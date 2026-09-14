import type { construction } from "../construction";
import type { PrefKey } from "../preferences";
import { vAdd, vIsNull, vNormalize, vSub, type Vec2, type Vec3 } from "../vec";
import { construction_object } from "./construction_object";
import type { point_object } from "./point_object";

export class primitive_line_object extends construction_object {
    P1: point_object;
    VEC: Vec3;
    sP1: Vec2 = [0, 0];
    sP2: Vec2 = [0, 0];

    constructor(
        c: construction,
        name: string | null | undefined,
        p: point_object,
        type?: PrefKey,
    ) {
        super(c, name, type ? type : "line");
        this.P1 = p;
        this.VEC = [1, 0, 0];
        this.familytype = "line";
        this.addParents(p);
    }

    // Compute 3D normalized vector this.VEC
    // Must be overridden by children classes :
    computeVEC(): void {}

    // Tells if a point is on the line.
    // Must be overridden by finite lines :
    InsideBounds(_point_coords: Vec3): boolean {
        return true;
    }

    compute(): void {
        this.computeVEC();
        const sp = this.P1.screen;
        if (vIsNull(this.VEC)) {
            this.sP1 = this.P1.screen;
            this.sP2 = this.P1.screen;
        } else {
            // Compute a circle which is centered in P1 and with a ray
            // which makes it containing the screen.
            // Then compute two intersection points (2D screen) between the line
            // and the circle : sP1 and sP2
            const sv = vNormalize(
                vSub(sp, this.C.pt3D(vAdd(this.P1.coords, this.VEC))),
            );
            const l =
                this.C.width +
                this.C.height +
                Math.abs(sp[0]) +
                Math.abs(sp[1]);
            this.sP1 = [sp[0] + l * sv[0], sp[1] + l * sv[1]];
            this.sP2 = [sp[0] - l * sv[0], sp[1] - l * sv[1]];
        }
    }

    // *************************************************
    // ****************** SVG PART **********************
    // *************************************************

    draw(): void {
        const d =
            "M" +
            this.sP1[0] +
            " " +
            this.sP1[1] +
            " L" +
            this.sP2[0] +
            " " +
            this.sP2[1];
        this.dom!.att("d", d).stl("display", this.isHidden ? "none" : "block");
    }

    static createSVG(_this: construction_object): void {
        const t = _this as primitive_line_object;
        t.dom = t.svg
            .shape("path")
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("cursor:pointer");
    }
}
