import { IDENTIFIER_PART, IDENTIFIER_START } from "./dgp_parser";
import {
    vAdd,
    vCross,
    vDot,
    vNorm,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";

export type FormulaFn =
    | "sqrt"
    | "d"
    | "pixel"
    | "windoww"
    | "windowh"
    | "windowcx"
    | "windowcy"
    | "theta"
    | "phi"
    | "x"
    | "y"
    | "sin"
    | "cos"
    | "tan"
    | "asin"
    | "acos"
    | "atan"
    | "atan2"
    | "abs"
    | "floor"
    | "ceil"
    | "round"
    | "exp"
    | "log"
    | "arg"
    | "perp"
    | "cross"
    | "dot"
    | "unitVector"
    | "isNaN"
    | "distance"
    | "min"
    | "max"
    | "conj"
    | "mod"
    | "Angle360"
    | "Angle180"
    | "crossProduct"
    | "gcd"
    | ListFn;

// DGPad's own names for its operators, also applying to lists, and its
// view restrictions, which the import applies once (see Expression in
// dgp_commands.ts).
type ListFn =
    | "plus"
    | "minus"
    | "times"
    | "quotient"
    | "power"
    | "pow"
    | "restrictTheta"
    | "restrictPhi";

// -1: one argument or more.
const FORMULA_ARITY: Record<FormulaFn, number> = {
    sqrt: 1,
    d: 2,
    pixel: 0,
    windoww: 0,
    windowh: 0,
    windowcx: 0,
    windowcy: 0,
    theta: 0,
    phi: 0,
    x: 1,
    y: 1,
    sin: 1,
    cos: 1,
    tan: 1,
    asin: 1,
    acos: 1,
    atan: 1,
    atan2: 2,
    abs: 1,
    floor: 1,
    ceil: 1,
    round: 1,
    exp: 1,
    log: 1,
    arg: 1,
    perp: 1,
    cross: 2,
    dot: 2,
    unitVector: 1,
    isNaN: 1,
    distance: 2,
    min: -1,
    max: -1,
    conj: 1,
    mod: 1,
    Angle360: 3,
    Angle180: 3,
    crossProduct: 2,
    gcd: 2,
    plus: 2,
    minus: 2,
    times: 2,
    quotient: 2,
    power: 2,
    pow: 2,
    restrictTheta: 1,
    restrictPhi: 1,
};

const LIST_OPERATORS: Record<ListFn, BinaryOp | null> = {
    plus: "+",
    minus: "-",
    times: "*",
    quotient: "/",
    power: "^",
    pow: "^",
    restrictTheta: null,
    restrictPhi: null,
};

// The only methods a script may call: reading an object, changing one of
// its own lists or joining lists, and styling the figure's objects.
export type ObjectMethod =
    | "coords2D"
    | "coords3D"
    | "getX"
    | "getY"
    | "getName"
    | "getAOC"
    | "center"
    | "push"
    | "pop"
    | "concat"
    | "setHidden"
    | "setShowName"
    | "setOpacity"
    | "setRGBColor"
    | "setSize"
    | "setPrecision"
    | "setLayer"
    | "setDash"
    | "noMouseInside"
    // A button's SET_EXP: the new value of a number (see button_object.ts).
    | "setExpression";

const READ_METHODS: ReadonlySet<ObjectMethod> = new Set([
    "coords2D",
    "coords3D",
    "getX",
    "getY",
    "getName",
    "getAOC",
    "center",
    "concat",
]);

const LIST_METHODS: ReadonlySet<ObjectMethod> = new Set(["push", "pop"]);

// DGPad's layers and dashes only make up for its lack of depth ordering,
// which the reader does on its own (see paintByDepth and hidden_line.ts),
// and noMouseInside concerns its editing: these methods are skipped,
// arguments included.
const SKIPPED_METHODS: ReadonlySet<ObjectMethod> = new Set([
    "setLayer",
    "setDash",
    "noMouseInside",
]);

// -1: any number of arguments.
const METHOD_ARITY: Record<ObjectMethod, number> = {
    coords2D: 0,
    coords3D: 0,
    getX: 0,
    getY: 0,
    getName: 0,
    getAOC: 0,
    center: 0,
    push: -1,
    pop: 0,
    concat: -1,
    setHidden: 1,
    setShowName: 1,
    setOpacity: 1,
    setRGBColor: 3,
    setSize: 1,
    setPrecision: 1,
    setLayer: 1,
    setDash: 1,
    noMouseInside: 0,
    setExpression: 1,
};

// DGPad's Blockly turtle: from a point, it lists the points it reaches,
// among drawing instructions (colors, pen sizes, fills, texts, images:
// items of 4 or more values) that a List draws (see
// expression_list_object.ts).
const TURTLE_ARITY = {
    TURTLE_INIT: 2,
    TURTLE_RESULT: 0,
    TURTLE_POS: 0,
    TURTLE_GET: 2,
    TURTLE_LENGTH: 1,
    TURTLE_RESET: 0,
    TURTLE_PRINT: 1,
    TURTLE_PRINT_IMG: 5,
    TURTLE_TEXT: 1,
    TURTLE_FONT: 4,
    TURTLE_MV: 2,
    TURTLE_TURN: 1,
    TURTLE_ROTATE: 2,
    TURTLE_UP: 1,
    TURTLE_COLOUR: 1,
    TURTLE_COLOUR_RGB: 1,
    TURTLE_COLOUR_INCREMENT: 1,
    TURTLE_FILL: 1,
    TURTLE_WIDTH: 1,
    TURTLE_POINTS_WIDTH: 1,
    TURTLE_WIDTH_INCREMENT: 1,
    TURTLE_POINTS_WIDTH_INCREMENT: 1,
    TURTLE_ROTATE_PT: 1,
    TURTLE_JOIN_PT: 1,
    SET_NUM_PRECISION: 1,
};

type TurtleFn = keyof typeof TURTLE_ARITY;

// The objects a turtle reads with TURTLE_GET and TURTLE_LENGTH: the Lists
// DGPad draws the other turtles with.
export const turtleList = (name: string) => `blk_turtle_list_${name}`;

type BinaryOp = "+" | "-" | "*" | "/" | "%" | "^" | Comparison;

export type FormulaNode =
    | { kind: "number"; value: number }
    | { kind: "string"; value: string }
    | { kind: "imaginary" }
    | { kind: "constant"; name: "PI" }
    | { kind: "identifier"; name: string }
    | { kind: "call"; fn: FormulaFn; args: FormulaNode[] }
    // A call to a name that isn't one of the built-in FORMULA_ARITY
    // functions, e.g. "E1(x)" referencing another named Expression: resolved
    // at evaluation time through FormulaEnv.callFunction, not evalCall.
    | { kind: "userCall"; name: string; args: FormulaNode[] }
    // "h.dt(t)": the value of a function-valued object's derivative with
    // respect to each of `variables` in turn (see dgp_derivative.ts).
    | {
          kind: "derivative";
          name: string;
          variables: string[];
          args: FormulaNode[];
      }
    | { kind: "unary"; op: "-" | "!"; operand: FormulaNode }
    // "P[1]": a component of a point's coordinates or of a list.
    | { kind: "index"; target: FormulaNode; index: FormulaNode }
    // "tab.length", "(P).length".
    | { kind: "length"; target: FormulaNode }
    // "tab.join(sep)", as JavaScript's.
    | { kind: "join"; target: FormulaNode; separator: FormulaNode | null }
    | { kind: "turtle"; fn: TurtleFn; args: FormulaNode[] }
    // "P.coords2D()" (where point P is drawn, in the window's coordinate
    // system, which changes with the 3D view), "S1.setHidden(1)" or a
    // script's own "tab.push(P)".
    | {
          kind: "method";
          object: string;
          method: ObjectMethod;
          args: FormulaNode[];
      }
    // A list literal, e.g. "[-1,-1,1]", a 3D point displacement.
    | { kind: "vector"; items: FormulaNode[] }
    | {
          kind: "conditional";
          test: FormulaNode;
          then: FormulaNode;
          otherwise: FormulaNode;
      }
    // Assigns one of the script's own variables.
    | { kind: "assign"; name: string; value: FormulaNode }
    // "m[i][j]=v": assigns an item of one of the script's own lists.
    | {
          kind: "assignItem";
          name: string;
          indices: FormulaNode[];
          value: FormulaNode;
      }
    | {
          kind: "binary";
          op: BinaryOp;
          left: FormulaNode;
          right: FormulaNode;
      };

// A DGPad script: JavaScript-like statements whose last one gives the
// Expression's value, e.g. "if(a<0){S1.setHidden(1)};\"text\"". It is
// interpreted here, never run as JavaScript.
export type Statement =
    | { kind: "expression"; node: FormulaNode }
    | {
          kind: "if";
          test: FormulaNode;
          then: Statement[];
          otherwise: Statement[];
      }
    | {
          kind: "loop";
          test: FormulaNode | null;
          body: Statement[];
          update: FormulaNode | null;
      }
    | {
          kind: "function";
          name: string;
          params: string[];
          // Its own variables, its parameters included.
          locals: Set<string>;
          body: Statement[];
      }
    | { kind: "return"; node: FormulaNode | null };

export interface Program {
    body: Statement[];
    // Its own variables, which shadow the figure's objects.
    locals: Set<string>;
}

// DGPad's JavaScript comparisons and logical operators, worth 1 or 0.
type Comparison = "==" | "!=" | "<" | "<=" | ">" | ">=" | "&&" | "||";

// Equality within GeoGebra's standard precision, so that a slider's
// rounding errors (e.g. 3·0.1) don't break a condition like "a == 0.3".
const EQUALITY_PRECISION = 1e-8;

const isComparison = (op: string): op is Comparison => op in COMPARISONS;

// As in JavaScript, NaN differs from everything, itself included: scripts
// test "x!=x" for an undefined value.
const equal = (a: number, b: number) =>
    a === b || Math.abs(a - b) < EQUALITY_PRECISION;

const COMPARISONS: Record<Comparison, (a: number, b: number) => number> = {
    "==": (a, b) => Number(equal(a, b)),
    "!=": (a, b) => Number(!equal(a, b)),
    "<": (a, b) => Number(a < b),
    "<=": (a, b) => Number(a <= b),
    ">": (a, b) => Number(a > b),
    ">=": (a, b) => Number(a >= b),
    "&&": (a, b) => Number(a !== 0 && b !== 0),
    "||": (a, b) => Number(a !== 0 || b !== 0),
};

const ARITHMETIC: Record<
    Exclude<BinaryOp, Comparison>,
    (a: number, b: number) => number
> = {
    "+": (a, b) => a + b,
    "-": (a, b) => a - b,
    "*": (a, b) => a * b,
    "/": (a, b) => a / b,
    "%": (a, b) => a % b,
    "^": Math.pow,
};

const ASSIGNMENTS: Record<string, "+" | "-" | "*" | "/" | null> = {
    "=": null,
    "+=": "+",
    "-=": "-",
    "*=": "*",
    "/=": "/",
};

type TokenType =
    | "number"
    | "string"
    | "identifier"
    | "imaginary"
    | "+"
    | "-"
    | "*"
    | "/"
    | "%"
    | "^"
    | Comparison
    | "!"
    | "."
    | "("
    | ")"
    | "["
    | "]"
    | ","
    | "?"
    | ":"
    | ";"
    | "{"
    | "}"
    | "="
    | "+="
    | "-="
    | "*="
    | "/="
    | "++"
    | "--"
    | "eof";

interface Token {
    type: TokenType;
    value: string | number;
}

// JavaScript's reserved words: a script uses only the statements parsed
// here.
const KEYWORDS: ReadonlySet<string> = new Set(
    "break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield".split(
        " ",
    ),
);

const NUMBER = /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/y;
const OPERATOR = /^(?:[=!]==?|[<>]=?|[-+*/]=|\+\+|--|&&|\|\||[!=?:;{}])/;
const STRING = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y;

class FormulaLexer {
    private index = 0;

    constructor(private readonly source: string) {}

    next(): Token {
        this.skipSpace();
        if (this.index === this.source.length)
            return { type: "eof", value: "" };

        const character = this.source[this.index];

        NUMBER.lastIndex = this.index;
        const number = NUMBER.exec(this.source);
        if (number) {
            this.index = NUMBER.lastIndex;
            const coefficient = Number(number[0]);
            if (this.consumeBareI())
                return { type: "imaginary", value: coefficient };
            return { type: "number", value: coefficient };
        }

        if (IDENTIFIER_START.test(character)) return this.identifier();

        STRING.lastIndex = this.index;
        const string = STRING.exec(this.source);
        if (string) {
            this.index = STRING.lastIndex;
            return {
                type: "string",
                value: string[0].slice(1, -1).replace(/\\(.)/g, "$1"),
            };
        }

        const operator = OPERATOR.exec(this.source.slice(this.index));
        if (operator) {
            this.index += operator[0].length;
            // JavaScript's strict equalities: the same between numbers.
            const type = operator[0].slice(0, 2) as TokenType;
            return { type, value: type };
        }

        if ("+-*/%^(),[].".includes(character)) {
            this.index++;
            return { type: character as TokenType, value: character };
        }

        throw new Error("Invalid DGP formula syntax");
    }

    private consumeBareI(): boolean {
        if (this.source[this.index] !== "i") return false;
        if (IDENTIFIER_PART.test(this.source[this.index + 1] ?? ""))
            return false;
        this.index++;
        return true;
    }

    private skipSpace(): void {
        while (
            this.index < this.source.length &&
            /\s/.test(this.source[this.index])
        )
            this.index++;
    }

    private identifier(): Token {
        const start = this.index++;
        while (
            this.index < this.source.length &&
            IDENTIFIER_PART.test(this.source[this.index])
        )
            this.index++;
        return {
            type: "identifier",
            value: this.source.slice(start, this.index),
        };
    }
}

// The objects of the figure being read (see withObjects).
let objects: ReadonlySet<string> = new Set();

// Reads a figure whose objects have these names: in its formulas, "xy" names
// one of them rather than the product x*y.
export function withObjects<T>(names: ReadonlySet<string>, read: () => T): T {
    const outer = objects;
    objects = names;
    try {
        return read();
    } finally {
        objects = outer;
    }
}

class FormulaParser {
    private readonly lexer: FormulaLexer;
    private current: Token;
    locals = new Set<string>();
    // The variables of the functions and program enclosing the function
    // being parsed.
    private readonly outer: Set<string>[] = [];

    constructor(source: string) {
        this.lexer = new FormulaLexer(source);
        this.current = this.lexer.next();
    }

    parse(): FormulaNode {
        const node = this.expression();
        if (this.current.type !== "eof" || this.locals.size > 0)
            throw new Error("Invalid DGP formula syntax");
        return node;
    }

    parseProgram(): Program {
        const body: Statement[] = [];
        while (this.current.type !== "eof") body.push(...this.statement());
        return { body, locals: this.locals };
    }

    private statement(): Statement[] {
        if (this.skip(";")) return [];
        if (this.skip("{")) {
            const body: Statement[] = [];
            while (!this.skip("}")) body.push(...this.statement());
            return body;
        }
        if (this.skipKeyword("var", "let", "const")) {
            const statements = this.declarations();
            this.skip(";");
            return statements;
        }
        if (this.skipKeyword("if")) {
            const test = this.condition();
            const then = this.statement();
            const otherwise = this.skipKeyword("else") ? this.statement() : [];
            return [{ kind: "if", test, then, otherwise }];
        }
        if (this.skipKeyword("while")) {
            const test = this.condition();
            return [
                { kind: "loop", test, body: this.statement(), update: null },
            ];
        }
        if (this.skipKeyword("for")) {
            this.take("(");
            const init: Statement[] = this.skipKeyword("var", "let")
                ? this.declarations()
                : this.current.type === ";"
                  ? []
                  : [{ kind: "expression", node: this.expression() }];
            this.take(";");
            const test = this.current.type === ";" ? null : this.expression();
            this.take(";");
            const update = this.current.type === ")" ? null : this.expression();
            this.take(")");
            return [
                ...init,
                { kind: "loop", test, body: this.statement(), update },
            ];
        }
        if (this.skipKeyword("function")) return [this.function()];
        if (this.skipKeyword("return")) {
            const node =
                this.current.type === ";" || this.current.type === "}"
                    ? null
                    : this.expression();
            this.skip(";");
            return [{ kind: "return", node }];
        }
        const node = this.expression();
        this.skip(";");
        return [{ kind: "expression", node }];
    }

    // "var f = function(…){…}" too, as Blockly wraps its programs.
    private function(name = this.name()): Statement {
        this.locals.add(name);
        this.take("(");
        const params: string[] = [];
        if (!this.skip(")")) {
            do params.push(this.name());
            while (this.skip(","));
            this.take(")");
        }
        this.outer.push(this.locals);
        this.locals = new Set(params);
        if (this.current.type !== "{")
            throw new Error("Invalid DGP formula syntax");
        const body = this.statement();
        const locals = this.locals;
        this.locals = this.outer.pop()!;
        return { kind: "function", name, params, locals, body };
    }

    private isLocal(name: string): boolean {
        return (
            this.locals.has(name) ||
            this.outer.some((locals) => locals.has(name))
        );
    }

    private declarations(): Statement[] {
        const statements: Statement[] = [];
        do {
            const name = this.name();
            this.locals.add(name);
            if (!this.skip("=")) continue;
            statements.push(
                this.skipKeyword("function")
                    ? this.function(name)
                    : {
                          kind: "expression",
                          node: {
                              kind: "assign",
                              name,
                              value: this.expression(),
                          },
                      },
            );
        } while (this.skip(","));
        return statements;
    }

    private condition(): FormulaNode {
        this.take("(");
        const node = this.expression();
        this.take(")");
        return node;
    }

    private expression(): FormulaNode {
        const node = this.conditional();
        if (!(this.current.type in ASSIGNMENTS)) return node;
        const op = ASSIGNMENTS[this.current.type];
        this.advance();
        const right = this.expression();
        const value: FormulaNode = op
            ? { kind: "binary", op, left: node, right }
            : right;
        if (node.kind === "identifier") return this.assign(node.name, value);
        const indices: FormulaNode[] = [];
        let target: FormulaNode = node;
        while (target.kind === "index") {
            indices.unshift(target.index);
            target = target.target;
        }
        if (target.kind !== "identifier" || indices.length === 0)
            throw new Error("Invalid DGP formula syntax");
        this.declare(target.name);
        return { kind: "assignItem", name: target.name, indices, value };
    }

    private assign(name: string, value: FormulaNode): FormulaNode {
        this.declare(name);
        return { kind: "assign", name, value };
    }

    // A variable assigned without being declared: the enclosing function's
    // or program's if it has one.
    private declare(name: string): void {
        if (!this.isLocal(name)) this.locals.add(name);
    }

    private conditional(): FormulaNode {
        const test = this.binaryLevel(["||"], () =>
            this.binaryLevel(["&&"], () =>
                this.binaryLevel(["==", "!="], () =>
                    this.binaryLevel(["<", "<=", ">", ">="], () =>
                        this.additive(),
                    ),
                ),
            ),
        );
        if (!this.skip("?")) return test;
        const then = this.expression();
        this.take(":");
        return {
            kind: "conditional",
            test,
            then,
            otherwise: this.expression(),
        };
    }

    private binaryLevel(
        ops: Comparison[],
        operand: () => FormulaNode,
    ): FormulaNode {
        let node = operand();
        while ((ops as TokenType[]).includes(this.current.type)) {
            const op = this.current.type as Comparison;
            this.advance();
            node = { kind: "binary", op, left: node, right: operand() };
        }
        return node;
    }

    private additive(): FormulaNode {
        let node = this.multiplicative();
        while (this.current.type === "+" || this.current.type === "-") {
            const op = this.current.type as "+" | "-";
            this.advance();
            node = {
                kind: "binary",
                op,
                left: node,
                right: this.multiplicative(),
            };
        }
        return node;
    }

    private multiplicative(): FormulaNode {
        let node = this.unary();
        while (
            this.current.type === "*" ||
            this.current.type === "/" ||
            this.current.type === "%" ||
            this.startsImplicitFactor()
        ) {
            if (
                this.current.type === "*" ||
                this.current.type === "/" ||
                this.current.type === "%"
            ) {
                const op = this.current.type as "*" | "/" | "%";
                this.advance();
                node = { kind: "binary", op, left: node, right: this.unary() };
            } else {
                node = {
                    kind: "binary",
                    op: "*",
                    left: node,
                    right: this.unary(),
                };
            }
        }
        return node;
    }

    // "0.5x^2", "2sin(x)", "3(x+1)": an identifier/"(" immediately following
    // a factor with no explicit operator means implicit multiplication,
    // matching DGPad's own math notation. A bare number never starts one
    // (unlike "0.5x", "1 2" has no standard reading and stays a syntax
    // error — two adjacent number tokens are never implicit multiplication).
    private startsImplicitFactor(): boolean {
        return (
            (this.current.type === "identifier" &&
                !KEYWORDS.has(this.current.value as string)) ||
            this.current.type === "imaginary" ||
            this.current.type === "("
        );
    }

    private unary(): FormulaNode {
        if (this.skip("+")) return this.unary();
        if (this.current.type === "-" || this.current.type === "!") {
            const op = this.current.type;
            this.advance();
            return { kind: "unary", op, operand: this.unary() };
        }
        const node = this.power();
        // "k++" in a loop: its value before the increment is never used.
        if (
            (this.current.type === "++" || this.current.type === "--") &&
            node.kind === "identifier"
        ) {
            const op = this.current.type === "++" ? "+" : "-";
            this.advance();
            return this.assign(node.name, {
                kind: "binary",
                op,
                left: node,
                right: { kind: "number", value: 1 },
            });
        }
        return node;
    }

    private power(): FormulaNode {
        let base = this.primary();
        while (this.current.type === "[" || this.current.type === ".") {
            if (this.skip(".")) {
                const name = this.name();
                if (name === "length") base = { kind: "length", target: base };
                else if (name === "join") {
                    this.take("(");
                    const [separator = null, ...rest] = this.arguments();
                    if (rest.length > 0)
                        throw new Error("Invalid DGP formula syntax");
                    base = { kind: "join", target: base, separator };
                } else throw new Error("Invalid DGP formula syntax");
                continue;
            }
            this.advance();
            base = { kind: "index", target: base, index: this.expression() };
            this.take("]");
        }
        if (this.current.type === "^") {
            this.advance();
            return { kind: "binary", op: "^", left: base, right: this.unary() };
        }
        return base;
    }

    private primary(): FormulaNode {
        const token = this.current;
        if (token.type === "number") {
            this.advance();
            return { kind: "number", value: token.value as number };
        }
        if (token.type === "string") {
            this.advance();
            return { kind: "string", value: token.value as string };
        }
        if (token.type === "imaginary") {
            this.advance();
            return this.imaginary(token.value as number);
        }
        if (token.type === "identifier") {
            const name = token.value as string;
            if (KEYWORDS.has(name))
                throw new Error("Invalid DGP formula syntax");
            this.advance();
            if ((this.current.type as TokenType) === "(")
                return this.call(name);
            if (this.skip(".")) return this.member(name);
            // "π" is DGPad's own notation for PI in slider bounds/formulas.
            if (name === "PI" || name === "π")
                return { kind: "constant", name: "PI" };
            if (name === "NaN") return { kind: "number", value: NaN };
            if (name === "true" || name === "false")
                return { kind: "number", value: Number(name === "true") };
            // Unless a script names one of its variables "i", as a loop
            // does with "for (i=0; …)".
            if (
                name === "i" &&
                !this.isLocal(name) &&
                !(this.current.type in ASSIGNMENTS)
            )
                return this.imaginary(1);
            // DGPad reads two adjacent function variables as a product,
            // unless they name one of the figure's objects.
            if (
                /^[xyzt]{2}$/.test(name) &&
                !this.isLocal(name) &&
                !objects.has(name)
            )
                return {
                    kind: "binary",
                    op: "*",
                    left: { kind: "identifier", name: name[0] },
                    right: { kind: "identifier", name: name[1] },
                };
            return { kind: "identifier", name };
        }
        if (token.type === "(") {
            this.advance();
            const node = this.expression();
            this.take(")");
            return node;
        }
        if (token.type === "[") return this.vector();
        throw new Error("Invalid DGP formula syntax");
    }

    private imaginary(coefficient: number): FormulaNode {
        return coefficient === 1
            ? { kind: "imaginary" }
            : {
                  kind: "binary",
                  op: "*",
                  left: { kind: "number", value: coefficient },
                  right: { kind: "imaginary" },
              };
    }

    private member(object: string): FormulaNode {
        const name = this.name();
        if (object === "Math") {
            if (name === "PI") return { kind: "constant", name: "PI" };
            return this.call(name);
        }
        if (name === "length")
            return {
                kind: "length",
                target: { kind: "identifier", name: object },
            };
        if (/^d[xyzt]$/.test(name)) {
            this.take("(");
            return {
                kind: "derivative",
                name: object,
                variables: [name[1]],
                args: this.arguments(),
            };
        }
        this.take("(");
        return methodNode(object, name, this.arguments());
    }

    private vector(): FormulaNode {
        this.advance();
        const items: FormulaNode[] = [];
        if ((this.current.type as TokenType) !== "]") {
            items.push(this.expression());
            while (this.skip(",")) items.push(this.expression());
        }
        this.take("]");
        return { kind: "vector", items };
    }

    private call(name: string): FormulaNode {
        this.take("(");
        const args = this.arguments();
        if ((name === "IF" || name === "test") && args.length === 3)
            return {
                kind: "conditional",
                test: args[0],
                then: args[1],
                otherwise: args[2],
            };
        // As JavaScript's: "" + x.
        if (name === "String" && args.length === 1)
            return {
                kind: "binary",
                op: "+",
                left: { kind: "string", value: "" },
                right: args[0],
            };
        if (name === "SET_EXP") {
            const [object, value] = args;
            if (args.length !== 2 || object.kind !== "string")
                throw new Error("Invalid DGP formula syntax");
            return methodNode(object.value, "setExpression", [value]);
        }
        // Blockly's form of a styling method: BLK_STL("S1","setHidden",[1]).
        if (name === "BLK_STL") {
            const [object, method, list] = args;
            if (
                args.length !== 3 ||
                object.kind !== "string" ||
                method.kind !== "string" ||
                list.kind !== "vector"
            )
                throw new Error("Invalid DGP formula syntax");
            return methodNode(
                object.value.replace("dgpad_object_", ""),
                method.value,
                list.items,
            );
        }
        if (name in TURTLE_ARITY) {
            const fn = name as TurtleFn;
            if (args.length !== TURTLE_ARITY[fn])
                throw new Error(`Invalid DGP turtle function "${name}" arity`);
            return { kind: "turtle", fn, args };
        }
        if (!(name in FORMULA_ARITY)) return { kind: "userCall", name, args };
        const fn = name as FormulaFn;
        const arity = FORMULA_ARITY[fn];
        if (arity < 0 ? args.length === 0 : args.length !== arity)
            throw new Error(`Invalid DGP formula function "${name}" arity`);
        return { kind: "call", fn, args };
    }

    // After "(": the arguments up to and including ")".
    private arguments(): FormulaNode[] {
        const args: FormulaNode[] = [];
        if ((this.current.type as TokenType) !== ")") {
            args.push(this.expression());
            while (this.skip(",")) args.push(this.expression());
        }
        this.take(")");
        return args;
    }

    private skipKeyword(...keywords: string[]): boolean {
        if (
            this.current.type !== "identifier" ||
            !keywords.includes(this.current.value as string)
        )
            return false;
        this.advance();
        return true;
    }

    private skip(type: TokenType): boolean {
        if (this.current.type !== type) return false;
        this.advance();
        return true;
    }

    private name(): string {
        const name = this.current.value as string;
        this.take("identifier");
        return name;
    }

    private take(type: TokenType): void {
        if (!this.skip(type)) throw new Error("Invalid DGP formula syntax");
    }

    private advance(): void {
        this.current = this.lexer.next();
    }
}

function methodNode(
    object: string,
    name: string,
    args: FormulaNode[],
): FormulaNode {
    if (!(name in METHOD_ARITY)) throw new Error("Invalid DGP formula syntax");
    const method = name as ObjectMethod;
    const arity = METHOD_ARITY[method];
    if (arity >= 0 && args.length !== arity)
        throw new Error(`Invalid DGP method "${name}" arity`);
    return { kind: "method", object, method, args };
}

// The text each parsed formula or program was read from, which a .dgo file
// stores rather than the tree.
const SOURCES = new WeakMap<FormulaNode | Program, string>();

export function parseFormula(source: string): FormulaNode {
    const node = new FormulaParser(source).parse();
    SOURCES.set(node, source);
    return node;
}

export function parseProgram(source: string): Program {
    const program = new FormulaParser(source).parseProgram();
    SOURCES.set(program, source);
    return program;
}

export function formulaSource(formula: FormulaNode | Program): string {
    return SOURCES.get(formula)!;
}

function children(node: FormulaNode): FormulaNode[] {
    switch (node.kind) {
        case "unary":
            return [node.operand];
        case "index":
            return [node.target, node.index];
        case "length":
            return [node.target];
        case "join":
            return node.separator
                ? [node.target, node.separator]
                : [node.target];
        case "turtle":
            return node.args;
        case "binary":
            return [node.left, node.right];
        case "conditional":
            return [node.test, node.then, node.otherwise];
        case "assign":
            return [node.value];
        case "assignItem":
            return [...node.indices, node.value];
        case "vector":
            return node.items;
        case "method":
            return SKIPPED_METHODS.has(node.method) ? [] : node.args;
        case "call":
        case "userCall":
        case "derivative":
            return node.args;
        default:
            return [];
    }
}

function statementNodes(statement: Statement): FormulaNode[] {
    switch (statement.kind) {
        case "expression":
            return [statement.node];
        case "if":
            return [
                statement.test,
                ...statement.then.flatMap(statementNodes),
                ...statement.otherwise.flatMap(statementNodes),
            ];
        case "loop":
            return [
                ...(statement.test ? [statement.test] : []),
                ...(statement.update ? [statement.update] : []),
                ...statement.body.flatMap(statementNodes),
            ];
        case "function":
            return statement.body.flatMap(statementNodes);
        case "return":
            return statement.node ? [statement.node] : [];
    }
}

// The variables of the program's functions, nested ones included.
function functionLocals(statements: Statement[]): string[] {
    return statements.flatMap((statement) => {
        switch (statement.kind) {
            case "function":
                return [...statement.locals, ...functionLocals(statement.body)];
            case "if":
                return functionLocals([
                    ...statement.then,
                    ...statement.otherwise,
                ]);
            case "loop":
                return functionLocals(statement.body);
            default:
                return [];
        }
    });
}

// Every node of the program, nested ones included.
export function programNodes(program: Program): FormulaNode[] {
    const nodes: FormulaNode[] = [];
    const walk = (node: FormulaNode): void => {
        nodes.push(node);
        children(node).forEach(walk);
    };
    program.body.flatMap(statementNodes).forEach(walk);
    return nodes;
}

function nodeNames(node: FormulaNode): string[] {
    switch (node.kind) {
        case "identifier":
        case "userCall":
        case "derivative":
            return [node.name];
        case "method":
            return READ_METHODS.has(node.method) ? [node.object] : [];
        case "turtle": {
            const [name] = node.args;
            return (node.fn === "TURTLE_GET" || node.fn === "TURTLE_LENGTH") &&
                name.kind === "string"
                ? [turtleList(name.value)]
                : [];
        }
        default:
            return [];
    }
}

// The turtles the program draws, whose own points TURTLE_GET reads.
function ownTurtles(program: Program): string[] {
    return programNodes(program).flatMap((node) =>
        node.kind === "turtle" &&
        node.fn === "TURTLE_INIT" &&
        node.args[0].kind === "string"
            ? [turtleList(node.args[0].value)]
            : [],
    );
}

export function formulaIdentifiers(node: FormulaNode): Set<string> {
    return new Set(
        programNodes({
            body: [{ kind: "expression", node }],
            locals: new Set(),
        }).flatMap(nodeNames),
    );
}

// The figure's objects the program reads.
export function programReferences(program: Program): Set<string> {
    const locals = new Set([
        ...program.locals,
        ...functionLocals(program.body),
        ...ownTurtles(program),
    ]);
    return new Set(
        programNodes(program)
            .flatMap(nodeNames)
            .filter((name) => !locals.has(name)),
    );
}

// The figure's objects the program styles.
export function programTargets(program: Program): Set<string> {
    return new Set(
        programNodes(program).flatMap((node) =>
            node.kind === "method" &&
            !READ_METHODS.has(node.method) &&
            !LIST_METHODS.has(node.method) &&
            !SKIPPED_METHODS.has(node.method)
                ? [node.object]
                : [],
        ),
    );
}

function someNode(
    node: FormulaNode,
    test: (n: FormulaNode) => boolean,
): boolean {
    return test(node) || children(node).some((n) => someNode(n, test));
}

export function usesCoords2D(node: FormulaNode): boolean {
    return someNode(
        node,
        (n) => n.kind === "method" && n.method === "coords2D",
    );
}

const VIEW_FUNCTIONS: ReadonlySet<FormulaFn> = new Set([
    "pixel",
    "windoww",
    "windowh",
    "windowcx",
    "windowcy",
    "theta",
    "phi",
]);

// Whether the formula reads the window (zoom, origin, size or 3D view), as
// DGPad re-evaluates it whenever that changes.
export function usesView(node: FormulaNode): boolean {
    return someNode(
        node,
        (n) =>
            (n.kind === "call" && VIEW_FUNCTIONS.has(n.fn)) ||
            // A move in pixels.
            (n.kind === "turtle" &&
                n.fn === "TURTLE_MV" &&
                !(n.args[1].kind === "number" && n.args[1].value === 0)),
    );
}

// What a DGPad script computes, like its JavaScript: a number, a text, or a
// list (a point's coordinates, a complex number, a list of points...).
export type ScriptValue = number | string | readonly ScriptValue[];

// A formula's own result: a number, a complex number or 2D point, or a 3D
// point.
export type FormulaValue = number | Vec2 | Vec3;

// The window a formula is evaluated in: pixels per unit, the origin's and
// the window's size in pixels, and the 3D view's angles. And the figure's
// angle unit: in DGPad's degree mode, the trigonometric functions read and
// return degrees, as do arg, theta and phi (π keeps its value).
export interface FormulaView {
    unit: number;
    origin: Vec2;
    width: number;
    height: number;
    theta: number;
    phi: number;
    degrees: boolean;
}

// For formulas evaluated outside any window (constants read at import).
export const NO_VIEW: FormulaView = {
    unit: 1,
    origin: [0, 0],
    width: 0,
    height: 0,
    theta: 0,
    phi: 0,
    degrees: false,
};

export interface FormulaEnv {
    resolveIdentifier(name: string): ScriptValue | null;
    view(): FormulaView;
    coords2D?(name: string): Vec2 | null;
    // DGPad's getAOC: the angle AOC as drawn, counterclockwise, in radians
    // within [0, 2π).
    orientedAngle?(name: string): number | null;
    // The center of a conic, as a point's value.
    center?(name: string): ScriptValue | null;
    // Resolves a userCall node (a name outside FORMULA_ARITY applied to
    // arguments, e.g. "E1(x)"), or a derivative node with its `derivatives`.
    // Consumers that don't support calling named objects (most formula
    // owners) simply omit this.
    callFunction?(
        name: string,
        args: FormulaValue[],
        derivatives: string[],
    ): FormulaValue | null;
    // The points another turtle drew (see turtleList).
    turtlePoints?(list: string): readonly ScriptValue[] | null;
    // Carries out a script's styling method on one of the figure's objects.
    callMethod?(
        object: string,
        method: ObjectMethod,
        args: (ScriptValue | null)[],
    ): void;
}

// A real number, possibly written as a complex number with no imaginary
// part (e.g. [2, 0]). A 3D point is never a real number.
export function realPart(value: ScriptValue | null): number | null {
    if (value === null || typeof value === "string") return null;
    if (typeof value === "number") return value;
    return value.length === 2 && value[1] === 0 && typeof value[0] === "number"
        ? value[0]
        : null;
}

function complex(value: ScriptValue): Vec2 | null {
    if (typeof value === "number") return [value, 0];
    return Array.isArray(value) &&
        value.length === 2 &&
        typeof value[0] === "number" &&
        typeof value[1] === "number"
        ? [value[0], value[1]]
        : null;
}

// A formula's own value: a number, or 2 or 3 finite coordinates.
function formulaValue(value: ScriptValue | null): FormulaValue | null {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (
        !Array.isArray(value) ||
        (value.length !== 2 && value.length !== 3) ||
        !value.every(
            (item) => typeof item === "number" && Number.isFinite(item),
        )
    )
        return null;
    return value.length === 2
        ? [value[0], value[1]]
        : [value[0], value[1], value[2]];
}

function complexMul(a: Vec2, b: Vec2): Vec2 {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

function complexDiv(a: Vec2, b: Vec2): Vec2 {
    const denominator = b[0] * b[0] + b[1] * b[1];
    return [
        (a[0] * b[0] + a[1] * b[1]) / denominator,
        (a[1] * b[0] - a[0] * b[1]) / denominator,
    ];
}

function complexSqrt(a: Vec2): Vec2 {
    const r = Math.hypot(a[0], a[1]);
    const theta = Math.atan2(a[1], a[0]);
    const sqrtR = Math.sqrt(r);
    return [sqrtR * Math.cos(theta / 2), sqrtR * Math.sin(theta / 2)];
}

// DGPad takes a complex number's argument in [0, 2π[: this picks the branch
// of a fractional power, and which root comes first.
function complexPow(a: Vec2, exponent: number, turn = 0): Vec2 {
    const r = Math.hypot(a[0], a[1]);
    const theta = Math.atan2(a[1], a[0]);
    const angle =
        exponent *
        ((theta < 0 ? theta + 2 * Math.PI : theta) + 2 * Math.PI * turn);
    const scaled = Math.pow(r, exponent);
    return [scaled * Math.cos(angle), scaled * Math.sin(angle)];
}

function terms(
    count: number,
    term: (index: number) => ScriptValue | null,
): ScriptValue[] | null {
    const values: ScriptValue[] = [];
    for (let index = 0; index < count; index++) {
        const value = term(index);
        if (value === null) return null;
        values.push(value);
    }
    return values;
}

function evalBinary(
    op: BinaryOp,
    l: ScriptValue,
    r: ScriptValue,
): ScriptValue | null {
    if (isComparison(op)) {
        const [a, b] = [realPart(l), realPart(r)];
        return a === null || b === null ? null : COMPARISONS[op](a, b);
    }
    if (typeof l === "string" || typeof r === "string")
        return op === "+" ? String(l) + String(r) : null;
    if (typeof l === "number" && typeof r === "number")
        return ARITHMETIC[op](l, r);
    const a = complex(l);
    const b = complex(r);
    if (a && b) {
        switch (op) {
            case "+":
                return vAdd(a, b);
            case "-":
                return vSub(a, b);
            case "*":
                return complexMul(a, b);
            case "/":
                return complexDiv(a, b);
            case "^": {
                if (typeof r !== "number") return null;
                // Like DGPad, a complex number (even [8, 0]) to the power 1/n
                // gives the list of its n roots, e.g. for Cardano's formula.
                const n = Math.round(1 / r);
                if (n > 1 && Math.abs(1 / r - n) < 1e-9)
                    return terms(n, (turn) => complexPow(a, r, turn));
                // A real base (e.g. [2, 0]) goes through plain Math.pow:
                // complexPow's polar round-trip (cos/sin of an angle that's
                // 0 or PI) leaves a tiny nonzero imaginary residue even for
                // a perfectly real result, which realPart would then
                // wrongly reject as complex.
                return a[1] === 0 && (a[0] >= 0 || Number.isInteger(r))
                    ? Math.pow(a[0], r)
                    : complexPow(a, r);
            }
        }
    }
    // Other lists (e.g. 3D vectors) add up, and scale by a real number, term
    // by term.
    if (Array.isArray(l) && Array.isArray(r))
        return (op === "+" || op === "-") && l.length === r.length
            ? terms(l.length, (i) => evalBinary(op, l[i], r[i]))
            : null;
    const [list, scalar] = Array.isArray(l)
        ? [l, realPart(r)]
        : [r as ScriptValue[], realPart(l)];
    if (scalar === null || !(op === "*" || (op === "/" && list === l)))
        return null;
    return terms(list.length, (i) => evalBinary(op, list[i], scalar));
}

function negate(value: ScriptValue): ScriptValue | null {
    if (typeof value === "number") return -value;
    if (typeof value === "string") return null;
    return terms(value.length, (i) => negate(value[i]));
}

function realUnary(
    fn: (x: number) => number,
    arg: FormulaValue,
): number | null {
    const real = realPart(arg ?? null);
    return real === null ? null : fn(real);
}

function angleUnit(env: FormulaEnv): number {
    return env.view().degrees ? Math.PI / 180 : 1;
}

function evalCall(
    fn: Exclude<FormulaFn, ListFn | "isNaN">,
    args: FormulaValue[],
    env: FormulaEnv,
): FormulaValue | null {
    switch (fn) {
        case "pixel":
            return env.view().unit;
        case "windoww": {
            const { width, unit } = env.view();
            return width / unit;
        }
        case "windowh": {
            const { height, unit } = env.view();
            return height / unit;
        }
        case "windowcx": {
            const { width, origin, unit } = env.view();
            return (width / 2 - origin[0]) / unit;
        }
        case "windowcy": {
            const { height, origin, unit } = env.view();
            return (origin[1] - height / 2) / unit;
        }
        case "theta":
            return env.view().theta / angleUnit(env);
        case "phi":
            return env.view().phi / angleUnit(env);
        case "d":
        case "distance": {
            const [a, b] = args;
            if (
                typeof a === "number" ||
                typeof b === "number" ||
                a.length !== b.length
            )
                return null;
            return a.length === 3
                ? vNorm(vSub(a as Vec3, b as Vec3))
                : vNorm(vSub(a as Vec2, b as Vec2));
        }
        case "x": {
            const [a] = args;
            return typeof a === "number" ? null : a[0];
        }
        case "y": {
            const [a] = args;
            return typeof a === "number" ? null : a[1];
        }
        case "sqrt": {
            const [a] = args;
            if (typeof a === "number")
                return a >= 0 ? Math.sqrt(a) : complexSqrt([a, 0]);
            return a.length === 3 ? null : complexSqrt(a);
        }
        case "sin":
        case "cos":
        case "tan": {
            const unit = angleUnit(env);
            return realUnary((x) => Math[fn](x * unit), args[0]);
        }
        case "asin":
        case "acos":
        case "atan": {
            const unit = angleUnit(env);
            return realUnary((x) => Math[fn](x) / unit, args[0]);
        }
        case "atan2": {
            const [a, b] = args;
            const ra = realPart(a);
            const rb = realPart(b);
            return ra === null || rb === null ? null : Math.atan2(ra, rb);
        }
        case "abs":
            return realUnary(Math.abs, args[0]);
        case "floor":
            return realUnary(Math.floor, args[0]);
        case "ceil":
            return realUnary(Math.ceil, args[0]);
        case "round":
            return realUnary(Math.round, args[0]);
        case "exp":
            return realUnary(Math.exp, args[0]);
        case "log":
            return realUnary(Math.log, args[0]);
        // DGPad's arg, within [0, 2π).
        case "arg": {
            const [a] = args;
            if (typeof a !== "number" && a.length === 3) return null;
            const [x, y] = typeof a === "number" ? [a, 0] : a;
            const angle = Math.atan2(y, x);
            return (angle < 0 ? angle + 2 * Math.PI : angle) / angleUnit(env);
        }
        case "perp": {
            const [a] = args;
            if (typeof a === "number") return null;
            const norm = Math.hypot(a[0], a[1]);
            return norm > 0 ? [-a[1] / norm, a[0] / norm] : null;
        }
        case "unitVector": {
            const [a] = args;
            if (typeof a === "number") return null;
            const norm = a.length === 3 ? vNorm(a as Vec3) : vNorm(a as Vec2);
            return a.length === 3
                ? vScale(a as Vec3, 1 / norm)
                : vScale(a as Vec2, 1 / norm);
        }
        case "cross":
        case "crossProduct": {
            const [a, b] = args;
            if (
                typeof a === "number" ||
                typeof b === "number" ||
                a.length !== 3 ||
                b.length !== 3
            )
                return null;
            return vCross(a as Vec3, b as Vec3);
        }
        case "dot": {
            const [a, b] = args;
            if (
                typeof a === "number" ||
                typeof b === "number" ||
                a.length !== b.length
            )
                return null;
            return vDot(a, b);
        }
        case "min":
        case "max": {
            const values = args.map(realPart);
            return values.includes(null)
                ? null
                : Math[fn](...(values as number[]));
        }
        case "gcd": {
            let [a, b] = args.map(realPart);
            if (a === null || b === null) return null;
            if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
            while (b !== 0) [a, b] = [b, a % b];
            return a;
        }
        case "conj": {
            const [a] = args;
            if (typeof a === "number") return a;
            return a.length === 2 ? [a[0], -a[1]] : null;
        }
        // A complex number's modulus.
        case "mod": {
            const [a] = args;
            if (typeof a === "number") return Math.abs(a);
            return a.length === 2 ? Math.hypot(a[0], a[1]) : null;
        }
        // The angle from OA to OC, counterclockwise, within [0, 2π).
        case "Angle360": {
            const [a, o, c] = args;
            if (typeof a === "number" || typeof o === "number") return null;
            if (typeof c === "number") return null;
            const angle =
                Math.atan2(c[1] - o[1], c[0] - o[0]) -
                Math.atan2(a[1] - o[1], a[0] - o[0]);
            const turn = 2 * Math.PI;
            return (angle - Math.floor(angle / turn) * turn) / angleUnit(env);
        }
        // The geometric angle AOC, within [0, π], in the plane or in space.
        case "Angle180": {
            const [a, o, c] = args;
            if (typeof a === "number" || typeof o === "number") return null;
            if (typeof c === "number") return null;
            if (a.length !== o.length || c.length !== o.length) return null;
            const u = a.map((value, i) => value - o[i]);
            const v = c.map((value, i) => value - o[i]);
            const cosine = vDot(u, v) / (Math.hypot(...u) * Math.hypot(...v));
            return (
                Math.acos(Math.min(1, Math.max(-1, cosine))) / angleUnit(env)
            );
        }
    }
}

// Beyond it, a script's loops are taken as endless and its value is
// undefined.
const MAX_STEPS = 10_000_000;
// Beyond it, a script's function calls are taken as endless, before they
// overflow the browser's stack.
const MAX_DEPTH = 1000;

class StepLimitExceeded extends Error {}

// One evaluation of a compiled formula or program.
interface Frame {
    env: FormulaEnv;
    // The values of the program's own variables, by slot.
    slots: (ScriptValue | null)[];
    steps: number;
    depth: number;
    // The lists the script made or copied, which it changes in place.
    owned: Set<ScriptValue[]>;
    // Whether a return statement is leaving the function, and its value.
    returning: boolean;
    result: ScriptValue | null;
    turtle: Turtle | null;
    // The decimal places a turtle writes numbers with, as a power of 10.
    precision: number;
}

// Where the turtle is and which way it heads (u), its left (v) and its top
// (w), and what it has drawn so far.
interface Turtle {
    name: string;
    u: Vec3;
    v: Vec3;
    w: Vec3;
    last: number[];
    penUp: boolean;
    tab: ScriptValue[];
}

// Formulas and programs are compiled once into closures, run at each
// evaluation: much faster than walking their tree, and never JavaScript
// built from the figure's text.
type Code = (frame: Frame) => ScriptValue | null;

// One of the script's functions. Its variables have their own slots, saved
// during a call and restored after it, so that it can call itself.
interface ScriptFunction {
    params: number[];
    slots: number[];
    body: Code;
}

// What a program is compiled in: the slots of the variables it sees and its
// functions, by name.
interface Scope {
    slots: ReadonlyMap<string, number>;
    functions: ReadonlyMap<string, ScriptFunction>;
    // The number of slots of the whole program.
    size: { value: number };
}

// A list the script may change: itself if the script made it, else a copy
// made once, as it may be another object's value (a copy per change would
// make building a list of n terms quadratic).
function own(list: readonly ScriptValue[], frame: Frame): ScriptValue[] {
    if (frame.owned.has(list as ScriptValue[])) return list as ScriptValue[];
    const copy = [...list];
    frame.owned.add(copy);
    return copy;
}

// One of the script's own lists, made its own.
function ownSlot(slot: number, frame: Frame): ScriptValue[] | null {
    const list = frame.slots[slot];
    return Array.isArray(list) ? (frame.slots[slot] = own(list, frame)) : null;
}

function truthy(value: ScriptValue | null): boolean {
    if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
    return value !== null && value !== "";
}

function evalCodes(codes: Code[], frame: Frame): ScriptValue[] | null {
    const values: ScriptValue[] = [];
    for (const code of codes) {
        const value = code(frame);
        if (value === null) return null;
        values.push(value);
    }
    return values;
}

// The instructions that apply from the turtle's last point on, by code.
const TURTLE_STYLES: Partial<Record<TurtleFn, number>> = {
    TURTLE_COLOUR: 2,
    TURTLE_COLOUR_INCREMENT: 3,
    TURTLE_WIDTH: 10,
    TURTLE_WIDTH_INCREMENT: 11,
    TURTLE_POINTS_WIDTH: 12,
    TURTLE_POINTS_WIDTH_INCREMENT: 13,
};

function rotateAxes(a: Vec3, b: Vec3, c: number, s: number): [Vec3, Vec3] {
    return [vAdd(vScale(a, c), vScale(b, s)), vSub(vScale(b, c), vScale(a, s))];
}

function turtlePoint(value: ScriptValue): number[] | null {
    return Array.isArray(value) &&
        (value.length === 2 || value.length === 3) &&
        value.every((c) => typeof c === "number")
        ? [...(value as number[])]
        : null;
}

function moveTurtle(t: Turtle, distance: number): void {
    t.last = t.last.map((c, i) => c + distance * t.u[i]);
    if (t.penUp) t.tab.push([NaN, NaN, NaN]);
    t.tab.push(t.last);
}

// Turns the turtle toward the point, in its plane, then, in 3D, up or down
// to it.
function headToward(t: Turtle, target: number[]): void {
    const p: Vec3 = [
        target[0] - t.last[0],
        target[1] - t.last[1],
        (target[2] ?? 0) - (t.last[2] ?? 0),
    ];
    const [x, y, z] = [vDot(p, t.u), vDot(p, t.v), vDot(p, t.w)];
    const flat = Math.hypot(x, y);
    const full = t.last.length === 3 ? Math.hypot(flat, z) : flat;
    if (flat <= 1e-13 || full <= 1e-13) return;
    [t.u, t.v] = rotateAxes(t.u, t.v, x / flat, y / flat);
    if (t.last.length === 3)
        [t.u, t.w] = rotateAxes(t.u, t.w, flat / full, z / full);
}

function turtleCall(
    fn: TurtleFn,
    args: ScriptValue[],
    frame: Frame,
): ScriptValue | null {
    const [arg] = args;
    const real = realPart(arg ?? null);
    switch (fn) {
        case "TURTLE_TEXT":
            return arg;
        case "SET_NUM_PRECISION":
            if (real !== null) frame.precision = 10 ** real;
            return null;
        case "TURTLE_INIT": {
            const start = turtlePoint(args[1]);
            frame.turtle = start && {
                name: String(arg),
                u: [1, 0, 0],
                v: [0, 1, 0],
                w: [0, 0, 1],
                last: start,
                penUp: false,
                tab: [[10, 0, 0, 1], [12, 0, 0, 1e-13], [2, 0, 0, 55], start],
            };
            return null;
        }
        case "TURTLE_LENGTH":
            return (
                frame.env.turtlePoints?.(turtleList(String(arg)))?.length ??
                null
            );
    }
    const t = frame.turtle;
    if (fn === "TURTLE_GET") {
        const index = realPart(args[1]);
        if (index === null) return null;
        if (!t || String(arg) !== t.name)
            return (
                frame.env.turtlePoints?.(turtleList(String(arg)))?.[
                    index - 1
                ] ?? null
            );
        let k = 0;
        for (const item of t.tab)
            if (
                Array.isArray(item) &&
                item.length < 4 &&
                !Number.isNaN(item[0]) &&
                ++k === index
            )
                return item;
        return null;
    }
    if (!t) return null;
    const code = TURTLE_STYLES[fn];
    if (code) {
        t.tab.splice(-1, 0, [code, 0, 0, arg]);
        return null;
    }
    const angle = (real ?? NaN) * angleUnit(frame.env);
    switch (fn) {
        case "TURTLE_RESULT":
            return t.tab;
        case "TURTLE_POS":
            return t.last;
        case "TURTLE_RESET":
            [t.u, t.v, t.w] = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1],
            ];
            return null;
        case "TURTLE_PRINT": {
            const p = frame.precision;
            const text = String(arg).replace(/\d+\.\d+/g, (number) =>
                String(Math.round(Number(number) * p) / p).replace(".", ","),
            );
            t.tab.push([20, 0, text, t.u], t.last);
            return null;
        }
        case "TURTLE_PRINT_IMG":
            t.tab.push([30, String(arg), ...args.slice(1), t.u], t.last);
            return null;
        case "TURTLE_FONT":
            t.tab.splice(-1, 0, [21, 0, 0, args]);
            return null;
        case "TURTLE_MV":
            if (real !== null)
                moveTurtle(
                    t,
                    truthy(args[1]) ? real / frame.env.view().unit : real,
                );
            return null;
        case "TURTLE_TURN":
            [t.u, t.v] = rotateAxes(t.u, t.v, Math.cos(angle), Math.sin(angle));
            return null;
        case "TURTLE_ROTATE":
            if (truthy(args[1]))
                [t.u, t.w] = rotateAxes(
                    t.u,
                    t.w,
                    Math.cos(angle),
                    Math.sin(angle),
                );
            else
                [t.v, t.w] = rotateAxes(
                    t.v,
                    t.w,
                    Math.cos(angle),
                    Math.sin(angle),
                );
            return null;
        case "TURTLE_UP":
            t.penUp = truthy(arg);
            return null;
        case "TURTLE_COLOUR_RGB": {
            const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(
                String(arg),
            );
            t.tab.splice(-1, 0, [
                1,
                ...(rgb
                    ? rgb.slice(1).map((hex) => parseInt(hex, 16))
                    : [0, 0, 0]),
            ]);
            return null;
        }
        case "TURTLE_FILL":
            t.tab.push([4, 0, 0, arg]);
            return null;
        case "TURTLE_ROTATE_PT":
        case "TURTLE_JOIN_PT": {
            const target = turtlePoint(arg);
            if (!target) return null;
            headToward(t, target);
            if (fn === "TURTLE_JOIN_PT")
                moveTurtle(
                    t,
                    Math.hypot(...t.last.map((c, i) => (target[i] ?? 0) - c)),
                );
            return null;
        }
    }
    return null;
}

