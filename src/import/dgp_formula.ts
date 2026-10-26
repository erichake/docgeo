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
    | "random"
    | "rotate"
    | "dilate"
    // "30°", an angle in degrees in the figure's unit: no name calls it.
    | "°"
    | ListFn;

// DGPad's own names for its operators, also applying to lists, its view
// restrictions (see restrictView) and Blockly's message (see alert).
type ListFn =
    | "plus"
    | "minus"
    | "times"
    | "quotient"
    | "power"
    | "pow"
    | "restrictTheta"
    | "restrictPhi"
    | "ALERT";

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
    random: 0,
    rotate: 3,
    dilate: 3,
    "°": 1,
    plus: 2,
    minus: 2,
    times: 2,
    quotient: 2,
    power: 2,
    pow: 2,
    restrictTheta: 1,
    restrictPhi: 1,
    ALERT: 1,
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
    ALERT: null,
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
    | "shift"
    | "concat"
    | "setHidden"
    | "setShowName"
    | "setOpacity"
    | "setRGBColor"
    | "setSize"
    | "setPrecision"
    | "setIncrement"
    | "setLayer"
    | "setDash"
    | "noMouseInside"
    // A button's SET_EXP: the new value of a number (see button_object.ts).
    | "setExpression"
    | "setArrow";

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

