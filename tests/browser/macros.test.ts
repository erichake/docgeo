import { describe, expect, it } from "vitest";
import "../../src/construction";
import type { construction } from "../../src/construction";
import {
    describeDgo,
    figureObjects,
    importDgoFromUrl,
    readDgo,
} from "../../src/dgo";
import { figureIndex, lineOf } from "../../src/editor/figure";
import { applyMacro, designation, takesNext } from "../../src/editor/macro";
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
import type { point_on_object } from "../../src/objects/point_on_object";
import type { polygon_object } from "../../src/objects/polygon_object";
import type { primitive_circle_object } from "../../src/objects/primitive_circle_object";
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
    // As CaRMetal does, but the look of the image is found, not asked: a
    // polygon's by a dilation, a line's by an inversion (see
    // TRANSFORMATIONS.md).
    it("maps objects by a macro that maps points, as found when applied", async () => {
        const invert = {
            n: "Inverse",
            f: ["Q"],
            m: [
                {
                    i: [["circle"], ["point"]],
                    b: [["Inv", "Q", [1, 2]]],
                    f: [3],
                },
            ],
        };
        const c = open(
            [
                ["Pt", "O", [0, 0]],
                ["Pt", "A", [2, 0]],
                ["Pt", "B", [4, 2]],
                ["Pt", "C", [2, 4]],
                ["Poly", "p", [1, 2, 3]],
                ["Cir", "c", [0, 1]],
                ["Line", "d", [2, 3]],
                ["Line", "l", [0, 2]],
                ["Seg", "s", [1, 2]],
            ],
            [MIDPOINT, invert],
        );
        const at = (...named: string[]) =>
            named.map((name) => get<construction_object>(c, name));
        expect(
            takesNext(designation(c.macros[0], at("O"), c.macros), get(c, "p")),
        ).toBe(true);
        const images = [
            applyMacro(c, 0, 0, at("O", "p")),
            applyMacro(c, 1, 0, at("c", "d")),
            applyMacro(c, 1, 0, at("c", "l")),
            applyMacro(c, 1, 0, at("c", "p")),
            applyMacro(c, 1, 0, at("c", "s")),
        ].map(([image]) => image);
        c.flush();
        const figure = await describeDgo(c);
        expect(
            (figure.o as unknown[][][])
                .slice(9)
                .map(([, , [, , , look]]) => look),
        ).toEqual(["Poly", "Cir", "Line", "Loc", "Arc"]);
        const [half, round, straight, curved, arc] = images;
        // Drawn once styled: filled.
        const fill = (half as polygon_object).path.dom() as SVGElement;
        expect(fill.style.fillOpacity).toBe("0.2");
        expectClose(
            (half as polygon_object).points.map((point) => point.coords),
            [
                [1, 0, 0],
                [2, 1, 0],
                [1, 2, 0],
            ],
        );
        expect((round as primitive_circle_object).R).toBeCloseTo(
            2 / (3 * Math.SQRT2),
        );
        expect(vNorm((straight as primitive_line_object).VEC)).toBeCloseTo(1);
        expect((curved as polygon_object).points.length).toBe(96);
        expect(arc.defined).toBe(true);
        const index = figureIndex(c);
        expect(lineOf(half, index, figureObjects(c))).toBe(
            `${half.name} = Milieu(O, p)`,
        );
        // Read back, the same.
        const copy = open(
            figure.o as Json[][],
            figure.mac as Json[],
            figure.st as Json[],
        );
        expect(names(copy)).toEqual(names(c));
        expectClose(
            get<polygon_object>(copy, half.name).points[1].coords,
            [2, 1, 0],
        );
    });

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

    it("moves a final on an object along its support, saved and stated", async () => {
        // On its base AB, the apex C of an isosceles triangle moves on the
        // perpendicular bisector; P stays where it was in the body.
        const ISOSCELES = {
            n: "Isocèle",
            f: ["C", "t", "R"],
            m: [
                {
                    i: [["point"], ["point"]],
                    b: [
                        ["Med", "m", [0, 1]],
                        ["On", "C", [2, 2]],
                        ["Poly", "t", [0, 1, 3]],
                        ["On", "P", [2, -1]],
                        ["Mid", "R", [5, 0]],
                    ],
                    f: [3, 4, 6],
                },
            ],
        };
        const o = [
            ["Pt", "A", [-2, 0]],
            ["Pt", "B", [2, 0]],
            ["Mac", "mac1", [0, 0, [0, 1]]],
            ["Out", "C", [2, 1, 1.5]],
            ["Out", "t", [2, 2]],
            ["Out", "R", [2, 3]],
        ];
        const c = open(o, [ISOSCELES]);
        const equidistant = (on: construction) =>
            expect(
                vNorm(vSub(get(on, "C").coords, get(on, "A").coords)),
            ).toBeCloseTo(
                vNorm(vSub(get(on, "C").coords, get(on, "B").coords)),
            );
        const apex = get<point_on_object>(c, "C");
        expect(apex.alpha).toBe(1.5);
        expect(apex.moveable).toBe(true);
        expect(get(c, "R").moveable).toBe(false);
        equidistant(c);
        const before = get(c, "C").coords;
        const middle = get(c, "R").coords;
        apex.alpha = 3;
        c.invalidateGeometry(apex);
        c.flush();
        expect(get(c, "C").coords).not.toEqual(before);
        expectClose(get(c, "R").coords, middle);
        move(c, "B", [4, 1, 0]);
        equidistant(c);
        expect(apex.alpha).toBe(3);

        const saved = await describeDgo(c);
        expect(saved.o.slice(3)).toEqual([
            ["Out", "C", [2, 1, 3]],
            ["Out", "t", [2, 2]],
            ["Out", "R", [2, 3]],
        ]);
        const reopened = createConstruction([800, 600]);
        readDgo(reopened, saved);
        reopened.flush();
        expectClose(get(reopened, "C").coords, get(c, "C").coords);

        // Stated, as a point on an object.
        const view = builtView(c);
        const values = figureValues(c, view);
        expect(values.has("C")).toBe(true);
        expect(values.has("R")).toBe(false);
        apex.alpha = -2;
        c.invalidateGeometry(apex);
        c.flush();
        const state = figureState(c, values, view);
        expect(Object.keys(state)).toEqual(["C"]);
        const applied = createConstruction([800, 600]);
        readDgo(applied, stateFigure(c, saved, state));
        applied.flush();
        expectClose(get(applied, "C").coords, get(c, "C").coords);

        // Only a point on an object has a place.
        expect(() =>
            open([...o.slice(0, 4), ["Out", "t", [2, 2, 1]]], [ISOSCELES]),
        ).toThrow();
    });

    it.each([false, true])(
        "updates private intermediates when a final moves (nested: %s)",
        (nested) => {
            const macro = {
                n: "Mobile",
                f: ["C", "D"],
                m: [
                    {
                        i: [["point"], ["point"]],
                        b: [
                            ["Line", "l", [0, 1]],
                            ["Perp", "q", [2, 0]],
                            ["On", "D", [3, 2]],
                            ["Mid", "I", [0, 4]],
                            ["Mid", "C", [5, 1]],
                        ],
                        f: [6, 4],
                    },
                ],
            };
            const wrapper = {
                n: "Wrapper",
                f: ["C", "D"],
                m: [
                    {
                        i: [["point"], ["point"]],
                        b: [
                            ["Mac", "inner", [0, 0, [0, 1]]],
                            ["Out", "C", [2, 1]],
                            ["Out", "D", [2, 2]],
                        ],
                        f: [3, 4],
                    },
                ],
            };
            const c = open(
                [
                    ["Pt", "A", [0, 0]],
                    ["Pt", "B", [4, 0]],
                    ["Mac", "mac1", [nested ? 1 : 0, 0, [0, 1]]],
                    ["Out", "C", [2, 1]],
                    ["Out", "D", [2, 2]],
                    ["Mid", "M", [3, 4]],
                ],
                nested ? [macro, wrapper] : [macro],
            );
            const D = get<point_on_object>(c, "D");
            for (const alpha of [-8, 7, -2, 5]) {
                D.alpha = alpha;
                c.invalidateGeometry(D);
                c.flush();
                expectClose(get(c, "C").coords, [2, D.y / 4, 0]);
                expectClose(get(c, "M").coords, [1, (5 * D.y) / 8, 0]);
            }
        },
    );

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
        // A constant of the body.
        expect(figure(method([["C1", "X", [0, 2]]]))).not.toThrow();
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

    it("draws Apollonius's circles, built with circles of constant radius", async () => {
        const c = createConstruction();
        await importDgoFromUrl(c, "/tests/dgo/Apollonius_macro.dgo");
        const given = ["a", "b", "c"].map((name) =>
            get<primitive_circle_object>(c, name),
        );
        const finals = figureObjects(c).filter(
            (object) => object.output,
        ) as primitive_circle_object[];
        expect(finals).toHaveLength(32);
        // Of the construction's candidates, the eight that exist each touch
        // the three circles, inside or out, as they move.
        const touching = () =>
            finals.filter(({ defined }) => defined).length === 8 &&
            finals.every(
                ({ defined, CENTER, R }) =>
                    !defined ||
                    given.every((circle) => {
                        const d = vNorm(vSub(CENTER, circle.CENTER));
                        return (
                            Math.min(
                                Math.abs(d - R - circle.R),
                                Math.abs(d - Math.abs(R - circle.R)),
                            ) <
                            1e-6 * (R + circle.R)
                        );
                    }),
            );
        expect(touching()).toBe(true);
        move(c, "A", [-1000, 11000, 0]);
        expect(touching()).toBe(true);
    });
});
