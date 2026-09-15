import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import { geometryTolerance, vNorm, vNormalize, vSub } from "../vec";
import type { construction_object } from "./construction_object";
import type { point_object } from "./point_object";
import { primitive_line_object } from "./primitive_line_object";
import { two_points_line_object } from "./two_points_line_object";

const FONT_MARGIN = 5;
const HALF_TURN = Math.PI;
const QUARTER_TURN = Math.PI / 2;

export class segment_object extends two_points_line_object {
    lengthText?: DOMElement;

    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        p2: point_object,
    ) {
        super(c, name, p1, p2, "segment");
    }

    project(): void {
        super.project();
        if (
            !this.defined ||
            !this.projectionDefined ||
            !this.P2.projectionDefined
        ) {
            this.projectionDefined = false;
            return;
        }
        this.sP1 = this.P1.screen;
        this.sP2 = this.P2.screen;
        this.projectionDefined = vNormalize(vSub(this.sP2, this.sP1)) !== null;
    }

    insideBounds(parameter: number): boolean {
        const length = vNorm(vSub(this.P2.coords, this.P1.coords));
        const tolerance = geometryTolerance(length);
        return parameter >= -tolerance && parameter <= length + tolerance;
    }

    render(): void {
        super.render();
        if (!this.lengthText) return;
        if (!this.defined || !this.projectionDefined) return;

        const midx = (this.sP1[0] + this.sP2[0]) / 2;
        const midy = (this.sP1[1] + this.sP2[1]) / 2;
        let angle = Math.atan2(
            this.sP2[1] - this.sP1[1],
            this.sP2[0] - this.sP1[0],
        );
        if (angle < -QUARTER_TURN || angle > QUARTER_TURN) angle += HALF_TURN;

        const offset = FONT_MARGIN + this.size / 2;
        this.lengthText
            .att(
                "transform",
                `translate(${midx} ${midy}) rotate(${(angle * 180) / Math.PI})`,
            )
            .att("y", -offset)
            .text(
                formatLength(
                    vNorm(vSub(this.P2.coords, this.P1.coords)),
                    this.precision,
                ),
            );
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as segment_object;
        const dom = primitive_line_object.createSVG(t);
        if (t.precision < 0) return dom;

        t.lengthText = t.svg
            .shape("text")
            .att("x", 0)
            .att("text-anchor", "middle")
            .stl(
                `fill:${t.stroke_color};font-family:Verdana;font-size:${t.fontSize}px;pointer-events:none`,
            );
        return dom.add(t.lengthText);
    }
}

function formatLength(value: number, precision: number): string {
    const factor = 10 ** precision;
    return (Math.round(value * factor) / factor).toString().replace(".", ",");
}

export function createSegment(
    c: construction,
    name: string | null | undefined,
    p1: point_object,
    p2: point_object,
): segment_object {
    return c.add(new segment_object(c, name, p1, p2));
}