function compileNode(node: FormulaNode, scope: Scope): Code {
    const compile = (child: FormulaNode) => compileNode(child, scope);
    switch (node.kind) {
        case "number":
        case "string": {
            const { value } = node;
            return () => value;
        }
        case "imaginary":
            return () => [0, 1];
        case "constant":
            return () => Math.PI;
        case "identifier": {
            const { name } = node;
            const slot = scope.slots.get(name);
            return slot === undefined
                ? (frame) => frame.env.resolveIdentifier(name)
                : (frame) => frame.slots[slot];
        }
        case "assign": {
            const slot = scope.slots.get(node.name);
            const value = compile(node.value);
            return slot === undefined
                ? value
                : (frame) => (frame.slots[slot] = value(frame));
        }
        case "assignItem": {
            const slot = scope.slots.get(node.name)!;
            const indices = node.indices.map(compile);
            const value = compile(node.value);
            return (frame) => {
                const path = indices.map((index) => realPart(index(frame)));
                const item = value(frame);
                let list = ownSlot(slot, frame);
                if (!list || path.includes(null) || item === null) return null;
                const last = path.pop()!;
                for (const index of path as number[]) {
                    const next: ScriptValue = list[index];
                    if (!Array.isArray(next)) return null;
                    list = list[index] = own(next, frame);
                }
                list[last] = item;
                return item;
            };
        }
        case "conditional": {
            const [test, then, otherwise] = [
                node.test,
                node.then,
                node.otherwise,
            ].map(compile);
            return (frame) =>
                truthy(test(frame)) ? then(frame) : otherwise(frame);
        }
        case "unary": {
            const operand = compile(node.operand);
            if (node.op === "-")
                return (frame) => {
                    const value = operand(frame);
                    return value === null ? null : negate(value);
                };
            return (frame) => {
                const real = realPart(operand(frame));
                return real === null ? null : Number(real === 0);
            };
        }
        case "index": {
            const index = compile(node.index);
            // Only the item read: the others may be undefined, e.g. in a list
            // of points.
            if (node.target.kind === "vector") {
                const items = node.target.items.map(compile);
                return (frame) => {
                    const i = realPart(index(frame));
                    if (i === null) return null;
                    const item = items[i];
                    return item ? item(frame) : null;
                };
            }
            const target = compile(node.target);
            return (frame) => {
                const i = realPart(index(frame));
                if (i === null) return null;
                const list = target(frame);
                return Array.isArray(list) ? (list[i] ?? null) : null;
            };
        }
        case "length": {
            const target = compile(node.target);
            return (frame) => {
                const value = target(frame);
                return typeof value === "string" || Array.isArray(value)
                    ? value.length
                    : null;
            };
        }
        case "join": {
            const target = compile(node.target);
            const separator = node.separator && compile(node.separator);
            return (frame) => {
                const list = target(frame);
                const sep = separator ? separator(frame) : ",";
                return Array.isArray(list) && sep !== null
                    ? list.join(String(sep))
                    : null;
            };
        }
        case "turtle": {
            const { fn } = node;
            const args = node.args.map(compile);
            return (frame) => {
                const values = evalCodes(args, frame);
                return values && turtleCall(fn, values, frame);
            };
        }
        case "method":
            return compileMethod(node, scope);
        case "vector": {
            const items = node.items.map(compile);
            return (frame) => {
                const values = evalCodes(items, frame);
                if (values) frame.owned.add(values);
                return values;
            };
        }
        case "binary": {
            const { op } = node;
            const [left, right] = [node.left, node.right].map(compile);
            const numbers = isComparison(op) ? COMPARISONS[op] : ARITHMETIC[op];
            return (frame) => {
                const l = left(frame);
                const r = right(frame);
                if (l === null || r === null) return null;
                return typeof l === "number" && typeof r === "number"
                    ? numbers(l, r)
                    : evalBinary(op, l, r);
            };
        }
        case "call": {
            const { fn } = node;
            const args = node.args.map(compile);
            // Whether a point, e.g. an intersection, is undefined.
            if (fn === "isNaN")
                return (frame) => {
                    const value = args[0](frame);
                    return Number(value === null || Number.isNaN(value));
                };
            if (fn in LIST_OPERATORS) {
                const op = LIST_OPERATORS[fn as ListFn];
                return (frame) => {
                    const values = evalCodes(args, frame);
                    if (values === null) return null;
                    return op
                        ? evalBinary(op, values[0], values[1])
                        : values[0];
                };
            }
            return (frame) => {
                const values = evalCodes(args, frame)?.map(formulaValue);
                if (!values || values.includes(null)) return null;
                return evalCall(
                    fn as Exclude<FormulaFn, ListFn | "isNaN">,
                    values as FormulaValue[],
                    frame.env,
                );
            };
        }
        case "userCall":
        case "derivative": {
            const { name } = node;
            const args = node.args.map(compile);
            const fn =
                node.kind === "userCall" ? scope.functions.get(name) : null;
            if (fn) return (frame) => callFunction(fn, args, frame);
            const derivatives =
                node.kind === "derivative" ? node.variables : [];
            return (frame) => {
                if (!frame.env.callFunction) return null;
                const values = evalCodes(args, frame)?.map(formulaValue);
                if (!values || values.includes(null)) return null;
                return frame.env.callFunction(
                    name,
                    values as FormulaValue[],
                    derivatives,
                );
            };
        }
    }
}

