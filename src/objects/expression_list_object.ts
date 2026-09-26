import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { FormulaValue } from "../import/dgp_formula";
import type { construction_object } from "./construction_object";
import type { expression_object } from "./expression_object";
import { list_object } from "./list_object";

// DGPad's List: the points of an Expression whose value is a list of 2D or
// 3D points, drawn as dots and, when `segmentsSize` is positive (its "sg"
// style), joined by segments, a point with NaN coordinates breaking the
// line. DGPad's drawing instructions among the points (colors, pen sizes,
// texts, images: items of 4 or more values) are ignored.
export class expression_list_object extends list_object {
    source: expression_object;
    segmentsSize = -1;
    private segments!: DOMElement;
    private dots!: DOMElement;

    constructor(
        c: construction,
        name: string | null | undefined,
        source: expression_object,
    ) {
        super(c, name, "point", { kind: "number", value: 0 }, [], new Map());
        this.source = source;
        this.readsView = source.viewDependent;
        this.addParents(source);
    }

    computeGeometry(): void {
        const value = this.source.value;
        const items: FormulaValue[][] = [];
        if (Array.isArray(value))
            for (const item of value) {
                // As DGPad, a malformed item empties the whole list.
                if (!Array.isArray(item) || item.length < 2) {
                    items.length = 0;
                    break;
                }
                if (item.length > 3) continue;
                const [x, y, z] = item.map((coord) =>
                    typeof coord === "number" ? coord : NaN,
                );
                items.push([item.length === 2 ? [x, y] : [x, y, z]]);
            }
        this.items = items;
        this.count = items.length;
        this.defined = this.source.defined && this.count > 0;
    }

    render(): void {
        this.dom.stl("display", this.isVisible ? "block" : "none");
        if (!this.isVisible) return;
        let segments = "";
        let dots = "";
        let previous = false;
        const r = this.size;
        this.screenItems.forEach(([p]) => {
            if (!p) {
                previous = false;
                return;
            }
            segments += `${previous ? "L" : "M"}${p[0]} ${p[1]} `;
            previous = true;
            if (r > 0)
                dots += `M${p[0] - r} ${p[1]} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 `;
        });
        this.segments.att("d", this.segmentsSize > 0 ? segments : "");
        this.dots.att("d", dots);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as expression_list_object;
        t.segments = t.svg
            .shape("path")
            .stl(
                `fill:none;stroke:${t.stroke_color};stroke-width:${t.segmentsSize};stroke-linecap:round;stroke-linejoin:round;pointer-events:none`,
            );
        // As DGPad's points: white, or filled with their color when opaque.
        const fill = t.opacity ? t.fill_color : t.prefs.point.color.fill;
        t.dots = t.svg
            .shape("path")
            .stl(
                `fill:${fill};fill-opacity:${t.opacity || 1};stroke:${t.stroke_color};stroke-width:${t.prefs.point.border ?? 1};pointer-events:none`,
            );
        return t.svg.shape("g").add(t.segments, t.dots);
    }
}

export function createExpressionList(
    c: construction,
    name: string | null | undefined,
    source: expression_object,
): expression_list_object {
    return c.add(new expression_list_object(c, name, source));
}
