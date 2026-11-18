import type { construction } from "../construction";
import {
    evaluateFormula,
    realPart,
    type FormulaNode,
    type FormulaValue,
} from "../import/dgp_formula";
import type { construction_object, DgoContext } from "./construction_object";
import { list_object, MAX_LIST_COUNT } from "./list_object";

// GeoGebra's IterationList(f, z, s, n): s, f(s), f(f(s))…, n + 1 values of
// the formula f of z, numbers, complex numbers or points, read by name as
// a list, drawn as points.
export class iteration_list_object extends list_object {
    variable: string;

    constructor(
        c: construction,
        name: string | null | undefined,
        variable: string,
        formula: FormulaNode,
        start: FormulaNode,
        count: FormulaNode,
        refs: Map<string, construction_object>,
        vec3 = false,
    ) {
        super(c, name, "point", count, [formula, start], refs, vec3);
        this.variable = variable;
    }

    dgo(context: DgoContext): [string, unknown] {
        const [formula, start] = this.formulas;
        return [
            "ItL",
            [
                this.variable,
                ...[formula, start, this.countFormula].map((node) =>
                    this.dgoFormula(node, context),
                ),
            ],
        ];
    }

    computeGeometry(): void {
        const base = this.baseEnv();
        const [formula, start] = this.formulas;
        let value: FormulaValue | null = evaluateFormula(start, base);
        const env = {
            ...base,
            resolveIdentifier: (name: string) =>
                name === this.variable ? value : base.resolveIdentifier(name),
        };
        const n = Math.min(
            realPart(evaluateFormula(this.countFormula, base)) ?? -1,
            MAX_LIST_COUNT,
        );
        this.items = [[value]];
        for (let k = 0; k < n; k++)
            this.items.push([(value = evaluateFormula(formula, env))]);
        this.count = this.items.length;
        this.defined = n >= 0;
    }
}

export function createIterationList(
    c: construction,
    name: string | null | undefined,
    variable: string,
    formula: FormulaNode,
    start: FormulaNode,
    count: FormulaNode,
    refs: Map<string, construction_object>,
    vec3 = false,
): iteration_list_object {
    return c.add(
        new iteration_list_object(
            c,
            name,
            variable,
            formula,
            start,
            count,
            refs,
            vec3,
        ),
    );
}
