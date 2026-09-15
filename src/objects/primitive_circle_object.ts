import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import {
    vAdd,
    vCross,
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
