import * as Blockly from "blockly/core";
import "blockly/blocks";
import type { Program } from "../../import/dgp_formula";
import { BLOCK_MESSAGES, type BlockMessage } from "./messages";
import {
    blocksProgram,
    FONT_ALIGNS,
    FONT_STYLES,
    programBlocks,
    STYLE_METHODS,
    TURTLE_FONTS,
    type WorkspaceState,
} from "./program_blocks";

// The figure the blocks name objects of, in the editor's language.
export interface BlocksFigure {
    lang: string;
    // A name as a program writes it.
    format(name: string): string;
    objects(): string[];
    // The names the turtles are known by (see TURTLE_GET).
    turtles(): string[];
    // DGPad's Blockly globals, which the figure's programs share.
    globals(): string[];
}

// Blockly's texts, by DocGeo's language.
const LOCALES: Record<string, () => Promise<object>> = {
    ar: () => import("blockly/msg/ar"),
    de: () => import("blockly/msg/de"),
    el: () => import("blockly/msg/el"),
    en: () => import("blockly/msg/en"),
    es: () => import("blockly/msg/es"),
    fr: () => import("blockly/msg/fr"),
    hi: () => import("blockly/msg/hi"),
    it: () => import("blockly/msg/it"),
    nl: () => import("blockly/msg/nl"),
    pt: () => import("blockly/msg/pt"),
    zh: () => import("blockly/msg/zh-hans"),
    "zh-TW": () => import("blockly/msg/zh-hant"),
};

// As Scratch's: the block, its menus a little darker, its outline darker
// still, which sets apart the blocks of a stack.
const TURTLE = ["#0d9488", "#0b8277", "#086b62"];
const FIGURE = ["#b45309", "#9e4808", "#813b06"];
const PROGRAM = ["#2563eb", "#1f55cf", "#1a46ab"];
// DGPad's, for its globals.
const GLOBAL = ["#4f7fa0", "#456f8c", "#3a5e77"];
// Where a program starts: Scratch's "when the green flag is clicked".
const START = ["#ffbf00", "#e6ac00", "#cc9900"];

let figure: BlocksFigure;
// The globals created in the blocks, the figure's once a program sets them.
const created = new Set<string>();
const globals = () => [...new Set([...figure.globals(), ...created])];

const options = (names: string[]): Blockly.MenuOption[] =>
    names.length ? names.map((name) => [name, name]) : [["?", ""]];

// The objects of the figure a dropdown chooses among.
function objectField(list: () => string[]): () => Blockly.MenuOption[] {
    return () => options(list());
}

const msg = (key: BlockMessage) => `%{BKY_DG_${key}}`;

const statement = { previousStatement: null, nextStatement: null };

const number = (name: string) => ({
    type: "input_value",
    name,
    check: ["Number", "String", "Array"],
});

const choice = (name: string, keys: [BlockMessage, string][]) => ({
    type: "field_dropdown",
    name,
    options: keys.map(([key, value]) => [msg(key), value]),
});

