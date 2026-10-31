import type { construction } from "../construction";
import {
    evaluateFormula,
    IDENTIFIER_PART,
    IDENTIFIER_START,
    parseFormula,
    realPart,
    usesView,
    type FormulaEnv,
    type FormulaNode,
    type FormulaValue,
    type ScriptValue,
} from "../import/dgp_formula";
import type { construction_object, DgoContext } from "./construction_object";
import { list_object, MAX_LIST_COUNT, type ListNature } from "./list_object";

export const SEQUENCE_VARIABLE = new RegExp(
    `^${IDENTIFIER_START.source}${IDENTIFIER_PART.source}*$`,
    "u",
);

// Whether a Sequence of this nature has as many formulas: a point's, a
// segment's or a line's ends, a circle's center, radius and maybe axis
// direction, or a polygon's vertices.
export const sequenceShape = (nature: unknown, count: number): boolean =>
    nature === "polygons"
        ? count >= 3
        : nature === "point"
          ? count === 1
          : nature === "circle"
            ? count === 2 || count === 3
            : ["segment", "line"].includes(nature as string) && count === 2;

// Its variable goes from `from` to `to` by `step`, 1 when null.
export interface SequenceLoop {
    variable: string;
    from: FormulaNode;
    to: FormulaNode;
    step: FormulaNode | null;
}

// Its count is its loops'.
const NO_COUNT = parseFormula("0");

// GeoGebra's Sequence(f, i, a, b, s), the items of f for i from a to b by
// s, nested Sequences reading the variables of those around them (see
// DGO.md). A polygon's vertices come in turn, each followed by an
// undefined point.
export class sequence_object extends list_object {
    loops: SequenceLoop[];
    // Read by name, its points, in lists for nested Sequences.
    private values: ScriptValue[] = [];

    constructor(
        c: construction,
        name: string | null | undefined,
        nature: ListNature,
        loops: SequenceLoop[],
        formulas: FormulaNode[],
        refs: Map<string, construction_object>,
        vec3 = false,
    ) {
        super(c, name, nature, NO_COUNT, formulas, refs, vec3);
        this.loops = loops;
        this.readsView ||= loops.some(({ from, to, step }) =>
            [from, to, step ?? NO_COUNT].some(usesView),
        );
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "Seq",
            [
                this.nature,
                this.loops.map(({ variable, from, to, step }) => [
                    variable,
                    ...[from, to, ...(step ? [step] : [])].map((formula) =>
                        this.dgoFormula(formula, context),
                    ),
                ]),
                ...this.formulas.map((formula) =>
                    this.dgoFormula(formula, context),
                ),
            ],
        ];
    }

    computeGeometry(): void {
        const bound = new Map<string, number>();
        const base = this.baseEnv();
        const env: FormulaEnv = {
            ...base,
            resolveIdentifier: (name) =>
                bound.get(name) ?? base.resolveIdentifier(name),
        };
        const real = (formula: FormulaNode) =>
            realPart(evaluateFormula(formula, env));
        const items: (FormulaValue | null)[][] = [];
        // Every loop's turns, which an empty inner loop doesn't add to the
        // items.
        let turns = 0;
        const run = (depth: number): ScriptValue[] => {
            const { variable, from, to, step } = this.loops[depth];
            const [a, b, s] = [real(from), real(to), step ? real(step) : 1];
            const values: ScriptValue[] = [];
            if (a === null || b === null || !s) return values;
            // With a margin for the bounds' rounding errors, as GeoGebra.
            const count = Math.floor((b - a) / s + 1.000001);
            for (let n = 0; n < count && turns < MAX_LIST_COUNT; n++) {
                turns++;
                bound.set(variable, a + n * s);
                if (depth + 1 < this.loops.length) {
                    values.push(run(depth + 1));
                    continue;
                }
                const item = this.formulas.map((formula) =>
                    evaluateFormula(formula, env),
                );
                if (this.nature === "polygons")
                    items.push(...item.map((vertex) => [vertex]), [null]);
                else items.push(item);
                values.push(item[0] ?? NaN);
            }
            return values;
        };
        this.values = run(0);
        this.items = items;
        this.count = items.length;
        this.defined = this.count > 0;
    }

    scriptValue(): ScriptValue | null {
        return this.nature === "point" ? this.values : null;
    }
}

export function createSequence(
    c: construction,
    name: string | null | undefined,
    nature: ListNature,
    loops: SequenceLoop[],
    formulas: FormulaNode[],
    refs: Map<string, construction_object>,
    vec3 = false,
): sequence_object {
    return c.add(
        new sequence_object(c, name, nature, loops, formulas, refs, vec3),
    );
}
