import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import {
    evaluateFormula,
    type FormulaEnv,
    type FormulaNode,
    type FormulaValue,
} from "../import/dgp_formula";
import { construction_object } from "./construction_object";
import { formatValue, type expression_object } from "./expression_object";
import { point_object } from "./point_object";
import { vIsFinite, vNormalize, vSub, type Vec2 } from "../vec";

export type ListNature = "point" | "segment" | "line" | "label";
export type ListRef = point_object | expression_object;

// point/segment/line results are folded into a single <path>, so this only
// bounds computation (mirrors locus_object's MAX_SAMPLES); label results
// need one real DOM node each (see render()), so they get a much smaller
// pool.
const MAX_LIST_COUNT = 5000;
const MAX_LABEL_COUNT = 500;

// Reserved loop-scope names inside a List's own formulas: "i" is already the
// imaginary unit at the lexer level (see dgp_formula.ts), so the index uses
// "k" instead; "count" holds the list's own evaluated size. Both shadow any
// real object of the same name for the duration of that formula's
// evaluation — a figure using List simply can't name a point/cursor "k" or
// "count" and expect it visible inside a List formula.
function resolveRef(ref: ListRef): Vec2 | null {
    if (ref instanceof point_object)
        return ref.defined ? [ref.coords[0], ref.coords[1]] : null;
    return typeof ref.value === "number" ? [ref.value, 0] : null;
}

function realPart(value: FormulaValue | null): number | null {
    if (value === null) return null;
    return typeof value === "number" ? value : null;
}

export class list_object extends construction_object {
    nature: ListNature;
    countFormula: FormulaNode;
    formulas: FormulaNode[];
    refs: Map<string, ListRef>;
    count = 0;
    items: (FormulaValue | null)[][] = [];
    screenItems: (Vec2 | null)[][] = [];
    private path!: DOMElement;
    private texts: DOMElement[] = [];

    constructor(
        c: construction,
        name: string | null | undefined,
        nature: ListNature,
        countFormula: FormulaNode,
        formulas: FormulaNode[],
        refs: Map<string, ListRef>,
    ) {
        super(c, name, "list");
        this.nature = nature;
        this.countFormula = countFormula;
        this.formulas = formulas;
        this.refs = refs;
        this.addParents(...refs.values());
    }

    private baseEnv(): FormulaEnv {
        return {
            resolveIdentifier: (n) => {
                const ref = this.refs.get(n);
                return ref ? resolveRef(ref) : null;
            },
            pixelScale: () => this.C.GRID.UNIT[0],
        };
    }

    private indexEnv(k: number, count: number): FormulaEnv {
        return {
            resolveIdentifier: (n) => {
                if (n === "k") return [k, 0];
                if (n === "count") return [count, 0];
                const ref = this.refs.get(n);
                return ref ? resolveRef(ref) : null;
            },
            pixelScale: () => this.C.GRID.UNIT[0],
        };
    }

    computeGeometry(): void {
        const rawCount = realPart(
            evaluateFormula(this.countFormula, this.baseEnv()),
        );
        const maxCount =
            this.nature === "label" ? MAX_LABEL_COUNT : MAX_LIST_COUNT;
        this.count =
            rawCount === null
                ? 0
                : Math.max(0, Math.min(maxCount, Math.round(rawCount)));

        this.items = [];
        for (let k = 0; k < this.count; k++) {
            const env = this.indexEnv(k, this.count);
            this.items.push(
                this.formulas.map((formula) => evaluateFormula(formula, env)),
            );
        }
        this.defined = this.count > 0;
    }

    project(): void {
        // The "label" nature's second formula is a value to format as text,
        // not a position: only index 0 is ever projected for it.
        const positionCount = this.nature === "label" ? 1 : this.formulas.length;
        this.screenItems = this.items.map((values) =>
            values.map((value, index) => {
                if (index >= positionCount) return null;
                if (value === null || typeof value === "number") return null;
                const screen = this.C.pt3D([value[0], value[1], 0]);
                return vIsFinite(screen) ? screen : null;
            }),
        );
    }

    render(): void {
        this.dom.stl("display", this.isVisible ? "block" : "none");
        if (!this.isVisible) return;
        if (this.nature === "label") {
            this.renderLabels();
            return;
        }
        this.path.att("d", this.buildPath());
    }

    private buildPath(): string {
        const r = this.size;
        return this.screenItems
            .map((points) => {
                if (this.nature === "point") {
                    const p = points[0];
                    if (!p) return "";
                    return `M${p[0] - r} ${p[1]} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0`;
                }
                const [p1, p2] = points;
                if (!p1 || !p2) return "";
                if (this.nature === "segment")
                    return `M${p1[0]} ${p1[1]} L${p2[0]} ${p2[1]}`;
                const extended = this.extendLine(p1, p2);
                if (!extended) return "";
                const [e1, e2] = extended;
                return `M${e1[0]} ${e1[1]} L${e2[0]} ${e2[1]}`;
            })
            .join(" ");
    }

    // Same "draw far enough past the viewport to read as infinite" overscan
    // primitive_line_object.project() uses for lines without a natural
    // reference span (no shared clip-to-viewport utility exists to call
    // into instead).
    private extendLine(p1: Vec2, p2: Vec2): [Vec2, Vec2] | null {
        const direction = vNormalize(vSub(p2, p1));
        if (!direction) return null;
        const length =
            this.C.width + this.C.height + Math.abs(p1[0]) + Math.abs(p1[1]);
        return [
            [p1[0] - length * direction[0], p1[1] - length * direction[1]],
            [p1[0] + length * direction[0], p1[1] + length * direction[1]],
        ];
    }

    private renderLabels(): void {
        this.texts.forEach((text, index) => {
            const position = this.screenItems[index]?.[0];
            const value = this.items[index]?.[1] ?? null;
            if (!position || value === null) {
                text.stl("display", "none");
                return;
            }
            text
                .stl("display", "block")
                .att("x", position[0])
                .att("y", position[1] + this.fontSize)
                .text(formatValue(value as number | number[], this.precision));
        });
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as list_object;
        const dom = t.svg.shape("g");
        if (t.nature === "label") {
            // Same convention as segment_object's length label: a negative
            // precision (the default) means "don't show a value".
            if (t.precision < 0) return dom;
            t.texts = Array.from({ length: MAX_LABEL_COUNT }, () =>
                t.svg
                    .shape("text")
                    .att("text-anchor", "middle")
                    .stl(
                        `fill:${t.stroke_color};font-family:Verdana;font-size:${t.fontSize}px;pointer-events:none`,
                    ),
            );
            dom.add(...t.texts);
            return dom;
        }
        t.path = t.svg
            .shape("path")
            .stl("pointer-events", "none")
            .stl(
                t.nature === "point"
                    ? `fill:${t.fill_color};stroke:none`
                    : `fill:none;stroke:${t.stroke_color};stroke-width:${t.size}`,
            );
        return dom.add(t.path);
    }
}

export function createList(
    c: construction,
    name: string | null | undefined,
    nature: ListNature,
    countFormula: FormulaNode,
    formulas: FormulaNode[],
    refs: Map<string, ListRef>,
): list_object {
    return c.add(
        new list_object(c, name, nature, countFormula, formulas, refs),
    );
}
