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
    valueText,
} from "../../src/editor/figure";
import { isCommand } from "../../src/editor/catalog";
import { parseLine } from "../../src/editor/text";
import { add } from "../../src/editor/figure";
import type { curve_object } from "../../src/objects/curve_object";
import type { expression_object } from "../../src/objects/expression_object";
import { evaluateFunction } from "../../src/objects/expression_object";

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

const at = (c: construction, name: string, x: number) =>
    evaluateFunction((c.getObj(name) as curve_object).formula, [x], () =>
        c.formulaView(),
    );

// The text the figure shows.
const drawn = (c: construction, name: string) =>
    (
        c.getObj(name) as unknown as { valueText: { text(): string } }
    ).valueText.text();

describe("Computer algebra commands", () => {
    it("are computed by Giac, its answers read with the objects' values, kept in the file", async () => {
        const c = figure();
        const text = [
            "a = Slider(-5, 5, 2)",
            "f(x) = a x^3",
            "g(x) = Derivative(f)",
            "h = Factor(x^2 - a^2)",
            "s = Solve(x^2 = 2)",
            "F(x) = Integral(x^2, x)",
            "k = Expand((x + 1)^2)",
            "I = Integral(f, 0, 1)",
        ];
        text.forEach((line) => type(c, line));
        c.flush();
        expect(lines(c)).toEqual(text);
        await vi.waitFor(
            () => {
                c.flush();
                expect(at(c, "g", 2)).toBe(24);
            },
            { timeout: 20000, interval: 50 },
        );
        await vi.waitFor(
            () => {
                c.flush();
                expect(c.getObj("s")!.scriptValue(false)).toEqual([
                    -Math.SQRT2,
                    Math.SQRT2,
                ]);
                expect(at(c, "F", 3)).toBeCloseTo(9, 12);
            },
            { timeout: 20000, interval: 50 },
        );
        const index = figureIndex(c);
        const objects = figureObjects(c);
        const shown = (name: string) => {
            const object = c.getObj(name)!;
            return valueText(object, lineOf(object, index, objects), false);
        };
        expect(shown("h")).toBe("= (x-a)*(x+a)");
        expect(shown("k")).toBe("= x^2+2*x+1");
        expect(shown("g")).toBe("= 3*a*x^2");
        expect(drawn(c, "h")).toBe("h = (x-a)*(x+a)");
        expect(c.getObj("I")!.scriptValue(false)).toBeCloseTo(0.5, 9);
        // A slider dragged: computed at once, with no new request.
        const a = c.getObj("a") as expression_object;
        a.value = 1;
        c.invalidateGeometry(a);
        c.flush();
        expect(at(c, "g", 2)).toBe(12);
        const saved = await describeDgo(c);
        expect(Object.values(saved.cas!).sort()).toEqual(
            [
                "3*dg0*x^2",
                "(x-dg0)*(x+dg0)",
                "list[-√2,√2]",
                "1/3*x^3",
                "x^2+2*x+1",
            ].sort(),
        );
        const other = figure();
        readDgo(other, saved);
        other.flush();
        expect(lines(other)).toEqual(lines(c));
        expect(at(other, "g", 2)).toBe(12);
    });

    it("are undefined when Giac has no answer the formulas read", async () => {
        const c = figure();
        type(c, "e = Integral(exp(-x^2))");
        type(c, "u = Factor(floor(x))");
        c.flush();
        await vi.waitFor(
            () => {
                c.flush();
                expect(drawn(c, "e")).toBe("e = 1/2*√π*erf(x)");
            },
            { timeout: 20000, interval: 50 },
        );
        expect(
            evaluateFunction(
                (c.getObj("u") as expression_object).formula!,
                [1],
                () => c.formulaView(),
            ),
        ).toBeNull();
    });
});
