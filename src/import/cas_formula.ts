import {
    formulaIdentifiers,
    parseFormula,
    withObjects,
    type FormulaNode,
    type ScriptValue,
} from "./dgp_formula";

// The computer algebra commands of the formulas (see CAS.md): Giac's
// request, built from the formula's tree, never from its text, and its
// answer, read by the formulas' grammar.

// Their arguments at most: what is computed, then a variable, then the
// order of a derivative.
export const CAS_ARITY = {
    Derivative: 3,
    Integral: 2,
    Factor: 1,
    Expand: 1,
    Simplify: 1,
    Solve: 2,
};
export type CasFn = keyof typeof CAS_ARITY;
// Of a command's name, undefined for another name.
export const casArity = (name: string): number | undefined =>
    Object.keys(CAS_ARITY).includes(name)
        ? CAS_ARITY[name as CasFn]
        : undefined;
export type CasNode = { kind: "cas"; fn: CasFn; args: FormulaNode[] };

const GIAC: Record<CasFn, string> = {
    Derivative: "diff",
    Integral: "integrate",
    Factor: "factor",
    Expand: "expand",
    Simplify: "simplify",
    Solve: "solve",
};

// The functions' variables (see FUNCTION_VARIABLES), symbols for Giac.
const VARIABLES = ["x", "y", "z", "t"];

const CALLS: Record<string, string> = {
    sqrt: "sqrt",
    abs: "abs",
    exp: "exp",
    log: "ln",
    sin: "sin",
    cos: "cos",
    tan: "tan",
    asin: "asin",
    acos: "acos",
    atan: "atan",
};
const TRIGONOMETRIC = new Set(["sin", "cos", "tan"]);
const INVERSE = new Set(["asin", "acos", "atan"]);

// A function-valued object, which a request writes in place of its name:
// its formula, the value of a part of it computed among its own objects,
// and the functions it calls.
export interface CasFunction {
    node: FormulaNode;
    variables: string[];
    value(node: FormulaNode): ScriptValue | null;
    functionOf(name: string): CasFunction | null;
}

// A part of the formula that no variable reads, Giac's symbol `dg<n>`:
// an object (`a`), or what Giac can't read (`d(A, B)`), in the function
// holding it, null for the formula's own.
export interface CasParameter {
    node: FormulaNode;
    owner: CasFunction | null;
}

export const SYMBOL = /^dg(\d+)$/;

interface Context {
    owner: CasFunction | null;
    functionOf: (name: string) => CasFunction | null;
    // Its function's variables, written as the call's arguments.
    variables: Map<string, string>;
}

const UNREAD = new Error("Not a computer algebra formula");

// Giac's request, objects kept as symbols: a slider dragged changes no
// request. Trigonometric functions in DGPad's degrees are written in
// radians. Null when Giac couldn't read it.
export function casRequest(
    node: CasNode,
    degrees: boolean,
    functionOf: (name: string) => CasFunction | null,
): { request: string; parameters: CasParameter[]; read: Set<string> } | null {
    const parameters: CasParameter[] = [];
    const symbols = new Map<string, string>();
    const read = new Set<string>();

    const parameter = (part: FormulaNode, context: Context): string => {
        const reading = formulaIdentifiers(part);
        if (
            (context.owner ? [...context.variables.keys()] : VARIABLES).some(
                (variable) => reading.has(variable),
            )
        )
            throw UNREAD;
        const key = part.kind === "identifier" ? part.name : null;
        const known = key !== null && symbols.get(key);
        if (known) return known;
        const symbol = `dg${parameters.length}`;
        parameters.push({ node: part, owner: context.owner });
        if (key !== null) symbols.set(key, symbol);
        read.add(symbol);
        return symbol;
    };

    const inline = (fn: CasFunction, args: string[]): string =>
        `(${write(fn.node, {
            owner: fn,
            functionOf: (name) => fn.functionOf(name),
            variables: new Map(
                fn.variables.map((variable, i) => [variable, args[i]]),
            ),
        })})`;

    const write = (part: FormulaNode, context: Context): string => {
        const next = (child: FormulaNode) => write(child, context);
        const operand = (child: FormulaNode) =>
            child.kind === "binary" || child.kind === "unary"
                ? `(${next(child)})`
                : next(child);
        switch (part.kind) {
            case "number":
                return Number.isFinite(part.value)
                    ? rational(part.value)
                    : parameter(part, context);
            case "imaginary":
                return "i";
            case "constant":
                return part.name === "PI"
                    ? "pi"
                    : part.name === "E"
                      ? "e"
                      : part.name === "INFINITY"
                        ? "inf"
                        : `sqrt(${part.name === "SQRT2" ? 2 : "1/2"})`;
            case "identifier": {
                const variable = context.variables.get(part.name);
                if (variable !== undefined)
                    return /^[\w.]+$/.test(variable)
                        ? variable
                        : `(${variable})`;
                if (!context.owner && VARIABLES.includes(part.name)) {
                    read.add(part.name);
                    return part.name;
                }
                const fn = context.functionOf(part.name);
                return fn && !context.owner
                    ? inline(
                          fn,
                          fn.variables.map((variable) => {
                              read.add(variable);
                              return variable;
                          }),
                      )
                    : parameter(part, context);
            }
            case "unary":
                return part.op === "-"
                    ? `-${operand(part.operand)}`
                    : parameter(part, context);
            case "binary": {
                if (part.op === "==")
                    return `${next(part.left)}=${next(part.right)}`;
                if (!"+-*/^".includes(part.op)) return parameter(part, context);
                return `${operand(part.left)}${part.op}${operand(part.right)}`;
            }
            case "call": {
                const giac = CALLS[part.fn];
                if (!giac) return parameter(part, context);
                const arg = next(part.args[0]);
                if (!degrees) return `${giac}(${arg})`;
                if (TRIGONOMETRIC.has(giac)) return `${giac}(${arg}*pi/180)`;
                return INVERSE.has(giac)
                    ? `(${giac}(${arg})*180/pi)`
                    : `${giac}(${arg})`;
            }
            case "userCall": {
                const fn = context.functionOf(part.name);
                return fn && fn.variables.length === part.args.length
                    ? inline(fn, part.args.map(next))
                    : parameter(part, context);
            }
            case "cas":
                return command(part, context);
        }
        return parameter(part, context);
    };

    const command = (part: CasNode, context: Context): string => {
        const [body, ...rest] = part.args;
        const text = write(body, context);
        let variable: string | undefined;
        let order = "";
        for (const arg of rest)
            if (arg.kind === "identifier" && VARIABLES.includes(arg.name))
                read.add((variable = arg.name));
            else if (
                part.fn === "Derivative" &&
                arg.kind === "number" &&
                Number.isInteger(arg.value) &&
                arg.value > 0
            )
                order = `,${arg.value}`;
            else throw UNREAD;
        variable ??= VARIABLES.find((name) => read.has(name)) ?? "x";
        if (CAS_ARITY[part.fn] === 1) return `${GIAC[part.fn]}(${text})`;
        const call = `${GIAC[part.fn]}(${text},${variable}${order})`;
        // As GeoGebra, whose diff doesn't gather its terms.
        return part.fn === "Solve" ? call : `regroup(${call})`;
    };

    try {
        const request = command(node, {
            owner: null,
            functionOf,
            variables: new Map(),
        });
        return { request, parameters, read };
    } catch (error) {
        if (error !== UNREAD) throw error;
        return null;
    }
}

