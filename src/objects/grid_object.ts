import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { GridPref } from "../preferences";
import { screenBasis, type ProjectionFrame } from "../projection";
import type { Vec2, Vec3 } from "../vec";
import { construction_object } from "./construction_object";

export class grid_object extends construction_object {
    UNIT: Vec3;
    RESTRICT_THETA: Vec2;
    RESTRICT_PHI: Vec2;
    PHI: number;
    THETA: number;
    ORG: Vec2;
    STEP: number;
    CPHI = 0;
    SPHI = 0;
    CTHETA = 0;
    STHETA = 0;
    axis!: DOMElement;

    constructor(c: construction) {
        super(c, null, "grid");
        const pref = this.prefs.grid as GridPref;
        this.UNIT = pref.unit;
        this.RESTRICT_THETA = pref.restrict_theta;
        this.RESTRICT_PHI = pref.restrict_phi;
        this.PHI = pref.phi;
        this.THETA = pref.theta;
        this.ORG = [c.width / 2, c.height / 2];
        this.STEP = pref.step;
    }

    project(): void {
        this.CPHI = Math.cos(this.PHI);
        this.SPHI = Math.sin(this.PHI);
        this.CTHETA = Math.cos(this.THETA);
        this.STHETA = Math.sin(this.THETA);
    }

    get screenIJK(): [Vec2, Vec2, Vec2] {
        return screenBasis(this.projectionFrame);
    }

    get projectionFrame(): ProjectionFrame {
        return {
            origin: this.ORG,
            unit: this.UNIT,
            cosPhi: this.CPHI,
            sinPhi: this.SPHI,
            cosTheta: this.CTHETA,
            sinTheta: this.STHETA,
        };
    }

    // *************************************************
    // ****************** SVG PART **********************
    // *************************************************

    render(): void {
        const v = this.screenIJK;
        let d = "M" + this.ORG[0] + " " + this.ORG[1];
        d += " L" + v[0][0] + " " + v[0][1];
        d += " M" + this.ORG[0] + " " + this.ORG[1];
        d += " L" + v[1][0] + " " + v[1][1];
        d += " M" + this.ORG[0] + " " + this.ORG[1];
        d += " L" + v[2][0] + " " + v[2][1];
        this.axis.att("d", d);
        this.dom.stl("display", this.isVisible ? "block" : "none");
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as grid_object;
        const dom = t.svg.shape("g");
        t.axis = t.svg
            .shape("path")
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("cursor:pointer");
        dom.add(t.axis);
        return dom;
    }
}

export function createGrid(c: construction): grid_object {
    return c.add(new grid_object(c));
}
