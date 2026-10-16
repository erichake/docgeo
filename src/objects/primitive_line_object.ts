import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { PrefKey } from "../preferences";
import {
    GEOMETRY_EPSILON,
    geometryTolerance,
    vAdd,
    vDot,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import { construction_object } from "./construction_object";
import {
    hiddenIntervalsBetween,
    intervalsToPath,
    type Interval,
    type Split,
} from "./hidden_line";
import type { point_object } from "./point_object";
import type { polygon_object } from "./polygon_object";

// In 3D, an infinite line isn't run to the edge of the canvas, which has
// no relation to the scene: it is drawn Cabri-style, as long as the
// segment given by referenceSpan() (e.g. A-B for a two-point line), plus a
// short overhang on each side fading out. That overhang is a fixed screen
// length regardless of how long the segment itself is (matching Cabri
// Express: a long AB doesn't grow a long tail) — but, since it's applied
// to the already-projected reference points rather than measured against
// the viewport, it stays coherent under 3D rotation. In 2D, a line runs to
// the canvas edge, as in DGPad and GeoGebra: drawn partially, it would
// read as a segment.
const LINE_TIP_LENGTH = 100;

let tipGradients = 0;

function pointAtDistance(origin: Vec2, dir: Vec2, distance: number): Vec2 {
    return [origin[0] + distance * dir[0], origin[1] + distance * dir[1]];
}

// The parameters of the ends of the part of p + t·d (0 ≤ t ≤ 1) in the
// window, if any.
function windowSpan(
    p: Vec2,
    d: Vec2,
    width: number,
    height: number,
): [number, number] | null {
    let from = 0;
    let to = 1;
    for (const [start, delta, size] of [
        [p[0], d[0], width],
        [p[1], d[1], height],
    ]) {
        if (delta === 0) {
            if (start < 0 || start > size) return null;
            continue;
        }
        const a = -start / delta;
        const b = (size - start) / delta;
        from = Math.max(from, Math.min(a, b));
        to = Math.min(to, Math.max(a, b));
    }
    return from <= to ? [from, to] : null;
}

// The dashes of a stroke `length` long, its pattern starting at `phase`.
function dashIntervals(
    length: number,
    dash: number[],
    phase: number,
): Interval[] {
    const intervals: Interval[] = [];
    for (
        let s = -phase, i = 0;
        s < length;
        s += dash[i], i = (i + 1) % dash.length
    )
        if (i % 2 === 0)
            intervals.push([Math.max(s, 0), Math.min(s + dash[i], length)]);
    return intervals;
}

function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
    return a.flatMap(([from, to]) =>
        b.map(([start, end]): Interval => [
            Math.max(from, start),
            Math.min(to, end),
        ]),
    );
}

// Path for a tip from `base` to `apex`, drawn over the given distances
// from its base.
function tipPath(base: Vec2, apex: Vec2, intervals: Interval[]): string {
    const length = vNorm(vSub(apex, base));
    const at = (s: number): string => {
        const [x, y] = vAdd(base, vScale(vSub(apex, base), s / length));
        return `${x} ${y}`;
    };
    return intervals
        .filter(([from, to]) => to > from)
        .map(([from, to]) => `M${at(from)} L${at(to)}`)
        .join(" ");
}

