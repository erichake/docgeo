import type { construction } from "../construction";
import type { DOMElement } from "../dom";
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

// Where a formula of x and y holds in the plane z = 0, as GeoGebra shades
// an inequality of two variables: its outline, by marching squares over the
// view, each edge crossing found by halvings.
export class region_object extends construction_object {
    formula: ExpressionFormula;
    private d = "";
    private path!: DOMElement;

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
        const holds = (screen: Vec2): boolean => {
            const point = C.unprojectToZPlane(screen, 0);
            const value =
                point &&
                evaluateFunction(
                    this.formula,
                    [point[0], point[1]],
                    () => view,
                );
            return typeof value === "number" && value !== 0 && value === value;
        };
        // Corners from one square left of and above the view to one beyond
        // it, those of the outer ring outside, so that every outline closes.
        const columns = Math.ceil(C.width / CELL) + 2;
        const rows = Math.ceil(C.height / CELL) + 2;
        const at = (i: number, j: number): Vec2 => [
            (i - 1) * CELL,
            (j - 1) * CELL,
        ];
        const inside = new Uint8Array((columns + 1) * (rows + 1));
        for (let j = 1; j < rows; j++)
            for (let i = 1; i < columns; i++)
                inside[j * (columns + 1) + i] = +holds(at(i, j));
        const corner = (i: number, j: number) => inside[j * (columns + 1) + i];
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
        this.d = "";
        links.forEach((_, start) => {
            if (seen.has(start)) return;
            const points: string[] = [];
            let [previous, key] = [-1, start];
            do {
                seen.add(key);
                const [x, y] = crossing(key);
                points.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
                const [one, other] = links.get(key)!;
                [previous, key] = [key, one === previous ? other : one];
            } while (key !== start);
            this.d += `M${points.join("L")}Z`;
        });
    }

    render(): void {
        this.dom.stl("display", this.isVisible ? "block" : "none");
        if (this.isVisible) this.path.att("d", this.d);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as region_object;
        t.path = t.svg
            .shape("path")
            .stl("fill", t.fill_color)
            .stl("fill-opacity", t.opacity ?? 0)
            .stl("fill-rule", "evenodd")
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("stroke-dasharray", t.strokeDashArray)
            .stl("cursor", "pointer");
        return t.svg.shape("g").add(t.path);
    }
}

export function createRegion(
    c: construction,
    name: string | null | undefined,
    formula: ExpressionFormula,
): region_object {
    return c.add(new region_object(c, name, formula));
}
