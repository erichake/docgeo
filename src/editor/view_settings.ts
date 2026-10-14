import type { construction } from "../construction";
import { $, type DOMElement } from "../dom";
import type { grid_object } from "../objects/grid_object";
import { message, type MessageKey } from "./messages";
import { scrubNumber, type Scrub } from "./scrub";

type Pair = [number, number];
// Bounds, step, and how a drag follows (see Scrub).
type Range = [number, number, number, Scrub];

// The plane coordinate system's looks, DGPad's, which the presets change.
const DGPAD = {
    showGrid: true,
    showOx: true,
    showOy: true,
    stroke_color: "rgb(80,80,80)",
    fontSize: 18,
    size: 2,
    gridWidth: 0.1,
    gridDistances: [0, 0] as Pair,
    gridSubdivisions: 0,
    gridColor: null as string | null,
    gridDash: [] as number[],
    tickDistances: [0, 0] as Pair,
    tickStyles: [0, 0] as Pair,
    boldNumbers: false,
    geogebraAxes: false,
    arrows: 0,
};
type Looks = typeof DGPAD;

const PRESETS: [MessageKey, Partial<Looks>][] = [
    ["preset_dgpad", {}],
    // As GeoGebra's figures have them.
    [
        "preset_geogebra",
        {
            stroke_color: "#1c1c1f",
            fontSize: 12,
            size: 1,
            gridWidth: 1,
            gridSubdivisions: 5,
            gridColor: "#b4b3ba",
            tickStyles: [1, 1],
            geogebraAxes: true,
            arrows: 2,
        },
    ],
    ["preset_axes", { showGrid: false }],
    [
        "preset_dotted",
        { gridWidth: 0.6, gridSubdivisions: 1, gridDash: [2, 3] },
    ],
    [
        "preset_squares",
        {
            showOx: false,
            showOy: false,
            gridDistances: [1, 1],
            gridSubdivisions: 1,
            gridWidth: 0.5,
            gridColor: "#6b9bd6",
        },
    ],
    [
        "preset_graph",
        {
            gridDistances: [1, 1],
            gridSubdivisions: 10,
            gridWidth: 0.4,
            gridColor: "#e8743b",
        },
    ],
];

const DASHES: [number[], MessageKey][] = [
    [[], "solid"],
    [[1, 3], "dotted"],
    [[5, 4], "dashes"],
];

const SUBDIVISIONS = [0, 1, 2, 4, 5, 10];

const BACKGROUND = "#FAFAFA";

// The floor's own, seen from above.
const FLOOR_COLOR = "rgb(35,141,227)";

export const RESET_ICON =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 6.5A5 5 0 1 1 3 9.5M3.5 2.5v4h4"/></svg>';

const LINK_ICON =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 9.5l3-3M7 4.6l1.1-1.1a2.6 2.6 0 0 1 3.7 3.7L10.7 8.3M9 11.4l-1.1 1.1a2.6 2.6 0 0 1-3.7-3.7l1.1-1.1"/></svg>';

const looksOf = (grid: grid_object): Looks =>
    Object.fromEntries(
        Object.keys(DGPAD).map((key) => [key, grid[key as keyof Looks]]),
    ) as Looks;

// Graduations of an axis, major and minor (0), major (1) or none (2),
// upright for Oy.
function ticksIcon(style: number, axis: number): string {
    const ticks = [
        "M4 5V11M8 5V11M12 5V11M6 6.5V9.5M10 6.5V9.5",
        "M4 5V11M8 5V11M12 5V11",
        "",
    ];
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8H15${ticks[style]}"${axis ? ' transform="rotate(-90 8 8)"' : ""}/></svg>`;
}

