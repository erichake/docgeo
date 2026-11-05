import { $ } from "../dom";
import { t } from "../i18n";
import { message } from "./messages";

// Outside a frame, in a browser with the File System Access API (Chromium),
// the figure is saved as by an application: the first save asks where, the
// next ones write over the same .dgo file, whose name shows in the menu bar
// with a dot while the figure has changed since. Elsewhere, a save
// downloads the figure.
export const standalone = window.self === window.top;
export const native = standalone && !!window.showSaveFilePicker;
// The only place where the browser leaves ⌘N and ⌘T to the page.
export const installed =
    standalone && matchMedia("(display-mode: standalone)").matches;

const DGO = "application/x-docgeo";

// The figure's file name, and its name without the extension, given to a
// save.
let shown = "";
let name = "figure";
let handle: FileSystemFileHandle | null = null;

const fileName = $.create("span");
export const fileLabel = $.create("div").cls("dge-file").add(fileName);

const aborted = (error: Error): null => {
    if (error.name !== "AbortError") throw error;
    return null;
};

// A figure opened from `source`, a file name or a URL. A save writes back to
// its file only if `from` is that of a .dgo file.
export function opened(source: string, from?: FileSystemHandle | null): void {
    shown = source
        .split(/[/\\?#]/)
        .filter(Boolean)
        .pop()!;
    name = shown.replace(/\.[^.]*$/, "");
    handle =
        from?.kind === "file" && /\.dgo$/i.test(from.name)
            ? (from as FileSystemFileHandle)
            : null;
    showChanged(false);
}

export function showChanged(dirty: boolean): void {
    if (!native) return;
    document.title = `${dirty ? "● " : ""}${shown} — ${message("title")}`;
    fileName.text(shown);
    fileLabel
        .toggleClass("dge-dirty", dirty)
        .att(
            "title",
            dirty ? `${shown} — ${message("unsaved_changes")}` : shown,
        );
}

// Lets the user choose figure files, several if the input allows it: the
// first one a save can write back to, where the browser allows it.
export function chooseFile(
    input: HTMLInputElement,
    open: (files: File[], from?: FileSystemFileHandle) => void,
): void {
    if (!native) return input.click();
    void window.showOpenFilePicker!({
        id: "docgeo",
        multiple: input.multiple,
        types: [
            {
                description: t("figure_formats"),
                accept: { [DGO]: [".dgo", ".dgp", ".ggb"] },
            },
        ],
    }).then(
        async (handles) =>
            open(
                await Promise.all(handles.map((from) => from.getFile())),
                handles[0],
            ),
        aborted,
    );
}

// Whether the figure `write` makes was saved, in its file or, if `as` or
// there is none yet, in the one the user chooses.
export async function saveFile(
    write: () => Promise<Blob>,
    as: boolean,
): Promise<boolean> {
    if (!native) {
        download(await write(), `${name}.dgo`);
        return true;
    }
    // Before the figure is written: a browser asks for permission or shows
    // the picker only right after a user gesture.
    let target = as ? null : handle;
    if (
        target &&
        (await target.requestPermission({ mode: "readwrite" })) !== "granted"
    )
        target = null;
    target ??= await window.showSaveFilePicker!({
        id: "docgeo",
        suggestedName: `${name}.dgo`,
        types: [{ description: "DocGeo (.dgo)", accept: { [DGO]: [".dgo"] } }],
    }).catch(aborted);
    if (!target) return false;
    // Written before the file is opened, which would otherwise be left
    // empty if the figure can't be.
    const blob = await write();
    const writable = await target.createWritable();
    await writable.write(blob);
    await writable.close();
    opened(target.name, target);
    return true;
}

function download(blob: Blob, file: string): void {
    const href = URL.createObjectURL(blob);
    (
        $.create("a")
            .att("href", href)
            .att("download", file)
            .dom() as HTMLAnchorElement
    ).click();
    setTimeout(() => URL.revokeObjectURL(href));
}

// A .dgo file other than the figure's, whose own stays.
export async function saveOther(
    write: () => Promise<Blob>,
    file: string,
): Promise<void> {
    if (!native) return download(await write(), file);
    const target = await window.showSaveFilePicker!({
        id: "docgeo",
        suggestedName: file,
        types: [{ description: "DocGeo (.dgo)", accept: { [DGO]: [".dgo"] } }],
    }).catch(aborted);
    if (!target) return;
    const blob = await write();
    const writable = await target.createWritable();
    await writable.write(blob);
    await writable.close();
}
