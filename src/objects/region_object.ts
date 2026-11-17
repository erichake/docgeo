import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import {
    formulaIdentifiers,
    type FormulaNode,
    type FormulaValue,
} from "../import/dgp_formula";
import type { Vec2 } from "../vec";
import {
    construction_object,
    dgoFormula,
    type DgoContext,
} from "./construction_object";
import { evaluateFunction, type ExpressionFormula } from "./expression_object";

// The side of the squares of the view's grid its formula is evaluated on,
// in pixels, and the halvings that find its edge between two of their
// corners.
const CELL = 8;
const HALVINGS = 6;
// The least turn, in radians, between the segments around one of an
// outline's for a corner of its curve to lie in that segment's square.
const CORNER = Math.PI / 6;

type Test = (screen: Vec2) => boolean;
interface Leaf {
    values: string | null;
    grid: Uint8Array;
    path: string;
}
// One of the formulas an inequality is read through, from its region's to
// its own: an argument of a region it is called by, or itself.
interface Level {
    formula: ExpressionFormula;
    node: FormulaNode;
}
const LEAVES = new WeakMap<construction, Map<string, Leaf>>();

// Where a point of the screen is in the plane z = 0: in a parallel
// projection, by an affine map rather than a projection of each point.
function planeMap(C: construction): (screen: Vec2) => Vec2 | null {
    const [o, u, v] = (
        [
            [0, 0],
            [1, 0],
            [0, 1],
        ] as Vec2[]
    ).map((screen) => C.unprojectToZPlane(screen, 0));
    if (C.projectionFrame.focal !== undefined || !o || !u || !v)
        return (screen) => C.unprojectToZPlane(screen, 0) as Vec2 | null;
    const [ax, ay, bx, by] = [
        u[0] - o[0],
        u[1] - o[1],
        v[0] - o[0],
        v[1] - o[1],
    ];
    return ([x, y]) => [o[0] + x * ax + y * bx, o[1] + x * ay + y * by];
}

// Where a formula of x and y holds in the plane z = 0, as GeoGebra shades
// an inequality of two variables: its outline, by marching squares over the
// view, each edge crossing found by halvings. Like GeoGebra, it strokes the
// whole edge of each inequality it combines with ∧, ∨ and ¬, dashed when
// strict, not its outline.
export class region_object extends construction_object {
    formula: ExpressionFormula;
    private d = "";
    private solid = "";
    private dashed = "";
    private path!: DOMElement;
    private solidPath!: DOMElement;
    private dashedPath!: DOMElement;

