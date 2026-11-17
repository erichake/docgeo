import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import {
    evaluateValue,
    realPart,
    statistic,
    type ScriptValue,
} from "../import/dgp_formula";
import {
    construction_object,
    dgoFormula,
    type DgoContext,
} from "./construction_object";
import { callFunction, type ExpressionFormula } from "./expression_object";

// GeoGebra's box plot of a list, around y and 2s high: its box from the
// first quartile to the third, its median across it, its whiskers out to
// the extrema, ended by bars. A formula reads it as its median.
export class box_plot_object extends construction_object {
    formulas: ExpressionFormula[];
    // y - s, y, y + s, then the list's least value, quartiles and greatest.
    private values: number[] = [];
    private box = "";
    private strokes = "";
    private boxPath!: DOMElement;
    private strokePath!: DOMElement;

    constructor(
        c: construction,
        name: string | null | undefined,
        formulas: ExpressionFormula[],
    ) {
        super(c, name, "polygon");
        this.formulas = formulas;
        formulas.forEach((formula) =>
            this.addParents(...formula.refs.values()),
        );
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "Box",
            this.formulas.map(({ source, refs }) =>
                dgoFormula(source, refs, context),
            ),
        ];
    }

    computeGeometry(): void {
        const view = () => this.C.formulaView();
        const [y, s, list] = this.formulas.map(({ node, refs, vec3 }) =>
            evaluateValue(node, {
                resolveIdentifier: (name) => refs.get(name)!.scriptValue(vec3),
                view,
                callFunction: (name, args, derivatives) =>
                    callFunction(refs, name, args, view, derivatives),
            }),
        );
        const [h, r] = [y, s].map((value) =>
            value === null ? null : realPart(value),
        );
        const values = [
            h !== null && r !== null ? [h - r, h, h + r] : [null],
            ["min", "q1", "median", "q3", "max"].map((fn) =>
                list === null ? null : statistic(fn, list),
            ),
        ].flat();
        this.defined = !values.includes(null);
        this.values = values as number[];
    }

    scriptValue(): ScriptValue | null {
        return this.defined ? this.values[5] : null;
    }

    project(): void {
        this.box = this.strokes = "";
        if (!this.defined) return;
        const [low, middle, high, min, q1, median, q3, max] = this.values;
        const at = (x: number, y: number) => this.C.pt3D([x, y, 0]).join(" ");
        const line = ([x1, y1, x2, y2]: number[]) =>
            `M${at(x1, y1)}L${at(x2, y2)}`;
        this.box = `M${at(q1, low)}L${at(q3, low)}L${at(q3, high)}L${at(q1, high)}Z`;
        this.strokes = [
            [median, low, median, high],
            [min, middle, q1, middle],
            [q3, middle, max, middle],
            [min, low, min, high],
            [max, low, max, high],
        ]
            .map(line)
            .join("");
    }

    render(): void {
        this.dom.stl("display", this.isVisible ? "block" : "none");
        if (!this.isVisible) return;
        this.boxPath.att("d", this.box);
        this.strokePath.att("d", this.strokes);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as box_plot_object;
        const style = (fill: boolean) =>
            `fill:${fill ? t.fill_color : "none"};fill-opacity:${t.opacity ?? 0};stroke:${t.stroke_color};stroke-width:${t.size};stroke-dasharray:${t.strokeDashArray}`;
        t.boxPath = t.svg
            .shape("path")
            .stl(style(true))
            .stl("cursor", "pointer");
        t.strokePath = t.svg
            .shape("path")
            .stl(style(false))
            .stl("pointer-events", "none");
        return t.svg.shape("g").add(t.boxPath).add(t.strokePath);
    }
}

export function createBoxPlot(
    c: construction,
    name: string | null | undefined,
    formulas: ExpressionFormula[],
): box_plot_object {
    return c.add(new box_plot_object(c, name, formulas));
}
