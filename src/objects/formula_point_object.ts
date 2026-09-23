import type { construction } from "../construction";
import { evaluateFormula, type FormulaNode } from "../import/dgp_formula";
import { expression_object } from "./expression_object";
import { point_object } from "./point_object";

type FormulaPointRef = point_object | expression_object;

export class formula_point_object extends point_object {
    moveable = false;
    formula: FormulaNode;
    refs: Map<string, FormulaPointRef>;
    // True in a 3D figure (DGPad's legacy SetCoords is3D flag): a
    // referenced point then resolves to its full 3D coordinates (e.g.
    // "P1+[-1,-1,1]", a cube vertex) instead of the 2D/complex-number
    // projection plain point-arithmetic formulas rely on.
    private vec3: boolean;

    constructor(
        c: construction,
        name: string | null | undefined,
        formula: FormulaNode,
        refs: Map<string, FormulaPointRef>,
        vec3 = false,
    ) {
        super(c, name, [0, 0, 0]);
        this.formula = formula;
        this.refs = refs;
        this.vec3 = vec3;
        this.addParents(...refs.values());
    }

    computeGeometry(): void {
        const value = evaluateFormula(this.formula, {
            resolveIdentifier: (n) => {
                const ref = this.refs.get(n)!;
                if (!ref.defined) return null;
                if (ref instanceof expression_object)
                    return typeof ref.value === "number" ? [ref.value, 0] : null;
                return this.vec3 ? ref.coords : [ref.coords[0], ref.coords[1]];
            },
            pixelScale: () => this.C.GRID.UNIT[0],
        });
        if (value === null) {
            this.defined = false;
            return;
        }
        this.coords =
            typeof value === "number"
                ? [value, 0, 0]
                : value.length === 3
                  ? value
                  : [value[0], value[1], 0];
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createFormulaPoint(
    c: construction,
    name: string | null | undefined,
    formula: FormulaNode,
    refs: Map<string, FormulaPointRef>,
    vec3 = false,
): formula_point_object {
    return c.add(new formula_point_object(c, name, formula, refs, vec3));
}