// DocGeo's blocks: the turtle's DGPad had, and what reads the figure.
function defineBlocks(): void {
    const turtle = { ...statement, style: "turtle_blocks" };
    Blockly.common.defineBlocksWithJsonArray([
        {
            type: "dg_turtle",
            message0: msg("TURTLE"),
            args0: [{ type: "field_label_serializable", name: "POINT" }],
            nextStatement: null,
            style: "start_blocks",
        },
        {
            type: "dg_program",
            message0: msg("PROGRAM"),
            nextStatement: null,
            style: "start_blocks",
        },
        {
            type: "dg_return",
            message0: msg("RETURN"),
            args0: [{ type: "input_value", name: "VALUE" }],
            previousStatement: null,
            style: "program_blocks",
        },
        {
            type: "turtle_move",
            message0: msg("MOVE"),
            args0: [
                choice("DIR", [
                    ["FORWARD", "forward"],
                    ["BACKWARD", "backward"],
                ]),
                number("VALUE"),
                choice("UNITS", [
                    ["PIXELS", "px"],
                    ["UNITS", "un"],
                ]),
            ],
            inputsInline: true,
            ...turtle,
        },
        {
            type: "turtle_turn",
            message0: msg("TURN"),
            args0: [
                choice("DIR", [
                    ["LEFT", "left"],
                    ["RIGHT", "right"],
                ]),
                number("VALUE"),
            ],
            inputsInline: true,
            ...turtle,
        },
        {
            type: "turtle_rotate",
            message0: msg("ROTATE"),
            args0: [
                choice("DIR", [
                    ["UP", "up"],
                    ["DOWN", "down"],
                    ["LEFT", "left"],
                    ["RIGHT", "right"],
                ]),
                number("VALUE"),
            ],
            inputsInline: true,
            ...turtle,
        },
        {
            type: "turtle_pen",
            message0: "%1",
            args0: [
                choice("PEN", [
                    ["PEN_UP", "up"],
                    ["PEN_DOWN", "down"],
                ]),
            ],
            ...turtle,
        },
        ...(
            [
                ["turtle_colour", "COLOUR", "N"],
                ["turtle_colour_rgb", "COLOUR_RGB", "RGB"],
                ["turtle_colour_increment", "COLOUR_INCREMENT", "COL"],
                ["turtle_fill", "FILL", "OP"],
                ["turtle_print", "PRINT", "TEXT"],
                ["turtle_turn_pt", "TURN_PT", "VALUE"],
                ["turtle_join_pt", "JOIN_PT", "VALUE"],
                ["turtle_precision", "PRECISION", "N"],
            ] as [string, BlockMessage, string][]
        ).map(([type, key, input]) => ({
            type,
            message0: msg(key),
            args0: [{ type: "input_value", name: input }],
            inputsInline: true,
            ...turtle,
        })),
        ...(
            [
                ["turtle_width", "WIDTH"],
                ["turtle_width_increment", "WIDTH_INCREMENT"],
            ] as [string, BlockMessage][]
        ).map(([type, key]) => ({
            type,
            message0: msg(key),
            args0: [
                choice("WHAT", [
                    ["PEN_WIDTH", "pen"],
                    ["POINT_SIZE", "points"],
                ]),
                number("WIDTH"),
            ],
            inputsInline: true,
            ...turtle,
        })),
        {
            type: "turtle_font",
            message0: msg("FONT"),
            args0: [
                {
                    type: "field_dropdown",
                    name: "FONT",
                    options: TURTLE_FONTS.map((font) => [font, font]),
                },
                { type: "field_number", name: "SIZE", value: 20, min: 1 },
                choice(
                    "STYLE",
                    FONT_STYLES.map((style) => [
                        style.toUpperCase() as BlockMessage,
                        style,
                    ]),
                ),
                choice("ALIGN", [
                    ["CENTER", "center"],
                    ["LEFT", "left"],
                    ["RIGHT", "right"],
                ] satisfies [BlockMessage, (typeof FONT_ALIGNS)[number]][]),
            ],
            ...turtle,
        },
        {
            type: "turtle_image",
            message0: msg("IMAGE"),
            args0: ["URL", "W", "H", "Z", "O"].map((name) => ({
                type: "input_value",
                name,
            })),
            ...turtle,
        },
        { type: "turtle_reset", message0: msg("RESET"), ...turtle },
        {
            type: "turtle_position",
            message0: msg("POSITION"),
            output: "Array",
            style: "turtle_blocks",
        },
        {
            type: "turtle_get",
            message0: msg("GET"),
            args0: [number("NUM"), { type: "input_dummy", name: "NAME" }],
            inputsInline: true,
            output: "Array",
            style: "turtle_blocks",
            extensions: ["dg_turtle_name"],
        },
        {
            type: "turtle_length",
            message0: msg("LENGTH"),
            args0: [{ type: "input_dummy", name: "NAME" }],
            output: "Number",
            style: "turtle_blocks",
            extensions: ["dg_turtle_name"],
        },
        {
            type: "dg_object",
            message0: "%1",
            args0: [{ type: "input_dummy", name: "NAME" }],
            output: null,
            style: "figure_blocks",
            extensions: ["dg_object_name"],
        },
        {
            type: "dg_point",
            message0: msg("POINT"),
            args0: [number("X"), number("Y")],
            inputsInline: true,
            output: "Array",
            style: "figure_blocks",
        },
        {
            type: "dg_point3",
            message0: msg("POINT3"),
            args0: [number("X"), number("Y"), number("Z")],
            inputsInline: true,
            output: "Array",
            style: "figure_blocks",
        },
        {
            type: "dg_coordinate",
            message0: msg("COORDINATE"),
            args0: [
                choice("AXIS", [
                    ["ABSCISSA", "x"],
                    ["ORDINATE", "y"],
                ]),
                { type: "input_value", name: "POINT" },
            ],
            inputsInline: true,
            output: "Number",
            style: "figure_blocks",
        },
        {
            type: "dg_distance",
            message0: msg("DISTANCE"),
            args0: [
                { type: "input_value", name: "A" },
                { type: "input_value", name: "B" },
            ],
            inputsInline: true,
            output: "Number",
            style: "figure_blocks",
        },
        {
            type: "dg_degrees",
            message0: msg("DEGREES"),
            args0: [number("VALUE")],
            inputsInline: true,
            output: "Number",
            style: "math_blocks",
        },
        {
            type: "dg_style",
            message0: msg("STYLE"),
            args0: [
                choice(
                    "METHOD",
                    STYLE_METHODS.map((method) => [
                        STYLE_LABELS[method],
                        method,
                    ]),
                ),
                { type: "input_dummy", name: "OBJECT" },
                number("VALUE"),
            ],
            inputsInline: true,
            ...statement,
            style: "figure_blocks",
            extensions: ["dg_style_object"],
        },
        {
            type: "dg_global_get",
            message0: msg("GLOBAL_GET"),
            args0: [{ type: "input_dummy", name: "NAME" }],
            output: null,
            style: "global_blocks",
            extensions: ["dg_global_name"],
        },
        ...(
            [
                ["dg_global_set", "GLOBAL_SET", "VALUE"],
                ["dg_global_inc", "GLOBAL_INC", "DELTA"],
            ] as [string, BlockMessage, string][]
        ).map(([type, key, input]) => ({
            type,
            message0: msg(key),
            args0: [
                { type: "input_dummy", name: "NAME" },
                { type: "input_value", name: input },
            ],
            inputsInline: true,
            ...statement,
            style: "global_blocks",
            extensions: ["dg_global_name"],
        })),
        {
            type: "dg_style_rgb",
            message0: msg("STYLE_RGB"),
            args0: [
                { type: "input_dummy", name: "OBJECT" },
                number("R"),
                number("G"),
                number("B"),
            ],
            inputsInline: true,
            ...statement,
            style: "figure_blocks",
            extensions: ["dg_style_object"],
        },
    ]);
}

