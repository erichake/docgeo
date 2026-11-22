import { afterEach, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";
import { renameFormula } from "../../src/editor/text";

const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach((dispose) => dispose()));

const until = async <T>(
    read: () => T | Promise<T>,
): Promise<NonNullable<T>> => {
    for (let wait = 0; wait < 300; wait++) {
        const value = await read();
        if (value) return value;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Timed out");
};

// The editor in French, of the figure with a computer algebra view and a
// computer algebra tab (see CAS.md, step 6), Giac served under /giac/.
async function editor(): Promise<Document> {
    const popup = window.open(
        `/editor.html?lang=fr&url=${location.origin}/tests/dgo/calcul_formel.dgo`,
        "_blank",
        "width=1200,height=700",
    ) as typeof window;
    cleanup.push(() => popup.close());
    const page = await until(() =>
        popup.document?.querySelectorAll(".dge-cas-line").length === 12
            ? popup.document
            : null,
    );
    const palette = page.querySelector("#dge-palette")!;
    if (palette.getClientRects().length)
        page.querySelector<HTMLElement>(
            ".dge-bar .dge-palette-button",
        )!.click();
    return page;
}

const fields = (page: Document) => [
    ...page.querySelectorAll<HTMLInputElement>(".dge-cas-line"),
];
const values = (page: Document) => fields(page).map(({ value }) => value);
// The TeX each line shows.
const answers = (page: Document) =>
    [...page.querySelectorAll(".docgeo-cas > div > div:last-child")].map(
        (output) =>
            output
                .querySelector("annotation")
                ?.textContent?.replace("\\displaystyle ", "") ??
            output.textContent,
    );
const rows = (page: Document) =>
    [...page.querySelectorAll<HTMLInputElement>(".dge-row")].map(
        ({ value }) => value,
    );

const click = async (x: number, y: number) => {
    await commands.mouse("move", x, y);
    await commands.mouse("down");
    await commands.mouse("up");
};
const center = (element: Element) => {
    const { left, top, width, height } = element.getBoundingClientRect();
    return [left + width / 2, top + height / 2] as const;
};

// A menu's item, in a submenu if several labels.
function choose(page: Document, ...labels: string[]): void {
    const roots = [
        ...page.querySelectorAll<HTMLElement>(".dge-menubar > div > button"),
    ];
    roots.find(({ textContent }) => textContent === "Fichier")!.click();
    labels.forEach((label) =>
        [...page.querySelectorAll<HTMLElement>(".dge-menu-popup > button")]
            .find(({ firstChild }) => firstChild?.textContent === label)!
            .click(),
    );
}

describe("Computer algebra view in the editor", () => {
    it("types, deletes and defines lines, objects and lines picked", async () => {
        const page = await editor();
        expect(values(page).slice(0, 2)).toEqual([
            "Factoriser(x^2 - a^2)",
            "Dérivée(f)",
        ]);
        expect(values(page)[11]).toBe("");

        // A line added, in French, computed; the field after it focused.
        fields(page)[11].focus();
        await commands.keyboard("type", "Développer((x + 1)^2)");
        await commands.keyboard("press", "Enter");
        await until(() => fields(page).length === 13);
        expect(values(page)[11]).toBe("Développer((x + 1)^2)");
        expect(page.activeElement).toBe(fields(page)[12]);
        await until(() => answers(page)[11] === "x^{2} + 2 x + 1");

        // While a line is typed, an object pressed gives its name, another
        // line's answer `$n`; nothing selected, the focus kept.
        const objects = rows(page).length;
        await commands.keyboard("type", "2*");
        const svg = page
            .querySelector("body > svg:has([data-layer])")!
            .getBoundingClientRect();
        await click(svg.left + 300 + 50, svg.top + 400 - 100);
        await until(() => values(page)[12] === "2*A");
        await commands.keyboard("type", " + ");
        const outputs = page.querySelectorAll(
            ".docgeo-cas > div > div:last-child",
        );
        await click(...center(outputs[11]));
        await until(() => values(page)[12] === "2*A + $12");
        expect(page.activeElement).toBe(fields(page)[12]);
        expect(page.querySelector(".dge-picked")).toBe(null);
        expect(rows(page).length).toBe(objects);
        await commands.keyboard("press", "Escape");
        expect(values(page)[12]).toBe("");

        // Unreadable, refused.
        fields(page)[12].focus();
        await commands.keyboard("type", "2*(");
        await commands.keyboard("press", "Enter");
        await until(() => fields(page)[12].classList.contains("dge-error"));
        expect(fields(page).length).toBe(13);
        await commands.keyboard("press", "Escape");

        // A definition of objects of the figure defines its object.
        fields(page)[12].focus();
        await commands.keyboard("type", "m(x) := x^2 + a");
        await commands.keyboard("press", "Enter");
        await until(() => rows(page).includes("m(x) = x^2 + a"));
        await until(() => fields(page).length === 14);
        // Of a free variable, the view's only.
        fields(page)[13].focus();
        await commands.keyboard("type", "n := b^2");
        await commands.keyboard("press", "Enter");
        await until(() => fields(page).length === 15);
        expect(rows(page).some((row) => row.startsWith("n ="))).toBe(false);
        expect(rows(page).some((row) => row.startsWith("b ="))).toBe(false);

        // The first line emptied, deleted: `$1` reads its formula.
        fields(page)[0].focus();
        fields(page)[0].select();
        await commands.keyboard("press", "Backspace");
        await commands.keyboard("press", "Enter");
        await until(() => fields(page).length === 14);
        expect(values(page)[0]).toBe("Dérivée(f)");
        expect(values(page)[9]).toBe(
            "Simplifier((Factoriser(x^2 - a^2)) / (x - a))",
        );
        await until(() => answers(page)[9] === "x + 1");

        // Undone, the line is back.
        (page.activeElement as HTMLElement).blur();
        page.body.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "z",
                metaKey: true,
                bubbles: true,
            }),
        );
        await until(() => fields(page).length === 15);
        expect(values(page)[0]).toBe("Factoriser(x^2 - a^2)");
    }, 40000);

    it("renames an object in the lines that read it", () => {
        const renamed = (line: string) =>
            renameFormula(line, (name) => (name === "A" ? "P" : undefined));
        expect(renamed("x(A) + y(A)/3")).toBe("x(P) + y(P)/3");
        expect(renamed("u(x) := A + $1 * x")).toBe("u(x) := P + $1 * x");
    });

    it("adds and deletes the view, and adds a tab", async () => {
        const page = await editor();
        choose(page, "Vue", "Supprimer la vue calcul formel");
        await until(() => !page.querySelector(".docgeo-cas"));
        choose(page, "Vue", "Nouvelle vue calcul formel");
        await until(() => fields(page).length === 1);
        fields(page)[0].focus();
        await commands.keyboard("type", "Factoriser(x^2 - 4)");
        await commands.keyboard("press", "Enter");
        await until(
            () =>
                answers(page)[0] ===
                "\\left(x - 2\\right) \\left(x + 2\\right)",
        );
        // Kept as typed, numerically: its object defined by its formula.
        fields(page)[1].focus();
        await commands.keyboard("type", "w(x) := ConserverSaisie(x^2 + a)");
        await commands.keyboard("press", "Enter");
        await until(() => rows(page).includes("w(x) = x^2 + a"));
        await until(() => answers(page)[1] === "w(x) := x^{2} + a");
        fields(page)[2].focus();
        await commands.keyboard("type", "Numérique(sqrt(2))");
        await commands.keyboard("press", "Enter");
        await until(() => answers(page)[2] === "1.41421356237");
        expect(values(page).slice(1, 3)).toEqual([
            "w(x) := ConserverSaisie(x^2 + a)",
            "Numérique(sqrt(2))",
        ]);
        choose(page, "Nouvel onglet calcul formel");
        await until(
            () =>
                [...page.querySelectorAll(".docgeo-tabs > button")].some(
                    ({ textContent }) => textContent?.includes("CAS1"),
                ) && fields(page).length === 1,
        );
    });
});
