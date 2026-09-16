import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import { projectPointOnPlane, viewDirection } from "../projection";
import {
    GEOMETRY_EPSILON,
    geometryTolerance,
    pointInPolygon,
    segmentIntersectionParameter,
    vAdd,
    vDot,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import type { construction_object } from "./construction_object";
import type { point_object } from "./point_object";
import type { polygon_object } from "./polygon_object";
import { primitive_line_object } from "./primitive_line_object";
import { two_points_line_object } from "./two_points_line_object";

const FONT_MARGIN = 5;
const HALF_TURN = Math.PI;
const QUARTER_TURN = Math.PI / 2;

// A sub-range of the segment's parameter (0 at P1, 1 at P2).
type Interval = [number, number];

// Screen-space bucketing of polygons, so a segment only tests occlusion
// against polygons actually near it instead of every polygon in the scene.
// Rebuilt at most once per projection update (keyed by objects_collector's
// frame counter), then shared by every segment that projects that frame.
const GRID_CELL_SIZE = 128;
const polygonGridCache = new WeakMap<
    construction,
    { frame: number; cells: Map<string, polygon_object[]> }
>();

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

function polygonGrid(c: construction): Map<string, polygon_object[]> {
    const cached = polygonGridCache.get(c);
    if (cached && cached.frame === c.OBJS.frame) return cached.cells;

    const cells = new Map<string, polygon_object[]>();
    (c.OBJS.polygons as polygon_object[]).forEach((polygon) => {
        if (!polygon.isVisible || polygon.points.length < 3) return;
        if (!polygon.points.every((p) => p.projectionDefined)) return;
        const xs = polygon.points.map((p) => p.screen[0]);
        const ys = polygon.points.map((p) => p.screen[1]);
        forEachCell(
            Math.min(...xs),
            Math.max(...xs),
            Math.min(...ys),
            Math.max(...ys),
            (key) => {
                const bucket = cells.get(key);
                if (bucket) bucket.push(polygon);
                else cells.set(key, [polygon]);
            },
        );
    });
    polygonGridCache.set(c, { frame: c.OBJS.frame, cells });
    return cells;
}

function nearbyPolygons(
    c: construction,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
): polygon_object[] {
    const cells = polygonGrid(c);
    const found = new Set<polygon_object>();
    forEachCell(minX, maxX, minY, maxY, (key) => {
        cells.get(key)?.forEach((polygon) => found.add(polygon));
    });
    return [...found];
}

export class segment_object extends two_points_line_object {
    lengthText?: DOMElement;
    hiddenPath!: DOMElement;
    // Sub-ranges of the segment hidden behind some polygon, drawn on
    // hiddenPath (dashed) instead of path (solid), per hidden-line
    // convention.
    private hiddenIntervals: Interval[] = [];
    private visibleIntervals: Interval[] = [[0, 1]];

    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        p2: point_object,
    ) {
        super(c, name, p1, p2, "segment");
    }

    project(): void {
        super.project();
        if (
            !this.defined ||
            !this.projectionDefined ||
            !this.P2.projectionDefined
        ) {
            this.projectionDefined = false;
            return;
        }
        this.sP1 = this.P1.screen;
        this.sP2 = this.P2.screen;
        this.projectionDefined = vNormalize(vSub(this.sP2, this.sP1)) !== null;
        this.hiddenIntervals = this.projectionDefined
            ? this.computeHiddenIntervals()
            : [];
        this.visibleIntervals = complement(this.hiddenIntervals);
    }

    // Splits the segment into sub-ranges hidden behind some polygon closer
    // to the camera, vs. the rest. A polygon hides a sub-range where it
    // covers the segment's screen projection AND its plane is closer to the
    // camera there. Both conditions are only evaluated at the midpoint of
    // each candidate sub-range, delimited by where the segment crosses the
    // polygon's outline or the depth difference changes sign — the depth
    // difference is affine along the segment (parallel projection, planar
    // polygon), so it crosses zero at most once per polygon.
    private computeHiddenIntervals(): Interval[] {
        const frame = this.C.projectionFrame;
        const dir = viewDirection(frame);
        const breakpoints = new Set([0, 1]);
        const candidates: Array<{
            screenPoly: Vec2[];
            depthDiffAt: (t: number) => number;
        }> = [];

        const segMinX = Math.min(this.sP1[0], this.sP2[0]);
        const segMaxX = Math.max(this.sP1[0], this.sP2[0]);
        const segMinY = Math.min(this.sP1[1], this.sP2[1]);
        const segMaxY = Math.max(this.sP1[1], this.sP2[1]);

        nearbyPolygons(this.C, segMinX, segMaxX, segMinY, segMaxY).forEach(
            (polygon) => {
                if (
                    polygon.points.includes(this.P1) &&
                    polygon.points.includes(this.P2)
                )
                    return;

                const screenPoly = polygon.points.map((p) => p.screen);
                // Exact bounding-box check: the grid only guarantees the
                // polygon shares a cell with the segment, not a true overlap.
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
                    const t = segmentIntersectionParameter(
                        this.sP1,
                        this.sP2,
                        a,
                        b,
                    );
                    if (t !== null) breakpoints.add(t);
                });

                const [v0, v1, v2] = polygon.points.map((p) => p.coords);
                const basis: [Vec3, Vec3] = [vSub(v1, v0), vSub(v2, v0)];
                const depthDiffAt = (t: number): number => {
                    const screen = vAdd(
                        this.sP1,
                        vScale(vSub(this.sP2, this.sP1), t),
                    );
                    const point3D = vAdd(
                        this.P1.coords,
                        vScale(vSub(this.P2.coords, this.P1.coords), t),
                    );
                    const planePoint = projectPointOnPlane(
                        screen,
                        v0,
                        basis,
                        frame,
                    );
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
            },
        );

        const sorted = [...breakpoints].sort((a, b) => a - b);
        const hidden: Interval[] = [];
        for (let i = 0; i < sorted.length - 1; i++) {
            const [a, b] = [sorted[i], sorted[i + 1]];
            if (b - a <= GEOMETRY_EPSILON) continue;
            const mid = (a + b) / 2;
            const midScreen = vAdd(
                this.sP1,
                vScale(vSub(this.sP2, this.sP1), mid),
            );
            const isHidden = candidates.some(({ screenPoly, depthDiffAt }) => {
                if (!pointInPolygon(midScreen, screenPoly)) return false;
                const diff = depthDiffAt(mid);
                return diff > geometryTolerance(diff);
            });
            if (isHidden) hidden.push([a, b]);
        }
        return mergeIntervals(hidden);
    }

    insideBounds(parameter: number): boolean {
        const length = vNorm(vSub(this.P2.coords, this.P1.coords));
        const tolerance = geometryTolerance(length);
        return parameter >= -tolerance && parameter <= length + tolerance;
    }

    render(): void {
        super.render();
        if (this.defined && this.projectionDefined) {
            this.path.att("d", this.pathData(this.visibleIntervals));
            this.hiddenPath.att("d", this.pathData(this.hiddenIntervals));
        }
        if (!this.lengthText) return;
        if (!this.defined || !this.projectionDefined) return;

        const midx = (this.sP1[0] + this.sP2[0]) / 2;
        const midy = (this.sP1[1] + this.sP2[1]) / 2;
        let angle = Math.atan2(
            this.sP2[1] - this.sP1[1],
            this.sP2[0] - this.sP1[0],
        );
        if (angle < -QUARTER_TURN || angle > QUARTER_TURN) angle += HALF_TURN;

        const offset = FONT_MARGIN + this.size / 2;
        this.lengthText
            .att(
                "transform",
                `translate(${midx} ${midy}) rotate(${(angle * 180) / Math.PI})`,
            )
            .att("y", -offset)
            .text(
                formatLength(
                    vNorm(vSub(this.P2.coords, this.P1.coords)),
                    this.precision,
                ),
            );
    }

    private pathData(intervals: Interval[]): string {
        return intervals
            .map(([a, b]) => {
                const p0 = vAdd(this.sP1, vScale(vSub(this.sP2, this.sP1), a));
                const p1 = vAdd(this.sP1, vScale(vSub(this.sP2, this.sP1), b));
                return `M${p0[0]} ${p0[1]} L${p1[0]} ${p1[1]}`;
            })
            .join(" ");
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as segment_object;
        const dom = primitive_line_object.createSVG(t);
        t.hiddenPath = t.svg
            .shape("path")
            .stl("fill", "none")
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("stroke-dasharray", `${t.size * 3} ${t.size * 2}`)
            .stl("pointer-events", "none");
        dom.add(t.hiddenPath);
        if (t.precision < 0) return dom;

        t.lengthText = t.svg
            .shape("text")
            .att("x", 0)
            .att("text-anchor", "middle")
            .stl(
                `fill:${t.stroke_color};font-family:Verdana;font-size:${t.fontSize}px;pointer-events:none`,
            );
        return dom.add(t.lengthText);
    }
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

function complement(intervals: Interval[]): Interval[] {
    const visible: Interval[] = [];
    let cursor = 0;
    intervals.forEach(([start, end]) => {
        if (start - cursor > GEOMETRY_EPSILON) visible.push([cursor, start]);
        cursor = Math.max(cursor, end);
    });
    if (1 - cursor > GEOMETRY_EPSILON) visible.push([cursor, 1]);
    return visible;
}

function formatLength(value: number, precision: number): string {
    const factor = 10 ** precision;
    return (Math.round(value * factor) / factor).toString().replace(".", ",");
}

export function createSegment(
    c: construction,
    name: string | null | undefined,
    p1: point_object,
    p2: point_object,
): segment_object {
    return c.add(new segment_object(c, name, p1, p2));
}
