import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { PrefKey } from "../preferences";
import {
    vAdd,
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

export class primitive_line_object extends construction_object {
    P1: point_object;
    VEC: Vec3;
    sP1: Vec2 = [0, 0];
    sP2: Vec2 = [0, 0];
    projectionDefined: boolean;
    path!: DOMElement;
    hitArea!: DOMElement;
    hiddenPath!: DOMElement;
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
        const [point3D1, point3D2] = this.extendedPoints();
        this.updateHiddenSplit(point3D1, point3D2);
    }

    // The 3D positions matching the current (doubly-extended) sP1/sP2, by
    // inverting the same screen-space extension above: it moves by
    // `length` screen pixels along the line's projected direction, which
    // (parallel projection) corresponds to a proportional, constant 3D
    // distance along VEC.
    protected extendedPoints(): [Vec3, Vec3] {
        const sp = this.P1.screen;
        const rawVector = vSub(this.C.pt3D(vAdd(this.P1.coords, this.VEC)), sp);
        const rawLength = vNorm(rawVector);
        const length =
            this.C.width + this.C.height + Math.abs(sp[0]) + Math.abs(sp[1]);
        return [
            vAdd(this.P1.coords, vScale(this.VEC, -length / rawLength)),
            vAdd(this.P1.coords, vScale(this.VEC, length / rawLength)),
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
        this.hitArea.att(
            "d",
            `M${this.sP1[0]} ${this.sP1[1]} L${this.sP2[0]} ${this.sP2[1]}`,
        );
        this.path.att(
            "d",
            intervalsToPath(this.sP1, this.sP2, this.visibleIntervals),
        );
        this.hiddenPath.att(
            "d",
            intervalsToPath(this.sP1, this.sP2, this.hiddenIntervals),
        );
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
        return dom.add(t.hitArea, t.path, t.hiddenPath);
    }
}
