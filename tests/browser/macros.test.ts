import { describe, expect, it } from "vitest";
import "../../src/construction";
import type { construction } from "../../src/construction";
import { describeDgo, figureObjects, readDgo } from "../../src/dgo";
import { figureIndex, lineOf } from "../../src/editor/figure";
import {
    builtView,
    figureState,
    figureValues,
    stateFigure,
} from "../../src/figure_state";
import type { construction_object } from "../../src/objects/construction_object";
import type { locus_object } from "../../src/objects/locus_object";
import { macro_object } from "../../src/objects/macro_object";
import type { point_object } from "../../src/objects/point_object";
import type { primitive_line_object } from "../../src/objects/primitive_line_object";
import { vNorm, vSub, type Vec3 } from "../../src/vec";
import { createConstruction, disposeFigures, expectClose } from "./figures";

disposeFigures();

type Json = unknown;

const VIEW = { o: [400, 300], u: 40, w: 800, h: 600 };

function open(o: Json[][], mac: Json[], st?: Json[]): construction {
    const c = createConstruction([800, 600]);
    readDgo(c, { dgo: 1, v: VIEW, o, mac, ...(st && { st }) });
    c.flush();
    return c;
}

const get = <T = point_object>(c: construction, name: string) =>
    c.getObj(name) as T;

function move(c: construction, name: string, coords: Vec3): void {
    const point = get(c, name);
    point.coords = coords;
    c.invalidateGeometry(point);
    c.flush();
}

const names = (c: construction) =>
    figureObjects(c).map((object: construction_object) => object.name);

// The midpoint of two points, or of a segment.
const MIDPOINT = {
    n: "Milieu",
    f: ["I"],
    m: [
        {
            i: [
                ["point", "Le premier point ?"],
                ["point", "Le second point ?"],
            ],
            h: "Choisir les deux points.",
            b: [["Mid", "I", [0, 1]]],
            f: [2],
        },
        {
            i: [["segment", "Le segment ?"]],
            b: [["Mid", "I", [2]]],
            f: [3],
        },
    ],
};

// The two intersections of a line and a circle, in the line's direction.
const CUT = {
    n: "Coupe",
    f: ["g", "h"],
    m: [
        {
            i: [["line"], ["circle"]],
            b: [
                ["Int", "g", [0, 2, 0]],
                ["Int", "h", [0, 2, 1]],
            ],
            f: [3, 4],
        },
    ],
};

