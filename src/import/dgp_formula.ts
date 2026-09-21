import { IDENTIFIER_PART, IDENTIFIER_START } from "./dgp_parser";
import { vAdd, vNorm, vSub, type Vec2 } from "../vec";

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
    | "perp";

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
    perp: 1,
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
    | { kind: "unary"; op: "-"; operand: FormulaNode }
    | {
          kind: "binary";
          op: "+" | "-" | "*" | "/" | "^";
          left: FormulaNode;
          right: FormulaNode;
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
    | "("
    | ")"
    | ","
    | "eof";

interface Token {
    type: TokenType;
    value: string | number;
}

const NUMBER = /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/y;

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

        if ("+-*/^(),".includes(character)) {
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
        const node = this.additive();
        if (this.current.type !== "eof")
            throw new Error("Invalid DGP formula syntax");
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
        if (this.current.type === "-") {
            this.advance();
            return { kind: "unary", op: "-", operand: this.unary() };
        }
        return this.power();
    }

    private power(): FormulaNode {
        const base = this.primary();
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
            if (name === "PI") return { kind: "constant", name: "PI" };
            return { kind: "identifier", name };
        }
        if (token.type === "(") {
            this.advance();
            const node = this.additive();
            this.take(")");
            return node;
        }
        throw new Error("Invalid DGP formula syntax");
    }

    private call(name: string): FormulaNode {
        this.advance();
        const args: FormulaNode[] = [];
        if ((this.current.type as TokenType) !== ")") {
            args.push(this.additive());
            while ((this.current.type as TokenType) === ",") {
                this.advance();
                args.push(this.additive());
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

export type FormulaValue = number | Vec2;

export interface FormulaEnv {
    resolveIdentifier(name: string): Vec2 | null;
    pixelScale(): number;
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
export function realPart(value: FormulaValue | null): number | null {
    if (value === null) return null;
    if (typeof value === "number") return value;
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
    op: "+" | "-" | "*" | "/" | "^",
    l: FormulaValue,
    r: FormulaValue,
): FormulaValue | null {
    if (op === "^") {
        if (typeof l === "number" && typeof r === "number")
            return Math.pow(l, r);
        if (typeof l !== "number" && typeof r === "number")
            // A real base (an identifier holding a zero-imaginary Vec2, e.g.
            // a curve's x) goes through plain Math.pow: complexPow's polar
            // round-trip (cos/sin of an angle that's 0 or PI) leaves a tiny
            // nonzero imaginary residue even for a perfectly real result,
            // which realPart would then wrongly reject as complex.
            return l[1] === 0 ? Math.pow(l[0], r) : complexPow(l, r);
        return null;
    }
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
        }
    }
    const a: Vec2 = typeof l === "number" ? [l, 0] : l;
    const b: Vec2 = typeof r === "number" ? [r, 0] : r;
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
            if (typeof a === "number" || typeof b === "number") return null;
            return vNorm(vSub(a, b));
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
            return complexSqrt(a);
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
        case "perp": {
            const [a] = args;
            if (typeof a === "number") return null;
            const norm = Math.hypot(a[0], a[1]);
            return norm > 0 ? [-a[1] / norm, a[0] / norm] : null;
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
            return typeof value === "number" ? -value : [-value[0], -value[1]];
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
    return Number.isFinite(result[0]) && Number.isFinite(result[1])
        ? result
        : null;
}
