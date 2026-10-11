import { describe, expect, it } from "vitest";
// First, as in main.ts: the object classes import each other.
import "../../src/construction";
import type { construction } from "../../src/construction";
import { describeDgo, figureObjects, readDgo } from "../../src/dgo";
import {
    add,
    addPointOn,
    figureIndex,
    lineOf,
    redefine,
    resolve,
    type Studio,
} from "../../src/editor/figure";
import { pick } from "../../src/editor/pick";
import { parseLine, TextError } from "../../src/editor/text";
import type { point_object } from "../../src/objects/point_object";
import { createConstruction, disposeFigures, expectClose } from "./figures";

disposeFigures();

function studio(space = false): Studio {
    const scene = createConstruction([800, 600]);
    readDgo(scene, {
        dgo: 1,
        v: { o: [400, 300], u: 40, w: 800, h: 600, ...(space && { "3d": 1 }) },
        o: [],
    });
    return { prefs: scene.prefs, scene };
}

const type = (c: construction, text: string) =>
    add(c, resolve(c, parseLine(text)));

const lines = (c: construction): string[] => {
    const index = figureIndex(c);
    const objects = figureObjects(c);
    return objects.map((object) => lineOf(object, index, objects)!);
};

describe("Editor", () => {
    it("writes back the line of each command", async () => {
        const { scene: c } = studio();
        const text = [
            "A = (-2, 0)",
            "B = (3, 1)",
            "C = (1, 4)",
            "D = (-3, 3)",
            "E = (0, -3)",
            "s = Segment(A, B)",
            "d = Line(A, C)",
            "r = Ray(B, C)",
            "u = Vector(C, D)",
            "M = Midpoint(A, B)",
            "m = PerpendicularBisector(B, C)",
            "p = Perpendicular(D, d)",
            "q = Parallel(E, d)",
            "b = AngleBisector(A, B, C)",
            "c = Circle(A, B)",
            "f = Circle(E, 1.5)",
            "g = Circle(A, B, C)",
            "h = Compass(A, B, E)",
            "j = Arc(A, C, D)",
            "n = Sector(B, C, D)",
            "O = Center(g)",
            "F = Intersection(d, q)",
            "G = Intersection(c, d, 2)",
            "H = Intersection(c, d, 1, B)",
            "P = Point(c, 0.5)",
            "Q = Point(s, 0.25)",
            "v = Polygon(A, B, C, D)",
            "R = Point(v, 0.5, 0.5)",
            "w = Angle(A, B, C)",
            "S = Reflect(D, A)",
            "T = Reflect(D, d)",
            "a = Conic(A, B, C, D, E)",
            "U = FixedPoint(1, 1)",
            "l = Locus(M, P)",
        ];
        text.forEach((line) => type(c, line));
        c.flush();
        expect(lines(c)).toEqual(text);
        // Saved and read, the same text.
        const other = createConstruction([800, 600]);
        readDgo(other, await describeDgo(c));
        expect(lines(other)).toEqual(text);
    });

    it("names objects, and refuses wrong lines", () => {
        const { scene: c } = studio();
        expect(type(c, "(1, 2)").name).toBe("A");
        expect(type(c, "(2, 2)").name).toBe("B");
        expect(type(c, "Segment(A, B)").name).toBe("a");
        expect(type(c, "Milieu(A, B)").name).toBe("C");
        for (const [text, key] of [
            ["Segment(A, Z)", "unknown_object"],
            ["Unknown(A, B)", "unknown_command"],
            ["Circle(a, A)", "arguments"],
            ["Intersection(a, a, 5)", "branch"],
            ["A = (3, 3)", "name_taken"],
        ])
            expect(() => resolve(c, parseLine(text)), text).toThrow(
                expect.objectContaining({ key }),
            );
    });

    it("redefines an object, after the ones it is built from", async () => {
        const studied = studio();
        const c = studied.scene;
        ["A = (-2, 0)", "B = (3, 1)", "d = Line(A, B)", "O = (0, -1)"].forEach(
            (line) => type(c, line),
        );
        const line = parseLine("A = Midpoint(B, O)");
        await redefine(
            studied,
            c.getObj("A")!,
            resolve(c, line, c.getObj("A")),
        );
        const scene = studied.scene;
        expect(lines(scene)).toEqual([
            "B = (3, 1)",
            "O = (0, -1)",
            "A = Midpoint(B, O)",
            "d = Line(A, B)",
        ]);
        expectClose((scene.getObj("A") as point_object).coords, [1.5, 0, 0]);
        // Nor on itself, nor on what is built from it.
        const cycle = parseLine("B = Midpoint(A, O)");
        await expect(
            redefine(
                studied,
                scene.getObj("B")!,
                resolve(scene, cycle, scene.getObj("B")),
            ),
        ).rejects.toThrow(TextError);
        // Renamed, and in space.
        const renamed = parseLine("K = (1, 2, 3)");
        await redefine(
            studied,
            scene.getObj("O")!,
            resolve(scene, renamed, scene.getObj("O")),
        );
        expect(lines(studied.scene)).toEqual([
            "B = (3, 1)",
            "K = (1, 2, 3)",
            "A = Midpoint(B, K)",
            "d = Line(A, B)",
        ]);
    });

    it("designates the objects under the pointer, points first", () => {
        const { scene: c } = studio();
        [
            "A = (0, 0)",
            "B = (4, 0)",
            "s = Segment(A, B)",
            "c = Circle(A, B)",
        ].forEach((line) => type(c, line));
        c.flush();
        // A at (400, 300), B at (560, 300).
        expect(pick(c, [403, 301]).map(({ object }) => object.name)).toEqual([
            "A",
            "s",
        ]);
        expect(pick(c, [480, 305]).map(({ object }) => object.name)).toEqual([
            "s",
        ]);
        const [hit] = pick(c, [400, 142]);
        expect(hit.object.name).toBe("c");
        const point = addPointOn(c, "P", hit.object, hit.at);
        expectClose(point.coords, [0, 4, 0]);
        expect(pick(c, [400, 200])).toEqual([]);
    });
});
