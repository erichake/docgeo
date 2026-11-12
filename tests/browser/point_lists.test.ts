import { describe, expect, it } from "vitest";
import "../../src/construction";
import type { construction } from "../../src/construction";
import { describeDgo, figureObjects, readDgo } from "../../src/dgo";
import { add, figureIndex, lineOf, resolve } from "../../src/editor/figure";
import { isCommand } from "../../src/editor/catalog";
import { parseLine, TextError } from "../../src/editor/text";
import type { expression_object } from "../../src/objects/expression_object";
import type { list_object } from "../../src/objects/list_object";
import type { point_list_object } from "../../src/objects/point_list_object";
import type { point_object } from "../../src/objects/point_object";
import type { polygon_object } from "../../src/objects/polygon_object";
import type { primitive_line_object } from "../../src/objects/primitive_line_object";
import type { two_points_line_object } from "../../src/objects/two_points_line_object";
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

describe("Lists of points", () => {
    it("writes one between braces, of coordinates and formulas", () => {
        const c = scene();
        type(c, "A = (0, 0)");
        type(c, "L = {(1, 2), (3, 4), (5, 1)}");
        type(c, "M = {A, (1, 2), Point(A + [1, 0])}");
        expect(lines(c)).toEqual([
            "A = (0, 0)",
            "L = {(1, 2), (3, 4), (5, 1)}",
            "M = {A, (1, 2), A + [1, 0]}",
        ]);
        const A = c.getObj("A") as point_object;
        A.coords = [2, 3, 0];
        c.invalidateGeometry(A);
        c.flush();
        const M = c.getObj("M") as list_object;
        expect(M.count).toBe(3);
        expectClose(M.pointAt(2), [3, 3, 0]);
    });

    it("makes a polygon of a list, as many vertices as it has", () => {
        const c = scene();
        type(c, "L = {(1, 2), (3, 4), (5, 1)}");
        type(c, "p = Polygon(L)");
        type(c, "n = 3");
        type(c, "S = Sequence((k, k*k/4), k, 0, n)");
        type(c, "q = Polygon(S)");
        expect(lines(c).filter((line) => /^[pq] /.test(line!))).toEqual([
            "p = Polygon(L)",
            "q = Polygon(S)",
        ]);
        expectClose((c.getObj("p") as polygon_object).area, 5);
        const q = c.getObj("q") as polygon_object;
        expect(q.points).toHaveLength(4);
        const n = c.getObj("n") as expression_object;
        n.value = 5;
        c.invalidateGeometry(n);
        c.flush();
        expect(q.points).toHaveLength(6);
        expectClose(q.points[5].coords, [5, 6.25, 0]);
    });

    it("takes a point of a list where a point is, written as Element", () => {
        const c = scene();
        type(c, "L = {(1, 2), (3, 4), (5, 1)}");
        type(c, "d = Line(L(1), Element(L, 3))");
        type(c, "P = Element(L, 2)");
        expect(lines(c).slice(1)).toEqual([
            "d = Line(Element(L, 1), Element(L, 3))",
            "P = Element(L, 2)",
        ]);
        expect(figureObjects(c)).toHaveLength(3);
        expectClose((c.getObj("P") as point_object).coords, [3, 4, 0]);
        const { P1 } = c.getObj("d") as primitive_line_object;
        expectClose(P1.coords, [1, 2, 0]);
        expect(c.getObj("L")!.children).toEqual([c.getObj("d"), c.getObj("P")]);
        expect(() => type(c, "e = Line(Element(d, 1), (0, 0))")).toThrow(
            TextError,
        );
    });

    it("saves and reads them back", async () => {
        const c = scene();
        [
            "A = (0, 0)",
            "L = {A, (3, 4), (5, 1)}",
            "p = Polygon(L)",
            "d = Line(L(1), L(2))",
        ].forEach((line) => type(c, line));
        const figure = await describeDgo(c);
        expect(figure.o.slice(1).map((entry) => entry.slice(0, 3))).toEqual([
            ["Pts", "L", [["A", { A: 0 }], "[3, 4]", "[5, 1]"]],
            ["PolyL", "p", [1]],
            [
                "Line",
                "d",
                [
                    ["Fp", ["L[(1)-1]", { L: 1 }]],
                    ["Fp", ["L[(2)-1]", { L: 1 }]],
                ],
            ],
        ]);
        const read = scene();
        readDgo(read, figure);
        expect(lines(read)).toEqual(lines(c));
    });
});