    constructor(
        c: construction,
        name: string | null | undefined,
        formula: ExpressionFormula,
    ) {
        super(c, name, "polygon");
        this.familytype = "region";
        this.formula = formula;
        this.addParents(...formula.refs.values());
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "Reg",
            dgoFormula(this.formula.source, this.formula.refs, context),
        ];
    }

    project(): void {
        const { C } = this;
        const view = C.formulaView();
        const [width, height] = [C.width, C.height];
        const plane = planeMap(C);
        const argsAt = (screen: Vec2): FormulaValue[] | null => {
            const point = plane(screen);
            return point && [point[0], point[1]];
        };
        const test =
            (formula: ExpressionFormula, at: typeof argsAt): Test =>
            (screen) => {
                const args = at(screen);
                const value =
                    args && evaluateFunction(formula, args, () => view);
                return (
                    typeof value === "number" && value !== 0 && value === value
                );
            };
        const cache = LEAVES.get(C) ?? new Map<string, Leaf>();
        LEAVES.set(C, cache);
        const frame = `${width} ${height} ${JSON.stringify(view)} ${JSON.stringify(C.projectionFrame)}`;
        // An inequality's grid and outline, kept while the window and the
        // values it reads are the same: those of the objects it names, in
        // it and in the arguments of the regions that call it. Not when it
        // calls a function, whose own formula reads others.
        const leaf = (levels: Level[], holds: Test): Leaf => {
            let values: string | null = frame;
            for (const { formula, node } of levels)
                for (const name of formulaIdentifiers(node)) {
                    const ref = formula.refs.get(name);
                    if (!ref) continue;
                    if ((ref as { formula?: unknown }).formula) values = null;
                    if (values === null) break;
                    values += ` ${name}=${JSON.stringify(ref.scriptValue(formula.vec3))}`;
                }
            const key = `${C.view} ${levels.map(({ node }) => JSON.stringify(node)).join(" ")}`;
            const kept = cache.get(key);
            if (kept && values !== null && kept.values === values) return kept;
            const grid = sample(holds, width, height);
            const made = {
                values,
                grid,
                path: trace(grid, holds, width, height),
            };
            if (values !== null) cache.set(key, made);
            return made;
        };
        // Where it holds, combined from the grids of its inequalities,
        // through the regions it calls (a(x, y) ∧ b(x, y)).
        this.solid = this.dashed = "";
        let single: Leaf | null = null;
        const walk = (
            formula: ExpressionFormula,
            node: FormulaNode,
            at: typeof argsAt,
            levels: Level[],
        ): Uint8Array => {
            if (
                node.kind === "binary" &&
                (node.op === "&&" || node.op === "||")
            ) {
                const left = walk(formula, node.left, at, levels);
                const right = walk(formula, node.right, at, levels);
                return node.op === "&&"
                    ? left.map((bit, k) => bit & right[k])
                    : left.map((bit, k) => bit | right[k]);
            }
            if (node.kind === "unary" && node.op === "!")
                return walk(formula, node.operand, at, levels).map(
                    (bit) => 1 - bit,
                );
            const callee =
                node.kind === "userCall"
                    ? formula.refs.get(node.name)
                    : undefined;
            if (node.kind === "userCall" && callee?.familytype === "region") {
                const inner = (callee as region_object).formula;
                return walk(
                    inner,
                    inner.node,
                    (screen) => {
                        const values = at(screen);
                        return (
                            values &&
                            node.args.map((arg) =>
                                evaluateFunction(
                                    { ...formula, node: arg },
                                    values,
                                    () => view,
                                )!,
                            )
                        );
                    },
                    [
                        ...levels,
                        ...node.args.map((arg) => ({ formula, node: arg })),
                    ],
                );
            }
            const made = leaf(
                [...levels, { formula, node }],
                test({ ...formula, node }, at),
            );
            if (node.kind === "binary" && (node.op === "<" || node.op === ">"))
                this.dashed += made.path;
            else this.solid += made.path;
            single = made;
            return made.grid;
        };
        const grid = walk(this.formula, this.formula.node, argsAt, []);
        this.d =
            single && grid === (single as Leaf).grid
                ? (single as Leaf).path
                : trace(grid, test(this.formula, argsAt), width, height);
    }

    render(): void {
        this.dom.stl("display", this.isVisible ? "block" : "none");
        if (!this.isVisible) return;
        this.path.att("d", this.d);
        this.solidPath.att("d", this.solid);
        this.dashedPath.att("d", this.dashed);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as region_object;
        t.path = t.svg
            .shape("path")
            .stl("fill", t.fill_color)
            .stl("fill-opacity", t.opacity ?? 0)
            .stl("fill-rule", "evenodd")
            .stl("stroke", "none")
            .stl("cursor", "pointer");
        const edge = (dash: string) =>
            t.svg
                .shape("path")
                .stl("fill", "none")
                .stl("stroke", t.stroke_color)
                .stl("stroke-width", t.size)
                .stl("stroke-dasharray", dash)
                .stl("pointer-events", "none");
        t.solidPath = edge(t.strokeDashArray);
        t.dashedPath = edge(`${t.size * 3} ${t.size * 2}`);
        return t.svg.shape("g").add(t.path).add(t.solidPath).add(t.dashedPath);
    }
}

// Corners from one square left of and above the view to one beyond it, on
// columns + 1 by rows + 1, those of the outer ring outside, so that every
// outline closes.
const size = (width: number, height: number) => [
    Math.ceil(width / CELL) + 2,
    Math.ceil(height / CELL) + 2,
];
const at = (i: number, j: number): Vec2 => [(i - 1) * CELL, (j - 1) * CELL];

// Whether `holds` at each corner of the view's squares.
function sample(holds: Test, width: number, height: number): Uint8Array {
    const [columns, rows] = size(width, height);
    const inside = new Uint8Array((columns + 1) * (rows + 1));
    for (let j = 1; j < rows; j++)
        for (let i = 1; i < columns; i++)
            inside[j * (columns + 1) + i] = +holds(at(i, j));
    return inside;
}

