import { negation } from "../../import/dgp_formula";
import type {
    FormulaFn,
    FormulaNode,
    Program,
    Statement,
} from "../../import/dgp_formula";

// A program and its blocks, both ways, as Blockly saves its workspace
// (serialization.workspaces): the program's text stays the figure's source,
// the blocks a view of it. Nothing here needs Blockly.

export interface BlockState {
    type: string;
    id?: string;
    x?: number;
    y?: number;
    data?: string;
    collapsed?: boolean;
    fields?: Record<string, unknown>;
    inputs?: Record<string, Input>;
    next?: { block?: BlockState };
    extraState?: Record<string, unknown>;
}

interface Input {
    block?: BlockState;
    shadow?: BlockState;
}

export interface WorkspaceState {
    blocks?: { languageVersion: number; blocks: BlockState[] };
    variables?: { name: string; id: string }[];
}

export const TURTLE_FONTS = [
    "Arial",
    "Courier New",
    "Georgia",
    "Impact",
    "Times New Roman",
    "Trebuchet MS",
    "Verdana",
];
export const FONT_STYLES = ["normal", "italic", "bold"];
export const FONT_ALIGNS = ["center", "left", "right"];

// The first block of an event's program, by its gesture ("change" for an
// expression's value): "when A is dragged".
export const EVENT_HATS: Record<string, string> = {
    drag: "dg_when_dragged",
    down: "dg_when_pressed",
    up: "dg_when_released",
    change: "dg_when_changed",
    init: "dg_when_opened",
};

// The first blocks of programs: a turtle's, an event's, another's.
const ROOTS = new Set([
    "dg_turtle",
    "dg_program",
    ...Object.values(EVENT_HATS),
]);

// The styles a program sets, one value each.
export const STYLE_METHODS = [
    "setHidden",
    "setShowName",
    "setAnimated",
    "setTrace",
    "setCaption",
    "setOpacity",
    "setSize",
    "setPrecision",
    "setIncrement",
    "setLayer",
    "setDash",
];

// The turtle's instructions of one value, as their blocks write them.
const TURTLE_SIMPLE: Record<string, [string, string]> = {
    TURTLE_COLOUR: ["turtle_colour", "N"],
    TURTLE_COLOUR_RGB: ["turtle_colour_rgb", "RGB"],
    TURTLE_COLOUR_INCREMENT: ["turtle_colour_increment", "COL"],
    TURTLE_FILL: ["turtle_fill", "OP"],
    TURTLE_PRINT: ["turtle_print", "TEXT"],
    TURTLE_ROTATE_PT: ["turtle_turn_pt", "VALUE"],
    TURTLE_JOIN_PT: ["turtle_join_pt", "VALUE"],
    SET_NUM_PRECISION: ["turtle_precision", "N"],
};

const TURTLE_WIDTHS: Record<string, [string, string]> = {
    TURTLE_WIDTH: ["turtle_width", "pen"],
    TURTLE_POINTS_WIDTH: ["turtle_width", "points"],
    TURTLE_WIDTH_INCREMENT: ["turtle_width_increment", "pen"],
    TURTLE_POINTS_WIDTH_INCREMENT: ["turtle_width_increment", "points"],
};

const ARITHMETIC: Record<string, string> = {
    "+": "ADD",
    "-": "MINUS",
    "*": "MULTIPLY",
    "/": "DIVIDE",
    "^": "POWER",
    plus: "ADD",
    minus: "MINUS",
    times: "MULTIPLY",
    quotient: "DIVIDE",
    power: "POWER",
    pow: "POWER",
};

const COMPARE: Record<string, string> = {
    "==": "EQ",
    "!=": "NEQ",
    "<": "LT",
    "<=": "LTE",
    ">": "GT",
    ">=": "GTE",
};

const SINGLE: Record<string, string> = {
    sqrt: "ROOT",
    abs: "ABS",
    log: "LN",
    exp: "EXP",
};

const TRIG: Record<string, string> = {
    sin: "SIN",
    cos: "COS",
    tan: "TAN",
    asin: "ASIN",
    acos: "ACOS",
    atan: "ATAN",
};

const ROUND: Record<string, string> = {
    round: "ROUND",
    ceil: "ROUNDUP",
    floor: "ROUNDDOWN",
};

// The functions of math_single, math_trig and math_round, by operator.
const FUNCTIONS = Object.fromEntries(
    Object.entries({ ...SINGLE, ...TRIG, ...ROUND }).map(([fn, op]) => [
        op,
        fn,
    ]),
);

// The global a name read by a program is (see globalName in
// dgp_formula.ts, which Blockly's chunk doesn't import).
const globalOf = (name: string): string | null =>
    name.startsWith("GLOBAL ") ? name.slice(7) : null;

// The function Blockly's "list with an item repeated" calls, which the
// program defines.
const LISTS_REPEAT = "listsRepeat";
const LISTS_REPEAT_FUNCTION = [
    `function ${LISTS_REPEAT}(value, n) {`,
    "    var list = [];",
    "    for (var k = 0; k < n; k++) {",
    "        list[k] = value;",
    "    }",
    "    return list;",
    "}",
];

// Its name in the versions of DGPad's Blockly.
const isListsRepeat = (statement: Statement): boolean =>
    statement.kind === "function" &&
    (statement.name === LISTS_REPEAT || statement.name === "lists_repeat") &&
    statement.params.length === 2;

// A node read through the shape it may have.
type Loose = FormulaNode & { left?: Loose; right?: Loose; args?: Loose[] };

// DGPad's random integer from a to b, as its Blockly writes it.
function randomInt(a: FormulaNode, b: FormulaNode): FormulaNode {
    const call = (fn: FormulaFn, ...args: FormulaNode[]): FormulaNode => ({
        kind: "call",
        fn,
        args,
    });
    const binary = (
        op: "+" | "-" | "*" | "/",
        left: FormulaNode,
        right: FormulaNode,
    ): FormulaNode => ({ kind: "binary", op, left, right });
    const span = call("abs", binary("-", a, b));
    return call(
        "floor",
        binary(
            "+",
            binary(
                "*",
                call("random"),
                binary("+", span, { kind: "number", value: 1 }),
            ),
            binary("/", binary("-", binary("+", a, b), span), {
                kind: "number",
                value: 2,
            }),
        ),
    );
}

class Unsupported extends Error {}

function unsupported(): never {
    throw new Unsupported();
}

// ************************* PROGRAM → BLOCKS *************************

// The blocks of the program, null when some part of it has none. Angles
// written without degrees are degrees only in a figure in degrees. The
// program comes parsed, Blockly's chunk not importing the engine's parser,
// the objects' names written by `format` in the blocks' expressions.
export function programBlocks(
    program: Program,
    degrees: boolean,
    format: (name: string) => string,
): WorkspaceState | null {
    try {
        return new Decompiler(degrees, format).workspace(
            program.body,
            program.locals,
        );
    } catch (error) {
        if (error instanceof Unsupported) return null;
        throw error;
    }
}

const number = (value: number): BlockState => ({
    type: "math_number",
    fields: { NUM: value },
});

const text = (value: string): BlockState => ({
    type: "text",
    fields: { TEXT: value },
});

// A value plugged into an input: numbers in their shadows, which the user
// types into, as in the toolbox.
const value = (block: BlockState): Input =>
    block.type === "math_number" ? { shadow: block } : { block };

// DGPad's block of an expression typed in, for what has no other block.
const expression = (code: string): BlockState => ({
    type: "dg_expression",
    fields: { TEXT: code },
});

const literal = (node: FormulaNode): number | string | null =>
    node.kind === "number"
        ? node.value
        : node.kind === "string"
          ? node.value
          : node.kind === "unary" &&
              node.op === "-" &&
              node.operand.kind === "number"
            ? -node.operand.value
            : null;

// Blockly's φ: (1 + Math.sqrt(5)) / 2.
const goldenRatio = (node: FormulaNode): boolean =>
    node.kind === "binary" &&
    node.op === "/" &&
    literal(node.right) === 2 &&
    node.left.kind === "binary" &&
    node.left.op === "+" &&
    literal(node.left.left) === 1 &&
    node.left.right.kind === "call" &&
    node.left.right.fn === "sqrt" &&
    literal(node.left.right.args[0]) === 5;

// Whether the value is a whole number, as written.
const whole = (node: FormulaNode): boolean =>
    node.kind === "number"
        ? Number.isInteger(node.value)
        : node.kind === "length" ||
          (node.kind === "call" &&
              (node.fn === "round" ||
                  node.fn === "floor" ||
                  node.fn === "ceil"));

const stripped = (node: FormulaNode): FormulaNode | null =>
    node.kind === "unary" && node.op === "-" ? node.operand : null;