const LIST_METHODS: ReadonlySet<ObjectMethod> = new Set([
    "push",
    "pop",
    "shift",
]);

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
export const METHOD_ARITY: Record<ObjectMethod, number> = {
    coords2D: 0,
    coords3D: 0,
    getX: 0,
    getY: 0,
    getName: 0,
    getAOC: 0,
    center: 0,
    push: -1,
    pop: 0,
    shift: 0,
    concat: -1,
    setHidden: 1,
    setShowName: 1,
    setOpacity: 1,
    setRGBColor: 3,
    setSize: 1,
    setPrecision: 1,
    setIncrement: 1,
    setLayer: 1,
    setDash: 1,
    setArrow: 1,
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

type NativeFn = "split" | "reverse" | "parseInt";

// The name a program reads, with TURTLE_GET and TURTLE_LENGTH, the List
// that draws another turtle by: that List's in DGPad, whatever its own in
// DocGeo (see DGO.md).
export const turtleList = (name: string) => `blk_turtle_list_${name}`;

// The name a program reads one of DGPad's Blockly globals by, an Ex of the
// figure (see DGO.md): not an identifier, no clash with other names.
export const globalName = (name: string) => `GLOBAL ${name}`;

// The global a name read by a program is, if any.
export const globalOf = (name: string): string | null =>
    name.startsWith("GLOBAL ") ? name.slice(7) : null;

// The program of a BLK's mode, a turtle ("onlogo") or an "oncompute"
// compiled as DGPad compiles them.
export function blocklySource(
    modes: Record<string, { sync?: unknown }>,
    mode: string,
    name: string,
): string | null {
    const sync = modes[mode]?.sync;
    if (typeof sync !== "string") return null;
    if (mode !== "onlogo" && mode !== "oncompute") return sync;
    const body = sync.replace(/^\s*var\s*\w+(\s*,\s*\w+)*;/gm, "");
    return mode === "onlogo"
        ? `var bl=function(){\nTURTLE_INIT("${name}",${name});\n${body}\nreturn TURTLE_RESULT()\n};\nbl()`
        : `var bl=function(){\n${body}\n};\nbl()`;
}

type BinaryOp = "+" | "-" | "*" | "/" | "%" | "^" | Comparison;

// Blockly's constants, but φ, which it writes (1 + Math.sqrt(5)) / 2.
const CONSTANTS = {
    PI: Math.PI,
    E: Math.E,
    SQRT2: Math.SQRT2,
    SQRT1_2: Math.SQRT1_2,
    INFINITY: Infinity,
};

export type FormulaNode =
    | { kind: "number"; value: number }
    | { kind: "string"; value: string }
    | { kind: "imaginary" }
    | { kind: "constant"; name: keyof typeof CONSTANTS }
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
    // "tab.slice(-1)", as JavaScript's: Blockly's last item is
    // "tab.slice(-1)[0]".
    | { kind: "slice"; target: FormulaNode; args: FormulaNode[] }
    // "s.split(sep)", "tab.reverse()", "parseInt(s)", as JavaScript's: the
    // text or list first.
    | { kind: "native"; fn: NativeFn; args: FormulaNode[] }
    | { kind: "turtle"; fn: TurtleFn; args: FormulaNode[] }
    // "P.coords2D()" (where point P is drawn, in the window's coordinate
    // system, which changes with the 3D view), "S1.setHidden(1)" or a
    // script's own "tab.push(P)", or "tab[i].push(P)" on one of its items.
    | {
          kind: "method";
          object: string;
          method: ObjectMethod;
          args: FormulaNode[];
          indices: FormulaNode[];
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
    | { kind: "return"; node: FormulaNode | null }
    // Only in a loop of the same function.
    | { kind: "break" }
    | { kind: "continue" };

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
    "&&": (a, b) => Number(truthy(a) && truthy(b)),
    "||": (a, b) => Number(truthy(a) || truthy(b)),
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

export type TokenType =
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
    | "°"
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

export interface Token {
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
const SPACE = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/y;
// After its "/": the rest of a regular expression, its flags included.
const REGEX = /(?:[^\\/[\n]|\\.|\[(?:[^\\\]\n]|\\.)*\])+\/[a-z]*/y;

// Also the editor's (see EDITOR.md), which reads where each token ends.
export class FormulaLexer {
    index = 0;

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

        // A name that isn't an identifier, as the editor writes it.
        if (character === "`") {
            const end = this.source.indexOf("`", this.index + 1);
            if (end < this.index + 2)
                throw new Error("Invalid DGP formula syntax");
            const value = this.source.slice(this.index + 1, end);
            this.index = end + 1;
            return { type: "identifier", value };
        }

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

        if ("+-*/%^(),[].°".includes(character)) {
            this.index++;
            return { type: character as TokenType, value: character };
        }

        throw new Error("Invalid DGP formula syntax");
    }

    skipRegex(): void {
        REGEX.lastIndex = this.index;
        if (!REGEX.exec(this.source))
            throw new Error("Invalid DGP formula syntax");
        this.index = REGEX.lastIndex;
    }

    private consumeBareI(): boolean {
        if (this.source[this.index] !== "i") return false;
        if (IDENTIFIER_PART.test(this.source[this.index + 1] ?? ""))
            return false;
        this.index++;
        return true;
    }

    // Comments too, as Blockly's "// Décrire cette fonction…".
    private skipSpace(): void {
        SPACE.lastIndex = this.index;
        SPACE.exec(this.source);
        this.index = SPACE.lastIndex;
    }

    // Primes too, as the editor names a point's image (A').
    private identifier(): Token {
        const start = this.index++;
        while (
            this.index < this.source.length &&
            (IDENTIFIER_PART.test(this.source[this.index]) ||
                this.source[this.index] === "'")
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

// Whether one of the objects of the figure being read has the name.
export const isFigureObject = (name: string) => objects.has(name);

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
    // being parsed, the first ones bound around the formula.
    private readonly outer: Set<string>[];
    // The functions built by Function(…) in the function or program being
    // parsed, declared at its start.
    private built: Statement[] = [];
    // The function being parsed, the names the program calls, and its
    // functions holding a regular expression, which none of them may be:
    // as DGPad figures' format(), whose regular expression is never run.
    private fn: string | null = null;
    // The loops holding the statement being parsed, in its function.
    private loops = 0;
    private readonly called = new Set<string>();
    private readonly unread = new Set<string>();

    constructor(source: string, variables: Iterable<string> = []) {
        this.outer = [new Set(variables)];
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
        for (const name of this.unread)
            if (this.called.has(name))
                throw new Error("Invalid DGP formula syntax");
        return { body: [...this.built, ...body], locals: this.locals };
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
                { kind: "loop", test, body: this.loopBody(), update: null },
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
                { kind: "loop", test, body: this.loopBody(), update },
            ];
        }
        if (this.loops > 0)
            for (const kind of ["break", "continue"] as const)
                if (this.skipKeyword(kind)) {
                    this.skip(";");
                    return [{ kind }];
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

    private loopBody(): Statement[] {
        this.loops++;
        const body = this.statement();
        this.loops--;
        return body;
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
        const built = this.built;
        this.built = [];
        const fn = this.fn;
        this.fn = name;
        const loops = this.loops;
        this.loops = 0;
        if (this.current.type !== "{")
            throw new Error("Invalid DGP formula syntax");
        const body = [...this.built, ...this.statement()];
        const locals = this.locals;
        this.locals = this.outer.pop()!;
        this.built = built;
        this.fn = fn;
        this.loops = loops;
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
        const { name, indices } = listItem(node);
        if (globalOf(name) === null) this.declare(name);
        return { kind: "assignItem", name, indices, value };
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
        // "k++", whose value is k's before the increment, as in
        // "for(i=0,j=n-1;i<n;j=i++)": (k=k+1)-1.
        if (
            (this.current.type === "++" || this.current.type === "--") &&
            node.kind === "identifier"
        ) {
            const [op, back] =
                this.current.type === "++" ? ["+", "-"] : ["-", "+"];
            this.advance();
            const one: FormulaNode = { kind: "number", value: 1 };
            return {
                kind: "binary",
                op: back as BinaryOp,
                left: this.assign(node.name, {
                    kind: "binary",
                    op: op as BinaryOp,
                    left: node,
                    right: one,
                }),
                right: one,
            };
        }
        return node;
    }

    private power(): FormulaNode {
        let base = this.primary();
        while (this.current.type === "[" || this.current.type === ".") {
            if (this.skip(".")) {
                const name = this.name();
                const property = this.property(base, name);
                if (property) base = property;
                else if (LIST_METHODS.has(name as ObjectMethod)) {
                    const { name: list, indices } = listItem(base);
                    this.take("(");
                    base = methodNode(list, name, this.arguments(), indices);
                } else throw new Error("Invalid DGP formula syntax");
                continue;
            }
            this.advance();
            base = { kind: "index", target: base, index: this.expression() };
            this.take("]");
        }
        while (this.skip("°")) base = { kind: "call", fn: "°", args: [base] };
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
            if (name === "Function" && (this.current.type as TokenType) === "(")
                return this.builtFunction();
            if ((this.current.type as TokenType) === "(")
                return this.call(name);
            if (this.skip(".")) return this.member(name);
            // "π" is DGPad's own notation for PI in slider bounds/formulas.
            if (name === "PI" || name === "π")
                return { kind: "constant", name: "PI" };
            if (name === "Infinity")
                return { kind: "constant", name: "INFINITY" };
            if (name === "NaN") return { kind: "number", value: NaN };
            // Blockly's empty input, 0 in JavaScript's arithmetic.
            if (name === "null") return { kind: "number", value: 0 };
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
        if (token.type === "/" && this.fn !== null) {
            this.lexer.skipRegex();
            this.advance();
            this.unread.add(this.fn);
            return { kind: "string", value: "" };
        }
        throw new Error("Invalid DGP formula syntax");
    }

    // JavaScript's Function("a,b", "…")(a, b), a script building a function
    // from its text: read here as one of its functions, which sees only the
    // figure's objects.
    private builtFunction(): FormulaNode {
        this.take("(");
        const [params, text] = this.arguments();
        if (params?.kind !== "string" || text?.kind !== "string")
            throw new Error("Invalid DGP formula syntax");
        const names = params.value.split(",").map((param) => param.trim());
        const parser = new FormulaParser(text.value);
        parser.locals = new Set(names);
        const { body, locals } = parser.parseProgram();
        // Not an identifier: no clash with the script's own names.
        const name = `Function ${this.built.length}`;
        this.locals.add(name);
        this.built.push({
            kind: "function",
            name,
            params: names,
            locals,
            body,
        });
        this.take("(");
        return { kind: "userCall", name, args: this.arguments() };
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
            if (
                name === "PI" ||
                name === "E" ||
                name === "SQRT2" ||
                name === "SQRT1_2"
            )
                return { kind: "constant", name };
            // Blockly's minimum or maximum of a list it builds:
            // Math.min.apply(null, [a, b]).
            if ((name === "min" || name === "max") && this.skip(".")) {
                if (this.name() !== "apply")
                    throw new Error("Invalid DGP formula syntax");
                this.take("(");
                const [, list, ...rest] = this.arguments();
                if (
                    list?.kind !== "vector" ||
                    !list.items.length ||
                    rest.length
                )
                    throw new Error("Invalid DGP formula syntax");
                return { kind: "call", fn: name, args: list.items };
            }
            return this.call(name);
        }
        const property = this.property(
            { kind: "identifier", name: object },
            name,
        );
        if (property) return property;
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

    // JavaScript's property or method of a text or list, if the name is one
    // of those read here.
    private property(target: FormulaNode, name: string): FormulaNode | null {
        switch (name) {
            case "length":
                return { kind: "length", target };
            case "join":
                return this.join(target);
            case "slice":
                return this.slice(target);
            case "toString":
                this.take("(");
                this.take(")");
                return {
                    kind: "binary",
                    op: "+",
                    left: { kind: "string", value: "" },
                    right: target,
                };
            case "split":
            case "reverse": {
                this.take("(");
                const args = [target, ...this.arguments()];
                if (args.length !== (name === "split" ? 2 : 1))
                    throw new Error("Invalid DGP formula syntax");
                return { kind: "native", fn: name, args };
            }
            // Only with a regular expression (see unread).
            case "replace":
                this.take("(");
                this.arguments();
                if (this.fn === null || !this.unread.has(this.fn))
                    throw new Error("Invalid DGP formula syntax");
                return target;
        }
        return null;
    }

    private join(target: FormulaNode): FormulaNode {
        this.take("(");
        const [separator = null, ...rest] = this.arguments();
        if (rest.length > 0) throw new Error("Invalid DGP formula syntax");
        return { kind: "join", target, separator };
    }

    private slice(target: FormulaNode): FormulaNode {
        this.take("(");
        const args = this.arguments();
        if (args.length > 2) throw new Error("Invalid DGP formula syntax");
        return { kind: "slice", target, args };
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
        // DGPad's Blockly globals, shared by the figure's programs: read as
        // an object, set as SET_EXP sets one.
        if (
            name === "GLOBAL_GET" ||
            name === "GLOBAL_SET" ||
            name === "GLOBAL_INC"
        ) {
            const [variable, value] = args;
            if (
                variable?.kind !== "string" ||
                args.length > (name === "GLOBAL_GET" ? 1 : 2) ||
                (name === "GLOBAL_SET" && !value)
            )
                throw new Error("Invalid DGP formula syntax");
            const global: FormulaNode = {
                kind: "identifier",
                name: globalName(variable.value),
            };
            if (name === "GLOBAL_GET") return global;
            return methodNode(global.name, "setExpression", [
                name === "GLOBAL_SET"
                    ? value
                    : {
                          kind: "binary",
                          op: "+",
                          left: global,
                          right: value ?? { kind: "number", value: 1 },
                      },
            ]);
        }
        if (name === "SET_EXP") {
            const [object, value] = args;
            if (args.length !== 2 || object.kind !== "string")
                throw new Error("Invalid DGP formula syntax");
            return methodNode(object.value, "setExpression", [value]);
        }
        // Blockly's coordinate of an object: Coordinate("A",1), y(A), or
        // A[2].
        if (name === "Coordinate") {
            const [object, index] = args;
            if (args.length !== 2 || object.kind !== "string")
                throw new Error("Invalid DGP formula syntax");
            const target: FormulaNode = {
                kind: "identifier",
                name: object.value,
            };
            return index.kind === "number" &&
                (index.value === 0 || index.value === 1)
                ? { kind: "call", fn: index.value ? "y" : "x", args: [target] }
                : { kind: "index", target, index };
        }
        // Blockly's form of a styling method: BLK_STL("S1","setHidden",[1]),
        // or BLK_STL(TURTLE_TEXT('dgpad_object_S1'),…) in a turtle's program.
        if (name === "BLK_STL") {
            const [named, method, list] = args;
            const object =
                named?.kind === "turtle" && named.fn === "TURTLE_TEXT"
                    ? named.args[0]
                    : named;
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
        // "f'(x)", f's derivative with respect to its variable, unless an
        // object has the name (see callFunction in expression_object.ts).
        const primes = /^(.+?)('+)$/.exec(name);
        if (primes && !objects.has(name) && !this.isLocal(name))
            return {
                kind: "derivative",
                name: primes[1],
                variables: [...primes[2]],
                args,
            };
        if (name === "parseInt" && args.length === 1)
            return { kind: "native", fn: name, args };
        if (!(name in FORMULA_ARITY)) {
            this.called.add(name);
            return { kind: "userCall", name, args };
        }
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

// "m[i][j]": an item of one of the script's own lists.
function listItem(node: FormulaNode): { name: string; indices: FormulaNode[] } {
    const indices: FormulaNode[] = [];
    while (node.kind === "index") {
        indices.unshift(node.index);
        node = node.target;
    }
    if (node.kind !== "identifier" || indices.length === 0)
        throw new Error("Invalid DGP formula syntax");
    return { name: node.name, indices };
}

function methodNode(
    object: string,
    name: string,
    args: FormulaNode[],
    indices: FormulaNode[] = [],
): FormulaNode {
    if (!(name in METHOD_ARITY)) throw new Error("Invalid DGP formula syntax");
    const method = name as ObjectMethod;
    const arity = METHOD_ARITY[method];
    if (arity >= 0 && args.length !== arity)
        throw new Error(`Invalid DGP method "${name}" arity`);
    return { kind: "method", object, method, args, indices };
}

// The text each parsed formula or program was read from, which a .dgo file
// stores rather than the tree.
const SOURCES = new WeakMap<FormulaNode | Program, string>();

// `variables`: the names a Sequence binds around it, "i" among them.
export function parseFormula(
    source: string,
    variables?: Iterable<string>,
): FormulaNode {
    const node = new FormulaParser(source, variables).parse();
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
        case "slice":
            return [node.target, ...node.args];
        case "native":
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
            return SKIPPED_METHODS.has(node.method)
                ? []
                : [...node.indices, ...node.args];
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
        case "break":
        case "continue":
            return [];
    }
}

// The names the statements read, but their variables: a function's hide
// the figure's objects only in its body.
function freeNames(
    statements: Statement[],
    locals: ReadonlySet<string>,
): string[] {
    return statements
        .flatMap((statement) => {
            switch (statement.kind) {
                case "function":
                    return freeNames(
                        statement.body,
                        new Set([...locals, ...statement.locals]),
                    );
                case "if":
                    return [
                        ...formulaIdentifiers(statement.test),
                        ...freeNames(
                            [...statement.then, ...statement.otherwise],
                            locals,
                        ),
                    ];
                case "loop":
                    return [
                        ...(statement.test
                            ? formulaIdentifiers(statement.test)
                            : []),
                        ...(statement.update
                            ? formulaIdentifiers(statement.update)
                            : []),
                        ...freeNames(statement.body, locals),
                    ];
                default:
                    return statementNodes(statement).flatMap((node) => [
                        ...formulaIdentifiers(node),
                    ]);
            }
        })
        .filter((name) => !locals.has(name));
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
        case "assignItem":
            return [node.name];
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
    return new Set(
        freeNames(
            program.body,
            new Set([...program.locals, ...ownTurtles(program)]),
        ),
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
                : node.kind === "assignItem" && globalOf(node.name) !== null
                  ? [node.name]
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
    // DGPad's restrictTheta and restrictPhi, which also turn the view as
    // they run, e.g. to make it spin with an animated number.
    restrictView?(angle: "THETA" | "PHI", range: ScriptValue | null): void;
    // Blockly's message, shown by a program run as a manipulation.
    alert?(message: ScriptValue | null): void;
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
export function formulaValue(value: ScriptValue | null): FormulaValue | null {
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
        // Two texts, as JavaScript compares them: "7" == "" is false.
        if (typeof l === "string" && typeof r === "string")
            return op === "&&" || op === "||"
                ? COMPARISONS[op](Number(l !== ""), Number(r !== ""))
                : COMPARISONS[op](Number(l > r) - Number(l < r), 0);
        const [a, b] = [realPart(l), realPart(r)];
        // A list, a real number's apart, never equals a number, as in
        // JavaScript: "v !== null" holds for a list v, null being 0 here.
        if (
            (op === "==" || op === "!=") &&
            (a === null) !== (b === null) &&
            typeof l !== "string" &&
            typeof r !== "string"
        )
            return Number(op === "!=");
        return a === null || b === null ? null : COMPARISONS[op](a, b);
    }
    if (typeof l === "string" || typeof r === "string")
        return op === "+" ? limited(String(l) + String(r)) : null;
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
        case "°": {
            const unit = angleUnit(env);
            return realUnary((x) => (x * Math.PI) / 180 / unit, args[0]);
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
        // Drawn again at each computation, as in DGPad.
        case "random":
            return Math.random();
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
        // P turned around O by an angle, its height kept in space.
        case "rotate": {
            const [p, o, a] = args;
            if (
                typeof p === "number" ||
                typeof o === "number" ||
                typeof a !== "number" ||
                p.length !== o.length
            )
                return null;
            const angle = a * angleUnit(env);
            const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
            const [dx, dy] = [p[0] - o[0], p[1] - o[1]];
            const x = o[0] + cos * dx - sin * dy;
            const y = o[1] + sin * dx + cos * dy;
            return p.length === 3 ? [x, y, p[2]] : [x, y];
        }
        // The image of P by the dilation of center O and ratio k.
        case "dilate": {
            const [p, o, k] = args;
            if (
                typeof p === "number" ||
                typeof o === "number" ||
                typeof k !== "number" ||
                p.length !== o.length
            )
                return null;
            return p.length === 3
                ? vAdd(vScale(vSub(p as Vec3, o as Vec3), k), o as Vec3)
                : vAdd(vScale(vSub(p as Vec2, o as Vec2), k), o as Vec2);
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
const MAX_STEPS = 50_000_000;
// Beyond it, a script's function calls are taken as endless, before they
// overflow the browser's stack.
const MAX_DEPTH = 1000;
// Beyond it, a list, a text or a turtle's drawing that a script builds is
// taken as built by an endless loop: well before its steps run out, its
// items would freeze the page, or exhaust its memory.
const MAX_LENGTH = 1_000_000;

class StepLimitExceeded extends Error {}

function limited<T extends ScriptValue>(value: T): T {
    if (
        (typeof value === "string" || Array.isArray(value)) &&
        value.length > MAX_LENGTH
    )
        throw new StepLimitExceeded();
    return value;
}

// An item set as JavaScript sets it, but only in the list or right after
// its last item: elsewhere, it would leave holes, undefined items.
function setItem(
    list: ScriptValue[],
    i: number,
    item: ScriptValue,
): ScriptValue | null {
    if (!Number.isInteger(i) || i < 0 || i > list.length) return null;
    list[i] = item;
    limited(list);
    return item;
}

// One evaluation of a compiled formula or program.
interface Frame {
    env: FormulaEnv;
    // The values of the program's own variables, by slot.
    slots: (ScriptValue | null)[];
    steps: number;
    depth: number;
    // The lists the script made or copied, which it changes in place: none
    // until it makes one.
    owned: Set<ScriptValue[]> | null;
    // Whether a return statement is leaving the function, and its value.
    returning: boolean;
    result: ScriptValue | null;
    // The break or continue statement leaving the loop's body.
    jump: "break" | "continue" | null;
    turtle: Turtle | null;
    // The decimal places a turtle writes numbers with, as a power of 10.
    precision: number;
    // The angle unit, read from the view at its first use (0 before).
    unit: number;
}

// Where the turtle is and which way it heads (u), its left (v) and its top
// (w), and what it has drawn so far.
export interface Turtle {
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
    if (frame.owned?.has(list as ScriptValue[])) return list as ScriptValue[];
    const copy = [...list];
    (frame.owned ??= new Set()).add(copy);
    return copy;
}

// One of the script's own lists, made its own.
function ownSlot(slot: number, frame: Frame): ScriptValue[] | null {
    const list = frame.slots[slot];
    return Array.isArray(list) ? (frame.slots[slot] = own(list, frame)) : null;
}

// The item at these indices of a list the script owns, made its own as are
// the lists holding it.
function ownItem(
    list: ScriptValue[] | null,
    indices: Code[],
    frame: Frame,
): ScriptValue[] | null {
    for (const index of indices) {
        const i = realPart(index(frame));
        if (!list || i === null) return null;
        const item = list[i];
        list = Array.isArray(item) ? (list[i] = own(item, frame)) : null;
    }
    return list;
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
        case "constant": {
            const value = CONSTANTS[node.name];
            return () => value;
        }
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
        // An item of a Blockly global's list, which DGPad's programs change
        // in place: the global set to the changed list.
        case "assignItem": {
            const { name } = node;
            const slot = scope.slots.get(name);
            const indices = node.indices.map(compile);
            const last = indices.pop()!;
            const value = compile(node.value);
            return (frame) => {
                const read =
                    slot === undefined && frame.env.resolveIdentifier(name);
                const global = Array.isArray(read) ? own(read, frame) : null;
                const list = ownItem(
                    slot === undefined ? global : ownSlot(slot, frame),
                    indices,
                    frame,
                );
                const index = realPart(last(frame));
                const item = value(frame);
                if (!list || index === null || item === null) return null;
                const set = setItem(list, index, item);
                if (global)
                    frame.env.callMethod?.(name, "setExpression", [global]);
                return set;
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
                    ? limited(list.join(String(sep)))
                    : null;
            };
        }
        case "slice": {
            const target = compile(node.target);
            const args = node.args.map(compile);
            return (frame) => {
                const list = target(frame);
                const bounds = args.map((arg) => realPart(arg(frame)));
                if (
                    !(typeof list === "string" || Array.isArray(list)) ||
                    bounds.includes(null)
                )
                    return null;
                const part = list.slice(...(bounds as number[]));
                if (Array.isArray(part)) (frame.owned ??= new Set()).add(part);
                return part;
            };
        }
        case "native": {
            const { fn } = node;
            const args = node.args.map(compile);
            return (frame) => {
                const values = evalCodes(args, frame);
                return values && nativeCall(fn, values, frame);
            };
        }
        case "turtle": {
            const { fn } = node;
            const args = node.args.map(compile);
            return (frame) => {
                const values = evalCodes(args, frame);
                const value = values && turtleCall(fn, values, frame);
                if (frame.turtle) limited(frame.turtle.tab);
                return value;
            };
        }
        case "method":
            return compileMethod(node, scope);
        case "vector": {
            const items = node.items.map(compile);
            return (frame) => {
                const values = evalCodes(items, frame);
                if (values) (frame.owned ??= new Set()).add(values);
                return values;
            };
        }
        case "binary":
            return binaryCode(node.op, compile(node.left), compile(node.right));
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
                    if (op) return evalBinary(op, values[0], values[1]);
                    if (fn === "ALERT") frame.env.alert?.(values[0]);
                    else
                        frame.env.restrictView?.(
                            fn === "restrictTheta" ? "THETA" : "PHI",
                            values[0],
                        );
                    return values[0];
                };
            }
            return callCode(fn as Exclude<FormulaFn, ListFn | "isNaN">, args);
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

// A list reversed in place if the script owns it, as JavaScript's.
function nativeCall(
    fn: NativeFn,
    [target, separator]: ScriptValue[],
    frame: Frame,
): ScriptValue | null {
    if (fn === "parseInt") return parseInt(String(target));
    if (fn === "reverse")
        return Array.isArray(target) ? own(target, frame).reverse() : null;
    if (typeof target !== "string") return null;
    const parts = target.split(String(separator));
    (frame.owned ??= new Set()).add(parts);
    return parts;
}

function slowBinary(
    op: BinaryOp,
    l: ScriptValue | null,
    r: ScriptValue | null,
): ScriptValue | null {
    // An undefined operand is JavaScript's NaN, which DGPad's compiled
    // scripts compare (e.g. "d(P,M)<0.001" is false).
    if (l === null || r === null)
        return isComparison(op)
            ? COMPARISONS[op](realPart(l) ?? NaN, realPart(r) ?? NaN)
            : null;
    return evalBinary(op, l, r);
}

// One closure per operator, its operation on two numbers written in it:
// shared, the call of the operation couldn't be inlined.
function binaryCode(op: BinaryOp, left: Code, right: Code): Code {
    const code =
        (numbers: (l: number, r: number) => number): Code =>
        (frame) => {
            const l = left(frame);
            const r = right(frame);
            return typeof l === "number" && typeof r === "number"
                ? numbers(l, r)
                : slowBinary(op, l, r);
        };
    switch (op) {
        case "+":
            return (frame) => {
                const l = left(frame);
                const r = right(frame);
                return typeof l === "number" && typeof r === "number"
                    ? l + r
                    : slowBinary(op, l, r);
            };
        case "-":
            return (frame) => {
                const l = left(frame);
                const r = right(frame);
                return typeof l === "number" && typeof r === "number"
                    ? l - r
                    : slowBinary(op, l, r);
            };
        case "*":
            return (frame) => {
                const l = left(frame);
                const r = right(frame);
                return typeof l === "number" && typeof r === "number"
                    ? l * r
                    : slowBinary(op, l, r);
            };
        case "/":
            return (frame) => {
                const l = left(frame);
                const r = right(frame);
                return typeof l === "number" && typeof r === "number"
                    ? l / r
                    : slowBinary(op, l, r);
            };
        case "<":
            return (frame) => {
                const l = left(frame);
                const r = right(frame);
                return typeof l === "number" && typeof r === "number"
                    ? Number(l < r)
                    : slowBinary(op, l, r);
            };
        case "<=":
            return (frame) => {
                const l = left(frame);
                const r = right(frame);
                return typeof l === "number" && typeof r === "number"
                    ? Number(l <= r)
                    : slowBinary(op, l, r);
            };
        case ">":
            return (frame) => {
                const l = left(frame);
                const r = right(frame);
                return typeof l === "number" && typeof r === "number"
                    ? Number(l > r)
                    : slowBinary(op, l, r);
            };
        case ">=":
            return (frame) => {
                const l = left(frame);
                const r = right(frame);
                return typeof l === "number" && typeof r === "number"
                    ? Number(l >= r)
                    : slowBinary(op, l, r);
            };
    }
    return code(isComparison(op) ? COMPARISONS[op] : ARITHMETIC[op]);
}

// The real functions of one number, applied straight to a finite one.
const REAL_FUNCTIONS: Partial<Record<FormulaFn, (x: number) => number>> = {
    abs: Math.abs,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    exp: Math.exp,
    log: Math.log,
};
const TRIGONOMETRIC: Partial<Record<FormulaFn, (x: number) => number>> = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
};
const INVERSE_TRIGONOMETRIC: Partial<Record<FormulaFn, (x: number) => number>> =
    {
        asin: Math.asin,
        acos: Math.acos,
        atan: Math.atan,
    };

function frameUnit(frame: Frame): number {
    return frame.unit || (frame.unit = angleUnit(frame.env));
}

// formulaValue's check alone: the value itself, which evalCall never
// changes, rather than a copy.
function checkedValue(value: ScriptValue): FormulaValue | null {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (!Array.isArray(value) || (value.length !== 2 && value.length !== 3))
        return null;
    for (const item of value)
        if (typeof item !== "number" || !Number.isFinite(item)) return null;
    return value as unknown as FormulaValue;
}

type UnaryCall = (frame: Frame, v: ScriptValue | null) => ScriptValue | null;

// What evalCall gives for one argument, with no list built for its most
// common uses: a function of a finite number, or a coordinate of a point.
function unaryCall(fn: Exclude<FormulaFn, ListFn | "isNaN">): UnaryCall | null {
    const isReal = (v: ScriptValue | null): v is number =>
        typeof v === "number" && Number.isFinite(v);
    const real = REAL_FUNCTIONS[fn];
    const trigonometric = TRIGONOMETRIC[fn];
    const inverse = INVERSE_TRIGONOMETRIC[fn];
    if (real)
        return (frame, v) => (isReal(v) ? real(v) : callValues(fn, [v], frame));
    if (fn === "sqrt")
        return (frame, v) =>
            isReal(v) && v >= 0 ? Math.sqrt(v) : callValues(fn, [v], frame);
    if (trigonometric)
        return (frame, v) =>
            isReal(v)
                ? trigonometric(v * frameUnit(frame))
                : callValues(fn, [v], frame);
    if (inverse)
        return (frame, v) =>
            isReal(v)
                ? inverse(v) / frameUnit(frame)
                : callValues(fn, [v], frame);
    if (fn === "x" || fn === "y") {
        const axis = fn === "x" ? 0 : 1;
        return (_, v) => {
            const point = v === null ? null : checkedValue(v);
            return point === null || typeof point === "number"
                ? null
                : point[axis];
        };
    }
    return null;
}

function callCode(
    fn: Exclude<FormulaFn, ListFn | "isNaN">,
    args: Code[],
): Code {
    const unary = args.length === 1 ? unaryCall(fn) : null;
    if (unary) {
        const [arg] = args;
        return (frame) => unary(frame, arg(frame));
    }
    return (frame) => {
        const values: (ScriptValue | null)[] = [];
        for (const code of args) {
            const value = code(frame);
            if (value === null) return null;
            values.push(value);
        }
        return callValues(fn, values, frame);
    };
}

function callValues(
    fn: Exclude<FormulaFn, ListFn | "isNaN">,
    values: (ScriptValue | null)[],
    frame: Frame,
): FormulaValue | null {
    const checked: FormulaValue[] = [];
    for (const value of values) {
        const v = value === null ? null : checkedValue(value);
        if (v === null) return null;
        checked.push(v);
    }
    return evalCall(fn, checked, frame.env);
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
                return limited(list.concat(...values));
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
    const indices = node.indices.map((index) => compileNode(index, scope));
    return (frame) => {
        const list =
            slot === undefined
                ? null
                : ownItem(ownSlot(slot, frame), indices, frame);
        const values = args.map((arg) => arg(frame));
        if (!list || values.includes(null)) return null;
        return listMethod(method, list, values as ScriptValue[]);
    };
}

function listMethod(
    method: ObjectMethod,
    list: ScriptValue[],
    values: ScriptValue[],
): ScriptValue | null {
    if (method === "pop") return list.pop() ?? null;
    if (method === "shift") return list.shift() ?? null;
    return limited(list).push(...values);
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
    return values && callScript(fn, values, frame);
}

function callScript(
    fn: ScriptFunction,
    values: ScriptValue[],
    frame: Frame,
): ScriptValue | null {
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

// The scope of a block that declares functions, their slots taken and their
// bodies compiled once they are all known: they can be called from anywhere
// in it, as JavaScript's.
function declareFunctions(
    statements: Statement[],
    scope: Scope,
    compile: (body: Statement[], scope: Scope) => Code,
): Scope {
    const declared = statements.filter(
        (statement) => statement.kind === "function",
    );
    if (declared.length === 0) return scope;
    const functions = new Map(scope.functions);
    const bodies = declared.map((statement) => {
        const slots = new Map(scope.slots);
        statement.locals.forEach((name) => slots.set(name, scope.size.value++));
        const fn: ScriptFunction = {
            params: statement.params.map((name) => slots.get(name)!),
            slots: [...statement.locals].map((name) => slots.get(name)!),
            body: () => null,
        };
        functions.set(statement.name, fn);
        return () => {
            fn.body = compile(statement.body, {
                slots,
                functions,
                size: scope.size,
            });
        };
    });
    bodies.forEach((compileBody) => compileBody());
    return { ...scope, functions };
}

// A block's value is its last statement's, null when it isn't an
// expression, or the value it returns.
function compileBlock(statements: Statement[], scope: Scope): Code {
    scope = declareFunctions(statements, scope, compileBlock);
    const codes = statements.map((statement) =>
        compileStatement(statement, scope),
    );
    return (frame) => {
        let value: ScriptValue | null = null;
        for (const code of codes) {
            step(frame);
            value = code(frame);
            if (frame.returning) return frame.result;
            if (frame.jump) return null;
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
        case "break":
        case "continue": {
            const { kind } = statement;
            return (frame) => {
                frame.jump = kind;
                return null;
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
                    const jump = frame.jump;
                    frame.jump = null;
                    if (jump === "break") return null;
                    update?.(frame);
                }
                return null;
            };
        }
    }
}

// *************************************************
// ************ Translation to JavaScript ***********
// *************************************************

// A program or formula that has run long enough is translated into
// JavaScript, much faster than its closures. Its code depends on the shape
// of the tree alone: the figure's names and texts, and the numbers that
// aren't finite, stay in its constants, which it reads by their index. It
// reads no global variable, only the helpers below, and reaches the items of
// lists by numeric indices alone. It counts its steps and its depth as the
// closures do, which remain the reference: it gives their results, runs
// them for the nodes it doesn't translate, and they run in its place on a
// page that forbids building JavaScript.

type Value = ScriptValue | null;

// What the translated code calls, all but the numbers' arithmetic and
// comparisons, which it writes itself.
const HELPERS = {
    slowBinary,
    truthy,
    realPart,
    negate,
    isArray: Array.isArray,
    pow: Math.pow,
    not: (v: Value): Value => {
        const real = realPart(v);
        return real === null ? null : Number(real === 0);
    },
    nan: (v: Value): Value => Number(v === null || Number.isNaN(v)),
    length: (v: Value): Value =>
        typeof v === "string" || Array.isArray(v) ? v.length : null,
    vector: (frame: Frame, values: ScriptValue[]): Value => {
        (frame.owned ??= new Set()).add(values);
        return values;
    },
    call: (
        fn: Exclude<FormulaFn, ListFn | "isNaN">,
        values: ScriptValue[],
        frame: Frame,
    ): Value => callValues(fn, values, frame),
    callScript,
    callEnv: (
        frame: Frame,
        name: string,
        values: ScriptValue[],
        derivatives: string[],
    ): Value => {
        const args = values.map(formulaValue);
        return args.includes(null)
            ? null
            : frame.env.callFunction!(
                  name,
                  args as FormulaValue[],
                  derivatives,
              );
    },
    ownSlot,
    setItem,
    // As an iteration of ownItem's loop.
    ownItemAt: (
        list: ScriptValue[],
        i: number,
        frame: Frame,
    ): ScriptValue[] | null => {
        const item = list[i];
        return Array.isArray(item) ? (list[i] = own(item, frame)) : null;
    },
    listMethod: (
        method: ObjectMethod,
        list: ScriptValue[] | null,
        values: Value[],
    ) =>
        !list || values.includes(null)
            ? null
            : listMethod(method, list, values as ScriptValue[]),
    stop: () => {
        throw new StepLimitExceeded();
    },
};

type Template = (a: string, b: string) => string;

// A comparison of two numbers, as a boolean: COMPARISONS' own.
const TESTS: Record<Comparison, Template> = {
    "==": (a, b) =>
        `(${a}===${b}||(${a}>${b}?${a}-${b}:${b}-${a})<${EQUALITY_PRECISION})`,
    "!=": (a, b) =>
        `!(${a}===${b}||(${a}>${b}?${a}-${b}:${b}-${a})<${EQUALITY_PRECISION})`,
    "<": (a, b) => `${a}<${b}`,
    "<=": (a, b) => `${a}<=${b}`,
    ">": (a, b) => `${a}>${b}`,
    ">=": (a, b) => `${a}>=${b}`,
    "&&": (a, b) => `truthy(${a})&&truthy(${b})`,
    "||": (a, b) => `truthy(${a})||truthy(${b})`,
};

// An operation on two numbers: ARITHMETIC's and COMPARISONS' own.
const OPERATIONS: Record<BinaryOp, Template> = {
    "+": (a, b) => `${a}+${b}`,
    "-": (a, b) => `${a}-${b}`,
    "*": (a, b) => `${a}*${b}`,
    "/": (a, b) => `${a}/${b}`,
    "%": (a, b) => `${a}%${b}`,
    "^": (a, b) => `pow(${a},${b})`,
    ...(Object.fromEntries(
        Object.entries(TESTS).map(([op, test]) => [
            op,
            (a: string, b: string) => `(${test(a, b)}?1:0)`,
        ]),
    ) as Record<Comparison, Template>),
};

const STEP = `if(++f.steps>${MAX_STEPS})stop();`;

// One function being translated: its constants and its temporary
// variables, each one a node's, so that a script's function calling itself
// has its own.
class Translation {
    private constants: unknown[] = [];
    private temps = 0;

    constant(value: unknown): string {
        return `K[${this.constants.push(value) - 1}]`;
    }

    temp(): string {
        return `t${this.temps++}`;
    }

    // A finite number as JavaScript reads it back, any other in the
    // constants.
    number(value: number): string {
        return Number.isFinite(value) ? `(${value})` : this.constant(value);
    }

    code(body: string): Code {
        const temps = Array.from({ length: this.temps }, (_, i) => `t${i}`);
        return new Function(
            "H",
            "K",
            `"use strict";const{${Object.keys(HELPERS)}}=H;return function(f){const S=f.slots;let v=null${temps.map((temp) => `,${temp}`).join("")};${body}}`,
        )(HELPERS, this.constants);
    }
}

// The values of the nodes, null as soon as one is, as evalCodes.
function translateValues(
    nodes: FormulaNode[],
    scope: Scope,
    t: Translation,
    then: (values: string) => string,
): string {
    const temps = nodes.map(() => t.temp());
    return nodes.reduceRight(
        (rest, node, k) =>
            `((${temps[k]}=${translateNode(node, scope, t)})===null?null:${rest})`,
        then(temps.join()),
    );
}

// Both operands, then the operation written for two numbers, slowBinary's
// for any other values.
function translateBinary(
    node: Extract<FormulaNode, { kind: "binary" }>,
    scope: Scope,
    t: Translation,
    numbers: Template,
    other: (value: string) => string,
): string {
    const [a, b] = [t.temp(), t.temp()];
    return `((${a}=${translateNode(node.left, scope, t)}),(${b}=${translateNode(node.right, scope, t)}),typeof ${a}==="number"&&typeof ${b}==="number"?${numbers(a, b)}:${other(`slowBinary(${t.constant(node.op)},${a},${b})`)})`;
}

// Whether the node's value is truthy, as a boolean.
function translateTest(
    node: FormulaNode,
    scope: Scope,
    t: Translation,
): string {
    if (node.kind === "binary" && isComparison(node.op))
        return translateBinary(
            node,
            scope,
            t,
            TESTS[node.op],
            (value) => `truthy(${value})`,
        );
    const v = t.temp();
    return `(typeof(${v}=${translateNode(node, scope, t)})==="number"?${v}!==0&&${v}===${v}:${v}!==null&&${v}!=="")`;
}

// The item of a list at an index, a number.
function translateItem(target: string, index: string, t: Translation) {
    const list = t.temp();
    return `(isArray(${list}=${target})?(${list}[${index}]??null):null)`;
}

function translateNode(
    node: FormulaNode,
    scope: Scope,
    t: Translation,
): string {
    const translate = (child: FormulaNode) => translateNode(child, scope, t);
    switch (node.kind) {
        case "number":
            return t.number(node.value);
        case "string":
            return t.constant(node.value);
        case "imaginary":
            return "[0,1]";
        case "constant":
            return t.number(CONSTANTS[node.name]);
        case "identifier": {
            const slot = scope.slots.get(node.name);
            return slot === undefined
                ? `f.env.resolveIdentifier(${t.constant(node.name)})`
                : `S[${slot}]`;
        }
        case "assign": {
            const slot = scope.slots.get(node.name);
            const value = translate(node.value);
            return slot === undefined ? value : `(S[${slot}]=${value})`;
        }
        case "conditional":
            return `(${translateTest(node.test, scope, t)}?${translate(node.then)}:${translate(node.otherwise)})`;
        case "unary": {
            if (node.op === "!") return `not(${translate(node.operand)})`;
            const v = t.temp();
            return `(typeof(${v}=${translate(node.operand)})==="number"?-${v}:${v}===null?null:negate(${v}))`;
        }
        case "index": {
            if (node.target.kind === "vector") break;
            if (node.index.kind === "number")
                return translateItem(
                    translate(node.target),
                    t.number(node.index.value),
                    t,
                );
            const i = t.temp();
            return `((${i}=${translate(node.index)}),typeof ${i}==="number"||(${i}=realPart(${i}))!==null?${translateItem(translate(node.target), i, t)}:null)`;
        }
        case "length":
            return `length(${translate(node.target)})`;
        // As ownItem, false once it has given up on the list.
        case "assignItem": {
            if (globalOf(node.name) !== null) break;
            const [list, i, value] = [t.temp(), t.temp(), t.temp()];
            const indices = node.indices
                .slice(0, -1)
                .map(
                    (index) =>
                        `${list}=${list}===false?false:((${i}=realPart(${translate(index)})),${list}===null||${i}===null?false:ownItemAt(${list},${i},f))`,
                );
            return `(${[
                `${list}=ownSlot(${scope.slots.get(node.name)!},f)`,
                ...indices,
                `${i}=realPart(${translate(node.indices[node.indices.length - 1])})`,
                `${value}=${translate(node.value)}`,
                `!${list}||${i}===null||${value}===null?null:setItem(${list},${i},${value})`,
            ].join(",")})`;
        }
        case "vector":
            return translateValues(
                node.items,
                scope,
                t,
                (values) => `vector(f,[${values}])`,
            );
        case "binary":
            return translateBinary(
                node,
                scope,
                t,
                OPERATIONS[node.op],
                (value) => value,
            );
        case "call": {
            const { fn } = node;
            if (fn === "isNaN") return `nan(${translate(node.args[0])})`;
            if (fn in LIST_OPERATORS) break;
            const unary =
                node.args.length === 1
                    ? unaryCall(fn as Exclude<FormulaFn, ListFn | "isNaN">)
                    : null;
            if (unary)
                return `${t.constant(unary)}(f,${translate(node.args[0])})`;
            return translateValues(
                node.args,
                scope,
                t,
                (values) => `call(${t.constant(fn)},[${values}],f)`,
            );
        }
        case "userCall":
        case "derivative": {
            const fn =
                node.kind === "userCall"
                    ? scope.functions.get(node.name)
                    : undefined;
            if (fn)
                return translateValues(
                    node.args,
                    scope,
                    t,
                    (values) => `callScript(${t.constant(fn)},[${values}],f)`,
                );
            const derivatives =
                node.kind === "derivative" ? node.variables : [];
            return `(f.env.callFunction?${translateValues(
                node.args,
                scope,
                t,
                (values) =>
                    `callEnv(f,${t.constant(node.name)},[${values}],${t.constant(derivatives)})`,
            )}:null)`;
        }
        case "method": {
            if (!LIST_METHODS.has(node.method) || node.indices.length > 0)
                break;
            const slot = scope.slots.get(node.object);
            const list = slot === undefined ? "null" : `ownSlot(${slot},f)`;
            return `listMethod(${t.constant(node.method)},${list},[${node.args.map(translate)}])`;
        }
    }
    return `${t.constant(compileNode(node, scope))}(f)`;
}

// The block's statements, the value of the last one in v at the top of a
// program or function: a return leaves the translated function at once, as
// it leaves the closures of every block holding it.
function translateBlock(
    statements: Statement[],
    scope: Scope,
    t: Translation,
    top: boolean,
): string {
    scope = declareFunctions(statements, scope, translateBody);
    return statements
        .map((statement) => {
            const value = (code: string) => (top ? `v=${code};` : `${code};`);
            const block = (body: Statement[]) =>
                translateBlock(body, scope, t, false);
            const node = (formula: FormulaNode) =>
                translateNode(formula, scope, t);
            switch (statement.kind) {
                case "expression":
                    return STEP + value(node(statement.node));
                case "function":
                    return STEP + value("null");
                case "return":
                    return `${STEP}f.result=${statement.node ? node(statement.node) : "null"};f.returning=true;return f.result;`;
                case "break":
                case "continue":
                    return `${STEP}${statement.kind};`;
                case "if":
                    return `${STEP}if(${translateTest(statement.test, scope, t)}){${block(statement.then)}}else{${block(statement.otherwise)}}${value("null")}`;
                // A for loop, whose continue still runs the update.
                case "loop":
                    return `${STEP}for(;${statement.test ? translateTest(statement.test, scope, t) : ""};${statement.update ? node(statement.update) : ""}){${STEP}${block(statement.body)}}${value("null")}`;
            }
        })
        .join("");
}

function translateBody(statements: Statement[], scope: Scope): Code {
    const t = new Translation();
    return t.code(`${translateBlock(statements, scope, t, true)}return v;`);
}

// Whether the page lets JavaScript be built.
let functionAllowed: boolean | undefined;
function canTranslate(): boolean {
    if (functionAllowed === undefined)
        try {
            new Function("");
            functionAllowed = true;
        } catch {
            functionAllowed = false;
        }
    return functionAllowed;
}

// The work, in steps and evaluations, after which a program or formula is
// translated: few for a script's loops, many for a formula, which only a
// curve or a script evaluates that often.
let TRANSLATE_AFTER = 1000;

// For the tests, which compare the translations (0) with the closures
// (Infinity).
export function translateAfter(work: number): void {
    TRANSLATE_AFTER = work;
}

interface Compiled {
    code: Code;
    size: number;
    work: number;
    translate: (() => Code) | null;
}

const COMPILED = new WeakMap<FormulaNode | Program, Compiled>();

// The turtle each program last drew, as it ended: the editor shows it.
const TURTLES = new WeakMap<Program, Turtle>();

export const programTurtle = (program: Program): Turtle | null =>
    TURTLES.get(program) ?? null;

function evaluate(compiled: Compiled, env: FormulaEnv, program?: Program) {
    if (
        compiled.translate &&
        compiled.work >= TRANSLATE_AFTER &&
        canTranslate()
    ) {
        compiled.code = compiled.translate();
        compiled.translate = null;
    }
    const frame: Frame = {
        env,
        slots: new Array<ScriptValue | null>(compiled.size).fill(null),
        steps: 0,
        depth: 0,
        owned: null,
        returning: false,
        result: null,
        jump: null,
        turtle: null,
        precision: 1e14,
        unit: 0,
    };
    let value: ScriptValue | null;
    try {
        value = compiled.code(frame);
    } catch (error) {
        // A RangeError: JavaScript's own limit on a text's length, which a
        // script reaches before MAX_LENGTH by joining long texts.
        if (error instanceof StepLimitExceeded || error instanceof RangeError)
            return null;
        throw error;
    }
    compiled.work += 1 + frame.steps;
    if (program && frame.turtle) TURTLES.set(program, frame.turtle);
    return value;
}

function programScope(program: Program): Scope {
    return {
        slots: new Map([...program.locals].map((name, i) => [name, i])),
        functions: new Map(),
        size: { value: program.locals.size },
    };
}

// The value of the program's last statement, as DGPad's: null when it
// isn't an expression, or when the program runs too long.
export function evaluateProgram(
    program: Program,
    env: FormulaEnv,
): ScriptValue | null {
    let compiled = COMPILED.get(program);
    if (!compiled) {
        const scope = programScope(program);
        const code = compileBlock(program.body, scope);
        compiled = {
            code,
            size: scope.size.value,
            work: 0,
            // Its own slots, the same as the closures'.
            translate: () => translateBody(program.body, programScope(program)),
        };
        COMPILED.set(program, compiled);
    }
    const value = evaluate(compiled, env, program);
    return typeof value === "number" && !Number.isFinite(value) ? null : value;
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
        const scope = {
            slots: new Map(),
            functions: new Map(),
            size: { value: 0 },
        };
        compiled = {
            code: compileNode(node, scope),
            size: 0,
            work: 0,
            translate: () => {
                const t = new Translation();
                return t.code(`return ${translateNode(node, scope, t)};`);
            },
        };
        COMPILED.set(node, compiled);
    }
    return formulaValue(evaluate(compiled, env));
}