const STYLE_LABELS: Record<string, BlockMessage> = {
    setHidden: "HIDDEN",
    setShowName: "SHOW_NAME",
    setOpacity: "OPACITY",
    setSize: "SIZE",
    setPrecision: "DECIMALS",
    setIncrement: "INCREMENT",
    setLayer: "LAYER",
    setDash: "DASH",
};

// A dropdown of the figure's objects, appended to the input named as its
// field.
function registerObjectFields(): void {
    const field = (name: string, list: () => string[]) =>
        function (this: Blockly.Block) {
            this.getInput(name)!.appendField(
                new Blockly.FieldDropdown(objectField(list)),
                name,
            );
        };
    Blockly.Extensions.register(
        "dg_object_name",
        field("NAME", () => figure.objects()),
    );
    Blockly.Extensions.register(
        "dg_style_object",
        field("OBJECT", () => figure.objects()),
    );
    Blockly.Extensions.register(
        "dg_turtle_name",
        field("NAME", () => figure.turtles()),
    );
    Blockly.Extensions.register("dg_global_name", field("NAME", globals));
}

const shadow = (type: string, fields: Record<string, unknown>) => ({
    shadow: { type, fields },
});
const num = (value: number) => shadow("math_number", { NUM: value });
const block = (type: string, inputs?: Record<string, unknown>) => ({
    kind: "block",
    type,
    ...(inputs && { inputs }),
});