// The assignments "v = v + d" and "v++" (read "(v = v + 1) - 1").
function increment(node: FormulaNode, name: string): FormulaNode | null {
    if (
        node.kind === "binary" &&
        node.op === "-" &&
        node.right.kind === "number" &&
        node.right.value === 1
    )
        node = node.left;
    return node.kind === "assign" && node.name === name
        ? added(node.value, name)
        : null;
}

// What "v + d", or Blockly's "Math.plus(v, d)", adds to v.
function added(node: FormulaNode, name: string): FormulaNode | null {
    const [left, right] =
        node.kind === "binary" && node.op === "+"
            ? [node.left, node.right]
            : node.kind === "call" && node.fn === "plus"
              ? node.args
              : [];
    return left?.kind === "identifier" && left.name === name ? right : null;
}

// Whether a "continue" of their own loop is among the statements.
const continues = (statements: Statement[]): boolean =>
    statements.some(
        (statement) =>
            statement.kind === "continue" ||
            (statement.kind === "if" &&
                continues([...statement.then, ...statement.otherwise])),
    );

// How many times the statements name the variable.
const mentions = (statements: Statement[], name: string): number =>
    JSON.stringify(statements).split(`"name":${JSON.stringify(name)}`).length -
    1;

const readsName = (statements: Statement[], name: string): boolean =>
    mentions(statements, name) > 0;

// The local variables of the statements' functions, at any depth.
function functionLocals(statements: Statement[]): string[] {
    return statements.flatMap((statement) =>
        statement.kind === "function"
            ? [...statement.locals, ...functionLocals(statement.body)]
            : statement.kind === "if"
              ? functionLocals([...statement.then, ...statement.otherwise])
              : statement.kind === "loop"
                ? functionLocals(statement.body)
                : [],
    );
}

// The variables the loops "for (var v = a; …)" count with.
function counters(statements: Statement[], names = new Set<string>()) {
    statements.forEach((statement, i) => {
        const loop = statements[i + 1];
        if (
            statement.kind === "expression" &&
            statement.node.kind === "assign" &&
            loop?.kind === "loop" &&
            loop.update
        )
            names.add(statement.node.name);
        if (statement.kind === "if") {
            counters(statement.then, names);
            counters(statement.otherwise, names);
        }
        if (statement.kind === "loop") counters(statement.body, names);
    });
    return names;
}

// The variables the statements set.
function assigned(value: unknown, names = new Set<string>()): Set<string> {
    if (Array.isArray(value)) value.forEach((item) => assigned(item, names));
    else if (value && typeof value === "object") {
        const node = value as { kind?: string; name?: string };
        if (node.kind === "assign") names.add(node.name!);
        Object.values(value).forEach((item) => assigned(item, names));
    }
    return names;
}

// The names the statements read or style, its variables' among them.
function objectNames(value: unknown, names = new Set<string>()): Set<string> {
    if (Array.isArray(value)) value.forEach((item) => objectNames(item, names));
    else if (value && typeof value === "object") {
        const node = value as { kind?: string; name?: string; object?: string };
        if (node.kind === "identifier") names.add(node.name!);
        if (node.kind === "method") names.add(node.object!);
        Object.values(value).forEach((item) => objectNames(item, names));
    }
    return names;
}

// Blockly wrote "Carré" as "Carr_C3_A9" in its JavaScript.
const blocklyName = (name: string): string =>
    name.replace(/(?:_[89A-F][0-9A-F])+/g, (run) => {
        const text = new TextDecoder().decode(
            Uint8Array.from(run.slice(1).split("_"), (hex) =>
                parseInt(hex, 16),
            ),
        );
        return text.includes("\uFFFD") ? run : text;
    });

class Decompiler {
    // The program's variables, by the name its blocks show: Blockly's are
    // the workspace's, whatever function sets them.
    private readonly names = new Map<string, string>();
    private readonly used = new Set<string>();
    // The program's procedures, by name: the names of their parameters.
    private readonly procedures = new Map<string, string[]>();
    // Those of them that return a value.
    private readonly returning = new Set<string>();
    // All its statements.
    private statements: Statement[] = [];
    // The name of the function of "list with an item repeated".
    private repeats: string | null = null;

    constructor(
        private readonly degrees: boolean,
        private readonly format: (name: string) => string,
    ) {}

    // DGPad's prefixes dropped, unless it would make two names one, or a
    // variable one of the objects the program reads: "blockly_var_p1 = p1".
    private name(locals: ReadonlySet<string>, objects: Set<string>): void {
        const plain = (name: string) =>
            blocklyName(
                name.replace(/^(?:blockly_var_|blockly_local_)(?=.)/, ""),
            );
        locals.forEach((name) => objects.delete(name));
        const shown = [...locals, ...objects].map(plain);
        locals.forEach((name) =>
            this.names.set(
                name,
                shown.filter((other) => other === plain(name)).length === 1
                    ? plain(name)
                    : name,
            ),
        );
    }

    workspace(body: Statement[], locals: ReadonlySet<string>): WorkspaceState {
        this.statements = body;
        const repeat = body.find(isListsRepeat);
        if (repeat) {
            this.repeats = (repeat as { name: string }).name;
            body = body.filter((statement) => statement !== repeat);
        }
        // Blockly's "var f = function(){…}; f()".
        const [fn, call] = body;
        if (
            body.length === 2 &&
            fn.kind === "function" &&
            fn.params.length === 0 &&
            call.kind === "expression" &&
            call.node.kind === "userCall" &&
            call.node.name === fn.name &&
            call.node.args.length === 0
        )
            return this.workspace(fn.body, new Set([...locals, ...fn.locals]));
        this.name(
            new Set([...locals, ...functionLocals(body)]),
            objectNames(body),
        );
        const [first] = body;
        const last = body[body.length - 1];
        let root: BlockState;
        if (
            first?.kind === "expression" &&
            first.node.kind === "turtle" &&
            first.node.fn === "TURTLE_INIT"
        ) {
            const [name, point] = first.node.args;
            if (
                name.kind !== "string" ||
                point.kind !== "identifier" ||
                last.kind !== "return" ||
                last.node?.kind !== "turtle" ||
                last.node.fn !== "TURTLE_RESULT"
            )
                unsupported();
            root = {
                type: "dg_turtle",
                data: name.value,
                fields: { POINT: point.name },
            };
            body = body.slice(1, -1);
        } else {
            root = { type: "dg_program" };
            // The value of the last expression, as the one it returns,
            // unless it calls a procedure that returns none.
            if (
                last?.kind === "expression" &&
                !isStatement(last.node) &&
                !body.some(
                    (statement) =>
                        statement.kind === "function" &&
                        last.node.kind === "userCall" &&
                        statement.name === last.node.name &&
                        !returned(statement.body),
                )
            )
                body = [
                    ...body.slice(0, -1),
                    { kind: "return", node: last.node },
                ];
        }
        const functions = body.filter(
            (statement) => statement.kind === "function",
        );
        functions.forEach(({ name, params, body }) => {
            this.procedures.set(
                name,
                params.map((param) => this.names.get(param)!),
            );
            if (returned(body)) this.returning.add(name);
        });
        // A value's block left alone, which DGPad's Blockly wrote "Z;" or
        // "12;".
        const alone = body.filter(
            (statement) =>
                statement.kind === "expression" &&
                !isStatement(statement.node) &&
                statement.node.kind !== "userCall",
        );
        const chain = this.chain(
            body.filter(
                (statement) =>
                    statement.kind !== "function" && !alone.includes(statement),
            ),
        );
        if (chain) root.next = { block: chain };
        // In a column, as Blockly's cleanUp leaves them.
        return {
            blocks: {
                languageVersion: 0,
                blocks: [
                    root,
                    ...functions.map((statement) => this.procedure(statement)),
                    ...alone.map((statement) =>
                        this.value((statement as { node: FormulaNode }).node),
                    ),
                ].map((block, i) => ({ ...block, x: 16, y: 16 + i })),
            },
            variables: [...this.used].map((name) => ({ name, id: name })),
        };
    }

    // A procedure, which returns the value of its last statement, if any.
    private procedure(
        statement: Extract<Statement, { kind: "function" }>,
    ): BlockState {
        const result = returned(statement.body);
        const body = result ? statement.body.slice(0, -1) : statement.body;
        if (JSON.stringify(body).includes('"kind":"return"')) unsupported();
        // The variables it sets are the program's, as Blockly's, or all its
        // own, as DGPad's Blockly declares them (see Generator.procedure),
        // its loops' counters apart.
        const apart = new Set([...statement.params, ...counters(body)]);
        const own = [...statement.locals].filter((name) => !apart.has(name));
        const set = [...assigned(body)].filter((name) => !apart.has(name));
        if (
            own.length &&
            (own.length !== set.length ||
                own.some((name) => !set.includes(name)))
        )
            unsupported();
        const params = this.procedures.get(statement.name)!;
        params.forEach((param) => this.used.add(param));
        const block = this.chain(body);
        return {
            type: result ? "procedures_defreturn" : "procedures_defnoreturn",
            ...(own.length && { data: OWN_VARIABLES }),
            fields: { NAME: blocklyName(statement.name) },
            ...(params.length && {
                extraState: {
                    params: params.map((name) => ({ name, id: name })),
                },
            }),
            inputs: {
                ...(block && { STACK: { block } }),
                ...(result && { RETURN: value(this.value(result)) }),
            },
        };
    }

