import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import {
    geometryTolerance,
    vAdd,
    vNorm,
    vNormalize,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import { computeAngleArc, formatDegrees } from "./angle_arc";
import type { construction_object, DgoContext } from "./construction_object";
import type { point_object } from "./point_object";
import { primitive_line_object } from "./primitive_line_object";

const DEFAULT_ARC_RADIUS = 30;
const LABEL_MARGIN = 5;

// A ray from a vertex, rotated by a fixed angle (in degrees) away from an
// existing reference point, with the swept angle drawn as a wedge. DGPad
// figures store the angle as a quoted expression string, but this project
// is a figure reader, not an expression evaluator, so only constant
// numeric expressions are supported (see dgp_commands.ts).
export class fixed_angle_object extends primitive_line_object {
    A: point_object;
    valueDegrees: number;
    trigo: boolean;
    arcRadius = DEFAULT_ARC_RADIUS;
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
        vertex: point_object,
        valueDegrees: number,
        trigo: boolean,
    ) {
        super(c, name, vertex, "fixedangle");
        this.A = a;
        this.valueDegrees = valueDegrees;
        this.trigo = trigo;
        this.addParents(a);
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "FA",
            [
                context.index(this.A),
                context.index(this.P1),
                this.valueDegrees,
                +this.trigo,
            ],
        ];
    }

    computeVEC(): Vec3 | null {
        if (!this.A.defined) return null;
        const dx = this.A.x - this.P1.x;
        const dy = this.A.y - this.P1.y;
        const theta =
            ((this.trigo ? 1 : -1) * this.valueDegrees * Math.PI) / 180;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        return vNormalize([dx * cos - dy * sin, dx * sin + dy * cos, 0]);
    }

    insideBounds(parameter: number): boolean {
        const scale = vNorm(vSub(this.A.coords, this.P1.coords));
        return parameter >= -geometryTolerance(scale);
    }

    project(): void {
        super.project();
        if (!this.defined || !this.projectionDefined) return;
        this.sP1 = this.P1.screen;
        const [, point3D2] = this.extendedPoints();
        this.updateHiddenSplit(this.P1.coords, point3D2);

        const origin = this.P1.screen;
        const dirA = vNormalize(vSub(this.A.screen, origin));
        const dirC = vNormalize(
            vSub(this.C.pt3D(vAdd(this.P1.coords, this.VEC)), origin),
        );
        if (!dirA || !dirC) return;

        const labelRadius = this.arcRadius + LABEL_MARGIN + this.fontSize / 2;
        const arc = computeAngleArc(
            origin,
            dirA,
            dirC,
            this.arcRadius,
            labelRadius,
        );
        this.legA = arc.legA;
        this.legC = arc.legC;
        this.sweep = arc.sweep;
        this.labelRotationDeg = arc.labelRotationDeg;
        this.labelOffset = arc.labelOffset;
        this.labelAnchor = arc.labelAnchor;
    }

    render(): void {
        super.render();
        if (!this.defined || !this.projectionDefined) return;
        const origin = this.P1.screen;
        this.wedgeFill.att(
            "d",
            `M${origin[0]} ${origin[1]} L${this.legA[0]} ${this.legA[1]} L${this.legC[0]} ${this.legC[1]} Z`,
        );
        this.arcPath.att(
            "d",
            `M${this.legA[0]} ${this.legA[1]} A${this.arcRadius} ${this.arcRadius} 0 0 ${this.sweep} ${this.legC[0]} ${this.legC[1]}`,
        );
        if (!this.valueText) return;
        this.valueText
            .att(
                "transform",
                `translate(${origin[0]} ${origin[1]}) rotate(${this.labelRotationDeg})`,
            )
            .att("x", this.labelOffset)
            .att("text-anchor", this.labelAnchor)
            .text(formatDegrees(this.valueDegrees, this.precision));
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as fixed_angle_object;
        const dom = primitive_line_object.createSVG(t);
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
            .stl("stroke-width", t.size * 3)
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

export function createFixedAngle(
    c: construction,
    name: string | null | undefined,
    a: point_object,
    vertex: point_object,
    valueDegrees: number,
    trigo: boolean,
): fixed_angle_object {
    return c.add(
        new fixed_angle_object(c, name, a, vertex, valueDegrees, trigo),
    );
}