export class primitive_line_object extends construction_object {
    P1: point_object;
    VEC: Vec3;
    sP1: Vec2 = [0, 0];
    sP2: Vec2 = [0, 0];
    // Full reach of the line (where the faded tips end), vs. sP1/sP2
    // where the solid/dashed body ends.
    // Only meaningful when partialDrawing is true.
    tipP1: Vec2 = [0, 0];
    tipP2: Vec2 = [0, 0];
    screenDir: Vec2 = [1, 0];
    projectionDefined: boolean;
    path!: DOMElement;
    hitArea!: DOMElement;
    hiddenPath!: DOMElement;
    // Only created for infinite lines, drawn partially in 3D.
    tipPath1!: DOMElement;
    tipPath2!: DOMElement;
    hiddenTipPath1!: DOMElement;
    hiddenTipPath2!: DOMElement;
    tipGradient1!: DOMElement;
    tipGradient2!: DOMElement;
    // False for segment_object, which has real endpoints.
    protected infinite = true;
    // A ray from P1, in the direction of VEC.
    protected oneSided = false;
    // Sub-ranges of [sP1, sP2] hidden behind some polygon, drawn on
    // hiddenPath (dashed) instead of path (solid), per hidden-line
    // convention. Subclasses that narrow sP1/sP2 (segment_object: exact
    // endpoints) recompute these afterward via updateHiddenSplit, since
    // they no longer match the range project() below assumes.
    protected hiddenIntervals: Interval[] = [];
    protected visibleIntervals: Interval[] = [[0, 1]];
    // The same for each tip, from its base to its apex.
    private tipSplits: [Split, Split] = [
        { hidden: [], visible: [] },
        { hidden: [], visible: [] },
    ];
    // Where its name was last written: GeoGebra keeps a line's by the end
    // nearest to it.
    private lastNameAt: Vec2 = [0, 0];

    constructor(
        c: construction,
        name: string | null | undefined,
        p: point_object,
        type?: PrefKey,
    ) {
        super(c, name, type ? type : "line");
        this.P1 = p;
        this.VEC = [1, 0, 0];
        this.projectionDefined = true;
        this.familytype = "line";
        this.addParents(p);
    }

    computeVEC(): Vec3 | null {
        return null;
    }

    insideBounds(_parameter: number): boolean {
        return true;
    }

    // Two world points lying on this line that give it a natural, intrinsic
    // scale (e.g. the two points a Line was built from). Overridden by
    // subclasses that have such points; null falls back to a fixed-length
    // extension. Only used when partialDrawing is true. A one-sided line's
    // span starts at P1.
    protected referenceSpan(): [Vec3, Vec3] | null {
        return null;
    }

    // World length of referenceSpan(), for lines (like Parallel) that
    // borrow their visual scale from another line rather than having their
    // own pair of points.
    characteristicLength(): number {
        const span = this.referenceSpan();
        return span ? vNorm(vSub(span[1], span[0])) : 1;
    }

    // Points that lie on this line without having defined it (an
    // intersection, a point dragged onto it, ...): Cabri still stretches
    // the drawn line to reach them, so referenceSpan() alone isn't enough.
    private onLinePoints(): Vec3[] {
        const tolerance = geometryTolerance(vNorm(this.P1.coords));
        return this.children
            .filter(
                (child): child is point_object =>
                    "coords" in child && child.defined,
            )
            .map((child) => child.coords)
            .filter((coords) => {
                const offset = vSub(coords, this.P1.coords);
                const along = vScale(this.VEC, vDot(offset, this.VEC));
                return vNorm(vSub(offset, along)) <= tolerance;
            });
    }

    // Stretches `span` (without ever shrinking it) so it also covers every
    // point in `points`.
    private expandSpan(span: [Vec3, Vec3], points: Vec3[]): [Vec3, Vec3] {
        const dir = vSub(span[1], span[0]);
        const length2 = vDot(dir, dir);
        if (length2 <= GEOMETRY_EPSILON) return span;
        let tMin = 0;
        let tMax = 1;
        for (const point of points) {
            const t = vDot(vSub(point, span[0]), dir) / length2;
            tMin = Math.min(tMin, t);
            tMax = Math.max(tMax, t);
        }
        return [
            vAdd(span[0], vScale(dir, tMin)),
            vAdd(span[0], vScale(dir, tMax)),
        ];
    }

    // Whether `polygon` is a face this line coincides with (one of its
    // edges, or an extension of one) and so should never occlude it.
    // two_points_line_object overrides this to check its own P1/P2; lines
    // derived from a direction rather than two named points (Parallel,
    // Perpendicular, PerpendicularBisector) have no such face to exclude.
    protected isOwnFace(_polygon: polygon_object): boolean {
        return false;
    }

    protected get partialDrawing(): boolean {
        return this.infinite && !this.C.GRID.is2D;
    }

