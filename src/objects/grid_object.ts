import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { GridPref } from "../preferences";
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
    dom: DOMElement | null = null;
    axis!: DOMElement;
    oy!: DOMElement;

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

        this.createSVG(); // init this.dom and add it to this.svg
    }

    compute(): void {
        this.CPHI = Math.cos(this.PHI);
        this.SPHI = Math.sin(this.PHI);
        this.CTHETA = Math.cos(this.THETA);
        this.STHETA = Math.sin(this.THETA);
    }

    static create(c: construction): grid_object {
        return c.add(new grid_object(c)) as grid_object;
    }

    get screenIJK(): [Vec2, Vec2, Vec2] {
        return [
            [
                this.ORG[0] + this.UNIT[0] * this.SPHI,
                this.ORG[1] + this.UNIT[0] * this.CPHI * this.STHETA,
            ],
            [
                this.ORG[0] + this.UNIT[1] * this.CPHI,
                this.ORG[1] - this.UNIT[1] * this.SPHI * this.STHETA,
            ],
            [this.ORG[0], this.ORG[1] - this.UNIT[2] * this.CTHETA],
        ];
    }

    // *************************************************
    // ****************** SVG PART **********************
    // *************************************************

    draw(): void {
        const v = this.screenIJK;
        let d = "M" + this.ORG[0] + " " + this.ORG[1];
        d += " L" + v[0][0] + " " + v[0][1];
        d += " M" + this.ORG[0] + " " + this.ORG[1];
        d += " L" + v[1][0] + " " + v[1][1];
        d += " M" + this.ORG[0] + " " + this.ORG[1];
        d += " L" + v[2][0] + " " + v[2][1];
        const dom = this.dom!;
        this.axis.att("d", d);
        dom.stl("display", this.isHidden ? "none" : "block");
    }

    static createSVG(_this: construction_object): void {
        const t = _this as grid_object;
        const dom = t.svg
            .shape("svg")
            .att("x:0;y:0;width:100%;height:100%;overflow:visible");
        t.axis = t.svg
            .shape("path")
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("cursor:pointer");
        t.oy = t.svg
            .shape("path")
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("cursor:pointer");
        dom.add(t.axis, t.oy);
        t.dom = dom;
        t.svg.add(dom);
    }
}
