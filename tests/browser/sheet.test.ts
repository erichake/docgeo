import { afterEach, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";
// First, as in main.ts: the object classes import each other.
import "../../src/construction";
import type { construction } from "../../src/construction";
import {
    describeDgo,
    dgoJson,
    gzipped,
    readDgo,
    type DgoFigure,
} from "../../src/dgo";
import { $ } from "../../src/dom";
import { isCommand } from "../../src/editor/catalog";
import { add, resolve } from "../../src/editor/figure";
import { parseLine } from "../../src/editor/text";
import { openFigureFile, writeWorkbook } from "../../src/workbook";
import { createConstruction, disposeFigures } from "./figures";

disposeFigures();

type Message = Record<string, any>;
const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach((dispose) => dispose()));

const workbook = (name: string, celldata: unknown[] = []) => ({
    format: "doccells",
    version: 1,
    sheets: [{ name, celldata }],
});
const number = (r: number, c: number, v: number | string) => ({
    r,
    c,
    v: { v, ct: { fa: "General", t: "n" } },
});
const type = (c: construction, text: string) =>
    add(c, resolve(c, parseLine(text, isCommand)));
const value = (c: construction, name: string) =>
    c.getObj(name)!.scriptValue(false);
const both: DgoFigure = {
    dgo: 1,
    v: { o: [200, 300], u: 40, w: 800, h: 600, cw: 0.5 },
    vs: [{ t: "s", cw: 0.5 }],
    o: [["Pt", "A", [1, 2]]],
    wb: workbook("Feuille1"),
};
const alone: DgoFigure = {
    dgo: 1,
    v: { t: "s", w: 800, h: 600 },
    o: [],
    wb: workbook("Données"),
};

const roundTrip = async (figure: DgoFigure) => {
    const c = createConstruction([800, 600]);
    readDgo(c, figure);
    return describeDgo(c);
};

describe("sheet views", () => {
    it("reads and writes a page with a sheet view, or a sheet only", async () => {
        const read = await roundTrip(both);
        expect(read.vs).toEqual(both.vs);
        expect(read.v.o).toEqual([200, 300]);
        expect(read.wb).toEqual(both.wb);
        expect(read.o).toEqual(both.o);
        expect(await roundTrip(alone)).toEqual(alone);
    });

    it("reads and writes a workbook mixing both", async () => {
        const book = await (await fetch("/tests/dgo/tableur.dgo")).blob();
        const c = createConstruction([800, 600]);
        const opened = (await openFigureFile(c, new File([book], "t.dgo")))
            .book!;
        const written = await dgoJson(await writeWorkbook(opened, c));
        expect(written).toEqual(await dgoJson(book));
    });

    it("refuses an object drawn in a sheet view, or two sheet views", () => {
        const c = createConstruction([800, 600]);
        expect(() =>
            readDgo(c, {
                ...both,
                st: [{ vw: 1 }],
                o: [["Pt", "A", [1, 2], 0]],
            }),
        ).toThrow("Invalid DGO file");
        expect(() =>
            readDgo(createConstruction([800, 600]), {
                ...both,
                v: { t: "s", w: 800, h: 600 },
            }),
        ).toThrow("Invalid DGO file");
        expect(() =>
            readDgo(createConstruction([800, 600]), { ...both, wb: 1 }),
        ).toThrow("Invalid DGO file");
    });
});

describe("cells read by the figure", () => {
    it("reads them in the archive, its page's or another's", async () => {
        const book = {
            dgo: 1,
            pg: [
                {
                    n: "Figure",
                    ...both,
                    wb: workbook("Feuille1", [
                        number(0, 0, 3),
                        number(1, 0, "4"),
                        { r: 2, c: 0, v: { v: "#DIV/0!" } },
                        null,
                        number(0, 1, 5),
                    ]),
                    dgo: undefined,
                },
                {
                    n: "Tableur",
                    ...alone,
                    wb: workbook("Données", [number(1, 1, 7)]),
                    dgo: undefined,
                },
            ],
        };
        const c = createConstruction([800, 600]);
        await openFigureFile(
            c,
            new File([await gzipped(book)], "classeur.dgo"),
        );
        // Shown, as in the editor, before DocCells holds its workbook.
        c.reveal();
        type(c, "m = 2 * !A1");
        expect(value(c, "m")).toBe(6);
        type(c, "B = (!A2, !B1)");
        expect(value(c, "B")).toEqual([4, 5]);
        type(c, "n = Tableur!B2");
        expect(value(c, "n")).toBe(7);
        type(c, "f = Figure!!A1");
        expect(value(c, "f")).toBe(3);
        type(c, "L = !A1:A4");
        expect(value(c, "L")).toEqual([3, 4, NaN, NaN]);
        type(c, "R = !A1:B2");
        expect(value(c, "R")).toEqual([
            [3, 5],
            [4, NaN],
        ]);
        type(c, "e = !A3");
        expect(value(c, "e")).toBeNull();
        expect(() => type(c, "q = Données!B2")).toThrow("unknown_object");
    });
});

