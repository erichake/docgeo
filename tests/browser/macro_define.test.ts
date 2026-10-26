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
    methodOf,
    missing,
    save,
    savingOf,
} from "../../src/editor/macro";
import { parseLine } from "../../src/editor/text";
import type { construction_object } from "../../src/objects/construction_object";
import type { point_object } from "../../src/objects/point_object";
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
        expect(analysis.determined(get(c, "X"))).toBe(false);
        expect(analysis.determined(get(c, "L"))).toBe(true);
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
        // Only the finals keep their style.
        expect(method.body[3][3]).toEqual({ c: "#ff0000", fc: "#CC66CC" });
        expect(method.body[0][3]).toBeUndefined();
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
            fc: "#CC66CC",
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
        const none = designation(macro, []);
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
        const one = designation(macro, all(c, "C"));
        expect(one).toEqual({
            complete: null,
            next: [["point", ""]],
            last: ["point"],
        });
        expect(takesNext(one, get(c, "t"))).toBe(false);
        expect(designation(macro, all(c, "t"))).toEqual({
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
});
