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
    withObjects,
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

    it("reads two function variables as one of the figure's objects when they name one", () => {
        expect(
            withObjects(new Set(["xx"]), () =>
                formulaIdentifiers(parseFormula("y(xx)+xy")),
            ),
        ).toEqual(new Set(["xx", "x", "y"]));
        expect(formulaIdentifiers(parseFormula("xx"))).toEqual(new Set(["x"]));
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

    it("gives the n roots of a complex number to the power 1/n", () => {
        const roots = (source: string) =>
            evaluateProgram(parseProgram(source), noPoints) as [
                number,
                number,
            ][];
        const cubeRoots = roots("[8,0]^(1/3)");
        expect(cubeRoots).toHaveLength(3);
        expect(cubeRoots[0]).toEqual([2, 0]);
        expect(cubeRoots[1][0]).toBeCloseTo(-1);
        expect(cubeRoots[1][1]).toBeCloseTo(Math.sqrt(3));
        // From an argument in [0, 2π[, as in DGPad.
        const [re, im] = roots("[0,-8]^(1/3)")[0];
        expect(re).toBeCloseTo(0);
        expect(im).toBeCloseTo(2);
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

    it("compares an undefined value as JavaScript's NaN", () => {
        const env = envWith({ A: null });
        expect(evaluateFormula(parseFormula("x(A)<1"), env)).toBe(0);
        expect(evaluateFormula(parseFormula("x(A)!=x(A)"), env)).toBe(1);
        expect(evaluateFormula(parseFormula("(x(A)<1)||1"), env)).toBe(1);
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
        expect(run("IF(2>1,3,4)+test(0,5,6)")).toBe(9);
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
        // As some figures' envelopes, computed point by point.
        expect(run("var k=0;while(k<2000000){k++};k")).toBe(2000000);
        expect(run("var k=0;while(1){k++};k")).toBeNull();
    });

    it("calls its own functions, which see its variables and can call themselves", () => {
        expect(
            run(
                "var t=[];var k=10;function add(a,b){var s=a+b;t.push(s*k);return s};add(1,2);add(add(1,1),3);t",
            ),
        ).toEqual([30, 20, 50]);
        expect(
            run(
                "var r=fact(5);function fact(n){if(n<2){return 1};for(var i=0;i<1;i++){return n*fact(n-1)}};r",
            ),
        ).toBe(120);
        expect(run("var u=2;function f(){var u=1};f();u")).toBe(2);
        expect(run("function f(){return f()};f()")).toBeNull();
    });

    it("runs the programs Blockly compiles", () => {
        expect(
            run(
                "var bl_a=function(){\nblockly_var_t = [];\nfor (var blockly_var_i = 1 ; blockly_var_i <= 3 ; blockly_var_i = blockly_var_i + 1){\n  blockly_var_t.push([Math.times(blockly_var_i,2),NaN]);\n};\nreturn (blockly_var_t);\n};\nbl_a()",
            ),
        ).toEqual([
            [2, NaN],
            [4, NaN],
            [6, NaN],
        ]);
    });

    it("tells the figure's objects from its functions and their variables", () => {
        expect(
            programReferences(
                parseProgram(
                    "var r=R;function f(P){var Q=P+A;return Q*r};f(B)",
                ),
            ),
        ).toEqual(new Set(["R", "A", "B"]));
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
        "var f=(function(){return 1})",
        "a.b=1",
        "a.length=1",
        "[1][0]=2",
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

    it("changes the items of its own lists, never another object's value", () => {
        const P = [
            [1, 2],
            [3, 4],
        ];
        const env: FormulaEnv = {
            resolveIdentifier: (name) => (name === "P" ? P : null),
            view: () => NO_VIEW,
        };
        expect(
            run(
                "var m=P;m[0][1]=5;m[1][0]+=2;var r=m[0];m[0]=m[1];m[1]=r;m",
                env,
            ),
        ).toEqual([
            [5, 4],
            [1, 5],
        ]);
        expect(P).toEqual([
            [1, 2],
            [3, 4],
        ]);
        expect(run("var a=[1,2];var b=a;b[0]=3;a")).toEqual([3, 2]);
    });

    it("reads the length of lists and texts, and takes their last item", () => {
        expect(
            run(
                'var t=[1,[2,3],"abc"];[t.length,(t[1]).length,t[2].length,t.pop(),t.length]',
            ),
        ).toEqual([3, 2, 3, "abc", 2]);
    });

    it("tells an undefined value by its difference with itself, as JavaScript", () => {
        expect(run("var x=NaN;[x!=x,x==x,1!=1]")).toEqual([1, 0, 0]);
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

    it("evaluates conj, mod, distance and crossProduct", () => {
        expect(value("conj(2+3i)")).toEqual([2, -3]);
        expect(value("mod(3+4i)")).toBe(5);
        expect(value("mod(-2)")).toBe(2);
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

describe("Blockly programs", () => {
    const run = (source: string, env: FormulaEnv = noPoints) =>
        evaluateProgram(parseProgram(source), env);

    it("reads Blockly's styling and SET_EXP as methods, String and join as JavaScript's", () => {
        const program = parseProgram(
            'BLK_STL("dgpad_object_S1","setRGBColor",[0,153,0]);SET_EXP("t",a+1)',
        );
        expect(programTargets(program)).toEqual(new Set(["S1", "t"]));
        expect(programReferences(program)).toEqual(new Set(["a"]));
        const calls: unknown[] = [];
        evaluateProgram(program, {
            resolveIdentifier: () => 2,
            view: () => NO_VIEW,
            callMethod: (...call) => calls.push(call),
        });
        expect(calls).toEqual([
            ["S1", "setRGBColor", [0, 153, 0]],
            ["t", "setExpression", [3]],
        ]);
        expect(run("[String(1.5),'x'].join('')+[1,2].join()")).toBe("1.5x1,2");
    });

    it("lists the turtle's points among its drawing instructions", () => {
        const env: FormulaEnv = {
            resolveIdentifier: (name) => (name === "A" ? [1, 1] : null),
            view: () => ({ ...NO_VIEW, unit: 10, degrees: true }),
        };
        const tab = run(
            'TURTLE_INIT("A",A);TURTLE_COLOUR(5);TURTLE_MV(2,false);TURTLE_TURN(90);TURTLE_UP(true);TURTLE_MV(10,true);TURTLE_FILL(20);SET_NUM_PRECISION(1);TURTLE_PRINT(TURTLE_TEXT("d = ")+1.25);TURTLE_RESULT()',
            env,
        ) as unknown[];
        const near = (p: unknown) => (p as number[]).map((c) => +c.toFixed(9));
        expect(tab.slice(0, 3)).toEqual([
            [10, 0, 0, 1],
            [12, 0, 0, 1e-13],
            [2, 0, 0, 55],
        ]);
        // The color applies from the last point on.
        expect(tab[3]).toEqual([2, 0, 0, 5]);
        expect(tab[4]).toEqual([1, 1]);
        expect(tab[5]).toEqual([3, 1]);
        // A pen up breaks the line; 10 pixels are 1 unit.
        expect(tab[6]).toEqual([NaN, NaN, NaN]);
        expect(near(tab[7])).toEqual([3, 2]);
        expect(tab[8]).toEqual([4, 0, 0, 20]);
        expect((tab[9] as unknown[]).slice(0, 3)).toEqual([20, 0, "d = 1,3"]);
        expect(near((tab[9] as unknown[])[3])).toEqual([0, 1, 0]);
    });

    it("turns the turtle toward a point, and reads the points of the turtles", () => {
        const env: FormulaEnv = {
            resolveIdentifier: (name) =>
                ({ A: [0, 0], B: [3, 4] })[name] ?? null,
            view: () => NO_VIEW,
            turtlePoints: (list) =>
                list === "blk_turtle_list_C"
                    ? [
                          [5, 5],
                          [6, 6],
                      ]
                    : null,
        };
        expect(
            run(
                'TURTLE_INIT("A",A);TURTLE_JOIN_PT(B);[TURTLE_POS(),TURTLE_GET("A",2),TURTLE_GET("C",2),TURTLE_LENGTH("C")]',
                env,
            ),
        ).toEqual([[3, 4], [3, 4], [6, 6], 2]);
        expect(
            programReferences(
                parseProgram(
                    'TURTLE_INIT("A",A);TURTLE_GET("A",1);TURTLE_GET("C",1)',
                ),
            ),
        ).toEqual(new Set(["A", "blk_turtle_list_C"]));
    });
});
