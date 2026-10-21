import { describe, expect, it } from "vitest";
import {
    completionAt,
    formatCall,
    formatName,
    formatNumber,
    formatProgram,
    joinLines,
    parseLine,
    pointFormulaText,
    renameFormula,
    splitProducts,
    syntaxLine,
    TextError,
    unknownMethod,
} from "../../src/editor/text";
import { parseProgram, programReferences } from "../../src/import/dgp_formula";

const COMMANDS = ["Milieu", "Intersection", "Cercle", "Point"];
const read = (text: string) =>
    parseLine(text, (name) => COMMANDS.includes(name));

describe("Editor text", () => {
    it("parses definitions, free points and deletions", () => {
        expect(read("M = Milieu(A, `aux 2`)")).toEqual({
            name: "M",
            definition: {
                kind: "call",
                command: "Milieu",
                args: [
                    { kind: "name", name: "A" },
                    { kind: "name", name: "aux 2" },
                ],
            },
        });
        expect(read("A' = (-1.5, 2e3, .5)")).toEqual({
            name: "A'",
            definition: { kind: "point", coords: [-1.5, 2000, 0.5] },
        });
        expect(read("Intersection(c, d, 2)")).toEqual({
            name: null,
            definition: {
                kind: "call",
                command: "Intersection",
                args: [
                    { kind: "name", name: "c" },
                    { kind: "name", name: "d" },
                    { kind: "number", value: 2 },
                ],
            },
        });
        expect(read("A =")).toEqual({ name: "A", definition: null });
    });

    it("reads what isn't a point nor a command as a formula", () => {
        for (const [text, name, source] of [
            ["a = 3", "a", "3"],
            ["L = [1, 2, 3]", "L", "[1, 2, 3]"],
            ["f = 0.5x^2-4", "f", "0.5x^2-4"],
            ["E = d(H, `M 1`) ", "E", "d(H, `M 1`)"],
            ["A = (1)", "A", "(1)"],
            ["A = (2*B)", "A", "(2*B)"],
            [
                's = if(a>2){S1.setHidden(1)};"Faces"',
                "s",
                'if(a>2){S1.setHidden(1)};"Faces"',
            ],
            ["d(A', B)", null, "d(A', B)"],
        ])
            expect(read(text!), text!).toEqual({
                name,
                definition: { kind: "formula", source },
            });
    });

    it("reads a point computed by a formula", () => {
        for (const [text, source] of [
            ["M = (1, B)", "[1, B]"],
            ["M = (x(B) + 1, y(A), max(1, a))", "[x(B) + 1, y(A), max(1, a)]"],
            ["M = Point(2*B - A)", "2*B - A"],
            ["M = Point(B)", "B"],
            ["M = Point(var u=A[0];[u, 0])", "var u=A[0];[u, 0]"],
            ["M = (r + 1; 60°)", "[(r + 1)*cos(60°), (r + 1)*sin(60°)]"],
        ])
            expect(read(text), text).toEqual({
                name: "M",
                definition: { kind: "pointFormula", source },
            });
        expect(read("M = Point(c, 0.5)").definition!.kind).toBe("call");
        expect(() => read("M = (a, b, c, d)")).toThrow(TextError);
        expect(pointFormulaText("[x(B) + 1, y(A)]")).toBe("(x(B) + 1, y(A))");
        expect(pointFormulaText("2*B-A")).toBe("Point(2*B-A)");
        expect(pointFormulaText("[1, -2]")).toBe("Point([1, -2])");
        expect(pointFormulaText("[a]")).toBe("Point([a])");
        expect(pointFormulaText("[a, b][0]")).toBe("Point([a, b][0])");
        expect(pointFormulaText("[(r + 1)*cos(60°), (r + 1)*sin(60°)]")).toBe(
            "(r + 1; 60°)",
        );
    });

    it("reads a function named with its variables", () => {
        expect(read("f(x) = x^2")).toEqual({
            name: "f",
            definition: { kind: "curve", source: "x^2" },
        });
        expect(read("g(x, y) = x y")).toEqual({
            name: "g",
            definition: { kind: "formula", source: "x y" },
        });
        expect(read("f(x) =")).toEqual({ name: "f", definition: null });
        expect(read("x(A) = 2").name).toBeNull();
    });

    it("reads a formula in an argument", () => {
        expect(read("c = Cercle(A, d(A, `B 1`) / 2)")).toEqual({
            name: "c",
            definition: {
                kind: "call",
                command: "Cercle",
                args: [
                    { kind: "name", name: "A" },
                    { kind: "formula", source: "d(A, `B 1`) / 2" },
                ],
            },
        });
        expect(read("Cercle(A, -a, [1, 2][0])").definition).toMatchObject({
            args: [
                { kind: "name", name: "A" },
                { kind: "formula", source: "-a" },
                { kind: "formula", source: "[1, 2][0]" },
            ],
        });
    });

    it("rejects what the grammar doesn't read", () => {
        for (const text of [
            "",
            "A = (1, 2, 3, 4)",
            "A = Milieu(B, C",
            "A = Milieu(B, , C)",
            "A = Milieu(B, C) D",
            "A = Milieu(B, (C)",
            "A = Milieu(B, @)",
        ])
            expect(() => read(text), text).toThrow(TextError);
    });

    it("writes names and numbers back", () => {
        expect(formatName("A_1")).toBe("A_1");
        expect(formatName("aux 2")).toBe("`aux 2`");
        expect(formatNumber(2.123456)).toBe("2.1235");
        expect(formatNumber(-0.00001)).toBe("0");
        expect(formatNumber(NaN)).toBe("NaN");
    });

    it("reads in formulas the names it writes", () => {
        expect(programReferences(parseProgram("d(`A 1`, B')+A''*2"))).toEqual(
            new Set(["A 1", "B'", "A''"]),
        );
        // Still DGPad's strings.
        expect(programReferences(parseProgram("a+'b'+f('c')"))).toEqual(
            new Set(["a", "f"]),
        );
    });

    it("reads unknown names of letters ending with a variable as products", () => {
        const known = (name: string) => ["max", "box"].includes(name);
        for (const [source, read] of [
            ["ax^2+bx+c", "a x^2+b x+c"],
            ["abt + box + max(1, kx)", "a b t + box + max(1, k x)"],
            ["`ax` + A.x + ax2", "`ax` + A.x + ax2"],
            ["var ax = 2; ax", "var ax = 2; ax"],
        ])
            expect(splitProducts(source, known), source).toBe(read);
    });

    it("writes a formula's names anew", () => {
        const names: Record<string, string> = { A: "`A 1`", S1: "T", B: "B" };
        expect(
            renameFormula(
                "if(d(A,`B`)>2){S1.setHidden(1)};A.x",
                (name) => names[name],
            ),
        ).toBe("if(d(`A 1`,B)>2){T.setHidden(1)};`A 1`.x");
        // A derivative's prime, after its function's name.
        expect(
            renameFormula("f'(x) + f''(1)", (name) => ({ f: "g" })[name]),
        ).toBe("g'(x) + g''(1)");
    });

    it("lays a program out, changing only spaces and line breaks", () => {
        const source =
            'for(i=0;i<3;i++){if(a>i){s.setHidden(1)}else{s.setHidden(0)}};"x"';
        const laid = formatProgram(source);
        expect(laid).toBe(
            [
                "for(i=0;i<3;i++) {",
                "    if(a>i) {",
                "        s.setHidden(1)",
                "    } else {",
                "        s.setHidden(0)",
                "    }",
                "};",
                '"x"',
            ].join("\n"),
        );
        expect(formatProgram(laid)).toBe(laid);
        expect(parseProgram(laid)).toEqual(parseProgram(source));
        // A string keeps its spaces; what the grammar doesn't read stays.
        expect(formatProgram('a="b ;{ c";b')).toBe('a="b ;{ c";\nb');
        expect(formatProgram('a="b')).toBe('a="b');
    });

    it("tells the line where a program goes wrong", () => {
        expect(syntaxLine("a=1;\nif(a){\n  b=2\n")).toBe(2);
        expect(syntaxLine("a=1;\nb=(2]\n")).toBe(2);
        expect(syntaxLine('a=1;\n\nb="2\n')).toBe(3);
        expect(syntaxLine("a=1;\nif(a){b=2}")).toBeNull();
        expect(unknownMethod("s.setHidden(1);s.setColor(2)")).toBe("setColor");
        expect(unknownMethod("Math.sqrt(2)+f.dx(1)+L.join(',')")).toBeNull();
    });

    it("tells what is being typed", () => {
        expect(completionAt("Mil")).toEqual({
            kind: "command",
            prefix: "Mil",
            formula: false,
        });
        expect(completionAt("M = ")).toEqual({
            kind: "command",
            prefix: "",
            formula: true,
        });
        expect(completionAt("M = Milieu(A, B")).toEqual({
            kind: "argument",
            command: "Milieu",
            position: 1,
            args: [{ kind: "name", name: "A" }],
            prefix: "B",
        });
        expect(completionAt("M = Milieu(Centre(c), ")).toEqual({
            kind: "argument",
            command: "Milieu",
            position: 1,
            args: [],
            prefix: "",
        });
        expect(completionAt("c = Cercle(O, -2, ")).toEqual({
            kind: "argument",
            command: "Cercle",
            position: 2,
            args: [
                { kind: "name", name: "O" },
                { kind: "number", value: -2 },
            ],
            prefix: "",
        });
        expect(completionAt("M = Milieu(A) ")).toBeNull();
        expect(completionAt("E = d(H, ")).toEqual({
            kind: "argument",
            command: "d",
            position: 1,
            args: [{ kind: "name", name: "H" }],
            prefix: "",
        });
        expect(completionAt("E = 2*d(`H 1`, M")).toMatchObject({
            kind: "argument",
            command: "d",
            args: [{ kind: "name", name: "H 1" }],
            prefix: "M",
        });
        for (const text of ["E = AI-AM-", "E = [1, ", "E = (a+"])
            expect(completionAt(text), text).toMatchObject({ kind: "free" });
        expect(completionAt("E = d(A, B)+s")).toEqual({
            kind: "free",
            prefix: "s",
        });
        // A method isn't a function.
        expect(completionAt("E = S1.setHidden(")).toEqual({
            kind: "free",
            prefix: "",
        });
        for (const text of ["E = AI ", "E = S1.", 'E = "ab', "E = `A"])
            expect(completionAt(text), text).toBeNull();
    });

    it("lays a long command out, and reads it back on one line", () => {
        const line =
            "Séquence(Cercle((a*(m*c*sin(t)^2 + b2*cos(t))/(a^2 - c^2*cos(t)^2), b*sin(t)*(a^2 - m*c*cos(t))/(a^2 - c^2*cos(t)^2), 0), b*abs(c*cos(t) - m)/sqrt(a^2 - c^2*cos(t)^2), (a*sin(t), -b*cos(t), 0)), t, 0, 2*PI*(n - 1)/n, 2*PI/n)";
        const laid = formatCall(line, 50);
        expect(laid).toBe(
            [
                "Séquence(",
                "    Cercle(",
                "        (",
                "            a*(m*c*sin(t)^2 + b2*cos(t))/(a^2 - c^2*cos(t)^2),",
                "            b*sin(t)*(a^2 - m*c*cos(t))/(a^2 - c^2*cos(t)^2),",
                "            0),",
                "        b*abs(c*cos(t) - m)/sqrt(a^2 - c^2*cos(t)^2),",
                "        (a*sin(t), -b*cos(t), 0)),",
                "    t, 0, 2*PI*(n - 1)/n, 2*PI/n)",
            ].join("\n"),
        );
        expect(joinLines(laid)).toBe(line);
        expect(formatCall(joinLines(laid), 50)).toBe(laid);
        expect(formatCall("Milieu(A, B)", 50)).toBe("Milieu(A, B)");
        // A formula stays whole, and what doesn't read is left as is.
        const formula = "a*(m*c*sin(t)^2 + b2*cos(t))/(a^2 - c^2*cos(t)^2)";
        expect(formatCall(formula, 20)).toBe(formula);
        expect(formatCall('Texte("ab', 2)).toBe('Texte("ab');
    });
});