    // The call of a procedure, as `type`.
    private call(
        node: Extract<FormulaNode, { kind: "userCall" }>,
        type: string,
    ): BlockState {
        const params = this.procedures.get(node.name) ?? unsupported();
        if (
            node.args.length !== params.length ||
            this.returning.has(node.name) !== (type === "procedures_callreturn")
        )
            unsupported();
        return {
            type,
            extraState: {
                name: blocklyName(node.name),
                ...(params.length && { params }),
            },
            inputs: Object.fromEntries(
                node.args.map((arg, i) => [`ARG${i}`, value(this.value(arg))]),
            ),
        };
    }

    private variable(name: string): { id: string } {
        const shown = this.names.get(name) ?? unsupported();
        this.used.add(shown);
        return { id: shown };
    }

    // The statements, each linked to the next.
    private chain(statements: Statement[]): BlockState | undefined {
        const blocks: BlockState[] = [];
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            const loop = statements[i + 1];
            // Blockly's "repeat n times", n computed: "var repeat_end = n;
            // for (var count = 0; count < repeat_end; count++)".
            const [end, init, after] = statements.slice(i, i + 3);
            const bound =
                after?.kind === "loop" &&
                after.test?.kind === "binary" &&
                after.test.op === "<"
                    ? after.test.right
                    : null;
            if (
                end.kind === "expression" &&
                end.node.kind === "assign" &&
                init?.kind === "expression" &&
                init.node.kind === "assign" &&
                literal(init.node.value) === 0 &&
                after?.kind === "loop" &&
                after.update &&
                bound?.kind === "identifier" &&
                bound.name === end.node.name &&
                mentions(this.statements, end.node.name) === 2
            ) {
                blocks.push(this.forLoop(init.node, after, end.node.value)!);
                i += 2;
                continue;
            }
            // "for (var v = a; v <= b; v = v + c)".
            const counted =
                loop?.kind === "loop" &&
                statement.kind === "expression" &&
                statement.node.kind === "assign" &&
                loop.update &&
                this.forLoop(statement.node, loop);
            if (counted) {
                blocks.push(counted);
                i++;
            } else blocks.push(this.statement(statement));
        }
        blocks.reduceRight<BlockState | undefined>((next, block) => {
            if (next) block.next = { block: next };
            return block;
        }, undefined);
        return blocks[0];
    }

    private body(statements: Statement[]): Record<string, Input> {
        const block = this.chain(statements);
        return block ? { DO: { block } } : {};
    }

    // Its count is `times` when Blockly computed it before. Null when it
    // isn't one of Blockly's loops.
    private forLoop(
        init: Extract<FormulaNode, { kind: "assign" }>,
        loop: Extract<Statement, { kind: "loop" }>,
        times?: FormulaNode,
    ): BlockState | null {
        const { name } = init;
        const { test } = loop;
        const step = increment(loop.update!, name);
        if (
            !step ||
            test?.kind !== "binary" ||
            test.left.kind !== "identifier" ||
            test.left.name !== name
        )
            return null;
        const from = literal(init.value);
        const counted = literal(step!) === 1 && !readsName(loop.body, name);
        const repeat = (count: FormulaNode): BlockState => ({
            type: "controls_repeat_ext",
            inputs: {
                TIMES: value(this.value(count)),
                ...this.body(loop.body),
            },
        });
        // DGPad's "repeat n times" counted from 1 by 1, Blockly's from 0,
        // which repeats as many times when n is whole.
        if (
            test!.op === "<" &&
            from === 0 &&
            counted &&
            whole(times ?? test!.right)
        )
            return repeat(times ?? test!.right);
        if (times) unsupported();
        if (test!.op !== "<=") return null;
        if (from === 1 && counted) return repeat(test!.right);
        return {
            type: "controls_for",
            fields: { VAR: this.variable(name) },
            inputs: {
                FROM: value(this.value(init.value)),
                TO: value(this.value(test!.right)),
                BY: value(this.value(step!)),
                ...this.body(loop.body),
            },
        };
    }

    private statement(statement: Statement): BlockState {
        switch (statement.kind) {
            case "expression":
                return this.instruction(statement.node);
            case "return":
                return {
                    type: "dg_return",
                    inputs: statement.node
                        ? { VALUE: value(this.value(statement.node)) }
                        : {},
                };
            case "if": {
                const inputs: BlockState["inputs"] = {};
                let count = 0;
                let current: Extract<Statement, { kind: "if" }> = statement;
                for (;;) {
                    inputs[`IF${count}`] = value(this.value(current.test));
                    const block = this.chain(current.then);
                    if (block) inputs[`DO${count}`] = { block };
                    const [only, ...rest] = current.otherwise;
                    if (only?.kind === "if" && rest.length === 0) {
                        current = only;
                        count++;
                        continue;
                    }
                    const otherwise = this.chain(current.otherwise);
                    if (otherwise) inputs.ELSE = { block: otherwise };
                    return {
                        type: "controls_if",
                        ...((count || current.otherwise.length) && {
                            extraState: {
                                ...(count && { elseIfCount: count }),
                                ...(current.otherwise.length && {
                                    hasElse: true,
                                }),
                            },
                        }),
                        inputs,
                    };
                }
            }
            case "loop": {
                // Any other "for", as a "while" ending with its update.
                const { update } = statement;
                if (!statement.test || (update && continues(statement.body)))
                    unsupported();
                const body: Statement[] = update
                    ? [...statement.body, { kind: "expression", node: update }]
                    : statement.body;
                const test = statement.test!;
                const until = test.kind === "unary" && test.op === "!";
                return {
                    type: "controls_whileUntil",
                    fields: { MODE: until ? "UNTIL" : "WHILE" },
                    inputs: {
                        BOOL: value(
                            this.value(
                                until
                                    ? (test as { operand: FormulaNode }).operand
                                    : test,
                            ),
                        ),
                        ...this.body(body),
                    },
                };
            }
            case "break":
            case "continue":
                return {
                    type: "controls_flow_statements",
                    fields: { FLOW: statement.kind.toUpperCase() },
                };
            case "function":
                return unsupported();
        }
    }

    // A statement that only does something.
    private instruction(node: FormulaNode): BlockState {
        // "v++" or "v--", (v = v ± 1) ∓ 1, its value unread.
        if (
            node.kind === "binary" &&
            node.left.kind === "assign" &&
            node.right.kind === "number" &&
            node.right.value === 1 &&
            increment(node, node.left.name)
        )
            node = node.left;
        if (node.kind === "assign") {
            const delta = increment(node, node.name);
            return delta
                ? {
                      type: "math_change",
                      fields: { VAR: this.variable(node.name) },
                      inputs: { DELTA: value(this.value(delta)) },
                  }
                : {
                      type: "variables_set",
                      fields: { VAR: this.variable(node.name) },
                      inputs: { VALUE: value(this.value(node.value)) },
                  };
        }
        if (node.kind === "assignItem") {
            const { name, indices } = node;
            const list = indices
                .slice(0, -1)
                .reduce<FormulaNode>(
                    (target, index) => ({ kind: "index", target, index }),
                    { kind: "identifier", name },
                );
            return {
                type: "dg_list_set",
                inputs: {
                    LIST: value(this.value(list)),
                    INDEX: value(this.position(indices[indices.length - 1])),
                    VALUE: value(this.value(node.value)),
                },
            };
        }
        // DGPad's "append to the end of the list", and Blockly's "remove
        // the first item" or the last, of a variable's list.
        if (
            node.kind === "method" &&
            (node.method === "push" ||
                node.method === "shift" ||
                node.method === "pop")
        ) {
            const list = value(
                this.value(
                    node.indices.reduce<FormulaNode>(
                        (target, index) => ({ kind: "index", target, index }),
                        { kind: "identifier", name: node.object },
                    ),
                ),
            );
            if (node.method !== "push")
                return {
                    type: "dg_list_remove",
                    fields: { WHERE: node.method },
                    inputs: { LIST: list },
                };
            if (node.args.length !== 1) unsupported();
            if (isBreak(node.args[0]))
                return { type: "dg_list_break", inputs: { LIST: list } };
            return {
                type: "dg_list_push",
                inputs: { VALUE: value(this.value(node.args[0])), LIST: list },
            };
        }
        if (node.kind === "method") {
            if (node.indices.length) unsupported();
            const global = globalOf(node.object);
            if (global !== null && node.method === "setExpression") {
                const [assigned] = node.args;
                // GLOBAL_INC's "g = g + d".
                const delta = added(assigned, node.object);
                return {
                    type: delta ? "dg_global_inc" : "dg_global_set",
                    fields: { NAME: global },
                    inputs: delta
                        ? { DELTA: value(this.value(delta)) }
                        : { VALUE: value(this.value(assigned)) },
                };
            }
            if (node.method === "setExpression")
                return {
                    type: "dg_set_value",
                    fields: { OBJECT: node.object },
                    inputs: { VALUE: value(this.value(node.args[0])) },
                };
            if (node.method === "setRGBColor") {
                const [r, g, b] = node.args.map((arg) =>
                    value(this.value(arg)),
                );
                return {
                    type: "dg_style_rgb",
                    fields: { OBJECT: node.object },
                    inputs: { R: r, G: g, B: b },
                };
            }
            // DGPad's arrows at the ends of a List's segments, their length
            // and half width in pixels.
            const [arrow] = node.args;
            if (
                node.method === "setArrow" &&
                arrow?.kind === "vector" &&
                arrow.items.length === 2
            )
                return {
                    type: "dg_style_arrow",
                    fields: { OBJECT: node.object },
                    inputs: {
                        W: value(this.value(arrow.items[0])),
                        H: value(this.value(arrow.items[1])),
                    },
                };
            if (!STYLE_METHODS.includes(node.method)) unsupported();
            return {
                type: "dg_style",
                fields: { OBJECT: node.object, METHOD: node.method },
                inputs: { VALUE: value(this.value(node.args[0])) },
            };
        }
        if (node.kind === "userCall")
            return this.call(node, "procedures_callnoreturn");
        if (node.kind === "call" && node.fn === "ALERT")
            return {
                type: "dg_alert",
                inputs: { TEXT: value(this.value(node.args[0])) },
            };
        if (node.kind === "call" && node.fn === "ASK")
            return {
                type: "dg_ask",
                inputs: { TEXT: value(this.value(node.args[0])) },
            };
        if (node.kind === "call" && node.fn === "WAIT")
            return {
                type: "dg_wait",
                inputs: { MS: value(this.value(node.args[0])) },
            };
        if (node.kind === "call" && node.fn === "VIEW_DIRECTION")
            return {
                type: "dg_view_direction",
                inputs: { VECTOR: value(this.value(node.args[0])) },
            };
        if (node.kind === "call" && node.fn === "SHOW_GRID")
            return {
                type: "dg_show_grid",
                inputs: { SHOWN: value(this.value(node.args[0])) },
            };
        if (node.kind === "call" && node.fn === "CENTER_VIEW")
            return {
                type: "dg_center_view",
                inputs: { POINT: value(this.value(node.args[0])) },
            };
        if (node.kind === "call" && node.fn === "CLEAR_TRACES")
            return { type: "dg_clear_traces" };
        if (node.kind === "call" && node.fn === "BACKGROUND") {
            const [r, g, b] = node.args.map((arg) => value(this.value(arg)));
            return { type: "dg_background", inputs: { R: r, G: g, B: b } };
        }
        if (node.kind === "call" && node.fn === "SHOW_AXIS") {
            const axis = literal(node.args[0]);
            if (axis !== 0 && axis !== 1 && axis !== 2) unsupported();
            return {
                type: "dg_show_axis",
                fields: { AXIS: String(axis) },
                inputs: { SHOWN: value(this.value(node.args[1])) },
            };
        }
        if (node.kind !== "turtle") return unsupported();
        const { fn, args } = node;
        const simple = TURTLE_SIMPLE[fn];
        if (simple)
            return {
                type: simple[0],
                inputs: { [simple[1]]: value(this.value(args[0])) },
            };
        const width = TURTLE_WIDTHS[fn];
        if (width)
            return {
                type: width[0],
                fields: { WHAT: width[1] },
                inputs: { WIDTH: value(this.value(args[0])) },
            };
        switch (fn) {
            case "TURTLE_MV": {
                const units = literal(args[1]);
                if (typeof units !== "number") unsupported();
                const back = stripped(args[0]);
                return {
                    type: "turtle_move",
                    fields: {
                        DIR: back ? "backward" : "forward",
                        UNITS: units ? "px" : "un",
                    },
                    inputs: { VALUE: value(this.value(back ?? args[0])) },
                };
            }
            case "TURTLE_TURN": {
                const right = stripped(args[0]);
                return {
                    type: "turtle_turn",
                    fields: { DIR: right ? "right" : "left" },
                    inputs: { VALUE: value(this.angle(right ?? args[0])) },
                };
            }
            case "TURTLE_ROTATE": {
                const vertical = literal(args[1]);
                if (typeof vertical !== "number") unsupported();
                const back = stripped(args[0]);
                const dir = vertical
                    ? back
                        ? "down"
                        : "up"
                    : back
                      ? "left"
                      : "right";
                return {
                    type: "turtle_rotate",
                    fields: { DIR: dir },
                    inputs: { VALUE: value(this.angle(back ?? args[0])) },
                };
            }
            case "TURTLE_UP": {
                const up = literal(args[0]);
                if (typeof up !== "number") unsupported();
                return {
                    type: "turtle_pen",
                    fields: { PEN: up ? "up" : "down" },
                };
            }
            case "TURTLE_RESET":
                return { type: "turtle_reset" };
            case "TURTLE_FONT": {
                const [font, size, style, align] = args.map(literal);
                if (
                    !TURTLE_FONTS.includes(font as string) ||
                    typeof size !== "number" ||
                    !FONT_STYLES.includes(style as string) ||
                    !FONT_ALIGNS.includes(align as string)
                )
                    unsupported();
                return {
                    type: "turtle_font",
                    fields: {
                        FONT: font,
                        SIZE: size,
                        STYLE: style,
                        ALIGN: align,
                    },
                };
            }
            case "TURTLE_PRINT_IMG": {
                const [url, w, h, z, o] = args.map((arg) =>
                    value(this.value(arg)),
                );
                return {
                    type: "turtle_image",
                    inputs: { URL: url, W: w, H: h, Z: z, O: o },
                };
            }
        }
        return unsupported();
    }

    // The rank, from 1, of the item at `index`, which Blockly writes "i-1".
    private position(index: FormulaNode): BlockState {
        if (
            index.kind === "binary" &&
            index.op === "-" &&
            index.right.kind === "number" &&
            index.right.value === 1
        )
            return this.value(index.left);
        return index.kind === "number"
            ? number(index.value + 1)
            : this.arithmetic("ADD", index, { kind: "number", value: 1 });
    }

    private list(items: FormulaNode[]): BlockState {
        return {
            type: "lists_create_with",
            extraState: { itemCount: items.length },
            inputs: Object.fromEntries(
                items.map((item, i) => [`ADD${i}`, value(this.value(item))]),
            ),
        };
    }

    // An angle in degrees.
    private angle(node: FormulaNode): BlockState {
        if (node.kind === "call" && node.fn === "°")
            return this.value(node.args[0]);
        return this.degrees ? this.value(node) : unsupported();
    }

    private value(node: FormulaNode): BlockState {
        switch (node.kind) {
            case "number":
                return Number.isNaN(node.value)
                    ? expression("NaN")
                    : number(node.value);
            case "string":
                return text(node.value);
            case "constant":
                return {
                    type: "math_constant",
                    fields: { CONSTANT: node.name },
                };
            case "identifier":
                if (globalOf(node.name) !== null)
                    return {
                        type: "dg_global_get",
                        fields: { NAME: globalOf(node.name) },
                    };
                return this.names.has(node.name)
                    ? {
                          type: "variables_get",
                          fields: { VAR: this.variable(node.name) },
                      }
                    : { type: "dg_object", fields: { NAME: node.name } };
            case "unary":
                if (node.op === "!")
                    return {
                        type: "logic_negate",
                        inputs: { BOOL: value(this.value(node.operand)) },
                    };
                return node.operand.kind === "number"
                    ? number(-node.operand.value)
                    : {
                          type: "math_single",
                          fields: { OP: "NEG" },
                          inputs: { NUM: value(this.value(node.operand)) },
                      };
            case "binary":
                return goldenRatio(node)
                    ? {
                          type: "math_constant",
                          fields: { CONSTANT: "GOLDEN_RATIO" },
                      }
                    : this.binary(node);
            case "conditional":
                return {
                    type: "logic_ternary",
                    inputs: {
                        IF: value(this.value(node.test)),
                        THEN: value(this.value(node.then)),
                        ELSE: value(this.value(node.otherwise)),
                    },
                };
            // Of 2 or 3 items, a point, unless one of them is a text or a
            // list, as a menu's [value, caption].
            case "vector":
                if (
                    (node.items.length !== 2 && node.items.length !== 3) ||
                    node.items.some(
                        (item) =>
                            item.kind === "string" ||
                            item.kind === "vector" ||
                            (item.kind === "turtle" &&
                                item.fn === "TURTLE_TEXT"),
                    )
                )
                    return this.list(node.items);
                return {
                    type: node.items.length === 2 ? "dg_point" : "dg_point3",
                    inputs: Object.fromEntries(
                        node.items.map((item, i) => [
                            "XYZ"[i],
                            value(this.value(item)),
                        ]),
                    ),
                };
            case "call":
                return this.fn(node);
            case "index": {
                // Blockly's last item: "L.slice(-1)[0]".
                const { target, index } = node;
                if (
                    target.kind === "slice" &&
                    target.args.length === 1 &&
                    literal(target.args[0]) === -1 &&
                    literal(index) === 0
                )
                    return {
                        type: "dg_list_last",
                        inputs: { LIST: value(this.value(target.target)) },
                    };
                return {
                    type: "dg_list_get",
                    inputs: {
                        LIST: value(this.value(node.target)),
                        INDEX: value(this.position(node.index)),
                    },
                };
            }
            case "length":
                return {
                    type: "lists_length",
                    inputs: { VALUE: value(this.value(node.target)) },
                };
            case "userCall": {
                const [item, count] = node.args;
                // A function of the figure: "f(t)".
                if (
                    !this.procedures.has(node.name) &&
                    node.name !== this.repeats
                )
                    return expression(
                        `${this.format(node.name)}(${node.args.map((arg) => this.code(arg)[0]).join(", ")})`,
                    );
                if (node.name !== this.repeats)
                    return this.call(node, "procedures_callreturn");
                if (node.args.length !== 2) unsupported();
                return {
                    type: "lists_repeat",
                    inputs: {
                        ITEM: value(this.value(item)),
                        NUM: value(this.value(count)),
                    },
                };
            }
            // DGPad's later text join: "[a, b].join('')".
            case "join":
                if (
                    node.target.kind !== "vector" ||
                    node.separator?.kind !== "string" ||
                    node.separator.value !== ""
                )
                    return expression(
                        `${this.operand(node.target)}.join(${node.separator ? this.code(node.separator)[0] : ""})`,
                    );
                return this.join(
                    (node.target as { items: FormulaNode[] }).items.map(
                        (item) => this.value(item),
                    ),
                );
            case "native": {
                const [target, arg] = node.args;
                return expression(
                    node.fn === "parseInt"
                        ? `parseInt(${this.code(target)[0]})`
                        : `${this.operand(target)}.${node.fn}(${arg ? this.code(arg)[0] : ""})`,
                );
            }
            case "turtle":
                switch (node.fn) {
                    case "TURTLE_TEXT":
                        return this.value(node.args[0]);
                    case "TURTLE_POS":
                        return { type: "turtle_position" };
                    case "TURTLE_GET":
                    case "TURTLE_LENGTH": {
                        const [name, index] = node.args;
                        if (name.kind !== "string") unsupported();
                        return node.fn === "TURTLE_GET"
                            ? {
                                  type: "turtle_get",
                                  fields: {
                                      NAME: (name as { value: string }).value,
                                  },
                                  inputs: { NUM: value(this.value(index)) },
                              }
                            : {
                                  type: "turtle_length",
                                  fields: {
                                      NAME: (name as { value: string }).value,
                                  },
                              };
                    }
                }
        }
        return unsupported();
    }

    // The node as its blocks write it, in a block "expression".
    private code(node: FormulaNode): Code {
        return new Generator({}, this.format).code(this.value(node));
    }

    private operand(node: FormulaNode): string {
        const [code, order] = this.code(node);
        return order > POSTFIX ? `(${code})` : code;
    }

    private fn(node: Extract<FormulaNode, { kind: "call" }>): BlockState {
        const { fn, args } = node;
        const [a, b] = args;
        if (fn in ARITHMETIC) return this.arithmetic(ARITHMETIC[fn], a, b);
        const single = (type: string, op: string) => ({
            type,
            fields: { OP: op },
            inputs: { NUM: value(this.value(a)) },
        });
        if (fn in SINGLE) return single("math_single", SINGLE[fn]);
        if (fn in TRIG) return single("math_trig", TRIG[fn]);
        // Its terms: floor(random()*(abs(a-b)+1)+…).
        const span = (a as Loose | undefined)?.left?.right?.left?.args?.[0];
        if (
            fn === "floor" &&
            span?.kind === "binary" &&
            JSON.stringify(randomInt(span.left, span.right)) ===
                JSON.stringify(node)
        )
            return {
                type: "math_random_int",
                inputs: {
                    FROM: value(this.value(span.left)),
                    TO: value(this.value(span.right)),
                },
            };
        if (fn in ROUND) return single("math_round", ROUND[fn]);
        switch (fn) {
            case "°":
                return {
                    type: "dg_degrees",
                    inputs: { VALUE: value(this.value(a)) },
                };
            case "d":
                return {
                    type: "dg_distance",
                    inputs: {
                        A: value(this.value(a)),
                        B: value(this.value(b)),
                    },
                };
            case "x":
            case "y":
            case "z":
                return {
                    type: "dg_coordinate",
                    fields: { AXIS: fn },
                    inputs: { POINT: value(this.value(a)) },
                };
            case "random":
                return { type: "math_random_float" };
            case "ANSWER":
                return { type: "dg_answer" };
            // What DGPad's Blockly reads of the view.
            case "windoww":
            case "windowh":
            case "windowcx":
            case "windowcy":
            case "pixel":
            case "phi":
            case "theta":
                return { type: "dg_view", fields: { NAME: fn } };
            // DGPad's angle ABC, within 0 and 180° or oriented.
            case "Angle180":
            case "Angle360":
                return {
                    type: "dg_angle",
                    fields: { TYPE: fn },
                    inputs: Object.fromEntries(
                        args.map((arg, i) => [
                            "ABC"[i],
                            value(this.value(arg)),
                        ]),
                    ),
                };
            // Blockly's minimum or maximum of the list it builds.
            case "min":
            case "max":
                return {
                    type: "math_on_list",
                    fields: { OP: fn.toUpperCase() },
                    inputs: { LIST: { block: this.list(args) } },
                };
        }
        return unsupported();
    }

    private arithmetic(op: string, a: FormulaNode, b: FormulaNode): BlockState {
        return {
            type: "math_arithmetic",
            fields: { OP: op },
            inputs: { A: value(this.value(a)), B: value(this.value(b)) },
        };
    }

    private binary(node: Extract<FormulaNode, { kind: "binary" }>): BlockState {
        const { op, left, right } = node;
        if (op === "+") return this.sum(node);
        if (op in ARITHMETIC)
            return this.arithmetic(ARITHMETIC[op], left, right);
        if (op === "%")
            return {
                type: "math_modulo",
                inputs: {
                    DIVIDEND: value(this.value(left)),
                    DIVISOR: value(this.value(right)),
                },
            };
        if (op in COMPARE)
            return {
                type: "logic_compare",
                fields: { OP: COMPARE[op] },
                inputs: {
                    A: value(this.value(left)),
                    B: value(this.value(right)),
                },
            };
        return {
            type: "logic_operation",
            fields: { OP: op === "&&" ? "AND" : "OR" },
            inputs: { A: value(this.value(left)), B: value(this.value(right)) },
        };
    }

    // A text joined from its parts, as soon as one of its first two terms
    // is a text: the terms before it are added up.
    private sum(node: Extract<FormulaNode, { kind: "binary" }>): BlockState {
        const terms: FormulaNode[] = [];
        let spine: FormulaNode = node;
        while (spine.kind === "binary" && spine.op === "+") {
            terms.unshift(spine.right);
            spine = spine.left;
        }
        terms.unshift(spine);
        const blocks = terms.map((term) => this.value(term));
        const texty = (block: BlockState) =>
            block.type === "text" || block.type === "text_join";
        const first = blocks.findIndex(texty);
        if (first < 0) {
            return blocks.reduce((sum, block) => ({
                type: "math_arithmetic",
                fields: { OP: "ADD" },
                inputs: { A: value(sum), B: value(block) },
            }));
        }
        const start = Math.max(first, 1);
        const items: BlockState[] =
            start > 1
                ? [
                      blocks.slice(0, start).reduce((sum, block) => ({
                          type: "math_arithmetic",
                          fields: { OP: "ADD" },
                          inputs: { A: value(sum), B: value(block) },
                      })),
                  ]
                : [blocks[0]];
        return this.join([...items, ...blocks.slice(start)]);
    }

    // The parts as one text.
    private join(blocks: BlockState[]): BlockState {
        const parts = blocks.flatMap((block) =>
            block.type === "text_join"
                ? Object.values(block.inputs ?? {}).map(
                      (input) => input.block ?? input.shadow!,
                  )
                : [block],
        );
        // Adjacent texts as one, the empty ones that only made a text gone.
        const joined: BlockState[] = [];
        parts.forEach((part) => {
            const previous = joined[joined.length - 1];
            if (part.type === "text" && previous?.type === "text")
                previous.fields!.TEXT = `${previous.fields!.TEXT}${part.fields!.TEXT}`;
            else joined.push(part);
        });
        const kept = joined.filter(
            (part) => part.type !== "text" || part.fields!.TEXT !== "",
        );
        if (kept.length === 1 && kept[0].type === "text") return kept[0];
        if (kept.length === 0) return text("");
        return {
            type: "text_join",
            extraState: { itemCount: kept.length },
            inputs: Object.fromEntries(
                kept.map((part, i) => [`ADD${i}`, value(part)]),
            ),
        };
    }
}