function compileMethod(
    node: Extract<FormulaNode, { kind: "method" }>,
    scope: Scope,
): Code {
    const { object, method } = node;
    const self = compileNode({ kind: "identifier", name: object }, scope);
    const args = node.args.map((arg) => compileNode(arg, scope));
    switch (method) {
        case "coords2D":
            return (frame) => frame.env.coords2D?.(object) ?? null;
        case "coords3D":
            return self;
        case "getAOC":
            return (frame) => frame.env.orientedAngle?.(object) ?? null;
        case "center":
            return (frame) => frame.env.center?.(object) ?? null;
        case "concat":
            return (frame) => {
                const list = self(frame);
                const values = evalCodes(args, frame);
                if (!Array.isArray(list) || values === null) return null;
                // As JavaScript's, which spreads the lists it's given.
                return list.concat(...values);
            };
        case "getName":
            return () => object;
        case "getX":
        case "getY": {
            const axis = method === "getX" ? 0 : 1;
            return (frame) => {
                const point = frame.env.resolveIdentifier(object);
                return Array.isArray(point) ? (point[axis] ?? null) : null;
            };
        }
    }
    if (SKIPPED_METHODS.has(method)) return () => null;
    if (!LIST_METHODS.has(method))
        return (frame) => {
            const values = args.map((arg) => arg(frame));
            frame.env.callMethod?.(object, method, values);
            return null;
        };
    const slot = scope.slots.get(object);
    return (frame) => {
        const values = args.map((arg) => arg(frame));
        const list = slot === undefined ? null : ownSlot(slot, frame);
        if (!list || values.includes(null)) return null;
        if (method === "pop") return list.pop() ?? null;
        list.push(...(values as ScriptValue[]));
        return list.length;
    };
}

