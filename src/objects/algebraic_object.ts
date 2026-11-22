import { readCas } from "../cas";
import type { construction } from "../construction";
import { casTree } from "../import/cas_formula";
import type { Vec3 } from "../vec";
import type { DgoContext } from "./construction_object";
import {
    dgoEquation,
    equationParents,
    equationValue,
    type Equation,
} from "./equation_conic_object";
import type { expression_object } from "./expression_object";
import { locus_object } from "./locus_object";
import type { point_object } from "./point_object";
import type { point_on_object } from "./point_on_object";
import type { primitive_line_object } from "./primitive_line_object";

// The side, in pixels, of the cells of its window where its sign is read.
const CELL = 8;
const XY = ["x", "y"];

// A plane algebraic curve, drawn where it crosses its window, which it
// follows: typed `left = right` (EqA), or Giac's equation of the locus of a
// point or of the envelope of a line as the driver moves (LocE, see
// locus_equation.ts), until which, or without Giac, it is the swept locus.
export class algebraic_object extends locus_object {
    equation: Equation | null;

    constructor(
        c: construction,
        name: string | null | undefined,
        equation: Equation | null,
        target?: point_object | primitive_line_object,
        driver?: point_on_object | expression_object,
    ) {
        super(c, name, target!, driver!);
        this.equation = equation;
        this.readsView = true;
        if (equation) this.addParents(...equationParents(equation));
    }

    dgo(context: DgoContext): [string, unknown] {
        return this.equation
            ? ["EqA", dgoEquation(this.equation, context)]
            : ["LocE", [this.target, this.driver].map(context.index)];
    }

    computeGeometry(): void {
        const equation = this.equation ?? found(this);
        if (!equation) return super.computeGeometry();
        // Its points stay where they were, its samples changing.
        const kept = (this.children as point_on_object[]).flatMap((child) =>
            child.support === this ? [[child, child.coords] as const] : [],
        );
        this.points = trace(
            (x, y) => equationValue(equation, this.C, [x, y]),
            this.C,
        );
        kept.forEach(([point, coords]) => {
            point.alpha = this.alphaOf(coords) ?? point.alpha;
        });
        this.defined = true;
    }
}

let translator: typeof import("../import/locus_equation") | undefined;
let loading: Promise<unknown> | undefined;
const FOUND = new Map<string, Equation | null>();
const side = (node: Equation[0]["node"]): Equation[0] => ({
    node,
    source: "",
    variables: XY,
    refs: new Map(),
    vec3: false,
});
const ZERO = side({ kind: "number", value: 0 });

// Giac's polynomial, its last while the next is computed.
function found(curve: algebraic_object): Equation | null {
    if (!translator) {
        loading ??= import("../import/locus_equation").then(
            (module) => (translator = module),
        );
        void loading.then(() => curve.C.invalidateGeometry(curve));
        return null;
    }
    const request = translator.locusRequest(curve);
    const answer = request && readCas(curve, request);
    if (typeof answer !== "string") return null;
    if (!FOUND.has(answer)) {
        const tree = casTree(answer, new Set(XY), false);
        FOUND.set(
            answer,
            tree?.kind === "vector" && tree.items.length === 1
                ? [side(tree.items[0]), ZERO]
                : null,
        );
    }
    return FOUND.get(answer)!;
}

// Its polylines, between nulls, where f changes sign: on the edges of the
// window's cells (marching squares), refined by bisection.
export function trace(
    f: (x: number, y: number) => number,
    c: construction,
): (Vec3 | null)[] {
    const { ORG, UNIT } = c.GRID;
    const columns = Math.ceil(c.width / CELL) + 1;
    const rows = Math.ceil(c.height / CELL) + 1;
    const at = (k: number): [number, number] => [
        ((k % columns) * CELL - ORG[0]) / UNIT[0],
        (ORG[1] - Math.floor(k / columns) * CELL) / UNIT[1],
    ];
    const values = Array.from({ length: columns * rows }, (_, k) =>
        f(...at(k)),
    );
    const crossings = new Map<number, Vec3 | null>();
    // The edge from node k to node l, if f changes sign on it.
    const crossing = (k: number, l: number): number | null => {
        const a = values[k];
        const b = values[l];
        if (a > 0 === b > 0 || !Number.isFinite(a + b)) return null;
        const key = 2 * k + +(l > k + 1);
        if (!crossings.has(key)) {
            let [x0, y0] = at(k);
            let [x1, y1] = at(l);
            let x = x0;
            let y = y0;
            let v = a;
            for (let step = 0; step < 8; step++) {
                x = (x0 + x1) / 2;
                y = (y0 + y1) / 2;
                v = f(x, y);
                if (v > 0 === a > 0) [x0, y0] = [x, y];
                else [x1, y1] = [x, y];
            }
            // Not a pole, where f grows.
            crossings.set(
                key,
                Math.abs(v) <= Math.max(Math.abs(a), Math.abs(b))
                    ? [x, y, 0]
                    : null,
            );
        }
        return crossings.get(key) ? key : null;
    };
    const links = new Map<number, number[]>();
    const link = (p: number | null, q: number | null) => {
        if (p === null || q === null) return;
        (links.get(p) ?? links.set(p, []).get(p)!).push(q);
        (links.get(q) ?? links.set(q, []).get(q)!).push(p);
    };
    for (let k = 0; k < columns * (rows - 1); k++) {
        if (k % columns === columns - 1) continue;
        const top = crossing(k, k + 1);
        const left = crossing(k, k + columns);
        const right = crossing(k + 1, k + 1 + columns);
        const bottom = crossing(k + columns, k + columns + 1);
        const sides = [top, right, bottom, left].filter((key) => key !== null);
        if (sides.length === 2) link(sides[0], sides[1]);
        else if (sides.length === 4) {
            // A saddle: the sign at its center tells which sides join.
            const [x, y] = at(k);
            if (
                f(x + CELL / 2 / UNIT[0], y - CELL / 2 / UNIT[1]) > 0 ===
                values[k] > 0
            ) {
                link(top, right);
                link(bottom, left);
            } else {
                link(top, left);
                link(right, bottom);
            }
        }
    }
    const points: (Vec3 | null)[] = [];
    const seen = new Set<number>();
    const walk = (start: number) => {
        let key: number | undefined = start;
        let last = start;
        while (key !== undefined) {
            seen.add(key);
            points.push(crossings.get(key)!);
            last = key;
            key = links.get(key)!.find((next) => !seen.has(next));
        }
        if (last !== start && links.get(last)!.includes(start))
            points.push(crossings.get(start)!);
        points.push(null);
    };
    // Open curves from their ends, then closed ones.
    for (const [key, next] of links)
        if (next.length === 1 && !seen.has(key)) walk(key);
    for (const key of links.keys()) if (!seen.has(key)) walk(key);
    return points;
}

export const createAlgebraic = (
    c: construction,
    name: string | null | undefined,
    equation: Equation | null,
    target?: point_object | primitive_line_object,
    driver?: point_on_object | expression_object,
): algebraic_object =>
    c.add(new algebraic_object(c, name, equation, target, driver));