async function editor(src = "/editor.html?embed&lang=fr") {
    const iframe = $.create("iframe")
        .att("src", src)
        .stl("width:900px;height:600px;border:0")
        .dom() as HTMLIFrameElement;
    const pending = new Map<number, (answer: Message) => void>();
    let id = 0;
    let ready!: () => void;
    const started = new Promise<void>((resolve) => (ready = resolve));
    const listener = ({ source, data }: MessageEvent) => {
        if (source !== iframe.contentWindow || data?.docgeo !== 1) return;
        if (data.event === "ready") ready();
        else if (!data.event) {
            pending.get(data.id)!(data);
            pending.delete(data.id);
        }
    };
    window.addEventListener("message", listener);
    cleanup.push(() => {
        window.removeEventListener("message", listener);
        iframe.remove();
    });
    $("body").add($(iframe));
    await started;
    return {
        page: () => iframe.contentDocument!,
        // Typed in DocCells, rather than written by DocGeo: posted from the
        // window DocCells is the frame of.
        typed: (ref: string, v: unknown) =>
            (
                iframe.contentWindow as unknown as { eval(code: string): void }
            ).eval(
                `document.querySelector(".docgeo-sheet iframe").contentWindow.postMessage(${JSON.stringify({ doccells: 1, type: "setCellValues", updates: [{ ref, v }] })}, "*")`,
            ),
        request: (type: string, parameters: Message = {}) =>
            new Promise<Message>((resolve) => {
                pending.set(++id, resolve);
                iframe.contentWindow!.postMessage(
                    { docgeo: 1, id, type, ...parameters },
                    "*",
                );
            }),
    };
}

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

declare global {
    interface Window {
        docCells?: any;
    }
}

// The value of the cell once the editor's page shows it in its workbook.
const cell = (page: Document, ref: string, value: unknown) =>
    until(() => {
        const frame = page.querySelector<HTMLIFrameElement>(
            ".docgeo-sheet.on > iframe",
        );
        const cells = frame?.contentWindow!.docCells;
        // Until the page's workbook is loaded, which has the sheet.
        return (
            cells
                ?.save()
                .sheets.some(
                    ({ name }: { name: string }) => name === ref.split("!")[0],
                ) &&
            cells.getValues(ref)[0][0] === value &&
            cells
        );
    });

describe("sheet views in the editor", () => {
    it("keeps the cells from page to page, and saves them", async () => {
        const { page, request } = await editor();
        const file = await (await fetch("/tests/dgo/tableur.dgo")).blob();
        await request("load", {
            data: await file.arrayBuffer(),
            format: "dgo",
        });
        const docCells = await cell(page(), "Feuille1!A1", 3);
        // Over its column, the right half of the figure.
        const box = page()
            .querySelector(".docgeo-sheet")!
            .getBoundingClientRect();
        const svg = page()
            .querySelector("body > svg:has([data-layer])")!
            .getBoundingClientRect();
        expect(box.left).toBeCloseTo(svg.right, 0);
        expect(box.width).toBeCloseTo(svg.width, 0);
        docCells.setCellValues([{ ref: "Feuille1!B2", v: 42 }]);
        const tab = (index: number) =>
            (
                [...page().querySelectorAll(".docgeo-tabs > button[dir]")][
                    index
                ] as HTMLElement
            ).click();
        tab(1);
        await cell(page(), "Données!B2", 7);
        tab(2);
        await until(
            () =>
                page().querySelector<HTMLElement>(".docgeo-sheet")!.style
                    .display === "none",
        );
        tab(0);
        await cell(page(), "Feuille1!B2", 42);
        const saved = (await request("save")).result.data as ArrayBuffer;
        const book = (await dgoJson(new Blob([saved]))) as {
            pg: DgoFigure[];
        };
        const [sheet] = (book.pg[0].wb as any).sheets;
        expect(
            sheet.celldata.find(
                ({ r, c }: { r: number; c: number }) => r === 1 && c === 1,
            ).v.v,
        ).toBe(42);
        tab(1);
        await cell(page(), "Données!B2", 7);
        await request("load", { data: saved, format: "dgo" });
        await cell(page(), "Feuille1!B2", 42);
    });
});

