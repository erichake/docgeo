import type { construction } from "../construction";
import type { Animation } from "../animation";
import { figureObjects } from "../dgo";
import { $, type DOMElement } from "../dom";
import { DIR } from "../i18n";
import { angle_object, RIGHT_ANGLE_MARKS } from "../objects/angle_object";
import type { construction_object } from "../objects/construction_object";
import type { grid_object } from "../objects/grid_object";
import { expression_object } from "../objects/expression_object";
import { expression_list_object } from "../objects/expression_list_object";
import { fixed_angle_object } from "../objects/fixed_angle_object";
import { list_object } from "../objects/list_object";
import { locus_object } from "../objects/locus_object";
import { panel_object } from "../objects/panel_object";
import { button_object } from "../objects/button_object";
import { event_object } from "../objects/event_object";
import { point_object } from "../objects/point_object";
import { point_on_object } from "../objects/point_on_object";
import { polygon_object } from "../objects/polygon_object";
import { segment_object } from "../objects/segment_object";
import { blocksView, isTurtle, releaseBlocks } from "./blocks/view";
import {
    createdColors,
    definitionSource,
    figureGlobals,
    figureTurtles,
    hasName,
    ownPrograms,
    programHat,
    programOwner,
} from "./figure";
import { message, type MessageKey } from "./messages";
import { scrubNumber, type Scrub } from "./scrub";
import { formatProgram, syntaxLine, TextError } from "./text";
import {
    hexColor,
    RESET_ICON,
    viewSettings,
    type ViewOptions,
} from "./view_settings";

type Field = HTMLInputElement | HTMLSelectElement;

// What the definition section edits.
type Defined = expression_object | panel_object | button_object | event_object;

// How each number follows a drag (see Scrub).
const SCRUB = {
    point_size: { pixel: 0.05 },
    point_border: { pixel: 0.05 },
    thickness: { pixel: 0.05 },
    stroke_opacity: { pixel: 0.5 },
    fill_opacity: { pixel: 0.5 },
    level: { pixel: 0.1 },
    font_size: { pixel: 0.1 },
    name_position: { pixel: 1.8 },
    step_x: { pixel: 0.005, relative: true },
    step_y: { pixel: 0.005, relative: true },
    arc_radius: { pixel: 0.5 },
    samples: { pixel: 1, relative: true },
    segments_size: { pixel: 0.05 },
    increment: { pixel: 0.005, relative: true },
    slider_length: { pixel: 2 },
    knob_size: { pixel: 0.1 },
    animation_speed: { pixel: 0.02, relative: true },
} satisfies Partial<Record<MessageKey, Scrub>>;

// DGPad's, that of a new slider.
const KNOB_COLOR = "#780013";

// Whose value the figure writes beside it.
const measured = (object: construction_object): boolean =>
    object instanceof segment_object ||
    object instanceof angle_object ||
    object instanceof fixed_angle_object ||
    object instanceof polygon_object ||
    (object instanceof list_object &&
        !(object instanceof expression_list_object));

const PROGRAM_PLACEHOLDER =
    "var t = [];\nfor (var i = 0; i < 10; i++) {\n    t.push([i, 0]);\n}\nt";

