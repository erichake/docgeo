import { $, type DOMElement } from "../dom";
import {
    keepMyMacros,
    myMacros,
    pruned,
    shownMacros,
    type Library,
} from "./library";
import { nameProblem } from "./macro";
import { message } from "./messages";
import { formatName } from "./text";
import type { Macro } from "../objects/macro_object";
import { macroIcon, TOOL_FAMILIES } from "./tools";
import { choice, modal } from "./web_page";
import "./my_macros.css";

// The user's macros managed: renamed, put in folders, deleted (see
// MACROS.md, « Bibliothèque »).

const FOLDER = " / ";

// As in the tools menu.
export function macroBadge(macro: Macro): DOMElement {
    const family = TOOL_FAMILIES.at(-1)!;
    return $.create("span")
        .cls("dge-tool-icon")
        .stl("--dge-hue", `${family.hue}`)
        .stl("--dge-tone", `${family.tone}`)
        .append(
            `<svg viewBox="0 0 24 24" aria-hidden="true">${macroIcon(macro)}</svg>`,
        );
}

export function manageMyMacros(options: {
    supplied: () => Library;
    importMacros: () => void;
    exportMacros: () => void;
}): void {
    let library = myMacros();
    const list = $.create("div").cls("dge-my-macros");
    const problem = $.create("p").cls("dge-dialog-error").hide();
    const folders = $.create("datalist").att("id", "dge-macro-folders");
    const exporting = choice("export_my_macros").att("type", "button");

    const change = (next: Library): void => {
        library = next;
        void keepMyMacros(library);
        show();
    };
    const refuse = (text: string): void => void problem.text(text).show();

    function rename(index: number, field: HTMLInputElement): void {
        const name = field.value.trim();
        const { macros } = library;
        const why =
            nameProblem(name) ??
            ([...macros, ...options.supplied().macros].some(
                (other) => other.name === name && other !== macros[index],
            )
                ? message("macro_name_taken", formatName(name))
                : null);
        if (why) {
            field.value = macros[index].name;
            return refuse(why);
        }
        const renamed = [...macros];
        renamed[index] = { ...macros[index], name };
        change({ ...library, macros: renamed });
    }

    function move(index: number, path: string): void {
        const folders = [...library.folders];
        folders[index] = path
            .split("/")
            .map((name) => name.trim())
            .filter(Boolean);
        change({ ...library, folders });
    }

    // Not while another applies it.
    function remove(index: number): void {
        const { macros } = library;
        const users = macros.filter(({ methods }) =>
            methods.some(({ body }) =>
                body.some(
                    ([tag, , parameters]) =>
                        tag === "Mac" && (parameters as number[])[0] === index,
                ),
            ),
        );
        if (users.length)
            return refuse(
                message(
                    "macro_used_by",
                    users.map(({ name }) => formatName(name)).join(", "),
                ),
            );
        change(
            pruned(
                library,
                shownMacros(library, options.supplied())
                    .filter((shown) => shown !== index)
                    .map((shown) => macros[shown].name),
            ),
        );
    }

    function row(index: number): DOMElement {
        const macro = library.macros[index];
        const name = $.create("input")
            .att("type", "text")
            .att("spellcheck", "false")
            .att("aria-label", message("macro_name"))
            .att("value", macro.name);
        name.on(
            "change",
            () => rename(index, name.dom() as HTMLInputElement),
            false,
        );
        const folder = $.create("input")
            .att("type", "text")
            .att("list", "dge-macro-folders")
            .att("placeholder", message("macro_folder_placeholder"))
            .att("aria-label", message("macro_folder"))
            .att("value", library.folders[index].join(FOLDER));
        folder.on(
            "change",
            () => move(index, (folder.dom() as HTMLInputElement).value),
            false,
        );
        const removal = $.create("button")
            .att("type", "button")
            .cls("dge-my-macro-remove")
            .att("aria-label", message("delete"))
            .att("title", message("delete"))
            .text("×");
        removal.on("click", () => remove(index), false);
        return $.create("div")
            .cls("dge-my-macro")
            .add(macroBadge(macro), name, folder, removal);
    }

    // By folder, each after the macros of the one it is in.
    function show(): void {
        problem.hide();
        const shown = shownMacros(library, options.supplied());
        const paths = [
            ...new Set(
                shown.map((index) => library.folders[index].join(FOLDER)),
            ),
        ];
        folders.inner("");
        paths
            .filter(Boolean)
            .forEach((path) =>
                folders.add($.create("option").att("value", path)),
            );
        list.inner("");
        if (!shown.length)
            list.add(
                $.create("p")
                    .cls("dge-dialog-note")
                    .text(message("my_macros_empty")),
            );
        [...paths].sort().forEach((path) => {
            if (path) list.add($.create("h3").att("dir", "auto").text(path));
            shown
                .filter((index) => library.folders[index].join(FOLDER) === path)
                .forEach((index) => list.add(row(index)));
        });
        (exporting.dom() as HTMLButtonElement).disabled = !shown.length;
    }

    const importing = choice("import_macros").att("type", "button");
    const close = choice("close", true).att("type", "button");
    const element = modal(
        message("my_macros"),
        $.create("p").cls("dge-dialog-note").text(message("my_macros_note")),
        list,
        folders,
        problem,
        $.create("div")
            .cls("dge-dialog-buttons")
            .add(importing, exporting, close),
    );
    element.classList.add("dge-my-macros-dialog");
    importing.on(
        "click",
        () => {
            element.close();
            options.importMacros();
        },
        false,
    );
    exporting.on(
        "click",
        () => {
            element.close();
            options.exportMacros();
        },
        false,
    );
    close.on("click", () => element.close(), false);
    show();
}
