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
    | "x"
    | "y"
    | "sin"
    | "cos"
    | "tan"
    | "asin"
    | "acos"
    | "atan"
    | "atan2"
    | "arg"
    | "perp"
    | "cross"
    | "dot";

const FORMULA_ARITY: Record<FormulaFn, number> = {
    sqrt: 1,
    d: 2,
    pixel: 0,
    x: 1,
    y: 1,
    sin: 1,
    cos: 1,
    tan: 1,
    asin: 1,
    acos: 1,
    atan: 1,
    atan2: 2,
    arg: 1,
    perp: 1,
    cross: 2,
    dot: 2,
};

export type FormulaNode =
    | { kind: "number"; value: number }
    | { kind: "imaginary" }
    | { kind: "constant"; name: "PI" }
    | { kind: "identifier"; name: string }
    | { kind: "call"; fn: FormulaFn; args: FormulaNode[] }
    // A call to a name that isn't one of the built-in FORMULA_ARITY
    // functions, e.g. "E1(x)" referencing another named Expression: resolved
    // at evaluation time through FormulaEnv.callFunction, not evalCall.
    | { kind: "userCall"; name: string; args: FormulaNode[] }
    | { kind: "unary"; op: "-" | "!"; operand: FormulaNode }
    // "P[1]": a component of a point's coordinates or of a vector.
    | { kind: "index"; target: FormulaNode; index: FormulaNode }
    // "P.coords2D()": where point P is drawn, in the window's coordinate
    // system, which changes with the 3D view.
    | { kind: "coords2D"; name: string }
    // A DGPad vector/point-displacement literal, e.g. "[-1,-1,1]": 2 or 3
    // real components, used to build 3D points (e.g. "P1+[-1,-1,1]").
    | { kind: "vector"; items: FormulaNode[] }
    | {
          kind: "binary";
          op: "+" | "-" | "*" | "/" | "^" | Comparison;
          left: FormulaNode;
          right: FormulaNode;
      };

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

type TokenType =
    | "number"
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
    | "eof";

interface Token {
    type: TokenType;
    value: string | number;
}

const NUMBER = /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/y;
const OPERATOR = /^(?:[=!<>]=|[<>!]|&&|\|\|)/;

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

        const operator = OPERATOR.exec(this.source.slice(this.index));
        if (operator) {
            this.index += operator[0].length;
            return { type: operator[0] as TokenType, value: operator[0] };
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
        const text = this.source.slice(start, this.index);
        if (text === "i") return { type: "imaginary", value: 1 };
        return { type: "identifier", value: text };
    }
}

class FormulaParser {
    private readonly lexer: FormulaLexer;
    private current: Token;

    constructor(source: string) {
        this.lexer = new FormulaLexer(source);
        this.current = this.lexer.next();
    }

    parse(): FormulaNode {
        const node = this.expression();
        if (this.current.type !== "eof")
            throw new Error("Invalid DGP formula syntax");
        return node;
    }

