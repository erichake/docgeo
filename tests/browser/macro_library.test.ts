/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import "../../src/construction";
import type { construction } from "../../src/construction";
import { dgoJson, readDgo } from "../../src/dgo";
import { isCommand } from "../../src/editor/catalog";
import { add, openBox, resolve } from "../../src/editor/figure";
import {
    conflicts,
    describeLibrary,
    keepMyMacros,
    merge,
    myMacros,
    pruned,
    readLibrary,
    shownMacros,
    type Library,
} from "../../src/editor/library";
import {
    applyMacro,
    macroIndex,
    methodOf,
    save,
    savingOf,
} from "../../src/editor/macro";
import { parseLine } from "../../src/editor/text";
import type { construction_object } from "../../src/objects/construction_object";
import type { macro_object } from "../../src/objects/macro_object";
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
const asLibrary = (c: construction): Library => ({
    macros: c.macros,
    folders: c.macros.map(() => []),
});

// A figure with a macro Milieu, and Moitié, which applies it.
function nested(): construction {
    const c = figure(
        "A = (0, 0)",
        "B = (4, 0)",
        "M = Midpoint(A, B)",
        "C = (1, 3)",
    );
    const middle = methodOf(c, all(c, "A", "B"), all(c, "M"), [], "");
    save(
        c,
        savingOf(c.macros, "Milieu", middle),
        "Milieu",
        ["M"],
        null,
        middle,
    );
    const [I] = applyMacro(c, 0, 0, all(c, "A", "C"));
    const D = methodOf(c, all(c, "C", "A"), [I], [], "");
    expect(D.body.map(([tag]) => tag)).toEqual(["Mac", "Out"]);
    save(c, savingOf(c.macros, "Moitié", D), "Moitié", ["I"], null, D);
    return c;
}

describe("Macro libraries", () => {
    it("are .dgo files without objects, folders and all", async () => {
        const c = nested();
        const library = { macros: c.macros, folders: [["A", "B"], []] };
        const figure = await describeLibrary(library);
        expect(figure.o).toEqual([]);
        expect(figure.mac.map(({ d }) => d)).toEqual([["A", "B"], undefined]);
        const read = readLibrary(JSON.parse(JSON.stringify(figure)));
        expect(read.folders).toEqual([["A", "B"], []]);
        expect(JSON.stringify(read.macros)).toBe(JSON.stringify(c.macros));
        expect(() =>
            readLibrary({ ...figure, mac: [{ ...figure.mac[0], d: [3] }] }),
        ).toThrow();
    });

    it("copy a macro with those it applies, before it", () => {
        const c = nested();
        const into = { macros: [], folders: [] };
        const { library, rewritten } = merge(
            into,
            asLibrary(c),
            ["Moitié"],
            false,
        );
        expect(library.macros.map(({ name }) => name)).toEqual([
            "Milieu",
            "Moitié",
        ]);
        expect(rewritten).toBe(false);
        // Already there, the same: kept.
        const again = merge(library, asLibrary(c), ["Moitié"], false);
        expect(again.library.macros[0]).toBe(library.macros[0]);
        expect(again.library.macros[1]).toBe(library.macros[1]);
        expect(conflicts(library, asLibrary(c), ["Moitié"])).toEqual([]);
    });

    it("tell a macro of the same name with another definition, which may be replaced", () => {
        const c = nested();
        const other = figure("A = (0, 0)", "B = (4, 0)", "N = Midpoint(B, A)");
        const method = methodOf(
            other,
            all(other, "A", "B"),
            all(other, "N"),
            [],
            "",
        );
        save(
            other,
            savingOf([], "Milieu", method),
            "Milieu",
            ["M"],
            null,
            method,
        );
        other.macros.unshift({ ...other.macros[0], name: "Autre" });
        const into = asLibrary(other);
        expect(conflicts(into, asLibrary(c), ["Moitié"])).toEqual(["Milieu"]);
        // Kept: Moitié applies the one there.
        const kept = merge(into, asLibrary(c), ["Moitié"], false);
        expect(kept.library.macros[1]).toBe(other.macros[1]);
        expect(kept.rewritten).toBe(false);
        // Replaced, where it was.
        const replaced = merge(into, asLibrary(c), ["Moitié"], true);
        expect(replaced.rewritten).toBe(true);
        expect(replaced.indices).toEqual([0, 1]);
        expect(replaced.library.macros.map(({ name }) => name)).toEqual([
            "Autre",
            "Milieu",
            "Moitié",
        ]);
        expect(replaced.library.macros[1].methods[0].body).toEqual(
            c.macros[0].methods[0].body,
        );
        expect(replaced.library.macros[2].methods[0].body[0][2]).toEqual([
            1,
            0,
            [1, 0],
        ]);
    });

    it("move a macro replaced after one it now applies", () => {
        const c = nested();
        // Mine: Moitié alone, unrelated to Milieu.
        const lone = figure("A = (0, 0)", "B = (4, 0)", "N = Midpoint(B, A)");
        const method = methodOf(
            lone,
            all(lone, "A", "B"),
            all(lone, "N"),
            [],
            "",
        );
        save(
            lone,
            savingOf([], "Moitié", method),
            "Moitié",
            ["I"],
            null,
            method,
        );
        const { library, indices, rewritten } = merge(
            asLibrary(lone),
            asLibrary(c),
            ["Moitié"],
            true,
        );
        expect(library.macros.map(({ name }) => name)).toEqual([
            "Milieu",
            "Moitié",
        ]);
        expect(indices).toEqual([1]);
        expect(rewritten).toBe(true);
    });

    it("keep mine in the browser, but for the copies of the library's", async () => {
        const c = nested();
        const library = { macros: c.macros, folders: [[], ["Mes"]] };
        await keepMyMacros(library);
        const mine = myMacros();
        expect(mine.folders).toEqual([[], ["Mes"]]);
        expect(shownMacros(mine, { macros: [], folders: [] })).toEqual([0, 1]);
        const supplied = pruned(mine, ["Milieu"]);
        expect(supplied.macros.map(({ name }) => name)).toEqual(["Milieu"]);
        expect(shownMacros(mine, supplied)).toEqual([1]);
        // Without Moitié, Milieu only served it.
        expect(pruned(mine, []).macros).toEqual([]);
        localStorage.removeItem("docgeo-macros");
        expect(myMacros().macros).toEqual([]);
    });
});

// The editor's languages, each its own library.
const LANGS = Object.keys(import.meta.glob("../../src/editor/lang/*.ts")).map(
    (path) => path.replace(/.*\/|\.ts$/g, ""),
);

const supplied = async (lang: string) =>
    readLibrary(
        await dgoJson(await (await fetch(`/macros/${lang}.dgo`)).blob()),
    );