// The outline of the corners set in `inside`, as an SVG path, each edge
// crossing found by halvings of `holds`.
function trace(
    inside: Uint8Array,
    holds: Test,
    width: number,
    height: number,
): string {
    const [columns, rows] = size(width, height);
    const corner = (i: number, j: number) =>
        i && j && i < columns && j < rows ? inside[j * (columns + 1) + i] : 0;
    // An edge: from its first corner, rightwards (even) or downwards.
    const edge = (i: number, j: number, down: number) =>
        2 * (j * (columns + 1) + i) + down;
    const links = new Map<number, number[]>();
    const link = (from: number, to: number) => {
        links.set(from, [...(links.get(from) ?? []), to]);
        links.set(to, [...(links.get(to) ?? []), from]);
    };
    for (let j = 0; j < rows; j++)
        for (let i = 0; i < columns; i++) {
            const a = corner(i, j);
            const b = corner(i + 1, j);
            const c = corner(i + 1, j + 1);
            const d = corner(i, j + 1);
            const top = edge(i, j, 0);
            const right = edge(i + 1, j, 1);
            const bottom = edge(i, j + 1, 0);
            const left = edge(i, j, 1);
            const crossed = [
                a !== b && top,
                b !== c && right,
                c !== d && bottom,
                d !== a && left,
            ].filter((key) => key !== false);
            if (crossed.length === 2) link(crossed[0], crossed[1]);
            else if (crossed.length === 4) {
                const [x, y] = at(i, j);
                if (+holds([x + CELL / 2, y + CELL / 2]) === a) {
                    link(top, right);
                    link(bottom, left);
                } else {
                    link(left, top);
                    link(right, bottom);
                }
            }
        }
    const crossing = (key: number): Vec2 => {
        const k = key >> 1;
        const [i, j] = [k % (columns + 1), Math.floor(k / (columns + 1))];
        let p = at(i, j);
        let q = key & 1 ? at(i, j + 1) : at(i + 1, j);
        const first = corner(i, j);
        for (let n = 0; n < HALVINGS; n++) {
            const middle: Vec2 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
            if (+holds(middle) === first) p = middle;
            else q = middle;
        }
        return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    };
    const seen = new Set<number>();
    let path = "";
    links.forEach((_, start) => {
        if (seen.has(start)) return;
        const points: Vec2[] = [];
        let [previous, key] = [-1, start];
        do {
            seen.add(key);
            const point = crossing(key);
            const last = points[points.length - 1];
            if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) > 1)
                points.push(point);
            const [one, other] = links.get(key)!;
            [previous, key] = [key, one === previous ? other : one];
        } while (key !== start);
        path += `M${sharpened(points)
            .map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`)
            .join("L")}Z`;
    });
    return path;
}

// A closed outline whose corners, cut by the segment across their square,
// are put back where the segments on either side meet: where its direction
// turns sharply across one segment only, not along a tight curve.
function sharpened(points: Vec2[]): Vec2[] {
    const n = points.length;
    if (n < 6) return points;
    const direction = (k: number): Vec2 => {
        const [a, b] = [points[(k + n) % n], points[(k + 1 + n) % n]];
        return [b[0] - a[0], b[1] - a[1]];
    };
    const turn = (u: Vec2, v: Vec2) =>
        Math.abs(
            Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]),
        );
    const result: Vec2[] = [];
    for (let i = 0; i < n; i++) {
        const p = points[i];
        const q = points[(i + 1) % n];
        result.push(p);
        const u = direction(i - 1);
        const v = direction(i + 1);
        const cross = u[0] * v[1] - u[1] * v[0];
        const angle = turn(u, v);
        if (
            angle < CORNER ||
            turn(direction(i - 2), u) > angle / 3 ||
            turn(v, direction(i + 2)) > angle / 3
        )
            continue;
        // Where the line o p meets the line q r: p + s u = q + t v.
        const s = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / cross;
        const t = ((q[0] - p[0]) * u[1] - (q[1] - p[1]) * u[0]) / cross;
        const x: Vec2 = [p[0] + s * u[0], p[1] + s * u[1]];
        if (
            s > 0 &&
            t < 0 &&
            Math.hypot(x[0] - p[0], x[1] - p[1]) < 1.5 * CELL &&
            Math.hypot(x[0] - q[0], x[1] - q[1]) < 1.5 * CELL
        )
            result.push(x);
    }
    return result;
}

export function createRegion(
    c: construction,
    name: string | null | undefined,
    formula: ExpressionFormula,
): region_object {
    return c.add(new region_object(c, name, formula));
}
