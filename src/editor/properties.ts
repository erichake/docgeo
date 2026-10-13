import type { construction } from "../construction";
import type { Animation } from "../animation";
import { figureObjects } from "../dgo";
import { $, type DOMElement } from "../dom";
import { DIR } from "../i18n";
import { angle_object, RIGHT_ANGLE_MARKS } from "../objects/angle_object";
import type { construction_object } from "../objects/construction_object";
import { expression_object } from "../objects/expression_object";
import { expression_list_object } from "../objects/expression_list_object";
import { fixed_angle_object } from "../objects/fixed_angle_object";
import { list_object } from "../objects/list_object";
import { locus_object } from "../objects/locus_object";
import { point_object } from "../objects/point_object";
import { point_on_object } from "../objects/point_on_object";
import { polygon_object } from "../objects/polygon_object";
import { segment_object } from "../objects/segment_object";
import { expressionSource } from "./figure";
import { message, type MessageKey } from "./messages";
import { scrubNumber } from "./scrub";
import { formatProgram, syntaxLine, TextError } from "./text";

type Field = HTMLInputElement | HTMLSelectElement;

const PROGRAM_PLACEHOLDER =
    "var t = [];\nfor (var i = 0; i < 10; i++) {\n    t.push([i, 0]);\n}\nt";

