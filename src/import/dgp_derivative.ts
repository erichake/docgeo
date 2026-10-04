import type { FormulaFn, FormulaNode } from "./dgp_formula";

type BinaryNode = Extract<FormulaNode, { kind: "binary" }>;
type Arithmetic = "+" | "-" | "*" | "/" | "^";

const number = (value: number): FormulaNode => ({ kind: "number", value });
const ZERO = number(0);
const ONE = number(1);
const isNumber = (node: FormulaNode, value: number) =>
    node.kind === "number" && node.value === value;

const FOLD: Record<Arithmetic, (a: number, b: number) => number> = {
    "+": (a, b) => a + b,
    "-": (a, b) => a - b,
    "*": (a, b) => a * b,
    "/": (a, b) => a / b,
    "^": Math.pow,
};

// Simplified just enough for the derivatives of derivatives not to swell.
function binary(op: Arithmetic, left: FormulaNode, right: FormulaNode) {
    if (left.kind === "number" && right.kind === "number")
        return number(FOLD[op](left.value, right.value));
    switch (op) {
        case "+":
            if (isNumber(left, 0)) return right;
            if (isNumber(right, 0)) return left;
            break;
        case "-":
            if (isNumber(right, 0)) return left;
            if (isNumber(left, 0)) return negate(right);
            break;
        case "*":
            if (isNumber(left, 0) || isNumber(right, 0)) return ZERO;
            if (isNumber(left, 1)) return right;
            if (isNumber(right, 1)) return left;
            break;
        case "/":
            if (isNumber(left, 0)) return ZERO;
            if (isNumber(right, 1)) return left;
            break;
        case "^":
            if (isNumber(right, 0)) return ONE;
            if (isNumber(right, 1)) return left;
    }
    return { kind: "binary", op, left, right } satisfies BinaryNode;
}

const negate = (node: FormulaNode): FormulaNode =>
    node.kind === "number"
        ? number(-node.value)
        : { kind: "unary", op: "-", operand: node };

const call = (fn: FormulaFn, ...args: FormulaNode[]): FormulaNode => ({
    kind: "call",
    fn,
    args,
});

// In DGPad's degree mode, the trigonometric functions read and return
// degrees: π/180 then, 1 otherwise.
const ANGLE_UNIT = binary(
    "/",
    binary("/", { kind: "constant", name: "PI" }, number(2)),
    call("asin", ONE),
);

const NOT_DERIVABLE = new Error("Not derivable DGP formula");

// The derivative of a function formula with respect to one of its
// variables, as DGPad's dx, dy, dz and dt, or null when it has none (a
// list's length, a script's function…). `variablesOf` gives the variables of
// the function-valued objects it calls, null for the others.
export function derivative(
    node: FormulaNode,
    variable: string,
    variablesOf: (name: string) => string[] | null,
): FormulaNode | null {
    const derive = (node: FormulaNode): FormulaNode => {
        switch (node.kind) {
            case "number":
            case "imaginary":
            case "constant":
                return ZERO;
            case "identifier":
                return node.name === variable ? ONE : ZERO;
            case "unary":
                return node.op === "-" ? negate(derive(node.operand)) : ZERO;
            case "vector":
                return { kind: "vector", items: node.items.map(derive) };
            case "index":
                return { ...node, target: derive(node.target) };
            case "conditional":
                return {
                    ...node,
                    then: derive(node.then),
                    otherwise: derive(node.otherwise),
                };
            case "binary":
                return deriveBinary(node);
            case "call":
                return deriveCall(node.fn, node.args[0]);
            case "userCall":
                return chain(node.name, [], node.args);
            case "derivative":
                return chain(node.name, node.variables, node.args);
        }
        throw NOT_DERIVABLE;
    };

    const deriveBinary = ({ op, left: u, right: v }: BinaryNode) => {
        switch (op) {
            case "+":
            case "-":
                return binary(op, derive(u), derive(v));
            case "*":
                return binary(
                    "+",
                    binary("*", derive(u), v),
                    binary("*", u, derive(v)),
                );
            case "/":
                return binary(
                    "-",
                    binary("/", derive(u), v),
                    binary(
                        "/",
                        binary("*", u, derive(v)),
                        binary("^", v, number(2)),
                    ),
                );
            case "^": {
                const dv = derive(v);
                if (isNumber(dv, 0))
                    return binary(
                        "*",
                        binary("*", v, binary("^", u, binary("-", v, ONE))),
                        derive(u),
                    );
                return binary(
                    "*",
                    binary("^", u, v),
                    binary(
                        "+",
                        binary("*", dv, call("log", u)),
                        binary("/", binary("*", v, derive(u)), u),
                    ),
                );
            }
            case "%":
                throw NOT_DERIVABLE;
        }
        // A comparison, worth 1 or 0.
        return ZERO;
    };

    const deriveCall = (fn: FormulaFn, u: FormulaNode) => {
        const du = () => derive(u);
        const inverse = (denominator: FormulaNode) =>
            binary("/", du(), binary("*", ANGLE_UNIT, denominator));
        switch (fn) {
            case "sin":
                return binary(
                    "*",
                    binary("*", call("cos", u), ANGLE_UNIT),
                    du(),
                );
            case "cos":
                return negate(
                    binary("*", binary("*", call("sin", u), ANGLE_UNIT), du()),
                );
            case "tan":
                return binary(
                    "/",
                    binary("*", ANGLE_UNIT, du()),
                    binary("^", call("cos", u), number(2)),
                );
            case "asin":
            case "acos": {
                const d = inverse(
                    call("sqrt", binary("-", ONE, binary("^", u, number(2)))),
                );
                return fn === "asin" ? d : negate(d);
            }
            case "atan":
                return inverse(binary("+", ONE, binary("^", u, number(2))));
            case "sqrt":
                return binary(
                    "/",
                    du(),
                    binary("*", number(2), call("sqrt", u)),
                );
            case "abs":
                return binary("*", binary("/", u, call("abs", u)), du());
            case "exp":
                return binary("*", call("exp", u), du());
            case "log":
                return binary("/", du(), u);
            case "floor":
            case "ceil":
            case "round":
                return ZERO;
        }
        throw NOT_DERIVABLE;
    };

    // The derivative of the function `name`, or of its derivative along
    // `derivatives`, applied to `args`: the sum over its variables of its
    // partial derivative times the argument's derivative.
    const chain = (
        name: string,
        derivatives: string[],
        args: FormulaNode[],
    ): FormulaNode => {
        const variables = variablesOf(name);
        if (!variables) throw NOT_DERIVABLE;
        return variables.reduce(
            (sum, partial, i) =>
                binary(
                    "+",
                    sum,
                    binary(
                        "*",
                        {
                            kind: "derivative",
                            name,
                            variables: [...derivatives, partial],
                            args,
                        },
                        derive(args[i] ?? ZERO),
                    ),
                ),
            ZERO,
        );
    };

    try {
        return derive(node);
    } catch (error) {
        if (error !== NOT_DERIVABLE) throw error;
        return null;
    }
}
