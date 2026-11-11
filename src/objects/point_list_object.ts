import type { construction } from "../construction";
import { evaluateFormula, type FormulaNode } from "../import/dgp_formula";
import type { construction_object, DgoContext } from "./construction_object";
import { list_object } from "./list_object";

const NO_COUNT: FormulaNode = { kind: "number", value: 0 };

// GeoGebra's {A, (1, 2), …}: a point for each of its formulas.
export class point_list_object extends list_object {
    constructor(
        c: construction,
        name: string | null | undefined,
        formulas: FormulaNode[],
        refs: Map<string, construction_object>,
        vec3 = false,
    ) {
        super(c, name, "point", NO_COUNT, formulas, refs, vec3);
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "Pts",
            this.formulas.map((formula) => this.dgoFormula(formula, context)),
        ];
    }

    computeGeometry(): void {
        const env = this.baseEnv();
        this.items = this.formulas.map((formula) => [
            evaluateFormula(formula, env),
        ]);
        this.count = this.items.length;
        this.defined = this.count > 0;
    }
}

export function createPointList(
    c: construction,
    name: string | null | undefined,
    formulas: FormulaNode[],
    refs: Map<string, construction_object>,
    vec3 = false,
): point_list_object {
    return c.add(new point_list_object(c, name, formulas, refs, vec3));
}
