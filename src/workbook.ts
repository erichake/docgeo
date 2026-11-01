import type { construction } from "./construction";
import {
    describeDgo,
    describeWorkbook,
    gzipped,
    importDgoBook,
    type Workbook,
} from "./dgo";
import { $, type DOMElement } from "./dom";
import { DIR } from "./i18n";

$("head").append(`<style>
    .docgeo-tabs { position: fixed; bottom: 0; inset-inline: var(--dge-panel-width, 0px) 0; height: var(--docgeo-tabs); display: flex; padding-inline: 8px; overflow-x: auto; background: #fafafc; box-shadow: inset 0 1px #e0e0e0; color: #676464; font: 13px system-ui, -apple-system, "Segoe UI", sans-serif; user-select: none; -webkit-user-select: none; transition: inset-inline-start var(--dge-slide, 0s); }
    .docgeo-tabs > button { position: relative; flex: none; display: flex; align-items: center; max-width: 240px; padding: 0 12px; border: 0; border-inline: 1px solid #e0e0e0; margin-inline-end: -1px; background: #fafafc; color: inherit; font: inherit; white-space: nowrap; cursor: pointer; }
    .docgeo-tabs > button:hover { background: #efefef; color: #222; }
    .docgeo-tabs > button.on { background: #efefef; color: #222; cursor: default; }
    .docgeo-tabs > button::after { content: ""; position: absolute; inset: auto 0 0; height: 3px; background: var(--docgeo-tab-color, none); }
    .docgeo-tabs > button > span { overflow: hidden; text-overflow: ellipsis; }
</style>`);

// The figure of the file, opened in `c`, and the workbook of which it is the
// page shown, if the file is one.
export async function openFigureFile(
    c: construction,
    file: File,
): Promise<{ book: Workbook | null; unsupported: string[] }> {
    if (/\.dgo$/i.test(file.name))
        return { book: await importDgoBook(c, file), unsupported: [] };
    return {
        book: null,
        unsupported: /\.ggb$/i.test(file.name)
            ? await (await import("./ggb_importer")).importGgbFromBlob(c, file)
            : (await import("./dgp_importer")).importDgp(c, await file.text()),
    };
}

// With its page shown as it is in `c`.
export async function writeWorkbook(
    book: Workbook,
    c: construction,
): Promise<Blob> {
    book.pages[book.current].figure = await describeDgo(c);
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