// Exact, as GeoGebra sends its numbers: 0.1 is 1/10.
function rational(value: number): string {
    const [, digits, decimals = "", exponent = "0"] =
        /^(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(String(Math.abs(value)))!;
    const shift = Number(exponent) - decimals.length;
    const numerator = BigInt(digits + decimals).toString();
    const text =
        shift >= 0
            ? numerator + "0".repeat(shift)
            : `${numerator}/1${"0".repeat(-shift)}`;
    return value < 0 ? `(-${text})` : text;
}

const PRODUCT = (left: FormulaNode, right: FormulaNode): FormulaNode => ({
    kind: "binary",
    op: "*",
    left,
    right,
});
const DEGREES: FormulaNode = {
    kind: "binary",
    op: "/",
    left: { kind: "number", value: 180 },
    right: { kind: "constant", name: "PI" },
};
const RADIANS: FormulaNode = {
    kind: "binary",
    op: "/",
    left: { kind: "constant", name: "PI" },
    right: { kind: "number", value: 180 },
};

const TREES = new Map<string, FormulaNode | null>();

// Giac's answer as a formula of the request's variables and symbols,
// trigonometric functions back in DGPad's degrees; null for what the
// formulas' grammar doesn't read (`undef`, `erf(x)`…).
export function casTree(
    answer: string,
    read: Set<string>,
    degrees: boolean,
): FormulaNode | null {
    const key = `${+degrees}${answer}`;
    if (TREES.has(key)) return TREES.get(key)!;
    const tree = (part: FormulaNode): FormulaNode => {
        switch (part.kind) {
            case "number":
            case "constant":
            case "imaginary":
                return part;
            case "identifier":
                if (part.name === "pi") return { kind: "constant", name: "PI" };
                if (part.name === "e") return { kind: "constant", name: "E" };
                if (part.name === "inf")
                    return { kind: "constant", name: "INFINITY" };
                if (read.has(part.name)) return part;
                break;
            case "unary":
                if (part.op === "-")
                    return { ...part, operand: tree(part.operand) };
                break;
            case "binary":
                if ("+-*/^".includes(part.op))
                    return {
                        ...part,
                        left: tree(part.left),
                        right: tree(part.right),
                    };
                break;
            case "vector":
                return { kind: "vector", items: part.items.map(tree) };
            case "call": {
                if (!CALLS[part.fn]) break;
                const [arg] = part.args.map(tree);
                const call: FormulaNode = {
                    kind: "call",
                    fn: part.fn,
                    args: [arg],
                };
                if (!degrees) return call;
                if (TRIGONOMETRIC.has(part.fn))
                    return { ...call, args: [PRODUCT(arg, DEGREES)] };
                return INVERSE.has(part.fn) ? PRODUCT(call, RADIANS) : call;
            }
            case "userCall": {
                const [arg] = part.args.map(tree);
                if (part.args.length !== 1) break;
                if (part.name === "ln")
                    return { kind: "call", fn: "log", args: [arg] };
                // Of integrate(abs(x)).
                if (part.name === "sign")
                    return {
                        kind: "binary",
                        op: "/",
                        left: arg,
                        right: { kind: "call", fn: "abs", args: [arg] },
                    };
            }
        }
        throw UNREAD;
    };
    let node: FormulaNode | null;
    try {
        node = tree(
            withObjects(new Set(), () =>
                parseFormula(
                    answer
                        .replace(/list\[/g, "[")
                        .replace(/√(\(|[\w.]+)/g, (_, arg: string) =>
                            arg === "(" ? "sqrt(" : `sqrt(${arg})`,
                        ),
                ),
            ),
        );
    } catch {
        node = null;
    }
    TREES.set(key, node);
    return node;
}

// The answer as shown, with the names of the objects it reads, or the
// values of the other parameters.
export const casText = (answer: string, names: string[]): string =>
    answer
        .replace(/list\[/g, "[")
        .replace(/\bpi\b/g, "π")
        .replace(/\bdg(\d+)\b/g, (_, k: string) => names[+k]);
