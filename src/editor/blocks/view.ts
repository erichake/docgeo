import { $ } from "../../dom";
import { LANG } from "../../i18n";
import { parseProgram, type Program } from "../../import/dgp_formula";
import { formatName } from "../text";
import type { BlocksEditor, BlocksFigure } from "./workspace";

// A program's blocks in the properties panel. Blockly, heavy, is loaded the
// first time, and its workspace kept: the panel, built again after each
// change, finds it as it was.

export interface BlocksView {
    // The program's name, "" for one to be created.
    key: string;
    source: string;
    degrees: boolean;
    figure: Pick<BlocksFigure, "objects" | "turtles" | "globals">;
    // The program the blocks now write.
    apply: (source: string) => void;
    // The program has some part without a block.
    fallback: () => void;
}

const host = $.create("div").cls("dge-blocks");
let editor: Promise<BlocksEditor> | null = null;
let current: BlocksView;
// The program whose blocks show.
let shown: string | null = null;

const same = (a: string, b: string) =>
    a.replace(/\s+/g, "") === b.replace(/\s+/g, "");

export function blocksView(view: BlocksView) {
    current = view;
    editor ??= import("./workspace").then(({ blocksEditor }) =>
        blocksEditor(
            host.dom() as HTMLElement,
            {
                lang: LANG,
                format: formatName,
                objects: () => current.figure.objects(),
                turtles: () => current.figure.turtles(),
                globals: () => current.figure.globals(),
            },
            (source) => current.apply(source),
        ),
    );
    void editor.then((blocks) => {
        if (current !== view) return;
        // Its own change, applied, or the program just created by it.
        const kept =
            (shown === view.key || shown === "") &&
            same(blocks.written, view.source);
        shown = view.key;
        if (kept) return blocks.resume();
        const program = parsed(view.source);
        if (!program || !blocks.load(program, view.degrees)) {
            shown = null;
            view.fallback();
        }
    });
    return host;
}

// Null for a text the grammar doesn't read, shown as text with its error.
function parsed(source: string): Program | null {
    try {
        return parseProgram(source);
    } catch {
        return null;
    }
}

export const isTurtle = (source: string) => /\bTURTLE_INIT\s*\(/.test(source);
