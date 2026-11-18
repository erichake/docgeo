import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { ScriptValue } from "../import/dgp_formula";
import {
    vAdd,
    vCross,
    vDot,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import {
    computeAngleArc,
    formatDegrees,
    type AngleArcGeometry,
} from "./angle_arc";
import { construction_object, type DgoContext } from "./construction_object";
import type { point_object } from "./point_object";

const DEFAULT_ARC_RADIUS = 30;
const LABEL_MARGIN = 5;
export const RIGHT_ANGLE_TOLERANCE = 1e-8;

// How a right angle is drawn: DGPad's open square, GeoGebra's arc (none),
// square, dot or L.
export const RIGHT_ANGLE_MARKS = [
    "dgpad",
    "none",
    "square",
    "dot",
    "L",
] as const;
export type RightAngleMark = (typeof RIGHT_ANGLE_MARKS)[number];

export class angle_object extends construction_object {
    A: point_object;
    O: point_object;
    B: point_object;
    arcRadius = DEFAULT_ARC_RADIUS;
    rightAngleMark: RightAngleMark = "dgpad";
    // In the plane, DGPad's ≤ 180° (0), or GeoGebra's from OA to OB
    // counterclockwise (1), or ≥ 180° (2).
    orientation: 0 | 1 | 2 = 0;
    value = 0;
    projectionDefined = false;
    private origin: Vec2 = [0, 0];
    private legA: Vec2 = [0, 0];
    private legC: Vec2 = [0, 0];
    private sweep: 0 | 1 = 0;
    private screenRadius = 0;
    private spaceArc = "";
    private labelRotationDeg = 0;
    private labelOffset = 0;
    private labelAnchor: "start" | "end" = "start";
    arcPath!: DOMElement;
    wedgeFill!: DOMElement;
    valueText?: DOMElement;
    dot?: DOMElement;

    constructor(
        c: construction,
        name: string | null | undefined,
        a: point_object,
        o: point_object,
        cPoint: point_object,
    ) {
        super(c, name, "angle");
        this.A = a;
        this.O = o;
        this.B = cPoint;
        this.addParents(a, o, cPoint);
    }

    scriptValue(_vec3: boolean): ScriptValue | null {
        if (!this.defined) return null;
        return this.C.degrees ? (this.value * 180) / Math.PI : this.value;
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["Ang", [this.A, this.O, this.B].map(context.index)];
    }

    computeGeometry(): void {
        this.defined = this.A.defined && this.O.defined && this.B.defined;
        if (!this.defined) return;
        const oa = vSub(this.A.coords, this.O.coords);
        const oc = vSub(this.B.coords, this.O.coords);
        const normA = vNorm(oa);
        const normC = vNorm(oc);
        this.defined = normA > 0 && normC > 0;
        if (!this.defined) return;
        const cosine = Math.min(
            1,
            Math.max(-1, vDot(oa, oc) / (normA * normC)),
        );
        this.value = Math.acos(cosine);
        if (!this.orientation) return;
        const turn = oa[0] * oc[1] - oa[1] * oc[0];
        if (this.orientation === 2 || turn < 0)
            this.value = 2 * Math.PI - this.value;
    }

    project(): void {
        this.projectionDefined = false;
        if (
            !this.defined ||
            !this.O.projectionDefined ||
            !this.A.projectionDefined ||
            !this.B.projectionDefined
        )
            return;
        const origin = this.O.screen;
        const dirA = vNormalize(vSub(this.A.screen, origin));
        const dirC = vNormalize(vSub(this.B.screen, origin));
        if (!dirA || !dirC) return;

        this.origin = origin;
        const radii = this.C.space ? this.spaceRadii(origin) : null;
        if (radii) this.projectInSpace(origin, ...radii);
        else {
            const labelRadius =
                this.arcRadius + LABEL_MARGIN + this.fontSize / 2;
            const arc = computeAngleArc(
                origin,
                dirA,
                dirC,
                this.arcRadius,
                labelRadius,
                this.value > Math.PI,
            );
            this.legA = arc.legA;
            this.legC = arc.legC;
            this.sweep = arc.sweep;
            this.screenRadius = this.arcRadius;
            this.spaceArc = "";
            this.setLabel(arc);
        }
        this.projectionDefined = true;
    }

    private setLabel(arc: AngleArcGeometry): void {
        this.labelRotationDeg = arc.labelRotationDeg;
        this.labelOffset = arc.labelOffset;
        this.labelAnchor = arc.labelAnchor;
    }

    // In space, the screen vectors of two orthogonal radii of the angle's
    // plane, along OA and towards OC's side (the other for a reflex angle),
    // scaled so that the arc's widest radius is arcRadius: the arc is seen in
    // perspective. None when the legs are aligned, the plane being unknown.
    private spaceRadii(origin: Vec2): [Vec2, Vec2] | null {
        const o = this.O.coords;
        const oa = vSub(this.A.coords, o);
        const oc = vSub(this.B.coords, o);
        const normal = vCross(oa, oc);
        if (vNorm(normal) < 1e-9 * vNorm(oa) * vNorm(oc)) return null;
        const side = vNormalize(vCross(normal, oa))!;
        const radius = (d: Vec3) => vSub(this.C.pt3D(vAdd(o, d)), origin);
        const u = radius(vNormalize(oa)!);
        const w = radius(vScale(side, this.value > Math.PI ? -1 : 1));
        const sum = vDot(u, u) + vDot(w, w);
        const det = u[0] * w[1] - u[1] * w[0];
        const widest = Math.sqrt(
            (sum + Math.sqrt(Math.max(0, sum * sum - 4 * det * det))) / 2,
        );
        if (!(widest > 0)) return null;
        const k = this.arcRadius / widest;
        return [vScale(u, k), vScale(w, k)];
    }

    private projectInSpace(origin: Vec2, u: Vec2, w: Vec2): void {
        const at = (t: number) =>
            vAdd(origin, vAdd(vScale(u, Math.cos(t)), vScale(w, Math.sin(t))));
        const count = Math.max(4, Math.ceil(this.value * 12));
        const points = Array.from({ length: count + 1 }, (_, k) =>
            at((this.value * k) / count),
        );
        this.legA = points[0];
        this.legC = points[count];
        this.spaceArc = points
            .map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`)
            .join(" ");
        const middle = vSub(at(this.value / 2), origin);
        this.screenRadius = vNorm(middle);
        const direction = vNormalize(middle) ?? [1, 0];
        this.setLabel(
            computeAngleArc(
                origin,
                direction,
                direction,
                this.screenRadius,
                this.screenRadius + LABEL_MARGIN + this.fontSize / 2,
            ),
        );
    }

    // Centered past its arc on its bisector, where its value is written.
    nameAt(): Vec2 | null {
        if (!this.projectionDefined) return null;
        const turn = (this.labelRotationDeg * Math.PI) / 180;
        const r =
            Math.sign(this.labelOffset) *
            (this.screenRadius + LABEL_MARGIN + this.fontSize * 0.6);
        const width =
            0.6 * this.fontSize * [...(this.caption ?? this.name)].length;
        return [
            this.origin[0] + r * Math.cos(turn) - width / 2,
            this.origin[1] + r * Math.sin(turn) + this.fontSize * 0.35,
        ];
    }

    render(): void {
        this.dom.stl(
            "display",
            this.isVisible && this.projectionDefined ? "block" : "none",
        );
        if (!this.defined || !this.projectionDefined) return;
        const right =
            this.rightAngleMark !== "none" &&
            Math.abs(this.value - Math.PI / 2) < RIGHT_ANGLE_TOLERANCE;
        const mark = right && this.rightAngleMark !== "dot";
        const arc =
            this.spaceArc ||
            `M${this.legA[0]} ${this.legA[1]} A${this.arcRadius} ${this.arcRadius} 0 ${+(this.value > Math.PI)} ${this.sweep} ${this.legC[0]} ${this.legC[1]}`;
        const [fill, outline] = mark
            ? this.rightAnglePaths()
            : [`M${this.origin[0]} ${this.origin[1]} L${arc.slice(1)} Z`, arc];
        this.wedgeFill.att("d", fill);
        this.arcPath
            .att("d", outline)
            .stl(
                "fill-opacity",
                mark && this.rightAngleMark === "square"
                    ? (this.opacity ?? 0)
                    : 0,
            );
        this.dot?.stl("display", right ? "block" : "none");
        if (this.dot && right) {
            const [x, y] = vAdd(
                this.origin,
                vScale(
                    vAdd(
                        vSub(this.legA, this.origin),
                        vSub(this.legC, this.origin),
                    ),
                    Math.SQRT1_2 / 1.7,
                ),
            );
            this.dot.att("cx", x).att("cy", y);
        }
        this.valueText?.stl(
            "display",
            right && this.rightAngleMark === "dgpad" ? "none" : "block",
        );
        if (!this.valueText) return;
        this.valueText
            .att(
                "transform",
                `translate(${this.origin[0]} ${this.origin[1]}) rotate(${this.labelRotationDeg})`,
            )
            .att("x", this.labelOffset)
            .att("text-anchor", this.labelAnchor)
            .text(formatDegrees((this.value * 180) / Math.PI, this.precision));
    }

    // The filled area and the outline of a right angle's mark, drawn from
    // the arc's legs on screen so that a 3D right angle keeps its mark in
    // the plane of the angle.
    private rightAnglePaths(): [string, string] {
        const side =
            this.rightAngleMark === "dgpad"
                ? this.arcRadius
                : this.arcRadius * Math.SQRT1_2;
        const k = side / this.arcRadius;
        const u = vScale(vSub(this.legA, this.origin), k);
        const v = vScale(vSub(this.legC, this.origin), k);
        const path = (...points: Vec2[]) =>
            points
                .map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`)
                .join(" ");
        const o = this.origin;
        const square = `${path(o, vAdd(o, u), vAdd(o, vAdd(u, v)), vAdd(o, v))} Z`;
        if (this.rightAngleMark === "dgpad")
            return [square, path(vAdd(o, u), vAdd(o, vAdd(u, v)), vAdd(o, v))];
        if (this.rightAngleMark === "square") return ["", square];
        const corner = vAdd(o, vScale(vAdd(u, v), 0.4));
        return ["", path(vAdd(corner, u), corner, vAdd(corner, v))];
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as angle_object;
        const dom = t.svg.shape("g");
        t.wedgeFill = t.svg
            .shape("path")
            .stl("fill", t.fill_color)
            .stl("fill-opacity", t.opacity ?? 0)
            .stl("stroke", "none")
            .stl("pointer-events", "none");
        t.arcPath = t.svg
            .shape("path")
            .stl("fill", t.fill_color)
            .stl("fill-opacity", t.opacity ?? 0)
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("pointer-events", "none");
        dom.add(t.wedgeFill, t.arcPath);
        if (t.rightAngleMark === "dot") {
            // GeoGebra's dot radius is its line thickness, twice ours.
            t.dot = t.svg
                .shape("circle")
                .att("r", 2 * t.size)
                .stl("fill", t.stroke_color)
                .stl("fill-opacity", t.strokeOpacity)
                .stl("pointer-events", "none");
            dom.add(t.dot);
        }
        if (t.precision < 0) return dom;

        t.valueText = t.svg
            .shape("text")
            .att("dominant-baseline", "middle")
            .stl(
                `fill:${t.stroke_color};font-family:Verdana;font-size:${t.fontSize}px;pointer-events:none`,
            );
        return dom.add(t.valueText);
    }
}

export function createAngle(
    c: construction,
    name: string | null | undefined,
    a: point_object,
    o: point_object,
    cPoint: point_object,
): angle_object {
    return c.add(new angle_object(c, name, a, o, cPoint));
}
