import { describe, expect, it } from "vitest";
import {
    casRequest,
    casTree,
    type CasFunction,
    type CasNode,
} from "../../src/import/cas_formula";
import {
    answerCas,
    casShown,
    evaluateValue,
    formulaIdentifiers,
    NO_VIEW,
    parseFormula,
    type FormulaEnv,
    type ScriptValue,
} from "../../src/import/dgp_formula";

const request = (
    source: string,
    degrees = false,
    functions: Record<string, CasFunction> = {},
) =>
    casRequest(
        parseFormula(source) as CasNode,
        degrees,
        (name) => functions[name] ?? null,
    )?.request ?? null;

// A function of the figure, `f(x) = a x^2` with a = 3.
const f: CasFunction = {
    node: parseFormula("a*x^2"),
    variables: ["x"],
    value: (node) => (node.kind === "identifier" ? 3 : null),
    functionOf: () => null,
};

describe("computer algebra requests", () => {
    it("writes the objects as symbols, numbers exact", () => {
        expect(request("Derivative(x^3+a*x)")).toBe(
            "regroup(diff((x^3)+(dg0*x),x))",
        );
        expect(request("Factor(x^2-0.25)")).toBe(
            "[with_sqrt(0),factor((x^2)-25/100,x),with_sqrt(1)][1]",
        );
        expect(request("IFactor(a^2-5)")).toBe("factor((dg0^2)-5,x)");
        expect(request("Expand((x+a)*(x-a))")).toBe("expand((x+dg0)*(x-dg0))");
        expect(request("Integral(1.5e-7*t)")).toBe(
            "regroup(integrate(15/100000000*t,t))",
        );
    });

    it("takes a variable, an order, Solve's equation", () => {
        expect(request("Derivative(x*y, y)")).toBe("regroup(diff(x*y,y))");
        expect(request("Derivative(x^3, 2)")).toBe("regroup(diff(x^3,x,2))");
        expect(request("Solve(x^2 = a)")).toBe("ggbsort(solve(x^2=dg0,x))");
        expect(request("Solve(x^2 - 2)")).toBe("ggbsort(solve((x^2)-2,x))");
        expect(request("CSolve(x^2 + 5)")).toBe("ggbsort(csolve((x^2)+5,x))");
    });

    it("keeps a part that reads no variable as a symbol, refuses one that does", () => {
        expect(request("Expand(x^2-d(A,B))")).toBe("expand((x^2)-dg0)");
        expect(request("Factor(floor(x))")).toBeNull();
    });

    it("writes a function of the figure in place of its name", () => {
        expect(request("Derivative(f)", false, { f })).toBe(
            "regroup(diff((dg0*(x^2)),x))",
        );
        expect(request("Derivative(f(2*x))", false, { f })).toBe(
            "regroup(diff((dg0*((2*x)^2)),x))",
        );
    });

    it("writes DGPad's degrees in radians", () => {
        expect(request("Derivative(sin(x))", true)).toBe(
            "regroup(diff(sin(x*pi/180),x))",
        );
    });

    it("binds the index of Sum, the variable of Limit and of a definite Integral", () => {
        expect(request("Sum(k^2, k, 1, n)")).toBe(
            "expand(sum(dk0^2,dk0,1,dg0))",
        );
        // An object of the index's name is not read.
        expect(request("Sum(x*k, k, 0, k)")).toBe(
            "expand(sum(x*dk0,dk0,0,dg0))",
        );
        expect(request("Limit(sin(x)/x, 0)")).toBe(
            "regroup(limit(sin(x)/x,x,0))",
        );
        expect(request("Limit((1+1/n)^n, n, ∞)")).toBe(
            "regroup(limit((1+(1/dk0))^dk0,dk0,inf))",
        );
        expect(request("Integral(x^2, 0, a)")).toBe(
            "regroup(integrate(x^2,x,0,dg0))",
        );
        expect(request("Integral(f(z)^2, z, 0, h)", false, { f })).toBe(
            "regroup(integrate((dg0*(dk0^2))^2,dk0,0,dg1))",
        );
        expect(request("Sum(k, k, 1)")).toBeNull();
        expect(request("Sum(floor(k), k, 1, 3)")).toBeNull();
        for (const [source, names] of [
            ["Sum(k^2, k, 1, n)", ["n"]],
            ["Limit(a/n, n, ∞)", ["a"]],
            ["Limit(x^2, a)", ["a"]],
            ["Integral(x^2, 0, a)", ["a"]],
            ["Integral(x*z, z, 0, 1)", ["x"]],
            ["Integral(x^2, x)", ["x"]],
        ] as const)
            expect(
                [...formulaIdentifiers(parseFormula(source))],
                source,
            ).toEqual(names);
    });

    it("writes the order of a Taylor polynomial by its value", () => {
        expect(request("TaylorPolynomial(exp(x), 0, 3)")).toBe(
            "convert(series(exp(x),x,0,3),polynom)",
        );
        expect(request("TaylorPolynomial(sin(t), t, a, 2)")).toBe(
            "convert(series(sin(t),t,dg0,2),polynom)",
        );
        const taylor = (order: ScriptValue | null) =>
            casRequest(
                parseFormula("TaylorPolynomial(f, 1, n)") as CasNode,
                false,
                (name) => (name === "f" ? f : null),
                undefined,
                () => order,
            )?.request ?? null;
        expect(taylor(4)).toBe("convert(series((dg0*(x^2)),x,1,4),polynom)");
        expect(taylor(2.5)).toBeNull();
        expect(taylor(null)).toBeNull();
    });

    it("writes the bounds of a sum by their value, when asked", () => {
        const sum = (bounds: boolean, n: ScriptValue | null = 4) =>
            casRequest(
                parseFormula("Sum(a / k, k, 1, n)") as CasNode,
                false,
                () => null,
                undefined,
                (part) => (part.kind === "identifier" ? n : null),
                bounds,
            )?.request ?? null;
        expect(sum(false)).toBe("expand(sum(dg0/dk0,dk0,1,dg1))");
        expect(sum(true)).toBe("expand(sum(dg0/dk0,dk0,1,4))");
        expect(sum(true, -2)).toBe("expand(sum(dg0/dk0,dk0,1,-2))");
        expect(sum(true, 2.5)).toBeNull();
    });

    it("binds Solve's unknown", () => {
        expect([...formulaIdentifiers(parseFormula("Solve(x^2 = a)"))]).toEqual(
            ["a"],
        );
        expect([
            ...formulaIdentifiers(parseFormula("CSolve(x^2 + a)")),
        ]).toEqual(["a"]);
    });
});

