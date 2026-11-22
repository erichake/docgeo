import { describe, expect, it, vi } from "vitest";
// First, as in main.ts: the object classes import each other.
import "../../src/construction";
import type { construction } from "../../src/construction";
import { createConstruction, disposeFigures } from "./figures";
import { describeDgo, readDgo, type DgoFigure } from "../../src/dgo";
import { resolveWithSliders } from "../../src/editor/figure";
import { isCommand } from "../../src/editor/catalog";
import { parseLine } from "../../src/editor/text";
import { add } from "../../src/editor/figure";
import type { expression_object } from "../../src/objects/expression_object";

disposeFigures();

const VIEW = { o: [400, 300], u: 40, w: 800, h: 600 };

// The figure of these objects, with a computer algebra view of these lines.
async function figure(
    objects: string[],
    lines: string[],
): Promise<construction> {
    const typed = createConstruction([800, 600]);
    readDgo(typed, { dgo: 1, v: VIEW, o: [] });
    objects.forEach((text) =>
        add(
            typed,
            resolveWithSliders(
                typed,
                parseLine(text, isCommand),
                undefined,
                [],
            ),
        ),
    );
    typed.flush();
    const described = await describeDgo(typed);
    typed.dispose();
    const c = createConstruction([800, 600]);
    readDgo(c, { ...described, vs: [{ t: "c", l: lines }] });
    c.reveal();
    c.flush();
    return c;
}

// The TeX each line shows, as KaTeX keeps it.
const shown = () =>
    [...document.querySelectorAll(".docgeo-cas > div > div:last-child")].map(
        (output) =>
            output
                .querySelector("annotation")
                ?.textContent?.replace("\\displaystyle ", "") ??
            output.textContent,
    );

describe("Computer algebra views", () => {
    it("are read and written, refusing an object drawn in one", async () => {
        const figure: DgoFigure = {
            dgo: 1,
            v: { ...VIEW, cw: 0.5 },
            vs: [{ t: "c", l: ["Factor(x^2 - 1)", "Expand($1)"], cw: 0.5 }],
            o: [],
        };
        const c = createConstruction([800, 600]);
        readDgo(c, figure);
        const written = await describeDgo(c);
        expect(written.vs).toEqual(figure.vs);
        const alone: DgoFigure = {
            dgo: 1,
            v: { t: "c", l: ["1 + 1"], w: 800, h: 600 },
            o: [],
        };
        const tab = createConstruction([800, 600]);
        readDgo(tab, alone);
        expect((await describeDgo(tab)).v).toEqual(alone.v);
        expect(() =>
            readDgo(createConstruction([800, 600]), {
                ...figure,
                st: [{ vw: 1 }],
                o: [["Pt", "A", [1, 2], 0]],
            }),
        ).toThrow("Invalid DGO file");
        expect(() =>
            readDgo(createConstruction([800, 600]), {
                ...figure,
                vs: [{ t: "c", l: [1] }],
            }),
        ).toThrow("Invalid DGO file");
    });

    it("show Giac's answers, objects by their values, and follow the figure", async () => {
        const c = await figure(
            [
                "a = Slider(-5, 5, 2)",
                "f(x) = x^2 + a",
                "h(x) = Derivative(f)",
                "A = (1, 3)",
            ],
            [
                "Factor(x^2 - a)",
                "a^2",
                "Solve(x^2 = a)",
                "b^2 + 2b",
                "g(x) := x^3 - x",
                "Derivative(g)",
                "Derivative(f)",
                "k := 5",
                "k + a + x(A)",
                "Expand(($1 + 1)^2)",
                "Solve(u^2 = 9, u)",
                "$20",
                "x^2 = (",
                "Solve(h(x) = 0)",
                "Derivative(ln(x)) + cos(pi)",
            ],
        );
        const answers = [
            "x^{2} - 2",
            "4",
            "\\left\\{x = -\\sqrt{2}, x = \\sqrt{2}\\right\\}",
            "b^{2} + 2 b",
            "g(x) := x^{3} - x",
            "3 x^{2} - 1",
            "2 x",
            "k := 5",
            "8",
            "x^{4} - 2 x^{2} + 1",
            "\\left\\{u = -3, u = 3\\right\\}",
            "?",
            "?",
            "\\left\\{x = 0\\right\\}",
            "\\frac{1}{x} - 1",
        ];
        await vi.waitFor(() => expect(shown()).toEqual(answers), {
            timeout: 20000,
            interval: 50,
        });
        // A slider dragged: the lines that read it computed again.
        const a = c.getObj("a") as expression_object;
        a.value = 3;
        c.invalidateGeometry(a);
        c.flush();
        await vi.waitFor(
            () =>
                expect(shown().slice(0, 3)).toEqual([
                    "x^{2} - 3",
                    "9",
                    "\\left\\{x = -\\sqrt{3}, x = \\sqrt{3}\\right\\}",
                ]),
            { timeout: 20000, interval: 50 },
        );
        // Its answers kept with the figure, which shows them without Giac.
        const saved = await describeDgo(c);
        expect(saved.cas!["3^2"]).toBe("9");
        c.dispose();
        await vi.waitFor(() =>
            expect(document.querySelector(".docgeo-cas")).toBeNull(),
        );
    });
});
