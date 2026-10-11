import { describe, expect, it } from "vitest";
import {
    completionAt,
    formatName,
    formatNumber,
    parseLine,
    TextError,
} from "../../src/editor/text";

describe("Editor text", () => {
    it("parses definitions, free points and deletions", () => {
        expect(parseLine("M = Milieu(A, `aux 2`)")).toEqual({
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
        expect(parseLine("A' = (-1.5, 2e3, .5)")).toEqual({
            name: "A'",
            definition: { kind: "point", coords: [-1.5, 2000, 0.5] },
        });
        expect(parseLine("Intersection(c, d, 2)")).toEqual({
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
        expect(parseLine("A =")).toEqual({ name: "A", definition: null });
    });

    it("rejects what the grammar doesn't read", () => {
        for (const text of [
            "A = (1)",
            "A = (1, 2, 3, 4)",
            "A = Milieu(B, C",
            "A = Milieu(B C)",
            "A = 1 + 2",
            "A = Milieu(B, C) D",
            "A = alert(1); B",
        ])
            expect(() => parseLine(text), text).toThrow(TextError);
    });

    it("writes names and numbers back", () => {
        expect(formatName("A_1")).toBe("A_1");
        expect(formatName("aux 2")).toBe("`aux 2`");
        expect(formatNumber(2.123456)).toBe("2.1235");
        expect(formatNumber(-0.00001)).toBe("0");
        expect(formatNumber(NaN)).toBe("NaN");
    });

    it("tells what is being typed", () => {
        expect(completionAt("Mil")).toEqual({ kind: "command", prefix: "Mil" });
        expect(completionAt("M = ")).toEqual({ kind: "command", prefix: "" });
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
    });
});
