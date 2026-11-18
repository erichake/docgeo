import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import {
    GEOMETRY_EPSILON,
    vAdd,
    vCross,
    vDot,
    vIsFinite,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import type { ConicCoeffs } from "./conic_algebra";
import { construction_object, type DgoContext } from "./construction_object";
import type { polygon_object } from "./polygon_object";
import type { revolution_object } from "./revolution_object";

// Points per turn.
const SAMPLES = 96;

// Where a plane cuts the side of a cylinder or a cone, like GeoGebra's
// IntersectPath(plane, solid): on the generator at angle t, from the rim
// of A's disk at t to that of B's (the apex), the point at s(t) of it in
// the plane, kept where 0 ≤ s ≤ 1, between the disks: arcs of an ellipse
// for a cylinder, of a conic for a cone.
export class cylinder_section_object extends construction_object {
    SOLID: revolution_object;
    PLANE: polygon_object;
    // Each kept arc, sampled.
    arcs: Vec3[][] = [];
    // The whole conic where the plane cuts the extended surface, whose foci
    // or vertices GeoGebra gives: a·x² + b·xy + c·y² + d·x + e·y + f = 0
    // along the plane's AXES from its ORIGIN.
    COEFFS: ConicCoeffs | null = null;
    private ORIGIN: Vec3 = [0, 0, 0];
    private AXES: [Vec3, Vec3] = [
        [1, 0, 0],
        [0, 1, 0],
    ];
    projectionDefined = true;
    private screens: Vec2[][] = [];
    path!: DOMElement;

    constructor(
        c: construction,
        name: string | null | undefined,
        solid: revolution_object,
        plane: polygon_object,
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
        if (!solid.defined || !plane.spans) return;
        const { A, B, U: u, V: v, R0, R1 } = solid;
        const { CENTER: p, NORMAL: normal } = plane;
        // The first axis along x, or y for a plane nearly orthogonal to it.
        const x: Vec3 = Math.abs(normal[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
        const e1 = vNormalize(vSub(x, vScale(normal, vDot(x, normal))))!;
        const e2 = vCross(normal, e1);
        this.ORIGIN = p;
        this.AXES = [e1, e2];
        const [a, d, f] = solid.quadratic(p, e1);
        const [c, e] = solid.quadratic(p, e2);
        const b = solid.quadratic(p, vAdd(e1, e2))[0] - a - c;
        this.COEFFS = [a, b, c, d, e, f];
        // s = (e0 - R0·rho·x) / (d0 - (R0 - R1)·rho·x), x = cos(t - phi):
        // 0 at x0, 1 at x1, infinite for a cone, whose s reaches 1 only at
        // its apex.
        const e0 = vDot(normal, vSub(p, A.coords));
        const d0 = vDot(normal, vSub(B.coords, A.coords));
        // A plane along a cylinder's axis cuts it along two generators.
        if (
            !solid.cone &&
            Math.abs(d0) <= GEOMETRY_EPSILON * vNorm(normal) * solid.HEIGHT
        )
            return;
        const [nu, nv] = [vDot(normal, u), vDot(normal, v)];
        const rho = Math.hypot(nu, nv);
        const phi = Math.atan2(nv, nu);
        const x0 = e0 / (R0 * rho);
        const x1 = (e0 - d0) / (R1 * rho);
        // Kept where inner ≤ |t - phi| ≤ outer. A plane orthogonal to the
        // axis (rho = 0) through a disk gives 0/0: the whole ellipse.
        const [low, high] = [Math.min(x0, x1), Math.max(x0, x1)];
        const inner = !(high < 1) ? 0 : high <= -1 ? Math.PI : Math.acos(high);
        const outer = !(low > -1) ? Math.PI : low >= 1 ? 0 : Math.acos(low);
        if (inner >= outer) return;
        const ranges =
            inner === 0
                ? [[phi - outer, phi + outer]]
                : outer === Math.PI
                  ? [[phi + inner, phi + 2 * Math.PI - inner]]
                  : [
                        [phi + inner, phi + outer],
                        [phi - outer, phi - inner],
                    ];
        this.arcs = ranges.map(([start, end]) => {
            const count = Math.ceil((SAMPLES * (end - start)) / (2 * Math.PI));
            return Array.from({ length: count + 1 }, (_, k) => {
                const t = start + ((end - start) * k) / count;
                const [r0, r1] = [solid.rim(false, t), solid.rim(true, t)];
                const along = vSub(r1, r0);
                return vAdd(
                    r0,
                    vScale(
                        along,
                        vDot(normal, vSub(p, r0)) / vDot(normal, along),
                    ),
                );
            });
        });
        this.defined = true;
    }

    fromPlane([x, y]: readonly number[]): Vec3 {
        const [u, v] = this.AXES;
        return vAdd(this.ORIGIN, vAdd(vScale(u, x), vScale(v, y)));
    }

    project(): void {
        this.screens = this.arcs.map((arc) =>
            arc.map((point) => this.C.pt3D(point)),
        );
        this.projectionDefined =
            this.defined && this.screens.flat().every(vIsFinite);
    }

    render(): void {
        this.dom.stl(
            "display",
            this.isVisible && this.projectionDefined ? "block" : "none",
        );
        if (!this.defined || !this.projectionDefined) return;
        this.path.att(
            "d",
            this.screens
                .map(
                    (arc) =>
                        `M${arc.map((point) => point.join(" ")).join(" L")}`,
                )
                .join(" "),
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
            .stl("stroke-linejoin", "round")
            .stl("pointer-events", "none");
        return t.svg.shape("g").add(t.path);
    }
}

export function createCylinderSection(
    c: construction,
    name: string | null | undefined,
    solid: revolution_object,
    plane: polygon_object,
): cylinder_section_object {
    return c.add(new cylinder_section_object(c, name, solid, plane));
}
