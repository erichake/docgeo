import type { construction } from "../construction";
import type { DgoFigure, Region, Workbook } from "../dgo";
import { $, type DOMElement } from "../dom";
import { frameRegion, hideFrame, showFrame } from "../frame";
import { message, type MessageKey } from "./messages";
import "./web_page.css";

// The figure embedded in a web page, from its published file: see EDITOR.md.

const ICONS = {
    code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    options:
        '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
};
const icon = (body: string) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

// Kept for the session.
const options = { center: true, border: true, bar: true, edit: true };

// Also the editor's other dialogs.
export function modal(
    title: string,
    ...children: DOMElement[]
): HTMLDialogElement {
    const dialog = $.create("dialog")
        .cls("dge-dialog")
        .add($.create("h2").text(title), ...children);
    const element = dialog.dom() as HTMLDialogElement;
    dialog.on("close", () => dialog.dispose(), false);
    dialog.on("keydown", (event) => event.stopPropagation(), false);
    $("body").add(dialog);
    element.showModal();
    return element;
}

export const choice = (key: MessageKey, primary = false) =>
    $.create("button")
        .cls(primary ? "dge-done" : "dge-secondary")
        .att("value", key)
        .text(message(key));

// Asks for the link of the published figure, which `open` opens, the
// dialog staying open while the link fails.
export function askLink(note: string, open: (url: string) => Promise<void>) {
    const input = $.create("input")
        .att("type", "url")
        .att("required", "")
        .att("spellcheck", "false")
        .att("placeholder", "https://…");
    const error = $.create("p").cls("dge-dialog-error").hide();
    const submit = choice("open", true).att("type", "submit");
    const cancel = choice("dismiss").att("type", "button");
    const form = $.create("form").add(
        $.create("p").text(message("embed_publish")),
        input,
        $.create("p").cls("dge-dialog-note").text(note),
        error,
        $.create("div").cls("dge-dialog-buttons").add(cancel, submit),
    );
    const element = modal(message("embed_page"), form);
    cancel.on("click", () => element.close(), false);
    form.on("submit", async () => {
        const button = submit.dom() as HTMLButtonElement;
        button.disabled = true;
        try {
            await open((input.dom() as HTMLInputElement).value.trim());
            element.close();
        } catch (failure) {
            error
                .text(message("embed_failed", (failure as Error).message))
                .show();
        }
        button.disabled = false;
    });
}

export function confirmed(
    text: string,
    title = message("embed_page"),
    go: MessageKey = "go_on",
): Promise<boolean> {
    return new Promise((resolve) => {
        const element = modal(
            title,
            $.create("form")
                .att("method", "dialog")
                .add(
                    $.create("p").text(text),
                    $.create("div")
                        .cls("dge-dialog-buttons")
                        .add(choice("dismiss"), choice(go, true)),
                ),
        );
        element.addEventListener("close", () =>
            resolve(element.returnValue === go),
        );
    });
}

const fixed = (value: number, digits: number) => Number(value.toFixed(digits));

// A view as the editor shows it: origin, unit and, in 3D, camera's angles.
const view = (
    [ox, oy]: readonly number[],
    unit: number,
    angles: number[] | null,
): number[] => [
    fixed(ox, 2),
    fixed(oy, 2),
    Number(unit.toPrecision(8)),
    ...(angles ? angles.map((angle) => fixed(angle, 5)) : []),
];

// That of a page of the workbook, as readDgo shows it in the window.
function pageView(c: construction, { v }: DgoFigure): number[] {
    const [x, y] = v.o as number[];
    const space = v["3d"] === 1;
    const [width, height] = c.windowSize;
    const [w, h] = [v.w as number, v.h as number];
    return view(
        space && !v.f2 ? [x + (width - w) / 2, y + (height - h) / 2] : [x, y],
        v.u as number,
        space && v.th !== undefined ? [v.th as number, v.ph as number] : null,
    );
}

