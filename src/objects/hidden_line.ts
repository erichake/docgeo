import type { construction } from "../construction";
import { projectPointOnPlane, viewDirection } from "../projection";
import {
    GEOMETRY_EPSILON,
    geometryTolerance,
    pointInPolygon,
    segmentIntersectionParameter,
    vAdd,
    vDot,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import type { point_object } from "./point_object";
import type { polygon_object } from "./polygon_object";

// A sub-range of a segment's parameter (0 at p1, 1 at p2).
export type Interval = [number, number];

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
// for drawing the edge [p1, p2], among all polygons that share it.
export function ownsEdge(
    c: construction,
    polygon: polygon_object,
    p1: point_object,
    p2: point_object,
): boolean {
    return edgeOwners(c).get(edgeKey(p1, p2)) === polygon;
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
    bounds: { minCx: number; maxCx: number; minCy: number; maxCy: number } | null;
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
    const bounds = { minCx: Infinity, maxCx: -Infinity, minCy: Infinity, maxCy: -Infinity };
    (c.OBJS.polygons as polygon_object[]).forEach((polygon) => {
        if (!polygon.isVisible || polygon.points.length < 3) return;
        if (!polygon.points.every((p) => p.projectionDefined)) return;
        const xs = polygon.points.map((p) => p.screen[0]);
        const ys = polygon.points.map((p) => p.screen[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        bounds.minCx = Math.min(bounds.minCx, Math.floor(minX / GRID_CELL_SIZE));
        bounds.maxCx = Math.max(bounds.maxCx, Math.floor(maxX / GRID_CELL_SIZE));
        bounds.minCy = Math.min(bounds.minCy, Math.floor(minY / GRID_CELL_SIZE));
        bounds.maxCy = Math.max(bounds.maxCy, Math.floor(maxY / GRID_CELL_SIZE));
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
): Interval[] {
    return hiddenIntervalsBetween(
        c,
        p1.screen,
        p2.screen,
        p1.coords,
        p2.coords,
        (polygon) => polygon.points.includes(p1) && polygon.points.includes(p2),
    );
}

// Splits the screen segment [sP1, sP2] — whose 3D positions at t=0 and t=1
// are point3D1/point3D2 — into sub-ranges hidden behind some polygon closer
// to the camera, vs. the rest. A polygon hides a sub-range where it covers
// the segment's screen projection AND its plane is closer to the camera
// there. Both conditions are only evaluated at the midpoint of each
// candidate sub-range, delimited by where the segment crosses the polygon's
// outline or the depth difference changes sign — the depth difference is
// affine along the segment (parallel projection, planar polygon), so it
// crosses zero at most once per polygon. `isOwnFace` excludes polygons this
// segment is itself (or coincides with) an edge of.
export function hiddenIntervalsBetween(
    c: construction,
    sP1: Vec2,
    sP2: Vec2,
    point3D1: Vec3,
    point3D2: Vec3,
    isOwnFace: (polygon: polygon_object) => boolean,
): Interval[] {
    const frame = c.projectionFrame;
    const dir = viewDirection(frame);
    const breakpoints = new Set([0, 1]);
    const candidates: Array<{
        screenPoly: Vec2[];
        depthDiffAt: (t: number) => number;
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
        const depthDiffAt = (t: number): number => {
            const screen = vAdd(sP1, vScale(vSub(sP2, sP1), t));
            const point3D = vAdd(point3D1, vScale(vSub(point3D2, point3D1), t));
            const planePoint = projectPointOnPlane(screen, v0, basis, frame);
            if (!planePoint) return -Infinity;
            return vDot(point3D, dir) - vDot(planePoint, dir);
        };

        const d0 = depthDiffAt(0);
        const d1 = depthDiffAt(1);
        if (Number.isFinite(d0) && Number.isFinite(d1) && d0 !== d1) {
            const tCross = d0 / (d0 - d1);
            if (tCross > 0 && tCross < 1) breakpoints.add(tCross);
        }
        candidates.push({ screenPoly, depthDiffAt });
    });

    const sorted = [...breakpoints].sort((a, b) => a - b);
    const hidden: Interval[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
        const [a, b] = [sorted[i], sorted[i + 1]];
        if (b - a <= GEOMETRY_EPSILON) continue;
        const mid = (a + b) / 2;
        const midScreen = vAdd(sP1, vScale(vSub(sP2, sP1), mid));
        const isHidden = candidates.some(({ screenPoly, depthDiffAt }) => {
            if (!pointInPolygon(midScreen, screenPoly)) return false;
            const diff = depthDiffAt(mid);
            return diff > geometryTolerance(diff);
        });
        if (isHidden) hidden.push([a, b]);
    }
    return mergeIntervals(hidden);
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

// The complement of a sorted, disjoint set of hidden sub-ranges within
// [0, 1] — the visible sub-ranges.
export function complement(intervals: Interval[]): Interval[] {
    const visible: Interval[] = [];
    let cursor = 0;
    intervals.forEach(([start, end]) => {
        if (start - cursor > GEOMETRY_EPSILON) visible.push([cursor, start]);
        cursor = Math.max(cursor, end);
    });
    if (1 - cursor > GEOMETRY_EPSILON) visible.push([cursor, 1]);
    return visible;
}

// Renders a set of sub-ranges of [sP1, sP2] as disconnected SVG path
// commands, one "M...L..." per range.
export function intervalsToPath(
    sP1: Vec2,
    sP2: Vec2,
    intervals: Interval[],
): string {
    return intervals
        .map(([a, b]) => {
            const p0 = vAdd(sP1, vScale(vSub(sP2, sP1), a));
            const p1 = vAdd(sP1, vScale(vSub(sP2, sP1), b));
            return `M${p0[0]} ${p0[1]} L${p1[0]} ${p1[1]}`;
        })
        .join(" ");
}
