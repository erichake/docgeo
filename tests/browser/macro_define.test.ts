import { describe, expect, it } from "vitest";
import "../../src/construction";
import type { construction } from "../../src/construction";
import {
    addDgoEntries,
    describeDgo,
    figureObjects,
    readDgo,
} from "../../src/dgo";
import { isCommand } from "../../src/editor/catalog";
import { add, resolve } from "../../src/editor/figure";
import {
    analyse,
    applyMacro,
    designation,
    takesNext,
    finalsOf,
    rememberFixed,
    withFixed,
    methodOf,
    missing,
    save,
    savingOf,
} from "../../src/editor/macro";
import { macroThumbnail } from "../../src/editor/macro_icon";
import { parseLine } from "../../src/editor/text";
import type { construction_object } from "../../src/objects/construction_object";
import type { point_object } from "../../src/objects/point_object";
import type { point_on_object } from "../../src/objects/point_on_object";
import { createConstruction, disposeFigures, expectClose } from "./figures";

disposeFigures();

function figure(...lines: string[]): construction {
    const c = createConstruction([800, 600]);
    readDgo(c, { dgo: 1, v: { o: [400, 300], u: 40, w: 800, h: 600 }, o: [] });
    lines.forEach((line) => add(c, resolve(c, parseLine(line, isCommand))));
    c.flush();
    return c;
}

const get = <T extends construction_object = point_object>(
    c: construction,
    name: string,
) => c.getObj(name) as T;
const all = (c: construction, ...names: string[]) =>
    names.map((name) => get(c, name));
const index = (c: construction, name: string) =>
    figureObjects(c).indexOf(get(c, name));

const CIRCUMCENTER = [
    "A = (0, 0)",
    "B = (4, 0)",
    "C = (1, 3)",
    "m1 = PerpendicularBisector(A, B)",
    "m2 = PerpendicularBisector(B, C)",
    "O = Intersection(m1, m2)",
    "c = Circle(O, A)",
];

