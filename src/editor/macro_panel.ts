import type { construction } from "../construction";
import { figureObjects } from "../dgo";
import { $, type DOMElement } from "../dom";
import { DIR } from "../i18n";
import type { construction_object } from "../objects/construction_object";
import {
    analyse,
    finalsOf,
    initialType,
    macroName,
    methodOf,
    missing,
    save,
    savingOf,
} from "./macro";
import { isCommand } from "./catalog";
import { message, type MessageKey } from "./messages";
import { formatName } from "./text";
import "./macro.css";

// The panel of a macro being defined, by direct manipulation of the
// figure: see MACROS.md.

// How an object of the figure shows: an initial, a final chosen, an
// object the initials determine, or one a final misses.
export type MacroState = "initial" | "final" | "possible" | "missing";

// The icon, in pixels.
const ICON_SIZE = 16;

export function macroPanel(options: {
    scene: () => construction;
    show: (states: Map<construction_object, MacroState>) => void;
    hint: (text: string) => void;
    // A macro saved: a step to undo.
    saved: () => void;
    close: () => void;
}) {
    let active = false;
    // The initials designated first, then the finals among what they
    // determine.
    let step: 1 | 2 = 1;
    // By name, the figure being rebuilt by undo and redo.
    let initials: string[] = [];
    let finals: string[] = [];
    const messages = new Map<string, string>();
    const finalNames = new Map<string, string>();
    // What the save button does, when it can.
    let saving: (() => void) | null = null;
    // Said once saved, until the next change.
    let notice = "";

    const field = (element: DOMElement) => element.dom() as HTMLInputElement;
    const section = (title: MessageKey, ...content: DOMElement[]) =>
        $.create("section")
            .cls("dge-macro-section")
            .add($.create("h3").text(message(title)), ...content);
    const removal = (remove: () => void) => {
        const button = $.create("button")
            .cls("dge-macro-remove")
            .att("type", "button")
            .att("aria-label", message("macro_remove"))
            .att("title", message("macro_remove"))
            .text("×");
        button.on("click", () => {
            remove();
            changed();
        });
        return button;
    };
    const swatch = (object: construction_object) =>
        $.create("span")
            .cls("dge-swatch")
            .stl("background", object.stroke_color);

    const close = $.create("button")
        .cls("dge-action")
        .att("type", "button")
        .att("aria-label", message("done"))
        .att("title", message("done"))
        .append(
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>',
        );
    close.on("click", () => options.close());
    const nameInput = $.create("input")
        .att("type", "text")
        .att("spellcheck", "false")
        .att("aria-label", message("macro_name"));
    nameInput.on("input", () => changed(), false);
    const stepText = $.create("p").cls("dge-macro-step");
    const initialsBox = $.create("ol").cls("dge-macro-list");
    const finalsBox = $.create("ol").cls("dge-macro-list");
    const implicit = $.create("p")
        .cls("dge-macro-note")
        .text(message("macro_implicit"));
    // Shown at the second step.
    const finalsSection = section("macro_finals", finalsBox, implicit);
    const help = $.create("textarea")
        .att("rows", "3")
        .att("placeholder", message("macro_help_placeholder"))
        .att("aria-label", message("macro_help"));
    const canvas = $.create("canvas")
        .cls("dge-macro-icon")
        .att("width", ICON_SIZE)
        .att("height", ICON_SIZE)
        .att("aria-label", message("macro_icon"));
    const pen = (canvas.dom() as HTMLCanvasElement).getContext("2d", {
        willReadFrequently: true,
    })!;
    const clear = $.create("button")
        .att("type", "button")
        .text(message("macro_clear_icon"));
    clear.on("click", () => pen.clearRect(0, 0, ICON_SIZE, ICON_SIZE));
    const status = $.create("p").cls("dge-macro-status").att("role", "status");
    const saveButton = $.create("button")
        .cls("dge-macro-save")
        .att("type", "button");
    saveButton.on("click", () => saving?.());
    const nextButton = $.create("button")
        .cls("dge-macro-save")
        .att("type", "button")
        .text(message("macro_next"));
    nextButton.on("click", () => goTo(2));
    const backButton = $.create("button")
        .cls("dge-macro-back")
        .att("type", "button")
        .text(message("macro_back"));
    backButton.on("click", () => goTo(1));

    const panel = $.create("aside")
        .cls("dge-macro")
        .att("dir", DIR)
        .att("aria-label", message("new_macro"))
        .add(
            $.create("div")
                .cls("dge-panel-header")
                .add($.create("h2").text(message("new_macro")), close),
            $.create("label")
                .cls("dge-macro-field")
                .add($.create("span").text(message("macro_name")), nameInput),
            stepText,
            section("macro_initials", initialsBox),
            finalsSection,
            section("macro_help", help),
            section(
                "macro_icon",
                $.create("div").cls("dge-macro-drawing").add(canvas, clear),
            ),
            $.create("div")
                .cls("dge-macro-footer")
                .add(status, nextButton, saveButton, backButton),
        )
        .hide();

    // The initials reordered by their handles.
    let dragged: DOMElement | null = null;
    initialsBox.drag(
        (event) => {
            const rows = [...initialsBox.dom().children].filter(
                (row) => row !== dragged!.dom(),
            );
            const before = rows.find((row) => {
                const box = row.getBoundingClientRect();
                return event.clientY < box.top + box.height / 2;
            });
            initialsBox.dom().insertBefore(dragged!.dom(), before ?? null);
        },
        (event) => {
            const handle = (event.target as Element).closest(
                ".dge-macro-handle",
            );
            if (!handle) return false;
            dragged = $(handle.closest("li")!).addClass("dge-dragging");
        },
        () => {
            initials = [...initialsBox.dom().children].map((row) =>
                row.getAttribute("data-name")!,
            );
            dragged = null;
            changed();
        },
    );

    // The icon drawn pixel by pixel, a stroke erasing if it starts on one.
    let inking = true;
    const pixel = (event: PointerEvent): [number, number] => {
        const box = canvas.dom().getBoundingClientRect();
        return [
            Math.floor(((event.clientX - box.left) / box.width) * ICON_SIZE),
            Math.floor(((event.clientY - box.top) / box.height) * ICON_SIZE),
        ];
    };
    const ink = (event: PointerEvent) => {
        const [x, y] = pixel(event);
        if (inking) pen.fillRect(x, y, 1, 1);
        else pen.clearRect(x, y, 1, 1);
    };
    pen.fillStyle = "#1f2937";
    canvas.drag(ink, (event) => {
        const [x, y] = pixel(event);
        inking = pen.getImageData(x, y, 1, 1).data[3] === 0;
        ink(event);
    });
    const icon = (): string | null =>
        pen
            .getImageData(0, 0, ICON_SIZE, ICON_SIZE)
            .data.some((value, index) => index % 4 === 3 && value > 0)
            ? (canvas.dom() as HTMLCanvasElement).toDataURL("image/png")
            : null;

    function changed(): void {
        notice = "";
        render();
    }

    const hint = (): string =>
        message(step === 1 ? "macro_step_initials" : "macro_step_finals");

    function goTo(next: 1 | 2): void {
        step = next;
        changed();
        options.hint(hint());
    }

    function render(): void {
        if (!active) return;
        const c = options.scene();
        initials = initials.filter((name) => c.getObj(name));
        finals = finals.filter((name) => c.getObj(name));
        const given = initials.map((name) => c.getObj(name)!);
        const chosen = finals.map((name) => c.getObj(name)!);
        const analysis = analyse(c, given);
        const shown = finalsOf(c, analysis, chosen);

        initialsBox.inner("");
        given.forEach((object, index) => {
            const input = $.create("input")
                .att("type", "text")
                .att(
                    "placeholder",
                    message(`designate_${initialType(object)!}` as MessageKey),
                )
                .att("aria-label", message("macro_message"));
            field(input).value = messages.get(object.name) ?? "";
            input.on(
                "input",
                () => messages.set(object.name, field(input).value),
                false,
            );
            initialsBox.add(
                $.create("li")
                    .att("data-name", object.name)
                    .add(
                        $.create("span")
                            .cls("dge-macro-handle")
                            .att("title", message("macro_drag"))
                            .text(String(index + 1)),
                        swatch(object),
                        $.create("span")
                            .cls("dge-macro-object")
                            .text(formatName(object.name)),
                        input,
                        removal(() => {
                            initials = initials.filter(
                                (name) => name !== object.name,
                            );
                        }),
                    ),
            );
        });
        if (!given.length)
            initialsBox.add(
                $.create("li")
                    .cls("dge-macro-note")
                    .text(message("macro_need_initial")),
            );

        const lacking = new Map(
            shown.map((object) => [
                object,
                analysis.determined(object) ? [] : missing(analysis, object),
            ]),
        );
        finalsBox.inner("");
        shown.forEach((object) => {
            const input = $.create("input")
                .att("type", "text")
                .att("spellcheck", "false")
                .att("aria-label", message("macro_name"));
            field(input).value = finalNames.get(object.name) ?? object.name;
            input.on(
                "input",
                () => finalNames.set(object.name, field(input).value),
                false,
            );
            const row = $.create("li").add(
                swatch(object),
                $.create("span")
                    .cls("dge-macro-object")
                    .text(formatName(object.name)),
                input,
            );
            if (chosen.includes(object))
                row.add(
                    removal(() => {
                        finals = finals.filter((name) => name !== object.name);
                    }),
                );
            if (!analysis.determined(object))
                row.addClass("dge-macro-bad").add(
                    $.create("small").text(
                        message(
                            "macro_missing",
                            lacking
                                .get(object)!
                                .map(({ name }) => formatName(name))
                                .join(", "),
                        ),
                    ),
                );
            finalsBox.add(row);
        });
        if (chosen.length || !shown.length) implicit.hide();
        else implicit.show();

        const name = field(nameInput).value.trim();
        saving = null;
        let problem = "";
        if (!given.length) problem = message("macro_need_initial");
        else if (step === 1) problem = "";
        else if (!shown.length) problem = message("macro_need_final");
        else if (shown.some((object) => !analysis.determined(object)))
            problem = message(
                "macro_missing",
                [...new Set([...lacking.values()].flat())]
                    .map(({ name }) => formatName(name))
                    .join(", "),
            );
        let label = message("macro_create");
        // Typed as a command.
        if (!problem && !/^[\p{L}_][\p{L}\p{N}_]*$/u.test(name))
            problem = message("macro_bad_name");
        if (!problem && isCommand(name))
            problem = message("macro_command_name", name);
        if (!problem) {
            const method = methodOf(
                c,
                given,
                shown,
                given.map((object) => messages.get(object.name) ?? ""),
                field(help).value,
            );
            const plan = savingOf(c.macros, name, method);
            const named = formatName(name);
            if (plan.kind === "add") label = message("macro_add", named);
            if (plan.kind === "replace")
                label = message("macro_replace", named);
            if (plan.kind === "finals")
                problem = message("macro_other_finals", named);
            if (plan.kind === "ambiguous")
                problem = message("macro_ambiguous", named);
            if (plan.kind === "later") problem = message("macro_later", named);
            if (!problem)
                saving = () => {
                    save(
                        c,
                        plan,
                        name,
                        shown.map(
                            (object) =>
                                finalNames.get(object.name)?.trim() ||
                                object.name,
                        ),
                        icon(),
                        methodOf(
                            c,
                            given,
                            shown,
                            given.map(
                                (object) => messages.get(object.name) ?? "",
                            ),
                            field(help).value,
                        ),
                    );
                    options.saved();
                    notice = message("macro_saved", named);
                    render();
                };
        }
        if (step === 1) saving = null;
        status
            .text(step === 1 ? "" : problem || notice)
            .toggleClass("dge-error", !!problem);
        stepText.text(hint());
        if (step === 1) finalsSection.hide();
        else finalsSection.show();
        saveButton.text(label);
        saveButton.dom().toggleAttribute("disabled", !saving);
        nextButton.dom().toggleAttribute("disabled", !given.length);
        [nextButton, saveButton, backButton].forEach((button) => button.hide());
        (step === 1 ? [nextButton] : [saveButton, backButton]).forEach(
            (button) => button.show(),
        );

        const states = new Map<construction_object, MacroState>();
        figureObjects(c).forEach((object) => {
            if (
                analysis.determined(object) &&
                !analysis.given.has(object) &&
                !chosen.includes(object)
            )
                states.set(object, "possible");
        });
        lacking.forEach((objects) =>
            objects.forEach((object) => states.set(object, "missing")),
        );
        chosen.forEach((object) => states.set(object, "final"));
        given.forEach((object) => states.set(object, "initial"));
        options.show(states);
    }

    return {
        panel,
        get active(): boolean {
            return active;
        },
        // Defining a new macro, from these initials.
        start(objects: construction_object[]): void {
            const c = options.scene();
            active = true;
            step = 1;
            initials = objects.map(({ name }) => name);
            finals = [];
            messages.clear();
            finalNames.clear();
            notice = "";
            field(nameInput).value = macroName(c, "Macro");
            field(help).value = "";
            pen.clearRect(0, 0, ICON_SIZE, ICON_SIZE);
            panel.show("flex");
            render();
            options.hint(hint());
        },
        // What the step asks for.
        get hint(): string {
            return hint();
        },
        stop(): void {
            if (!active) return;
            active = false;
            panel.hide();
            options.show(new Map());
        },
        // A tap on the object: an initial at the first step, a final among
        // what they determine at the second, or neither again.
        tap(object: construction_object): void {
            const c = options.scene();
            const { name } = object;
            options.hint(hint());
            if (step === 1) {
                if (initials.includes(name))
                    initials = initials.filter((other) => other !== name);
                else if (!initialType(object))
                    return options.hint(
                        message("macro_not_initial", formatName(name)),
                    );
                else {
                    finals = finals.filter((other) => other !== name);
                    initials.push(name);
                }
                return changed();
            }
            if (finals.includes(name))
                finals = finals.filter((other) => other !== name);
            else {
                const analysis = analyse(
                    c,
                    initials.map((other) => c.getObj(other)!),
                );
                if (analysis.given.has(object)) return;
                if (!analysis.determined(object))
                    return options.hint(
                        message(
                            "macro_missing",
                            missing(analysis, object)
                                .map(({ name }) => formatName(name))
                                .join(", "),
                        ),
                    );
                finals.push(name);
            }
            changed();
        },
        // The figure changed, or was rebuilt.
        refresh: render,
    };
}
