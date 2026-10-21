import { describe, expect, it } from "vitest";
import "../../src/construction";
import type { construction } from "../../src/construction";
import {
    describeDgo,
    figureObjects,
    importDgoFromBlob,
    readDgo,
    writeDgo,
} from "../../src/dgo";
import {
    add,
    addPointOn,
    figureIndex,
    lineOf,
    redefine,
    resolve,
    resolveWithSliders,
} from "../../src/editor/figure";
import { accepts, isCommand } from "../../src/editor/catalog";
import { meant, pick } from "../../src/editor/pick";
import { completionAt, parseLine } from "../../src/editor/text";
import { polygonSide } from "../../src/objects/polygon_part";
import type { point_object } from "../../src/objects/point_object";
import type { polygon_object } from "../../src/objects/polygon_object";
import { vAdd, vScale } from "../../src/vec";
import { createConstruction, disposeFigures, expectClose } from "./figures";

disposeFigures();

const type = (c: construction, source: string) =>
    add(c, resolve(c, parseLine(source, isCommand)));
const point = (c: construction, name: string) => c.getObj(name) as point_object;
const lines = (c: construction) =>
    figureObjects(c).map((object) =>
        lineOf(object, figureIndex(c), figureObjects(c)),
    );

function figure(regular = false) {
    const scene = createConstruction([800, 600]);
    readDgo(scene, {
        dgo: 1,
        v: { o: [400, 300], u: 40, w: 800, h: 600 },
        o: [],
    });
    [
        "A = (-2, 0)",
        "B = (2, 0)",
        "C = (2, 3)",
        "D = (-2, 3)",
        regular ? "p = RegularPolygon(A, B, 4)" : "p = Polygon(A, B, C, D)",
    ].forEach((source) => type(scene, source));
    return { scene, prefs: scene.prefs };
}