describe("Defining a macro", () => {
    it("tells what the initials determine, and what a final misses", () => {
        const c = figure(
            ...CIRCUMCENTER,
            "D = (5, 5)",
            "e = Circle(D, A)",
            "s = Segment(A, B)",
            "M = Midpoint(A, B)",
        );
        const two = analyse(c, all(c, "A", "B"));
        expect(two.determined(get(c, "m1"))).toBe(true);
        expect(two.determined(get(c, "O"))).toBe(false);
        expect(missing(two, get(c, "c")).map(({ name }) => name)).toEqual([
            "C",
        ]);
        const three = analyse(c, all(c, "A", "B", "C"));
        expect(three.determined(get(c, "c"))).toBe(true);
        expect(three.determined(get(c, "e"))).toBe(false);
        expect(missing(three, get(c, "e")).map(({ name }) => name)).toEqual([
            "D",
        ]);
        // Without finals, the visible objects determined.
        expect(finalsOf(c, three, []).map(({ name }) => name)).toEqual([
            "m1",
            "m2",
            "O",
            "c",
            "s",
            "M",
        ]);
        // A segment gives its ends.
        const segment = analyse(c, all(c, "s"));
        expect(segment.determined(get(c, "M"))).toBe(true);
        expect(segment.given.has(get(c, "A"))).toBe(true);
    });

    it("keeps a circle's numeric radius as a constant of the body", () => {
        const c = figure(
            "A = (0, 0)",
            "B = (4, 0)",
            "M = Midpoint(A, B)",
            "k = Circle(M, 0.5)",
            "l = Line(A, B)",
            "P = Intersection(l, k, 1)",
        );
        const analysis = analyse(c, all(c, "A", "B"));
        expect(analysis.determined(get(c, "k"))).toBe(true);
        expect(analysis.determined(get(c, "P"))).toBe(true);
        const method = methodOf(c, all(c, "A", "B"), all(c, "P"), [], "");
        expect(method.body.find(([, name]) => name === "k")).toEqual([
            "C1",
            "k",
            [2, 0.5],
            { c: "#396D26" },
        ]);
    });

    it("leaves out a script that styles what it builds", () => {
        const c = figure(
            "A = (0, 0)",
            "B = (4, 0)",
            "a = 1",
            "M = Midpoint(A, B)",
            'p = if(a==0){M.setHidden(1)};"Montrer"',
            "N = Midpoint(M, B)",
        );
        const analysis = analyse(c, all(c, "A", "B"));
        expect(analysis.determined(get(c, "N"))).toBe(true);
        const method = methodOf(c, all(c, "A", "B"), all(c, "N"), [], "");
        expect(method.body.map(([, name]) => name)).toEqual(["M", "N"]);
    });

    it("misses a fixed point, as what is built from nothing", () => {
        const c = figure(
            "A = (0, 0)",
            "O = FixedPoint(1, 1)",
            "k = Circle(O, 2)",
            "s = Segment(A, O)",
        );
        const analysis = analyse(c, all(c, "A"));
        expect(finalsOf(c, analysis, [])).toEqual([]);
        expect(missing(analysis, get(c, "s")).map(({ name }) => name)).toEqual([
            "O",
        ]);
    });

    it("takes a point on an object the initials determine, final or not", () => {
        const c = figure(
            "A = (-2, 0)",
            "B = (2, 0)",
            "m = PerpendicularBisector(A, B)",
            "C = Point(m, 1.5)",
            "t = Polygon(A, B, C)",
            "P = Point(m, -1)",
            "R = Midpoint(P, A)",
        );
        const analysis = analyse(c, all(c, "A", "B"));
        expect(analysis.determined(get(c, "C"))).toBe(true);
        expect(analysis.determined(get(c, "R"))).toBe(true);
        const method = methodOf(
            c,
            all(c, "A", "B"),
            all(c, "C", "t", "R"),
            [],
            "",
        );
        expect(method.body.map(([tag, name]) => [tag, name])).toEqual([
            ["Med", "m"],
            ["On", "C"],
            ["Poly", "t"],
            ["On", "P"],
            ["Mid", "R"],
        ]);
        save(
            c,
            savingOf(c.macros, "Isocèle", method),
            "Isocèle",
            ["C", "t", "R"],
            null,
            method,
        );
        // Applied elsewhere: its apex where it was on the bisector, which
        // the application's own drag moves.
        const other = figure("D = (0, 0)", "E = (0, 4)");
        other.macros = c.macros;
        const [apex] = applyMacro(other, 0, 0, all(other, "D", "E"));
        const { alpha } = get<point_on_object>(c, "C");
        expect((apex as point_on_object).alpha).toBe(alpha);
        expect((apex as point_on_object).moveable).toBe(true);
        expectClose(
            Math.hypot(...(apex as point_object).coords.slice(0, 2)),
            Math.hypot(
                (apex as point_object).coords[0],
                (apex as point_object).coords[1] - 4,
            ),
        );
    });

    it("determines a locus from its point's support", () => {
        const c = figure(
            "O = (0, 0)",
            "A = (2, 0)",
            "c = Circle(O, A)",
            "M = Point(c, 1)",
            "Q = (4, 0)",
            "X = Midpoint(M, Q)",
            "L = Locus(X, M)",
        );
        const analysis = analyse(c, all(c, "c", "Q"));
        // M's place on c, a constant of the body.
        expect(analysis.determined(get(c, "X"))).toBe(true);
        expect(analysis.determined(get(c, "L"))).toBe(true);
        // Not without c.
        expect(analyse(c, all(c, "Q")).determined(get(c, "L"))).toBe(false);
        const method = methodOf(c, all(c, "c", "Q"), all(c, "L"), [], "");
        expect(method.body.map(([tag]) => tag)).toEqual(["On", "Mid", "Loc"]);
        expect(method.initials).toEqual([
            ["circle", ""],
            ["point", ""],
        ]);
    });

    it("saves a method that computes the finals again from other initials", async () => {
        const c = figure(
            ...CIRCUMCENTER,
            "D = (-1, 1)",
            "E = (3, 2)",
            "F = (0, 5)",
        );
        get(c, "c").stroke_color = "#ff0000";
        get(c, "m1").hidden = 1;
        const method = methodOf(
            c,
            all(c, "A", "B", "C"),
            all(c, "O", "c"),
            ["Le premier ?", "", ""],
            "Trois points",
        );
        expect(method.body.map(([, name]) => name)).toEqual([
            "m1",
            "m2",
            "O",
            "c",
        ]);
        expect(method.finals).toEqual([5, 6]);
        // Each keeps its style: a final's at the application, an
        // intermediate's when its box is opened.
        expect(method.body[3][3]).toEqual({ c: "#ff0000", fc: "#396D26" });
        expect(method.body[0][3]).toEqual({ c: "#E377C2", h: 1 });
        expect(method.body[1][3]).toEqual({ c: "#E377C2" });
        const saving = savingOf(c.macros, "Circonscrit", method);
        expect(saving).toEqual({ kind: "create" });
        save(c, saving, "Circonscrit", ["O", "c"], null, method);
        const at = figureObjects(c).length;
        addDgoEntries(
            c,
            [
                [
                    "Mac",
                    "mac1",
                    [0, 0, ["D", "E", "F"].map((name) => index(c, name))],
                ],
                ["Out", "O2", [at, 1]],
                ["Out", "c2", [at, 2], 0],
            ],
            [{ c: "#00ff00" }],
        );
        add(
            c,
            resolve(
                c,
                parseLine("n1 = PerpendicularBisector(D, E)", isCommand),
            ),
        );
        add(
            c,
            resolve(
                c,
                parseLine("n2 = PerpendicularBisector(E, F)", isCommand),
            ),
        );
        add(c, resolve(c, parseLine("P = Intersection(n1, n2)", isCommand)));
        c.flush();
        expectClose(get(c, "O2").coords, get(c, "P").coords);
        expect(get(c, "c2").stroke_color).toBe("#00ff00");
        // Saved with the figure.
        const copy = createConstruction([800, 600]);
        readDgo(copy, await describeDgo(c));
        copy.flush();
        expectClose(get(copy, "O2").coords, get(c, "P").coords);
        expect(copy.macros[0].methods[0].body[3][3]).toEqual({
            c: "#ff0000",
            fc: "#396D26",
        });
    });

    it("adds a method, replaces one, and refuses what would be ambiguous", () => {
        const c = figure(
            "A = (0, 0)",
            "B = (4, 0)",
            "C = (1, 3)",
            "s = Segment(A, B)",
            "M = Midpoint(A, B)",
            "N = Midpoint(s)",
            "G = Centroid(A, B, C)",
        );
        const points = methodOf(c, all(c, "A", "B"), all(c, "M"), [], "");
        save(
            c,
            savingOf(c.macros, "Milieu", points),
            "Milieu",
            ["I"],
            null,
            points,
        );
        const segment = methodOf(c, all(c, "s"), all(c, "N"), [], "");
        const added = savingOf(c.macros, "Milieu", segment);
        expect(added.kind).toBe("add");
        save(c, added, "Milieu", ["I"], null, segment);
        expect(c.macros[0].methods).toHaveLength(2);
        expect(savingOf(c.macros, "Milieu", points)).toEqual({
            kind: "replace",
            macro: c.macros[0],
            method: 0,
        });
        const three = methodOf(c, all(c, "A", "B", "C"), all(c, "G"), [], "");
        expect(savingOf(c.macros, "Milieu", three).kind).toBe("ambiguous");
        const line = methodOf(c, all(c, "A", "B"), all(c, "s"), [], "");
        expect(savingOf(c.macros, "Milieu", line).kind).toBe("finals");
    });

    it("applies a method once its initials are designated, whichever they begin", () => {
        const c = figure(
            "A = (0, 0)",
            "B = (4, 0)",
            "s = Segment(A, B)",
            "M = Midpoint(A, B)",
            "N = Midpoint(s)",
            "C = (2, 6)",
            "D = (0, 2)",
            "t = Segment(C, D)",
        );
        get(c, "M").stroke_color = "#ff0000";
        const points = methodOf(c, all(c, "A", "B"), all(c, "M"), [], "");
        save(
            c,
            savingOf(c.macros, "Milieu", points),
            "Milieu",
            ["M"],
            null,
            points,
        );
        const segment = methodOf(c, all(c, "s"), all(c, "N"), [], "");
        save(
            c,
            savingOf(c.macros, "Milieu", segment),
            "Milieu",
            ["M"],
            null,
            segment,
        );
        const [macro] = c.macros;
        const none = designation(macro, [], c.macros);
        expect(none).toEqual({
            complete: null,
            next: [
                ["point", ""],
                ["segment", ""],
            ],
            last: ["segment"],
        });
        expect(takesNext(none, get(c, "t"))).toBe(true);
        expect(takesNext(none, get(c, "M"))).toBe(true);
        // Mapping a point to a point, its last takes an object too, whose
        // image it gives (see TRANSFORMATIONS.md).
        const one = designation(macro, all(c, "C"), c.macros);
        expect(one).toEqual({
            complete: null,
            next: [["invertible", ""]],
            last: ["invertible"],
        });
        expect(takesNext(one, get(c, "t"))).toBe(true);
        expect(designation(macro, all(c, "t"), c.macros)).toEqual({
            complete: 1,
            next: [],
            last: [],
        });
        const [first] = applyMacro(c, 0, 0, all(c, "C", "D"));
        const [second] = applyMacro(c, 0, 1, all(c, "t"));
        c.flush();
        // Named after the macro's final, unless taken.
        expect([first.name, second.name]).toEqual(["M1", "M2"]);
        expectClose((first as point_object).coords, [1, 4, 0]);
        expectClose((second as point_object).coords, [1, 4, 0]);
        expect(first.stroke_color).toBe("#ff0000");
    });

    it("takes a fixed initial by its name, or the object last designated for it", () => {
        const c = figure(
            "O = (0, 0)",
            "Hz = Circle(O, 4)",
            "k = Circle(O, 2)",
            "A = (1, 1)",
            "B = (2, 0)",
            "M = Midpoint(O, A)",
            "N = Midpoint(O, B)",
        );
        const method = methodOf(
            c,
            all(c, "Hz", "A"),
            all(c, "M"),
            [],
            "",
            all(c, "Hz"),
        );
        expect(method.initials).toEqual([
            ["circle", "", "Hz"],
            ["point", ""],
        ]);
        const half = {
            name: "Half",
            finals: ["M"],
            icon: null,
            methods: [method],
        };
        // Its name: the figure's Hz.
        expect(withFixed(c, half, [])).toEqual(all(c, "Hz"));
        // Then the object designated for it, by any macro looking for it.
        rememberFixed(designation(half, [], c.macros), get(c, "k"));
        expect(withFixed(c, half, [])).toEqual(all(c, "k"));
        // Never the last initial, which would apply the macro untouched.
        const alone = methodOf(
            c,
            all(c, "Hz"),
            all(c, "O"),
            [],
            "",
            all(c, "Hz"),
        );
        expect(withFixed(c, { ...half, methods: [alone] }, [])).toEqual([]);
    });

    it("draws its icon from the figure, its initials grey, its finals red", () => {
        const c = figure(...CIRCUMCENTER, "d = Line(A, B)");
        const svg = atob(
            macroThumbnail(all(c, "A", "B", "C"), all(c, "O", "c", "d"))!.split(
                ",",
            )[1],
        );
        const icon = new DOMParser().parseFromString(svg, "image/svg+xml");
        const dots = [...icon.querySelectorAll("circle[fill]")];
        expect(dots.map((dot) => dot.getAttribute("fill"))).toEqual([
            "#536174",
            "#536174",
            "#536174",
            "#d14343",
        ]);
        expect(
            [...icon.querySelectorAll("[stroke]")].map((shape) => [
                shape.tagName,
                shape.getAttribute("stroke"),
            ]),
        ).toEqual([
            ["circle", "#d14343"],
            ["path", "#d14343"],
        ]);
        // Framed on the circle, the line crossing it: a square around its
        // diameter, in pixels, within the margin of the tools' icons.
        const [, , side] = icon
            .querySelector("svg")!
            .getAttribute("viewBox")!
            .split(" ")
            .map(Number);
        expect(side).toBeCloseTo((2 * 40 * Math.hypot(2, 1) * 20) / 16, 1);
        expect(macroThumbnail(all(c, "A"), [])).not.toBeNull();
        expect(macroThumbnail([], [])).toBeNull();
    });
});
