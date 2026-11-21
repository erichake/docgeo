import { construction } from "./construction";
import {
    describeDgo,
    describeWorkbook,
    figureObjects,
    gzipped,
    importDgo,
    readDgoFile,
    type Workbook,
} from "./dgo";
import { $, type DOMElement } from "./dom";
import { DIR } from "./i18n";
import { readExternals, type ScriptValue } from "./import/dgp_formula";
import { expression_object } from "./objects/expression_object";
import { preferences } from "./preferences";
import { archiveCells, readCells } from "./sheet";

$("head").append(`<style>
    .docgeo-tabs { position: fixed; bottom: 0; inset-inline: var(--dge-panel-width, 0px) 0; height: var(--docgeo-tabs); display: flex; padding-inline: 8px; overflow-x: auto; background: #fafafc; box-shadow: inset 0 1px #e0e0e0; color: #676464; font: 13px system-ui, -apple-system, "Segoe UI", sans-serif; user-select: none; -webkit-user-select: none; transition: inset-inline-start var(--dge-slide, 0s); }
    .docgeo-tabs > button { position: relative; flex: none; display: flex; align-items: center; max-width: 240px; padding: 0 12px; border: 0; border-inline: 1px solid #e0e0e0; margin-inline-end: -1px; background: #fafafc; color: inherit; font: inherit; white-space: nowrap; cursor: pointer; }
    .docgeo-tabs > button:hover { background: #efefef; color: #222; }
    .docgeo-tabs > button.on { background: #efefef; color: #222; cursor: default; }
    .docgeo-tabs > button::after { content: ""; position: absolute; inset: auto 0 0; height: 3px; background: var(--docgeo-tab-color, none); }
    .docgeo-tabs > button > span { overflow: hidden; text-overflow: ellipsis; }
</style>`);

type Page = Workbook["pages"][number];

// The workbook of the page shown, whose formulas read the expressions of
// its other pages (see DGO.md): the values computed of each, which hold as
// long as the pages it read don't change, and the pages being computed,
// the page shown first, each with those it reads.
let book: Workbook | null = null;
const computed = new Map<
    Page,
    { values: Map<string, ScriptValue | null>; reads: Set<Page> }
>();
let reading: { page: Page; reads: Set<Page> }[] = [];

export function useWorkbook(shown: Workbook | null): void {
    if (shown === book) return;
    book = shown;
    forgetValues();
    if (!book) return;
    // Those of the page shown first, a global never set changing none.
    const { pages, current } = book;
    const values = new Map<string, unknown>();
    for (const page of [pages[current], ...pages])
        for (const { g, v } of globals(page))
            if (v != null && !values.has(g)) values.set(g, v);
    shareGlobals(pages, values);
}

type Global = { g: string; v?: unknown };

// The parameters of the expressions holding Blockly globals in the page's
// description.
const globals = ({ figure: { o } }: Page): Global[] =>
    (Array.isArray(o) ? o : []).flatMap((object: unknown) =>
        Array.isArray(object) &&
        object[0] === "Ex" &&
        typeof (object[2] as Global | null)?.g === "string"
            ? [object[2] as Global]
            : [],
    );

const pageGlobals = (page: Page) =>
    new Map(globals(page).map(({ g, v }) => [g, v ?? null]));

// The Blockly globals are the workbook's, not a page's (see DGO.md): the
// pages that hold one are given its value, and computed again.
function shareGlobals(pages: Page[], values: Map<string, unknown>): void {
    for (const page of pages) {
        let changed = false;
        for (const global of globals(page))
            if (
                values.has(global.g) &&
                JSON.stringify(values.get(global.g)) !==
                    JSON.stringify(global.v ?? null)
            ) {
                global.v = values.get(global.g);
                changed = true;
            }
        if (!changed) continue;
        computed.delete(page);
        forget(page);
    }
}

// After a page is deleted.
export function forgetValues(): void {
    computed.clear();
    reading = [];
}

const pageNamed = (name: string): Page | undefined =>
    book?.pages.find((page) => page.name === name);

// The page reading: the page shown, unless another is being computed.
function reader(): { page: Page; reads: Set<Page> } {
    const page = book!.pages[book!.current];
    if (reading[0]?.page !== page) reading = [{ page, reads: new Set() }];
    return reading[reading.length - 1];
}

// Undefined if it would close a cycle: the pages being computed, the page
// shown first, can't be read.
readExternals((name, object) => {
    const cells = cellsOf(name, object);
    if (cells !== undefined) return cells;
    if (!name || object.startsWith("!")) return null;
    const page = pageNamed(name);
    if (!page) return null;
    reader().reads.add(page);
    return reading.some((other) => other.page === page)
        ? null
        : (pageValues(page).get(object) ?? null);
});

// The cells a reference names, undefined if it names none: of the sheet
// view of the page computed ("!B3"), or of a page's sheet tab
// ("Tableur2!B3") or sheet view ("'Page 1'!!B3"), see TABLEUR.md.
function cellsOf(
    name: string,
    object: string,
): ScriptValue | null | undefined {
    if (!name) return readCells(object);
    const page = pageNamed(name);
    const view = object.startsWith("!");
    const { wb, v, vs } = page?.figure ?? {};
    if (!wb || !(view || (v!.t === "s" && !vs?.length))) return undefined;
    const range = view ? object.slice(1) : object;
    return page === reader().page ? readCells(range) : archiveCells(wb, range);
}

