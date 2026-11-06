import { describe, expect, it } from "vitest";
import "../../src/construction";
import type { construction } from "../../src/construction";
import { describeDgo, figureObjects, readDgo } from "../../src/dgo";
import {
    add,
    figureIndex,
    lineOf,
    redefine,
    resolve,
} from "../../src/editor/figure";
import { accepts, isCommand, meet } from "../../src/editor/catalog";
import { crossing, meant, pick } from "../../src/editor/pick";
import { parseLine } from "../../src/editor/text";
import type { point_object } from "../../src/objects/point_object";
import type { point_on_object } from "../../src/objects/point_on_object";
import type { polygon_object } from "../../src/objects/polygon_object";
import { polyhedronFace } from "../../src/objects/polygon_part";
import type { polyhedron_object } from "../../src/objects/polyhedron_object";
import type { primitive_line_object } from "../../src/objects/primitive_line_object";
import { vScale, type Vec3 } from "../../src/vec";
import { createConstruction, disposeFigures, expectClose } from "./figures";

disposeFigures();

const type = (c: construction, source: string) =>
    add(c, resolve(c, parseLine(source, isCommand)));
const point = (c: construction, name: string) => c.getObj(name) as point_object;

function space(...sources: string[]): construction {
    const c = createConstruction([800, 600]);
    readDgo(c, {
        dgo: 1,
        v: { o: [400, 300], u: 40, w: 800, h: 600, "3d": 1 },
        o: [],
    });
    sources.forEach((source) => type(c, source));
    // Seen from aside and above.
    c.GRID.THETA = 0.4;
    c.GRID.PHI = 0.6;
    c.invalidateProjection();
    c.flush();
    return c;
}

// The prism on the triangle ABC, from z = 0 to z = 4: 1 is its base, 2 to 4
// its sides, 5 its top.
const prism = (...sources: string[]) =>
    space(
        "A = (0, 0, 0)",
        "B = (4, 0, 0)",
        "C = (0, 4, 0)",
        "p = Polygon(A, B, C)",
        "D = (0, 0, 4)",
        "k = Prism(p, D)",
        ...sources,
    );

