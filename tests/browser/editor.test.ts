import { describe, expect, it } from "vitest";
// First, as in main.ts: the object classes import each other.
import "../../src/construction";
import type { construction } from "../../src/construction";
import { describeDgo, figureObjects, readDgo } from "../../src/dgo";
import {
    add,
    addPointOn,
    entryOf,
    figureIndex,
    lineOf,
    rebuild,
    redefine,
    resolve,
    type Studio,
} from "../../src/editor/figure";
import {
    accepts,
    COMMANDS,
    findCommand,
    isCommand,
    paramAt,
    readable,
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
import { pinnable, togglePin } from "../../src/editor/pin";
import {
    handleOf,
    pull,
    setAnimation,
    springOf,
    springy,
} from "../../src/editor/spring";
import type { point_on_object } from "../../src/objects/point_on_object";
import { labelAt, labelCenter, placeLabel } from "../../src/editor/labels";
import { crossing, meant, pick } from "../../src/editor/pick";
import { parseLine, TextError } from "../../src/editor/text";
import en from "../../src/editor/lang/en";
import type { MessageKey, Texts } from "../../src/editor/messages";
import { IDENTIFIER_PART, IDENTIFIER_START } from "../../src/import/dgp_parser";
import type { point_object } from "../../src/objects/point_object";
import type { circle1_object } from "../../src/objects/circle1_object";
import type { expression_object } from "../../src/objects/expression_object";
import type { expression_list_object } from "../../src/objects/expression_list_object";
import { createConstruction, disposeFigures, expectClose } from "./figures";
import { vDot, vScale, vSub } from "../../src/vec";

disposeFigures();

const LANGUAGES = import.meta.glob<Texts>(
    ["../../src/editor/lang/*.ts", "!../../src/editor/lang/en.ts"],
    { import: "default", eager: true },
);

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
    add(c, resolve(c, parseLine(text, isCommand)));

const lines = (c: construction): string[] => {
    const index = figureIndex(c);
    const objects = figureObjects(c);
    return objects.map((object) => lineOf(object, index, objects)!);
};

describe("Editor", () => {
    it("speaks every language of DocTools, with GeoGebra's command names", () => {
        const placeholders = (text: string) => text.split("%").length;
        const identifier = new RegExp(
            `^${IDENTIFIER_START.source}${IDENTIFIER_PART.source}*$`,
            "u",
        );
        const fold = (name: string) =>
            name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
        const shared: string[][] = [];
        for (const [path, { messages, commands }] of Object.entries(
            LANGUAGES,
        )) {
            for (const key of Object.keys(en) as MessageKey[]) {
                const text = messages[key];
                expect(text, `${path}: ${key}`).toBeDefined();
                expect(placeholders(text!), `${path}: ${key}`).toBe(
                    placeholders(en[key]),
                );
            }
            // Chinese (Taiwan) keeps the English names, as GeoGebra.
            if (!commands) continue;
            expect(Object.keys(commands).sort(), path).toEqual(
                COMMANDS.map(({ name }) => name).sort(),
            );
            const named = new Map<string, Set<string>>();
            for (const { name } of COMMANDS)
                for (const each of [name, commands[name]!]) {
                    expect(each, path).toMatch(identifier);
                    const set = named.get(fold(each)) ?? new Set();
                    named.set(fold(each), set.add(name));
                }
            for (const set of named.values())
                if (set.size > 1) shared.push([...set]);
        }
        // Told apart by their arguments.
        expect(shared).toEqual([["Midpoint", "Center"]]);
    });

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
        expect(type(c, "Midpoint(A, B)").name).toBe("C");
        expect(type(c, "Circle(A, B)").name).toBe("b");
        for (const [text, key] of [
            ["Segment(A, Z)", "unknown_object"],
            ["Unknown(A, B)", "unknown_command"],
            ["Circle(a, A)", "arguments"],
            ["Intersection(b, a, 5)", "branch"],
            ["Intersection(b, a)", "arguments"],
            ["Intersection(a, a, 1)", "arguments"],
            ["A = (3, 3)", "name_taken"],
        ])
            expect(() => resolve(c, parseLine(text, isCommand)), text).toThrow(
                expect.objectContaining({ key }),
            );
        for (const [text, detail] of [
            ["Circle(A, B, C)", "Circumcircle(A, B, C)"],
            ["Intersection(b, a, A)", "OtherIntersection(b, a, A)"],
            ["Point(1, 2)", "FixedPoint(1, 2)"],
        ])
            expect(() => resolve(c, parseLine(text, isCommand)), text).toThrow(
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
                        !["number", "real"].includes(
                            shorter.params[shorter.params.length - 1],
                        ) &&
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
        const line = parseLine("A = Midpoint(B, O)", isCommand);
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
        const cycle = parseLine("B = Midpoint(A, O)", isCommand);
        await expect(
            redefine(
                studied,
                scene.getObj("B")!,
                resolve(scene, cycle, scene.getObj("B")),
            ),
        ).rejects.toThrow(TextError);
        // Renamed, and in space.
        const renamed = parseLine("K = (1, 2, 3)", isCommand);
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

    it("writes and reads expressions, their nature told by the text", async () => {
        const { scene: c } = studio();
        const text = [
            "A = (0, 0)",
            "B = (3, 4)",
            "a = 3",
            "L = [1, 2, 3]",
            "f = 0.5x^2-4",
            "E = d(A, B)+f(2)",
            "s = Segment(A, B)",
            "c = Circle(A, a)",
            'p = if(a>2){s.setHidden(1)};"Faces"',
            "z = 3i-9",
        ];
        text.forEach((line) => type(c, line));
        c.flush();
        expect(lines(c)).toEqual(text);
        const index = figureIndex(c);
        const entry = (name: string) => entryOf(c.getObj(name)!, index);
        expect(entry("a")).toEqual(["Ex", { t: "", v: 3, xy: [20, 40] }]);
        expect(entry("L")[1]).toMatchObject({ v: [1, 2, 3], xy: [20, 70] });
        expect(entry("z")[1]).toMatchObject({ s: "3i-9" });
        expect((c.getObj("z") as expression_object).value).toEqual([-9, 3]);
        expect(entry("f")[1]).toMatchObject({ f: "0.5x^2-4" });
        expect(entry("E")[1]).toMatchObject({
            s: ["d(A, B)+f(2)", { A: 0, B: 1, f: 4 }],
        });
        expect(entry("c")).toEqual(["C1", [0, ["a", { a: 2 }]]]);
        expect((c.getObj("E") as expression_object).value).toBe(3);
        expect((c.getObj("c") as circle1_object).R).toBe(3);
        expect(c.getObj("s")!.hidden).toBe(1);
        // Saved and read, the same text.
        const other = createConstruction([800, 600]);
        readDgo(other, await describeDgo(c));
        expect(lines(other)).toEqual(text);
        for (const [line, key, detail] of [
            ["E = d(A, Z)", "unknown_object", "Z"],
            ["E = Distance(A, B)", "unknown_command", "Distance"],
            ["E = 1 +", "syntax", "1 +"],
            ["c = Circle(A, s)", "arguments", "Circle"],
        ])
            expect(() => resolve(c, parseLine(line, isCommand)), line).toThrow(
                expect.objectContaining({ key, detail }),
            );
    });

    it("redefines and renames expressions, their targets before them", async () => {
        const studied = studio();
        [
            "A = (0, 0)",
            "B = (3, 4)",
            "a = 3",
            "s = Segment(A, B)",
            "c = Circle(A, a)",
            'p = if(a>2){s.setHidden(1)};"Faces"',
            "E = d(A, B)",
        ].forEach((line) => type(studied.scene, line));
        const redefined = async (text: string, name: string) => {
            const c = studied.scene;
            const target = c.getObj(name)!;
            await redefine(
                studied,
                target,
                resolve(c, parseLine(text, isCommand), target),
            );
        };
        // A program styles an object before it, reordered or not.
        await redefined("s = Segment(B, A)", "s");
        await redefined("a = 1", "a");
        expect((studied.scene.getObj("c") as circle1_object).R).toBe(1);
        // Kept: its place; its slider's bounds only by Slider(…).
        const slider = (c: construction) =>
            entryOf(c.getObj("b")!, figureIndex(c))[1];
        const figure = await describeDgo(studied.scene);
        const position = figure.o.findIndex(
            (entry) => (entry as unknown[])[1] === "a",
        );
        Object.assign((figure.o[position] as unknown[])[2] as object, {
            mn: 0,
            mx: 10,
            xy: [100, 200],
        });
        rebuild(studied, figure);
        expect(lines(studied.scene)[2]).toBe("a = Slider(0, 10, 1)");
        await redefined("b = Slider(0, 10, 4)", "a");
        expect(slider(studied.scene)).toEqual({
            t: "",
            v: 4,
            mn: 0,
            mx: 10,
            xy: [100, 200],
        });
        await redefined("b = 4", "b");
        expect(slider(studied.scene)).toEqual({ t: "", v: 4, xy: [100, 200] });
        await redefined("b = d(A, B)", "b");
        expect(slider(studied.scene)).toEqual({
            t: "",
            s: ["d(A, B)", { A: 0, B: 1 }],
            xy: [100, 200],
        });
        expect(lines(studied.scene)).toEqual([
            "A = (0, 0)",
            "B = (3, 4)",
            "b = d(A, B)",
            "s = Segment(B, A)",
            "c = Circle(A, b)",
            'p = if(b>2){s.setHidden(1)};"Faces"',
            "E = d(A, B)",
        ]);
        // It may read what it styles, not what is built from it.
        await redefined('p = if(s>2){s.setHidden(1)};"Faces"', "p");
        for (const [text, name] of [
            ["b = 2*c", "b"],
            ["s = Circle(A, p)", "s"],
        ])
            await expect(redefined(text, name), text).rejects.toThrow(
                expect.objectContaining({ key: "cycle" }),
            );
        // What it styles comes before it.
        await redefined('p = if(b>2){E.setHidden(1)};"Faces"', "p");
        // Renamed, the formulas that read it write its new name.
        const figure2 = await describeDgo(studied.scene);
        (figure2.o[0] as unknown[])[1] = "A 1";
        rebuild(studied, figure2);
        expect(lines(studied.scene).slice(2)).toEqual([
            "b = d(`A 1`, B)",
            "s = Segment(B, `A 1`)",
            "c = Circle(`A 1`, b)",
            "E = d(`A 1`, B)",
            'p = if(b>2){E.setHidden(1)};"Faces"',
        ]);
        await redefined("E = d(`A 1`, B)/2", "E");
        expect((studied.scene.getObj("E") as expression_object).value).toBe(
            2.5,
        );
    });

    it("makes sliders, read back as such", async () => {
        const studied = studio();
        const c = studied.scene;
        ["a = Slider(0, 10, 3)", "b = Slider(-1, a, 2)", "E = 2*b"].forEach(
            (line) => type(c, line),
        );
        c.flush();
        expect(lines(c)).toEqual([
            "a = Slider(0, 10, 3)",
            "b = Slider(-1, a, 2)",
            "E = 2*b",
        ]);
        const index = figureIndex(c);
        expect(entryOf(c.getObj("a")!, index)[1]).toEqual({
            t: "",
            v: 3,
            mn: 0,
            mx: 10,
            xy: [20, 40],
        });
        // Under the sliders' tracks.
        expect(entryOf(c.getObj("E")!, index)[1]).toMatchObject({
            xy: [20, 160],
        });
        const b = c.getObj("b") as expression_object;
        expect([b.isCursor, b.min, b.max]).toEqual([true, -1, 3]);
        const other = createConstruction([800, 600]);
        readDgo(other, await describeDgo(c));
        expect(lines(other)).toEqual(lines(c));
        expect(() => type(c, "d = Slider(0, 10, a)")).toThrow(
            expect.objectContaining({ key: "arguments" }),
        );
        // A constant again, then a slider again.
        await redefine(
            studied,
            b,
            resolve(c, parseLine("b = 2", isCommand), b),
        );
        expect(lines(studied.scene)[1]).toBe("b = 2");
        expect((studied.scene.getObj("b") as expression_object).isCursor).toBe(
            false,
        );
        const figure = await describeDgo(studied.scene);
        rebuild(studied, figure);
        const constant = studied.scene.getObj("b")!;
        await redefine(
            studied,
            constant,
            resolve(
                studied.scene,
                parseLine("b = Slider(0, 5, 1)", isCommand),
                constant,
            ),
        );
        expect(lines(studied.scene)[1]).toBe("b = Slider(0, 5, 1)");
        // Bounds that are formulas have no line yet.
        const bounded = await describeDgo(studied.scene);
        Object.assign((bounded.o[1] as unknown[])[2] as object, {
            mx: ["2*a", { a: 0 }],
        });
        rebuild(studied, bounded);
        expect(lines(studied.scene)[1]).toBeNull();
    });

    it("draws the points of an expression's value as a list", async () => {
        const { scene: c } = studio();
        const text = [
            "p = var t=[]; for (var i=0;i<4;i++){t.push([i,0])}; t",
            "L = List(p)",
        ];
        text.forEach((line) => type(c, line));
        c.flush();
        expect(lines(c)).toEqual(text);
        const index = figureIndex(c);
        expect(entryOf(c.getObj("L")!, index)).toEqual(["ELst", [0]]);
        const list = c.getObj("L") as expression_list_object;
        expect(list.points).toEqual([
            [0, 0],
            [1, 0],
            [2, 0],
            [3, 0],
        ]);
        const other = createConstruction([800, 600]);
        readDgo(other, await describeDgo(c));
        expect(lines(other)).toEqual(text);
        type(c, "A = (1, 1)");
        expect(() => type(c, "M = List(A)")).toThrow(
            expect.objectContaining({ key: "arguments" }),
        );
        expect(accepts(c.getObj("p")!, "expression")).toBe(true);
        expect(accepts(1, "expression")).toBe(false);
    });

    it("signs the formulas' functions, a real number reading expressions", () => {
        const { scene: c } = studio();
        ["A = (0, 0)", "a = 3", "s = Segment(A, A)", "w = Point(s, 0)"].forEach(
            (line) => type(c, line),
        );
        const [A, a, s] = ["A", "a", "s"].map((name) => c.getObj(name)!);
        expect(accepts(a, "real")).toBe(true);
        expect(accepts(a, "number")).toBe(false);
        expect(accepts(2, "number")).toBe(true);
        expect(findCommand("d")!.overloads[0].params).toEqual([
            "point",
            "point",
        ]);
        expect(findCommand("d")!.formula).toBe(true);
        // A command's name only: no formula's function in the text's head.
        expect(isCommand("d")).toBe(false);
        expect(isCommand("midpoint")).toBe(true);
        expect(findCommand("Sqrt")).toBeUndefined();
        expect([A, a, s].every(readable)).toBe(true);
        expect(readable(c.getObj("w")!)).toBe(true);
        expect(() => type(c, "P = Point(s, a)")).toThrow(
            expect.objectContaining({ key: "arguments" }),
        );
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

    it("pins a free point to the window, as DGPad's pushpin", async () => {
        const { scene: c } = studio();
        ["A = (1, 2)", "B = (3, 0)", "M = Midpoint(A, B)"].forEach((line) =>
            type(c, line),
        );
        const [A, M] = ["A", "M"].map((name) => c.getObj(name)!);
        expect([A, M].map(pinnable)).toEqual([true, false]);
        expect(pinnable(studio(true).scene.getObj("A"))).toBe(false);
        const point = A as point_object;
        togglePin(point);
        c.GRID.ORG = [440, 260];
        c.GRID.UNIT = [80, 80, 80];
        c.invalidateProjection();
        c.flush();
        expectClose(point.coords, [0, 0.5, 0]);
        const figure = await describeDgo(c);
        expect(figure.st?.some((style) => style.fl === 1)).toBe(true);
        togglePin(point);
        c.GRID.ORG = [400, 300];
        c.invalidateProjection();
        c.flush();
        expectClose(point.coords, [0, 0.5, 0]);
        expect((await describeDgo(c)).st?.some((style) => style.fl)).toBe(
            false,
        );
    });

    it("animates a point on an object as DGPad's spring", async () => {
        const { scene: c } = studio();
        [
            "A = (0, 0)",
            "B = (4, 0)",
            "C = (0, 4)",
            "s = Segment(A, B)",
            "c = Circle(C, A)",
            "M = Midpoint(A, B)",
            "P = Point(s, 0.5)",
            "Q = Point(c, 1)",
        ].forEach((line) => type(c, line));
        c.flush();
        const [A, s, M, P, Q] = ["A", "s", "M", "P", "Q"].map((name) =>
            c.getObj(name)!,
        );
        expect([A, s, M, P, Q].map(springy)).toEqual([
            false,
            false,
            false,
            true,
            true,
        ]);
        const point = P as point_on_object;
        const spring = springOf(point);
        expectClose(spring.forward.map(Math.abs), [1, 0]);
        // Let go like an elastic, the point goes the other way.
        [1, -1].forEach((side) => {
            const { animation, label } = pull(spring, [side * 160, 0]);
            expect(animation).toEqual({
                speed: 50,
                direction: -side * Math.sign(spring.forward[0]),
                ar: false,
            });
            expect(label).toBe("50 px/s");
            setAnimation(point, animation);
            const x = point.sx;
            point.animate(0.1);
            c.flush();
            expect(Math.sign(point.sx - x)).toBe(-side);
        });
        expect(pull(spring, [0, 160])).toEqual({
            animation: { speed: 50, direction: 1, ar: true },
            label: "50 px/s ⇄",
        });
        expect(pull(spring, [10, 0]).animation.speed).toBe(0);
        // Its handle shows its animation, but the direction a back and
        // forth starts in.
        [
            [150, 20],
            [-60, 5],
            [3, -200],
            [400, 0],
        ].forEach((vector) => {
            const { animation } = pull(spring, vector as [number, number]);
            const shown = pull(spring, handleOf(spring, animation)).animation;
            if (animation.ar) shown.direction = animation.direction;
            expect(shown).toEqual(animation);
        });
        const turning = springOf(Q as point_on_object);
        const radius = vSub(
            (Q as point_object).SCREEN,
            (c.getObj("C") as point_object).SCREEN,
        );
        expect(vDot(turning.forward, radius)).toBeCloseTo(0, 1);
        const { animation, label } = pull(
            turning,
            vScale(turning.forward, 130),
        );
        expect(label).toBe("30 °/s");
        expect(animation.speed).toBeCloseTo(Math.PI / 6);
        setAnimation(point, { speed: 0, direction: 1, ar: false });
        expect(
            (await describeDgo(c)).st?.find((style) => style.an)?.an,
        ).toEqual([0, 1, 0]);
    });

    it("animates a point on a conic, which DGPad doesn't", () => {
        const { scene: c } = studio();
        const r = Math.SQRT2;
        [
            "A = (4, 0)",
            "B = (-4, 0)",
            "C = (0, 2)",
            "D = (0, -2)",
            `E = (${2 * r}, ${r})`,
            "e = Conic(A, B, C, D, E)",
            "F = (1, 0)",
            "G = (-1, 0)",
            `H = (${r}, 1)`,
            `I = (${r}, -1)`,
            `J = (${-r}, 1)`,
            "h = Conic(F, G, H, I, J)",
        ].forEach((line) => type(c, line));
        c.flush();
        const P = addPointOn(c, "P", c.getObj("e")!, [4, 0, 0]);
        const Q = addPointOn(c, "Q", c.getObj("h")!, [1, 0, 0]);
        c.flush();
        expect([P, Q].map(springy)).toEqual([true, true]);
        // Round the ellipse, a turn of about 795 px.
        setAnimation(P, { speed: 100, direction: 1, ar: false });
        let turned = 0;
        let last = Math.atan2(P.coords[1] / 2, P.coords[0] / 4);
        for (let step = 0; step < 20; step++) {
            P.animate(0.5);
            c.flush();
            const [x, y] = P.coords;
            expect((x * x) / 16 + (y * y) / 4).toBeCloseTo(1, 6);
            const angle = Math.atan2(y / 2, x / 4);
            turned += ((angle - last + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
            last = angle;
        }
        expect(Math.abs(turned) / (2 * Math.PI)).toBeCloseTo(1000 / 795, 1);
        // Back and forth on its branch of the hyperbola, in the window.
        setAnimation(Q, { speed: 1500, direction: 1, ar: false });
        const sides = new Set<number>();
        for (let step = 0; step < 60; step++) {
            Q.animate(0.1);
            c.flush();
            const [x, y] = Q.coords;
            expect(x * x - y * y).toBeCloseTo(1, 6);
            expect(x).toBeGreaterThan(0);
            expect(Q.sy).toBeGreaterThan(-5);
            expect(Q.sy).toBeLessThan(c.height + 5);
            sides.add(Q.animation!.direction);
        }
        expect(sides.size).toBe(2);
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