function step(frame: Frame): void {
    if (++frame.steps > MAX_STEPS) throw new StepLimitExceeded();
}

function callFunction(
    fn: ScriptFunction,
    args: Code[],
    frame: Frame,
): ScriptValue | null {
    const values = evalCodes(args, frame);
    if (values === null) return null;
    if (++frame.depth > MAX_DEPTH) throw new StepLimitExceeded();
    const saved = fn.slots.map((slot) => frame.slots[slot]);
    fn.slots.forEach((slot) => (frame.slots[slot] = null));
    fn.params.forEach((slot, i) => (frame.slots[slot] = values[i] ?? null));
    fn.body(frame);
    const value = frame.returning ? frame.result : null;
    frame.returning = false;
    fn.slots.forEach((slot, i) => (frame.slots[slot] = saved[i]));
    frame.depth--;
    return value;
}

// A block's value is its last statement's, null when it isn't an
// expression, or the value it returns. Its functions can be called from
// anywhere in it, as JavaScript's.
function compileBlock(statements: Statement[], scope: Scope): Code {
    const declared = statements.filter(
        (statement) => statement.kind === "function",
    );
    if (declared.length > 0) {
        const functions = new Map(scope.functions);
        const bodies = declared.map((statement) => {
            const slots = new Map(scope.slots);
            statement.locals.forEach((name) =>
                slots.set(name, scope.size.value++),
            );
            const fn: ScriptFunction = {
                params: statement.params.map((name) => slots.get(name)!),
                slots: [...statement.locals].map((name) => slots.get(name)!),
                body: () => null,
            };
            functions.set(statement.name, fn);
            return () => {
                fn.body = compileBlock(statement.body, {
                    slots,
                    functions,
                    size: scope.size,
                });
            };
        });
        scope = { ...scope, functions };
        bodies.forEach((compileBody) => compileBody());
    }
    const codes = statements.map((statement) =>
        compileStatement(statement, scope),
    );
    return (frame) => {
        let value: ScriptValue | null = null;
        for (const code of codes) {
            step(frame);
            value = code(frame);
            if (frame.returning) return frame.result;
        }
        return value;
    };
}

