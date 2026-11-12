import type { construction } from "../construction";
import {
    evaluateValue,
    formulaValue,
    type FormulaNode,
    type ScriptValue,
} from "../import/dgp_formula";
import {
    embed,
    type construction_object,
    type DgoContext,
} from "./construction_object";
import { list_object } from "./list_object";

const NO_COUNT: FormulaNode = { kind: "number", value: 0 };

// Its items, a formula or a list of them in turn.
export type ListTree = FormulaNode | ListTree[];

const leaves = (tree: ListTree): FormulaNode[] =>
    Array.isArray(tree) ? tree.flatMap(leaves) : [tree];

const isList = (value: ScriptValue | null): value is ScriptValue[] =>
    Array.isArray(value) && value.some(Array.isArray);

// GeoGebra's {A, (1, 2), …}: a point for each of its formulas, or for
// those of a list in it, {{A, B}, {C}}, or of a list a formula gives,
// {L, M}. A single formula, not a list of them, is a list itself, as
// Element(L, 1) when L is a list of lists.
export class point_list_object extends list_object {
    // Whether it holds lists, not only points.
    nested = false;
    values: ScriptValue[] = [];

    constructor(
        c: construction,
        name: string | null | undefined,
        readonly tree: ListTree,
        refs: Map<string, construction_object>,
        vec3 = false,
    ) {
        super(c, name, "point", NO_COUNT, leaves(tree), refs, vec3);
    }

    dgo(context: DgoContext): [string, unknown] {
        const write = (tree: ListTree): unknown =>
            Array.isArray(tree)
                ? tree.map(write)
                : this.dgoFormula(tree, context);
        return Array.isArray(this.tree)
            ? ["Pts", write(this.tree)]
            : ["Fl", [write(this.tree)]];
    }

    computeGeometry(): void {
        const env = this.baseEnv();
        const items: ReturnType<typeof formulaValue>[][] = [];
        const item = (value: ScriptValue | null): ScriptValue => {
            const point = formulaValue(value);
            if (point === null && isList(value)) return value.map(item);
            items.push([point]);
            return point ?? NaN;
        };
        const run = (tree: ListTree): ScriptValue =>
            Array.isArray(tree)
                ? tree.map(run)
                : item(evaluateValue(tree, env));
        const { tree } = this;
        let values: ScriptValue[] = [];
        if (Array.isArray(tree)) values = tree.map(run);
        else {
            const list = evaluateValue(tree, env);
            if (isList(list)) values = list.map(item);
        }
        this.values = values;
        this.nested =
            (Array.isArray(tree) && tree.some(Array.isArray)) ||
            values.some(isList);
        this.items = items;
        this.count = items.length;
        this.defined = values.length > 0;
    }

    scriptValue(): ScriptValue | null {
        return this.values;
    }
}

export function createPointList(
    c: construction,
    name: string | null | undefined,
    tree: ListTree,
    refs: Map<string, construction_object>,
    vec3 = false,
): point_list_object {
    return c.add(new point_list_object(c, name, tree, refs, vec3));
}

// A list written in an object's definition, as a point is (see
// embeddedPoint).
export function embeddedList(
    c: construction,
    formula: FormulaNode,
    refs: Map<string, construction_object>,
    vec3: boolean,
): point_list_object {
    return embed(new point_list_object(c, null, formula, refs, vec3));
}