    computeGeometry(): void {
        if (!this.P1.defined) {
            this.defined = false;
            return;
        }

        const vector = this.computeVEC();
        this.defined = vector !== null;
        if (!vector) return;

        this.VEC = vector;
    }

    project(): void {
        this.projectionDefined = false;
        if (!this.defined || !this.P1.projectionDefined) return;
        const sp = this.P1.screen;
        const screenVector = vNormalize(
            vSub(this.C.pt3D(vAdd(this.P1.coords, this.VEC)), sp),
        );
        if (!screenVector) return;

        this.projectionDefined = true;
        this.screenDir = screenVector;

        const baseSpan = this.partialDrawing ? this.referenceSpan() : null;
        const span = baseSpan && this.expandSpan(baseSpan, this.onLinePoints());
        if (span) {
            const bodyP1 = this.C.pt3D(span[0]);
            const bodyP2 = this.C.pt3D(span[1]);
            const bodyLength = vNorm(vSub(bodyP2, bodyP1));
            const dir =
                bodyLength > 1e-6
                    ? vScale(vSub(bodyP2, bodyP1), 1 / bodyLength)
                    : null;
            if (dir) {
                this.screenDir = dir;
                this.sP1 = bodyP1;
                this.sP2 = bodyP2;
                this.tipP1 = this.oneSided
                    ? bodyP1
                    : pointAtDistance(bodyP1, dir, -LINE_TIP_LENGTH);
                this.tipP2 = pointAtDistance(bodyP2, dir, LINE_TIP_LENGTH);
                this.updateHiddenSplit(span[0], span[1]);
                const reach = vScale(
                    vSub(span[1], span[0]),
                    LINE_TIP_LENGTH / bodyLength,
                );
                this.tipSplits = [
                    this.splitBetween(
                        bodyP1,
                        this.tipP1,
                        span[0],
                        vSub(span[0], reach),
                    ),
                    this.splitBetween(
                        bodyP2,
                        this.tipP2,
                        span[1],
                        vAdd(span[1], reach),
                    ),
                ];
                return;
            }
        }

        const length =
            this.C.width + this.C.height + Math.abs(sp[0]) + Math.abs(sp[1]);
        this.sP1 = this.oneSided
            ? sp
            : [
                  sp[0] - length * screenVector[0],
                  sp[1] - length * screenVector[1],
              ];
        this.sP2 = [
            sp[0] + length * screenVector[0],
            sp[1] + length * screenVector[1],
        ];
        this.tipP1 = this.sP1;
        this.tipP2 = this.sP2;
        const [point3D1, point3D2] = this.extendedPoints();
        this.updateHiddenSplit(
            this.oneSided ? this.P1.coords : point3D1,
            point3D2,
        );
    }

    // The 3D point lying `distance` screen pixels from P1 along the line's
    // projected direction: (parallel projection) this corresponds to a
    // proportional, constant 3D distance along VEC.
    private pointAtScreenDistance(distance: number): Vec3 {
        const sp = this.P1.screen;
        const rawVector = vSub(this.C.pt3D(vAdd(this.P1.coords, this.VEC)), sp);
        const rawLength = vNorm(rawVector);
        return vAdd(this.P1.coords, vScale(this.VEC, distance / rawLength));
    }

    // The 3D positions of the line's ends, run to the canvas edge both ways.
    private extendedPoints(): [Vec3, Vec3] {
        const sp = this.P1.screen;
        const length =
            this.C.width + this.C.height + Math.abs(sp[0]) + Math.abs(sp[1]);
        return [
            this.pointAtScreenDistance(-length),
            this.pointAtScreenDistance(length),
        ];
    }

    // Recomputes hiddenIntervals/visibleIntervals for the current sP1/sP2,
    // given the 3D positions matching them.
    protected updateHiddenSplit(point3D1: Vec3, point3D2: Vec3): void {
        ({ hidden: this.hiddenIntervals, visible: this.visibleIntervals } =
            this.splitBetween(this.sP1, this.sP2, point3D1, point3D2));
    }

    private splitBetween(
        sP1: Vec2,
        sP2: Vec2,
        point3D1: Vec3,
        point3D2: Vec3,
    ): Split {
        return hiddenIntervalsBetween(
            this.C,
            sP1,
            sP2,
            point3D1,
            point3D2,
            (polygon) => this.isOwnFace(polygon),
        );
    }