describe("Virtual polygon sides", () => {
    it("picks an individual side on either side of the outline, keeping vertices and interiors", () => {
        const { scene: c } = figure();
        const polygon = c.getObj("p") as polygon_object;
        const objects = [...figureObjects(c)];
        const children = [...polygon.children];
        for (const y of [-0.1, 0.1]) {
            const hits = pick(c, c.pt3D([0, y, 0]));
            const [hit] = meant(hits);
            expect(hit.object).toBe(polygonSide(polygon, 1));
            expect(accepts(hit.object, "segment")).toBe(true);
            expect(accepts(hit.object, "line")).toBe(true);
            expect(meant(hits)).toHaveLength(1);
        }
        expect(pick(c, point(c, "A").screen)[0].object).toBe(point(c, "A"));
        expect(pick(c, c.pt3D([0, 1, 0]))[0].object).toBe(polygon);
        expect(
            pick(c, c.pt3D([0, 0.1, 0]), new Set(), 12, false)[0].object,
        ).toBe(polygon);
        expect(polygon.children).toEqual(children);
        expect(figureObjects(c)).toEqual(objects);
        expect(
            [...polygon.virtualParts!.values()].every((part) => !part.hasView),
        ).toBe(true);
        const segment = type(c, "s = Segment(A, B)");
        expect(
            meant(pick(c, c.pt3D([0, 0.1, 0]))).map(({ object }) => object),
        ).toEqual([segment, polygon]);
        c.removeObject(segment);
        polygon.hidden = 1;
        expect(pick(c, c.pt3D([0, 0, 0]))).toEqual([]);
    });

    it("keeps the geometry and projection of sides in space", async () => {
        const c = createConstruction([800, 600]);
        readDgo(c, {
            dgo: 1,
            v: { o: [400, 300], u: 40, w: 800, h: 600, "3d": 1 },
            o: [],
        });
        [
            "A = (0, 0, 0)",
            "B = (2, 1, 3)",
            "C = (0, 4, 2)",
            "p = Polygon(A, B, C)",
            "O = (1, 3, 2)",
            "M = Midpoint(Side(p, 1))",
            "P = Point(Side(p, 1), 0.25)",
            "d = Parallel(O, Side(p, 1))",
        ].forEach((source) => type(c, source));
        c.flush();
        const polygon = c.getObj("p") as polygon_object;
        const side = polygonSide(polygon, 1);
        expectClose(point(c, "M").coords, [1, 0.5, 1.5]);
        expectClose(point(c, "P").coords, [0.5, 0.25, 0.75]);
        expectClose(side.P2.screen, point(c, "B").screen);
        expect(side.flat).toBe(polygon.flat);
        c.GRID.PHI += 0.4;
        c.invalidateProjection();
        c.flush();
        expectClose(side.P2.screen, point(c, "B").screen);
        const copy = createConstruction([800, 600]);
        readDgo(copy, await describeDgo(c));
        expectClose(point(copy, "P").coords, point(c, "P").coords);
    });

    it("uses sides in tools, tracks movement and saves no auxiliary construction objects", async () => {
        const { scene: c } = figure();
        const sources = [
            "O = (0, 2)",
            "N = (0, -1)",
            "q = Line(O, N)",
            "M = Midpoint(Side(p, 1))",
            "m = PerpendicularBisector(Side(p, 1))",
            "d = Parallel(O, Side(p, 1))",
            "e = Perpendicular(O, Side(p, 1))",
            "R = Reflect(O, Side(p, 1))",
            "P = Point(Side(p, 1), 0.25)",
            "I = Intersection(Side(p, 1), q)",
        ];
        sources.forEach((source) => type(c, source));
        c.flush();
        expect(lines(c).slice(-sources.length)).toEqual(sources);
        expectClose(point(c, "M").coords, [0, 0, 0]);
        expectClose(point(c, "P").coords, [-1, 0, 0]);
        expectClose(point(c, "R").coords, [0, -2, 0]);
        expectClose(point(c, "I").coords, [0, 0, 0]);
        expect(point(c, "M").parents).toEqual([c.getObj("p")]);
        point(c, "B").coords = [4, 0, 0];
        c.invalidateGeometry(point(c, "B"));
        c.flush();
        expectClose(point(c, "M").coords, [1, 0, 0]);
        expectClose(point(c, "P").coords, [-0.5, 0, 0]);
        const saved = await describeDgo(c);
        expect(saved.o).toHaveLength(5 + sources.length);
        expect(saved.o.some((entry) => entry[0] === "Seg")).toBe(false);
        const other = createConstruction([800, 600]);
        await importDgoFromBlob(other, await writeDgo(c));
        expect(await describeDgo(other)).toEqual(saved);
        expect(lines(other)).toEqual(lines(c));
        expectClose(point(other, "P").coords, point(c, "P").coords);
        c.removeObject(c.getObj("p")!);
        expect(figureObjects(c).map(({ name }) => name)).toEqual([
            "A",
            "B",
            "C",
            "D",
            "O",
            "N",
            "q",
        ]);
    });

    it("keeps a side's rank through regular-polygon redefinition and recovers missing sides", async () => {
        const studied = figure(true);
        [
            "M = Midpoint(Side(p, 4))",
            "P = Point(Side(p, 4), 0.25)",
            "m = PerpendicularBisector(Side(p, 4))",
        ].forEach((source) => type(studied.scene, source));
        const change = async (n: number) => {
            const target = studied.scene.getObj("p")!;
            await redefine(
                studied,
                target,
                resolve(
                    studied.scene,
                    parseLine(`p = RegularPolygon(A, B, ${n})`, isCommand),
                    target,
                ),
            );
        };
        await change(5);
        const polygon = studied.scene.getObj("p") as polygon_object;
        expectClose(
            point(studied.scene, "M").coords,
            vScale(
                vAdd(polygon.points[3].coords, polygon.points[4].coords),
                0.5,
            ),
        );
        expect(lines(studied.scene).slice(-3)).toEqual([
            "M = Midpoint(Side(p, 4))",
            "P = Point(Side(p, 4), 0.25)",
            "m = PerpendicularBisector(Side(p, 4))",
        ]);
        await change(3);
        for (const name of ["M", "P", "m"])
            expect(studied.scene.getObj(name)!.defined).toBe(false);
        await change(4);
        for (const name of ["M", "P", "m"])
            expect(studied.scene.getObj(name)!.defined).toBe(true);
        expectClose(point(studied.scene, "M").coords, [-2, 2, 0]);
        const target = studied.scene.getObj("p")!;
        await expect(
            redefine(
                studied,
                target,
                resolve(
                    studied.scene,
                    parseLine("p = Polygon(A, B, M)", isCommand),
                    target,
                ),
            ),
        ).rejects.toMatchObject({ key: "cycle" });
        expect(figureObjects(studied.scene)).toHaveLength(8);
    });

    it("supports point placement, segment bounds, renamed polygons and typed argument completion", async () => {
        const studied = figure();
        const c = studied.scene;
        const side = polygonSide(c.getObj("p") as polygon_object, 1);
        const placed = addPointOn(c, "P", side, [8, 0, 0]);
        expectClose(placed.coords, [2, 0, 0]);
        const source = "d = Parallel(A, Side(p, 1))";
        const sliders: never[] = [];
        add(
            c,
            resolveWithSliders(
                c,
                parseLine(source, isCommand),
                undefined,
                sliders,
            ),
        );
        expect(sliders).toEqual([]);
        expect(completionAt("Parallel(Side(p, 1), ")).toMatchObject({
            command: "Parallel",
            position: 1,
            args: [{ kind: "formula", source: "Side(p, 1)" }],
        });
        await redefine(
            studied,
            c.getObj("p")!,
            resolve(
                c,
                parseLine("`mon polygone` = Polygon(A, B, C, D)", isCommand),
                c.getObj("p"),
            ),
        );
        expect(lines(studied.scene).slice(-2)).toEqual([
            "P = Point(Side(`mon polygone`, 1), 1)",
            "d = Parallel(A, Side(`mon polygone`, 1))",
        ]);
    });

    it("rejects malformed, forward and wrongly typed native references", () => {
        const { scene: c } = figure();
        for (const ref of [
            ["side", 4, 0],
            ["side", 4, 1.5],
            ["side", 0, 1],
            ["side", 9, 1],
            ["side", ["side", 4, 1], 1],
            ["other", 4, 1],
            ["side", 4, 1, 2],
        ]) {
            const other = createConstruction([800, 600]);
            expect(() =>
                readDgo(other, {
                    dgo: 1,
                    v: { o: [400, 300], u: 40, w: 800, h: 600 },
                    o: [
                        ["Pt", "A", [0, 0]],
                        ["Pt", "B", [1, 0]],
                        ["Pt", "C", [0, 1]],
                        ["Pt", "D", [1, 1]],
                        ["Poly", "p", [0, 1, 2]],
                        ["Par", "d", [ref, 0]],
                    ],
                }),
            ).toThrow();
        }
        expect(() =>
            resolve(c, parseLine("M = Midpoint(Side(p, 0))", isCommand)),
        ).toThrow();
    });
});
