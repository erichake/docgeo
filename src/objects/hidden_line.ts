import type { construction } from "../construction";
import {
    projectPointOnLine,
    projectPointOnPlane,
    viewDirection,
} from "../projection";
import {
    GEOMETRY_EPSILON,
    geometryTolerance,
    pointInPolygon,
    segmentIntersectionParameter,
    vAdd,
    vCross,
    vDot,
    vNormalize,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import type { point_object } from "./point_object";
import type { polygon_object } from "./polygon_object";
import type { two_points_line_object } from "./two_points_line_object";

// A sub-range of a segment's parameter (0 at p1, 1 at p2).
export type Interval = [number, number];

// Where a segment is drawn: solid, dashed behind a transparent polygon, and
// not at all behind an opaque one, as GeoGebra's depth buffer does.
export interface Split {
    visible: Interval[];
    hidden: Interval[];
}

const isOpaque = (polygon: polygon_object): boolean =>
    (polygon.opacity ?? 0) >= 1;

// When two polygons share an edge (e.g. adjacent faces of a solid), only
// one of them should draw it — otherwise each draws its own independently
// dashed copy, and since they run in opposite directions the two dash
// patterns fall out of phase and their gaps fill each other in, making the
// shared edge look solid. Cached per frame like the polygon grid below.
const edgeOwnerCache = new WeakMap<
    construction,
    { frame: number; owners: Map<string, polygon_object> }
>();

function edgeKey(p1: point_object, p2: point_object): string {
    return p1.sequence < p2.sequence
        ? `${p1.sequence}:${p2.sequence}`
        : `${p2.sequence}:${p1.sequence}`;
}

function edgeOwners(c: construction): Map<string, polygon_object> {
    const cached = edgeOwnerCache.get(c);
    if (cached && cached.frame === c.OBJS.frame) return cached.owners;

    const owners = new Map<string, polygon_object>();
    (c.OBJS.polygons as polygon_object[]).forEach((polygon) => {
        polygon.points.forEach((p1, i) => {
            const p2 = polygon.points[(i + 1) % polygon.points.length];
            const key = edgeKey(p1, p2);
            if (!owners.has(key)) owners.set(key, polygon);
        });
    });
    edgeOwnerCache.set(c, { frame: c.OBJS.frame, owners });
    return owners;
}

// Whether `polygon` is the (single, arbitrary but stable) owner responsible
// for drawing the edge [p1, p2], among all polygons that share it. A
// visible segment joining p1 and p2 draws that edge itself instead, for
// the same out-of-phase dashing reason as above.
export function ownsEdge(
    c: construction,
    polygon: polygon_object,
    p1: point_object,
    p2: point_object,
): boolean {
    const drawnBySegment = p1.children.some((child) => {
        if (child.type !== "segment" || !child.isVisible) return false;
        const segment = child as two_points_line_object;
        return segment.P1 === p2 || segment.P2 === p2;
    });
    return !drawnBySegment && edgeOwners(c).get(edgeKey(p1, p2)) === polygon;
}

// Screen-space bucketing of polygons, so a segment only tests occlusion
// against polygons actually near it instead of every polygon in the scene.
// Rebuilt at most once per projection update (keyed by objects_collector's
// frame counter), then shared by every segment/edge that projects that
// frame.
const GRID_CELL_SIZE = 128;
type PolygonGrid = {
    frame: number;
    cells: Map<string, polygon_object[]>;
    // Cell range actually populated by a polygon, so a query bbox that is far
    // larger than the scene itself (e.g. a Line/Ray's synthetic far point
    // during a transient near-degenerate drag) can be clamped down instead of
    // walking every empty cell between here and there.
    bounds: {
        minCx: number;
        maxCx: number;
        minCy: number;
        maxCy: number;
    } | null;
};
const polygonGridCache = new WeakMap<construction, PolygonGrid>();

function forEachCell(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    visit: (key: string) => void,
): void {
    const minCx = Math.floor(minX / GRID_CELL_SIZE);
    const maxCx = Math.floor(maxX / GRID_CELL_SIZE);
    const minCy = Math.floor(minY / GRID_CELL_SIZE);
    const maxCy = Math.floor(maxY / GRID_CELL_SIZE);
    for (let cx = minCx; cx <= maxCx; cx++)
        for (let cy = minCy; cy <= maxCy; cy++) visit(`${cx},${cy}`);
}

function polygonGrid(c: construction): PolygonGrid {
    const cached = polygonGridCache.get(c);
    if (cached && cached.frame === c.OBJS.frame) return cached;

    const cells = new Map<string, polygon_object[]>();
    const bounds = {
        minCx: Infinity,
        maxCx: -Infinity,
        minCy: Infinity,
        maxCy: -Infinity,
    };
    (c.OBJS.polygons as polygon_object[]).forEach((polygon) => {
        if (!polygon.isVisible || polygon.points.length < 3) return;
        if (!polygon.points.every((p) => p.projectionDefined)) return;
        const xs = polygon.points.map((p) => p.screen[0]);
        const ys = polygon.points.map((p) => p.screen[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        bounds.minCx = Math.min(
            bounds.minCx,
            Math.floor(minX / GRID_CELL_SIZE),
        );
        bounds.maxCx = Math.max(
            bounds.maxCx,
            Math.floor(maxX / GRID_CELL_SIZE),
        );
        bounds.minCy = Math.min(
            bounds.minCy,
            Math.floor(minY / GRID_CELL_SIZE),
        );
        bounds.maxCy = Math.max(
            bounds.maxCy,
            Math.floor(maxY / GRID_CELL_SIZE),
        );
        forEachCell(minX, maxX, minY, maxY, (key) => {
            const bucket = cells.get(key);
            if (bucket) bucket.push(polygon);
            else cells.set(key, [polygon]);
        });
    });
    const grid: PolygonGrid = {
        frame: c.OBJS.frame,
        cells,
        bounds: cells.size > 0 ? bounds : null,
    };
    polygonGridCache.set(c, grid);
    return grid;
}

function nearbyPolygons(
    c: construction,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
): polygon_object[] {
    const { cells, bounds } = polygonGrid(c);
    if (!bounds) return [];

    // Clamp the query to cells that actually hold a polygon: a Line/Ray's
    // screen segment is synthetically extended far past the viewport (see
    // primitive_line_object.project), and during a fast drag through a
    // near-degenerate construction that extension can briefly span an
    // enormous range — walking every empty cell in between would hang the
    // main thread rather than just return no candidates.
    const minCx = Math.max(Math.floor(minX / GRID_CELL_SIZE), bounds.minCx);
    const maxCx = Math.min(Math.floor(maxX / GRID_CELL_SIZE), bounds.maxCx);
    const minCy = Math.max(Math.floor(minY / GRID_CELL_SIZE), bounds.minCy);
    const maxCy = Math.min(Math.floor(maxY / GRID_CELL_SIZE), bounds.maxCy);
    if (minCx > maxCx || minCy > maxCy) return [];

    const found = new Set<polygon_object>();
    for (let cx = minCx; cx <= maxCx; cx++)
        for (let cy = minCy; cy <= maxCy; cy++)
            cells.get(`${cx},${cy}`)?.forEach((polygon) => found.add(polygon));
    return [...found];
}

// Splits [p1, p2] into sub-ranges hidden behind some polygon closer to the
// camera, vs. the rest. A polygon that has both p1 and p2 as vertices is
// skipped, since it is coplanar with [p1, p2] (its own edge, or another
// face's edge sharing it) rather than in front of it. See
// hiddenIntervalsBetween for how the split itself is computed.
export function hiddenIntervals(
    c: construction,
    p1: point_object,
    p2: point_object,
): Split {
    return hiddenIntervalsBetween(
        c,
        p1.screen,
        p2.screen,
        p1.coords,
        p2.coords,
        (polygon) => polygon.points.includes(p1) && polygon.points.includes(p2),
    );
}

// Number of samples used to hunt for depth-difference sign changes under
// perspective (see hiddenIntervalsBetween). The function is a ratio of
// degree-<=3 polynomials in t, so a handful of samples is enough in practice
// without the cost of solving that ratio for its roots exactly.
const DEPTH_SAMPLE_COUNT = 8;
const BISECTION_STEPS = 20;

function bisectZero(
    f: (t: number) => number,
    a: number,
    fa: number,
    b: number,
): number {
    for (let i = 0; i < BISECTION_STEPS; i++) {
        const mid = (a + b) / 2;
        const fm = f(mid);
        if (fm < 0 === fa < 0) {
            a = mid;
            fa = fm;
        } else {
            b = mid;
        }
    }
    return (a + b) / 2;
}

function findDepthCrossings(
    depthDiffAt: (t: number) => number,
    d0: number,
    d1: number,
): number[] {
    const crossings: number[] = [];
    let prevT = 0;
    let prevD = d0;
    for (let i = 1; i <= DEPTH_SAMPLE_COUNT; i++) {
        const t = i / DEPTH_SAMPLE_COUNT;
        const d = i === DEPTH_SAMPLE_COUNT ? d1 : depthDiffAt(t);
        if (
            Number.isFinite(prevD) &&
            Number.isFinite(d) &&
            prevD !== 0 &&
            d !== 0 &&
            prevD < 0 !== d < 0
        ) {
            crossings.push(bisectZero(depthDiffAt, prevT, prevD, t));
        }
        prevT = t;
        prevD = d;
    }
    return crossings;
}

// Splits the screen segment [sP1, sP2] — whose 3D positions at t=0 and t=1
// are point3D1/point3D2 — into sub-ranges hidden behind some polygon closer
// to the camera, vs. the rest. A polygon hides a sub-range where it covers
// the segment's screen projection AND its plane is closer to the camera
// there. Both conditions are only evaluated at the midpoint of each
// candidate sub-range, delimited by where the segment crosses the polygon's
// outline or the depth difference changes sign. Under parallel projection
// the depth difference is affine along the segment, so it crosses zero at
// most once per polygon and that crossing is solved for directly; under
// perspective it's a ratio of low-degree polynomials in t (screen position
// and 3D position along the segment no longer move in lockstep) that can
// cross zero more than once, so crossings are instead located by sampling
// and bisection (see findDepthCrossings). `isOwnFace` excludes polygons
// this segment is itself (or coincides with) an edge of.
export function hiddenIntervalsBetween(
    c: construction,
    sP1: Vec2,
    sP2: Vec2,
    point3D1: Vec3,
    point3D2: Vec3,
    isOwnFace: (polygon: polygon_object) => boolean,
): Split {
    const frame = c.projectionFrame;
    // Normalized so depth differences are in world units: a polygon
    // coplanar with the segment (e.g. a face sharing it as an edge through
    // other, coincident vertices) then stays within geometryTolerance
    // instead of randomly occluding it through rounding noise.
    const dir = vNormalize(viewDirection(frame))!;
    const breakpoints = new Set([0, 1]);
    const candidates: Array<{
        screenPoly: Vec2[];
        depthDiffAt: (t: number) => number;
        opaque: boolean;
    }> = [];

    const segMinX = Math.min(sP1[0], sP2[0]);
    const segMaxX = Math.max(sP1[0], sP2[0]);
    const segMinY = Math.min(sP1[1], sP2[1]);
    const segMaxY = Math.max(sP1[1], sP2[1]);

    nearbyPolygons(c, segMinX, segMaxX, segMinY, segMaxY).forEach((polygon) => {
        if (isOwnFace(polygon)) return;

        const screenPoly = polygon.points.map((p) => p.screen);
        // Exact bounding-box check: the grid only guarantees the polygon
        // shares a cell with the segment, not a true overlap.
        const polyXs = screenPoly.map((p) => p[0]);
        const polyYs = screenPoly.map((p) => p[1]);
        if (
            Math.max(...polyXs) < segMinX ||
            Math.min(...polyXs) > segMaxX ||
            Math.max(...polyYs) < segMinY ||
            Math.min(...polyYs) > segMaxY
        )
            return;

        screenPoly.forEach((a, i) => {
            const b = screenPoly[(i + 1) % screenPoly.length];
            const t = segmentIntersectionParameter(sP1, sP2, a, b);
            if (t !== null) breakpoints.add(t);
        });

        const [v0, v1, v2] = polygon.points.map((p) => p.coords);
        const basis: [Vec3, Vec3] = [vSub(v1, v0), vSub(v2, v0)];
        const segmentDir = vSub(point3D2, point3D1);
        const depthDiffAt = (t: number): number => {
            const screen = vAdd(sP1, vScale(vSub(sP2, sP1), t));
            const point3D =
                frame.focal === undefined
                    ? vAdd(point3D1, vScale(segmentDir, t))
                    : projectPointOnLine(screen, point3D1, segmentDir, frame);
            const planePoint = projectPointOnPlane(screen, v0, basis, frame);
            if (!point3D || !planePoint) return -Infinity;
            return vDot(point3D, dir) - vDot(planePoint, dir);
        };

        const d0 = depthDiffAt(0);
        const d1 = depthDiffAt(1);
        if (frame.focal === undefined) {
            if (Number.isFinite(d0) && Number.isFinite(d1) && d0 !== d1) {
                const tCross = d0 / (d0 - d1);
                if (tCross > 0 && tCross < 1) breakpoints.add(tCross);
            }
        } else {
            findDepthCrossings(depthDiffAt, d0, d1).forEach((t) =>
                breakpoints.add(t),
            );
        }
        candidates.push({ screenPoly, depthDiffAt, opaque: isOpaque(polygon) });
    });

    const sorted = [...breakpoints].sort((a, b) => a - b);
    const visible: Interval[] = [];
    const hidden: Interval[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
        const [a, b] = [sorted[i], sorted[i + 1]];
        if (b - a <= GEOMETRY_EPSILON) continue;
        const mid = (a + b) / 2;
        const midScreen = vAdd(sP1, vScale(vSub(sP2, sP1), mid));
        const covering = candidates.filter(({ screenPoly, depthDiffAt }) => {
            if (!pointInPolygon(midScreen, screenPoly)) return false;
            const diff = depthDiffAt(mid);
            return diff > geometryTolerance(diff);
        });
        if (covering.length === 0) visible.push([a, b]);
        else if (!covering.some(({ opaque }) => opaque)) hidden.push([a, b]);
    }
    return { visible: mergeIntervals(visible), hidden: mergeIntervals(hidden) };
}

// The depth (see viewDirection) of `polygon`'s plane at `screen`, or null
// if it projects edge-on.
function planeDepth(
    c: construction,
    polygon: polygon_object,
    screen: Vec2,
): number | null {
    const frame = c.projectionFrame;
    const [v0, v1, v2] = polygon.points.map((p) => p.coords);
    const point = projectPointOnPlane(
        screen,
        v0,
        [vSub(v1, v0), vSub(v2, v0)],
        frame,
    );
    return point && vDot(point, vNormalize(viewDirection(frame))!);
}

// Whether an opaque polygon, other than one of its own faces, hides `point`.
export function isOccluded(c: construction, point: point_object): boolean {
    const [x, y] = point.screen;
    const depth = vDot(
        point.coords,
        vNormalize(viewDirection(c.projectionFrame))!,
    );
    return nearbyPolygons(c, x, x, y, y).some((polygon) => {
        if (
            !isOpaque(polygon) ||
            polygon.points.includes(point) ||
            !pointInPolygon(
                point.screen,
                polygon.points.map((p) => p.screen),
            )
        )
            return false;
        const plane = planeDepth(c, polygon, point.screen);
        if (plane === null) return false;
        const diff = depth - plane;
        return diff > geometryTolerance(diff);
    });
}

// The part of the convex polygon `subject` inside the convex polygon
// `clip`.
function clipPolygon(subject: Vec2[], clip: Vec2[]): Vec2[] {
    const orientation = Math.sign(signedArea(clip));
    return clip.reduce((kept, a, index) => {
        const b = clip[(index + 1) % clip.length];
        const side = ([x, y]: Vec2): number =>
            orientation *
            ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]));
        return kept.flatMap((current, position) => {
            const previous = kept[(position + kept.length - 1) % kept.length];
            const [sa, sb] = [side(previous), side(current)];
            const crossing: Vec2[] =
                sa >= 0 !== sb >= 0
                    ? [
                          vAdd(
                              previous,
                              vScale(vSub(current, previous), sa / (sa - sb)),
                          ),
                      ]
                    : [];
            return sb >= 0 ? [...crossing, current] : crossing;
        });
    }, subject);
}