    // GeoGebra's DrawLine, DrawRay and DrawSegment: a line's name by the
    // window's edge, sloped away from it; a ray's or a segment's 16 pixels
    // beside the middle of its part in the window or of the whole.
    nameAt(): Vec2 | null {
        if (!this.projectionDefined) return null;
        const width = this.C.width;
        const height = this.C.height;
        const along = vSub(this.sP2, this.sP1);
        const span = this.infinite
            ? windowSpan(this.sP1, along, width, height)
            : [0, 1];
        if (!span) return null;
        const [a, b] = span.map((t) => vAdd(this.sP1, vScale(along, t)));
        if (this.oneSided || !this.infinite || this.partialDrawing)
            return vAdd(
                vScale(vAdd(a, b), 1 / 2),
                vScale(vNormalize([-along[1], along[0]])!, 16),
            );
        const [x, y] =
            vNorm(vSub(a, this.lastNameAt)) <= vNorm(vSub(b, this.lastNameAt))
                ? a
                : b;
        const slope = along[1] / along[0];
        const gap = 2 * y < height ? 16 : -8;
        const shift = 2 * x < width ? 8 : -16;
        this.lastNameAt =
            x < 1
                ? [5, y + gap + 16 * slope]
                : x > width - 1
                  ? [width - 15, y + gap - 16 * slope]
                  : y < 1
                    ? [x + shift + 16 / slope, 15]
                    : [x + shift - 16 / slope, height - 5];
        return this.lastNameAt;
    }

    // A moved name keeps its place from its point along nameAxis and, in
    // pixels, beside it.
    private nameFrame(): [Vec2, Vec2, Vec2] | null {
        const axis = this.nameAxis();
        const unit = vNormalize(axis);
        return unit && [this.P1.screen, axis, [-unit[1], unit[0]]];
    }

    // One pixel along it.
    protected nameAxis(): Vec2 {
        return (
            vNormalize(
                vSub(
                    this.C.pt3D(vAdd(this.P1.coords, this.VEC)),
                    this.P1.screen,
                ),
            ) ?? [0, 0]
        );
    }

    anchoredName([along, beside]: number[]): Vec2 | null {
        const frame = this.nameFrame();
        if (!frame) return null;
        const [origin, axis, normal] = frame;
        return vAdd(vAdd(origin, vScale(axis, along)), vScale(normal, beside));
    }

    anchorName(at: Vec2): number[] {
        const [origin, axis, normal] = this.nameFrame()!;
        const offset = vSub(at, origin);
        return [vDot(offset, axis) / vDot(axis, axis), vDot(offset, normal)];
    }

    // *************************************************
    // ****************** SVG PART **********************
    // *************************************************

    render(): void {
        this.dom.stl(
            "display",
            this.isVisible && this.projectionDefined ? "block" : "none",
        );
        if (!this.defined || !this.projectionDefined) return;
        const [hitP1, hitP2] = this.partialDrawing
            ? [this.tipP1, this.tipP2]
            : [this.sP1, this.sP2];
        this.hitArea.att(
            "d",
            `M${hitP1[0]} ${hitP1[1]} L${hitP2[0]} ${hitP2[1]}`,
        );
        this.path.att(
            "d",
            intervalsToPath(this.sP1, this.sP2, this.visibleIntervals),
        );
        this.hiddenPath.att(
            "d",
            intervalsToPath(this.sP1, this.sP2, this.hiddenIntervals),
        );
        if (this.partialDrawing) {
            const dashes = this.tipIntervals();
            for (const [i, path, hiddenPath, gradient, base, apex] of [
                [
                    0,
                    this.tipPath1,
                    this.hiddenTipPath1,
                    this.tipGradient1,
                    this.sP1,
                    this.tipP1,
                ],
                [
                    1,
                    this.tipPath2,
                    this.hiddenTipPath2,
                    this.tipGradient2,
                    this.sP2,
                    this.tipP2,
                ],
            ] as const) {
                const length = vNorm(vSub(apex, base));
                const { hidden, visible } = this.tipSplits[i];
                const along = (intervals: Interval[]): Interval[] =>
                    intervals.map(([from, to]) => [from * length, to * length]);
                path.att(
                    "d",
                    tipPath(
                        base,
                        apex,
                        intersectIntervals(dashes[i], along(visible)),
                    ),
                );
                hiddenPath.att("d", tipPath(base, apex, along(hidden)));
                const [x1, y1] = base;
                const [x2, y2] = apex;
                gradient
                    .att("x1", x1)
                    .att("y1", y1)
                    .att("x2", x2)
                    .att("y2", y2);
            }
        }
    }

