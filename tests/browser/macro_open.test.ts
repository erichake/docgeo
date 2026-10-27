import { describe, expect, it } from "vitest";
import "../../src/construction";
import type { construction } from "../../src/construction";
import { figureObjects, readDgo } from "../../src/dgo";
import { openBox } from "../../src/editor/figure";
import type { construction_object } from "../../src/objects/construction_object";
import type { macro_object } from "../../src/objects/macro_object";
import type { point_object } from "../../src/objects/point_object";
import { createConstruction, disposeFigures, expectClose } from "./figures";

disposeFigures();

type Json = unknown;

const VIEW = { o: [400, 300], u: 40, w: 800, h: 600 };

function open(o: Json[][], mac: Json[], st?: Json[]): construction {
    const c = createConstruction([800, 600]);
    readDgo(c, { dgo: 1, v: VIEW, o, mac, ...(st && { st }) });
    c.flush();
    return c;
}

const get = <T = point_object>(c: construction, name: string) =>
    c.getObj(name) as T;

const names = (c: construction) =>
    figureObjects(c).map((object: construction_object) => object.name);

// The figure with the application's box opened, and the names of what came
// out of it.
async function opened(
    c: construction,
    node: string,
): Promise<{ c: construction; o: unknown[][]; names: string[] }> {
    const result = await openBox(c, get<macro_object>(c, node));
    const copy = createConstruction([800, 600]);
    readDgo(copy, result!.figure);
    copy.flush();
    return {
        c: copy,
        o: result!.figure.o as unknown[][],
        names: result!.names,
    };
}

const MIDPOINT = {
    n: "Milieu",
    f: ["I"],
    m: [
        { i: [["point"], ["point"]], b: [["Mid", "I", [0, 1]]], f: [2] },
        { i: [["segment"]], b: [["Mid", "I", [2]]], f: [3] },
    ],
};

const CIRCUMCENTER = {
    n: "Circonscrit",
    f: ["O", "c"],
    m: [
        {
            i: [["point"], ["point"], ["point"]],
            b: [
                ["Med", "m1", [0, 1]],
                ["Med", "m2", [1, 2]],
                ["Int", "O", [3, 4, 0]],
                ["Cir", "c", [5, 0]],
            ],
            f: [5, 6],
        },
    ],
};

