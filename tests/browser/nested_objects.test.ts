import { describe, expect, it } from "vitest";
import "../../src/construction";
import type { construction } from "../../src/construction";
import { describeDgo, figureObjects, readDgo } from "../../src/dgo";
import { add, figureIndex, lineOf, resolve } from "../../src/editor/figure";
import { isCommand } from "../../src/editor/catalog";
import { parseLine, TextError } from "../../src/editor/text";
import type { point_object } from "../../src/objects/point_object";
import type { polygon_object } from "../../src/objects/polygon_object";
import type { polyhedron_object } from "../../src/objects/polyhedron_object";
import type { two_points_line_object } from "../../src/objects/two_points_line_object";
import type { Vec3 } from "../../src/vec";
import { createConstruction, disposeFigures, expectClose } from "./figures";

disposeFigures();

const type = (c: construction, source: string) =>
    add(c, resolve(c, parseLine(source, isCommand)));
const lines = (c: construction) =>
    figureObjects(c).map((object) =>
        lineOf(object, figureIndex(c), figureObjects(c)),
    );
const names = (c: construction) => figureObjects(c).map(({ name }) => name);
const coords = (c: construction, name: string) =>
    (c.getObj(name) as point_object).coords;

function scene(space: boolean, ...sources: string[]) {
    const c = createConstruction([800, 600]);
    readDgo(c, {
        dgo: 1,
        v: { o: [400, 300], u: 40, w: 800, h: 600, ...(space && { "3d": 1 }) },
        o: [],
    });
    sources.forEach((source) => type(c, source));
    return c;
}

const square = (...sources: string[]) =>
    scene(
        false,
        "A = (0, 0)",
        "B = (4, 0)",
        "C = (0, 4)",
        "D = (4, 4)",
        ...sources,
    );

const move = (c: construction, name: string, to: Vec3) => {
    const point = c.getObj(name) as point_object;
    point.coords = to;
    c.invalidateGeometry(point);
    c.flush();
};

describe("Objects written in a definition", () => {
    it("are held by the object, alone on its line, read back as typed", () => {
        const c = square(
            "I = Intersection(Line(A, D), Line(B, C))",
            "J = Intersection(Line(Midpoint(A, B), C), Line(A, D))",
            "K = Intersection(x + y = 1, Line(A, B))",
            "d = Perpendicular(A, Line(B, C))",
        );
        expect(names(c)).toEqual(["A", "B", "C", "D", "I", "J", "K", "d"]);
        expect(lines(c).slice(4)).toEqual([
            "I = Intersection(Line(A, D), Line(B, C))",
            "J = Intersection(Line(Midpoint(A, B), C), Line(A, D))",
            "K = Intersection(x + y = 1, Line(A, B))",
            "d = Perpendicular(A, Line(B, C))",
        ]);
        expectClose(coords(c, "I"), [2, 2, 0]);
        expectClose(coords(c, "K"), [1, 0, 0]);
        expect(c.getObj("D")!.children).toEqual([c.getObj("I"), c.getObj("J")]);
        // They follow what they read, those they hold included.
        move(c, "D", [4, 8, 0]);
        expectClose(coords(c, "I"), [4 / 3, 8 / 3, 0]);
        expectClose(coords(c, "J"), [1, 2, 0]);
    });

    it("are saved as their entry without name, in the entry that uses them", async () => {
        const c = square(
            "J = Intersection(Line(Midpoint(A, B), C), Line(A, D))",
        );
        const figure = await describeDgo(c);
        expect(figure.o[4][2]).toEqual([
            ["Line", [["Mid", [0, 1]], 2]],
            ["Line", [0, 3]],
            0,
        ]);
        const read = scene(false);
        readDgo(read, figure);
        expect(lines(read)[4]).toBe(
            "J = Intersection(Line(Midpoint(A, B), C), Line(A, D))",
        );
        expectClose(coords(read, "J"), [4 / 3, 4 / 3, 0]);
        // Never what is moved or edited by itself.
        const free = structuredClone(figure);
        (free.o[4][2] as unknown[])[1] = ["Pt", [0, 3]];
        expect(() => readDgo(scene(false), free)).toThrow();
    });

    it("gives a polygon the points of an expression's value, or of a list", () => {
        const c = scene(
            false,
            "A = (0, 0)",
            "c = [[1, 2], [5, 2], [3, 0]]",
            "p = Polygon(List(c))",
            "q = Polygon({(1, 2), A, (3, 0)})",
        );
        expect(lines(c).slice(2)).toEqual([
            "p = Polygon(List(c))",
            "q = Polygon({(1, 2), A, (3, 0)})",
        ]);
        expect(names(c)).toEqual(["A", "c", "p", "q"]);
        const { vertices } = c.getObj("p") as polygon_object;
        expectClose(
            vertices.map(({ coords }) => coords),
            [
                [1, 2, 0],
                [5, 2, 0],
                [3, 0, 0],
            ],
        );
    });

    it("are mapped by a transformation", () => {
        const c = square(
            "r = Rotation(A, Segment(B, D), 90°)",
            "s = Translation(Midpoint(A, B), Segment(C, D))",
        );
        expect(lines(c).slice(4)).toEqual([
            "r = Rotation(A, Segment(B, D), 90°)",
            "s = Translation(Midpoint(A, B), Segment(C, D))",
        ]);
        move(c, "B", [2, 0, 0]);
        const ends = (name: string) => {
            const { P1, P2 } = c.getObj(name) as two_points_line_object;
            return [P1.coords, P2.coords];
        };
        expectClose(ends("r"), [
            [0, 2, 0],
            [-4, 4, 0],
        ]);
        expectClose(ends("s"), [
            [1, 4, 0],
            [5, 4, 0],
        ]);
    });

    it("are refused where the object would have to name them", () => {
        const c = square(
            "c = [[1, 2], [5, 2], [3, 0]]",
            "l = Line(A, B)",
            "M = Point(l)",
        );
        for (const text of [
            "P = Vertex(Polygon(A, B, C), 1)",
            "e = Line(Vertex(Polygon(A, B, C), 2), A)",
            "Q = Element(List(c), 2)",
            'b = Checkbox("x", Line(A, B))',
            "L = Locus(Midpoint(C, M), M)",
        ])
            expect(() => type(c, text), text).toThrow(TextError);
    });

    it("builds a solid on a polygon written in its definition", () => {
        const c = scene(
            true,
            "A = (0, 0, 0)",
            "B = (4, 0, 0)",
            "C = (0, 4, 0)",
            "D = (0, 0, 4)",
            "k = Prism(Polygon(A, B, C), D)",
        );
        expect(lines(c)[4]).toBe("k = Prism(Polygon(A, B, C), D)");
        const k = c.getObj("k") as polyhedron_object;
        expect(k.defined).toBe(true);
        move(c, "B", [8, 0, 0]);
        expect(
            k.vertices.some(
                ({ coords }) =>
                    Math.abs(coords[0] - 8) < 1e-9 &&
                    Math.abs(coords[2] - 4) < 1e-9,
            ),
        ).toBe(true);
    });
});
