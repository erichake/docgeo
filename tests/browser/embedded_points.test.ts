import { describe, expect, it } from "vitest";
import "../../src/construction";
import type { construction } from "../../src/construction";
import { describeDgo, figureObjects, readDgo } from "../../src/dgo";
import { add, figureIndex, lineOf, resolve } from "../../src/editor/figure";
import { isCommand } from "../../src/editor/catalog";
import { parseLine, TextError } from "../../src/editor/text";
import { pointsDrag } from "../../src/objects/drag_points";
import type { expression_object } from "../../src/objects/expression_object";
import type { point_object } from "../../src/objects/point_object";
import type { primitive_line_object } from "../../src/objects/primitive_line_object";
import type { primitive_quadric_object } from "../../src/objects/primitive_quadric_object";
import { createConstruction, disposeFigures, expectClose } from "./figures";

disposeFigures();

const type = (c: construction, source: string) =>
    add(c, resolve(c, parseLine(source, isCommand)));
const lines = (c: construction) =>
    figureObjects(c).map((object) =>
        lineOf(object, figureIndex(c), figureObjects(c)),
    );

function scene() {
    const c = createConstruction([800, 600]);
    readDgo(c, {
        dgo: 1,
        v: { o: [400, 300], u: 40, w: 800, h: 600 },
        o: [],
    });
    return c;
}

// Where the line is: a point and its direction.
const through = (c: construction, name: string) => {
    const { P1, VEC } = c.getObj(name) as primitive_line_object;
    return { at: P1.coords, direction: VEC };
};

describe("Points written in a definition", () => {
    it("builds a line on coordinates, alone in the figure, read back as typed", () => {
        const c = scene();
        type(c, "d = Line((0, 7), (1, 7))");
        expect(figureObjects(c).map(({ name }) => name)).toEqual(["d"]);
        expect(lines(c)).toEqual(["d = Line((0, 7), (1, 7))"]);
        const { at, direction } = through(c, "d");
        expectClose(at, [0, 7, 0]);
        expectClose(direction[1], 0);
    });

    it("takes a formula whose value is a point, as an item of a list of coordinates", () => {
        const c = scene();
        type(c, "a = [[2, 0], [1, 0.8], [0, 1]]");
        type(c, "d = Line(a[0], a[1])");
        expect(lines(c)).toEqual([
            "a = [[2, 0], [1, 0.8], [0, 1]]",
            "d = Line(Point(a[0]), Point(a[1]))",
        ]);
        const { at, direction } = through(c, "d");
        expectClose(at, [2, 0, 0]);
        expectClose(direction[1] / direction[0], -0.8);
        expect(() => type(c, "e = Line(a[0][0], a[1])")).toThrow(TextError);
    });

    it("takes them in any command's point, a conic's five included", () => {
        const c = scene();
        type(c, "c = Conic((1, 2), (3, 4), (3, 1), (5, 1), (-2, 2))");
        type(c, "s = Segment((0, 0), (3; 90°))");
        expect(lines(c)).toEqual([
            "c = Conic((1, 2), (3, 4), (3, 1), (5, 1), (-2, 2))",
            "s = Segment((0, 0), (3; 90°))",
        ]);
        expect((c.getObj("c") as primitive_quadric_object).defined).toBe(true);
    });

    it("follows the objects its formulas read, and is fixed otherwise", () => {
        const c = scene();
        type(c, "k = 2");
        type(c, "A = (1, 1)");
        type(c, "e = Line((0, k), (1, k))");
        type(c, "m = Line(A, Point(A + [2, 0]))");
        type(c, "n = Line(A, (3, 5))");
        expect(lines(c).slice(2)).toEqual([
            "e = Line((0, k), (1, k))",
            "m = Line(A, Point(A + [2, 0]))",
            "n = Line(A, (3, 5))",
        ]);
        const k = c.getObj("k") as expression_object;
        k.value = -3;
        c.invalidateGeometry(k);
        const A = c.getObj("A") as point_object;
        A.coords = [3, 1, 0];
        c.invalidateGeometry(A);
        c.flush();
        expectClose(through(c, "e").at, [0, -3, 0]);
        expectClose(through(c, "m").direction[1], 0);
        // Through A and (3, 5), vertical now.
        expectClose(through(c, "n").direction[0], 0);
        // A point of its definition holds it: dragging it moves nothing.
        const [, grab] = pointsDrag(c.getObj("n")!);
        expect(grab(new PointerEvent("pointerdown"))).toBe(false);
    });

    it("saves them in the entry that uses them", async () => {
        const c = scene();
        type(c, "k = 2");
        type(c, "e = Line((0, 7), (1, k))");
        const figure = await describeDgo(c);
        expect(figure.o[1][2]).toEqual([
            ["Fp", "[0, 7]"],
            ["Fp", ["[1, k]", { k: 0 }]],
        ]);
        const read = scene();
        readDgo(read, figure);
        expect(lines(read)).toEqual(["k = 2", "e = Line((0, 7), (1, k))"]);
        expect(read.getObj("k")!.children).toEqual([read.getObj("e")]);
    });

    it("is only taken where a point is", () => {
        const c = scene();
        type(c, "u = (1, 1)");
        expect(() => type(c, "t = Translation((1, 2), u)")).toThrow(TextError);
    });
});