function compileStatement(statement: Statement, scope: Scope): Code {
    switch (statement.kind) {
        case "expression":
            return compileNode(statement.node, scope);
        case "function":
            return () => null;
        case "return": {
            const value = statement.node
                ? compileNode(statement.node, scope)
                : () => null;
            return (frame) => {
                frame.result = value(frame);
                frame.returning = true;
                return frame.result;
            };
        }
        case "if": {
            const test = compileNode(statement.test, scope);
            const then = compileBlock(statement.then, scope);
            const otherwise = compileBlock(statement.otherwise, scope);
            return (frame) => {
                (truthy(test(frame)) ? then : otherwise)(frame);
                return null;
            };
        }
        case "loop": {
            const test = statement.test && compileNode(statement.test, scope);
            const update =
                statement.update && compileNode(statement.update, scope);
            const body = compileBlock(statement.body, scope);
            return (frame) => {
                while (!test || truthy(test(frame))) {
                    step(frame);
                    body(frame);
                    if (frame.returning) return null;
                    update?.(frame);
                }
                return null;
            };
        }
    }
}

const COMPILED = new WeakMap<
    FormulaNode | Program,
    { code: Code; size: number }
>();

function evaluate(
    { code, size }: { code: Code; size: number },
    env: FormulaEnv,
) {
    return code({
        env,
        slots: new Array<ScriptValue | null>(size).fill(null),
        steps: 0,
        depth: 0,
        owned: new Set(),
        returning: false,
        result: null,
        turtle: null,
        precision: 1e14,
    });
}