function signedArea(polygon: Vec2[]): number {
    return (
        polygon.reduce((sum, [x0, y0], index) => {
            const [x1, y1] = polygon[(index + 1) % polygon.length];
            return sum + x0 * y1 - x1 * y0;
        }, 0) / 2
    );
}

// Overlaps thinner than this (square pixels), e.g. along the edge two
// faces share, don't order them.
const MIN_OVERLAP = 0.5;

// Positive if `p` is behind `q` where their projections overlap, negative
// if in front, 0 if they don't overlap or lie in the same plane.
function depthOrder(
    c: construction,
    p: polygon_object,
    q: polygon_object,
): number {
    const [v0, v1, v2] = p.points.map((point) => point.coords);
    const normal = vNormalize(vCross(vSub(v1, v0), vSub(v2, v0)));
    if (
        !normal ||
        q.points.every((point) => {
            const offset = vDot(normal, vSub(point.coords, v0));
            return Math.abs(offset) <= geometryTolerance(offset);
        })
    )
        return 0;
    const [sp, sq] = [p, q].map((polygon) =>
        polygon.points.map((point) => point.screen),
    );
    const overlap = clipPolygon(sp, sq);
    if (overlap.length < 3 || Math.abs(signedArea(overlap)) < MIN_OVERLAP)
        return 0;
    const center = vScale(overlap.reduce(vAdd), 1 / overlap.length);
    if (!pointInPolygon(center, sp) || !pointInPolygon(center, sq)) return 0;
    const [dp, dq] = [p, q].map((polygon) => planeDepth(c, polygon, center));
    if (dp === null || dq === null) return 0;
    const diff = dp - dq;
    return Math.abs(diff) > geometryTolerance(diff) ? Math.sign(diff) : 0;
}