// The value a procedure's last statement returns.
function returned(body: Statement[]): FormulaNode | null {
    const last = body[body.length - 1];
    return last?.kind === "return" ? last.node : null;
}

const isStatement = (node: FormulaNode): boolean =>
    node.kind === "assign" ||
    node.kind === "assignItem" ||
    node.kind === "turtle" ||
    (node.kind === "call" &&
        [
            "ALERT",
            "WAIT",
            "ASK",
            "VIEW_DIRECTION",
            "SHOW_AXIS",
            "SHOW_GRID",
            "CENTER_VIEW",
            "CLEAR_TRACES",
            "BACKGROUND",
        ].includes(node.fn)) ||
    (node.kind === "method" && node.method !== "concat");

// ************************* BLOCKS → PROGRAM *************************

// How tightly an expression binds, as the grammar reads it: an operand
// binding less tightly than its operator is put between parentheses.
const ATOM = 0;
const POSTFIX = 1;
const UNARY = 3;
const PRODUCT = 4;
const SUM = 5;
const RELATION = 6;
const EQUALITY = 7;
const AND = 8;
const OR = 9;
const CONDITIONAL = 10;

type Code = [string, number];

const CONSTANT_CODE: Record<string, Code> = {
    PI: ["Math.PI", ATOM],
    E: ["Math.E", ATOM],
    GOLDEN_RATIO: ["(1 + sqrt(5)) / 2", PRODUCT],
    SQRT2: ["Math.SQRT2", ATOM],
    SQRT1_2: ["Math.SQRT1_2", ATOM],
    INFINITY: ["Infinity", ATOM],
};

