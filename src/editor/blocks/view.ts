import { $, type DOMElement } from "../../dom";
import { LANG } from "../../i18n";
import { parseProgram, type Program } from "../../import/dgp_formula";
import { ACTION_ICONS } from "../icons";
import { message } from "../messages";
import { formatName } from "../text";
import type { BlocksEditor, BlocksFigure } from "./workspace";

// An object's programs as blocks in the properties panel, each under its
// first block. Blockly, heavy, is loaded the first time, and its workspace
// kept: the panel, built again after each change, finds it as it was.

// One of the programs of an object, by its first block.
export interface ProgramHat {
    key: string;
    // "turtle", "program", or the gesture an event's answers ("change" for
    // an expression's value).
    kind: string;
    // The point a turtle starts from, the object an event answers.
    object: string;
}

export interface BlocksView {
    // The programs of the object, by their first block and their text: a
    // key "" for one to be created.
    programs: (ProgramHat & { source: string })[];
    // The one being edited, among them.
    key: string;
    degrees: boolean;
    figure: Pick<BlocksFigure, "objects" | "turtles" | "globals">;
    // The object, and the programs it can still have ("turtle", or a
    // gesture).
    owner: string;
    starts: string[];
    // The programs the blocks now write, by key.
    apply: (changes: [string, string][]) => void;
    // Another of the programs edited.
    open: (key: string) => void;
    // A program of the object to start from its first block.
    start: (kind: string) => void;
    // A program taken out, its first block deleted.
    remove: (key: string) => void;
    // The program edited has some part without a block.
    fallback: () => void;
}

const host = $.create("div").cls("dge-blocks");
// The button enlarging the blocks over the figure, or putting them back.
const resize = $.create("button").cls("dge-blocks-size").att("type", "button");
// Enlarged, the blocks are moved by their bar and sized by their corner.
const title = $.create("span").cls("dge-blocks-title");
const bar = $.create("div")
    .cls("dge-blocks-bar")
    .add(
        $.create("span")
            .cls("dge-blocks-mark")
            .att("aria-hidden", "true")
            .inner(
                `<svg viewBox="0 0 24 24">${ACTION_ICONS.new_program}</svg>`,
            ),
        title,
    );
const corner = $.create("div").cls("dge-blocks-corner");
const frame = $.create("div")
    .cls("dge-blocks-frame")
    .add(bar, host, resize, corner);
// In the panel while the blocks are enlarged.
let stand: DOMElement | null = null;
// The panel, built again, shows them still.
let claimed = false;
// The panels out of the way of the enlarged blocks, or back.
let panels = (_out: boolean, _duration: number) => {};
export const onEnlarge = (f: typeof panels) => (panels = f);
const ENLARGE =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>';
const SHRINK =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10h-6V4M4 14h6v6M14 10l7-7M10 14l-7 7"/></svg>';
let motion: Animation | null = null;
let closing = false;
resize.on("click", () => enlarge(!stand || closing, true), false);
enlarge(false);

// Where the enlarged blocks were left, and their size, for the session.
const BOUNDS = ["left", "top", "width", "height"].map(
    (side) => `--dge-blocks-${side}`,
);
function place(...values: number[]): void {
    BOUNDS.forEach((name, i) => frame.stl(name, `${Math.round(values[i])}px`));
}
// The frame and the pointer where the gesture began: the frame follows the
// pointer, even after a bound held it.
let start = [0, 0, 0, 0, 0, 0];
const grab = (event: PointerEvent) => {
    const { left, top, width, height } = frame.dom().getBoundingClientRect();
    start = [left, top, width, height, event.clientX, event.clientY];
};
bar.drag((event) => {
    const [left, top, width, height, x, y] = start;
    place(
        Math.min(
            Math.max(left + event.clientX - x, 60 - width),
            window.innerWidth - 60,
        ),
        Math.min(Math.max(top + event.clientY - y, 0), window.innerHeight - 40),
        width,
        height,
    );
}, grab);
bar.on("dblclick", () => BOUNDS.forEach((name) => frame.stl(name, "")));
corner.drag((event) => {
    const [left, top, width, height, x, y] = start;
    place(
        left,
        top,
        Math.max(width + event.clientX - x, 320),
        Math.max(height + event.clientY - y, 200),
    );
}, grab);