describe("Opening a macro's box", () => {
    it("puts the body in place of the application, the finals kept", async () => {
        const c = open(
            [
                ["Pt", "A", [-2, 1]],
                ["Pt", "B", [3, 0]],
                ["Pt", "C", [0, 4]],
                ["Mac", "mac1", [0, 0, [0, 1, 2]]],
                ["Out", "P", [3, 1], 0],
                ["Out", "k", [3, 2]],
                ["Mid", "K", [4, 0]],
                ["Line", "m1", [0, 2]],
            ],
            [CIRCUMCENTER],
            [{ c: "#ff0000" }],
        );
        const before = get(c, "P").coords;
        const box = await opened(c, "mac1");
        expect(names(box.c)).toEqual([
            "A",
            "B",
            "C",
            "m2",
            "m3",
            "P",
            "k",
            "K",
            "m1",
        ]);
        expect(box.names).toEqual(["m2", "m3", "P", "k"]);
        expect(box.o.slice(3, 8)).toEqual([
            ["Med", "m2", [0, 1]],
            ["Med", "m3", [1, 2]],
            ["Int", "P", [3, 4, 0], 0],
            ["Cir", "k", [5, 0]],
            ["Mid", "K", [5, 0]],
        ]);
        expectClose(get(box.c, "P").coords, before);
        expect(get(box.c, "P").stroke_color).toBe("#ff0000");
        expect(get(box.c, "P").moveable).toBe(false);
        expect(get(box.c, "m2").isHidden).toBe(false);
        expect(box.c.macros).toHaveLength(1);
    });

    it("styles the intermediates as the body does, hidden ones hidden", async () => {
        const c = open(
            [
                ["Pt", "A", [-2, 1]],
                ["Pt", "B", [3, 0]],
                ["Pt", "C", [0, 4]],
                ["Mac", "mac1", [0, 0, [0, 1, 2]]],
                ["Out", "O", [3, 1]],
                ["Out", "c", [3, 2]],
            ],
            [
                {
                    ...CIRCUMCENTER,
                    m: [
                        {
                            ...CIRCUMCENTER.m[0],
                            b: [
                                ["Med", "m1", [0, 1], 0],
                                ["Med", "m2", [1, 2], 1],
                                ["Int", "O", [3, 4, 0]],
                                ["Cir", "c", [5, 0]],
                            ],
                        },
                    ],
                },
            ],
            [{ h: 1 }, { c: "#ff0000" }],
        );
        const box = await opened(c, "mac1");
        expect(get(box.c, "m1").isHidden).toBe(true);
        expect(get(box.c, "m2").isHidden).toBe(false);
        expect(get(box.c, "m2").stroke_color).toBe("#ff0000");
    });

    it("leaves out a final deleted, and what only it needs", async () => {
        const c = open(
            [
                ["Pt", "A", [-2, 1]],
                ["Pt", "B", [3, 0]],
                ["Pt", "C", [0, 4]],
                ["Mac", "mac1", [0, 0, [0, 1, 2]]],
                ["Out", "c", [3, 2]],
            ],
            [CIRCUMCENTER],
        );
        const box = await opened(c, "mac1");
        // The center comes back, the circle needing it.
        expect(names(box.c)).toEqual(["A", "B", "C", "m1", "m2", "O", "c"]);
        const MIDDLE = {
            n: "Milieux",
            f: ["I", "J"],
            m: [
                {
                    i: [["point"], ["point"], ["point"]],
                    b: [
                        ["Mid", "I", [0, 1]],
                        ["Mid", "J", [1, 2]],
                    ],
                    f: [3, 4],
                },
            ],
        };
        const other = open(
            [
                ["Pt", "A", [-2, 1]],
                ["Pt", "B", [3, 0]],
                ["Pt", "C", [0, 4]],
                ["Mac", "mac1", [0, 0, [0, 1, 2]]],
                ["Out", "J", [3, 2]],
            ],
            [MIDDLE],
        );
        expect(names((await opened(other, "mac1")).c)).toEqual([
            "A",
            "B",
            "C",
            "J",
        ]);
    });

    it("gives the initials' sub-objects the figure's own, or makes them", async () => {
        const SUBS = {
            n: "Sous-objets",
            f: ["E", "F", "G", "H", "K"],
            m: [
                {
                    i: [["segment"], ["circle"], ["polygon"], ["arc"]],
                    b: [
                        ["Mid", "E", [0, 3]],
                        ["Mid", "F", [["vertex", 5, 2], 0]],
                        ["Mid", "G", [6, 7]],
                        ["Mid", "H", [6, 8]],
                        ["Mid", "K", [["side", 5, 1]]],
                    ],
                    f: [10, 11, 12, 13, 14],
                },
            ],
        };
        const c = open(
            [
                ["Pt", "A", [0, 0]],
                ["Pt", "B", [2, 0]],
                ["Seg", "s", [0, 1]],
                ["Pt", "O", [4, 4]],
                ["Cir", "c", [3, 1]],
                ["Pt", "C", [0, 2]],
                ["Poly", "p", [0, 1, 5]],
                ["Pt", "U", [-1, 0]],
                ["Pt", "V", [0, 1]],
                ["Pt", "W", [1, 0]],
                ["Arc", "a", [7, 8, 9]],
                ["Mac", "mac1", [0, 0, [2, 4, 6, 10]]],
                ...["E", "F", "G", "H", "K"].map((name, k) => [
                    "Out",
                    name,
                    [11, k + 1],
                ]),
            ],
            [SUBS],
        );
        const before = ["E", "F", "G", "H"].map((name) => get(c, name).coords);
        const box = await opened(c, "mac1");
        expect(box.o.slice(11)).toEqual([
            ["Ctr", "D", [10], 0],
            ["Mid", "E", [0, 3]],
            ["Mid", "F", [["vertex", 6, 2], 0]],
            ["Mid", "G", [11, 7]],
            ["Mid", "H", [11, 9]],
            ["Mid", "K", [["side", 6, 1]]],
        ]);
        ["E", "F", "G", "H"].forEach((name, k) =>
            expectClose(get(box.c, name).coords, before[k]),
        );
        expect(get(box.c, "D").showName).toBe(true);

        // No entry gives the end of an arc of a center and two points.
        const END = {
            n: "Fin",
            f: ["E"],
            m: [{ i: [["arc"]], b: [["Mid", "E", [0, 2]]], f: [4] }],
        };
        const arc = open(
            [
                ["Pt", "O", [0, 0]],
                ["Pt", "A", [1, 0]],
                ["Pt", "B", [0, 3]],
                ["CArc", "a", [0, 1, 2]],
                ["Mac", "mac1", [0, 0, [3]]],
                ["Out", "E", [4, 1]],
            ],
            [END],
        );
        expect(await openBox(arc, get<macro_object>(arc, "mac1"))).toBeNull();

        // The ends of a segment an application builds are the figure's
        // points they stand for.
        const MAKE = {
            n: "Segment2",
            f: ["s"],
            m: [
                {
                    i: [["point"], ["point"]],
                    b: [["Seg", "s", [0, 1]]],
                    f: [2],
                },
            ],
        };
        const inner = open(
            [
                ["Pt", "A", [0, 0]],
                ["Pt", "B", [2, 0]],
                ["Mac", "mac", [0, 0, [0, 1]]],
                ["Out", "s", [2, 1]],
                ["Mac", "mac1", [1, 0, [3]]],
                ["Out", "E", [4, 1]],
            ],
            [
                MAKE,
                {
                    ...END,
                    m: [
                        { i: [["segment"]], b: [["Mid", "E", [0, 1]]], f: [3] },
                    ],
                },
            ],
        );
        const result = await openBox(inner, get<macro_object>(inner, "mac1"));
        expect(result!.figure.o.slice(4)).toEqual([["Mid", "E", [0, 1]]]);
        // Not those it computes: no entry describes them.
        const built = open(
            [
                ["Pt", "A", [0, 0]],
                ["Pt", "B", [2, 0]],
                ["Mac", "mac", [0, 0, [0, 1]]],
                ["Out", "s", [2, 1]],
                ["Mac", "mac1", [1, 0, [3]]],
                ["Out", "E", [4, 1]],
            ],
            [
                {
                    ...MAKE,
                    m: [
                        {
                            i: [["point"], ["point"]],
                            b: [
                                ["Mid", "M", [0, 1]],
                                ["Seg", "s", [0, 2]],
                            ],
                            f: [3],
                        },
                    ],
                },
                {
                    ...END,
                    m: [
                        {
                            i: [["segment"]],
                            b: [["Mid", "E", [0, 1]]],
                            f: [3],
                        },
                    ],
                },
            ],
        );
        expect(
            await openBox(built, get<macro_object>(built, "mac1")),
        ).toBeNull();
    });

    it("lets out a final on an object where it was moved", async () => {
        const ISOSCELES = {
            n: "Isocèle",
            f: ["C", "t"],
            m: [
                {
                    i: [["point"], ["point"]],
                    b: [
                        ["Med", "m", [0, 1]],
                        ["On", "C", [2, 2]],
                        ["Poly", "t", [0, 1, 3]],
                    ],
                    f: [3, 4],
                },
            ],
        };
        const c = open(
            [
                ["Pt", "A", [-2, 0]],
                ["Pt", "B", [2, 0]],
                ["Mac", "mac1", [0, 0, [0, 1]]],
                ["Out", "C", [2, 1, -3]],
                ["Out", "t", [2, 2]],
            ],
            [ISOSCELES],
        );
        const box = await opened(c, "mac1");
        expect(box.o.find(([, name]) => name === "C")).toEqual([
            "On",
            "C",
            [box.o.findIndex(([, name]) => name === "m"), -3],
        ]);
        expectClose(get(box.c, "C").coords, get(c, "C").coords);
    });

    it("writes a typed number as a constant expression", async () => {
        const DILATE = {
            n: "Homothétie",
            f: ["D"],
            m: [
                {
                    i: [["point"], ["point"], ["number"]],
                    b: [["Dil", "D", [0, 1, ["k", { k: 2 }]]]],
                    f: [3],
                },
            ],
        };
        const c = open(
            [
                ["Pt", "O", [0, 0]],
                ["Pt", "P", [1, 1]],
                ["Mac", "mac1", [0, 0, [0, 1, "-2"]]],
                ["Out", "E", [2, 1]],
            ],
            [DILATE],
        );
        const box = await opened(c, "mac1");
        expect(box.o.slice(2)).toEqual([
            ["Ex", "a", { t: "", s: "-2", xy: [20, 40] }],
            ["Dil", "E", [0, 1, ["k", { k: 2 }]]],
        ]);
        expectClose(get(box.c, "E").coords, [-2, -2, 0]);
    });

    it("opens one level of nested applications, then the next", async () => {
        const QUARTER = {
            n: "Quart",
            f: ["Q"],
            m: [
                {
                    i: [["point"], ["point"]],
                    b: [
                        ["Mac", "m1", [0, 0, [0, 1]]],
                        ["Out", "M", [2, 1]],
                        ["Mac", "m2", [0, 0, [0, 3]]],
                        ["Out", "Q", [4, 1]],
                    ],
                    f: [5],
                },
            ],
        };
        const c = open(
            [
                ["Pt", "A", [0, 0]],
                ["Pt", "B", [4, 8]],
                ["Mac", "mac1", [1, 0, [0, 1]]],
                ["Out", "R", [2, 1]],
            ],
            [MIDPOINT, QUARTER],
        );
        const box = await opened(c, "mac1");
        expect(box.o.slice(2)).toEqual([
            ["Mac", "m1", [0, 0, [0, 1]]],
            ["Out", "M", [2, 1]],
            ["Mac", "m2", [0, 0, [0, 3]]],
            ["Out", "R", [4, 1]],
        ]);
        expectClose(get(box.c, "R").coords, [1, 2, 0]);
        const inner = await opened(box.c, "m2");
        expect(inner.o.slice(2)).toEqual([
            ["Mac", "m1", [0, 0, [0, 1]]],
            ["Out", "M", [2, 1]],
            ["Mid", "R", [0, 3]],
        ]);
        expectClose(get(inner.c, "R").coords, [1, 2, 0]);
    });

    it("keeps the branches the application follows", async () => {
        const CROSS = {
            n: "Croisement",
            f: ["E1", "E2", "E3", "E4"],
            m: [
                {
                    i: [["conic"], ["conic"]],
                    b: [0, 1, 2, 3].map((k) => ["Int", `E${k + 1}`, [0, 1, k]]),
                    f: [2, 3, 4, 5],
                },
            ],
        };
        const c = open(
            [
                ["Pt", "F", [-2, 0]],
                ["Pt", "G", [2, 0]],
                ["Pt", "P", [3, 0]],
                ["Ell", "e", [0, 1, 2]],
                ["Pt", "F2", [0, -2]],
                ["Pt", "G2", [0, 2]],
                ["Pt", "P2", [0, 3]],
                ["Ell", "f", [4, 5, 6]],
                ["Mac", "mac1", [0, 0, [3, 7], [3, 2, 1, 0]]],
                ...[1, 2, 3, 4].map((k) => ["Out", `E${k}`, [8, k]]),
            ],
            [CROSS],
        );
        const before = [1, 2, 3, 4].map((k) => get(c, `E${k}`).coords);
        const box = await opened(c, "mac1");
        expect(box.o.slice(8).map((entry) => entry[2])).toEqual([
            [3, 7, 3],
            [3, 7, 2],
            [3, 7, 1],
            [3, 7, 0],
        ]);
        [1, 2, 3, 4].forEach((k) =>
            expectClose(get(box.c, `E${k}`).coords, before[k - 1]),
        );
    });
});