const OPERATORS: Record<string, [string, number]> = {
    ADD: ["+", SUM],
    MINUS: ["-", SUM],
    MULTIPLY: ["*", PRODUCT],
    DIVIDE: ["/", PRODUCT],
    EQ: ["==", EQUALITY],
    NEQ: ["!=", EQUALITY],
    LT: ["<", RELATION],
    LTE: ["<=", RELATION],
    GT: [">", RELATION],
    GTE: [">=", RELATION],
    AND: ["&&", AND],
    OR: ["||", OR],
};

export const quoted = (text: string): string =>
    `"${text.replace(/[\\"]/g, "\\$&")}"`;

const numberCode = (value: unknown): Code => {
    const n = Number(value);
    return [String(n), n < 0 ? UNARY : ATOM];
};

// The program the blocks write, null without its first block (turtle,
// event or program), the objects' names written by `format`. The other
// programs shown with it, folded, don't count.
export function blocksProgram(
    state: WorkspaceState,
    format: (name: string) => string,
): string | null {
    const blocks = state.blocks?.blocks ?? [];
    const root = blocks.find(
        (block) => ROOTS.has(block.type) && !block.collapsed,
    );
    return root ? new Generator(state, format).program(root, blocks) : null;
}

// One of the programs a workspace shows, from its first block, with the
// procedures it calls, directly or not.
export function stackState(
    state: WorkspaceState,
    root: BlockState,
): WorkspaceState {
    const procedures = (state.blocks?.blocks ?? []).filter(isProcedure);
    const called: BlockState[] = [];
    const walk = (block: BlockState | undefined): void => {
        if (!block) return;
        const procedure =
            block.type.startsWith("procedures_call") &&
            procedures.find(
                ({ fields }) => fields?.NAME === block.extraState?.name,
            );
        if (procedure && !called.includes(procedure)) {
            called.push(procedure);
            walk(procedure);
        }
        Object.values(block.inputs ?? {}).forEach((input) => {
            walk(input.block);
            walk(input.shadow);
        });
        walk(block.next?.block);
    };
    walk(root);
    return {
        ...state,
        blocks: { languageVersion: 0, blocks: [root, ...called] },
    };
}