describe("Lists of lists", () => {
    const LISTS =
        "c = {{(2, 0), (1, 0.8), (0, 1)}, {(2, 3), (1, 3.8), (0, 4), (-2, 0)}}";

    it("writes them between braces, or of lists a formula gives", () => {
        const c = scene();
        type(c, LISTS);
        type(c, "a = {(2, 0), (1, 0.8), (0, 1)}");
        type(c, "b = {(2, 3), (1, 3.8)}");
        type(c, "d = {a, b, (5, 5)}");
        expect(lines(c)).toEqual([
            LISTS,
            "a = {(2, 0), (1, 0.8), (0, 1)}",
            "b = {(2, 3), (1, 3.8)}",
            "d = {a, b, (5, 5)}",
        ]);
        const lists = c.getObj("c") as point_list_object;
        expect(lists.nested).toBe(true);
        expect(lists.count).toBe(7);
        expect(lists.values[1]).toEqual([
            [2, 3],
            [1, 3.8],
            [0, 4],
            [-2, 0],
        ]);
        const d = c.getObj("d") as point_list_object;
        expect(d.nested).toBe(true);
        expect(d.count).toBe(6);
        expect((c.getObj("a") as point_list_object).nested).toBe(false);
        type(c, "e = Line(d[0][1], d[1][0])");
        const { P1, P2 } = c.getObj("e") as two_points_line_object;
        expectClose(P1.coords, [1, 0.8, 0]);
        expectClose(P2.coords, [2, 3, 0]);
    });

    it("takes a list of it, or a point, written as Element", () => {
        const c = scene();
        type(c, LISTS);
        type(c, "L = Element(c, 2)");
        type(c, "p = Polygon(L)");
        type(c, "q = Polygon(Element(c, 1))");
        type(c, "P = Element(c, 2, 3)");
        type(c, "d = Line(Element(c, 1, 1), Element(c, 2, 1))");
        type(c, "r = Polygon(c(1))");
        expect(lines(c).slice(1)).toEqual([
            "L = Element(c, 2)",
            "p = Polygon(L)",
            "q = Polygon(Element(c, 1))",
            "P = Element(c, 2, 3)",
            "d = Line(Element(c, 1, 1), Element(c, 2, 1))",
            "r = Polygon(Element(c, 1))",
        ]);
        expect((c.getObj("L") as point_list_object).count).toBe(4);
        expectClose((c.getObj("p") as polygon_object).area, 5.3);
        expectClose((c.getObj("q") as polygon_object).area, 0.3);
        expectClose((c.getObj("P") as point_object).coords, [0, 4, 0]);
        const { P1, P2 } = c.getObj("d") as two_points_line_object;
        expectClose(P1.coords, [2, 0, 0]);
        expectClose(P2.coords, [2, 3, 0]);
        for (const line of [
            "s = Polygon(c)",
            "P = Element(c, 1, 1, 1)",
            "P = Element(L, 1, 1)",
            "s = Line(c(1), (0, 0))",
        ])
            expect(() => type(c, line)).toThrow(TextError);
    });

    it("saves and reads them back", async () => {
        const c = scene();
        [
            "A = (0, 0)",
            "c = {{A, (1, 0), (0, 1)}, {(2, 3)}}",
            "L = Element(c, 1)",
            "q = Polygon(Element(c, 1))",
            "d = Line(Element(c, 1, 2), Element(c, 2, 1))",
        ].forEach((line) => type(c, line));
        const figure = await describeDgo(c);
        expect(figure.o.slice(1).map((entry) => entry.slice(0, 3))).toEqual([
            ["Pts", "c", [[["A", { A: 0 }], "[1, 0]", "[0, 1]"], ["[2, 3]"]]],
            ["Fl", "L", [["c[(1)-1]", { c: 1 }]]],
            ["PolyL", "q", [["Fl", ["c[(1)-1]", { c: 1 }]]]],
            [
                "Line",
                "d",
                [
                    ["Fp", ["c[(1)-1][(2)-1]", { c: 1 }]],
                    ["Fp", ["c[(2)-1][(1)-1]", { c: 1 }]],
                ],
            ],
        ]);
        const read = scene();
        readDgo(read, figure);
        expect(lines(read)).toEqual(lines(c));
        expectClose((read.getObj("q") as polygon_object).area, 0.5);
    });
});
