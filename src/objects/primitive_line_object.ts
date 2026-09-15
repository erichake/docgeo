import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { PrefKey } from "../preferences";
import { vAdd, vNormalize, vSub, type Vec2, type Vec3 } from "../vec";
import { construction_object } from "./construction_object";
import type { point_object } from "./point_object";

export class primitive_line_object extends construction_object {
    P1: point_object;
    VEC: Vec3;
    sP1: Vec2 = [0, 0];
    sP2: Vec2 = [0, 0];
    projectionDefined: boolean;
    path!: DOMElement;
    hitArea!: DOMElement;

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
        const d =
            "M" +
            this.sP1[0] +
            " " +
            this.sP1[1] +
            " L" +
            this.sP2[0] +
            " " +
            this.sP2[1];
        this.path.att("d", d);
        this.hitArea.att("d", d);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as primitive_line_object;
        const dom = t.svg.shape("g");
        t.hitArea = t.svg
            .shape("path")
            .stl("fill:none;stroke:transparent;pointer-events:stroke;cursor:pointer")
            .stl("stroke-width", t.prefs[t.type].touchsize);
        t.path = t.svg
            .shape("path")
            .stl("fill", "none")
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("pointer-events", "none");
        return dom.add(t.hitArea, t.path);
    }
}