// The mark of a procedure whose variables are its own (see procedure).
const OWN_VARIABLES = "own variables";

export const isProcedure = (block: BlockState): boolean =>
    block.type === "procedures_defnoreturn" ||
    block.type === "procedures_defreturn";

// A list a program can change an item of.
const assignable = (block: BlockState | undefined): boolean =>
    block?.type === "variables_get" ||
    block?.type === "dg_global_get" ||
    (block?.type === "dg_list_get" && assignable(block.inputs?.LIST?.block));

const pushable = (block: BlockState | undefined): boolean =>
    block?.type === "variables_get" ||
    (block?.type === "dg_list_get" && pushable(block.inputs?.LIST?.block));

// DGPad's "break the list": a point that cannot be drawn, where the line
// through the list's points stops.
const isBreak = (node: FormulaNode): boolean =>
    node.kind === "vector" &&
    node.items.length === 3 &&
    node.items.every(
        (item) => item.kind === "number" && Number.isNaN(item.value),
    );

const paramsOf = (block: BlockState): string[] =>
    ((block.extraState?.params ?? []) as (string | { name: string })[]).map(
        (param) => (typeof param === "string" ? param : param.name),
    );

// Whether a text typed in an expression binds as a name: no operator out of
// its brackets and texts.
function atomic(code: string): boolean {
    let depth = 0;
    let quote = "";
    for (let i = 0; i < code.length; i++) {
        const c = code[i];
        if (quote) {
            if (c === "\\") i++;
            else if (c === quote) quote = "";
        } else if (c === '"' || c === "'") quote = c;
        else if ("([{".includes(c)) depth++;
        else if (")]}".includes(c)) depth--;
        else if (!depth && !/[\p{L}\p{N}_$.]/u.test(c)) return false;
    }
    return true;
}

class Generator {
    private readonly names = new Map<string, string>();
    // The names the program uses, which a counter mustn't take.
    private readonly taken = new Set<string>();
    // The loops holding the block written, out of which break and continue
    // write nothing, as Blockly disables them.
    private loops = 0;
    private repeats = false;

    constructor(
        state: WorkspaceState,
        private readonly format: (name: string) => string,
    ) {
        state.variables?.forEach(({ name, id }) => {
            this.names.set(id, name);
            this.taken.add(name);
        });
        const walk = (block: BlockState | undefined): void => {
            if (!block) return;
            if (block.type === "dg_object" || isProcedure(block))
                this.taken.add(String(block.fields?.NAME));
            Object.values(block.inputs ?? {}).forEach((input) => {
                walk(input.block);
                walk(input.shadow);
            });
            walk(block.next?.block);
        };
        state.blocks?.blocks.forEach(walk);
    }

    // Its procedures and the values' blocks left alone, before its
    // statements.
    program(root: BlockState, blocks: BlockState[]): string {
        const procedures = blocks.filter(isProcedure);
        const params = new Set(procedures.flatMap(paramsOf));
        // Blockly's variables are the program's, whatever procedure sets
        // them, but in DGPad's (see procedure).
        const variables = [...this.names.values()].filter(
            (name) => !params.has(name),
        );
        const body = [
            ...(procedures.length && variables.length
                ? [`var ${variables.map(this.format).join(", ")};`]
                : []),
            ...procedures.flatMap((block) => this.procedure(block)),
            ...blocks
                .filter(
                    (block) =>
                        !ROOTS.has(block.type) &&
                        !isProcedure(block) &&
                        !this.statement(block, "").length,
                )
                .map((block) => `${this.value(block)[0]};`),
            ...this.statements(root.next?.block, ""),
        ];
        if (this.repeats) body.unshift(...LISTS_REPEAT_FUNCTION);
        if (root.type !== "dg_turtle") return body.join("\n");
        return [
            `TURTLE_INIT(${quoted(root.data ?? "")}, ${this.format(String(root.fields!.POINT))});`,
            ...body,
            "return TURTLE_RESULT();",
        ].join("\n");
    }