function enlarge(on: boolean, animate = false): void {
    motion?.cancel();
    motion = null;
    closing = false;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches
        ? 0
        : 180;
    if (!on && stand && animate && duration) {
        closing = true;
        motion = frame.dom().animate(
            [
                { opacity: 1, transform: "none" },
                { opacity: 0, transform: "translateY(6px)" },
            ],
            { duration: 120, easing: "cubic-bezier(0.4, 0, 1, 1)" },
        );
        motion.onfinish = () => {
            enlarge(false);
            motion = frame
                .dom()
                .animate([{ opacity: 0 }, { opacity: 1 }], { duration });
        };
        return;
    }
    if (on && !stand) {
        stand = $.create("p")
            .cls("dge-property-help")
            .text(message("blocks_enlarged"));
        frame.dom().replaceWith(stand.dom());
        $("body").add(frame);
        panels(true, duration);
    } else if (!on && stand) {
        if (stand.dom().isConnected) stand.dom().replaceWith(frame.dom());
        else frame.remove();
        stand = null;
        panels(false, duration);
    }
    const key = on ? "shrink_blocks" : "enlarge_blocks";
    frame.toggleClass("dge-blocks-large", on);
    resize
        .att("title", message(key))
        .att("aria-label", message(key))
        .inner(on ? SHRINK : ENLARGE);
    if (on && animate && duration)
        motion = frame.dom().animate(
            [
                { opacity: 0, transform: "translateY(8px)" },
                { opacity: 1, transform: "none" },
            ],
            { duration, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
        );
}

// Before the panel is built again: the blocks go back to it unless it
// shows them.
export function releaseBlocks(): void {
    claimed = false;
    queueMicrotask(() => {
        if (!claimed) enlarge(false);
    });
}

// Whether they were enlarged.
export function shrinkBlocks(): boolean {
    const enlarged = stand !== null;
    enlarge(false);
    return enlarged;
}

// A question Blockly asks: a text to type (`value`), or a confirmation.
// Null when cancelled.
function dialog(
    {
        text,
        value,
        ok,
        cancel,
    }: { text: string; value?: string; ok: string; cancel?: string },
    done: (answer: string | null) => void,
): void {
    const back = $.create("div").cls("dge-dialog-back");
    const form = $.create("form")
        .cls("dge-dialog")
        .att("role", "dialog")
        .att("aria-modal", "true")
        .add($.create("p").text(text));
    const input =
        value === undefined
            ? null
            : $.create("input").att("type", "text").att("spellcheck", "false");
    if (input) {
        (input.dom() as HTMLInputElement).value = value!;
        form.add(input);
    }
    const close = (answer: string | null) => {
        back.dispose();
        done(answer);
    };
    const actions = $.create("div").cls("dge-dialog-actions");
    if (cancel !== undefined) {
        const no = $.create("button").att("type", "button").text(cancel);
        no.on("click", () => close(null));
        actions.add(no);
    }
    const yes = $.create("button")
        .cls("dge-primary")
        .att("type", "submit")
        .text(ok);
    form.add(actions.add(yes));
    form.on("submit", () =>
        close(input ? (input.dom() as HTMLInputElement).value : ""),
    );
    form.on(
        "keydown",
        (event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            close(cancel === undefined ? "" : null);
        },
        false,
    );
    back.on(
        "pointerdown",
        (event) => {
            if (event.target === back.dom()) close(null);
        },
        false,
    );
    $("body").add(back.add(form));
    const focused = (input ?? yes).dom() as HTMLInputElement;
    focused.focus();
    if (input) focused.select();
}

let editor: Promise<BlocksEditor> | null = null;
let current: BlocksView;
// The programs whose blocks show, and those they can still have.
let shown = "";

const same = (a: string, b: string) =>
    a.replace(/\s+/g, "") === b.replace(/\s+/g, "");

export function blocksView(view: BlocksView) {
    current = view;
    claimed = true;
    title
        .inner("")
        .add(
            $.create("span").text(message("programs")),
            $.create("b").text(formatName(view.owner)),
        );
    editor ??= import("./workspace").then(({ blocksEditor }) =>
        blocksEditor(
            host.dom() as HTMLElement,
            {
                lang: LANG,
                format: formatName,
                objects: () => current.figure.objects(),
                turtles: () => current.figure.turtles(),
                globals: () => current.figure.globals(),
                dialog,
            },
            {
                changed: (changes) => current.apply(changes),
                open: (key) => current.open(key),
                start: (kind) => current.start(kind),
                removed: (key) => current.remove(key),
            },
        ),
    );
    void editor.then((blocks) => {
        if (current !== view) return;
        const programs = JSON.stringify([
            view.programs.map(({ key, kind, object }) => [key, kind, object]),
            view.starts,
            view.owner,
        ]);
        // Their own change, applied, or the program just created by them:
        // the blocks stay as they are, whichever is edited.
        const created = blocks.written.has("");
        const kept =
            (shown === programs || created) &&
            view.programs.every(({ key, source }) => {
                const written = blocks.written.get(created ? "" : key);
                return written === null || same(written ?? "", source);
            });
        shown = programs;
        if (kept) return blocks.resume();
        if (
            !blocks.load(
                view.programs.map((hat) => ({
                    hat,
                    program: parsed(hat.source),
                })),
                view.key,
                view.degrees,
                view.owner,
                view.starts,
            )
        ) {
            shown = "";
            view.fallback();
        }
    });
    return stand ?? frame;
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