// The iframe showing the region of the figure as its window shows it, with
// the view it's framed in, then that of each other page of its workbook
// (see fit.ts).
function embedCode(
    c: construction,
    book: Workbook | null,
    region: Region,
    url: string,
): string {
    const { x, y, w, h } = region;
    const grid = c.GRID;
    const shown = view(
        grid.ORG,
        grid.UNIT[0],
        grid.is2D ? null : [grid.THETA, grid.PHI],
    );
    const views = book
        ? book.pages.map(({ figure }, index) =>
              index === book.current ? shown : pageView(c, figure),
          )
        : [shown];
    const fit = [w, h, x, y, ...views[0]].join(",");
    const reader = new URL("index.html", location.href).href;
    const src = `${reader}?fit=${[fit, ...views.slice(1)].join(";")}${options.bar ? "" : "&nobar"}${options.edit ? "" : "&noedit"}&url=${url}`;
    // Its width first, the only number to change for another size: the
    // height follows, in the frame's proportions.
    const style = `width:${w}px;max-width:100%;aspect-ratio:${w}/${h};border:${options.border ? "1px solid #ccc" : "0"}`;
    const code = `<iframe src="${src.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" style="${style}" allow="fullscreen" loading="lazy"></iframe>`;
    return options.center ? `<center>${code}</center>` : code;
}

// The bar's banner while the figure is framed, `url` that of its file.
export function framingBar(
    scene: () => construction,
    book: () => Workbook | null,
    url: () => string,
    hint: (text: string, error?: boolean) => void,
    done: () => void,
) {
    const card = $.create("div").cls("dge-embed-options").hide();
    const checks = (
        [
            ["center", "embed_center"],
            ["border", "embed_border"],
            ["bar", "embed_bar"],
            ["edit", "embed_edit"],
        ] as const
    ).map(([option, key]) => {
        const box = $.create("input").att("type", "checkbox");
        const input = box.dom() as HTMLInputElement;
        input.checked = options[option];
        box.on(
            "change",
            () => {
                options[option] = input.checked;
                (checks[3].dom() as HTMLInputElement).disabled = !options.bar;
            },
            false,
        );
        card.add(
            $.create("label").add(box, $.create("span").text(message(key))),
        );
        return box;
    });
    (checks[3].dom() as HTMLInputElement).disabled = !options.bar;

    const optionsButton = $.create("button")
        .cls("dge-action")
        .att("type", "button")
        .att("title", message("embed_options"))
        .att("aria-label", message("embed_options"))
        .att("aria-expanded", "false")
        .append(icon(ICONS.options));
    optionsButton.on(
        "click",
        () => {
            const open = card.isHidden();
            optionsButton.att("aria-expanded", String(open));
            if (!open) return void card.hide();
            const { bottom, left } = optionsButton
                .dom()
                .getBoundingClientRect();
            card.stl("top", `${bottom + 8}px`)
                .stl("left", `${left}px`)
                .show("flex");
        },
        false,
    );
    const copy = $.create("button")
        .cls("dge-done")
        .att("type", "button")
        .text(message("copy_code"));
    copy.on(
        "click",
        () =>
            void navigator.clipboard
                .writeText(embedCode(scene(), book(), frameRegion()!, url()))
                .then(
                    () => hint(message("code_copied")),
                    (error: Error) => hint(error.message, true),
                ),
        false,
    );
    const finish = $.create("button")
        .cls("dge-secondary")
        .att("type", "button")
        .text(message("done"));
    finish.on("click", done, false);
    const bar = $.create("div")
        .cls("dge-bar-group dge-bar-object dge-embed")
        .att("role", "group")
        .att("aria-label", message("embed_page"))
        .add(
            $.create("span")
                .cls("dge-bar-name")
                .append(icon(ICONS.code))
                .add($.create("span").text(message("embed_page"))),
            optionsButton,
            copy,
            finish,
        )
        .hide();
    return {
        elements: [bar, card],
        get shown() {
            return !bar.isHidden();
        },
        // The frame first takes most of the figure.
        start() {
            const c = scene();
            showFrame(
                Math.round(c.width * 0.8),
                Math.round(c.height * 0.8),
                () => {},
            );
            bar.show("flex");
            $("body").addClass("dge-embedding");
            hint(message("embed_hint"));
        },
        stop() {
            hideFrame();
            bar.hide();
            card.hide();
            optionsButton.att("aria-expanded", "false");
            $("body").removeClass("dge-embedding");
            hint("");
        },
    };
}
