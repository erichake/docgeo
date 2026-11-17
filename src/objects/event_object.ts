import type { construction, Gesture } from "../construction";
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

// What runs an event's program but a change of value.
export type Trigger = Gesture | "init";

// DGPad's Blockly "onchange" program of an expression, run as a button's
// once its value has changed (slider, animation, SET_EXP), or a point's
// program for a gesture: "ondrag" once it is dragged or animated,
// "onmousedown" and "onmouseup" once pressed and released, the
// "onmousedown" of a text or a shape once clicked (GeoGebra's click
// script). Never as the figure opens, but "oninit", of an expression or a
// button, which runs only then (see runInits). Never drawn.
export class event_object extends construction_object {
    owner: construction_object;
    program: ExpressionProgram;
    // Null for a change of value.
    gesture: Trigger | null;
    // The value it last ran for, or the update.
    private seen: ScriptValue | null;
    private pass = -1;

    constructor(
        c: construction,
        name: string | null | undefined,
        owner: construction_object,
        program: ExpressionProgram,
        gesture: Trigger | null,
    ) {
        super(c, name, "expression");
        this.owner = owner;
        this.program = program;
        this.gesture = gesture;
        this.seen = gesture ? null : (owner as expression_object).value;
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
                ...(this.gesture && { e: this.gesture }),
                s: dgoFormula(
                    formulaSource(program),
                    new Map([...refs, ...targets]),
                    context,
                ),
            },
        ];
    }

    computeGeometry(): void {
        if (this.gesture === "init") return;
        if (this.gesture) {
            // Once: what it sets computes it again.
            const { pass } = this.C.OBJS;
            if (
                this.pass === pass ||
                !this.C.gestures[this.gesture].has(this.owner)
            )
                return;
            this.pass = pass;
            runProgram(this.C, this.program);
            return;
        }
        const { value } = this.owner as expression_object;
        // Computed again, a point's coordinates are a new list.
        if (
            value === this.seen ||
            (Array.isArray(value) && String(value) === String(this.seen))
        )
            return;
        this.seen = value;
        runProgram(this.C, this.program);
    }
}

export function createEvent(
    c: construction,
    name: string | null | undefined,
    owner: construction_object,
    program: ExpressionProgram,
    gesture: Trigger | null = null,
): event_object {
    return c.add(new event_object(c, name, owner, program, gesture));
}

// The "oninit" programs, run once the figure has opened, before what the
// host page may set (see EMBED.md), as DGPad runs them: not when the editor
// builds the figure again.
export function runInits(c: construction): void {
    c.OBJS.V.forEach((object) => {
        if (object instanceof event_object && object.gesture === "init")
            runProgram(c, object.program);
    });
}