// Paints the polygons farthest first wherever their projections overlap,
// as GeoGebra's depth buffer does for faces that don't cut through each
// other. Planes keep their own layer, beneath (see polygon_object.plane).
export function paintByDepth(c: construction): void {
    const polygons = (c.OBJS.polygons as polygon_object[]).filter(
        (polygon) => polygon.hasView && polygon.isVisible && !polygon.plane,
    );
    const indices = new Map(polygons.map((polygon, index) => [polygon, index]));
    const nearer: number[][] = polygons.map(() => []);
    const farther = polygons.map(() => 0);
    polygons.forEach((p, i) => {
        const xs = p.points.map((point) => point.screen[0]);
        const ys = p.points.map((point) => point.screen[1]);
        nearbyPolygons(
            c,
            Math.min(...xs),
            Math.max(...xs),
            Math.min(...ys),
            Math.max(...ys),
        ).forEach((q) => {
            const j = indices.get(q);
            if (j === undefined || j <= i) return;
            const order = depthOrder(c, p, q);
            if (order === 0) return;
            const [back, front] = order > 0 ? [i, j] : [j, i];
            nearer[back].push(front);
            farther[front]++;
        });
    });
    // Construction order among those not ordered by depth.
    const ready = polygons.flatMap((_, index) =>
        farther[index] === 0 ? [index] : [],
    );
    const order: number[] = [];
    while (ready.length > 0) {
        const index = ready.shift()!;
        order.push(index);
        nearer[index].forEach((front) => {
            if (--farther[front] > 0) return;
            const position = ready.findIndex((other) => other > front);
            ready.splice(position < 0 ? ready.length : position, 0, front);
        });
    }
    // A cycle is left in construction order.
    polygons.forEach((_, index) => {
        if (farther[index] > 0) order.push(index);
    });
    const layer = c.layers.get(c.prefs.polygon.layer)!;
    const position = new Map(
        [...layer.dom().children].map((element, index) => [element, index]),
    );
    const painted = order.map((index) => polygons[index].dom);
    if (
        painted.every(
            (dom, index) =>
                index === 0 ||
                position.get(painted[index - 1].dom())! <
                    position.get(dom.dom())!,
        )
    )
        return;
    painted.forEach((dom) => layer.add(dom));
}

