import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { GridPref } from "../preferences";
import {
    projectPoint,
    screenBasis,
    viewDirection,
    type ProjectionFrame,
} from "../projection";
import { vNormalize, type Vec2, type Vec3 } from "../vec";
import { construction_object } from "./construction_object";

// Half-side, in math units, of the floor's finite tiling. Kept smaller than
// the visible area on purpose: a floor covering the whole window would read
// as a flat background instead of a plane sitting in space.
const FLOOR_EXTENT = 5;

export class grid_object extends construction_object {
    UNIT: Vec3;
    RESTRICT_THETA: Vec2;
    RESTRICT_PHI: Vec2;
    PHI: number;
    THETA: number;
    ORG: Vec2;
    STEP: number;
    FOCAL: number;
    PERSPECTIVE = false;
    // Defaults to shown, matching the default-visible axis (isAxis defaults
    // to true); applyCoordsStyle keeps the two in sync when isAxis is set
    // explicitly. Independent of the axis afterwards: 's' toggles it even
    // while the axis is hidden.
    SHOWFLOOR = true;
    CPHI = 0;
    SPHI = 0;
    CTHETA = 0;
    STHETA = 0;
    DIR: Vec3 = [0, 0, 1];
    axis!: DOMElement;
    floorFill!: DOMElement;
    floorLines!: DOMElement;

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
        this.FOCAL = pref.focal;
    }

    project(): void {
        this.CPHI = Math.cos(this.PHI);
        this.SPHI = Math.sin(this.PHI);
        this.CTHETA = Math.cos(this.THETA);
        this.STHETA = Math.sin(this.THETA);
        this.DIR = vNormalize(viewDirection(this.projectionFrame)) ?? this.DIR;
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
            dir: this.DIR,
            focal: this.PERSPECTIVE ? this.FOCAL : undefined,
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
        this.axis.stl("display", this.isVisible ? "block" : "none");
        this.renderFloor();
    }

    private renderFloor(): void {
        const show = this.SHOWFLOOR;
        this.floorFill.stl("display", show ? "block" : "none");
        this.floorLines.stl("display", show ? "block" : "none");
        if (!show) return;

        const frame = this.projectionFrame;
        const n = FLOOR_EXTENT;
        const project2 = (p: Vec3) => projectPoint(p, frame).join(",");

        const corners: Vec3[] = [
            [-n, -n, 0],
            [n, -n, 0],
            [n, n, 0],
            [-n, n, 0],
        ];
        this.floorFill.att("points", corners.map(project2).join(" "));

        let d = "";
        for (let k = -n; k <= n; k++) {
            d += "M" + project2([k, -n, 0]) + " L" + project2([k, n, 0]);
            d += "M" + project2([-n, k, 0]) + " L" + project2([n, k, 0]);
        }
        this.floorLines.att("d", d);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as grid_object;
        const dom = t.svg.shape("g");
        t.floorFill = t.svg
            .shape("polygon")
            .stl("fill", t.fill_color)
            .stl("fill-opacity", "0.08")
            .stl("stroke", "none")
            .stl("pointer-events", "none");
        t.floorLines = t.svg
            .shape("path")
            .stl("stroke", t.fill_color)
            .stl("stroke-width", "0.5")
            .stl("stroke-opacity", "0.35")
            .stl("pointer-events", "none");
        dom.add(t.floorFill);
        dom.add(t.floorLines);
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
