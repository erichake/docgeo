import { describe, expect, it } from "vitest";
import "../../src/construction";
import type { construction } from "../../src/construction";
import { readDgo } from "../../src/dgo";
import { methodProgram } from "../../src/editor/macro_program";
import type { construction_object } from "../../src/objects/construction_object";
import { createConstruction, disposeFigures } from "./figures";

disposeFigures();

type Json = unknown;

const VIEW = { o: [400, 300], u: 40, w: 800, h: 600 };

function open(o: Json[][], mac: Json[]): construction {
    const c = createConstruction([800, 600]);
    readDgo(c, { dgo: 1, v: VIEW, o, mac });
    c.flush();
    return c;
}

const MIDPOINT = {
    n: "Milieu",
    f: ["I"],
    m: [
        { i: [["point"], ["point"]], b: [["Mid", "I", [0, 1]]], f: [2] },
        { i: [["segment"]], b: [["Mid", "I", [2]]], f: [3] },
    ],
};

const CIRCUMCENTER = {
    n: "Circonscrit",
    f: ["O", "c"],
    m: [
        {
            i: [["point", "Le premier ?"], ["point"], ["point"]],
            b: [
                ["Med", "m1", [0, 1]],
                ["Med", "m2", [1, 2]],
                ["Int", "O", [3, 4, 0]],
                ["Cir", "c", [5, 0]],
            ],
            f: [5, 6],
        },
    ],
};

const program = (
    c: construction,
    index: number,
    method: number,
    picked: (construction_object | string)[] = [],
) => methodProgram(c, index, method, picked);

const lines = (
    c: construction,
    ...args: [number, number, (construction_object | string)[]?]
) =>
    program(c, ...args).lines.map(({ text, final }) =>
        final ? `${text} !` : text,
    );

describe("A macro's program", () => {
    it("names the initials not designated as the editor names objects", () => {
        const c = open([["Pt", "A", [0, 0]]], [CIRCUMCENTER]);
        const { initials } = program(c, 0, 0);
        expect(initials).toEqual([
            { name: "B", parts: [], message: "Le premier ?" },
            { name: "C", parts: [], message: "Designate a point" },
            { name: "D", parts: [], message: "Designate a point" },
        ]);
        expect(lines(c, 0, 0)).toEqual([
            "m1 = PerpendicularBisector(B, C)",
            "m2 = PerpendicularBisector(C, D)",
            "O = Intersection(m1, m2) !",
            "c = Circle(O, B) !",
        ]);
    });

    it("names them as the figure where it was defined did", () => {
        const named = {
            ...CIRCUMCENTER,
            m: [{ ...CIRCUMCENTER.m[0], n: ["P", "Q", "R"] }],
        };
        const c = open(
            [
                ["Pt", "P", [0, 0]],
                ["Pt", "O", [1, 0]],
            ],
            [named],
        );
        expect(lines(c, 0, 0)).toEqual([
            "m1 = PerpendicularBisector(P, Q)",
            "m2 = PerpendicularBisector(Q, R)",
            "O = Intersection(m1, m2) !",
            "c = Circle(O, P) !",
        ]);
        // O designated, which the body's O can't be.
        const { initials, lines: written } = program(c, 0, 0, [c.getObj("O")!]);
        expect(initials.map(({ name }) => name)).toEqual(["O", "Q", "R"]);
        expect(written.map(({ text }) => text)).toEqual([
            "m1 = PerpendicularBisector(O, Q)",
            "m2 = PerpendicularBisector(Q, R)",
            "O1 = Intersection(m1, m2)",
            "c = Circle(O1, O)",
        ]);
        expect(() =>
            open([], [{ ...named, m: [{ ...named.m[0], n: ["P", "Q"] }] }]),
        ).toThrow();
    });

    it("writes those designated by their names", () => {
        const c = open(
            [
                ["Pt", "P", [-2, 1]],
                ["Pt", "Q", [3, 0]],
                ["Seg", "s", [0, 1]],
            ],
            [MIDPOINT, CIRCUMCENTER],
        );
        const [P, Q, s] = ["P", "Q", "s"].map((name) => c.getObj(name)!);
        expect(lines(c, 1, 0, [P, Q])).toEqual([
            "m1 = PerpendicularBisector(P, Q)",
            "m2 = PerpendicularBisector(Q, A)",
            "O = Intersection(m1, m2) !",
            "c = Circle(O, P) !",
        ]);
        expect(program(c, 0, 1, [s]).initials).toEqual([
            { name: "s", parts: ["P", "Q"], message: "Designate a segment" },
        ]);
        // A point, which the segment's method doesn't take.
        expect(program(c, 0, 1, [P]).initials[0].parts).toEqual(["A", "B"]);
    });

    it("shows applications, sub-objects and numbers", () => {
        const c = open(
            [
                ["Pt", "A", [0, 0]],
                ["Pt", "B", [2, 0]],
                ["Cir", "k", [0, 1]],
            ],
            [
                MIDPOINT,
                {
                    n: "Quart",
                    f: ["J"],
                    m: [
                        {
                            i: [["point"], ["point"]],
                            b: [
                                ["Mac", "mac1", [0, 0, [0, 1]]],
                                ["Out", "I", [2, 1]],
                                ["Mac", "mac2", [0, 0, [0, 3]]],
                                ["Out", "J", [4, 1]],
                            ],
                            f: [5],
                        },
                    ],
                },
                {
                    n: "Rayon",
                    f: ["s"],
                    m: [
                        {
                            i: [["circle"], ["point"]],
                            b: [["Seg", "s", [0, 2]]],
                            f: [3],
                        },
                    ],
                },
                {
                    n: "Double",
                    f: ["r"],
                    m: [
                        {
                            i: [["number"]],
                            b: [
                                [
                                    "Ex",
                                    "r",
                                    { t: "", f: ["n*2", { n: 0 }], xy: [0, 0] },
                                ],
                            ],
                            f: [1],
                        },
                    ],
                },
            ],
        );
        expect(program(c, 1, 0).lines).toEqual([
            { text: "I = Milieu(C, D)", final: false, macro: 0 },
            { text: "J = Milieu(C, I)", final: true, macro: 0 },
        ]);
        const circle = program(c, 2, 0, [c.getObj("k")!]);
        expect(circle.initials.map(({ name, parts }) => [name, parts])).toEqual(
            [
                ["k", ["A"]],
                ["C", []],
            ],
        );
        expect(circle.lines[0].text).toBe("s = Segment(A, C)");
        expect(program(c, 3, 0, ["3"]).initials[0].name).toBe("a = 3");
        expect(lines(c, 3, 0)).toEqual(["r = a*2 !"]);
    });
});