describe("Macro-constructions", () => {
    it("applies each method, and writes the figure back as it was read", async () => {
        const o = [
            ["Pt", "A", [-2, 1]],
            ["Pt", "B", [3, 0]],
            ["Mac", "mac1", [0, 0, [0, 1]]],
            ["Out", "I", [2, 1]],
            ["Seg", "s", [0, 1]],
            ["Mac", "mac2", [0, 1, [4]]],
            ["Out", "J", [5, 1], 0],
        ];
        const st = [{ c: "#ff0000" }];
        const c = open(o, [MIDPOINT], st);
        expectClose(get(c, "I").coords, [0.5, 0.5, 0]);
        expectClose(get(c, "J").coords, [0.5, 0.5, 0]);
        expect(get(c, "J").stroke_color).toBe("#ff0000");
        expect(get(c, "I").moveable).toBe(false);
        expect(names(c)).toEqual(["A", "B", "mac1", "I", "s", "mac2", "J"]);
        expect(get(c, "I").hasView).toBe(true);
        expect(get(c, "mac1").hasView).toBe(false);
        const index = figureIndex(c);
        // A final's line is its application's; the node has no row.
        expect(
            figureObjects(c).map((object) =>
                lineOf(object, index, figureObjects(c)),
            ),
        ).toEqual([
            "A = (-2, 1)",
            "B = (3, 0)",
            null,
            "I = Milieu(A, B)",
            "s = Segment(A, B)",
            null,
            "J = Milieu(s)",
        ]);
        move(c, "A", [0, 4, 0]);
        expectClose(get(c, "I").coords, [1.5, 2, 0]);
        expectClose(get(c, "J").coords, [1.5, 2, 0]);
        const figure = await describeDgo(c);
        expect(figure.mac).toEqual([MIDPOINT]);
        expect(figure.st).toEqual(st);
        expect(figure.o.slice(2)).toEqual(o.slice(2));
        const copy = createConstruction([800, 600]);
        readDgo(copy, figure);
        expect(await describeDgo(copy)).toEqual(figure);
    });

    it("keeps the orientation of lines through the application", () => {
        const c = open(
            [
                ["Pt", "A", [-3, 0]],
                ["Pt", "B", [3, 1]],
                ["Line", "d", [0, 1]],
                ["Pt", "O", [0, 0]],
                ["Pt", "P", [2, 0]],
                ["Cir", "c", [3, 4]],
                ["Mac", "mac1", [0, 0, [2, 5]]],
                ["Out", "g", [6, 1]],
                ["Out", "h", [6, 2]],
                ["Int", "G", [2, 5, 0]],
                ["Int", "H", [2, 5, 1]],
            ],
            [CUT],
        );
        const check = () => {
            expectClose(get(c, "g").coords, get(c, "G").coords);
            expectClose(get(c, "h").coords, get(c, "H").coords);
        };
        check();
        expect(get(c, "g").coords[0]).toBeGreaterThan(0);
        // The line turns back: so do its intersections.
        move(c, "A", [3, -1, 0]);
        move(c, "B", [-3, 0, 0]);
        check();
        expect(get(c, "g").coords[0]).toBeLessThan(0);
    });

    it("gives a final line its direction", () => {
        const PARALLEL = {
            n: "Parallèle",
            f: ["p"],
            m: [
                { i: [["line"], ["point"]], b: [["Par", "p", [0, 1]]], f: [2] },
            ],
        };
        const c = open(
            [
                ["Pt", "A", [-3, 0]],
                ["Pt", "B", [3, 1]],
                ["Line", "d", [0, 1]],
                ["Pt", "M", [0, 1]],
                ["Mac", "mac1", [0, 0, [2, 3]]],
                ["Out", "p", [4, 1]],
                ["Par", "q", [2, 3]],
            ],
            [PARALLEL],
        );
        const [p, q] = ["p", "q"].map((name) =>
            get<primitive_line_object>(c, name),
        );
        expectClose(p.VEC, q.VEC);
        expectClose(p.P1.coords, q.P1.coords);
    });

    it("spreads undefinedness", () => {
        const c = open(
            [
                ["Pt", "A", [-3, 0]],
                ["Pt", "B", [3, 0]],
                ["Line", "d", [0, 1]],
                ["Pt", "O", [0, 0]],
                ["Pt", "P", [2, 0]],
                ["Cir", "c", [3, 4]],
                ["Mac", "mac1", [0, 0, [2, 5]]],
                ["Out", "g", [6, 1]],
                ["Mid", "K", [7, 3]],
            ],
            [CUT],
        );
        expect(get(c, "K").defined).toBe(true);
        move(c, "A", [-3, 5, 0]);
        move(c, "B", [3, 5, 0]);
        expect(get(c, "g").defined).toBe(false);
        expect(get(c, "K").defined).toBe(false);
        move(c, "B", [3, -5, 0]);
        expect(get(c, "K").defined).toBe(true);
    });

    it("nests applications", async () => {
        const QUARTER = {
            n: "Quart",
            f: ["Q"],
            m: [
                {
                    i: [["point"], ["point"]],
                    b: [
                        ["Mac", "m1", [0, 0, [0, 1]]],
                        ["Out", "M", [2, 1]],
                        ["Mac", "m2", [0, 0, [0, 3]]],
                        ["Out", "Q", [4, 1]],
                    ],
                    f: [5],
                },
            ],
        };
        const o = [
            ["Pt", "A", [0, 0]],
            ["Pt", "B", [4, 8]],
            ["Mac", "mac1", [1, 0, [0, 1]]],
            ["Out", "Q", [2, 1]],
        ];
        const c = open(o, [MIDPOINT, QUARTER]);
        expectClose(get(c, "Q").coords, [1, 2, 0]);
        move(c, "A", [4, 0, 0]);
        expectClose(get(c, "Q").coords, [4, 2, 0]);
        expect((await describeDgo(c)).o.slice(2)).toEqual(o.slice(2));
        // No macro applies itself, nor a later one.
        expect(() =>
            open(
                o.map((entry) =>
                    entry[0] === "Mac"
                        ? ["Mac", "mac1", [0, 0, [0, 1]]]
                        : entry,
                ),
                [QUARTER, MIDPOINT],
            ),
        ).toThrow();
    });

    it("reads the sub-objects of initials", () => {
        const SUBS = {
            n: "Sous-objets",
            f: ["E", "F", "G", "H", "K"],
            m: [
                {
                    i: [["segment"], ["circle"], ["polygon"], ["arc"]],
                    b: [
                        ["Fix", "Z", [0, 0]],
                        ["Mid", "E", [0, 3]],
                        ["Mid", "F", [["vertex", 5, 2], 0]],
                        ["Mid", "G", [6, 7]],
                        ["Mid", "H", [6, 8]],
                        ["Sym", "K", [10, 3]],
                    ],
                    f: [11, 12, 13, 14, 15],
                },
            ],
        };
        const c = open(
            [
                ["Pt", "A", [0, 0]],
                ["Pt", "B", [2, 0]],
                ["Seg", "s", [0, 1]],
                ["Pt", "O", [4, 4]],
                ["Cir", "c", [3, 1]],
                ["Pt", "C", [0, 2]],
                ["Poly", "p", [0, 1, 5]],
                ["Pt", "U", [-1, 0]],
                ["Pt", "V", [0, 1]],
                ["Pt", "W", [1, 0]],
                ["Arc", "a", [7, 8, 9]],
                ["Mac", "mac1", [0, 0, [2, 4, 6, 10]]],
                ["Out", "E", [11, 1]],
                ["Out", "F", [11, 2]],
                ["Out", "G", [11, 3]],
                ["Out", "H", [11, 4]],
                ["Out", "K", [11, 5]],
            ],
            [SUBS],
        );
        // The segment's first end and the circle's center.
        expectClose(get(c, "E").coords, [2, 2, 0]);
        // The polygon's second vertex and the segment's first end.
        expectClose(get(c, "F").coords, [1, 0, 0]);
        // The arc's center, and its ends.
        expectClose(get(c, "G").coords, [-0.5, 0, 0]);
        expectClose(get(c, "H").coords, [0.5, 0, 0]);
        // The circle's center about a fixed point of the body.
        expectClose(get(c, "K").coords, [-4, -4, 0]);
    });

    it("takes numbers, from an expression or typed", () => {
        const DILATE = {
            n: "Homothétie",
            f: ["D"],
            m: [
                {
                    i: [["point"], ["point"], ["number"]],
                    b: [["Dil", "D", [0, 1, ["k", { k: 2 }]]]],
                    f: [3],
                },
            ],
        };
        const c = open(
            [
                ["Pt", "O", [0, 0]],
                ["Pt", "P", [1, 1]],
                ["Ex", "k", { t: "", v: 3, xy: [10, 10] }],
                ["Mac", "mac1", [0, 0, [0, 1, 2]]],
                ["Out", "D", [3, 1]],
                ["Mac", "mac2", [0, 0, [0, 1, "-2"]]],
                ["Out", "E", [5, 1]],
            ],
            [DILATE],
        );
        expectClose(get(c, "D").coords, [3, 3, 0]);
        expectClose(get(c, "E").coords, [-2, -2, 0]);
        // A typed number names nothing.
        expect(() =>
            open(
                [
                    ["Pt", "O", [0, 0]],
                    ["Pt", "P", [1, 1]],
                    ["Mac", "mac1", [0, 0, [0, 1, "P"]]],
                ],
                [DILATE],
            ),
        ).toThrow();
    });

    it("draws a locus of the body", () => {
        const LOCUS = {
            n: "Lieu",
            f: ["L"],
            m: [
                {
                    i: [["circle"], ["point"]],
                    b: [
                        ["On", "M", [1, 0]],
                        ["Mid", "I", [3, 2]],
                        ["Loc", "L", [4, 3]],
                    ],
                    f: [5],
                },
            ],
        };
        const c = open(
            [
                ["Pt", "O", [0, 0]],
                ["Pt", "A", [2, 0]],
                ["Cir", "c", [0, 1]],
                ["Pt", "P", [4, 0]],
                ["Mac", "mac1", [0, 0, [2, 3]]],
                ["Out", "L", [4, 1]],
            ],
            [LOCUS],
        );
        const locus = get<locus_object>(c, "L");
        const points = locus.points.filter((point) => point !== null);
        expect(points.length).toBeGreaterThan(100);
        points.forEach((point) =>
            expect(Math.abs(vNorm(vSub(point, [2, 0, 0])) - 1)).toBeLessThan(
                1e-9,
            ),
        );
    });

    it("deletes an application with its last final, and with an initial", () => {
        const o = [
            ["Pt", "A", [-3, 0]],
            ["Pt", "B", [3, 0]],
            ["Line", "d", [0, 1]],
            ["Pt", "O", [0, 0]],
            ["Pt", "P", [2, 0]],
            ["Cir", "c", [3, 4]],
            ["Mac", "mac1", [0, 0, [2, 5]]],
            ["Out", "g", [6, 1]],
            ["Out", "h", [6, 2]],
            ["Mid", "K", [7, 3]],
        ];
        const c = open(o, [CUT]);
        c.removeObject(get(c, "g"));
        expect(names(c)).toEqual(["A", "B", "d", "O", "P", "c", "mac1", "h"]);
        c.removeObject(get(c, "h"));
        expect(names(c)).toEqual(["A", "B", "d", "O", "P", "c"]);
        const other = open(o, [CUT]);
        other.removeObject(get(other, "c"));
        expect(names(other)).toEqual(["A", "B", "d", "O", "P"]);
    });

    it("follows the branches of conic intersections, saved and stated", async () => {
        const CROSS = {
            n: "Croisement",
            f: ["E1", "E2", "E3", "E4"],
            m: [
                {
                    i: [["conic"], ["conic"]],
                    b: [0, 1, 2, 3].map((k) => ["Int", `E${k + 1}`, [0, 1, k]]),
                    f: [2, 3, 4, 5],
                },
            ],
        };
        const o = [
            ["Pt", "F", [-2, 0]],
            ["Pt", "G", [2, 0]],
            ["Pt", "P", [3, 0]],
            ["Ell", "e", [0, 1, 2]],
            ["Pt", "F2", [0, -2]],
            ["Pt", "G2", [0, 2]],
            ["Pt", "P2", [0, 3]],
            ["Ell", "f", [4, 5, 6]],
            ["Mac", "mac1", [0, 0, [3, 7]]],
            ...[1, 2, 3, 4].map((k) => ["Out", `E${k}`, [8, k]]),
            ...[0, 1, 2, 3].map((k) => ["Int", `I${k + 1}`, [3, 7, k]]),
        ];
        const c = open(o, [CROSS]);
        [1, 2, 3, 4].forEach((k) =>
            expectClose(get(c, `E${k}`).coords, get(c, `I${k}`).coords),
        );
        const node = get<macro_object>(c, "mac1");
        expect(node.branches).toEqual([0, 1, 2, 3]);
        const view = builtView(c);
        const values = figureValues(c, view);
        expect(values.get("mac1")).toBe("[0,1,2,3]");
        expect(figureState(c, values, view)).toEqual({});

        const turned = open(
            [...o.slice(0, 8), ["Mac", "mac1", [0, 0, [3, 7], [3, 2, 1, 0]]]],
            [CROSS],
        );
        const saved = await describeDgo(turned);
        expect(saved.o[8]).toEqual([
            "Mac",
            "mac1",
            [0, 0, [3, 7], [3, 2, 1, 0]],
        ]);
        const base = await describeDgo(c);
        const state = { mac1: [3, 2, 1, 0] };
        const applied = createConstruction([800, 600]);
        readDgo(applied, stateFigure(c, base, state));
        applied.flush();
        [1, 2, 3, 4].forEach((k) =>
            expectClose(
                get(applied, `E${k}`).coords,
                get(c, `I${5 - k}`).coords,
            ),
        );
        expect(figureState(applied, values, builtView(applied))).toEqual(state);
        expect(() =>
            open(
                [...o.slice(0, 8), ["Mac", "mac1", [0, 0, [3, 7], [0, 1]]]],
                [CROSS],
            ),
        ).toThrow();
    });

    it("refuses malformed macros", () => {
        const figure = (macro: Json) => () =>
            open([["Pt", "A", [0, 0]]], [macro]);
        const method = (body: Json[], finals = [1]) => ({
            n: "M",
            f: ["X"],
            m: [{ i: [["point"]], b: body, f: finals }],
        });
        expect(figure(method([["Sym", "X", [0, 0]]]))).not.toThrow();
        expect(figure(method([["Pt", "X", [0, 0]]]))).toThrow();
        expect(
            figure(method([["Ex", "X", { t: "", v: 1, xy: [0, 0] }]])),
        ).toThrow();
        expect(figure(method([["C1", "X", [0, 2]]]))).toThrow();
        expect(figure(method([["Sym", "X", [0, 0]]], [0]))).toThrow();
        expect(figure(method([["Sym", "X", [0, 0]]], [2]))).toThrow();
        expect(figure({ n: "M", f: ["X"], m: [] })).toThrow();
        // No signature begins another.
        expect(
            figure({
                n: "M",
                f: ["X"],
                m: [
                    { i: [["point"]], b: [["Sym", "X", [0, 0]]], f: [1] },
                    {
                        i: [["point"], ["point"]],
                        b: [["Mid", "X", [0, 1]]],
                        f: [2],
                    },
                ],
            }),
        ).toThrow();
        // Exact types: a segment is no line.
        expect(() =>
            open(
                [
                    ["Pt", "A", [0, 0]],
                    ["Pt", "B", [1, 0]],
                    ["Seg", "s", [0, 1]],
                    ["Pt", "O", [0, 0]],
                    ["Cir", "c", [3, 1]],
                    ["Mac", "mac1", [0, 0, [2, 4]]],
                ],
                [CUT],
            ),
        ).toThrow();
    });
});
