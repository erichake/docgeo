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
    complement,
    hiddenIntervalsBetween,
    intervalsToPath,
    type Interval,
} from "./hidden_line";
import type { point_object } from "./point_object";
import type { polygon_object } from "./polygon_object";

// Cabri-style rendering for a truly infinite line: rather than running the
// stroke to the edge of the canvas (which, under a 3D rotation or a window
// resize, has no relation to the geometry at all), it is drawn as long as
// the segment given by referenceSpan() (e.g. A-B for a two-point line),
// plus a short tapered overhang on each side. That overhang is a fixed
// screen length regardless of how long the segment itself is (matching
// Cabri Express: a long AB doesn't grow a long tail) — but, since it's
// applied to the already-projected reference points rather than measured
// against the viewport, it stays coherent under pan/zoom/3D rotation and
// doesn't depend on window size.
const LINE_TIP_LENGTH = 100;

function pointAtDistance(origin: Vec2, dir: Vec2, distance: number): Vec2 {
    return [origin[0] + distance * dir[0], origin[1] + distance * dir[1]];
}

// Path for a tapered tip: a triangle from `base` (as wide as the stroke,
// offset by +/-perp) narrowing to a point at `apex`.
function tipTrianglePath(base: Vec2, apex: Vec2, perp: Vec2): string {
    return `M${base[0] + perp[0]} ${base[1] + perp[1]} L${apex[0]} ${apex[1]} L${base[0] - perp[0]} ${base[1] - perp[1]} Z`;
}

export class primitive_line_object extends construction_object {
    P1: point_object;
    VEC: Vec3;
    sP1: Vec2 = [0, 0];
    sP2: Vec2 = [0, 0];
    // Full reach of the line (where the tapered tips end), vs. sP1/sP2
    // which are pulled back by the taper length for the solid/dashed body.
    // Only meaningful when showTips is true.
    tipP1: Vec2 = [0, 0];
    tipP2: Vec2 = [0, 0];
    screenDir: Vec2 = [1, 0];
    projectionDefined: boolean;
    path!: DOMElement;
    hitArea!: DOMElement;
    hiddenPath!: DOMElement;
    tipPath1!: DOMElement;
    tipPath2!: DOMElement;
    // Whether this line draws tapered Cabri-style tips instead of running
    // to the canvas edge. True for genuinely infinite lines; segment_object
    // and ray_line_object (which have real endpoints) turn it off.
    protected showTips = true;
    // Sub-ranges of [sP1, sP2] hidden behind some polygon, drawn on
    // hiddenPath (dashed) instead of path (solid), per hidden-line
    // convention. Subclasses that narrow sP1/sP2 (segment_object: exact
    // endpoints; ray_line_object: one-sided) recompute these afterward via
    // updateHiddenSplit, since they no longer match the doubly-extended
    // range project() below assumes.
    protected hiddenIntervals: Interval[] = [];
    protected visibleIntervals: Interval[] = [[0, 1]];

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
    // extension. Not used when showTips is false.
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

        const baseSpan = this.showTips ? this.referenceSpan() : null;
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
                this.tipP1 = pointAtDistance(bodyP1, dir, -LINE_TIP_LENGTH);
                this.tipP2 = pointAtDistance(bodyP2, dir, LINE_TIP_LENGTH);
                this.updateHiddenSplit(span[0], span[1]);
                return;
            }
        }

        const length =
            this.C.width + this.C.height + Math.abs(sp[0]) + Math.abs(sp[1]);
        this.sP1 = [
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
        this.updateHiddenSplit(point3D1, point3D2);
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

    // The 3D positions matching the current (doubly-extended) sP1/sP2.
    protected extendedPoints(): [Vec3, Vec3] {
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
        this.hiddenIntervals = hiddenIntervalsBetween(
            this.C,
            this.sP1,
            this.sP2,
            point3D1,
            point3D2,
            (polygon) => this.isOwnFace(polygon),
        );
        this.visibleIntervals = complement(this.hiddenIntervals);
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
        const [hitP1, hitP2] = this.showTips
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
        if (this.showTips) {
            const half = this.size / 2;
            const perp: Vec2 = [
                -this.screenDir[1] * half,
                this.screenDir[0] * half,
            ];
            this.tipPath1.att("d", tipTrianglePath(this.sP1, this.tipP1, perp));
            this.tipPath2.att("d", tipTrianglePath(this.sP2, this.tipP2, perp));
        }
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
            .stl("pointer-events", "none");
        t.hiddenPath = t.svg
            .shape("path")
            .stl("fill", "none")
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("stroke-dasharray", `${t.size * 3} ${t.size * 2}`)
            .stl("pointer-events", "none");
        t.tipPath1 = t.svg
            .shape("path")
            .stl("fill", t.stroke_color)
            .stl("stroke", "none")
            .stl("pointer-events", "none");
        t.tipPath2 = t.svg
            .shape("path")
            .stl("fill", t.stroke_color)
            .stl("stroke", "none")
            .stl("pointer-events", "none");
        return dom.add(t.hitArea, t.path, t.hiddenPath, t.tipPath1, t.tipPath2);
    }
}
