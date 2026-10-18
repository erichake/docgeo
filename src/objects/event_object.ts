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
import type { point_object } from "./point_object";

// DGPad's Blockly "onchange" program of an expression, run as a button's
// once its value has changed (slider, animation, SET_EXP), or "ondrag"
// program of a point, once dragged or animated: never as the figure opens.
// Never drawn.
export class event_object extends construction_object {
    owner: expression_object | point_object;
    program: ExpressionProgram;
    drag: boolean;
    // The value it last ran for.
    private seen: ScriptValue | null;

    constructor(
        c: construction,
        name: string | null | undefined,
        owner: expression_object | point_object,
        program: ExpressionProgram,
        drag: boolean,
    ) {
        super(c, name, "expression");
        this.owner = owner;
        this.program = program;
        this.drag = drag;
        this.seen = drag ? null : (owner as expression_object).value;
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
                ...(this.drag && { e: "drag" }),
                s: dgoFormula(
                    formulaSource(program),
                    new Map([...refs, ...targets]),
                    context,
                ),
            },
        ];
    }

    computeGeometry(): void {
        if (this.drag) {
            // Once: what it sets computes it again.
            if (this.C.dragged.delete(this.owner))
                runProgram(this.C, this.program);
            return;
        }
        const { value } = this.owner as expression_object;
        if (value === this.seen) return;
        this.seen = value;
        runProgram(this.C, this.program);
    }
}

export function createEvent(
    c: construction,
    name: string | null | undefined,
    owner: expression_object | point_object,
    program: ExpressionProgram,
    drag = false,
): event_object {
    return c.add(new event_object(c, name, owner, program, drag));
}