    // The variables it sets are the program's, but in a procedure of
    // DGPad's Blockly, which declares them its own: they don't change
    // those of the same name elsewhere, nor its own in the calls it makes of
    // itself (Gosper's curve).
    private procedure(block: BlockState): string[] {
        const params = paramsOf(block).map(this.format);
        const own = new Set<string>();
        const walk = (child: BlockState | undefined): void => {
            if (!child) return;
            if (child.type === "variables_set" || child.type === "math_change")
                own.add(this.variable(child));
            Object.values(child.inputs ?? {}).forEach((input) =>
                walk(input.block),
            );
            walk(child.next?.block);
        };
        if (block.data === OWN_VARIABLES) walk(block.inputs?.STACK?.block);
        params.forEach((param) => own.delete(param));
        return [
            `function ${this.format(String(block.fields!.NAME))}(${params.join(", ")}) {`,
            ...(own.size ? [`    var ${[...own].join(", ")};`] : []),
            ...this.nested(block, "STACK", ""),
            ...(block.inputs?.RETURN
                ? [`    return ${this.arg(block, "RETURN")};`]
                : []),
            "}",
        ];
    }

    private variable(block: BlockState): string {
        const field = block.fields?.VAR as { id?: string; name?: string };
        return this.format(
            this.names.get(field.id!) ?? field.name ?? field.id ?? "x",
        );
    }

    private statements(
        block: BlockState | undefined,
        indent: string,
    ): string[] {
        const lines: string[] = [];
        for (; block; block = block.next?.block)
            lines.push(...this.statement(block, indent));
        return lines;
    }

    private nested(block: BlockState, input: string, indent: string): string[] {
        return this.statements(block.inputs?.[input]?.block, `${indent}    `);
    }

    private loopBody(block: BlockState, indent: string): string[] {
        this.loops++;
        const body = this.nested(block, "DO", indent);
        this.loops--;
        return body;
    }

    // The value plugged into the input, or `fallback`.
    private input(block: BlockState, name: string, fallback = "0"): Code {
        const input = block.inputs?.[name];
        const plugged = input?.block ?? input?.shadow;
        return plugged ? this.value(plugged) : [fallback, ATOM];
    }

    // As an operand binding at most `level`.
    private operand(
        block: BlockState,
        name: string,
        level: number,
        fallback?: string,
    ): string {
        const [code, order] = this.input(block, name, fallback);
        return order > level ? `(${code})` : code;
    }

    // Its opposite: "--" would be a decrement.
    private negated(block: BlockState, name: string): string {
        const code = this.operand(block, name, UNARY);
        return code.startsWith("-") ? `-(${code})` : `-${code}`;
    }

    private arg(block: BlockState, name: string, fallback?: string): string {
        return this.input(block, name, fallback)[0];
    }

    private statement(block: BlockState, indent: string): string[] {
        const line = (code: string) => [`${indent}${code}`];
        const call = (fn: string, ...args: string[]) =>
            line(`${fn}(${args.join(", ")});`);
        const fields = block.fields ?? {};
        switch (block.type) {
            case "variables_set":
                return line(
                    `${this.variable(block)} = ${this.arg(block, "VALUE")};`,
                );
            case "math_change": {
                const name = this.variable(block);
                return line(
                    `${name} = ${name} + ${this.operand(block, "DELTA", PRODUCT, "1")};`,
                );
            }
            case "dg_return":
                return line(`return ${this.arg(block, "VALUE")};`);
            case "dg_style":
                return line(
                    `${this.format(String(fields.OBJECT))}.${fields.METHOD}(${this.arg(block, "VALUE")});`,
                );
            case "dg_set_value":
                return line(
                    `${this.format(String(fields.OBJECT))}.setExpression(${this.arg(block, "VALUE")});`,
                );
            case "dg_style_arrow":
                return line(
                    `${this.format(String(fields.OBJECT))}.setArrow([${this.arg(block, "W")}, ${this.arg(block, "H")}]);`,
                );
            case "dg_style_rgb":
                return line(
                    `${this.format(String(fields.OBJECT))}.setRGBColor(${["R", "G", "B"].map((c) => this.arg(block, c)).join(", ")});`,
                );
            case "controls_if": {
                const count = Number(block.extraState?.elseIfCount ?? 0);
                const lines: string[] = [];
                for (let i = 0; i <= count; i++) {
                    const keyword = i ? "} else if" : "if";
                    lines.push(
                        `${indent}${keyword} (${this.arg(block, `IF${i}`, "false")}) {`,
                        ...this.nested(block, `DO${i}`, indent),
                    );
                }
                if (block.extraState?.hasElse)
                    lines.push(
                        `${indent}} else {`,
                        ...this.nested(block, "ELSE", indent),
                    );
                return [...lines, `${indent}}`];
            }
            case "controls_repeat_ext": {
                const counter = this.counter();
                this.taken.add(counter);
                const body = this.loopBody(block, indent);
                this.taken.delete(counter);
                return [
                    `${indent}for (var ${counter} = 1; ${counter} <= ${this.operand(block, "TIMES", SUM)}; ${counter} = ${counter} + 1) {`,
                    ...body,
                    `${indent}}`,
                ];
            }
            case "controls_for": {
                const name = this.variable(block);
                return [
                    `${indent}for (var ${name} = ${this.arg(block, "FROM")}; ${name} <= ${this.operand(block, "TO", SUM)}; ${name} = ${name} + ${this.operand(block, "BY", PRODUCT, "1")}) {`,
                    ...this.loopBody(block, indent),
                    `${indent}}`,
                ];
            }
            case "controls_whileUntil": {
                const test =
                    fields.MODE === "UNTIL"
                        ? negation(this.operand(block, "BOOL", UNARY, "false"))
                        : this.arg(block, "BOOL", "false");
                return [
                    `${indent}while (${test}) {`,
                    ...this.loopBody(block, indent),
                    `${indent}}`,
                ];
            }
            case "controls_flow_statements":
                return this.loops
                    ? line(`${fields.FLOW === "BREAK" ? "break" : "continue"};`)
                    : [];
            case "turtle_move": {
                const back = fields.DIR === "backward";
                const distance = back
                    ? this.negated(block, "VALUE")
                    : this.arg(block, "VALUE");
                return call(
                    "TURTLE_MV",
                    distance,
                    String(fields.UNITS === "px"),
                );
            }
            case "turtle_turn":
                return call(
                    "TURTLE_TURN",
                    `${fields.DIR === "right" ? "-" : ""}${this.operand(block, "VALUE", POSTFIX)}°`,
                );
            case "turtle_rotate": {
                const dir = String(fields.DIR);
                return call(
                    "TURTLE_ROTATE",
                    `${dir === "down" || dir === "left" ? "-" : ""}${this.operand(block, "VALUE", POSTFIX)}°`,
                    String(dir === "up" || dir === "down"),
                );
            }
            case "dg_global_set":
                return call(
                    "GLOBAL_SET",
                    quoted(String(fields.NAME)),
                    this.arg(block, "VALUE"),
                );
            case "dg_global_inc":
                return call(
                    "GLOBAL_INC",
                    quoted(String(fields.NAME)),
                    this.arg(block, "DELTA", "1"),
                );
            // Of a variable's list or a global's: a list built is lost.
            case "dg_list_set":
                if (!assignable(block.inputs?.LIST?.block)) return [];
                return line(
                    `${this.item(block)} = ${this.arg(block, "VALUE")};`,
                );
            // Of a variable's list or of one of its items.
            case "dg_list_push":
                if (!pushable(block.inputs?.LIST?.block)) return [];
                return line(
                    `${this.operand(block, "LIST", ATOM, "[]")}.push(${this.arg(block, "VALUE")});`,
                );
            case "dg_list_break":
                if (!pushable(block.inputs?.LIST?.block)) return [];
                return line(
                    `${this.operand(block, "LIST", ATOM, "[]")}.push([NaN, NaN, NaN]);`,
                );
            case "dg_list_remove":
                if (!pushable(block.inputs?.LIST?.block)) return [];
                return line(
                    `${this.operand(block, "LIST", ATOM, "[]")}.${fields.WHERE}();`,
                );
            case "dg_alert":
                return call("ALERT", this.arg(block, "TEXT", '""'));
            case "dg_wait":
                return call("WAIT", this.arg(block, "MS"));
            case "dg_view_direction":
                return call("VIEW_DIRECTION", this.arg(block, "VECTOR"));
            case "dg_show_grid":
                return call("SHOW_GRID", this.arg(block, "SHOWN"));
            case "dg_center_view":
                return call("CENTER_VIEW", this.arg(block, "POINT"));
            case "dg_clear_traces":
                return call("CLEAR_TRACES");
            case "dg_background":
                return call(
                    "BACKGROUND",
                    ...["R", "G", "B"].map((c) => this.arg(block, c)),
                );
            case "dg_show_axis":
                return call(
                    "SHOW_AXIS",
                    String(fields.AXIS),
                    this.arg(block, "SHOWN"),
                );
            case "dg_ask":
                return call("ASK", this.arg(block, "TEXT", '""'));
            case "procedures_callnoreturn":
                return line(`${this.value(block)[0]};`);
            case "turtle_pen":
                return call("TURTLE_UP", String(fields.PEN === "up"));
            case "turtle_reset":
                return call("TURTLE_RESET");
            case "turtle_width":
            case "turtle_width_increment": {
                const fn = Object.keys(TURTLE_WIDTHS).find(
                    (key) =>
                        TURTLE_WIDTHS[key][0] === block.type &&
                        TURTLE_WIDTHS[key][1] === fields.WHAT,
                )!;
                return call(fn, this.arg(block, "WIDTH", "1"));
            }
            case "turtle_font":
                return call(
                    "TURTLE_FONT",
                    quoted(String(fields.FONT)),
                    numberCode(fields.SIZE)[0],
                    quoted(String(fields.STYLE)),
                    quoted(String(fields.ALIGN)),
                );
            case "turtle_image":
                return call(
                    "TURTLE_PRINT_IMG",
                    this.arg(block, "URL", '""'),
                    ...["W", "H", "Z", "O"].map((name) =>
                        this.arg(block, name),
                    ),
                );
        }
        const simple = Object.keys(TURTLE_SIMPLE).find(
            (key) => TURTLE_SIMPLE[key][0] === block.type,
        );
        if (simple)
            return call(
                simple,
                this.arg(
                    block,
                    TURTLE_SIMPLE[simple][1],
                    block.type === "turtle_print" ||
                        block.type === "turtle_colour_rgb"
                        ? '""'
                        : "0",
                ),
            );
        // A value left alone does nothing.
        return [];
    }