// The value of the program's last statement, as DGPad's: null when it
// isn't an expression, or when the program runs too long.
export function evaluateProgram(
    program: Program,
    env: FormulaEnv,
): ScriptValue | null {
    let compiled = COMPILED.get(program);
    if (!compiled) {
        const size = { value: program.locals.size };
        const slots = new Map([...program.locals].map((name, i) => [name, i]));
        const code = compileBlock(program.body, {
            slots,
            functions: new Map(),
            size,
        });
        compiled = { code, size: size.value };
        COMPILED.set(program, compiled);
    }
    try {
        const value = evaluate(compiled, env);
        return typeof value === "number" && !Number.isFinite(value)
            ? null
            : value;
    } catch (error) {
        if (error instanceof StepLimitExceeded) return null;
        throw error;
    }
}

// Never throws: any domain failure (an undefined referenced point, division
// by zero, a non-finite result, a real-only function given a complex
// argument, a complex base with a complex exponent) surfaces as null.
export function evaluateFormula(
    node: FormulaNode,
    env: FormulaEnv,
): FormulaValue | null {
    let compiled = COMPILED.get(node);
    if (!compiled) {
        const code = compileNode(node, {
            slots: new Map(),
            functions: new Map(),
            size: { value: 0 },
        });
        compiled = { code, size: 0 };
        COMPILED.set(node, compiled);
    }
    return formulaValue(evaluate(compiled, env));
}