    private expression(): FormulaNode {
        return this.binaryLevel(["||"], () =>
            this.binaryLevel(["&&"], () =>
                this.binaryLevel(["==", "!="], () =>
                    this.binaryLevel(["<", "<=", ">", ">="], () =>
                        this.additive(),
                    ),
                ),
            ),
        );
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
            this.current.type === "identifier" ||
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
        return this.power();
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
        if (token.type === "imaginary") {
            this.advance();
            const coefficient = token.value as number;
            return coefficient === 1
                ? { kind: "imaginary" }
                : {
                      kind: "binary",
                      op: "*",
                      left: { kind: "number", value: coefficient },
                      right: { kind: "imaginary" },
                  };
        }
        if (token.type === "identifier") {
            this.advance();
            const name = token.value as string;
            if ((this.current.type as TokenType) === "(")
                return this.call(name);
            if ((this.current.type as TokenType) === ".") {
                this.advance();
                if (this.current.value !== "coords2D")
                    throw new Error("Invalid DGP formula syntax");
                this.advance();
                this.take("(");
                this.take(")");
                return { kind: "coords2D", name };
            }
            // "π" is DGPad's own notation for PI in slider bounds/formulas.
            if (name === "PI" || name === "π")
                return { kind: "constant", name: "PI" };
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

    private vector(): FormulaNode {
        this.advance();
        const items: FormulaNode[] = [this.expression()];
        while ((this.current.type as TokenType) === ",") {
            this.advance();
            items.push(this.expression());
        }
        this.take("]");
        if (items.length !== 2 && items.length !== 3)
            throw new Error("Invalid DGP formula syntax");
        return { kind: "vector", items };
    }

    private call(name: string): FormulaNode {
        this.advance();
        const args: FormulaNode[] = [];
        if ((this.current.type as TokenType) !== ")") {
            args.push(this.expression());
            while ((this.current.type as TokenType) === ",") {
                this.advance();
                args.push(this.expression());
            }
        }
        this.take(")");
        if (!(name in FORMULA_ARITY)) return { kind: "userCall", name, args };
        const fn = name as FormulaFn;
        if (args.length !== FORMULA_ARITY[fn])
            throw new Error(`Invalid DGP formula function "${name}" arity`);
        return { kind: "call", fn, args };
    }

    private take(type: TokenType): void {
        if (this.current.type !== type)
            throw new Error("Invalid DGP formula syntax");
        this.advance();
    }

    private advance(): void {
        this.current = this.lexer.next();
    }
}

export function parseFormula(source: string): FormulaNode {
    return new FormulaParser(source).parse();
}

export function formulaIdentifiers(node: FormulaNode): Set<string> {
    const names = new Set<string>();
    const walk = (n: FormulaNode): void => {
        switch (n.kind) {
            case "identifier":
                names.add(n.name);
                break;
            case "unary":
                walk(n.operand);
                break;
            case "vector":
                n.items.forEach(walk);
                break;
            case "index":
                walk(n.target);
                walk(n.index);
                break;
            case "coords2D":
                names.add(n.name);
                break;
            case "binary":
                walk(n.left);
                walk(n.right);
                break;
            case "call":
                n.args.forEach(walk);
                break;
            case "userCall":
                names.add(n.name);
                n.args.forEach(walk);
                break;
        }
    };
    walk(node);
    return names;
}

export function usesCoords2D(node: FormulaNode): boolean {
    switch (node.kind) {
        case "coords2D":
            return true;
        case "unary":
            return usesCoords2D(node.operand);
        case "index":
            return usesCoords2D(node.target) || usesCoords2D(node.index);
        case "binary":
            return usesCoords2D(node.left) || usesCoords2D(node.right);
        case "vector":
            return node.items.some(usesCoords2D);
        case "call":
        case "userCall":
            return node.args.some(usesCoords2D);
        default:
            return false;
    }
}

// A Vec3 only ever comes from a 3-item vector literal (e.g. "P1+[-1,-1,1]",
// a legacy-3D point displacement) or a point identifier resolved in that
// same 3D context; every other formula stays within number | Vec2 exactly
// as before.
export type FormulaValue = number | Vec2 | Vec3;

export interface FormulaEnv {
    resolveIdentifier(name: string): Vec2 | Vec3 | null;
    pixelScale(): number;
    coords2D?(name: string): Vec2 | null;
    // Resolves a userCall node (a name outside FORMULA_ARITY applied to
    // arguments, e.g. "E1(x)"). Consumers that don't support calling named
    // objects (most formula owners) simply omit this.
    callFunction?(name: string, args: FormulaValue[]): FormulaValue | null;
}

// Every identifier resolves through a Vec2-shaped slot (see FormulaEnv),
// so a real-valued result like "x^2" still comes back as a Vec2 with a
// zero imaginary part rather than a plain number. Real-only consumers
// (list counts, label values, real trig functions, curve samples) treat
// such a Vec2 as that real number, and reject a genuinely complex one.
// A Vec3 (a 3D point coordinate, never a "real number") always rejects.
export function realPart(value: FormulaValue | null): number | null {
    if (value === null) return null;
    if (typeof value === "number") return value;
    if (value.length === 3) return null;
    return value[1] === 0 ? value[0] : null;
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

function evalBinary(
    op: "+" | "-" | "*" | "/" | "^" | Comparison,
    l: FormulaValue,
    r: FormulaValue,
): FormulaValue | null {
    if (isComparison(op)) {
        const [a, b] = [realPart(l), realPart(r)];
        return a === null || b === null ? null : Number(COMPARISONS[op](a, b));
    }
    if (
        (typeof l !== "number" && l.length === 3) ||
        (typeof r !== "number" && r.length === 3)
    ) {
        // A 3D vector only adds to/subtracts from another one, or scales
        // by a real number: complex multiplication/division/power don't
        // generalize to 3D.
        const leftVector = typeof l !== "number" && l.length === 3;
        const scalar = realPart(leftVector ? r : l);
        if (scalar !== null && op === "*")
            return vScale((leftVector ? l : r) as Vec3, scalar);
        if (scalar !== null && op === "/" && leftVector)
            return vScale(l as Vec3, 1 / scalar);
        if (
            typeof l === "number" ||
            typeof r === "number" ||
            l.length !== 3 ||
            r.length !== 3 ||
            (op !== "+" && op !== "-")
        )
            return null;
        return op === "+" ? vAdd(l, r) : vSub(l, r);
    }
    // From here, l and r are number | Vec2 only (the 3D case above always
    // returns). Cast away the Vec3 arm TS can't otherwise rule out.
    const l2 = l as number | Vec2;
    const r2 = r as number | Vec2;
    if (op === "^") {
        if (typeof l2 === "number" && typeof r2 === "number")
            return Math.pow(l2, r2);
        if (typeof l2 !== "number" && typeof r2 === "number")
            // A real base (an identifier holding a zero-imaginary Vec2, e.g.
            // a curve's x) goes through plain Math.pow: complexPow's polar
            // round-trip (cos/sin of an angle that's 0 or PI) leaves a tiny
            // nonzero imaginary residue even for a perfectly real result,
            // which realPart would then wrongly reject as complex.
            return l2[1] === 0 ? Math.pow(l2[0], r2) : complexPow(l2, r2);
        return null;
    }
    if (typeof l2 === "number" && typeof r2 === "number") {
        switch (op) {
            case "+":
                return l2 + r2;
            case "-":
                return l2 - r2;
            case "*":
                return l2 * r2;
            case "/":
                return l2 / r2;
        }
    }
    const a: Vec2 = typeof l2 === "number" ? [l2, 0] : l2;
    const b: Vec2 = typeof r2 === "number" ? [r2, 0] : r2;
    switch (op) {
        case "+":
            return vAdd(a, b);
        case "-":
            return vSub(a, b);
        case "*":
            return complexMul(a, b);
        case "/":
            return complexDiv(a, b);
    }
}

function realUnary(
    fn: (x: number) => number,
    arg: FormulaValue,
): number | null {
    const real = realPart(arg);
    return real === null ? null : fn(real);
}

function evalCall(
    fn: FormulaFn,
    args: FormulaValue[],
    env: FormulaEnv,
): FormulaValue | null {
    switch (fn) {
        case "pixel":
            return env.pixelScale();
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
            return realUnary(Math.sin, args[0]);
        case "cos":
            return realUnary(Math.cos, args[0]);
        case "tan":
            return realUnary(Math.tan, args[0]);
        case "asin":
            return realUnary(Math.asin, args[0]);
        case "acos":
            return realUnary(Math.acos, args[0]);
        case "atan":
            return realUnary(Math.atan, args[0]);
        case "atan2": {
            const [a, b] = args;
            const ra = realPart(a);
            const rb = realPart(b);
            return ra === null || rb === null ? null : Math.atan2(ra, rb);
        }
        // DGPad's arg, within [0, 2π).
        case "arg": {
            const [a] = args;
            if (typeof a !== "number" && a.length === 3) return null;
            const [x, y] = typeof a === "number" ? [a, 0] : a;
            const angle = Math.atan2(y, x);
            return angle < 0 ? angle + 2 * Math.PI : angle;
        }
        case "perp": {
            const [a] = args;
            if (typeof a === "number") return null;
            const norm = Math.hypot(a[0], a[1]);
            return norm > 0 ? [-a[1] / norm, a[0] / norm] : null;
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

function evalNode(node: FormulaNode, env: FormulaEnv): FormulaValue | null {
    switch (node.kind) {
        case "number":
            return node.value;
        case "imaginary":
            return [0, 1];
        case "constant":
            return Math.PI;
        case "identifier":
            return env.resolveIdentifier(node.name);
        case "unary": {
            const value = evalNode(node.operand, env);
            if (value === null) return null;
            if (node.op === "!") {
                const real = realPart(value);
                return real === null ? null : Number(real === 0);
            }
            if (typeof value === "number") return -value;
            return value.length === 3
                ? [-value[0], -value[1], -value[2]]
                : [-value[0], -value[1]];
        }
        case "index": {
            const target = evalNode(node.target, env);
            const index = realPart(evalNode(node.index, env));
            if (target === null || typeof target === "number" || index === null)
                return null;
            return target[index] ?? null;
        }
        case "coords2D":
            return env.coords2D?.(node.name) ?? null;
        case "vector": {
            const values: number[] = [];
            for (const item of node.items) {
                const real = realPart(evalNode(item, env));
                if (real === null) return null;
                values.push(real);
            }
            return values.length === 3
                ? [values[0], values[1], values[2]]
                : [values[0], values[1]];
        }
        case "binary": {
            const left = evalNode(node.left, env);
            const right = evalNode(node.right, env);
            if (left === null || right === null) return null;
            return evalBinary(node.op, left, right);
        }
        case "call": {
            const args: FormulaValue[] = [];
            for (const argNode of node.args) {
                const value = evalNode(argNode, env);
                if (value === null) return null;
                args.push(value);
            }
            return evalCall(node.fn, args, env);
        }
        case "userCall": {
            if (!env.callFunction) return null;
            const args: FormulaValue[] = [];
            for (const argNode of node.args) {
                const value = evalNode(argNode, env);
                if (value === null) return null;
                args.push(value);
            }
            return env.callFunction(node.name, args);
        }
    }
}

// Never throws: any domain failure (an undefined referenced point, division
// by zero, a non-finite result, a real-only function given a complex
// argument, a complex base with a complex exponent) surfaces as null.
export function evaluateFormula(
    node: FormulaNode,
    env: FormulaEnv,
): FormulaValue | null {
    const result = evalNode(node, env);
    if (result === null) return null;
    if (typeof result === "number")
        return Number.isFinite(result) ? result : null;
    return result.every(Number.isFinite) ? result : null;
}
