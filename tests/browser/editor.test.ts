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
import {
    accepts,
    COMMANDS,
    paramAt,
    type Arg,
    type Param,
} from "../../src/editor/catalog";
import {
    hideGhosts,
    showGhosts,
    toggleGhost,
    withGhostsHidden,
} from "../../src/editor/eraser";
import {
    attracts,
    dropLostMagnets,
    magnetizable,
    reachOf,
    setReach,
    showZone,
} from "../../src/editor/magnets";
import { labelAt, labelCenter, placeLabel } from "../../src/editor/labels";
import { crossing, meant, pick } from "../../src/editor/pick";
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
            "g = Circumcircle(A, B, C)",
            "h = Compass(A, B, E)",
            "j = Arc(A, C, D)",
            "n = Sector(B, C, D)",
            "O = Center(g)",
            "F = Intersection(d, q)",
            "G = Intersection(c, d, 2)",
            "H = OtherIntersection(c, d, B)",
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
        expect(type(c, "Cercle(A, B)").name).toBe("b");
        for (const [text, key] of [
            ["Segment(A, Z)", "unknown_object"],
            ["Unknown(A, B)", "unknown_command"],
            ["Circle(a, A)", "arguments"],
            ["Intersection(b, a, 5)", "branch"],
            ["Intersection(b, a)", "arguments"],
            ["Intersection(a, a, 1)", "arguments"],
            ["A = (3, 3)", "name_taken"],
        ])
            expect(() => resolve(c, parseLine(text)), text).toThrow(
                expect.objectContaining({ key }),
            );
        for (const [text, detail] of [
            ["Circle(A, B, C)", "Circumcircle(A, B, C)"],
            ["Intersection(b, a, A)", "OtherIntersection(b, a, A)"],
            ["Point(1, 2)", "FixedPoint(1, 2)"],
        ])
            expect(() => resolve(c, parseLine(text)), text).toThrow(
                expect.objectContaining({ key: "instead", detail }),
            );
    });

    it("tells from the arguments designated whether the line goes on", () => {
        const { scene: c } = studio();
        [
            "A = (-2, 0)",
            "B = (3, 1)",
            "C = (1, 4)",
            "D = (-3, 3)",
            "E = (0, -3)",
            "s = Segment(A, B)",
            "d = Line(A, C)",
            "c = Circle(A, B)",
            "v = Polygon(A, B, C)",
            "a = Conic(A, B, C, D, E)",
            "S = Sphere(A, B)",
            "P = Point(c, 0.5)",
            "M = Midpoint(A, B)",
            "l = Locus(M, P)",
            "w = Angle(A, B, C)",
        ].forEach((line) => type(c, line));
        const samples: Arg[] = [...figureObjects(c), 1];
        const overlap = (p: Param, q: Param | null) =>
            q !== null &&
            samples.some((arg) => accepts(arg, p) && accepts(arg, q));
        for (const { name, overloads } of COMMANDS)
            for (const shorter of overloads)
                for (const longer of overloads)
                    if (
                        !shorter.variadic &&
                        shorter.params[shorter.params.length - 1] !== "real" &&
                        longer.params.length > shorter.params.length
                    )
                        expect(
                            shorter.params.every((param, position) =>
                                overlap(param, paramAt(longer, position)),
                            ),
                            `${name}: ${shorter.params} begins ${longer.params}`,
                        ).toBe(false);
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

    it("lets the user choose between objects superposed, not points", () => {
        const { scene: c } = studio();
        [
            "A = (0, 0)",
            "B = (4, 0)",
            "a = Line(A, B)",
            "C = Point(a, -0.5)",
            "D = Point(a, 0.5)",
            "b = Segment(C, D)",
            "c = Segment(A, B)",
        ].forEach((line) => type(c, line));
        c.flush();
        // Between A and D.
        const names = (screen: [number, number]) =>
            meant(pick(c, screen))
                .map(({ object }) => object.name)
                .sort();
        expect(names([440, 300])).toEqual(["a", "b", "c"]);
        expect(names([520, 300])).toEqual(["a", "c"]);
        expect(names([401, 300])).toEqual(["A"]);
    });

    it("finds the intersection a click near two objects makes", () => {
        const { scene: c } = studio();
        [
            "A = (0, 0)",
            "B = (4, 0)",
            "C = (2, -2)",
            "D = (2, 2)",
            "a = Line(A, B)",
            "b = Line(C, D)",
            "c = Segment(A, B)",
            "d = Circle(A, B)",
        ].forEach((line) => type(c, line));
        c.flush();
        const crossed = (screen: [number, number]) => {
            const found = crossing(c, screen, pick(c, screen));
            return found && [found.a.name, found.b.name].sort();
        };
        // Near (2, 0), on a, b and c, a and c superposed.
        expect(crossed([484, 302])).toEqual(["a", "b"]);
        // Near (4, 0), on B.
        expect(crossed([559, 300])).toBeNull();
        // Near (-4, 0), on a and d.
        expect(crossed([243, 304])).toEqual(["a", "d"]);
        expect(crossed([300, 380])).toBeNull();
    });

    it("erases as DGPad, its hidden objects shown pale", async () => {
        const { scene: c } = studio();
        ["A = (0, 0)", "B = (4, 0)", "C = (0, 4)"].forEach((line) =>
            type(c, line),
        );
        const [a, b, k] = ["A", "B", "C"].map((name) => c.getObj(name)!);
        b.hidden = 1;
        k.hidden = 2;
        [b, k].forEach((object) => object.updateView());
        c.flush();
        const ghosts = showGhosts(c);
        expect([...ghosts]).toEqual([b]);
        expect(b.hasView && b.dom.dom().classList.contains("dge-ghost")).toBe(
            true,
        );
        expect(pick(c, [560, 300]).map(({ object }) => object)).toEqual([b]);
        expect(pick(c, [400, 140])).toEqual([]);
        toggleGhost(ghosts, a);
        toggleGhost(ghosts, b);
        const { o, st } = await withGhostsHidden(ghosts, () => describeDgo(c));
        expect(o.map((entry) => st?.[entry[3] as number]?.h ?? 0)).toEqual([
            1, 0, 2,
        ]);
        expect([a.hidden, b.hidden, a.hasView]).toEqual([0, 0, true]);
        hideGhosts(ghosts);
        expect([a.hidden, a.hasView, b.hidden]).toEqual([1, false, 0]);
    });

    it("sets magnets as DGPad, and drops those of removed targets", async () => {
        const { scene: c } = studio();
        [
            "A = (0, 0)",
            "B = (4, 0)",
            "C = (0, 4)",
            "a = Line(A, B)",
            "c = Circle(C, A)",
            "M = Midpoint(A, B)",
            "P = Point(c, 1)",
        ].forEach((line) => type(c, line));
        const [A, B, C, a, k, M, P] = ["A", "B", "C", "a", "c", "M", "P"].map(
            (name) => c.getObj(name)!,
        );
        expect([A, M, P].map(magnetizable)).toEqual([true, false, false]);
        const point = B as point_object;
        expect([A, C, k].map((o) => attracts(point, o))).toEqual([
            true,
            true,
            true,
        ]);
        // These move with B.
        expect([point, a, M].map((o) => attracts(point, o))).toEqual([
            false,
            false,
            false,
        ]);
        expect(attracts(A as point_object, a)).toBe(false);
        setReach(point, k as never, 20);
        setReach(point, C as never, 50);
        setReach(point, k as never, 30);
        expect(
            point.magnets.map(({ target, radius }) => [target.name, radius]),
        ).toEqual([
            ["C", 50],
            ["c", 30],
        ]);
        c.flush();
        const zone = showZone(k as never, 30)!;
        expect(zone.dom().nextSibling).toBe(k.dom.dom());
        expect(
            (zone.dom() as SVGElement).style.getPropertyValue("--dge-reach"),
        ).toBe("60px");
        zone.remove();
        setReach(point, k as never, 0);
        expect(reachOf(point, k as never)).toBe(0);
        setReach(point, k as never, 30);
        c.removeObject(C);
        dropLostMagnets(c);
        expect(point.magnets.map(({ target }) => target)).toEqual([]);
        const { st } = await describeDgo(c);
        expect(st?.some((style) => style.mg)).toBe(false);
    });

    it("drags the name of a point around it, as in GeoGebra", async () => {
        const { scene: c } = studio();
        readDgo(c, {
            dgo: 1,
            v: { o: [400, 300], u: 40, w: 800, h: 600 },
            o: [["Pt", "A", [0, 0], 0]],
            st: [{ sn: 1, s: 4 }],
        });
        c.flush();
        const A = c.getObj("A") as point_object;
        const box = () => A.nameText!.dom().getBoundingClientRect();
        const { left, top, width, height } = box();
        expect(labelAt(c, [left + width / 2, top + height / 2])).toBe(A);
        expect(labelAt(c, [left - 20, top - 20])).toBe(null);
        // Its center follows the pointer, the name never covering the point.
        placeLabel(A, [370, 260]);
        const [x, y] = labelCenter(A);
        expect([x, y].map(Math.round)).toEqual([370, 260]);
        expect(A.namePosition).toBeCloseTo((Math.PI * 3) / 4, 0);
        placeLabel(A, [401, 301]);
        expect(A.nameDistance).toBe(0);
        placeLabel(A, [400, 0]);
        expect(A.nameDistance).toBe(80);
        expect(A.namePosition).toBeCloseTo(Math.PI / 2);
        placeLabel(A, [440, 280]);
        const { scene: copy } = studio();
        readDgo(copy, await describeDgo(c));
        const B = copy.getObj("A") as point_object;
        expect(B.nameDistance).toBe(A.nameDistance);
        expect(B.namePosition).toBe(A.namePosition);
    });
});
