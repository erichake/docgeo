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
import { casShown } from "../../src/import/dgp_formula";
import { importGgb } from "../../src/ggb_importer";
import type { expression_object } from "../../src/objects/expression_object";
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

const value = (c: construction, name: string) =>
    (c.getObj(name) as expression_object).value;

// Until Giac's answers come.
const proved = (c: construction, values: Record<string, number | null>) =>
    vi.waitFor(
        () => {
            c.flush();
            for (const [name, expected] of Object.entries(values))
                expect([name, value(c, name)]).toEqual([name, expected]);
        },
        { timeout: 20000, interval: 50 },
    );

const TRIANGLE = ["A = (-3, -1)", "B = (4, -2)", "C = (1, 3)"];

describe("Prove and its predicates", () => {
    it("decide theorems in general, and find what is true now only", async () => {
        const c = figure();
        const text = [
            ...TRIANGLE,
            "I = Midpoint(B, C)",
            "J = Midpoint(A, C)",
            "K = Midpoint(A, B)",
            "a = Line(A, I)",
            "b = Line(B, J)",
            "d = Line(C, K)",
            "p = Prove(AreConcurrent(a, b, d))",
            "q = AreConcurrent(a, b, d)",
            "G = Centroid(A, B, C)",
            "r = Prove(AreCollinear(A, B, G))",
            "s = AreCollinear(A, B, G)",
            "H = Orthocenter(A, B, C)",
            "O = Circumcenter(A, B, C)",
            "e = Prove(AreCollinear(G, H, O))",
            "u = Segment(I, J)",
            "v = Segment(A, K)",
            "f = Prove(AreEqual(u, v))",
            "h = Prove(AreCollinear(A, B, C))",
        ];
        text.forEach((line) => type(c, line));
        c.flush();
        expect(lines(c)).toEqual(text);
        // Numerically, at once.
        expect(value(c, "q")).toBe(1);
        expect(value(c, "s")).toBe(0);
        await proved(c, { p: 1, r: 0, e: 1, f: 1, h: 0 });
        expect(
            casShown((c.getObj("p") as expression_object).casNode!, String),
        ).toBe("true");
        // True now only: C on (AB), which Prove doesn't change.
        (c.getObj("C") as unknown as { coords: Vec3 }).coords = [0, -10 / 7, 0];
        c.invalidateGeometry(c.getObj("C")!);
        c.flush();
        expect(value(c, "h")).toBe(0);
        type(c, "t = AreCollinear(A, B, C)");
        c.flush();
        expect(value(c, "t")).toBe(1);
        // Its answers kept in the .dgo, read with no Giac.
        const saved = await describeDgo(c);
        expect(Object.values(saved.cas ?? {})).toContain("[[1]]");
    });

    it("prove with points on objects, the other intersection of a circle", async () => {
        const c = figure();
        const text = [
            "O = (0, 0)",
            "A = (3, 1)",
            "c = Circle(O, A)",
            "A' = Reflect(O, A)",
            "M = Point(c, 1)",
            "l = Line(M, A)",
            "m = Line(M, A')",
            "q = Prove(ArePerpendicular(l, m))",
            "B = (-1, 4)",
            "d = Line(A, B)",
            "Q = OtherIntersection(c, d, A)",
            "K = Midpoint(A, Q)",
            "k = Line(O, K)",
            "r = Prove(ArePerpendicular(k, d))",
            "D = Point(c, 2)",
            "E = Point(c, 3)",
            "s = Prove(AreConcyclic(A, M, D, E))",
            "t = AreConcyclic(A, M, D, E)",
            "w = Prove(AreConcyclic(A, M, D, B))",
        ];
        text.forEach((line) => type(c, line));
        c.flush();
        expect(lines(c)).toEqual(text);
        expect(value(c, "t")).toBe(1);
        await proved(c, { q: 1, r: 1, s: 1, w: 0 });
    });

    it("prove Simson's line and the nine-point circle", async () => {
        const c = figure();
        const text = [
            ...TRIANGLE,
            "a = Line(B, C)",
            "b = Line(A, C)",
            "d = Line(A, B)",
            "O = Circumcenter(A, B, C)",
            "c = Circle(O, A)",
            "P = Point(c, 1)",
            "e = Perpendicular(P, a)",
            "f = Perpendicular(P, b)",
            "g = Perpendicular(P, d)",
            "U = Intersection(a, e)",
            "V = Intersection(b, f)",
            "W = Intersection(d, g)",
            "s = Prove(AreCollinear(U, V, W))",
            "N = NinePointCenter(A, B, C)",
            "I = Midpoint(B, C)",
            "h = Perpendicular(A, a)",
            "F = Intersection(a, h)",
            "u = Segment(N, I)",
            "v = Segment(N, F)",
            "w = Segment(N, U)",
            "m = Prove(AreEqual(u, v))",
            "n = Prove(AreEqual(u, w))",
            "k = AreEqual(u, v)",
            "j = Prove(ArePerpendicular(h, a))",
        ];
        text.forEach((line) => type(c, line));
        c.flush();
        expect(lines(c)).toEqual(text);
        expect(value(c, "k")).toBe(1);
        await proved(c, { s: 1, m: 1, n: 0, j: 1 });
    });

    it("are imported from GeoGebra", async () => {
        const c = figure();
        const point = (label: string, x: number, y: number) =>
            `<element type="point" label="${label}"><coords x="${x}" y="${y}" z="1"/></element>`;
        const command = (
            name: string,
            inputs: string[],
            output: string,
            type: string,
        ) =>
            `<command name="${name}"><input ${inputs.map((input, index) => `a${index}="${input}"`).join(" ")}/><output a0="${output}"/></command><element type="${type}" label="${output}"/>`;
        expect(
            importGgb(
                c,
                `<geogebra><construction>
${point("A", -3, -1)}${point("B", 4, -2)}${point("C", 1, 3)}
${command("Midpoint", ["A", "B"], "M", "point")}
${command("Line", ["A", "C"], "f", "line")}
${command("Line", ["B", "C"], "g", "line")}
${command("Prove", ["AreCollinear(A, B, M)"], "p", "boolean")}
${command("AreParallel", ["f", "g"], "q", "boolean")}
</construction></geogebra>`,
            ),
        ).toEqual([]);
        c.flush();
        expect(lines(c).slice(-2)).toEqual([
            "p = Prove(AreCollinear(A, B, M))",
            "q = AreParallel(f, g)",
        ]);
        expect(value(c, "q")).toBe(0);
        await proved(c, { p: 1 });
    });
});
