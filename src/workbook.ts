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
    .docgeo-tabs { position: fixed; bottom: 0; inset-inline: var(--dge-panel-width, 0px) 0; height: var(--docgeo-tabs); display: flex; gap: 2px; padding-inline: 8px; overflow-x: auto; background: #e5e7eb; box-shadow: inset 0 1px #d1d5db; font: 13px system-ui, -apple-system, "Segoe UI", sans-serif; transition: inset-inline-start var(--dge-slide, 0s); }
    .docgeo-tabs button { flex: none; max-width: 240px; padding: 0 14px; border: 0; border-radius: 0 0 8px 8px; background: none; color: #4b5563; font: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
    .docgeo-tabs button:hover { background: #f3f4f6; }
    .docgeo-tabs button.on { background: #fff; color: #1d4ed8; box-shadow: 0 1px 2px rgb(0 0 0 / 0.12); }
</style>`);

// The figure of the file, opened in `c`, and the workbook of which it is the
// page shown, if the file is one.
export async function openFigureFile(
    c: construction,
    file: File,
): Promise<{ book: Workbook | null; unsupported: string[] }> {
    if (/\.zir[sz]?$/i.test(file.name))
        return (await import("./zir_importer")).importZirBook(c, file);
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

// Below the figure, those of the workbook's pages, if it has several:
// `show` shows the page of the tab chosen in place of the one shown, whose
// figure it keeps as it is.
// The height of the tabs below a workbook's figure.
export const TABS_HEIGHT = 32;

export function showTabs(
    book: Workbook | null,
    show: (index: number) => Promise<void>,
): void {
    tabs?.dispose();
    tabs = null;
    const paged = !!book && book.pages.length > 1;
    $("html").stl("--docgeo-tabs", paged ? `${TABS_HEIGHT}px` : "");
    if (!paged) return;
    let showing = false;
    const buttons = book.pages.map(({ name }, index) => {
        const button = $.create("button")
            .att("dir", "auto")
            .att("title", name)
            .text(name)
            .toggleClass("on", index === book.current);
        button.on("click", async () => {
            if (showing || index === book.current) return;
            showing = true;
            buttons.forEach((button, other) =>
                button.toggleClass("on", other === index),
            );
            await show(index).finally(() => (showing = false));
        });
        return button;
    });
    tabs = $.create("div")
        .cls("docgeo-tabs")
        .att("dir", DIR)
        .add(...buttons);
    $("body").add(tabs);
}
