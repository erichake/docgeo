import { describe, expect, it } from "vitest";
// First, as in main.ts: the object classes import each other.
import "../../src/construction";
import type { construction } from "../../src/construction";
import { importDgpFromUrl } from "../../src/dgp_importer";
import { importGgbFromUrl } from "../../src/ggb_importer";
import { translateAfter } from "../../src/import/dgp_formula";
import {
    expression_object,
    loadKaTeX,
} from "../../src/objects/expression_object";
import { point_object } from "../../src/objects/point_object";
import {
    createConstruction,
    DGP,
    disposeFigures,
    drawing,
    drawingDifference,
    figure,
    frame,
    GGB,
    seedRandom,
} from "./figures";

disposeFigures();

// Its values, NaN and infinities included, and its drawing.
function state(c: construction): [string, string] {
    const values = c.OBJS.V.map((object) => [
        object.name,
        object.defined,
        object instanceof expression_object ? object.value : null,
        object instanceof point_object ? object.coords : null,
    ]);
    return [
        JSON.stringify(values, (_, value) =>
            typeof value === "number" && !Number.isFinite(value)
                ? String(value)
                : value,
        ),
        drawing(c.svg.dom()),
    ];
}

// Opened, then with the free point most objects depend on moved.
async function states(
    open: (c: construction) => Promise<unknown>,
    work: number,
): Promise<[string, string][]> {
    translateAfter(work);
    // The same random numbers either way.
    seedRandom();
    // So that the TeX it shows is drawn in time, either way.
    await loadKaTeX();
    const c = createConstruction();
    await open(c);
    await frame();
    // Its images drawn at their size, which the second run knows at once.
    await Promise.all(
        [...c.svg.dom().querySelectorAll("image")].map((image) => {
            const loaded = new Image();
            loaded.src = image.getAttribute("href")!;
            return loaded.decode();
        }),
    );
    await frame();
    await frame();
    const opened = state(c);
    const dependents = (object: point_object) => {
        const seen = new Set();
        const stack = [object];
        while (stack.length) {
            const next = stack.pop()!;
            if (seen.has(next)) continue;
            seen.add(next);
            stack.push(...(next.children as point_object[]));
        }
        return seen.size;
    };
    const [point] = c.OBJS.V.filter(
        (object): object is point_object => object.constructor === point_object,
    ).sort((a, b) => dependents(b) - dependents(a));
    if (!point) return [opened];
    point.coords = [point.x + 0.1, point.y - 0.05, point.z];
    c.invalidateGeometry(point);
    await frame();
    return [opened, state(c)];
}

// Translated into JavaScript, the figures' formulas and programs give the
// closures' results, to the last bit.
async function compare(
    open: (c: construction) => Promise<unknown>,
): Promise<void> {
    const closures = await states(open, Infinity);
    const translated = await states(open, 0);
    expect(translated.length).toBe(closures.length);
    translated.forEach(([values, drawn], i) => {
        expect(values).toBe(closures[i][0]);
        expect(drawingDifference(drawn, closures[i][1])).toBe("");
    });
}

describe("Formulas and programs translated into JavaScript", () => {
    it.each(DGP)("%s", (name) =>
        compare((c) => importDgpFromUrl(c, figure(name))),
    );
    it.each(GGB)("%s", (name) =>
        compare((c) => importGgbFromUrl(c, figure(name))),
    );
});
