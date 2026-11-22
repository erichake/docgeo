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
// order of a derivative, or the bounds of a sum or a definite integral, the
// point of a limit or of a Taylor polynomial and its order.
export const CAS_ARITY = {
    Derivative: 3,
    Integral: 4,
    Factor: 1,
    IFactor: 1,
    Expand: 1,
    Simplify: 1,
    Solve: 2,
    CSolve: 2,
    Sum: 4,
    Limit: 3,
    TaylorPolynomial: 4,
};
export type CasFn = keyof typeof CAS_ARITY;
// Of a command's name, undefined for another name.
export const casArity = (name: string): number | undefined =>
    Object.keys(CAS_ARITY).includes(name)
        ? CAS_ARITY[name as CasFn]
        : undefined;
export type CasNode = { kind: "cas"; fn: CasFn; args: FormulaNode[] };

// As GeoGebra's (Ggb2giac): `%` stands for the arguments. Factor doesn't
// write square roots, IFactor does (Giac's default, restored), Derivative
// and Integral gather their terms, solutions are sorted.
const GIAC: Record<CasFn, string> = {
    Derivative: "regroup(diff(%))",
    Integral: "regroup(integrate(%))",
    Factor: "[with_sqrt(0),factor(%),with_sqrt(1)][1]",
    IFactor: "factor(%)",
    Expand: "expand(%)",
    Simplify: "simplify(%)",
    Solve: "ggbsort(solve(%))",
    CSolve: "ggbsort(csolve(%))",
    Sum: "expand(sum(%))",
    Limit: "regroup(limit(%))",
    TaylorPolynomial: "convert(series(%),polynom)",
};

// The functions' variables (see FUNCTION_VARIABLES), symbols for Giac.
const VARIABLES = ["x", "y", "z", "t"];

// What a command binds, its answer not reading it: the unknown of Solve,
// the index of Sum, the variable of Limit and of a definite Integral, named
// or else any of the functions'.
export function casBound({ fn, args }: CasNode): string[] | null {
    const named = (count: number) =>
        args.length === count && args[1].kind === "identifier"
            ? [args[1].name]
            : VARIABLES;
    if (fn.endsWith("Solve")) return named(2);
    if (fn === "Sum" || fn === "Limit") return named(CAS_ARITY[fn]);
    return fn === "Integral" && args.length > 2 ? named(4) : null;
}

// Sum(e, k, a, b), Limit(e[, v], a), Integral(e[, v], a, b) and
// TaylorPolynomial(e[, v], a, n): their variable, if named, comes before
// their other arguments.
const BETWEEN = new Set<CasFn>(["Sum", "Limit", "TaylorPolynomial"]);