describe("Faces of polyhedra", () => {
    it("gives the vertices of each face, its own computed ones included", () => {
        const c = prism();
        const solid = c.getObj("k") as polyhedron_object;
        const top = polyhedronFace(solid, 5);
        expect(top.defined).toBe(true);
        expect(top.points.map((vertex) => vertex.coords)).toEqual([
            [0, 0, 4],
            [4, 0, 4],
            [0, 4, 4],
        ]);
        expect(top.reference).toEqual({ owner: solid, kind: "face", rank: 5 });
        expect(polyhedronFace(solid, 5)).toBe(top);
        expect(polyhedronFace(solid, 6).defined).toBe(false);
        expect(figureObjects(c)).not.toContain(top);
    });

    it("puts a point on a face, kept inside it and following the solid", () => {
        const c = prism("M = Point(Face(k, 5), 0.25, 0.25)");
        const m = c.getObj("M") as point_on_object;
        expectClose(m.coords, [1, 1, 4]);
        point(c, "D").coords = [0, 0, 6];
        c.invalidateGeometry(point(c, "D"));
        c.flush();
        expectClose(m.coords, [1, 1, 6]);
        const alpha = m.alphaFor([9, 9, 6]);
        expect(alpha).not.toBeNull();
        m.alpha = alpha!;
        m.computeGeometry();
        // Pulled back on its hypotenuse.
        expect(m.coords[0] + m.coords[1]).toBeCloseTo(4);
        expect(m.coords[2]).toBeCloseTo(6);
    });

    it("takes a face and a polygon as a plane in the tools of space", () => {
        const c = prism(
            "O = (1, 1, 7)",
            "n = Perpendicular(O, Face(k, 5))",
            "q = ParallelPlane(O, Face(k, 2))",
            "g = Perpendicular(O, p)",
            "t = Section(k, Face(k, 5))",
        );
        const n = c.getObj("n") as primitive_line_object;
        expectClose(vScale(n.VEC, Math.sign(n.VEC[2])), [0, 0, 1]);
        const g = c.getObj("g") as primitive_line_object;
        expectClose(vScale(g.VEC, Math.sign(g.VEC[2])), [0, 0, 1]);
        const plane = c.getObj("q") as polygon_object;
        expectClose(
            vScale(plane.NORMAL, Math.sign(plane.NORMAL[1])),
            [0, 1, 0],
        );
        expect(c.getObj("t")!.defined).toBe(true);
    });

    it("refuses a polygon as a plane in the plane", () => {
        const c = createConstruction([800, 600]);
        readDgo(c, {
            dgo: 1,
            v: { o: [400, 300], u: 40, w: 800, h: 600 },
            o: [],
        });
        [
            "A = (0, 0)",
            "B = (2, 0)",
            "C = (0, 2)",
            "p = Polygon(A, B, C)",
        ].forEach((source) => type(c, source));
        expect(accepts(c.getObj("p")!, "plane")).toBe(false);
        expect(() => type(c, "n = Perpendicular(A, p)")).toThrow();
    });

    it("meets a line only inside the face, as a plane everywhere", () => {
        const c = prism(
            "E = (1, 1, 9)",
            "F = (1, 1, 8)",
            "d = Line(E, F)",
            "I = Intersection(d, Face(k, 5))",
            "G = (9, 9, 9)",
            "H = (9, 9, 8)",
            "e = Line(G, H)",
            "J = Intersection(e, Face(k, 5))",
            "r = Plane(A, B, C)",
            "K = Intersection(e, r)",
            "l = Line(A, D)",
            "L = Intersection(l, Face(k, 5))",
        );
        expectClose(point(c, "I").coords, [1, 1, 4]);
        expect(point(c, "J").defined).toBe(false);
        expectClose(point(c, "K").coords, [9, 9, 0]);
        // Through a vertex of the face.
        expectClose(point(c, "L").coords, [0, 0, 4]);
    });

    it("has no meeting of a line lying in the face", () => {
        const c = prism(
            "E = (1, 1, 4)",
            "F = (2, 1, 4)",
            "d = Line(E, F)",
            "I = Intersection(d, Face(k, 5))",
        );
        expect(point(c, "I").defined).toBe(false);
    });

    it("designates the face seen, but its polyhedron when both are taken", () => {
        const c = space(
            "A = (-2, -2, 0)",
            "B = (2, -2, 0)",
            "C = (2, 2, 0)",
            "k = Cube(A, B, C)",
        );
        const solid = c.getObj("k") as polyhedron_object;
        const screen = c.pt3D([0, 0, 4]);
        const hits = pick(c, screen);
        const face = hits.find(
            ({ object }) => object.reference?.kind === "face",
        )!;
        expect(face.object.reference!.owner).toBe(solid);
        expectClose(face.at, [0, 0, 4]);
        expect(meant(hits).map(({ object }) => object)).toEqual([solid]);
        expect(meant([face]).map(({ object }) => object)).toEqual([
            face.object,
        ]);
        // Only its front one, as seen from above.
        expect(
            (face.object as polygon_object).points.every(
                (vertex) => vertex.coords[2] === 4,
            ),
        ).toBe(true);
    });

    it("makes the point where a line pierces a face", () => {
        const c = prism("E = (1, 1, 9)", "F = (1, 1, 8)", "d = Line(E, F)");
        const solid = c.getObj("k") as polyhedron_object;
        const d = c.getObj("d")!;
        const top = polyhedronFace(solid, 5);
        expect(meet(d, top)).toBe(true);
        expect(meet(c.getObj("p")!, top)).toBe(false);
        const at: Vec3 = [1, 1, 4];
        const screen = c.pt3D(at);
        const hits = pick(c, screen);
        const cross = crossing(c, screen, hits);
        expect(cross?.a === d || cross?.b === d).toBe(true);
    });

    it("writes, reads and types the faces as references", async () => {
        const c = prism(
            "O = (1, 1, 7)",
            "n = Perpendicular(O, Face(k, 5))",
            "M = Point(Face(k, 5), 0.25, 0.25)",
        );
        const studio = { scene: c, prefs: c.prefs };
        const saved = await describeDgo(c);
        const entries = (saved as { o: unknown[][] }).o;
        expect(entries.find((entry) => entry[1] === "n")![2]).toEqual([
            ["face", 4 + 1, 5],
            6,
        ]);
        const copy = createConstruction([800, 600]);
        readDgo(copy, saved);
        expectClose(point(copy, "M").coords, [1, 1, 4]);
        expect(await describeDgo(copy)).toEqual(saved);
        expect(
            figureObjects(c).map((object) =>
                lineOf(object, figureIndex(c), figureObjects(c)),
            ),
        ).toContain("n = Perpendicular(O, Face(k, 5))");
        const target = c.getObj("k")!;
        await redefine(
            studio,
            target,
            resolve(c, parseLine("k = Pyramid(p, D)", isCommand), target),
        );
        expect(studio.scene.getObj("M")!.defined).toBe(false);
    });

    it("refuses faces of what has none, and parts of a face, in a file and typed", () => {
        const c = prism();
        expect(() => type(c, "n = Perpendicular(A, Face(p, 1))")).toThrow();
        expect(() => type(c, "m = Midpoint(Side(Face(k, 5), 1))")).toThrow();
        for (const ref of [
            ["face", 0, 1],
            ["face", 3, 1],
            ["face", 4, 0],
            ["face", ["face", 4, 1], 1],
            ["side", ["face", 4, 1], 1],
        ]) {
            const other = createConstruction([800, 600]);
            expect(() =>
                readDgo(other, {
                    dgo: 1,
                    v: { o: [400, 300], u: 40, w: 800, h: 600, "3d": 1 },
                    o: [
                        ["Pt", "A", [0, 0, 0]],
                        ["Pt", "B", [1, 0, 0]],
                        ["Pt", "C", [0, 1, 0]],
                        ["Poly", "p", [0, 1, 2]],
                        ["Pyr", "k", [3, 0]],
                        ["Nrm", "n", [ref, 0]],
                    ],
                }),
            ).toThrow();
        }
    });
});
