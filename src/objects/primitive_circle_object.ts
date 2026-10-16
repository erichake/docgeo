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
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import { construction_object } from "./construction_object";
import { polylineSplit } from "./hidden_line";

// GeoGebra's DrawConic: up left of an ellipse's center, by its frame, for
// the ellipse center + cos·u + sin·v on the screen.
export function ellipseNameAt([x, y]: Vec2, u: Vec2, v: Vec2): Vec2 {
    return [
        x - Math.hypot(u[0], v[0]) / 2,
        y - 0.85 * Math.hypot(u[1], v[1]) + 20,
    ];
}

// A moved name's place on the ellipse center + cos·u + sin·v of the screen:
// its angle there and its gap outward, in pixels.
export function ellipseName(
    center: Vec2,
    u: Vec2,
    v: Vec2,
    [alpha, gap]: number[],
): Vec2 {
    const on = vAdd(vScale(u, Math.cos(alpha)), vScale(v, Math.sin(alpha)));
    return vAdd(vAdd(center, on), vScale(vNormalize(on) ?? [0, 0], gap));
}

export function ellipseAnchor(
    center: Vec2,
    u: Vec2,
    v: Vec2,
    at: Vec2,
): number[] {
    const [x, y] = vSub(at, center);
    const det = u[0] * v[1] - u[1] * v[0];
    const alpha = Math.atan2(
        (u[0] * y - u[1] * x) / det,
        (x * v[1] - y * v[0]) / det,
    );
    const on = vAdd(vScale(u, Math.cos(alpha)), vScale(v, Math.sin(alpha)));
    return [alpha, Math.hypot(x, y) - vNorm(on)];
}

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
    // In space, its stroke: solid, and dashed where a face hides it.
    edge!: DOMElement;
    hiddenEdge!: DOMElement;

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

    nameAt(): Vec2 | null {
        return ellipseNameAt(this.centerScreen, this.screenU, this.screenV);
    }

    anchoredName(offset: number[]): Vec2 | null {
        return ellipseName(
            this.centerScreen,
            this.screenU,
            this.screenV,
            offset,
        );
    }

    anchorName(at: Vec2): number[] {
        return ellipseAnchor(this.centerScreen, this.screenU, this.screenV, at);
    }

    // Its points from the angle `from` over `span`, close enough that the
    // chords between them don't show.
    protected strokePoints(from: number, span: number): Vec3[] {
        const radius = Math.max(vNorm(this.screenU), vNorm(this.screenV));
        const turn = Math.min(
            360,
            Math.max(16, Math.PI * Math.sqrt(2 * radius)),
        );
        const count = Math.max(1, Math.ceil((turn * span) / (2 * Math.PI)));
        return Array.from({ length: count + 1 }, (_, k) =>
            this.pointAt(from + (span * k) / count),
        );
    }

    // In space, its stroke split where faces and solids hide it (see
    // hidden_line.ts), drawn by its edges instead of its path.
    protected drawStroke(points: () => Vec3[]): void {
        const space = !this.C.GRID.is2D;
        this.path.stl("stroke", space ? "none" : this.stroke_color);
        const [visible, hidden] = space
            ? polylineSplit(this.C, points())
            : ["", ""];
        this.edge.att("d", visible);
        this.hiddenEdge.att("d", hidden);
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
        this.drawStroke(() => this.strokePoints(0, 2 * Math.PI));
    }

    // Its path, and the edges drawing its stroke in space.
    static addStroke(
        t: primitive_circle_object,
        dom: DOMElement,
        path: DOMElement,
    ): DOMElement {
        t.path = path
            .stl("fill", t.fill_color)
            .stl("fill-opacity", t.opacity ?? 0)
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("stroke-dasharray", t.strokeDashArray)
            .stl("pointer-events", "none")
            .stl("vector-effect", "non-scaling-stroke");
        const edge = (dash: string) =>
            t.svg
                .shape("path")
                .stl("fill", "none")
                .stl("stroke", t.stroke_color)
                .stl("stroke-width", t.size)
                .stl("stroke-dasharray", dash)
                .stl("pointer-events", "none");
        t.edge = edge(t.strokeDashArray);
        t.hiddenEdge = edge(`${t.size * 3} ${t.size * 2}`);
        return dom.add(t.hitArea, t.path, t.edge, t.hiddenEdge);
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
        return primitive_circle_object.addStroke(
            t,
            dom,
            t.svg.shape("circle").att("cx", 0).att("cy", 0).att("r", 1),
        );
    }
}
