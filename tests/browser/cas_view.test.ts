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
import { importGgb } from "../../src/ggb_importer";

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
            "-1 + \\frac{1}{x}",
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
        expect(
            Object.entries(saved.cas!).find(([request]) =>
                request.endsWith("regroup(3^2))"),
            )?.[1],
        ).toBe("9");
        c.dispose();
        await vi.waitFor(() =>
            expect(document.querySelector(".docgeo-cas")).toBeNull(),
        );
    });

    it("import GeoGebra's CAS cells, and the Suite's rows that read free variables", async () => {
        const c = createConstruction([800, 600]);
        readDgo(c, { dgo: 1, v: VIEW, o: [] });
        const cell = (typed: string, evaluated: string, command = "") =>
            `<cascell><cellPair><inputCell><expression value="${typed}" eval="${evaluated}" evalCmd="${command}"/></inputCell></cellPair></cascell>`;
        expect(
            importGgb(
                c,
                `<geogebra><gui><perspectives><perspective id="tmp"><views>
<view id="1" visible="true" location="1" size="500"/>
<view id="8" visible="true" location="3" size="300"/>
</views></perspective></perspectives></gui><construction>
<element type="numeric" label="a"><value val="2"/></element>
<element type="boolean" label="c"><value val="true"/></element>
<element type="point" label="A"><coords x="1" y="1" z="1"/><condition showObject="c ≠ 0"/></element>
<cascell><cellPair><useAsText/><inputCell><expression value="Calcul &quot;exact&quot;"/></inputCell></cellPair></cascell>
${cell("Factor(x² - a²)", "Factor(x^(2) - a^(2))")}
${cell("f(x):= x² + a", "Evaluate(Evaluate(x^(2) + a))", "KeepInput")}
${cell("Product(k, k, 1, n)", "Product(k, k, 1, n)")}
${cell("Solve(f(x) = 6)", "Solve(f(x) = 6)")}
${cell("v:=sqrt(2) a", "Numeric(sqrt(2) * a)", "Numeric")}
${cell("$2 + 1", "$2 + 1")}
${cell("$4", "$4")}
${cell("IFactor(b² - 5)", "IFactor(b^(2) - 5)")}
${cell("Sum[f(k/n)/n,k,1,n]", "Sum(f(k / n) / n,k,1,n)")}
${cell("Limit[$10,n,∞]", "Limit($10,n,Infinity)")}
${cell("Integral[f(z)²,z,0,a]", "Integral(f(z)^(2),z,0,a)")}
${cell("TaylorPolynomial[sin(x),x,0,5]", "TaylorPolynomial(sin(x),x,0,5)")}
</construction></geogebra>`,
            ),
        ).toEqual(["cascell Product(k, k, 1, n)", "cascell $4"]);
        // The condition of A, an auxiliary object, not named after a free
        // variable of the cells.
        expect(c.getObj("b")).toBeUndefined();
        // On the left of the graphics, as in GeoGebra.
        expect(c.views.map((view) => !!view.cas)).toEqual([true, false]);
        expect(c.views[0].cas!.lines).toEqual([
            `"Calcul 'exact'"`,
            "Factor(x^(2) - a^(2))",
            "f(x) := KeepInput(x^(2) + a)",
            "Solve(f(x) = 6)",
            "v := Numeric(sqrt(2) * a)",
            "$2 + 1",
            "IFactor(b^(2) - 5)",
            "Sum(f(k / n) / n,k,1,n)",
            "Limit($8,n,Infinity)",
            "Integral(f(z)^(2),z,0,a)",
            "TaylorPolynomial(sin(x),x,0,5)",
        ]);
        c.reveal();
        c.flush();
        await vi.waitFor(
            () =>
                expect(shown()).toEqual([
                    "",
                    "\\left(x - 2\\right) \\left(x + 2\\right)",
                    "f(x) := x^{2} + a",
                    "\\left\\{x = -2, x = 2\\right\\}",
                    "v := 2.82842712475",
                    "x^{2} - 3",
                    "\\left(b - \\sqrt{5}\\right) \\left(b + \\sqrt{5}\\right)",
                    "\\frac{1}{2 n} + \\frac{1}{6 n^{2}} + \\frac{7}{3}",
                    "\\frac{7}{3}",
                    "\\frac{376}{15}",
                    "x - \\frac{1}{6} x^{3} + \\frac{1}{120} x^{5}",
                ]),
            { timeout: 20000, interval: 50 },
        );
        expect(document.querySelector(".docgeo-cas .t")?.textContent).toBe(
            "1Calcul 'exact'",
        );
        c.dispose();

        // A row of the Suite's symbolic mode that reads a free variable: a
        // line of a CAS view, on the right without the algebra view.
        const symbolic = (label: string, exp: string) =>
            `<expression label="${label}" exp="${exp}"/><element type="symbolic" label="${label}"/>`;
        const suite = createConstruction([800, 600]);
        readDgo(suite, { dgo: 1, v: VIEW, o: [] });
        expect(
            importGgb(
                suite,
                `<geogebra><construction>
${symbolic("r", "IFactor(a^(2) - 5)")}
${symbolic("k", "Factor(x^(2) - 5)")}
</construction></geogebra>`,
            ),
        ).toEqual([]);
        expect(suite.views.map((view) => view.cas?.lines)).toEqual([
            undefined,
            ["r := IFactor(a^(2) - 5)"],
        ]);
        expect(suite.getObj("k")).toBeTruthy();
        suite.dispose();

        // All of them where the algebra view shows them, in its place, the
        // named ones still objects of the figure.
        const algebra = createConstruction([800, 600]);
        readDgo(algebra, { dgo: 1, v: VIEW, o: [] });
        expect(
            importGgb(
                algebra,
                `<geogebra><gui><perspectives><perspective id="tmp"><views>
<view id="1" visible="true" location="1" size="159"/>
<view id="2" visible="true" location="3" size="541"/>
</views></perspective></perspectives></gui><construction>
${symbolic("¥¦§¨©ª", "sqrt(12) - sqrt(3)")}
${symbolic("¥¦§¨©ª_{1}", "IFactor(a^(2) - 5)")}
${symbolic("k", "Factor(x^(2) - 5)")}
${symbolic("¥¦§¨©ª_{2}", "Sum(j^(2), j, 1, 10)")}
</construction></geogebra>`,
            ),
        ).toEqual([]);
        expect(algebra.views.map((view) => view.cas?.lines)).toEqual([
            [
                "sqrt(12) - sqrt(3)",
                "IFactor(a^(2) - 5)",
                "k := Factor(x^(2) - 5)",
                "Sum(j^(2),j,1,10)",
            ],
            undefined,
        ]);
        expect(
            algebra.OBJS.V.filter(({ name }) => name.startsWith("k")).length,
        ).toBe(1);
        expect(algebra.OBJS.V.some(({ name }) => /¥|sqrt/.test(name))).toBe(
            false,
        );
        algebra.reveal();
        algebra.flush();
        await vi.waitFor(
            () =>
                expect(shown()).toEqual([
                    "\\sqrt{3}",
                    "\\left(a - \\sqrt{5}\\right) \\left(a + \\sqrt{5}\\right)",
                    "k := x^{2} - 5",
                    "385",
                ]),
            { timeout: 20000, interval: 50 },
        );
        algebra.dispose();
    }, 30000);
});
