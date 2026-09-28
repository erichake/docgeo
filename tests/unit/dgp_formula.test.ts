import { describe, expect, it } from "vitest";
import {
    evaluateFormula,
    evaluateProgram,
    formulaIdentifiers,
    NO_VIEW,
    parseFormula,
    parseProgram,
    programReferences,
    programTargets,
    type FormulaEnv,
    type FormulaView,
} from "../../src/import/dgp_formula";

const noPoints: FormulaEnv = {
    resolveIdentifier: () => null,
    view: () => NO_VIEW,
};

function envWith(
    points: Record<string, [number, number] | null>,
    view: FormulaView = { ...NO_VIEW, unit: 40 },
): FormulaEnv {
    return {
        resolveIdentifier: (name) => points[name] ?? null,
        view: () => view,
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
        ["1 2", "trailing garbage"],
        ["d(A)", "wrong arity"],
    ])("rejects invalid syntax: %s (%s)", (source) => {
        expect(() => parseFormula(source)).toThrow();
    });

    it("parses implicit multiplication", () => {
        expect(parseFormula("0.5x^2-4")).toEqual({
            kind: "binary",
            op: "-",
            left: {
                kind: "binary",
                op: "*",
                left: { kind: "number", value: 0.5 },
                right: {
                    kind: "binary",
                    op: "^",
                    left: { kind: "identifier", name: "x" },
                    right: { kind: "number", value: 2 },
                },
            },
            right: { kind: "number", value: 4 },
        });
        expect(parseFormula("2(x+1)")).toEqual({
            kind: "binary",
            op: "*",
            left: { kind: "number", value: 2 },
            right: {
                kind: "binary",
                op: "+",
                left: { kind: "identifier", name: "x" },
                right: { kind: "number", value: 1 },
            },
        });
        expect(parseFormula("sin(xy)")).toEqual({
            kind: "call",
            fn: "sin",
            args: [
                {
                    kind: "binary",
                    op: "*",
                    left: { kind: "identifier", name: "x" },
                    right: { kind: "identifier", name: "y" },
                },
            ],
        });
    });

    it("parses a call to a name outside the built-in functions as userCall", () => {
        expect(parseFormula("E1(x)")).toEqual({
            kind: "userCall",
            name: "E1",
            args: [{ kind: "identifier", name: "x" }],
        });
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
        expect(formulaIdentifiers(parseFormula("E1(x)+1"))).toEqual(
            new Set(["E1", "x"]),
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

    it("reads the window size and center in units", () => {
        const env = envWith(
            {},
            {
                ...NO_VIEW,
                unit: 20,
                origin: [100, 300],
                width: 800,
                height: 400,
            },
        );
        const value = (source: string) =>
            evaluateFormula(parseFormula(source), env);
        expect(value("windoww()")).toBe(40);
        expect(value("windowh()")).toBe(20);
        expect(value("windowcx()")).toBe(15);
        expect(value("windowcy()")).toBe(5);
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

    it("evaluates real trig functions of a real-valued (zero-imaginary) identifier", () => {
        // A real number written as a complex number with no imaginary
        // part (see realPart) is as good as a raw number.
        const env = envWith({ x: [Math.PI, 0] });
        expect(evaluateFormula(parseFormula("sin(x)"), env)).toBeCloseTo(0);
        expect(evaluateFormula(parseFormula("cos(x)"), env)).toBeCloseTo(-1);
        expect(
            evaluateFormula(parseFormula("atan2(x,x)"), envWith({ x: [1, 0] })),
        ).toBeCloseTo(Math.PI / 4);
    });

    it("calls a userCall node through FormulaEnv.callFunction", () => {
        const env: FormulaEnv = {
            resolveIdentifier: (name) => (name === "x" ? [5, 0] : null),
            view: () => NO_VIEW,
            callFunction: (name, args) =>
                name === "double" && typeof args[0] !== "number"
                    ? [2 * args[0][0], 0]
                    : null,
        };
        expect(evaluateFormula(parseFormula("double(x)+1"), env)).toEqual([
            11, 0,
        ]);
    });

    it("returns null for a userCall when the env doesn't support callFunction", () => {
        expect(evaluateFormula(parseFormula("E1(x)"), noPoints)).toBeNull();
    });

    it("evaluates comparisons and logical operators to 1 or 0", () => {
        const env = envWith({ a: [3 * 0.1, 0] });
        const value = (source: string) =>
            evaluateFormula(parseFormula(source), env);
        expect(value("a==0.3")).toBe(1);
        expect(value("a!=0.3")).toBe(0);
        expect(value("1+1<=2 && 2>3 || a>=0.3")).toBe(1);
        expect(value("(a<0)*5+(a>0)*7")).toBe(7);
        expect(value("[1,2]==1")).toBeNull();
    });

    it("evaluates logical negation", () => {
        const env = envWith({ n: [3, 0] });
        const value = (source: string) =>
            evaluateFormula(parseFormula(source), env);
        expect(value("!(n==3 || n==4)")).toBe(0);
        expect(value("!(n>5)")).toBe(1);
        expect(value("n!=3")).toBe(0);
    });

    it("reads a component of a point with P[i]", () => {
        const env: FormulaEnv = {
            resolveIdentifier: (name) => (name === "P" ? [1, 2, 3] : null),
            view: () => NO_VIEW,
        };
        const value = (source: string) =>
            evaluateFormula(parseFormula(source), env);
        expect(value("P[0]*P[1]^2+P[2]")).toBe(7);
        expect(value("P[3]")).toBeNull();
        expect(formulaIdentifiers(parseFormula("P[0]+Q[1]"))).toEqual(
            new Set(["P", "Q"]),
        );
    });

    it("reads where a point is drawn with P.coords2D(), and its arg within [0, 2π)", () => {
        const env: FormulaEnv = {
            resolveIdentifier: () => null,
            view: () => NO_VIEW,
            coords2D: (name) =>
                ({ A: [1, 0], B: [0, -1] })[name] as [number, number],
        };
        const value = (source: string) =>
            evaluateFormula(parseFormula(source), env);
        expect(value("arg(A.coords2D())")).toBe(0);
        expect(value("arg(B.coords2D()-A.coords2D())")).toBeCloseTo(
            (5 * Math.PI) / 4,
        );
        expect(
            formulaIdentifiers(parseFormula("A.coords2D()-B.coords2D()")),
        ).toEqual(new Set(["A", "B"]));
        expect(() => parseFormula("A.foci()")).toThrow();
    });
});

describe("evaluateProgram", () => {
    const run = (source: string, env: FormulaEnv = noPoints) =>
        evaluateProgram(parseProgram(source), env);

    it("gives the value of the last statement, computed with its own variables and loops", () => {
        expect(
            run("var _t=[];for(var i=0;i<3;i++){_t.push([i,2i])};_t"),
        ).toEqual([
            [0, [0, 2]],
            [1, [0, 2]],
            [2, [0, 2]],
        ]);
        expect(run("var n=0,k=5;while(k>0){n+=k;k--};n")).toBe(15);
        expect(run('var a=Math.sqrt(4);a>1?"big":"small"')).toBe("big");
        expect(run('"AB = "+round(2.6)')).toBe("AB = 3");
    });

    it("computes on lists term by term, as DGPad's operators", () => {
        const env: FormulaEnv = {
            resolveIdentifier: (name) =>
                ({ P: [1, 2, 3], Q: [1, 0, 1] })[name] ?? null,
            view: () => NO_VIEW,
        };
        expect(run("var _p=minus(P,Q);[_p+Q,2*_p,_p/2]", env)).toEqual([
            [1, 2, 3],
            [0, 4, 4],
            [0, 1, 1],
        ]);
        expect(run("unitVector([0,0,2])")).toEqual([0, 0, 1]);
    });

    it("styles the figure's objects through callMethod", () => {
        const calls: unknown[] = [];
        const env: FormulaEnv = {
            resolveIdentifier: (name) => (name === "a" ? 2 : null),
            view: () => ({ ...NO_VIEW, theta: -0.5 }),
            callMethod: (...call) => calls.push(call),
        };
        expect(
            run(
                'if(theta()<0) {S1.setOpacity(0.9);S1.setLayer(a)} else {S1.setHidden(1)};S2.setRGBColor(a,0,255);"prog"',
                env,
            ),
        ).toBe("prog");
        expect(calls).toEqual([
            ["S1", "setOpacity", [0.9]],
            ["S2", "setRGBColor", [2, 0, 255]],
        ]);
    });

    it("reads the figure's objects", () => {
        const env: FormulaEnv = {
            resolveIdentifier: (name) => ({ A: [3, 4] })[name] ?? null,
            view: () => NO_VIEW,
        };
        expect(run('A.getName()+" : "+A.getY()', env)).toBe("A : 4");
        expect(run("!isNaN(A.getX())+2*isNaN(I.getX())", env)).toBe(3);
    });

    it("gives up on a program that runs too long", () => {
        expect(run("var k=0;while(1){k++};k")).toBeNull();
    });

    it("tells the objects it reads from those it styles and its own variables", () => {
        const program = parseProgram(
            "var _v=A-B;S1.setHidden(E1>0);S2.setDash(angl1>1);[_v,P.coords2D()]",
        );
        expect(programReferences(program)).toEqual(
            new Set(["A", "B", "E1", "P"]),
        );
        expect(programTargets(program)).toEqual(new Set(["S1"]));
    });

    it.each([
        "document.write(1)",
        "A.constructor",
        "S1.setHidden()",
        "function f(){return 1};f()",
        "a.b=1",
        "new Function('')",
    ])("rejects what isn't part of DGPad's script language: %s", (source) => {
        expect(() => parseProgram(source)).toThrow();
    });

    it("keeps assignments out of plain formulas", () => {
        expect(() => parseFormula("a=1")).toThrow();
    });

    it("counts with i, a loop's own variable, and joins lists", () => {
        expect(
            run(
                "var t=[];for (i=0; i<3; i=i+1){t.push(i)};t=t.concat([5,6],7);t",
            ),
        ).toEqual([0, 1, 2, 5, 6, 7]);
        expect(run("var n=0;for(i=0;i<4;i++){n+=i};n+i")).toBe(10);
    });

    it("reads points in space and the angles as drawn", () => {
        const env: FormulaEnv = {
            resolveIdentifier: (name) =>
                ({ P: [1, 2, 3], Q: [0, 0, 1] })[name] ?? null,
            view: () => NO_VIEW,
            orientedAngle: (name) => (name === "a" ? 4 : null),
        };
        expect(run("P.coords3D()-Q.coords3D()", env)).toEqual([1, 2, 2]);
        expect(run("a.getAOC()>π", env)).toBe(1);
    });
});

describe("DGPad's other functions and operators", () => {
    const value = (source: string, degrees = false) =>
        evaluateFormula(parseFormula(source), {
            resolveIdentifier: (name) =>
                ({ A: [1, 0], O: [0, 0], C: [0, -1] })[name] ?? null,
            view: () => ({ ...NO_VIEW, degrees }),
        });

    it("evaluates min, max, gcd and the remainder", () => {
        expect(value("min(3,-1,2)+max(4,1)")).toBe(3);
        expect(value("gcd(12,18)")).toBe(6);
        expect(value("gcd(12,NaN)")).toBeNull();
        expect(value("7%3+(-7)%3")).toBe(0);
        expect(() => parseFormula("min()")).toThrow();
    });

    it("evaluates conj, distance and crossProduct", () => {
        expect(value("conj(2+3i)")).toEqual([2, -3]);
        expect(value("distance(A,C)")).toBeCloseTo(Math.SQRT2, 12);
        expect(value("crossProduct([1,0,0],[0,1,0])")).toEqual([0, 0, 1]);
    });

    it("measures DGPad's oriented and geometric angles", () => {
        expect(value("Angle360(A,O,C)")).toBeCloseTo((3 * Math.PI) / 2, 12);
        expect(value("Angle360(C,O,A)", true)).toBeCloseTo(90, 12);
        expect(value("Angle180(A,O,C)", true)).toBeCloseTo(90, 12);
        expect(value("Angle180([1,0,0],[0,0,0],[0,0,1])")).toBeCloseTo(
            Math.PI / 2,
            12,
        );
    });

    it("reads a unary plus and booleans", () => {
        expect(value("+2*(1+1)")).toBe(4);
        expect(value("true+false")).toBe(1);
    });
});
