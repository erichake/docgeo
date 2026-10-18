import type { construction } from "../construction";
import { formulaSource, type ScriptValue } from "../import/dgp_formula";
import {
    construction_object,
    dgoFormula,
    type DgoContext,
} from "./construction_object";
import {
    runProgram,
    type expression_object,
    type ExpressionProgram,
} from "./expression_object";

// DGPad's Blockly "onchange" program of an expression: run as a button's
// once its value has changed (slider, animation, SET_EXP), never as the
// figure opens. Never drawn.
export class event_object extends construction_object {
    owner: expression_object;
    program: ExpressionProgram;
    // The value it last ran for.
    private seen: ScriptValue | null;

    constructor(
        c: construction,
        name: string | null | undefined,
        owner: expression_object,
        program: ExpressionProgram,
    ) {
        super(c, name, "expression");
        this.owner = owner;
        this.program = program;
        this.seen = owner.value;
        this.hidden = 2;
        // The objects it reads and sets too, which come before it.
        this.addParents(
            owner,
            ...program.refs.values(),
            ...program.targets.values(),
        );
    }

    dgo(context: DgoContext): [string, unknown] {
        const { program, refs, targets } = this.program;
        return [
            "Evt",
            {
                on: context.index(this.owner),
                s: dgoFormula(
                    formulaSource(program),
                    new Map([...refs, ...targets]),
                    context,
                ),
            },
        ];
    }

    computeGeometry(): void {
        if (this.owner.value === this.seen) return;
        this.seen = this.owner.value;
        runProgram(this.C, this.program);
    }
}

export function createEvent(
    c: construction,
    name: string | null | undefined,
    owner: expression_object,
    program: ExpressionProgram,
): event_object {
    return c.add(new event_object(c, name, owner, program));
}