type XY = readonly number[];
const sub = (p: XY, q: XY) => [p[0] - q[0], p[1] - q[1]];
const dist = (p: XY, q: XY) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const dot = (u: XY, v: XY) => u[0] * v[0] + u[1] * v[1];
const cross = (u: XY, v: XY) => u[0] * v[1] - u[1] * v[0];
// The angle at O, in degrees, from 0 to 180.
const angle = (p: XY, o: XY, q: XY) =>
    (Math.acos(dot(sub(p, o), sub(q, o)) / (dist(p, o) * dist(q, o))) * 180) /
    Math.PI;
const toLine = (p: XY, line: { P1: point_object; VEC: XY }) =>
    Math.abs(cross(line.VEC, sub(p, line.P1.coords))) /
    Math.hypot(line.VEC[0], line.VEC[1]);
const throughLine = (p: XY, q: XY) => ({
    P1: { coords: p } as point_object,
    VEC: sub(q, p),
});
// Complex numbers, as pairs.
const times = (a: XY, b: XY) => [
    a[0] * b[0] - a[1] * b[1],
    a[0] * b[1] + a[1] * b[0],
];
const over = (a: XY, b: XY) => {
    const n = dot(b, b);
    return [(a[0] * b[0] + a[1] * b[1]) / n, (a[1] * b[0] - a[0] * b[1]) / n];
};
const crossRatio = (a: XY, b: XY, c: XY, d: XY) =>
    over(times(sub(c, a), sub(d, b)), times(sub(c, b), sub(d, a)));