export function propertiesPanel(options: {
    scene: () => construction;
    changed: () => void;
    rename: (object: construction_object, name: string) => Promise<void>;
    // Throws a TextError where the text is wrong.
    define: (object: expression_object, source: string) => Promise<void>;
    // A new expression, given a name or not.
    create: (name: string, source: string) => Promise<void>;
    close: () => void;
}) {
    const panel = $.create("aside")
        .cls("dge-properties")
        .att("dir", DIR)
        .att("id", "dge-properties")
        .att("aria-label", message("properties"));
    const close = $.create("button")
        .cls("dge-action")
        .att("type", "button")
        .att("aria-label", message("close_properties"))
        .att("title", message("close_properties"))
        .append(
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>',
        );
    close.on("click", options.close);
    const picker = $.create("select").att("aria-label", message("object"));
    const content = $.create("div").cls("dge-property-content");
    panel.add(
        $.create("div")
            .cls("dge-panel-header")
            .add($.create("h2").text(message("properties")), close),
        $.create("div").cls("dge-property-picker").add(picker),
        content,
    );
    let adjusting = 0;
    let selected: construction_object | null = null;
    let all = false;
    const fields: DOMElement[] = [];
    const objects = () =>
        figureObjects(options.scene()).filter(({ hidden }) => hidden !== 2);
    picker.on(
        "change",
        () =>
            select(
                options.scene().getObj((picker.dom() as Field).value) ?? null,
            ),
        false,
    );
    panel.on(
        "keydown",
        (event) => {
            if (event.key === "Escape") {
                event.stopPropagation();
                options.close();
            } else if (!event.metaKey && !event.ctrlKey) {
                event.stopPropagation();
                if (
                    event.key === "Enter" &&
                    event.target instanceof HTMLInputElement &&
                    ["text", "number"].includes(event.target.type)
                ) {
                    event.preventDefault();
                    event.target.blur();
                }
            }
        },
        false,
    );

    // Wider for a formula's lines.
    function clear(object: construction_object | null, wide: boolean): void {
        selected?.dom?.removeClass("dge-property-selected");
        selected = object;
        selected?.dom?.addClass("dge-property-selected");
        fields.splice(0).forEach((field) => field.dispose());
        content.inner("");
        $("body").toggleClass("dge-properties-wide", wide);
        refreshPicker();
    }

    function select(object: construction_object | null): void {
        clear(
            object,
            object instanceof expression_object &&
                !!(object.formula || object.program),
        );
        if (!object) {
            content.add(
                $.create("p")
                    .cls("dge-property-help")
                    .text(message("properties_hint")),
            );
            return;
        }
        build(object);
    }

    function refreshPicker(): void {
        picker.inner("");
        picker.add(
            $.create("option").att("value", "").text(message("choose_object")),
        );
        objects().forEach((candidate) =>
            picker.add(
                $.create("option")
                    .att("value", candidate.name)
                    .text(candidate.name),
            ),
        );
        (picker.dom() as Field).value = selected?.name ?? "";
    }

    function row(
        section: DOMElement,
        key: MessageKey,
        field: DOMElement,
    ): void {
        fields.push(field);
        section.add(
            $.create("label")
                .cls("dge-property-row")
                .add(
                    $.create("span").text(
                        message(key) +
                            (key === "stroke_opacity" || key === "fill_opacity"
                                ? " (%)"
                                : ""),
                    ),
                    field.att("aria-label", message(key)),
                ),
        );
    }

    function section(key: MessageKey): DOMElement {
        const box = $.create("section").cls("dge-property-section");
        content.add(box.add($.create("h3").text(message(key))));
        return box;
    }

    function apply(change: (object: construction_object) => void): void {
        const targets = all
            ? objects().filter((object) => object.class === selected!.class)
            : [selected!];
        targets.forEach((object) => {
            change(object);
            // Traces live outside the object's SVG group.
            const trace =
                object instanceof point_object
                    ? object.tracePath?.getAtt("d")
                    : null;
            if (object instanceof point_object) {
                object.tracePath?.dispose();
                object.tracePath = undefined;
            }
            if (object.isHidden) object.updateView();
            else object.createSVG();
            if (trace && object instanceof point_object)
                object.tracePath?.att("d", trace);
            if (
                object instanceof locus_object ||
                object instanceof expression_list_object
            )
                object.C.invalidateGeometry(object);
        });
        const c = options.scene();
        c.invalidateProjection();
        c.flush();
        selected?.dom?.addClass("dge-property-selected");
        // The object shows bare while it is being adjusted.
        $("body").addClass("dge-adjusting");
        clearTimeout(adjusting);
        adjusting = window.setTimeout(
            () => $("body").removeClass("dge-adjusting"),
            700,
        );
    }

    function check(
        box: DOMElement,
        key: MessageKey,
        value: boolean,
        change: (object: construction_object, value: boolean) => void,
    ): void {
        const field = $.create("input").att("type", "checkbox");
        (field.dom() as HTMLInputElement).checked = value;
        row(box, key, field);
        field.on(
            "change",
            () => {
                apply((object) =>
                    change(object, (field.dom() as HTMLInputElement).checked),
                );
                options.changed();
            },
            false,
        );
    }

    function number(
        box: DOMElement,
        key: MessageKey,
        value: number,
        min: number,
        max: number,
        step: number,
        change: (object: construction_object, value: number) => void,
    ): void {
        const field = $.create("input")
            .att("type", "number")
            .att("title", message("scrub_hint"))
            .att("min", min)
            .att("max", max)
            .att("step", step);
        const input = field.dom() as HTMLInputElement;
        input.value = String(value);
        row(box, key, field);
        scrubNumber(
            field,
            (next) => {
                value = next;
                input.value = String(value);
                apply((object) => change(object, value));
            },
            options.changed,
        );
        field.on(
            "input",
            () => {
                if (input.value !== "" && input.validity.valid) {
                    value = input.valueAsNumber;
                    apply((object) => change(object, value));
                }
            },
            false,
        );
        field.on(
            "change",
            () => {
                if (input.value === "" || !input.validity.valid)
                    input.value = String(value);
                else value = input.valueAsNumber;
                options.changed();
            },
            false,
        );
    }

    function color(
        box: DOMElement,
        key: MessageKey,
        value: string,
        change: (object: construction_object, value: string) => void,
    ): void {
        const field = $.create("input").att("type", "color");
        const input = field.dom() as HTMLInputElement;
        input.value = hexColor(value);
        row(box, key, field);
        field.on(
            "input",
            () => apply((object) => change(object, input.value)),
            false,
        );
        field.on("change", options.changed, false);
    }

    function choice(
        box: DOMElement,
        key: MessageKey,
        value: string,
        choices: [string, string][],
        change: (object: construction_object, value: string) => void,
    ): void {
        const field = $.create("select");
        choices.forEach(([value, label]) =>
            field.add($.create("option").att("value", value).text(label)),
        );
        (field.dom() as Field).value = value;
        row(box, key, field);
        field.on(
            "change",
            () => {
                apply((object) => change(object, (field.dom() as Field).value));
                options.changed();
            },
            false,
        );
    }

    function build(object: construction_object): void {
        const identity = section("object");
        const name = $.create("input")
            .att("type", "text")
            .att("spellcheck", "false");
        (name.dom() as HTMLInputElement).value = object.name;
        row(identity, "name", name);
        name.on(
            "change",
            () => {
                const input = name.dom() as HTMLInputElement;
                const value = input.value.trim();
                const taken = options.scene().getObj(value);
                input.setCustomValidity(
                    !value
                        ? message("name_required")
                        : taken && taken !== object
                          ? message("name_taken", value)
                          : "",
                );
                if (!input.reportValidity()) return;
                if (value !== object.name) void options.rename(object, value);
            },
            false,
        );
        name.on(
            "input",
            () => (name.dom() as HTMLInputElement).setCustomValidity(""),
            false,
        );

        if (
            object instanceof expression_object &&
            !object.isCursor &&
            !object.bounds
        )
            definition(object);

        const appearance = section("appearance");
        const scope = $.create("input").att("type", "checkbox");
        (scope.dom() as HTMLInputElement).checked = all;
        row(appearance, "same_type", scope);
        scope.on(
            "change",
            () => {
                all = (scope.dom() as HTMLInputElement).checked;
            },
            false,
        );
        color(appearance, "color", object.stroke_color, (object, value) => {
            object.stroke_color = value;
            object.fill_color = value;
        });
        number(
            appearance,
            object instanceof point_object ? "point_size" : "thickness",
            object.size,
            0,
            50,
            0.5,
            (object, value) => {
                object.size = value;
            },
        );
        number(
            appearance,
            "stroke_opacity",
            object.strokeOpacity * 100,
            0,
            100,
            1,
            (object, value) => {
                object.strokeOpacity = value / 100;
            },
        );
        // A locus has no default opacity in .dgo, yet is filled like DGPad's.
        if (object.opacity !== undefined || object instanceof locus_object) {
            color(
                appearance,
                "fill_color",
                object.fill_color,
                (object, value) => {
                    object.fill_color = value;
                },
            );
            number(
                appearance,
                "fill_opacity",
                (object.opacity ?? 0) * 100,
                0,
                100,
                1,
                (object, value) => {
                    object.opacity = value / 100;
                },
            );
        }
        if (!(
            object instanceof point_object ||
            object instanceof expression_object
        ))
            check(
                appearance,
                "dashed",
                object.dash.length > 0,
                (object, value) => {
                    object.dash = value ? [6, 6] : [];
                },
            );
        number(
            appearance,
            "level",
            object.level,
            -100,
            100,
            1,
            (object, value) => {
                object.level = value;
            },
        );

        const display = section("display");
        check(display, "visible", object.hidden === 0, (object, value) => {
            object.hidden = value ? 0 : 1;
        });
        if (object.condition)
            display.add(
                $.create("p")
                    .cls("dge-property-help")
                    .text(message("conditional_visibility")),
            );
        if (object instanceof point_object)
            check(display, "show_name", object.showName, (object, value) => {
                object.showName = value;
            });
        const measured =
            object instanceof segment_object ||
            object instanceof angle_object ||
            object instanceof fixed_angle_object ||
            object instanceof polygon_object ||
            (object instanceof list_object &&
                !(object instanceof expression_list_object));
        if (
            object instanceof point_object ||
            measured ||
            ["expression", "text", "button"].includes(object.type)
        )
            number(
                display,
                "font_size",
                object.fontSize,
                6,
                72,
                1,
                (object, value) => {
                    object.fontSize = value;
                },
            );
        if (measured || object instanceof expression_object) {
            choice(
                display,
                "precision",
                String(object.precision),
                [
                    ["-1", message("no_value")],
                    ...Array.from({ length: 11 }, (_, i): [string, string] => [
                        String(i),
                        String(i),
                    ]),
                ],
                (object, value) => {
                    object.precision = Number(value);
                },
            );
        }

        if (object instanceof point_object) {
            const point = section("point_settings");
            choice(
                point,
                "point_shape",
                object.shape,
                ["circle", "cross", "diamond", "rect"].map((shape) => [
                    shape,
                    message(("shape_" + shape) as MessageKey),
                ]),
                (object, value) => {
                    (object as point_object).shape = value;
                },
            );
            number(
                point,
                "name_position",
                Math.round((object.namePosition * 180) / Math.PI),
                -360,
                360,
                1,
                (object, value) => {
                    (object as point_object).namePosition =
                        (value * Math.PI) / 180;
                },
            );
            check(point, "trace", object.trace, (object, value) => {
                (object as point_object).trace = value;
            });
            if (object.moveable) {
                number(
                    point,
                    "step_x",
                    object.increment[0],
                    0,
                    1000,
                    0.01,
                    (object, value) => {
                        (object as point_object).increment[0] = value;
                    },
                );
                number(
                    point,
                    "step_y",
                    object.increment[1],
                    0,
                    1000,
                    0.01,
                    (object, value) => {
                        (object as point_object).increment[1] = value;
                    },
                );
            }
        }
        if (object instanceof segment_object)
            choice(
                appearance,
                "decoration",
                String(object.decoration),
                Array.from({ length: 7 }, (_, i) => [
                    String(i),
                    i
                        ? "│".repeat(i <= 3 ? i : i - 3) + (i > 3 ? " × 2" : "")
                        : message("none"),
                ]),
                (object, value) => {
                    (object as segment_object).decoration = Number(value);
                },
            );
        if (
            object instanceof angle_object ||
            object instanceof fixed_angle_object
        ) {
            const angle = section("angle_settings");
            number(
                angle,
                "arc_radius",
                object.arcRadius,
                5,
                200,
                1,
                (object, value) => {
                    (object as angle_object | fixed_angle_object).arcRadius =
                        value;
                },
            );
            if (object instanceof angle_object)
                choice(
                    angle,
                    "right_angle",
                    object.rightAngleMark,
                    RIGHT_ANGLE_MARKS.map((value) => [
                        value,
                        message(("mark_" + value) as MessageKey),
                    ]),
                    (object, value) => {
                        (object as angle_object).rightAngleMark =
                            value as (typeof RIGHT_ANGLE_MARKS)[number];
                    },
                );
        }
        if (object instanceof locus_object)
            number(
                section("sampling"),
                "samples",
                object.precision,
                10,
                5000,
                1,
                (object, value) => {
                    object.precision = value;
                },
            );
        if (object instanceof expression_list_object)
            number(
                appearance,
                "segments_size",
                object.segmentsSize,
                -1,
                50,
                0.5,
                (object, value) => {
                    (object as expression_list_object).segmentsSize = value;
                },
            );
        if (object instanceof expression_object && object.isCursor) {
            const slider = section("slider_settings");
            number(
                slider,
                "increment",
                object.increment,
                0,
                1000,
                0.01,
                (object, value) => {
                    (object as expression_object).increment = value;
                },
            );
            number(
                slider,
                "slider_length",
                object.cursorLength,
                20,
                1000,
                1,
                (object, value) => {
                    (object as expression_object).cursorLength = value;
                },
            );
            check(slider, "vertical", object.vertical, (object, value) => {
                (object as expression_object).vertical = value;
            });
            color(slider, "knob_color", object.cursorColor, (object, value) => {
                (object as expression_object).cursorColor = value;
            });
            number(
                slider,
                "knob_size",
                object.cursorRadius,
                2,
                40,
                0.5,
                (object, value) => {
                    (object as expression_object).cursorRadius = value;
                },
            );
        }
        if (
            object instanceof point_on_object ||
            (object instanceof expression_object && object.isCursor)
        ) {
            const animation = section("animation_settings");
            const settings: Animation = {
                speed: 0,
                direction: 1,
                ar: false,
                ...object.animation,
            };
            const update = (
                object: construction_object,
                change: (settings: Animation) => void,
            ) => {
                const owner = object as point_on_object | expression_object;
                change(settings);
                if (settings.speed > 0)
                    owner.C.animations.add(owner, { ...settings });
                else if (owner.animation)
                    Object.assign(owner.animation, settings);
            };
            number(
                animation,
                "animation_speed",
                object.animation?.speed ?? 0,
                0,
                100,
                0.1,
                (object, value) =>
                    update(object, (settings) => {
                        settings.speed = value;
                    }),
            );
            check(
                animation,
                "reverse",
                object.animation?.direction === -1,
                (object, value) =>
                    update(object, (settings) => {
                        settings.direction = value ? -1 : 1;
                    }),
            );
            choice(
                animation,
                "animation_end",
                object.animation?.once
                    ? "once"
                    : object.animation?.ar
                      ? "bounce"
                      : "loop",
                [
                    ["loop", message("loop")],
                    ["bounce", message("bounce")],
                    ["once", message("once")],
                ],
                (object, value) =>
                    update(object, (settings) => {
                        settings.ar = value === "bounce";
                        settings.once = value === "once";
                    }),
            );
        }
    }

    // Its value, formula or program, on as many lines as it takes: Enter
    // keeps the indentation, Tab indents, ⌘-Enter or Ctrl-Enter applies and
    // Escape restores. The edits go through the browser's own, to be undone
    // as typing is.
    // A program to be made, written before it exists.
    function create(name: string): void {
        clear(null, true);
        const field = $.create("input")
            .att("type", "text")
            .att("spellcheck", "false");
        const input = field.dom() as HTMLInputElement;
        input.value = name;
        row(section("new_program"), "name", field);
        definition(null, () => input.value.trim());
        (content.find("textarea")!.dom() as HTMLTextAreaElement).focus();
    }

    function definition(
        object: expression_object | null,
        name?: () => string,
    ): void {
        const box = section("definition");
        const original = object ? expressionSource(object) : "";
        const editor = $.create("textarea")
            .cls("dge-program")
            .att("dir", "ltr")
            .att("spellcheck", "false")
            .att("wrap", "off")
            .att("aria-label", message("definition"))
            .att("placeholder", object ? "" : PROGRAM_PLACEHOLDER);
        const area = editor.dom() as HTMLTextAreaElement;
        area.value = original;
        const error = $.create("p")
            .cls("dge-program-error")
            .att("role", "alert");
        const apply = $.create("button")
            .cls("dge-primary")
            .att("type", "button")
            .text(message(object ? "apply" : "create"));
        const format = $.create("button")
            .att("type", "button")
            .text(message("format_program"));
        fields.push(editor, apply, format);
        box.add(
            editor,
            error,
            $.create("div").cls("dge-program-actions").add(apply, format),
            $.create("p")
                .cls("dge-property-help")
                .text(message("definition_hint")),
        );
        const update = () => {
            area.rows = Math.min(
                // The example too, while empty.
                Math.max(
                    (area.value || area.placeholder).split("\n").length + 1,
                    3,
                ),
                20,
            );
            apply.dom().toggleAttribute("disabled", area.value === original);
            editor.removeClass("dge-error");
            error.text("");
        };
        update();
        const insert = (text: string) =>
            document.execCommand("insertText", false, text);
        editor.on("input", update, false);
        editor.on(
            "keydown",
            (event) => {
                const caret = area.selectionStart;
                const line = area.value.slice(
                    area.value.lastIndexOf("\n", caret - 1) + 1,
                    caret,
                );
                const indent = /^\s*/.exec(line)![0];
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey))
                    void submit();
                else if (event.key === "Enter")
                    insert(`\n${indent}${/\{\s*$/.test(line) ? "    " : ""}`);
                else if (event.key === "Tab" && !event.shiftKey) insert("    ");
                else if (event.key === "}" && line && !line.trim()) {
                    area.setSelectionRange(
                        caret - Math.min(line.length, 4),
                        caret,
                    );
                    insert("}");
                } else if (event.key === "Escape" && area.value !== original) {
                    area.value = original;
                    update();
                    event.stopPropagation();
                } else return;
                event.preventDefault();
            },
            false,
        );
        apply.on("click", () => void submit(), false);
        format.on(
            "click",
            () => {
                area.focus();
                area.select();
                insert(formatProgram(area.value));
            },
            false,
        );

        async function submit(): Promise<void> {
            try {
                await (object
                    ? options.define(object, area.value)
                    : options.create(name!(), area.value));
            } catch (failure) {
                if (!(failure instanceof TextError)) throw failure;
                const syntax = failure.key === "syntax";
                const line = syntax ? syntaxLine(area.value) : null;
                editor.addClass("dge-error");
                error.text(
                    line
                        ? message("syntax_line", String(line))
                        : syntax
                          ? message("program_syntax")
                          : message(failure.key as MessageKey, failure.detail),
                );
                if (!line) return;
                // The line selected.
                const lines = area.value.split("\n");
                const start = lines
                    .slice(0, line - 1)
                    .reduce((sum, text) => sum + text.length + 1, 0);
                area.focus();
                area.setSelectionRange(start, start + lines[line - 1].length);
            }
        }
    }

    function refresh(): void {
        const object = selected && options.scene().getObj(selected.name);
        if (object !== selected) select(object ?? null);
        else refreshPicker();
    }

    select(null);
    return {
        panel,
        select,
        create,
        refresh,
        get selected() {
            return selected;
        },
    };
}

function hexColor(color: string): string {
    if (color.startsWith("#"))
        return color.length === 4
            ? "#" +
                  [...color.slice(1)]
                      .map((channel) => channel + channel)
                      .join("")
            : color;
    return (
        "#" +
        color
            .match(/\d+/g)!
            .map((channel) => Number(channel).toString(16).padStart(2, "0"))
            .join("")
    );
}