describe("DocCells' bars in the editor's", () => {
    it("take their place while the sheet view is active", async () => {
        // A window of its own: framed, the editor has no menu bar.
        const popup = window.open(
            `/editor.html?lang=fr&url=${location.origin}/tests/dgo/tableur.dgo`,
            "_blank",
            "width=1200,height=700",
        ) as typeof window;
        cleanup.push(() => popup.close());
        const page = await until(
            () =>
                popup.document?.querySelector(".docgeo-sheet.on") &&
                popup.document,
        );
        const docCells = await cell(page, "Feuille1!A1", 3);
        const bar = page.querySelector<HTMLElement>(".dge-sheet-bar")!;
        await until(() => bar.shadowRoot?.querySelector('[data-tips^="Gras"]'));
        const shown = (selector: string) =>
            [...page.querySelectorAll(selector)].map(
                (element) => element.getClientRects().length > 0,
            );
        const on = () => page.body.classList.contains("dge-sheet-on");
        const press = (target: EventTarget, view: typeof window = popup) =>
            target.dispatchEvent(
                new view.PointerEvent("pointerdown", { bubbles: true }),
            );
        const svg = page.querySelector("body > svg:has([data-layer])")!;
        const before = svg.getBoundingClientRect().toJSON();
        const editorBar = page
            .querySelector(".dge-bar")!
            .getBoundingClientRect();
        expect(on()).toBe(false);
        expect(shown(".dge-menubar > div:not([class])")).toEqual([
            true,
            false,
            true,
            true,
            true,
            true,
        ]);
        expect(shown(".dge-sheet-menus, .dge-sheet-bar")).toEqual([
            false,
            false,
        ]);
        // Pressed in the cells.
        const frame = page.querySelector<HTMLIFrameElement>(
            ".docgeo-sheet > iframe",
        )!.contentWindow! as typeof window;
        press(frame, frame);
        expect(on()).toBe(true);
        expect(shown(".dge-menubar > div:not([class])")).toEqual([
            true,
            true,
            false,
            false,
            false,
            false,
        ]);
        expect(shown(".dge-bar, .dge-sheet-menus")).toEqual([false, true]);
        expect(bar.getBoundingClientRect().toJSON()).toEqual(
            editorBar.toJSON(),
        );
        expect(svg.getBoundingClientRect().toJSON()).toEqual(before);
        // Bold on A1, selected, from the editor's bar.
        const a1 = frame.document.elementFromPoint(70, 60)!;
        for (const type of ["mousedown", "mouseup"])
            a1.dispatchEvent(
                new frame.MouseEvent(type, {
                    bubbles: true,
                    clientX: 70,
                    clientY: 60,
                    buttons: +(type === "mousedown"),
                }),
            );
        bar.shadowRoot!.querySelector<HTMLElement>(
            '[data-tips^="Gras"]',
        )!.click();
        const bold = (sheet: {
            celldata: { r: number; c: number; v: any }[];
        }) => sheet.celldata.find(({ r, c }) => r === 0 && c === 0)?.v.bl;
        await until(() => bold(docCells.save().sheets[0]) === 1);
        // File > Save, the sheet view still active.
        let written: Blob | undefined;
        (popup as any).showSaveFilePicker = async () => ({
            name: "tableur.dgo",
            createWritable: async () => ({
                write: async (blob: Blob) => (written = blob),
                close: async () => {},
            }),
        });
        page.querySelector<HTMLElement>(".dge-menubar > div > button")!.click();
        [...page.querySelectorAll<HTMLElement>(".dge-menu-popup > button")]
            .find(
                ({ firstChild }) => firstChild?.textContent === "Enregistrer",
            )!
            .click();
        const book = (await dgoJson(await until(() => written))) as {
            pg: DgoFigure[];
        };
        expect(bold((book.pg[0].wb as any).sheets[0])).toBe(1);
        expect(on()).toBe(true);
        // A single menu open in both menu bars, the pointer passing from
        // one to the other.
        const roots = [
            ...page.querySelectorAll<HTMLElement>(
                ".dge-menubar > div > button",
            ),
        ];
        const inner = [
            ...page
                .querySelector(".dge-sheet-menus")!
                .shadowRoot!.querySelectorAll<HTMLElement>("[aria-expanded]"),
        ];
        const opened = () =>
            [
                ...roots.filter((root) => root.classList.contains("dge-open")),
                ...inner.filter((root) => root.ariaExpanded === "true"),
            ]
                .map(({ textContent }) => textContent)
                .join();
        roots[1].click();
        inner
            .find(({ textContent }) => textContent === "Format")!
            .dispatchEvent(
                new popup.PointerEvent("pointerover", {
                    bubbles: true,
                    composed: true,
                }),
            );
        await until(() => opened() === "Format");
        roots[0].dispatchEvent(new popup.PointerEvent("pointerenter"));
        await until(() => opened() === "Fichier");
        roots[0].click();
        expect(opened()).toBe("");
        // Pressed in a graphic view, then in the Construction panel.
        press(svg);
        expect(on()).toBe(false);
        expect(shown(".dge-bar, .dge-sheet-menus")).toEqual([true, false]);
        press(frame, frame);
        expect(on()).toBe(true);
        press(page.querySelector("#dge-history")!);
        expect(on()).toBe(false);
        // A sheet tab: always.
        page.querySelectorAll<HTMLElement>(
            ".docgeo-tabs > button[dir]",
        )[1].click();
        await until(on);
        // A dialog of DocCells veils the page, not itself.
        bar.shadowRoot!.querySelector<HTMLElement>(
            "#custom-alternating-colors-button",
        )!.click();
        await until(() => page.body.classList.contains("dge-sheet-dialog"));
        const veil = page.querySelector(".dge-sheet-veil")!;
        expect(page.elementFromPoint(100, 300)).toBe(veil);
        const { left, top } = page
            .querySelector(".docgeo-sheet")!
            .getBoundingClientRect();
        expect(page.elementFromPoint(left + 10, top + 10)?.tagName).toBe(
            "IFRAME",
        );
        // As DocCells veils its frame, then no more.
        const backdrop = frame.document.querySelector(".dc-ac-backdrop")!;
        const background = (element: Element, view: typeof window) =>
            view.getComputedStyle(element).backgroundColor;
        expect(background(veil, popup)).toBe(background(backdrop, frame));
        [...frame.document.querySelectorAll<HTMLElement>("button")]
            .find(({ textContent }) => textContent === "Annuler")!
            .click();
        await until(() => !page.body.classList.contains("dge-sheet-dialog"));
        // DocCells' menus as large as the editor's.
        const fontSize = (element: Element) =>
            popup.getComputedStyle(element).fontSize;
        expect(
            fontSize(
                page
                    .querySelector(".dge-sheet-menus")!
                    .shadowRoot!.querySelector("button")!,
            ),
        ).toBe(fontSize(page.querySelector(".dge-menubar > div > button")!));
        // DocCells' menus as the editor's: font, rows, hovered row.
        const looks = async (root: HTMLElement, rows: string) => {
            root.click();
            const row = await until(() =>
                [
                    ...(
                        root.getRootNode() as ParentNode
                    ).querySelectorAll<HTMLElement>(rows),
                ].find((row) => row.getClientRects().length),
            );
            const { left, top, height } = row.getBoundingClientRect();
            await commands.hover(left + 20, top + height / 2);
            const style = popup.getComputedStyle(row);
            const look = [
                style.fontFamily,
                height,
                style.backgroundColor,
                style.color,
            ];
            await commands.hover(600, 600);
            root.click();
            return look;
        };
        const geo = await looks(roots[0], ".dge-menu-popup > button");
        expect(geo[2]).toBe("rgb(37, 99, 235)");
        // DocCells' menu bar mounted again, on the sheet tab.
        const edit = page
            .querySelector(".dge-sheet-menus")!
            .shadowRoot!.querySelector<HTMLElement>("[aria-expanded]")!;
        expect(await looks(edit, ".dc-menu-item")).toEqual(geo);
        const title = ({ top, height }: DOMRect) => [top, height];
        expect(title(edit.getBoundingClientRect())).toEqual(
            title(roots[0].getBoundingClientRect()),
        );
    });
});