function toolbox(turtle: boolean) {
    const text = (key: BlockMessage) => Blockly.Msg[`DG_${key}`];
    return {
        kind: "categoryToolbox",
        contents: [
            ...(turtle
                ? [
                      {
                          kind: "category",
                          name: text("CAT_TURTLE"),
                          categorystyle: "turtle_category",
                          contents: [
                              block("turtle_move", { VALUE: num(50) }),
                              block("turtle_turn", { VALUE: num(90) }),
                              block("turtle_pen"),
                              block("turtle_colour", { N: num(1) }),
                              block("turtle_colour_increment", {
                                  COL: num(1),
                              }),
                              block("turtle_width", { WIDTH: num(3) }),
                              block("turtle_width_increment", {
                                  WIDTH: num(1),
                              }),
                              block("turtle_fill", { OP: num(50) }),
                              block("turtle_print", {
                                  TEXT: shadow("text", { TEXT: "" }),
                              }),
                              block("turtle_font"),
                              block("turtle_turn_pt"),
                              block("turtle_join_pt"),
                              block("turtle_reset"),
                              block("turtle_position"),
                              block("turtle_get", { NUM: num(1) }),
                              block("turtle_length"),
                              block("turtle_rotate", { VALUE: num(90) }),
                              block("turtle_precision", { N: num(2) }),
                          ],
                      },
                  ]
                : []),
            {
                kind: "category",
                name: text("CAT_LOOPS"),
                categorystyle: "loop_category",
                contents: [
                    block("controls_repeat_ext", { TIMES: num(4) }),
                    block("controls_for", {
                        FROM: num(1),
                        TO: num(10),
                        BY: num(1),
                    }),
                    block("controls_whileUntil"),
                ],
            },
            {
                kind: "category",
                name: text("CAT_LOGIC"),
                categorystyle: "logic_category",
                contents: [
                    block("controls_if"),
                    {
                        ...block("controls_if"),
                        extraState: { hasElse: true },
                    },
                    block("logic_compare"),
                    block("logic_operation"),
                    block("logic_negate"),
                    block("logic_boolean"),
                    block("logic_ternary"),
                ],
            },
            {
                kind: "category",
                name: text("CAT_MATH"),
                categorystyle: "math_category",
                contents: [
                    block("math_number"),
                    block("math_arithmetic", { A: num(1), B: num(1) }),
                    block("math_single", { NUM: num(9) }),
                    block("math_trig", { NUM: num(45) }),
                    block("math_constant"),
                    block("math_round", { NUM: num(3.1) }),
                    block("math_modulo", {
                        DIVIDEND: num(64),
                        DIVISOR: num(10),
                    }),
                    block("dg_degrees", { VALUE: num(90) }),
                ],
            },
            {
                kind: "category",
                name: text("CAT_TEXT"),
                categorystyle: "text_category",
                contents: [block("text"), block("text_join")],
            },
            {
                kind: "category",
                name: text("CAT_VARIABLES"),
                categorystyle: "variable_category",
                custom: "VARIABLE",
            },
            {
                kind: "category",
                name: text("CAT_GLOBALS"),
                categorystyle: "global_category",
                custom: "DG_GLOBALS",
            },
            {
                kind: "category",
                name: text("CAT_FUNCTIONS"),
                categorystyle: "procedure_category",
                custom: "PROCEDURE",
            },
            {
                kind: "category",
                name: text("CAT_FIGURE"),
                categorystyle: "figure_category",
                contents: [
                    block("dg_object"),
                    block("dg_coordinate"),
                    block("dg_distance"),
                    block("dg_point", { X: num(0), Y: num(0) }),
                    block("dg_point3", { X: num(0), Y: num(0), Z: num(0) }),
                    block("dg_style", { VALUE: num(1) }),
                    block("dg_style_rgb", {
                        R: num(0),
                        G: num(0),
                        B: num(255),
                    }),
                    ...(turtle ? [] : [block("dg_return", { VALUE: num(0) })]),
                ],
            },
        ],
    };
}

const style = ([primary, secondary, tertiary]: string[]) => ({
    colourPrimary: primary,
    colourSecondary: secondary,
    colourTertiary: tertiary,
    hat: "",
});

function theme(): Blockly.Theme {
    return Blockly.Theme.defineTheme("docgeo", {
        name: "docgeo",
        base: Blockly.Themes.Zelos,
        blockStyles: {
            turtle_blocks: style(TURTLE),
            figure_blocks: style(FIGURE),
            program_blocks: style(PROGRAM),
            start_blocks: style(START),
            global_blocks: style(GLOBAL),
        },
        categoryStyles: {
            turtle_category: { colour: TURTLE[0] },
            figure_category: { colour: FIGURE[0] },
            global_category: { colour: GLOBAL[0] },
        },
        componentStyles: {
            workspaceBackgroundColour: "#ffffff",
            toolboxBackgroundColour: "#f8fafc",
            toolboxForegroundColour: "#334155",
            flyoutBackgroundColour: "#f1f5f9",
            flyoutForegroundColour: "#334155",
            flyoutOpacity: 0.96,
            scrollbarColour: "#cbd5e1",
            scrollbarOpacity: 0.8,
        },
        fontStyle: {
            family: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            weight: "600",
            size: 11,
        },
        startHats: true,
    });
}

export interface BlocksEditor {
    // Shows the program's blocks: false when it has none.
    load(program: Program, degrees: boolean): boolean;
    // The program the blocks write.
    readonly written: string;
    // The field being typed in, its editor closed by the panel built again,
    // edited again as it was.
    resume(): void;
}