function mergeIntervals(intervals: Interval[]): Interval[] {
    const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
    const merged: Interval[] = [];
    sorted.forEach(([start, end]) => {
        const last = merged[merged.length - 1];
        if (last && start <= last[1] + GEOMETRY_EPSILON)
            last[1] = Math.max(last[1], end);
        else merged.push([start, end]);
    });
    return merged;
}

// Renders a set of sub-ranges of [sP1, sP2] as disconnected SVG path
// commands, one "M...L..." per range. Each range starts from its leftmost
// (then topmost) end whichever way the segment runs, so that coincident
// strokes (e.g. [G,C] and [C,G'] with G' on G) share the same dash phase
// instead of filling each other's gaps.
export function intervalsToPath(
    sP1: Vec2,
    sP2: Vec2,
    intervals: Interval[],
): string {
    return intervals
        .map(([a, b]) => {
            let p0 = vAdd(sP1, vScale(vSub(sP2, sP1), a));
            let p1 = vAdd(sP1, vScale(vSub(sP2, sP1), b));
            if (p1[0] < p0[0] || (p1[0] === p0[0] && p1[1] < p0[1]))
                [p0, p1] = [p1, p0];
            return `M${p0[0]} ${p0[1]} L${p1[0]} ${p1[1]}`;
        })
        .join(" ");
}