describe("Giac's answers", () => {
    const read = new Set(["x", "dg0"]);
    it("reads GeoGebra's forms", () => {
        for (const answer of [
            "3*x^2+dg0",
            "2*√x*x/3",
            "1/√(-x^2+1)",
            "list[-√2,√2]",
            "1/3*x^3*ln(x)-1/9*x^3",
            "1/3*(x^(1/3))^-2",
            "1/2*x^2*sign(x)",
            "i*x-1",
            "dg0*pi*exp(x)",
            "[]",
            "+infinity",
            "-infinity",
            "exp(1)",
        ])
            expect(casTree(answer, read, false), answer).not.toBeNull();
    });

    it("refuses what the formulas don't read", () => {
        for (const answer of [
            "undef",
            "sqrt(pi)/2*erf(x)",
            "y+1",
            "x:=2",
            "infinity",
            "Psi(dg0+1)+euler_gamma",
            "bounded_function(2)",
        ])
            expect(casTree(answer, read, false), answer).toBeNull();
    });
});

describe("computer algebra formulas", () => {
    it("compute Giac's answer with the objects' values, shown with their names", () => {
        const requests: string[] = [];
        answerCas((_site, request) => {
            requests.push(request);
            return request ===
                "[with_sqrt(0),factor((x^2)-(dg0^2),x),with_sqrt(1)][1]"
                ? "(x-dg0)*(x+dg0)"
                : undefined;
        }, () => null);
        const node = parseFormula("Factor(x^2-a^2)");
        const values: Record<string, ScriptValue> = { x: 5, a: 2 };
        const env: FormulaEnv = {
            resolveIdentifier: (name) => values[name],
            view: () => NO_VIEW,
        };
        expect(evaluateValue(node, env)).toBe(21);
        values.a = 3;
        expect(evaluateValue(node, env)).toBe(16);
        expect(new Set(requests).size).toBe(1);
        expect(casShown(node, String)).toBe("(x-a)*(x+a)");
        expect(evaluateValue(parseFormula("Expand(x)"), env)).toBeNull();
    });

    it("derive without Giac's answer, a function named alone too", () => {
        answerCas(() => undefined, () => null);
        const values: Record<string, ScriptValue> = { x: 2, a: 3 };
        const env: FormulaEnv = {
            resolveIdentifier: (name) => values[name],
            view: () => NO_VIEW,
            functionOf: (name) => (name === "f" ? f : null),
            // f(x) = a x^2: f'(x) = 2 a x.
            callFunction: (_name, [x], derivatives) =>
                derivatives.join() === "x" ? 6 * (x as number) : null,
        };
        expect(evaluateValue(parseFormula("Derivative(a*x^3, 2)"), env)).toBe(
            36,
        );
        expect(evaluateValue(parseFormula("Derivative(f)"), env)).toBe(12);
        expect(evaluateValue(parseFormula("Integral(x)"), env)).toBeNull();
    });
});
