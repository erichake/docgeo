import { describe, expect, it } from "vitest";
import {
    evaluateFormula,
    formulaIdentifiers,
    parseFormula,
    type FormulaEnv,
} from "../../src/import/dgp_formula";

const noPoints: FormulaEnv = {
    resolveIdentifier: () => null,
    pixelScale: () => {
        throw new Error("pixel() not expected");
    },
};

function envWith(
    points: Record<string, [number, number] | null>,
    pixelScale = 40,
): FormulaEnv {
    return {
        resolveIdentifier: (name) => points[name] ?? null,
        pixelScale: () => pixelScale,
    };
}

describe("DGP formula parser", () => {
    it("parses arithmetic with standard precedence", () => {
        expect(parseFormula("1+2*3")).toEqual({
            kind: "binary",
            op: "+",
            left: { kind: "number", value: 1 },
            right: {
                kind: "binary",
                op: "*",
                left: { kind: "number", value: 2 },
                right: { kind: "number", value: 3 },
            },
        });
    });

    it("parses object references", () => {
        expect(parseFormula("A+5-i")).toEqual({
            kind: "binary",
            op: "-",
            left: {
                kind: "binary",
                op: "+",
                left: { kind: "identifier", name: "A" },
                right: { kind: "number", value: 5 },
            },
            right: { kind: "imaginary" },
        });
    });

    it("folds a numeric coefficient into i", () => {
        expect(parseFormula("3i")).toEqual({
            kind: "binary",
            op: "*",
            left: { kind: "number", value: 3 },
            right: { kind: "imaginary" },
        });
    });

    it("parses function calls and PI", () => {
        expect(parseFormula("d(A,E)")).toEqual({
            kind: "call",
            fn: "d",
            args: [
                { kind: "identifier", name: "A" },
                { kind: "identifier", name: "E" },
            ],
        });
        expect(parseFormula("10/pixel()")).toEqual({
            kind: "binary",
            op: "/",
            left: { kind: "number", value: 10 },
            right: { kind: "call", fn: "pixel", args: [] },
        });
        expect(parseFormula("sin(PI)")).toEqual({
            kind: "call",
            fn: "sin",
            args: [{ kind: "constant", name: "PI" }],
        });
    });

    it("parses the reference translation formula without throwing", () => {
        expect(() =>
            parseFormula(
                "(A+M1)/2+(10/(2*pixel()*d(A,M1)))*(M1-A)*(1+i*sqrt(3))",
            ),
        ).not.toThrow();
    });

    it.each([
        ["(1+2", "unbalanced parens"],
        ["foo(A)", "unknown function"],
        ["1 2", "trailing garbage"],
        ["d(A)", "wrong arity"],
    ])("rejects invalid syntax: %s (%s)", (source) => {
        expect(() => parseFormula(source)).toThrow();
    });
});

describe("formulaIdentifiers", () => {
    it("collects every referenced object name", () => {
        expect(
            formulaIdentifiers(
                parseFormula(
                    "(A+M1)/2+(10/(2*pixel()*d(A,M1)))*(M1-A)*(1+i*sqrt(3))",
                ),
            ),
        ).toEqual(new Set(["A", "M1"]));
        expect(formulaIdentifiers(parseFormula("2+3i"))).toEqual(new Set());
        expect(formulaIdentifiers(parseFormula("d(A,E)"))).toEqual(
            new Set(["A", "E"]),
        );
    });
});

describe("evaluateFormula", () => {
    it("evaluates real arithmetic", () => {
        expect(evaluateFormula(parseFormula("1+2*3"), noPoints)).toBe(7);
        expect(evaluateFormula(parseFormula("2^10"), noPoints)).toBe(1024);
    });

    it("evaluates complex arithmetic", () => {
        expect(evaluateFormula(parseFormula("2+3i"), noPoints)).toEqual([2, 3]);
        expect(evaluateFormula(parseFormula("(1+i)*(1-i)"), noPoints)).toEqual([
            2, 0,
        ]);
    });

    it("evaluates sqrt of a negative real as a complex result", () => {
        const [re, im] = evaluateFormula(
            parseFormula("sqrt(-4)"),
            noPoints,
        ) as [number, number];
        expect(re).toBeCloseTo(0);
        expect(im).toBeCloseTo(2);
        expect(evaluateFormula(parseFormula("sqrt(4)"), noPoints)).toBe(2);
    });

    it("evaluates a complex base raised to a real exponent", () => {
        const [re, im] = evaluateFormula(
            parseFormula("(1+i*sqrt(3))^2"),
            noPoints,
        ) as [number, number];
        expect(re).toBeCloseTo(-2);
        expect(im).toBeCloseTo(2 * Math.sqrt(3));
    });

    it("resolves object references and pixel()", () => {
        const env = envWith({ A: [1, 2], E: [4, 6] });
        expect(evaluateFormula(parseFormula("A+5-i"), env)).toEqual([6, 1]);
        expect(evaluateFormula(parseFormula("d(A,E)"), env)).toBe(5);
        expect(evaluateFormula(parseFormula("10/pixel()"), env)).toBe(0.25);
    });

    it("evaluates x()/y() and standard trig", () => {
        const env = envWith({ A: [3, 4] });
        expect(evaluateFormula(parseFormula("x(A)"), env)).toBe(3);
        expect(evaluateFormula(parseFormula("y(A)"), env)).toBe(4);
        expect(evaluateFormula(parseFormula("sin(0)"), env)).toBe(0);
        expect(evaluateFormula(parseFormula("cos(PI)"), env)).toBeCloseTo(-1);
    });

    it("propagates an undefined referenced point as null", () => {
        const env = envWith({ A: null });
        expect(evaluateFormula(parseFormula("A+1"), env)).toBeNull();
    });

    it("returns null on division by zero", () => {
        expect(evaluateFormula(parseFormula("1/0"), noPoints)).toBeNull();
        expect(evaluateFormula(parseFormula("(1+i)/0"), noPoints)).toBeNull();
    });

    it("returns null when a real-only function receives a complex argument", () => {
        expect(evaluateFormula(parseFormula("sin(1+i)"), noPoints)).toBeNull();
    });

    it("evaluates perp() as the unit perpendicular vector", () => {
        const env = envWith({ V: [3, 0] });
        const [px, py] = evaluateFormula(parseFormula("perp(V)"), env) as [
            number,
            number,
        ];
        expect(px).toBeCloseTo(0);
        expect(py).toBeCloseTo(1);
        const rotated = evaluateFormula(
            parseFormula("perp(V)"),
            envWith({ V: [1, 1] }),
        ) as [number, number];
        expect(Math.hypot(rotated[0], rotated[1])).toBeCloseTo(1);
        expect(rotated[0]).toBeCloseTo(-Math.SQRT1_2);
        expect(rotated[1]).toBeCloseTo(Math.SQRT1_2);
    });

    it("returns null for perp() of a zero vector", () => {
        expect(
            evaluateFormula(parseFormula("perp(V)"), envWith({ V: [0, 0] })),
        ).toBeNull();
    });
});