describe("cells picked while a line is typed", () => {
    it("give their reference at the caret, as the mouse drags over them", async () => {
        const popup = window.open(
            `/editor.html?lang=fr&url=${location.origin}/tests/dgo/tableur.dgo`,
            "_blank",
            "width=1200,height=700",
        ) as typeof window;
        cleanup.push(() => popup.close());
        const page = await until(
            () =>
                popup.document?.querySelector(".docgeo-sheet.on") &&
                popup.document,
        );
        await cell(page, "Feuille1!A1", 3);
        // Not to cover the cells.
        const palette = page.querySelector("#dge-palette")!;
        if (palette.getClientRects().length)
            page.querySelector<HTMLElement>(".dge-bar .dge-palette-button")!.click();
        const iframe = page.querySelector(".docgeo-sheet > iframe")!;
        const frame = (iframe as HTMLIFrameElement)
            .contentWindow! as typeof window;
        const area = frame.document
            .querySelector(".fortune-cell-area")!
            .getBoundingClientRect();
        const { left, top } = iframe.getBoundingClientRect();
        // Columns of 100 px, rows of 20 px.
        const at = (r: number, c: number): [number, number] => [
            left + area.left + c * 100 + 50,
            top + area.top + r * 20 + 10,
        ];
        const on = () => page.body.classList.contains("dge-sheet-on");
        const field = page.querySelector<HTMLInputElement>(
            ".dge-entry .dge-input",
        )!;
        field.focus();
        field.value = "s = 2 *  + 1";
        field.setSelectionRange(8, 8);
        await commands.mouse("move", ...at(1, 1));
        await commands.mouse("down");
        await until(() => field.value === "s = 2 * !B2 + 1");
        await commands.mouse("move", ...at(3, 2));
        await until(() => field.value === "s = 2 * !B2:C4 + 1");
        expect(
            frame.document.querySelector(".dc-pick-frame")!.getClientRects()
                .length,
        ).toBe(1);
        await commands.mouse("move", ...at(3, 1));
        await commands.mouse("up");
        await until(() => field.value === "s = 2 * !B2:B4 + 1");
        expect(page.activeElement).toBe(field);
        expect(field.selectionStart).toBe(14);
        expect(on()).toBe(false);
        expect(
            page.querySelector(".dge-bar")!.getClientRects().length,
        ).toBe(1);
        // Another press inserts another reference.
        field.setRangeText(" + ", 14, 14, "end");
        await commands.mouse("move", ...at(0, 0));
        await commands.mouse("down");
        await commands.mouse("up");
        await until(() => field.value === "s = 2 * !B2:B4 + !A1 + 1");
        expect(page.activeElement).toBe(field);
        // Out of the line, pressed cells activate the sheet view.
        field.blur();
        await commands.mouse("move", ...at(4, 3));
        await commands.mouse("down");
        await commands.mouse("up");
        await until(on);
        expect(frame.document.querySelector(".dc-pick-frame")).toBe(null);
        expect(field.value).toBe("s = 2 * !B2:B4 + !A1 + 1");
    });
});

