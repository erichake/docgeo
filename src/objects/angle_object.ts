import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { ScriptValue } from "../import/dgp_formula";
import { vAdd, vDot, vNorm, vNormalize, vScale, vSub, type Vec2 } from "../vec";
import { computeAngleArc, formatDegrees } from "./angle_arc";
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
    private dirA: Vec2 = [0, 0];
    private dirC: Vec2 = [0, 0];
    private sweep: 0 | 1 = 0;
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

        const labelRadius = this.arcRadius + LABEL_MARGIN + this.fontSize / 2;
        const arc = computeAngleArc(
            origin,
            dirA,
            dirC,
            this.arcRadius,
            labelRadius,
            this.value > Math.PI,
        );
        this.origin = origin;
        this.legA = arc.legA;
        this.legC = arc.legC;
        this.dirA = dirA;
        this.dirC = dirC;
        this.sweep = arc.sweep;
        this.labelRotationDeg = arc.labelRotationDeg;
        this.labelOffset = arc.labelOffset;
        this.labelAnchor = arc.labelAnchor;
        this.projectionDefined = true;
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
        const arc = `M${this.legA[0]} ${this.legA[1]} A${this.arcRadius} ${this.arcRadius} 0 ${+(this.value > Math.PI)} ${this.sweep} ${this.legC[0]} ${this.legC[1]}`;
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
                    vNormalize(vAdd(this.dirA, this.dirC))!,
                    this.arcRadius / 1.7,
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
    // the legs' screen directions so that a 3D right angle keeps its mark in
    // the plane of the angle.
    private rightAnglePaths(): [string, string] {
        const side =
            this.rightAngleMark === "dgpad"
                ? this.arcRadius
                : this.arcRadius * Math.SQRT1_2;
        const u = vScale(this.dirA, side);
        const v = vScale(this.dirC, side);
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
