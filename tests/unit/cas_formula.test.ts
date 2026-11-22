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
        expect(request("Derivative(x^3+a*x)")).toBe("regroup(diff((x^3)+(dg0*x),x))");
        expect(request("Factor(x^2-0.25)")).toBe("factor((x^2)-25/100)");
        expect(request("Expand((x+a)*(x-a))")).toBe("expand((x+dg0)*(x-dg0))");
        expect(request("Integral(1.5e-7*t)")).toBe(
            "regroup(integrate(15/100000000*t,t))",
        );
    });

    it("takes a variable, an order, Solve's equation", () => {
        expect(request("Derivative(x*y, y)")).toBe("regroup(diff(x*y,y))");
        expect(request("Derivative(x^3, 2)")).toBe("regroup(diff(x^3,x,2))");
        expect(request("Solve(x^2 = a)")).toBe("solve(x^2=dg0,x)");
        expect(request("Solve(x^2 - 2)")).toBe("solve((x^2)-2,x)");
    });

    it("keeps a part that reads no variable as a symbol, refuses one that does", () => {
        expect(request("Factor(x^2-d(A,B))")).toBe("factor((x^2)-dg0)");
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

    it("binds Solve's unknown", () => {
        expect([...formulaIdentifiers(parseFormula("Solve(x^2 = a)"))]).toEqual(
            ["a"],
        );
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
        ])
            expect(casTree(answer, read, false), answer).not.toBeNull();
    });

    it("refuses what the formulas don't read", () => {
        for (const answer of ["undef", "sqrt(pi)/2*erf(x)", "y+1", "x:=2"])
            expect(casTree(answer, read, false), answer).toBeNull();
    });
});

describe("computer algebra formulas", () => {
    it("compute Giac's answer with the objects' values, shown with their names", () => {
        const requests: string[] = [];
        answerCas((_site, request) => {
            requests.push(request);
            return request === "factor((x^2)-(dg0^2))"
                ? "(x-dg0)*(x+dg0)"
                : undefined;
        });
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
});
