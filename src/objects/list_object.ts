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
import {
    vIsFinite,
    vNorm,
    vNormalize,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";

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

// Every reference — a point's coordinates, a cursor's value, "k", "count" —
// resolves through the same Vec2-shaped identifier slot (see resolveRef),
// so a bare "n" or "k*2" evaluates to a Vec2 like [5, 0], never the plain
// number 5. A List's count and a label's displayed value both need a real
// number, though, so treat a Vec2 with an exactly-zero imaginary part as
// that real number: nothing produces a nonzero imaginary part here unless a
// formula deliberately does (a literal "i", or sqrt of a negative), in
// which case staying a genuinely complex result (and being rejected as a
// count, or shown as "[re;im]" for a label) is the correct outcome.
function realPart(value: FormulaValue | null): number | null {
    if (value === null) return null;
    if (typeof value === "number") return value;
    return value[1] === 0 ? value[0] : null;
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
    texts: DOMElement[] = [];

    constructor(
        c: construction,
        name: string | null | undefined,
        nature: ListNature,
        countFormula: FormulaNode,
        formulas: FormulaNode[],
        refs: Map<string, ListRef>,
    ) {
        super(c, name, "list");
        // A string tag, not `instanceof`, because point_object.ts (magnet
        // targets) can't take a value-import of list_object without a
        // circular import (list_object.ts already imports point_object) —
        // the same reason locus_object is recognized by familytype too.
        this.familytype = "list";
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

    // *************************************************
    // *********** PointOn support (nature "point") *****
    // *************************************************

    private itemPoint(index: number): Vec3 | null {
        const value = this.items[index]?.[0];
        if (!value || typeof value === "number") return null;
        return [value[0], value[1], 0];
    }

    private itemScreen(index: number): Vec2 | null {
        return this.screenItems[index]?.[0] ?? null;
    }

    // Nearest list item to a math-space point — the magnetism ("mg" style)
    // counterpart of alphaAtScreen, used while dragging a free point instead
    // of a point already constrained to this List.
    nearestPoint(target: Vec3): Vec3 | null {
        if (this.nature !== "point") return null;
        let best: Vec3 | null = null;
        let bestDistance = Infinity;
        for (let index = 0; index < this.count; index++) {
            const point = this.itemPoint(index);
            if (!point) continue;
            const distance = vNorm(vSub(point, target));
            if (distance >= bestDistance) continue;
            bestDistance = distance;
            best = point;
        }
        return best;
    }

    // Unlike locus_object.pointAt (a continuous curve, interpolating between
    // samples), a List's items are discrete, individually meaningful
    // positions (e.g. "the k-th tick"): a point on a List snaps to the
    // nearest one instead of ever sitting between two of them.
    pointAt(alpha: number): Vec3 | null {
        if (this.nature !== "point" || this.count === 0) return null;
        const index = Math.max(0, Math.min(this.count - 1, Math.round(alpha)));
        return this.itemPoint(index);
    }

    // Nearest list item to the pointer, in screen space — the discrete
    // counterpart of locus_object.alphaAtScreen's nearest-point-on-polyline
    // search.
    alphaAtScreen(target: Vec2): number | null {
        if (this.nature !== "point") return null;
        let bestAlpha: number | null = null;
        let bestDistance = Infinity;
        for (let index = 0; index < this.count; index++) {
            const point = this.itemScreen(index);
            if (!point) continue;
            const distance = vNorm(vSub(target, point));
            if (distance >= bestDistance) continue;
            bestDistance = distance;
            bestAlpha = index;
        }
        return bestAlpha;
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
            const raw = this.items[index]?.[1] ?? null;
            if (!position || raw === null) {
                text.stl("display", "none");
                return;
            }
            const value = realPart(raw) ?? raw;
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