// The axes' ends: DGPad's arrow, none, GeoGebra's open or filled one.
const ARROW_ICONS = [
    '<path d="M1 8H10"/><path d="M15 8 9 4.5v7z" fill="currentColor"/>',
    '<path d="M1 8H15"/>',
    '<path d="M1 8H14.5M11 4.5 14.5 8 11 11.5"/>',
    '<path d="M1 8H11"/><path d="M15 8l-5-2v4z" fill="currentColor"/>',
].map((path) => `<svg viewBox="0 0 16 16" aria-hidden="true">${path}</svg>`);

function dashIcon(dash: number[]): string {
    return `<svg viewBox="0 0 24 16" aria-hidden="true"><path d="M2 8H22" stroke-dasharray="${dash.join(" ") || "none"}"/></svg>`;
}

// A preset in miniature, its major lines 12 pixels apart, its origin at
// (18, 33).
function thumbnail(looks: Looks, background: string): string {
    const at = (origin: number, step: number, end: number) => {
        const values: number[] = [];
        for (let k = Math.ceil(-origin / step); origin + k * step <= end; k++)
            values.push(+(origin + k * step).toFixed(2));
        return values;
    };
    const lines = (step: number) =>
        at(18, step, 72)
            .map((x) => `M${x} 0V48`)
            .join("") +
        at(33, step, 48)
            .map((y) => `M0 ${y}H72`)
            .join("");
    const n = looks.gridSubdivisions || 5;
    const grid = looks.showGrid
        ? `<g fill="none" stroke="${looks.gridColor ?? looks.stroke_color}" stroke-dasharray="${looks.gridDash.join(" ") || "none"}">${
              n > 1
                  ? `<path d="${lines(12 / n)}" stroke-width="0.5" stroke-opacity="0.25"/>`
                  : ""
          }<path d="${lines(12)}" stroke-width="0.6" stroke-opacity="0.7"/></g>`
        : "";
    const [xTicks, yTicks] = looks.tickStyles.map((style) => style < 2);
    let axes = "";
    let arrows = "";
    // GeoGebra's open arrows with the axes.
    const open = looks.arrows === 2;
    if (looks.showOx) {
        axes += "M0 33H69";
        arrows += open ? "M69 30.5l3 2.5-3 2.5" : "M72 33l-4.5-2.5v5z";
        if (xTicks)
            axes += at(18, 12, 66)
                .map((x) => `M${x} 31.5V34.5`)
                .join("");
    }
    if (looks.showOy) {
        axes += "M18 48V3";
        arrows += open ? "M15.5 3l2.5-3 2.5 3" : "M18 0l-2.5 4.5h5z";
        if (yTicks)
            axes += at(33, 12, 45)
                .map((y) => `M16.5 ${y}H19.5`)
                .join("");
    }
    const color = looks.stroke_color;
    return `<svg viewBox="0 0 72 48" aria-hidden="true"><rect width="72" height="48" fill="${background}"/>${grid}<path d="${axes}${open ? arrows : ""}" fill="none" stroke="${color}" stroke-width="${looks.size > 1 ? 1.2 : 0.8}"/>${open ? "" : `<path d="${arrows}" fill="${color}"/>`}</svg>`;
}

