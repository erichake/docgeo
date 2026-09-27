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

// The only methods a script may call: reading an object, appending to one
// of its own lists, and styling the figure's objects.
export type ObjectMethod =
    | "coords2D"
    | "getX"
    | "getY"
    | "getName"
    | "push"
    | "setHidden"
    | "setOpacity"
    | "setRGBColor"
    | "setLayer"
    | "setDash"
    | "noMouseInside";

const READ_METHODS: ReadonlySet<ObjectMethod> = new Set([
    "coords2D",
    "getX",
    "getY",
    "getName",
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
const METHOD_ARITY: Record<ObjectMethod, number> = {
    coords2D: 0,
    getX: 0,
    getY: 0,
    getName: 0,
    push: -1,
    setHidden: 1,
    setOpacity: 1,
    setRGBColor: 3,
    setLayer: 1,
    setDash: 1,
    noMouseInside: 0,
};

type BinaryOp = "+" | "-" | "*" | "/" | "^" | Comparison;

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

const COMPARISONS: Record<Comparison, (a: number, b: number) => boolean> = {
    "==": (a, b) => Math.abs(a - b) < EQUALITY_PRECISION,
    "!=": (a, b) => Math.abs(a - b) >= EQUALITY_PRECISION,
    "<": (a, b) => a < b,
    "<=": (a, b) => a <= b,
    ">": (a, b) => a > b,
    ">=": (a, b) => a >= b,
    "&&": (a, b) => a !== 0 && b !== 0,
    "||": (a, b) => a !== 0 || b !== 0,
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

        if ("+-*/^(),[].".includes(character)) {
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
        if (node.kind !== "identifier")
            throw new Error("Invalid DGP formula syntax");
        this.advance();
        const value = this.expression();
        return this.assign(
            node.name,
            op ? { kind: "binary", op, left: node, right: value } : value,
        );
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
            this.startsImplicitFactor()
        ) {
            if (this.current.type === "*" || this.current.type === "/") {
                const op = this.current.type as "*" | "/";
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
        while (this.current.type === "[") {
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
            // Unless a script names one of its variables "i".
            if (name === "i" && !this.locals.has(name))
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
        if (!(name in FORMULA_ARITY)) return { kind: "userCall", name, args };
        const fn = name as FormulaFn;
        if (args.length !== FORMULA_ARITY[fn])
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
        case "binary":
            return [node.left, node.right];
        case "conditional":
            return [node.test, node.then, node.otherwise];
        case "assign":
            return [node.value];
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
            node.method !== "push" &&
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

function complexPow(a: Vec2, exponent: number): Vec2 {
    const r = Math.hypot(a[0], a[1]);
    const theta = Math.atan2(a[1], a[0]);
    const scaled = Math.pow(r, exponent);
    return [
        scaled * Math.cos(exponent * theta),
        scaled * Math.sin(exponent * theta),
    ];
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
        return a === null || b === null ? null : Number(COMPARISONS[op](a, b));
    }
    if (typeof l === "string" || typeof r === "string")
        return op === "+" ? String(l) + String(r) : null;
    if (typeof l === "number" && typeof r === "number") {
        switch (op) {
            case "+":
                return l + r;
            case "-":
                return l - r;
            case "*":
                return l * r;
            case "/":
                return l / r;
            case "^":
                return Math.pow(l, r);
        }
    }
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
            case "^":
                // A real base (e.g. [2, 0]) goes through plain Math.pow:
                // complexPow's polar round-trip (cos/sin of an angle that's
                // 0 or PI) leaves a tiny nonzero imaginary residue even for
                // a perfectly real result, which realPart would then
                // wrongly reject as complex.
                if (typeof r !== "number") return null;
                return a[1] === 0 ? Math.pow(a[0], r) : complexPow(a, r);
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
        case "d": {
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
        case "cross": {
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
    }
}

// Beyond it, a script's loops are taken as endless and its value is
// undefined.
const MAX_STEPS = 1_000_000;

class StepLimitExceeded extends Error {}

interface Scope {
    env: FormulaEnv;
    names: ReadonlySet<string>;
    locals: Map<string, ScriptValue | null>;
    steps: number;
    // The lists the script already appended to, which it now owns.
    grown: Set<ScriptValue[]>;
}

function truthy(value: ScriptValue | null): boolean {
    if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
    return value !== null && value !== "";
}

function evalArgs(nodes: FormulaNode[], scope: Scope): ScriptValue[] | null {
    return terms(nodes.length, (i) => evalNode(nodes[i], scope));
}

function evalNode(node: FormulaNode, scope: Scope): ScriptValue | null {
    switch (node.kind) {
        case "number":
        case "string":
            return node.value;
        case "imaginary":
            return [0, 1];
        case "constant":
            return Math.PI;
        case "identifier":
            return scope.names.has(node.name)
                ? (scope.locals.get(node.name) ?? null)
                : scope.env.resolveIdentifier(node.name);
        case "assign": {
            const value = evalNode(node.value, scope);
            scope.locals.set(node.name, value);
            return value;
        }
        case "conditional":
            return evalNode(
                truthy(evalNode(node.test, scope)) ? node.then : node.otherwise,
                scope,
            );
        case "unary": {
            const value = evalNode(node.operand, scope);
            if (value === null) return null;
            if (node.op === "-") return negate(value);
            const real = realPart(value);
            return real === null ? null : Number(real === 0);
        }
        case "index": {
            const index = realPart(evalNode(node.index, scope));
            if (index === null) return null;
            // Only the item read: the others may be undefined, e.g. in a list
            // of points.
            if (node.target.kind === "vector") {
                const item = node.target.items[index];
                return item ? evalNode(item, scope) : null;
            }
            const target = evalNode(node.target, scope);
            if (!Array.isArray(target)) return null;
            return target[index] ?? null;
        }
        case "method": {
            switch (node.method) {
                case "coords2D":
                    return scope.env.coords2D?.(node.object) ?? null;
                case "getName":
                    return node.object;
                case "getX":
                case "getY": {
                    const point = scope.env.resolveIdentifier(node.object);
                    return Array.isArray(point)
                        ? (point[node.method === "getX" ? 0 : 1] ?? null)
                        : null;
                }
            }
            if (SKIPPED_METHODS.has(node.method)) return null;
            const args = node.args.map((arg) => evalNode(arg, scope));
            if (node.method !== "push") {
                scope.env.callMethod?.(node.object, node.method, args);
                return null;
            }
            const list = scope.locals.get(node.object);
            if (!Array.isArray(list) || args.includes(null)) return null;
            // Copied once, as it may be another object's value, then
            // appended to in place: a copy per push would make building a
            // list of n terms (e.g. a sequence's) quadratic.
            let pushed = list as ScriptValue[];
            if (!scope.grown.has(pushed)) {
                pushed = [...list];
                scope.grown.add(pushed);
                scope.locals.set(node.object, pushed);
            }
            pushed.push(...(args as ScriptValue[]));
            return pushed.length;
        }
        case "vector":
            return evalArgs(node.items, scope);
        case "binary": {
            const left = evalNode(node.left, scope);
            const right = evalNode(node.right, scope);
            if (left === null || right === null) return null;
            return evalBinary(node.op, left, right);
        }
        case "call": {
            // Whether a point, e.g. an intersection, is undefined.
            if (node.fn === "isNaN") {
                const value = evalNode(node.args[0], scope);
                return Number(value === null || Number.isNaN(value));
            }
            const args = evalArgs(node.args, scope);
            if (args === null) return null;
            if (node.fn in LIST_OPERATORS) {
                const op = LIST_OPERATORS[node.fn as ListFn];
                return op ? evalBinary(op, args[0], args[1]) : args[0];
            }
            const values = args.map(formulaValue);
            if (values.includes(null)) return null;
            return evalCall(
                node.fn as Exclude<FormulaFn, ListFn | "isNaN">,
                values as FormulaValue[],
                scope.env,
            );
        }
        case "userCall": {
            if (!scope.env.callFunction) return null;
            const args = evalArgs(node.args, scope)?.map(formulaValue);
            if (!args || args.includes(null)) return null;
            return scope.env.callFunction(node.name, args as FormulaValue[]);
        }
    }
}

function step(scope: Scope): void {
    if (++scope.steps > MAX_STEPS) throw new StepLimitExceeded();
}

function run(statements: Statement[], scope: Scope): ScriptValue | null {
    let value: ScriptValue | null = null;
    for (const statement of statements) {
        step(scope);
        value = null;
        switch (statement.kind) {
            case "expression":
                value = evalNode(statement.node, scope);
                break;
            case "if":
                run(
                    truthy(evalNode(statement.test, scope))
                        ? statement.then
                        : statement.otherwise,
                    scope,
                );
                break;
            case "loop":
                while (
                    statement.test === null ||
                    truthy(evalNode(statement.test, scope))
                ) {
                    step(scope);
                    run(statement.body, scope);
                    if (statement.update) evalNode(statement.update, scope);
                }
                break;
        }
    }
    return value;
}

// The value of the program's last statement, as DGPad's: null when it
// isn't an expression, or when the program runs too long.
export function evaluateProgram(
    program: Program,
    env: FormulaEnv,
): ScriptValue | null {
    const scope: Scope = {
        env,
        names: program.locals,
        locals: new Map(),
        steps: 0,
        grown: new Set(),
    };
    try {
        const value = run(program.body, scope);
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
    return formulaValue(
        evalNode(node, {
            env,
            names: new Set(),
            locals: new Map(),
            steps: 0,
            grown: new Set(),
        }),
    );
}