// As last computed, or computed in a figure that is never shown.
function pageValues(page: Page): Map<string, ScriptValue | null> {
    let done = computed.get(page);
    if (!done) {
        const entry = { page, reads: new Set<Page>() };
        reading.push(entry);
        const c = construction.create({ prefs: new preferences() });
        let values = new Map<string, ScriptValue | null>();
        try {
            importDgo(c, page.figure);
            values = expressionValues(c);
        } catch {
            // A malformed page, which shows why when it's shown.
        } finally {
            c.dispose();
            reading.pop();
        }
        done = { values, reads: entry.reads };
        computed.set(page, done);
    }
    return done.values;
}

// What a formula of the page reads when it names them (a point's
// coordinates, a segment's length…), functions aside.
const expressionValues = (c: construction) =>
    new Map(
        figureObjects(c).flatMap((object) =>
            object instanceof expression_object &&
            object.formula?.variables.length
                ? []
                : [[object.name, object.scriptValue(c.space)] as const],
        ),
    );

// The values the page shown is left with, as described: those that read it
// are computed again if they changed, and its globals given to the others.
export function leavePage(c: construction): void {
    if (!book) return;
    const { page, reads } = reader();
    shareGlobals(book.pages, pageGlobals(page));
    const values = expressionValues(c);
    const before = computed.get(page);
    computed.set(page, { values, reads });
    if (
        !before ||
        JSON.stringify([...before.values]) !== JSON.stringify([...values])
    )
        forget(page);
}

// The values of the pages that read it, directly or not.
function forget(page: Page): void {
    computed.forEach(({ reads }, other) => {
        if (other !== page && reads.has(page) && computed.delete(other))
            forget(other);
    });
}

// Why the page shown can't read the object of this page, if it can't: it
// reads the page shown, directly or not, or has no such expression.
export function unreadable(
    name: string,
    object: string,
): "unknown_object" | "circular_reference" | null {
    if (cellsOf(name, object) !== undefined) return null;
    const page = pageNamed(name);
    if (!page || !name || object.startsWith("!")) return "unknown_object";
    const shown = reader().page;
    if (page === shown) return "circular_reference";
    const values = pageValues(page);
    const seen = new Set<Page>();
    const reads = (from: Page): boolean =>
        [...(computed.get(from)?.reads ?? [])].some(
            (read) =>
                read === shown ||
                (!seen.has(read) && seen.add(read) && reads(read)),
        );
    if (reads(page)) return "circular_reference";
    return values.has(object) ? null : "unknown_object";
}

// Its page shown, and its workbook, if it is one, whose other pages its
// formulas read.
export async function importDgoBook(
    c: construction,
    file: Blob,
    centered = false,
): Promise<Workbook | null> {
    const { book, figure } = await readDgoFile(file);
    useWorkbook(book);
    importDgo(c, figure, centered);
    return book;
}

// The figure of the file, opened in `c`, and the workbook of which it is the
// page shown, if the file is one.
export async function openFigureFile(
    c: construction,
    file: File,
): Promise<{ book: Workbook | null; unsupported: string[] }> {
    if (/\.dgo$/i.test(file.name))
        return { book: await importDgoBook(c, file), unsupported: [] };
    useWorkbook(null);
    return { book: null, unsupported: await importForeign(c, file) };
}

// What a DGPad or GeoGebra figure, opened in `c`, has that isn't supported.
export const importForeign = async (
    c: construction,
    file: File,
): Promise<string[]> =>
    /\.ggb$/i.test(file.name)
        ? (await import("./ggb_importer")).importGgbFromBlob(c, file)
        : (await import("./dgp_importer")).importDgp(c, await file.text());

// With its page shown as it is in `c`.
export async function writeWorkbook(
    book: Workbook,
    c: construction,
): Promise<Blob> {
    const page = book.pages[book.current];
    page.figure = await describeDgo(c);
    shareGlobals(book.pages, pageGlobals(page));
    return gzipped(describeWorkbook(book));
}

let tabs: DOMElement | null = null;

// The height of the tabs below a workbook's figure.
export const TABS_HEIGHT = 32;

// Below the figure, those of the workbook's pages, if it has several, after
// `start`: `show` shows the page of the tab chosen in place of the one shown,
// whose figure it keeps as it is; `edit`, the editor's, completes each tab.
export function showTabs(
    book: Workbook | null,
    show: (index: number) => Promise<void>,
    edit?: (tab: DOMElement, index: number) => void,
    start: DOMElement[] = [],
): void {
    tabs?.dispose();
    tabs = null;
    const paged = !!book && book.pages.length > 1;
    $("html").stl("--docgeo-tabs", paged ? `${TABS_HEIGHT}px` : "");
    if (!paged) return;
    let showing = false;
    const buttons = book.pages.map(({ name, color }, index) => {
        const button = $.create("button")
            .att("dir", "auto")
            .att("title", name)
            .add($.create("span").text(name))
            .toggleClass("on", index === book.current);
        if (color) button.stl("--docgeo-tab-color", color);
        button.on("click", async () => {
            if (showing || index === book.current) return;
            showing = true;
            buttons.forEach((button, other) =>
                button.toggleClass("on", other === index),
            );
            await show(index).finally(() => (showing = false));
        });
        edit?.(button, index);
        return button;
    });
    tabs = $.create("div")
        .cls("docgeo-tabs")
        .att("dir", DIR)
        .add(...start, ...buttons);
    $("body").add(tabs);
}