describe("objects picked while a cell's formula is typed", () => {
    it("give GEO of their names at the caret, the sheet view kept", async () => {
        const popup = window.open(
            `/editor.html?lang=fr&url=${location.origin}/tests/dgo/tableur_geo.dgo`,
            "_blank",
            "width=1200,height=700",
        ) as typeof window;
        cleanup.push(() => popup.close());
        const page = await until(
            () =>
                popup.document?.querySelector(".docgeo-sheet.on") &&
                popup.document,
        );
        const docCells = await cell(page, "Feuille1!A1", 3);
        const palette = page.querySelector("#dge-palette")!;
        if (palette.getClientRects().length)
            page.querySelector<HTMLElement>(
                ".dge-bar .dge-palette-button",
            )!.click();
        const iframe = page.querySelector(".docgeo-sheet > iframe")!;
        const frame = (iframe as HTMLIFrameElement)
            .contentWindow! as typeof window;
        const area = frame.document
            .querySelector(".fortune-cell-area")!
            .getBoundingClientRect();
        const { left, top } = iframe.getBoundingClientRect();
        const svg = page
            .querySelector("body > svg:has([data-layer])")!
            .getBoundingClientRect();
        // The view's origin at (200, 300), 40 px a unit.
        const point = (x: number, y: number) =>
            [svg.left + 200 + 40 * x, svg.top + 300 - 40 * y] as const;
        // Columns of 100 px, rows of 20 px.
        const at = (r: number, c: number) =>
            [
                left + area.left + c * 100 + 50,
                top + area.top + r * 20 + 10,
            ] as const;
        const click = async (x: number, y: number) => {
            await commands.mouse("move", x, y);
            await commands.mouse("down");
            await commands.mouse("up");
        };
        const on = () => page.body.classList.contains("dge-sheet-on");
        const input = () =>
            frame.document.querySelector("#luckysheet-rich-text-editor")!
                .textContent;
        const value = (ref: string) =>
            JSON.stringify(docCells.getValues(ref)[0][0]);
        await until(() => value("Feuille1!C1") === "[4,3]");
        const rows = page.querySelectorAll(".dge-row").length;
        await click(...at(1, 1));
        await until(on);
        await commands.keyboard("type", "=2*");
        await until(() => input() === "=2*");
        await click(...point(1, 2));
        await until(() => input() === '=2*GEO("A")');
        // A second object replaces the first.
        await click(...point(3, 1));
        await until(() => input() === '=2*GEO("B")');
        expect(on()).toBe(true);
        expect(page.querySelector(".dge-picked")).toBe(null);
        await commands.keyboard("type", "+1");
        await commands.keyboard("press", "Enter");
        await until(() => value("Feuille1!B2") === "[7,2]");
        // Neither moved, nor a point made.
        expect(value("Feuille1!C1")).toBe("[4,3]");
        expect(page.querySelectorAll(".dge-row").length).toBe(rows);
        expect(on()).toBe(true);
        // Out of a formula, the figure takes the press as before.
        await click(...point(1, 2));
        await until(() => !on());
        expect(value("Feuille1!B2")).toBe("[7,2]");
    });
});

