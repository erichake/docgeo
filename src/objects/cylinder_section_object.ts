import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import {
    GEOMETRY_EPSILON,
    vAdd,
    vDot,
    vIsFinite,
    vNorm,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import { construction_object, type DgoContext } from "./construction_object";
import type { plane_object } from "./plane_object";
import type { revolution_object } from "./revolution_object";

// Where a plane cuts the side of a cylinder, like GeoGebra's
// IntersectPath(plane, cylinder): the
// ellipse CENTER + cos t·U + sin t·V, drawn as an affine image of the unit
// circle, keeping only its arcs between the planes of the disks.
export class cylinder_section_object extends construction_object {
    SOLID: revolution_object;
    PLANE: plane_object;
    CENTER: Vec3 = [0, 0, 0];
    U: Vec3 = [1, 0, 0];
    V: Vec3 = [0, 1, 0];
    // Each kept arc's parameters t, increasing.
    arcs: [number, number][] = [];
    projectionDefined = true;
    centerScreen: Vec2 = [0, 0];
    screenU: Vec2 = [0, 0];
    screenV: Vec2 = [0, 0];
    path!: DOMElement;

    constructor(
        c: construction,
        name: string | null | undefined,
        solid: revolution_object,
        plane: plane_object,
    ) {
        super(c, name, "circle");
        this.SOLID = solid;
        this.PLANE = plane;
        this.addParents(solid, plane);
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["CyS", [this.SOLID, this.PLANE].map(context.index)];
    }

    computeGeometry(): void {
        this.defined = false;
        const { SOLID: solid, PLANE: plane } = this;
        if (!solid.defined || !plane.defined) return;
        const { A: a, AXIS: w, U: u, V: v, R0: radius, HEIGHT: height } = solid;
        const { CENTER: p, NORMAL: normal } = plane;
        const slope = vDot(normal, w);
        if (Math.abs(slope) <= GEOMETRY_EPSILON * vNorm(normal)) return;
        // Heights along the axis from A: h0 at the center, h0 + hu·cos t +
        // hv·sin t = h0 + rho·cos(t - phi) around it.
        const h0 = vDot(normal, vSub(p, a.coords)) / slope;
        const [hu, hv] = [u, v].map(
            (direction) => (-radius * vDot(normal, direction)) / slope,
        );
        this.CENTER = vAdd(a.coords, vScale(w, h0));
        this.U = vAdd(vScale(u, radius), vScale(w, hu));
        this.V = vAdd(vScale(v, radius), vScale(w, hv));
        const rho = Math.hypot(hu, hv);
        const phi = Math.atan2(hv, hu);
        // Kept where inner ≤ |t - phi| ≤ outer. A plane orthogonal to the
        // axis (rho = 0) through a disk gives 0/0: the whole ellipse.
        const top = (height - h0) / rho;
        const bottom = -h0 / rho;
        const inner = !(top < 1) ? 0 : top <= -1 ? Math.PI : Math.acos(top);
        const outer = !(bottom > -1)
            ? Math.PI
            : bottom >= 1
              ? 0
              : Math.acos(bottom);
        if (inner >= outer) return;
        this.arcs =
            inner === 0
                ? [[phi - outer, phi + outer]]
                : outer === Math.PI
                  ? [[phi + inner, phi + 2 * Math.PI - inner]]
                  : [
                        [phi + inner, phi + outer],
                        [phi - outer, phi - inner],
                    ];
        this.defined = true;
    }

    project(): void {
        this.projectionDefined = false;
        if (!this.defined) return;
        const center = this.C.pt3D(this.CENTER);
        const u = vSub(this.C.pt3D(vAdd(this.CENTER, this.U)), center);
        const v = vSub(this.C.pt3D(vAdd(this.CENTER, this.V)), center);
        if (!vIsFinite(center) || !vIsFinite(u) || !vIsFinite(v)) return;
        this.centerScreen = center;
        this.screenU = u;
        this.screenV = v;
        this.projectionDefined = true;
    }

    // Each arc through its middle, so that both halves span at most π.
    render(): void {
        this.dom.stl(
            "display",
            this.isVisible && this.projectionDefined ? "block" : "none",
        );
        if (!this.defined || !this.projectionDefined) return;
        const at = (t: number) => `${Math.cos(t)} ${Math.sin(t)}`;
        const d = this.arcs
            .map(
                ([start, end]) =>
                    `M${at(start)} A1 1 0 0 1 ${at((start + end) / 2)} A1 1 0 0 1 ${at(end)}`,
            )
            .join(" ");
        this.path
            .att("d", d)
            .att(
                "transform",
                `matrix(${this.screenU[0]} ${this.screenU[1]} ${this.screenV[0]} ${this.screenV[1]} ${this.centerScreen[0]} ${this.centerScreen[1]})`,
            );
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as cylinder_section_object;
        t.path = t.svg
            .shape("path")
            .stl("fill", t.fill_color)
            .stl("fill-opacity", t.opacity ?? 0)
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("pointer-events", "none")
            .stl("vector-effect", "non-scaling-stroke");
        return t.svg.shape("g").add(t.path);
    }
}

export function createCylinderSection(
    c: construction,
    name: string | null | undefined,
    solid: revolution_object,
    plane: plane_object,
): cylinder_section_object {
    return c.add(new cylinder_section_object(c, name, solid, plane));
}
