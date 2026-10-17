import type { FormulaNode, Program, Statement } from "../../import/dgp_formula";

// A program and its blocks, both ways, as Blockly saves its workspace
// (serialization.workspaces): the program's text stays the figure's source,
// the blocks a view of it. Nothing here needs Blockly.

export interface BlockState {
    type: string;
    x?: number;
    y?: number;
    data?: string;
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

// DGPad's Blockly prefixed its variables.
const DGPAD_VARIABLE = "blockly_var_";

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

// The styles a program sets, one value each.
export const STYLE_METHODS = [
    "setHidden",
    "setShowName",
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

class Unsupported extends Error {}

function unsupported(): never {
    throw new Unsupported();
}

// ************************* PROGRAM → BLOCKS *************************

// The blocks of the program, null when some part of it has none. Angles
// written without degrees are degrees only in a figure in degrees. The
// program comes parsed, Blockly's chunk not importing the engine's parser.
export function programBlocks(
    program: Program,
    degrees: boolean,
): WorkspaceState | null {
    try {
        return new Decompiler(degrees).workspace(program.body, program.locals);
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
    return node.kind === "assign" &&
        node.name === name &&
        node.value.kind === "binary" &&
        node.value.op === "+" &&
        node.value.left.kind === "identifier" &&
        node.value.left.name === name
        ? node.value.right
        : null;
}

function readsName(statements: Statement[], name: string): boolean {
    const text = JSON.stringify(statements);
    return text.includes(`"name":"${name.replace(/["\\]/g, "\\$&")}"`);
}

class Decompiler {
    // The program's variables, by the name its blocks show.
    private readonly names = new Map<string, string>();
    private readonly used = new Set<string>();

    constructor(private readonly degrees: boolean) {}

    // DGPad's prefix dropped, unless it would make two names one.
    private name(locals: ReadonlySet<string>): void {
        const plain = (name: string) =>
            name.startsWith(DGPAD_VARIABLE) &&
            name.length > DGPAD_VARIABLE.length
                ? name.slice(DGPAD_VARIABLE.length)
                : name;
        const shown = [...locals].map(plain);
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
            return this.workspace(fn.body, fn.locals);
        this.name(locals);
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
            // The value of the last expression, as the one it returns.
            if (last?.kind === "expression" && !isStatement(last.node))
                body = [
                    ...body.slice(0, -1),
                    { kind: "return", node: last.node },
                ];
        }
        const chain = this.chain(body);
        if (chain) root.next = { block: chain };
        root.x = 16;
        root.y = 16;
        return {
            blocks: { languageVersion: 0, blocks: [root] },
            variables: [...this.used].map((name) => ({ name, id: name })),
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
            // "for (var v = a; v <= b; v = v + c)".
            if (
                loop?.kind === "loop" &&
                statement.kind === "expression" &&
                statement.node.kind === "assign" &&
                loop.update
            ) {
                blocks.push(this.forLoop(statement.node, loop));
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

    private forLoop(
        init: Extract<FormulaNode, { kind: "assign" }>,
        loop: Extract<Statement, { kind: "loop" }>,
    ): BlockState {
        const { name } = init;
        const { test } = loop;
        const step = increment(loop.update!, name);
        if (
            !step ||
            test?.kind !== "binary" ||
            test.op !== "<=" ||
            test.left.kind !== "identifier" ||
            test.left.name !== name
        )
            unsupported();
        // DGPad's "repeat n times" counted from 1 by 1.
        const from = literal(init.value);
        if (from === 1 && literal(step!) === 1 && !readsName(loop.body, name))
            return {
                type: "controls_repeat_ext",
                inputs: {
                    TIMES: value(this.value(test!.right)),
                    ...this.body(loop.body),
                },
            };
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
                if (statement.update || !statement.test) unsupported();
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
                        ...this.body(statement.body),
                    },
                };
            }
            case "function":
                return unsupported();
        }
    }

    // A statement that only does something.
    private instruction(node: FormulaNode): BlockState {
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
        if (node.kind === "method") {
            if (node.indices.length) unsupported();
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
            if (!STYLE_METHODS.includes(node.method)) unsupported();
            return {
                type: "dg_style",
                fields: { OBJECT: node.object, METHOD: node.method },
                inputs: { VALUE: value(this.value(node.args[0])) },
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

    // An angle in degrees.
    private angle(node: FormulaNode): BlockState {
        if (node.kind === "call" && node.fn === "°")
            return this.value(node.args[0]);
        return this.degrees ? this.value(node) : unsupported();
    }

    private value(node: FormulaNode): BlockState {
        switch (node.kind) {
            case "number":
                return number(node.value);
            case "string":
                return text(node.value);
            case "constant":
                return { type: "math_constant", fields: { CONSTANT: "PI" } };
            case "identifier":
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
                return this.binary(node);
            case "conditional":
                return {
                    type: "logic_ternary",
                    inputs: {
                        IF: value(this.value(node.test)),
                        THEN: value(this.value(node.then)),
                        ELSE: value(this.value(node.otherwise)),
                    },
                };
            case "vector":
                if (node.items.length !== 2 && node.items.length !== 3)
                    unsupported();
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
                return this.call(node);
            // DGPad's later text join: "[a, b].join('')".
            case "join":
                if (
                    node.target.kind !== "vector" ||
                    node.separator?.kind !== "string" ||
                    node.separator.value !== ""
                )
                    unsupported();
                return this.join(
                    (node.target as { items: FormulaNode[] }).items.map(
                        (item) => this.value(item),
                    ),
                );
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

    private call(node: Extract<FormulaNode, { kind: "call" }>): BlockState {
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
                return {
                    type: "dg_coordinate",
                    fields: { AXIS: fn },
                    inputs: { POINT: value(this.value(a)) },
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

const isStatement = (node: FormulaNode): boolean =>
    node.kind === "assign" ||
    node.kind === "assignItem" ||
    node.kind === "turtle" ||
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

// The program the blocks write, null without its first block (turtle or
// program), the objects' names written by `format`.
export function blocksProgram(
    state: WorkspaceState,
    format: (name: string) => string,
): string | null {
    const root = state.blocks?.blocks.find(
        (block) => block.type === "dg_turtle" || block.type === "dg_program",
    );
    return root ? new Generator(state, format).program(root) : null;
}

class Generator {
    private readonly names = new Map<string, string>();
    // The names the program uses, which a counter mustn't take.
    private readonly taken = new Set<string>();
    private depth = 0;

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
            if (block.type === "dg_object")
                this.taken.add(String(block.fields?.NAME));
            Object.values(block.inputs ?? {}).forEach((input) => {
                walk(input.block);
                walk(input.shadow);
            });
            walk(block.next?.block);
        };
        state.blocks?.blocks.forEach(walk);
    }

    program(root: BlockState): string {
        const body = this.statements(root.next?.block, "");
        if (root.type === "dg_program") return body.join("\n");
        return [
            `TURTLE_INIT(${quoted(root.data ?? "")}, ${this.format(String(root.fields!.POINT))});`,
            ...body,
            "return TURTLE_RESULT();",
        ].join("\n");
    }

    private variable(block: BlockState): string {
        const field = block.fields?.VAR as { id?: string; name?: string };
        return this.format(this.names.get(field.id!) ?? field.name ?? "x");
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
                this.depth++;
                const body = this.nested(block, "DO", indent);
                this.depth--;
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
                    ...this.nested(block, "DO", indent),
                    `${indent}}`,
                ];
            }
            case "controls_whileUntil": {
                const test =
                    fields.MODE === "UNTIL"
                        ? `!${this.operand(block, "BOOL", UNARY, "false")}`
                        : this.arg(block, "BOOL", "false");
                return [
                    `${indent}while (${test}) {`,
                    ...this.nested(block, "DO", indent),
                    `${indent}}`,
                ];
            }
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

    // A counter of its own for each loop it is nested in.
    private counter(): string {
        for (let n = this.depth; ; n++) {
            const name = n ? `k${n}` : "k";
            if (!this.taken.has(name)) return name;
        }
    }

    private value(block: BlockState): Code {
        const fields = block.fields ?? {};
        switch (block.type) {
            case "math_number":
                return numberCode(fields.NUM);
            case "text":
                return [quoted(String(fields.TEXT ?? "")), ATOM];
            case "logic_boolean":
                return [fields.BOOL === "TRUE" ? "true" : "false", ATOM];
            case "math_constant":
                return ["Math.PI", ATOM];
            case "variables_get":
                return [this.variable(block), ATOM];
            case "dg_object":
                return [this.format(String(fields.NAME)), ATOM];
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
                    `!${this.operand(block, "BOOL", UNARY, "false")}`,
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
            case "dg_degrees":
                return [`${this.operand(block, "VALUE", POSTFIX)}°`, POSTFIX];
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