describe("cells read by the shown figure", () => {
    it("follows the cells typed in DocCells, a range as a list", async () => {
        const { page, request, typed } = await editor("/index.html?embed");
        const ex = (name: string, s: string) => [
            "Ex",
            name,
            { t: "", s, xy: [0, 0] },
        ];
        const figure = {
            ...both,
            wb: workbook("Feuille1", [number(0, 0, 3), number(1, 1, 2)]),
            o: [ex("m", "2*!B2"), ex("L", "!A1:A2")],
        };
        await request("load", {
            data: new TextEncoder().encode(JSON.stringify(figure)).buffer,
            format: "dgo",
        });
        const read = async (name: string) =>
            (await request("value", { name })).result;
        expect([await read("m"), await read("L")]).toEqual([4, [3, null]]);
        await cell(page(), "Feuille1!B2", 2);
        typed("Feuille1!B2", 21);
        typed("Feuille1!A2", 1);
        await until(async () => (await read("m")) === 42);
        expect(await read("L")).toEqual([3, 1]);
    });
});

declare module "vitest/browser" {
    interface BrowserCommands {
        throttle: (rate: number) => Promise<void>;
        hover: (x: number, y: number) => Promise<void>;
        mouse: (
            action: "move" | "down" | "up",
            x?: number,
            y?: number,
        ) => Promise<void>;
        keyboard: (action: "type" | "press", text: string) => Promise<void>;
    }
}

// The engine of the page of the frame, its figure and DocCells.
async function engine(page: Document) {
    const view = page.defaultView! as unknown as {
        eval(code: string): Promise<{ construction: typeof construction }>;
        requestAnimationFrame(callback: () => void): number;
    };
    const engine = await view.eval('import("/src/construction.ts")');
    const c = engine.construction.constructions[0];
    const docCells = () =>
        page.querySelector<HTMLIFrameElement>(".docgeo-sheet.on > iframe")
            ?.contentWindow!.docCells;
    // A point moved as a drag moves it, then what the next frame shows.
    const drag = (name: string, coords: number[], read: () => unknown) => {
        const point = c.getObj(name) as unknown as { coords: number[] };
        point.coords = coords;
        c.invalidateGeometry(c.getObj(name)!);
        return new Promise((resolve) =>
            view.requestAnimationFrame(() => resolve(read())),
        );
    };
    return { c, docCells, drag };
}

const formula = (r: number, c: number, f: string) => ({ r, c, v: { f } });
const ex = (name: string, s: string) => ["Ex", name, { t: "", s, xy: [0, 0] }];
const encoded = (figure: unknown) =>
    new TextEncoder().encode(JSON.stringify(figure)).buffer;
