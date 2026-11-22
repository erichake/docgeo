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
import { importGgb } from "../../src/ggb_importer";

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
        await vi.waitFor(
            () => {
                c.flush();
                expect(shown("h")).toBe("= (x-a)*(x+a)");
                expect(shown("k")).toBe("= x^2+2*x+1");
                expect(shown("g")).toBe("= 3*a*x^2");
                expect(drawn(c, "h")).toBe("h = (x-a)*(x+a)");
            },
            { timeout: 20000, interval: 50 },
        );
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

    it("sum, take a limit, a definite integral and a Taylor polynomial", async () => {
        const c = figure();
        const text = [
            "n = Slider(1, 10, 3)",
            "a = Slider(0, 5, 2)",
            "s = Sum(k^2, k, 1, n)",
            "l = Limit((1 + 1/m)^m, m, ∞)",
            "q = Limit((x^2 - 1) / (x - 1), 1)",
            "J = Integral(x^2, 0, a)",
            "G(x) = Integral(x z, z, 0, 1)",
            "T(x) = TaylorPolynomial(exp(x), 0, n)",
            "I = Integral(G, 0, 1)",
        ];
        text.forEach((line) => type(c, line));
        c.flush();
        expect(lines(c)).toEqual(text);
        await vi.waitFor(
            () => {
                c.flush();
                expect(c.getObj("s")!.scriptValue(false)).toBe(14);
                expect(c.getObj("l")!.scriptValue(false)).toBeCloseTo(
                    Math.E,
                    12,
                );
                expect(c.getObj("q")!.scriptValue(false)).toBe(2);
                expect(c.getObj("J")!.scriptValue(false)).toBeCloseTo(8 / 3);
                expect(at(c, "G", 4)).toBe(2);
                expect(at(c, "T", 1)).toBeCloseTo(8 / 3, 12);
            },
            { timeout: 20000, interval: 50 },
        );
        const index = figureIndex(c);
        const objects = figureObjects(c);
        const shown = (name: string) => {
            const object = c.getObj(name)!;
            return valueText(object, lineOf(object, index, objects), false);
        };
        expect(shown("s")).toBe("= 1/3*n^3+1/2*n^2+1/6*n");
        expect(shown("T")).toBe("= 1+x+1/2*x^2+1/6*x^3");
        // The sum by its closed form, the Taylor polynomial asked again.
        const n = c.getObj("n") as expression_object;
        n.value = 4;
        c.invalidateGeometry(n);
        c.flush();
        expect(c.getObj("s")!.scriptValue(false)).toBe(30);
        await vi.waitFor(
            () => {
                c.flush();
                expect(at(c, "T", 1)).toBeCloseTo(65 / 24, 12);
            },
            { timeout: 20000, interval: 50 },
        );
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

    it("compute GeoGebra's commands and symbolic rows, a derivative being DocGeo's until Giac answers", async () => {
        const c = figure();
        const command = (name: string, inputs: string[], output: string) =>
            `<command name="${name}"><input ${inputs.map((input, index) => `a${index}="${input}"`).join(" ")}/><output a0="${output}"/></command><element type="function" label="${output}"/>`;
        const symbolic = (label: string, exp: string) =>
            `<expression label="${label}" exp="${exp}"/><element type="symbolic" label="${label}"/>`;
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="numeric" label="a"><value val="2"/></element>
<expression label="f" exp="f(x) = a * x^(3) + abs(x - 2)"/>
<element type="function" label="f"/>
${command("Derivative", ["f", "2"], "g")}
<expression label="h" exp="h(x) = 3x^(2)"/>
<element type="function" label="h"/>
${command("Integral", ["h"], "H")}
<expression label="p" exp="p(x) = Integral[h(x)] + f(0)"/>
<element type="function" label="p"/>
${symbolic("r", "sqrt(12) - sqrt(3)")}
${symbolic("s", "CSolve(x^(2) + 5)")}
${symbolic("q", "IFactor(x^(2) - 5)")}
${symbolic("k", "Factor(x^(2) - 5)")}
</construction></geogebra>`,
            ),
        ).toEqual([]);
        c.flush();
        expect(lines(c)).toEqual([
            "a = 2",
            "f(x) = a * x^(3) + mod(x - 2)",
            "g(x) = Derivative(f, 2)",
            "h(x) = 3x^(2)",
            "H(x) = Integral(h)",
            "p(x) = Integral(h(x)) + f(0)",
            "r = Simplify(sqrt(12) - sqrt(3))",
            "s = CSolve(x^(2) + 5)",
            "q = IFactor(x^(2) - 5)",
            "k = Factor(x^(2) - 5)",
        ]);
        // Before Giac's answer.
        expect(at(c, "g", 1)).toBe(12);
        await vi.waitFor(
            () => {
                c.flush();
                expect(at(c, "H", 2)).toBe(8);
                expect(at(c, "p", 1)).toBe(3);
                expect(c.getObj("r")!.scriptValue(false)).toBeCloseTo(
                    Math.sqrt(3),
                    12,
                );
                expect(c.getObj("s")!.scriptValue(false)).toEqual([
                    [0, Math.sqrt(5)],
                    [0, -Math.sqrt(5)],
                ]);
            },
            { timeout: 20000, interval: 50 },
        );
        expect(at(c, "g", 1)).toBe(12);
        const index = figureIndex(c);
        const objects = figureObjects(c);
        const shown = (name: string) => {
            const object = c.getObj(name)!;
            return valueText(object, lineOf(object, index, objects), false);
        };
        expect(["g", "r", "s", "q", "k"].map((name) => shown(name))).toEqual([
            "= 6*a*x",
            "= √3",
            "= [i*√5,(-i)*√5]",
            "= (x-√5)*(x+√5)",
            "= x^2-5",
        ]);
    });
});
