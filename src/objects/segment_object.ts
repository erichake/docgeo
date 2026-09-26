import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import {
    geometryTolerance,
    vAdd,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec2,
} from "../vec";
import type { construction_object } from "./construction_object";
import { edgeStroke } from "./hidden_line";
import type { point_object } from "./point_object";
import { two_points_line_object } from "./two_points_line_object";

const FONT_MARGIN = 5;
const HALF_TURN = Math.PI;
const QUARTER_TURN = Math.PI / 2;
// GeoGebra's segment decorations, 1 to 3 ticks then 1 to 3 arrows: where
// each tick or arrow tip sits along the segment from its midpoint, in tick
// spacings towards its first end.
const DECORATIONS = [
    [],
    [0],
    [0.5, -0.5],
    [1, 0, -1],
    [-1],
    [-2, 0],
    [-1, 1, -3],
];

export class segment_object extends two_points_line_object {
    lengthText?: DOMElement;
    decorationPath?: DOMElement;
    decoration = 0;
    protected showTips = false;

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
        if (this.projectionDefined)
            this.updateHiddenSplit(this.P1.coords, this.P2.coords);
    }

    insideBounds(parameter: number): boolean {
        const length = vNorm(vSub(this.P2.coords, this.P1.coords));
        const tolerance = geometryTolerance(length);
        return parameter >= -tolerance && parameter <= length + tolerance;
    }

    render(): void {
        super.render();
        if (!this.defined || !this.projectionDefined) return;
        const { solid, dashed } = edgeStroke(this.C, this, this.P1, this.P2);
        if (!solid) this.path.att("d", "");
        if (!dashed) this.hiddenPath.att("d", "");
        this.decorationPath?.att("d", this.decorationData());
        if (!this.lengthText) return;

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

    // GeoGebra's DrawSegment geometry, its line thickness being twice our
    // size.
    private decorationData(): string {
        const along = vNormalize(vSub(this.sP1, this.sP2))!;
        const perp: Vec2 = [along[1], -along[0]];
        const mid = vScale(vAdd(this.sP1, this.sP2), 1 / 2);
        const spacing = 2.5 + this.size;
        const tick = vScale(perp, spacing + 1);
        const line = ([x1, y1]: Vec2, [x2, y2]: Vec2) =>
            `M${x1} ${y1} L${x2} ${y2}`;
        return DECORATIONS[this.decoration]
            .map((offset) => {
                const at = vAdd(mid, vScale(along, offset * spacing));
                if (this.decoration <= 3)
                    return line(vSub(at, tick), vAdd(at, tick));
                const back = vAdd(at, vScale(along, spacing));
                return `${line(at, vAdd(back, tick))} ${line(at, vSub(back, tick))}`;
            })
            .join(" ");
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as segment_object;
        const dom = two_points_line_object.createSVG(t);
        if (t.decoration > 0) {
            t.decorationPath = t.svg
                .shape("path")
                .stl(
                    `fill:none;stroke:${t.stroke_color};stroke-width:${t.size};pointer-events:none`,
                );
            dom.add(t.decorationPath);
        }
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