// A page with a sheet view, its workbook's cells, and the objects of the
// lines.
async function built(cells: unknown[], lines: string[]) {
    const c = createConstruction([800, 600]);
    readDgo(c, { ...both, o: [], wb: workbook("Feuille1", cells) });
    // Shown, its formulas reading its cells.
    c.reveal();
    lines.forEach((line) => type(c, line));
    const figure = await describeDgo(c);
    c.dispose();
    return encoded(figure);
}

describe("cells that read the figure", () => {
    it("follow a point dragged, and the objects reading them too, in the same frame", async () => {
        const { page, request } = await editor("/index.html?embed");
        await request("load", {
            data: await built(
                [
                    formula(0, 0, '=GEO("d")'),
                    formula(1, 0, "=A1*2"),
                    formula(2, 0, `=GEO("e")&"!"`),
                ],
                [
                    "A = (1, 2)",
                    "d = x(A)",
                    'e = "a"',
                    "m = !A2 + 1",
                    "t = !A3",
                ],
            ),
            format: "dgo",
        });
        const { c, docCells, drag } = await engine(page());
        const read = () => c.getObj("m")!.scriptValue(false);
        await until(() => read() === 3);
        expect(c.getObj("t")!.scriptValue(false)).toBe("a!");
        expect(
            await drag("A", [5, 2, 0], () => [
                read(),
                docCells().getValues("Feuille1!A1:A2"),
            ]),
        ).toEqual([11, [[5], [10]]]);
    });

    it("read a point as a list, computed on as complex numbers", async () => {
        const { page, request } = await editor("/index.html?embed");
        await request("load", {
            data: await built(
                [formula(0, 0, '=GEO("A")'), formula(1, 0, "=A1*A1")],
                ["A = (1, 2)", "m = !A2"],
            ),
            format: "dgo",
        });
        const { c, docCells, drag } = await engine(page());
        const read = () => c.getObj("m")!.scriptValue(false);
        await until(() => String(read()) === "-3,4");
        expect(
            await drag("A", [0, 1, 0], () => [
                read(),
                docCells().getValues("Feuille1!A1:A2"),
            ]),
        ).toEqual([
            [-1, 0],
            [[[0, 1]], [[-1, 0]]],
        ]);
    });

    it("read an object of another page", async () => {
        const { page, request } = await editor("/index.html?embed");
        const other = JSON.parse(
            new TextDecoder().decode(
                await built([formula(0, 0, `=GEO("'Page 1'!k")+1`)], []),
            ),
        );
        await request("load", {
            data: await (
                await gzipped({
                    dgo: 1,
                    pg: [
                        { n: "Page 1", ...alone, v: both.v, o: [ex("k", "7")] },
                        {
                            n: "Page 2",
                            ...other,
                            o: [ex("n", "!A1 * 2")],
                            dgo: undefined,
                        },
                    ],
                    p: 1,
                })
            ).arrayBuffer(),
            format: "dgo",
        });
        const { c } = await engine(page());
        await until(() => c.getObj("n")!.scriptValue(false) === 16);
    });

    it("leaves undefined a reference that closes a cycle, in a file", async () => {
        const { page, request } = await editor("/index.html?embed");
        await request("load", {
            data: await built(
                [formula(0, 0, '=GEO("m")+1')],
                ["m = !A1 * 2", "n = m + 1"],
            ),
            format: "dgo",
        });
        const { c, docCells } = await engine(page());
        // Its value given to DocCells, undefined.
        await until(() => docCells()?.getValues("Feuille1!A1")[0][0]?.error);
        expect(c.getObj("m")!.scriptValue(false)).toBeNull();
        expect(c.getObj("n")!.scriptValue(false)).toBeNull();
    });

    it("refuses in the editor a line or a cell that closes a cycle", async () => {
        const { page, request, typed } = await editor();
        await request("load", {
            data: encoded({
                ...both,
                wb: workbook("Feuille1", [formula(0, 0, '=GEO("m")+1')]),
                o: [ex("m", "1"), ex("n", "!B1+1")],
            }),
            format: "dgo",
        });
        const { docCells } = await engine(page());
        await until(() => docCells()?.getValues("Feuille1!A1")[0][0] === 2);
        const input = page().querySelector<HTMLInputElement>(".dge-input")!;
        const enter = (text: string) => {
            input.value = text;
            input.dispatchEvent(
                new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
            );
        };
        const hint = (ref: string) =>
            page().body.textContent!.includes(`Référence circulaire : ${ref}`);
        enter("m = !A1");
        await until(() => input.classList.contains("dge-error"));
        expect(hint("!A1")).toBe(true);
        const scene = (await engine(page())).c;
        expect(scene.getObj("m")!.scriptValue(false)).toBe(1);
        enter("p = !A1");
        await until(() => scene.getObj("p")?.scriptValue(false) === 2);
        // A cell's formula, typed in DocCells, the cells then loaded again.
        let typing = true;
        docCells().on("hostNamesChanged", () => (typing = false));
        typed("Feuille1!B1", '=GEO("n")');
        await until(
            () =>
                !typing &&
                hint("!B1") &&
                docCells()
                    ?.save()
                    .sheets[0].celldata.every(
                        ({ r, c }: { r: number; c: number }) =>
                            r !== 0 || c !== 1,
                    ),
        );
        expect(scene.getObj("n")!.scriptValue(false)).toBeNull();
    });

    it("takes a frame with 300 formulas reading the figure", async () => {
        const { page, request } = await editor("/index.html?embed");
        await request("load", {
            data: await built(
                [
                    formula(0, 0, '=GEO("d")'),
                    ...Array.from({ length: 299 }, (_, k) =>
                        formula(k + 1, 0, `=A${k + 1}+1`),
                    ),
                ],
                ["A = (1, 2)", "d = x(A)", "m = !A300"],
            ),
            format: "dgo",
        });
        const { c } = await engine(page());
        const read = () => c.getObj("m")!.scriptValue(false);
        await until(() => read() === 300);
        const point = c.getObj("A") as unknown as { coords: number[] };
        const measure = () => {
            const times = Array.from({ length: 40 }, (_, k) => {
                point.coords = [k / 10, 2, 0];
                const start = performance.now();
                c.invalidateGeometry(c.getObj("A")!);
                c.flush();
                const time = performance.now() - start;
                expect(read()).toBeCloseTo(k / 10 + 299);
                return time;
            });
            return times.sort((a, b) => a - b)[20];
        };
        // About 0.7 ms (2026-11-20).
        measure();
        await commands.throttle(4);
        // About 3 ms, within a frame.
        expect(measure()).toBeLessThan(16);
        await commands.throttle(1);
    });
});