export function propertiesPanel(options: {
    scene: () => construction;
    changed: () => void;
    rename: (object: construction_object, name: string) => Promise<void>;
    // Throws a TextError where the text is wrong.
    define: (object: Defined, source: string) => Promise<void>;
    // A program for the object, a turtle's or an event's ("drag", "down",
    // "up", "change"), the object's own shown if it has one.
    start: (kind: string, object: construction_object) => void;
    // One of its programs, its first block deleted.
    remove: (program: construction_object) => void;
    // A new expression, given a name or not.
    create: (name: string, source: string) => Promise<void>;
    // After each selection.
    shown: () => void;
    // Lights or unlights an object shown.
    mark: (object: construction_object, on: boolean) => void;
    figure: ViewOptions["figure"];
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
    const objectPane = $.create("div")
        .att("role", "tabpanel")
        .add($.create("div").cls("dge-property-picker").add(picker), content);
    const figurePane = $.create("div").att("role", "tabpanel").hide();
    const tab = (key: MessageKey, figure: boolean) => {
        const button = $.create("button")
            .att("type", "button")
            .att("role", "tab")
            .att("aria-selected", String(!figure))
            .text(message(key));
        button.on("click", () => (figure ? showFigure() : select(selected)));
        return button;
    };
    const tabs = [tab("tab_object", false), tab("tab_figure", true)];
    panel.add(
        $.create("div")
            .cls("dge-panel-header")
            .add($.create("h2").text(message("properties")), close),
        $.create("div")
            .cls("dge-tabs")
            .att("role", "tablist")
            .add(...tabs),
        objectPane,
        figurePane,
    );
    let adjusting = 0;
    // In the order they were selected, the first giving the values shown.
    let selected: construction_object[] = [];
    // The grid the figure tab shows, while it does.
    let shownGrid: grid_object | null = null;
    let all = false;
    // Programs as blocks rather than text, once chosen; until then, only
    // turtles.
    let preferBlocks: boolean | null = null;
    // The program of the object shown, among its others, by name; the
    // object whose blocks show without a program yet.
    let expanded: string | null = null;
    let adding: construction_object | null = null;
    // The program whose text or blocks show.
    let shownProgram: construction_object | null = null;
    const fields: DOMElement[] = [];
    const figureFields: DOMElement[] = [];
    // A turtle's program, super-hidden, while it shows.
    const objects = () =>
        figureObjects(options.scene()).filter(
            (object) => object.hidden !== 2 || selected.includes(object),
        );
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

    const mark = (on: boolean) =>
        selected.forEach((object) => options.mark(object, on));

    // Wider for a formula's lines.
    function clear(objects: construction_object[], wide: boolean): void {
        mark(false);
        selected = objects;
        mark(true);
        fields.splice(0).forEach((field) => field.dispose());
        releaseBlocks();
        content.inner("");
        shownProgram = null;
        $("body").toggleClass("dge-properties-wide", wide);
        refreshPicker();
    }

    function showTab(figure: boolean): void {
        tabs.forEach((button, index) =>
            button.att("aria-selected", String((index === 1) === figure)),
        );
        [objectPane, figurePane].forEach((pane, index) =>
            (index === 1) === figure ? pane.show() : pane.hide(),
        );
        figureFields.splice(0).forEach((field) => field.dispose());
        figurePane.inner("");
        shownGrid = null;
    }

    // The coordinate system, the view and the figure's own settings.
    function showFigure(): void {
        showTab(true);
        mark(false);
        $("body").removeClass("dge-properties-wide");
        shownGrid = options.scene().GRID;
        figureFields.push(
            ...viewSettings(figurePane, {
                scene: options.scene,
                changed: options.changed,
                figure: options.figure,
                rebuild: showFigure,
            }),
        );
    }

    // Kept while the figure tab shows, which an empty click doesn't leave.
    // A program, a turtle's or an event's, shows with its object.
    function select(
        chosen: construction_object | construction_object[] | null,
    ): void {
        const objects = [
            ...new Set(
                [chosen ?? []].flat().map((object) => {
                    const owner = programOwner(object);
                    if (owner === object) return object;
                    expanded = object.name;
                    return owner;
                }),
            ),
        ];
        if (shownGrid && !objects[0]) {
            selected = [];
            return;
        }
        if (shownGrid) showTab(false);
        const [object] = objects;
        clear(
            objects,
            !objects[1] &&
                ((object instanceof expression_object &&
                    !!(object.formula || object.program)) ||
                    (!!object &&
                        (adding === object ||
                            ownPrograms(options.scene(), object).length > 0))),
        );
        if (!object) {
            content.add(
                $.create("p")
                    .cls("dge-property-help")
                    .text(message("properties_hint")),
            );
            return;
        }
        build(objects);
        options.shown();
    }

    // Added to the objects shown, or removed if it was.
    function toggle(object: construction_object): void {
        select(
            shownGrid
                ? object
                : selected.includes(object)
                  ? selected.filter((other) => other !== object)
                  : [...selected, object],
        );
    }

    function refreshPicker(): void {
        picker.inner("");
        picker.add(
            $.create("option")
                .att("value", "")
                .text(
                    selected[1]
                        ? selected.map(({ name }) => name).join(", ")
                        : message("choose_object"),
                ),
        );
        objects().forEach((candidate) =>
            picker.add(
                $.create("option")
                    .att("value", candidate.name)
                    .text(candidate.name),
            ),
        );
        (picker.dom() as Field).value = selected[1]
            ? ""
            : (selected[0]?.name ?? "");
    }

    // `control`: the field with what goes along with it.
    function row(
        section: DOMElement,
        key: MessageKey,
        field: DOMElement,
        control = field,
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
                    control,
                ),
        );
        field.att("aria-label", message(key));
    }

    function section(key: MessageKey): DOMElement {
        const box = $.create("section").cls("dge-property-section");
        content.add(box.add($.create("h3").text(message(key))));
        return box;
    }

    // Whether all the objects shown have the setting: only then is it shown.
    const common = (targets: construction_object[]) =>
        targets.length === selected.length;

    // `targets`: the objects shown, and with "same type", all those of their
    // types.
    function apply<T extends construction_object>(
        targets: T[],
        change: (object: T) => void,
    ): void {
        (all
            ? (objects().filter((object) =>
                  targets.some((target) => target.class === object.class),
              ) as T[])
            : targets
        ).forEach((object) => {
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
        mark(true);
        // The object shows bare while it is being adjusted.
        $("body").addClass("dge-adjusting");
        clearTimeout(adjusting);
        adjusting = window.setTimeout(
            () => $("body").removeClass("dge-adjusting"),
            700,
        );
    }

    // The value of the first target, set apart if the others differ.
    function first<T extends construction_object, V>(
        field: DOMElement,
        targets: T[],
        read: (object: T) => V,
    ): V {
        const value = read(targets[0]);
        field.toggleClass(
            "dge-mixed",
            targets.some((object) => read(object) !== value),
        );
        return value;
    }

    function check<T extends construction_object>(
        box: DOMElement,
        key: MessageKey,
        targets: T[],
        read: (object: T) => boolean,
        change: (object: T, value: boolean) => void,
    ): void {
        if (!common(targets)) return;
        const field = $.create("input").att("type", "checkbox");
        const input = field.dom() as HTMLInputElement;
        input.checked = first(field, targets, read);
        input.indeterminate = field.dom().classList.contains("dge-mixed");
        row(box, key, field);
        field.on(
            "change",
            () => {
                apply(targets, (object) => change(object, input.checked));
                options.changed();
            },
            false,
        );
    }

    function number<T extends construction_object>(
        box: DOMElement,
        key: keyof typeof SCRUB,
        targets: T[],
        read: (object: T) => number,
        min: number,
        max: number,
        step: number,
        change: (object: T, value: number) => void,
    ): void {
        if (!common(targets)) return;
        const field = $.create("input")
            .att("type", "number")
            .att("title", message("scrub_hint"))
            .att("min", min)
            .att("max", max)
            .att("step", step);
        const input = field.dom() as HTMLInputElement;
        let value = first(field, targets, read);
        input.value = String(value);
        row(box, key, field);
        const set = () => {
            field.removeClass("dge-mixed");
            apply(targets, (object) => change(object, value));
        };
        scrubNumber(
            field,
            (next) => {
                value = next;
                input.value = String(value);
                set();
            },
            options.changed,
            SCRUB[key],
        );
        field.on(
            "input",
            () => {
                if (input.value !== "" && input.validity.valid) {
                    value = input.valueAsNumber;
                    set();
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

    // Its button, after the field so that the label opens the field, brings
    // each object back to its `initial` color.
    function color<T extends construction_object>(
        box: DOMElement,
        key: MessageKey,
        targets: T[],
        read: (object: T) => string,
        initial: (object: T) => string,
        change: (object: T, value: string) => void,
    ): void {
        if (!common(targets)) return;
        const field = $.create("input").att("type", "color");
        const input = field.dom() as HTMLInputElement;
        input.value = first(field, targets, (object) => hexColor(read(object)));
        const reset = $.create("button")
            .cls("dge-reset")
            .att("type", "button")
            .att("title", message("default_color"))
            .att("aria-label", message("default_color"))
            .append(RESET_ICON);
        const showReset = () =>
            reset.stl(
                "visibility",
                targets.some(
                    (object) =>
                        hexColor(read(object)) !== hexColor(initial(object)),
                )
                    ? "visible"
                    : "hidden",
            );
        showReset();
        fields.push(reset);
        reset.on("click", () => {
            apply(targets, (object) => change(object, initial(object)));
            input.value = first(field, targets, (object) =>
                hexColor(read(object)),
            );
            showReset();
            options.changed();
        });
        row(
            box,
            key,
            field,
            $.create("span").cls("dge-color-field").add(field, reset),
        );
        field.on(
            "input",
            () => {
                field.removeClass("dge-mixed");
                apply(targets, (object) => change(object, input.value));
                showReset();
            },
            false,
        );
        field.on("change", options.changed, false);
    }

    function choice<T extends construction_object>(
        box: DOMElement,
        key: MessageKey,
        targets: T[],
        read: (object: T) => string,
        choices: [string, string][],
        change: (object: T, value: string) => void,
    ): void {
        if (!common(targets)) return;
        const field = $.create("select");
        choices.forEach(([value, label]) =>
            field.add($.create("option").att("value", value).text(label)),
        );
        (field.dom() as Field).value = first(field, targets, read);
        row(box, key, field);
        field.on(
            "change",
            () => {
                field.removeClass("dge-mixed");
                apply(targets, (object) =>
                    change(object, (field.dom() as Field).value),
                );
                options.changed();
            },
            false,
        );
    }

    // The settings common to the objects, the name and the definition of a
    // single one.
    function build(objects: construction_object[]): void {
        const [object] = objects;
        if (objects[1])
            content.add(
                $.create("p")
                    .cls("dge-property-help")
                    .text(message("several_objects", String(objects.length))),
            );
        else identity(object);
        // Never drawn.
        if (objects.every((object) => object instanceof event_object)) return;

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
        color(
            appearance,
            "color",
            objects,
            (object) => object.stroke_color,
            (object) => createdColors(object)[0],
            (object, value) => {
                object.stroke_color = value;
            },
        );
        const points = objects.filter(
            (object) => object instanceof point_object,
        );
        number(
            appearance,
            "point_size",
            points,
            (object) => object.size,
            0,
            50,
            0.5,
            (object, value) => {
                object.size = value;
            },
        );
        number(
            appearance,
            "thickness",
            objects.filter((object) => !(object instanceof point_object)),
            (object) => object.size,
            0,
            50,
            0.5,
            (object, value) => {
                object.size = value;
            },
        );
        number(
            appearance,
            "point_border",
            points,
            (object) => object.border,
            0,
            20,
            0.5,
            (object, value) => {
                object.border = value;
            },
        );
        number(
            appearance,
            "stroke_opacity",
            objects,
            (object) => object.strokeOpacity * 100,
            0,
            100,
            1,
            (object, value) => {
                object.strokeOpacity = value / 100;
            },
        );
        // A locus has no default opacity in .dgo, yet is filled like DGPad's.
        const filled = objects.filter(
            (object) =>
                object.opacity !== undefined || object instanceof locus_object,
        );
        color(
            appearance,
            "fill_color",
            filled,
            (object) => object.fill_color,
            (object) => createdColors(object)[1],
            (object, value) => {
                object.fill_color = value;
            },
        );
        number(
            appearance,
            "fill_opacity",
            filled,
            (object) => (object.opacity ?? 0) * 100,
            0,
            100,
            1,
            (object, value) => {
                object.opacity = value / 100;
            },
        );
        check(
            appearance,
            "dashed",
            objects.filter(
                (object) =>
                    !(
                        object instanceof point_object ||
                        object instanceof expression_object
                    ),
            ),
            (object) => object.dash.length > 0,
            (object, value) => {
                object.dash = value ? [6, 6] : [];
            },
        );
        number(
            appearance,
            "level",
            objects,
            (object) => object.level,
            -100,
            100,
            1,
            (object, value) => {
                object.level = value;
            },
        );

        const display = section("display");
        check(
            display,
            "visible",
            objects,
            (object) => object.hidden === 0,
            (object, value) => {
                object.hidden = value ? 0 : 1;
            },
        );
        if (objects.some(({ condition }) => condition))
            display.add(
                $.create("p")
                    .cls("dge-property-help")
                    .text(message("conditional_visibility")),
            );
        check(
            display,
            "show_name",
            objects.filter((object) => hasName(object)),
            (object) => object.showName,
            (object, value) => {
                object.showName = value;
            },
        );
        check(
            display,
            "fixed_object",
            objects.filter(
                (object): object is polygon_object =>
                    object instanceof polygon_object &&
                    !object.plane &&
                    !object.section,
            ),
            (object) => object.fixed,
            (object, value) => {
                object.fixed = value;
            },
        );
        check(
            display,
            "inert_object",
            objects,
            (object) => object.inert,
            (object, value) => {
                object.inert = value;
            },
        );
        number(
            display,
            "font_size",
            objects.filter(
                (object) =>
                    object instanceof point_object ||
                    measured(object) ||
                    ["expression", "text", "button"].includes(object.type),
            ),
            (object) => object.fontSize,
            6,
            72,
            1,
            (object, value) => {
                object.fontSize = value;
            },
        );
        choice(
            display,
            "precision",
            objects.filter(
                (object) =>
                    measured(object) || object instanceof expression_object,
            ),
            (object) => String(object.precision),
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

        if (common(points)) {
            const point = section("point_settings");
            choice(
                point,
                "point_shape",
                points,
                (object) => object.shape,
                ["circle", "cross", "diamond", "rect"].map((shape) => [
                    shape,
                    message(("shape_" + shape) as MessageKey),
                ]),
                (object, value) => {
                    object.shape = value;
                },
            );
            number(
                point,
                "name_position",
                points,
                (object) => Math.round((object.namePosition * 180) / Math.PI),
                -360,
                360,
                1,
                (object, value) => {
                    object.namePosition = (value * Math.PI) / 180;
                },
            );
            check(
                point,
                "trace",
                points,
                (object) => object.trace,
                (object, value) => {
                    object.trace = value;
                },
            );
            const moveable = points.filter(({ moveable }) => moveable);
            number(
                point,
                "step_x",
                moveable,
                (object) => object.increment[0],
                0,
                1000,
                0.01,
                (object, value) => {
                    object.increment[0] = value;
                },
            );
            number(
                point,
                "step_y",
                moveable,
                (object) => object.increment[1],
                0,
                1000,
                0.01,
                (object, value) => {
                    object.increment[1] = value;
                },
            );
        }
        choice(
            appearance,
            "decoration",
            objects.filter((object) => object instanceof segment_object),
            (object) => String(object.decoration),
            Array.from({ length: 7 }, (_, i) => [
                String(i),
                i
                    ? "│".repeat(i <= 3 ? i : i - 3) + (i > 3 ? " × 2" : "")
                    : message("none"),
            ]),
            (object, value) => {
                object.decoration = Number(value);
            },
        );
        const angles = objects.filter(
            (object) =>
                object instanceof angle_object ||
                object instanceof fixed_angle_object,
        );
        if (common(angles)) {
            const angle = section("angle_settings");
            number(
                angle,
                "arc_radius",
                angles,
                (object) => object.arcRadius,
                5,
                200,
                1,
                (object, value) => {
                    object.arcRadius = value;
                },
            );
            choice(
                angle,
                "right_angle",
                angles.filter((object) => object instanceof angle_object),
                (object) => object.rightAngleMark,
                RIGHT_ANGLE_MARKS.map((value) => [
                    value,
                    message(("mark_" + value) as MessageKey),
                ]),
                (object, value) => {
                    object.rightAngleMark =
                        value as (typeof RIGHT_ANGLE_MARKS)[number];
                },
            );
        }
        const loci = objects.filter((object) => object instanceof locus_object);
        if (common(loci))
            number(
                section("sampling"),
                "samples",
                loci,
                (object) => object.precision,
                10,
                5000,
                1,
                (object, value) => {
                    object.precision = value;
                },
            );
        number(
            appearance,
            "segments_size",
            objects.filter(
                (object) => object instanceof expression_list_object,
            ),
            (object) => object.segmentsSize,
            -1,
            50,
            0.5,
            (object, value) => {
                object.segmentsSize = value;
            },
        );
        const sliders = objects.filter(
            (object): object is expression_object =>
                object instanceof expression_object && object.isCursor,
        );
        if (common(sliders)) {
            const slider = section("slider_settings");
            number(
                slider,
                "increment",
                sliders,
                (object) => object.increment,
                0,
                1000,
                0.01,
                (object, value) => {
                    object.increment = value;
                },
            );
            number(
                slider,
                "slider_length",
                sliders,
                (object) => object.cursorLength,
                20,
                1000,
                1,
                (object, value) => {
                    object.cursorLength = value;
                },
            );
            check(
                slider,
                "vertical",
                sliders,
                (object) => object.vertical,
                (object, value) => {
                    object.vertical = value;
                },
            );
            color(
                slider,
                "knob_color",
                sliders,
                (object) => object.cursorColor,
                () => KNOB_COLOR,
                (object, value) => {
                    object.cursorColor = value;
                },
            );
            number(
                slider,
                "knob_size",
                sliders,
                (object) => object.cursorRadius,
                2,
                40,
                0.5,
                (object, value) => {
                    object.cursorRadius = value;
                },
            );
        }
        const animated = objects.filter(
            (object): object is point_on_object | expression_object =>
                object instanceof point_on_object ||
                (object instanceof expression_object && object.isCursor),
        );
        if (common(animated)) {
            const animation = section("animation_settings");
            // Each object's, kept while it isn't animated.
            const settings = new Map<construction_object, Animation>();
            const update = (
                owner: point_on_object | expression_object,
                change: (settings: Animation) => void,
            ) => {
                if (!settings.has(owner))
                    settings.set(owner, {
                        speed: 0,
                        direction: 1,
                        ar: false,
                        ...owner.animation,
                    });
                const own = settings.get(owner)!;
                change(own);
                if (own.speed > 0) owner.C.animations.add(owner, { ...own });
                else if (owner.animation) Object.assign(owner.animation, own);
            };
            number(
                animation,
                "animation_speed",
                animated,
                (object) => object.animation?.speed ?? 0,
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
                animated,
                (object) => object.animation?.direction === -1,
                (object, value) =>
                    update(object, (settings) => {
                        settings.direction = value ? -1 : 1;
                    }),
            );
            choice(
                animation,
                "animation_end",
                animated,
                (object) =>
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

    function identity(object: construction_object): void {
        const box = section("object");
        const name = $.create("input")
            .att("type", "text")
            .att("spellcheck", "false");
        (name.dom() as HTMLInputElement).value = object.name;
        row(box, "name", name);
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
            (object instanceof expression_object &&
                !object.isCursor &&
                !object.bounds) ||
            object instanceof panel_object ||
            object instanceof button_object
        )
            definition(object);
        if (
            object instanceof point_object ||
            (object instanceof expression_object && !object.program)
        )
            programs(object);
    }

    // Those it can still have: a turtle from a point, a program for each
    // gesture on one that is dragged, for the change of an expression, and,
    // as DGPad's "oninit", for the opening of the figure.
    function starts(owner: construction_object): string[] {
        const kinds =
            owner instanceof point_object
                ? ["turtle", ...(owner.moveable ? ["drag", "down", "up"] : [])]
                : owner instanceof expression_object
                  ? ["change", "init"]
                  : owner instanceof button_object
                    ? ["init"]
                    : [];
        const own = ownPrograms(options.scene(), owner).map(programHat);
        return kinds.filter((kind) => !own.some((hat) => hat.kind === kind));
    }

    // A point's or an expression's programs, one of them shown, or blocks
    // to start one.
    function programs(owner: point_object | expression_object): void {
        const c = options.scene();
        const own = ownPrograms(c, owner);
        const shown = own.find(({ name }) => name === expanded) ?? own[0];
        if (shown) return definition(shown as Defined);
        if (!starts(owner).length) return;
        const box = section("programs");
        if (adding !== owner) {
            const open = $.create("button")
                .cls("dge-add-program")
                .att("type", "button")
                .append(
                    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
                )
                .add($.create("span").text(message("add_program")));
            open.on(
                "click",
                () => {
                    adding = owner;
                    select(owner);
                },
                false,
            );
            fields.push(open);
            return void box.add(open);
        }
        box.add(
            blocksView({
                programs: [],
                key: "",
                degrees: c.degrees,
                figure: blocksFigure(c),
                owner: owner.name,
                starts: starts(owner),
                apply: () => {},
                open: () => {},
                start: (kind) => options.start(kind, owner),
                remove: () => {},
                fallback: () => {},
            }),
        );
    }

    const blocksFigure = (c: construction) => ({
        objects: () => figureObjects(c).map(({ name }) => name),
        turtles: () => figureTurtles(c).map(([name]) => name),
        globals: () => figureGlobals(c).map((object) => object.global!),
    });

    // Its value, formula or program, on as many lines as it takes: Enter
    // keeps the indentation, Tab indents, ⌘-Enter or Ctrl-Enter applies and
    // Escape restores. The edits go through the browser's own, to be undone
    // as typing is.
    // A program to be made, written before it exists.
    function create(name: string): void {
        if (shownGrid) showTab(false);
        clear([], true);
        const field = $.create("input")
            .att("type", "text")
            .att("spellcheck", "false");
        const input = field.dom() as HTMLInputElement;
        input.value = name;
        row(section("new_program"), "name", field);
        definition(null, () => input.value.trim());
        (content.find("textarea")!.dom() as HTMLTextAreaElement).focus();
    }

    // An object's, or one of the programs of its object (see programs).
    function definition(object: Defined | null, name?: () => string): void {
        const owner = object && programOwner(object);
        const box = section(
            owner && owner !== object ? "programs" : "definition",
        );
        const original = object ? definitionSource(object) : "";
        // HTML, its lines wrapped, isn't a program to lay out.
        const html = object instanceof panel_object;
        // A program, or one to be made, shows as text or as blocks.
        const program =
            !object ||
            object instanceof button_object ||
            object instanceof event_object ||
            !!(object as expression_object).program;
        if (program) shownProgram = object;
        const editor = $.create("textarea")
            .cls("dge-program")
            .att("dir", "ltr")
            .att("spellcheck", "false")
            .att("wrap", html ? "soft" : "off")
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
        if (html) format.hide();
        fields.push(editor, apply, format);
        const actions = $.create("div")
            .cls("dge-program-actions")
            .add(apply, format);
        const hint = $.create("p")
            .cls("dge-property-help")
            .text(message("definition_hint"));
        const slot = $.create("div");
        const mode = (key: MessageKey, blocks: boolean) => {
            const button = $.create("button")
                .att("type", "button")
                .att("role", "tab")
                .text(message(key));
            button.on(
                "click",
                () => {
                    preferBlocks = blocks;
                    // The text of the program last clicked in the blocks.
                    if (!blocks && object && expanded !== object.name)
                        select(selected);
                    else show(blocks);
                },
                false,
            );
            fields.push(button);
            return button;
        };
        const modes = [
            mode("program_text", false),
            mode("program_blocks", true),
        ];
        if (program)
            box.add(
                $.create("div")
                    .cls("dge-tabs dge-modes")
                    .att("role", "tablist")
                    .add(...modes),
            );
        box.add(editor, slot, error, actions, hint);
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

        function show(blocks: boolean): void {
            modes.forEach((button, index) =>
                button.att("aria-selected", String((index === 1) === blocks)),
            );
            [editor, actions, hint].forEach((element) =>
                blocks ? element.hide() : element.show(),
            );
            editor.removeClass("dge-error");
            error.text("");
            if (!blocks) return void slot.inner("");
            const c = options.scene();
            slot.add(
                blocksView({
                    programs: owner
                        ? ownPrograms(c, owner).map((program) => ({
                              ...programHat(program),
                              source:
                                  program === object
                                      ? original
                                      : definitionSource(program as Defined),
                          }))
                        : [
                              {
                                  key: "",
                                  kind: "program",
                                  object: "",
                                  source: area.value,
                              },
                          ],
                    key: object?.name ?? "",
                    degrees: c.degrees,
                    figure: blocksFigure(c),
                    owner: owner?.name ?? "",
                    starts: owner ? starts(owner) : [],
                    apply: (changes) => void applyAll(changes),
                    // Not shown again: the user may be dragging it.
                    open: (key) => {
                        expanded = key;
                        shownProgram = options.scene().getObj(key) ?? null;
                        options.shown();
                    },
                    start: (kind) => owner && options.start(kind, owner),
                    remove: (key) => {
                        const removed = options.scene().getObj(key);
                        if (removed && removed !== owner)
                            options.remove(removed);
                        select(selected);
                    },
                    fallback: () => {
                        show(false);
                        error.text(message("blocks_unsupported"));
                    },
                }),
            );
        }
        if (program)
            show(
                preferBlocks ??
                    (isTurtle(original) ||
                        object instanceof button_object ||
                        object instanceof event_object),
            );
        format.on(
            "click",
            () => {
                area.focus();
                area.select();
                insert(formatProgram(area.value));
            },
            false,
        );

        // The programs of the object the blocks changed, this one or others,
        // found again in the figure each change rebuilds.
        async function applyAll(changes: [string, string][]): Promise<void> {
            for (const [key, source] of changes) {
                const target = key ? options.scene().getObj(key) : object;
                if (target === object) await submit(source);
                else
                    await options
                        .define(target as Defined, source)
                        .catch((failure) => {
                            if (!(failure instanceof TextError)) throw failure;
                            error.text(message("program_syntax"));
                        });
            }
        }

        async function submit(text = area.value): Promise<void> {
            try {
                await (object
                    ? options.define(object, text)
                    : options.create(name!(), text));
            } catch (failure) {
                if (!(failure instanceof TextError)) throw failure;
                const syntax = failure.key === "syntax";
                const line = syntax ? syntaxLine(text) : null;
                editor.addClass("dge-error");
                error.text(
                    line
                        ? message("syntax_line", String(line))
                        : syntax
                          ? message("program_syntax")
                          : message(failure.key as MessageKey, failure.detail),
                );
                if (!line || editor.isHidden()) return;
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

    // `figure`: the figure tab built again, its settings changed elsewhere.
    function refresh(figure = false): void {
        const objects = selected.flatMap(
            ({ name }) => options.scene().getObj(name) ?? [],
        );
        if (!shownGrid) {
            if (
                objects.length < selected.length ||
                objects.some((object, index) => object !== selected[index])
            )
                select(objects);
            else refreshPicker();
        } else {
            selected = objects;
            if (figure || shownGrid !== options.scene().GRID) showFigure();
        }
    }

    select(null);
    return {
        panel,
        select,
        create,
        toggle,
        refresh,
        figure: showFigure,
        // Programs shown as blocks from now on.
        showBlocks: () => {
            preferBlocks = true;
        },
        // The program whose text or blocks show.
        get program() {
            return shownProgram;
        },
        // None while the figure tab shows.
        get selected() {
            return shownGrid ? null : (selected[0] ?? null);
        },
        get selection() {
            return shownGrid ? [] : selected;
        },
    };
}