// The workspace, in `host`, `changed` told the program its blocks write
// after each change, once the user is no longer dragging or typing.
export async function blocksEditor(
    host: HTMLElement,
    owner: BlocksFigure,
    changed: (source: string) => void,
): Promise<BlocksEditor> {
    figure = owner;
    const { lang, format } = owner;
    const texts = await (LOCALES[lang] ?? LOCALES.en)();
    Blockly.setLocale(
        Object.fromEntries(
            Object.entries(texts).filter(
                ([, text]) => typeof text === "string",
            ),
        ),
    );
    const own = BLOCK_MESSAGES[lang] ?? BLOCK_MESSAGES.en;
    Object.entries(own).forEach(([key, text]) => {
        Blockly.Msg[`DG_${key}`] = text;
    });
    registerObjectFields();
    defineBlocks();
    // Procedures without a value only: DGPad's turtles have no other.
    delete Blockly.Blocks.procedures_defreturn;
    delete Blockly.Blocks.procedures_ifreturn;
    const workspace = Blockly.inject(host, {
        renderer: "zelos",
        theme: theme(),
        toolbox: toolbox(true),
        trashcan: false,
        sounds: false,
        media: "./",
        rtl: lang === "ar",
        zoom: { controls: false, wheel: true, startScale: 0.7 },
        move: { scrollbars: true, drag: true, wheel: false },
    });
    // A button creating a global, then its blocks once there is one.
    workspace.registerToolboxCategoryCallback(
        "DG_GLOBALS",
        () =>
            [
                {
                    kind: "button",
                    text: Blockly.Msg.DG_NEW_GLOBAL,
                    callbackkey: "DG_NEW_GLOBAL",
                },
                ...(globals().length
                    ? [
                          block("dg_global_set", { VALUE: num(0) }),
                          block("dg_global_inc", { DELTA: num(1) }),
                          block("dg_global_get"),
                      ]
                    : []),
            ] as Blockly.utils.toolbox.FlyoutItemInfoArray,
    );
    workspace.registerButtonCallback("DG_NEW_GLOBAL", () =>
        Blockly.dialog.prompt(Blockly.Msg.NEW_VARIABLE_TITLE, "", (name) => {
            if (!name?.trim()) return;
            created.add(name.trim());
            workspace.refreshToolboxSelection();
        }),
    );
    // Moved from panel to panel, or the panel resized.
    new ResizeObserver(() => Blockly.svgResize(workspace)).observe(host);
    let written = "";
    let timer = 0;
    // Plugging a block in, choosing in a dropdown or typing a number all
    // end in a change of the program the blocks write: a number or a text as
    // it is typed, as in DGPad.
    const settle = () => {
        clearTimeout(timer);
        timer = window.setTimeout(() => {
            if (workspace.isDragging() || Blockly.DropDownDiv.isVisible())
                return settle();
            const program = blocksProgram(
                Blockly.serialization.workspaces.save(
                    workspace,
                ) as WorkspaceState,
                format,
            );
            if (program === null || program === written) return;
            written = program;
            const input = Blockly.WidgetDiv.getDiv()?.querySelector("input");
            typing = input && edited ? { field: edited, input } : null;
            changed(program);
        }, 250);
    };
    // The field being typed in when its program was applied: the panel, built
    // again, takes the workspace out of the page, which closes its editor.
    let edited: Blockly.Field | null = null;
    let typing: { field: Blockly.Field; input: HTMLInputElement } | null = null;
    workspace.addChangeListener((event) => {
        if (event.type === Blockly.Events.BLOCK_FIELD_INTERMEDIATE_CHANGE) {
            const { blockId, name } =
                event as Blockly.Events.BlockFieldIntermediateChange;
            edited = workspace.getBlockById(blockId!)!.getField(name!);
        }
        if (!event.isUiEvent) settle();
    });
    return {
        load(program, degrees) {
            const state = programBlocks(program, degrees);
            if (!state) return false;
            Blockly.Events.disable();
            Blockly.serialization.workspaces.load(state, workspace);
            // Its procedures under it.
            if (state.blocks!.blocks.length > 1) workspace.cleanUp();
            Blockly.Events.enable();
            const turtle = state.blocks!.blocks[0].type === "dg_turtle";
            workspace.updateToolbox(toolbox(turtle));
            // Its first block clear of the edge, its top rounded as a hat.
            workspace.scroll(workspace.scrollX + 12, workspace.scrollY + 16);
            written = blocksProgram(state, format)!;
            return true;
        },
        get written() {
            return written;
        },
        resume() {
            if (!typing || Blockly.WidgetDiv.isVisible()) return;
            const { field, input } = typing;
            typing = null;
            field.showEditor();
            Blockly.WidgetDiv.getDiv()!
                .querySelector("input")!
                .setSelectionRange(input.selectionStart, input.selectionEnd);
        },
    };
}
