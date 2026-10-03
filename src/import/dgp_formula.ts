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
    | "noMouseInside";

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
};

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
    | { kind: "unary"; op: "-" | "!"; operand: FormulaNode }
    // "P[1]": a component of a point's coordinates or of a list.
    | { kind: "index"; target: FormulaNode; index: FormulaNode }
    // "tab.length", "(P).length".
    | { kind: "length"; target: FormulaNode }
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
      };

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

class FormulaParser {
    private readonly lexer: FormulaLexer;
    private current: Token;
    readonly locals = new Set<string>();

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
        const node = this.expression();
        this.skip(";");
        return [{ kind: "expression", node }];
    }

    private declarations(): Statement[] {
        const statements: Statement[] = [];
        do {
            const name = this.current.value as string;
            this.take("identifier");
            this.locals.add(name);
            if (this.skip("="))
                statements.push({
                    kind: "expression",
                    node: { kind: "assign", name, value: this.expression() },
                });
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
        this.locals.add(target.name);
        return { kind: "assignItem", name: target.name, indices, value };
    }

    private assign(name: string, value: FormulaNode): FormulaNode {
        this.locals.add(name);
        return { kind: "assign", name, value };
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
                if (this.current.value !== "length")
                    throw new Error("Invalid DGP formula syntax");
                this.take("identifier");
                base = { kind: "length", target: base };
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
                !this.locals.has(name) &&
                !(this.current.type in ASSIGNMENTS)
            )
                return this.imaginary(1);
            // DGPad reads two adjacent function variables as a product.
            if (/^[xyzt]{2}$/.test(name) && !this.locals.has(name))
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
        const name = this.current.value as string;
        this.take("identifier");
        if (object === "Math") {
            if (name === "PI") return { kind: "constant", name: "PI" };
            return this.call(name);
        }
        if (name === "length")
            return {
                kind: "length",
                target: { kind: "identifier", name: object },
            };
        if (!(name in METHOD_ARITY))
            throw new Error("Invalid DGP formula syntax");
        const method = name as ObjectMethod;
        this.take("(");
        const args = this.arguments();
        const arity = METHOD_ARITY[method];
        if (arity >= 0 && args.length !== arity)
            throw new Error(`Invalid DGP method "${name}" arity`);
        return { kind: "method", object, method, args };
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

    private take(type: TokenType): void {
        if (!this.skip(type)) throw new Error("Invalid DGP formula syntax");
    }

    private advance(): void {
        this.current = this.lexer.next();
    }
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
    }
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
            return [node.name];
        case "method":
            return READ_METHODS.has(node.method) ? [node.object] : [];
        default:
            return [];
    }
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
        programNodes(program)
            .flatMap(nodeNames)
            .filter((name) => !program.locals.has(name)),
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
    return someNode(node, (n) => n.kind === "call" && VIEW_FUNCTIONS.has(n.fn));
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
    // arguments, e.g. "E1(x)"). Consumers that don't support calling named
    // objects (most formula owners) simply omit this.
    callFunction?(name: string, args: FormulaValue[]): FormulaValue | null;
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
    const real = realPart(arg);
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
const MAX_STEPS = 1_000_000;

class StepLimitExceeded extends Error {}

// One evaluation of a compiled formula or program.
interface Frame {
    env: FormulaEnv;
    // The values of the program's own variables, by slot.
    slots: (ScriptValue | null)[];
    steps: number;
    // The lists the script made or copied, which it changes in place.
    owned: Set<ScriptValue[]>;
}

// Formulas and programs are compiled once into closures, run at each
// evaluation: much faster than walking their tree, and never JavaScript
// built from the figure's text.
type Code = (frame: Frame) => ScriptValue | null;

// The slots of a program's own variables, by name.
type Slots = ReadonlyMap<string, number>;

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

function compileNode(node: FormulaNode, slots: Slots): Code {
    const compile = (child: FormulaNode) => compileNode(child, slots);
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
            const slot = slots.get(name);
            return slot === undefined
                ? (frame) => frame.env.resolveIdentifier(name)
                : (frame) => frame.slots[slot];
        }
        case "assign": {
            const slot = slots.get(node.name);
            const value = compile(node.value);
            return slot === undefined
                ? value
                : (frame) => (frame.slots[slot] = value(frame));
        }
        case "assignItem": {
            const slot = slots.get(node.name)!;
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
        case "method":
            return compileMethod(node, slots);
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
        case "userCall": {
            const { name } = node;
            const args = node.args.map(compile);
            return (frame) => {
                if (!frame.env.callFunction) return null;
                const values = evalCodes(args, frame)?.map(formulaValue);
                if (!values || values.includes(null)) return null;
                return frame.env.callFunction(name, values as FormulaValue[]);
            };
        }
    }
}

function compileMethod(
    node: Extract<FormulaNode, { kind: "method" }>,
    slots: Slots,
): Code {
    const { object, method } = node;
    const self = compileNode({ kind: "identifier", name: object }, slots);
    const args = node.args.map((arg) => compileNode(arg, slots));
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
    const slot = slots.get(object);
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

// A block's value is its last statement's, null when it isn't an
// expression.
function compileBlock(statements: Statement[], slots: Slots): Code {
    const codes = statements.map((statement) =>
        compileStatement(statement, slots),
    );
    return (frame) => {
        let value: ScriptValue | null = null;
        for (const code of codes) {
            step(frame);
            value = code(frame);
        }
        return value;
    };
}

function compileStatement(statement: Statement, slots: Slots): Code {
    switch (statement.kind) {
        case "expression":
            return compileNode(statement.node, slots);
        case "if": {
            const test = compileNode(statement.test, slots);
            const then = compileBlock(statement.then, slots);
            const otherwise = compileBlock(statement.otherwise, slots);
            return (frame) => {
                (truthy(test(frame)) ? then : otherwise)(frame);
                return null;
            };
        }
        case "loop": {
            const test = statement.test && compileNode(statement.test, slots);
            const update =
                statement.update && compileNode(statement.update, slots);
            const body = compileBlock(statement.body, slots);
            return (frame) => {
                while (!test || truthy(test(frame))) {
                    step(frame);
                    body(frame);
                    update?.(frame);
                }
                return null;
            };
        }
    }
}

const COMPILED = new WeakMap<FormulaNode | Program, Code>();

function evaluate(code: Code, slots: number, env: FormulaEnv) {
    return code({
        env,
        slots: new Array<ScriptValue | null>(slots).fill(null),
        steps: 0,
        owned: new Set(),
    });
}

// The value of the program's last statement, as DGPad's: null when it
// isn't an expression, or when the program runs too long.
export function evaluateProgram(
    program: Program,
    env: FormulaEnv,
): ScriptValue | null {
    let code = COMPILED.get(program);
    if (!code) {
        const slots = new Map([...program.locals].map((name, i) => [name, i]));
        code = compileBlock(program.body, slots);
        COMPILED.set(program, code);
    }
    try {
        const value = evaluate(code, program.locals.size, env);
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
    let code = COMPILED.get(node);
    if (!code) {
        code = compileNode(node, new Map());
        COMPILED.set(node, code);
    }
    return formulaValue(evaluate(code, 0, env));
}
