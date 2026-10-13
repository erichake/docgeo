import { describe, expect, it } from "vitest";
import {
    completionAt,
    formatName,
    formatNumber,
    formatProgram,
    parseLine,
    pointFormulaText,
    renameFormula,
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
    });

    it("rejects what the grammar doesn't read", () => {
        for (const text of [
            "",
            "A = (1, 2, 3, 4)",
            "A = Milieu(B, C",
            "A = Milieu(B C)",
            "A = Milieu(B, C) D",
            "A = Milieu(B, 1 + 2)",
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

    it("writes a formula's names anew", () => {
        const names: Record<string, string> = { A: "`A 1`", S1: "T", B: "B" };
        expect(
            renameFormula(
                "if(d(A,`B`)>2){S1.setHidden(1)};A.x",
                (name) => names[name],
            ),
        ).toBe("if(d(`A 1`,B)>2){T.setHidden(1)};`A 1`.x");
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
});
