import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import {
    evaluateFormula,
    formulaIdentifiers,
    formulaSource,
    realPart,
    usesView,
    type FormulaEnv,
    type FormulaNode,
    type FormulaValue,
    type ScriptValue,
} from "../import/dgp_formula";
import {
    construction_object,
    dgoFormula,
    type DgoContext,
} from "./construction_object";
import { callFunction, formatValue } from "./expression_object";
import { MAX_SCREEN } from "./point_object";
import { axisBasis } from "./circle1_object";
import {
    vAdd,
    vCross,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";

// "polygon": the points, in turn, bound a filled region; "polygons": each
// run of defined points bounds one; "circle": a center, a radius and, in a
// Sequence, maybe an axis direction.
export type ListNature =
    "point" | "segment" | "line" | "label" | "polygon" | "polygons" | "circle";

// point/segment/line results are folded into a single <path>, so this only
// bounds computation (mirrors locus_object's MAX_SAMPLES); label results
// need one real DOM node each (see render()), so they get a much smaller
// pool.
export const MAX_LIST_COUNT = 100000;
const MAX_LABEL_COUNT = 500;

// Reserved loop-scope names inside a List's own formulas: "i" is already the
// imaginary unit at the lexer level (see dgp_formula.ts), so the index uses
// "k" instead; "count" holds the list's own evaluated size. Both shadow any
// real object of the same name for the duration of that formula's
// evaluation — a figure using List simply can't name a point/cursor "k" or
// "count" and expect it visible inside a List formula.

export class list_object extends construction_object {
    nature: ListNature;
    countFormula: FormulaNode;
    formulas: FormulaNode[];
    refs: Map<string, construction_object>;
    // True in a 3D figure: a point then reads its 3D coordinates.
    protected vec3: boolean;
    count = 0;
    // Its points', as a point's (see POINT_SHAPES).
    shape = "circle";
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
        refs: Map<string, construction_object>,
        vec3 = false,
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
        this.readsView = [countFormula, ...formulas].some(usesView);
        this.refs = refs;
        this.vec3 = vec3;
        this.addParents(...refs.values());
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "Lst",
            [
                this.nature,
                ...[this.countFormula, ...this.formulas].map((formula) =>
                    this.dgoFormula(formula, context),
                ),
            ],
        ];
    }

    // With only the refs it reads, of those its formulas share.
    protected dgoFormula(
        formula: FormulaNode,
        context: DgoContext,
    ): ReturnType<typeof dgoFormula> {
        const names = formulaIdentifiers(formula);
        return dgoFormula(
            formulaSource(formula),
            new Map([...this.refs].filter(([name]) => names.has(name))),
            context,
        );
    }

    protected baseEnv(): FormulaEnv {
        return {
            resolveIdentifier: (n) => {
                const ref = this.refs.get(n);
                return ref ? ref.scriptValue(this.vec3) : null;
            },
            view: () => this.C.formulaView(),
            callFunction: (name, args, derivatives) =>
                callFunction(
                    this.refs,
                    name,
                    args,
                    () => this.C.formulaView(),
                    derivatives,
                ),
        };
    }

    private indexEnv(k: number, count: number): FormulaEnv {
        return {
            resolveIdentifier: (n) => {
                if (n === "k") return k;
                if (n === "count") return count;
                const ref = this.refs.get(n);
                return ref ? ref.scriptValue(this.vec3) : null;
            },
            view: () => this.C.formulaView(),
            callFunction: (name, args, derivatives) =>
                callFunction(
                    this.refs,
                    name,
                    args,
                    () => this.C.formulaView(),
                    derivatives,
                ),
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

    // Read by name, a list of points is their values.
    scriptValue(): ScriptValue | null {
        return this.nature === "point"
            ? this.items.map(([value]) => value ?? NaN)
            : null;
    }

    project(): void {
        this.screenItems = this.items.map((values) =>
            this.nature === "circle"
                ? this.circleScreen(values)
                : values.map((value, index) => {
                      // The "label" nature's second formula is a value to format
                      // as text, not a position.
                      if (this.nature === "label" && index > 0) return null;
                      if (value === null || typeof value === "number")
                          return null;
                      const screen = this.C.pt3D([
                          value[0],
                          value[1],
                          value[2] ?? 0,
                      ]);
                      return screen.every((v) => Math.abs(v) < MAX_SCREEN)
                          ? screen
                          : null;
                  }),
        );
    }

    // The circle's center on the screen, and its images of two orthogonal
    // radii, x and y ones without an axis: conjugate half-diameters of the
    // drawn ellipse.
    private circleScreen([
        center,
        radius,
        axis,
    ]: (FormulaValue | null)[]): (Vec2 | null)[] {
        const r = radius === null ? null : realPart(radius);
        if (!center || typeof center === "number" || r === null || r < 0)
            return [null];
        const normal =
            axis && typeof axis !== "number"
                ? vNormalize([axis[0], axis[1], axis[2] ?? 0] as Vec3)
                : null;
        if (axis !== undefined && !normal) return [null];
        const x = normal ? axisBasis(normal) : ([1, 0, 0] as Vec3);
        const y = normal ? vCross(normal, x) : ([0, 1, 0] as Vec3);
        const c: Vec3 = [center[0], center[1], center[2] ?? 0];
        const screen = [c, vAdd(c, vScale(x, r)), vAdd(c, vScale(y, r))].map(
            (point) => this.C.pt3D(point),
        );
        if (!screen.flat().every((v) => Math.abs(v) < MAX_SCREEN))
            return [null];
        const [o, u, v] = screen;
        return [o, vSub(u, o), vSub(v, o)];
    }

    // *************************************************
    // *********** PointOn support (nature "point") *****
    // *************************************************

    private itemPoint(index: number): Vec3 | null {
        const value = this.items[index]?.[0];
        if (!value || typeof value === "number") return null;
        return [value[0], value[1], value[2] ?? 0];
    }

    private itemScreen(index: number): Vec2 | null {
        return this.screenItems[index]?.[0] ?? null;
    }

    // Nearest list item to a math-space point — the magnetism ("mg" style)
    // counterpart of alphaAtScreen, used while dragging a free point instead
    // of a point already constrained to this List.
    nearestPoint(target: Vec3): Vec3 | null {
        const index = this.nearestIndex(target);
        return index === null ? null : this.itemPoint(index);
    }

    nearestIndex(target: Vec3): number | null {
        if (this.nature !== "point") return null;
        let best: number | null = null;
        let bestDistance = Infinity;
        for (let index = 0; index < this.count; index++) {
            const point = this.itemPoint(index);
            if (!point) continue;
            const distance = vNorm(vSub(point, target));
            if (distance >= bestDistance) continue;
            bestDistance = distance;
            best = index;
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
        if (this.nature === "polygon") {
            const points = this.screenItems.map(([point]) => point);
            return points.every(Boolean)
                ? `M${points.map((point) => point!.join(" ")).join("L")}Z`
                : "";
        }
        if (this.nature === "polygons")
            return this.screenItems
                .map(([point]) => point?.join(" ") ?? "Z")
                .join("L")
                .split(/L?ZL?/)
                .filter(Boolean)
                .map((run) => `M${run}Z`)
                .join("");
        return this.screenItems
            .map((points) => {
                if (this.nature === "point") {
                    const p = points[0];
                    if (!p) return "";
                    const [x, y] = p;
                    switch (this.shape) {
                        case "cross":
                            return `M${x - r} ${y - r}L${x + r} ${y + r}M${x - r} ${y + r}L${x + r} ${y - r}`;
                        case "diamond":
                            return `M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z`;
                        case "rect":
                            return `M${x - r} ${y - r}h${2 * r}v${2 * r}h${-2 * r}Z`;
                    }
                    return `M${x - r} ${y} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0`;
                }
                if (this.nature === "circle") return ellipsePath(points);
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
            text.stl("display", "block")
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
                    ? `fill:${t.fill_color};stroke:${t.shape === "cross" ? t.stroke_color : "none"};stroke-width:2`
                    : `fill:${t.nature === "segment" || t.nature === "line" ? "none" : t.fill_color};fill-opacity:${t.opacity ?? 0};stroke:${t.stroke_color};stroke-width:${t.size}`,
            );
        return dom.add(t.path);
    }
}

// Four Bézier arcs, exact images of those approximating a circle within
// 0.03 %: an affine map keeps them on the ellipse's conjugate diameters.
function ellipsePath([o, u, v]: (Vec2 | null)[]): string {
    if (!o) return "";
    const K = 0.5523;
    const at = (a: number, b: number) =>
        `${o[0] + a * u![0] + b * v![0]} ${o[1] + a * u![1] + b * v![1]}`;
    return `M${at(1, 0)}C${at(1, K)} ${at(K, 1)} ${at(0, 1)}C${at(-K, 1)} ${at(-1, K)} ${at(-1, 0)}C${at(-1, -K)} ${at(-K, -1)} ${at(0, -1)}C${at(K, -1)} ${at(1, -K)} ${at(1, 0)}Z`;
}

export function createList(
    c: construction,
    name: string | null | undefined,
    nature: ListNature,
    countFormula: FormulaNode,
    formulas: FormulaNode[],
    refs: Map<string, construction_object>,
    vec3 = false,
): list_object {
    return c.add(
        new list_object(c, name, nature, countFormula, formulas, refs, vec3),
    );
}