function circumcenter(a: XY, b: XY, c: XY): number[] {
    const d =
        2 *
        (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    const n = (p: XY) => dot(p, p);
    return [
        (n(a) * (b[1] - c[1]) + n(b) * (c[1] - a[1]) + n(c) * (a[1] - b[1])) /
            d,
        (n(a) * (c[0] - b[0]) + n(b) * (a[0] - c[0]) + n(c) * (b[0] - a[0])) /
            d,
    ];
}

type Circle = { CENTER: XY; R: number };
type Line = { P1: point_object; VEC: XY };

// A conic's equation [a, b, c, d, e, f] through five of its points.
type Quadric = { pointAt(alpha: readonly [number, number]): readonly number[] };
function equation(conic: construction_object): number[] {
    const rows = (
        [
            [1, 0],
            [0, 1],
            [-1, 0.3],
            [0.4, -1],
            [0.7, 0.7],
        ] as const
    ).map((alpha) => {
        const [x, y] = (conic as unknown as Quadric).pointAt(alpha);
        return [x * x, x * y, y * y, x, y, 1];
    });
    // Its null vector, the last unknown set to 1, by elimination.
    for (let col = 0; col < 5; col++) {
        let pivot = col;
        for (let r = col + 1; r < 5; r++)
            if (Math.abs(rows[r][col]) > Math.abs(rows[pivot][col])) pivot = r;
        [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
        for (let r = 0; r < 5; r++)
            if (r !== col) {
                const g = rows[r][col] / rows[col][col];
                for (let k = col; k < 6; k++) rows[r][k] -= g * rows[col][k];
            }
    }
    const K = [...rows.map((row, r) => -row[5] / row[r]), 1];
    const scale = Math.max(...K.map(Math.abs));
    return K.map((value) => value / scale);
}
// How far a point is from the conic, to first order.
function offConic(K: number[], [x, y]: XY): number {
    const [a, b, c, d, e, f] = K;
    const value = a * x * x + b * x * y + c * y * y + d * x + e * y + f;
    return (
        Math.abs(value) /
        Math.hypot(2 * a * x + b * y + d, b * x + 2 * c * y + e)
    );
}
// [P 1] M [Q 1] for the conic's matrix M.
function bilinear([a, b, c, d, e, f]: number[], [px, py]: XY, [qx, qy]: XY) {
    return (
        a * px * qx +
        (b / 2) * (px * qy + py * qx) +
        c * py * qy +
        (d / 2) * (px + qx) +
        (e / 2) * (py + qy) +
        f
    );
}
const sampled = (conic: construction_object) =>
    (
        [
            [0.9, 0.4],
            [-0.3, 1],
            [-1, -0.6],
        ] as const
    ).map((alpha) => (conic as unknown as Quadric).pointAt(alpha));
const intersect = (l: Line, m: Line) => {
    const t = cross(sub(m.P1.coords, l.P1.coords), m.VEC) / cross(l.VEC, m.VEC);
    return [l.P1.coords[0] + t * l.VEC[0], l.P1.coords[1] + t * l.VEC[1]];
};

const ELLIPSE = [
    "F1 = (-2, -1)",
    "F2 = (3, 1)",
    "S = (1, 3)",
    "co = Ellipse(F1, F2, S)",
];
const HYPERBOLA = [
    "F1 = (-3, -1)",
    "F2 = (3, 1)",
    "S = (1.5, -0.5)",
    "co = Hyperbola(F1, F2, S)",
];
const TRIANGLE = ["A = (-3, -2)", "B = (5, -1)", "C = (1, 4)"];
const CIRCLES = [
    "P = (-3, 0)",
    "Q = (-2, 0)",
    "c = Circle(P, Q)",
    "R = (4, 2)",
    "d = Circle(R, 3)",
];

// The Poincaré disk of the hyperbolic macros, and geodesics g and h in
// it, which don't meet.
const DISK = ["O = (1, -0.5)", "Hz = Circle(O, 5)"];
const HZ: Circle = { CENTER: [1, -0.5], R: 5 };
const G = [
    "G1 = (-4, -0.5)",
    "G2 = (4, 3.5)",
    "X = Point(O + 5 * (-1 + 2 * i) * (1 - 2 / sqrt(5)))",
    "g = Arc(G1, X, G2)",
];
const G_CIRCLE: Circle = { CENTER: [-4, 9.5], R: 10 };
const H = [
    "H1 = (6, -0.5)",
    "H2 = (4, -4.5)",
    "Y = Point(O + 5 * (1 - 0.5 * i) * (1 - 0.5 / sqrt(1.25)))",
    "h = Arc(H1, Y, H2)",
];
const H_CIRCLE: Circle = { CENTER: [6, -3], R: 2.5 };
const on = ({ CENTER, R }: Circle, p: XY) =>
    expect(dist(CENTER, p)).toBeCloseTo(R);
const orthogonal = (k: Circle, l: Circle) =>
    expect(dist(k.CENTER, l.CENTER) ** 2).toBeCloseTo(k.R ** 2 + l.R ** 2);
const invert = ({ CENTER, R }: Circle, p: XY) => {
    const d = dist(CENTER, p) ** 2;
    return [
        CENTER[0] + (R * R * (p[0] - CENTER[0])) / d,
        CENTER[1] + (R * R * (p[1] - CENTER[1])) / d,
    ];
};
// A hyperbolic line through these points: an arc orthogonal to the disk.
const geodesic = (arc: construction_object, ...points: XY[]) => {
    const k = arc as unknown as Circle;
    orthogonal(k, HZ);
    points.forEach((p) => on(k, p));
};
function hDist(p: XY, q: XY): number {
    const a = [(p[0] - 1) / 5, (p[1] + 0.5) / 5];
    const b = [(q[0] - 1) / 5, (q[1] + 0.5) / 5];
    const t = dist(a, b) / Math.hypot(...sub([1, 0], times([a[0], -a[1]], b)));
    return Math.log((1 + t) / (1 - t));
}

// By its English name, a figure each macro is applied to, its initials
// there, and what its finals must be.
const USES: Record<
    string,
    [
        string[],
        string[],
        (finals: construction_object[], at: (name: string) => XY) => void,
    ]
> = {
    IsoscelesTriangle: [
        ["A = (-3, -2)", "B = (5, -1)"],
        ["A", "B"],
        ([C, t], at) => {
            expect(dist(at("A"), (C as point_object).coords)).toBeCloseTo(
                dist(at("B"), (C as point_object).coords),
            );
            expect((C as point_object).moveable).toBe(true);
            expect(t.name).toBe("t");
        },
    ],
    RightTriangle: [
        ["A = (-3, -2)", "B = (5, -1)"],
        ["A", "B"],
        ([C], at) => {
            expect(
                angle(at("B"), at("A"), (C as point_object).coords),
            ).toBeCloseTo(90);
            expect((C as point_object).moveable).toBe(true);
        },
    ],
    RightIsoscelesTriangle: [
        ["A = (-3, -2)", "B = (5, -1)"],
        ["A", "B"],
        ([C], at) => {
            const p = (C as point_object).coords;
            expect(angle(at("B"), at("A"), p)).toBeCloseTo(90);
            expect(dist(at("A"), p)).toBeCloseTo(dist(at("A"), at("B")));
        },
    ],
    EquilateralTriangle: [
        ["A = (-3, -2)", "B = (5, -1)"],
        ["A", "B"],
        ([C], at) => {
            const p = (C as point_object).coords;
            expect(dist(at("A"), p)).toBeCloseTo(dist(at("A"), at("B")));
            expect(dist(at("B"), p)).toBeCloseTo(dist(at("A"), at("B")));
            // On the left of AB.
            expect(
                cross(sub(at("B"), at("A")), sub(p, at("A"))),
            ).toBeGreaterThan(0);
        },
    ],
    Incircle: [
        TRIANGLE,
        ["A", "B", "C"],
        ([I, c], at) => {
            const center = (I as point_object).coords;
            const r = (c as unknown as Circle).R;
            for (const [p, q] of ["AB", "BC", "CA"])
                expect(toLine(center, throughLine(at(p), at(q)))).toBeCloseTo(
                    r,
                );
        },
    ],
    Excircles: [
        TRIANGLE,
        ["A", "B", "C"],
        (finals, at) => {
            for (let k = 0; k < 3; k++) {
                const center = (finals[k] as point_object).coords;
                const r = (finals[k + 3] as unknown as Circle).R;
                expectClose(
                    (finals[k + 3] as unknown as Circle).CENTER,
                    center,
                );
                for (const [p, q] of ["AB", "BC", "CA"])
                    expect(
                        toLine(center, throughLine(at(p), at(q))),
                    ).toBeCloseTo(r);
            }
        },
    ],
    NinePointCircle: [
        TRIANGLE,
        ["A", "B", "C"],
        ([N], at) => {
            const center = (N as point_object).coords;
            const middle = (p: string, q: string) => [
                (at(p)[0] + at(q)[0]) / 2,
                (at(p)[1] + at(q)[1]) / 2,
            ];
            const r = dist(center, middle("A", "B"));
            expect(dist(center, middle("B", "C"))).toBeCloseTo(r);
            expect(dist(center, middle("C", "A"))).toBeCloseTo(r);
        },
    ],
    EulerLine: [
        TRIANGLE,
        ["A", "B", "C"],
        ([e], at) => {
            const [a, b, c] = [at("A"), at("B"), at("C")];
            const o = circumcenter(a, b, c);
            const g = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
            const h = [
                a[0] + b[0] + c[0] - 2 * o[0],
                a[1] + b[1] + c[1] - 2 * o[1],
            ];
            for (const p of [o, g, h])
                expect(toLine(p, e as unknown as Line)).toBeCloseTo(0);
        },
    ],
    FermatPoint: [
        TRIANGLE,
        ["A", "B", "C"],
        ([F], at) => {
            const f = (F as point_object).coords;
            expect(angle(at("A"), f, at("B"))).toBeCloseTo(120);
            expect(angle(at("B"), f, at("C"))).toBeCloseTo(120);
        },
    ],
    SimsonLine: [
        TRIANGLE,
        ["A", "B", "C"],
        ([k, P, s], at) => {
            const p = (P as point_object).coords;
            const { CENTER, R } = k as unknown as Circle;
            expect(dist(p, CENTER)).toBeCloseTo(R);
            expect((P as point_object).moveable).toBe(true);
            // The foot on AB is on it too.
            const u = sub(at("B"), at("A"));
            const t = dot(sub(p, at("A")), u) / dot(u, u);
            const foot = [at("A")[0] + t * u[0], at("A")[1] + t * u[1]];
            expect(toLine(foot, s as unknown as Line)).toBeCloseTo(0);
        },
    ],
    IsogonalConjugate: [
        [...TRIANGLE, "P = (1, 0)"],
        ["A", "B", "C", "P"],
        ([Q], at) => {
            const q = (Q as point_object).coords;
            expect(angle(at("B"), at("A"), at("P"))).toBeCloseTo(
                angle(q, at("A"), at("C")),
            );
            expect(angle(at("C"), at("B"), at("P"))).toBeCloseTo(
                angle(q, at("B"), at("A")),
            );
        },
    ],
    Symmedians: [
        TRIANGLE,
        ["A", "B", "C"],
        ([K], at) => {
            // The isogonal conjugate of the centroid.
            const k = (K as point_object).coords;
            const [a, b, c] = [at("A"), at("B"), at("C")];
            const g = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
            expect(angle(b, a, g)).toBeCloseTo(angle(k, a, c));
            expect(angle(c, b, g)).toBeCloseTo(angle(k, b, a));
        },
    ],
    Parallelogram: [
        TRIANGLE,
        ["A", "B", "C"],
        ([D, p]) => {
            expectClose((D as point_object).coords, [-7, 3, 0]);
            expect(p.name).toBe("p");
        },
    ],
    Trapezoid: [
        TRIANGLE,
        ["A", "B", "C"],
        ([D], at) => {
            const d = (D as point_object).coords;
            expect(cross(sub(d, at("C")), sub(at("B"), at("A")))).toBeCloseTo(
                0,
            );
            expect((D as point_object).moveable).toBe(true);
        },
    ],
    Kite: [
        TRIANGLE,
        ["A", "B", "C"],
        ([D], at) => {
            const d = (D as point_object).coords;
            expect(dist(at("A"), d)).toBeCloseTo(dist(at("A"), at("B")));
            expect(dist(at("C"), d)).toBeCloseTo(dist(at("C"), at("B")));
        },
    ],
    Rhombus: [
        ["A = (-3, -2)", "B = (5, -1)"],
        ["A", "B"],
        ([C, D], at) => {
            const [c, d] = [
                (C as point_object).coords,
                (D as point_object).coords,
            ];
            const side = dist(at("A"), at("B"));
            expect(dist(at("A"), d)).toBeCloseTo(side);
            expect(dist(c, d)).toBeCloseTo(side);
            expect(dist(c, at("B"))).toBeCloseTo(side);
            expect((D as point_object).moveable).toBe(true);
        },
    ],
    Rectangle: [
        ["A = (-3, -2)", "B = (5, -1)"],
        ["A", "B"],
        ([C, D], at) => {
            const [c, d] = [
                (C as point_object).coords,
                (D as point_object).coords,
            ];
            expect(angle(at("B"), at("A"), d)).toBeCloseTo(90);
            expectClose(sub(c, at("B")), sub(d, at("A")));
        },
    ],
    Square: [
        ["A = (-3, -2)", "B = (5, -1)"],
        ["A", "B"],
        ([C, D], at) => {
            const [c, d] = [
                (C as point_object).coords,
                (D as point_object).coords,
            ];
            expect(angle(at("B"), at("A"), d)).toBeCloseTo(90);
            expect(dist(at("A"), d)).toBeCloseTo(dist(at("A"), at("B")));
            expectClose(sub(c, at("B")), sub(d, at("A")));
        },
    ],
    RadicalAxis: [
        CIRCLES,
        ["c", "d"],
        ([a], at) => {
            const line = a as unknown as Line;
            const m = line.P1.coords;
            const power = (center: XY, r: number) =>
                dist(m, center) ** 2 - r ** 2;
            expect(power(at("P"), 1)).toBeCloseTo(power(at("R"), 3));
            expect(dot(line.VEC, sub(at("R"), at("P")))).toBeCloseTo(0);
        },
    ],
    RadicalCenter: [
        [...CIRCLES, "S = (0, 4)", "e = Circle(S, 1)"],
        ["c", "d", "e"],
        ([X], at) => {
            const x = (X as point_object).coords;
            const power = (center: XY, r: number) =>
                dist(x, center) ** 2 - r ** 2;
            expect(power(at("P"), 1)).toBeCloseTo(power(at("R"), 3));
            expect(power(at("P"), 1)).toBeCloseTo(power(at("S"), 1));
        },
    ],
    HomothetyCenters: [
        CIRCLES,
        ["c", "d"],
        ([I, J], at) => {
            const [i, j] = [
                (I as point_object).coords,
                (J as point_object).coords,
            ];
            const [p, r] = [at("P"), at("R")];
            expect(dist(i, p) / dist(i, r)).toBeCloseTo(1 / 3);
            expect(dist(j, p) / dist(j, r)).toBeCloseTo(1 / 3);
            expect(dist(p, r)).toBeCloseTo(dist(p, i) + dist(i, r));
        },
    ],
    CommonTangents: [
        CIRCLES,
        ["c", "d"],
        (finals, at) => {
            expect(finals.every(({ defined }) => defined)).toBe(true);
            finals.forEach((line) => {
                expect(toLine(at("P"), line as unknown as Line)).toBeCloseTo(1);
                expect(toLine(at("R"), line as unknown as Line)).toBeCloseTo(3);
            });
        },
    ],
    OrthogonalCircle: [
        [...CIRCLES, "M = (0, -3)"],
        ["c", "d", "M"],
        ([X, k], at) => {
            const x = (X as point_object).coords;
            const r = (k as unknown as Circle).R;
            expect(dist(x, at("M"))).toBeCloseTo(r);
            expect(dist(x, at("P")) ** 2).toBeCloseTo(1 + r ** 2);
            expect(dist(x, at("R")) ** 2).toBeCloseTo(9 + r ** 2);
        },
    ],
    LimitPoints: [
        CIRCLES,
        ["c", "d"],
        ([L1, L2], at) => {
            const [l1, l2] = [
                (L1 as point_object).coords,
                (L2 as point_object).coords,
            ];
            // Inverse of each other in both circles.
            expect(dot(sub(l1, at("P")), sub(l2, at("P")))).toBeCloseTo(1);
            expect(dot(sub(l1, at("R")), sub(l2, at("R")))).toBeCloseTo(9);
        },
    ],
    ApolloniusCircle: [
        ["A = (-3, 1)", "B = (4, 0)", "k = 3"],
        ["A", "B", "k"],
        ([c], at) => {
            const { CENTER, R } = c as unknown as Circle;
            for (const t of [0, 1, 2.5]) {
                const m = [
                    CENTER[0] + R * Math.cos(t),
                    CENTER[1] + R * Math.sin(t),
                ];
                expect(dist(m, at("A"))).toBeCloseTo(3 * dist(m, at("B")));
            }
        },
    ],
    TangentCirclesTwoPoints: [
        ["O = (0, 0)", "c = Circle(O, 2)", "A = (3, 3)", "B = (5, -1)"],
        ["c", "A", "B"],
        (finals, at) => {
            expect(finals.length).toBe(2);
            finals.forEach((circle) => {
                const { CENTER, R } = circle as unknown as Circle;
                expect(dist(CENTER, at("A"))).toBeCloseTo(R);
                expect(dist(CENTER, at("B"))).toBeCloseTo(R);
                const between = dist(CENTER, at("O"));
                expect(
                    Math.min(
                        Math.abs(between - R - 2),
                        Math.abs(between - Math.abs(R - 2)),
                    ),
                ).toBeCloseTo(0);
            });
        },
    ],
    TangentCirclesOnePoint: [
        [...CIRCLES, "M = (0, -4)"],
        ["c", "d", "M"],
        (finals, at) => {
            expect(finals.every(({ defined }) => defined)).toBe(true);
            const tangent = (center: XY, R: number, other: XY, r: number) => {
                const between = dist(center, other);
                return Math.min(
                    Math.abs(between - R - r),
                    Math.abs(between - Math.abs(R - r)),
                );
            };
            finals.forEach((circle) => {
                const { CENTER, R } = circle as unknown as Circle;
                expect(dist(CENTER, at("M"))).toBeCloseTo(R);
                expect(tangent(CENTER, R, at("P"), 1)).toBeCloseTo(0);
                expect(tangent(CENTER, R, at("R"), 3)).toBeCloseTo(0);
            });
        },
    ],
    QuadrilateralEulerCenter: [
        ["A = (-4, -2)", "B = (3, -3)", "C = (4, 2)", "D = (-2, 3)"],
        ["A", "B", "C", "D"],
        ([E], at) => {
            const e = (E as point_object).coords;
            const middle = (p: string, q: string) => [
                (at(p)[0] + at(q)[0]) / 2,
                (at(p)[1] + at(q)[1]) / 2,
            ];
            // On the nine-point circle of BCD, which the body doesn't use.
            const [m, n, o] = [
                middle("B", "C"),
                middle("C", "D"),
                middle("D", "B"),
            ];
            const center = circumcenter(m, n, o);
            expect(dist(e, center)).toBeCloseTo(dist(m, center));
        },
    ],
    AffineMap: [
        [
            "A = (-4, -2)",
            "B = (0, -3)",
            "C = (-3, 2)",
            "U = (1, 1)",
            "V = (5, 0)",
            "W = (2, 4)",
            "M = Point((A + B + C) / 3)",
        ],
        ["A", "B", "C", "U", "V", "W", "M"],
        ([N], at) => {
            const [u, v, w] = [at("U"), at("V"), at("W")];
            expectClose((N as point_object).coords.slice(0, 2), [
                (u[0] + v[0] + w[0]) / 3,
                (u[1] + v[1] + w[1]) / 3,
            ]);
        },
    ],
    SimilarityCenter: [
        ["A = (-4, -1)", "B = (-1, -2)", "U = (2, 1)", "V = (4, 4)"],
        ["A", "B", "U", "V"],
        ([S], at) => {
            const s = (S as point_object).coords;
            expectClose(
                over(sub(at("U"), s), sub(at("A"), s)),
                over(sub(at("V"), s), sub(at("B"), s)),
            );
        },
    ],
    HarmonicConjugate: [
        ["A = (-3, 1)", "B = (5, 1)", "C = (3, 1)"],
        ["A", "B", "C"],
        ([D], at) => {
            expectClose(
                crossRatio(
                    at("A"),
                    at("B"),
                    at("C"),
                    (D as point_object).coords,
                ),
                [-1, 0],
            );
        },
    ],
    HarmonicHomology: [
        [
            "U = (-4, -2)",
            "V = (4, -1)",
            "d = Line(U, V)",
            "O = (1, 4)",
            "M = (2, 1)",
        ],
        ["d", "O", "M"],
        ([N], at) => {
            const n = (N as point_object).coords;
            const [o, m] = [at("O"), at("M")];
            expect(cross(sub(n, o), sub(m, o))).toBeCloseTo(0);
            // I, where OM cuts d.
            const [u, v] = [at("U"), at("V")];
            const t = cross(sub(u, o), sub(v, u)) / cross(sub(m, o), sub(v, u));
            const i = [o[0] + t * (m[0] - o[0]), o[1] + t * (m[1] - o[1])];
            expectClose(crossRatio(o, i, m, n), [-1, 0]);
        },
    ],
    CrossRatio: [
        ["A = (-4, 1)", "B = (3, 1)", "C = (-1, 1)", "D = (5, 1)"],
        ["A", "B", "C", "D"],
        ([r]) => {
            // (CA / CB) / (DA / DB), signed.
            expect((r as unknown as { value: number }).value).toBeCloseTo(
                3 / -4 / (9 / 2),
            );
        },
    ],
    Homography: [
        [
            "A = (-4, -2)",
            "B = (-1, -2)",
            "C = (3, -2)",
            "U = (-3, 1)",
            "V = (0, 2)",
            "W = (3, 3)",
            "M = (1, -2)",
        ],
        ["A", "B", "C", "U", "V", "W", "M"],
        ([N], at) => {
            const n = (N as point_object).coords;
            expect(cross(sub(n, at("U")), sub(at("W"), at("U")))).toBeCloseTo(
                0,
            );
            expectClose(
                crossRatio(at("M"), at("A"), at("B"), at("C")),
                crossRatio(n, at("U"), at("V"), at("W")),
            );
        },
    ],
    TangentCirclesThreeCircles: [
        [...CIRCLES, "S = (0, 4)", "e = Circle(S, 1)"],
        ["c", "d", "e"],
        (finals, at) => {
            expect(finals.filter(({ defined }) => defined).length).toBe(8);
            const tangent = (center: XY, R: number, other: XY, r: number) => {
                const between = dist(center, other);
                return Math.min(
                    Math.abs(between - R - r),
                    Math.abs(between - Math.abs(R - r)),
                );
            };
            finals.forEach((circle) => {
                const { CENTER, R } = circle as unknown as Circle;
                expect(tangent(CENTER, R, at("P"), 1)).toBeCloseTo(0);
                expect(tangent(CENTER, R, at("R"), 3)).toBeCloseTo(0);
                expect(tangent(CENTER, R, at("S"), 1)).toBeCloseTo(0);
            });
        },
    ],
    ConicFocusDirectrixEccentricity: [
        [
            "U = (-4, -3)",
            "V = (-4, 3)",
            "g = Line(U, V)",
            "F = (-1, 1)",
            "e = 1.5",
        ],
        ["g", "F", "e"],
        ([co], at) => {
            for (const m of sampled(co))
                expect(dist(m, at("F")) / Math.abs(m[0] + 4)).toBeCloseTo(1.5);
        },
    ],
    ConicFocusDirectrixPoint: [
        [
            "U = (-4, -3)",
            "V = (-4, 3)",
            "g = Line(U, V)",
            "F = (-1, 1)",
            "M = (1, 2)",
        ],
        ["g", "F", "M"],
        ([co], at) => {
            const e = dist(at("M"), at("F")) / 5;
            expect(offConic(equation(co), at("M"))).toBeCloseTo(0);
            for (const m of sampled(co))
                expect(dist(m, at("F")) / Math.abs(m[0] + 4)).toBeCloseTo(e);
        },
    ],
    ConicFromCircleAndFocus: [
        ["O = (-1, 0)", "c = Circle(O, 5)", "F = (1.5, 1)"],
        ["c", "F"],
        ([co, V1, V2], at) => {
            for (const m of sampled(co))
                expect(dist(m, at("O")) + dist(m, at("F"))).toBeCloseTo(5);
            const K = equation(co);
            for (const V of [V1, V2])
                expect(offConic(K, (V as point_object).coords)).toBeCloseTo(0);
        },
    ],
    ConicThreePointsTangent: [
        [
            "A = (-3, 1)",
            "B = (0, 3)",
            "C = (3, 1)",
            "T = (0, -2)",
            "Z = (2, -2.5)",
            "t = Line(T, Z)",
        ],
        ["A", "B", "C", "T", "t"],
        ([co], at) => {
            const K = equation(co);
            for (const P of ["A", "B", "C", "T"])
                expect(offConic(K, at(P))).toBeCloseTo(0);
            const [a, b, c, d, e] = K;
            const [x, y] = at("T");
            const gradient = [2 * a * x + b * y + d, b * x + 2 * c * y + e];
            expect(
                dot(gradient, sub(at("Z"), at("T"))) / Math.hypot(...gradient),
            ).toBeCloseTo(0);
        },
    ],
    ConicPointTwoTangents: [
        [
            "A = (0, 3)",
            "T1 = (-3, 0)",
            "Z1 = (-3.2, 2)",
            "t1 = Line(T1, Z1)",
            "T2 = (3, 0.5)",
            "Z2 = (3.5, 2)",
            "t2 = Line(T2, Z2)",
        ],
        ["A", "T1", "t1", "T2", "t2"],
        ([co], at) => {
            const K = equation(co);
            const [a, b, c, d, e] = K;
            for (const P of ["A", "T1", "T2"])
                expect(offConic(K, at(P))).toBeCloseTo(0);
            for (const [T, Z] of [
                ["T1", "Z1"],
                ["T2", "Z2"],
            ]) {
                const [x, y] = at(T);
                const gradient = [2 * a * x + b * y + d, b * x + 2 * c * y + e];
                expect(
                    dot(gradient, sub(at(Z), at(T))) / Math.hypot(...gradient),
                ).toBeCloseTo(0);
            }
        },
    ],
    ParabolasFourPoints: [
        ["A = (-3, -1)", "B = (-1, 2.5)", "C = (2, 1.5)", "D = (4, -2)"],
        ["A", "B", "C", "D"],
        (finals, at) => {
            const [K1, K2] = finals.map(equation);
            for (const K of [K1, K2]) {
                for (const P of ["A", "B", "C", "D"])
                    expect(offConic(K, at(P))).toBeCloseTo(0);
                expect(K[1] * K[1] - 4 * K[0] * K[2]).toBeCloseTo(0);
            }
            expect(
                Math.abs(K1[3] - K2[3]) + Math.abs(K1[4] - K2[4]),
            ).toBeGreaterThan(0.01);
        },
    ],
    RectangularHyperbolaFourPoints: [
        ["A = (-3, -1)", "B = (-1, 2.5)", "C = (2, 1.5)", "D = (4, -2)"],
        ["A", "B", "C", "D"],
        ([co], at) => {
            const K = equation(co);
            for (const P of ["A", "B", "C", "D"])
                expect(offConic(K, at(P))).toBeCloseTo(0);
            expect(K[0] + K[2]).toBeCloseTo(0);
        },
    ],
    ConicCenter: [
        HYPERBOLA,
        ["co"],
        ([O]) => {
            expectClose((O as point_object).coords.slice(0, 2), [0, 0]);
        },
    ],
    ConicAxes: [
        ELLIPSE,
        ["co"],
        ([a1, a2], at) => {
            for (const F of ["F1", "F2"])
                expect(toLine(at(F), a1 as unknown as Line)).toBeCloseTo(0);
            expect(
                dot((a1 as unknown as Line).VEC, (a2 as unknown as Line).VEC),
            ).toBeCloseTo(0);
            expect(toLine([0.5, 0], a2 as unknown as Line)).toBeCloseTo(0);
        },
    ],
    FociDirectrices: [
        ELLIPSE,
        ["co"],
        ([G1, G2, d1], at) => {
            const foci = [G1, G2].map((G) => (G as point_object).coords);
            expect(
                Math.min(dist(foci[0], at("F1")), dist(foci[1], at("F1"))),
            ).toBeCloseTo(0);
            expect(
                Math.min(dist(foci[0], at("F2")), dist(foci[1], at("F2"))),
            ).toBeCloseTo(0);
            const [m, n] = sampled(G1.C.getObj("co")!);
            const ratio = (p: XY) =>
                dist(p, foci[0]) / toLine(p, d1 as unknown as Line);
            expect(ratio(m)).toBeCloseTo(ratio(n));
        },
    ],
    Asymptotes: [
        HYPERBOLA,
        ["co"],
        (finals) => {
            const [a, b, c] = equation(finals[0].C.getObj("co")!);
            finals.forEach((line) => {
                const { VEC } = line as unknown as Line;
                const [x, y] = [VEC[0], VEC[1]].map(
                    (v) => v / Math.hypot(VEC[0], VEC[1]),
                );
                expect(a * x * x + b * x * y + c * y * y).toBeCloseTo(0);
                expect(toLine([0, 0], line as unknown as Line)).toBeCloseTo(0);
            });
        },
    ],
    AuxiliaryCircle: [
        ELLIPSE,
        ["co"],
        ([c], at) => {
            const { CENTER, R } = c as unknown as Circle;
            expectClose(CENTER.slice(0, 2), [0.5, 0]);
            expect(R).toBeCloseTo(
                (dist(at("S"), at("F1")) + dist(at("S"), at("F2"))) / 2,
            );
        },
    ],
    DirectorCircle: [
        ELLIPSE,
        ["co"],
        ([c], at) => {
            const a = (dist(at("S"), at("F1")) + dist(at("S"), at("F2"))) / 2;
            const focal = dist(at("F1"), at("F2")) / 2;
            expect((c as unknown as Circle).R ** 2).toBeCloseTo(
                2 * a * a - focal * focal,
            );
        },
    ],
    ConjugateDiameters: [
        ELLIPSE,
        ["co"],
        ([M, d1, d2]) => {
            const K = equation(M.C.getObj("co")!);
            const m = (M as point_object).coords;
            expect(offConic(K, m)).toBeCloseTo(0);
            expect((M as point_object).moveable).toBe(true);
            const u = sub(m, [0.5, 0]);
            const v = (d2 as unknown as Line).VEC;
            const [a, b, c] = K;
            expect(
                a * u[0] * v[0] +
                    (b / 2) * (u[0] * v[1] + u[1] * v[0]) +
                    c * u[1] * v[1],
            ).toBeCloseTo(0);
            expect(toLine([0.5, 0], d1 as unknown as Line)).toBeCloseTo(0);
        },
    ],
    Polar: [
        [...ELLIPSE, "P = (5, 3)"],
        ["co", "P"],
        ([p], at) => {
            const K = equation(p.C.getObj("co")!);
            const { P1, VEC } = p as unknown as Line;
            for (const t of [0, 1])
                expect(
                    bilinear(K, at("P"), [
                        P1.coords[0] + t * VEC[0],
                        P1.coords[1] + t * VEC[1],
                    ]),
                ).toBeCloseTo(0);
        },
    ],
    Pole: [
        [...ELLIPSE, "U = (-5, 4)", "V = (5, 3)", "l = Line(U, V)"],
        ["co", "l"],
        ([P], at) => {
            const K = equation(P.C.getObj("co")!);
            for (const X of ["U", "V"])
                expect(
                    bilinear(K, (P as point_object).coords, at(X)),
                ).toBeCloseTo(0);
        },
    ],
    QuadraticForm: [
        [...ELLIPSE, "X = Point(co, 0.3, 0.9)"],
        ["co", "X"],
        ([v]) => {
            expect((v as unknown as { value: number }).value).toBeCloseTo(1);
        },
    ],
    PolarForm: [
        [
            ...ELLIPSE,
            "X = Point(co, 0.3, 0.9)",
            "Y = Point(2 * co.center() - X)",
        ],
        ["co", "X", "Y"],
        ([v]) => {
            expect((v as unknown as { value: number }).value).toBeCloseTo(-1);
        },
    ],
    LevelConic: [
        [...ELLIPSE, "X = (2, 3)"],
        ["co", "X"],
        ([c], at) => {
            const K = equation(c);
            expect(offConic(K, at("X"))).toBeCloseTo(0);
            expect(offConic(K, [1 - at("X")[0], -at("X")[1]])).toBeCloseTo(0);
            const original = equation(c.C.getObj("co")!);
            const ratio = K[0] / original[0];
            expect(K[1] / original[1]).toBeCloseTo(ratio);
            expect(K[2] / original[2]).toBeCloseTo(ratio);
        },
    ],
    PascalLine: [
        ELLIPSE,
        ["co"],
        (finals) => {
            const K = equation(finals[0].C.getObj("co")!);
            for (const P of finals.slice(0, 6))
                expect(offConic(K, (P as point_object).coords)).toBeCloseTo(0);
            expect(
                toLine(
                    (finals[8] as point_object).coords,
                    finals[9] as unknown as Line,
                ),
            ).toBeCloseTo(0);
        },
    ],
    BrianchonPoint: [
        ELLIPSE,
        ["co"],
        (finals) => {
            const tangents = finals.slice(6, 12) as unknown as Line[];
            const corner = (k: number) =>
                intersect(tangents[k % 6], tangents[(k + 1) % 6]);
            const k = (finals[12] as point_object).coords;
            expect(toLine(k, throughLine(corner(2), corner(5)))).toBeCloseTo(0);
        },
    ],
    DesarguesPerspective: [
        [
            "A = (-4, 1)",
            "B = (-1, 3)",
            "C = (-2, -1)",
            "U = (-9, 2)",
            "V = (-5, 9)",
            "W = (-3.5, -1.5)",
        ],
        ["A", "B", "C", "U", "V", "W"],
        ([O, , , Z, s], at) => {
            // In perspective from O = (1, 0): AU, BV, CW meet there.
            expectClose((O as point_object).coords.slice(0, 2), [1, 0]);
            expect(
                toLine((Z as point_object).coords, s as unknown as Line),
            ).toBeCloseTo(0);
            expect(
                cross(sub(at("C"), [1, 0]), sub(at("W"), [1, 0])),
            ).toBeCloseTo(0);
        },
    ],
    DivideSegment: [
        ["A = (-4, -1)", "B = (4, 3)", "n = 4"],
        ["A", "B", "n"],
        ([L]) => {
            expect((L as unknown as { items: unknown[] }).items.length).toBe(3);
        },
    ],
    GeometricMean: [
        ["A = (-5, 1)", "B = (-1, 1)", "C = (4, 1)"],
        ["A", "B", "C"],
        ([, D, s], at) => {
            const d = (D as point_object).coords;
            expect(dist(at("B"), d) ** 2).toBeCloseTo(
                dist(at("A"), at("B")) * dist(at("B"), at("C")),
            );
            expect(s.name).toBe("s");
        },
    ],
    LineH: [
        [...DISK, "A = (0, 1)", "B = (3, -2)"],
        ["Hz", "A", "B"],
        ([l], at) => {
            geodesic(l, at("A"), at("B"));
        },
    ],
    SegmentH: [
        [...DISK, "A = (0, 1)", "B = (3, -2)"],
        ["Hz", "A", "B"],
        ([s], at) => {
            geodesic(s, at("A"), at("B"));
        },
    ],
    RayH: [
        [...DISK, "A = (0, 1)", "B = (3, -2)"],
        ["Hz", "A", "B"],
        ([r], at) => {
            geodesic(r, at("A"), at("B"));
        },
    ],
    MidpointH: [
        [...DISK, "A = (0, 1)", "B = (3, -2)"],
        ["Hz", "A", "B"],
        ([M], at) => {
            const m = (M as point_object).coords;
            expect(hDist(at("A"), m)).toBeCloseTo(hDist(at("A"), at("B")) / 2);
            expect(hDist(at("B"), m)).toBeCloseTo(hDist(at("A"), at("B")) / 2);
        },
    ],
    PerpendicularBisectorH: [
        [...DISK, "A = (0, 1)", "B = (3, -2)"],
        ["Hz", "A", "B"],
        ([m], at) => {
            const k = m as unknown as Circle;
            orthogonal(k, HZ);
            expectClose(invert(k, at("A")), at("B").slice(0, 2));
        },
    ],
    PerpendicularH: [
        [...DISK, ...G, "A = (2, -2)"],
        ["Hz", "A", "g"],
        ([l, H], at) => {
            const k = l as unknown as Circle;
            geodesic(l, at("A"));
            orthogonal(k, G_CIRCLE);
            on(k, (H as point_object).coords);
            on(G_CIRCLE, (H as point_object).coords);
        },
    ],
    AngleBisectorH: [
        [...DISK, "A = (-2, 1)", "V = (1, -2)", "B = (3, 2)"],
        ["Hz", "A", "V", "B"],
        ([b], at) => {
            const k = b as unknown as Circle;
            geodesic(b, at("V"));
            // Its reflection takes the line VA to VB.
            const B = at("B");
            const VB = circumcenter(at("V"), B, invert(HZ, B));
            on({ CENTER: VB, R: dist(VB, B) }, invert(k, at("A")));
        },
    ],
    ReflectH: [
        [...DISK, ...G, "M = (2, -2)"],
        ["Hz", "M", "g"],
        ([M1], at) => {
            expectClose(
                (M1 as point_object).coords.slice(0, 2),
                invert(G_CIRCLE, at("M")),
            );
        },
    ],
    CircleH: [
        [...DISK, "C = (2, 1)", "A = (-1, -2)"],
        ["Hz", "C", "A"],
        ([k], at) => {
            const { CENTER, R } = k as unknown as Circle;
            for (const [x, y] of [
                [R, 0],
                [0, R],
                [-R, 0],
                [0, -R],
            ])
                expect(
                    hDist(at("C"), [CENTER[0] + x, CENTER[1] + y]),
                ).toBeCloseTo(hDist(at("C"), at("A")));
        },
    ],
    CircumcircleH: [
        [...DISK, "A = (-2, -1)", "B = (3, -2)", "C = (1, 2)"],
        ["Hz", "A", "B", "C"],
        ([Ω, c], at) => {
            const o = (Ω as point_object).coords;
            for (const P of ["A", "B", "C"]) {
                expect(hDist(o, at(P))).toBeCloseTo(hDist(o, at("A")));
                on(c as unknown as Circle, at(P));
            }
        },
    ],
    DistanceH: [
        [...DISK, "A = (0, 1)", "B = (3, -2)"],
        ["Hz", "A", "B"],
        ([d], at) => {
            expect((d as unknown as { value: number }).value).toBeCloseTo(
                hDist(at("A"), at("B")),
            );
        },
    ],
    AngleH: [
        [...DISK, "A = (-2, 1)", "V = (1, -2)", "B = (3, 2)"],
        ["Hz", "A", "V", "B"],
        ([α], at) => {
            const V = at("V");
            // The tangent at V to the line VP, toward P.
            const tangent = (P: XY) => {
                const center = circumcenter(V, P, invert(HZ, P));
                const t = [center[1] - V[1], V[0] - center[0]];
                return dot(t, sub(P, V)) > 0 ? t : [-t[0], -t[1]];
            };
            const [u, v] = [tangent(at("A")), tangent(at("B"))];
            expect((α as unknown as { value: number }).value).toBeCloseTo(
                Math.acos(dot(u, v) / Math.hypot(...u) / Math.hypot(...v)),
            );
        },
    ],
    Horocycle: [
        [...DISK, "P = (4, 3.5)", "A = (-1, -2)"],
        ["Hz", "P", "A"],
        ([h], at) => {
            const k = h as unknown as Circle;
            on(k, at("A"));
            on(k, at("P"));
            expect(dist(k.CENTER, HZ.CENTER) + k.R).toBeCloseTo(HZ.R);
        },
    ],
    Hypercycle: [
        [...DISK, ...G, "A = (2, -2)"],
        ["Hz", "g", "A"],
        ([e], at) => {
            for (const P of ["A", "G1", "G2"])
                on(e as unknown as Circle, at(P));
        },
    ],
    LimitingParallels: [
        [...DISK, ...G, "A = (2, -2)"],
        ["Hz", "A", "g"],
        ([r1, r2], at) => {
            geodesic(r1, at("A"), at("G1"));
            geodesic(r2, at("A"), at("G2"));
        },
    ],
    CommonPerpendicular: [
        [...DISK, ...G, ...H],
        ["Hz", "g", "h"],
        ([c]) => {
            const k = c as unknown as Circle;
            orthogonal(k, HZ);
            orthogonal(k, G_CIRCLE);
            orthogonal(k, H_CIRCLE);
        },
    ],
};

describe("The library shipped with DocGeo", () => {
    it("has the same macros in every language", async () => {
        const english = await supplied("en");
        for (const lang of LANGS) {
            const library = await supplied(lang);
            expect(library.macros.length).toBe(english.macros.length);
            library.macros.forEach((macro, index) => {
                expect(macro.methods.map(({ body }) => body)).toEqual(
                    english.macros[index].methods.map(({ body }) => body),
                );
                expect(library.folders[index].length).toBe(
                    english.folders[index].length,
                );
            });
        }
        expect(english.macros.map(({ name }) => name).sort()).toEqual(
            Object.keys(USES).sort(),
        );
    });

    it("builds what its macros say", async () => {
        const library = await supplied("en");
        const failed: string[] = [];
        for (const [name, [lines, initials, check]] of Object.entries(USES)) {
            const c = figure(...lines);
            c.macros = merge(
                asLibrary(c),
                library,
                [name],
                false,
            ).library.macros;
            const finals = applyMacro(
                c,
                macroIndex(c, name),
                0,
                all(c, ...initials),
            );
            c.flush();
            // Each macro's failure told, rather than the first's only.
            try {
                expect(finals.every(({ defined }) => defined)).toBe(true);
                check(finals, (point) => get(c, point).coords);
            } catch (error) {
                failed.push(`${name}: ${(error as Error).message}`);
            }
        }
        expect(failed).toEqual([]);
    });

    it("draws a hyperbolic line through the disk's center as a diameter", async () => {
        const library = await supplied("en");
        for (const [name, lines, through] of [
            ["LineH", ["A = (1, -0.5)", "B = (3, 1)"], ["A", "B"]],
            ["SegmentH", ["A = (-1, -2)", "B = (3, 1)"], ["A", "B"]],
            ["RayH", ["A = (1, -0.5)", "B = (3, -0.5)"], ["A", "B"]],
            [
                "PerpendicularBisectorH",
                ["A = (-1, -0.5)", "B = (3, -0.5)", "C = (1, 3)"],
                ["O", "C"],
            ],
        ] as const) {
            const c = figure(...DISK, ...lines);
            c.macros = merge(
                asLibrary(c),
                library,
                [name],
                false,
            ).library.macros;
            const [arc] = applyMacro(
                c,
                macroIndex(c, name),
                0,
                all(c, "Hz", "A", "B"),
            );
            c.flush();
            expect(arc.defined).toBe(true);
            // A ten-thousandth of its chord off it, at most.
            const { CENTER, R } = arc as unknown as Circle;
            expect(R).toBeGreaterThan(1000);
            for (const P of through)
                expect(
                    Math.abs(dist(CENTER, get(c, P).coords) - R),
                ).toBeLessThan(2e-3);
        }
    });

    it("find the common perpendicular of the lines they draw, a diameter", async () => {
        const c = figure(
            ...DISK,
            "A1 = (-1, 1.5)",
            "B1 = (3, 1.5)",
            "A2 = (-1, -2.5)",
            "B2 = (3, -2.5)",
            "C = (1, 3)",
        );
        c.macros = merge(
            asLibrary(c),
            await supplied("en"),
            ["LineH", "CommonPerpendicular"],
            false,
        ).library.macros;
        const line = macroIndex(c, "LineH");
        const [g] = applyMacro(c, line, 0, all(c, "Hz", "A1", "B1"));
        const [h] = applyMacro(c, line, 0, all(c, "Hz", "A2", "B2"));
        const [p] = applyMacro(c, macroIndex(c, "CommonPerpendicular"), 0, [
            get(c, "Hz"),
            g,
            h,
        ]);
        c.flush();
        const { CENTER, R } = p as unknown as Circle;
        for (const P of ["O", "C"])
            expect(Math.abs(dist(CENTER, get(c, P).coords) - R)).toBeLessThan(
                2e-3,
            );
    });

    it("open the box of a macro applied to the line another draws", async () => {
        const c = figure(...DISK, "A = (0, 1)", "B = (3, -2)", "D = (2, 2)");
        c.macros = merge(
            asLibrary(c),
            await supplied("en"),
            ["LineH", "PerpendicularH"],
            false,
        ).library.macros;
        const [l] = applyMacro(
            c,
            macroIndex(c, "LineH"),
            0,
            all(c, "Hz", "A", "B"),
        );
        const [, H] = applyMacro(c, macroIndex(c, "PerpendicularH"), 0, [
            get(c, "Hz"),
            get(c, "D"),
            l,
        ]);
        c.flush();
        const before = (H as point_object).coords;
        const result = await openBox(c, H.parents[0] as macro_object);
        const copy = figure();
        readDgo(copy, result!.figure);
        copy.flush();
        expectClose(get(copy, H.name).coords, before);
    });

    it("draw a hyperbolic circle of a given radius", async () => {
        const c = figure(...DISK, "C = (2, 1)");
        c.macros = merge(
            asLibrary(c),
            await supplied("en"),
            ["CircleH"],
            false,
        ).library.macros;
        const [k] = applyMacro(c, macroIndex(c, "CircleH"), 1, [
            get(c, "Hz"),
            get(c, "C"),
            "1.5",
        ]);
        c.flush();
        const { CENTER, R } = k as unknown as Circle;
        for (const [x, y] of [
            [R, 0],
            [0, R],
            [-R, 0],
        ])
            expect(
                hDist(get(c, "C").coords, [CENTER[0] + x, CENTER[1] + y]),
            ).toBeCloseTo(1.5);
    });
});