describe("a sheet view in the embedded player", () => {
    it("gives the base cells back on reset, takes the typed ones on rebase and save", async () => {
        const { page, request, typed } = await editor("/index.html?embed");
        await request("load", {
            data: encoded({
                ...both,
                o: [ex("m", "2*!A1")],
                wb: workbook("Feuille1", [number(0, 0, 3)]),
            }),
            format: "dgo",
        });
        // At once, while DocCells loads the workbook.
        await request("setState", { state: {} });
        const read = async () => (await request("value", { name: "m" })).result;
        await cell(page(), "Feuille1!A1", 3);
        typed("Feuille1!A1", 5);
        await until(async () => (await read()) === 10);
        const saved = (await dgoJson(
            new Blob([(await request("save")).result.data]),
        )) as Message;
        expect(saved.wb.sheets[0].celldata[0].v.v).toBe(5);
        await request("reset");
        expect(await read()).toBe(6);
        // Loaded again.
        await cell(page(), "Feuille1!A1", 3);
        typed("Feuille1!A1", 4);
        await until(async () => (await read()) === 8);
        await request("rebase");
        typed("Feuille1!A1", 9);
        await until(async () => (await read()) === 18);
        await request("reset");
        await until(async () => (await read()) === 8);
        expect(page().querySelector(".docgeo-sheet.failed")).toBeNull();
    });

    it("is placed on its part of a web page's region", async () => {
        const iframe = $.create("iframe")
            .att("src", "/index.html?fit&url=/tests/dgo/tableur.dgo")
            .stl("width:800px;height:300px;border:0")
            .dom() as HTMLIFrameElement;
        cleanup.push(() => iframe.remove());
        $("body").add($(iframe));
        // The region, 800 × 600, at half its size or less, centered: the
        // sheet view its right half.
        const box = await until(() => {
            const rect = iframe.contentDocument
                ?.querySelector(".docgeo-sheet.on")
                ?.getBoundingClientRect();
            return rect?.width ? rect : null;
        });
        const view = iframe
            .contentDocument!.querySelectorAll("body > svg")[1]
            .getBoundingClientRect();
        expect(box.toJSON()).toEqual(view.toJSON());
        // Not half the window, as a column.
        expect(view.left).toBeCloseTo(400);
        expect(view.width).toBeLessThan(400);
    });
});