    // Where each tip is drawn, from its base. Dashed, it continues the
    // body's pattern, which intervalsToPath starts at its leftmost end: the
    // tip there leads into it from its apex.
    private tipIntervals(): [Interval[], Interval[]] {
        const length1 = vNorm(vSub(this.tipP1, this.sP1));
        const length2 = vNorm(vSub(this.tipP2, this.sP2));
        const dash = this.dash;
        if (!dash.length) return [[[0, length1]], [[0, length2]]];
        const period = dash.reduce((sum, length) => sum + length);
        const body = vNorm(vSub(this.sP2, this.sP1)) % period;
        const leading = (length: number): Interval[] =>
            dashIntervals(
                length,
                dash,
                (period - (length % period)) % period,
            ).map(([from, to]) => [length - to, length - from]);
        const trailing = (length: number): Interval[] =>
            dashIntervals(length, dash, body);
        const [x1, y1] = this.sP1;
        const [x2, y2] = this.sP2;
        return x1 < x2 || (x1 === x2 && y1 <= y2)
            ? [leading(length1), trailing(length2)]
            : [trailing(length1), leading(length2)];
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as primitive_line_object;
        const dom = t.svg.shape("g");
        t.hitArea = t.svg
            .shape("path")
            .stl(
                "fill:none;stroke:transparent;pointer-events:stroke;cursor:pointer",
            )
            .stl("stroke-width", t.prefs[t.type].touchsize);
        t.path = t.svg
            .shape("path")
            .stl("fill", "none")
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("stroke-dasharray", t.strokeDashArray)
            .stl("pointer-events", "none");
        t.hiddenPath = t.svg
            .shape("path")
            .stl("fill", "none")
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("stroke-dasharray", `${t.size * 3} ${t.size * 2}`)
            .stl("pointer-events", "none");
        dom.add(t.hitArea, t.path, t.hiddenPath);
        if (!t.infinite) return dom;
        // userSpaceOnUse: a horizontal or vertical stroke has an empty
        // bounding box, which would cancel an objectBoundingBox gradient.
        const tip = (): [DOMElement, DOMElement, DOMElement] => {
            const id = `line-tip-gradient-${++tipGradients}`;
            const gradient = t.svg
                .shape("linearGradient")
                .att("id", id)
                .att("gradientUnits", "userSpaceOnUse")
                .add(
                    t.svg
                        .shape("stop")
                        .att("offset", 0)
                        .stl("stop-color", t.stroke_color),
                    t.svg
                        .shape("stop")
                        .att("offset", 1)
                        .stl("stop-color", t.stroke_color)
                        .stl("stop-opacity", 0),
                );
            const path = (dash: string) =>
                t.svg
                    .shape("path")
                    .stl("fill", "none")
                    .stl("stroke", `url(#${id})`)
                    .stl("stroke-width", t.size)
                    .stl("stroke-dasharray", dash)
                    .stl("pointer-events", "none");
            return [gradient, path(""), path(`${t.size * 3} ${t.size * 2}`)];
        };
        [t.tipGradient1, t.tipPath1, t.hiddenTipPath1] = tip();
        [t.tipGradient2, t.tipPath2, t.hiddenTipPath2] = tip();
        return dom.add(
            t.svg.shape("defs").add(t.tipGradient1, t.tipGradient2),
            t.tipPath1,
            t.tipPath2,
            t.hiddenTipPath1,
            t.hiddenTipPath2,
        );
    }
}