const CALLS: Record<string, string> = {
    sqrt: "sqrt",
    abs: "abs",
    // GeoGebra's abs, imported (see ggb_translate.ts).
    mod: "abs",
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

// A line of a computer algebra view that defines `a := …` or `f(x) := …`.
export const CAS_DEFINITION =
    /^\s*([\p{L}_][\p{L}\p{N}_]*)\s*(?:\(([^()]*)\))?\s*:=(.*)$/su;

interface Context {
    owner: CasFunction | null;
    functionOf: (name: string) => CasFunction | null;
    // Its function's variables, written as the call's arguments.
    variables: Map<string, string>;
}

const UNREAD = new Error("Not a computer algebra formula");

// Giac's request, objects kept as symbols: a slider dragged changes no
// request. Trigonometric functions in DGPad's degrees are written in
// radians. Null when Giac couldn't read it. A computer algebra view's line
// (see cas_view.ts) writes the values of the objects it reads (`valueOf`,
// null when Giac can't read them), its free variables (undefined) staying
// symbols. The order of a Taylor polynomial is written by its value
// (`valueOf`, or else `numberOf`): a slider gives the polynomials of its
// integers; so are the bounds of a sum when `bounds`, asked again so when
// it has no closed form.
export function casRequest(
    node: FormulaNode,
    degrees: boolean,
    functionOf: (name: string) => CasFunction | null,
    valueOf?: (part: FormulaNode) => string | null | undefined,
    numberOf?: (part: FormulaNode) => ScriptValue | null,
    bounds?: boolean,
): { request: string; parameters: CasParameter[]; read: Set<string> } | null {
    const parameters: CasParameter[] = [];
    const symbols = new Map<string, string>();
    const read = new Set<string>();
    let bound = 0;

    const parameter = (part: FormulaNode, context: Context): string => {
        const reading = formulaIdentifiers(part);
        if (
            [
                ...(context.owner ? [] : VARIABLES),
                ...context.variables.keys(),
            ].some((variable) => reading.has(variable))
        )
            throw UNREAD;
        const value = valueOf?.(part);
        if (value === null) throw UNREAD;
        if (value !== undefined) return value;
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
                // Named alone, of its variables, those of the function
                // holding it if any (`g(x) = Derivative(f)`).
                const fn = context.functionOf(part.name);
                return fn
                    ? inline(
                          fn,
                          fn.variables.map((variable) =>
                              context.owner
                                  ? write(
                                        { kind: "identifier", name: variable },
                                        context,
                                    )
                                  : (read.add(variable), variable),
                          ),
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

    // A variable named: of the functions', or free in a view's line.
    const free = (arg: FormulaNode, context: Context): string | null => {
        if (arg.kind !== "identifier") return null;
        if (VARIABLES.includes(arg.name)) {
            read.add(arg.name);
            return arg.name;
        }
        return valueOf && valueOf(arg) === undefined
            ? parameter(arg, context)
            : null;
    };
    const implicit = () =>
        VARIABLES.find((name) => read.has(name)) ??
        (valueOf && [...read].find((name) => SYMBOL.test(name))) ??
        "x";

    const between = (part: CasNode, context: Context): string => {
        const { fn, args } = part;
        const named = args.length === CAS_ARITY[fn];
        if (args.length < CAS_ARITY[fn] - (fn === "Sum" ? 0 : 1)) throw UNREAD;
        let inner = context;
        let variable: string | null | undefined;
        if (named && fn === "TaylorPolynomial") {
            variable = free(args[1], context);
            if (!variable) throw UNREAD;
        } else if (named) {
            if (args[1].kind !== "identifier") throw UNREAD;
            variable = `dk${bound++}`;
            inner = {
                ...context,
                variables: new Map([
                    ...context.variables,
                    [args[1].name, variable],
                ]),
            };
        }
        const body = write(args[0], inner);
        const rest = args.slice(named ? 2 : 1).map((arg, k, all) => {
            if (
                valueOf ||
                (fn === "TaylorPolynomial"
                    ? k < all.length - 1
                    : fn !== "Sum" || !bounds)
            )
                return write(arg, context);
            const value =
                arg.kind === "number"
                    ? arg.value
                    : context.owner
                      ? context.owner.value(arg)
                      : numberOf?.(arg);
            if (
                typeof value !== "number" ||
                !Number.isInteger(value) ||
                (value < 0 && fn !== "Sum")
            )
                throw UNREAD;
            return String(value);
        });
        return GIAC[fn].replace("%", () =>
            [body, variable ?? implicit(), ...rest].join(","),
        );
    };

    const command = (part: CasNode, context: Context): string => {
        if (
            BETWEEN.has(part.fn) ||
            (part.fn === "Integral" && part.args.length > 2)
        )
            return between(part, context);
        const [body, ...rest] = part.args;
        const text = write(body, context);
        let variable: string | undefined;
        let order = "";
        for (const arg of rest) {
            const named = free(arg, context);
            if (named) variable = named;
            else if (
                part.fn === "Derivative" &&
                arg.kind === "number" &&
                Number.isInteger(arg.value) &&
                arg.value > 0
            )
                order = `,${arg.value}`;
            else throw UNREAD;
        }
        variable ??= implicit();
        return GIAC[part.fn].replace("%", () =>
            part.fn === "Expand" || part.fn === "Simplify"
                ? text
                : `${text},${variable}${order}`,
        );
    };

    try {
        const context = { owner: null, functionOf, variables: new Map() };
        const request =
            node.kind === "cas" ? command(node, context) : write(node, context);
        return { request, parameters, read };
    } catch (error) {
        if (error !== UNREAD) throw error;
        return null;
    }
}

// Exact, as GeoGebra sends its numbers: 0.1 is 1/10.
export function rational(value: number): string {
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
                if (/^([-+*/^]|==)$/.test(part.op))
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
                        .replace(/([+-])infinity/g, (_, sign: string) =>
                            sign === "-" ? "-inf" : "inf",
                        )
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
        .replace(/\+?infinity/g, "∞")
        .replace(/\bdg(\d+)\b/g, (_, k: string) => names[+k]);
