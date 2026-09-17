import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import { vAdd, vDot, vNorm, vNormalize, vScale, vSub, type Vec2 } from "../vec";
import { construction_object } from "./construction_object";
import type { point_object } from "./point_object";

const DEFAULT_ARC_RADIUS = 30;
const LABEL_MARGIN = 5;
const HALF_TURN = Math.PI;
const FULL_TURN = 2 * Math.PI;

export class angle_object extends construction_object {
    A: point_object;
    O: point_object;
    B: point_object;
    arcRadius = DEFAULT_ARC_RADIUS;
    value = 0;
    projectionDefined = false;
    private origin: Vec2 = [0, 0];
    private legA: Vec2 = [0, 0];
    private legC: Vec2 = [0, 0];
    private sweep: 0 | 1 = 0;
    private labelRotationDeg = 0;
    private labelOffset = 0;
    private labelAnchor: "start" | "end" = "start";
    arcPath!: DOMElement;
    wedgeFill!: DOMElement;
    valueText?: DOMElement;

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

        const angleA = Math.atan2(dirA[1], dirA[0]);
        const angleC = Math.atan2(dirC[1], dirC[0]);
        let diff = angleC - angleA;
        diff -= Math.round(diff / FULL_TURN) * FULL_TURN;
        this.sweep = diff > 0 ? 1 : 0;

        this.origin = origin;
        this.legA = vAdd(origin, vScale(dirA, this.arcRadius));
        this.legC = vAdd(origin, vScale(dirC, this.arcRadius));

        // The label sits along the bisector direction, outside the arc. Its
        // rotation is flipped by a half turn whenever that direction points
        // generally leftwards, so the glyphs stay upright; the offset and
        // anchor are flipped along with it so the anchor point itself (where
        // the label starts, right past the arc) doesn't move on screen.
        const bisector = angleA + diff / 2;
        const normalized = ((bisector % FULL_TURN) + FULL_TURN) % FULL_TURN;
        const flipped =
            normalized > Math.PI / 2 && normalized < (3 * Math.PI) / 2;
        const labelRadius = this.arcRadius + LABEL_MARGIN + this.fontSize / 2;
        this.labelRotationDeg =
            ((flipped ? normalized + HALF_TURN : normalized) * 180) / Math.PI;
        this.labelOffset = flipped ? -labelRadius : labelRadius;
        this.labelAnchor = flipped ? "end" : "start";

        this.projectionDefined = true;
    }

    render(): void {
        this.dom.stl(
            "display",
            this.isVisible && this.projectionDefined ? "block" : "none",
        );
        if (!this.defined || !this.projectionDefined) return;
        this.wedgeFill.att(
            "d",
            `M${this.origin[0]} ${this.origin[1]} L${this.legA[0]} ${this.legA[1]} L${this.legC[0]} ${this.legC[1]} Z`,
        );
        this.arcPath.att(
            "d",
            `M${this.legA[0]} ${this.legA[1]} A${this.arcRadius} ${this.arcRadius} 0 0 ${this.sweep} ${this.legC[0]} ${this.legC[1]}`,
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

function formatDegrees(value: number, precision: number): string {
    const factor = 10 ** precision;
    return `${Math.round(value * factor) / factor}`.replace(".", ",") + "°";
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
