import type { construction } from "../construction";
import { evaluateFormula, type FormulaNode } from "../import/dgp_formula";
import { point_object } from "./point_object";

export class formula_point_object extends point_object {
    formula: FormulaNode;
    refs: Map<string, point_object>;

    constructor(
        c: construction,
        name: string | null | undefined,
        formula: FormulaNode,
        refs: Map<string, point_object>,
    ) {
        super(c, name, [0, 0, 0]);
        this.formula = formula;
        this.refs = refs;
        this.addParents(...refs.values());
    }

    computeGeometry(): void {
        const value = evaluateFormula(this.formula, {
            resolveIdentifier: (n) => {
                const p = this.refs.get(n)!;
                return p.defined ? [p.coords[0], p.coords[1]] : null;
            },
            pixelScale: () => this.C.GRID.UNIT[0],
        });
        if (value === null) {
            this.defined = false;
            return;
        }
        const [x, y] = typeof value === "number" ? [value, 0] : value;
        this.coords = [x, y, 0];
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createFormulaPoint(
    c: construction,
    name: string | null | undefined,
    formula: FormulaNode,
    refs: Map<string, point_object>,
): formula_point_object {
    return c.add(new formula_point_object(c, name, formula, refs));
}