export function hexColor(color: string): string {
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

export interface ViewOptions {
    scene: () => construction;
    // A step to undo.
    changed: () => void;
    // The figure read again with this angle unit or segments order.
    figure: (patch: { deg?: number; sop?: number }) => void;
    // The tab built again, after a preset.
    rebuild: () => void;
}

// The figure tab: its coordinate system, grid, view and figure-wide
// settings, applied as they change. Returns its fields, to dispose of.
export function viewSettings(
    box: DOMElement,
    options: ViewOptions,
): DOMElement[] {
    const fields: DOMElement[] = [];
    const c = options.scene();
    const grid = c.GRID;
    const commit = options.changed;
    // The grid drawn again (the 3D axes take their style when created);
    // `projection`: the figure too, as a 3D floor or perspective changes it.
    // The preset these looks are, shown pressed.
    let showPreset = () => {};
    const redraw = (projection = false) => {
        showPreset();
        grid.createSVG();
        if (projection) c.invalidateProjection();
        c.flush();
    };
    const draw =
        <T>(change: (value: T) => void, projection = false) =>
        (value: T) => {
            change(value);
            redraw(projection);
        };

    // `part`: of the coordinate system, which shows it dimmed while hidden.
    function section(
        key: MessageKey,
        toggle?: [boolean, (on: boolean) => void],
        part = false,
    ): DOMElement {
        const title = $.create("h3").add($.create("span").text(message(key)));
        const rows = $.create("div").cls("dge-view-rows");
        const section = $.create("section")
            .cls("dge-property-section")
            .toggleClass("dge-coords-part", part)
            .add(title, rows);
        if (toggle) {
            const [value, change] = toggle;
            const field = checkbox(message(key), value, (on) => {
                section.toggleClass("dge-off", !on);
                change(on);
            }).cls("dge-switch");
            section.toggleClass("dge-off", !value);
            title.add(field);
        }
        box.add(section);
        return rows;
    }

    const label = (key: MessageKey) =>
        $.create("span").cls("dge-view-label").text(message(key));

    // A label, then its control: a field in the column of y, a color with
    // its reset button after the column of x, else across the columns of x
    // and y.
    function row(rows: DOMElement, key: MessageKey, control: DOMElement): void {
        const dom = control.dom();
        const field = dom instanceof HTMLInputElement;
        rows.add(
            label(key)
                .toggleClass("dge-view-long", field)
                .toggleClass(
                    "dge-view-wide",
                    dom.classList.contains("dge-view-color"),
                ),
            control.addClass(field ? "dge-view-field" : "dge-view-control"),
        );
    }

    function axisHeader(rows: DOMElement): void {
        rows.add(
            $.create("span"),
            $.create("i").cls("dge-view-axis").text("x"),
            $.create("span"),
            $.create("i").cls("dge-view-axis").text("y"),
        );
    }

    // Per axis, with a control made from its index and name.
    function pairRow(
        rows: DOMElement,
        key: MessageKey,
        cell: (axis: 0 | 1, name: string) => DOMElement,
        link: DOMElement = $.create("span"),
    ): void {
        rows.add(
            label(key),
            cell(0, `${message(key)} x`),
            link,
            cell(1, `${message(key)} y`),
        );
    }

    function checkbox(
        name: string,
        value: boolean,
        change: (value: boolean) => void,
    ): DOMElement {
        const field = $.create("input")
            .att("type", "checkbox")
            .att("aria-label", name);
        const input = field.dom() as HTMLInputElement;
        input.checked = value;
        fields.push(field);
        field.on(
            "change",
            () => {
                change(input.checked);
                commit();
            },
            false,
        );
        return field;
    }

    // Empty for 0 if `auto`.
    function number(
        name: string,
        value: number,
        [min, max, step, scrub]: Range,
        change: (value: number) => void,
        auto = false,
    ): { field: DOMElement; show: (value: number) => void } {
        const field = $.create("input")
            .att("type", "number")
            .att("title", message("scrub_hint"))
            .att("aria-label", name)
            .att("min", min)
            .att("max", max)
            .att("step", step);
        const input = field.dom() as HTMLInputElement;
        if (auto) field.att("placeholder", message("auto"));
        const show = (next: number) => {
            value = next;
            input.value = auto && !next ? "" : String(next);
        };
        show(value);
        fields.push(field);
        scrubNumber(
            field,
            (next) => {
                show(next);
                change(next);
            },
            commit,
            scrub,
        );
        field.on(
            "input",
            () => {
                if (input.value === "" ? auto : input.validity.valid) {
                    value = input.valueAsNumber || 0;
                    change(value);
                }
            },
            false,
        );
        field.on(
            "change",
            () => {
                show(value);
                commit();
            },
            false,
        );
        return { field, show };
    }

    // Both values together while linked.
    function pair(
        rows: DOMElement,
        key: MessageKey,
        values: Pair,
        range: Range,
        change: (values: Pair) => void,
        auto = false,
    ): void {
        let linked = values[0] === values[1];
        const cells: ReturnType<typeof number>[] = [];
        const link = $.create("button")
            .cls("dge-link")
            .att("type", "button")
            .att("title", message("link"))
            .att("aria-label", message("link"))
            .att("aria-pressed", String(linked))
            .append(LINK_ICON);
        fields.push(link);
        link.on("click", () => {
            linked = !linked;
            link.att("aria-pressed", String(linked));
            if (!linked || values[0] === values[1]) return;
            values = [values[0], values[0]];
            cells[1].show(values[0]);
            change(values);
            commit();
        });
        pairRow(
            rows,
            key,
            (axis, name) => {
                const cell = number(
                    name,
                    values[axis],
                    range,
                    (value) => {
                        values = linked
                            ? [value, value]
                            : axis
                              ? [values[0], value]
                              : [value, values[1]];
                        if (linked) cells[1 - axis].show(value);
                        change(values);
                    },
                    auto,
                );
                cells.push(cell);
                return cell.field;
            },
            link,
        );
    }

    function color(
        name: string,
        value: string,
        change: (value: string) => void,
    ): DOMElement {
        const field = $.create("input")
            .att("type", "color")
            .att("aria-label", name);
        const input = field.dom() as HTMLInputElement;
        input.value = hexColor(value);
        fields.push(field);
        field.on("input", () => change(input.value), false);
        field.on("change", commit, false);
        return field;
    }

    function text(
        name: string,
        value: string,
        change: (value: string) => void,
        list?: string,
    ): DOMElement {
        const field = $.create("input")
            .att("type", "text")
            .att("spellcheck", "false")
            .att("aria-label", name);
        if (list) field.att("list", list);
        const input = field.dom() as HTMLInputElement;
        input.value = value;
        fields.push(field);
        field.on("input", () => change(input.value), false);
        field.on("change", commit, false);
        return field;
    }

    // Buttons, one pressed. `face`: an icon, or else a text.
    function choices<T>(
        name: string,
        value: T,
        faces: [T, string, string][],
        change: (value: T) => void,
    ): DOMElement {
        const same = (a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);
        const group = $.create("div")
            .cls("dge-segmented")
            .att("role", "group")
            .att("aria-label", name);
        const buttons = faces.map(([choice, face, title]) => {
            const button = $.create("button")
                .att("type", "button")
                .att("title", title)
                .att("aria-label", title)
                .att("aria-pressed", String(same(choice, value)));
            if (face.startsWith("<")) button.append(face);
            else button.text(face);
            button.on("click", () => {
                value = choice;
                buttons.forEach((other, index) =>
                    other.att(
                        "aria-pressed",
                        String(same(faces[index][0], choice)),
                    ),
                );
                change(choice);
                commit();
            });
            fields.push(button);
            return button;
        });
        return group.add(...buttons);
    }

    function select(
        key: MessageKey,
        value: number,
        items: [number, string][],
        change: (value: number) => void,
    ): DOMElement {
        const field = $.create("select").att("aria-label", message(key));
        items.forEach(([choice, text]) =>
            field.add($.create("option").att("value", choice).text(text)),
        );
        (field.dom() as HTMLSelectElement).value = String(value);
        fields.push(field);
        field.on(
            "change",
            () => {
                change(Number((field.dom() as HTMLSelectElement).value));
                commit();
            },
            false,
        );
        return field;
    }

    // In 3D, for the trihedron alone.
    const shown: [boolean, (on: boolean) => void] = [
        grid.hidden === 0,
        (on) => {
            box.toggleClass("dge-coords-off", !on);
            grid.hidden = on ? 0 : 1;
            redraw(true);
        },
    ];
    box.toggleClass("dge-coords-off", grid.hidden !== 0);
    let followAxes = (_color: string) => {};
    const axesStyle = (rows: DOMElement) => {
        row(
            rows,
            "color",
            byDefault(
                message("color"),
                grid.stroke_color,
                DGPAD.stroke_color,
                draw((value) => {
                    grid.stroke_color = value;
                    followAxes(value);
                }),
            ),
        );
        row(
            rows,
            "thickness",
            number(
                message("thickness"),
                grid.size,
                [0, 10, 0.5, { pixel: 0.025 }],
                draw((value) => (grid.size = value)),
            ).field,
        );
    };

    // A color, back to `initial` (null) by a button that `title` names.
    function resettable(
        name: string,
        title: MessageKey,
        value: string | null,
        initial: string,
        change: (value: string | null) => void,
    ): { field: DOMElement; follow: (value: string) => void } {
        let chosen = value !== null;
        const swatch = color(name, value ?? initial, (next) => {
            chosen = true;
            change(next);
            reset.stl("visibility", "visible");
        });
        const reset = $.create("button")
            .cls("dge-reset")
            .att("type", "button")
            .att("title", message(title))
            .att("aria-label", message(title))
            .stl("visibility", chosen ? "visible" : "hidden")
            .append(RESET_ICON);
        fields.push(reset);
        const input = swatch.dom() as HTMLInputElement;
        reset.on("click", () => {
            chosen = false;
            input.value = hexColor(initial);
            reset.stl("visibility", "hidden");
            change(null);
            commit();
        });
        return {
            field: $.create("div").cls("dge-view-color").add(reset, swatch),
            follow: (next) => {
                initial = next;
                if (!chosen) input.value = hexColor(next);
            },
        };
    }

    // A color, back to `initial` by its button.
    const byDefault = (
        name: string,
        value: string,
        initial: string,
        change: (value: string) => void,
    ) =>
        resettable(
            name,
            "default_color",
            hexColor(value) === hexColor(initial) ? null : value,
            initial,
            (next) => change(next ?? initial),
        ).field;

    if (grid.is2D) {
        const coords = section("coords", shown);
        const presets = $.create("div").cls("dge-presets");
        const buttons = PRESETS.map(([key, preset]) => {
            const looks = { ...DGPAD, ...preset };
            const button = $.create("button")
                .att("type", "button")
                .append(thumbnail(looks, c.prefs.background.color))
                .add($.create("span").text(message(key)));
            fields.push(button);
            button.on("click", () => {
                Object.assign(grid, structuredClone(looks));
                grid.hidden = 0;
                redraw(true);
                commit();
                options.rebuild();
            });
            presets.add(button);
            return [button, JSON.stringify(looks)] as const;
        });
        showPreset = () => {
            const current = JSON.stringify(looksOf(grid));
            buttons.forEach(([button, looks]) =>
                button.att("aria-pressed", String(looks === current)),
            );
        };
        showPreset();
        coords.add(presets);

        const axes = section("axes_section", undefined, true);
        axisHeader(axes);
        pairRow(axes, "show_axis", (axis, name) =>
            checkbox(
                name,
                axis ? grid.showOy : grid.showOx,
                draw((value) => {
                    if (axis) grid.showOy = value;
                    else grid.showOx = value;
                }),
            ),
        );
        const texts = (
            key: MessageKey,
            values: [string, string],
            change: (values: [string, string]) => void,
            list?: string,
        ) =>
            pairRow(axes, key, (axis, name) =>
                text(
                    name,
                    values[axis],
                    draw((value) => {
                        values = [...values];
                        values[axis] = value;
                        change(values);
                    }),
                    list,
                ),
            );
        texts(
            "axis_name",
            grid.axisLabels,
            (values) => (grid.axisLabels = values),
        );
        pairRow(axes, "numbers", (axis, name) =>
            checkbox(
                name,
                grid.showNumbers[axis],
                draw((value) => {
                    const shown: [boolean, boolean] = [...grid.showNumbers];
                    shown[axis] = value;
                    grid.showNumbers = shown;
                }),
            ),
        );
        // A unit of π writes the numbers as its multiples.
        const units = `dge-units-${Math.random().toString(36).slice(2)}`;
        box.add(
            $.create("datalist")
                .att("id", units)
                .add(
                    ...["π", "°", "cm"].map((unit) =>
                        $.create("option").att("value", unit),
                    ),
                ),
        );
        texts(
            "unit",
            grid.axisUnits,
            (values) => (grid.axisUnits = values),
            units,
        );
        pairRow(axes, "ticks", (axis, name) =>
            choices(
                name,
                grid.tickStyles[axis],
                (["ticks_all", "ticks_major", "ticks_none"] as const).map(
                    (key, style) => [
                        style,
                        ticksIcon(style, axis),
                        message(key),
                    ],
                ),
                draw((style) => {
                    const styles: Pair = [...grid.tickStyles];
                    styles[axis] = style;
                    grid.tickStyles = styles;
                }),
            ),
        );
        pair(
            axes,
            "tick_distance",
            [...grid.tickDistances],
            [0, 1000, 0.001, { pixel: 0.01, relative: true }],
            draw((values) => (grid.tickDistances = values)),
            true,
        );
        row(
            axes,
            "arrows",
            choices(
                message("arrows"),
                grid.arrows,
                (
                    [
                        "arrows_dgpad",
                        "arrows_none",
                        "arrows_open",
                        "arrows_filled",
                    ] as const
                ).map((key, arrows) => [
                    arrows,
                    ARROW_ICONS[arrows],
                    message(key),
                ]),
                draw((value) => (grid.arrows = value)),
            ),
        );
        axesStyle(axes);
        row(
            axes,
            "numbers_size",
            number(
                message("numbers_size"),
                grid.fontSize,
                [6, 72, 1, { pixel: 0.1 }],
                draw((value) => (grid.fontSize = value)),
            ).field,
        );
        row(
            axes,
            "bold_numbers",
            checkbox(
                message("bold_numbers"),
                grid.boldNumbers,
                draw((value) => (grid.boldNumbers = value)),
            ),
        );
        row(
            axes,
            "ticks_style",
            choices(
                message("ticks_style"),
                grid.geogebraAxes,
                [
                    [false, "DGPad", "DGPad"],
                    [true, "GeoGebra", "GeoGebra"],
                ],
                draw((value) => (grid.geogebraAxes = value)),
            ),
        );
        row(
            axes,
            "positive_only",
            checkbox(
                message("positive_only"),
                grid.onlyPositive,
                draw((value) => (grid.onlyPositive = value)),
            ),
        );

        const lines = section(
            "grid_section",
            [grid.showGrid, draw((on) => (grid.showGrid = on))],
            true,
        );
        axisHeader(lines);
        pair(
            lines,
            "grid_distance",
            [...grid.gridDistances],
            [0, 1000, 0.001, { pixel: 0.01, relative: true }],
            draw((values) => (grid.gridDistances = values)),
            true,
        );
        const subdivisions = SUBDIVISIONS.includes(grid.gridSubdivisions)
            ? SUBDIVISIONS
            : [...SUBDIVISIONS, grid.gridSubdivisions].sort((a, b) => a - b);
        row(
            lines,
            "subdivisions",
            select(
                "subdivisions",
                grid.gridSubdivisions,
                subdivisions.map((n) => [
                    n,
                    n === 0
                        ? message("auto")
                        : n === 1
                          ? message("none")
                          : String(n),
                ]),
                draw((value) => (grid.gridSubdivisions = value)),
            ),
        );
        const gridColor = resettable(
            message("grid_color"),
            "same_as_axes",
            grid.gridColor,
            grid.stroke_color,
            draw((value) => (grid.gridColor = value)),
        );
        followAxes = gridColor.follow;
        row(lines, "color", gridColor.field);
        row(
            lines,
            "thickness",
            number(
                message("grid_width"),
                grid.gridWidth,
                [0, 10, 0.1, { pixel: 0.01 }],
                draw((value) => (grid.gridWidth = value)),
            ).field,
        );
        row(
            lines,
            "line_style",
            choices(
                message("line_style"),
                grid.gridDash,
                DASHES.map(([dash, key]) => [
                    dash,
                    dashIcon(dash),
                    message(key),
                ]),
                draw((dash) => (grid.gridDash = dash)),
            ),
        );

        const view = section("navigation", undefined, true);
        axisHeader(view);
        pairRow(view, "axis_fixed", (axis, name) =>
            checkbox(name, axis ? grid.lockOy : grid.lockOx, (value) => {
                if (axis) grid.lockOy = value;
                else grid.lockOx = value;
            }),
        );
        row(
            view,
            "center_zoom",
            checkbox(message("center_zoom"), grid.centerZoom, (value) => {
                grid.centerZoom = value;
            }),
        );
    } else {
        axesStyle(section("axes_section", shown));
        const floor = section("floor", [
            grid.SHOWFLOOR,
            draw((on) => (grid.SHOWFLOOR = on), true),
        ]);
        let followFloor = (_color: string) => {};
        row(
            floor,
            "color",
            resettable(
                message("floor_color"),
                "floor_colors",
                grid.floorColor,
                FLOOR_COLOR,
                draw((value) => {
                    grid.floorColor = value;
                    followFloor(value ?? FLOOR_COLOR);
                }),
            ).field,
        );
        row(
            floor,
            "opacity",
            number(
                message("opacity"),
                grid.floorOpacity,
                [0, 1, 0.05, { pixel: 0.005 }],
                draw((value) => (grid.floorOpacity = value)),
            ).field,
        );
        row(
            floor,
            "floor_size",
            number(
                message("floor_size"),
                grid.floorExtent * 2,
                [1, 200, 1, { pixel: 0.1 }],
                draw((value) => (grid.floorExtent = value / 2), true),
            ).field,
        );
        row(
            floor,
            "grid_distance",
            number(
                message("grid_distance"),
                grid.floorStep,
                [0, 100, 0.05, { pixel: 0.01, relative: true }],
                draw((value) => (grid.floorStep = value)),
            ).field,
        );
        const lineColor = resettable(
            message("floor_line_color"),
            "same_as_floor",
            grid.floorLineColor,
            grid.floorColor ?? FLOOR_COLOR,
            draw((value) => (grid.floorLineColor = value)),
        );
        followFloor = lineColor.follow;
        row(floor, "floor_line_color", lineColor.field);
        row(
            floor,
            "floor_line_width",
            number(
                message("floor_line_width"),
                grid.floorLineWidth,
                [0, 10, 0.1, { pixel: 0.01 }],
                draw((value) => (grid.floorLineWidth = value)),
            ).field,
        );
        const view = section("view_section");
        row(
            view,
            "perspective",
            checkbox(
                message("perspective"),
                grid.PERSPECTIVE,
                draw((value) => (grid.PERSPECTIVE = value), true),
            ),
        );
    }

    const figure = section("figure_section");
    row(
        figure,
        "background",
        byDefault(
            message("background"),
            c.prefs.background.color,
            BACKGROUND,
            (value) => {
                c.prefs.background.color = value;
                c.svg.stl("background", value);
                redraw();
            },
        ),
    );
    row(
        figure,
        "angles",
        choices(
            message("angles"),
            c.degrees,
            [
                [true, message("degrees"), message("degrees")],
                [false, message("radians"), message("radians")],
            ],
            (value) => options.figure({ deg: +value }),
        ),
    );
    row(
        figure,
        "segments_over",
        checkbox(message("segments_over"), c.segmentsOverPolygons, (value) =>
            options.figure({ sop: +value }),
        ),
    );
    return fields;
}