    // Its item at INDEX, counted from 1.
    private item(block: BlockState): string {
        return `${this.operand(block, "LIST", ATOM, "[]")}[${this.operand(block, "INDEX", SUM, "1")} - 1]`;
    }

    // A counter of its own for each loop it is nested in.
    private counter(): string {
        for (let n = 0; ; n++) {
            const name = n ? `k${n}` : "k";
            if (!this.taken.has(name)) return name;
        }
    }

    // What a value's blocks write.
    code(block: BlockState): Code {
        return this.value(block);
    }

    private value(block: BlockState): Code {
        const fields = block.fields ?? {};
        switch (block.type) {
            case "math_number":
                return numberCode(fields.NUM);
            case "dg_expression": {
                const code = String(fields.TEXT ?? "").trim() || "0";
                return [code, atomic(code) ? ATOM : CONDITIONAL];
            }
            case "text":
                return [quoted(String(fields.TEXT ?? "")), ATOM];
            case "logic_boolean":
                return [fields.BOOL === "TRUE" ? "true" : "false", ATOM];
            case "math_constant":
                return CONSTANT_CODE[String(fields.CONSTANT)];
            case "variables_get":
                return [this.variable(block), ATOM];
            case "dg_object":
                return [this.format(String(fields.NAME)), ATOM];
            case "dg_global_get":
                return [`GLOBAL_GET(${quoted(String(fields.NAME))})`, ATOM];
            case "math_arithmetic": {
                if (fields.OP === "POWER")
                    return [
                        `${this.operand(block, "A", POSTFIX)} ^ ${this.operand(block, "B", UNARY)}`,
                        UNARY,
                    ];
                const [op, level] = OPERATORS[String(fields.OP)];
                return [
                    `${this.operand(block, "A", level)} ${op} ${this.operand(block, "B", level - 1)}`,
                    level,
                ];
            }
            case "math_modulo":
                return [
                    `${this.operand(block, "DIVIDEND", PRODUCT)} % ${this.operand(block, "DIVISOR", UNARY)}`,
                    PRODUCT,
                ];
            case "logic_compare":
            case "logic_operation": {
                const [op, level] = OPERATORS[String(fields.OP)];
                return [
                    `${this.operand(block, "A", level, "false")} ${op} ${this.operand(block, "B", level - 1, "false")}`,
                    level,
                ];
            }
            case "logic_negate":
                return [
                    negation(this.operand(block, "BOOL", UNARY, "false")),
                    UNARY,
                ];
            case "logic_ternary":
                return [
                    `${this.operand(block, "IF", OR, "false")} ? ${this.arg(block, "THEN")} : ${this.arg(block, "ELSE")}`,
                    CONDITIONAL,
                ];
            case "math_single":
                if (fields.OP === "NEG")
                    return [this.negated(block, "NUM"), UNARY];
                return [
                    `${FUNCTIONS[String(fields.OP)]}(${this.arg(block, "NUM")})`,
                    ATOM,
                ];
            case "math_random_float":
                return ["random()", ATOM];
            case "math_random_int": {
                const a = this.operand(block, "FROM", SUM);
                const b = this.operand(block, "TO", PRODUCT);
                return [
                    `floor(random() * (abs(${a} - ${b}) + 1) + (${a} + ${b} - abs(${a} - ${b})) / 2)`,
                    ATOM,
                ];
            }
            // Its item binds as tightly as a name.
            case "dg_list_get":
                return [this.item(block), ATOM];
            case "dg_list_last":
                return [
                    `${this.operand(block, "LIST", ATOM, "[]")}.slice(-1)[0]`,
                    ATOM,
                ];
            case "lists_create_with":
                return [
                    `[${Array.from(
                        { length: Number(block.extraState?.itemCount ?? 0) },
                        (_, i) => this.arg(block, `ADD${i}`),
                    ).join(", ")}]`,
                    ATOM,
                ];
            case "lists_repeat":
                this.repeats = true;
                return [
                    `${LISTS_REPEAT}(${this.arg(block, "ITEM")}, ${this.arg(block, "NUM")})`,
                    ATOM,
                ];
            case "lists_length":
                return [
                    `${this.operand(block, "VALUE", ATOM, "[]")}.length`,
                    ATOM,
                ];
            // Of a list it builds.
            case "math_on_list": {
                const list = block.inputs?.LIST?.block;
                const count =
                    list?.type === "lists_create_with"
                        ? Number(list.extraState?.itemCount ?? 0)
                        : 0;
                const items = Array.from({ length: count }, (_, i) =>
                    this.operand(list!, `ADD${i}`, SUM),
                );
                if (!items.length) break;
                switch (fields.OP) {
                    case "MIN":
                    case "MAX":
                        return [
                            `${String(fields.OP).toLowerCase()}(${items.join(", ")})`,
                            ATOM,
                        ];
                    case "SUM":
                        return [items.join(" + "), SUM];
                    case "AVERAGE":
                        return [`(${items.join(" + ")}) / ${count}`, PRODUCT];
                }
                break;
            }
            case "math_trig":
            case "math_round":
                return [
                    `${FUNCTIONS[String(fields.OP)]}(${this.arg(block, "NUM")})`,
                    ATOM,
                ];
            case "text_join": {
                const count = Number(block.extraState?.itemCount ?? 0);
                const items = Array.from({ length: count }, (_, i) =>
                    this.operand(block, `ADD${i}`, PRODUCT, '""'),
                );
                if (!items.length) return ['""', ATOM];
                if (!items[0].startsWith('"')) items.unshift('""');
                return [items.join(" + "), SUM];
            }
            case "dg_point":
            case "dg_point3":
                return [
                    `[${[..."XYZ".slice(0, block.type === "dg_point" ? 2 : 3)].map((c) => this.arg(block, c)).join(", ")}]`,
                    ATOM,
                ];
            case "dg_coordinate":
                return [`${fields.AXIS}(${this.arg(block, "POINT")})`, ATOM];
            case "dg_distance":
                return [
                    `d(${this.arg(block, "A")}, ${this.arg(block, "B")})`,
                    ATOM,
                ];
            case "dg_view":
                return [`${fields.NAME}()`, ATOM];
            case "dg_answer":
                return ["ANSWER()", ATOM];
            case "dg_angle":
                return [
                    `${fields.TYPE}(${["A", "B", "C"].map((c) => this.arg(block, c)).join(", ")})`,
                    ATOM,
                ];
            case "dg_degrees":
                return [`${this.operand(block, "VALUE", POSTFIX)}°`, POSTFIX];
            case "procedures_callnoreturn":
            case "procedures_callreturn":
                return [
                    `${this.format(String(block.extraState!.name))}(${paramsOf(
                        block,
                    )
                        .map((_, i) => this.arg(block, `ARG${i}`))
                        .join(", ")})`,
                    ATOM,
                ];
            case "turtle_position":
                return ["TURTLE_POS()", ATOM];
            case "turtle_get":
                return [
                    `TURTLE_GET(${quoted(String(fields.NAME))}, ${this.arg(block, "NUM", "1")})`,
                    ATOM,
                ];
            case "turtle_length":
                return [`TURTLE_LENGTH(${quoted(String(fields.NAME))})`, ATOM];
        }
        return ["0", ATOM];
    }
}
