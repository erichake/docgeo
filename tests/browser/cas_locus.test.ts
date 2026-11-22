import { describe, expect, it, vi } from "vitest";
// First, as in main.ts: the object classes import each other.
import "../../src/construction";
import type { construction } from "../../src/construction";
import { createConstruction, disposeFigures } from "./figures";
import { describeDgo, figureObjects, readDgo } from "../../src/dgo";
import {
    figureIndex,
    lineOf,
    resolveWithSliders,
} from "../../src/editor/figure";
import { isCommand } from "../../src/editor/catalog";
import { parseLine } from "../../src/editor/text";
import { add } from "../../src/editor/figure";
import type { algebraic_object } from "../../src/objects/algebraic_object";
import type { expression_object } from "../../src/objects/expression_object";
import type { point_on_object } from "../../src/objects/point_on_object";
import type { Vec3 } from "../../src/vec";

disposeFigures();

function figure(): construction {
    const c = createConstruction([800, 600]);
    readDgo(c, { dgo: 1, v: { o: [400, 300], u: 40, w: 800, h: 600 }, o: [] });
    return c;
}

const type = (c: construction, text: string) =>
    add(c, resolveWithSliders(c, parseLine(text, isCommand), undefined, []));

const lines = (c: construction): string[] => {
    const index = figureIndex(c);
    const objects = figureObjects(c);
    return objects.map((object) => lineOf(object, index, objects)!);
};

const points = (c: construction, name: string): Vec3[] =>
    (c.getObj(name) as algebraic_object).points.filter(
        (point): point is Vec3 => point !== null,
    );

// Until every point of the curve satisfies `on`, many of them, across the
// window: the whole curve, not its swept part.
const curve = async (
    c: construction,
    name: string,
    on: (x: number, y: number) => number,
) =>
    vi.waitFor(
        () => {
            c.flush();
            const found = points(c, name);
            expect(found.length).toBeGreaterThan(100);
            expect(
                Math.max(...found.map(([x, y]) => Math.abs(on(x, y)))),
            ).toBeLessThan(1e-3);
            expect(
                Math.max(...found.map(([x]) => Math.abs(x))),
            ).toBeGreaterThan(5);
        },
        { timeout: 20000, interval: 50 },
    );

describe("Algebraic curves", () => {
    it("are typed as equations of any degree, with no Giac", () => {
        const c = figure();
        const text = ["a = Slider(1, 5, 3)", "f = x^3 + y^3 = a x y"];
        text.forEach((line) => type(c, line));
        c.flush();
        expect(lines(c)).toEqual(text);
        // Its distance to the curve, about.
        const away = ([x, y]: Vec3, a: number) =>
            Math.abs(x ** 3 + y ** 3 - a * x * y) /
            Math.hypot(3 * x * x - a * y, 3 * y * y - a * x);
        const found = points(c, "f");
        expect(found.length).toBeGreaterThan(100);
        expect(Math.max(...found.map((p) => away(p, 3)))).toBeLessThan(1e-3);
        // Through (3/2, 3/2), the folium's loop.
        expect(
            Math.min(...found.map(([x, y]) => Math.hypot(x - 1.5, y - 1.5))),
        ).toBeLessThan(0.01);
        // A point on it, and the curve following its slider.
        type(c, "P = Point(f, 10)");
        const a = c.getObj("a") as expression_object;
        a.value = 2;
        c.invalidateGeometry(a);
        c.flush();
        expect(Math.max(...points(c, "f").map((p) => away(p, 2)))).toBeLessThan(
            1e-3,
        );
        expect(away((c.getObj("P") as point_on_object).coords, 2)).toBeLessThan(
            1e-2,
        );
        // Where it was, the view moved.
        const point = c.getObj("P") as point_on_object;
        const [x, y] = point.coords;
        c.GRID.ORG = [c.GRID.ORG[0] + 37, c.GRID.ORG[1] - 11];
        c.invalidateProjection();
        c.flush();
        expect(point.coords[0]).toBeCloseTo(x, 2);
        expect(point.coords[1]).toBeCloseTo(y, 2);
        // No line across a pole.
        type(c, "r = y = 1/x");
        expect(
            points(c, "r").filter(
                ([x, y]) => Math.abs(x) < 0.05 && Math.abs(y) < 5,
            ),
        ).toEqual([]);
        expect(points(c, "r").length).toBeGreaterThan(100);
        // A conic stays one.
        type(c, "g = x^2 + 2y^2 = 4");
        expect(lines(c).at(-1)).toBe("g = x^2 + 2y^2 = 4");
        expect(c.getObj("g")!.constructor.name).toBe("equation_conic_object");
    });

    it("are the equations of a locus or of an envelope, by Giac, kept in the file", async () => {
        const c = figure();
        const text = [
            "D = (-1, -1)",
            "G = (1, -1)",
            "s = Segment(D, G)",
            "M = Point(s, 0.5)",
            "A = (0, 3)",
            "P = Midpoint(A, M)",
            "L = LocusEquation(P, M)",
            "F = (0, 1)",
            "d = PerpendicularBisector(F, M)",
            "E = Envelope(d, M)",
        ];
        text.forEach((line) => type(c, line));
        c.flush();
        expect(lines(c)).toEqual(text);
        // Meanwhile, the swept parts.
        const widest = (name: string) =>
            Math.max(...points(c, name).map(([x]) => Math.abs(x)));
        expect(widest("L")).toBeCloseTo(0.5, 9);
        expect(widest("E")).toBeLessThan(1.01);
        await curve(c, "L", (_, y) => y - 1);
        // A parabola of focus F and directrix y = -1.
        await curve(c, "E", (x, y) => (x * x - 4 * y) / Math.hypot(2 * x, 4));
        // Another point moved: computed again.
        (c.getObj("A") as unknown as { coords: Vec3 }).coords = [0, 5, 0];
        c.invalidateGeometry(c.getObj("A")!);
        await curve(c, "L", (_, y) => y - 2);
        const saved = await describeDgo(c);
        expect(Object.keys(saved.cas!).length).toBe(2);
        const other = figure();
        readDgo(other, saved);
        other.flush();
        expect(lines(other)).toEqual(lines(c));
        await curve(other, "L", (_, y) => y - 2);
    });

    it("sums without a closed form, by the value of their bounds", async () => {
        const c = figure();
        const text = ["n = Slider(1, 10, 3)", "s = Sum(1 / k, k, 1, n)"];
        text.forEach((line) => type(c, line));
        await vi.waitFor(
            () => {
                c.flush();
                expect(c.getObj("s")!.scriptValue(false)).toBeCloseTo(
                    11 / 6,
                    12,
                );
            },
            { timeout: 20000, interval: 50 },
        );
        const n = c.getObj("n") as expression_object;
        n.value = 4;
        c.invalidateGeometry(n);
        await vi.waitFor(
            () => {
                c.flush();
                expect(c.getObj("s")!.scriptValue(false)).toBeCloseTo(
                    25 / 12,
                    12,
                );
            },
            { timeout: 20000, interval: 50 },
        );
    });
});
