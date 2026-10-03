import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { ScriptValue } from "../import/dgp_formula";
import {
    geometryTolerance,
    numEqual,
    vAdd,
    vCross,
    vDot,
    vIsFinite,
    vNormalize,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import { construction_object } from "./construction_object";

export class primitive_circle_object extends construction_object {
    CENTER: Vec3 = [0, 0, 0];
    R = 0;
    U: Vec3 = [1, 0, 0];
    V: Vec3 = [0, 1, 0];
    NORMAL: Vec3 = [0, 0, 1];
    projectionDefined = true;
    centerScreen: Vec2 = [0, 0];
    screenU: Vec2 = [0, 0];
    screenV: Vec2 = [0, 0];
    path!: DOMElement;
    hitArea!: DOMElement;

    constructor(c: construction, name: string | null | undefined) {
        super(c, name, "circle");
        this.familytype = "circle";
    }

    scriptValue(_vec3: boolean): ScriptValue | null {
        return this.defined ? this.R : null;
    }

    setCircle(center: Vec3, radius: number, u: Vec3, v: Vec3): void {
        const unitU = vNormalize(u);
        const unitV = vNormalize(v);
        const normal = unitU && unitV ? vNormalize(vCross(unitU, unitV)) : null;
        if (!unitU || !unitV || !normal) {
            this.defined = false;
            return;
        }
        this.CENTER = center;
        this.R = radius;
        this.U = unitU;
        this.V = unitV;
        this.NORMAL = normal;
        this.defined =
            vIsFinite(center) && Number.isFinite(radius) && radius >= 0;
    }

    // The plane of a plane construction: horizontal, or the screen plane for
    // a DGPad 3D figure's 2D object (see GRID.FRAME2D).
    protected get plane(): [Vec3, Vec3] {
        return this.C.GRID.FRAME2D && this.flat
            ? this.C.screenPlaneBasis
            : [
                  [1, 0, 0],
                  [0, 1, 0],
              ];
    }

    // The circle of that plane centered at `center` through the projection of
    // `point` onto it.
    protected setPlaneCircle(center: Vec3, point: Vec3): void {
        const [u, v] = this.plane;
        const radius = vSub(point, center);
        this.setCircle(
            center,
            Math.hypot(vDot(radius, u), vDot(radius, v)),
            u,
            v,
        );
    }

    // The circle through three points of a plane parallel to that plane.
    protected setCircleThrough(a: Vec3, b: Vec3, c: Vec3): void {
        const [u, v] = this.plane;
        const normal = vCross(u, v);
        if (
            !numEqual(vDot(a, normal), vDot(b, normal)) ||
            !numEqual(vDot(a, normal), vDot(c, normal))
        ) {
            this.defined = false;
            return;
        }
        const ab = vSub(b, a);
        const ac = vSub(c, a);
        const [abx, aby] = [vDot(ab, u), vDot(ab, v)];
        const [acx, acy] = [vDot(ac, u), vDot(ac, v)];
        const denominator = 2 * (abx * acy - aby * acx);
        const scale = Math.hypot(abx, aby) * Math.hypot(acx, acy);
        if (Math.abs(denominator) <= 2 * geometryTolerance(scale)) {
            this.defined = false;
            return;
        }
        const ab2 = abx * abx + aby * aby;
        const ac2 = acx * acx + acy * acy;
        const x = (acy * ab2 - aby * ac2) / denominator;
        const y = (abx * ac2 - acx * ab2) / denominator;
        this.setCircle(
            vAdd(a, vAdd(vScale(u, x), vScale(v, y))),
            Math.hypot(x, y),
            u,
            v,
        );
    }

    pointAt(alpha: number): Vec3 {
        return vAdd(
            this.CENTER,
            vScale(
                vAdd(
                    vScale(this.U, Math.cos(alpha)),
                    vScale(this.V, Math.sin(alpha)),
                ),
                this.R,
            ),
        );
    }

    insideBounds(_point: Vec3): boolean {
        return true;
    }

    alphaOf(point: Vec3): number {
        const relative = vSub(point, this.CENTER);
        return Math.atan2(
            relative[0] * this.V[0] +
                relative[1] * this.V[1] +
                relative[2] * this.V[2],
            relative[0] * this.U[0] +
                relative[1] * this.U[1] +
                relative[2] * this.U[2],
        );
    }

    project(): void {
        this.projectionDefined = false;
        if (!this.defined) return;
        const center = this.C.pt3D(this.CENTER);
        const u = vSub(
            this.C.pt3D(vAdd(this.CENTER, vScale(this.U, this.R))),
            center,
        );
        const v = vSub(
            this.C.pt3D(vAdd(this.CENTER, vScale(this.V, this.R))),
            center,
        );
        if (!vIsFinite(center) || !vIsFinite(u) || !vIsFinite(v)) return;
        this.centerScreen = center;
        this.screenU = u;
        this.screenV = v;
        this.projectionDefined = true;
    }

    render(): void {
        this.dom.stl(
            "display",
            this.isVisible && this.projectionDefined ? "block" : "none",
        );
        if (!this.defined || !this.projectionDefined) return;
        const transform = `matrix(${this.screenU[0]} ${this.screenU[1]} ${this.screenV[0]} ${this.screenV[1]} ${this.centerScreen[0]} ${this.centerScreen[1]})`;
        this.path.att("transform", transform);
        this.hitArea.att("transform", transform);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as primitive_circle_object;
        const dom = t.svg.shape("g");
        t.hitArea = t.svg
            .shape("circle")
            .att("cx", 0)
            .att("cy", 0)
            .att("r", 1)
            .stl(
                "fill:transparent;stroke:transparent;pointer-events:stroke;cursor:pointer;vector-effect:non-scaling-stroke",
            )
            .stl("stroke-width", t.prefs.circle.touchsize);
        t.path = t.svg
            .shape("circle")
            .att("cx", 0)
            .att("cy", 0)
            .att("r", 1)
            .stl("fill", t.fill_color)
            .stl("fill-opacity", t.opacity ?? 0)
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("pointer-events", "none")
            .stl("vector-effect", "non-scaling-stroke");
        return dom.add(t.hitArea, t.path);
    }
}
