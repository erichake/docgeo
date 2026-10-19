import * as Blockly from "blockly/core";
import "blockly/blocks";
import type { Program } from "../../import/dgp_formula";
import { BLOCK_MESSAGES, type BlockMessage } from "./messages";
import {
    blocksProgram,
    EVENT_HATS,
    FONT_ALIGNS,
    FONT_STYLES,
    programBlocks,
    stackState,
    STYLE_METHODS,
    TURTLE_FONTS,
    type BlockState,
    type WorkspaceState,
} from "./program_blocks";
import type { ProgramHat } from "./view";

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
    // Asks a text to type (`value`), or a confirmation, null when
    // cancelled.
    dialog(
        question: { text: string; value?: string; ok: string; cancel?: string },
        done: (answer: string | null) => void,
    ): void;
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
// The objects the programs shown name, the figure's or not (DGPad sets
// nothing of an object it lacks): their dropdowns keep them.
const named = new Set<string>();
const objects = () => [...new Set([...figure.objects(), ...named])];

function nameObjects(block: BlockState | undefined): void {
    if (!block) return;
    const { NAME, OBJECT } = block.fields ?? {};
    if (block.type.startsWith("dg_global_")) created.add(String(NAME));
    else if (block.type === "dg_object") named.add(String(NAME));
    else if (OBJECT !== undefined) named.add(String(OBJECT));
    Object.values(block.inputs ?? {}).forEach((input) =>
        nameObjects(input.block),
    );
    nameObjects(block.next?.block);
}

const options = (names: string[]): Blockly.MenuOption[] =>
    names.length ? names.map((name) => [name, name]) : [["?", ""]];

// The objects of the figure a dropdown chooses among.
function objectField(list: () => string[]): () => Blockly.MenuOption[] {
    return () => options(list());
}

const msg = (key: BlockMessage) => `%{BKY_DG_${key}}`;

const EVENT_MESSAGES: Record<string, BlockMessage> = {
    drag: "WHEN_DRAGGED",
    down: "WHEN_PRESSED",
    up: "WHEN_RELEASED",
    change: "WHEN_CHANGED",
    init: "WHEN_OPENED",
};

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
        // Of the object whose programs show, said in one label.
        ...Object.values(EVENT_HATS).map((type) => ({
            type,
            message0: "%1",
            args0: [{ type: "field_label_serializable", name: "TEXT" }],
            nextStatement: null,
            style: "start_blocks",
        })),
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
            type: "dg_set_value",
            message0: msg("SET_VALUE"),
            args0: [
                { type: "input_dummy", name: "OBJECT" },
                { type: "input_value", name: "VALUE" },
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
        // DGPad's, of an item counted from 1.
        {
            type: "dg_list_get",
            message0: "%1 [ %2 ]",
            args0: [{ type: "input_value", name: "LIST" }, number("INDEX")],
            inputsInline: true,
            output: null,
            style: "list_blocks",
        },
        {
            type: "dg_list_set",
            message0: "%1 [ %2 ] = %3",
            args0: [
                { type: "input_value", name: "LIST" },
                number("INDEX"),
                { type: "input_value", name: "VALUE" },
            ],
            inputsInline: true,
            ...statement,
            style: "list_blocks",
        },
        {
            type: "dg_list_push",
            message0: msg("LIST_PUSH"),
            args0: [
                { type: "input_value", name: "VALUE" },
                { type: "input_value", name: "LIST" },
            ],
            inputsInline: true,
            ...statement,
            style: "list_blocks",
        },
        {
            type: "dg_alert",
            message0: msg("ALERT"),
            args0: [{ type: "input_value", name: "TEXT" }],
            inputsInline: true,
            ...statement,
            style: "text_blocks",
        },
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
    Blockly.Extensions.register("dg_object_name", field("NAME", objects));
    Blockly.Extensions.register("dg_style_object", field("OBJECT", objects));
    Blockly.Extensions.register(
        "dg_turtle_name",
        field("NAME", () => figure.turtles()),
    );
    Blockly.Extensions.register("dg_global_name", field("NAME", globals));
}

// The first block of one of the programs shown together.
function hatBlock({ kind, object }: ProgramHat): BlockState {
    if (kind === "turtle")
        return { type: "dg_turtle", fields: { POINT: object } };
    if (kind === "program") return { type: "dg_program" };
    return {
        type: EVENT_HATS[kind],
        fields: {
            TEXT: Blockly.Msg[`DG_${EVENT_MESSAGES[kind]}`].replace(
                "%1",
                object,
            ),
        },
    };
}

// The first block of the program `key` has this id, or, folded by the
// user, this one.
const ROOT = "dge:";
const FOLDED = "dgf:";

// The blocks of a stack but its first one.
function blockCount(state: BlockState): number {
    const inner = (block: BlockState | undefined): number =>
        block
            ? 1 +
              Object.values(block.inputs ?? {}).reduce(
                  (sum, input) => sum + inner(input.block),
                  0,
              ) +
              inner(block.next?.block)
            : 0;
    return inner(state) - 1;
}

// A pill with the number of blocks a folded stack holds.
function pill(count: number): [string, number] {
    const text = String(count);
    const width = 12 + 7 * text.length;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="18"><rect width="${width}" height="18" rx="9" fill="#fff"/><text x="${width / 2}" y="13" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" font-weight="700" fill="#996600">${text}</text></svg>`;
    return [`data:image/svg+xml,${encodeURIComponent(svg)}`, width];
}

// What a first block dropped from the toolbox starts.
const STARTS: Record<string, string> = {
    dg_turtle: "turtle",
    ...Object.fromEntries(
        Object.entries(EVENT_HATS).map(([gesture, type]) => [type, gesture]),
    ),
};

const shadow = (type: string, fields: Record<string, unknown>) => ({
    shadow: { type, fields },
});
const num = (value: number) => shadow("math_number", { NUM: value });
const block = (type: string, inputs?: Record<string, unknown>) => ({
    kind: "block",
    type,
    ...(inputs && { inputs }),
});

// The blocks of the programs `kinds` (a turtle's, an event's, another's,
// which returns a value), and the first blocks of the programs `starts` the
// object `owner` can still have.
function toolbox(kinds: string[], owner: string, starts: string[]) {
    const turtle = kinds.includes("turtle");
    const text = (key: BlockMessage) => Blockly.Msg[`DG_${key}`];
    return {
        kind: "categoryToolbox",
        contents: [
            ...(starts.length
                ? [
                      {
                          kind: "category",
                          name: text("CAT_EVENTS"),
                          categorystyle: "event_category",
                          contents: starts.map((start) => ({
                              kind: "block",
                              ...hatBlock({
                                  key: "",
                                  kind: start,
                                  object: owner,
                              }),
                          })),
                      },
                  ]
                : []),
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
                    block("math_random_float"),
                    block("math_random_int", { FROM: num(1), TO: num(6) }),
                    block("math_modulo", {
                        DIVIDEND: num(64),
                        DIVISOR: num(10),
                    }),
                    block("dg_degrees", { VALUE: num(90) }),
                    block("math_on_list", {
                        LIST: {
                            block: {
                                type: "lists_create_with",
                                extraState: { itemCount: 2 },
                            },
                        },
                    }),
                ],
            },
            {
                kind: "category",
                name: text("CAT_TEXT"),
                categorystyle: "text_category",
                contents: [
                    block("text"),
                    block("text_join"),
                    block("dg_alert", {
                        TEXT: shadow("text", { TEXT: "" }),
                    }),
                ],
            },
            {
                kind: "category",
                name: text("CAT_LISTS"),
                categorystyle: "list_category",
                contents: [
                    {
                        ...block("lists_create_with"),
                        extraState: { itemCount: 0 },
                    },
                    block("lists_create_with"),
                    block("lists_repeat", { ITEM: num(0), NUM: num(5) }),
                    block("lists_length"),
                    block("dg_list_get", { INDEX: num(1) }),
                    block("dg_list_set", { INDEX: num(1) }),
                    block("dg_list_push"),
                ],
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
                    block("dg_set_value", { VALUE: num(0) }),
                    block("dg_style", { VALUE: num(1) }),
                    block("dg_style_rgb", {
                        R: num(0),
                        G: num(0),
                        B: num(255),
                    }),
                    ...(kinds.includes("program")
                        ? [block("dg_return", { VALUE: num(0) })]
                        : []),
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
            event_category: { colour: START[0] },
        },
        componentStyles: {
            // Enlarged, the blocks let the figure show through.
            workspaceBackgroundColour: "transparent",
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

// One of the programs shown, null for one without blocks.
export interface ShownStack {
    hat: ProgramHat;
    program: Program | null;
}

export interface BlocksEditor {
    // Shows the programs of `owner`, `starts` those it can still have, each
    // with its blocks but those that have none, folded: false when the
    // program `current` has none.
    load(
        programs: ShownStack[],
        current: string,
        degrees: boolean,
        owner: string,
        starts: string[],
    ): boolean;
    // The programs the blocks write, by key, null for those shown as text.
    readonly written: ReadonlyMap<string, string | null>;
    // The field being typed in, its editor closed by the panel built again,
    // edited again as it was.
    resume(): void;
}

// What the workspace tells: the programs its blocks write after each change,
// once the user is no longer dragging or typing; a program clicked; a
// program to start, from a first block dropped from the toolbox; a program
// taken out, its first block deleted.
export interface BlocksActions {
    changed(changes: [string, string][]): void;
    open(key: string): void;
    start(kind: string): void;
    removed(key: string): void;
}

// The workspace, in `host`.
export async function blocksEditor(
    host: HTMLElement,
    owner: BlocksFigure,
    actions: BlocksActions,
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
    // In the editor's own dialogs.
    const ok = () => Blockly.Msg.DIALOG_OK;
    const cancel = () => Blockly.Msg.DIALOG_CANCEL;
    Blockly.dialog.setPrompt((text, value, done) =>
        owner.dialog({ text, value, ok: ok(), cancel: cancel() }, done),
    );
    Blockly.dialog.setConfirm((text, done) =>
        owner.dialog({ text, ok: ok(), cancel: cancel() }, (answer) =>
            done(answer !== null),
        ),
    );
    Blockly.dialog.setAlert((text, done) =>
        owner.dialog({ text, ok: ok() }, () => done?.()),
    );
    // DGPad's operations, on points and complex numbers too: "P1 + [1, 0]".
    const arithmetic = Blockly.Blocks.math_arithmetic;
    const init = arithmetic.init!;
    arithmetic.init = function (this: Blockly.Block) {
        init.call(this);
        const types = ["Number", "Array"];
        this.setOutput(true, types);
        this.getInput("A")!.setCheck(types);
        this.getInput("B")!.setCheck(types);
    };
    // Procedures without a value only: DGPad's turtles have no other.
    delete Blockly.Blocks.procedures_defreturn;
    delete Blockly.Blocks.procedures_ifreturn;
    const workspace = Blockly.inject(host, {
        renderer: "zelos",
        theme: theme(),
        toolbox: toolbox(["turtle"], "", []),
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
    let written = new Map<string, string | null>();
    let current = "";
    // The stacks the user folded, by key, and their blocks meanwhile.
    const folds = new Map<string, BlockState>();
    // A folded stack: its first block alone, which takes no block under
    // it, the number of blocks it holds in a pill unfolding it.
    const fold = (
        key: string,
        state: BlockState,
        at: Blockly.utils.Coordinate,
    ) => {
        folds.set(key, state);
        const { type, fields, data } = state;
        const block = Blockly.serialization.blocks.append(
            { type, fields, data, id: FOLDED + key, x: at.x, y: at.y },
            workspace,
        ) as Blockly.BlockSvg;
        const [src, width] = pill(blockCount(state));
        block.setNextStatement(false);
        block.setInputsInline(true);
        block
            .appendDummyInput()
            .appendField(
                new Blockly.FieldImage(
                    src,
                    width,
                    18,
                    Blockly.Msg.DG_FOLDED_BLOCKS.replace(
                        "%1",
                        String(blockCount(state)),
                    ),
                    () => toggle(block),
                ),
            );
        return block;
    };
    // Folds or unfolds the stack of its first block, which the program
    // ignores: it keeps its text meanwhile.
    const toggle = (block: Blockly.BlockSvg) => {
        const at = block.getRelativeToSurfaceXY();
        const folded = block.id.startsWith(FOLDED);
        const key = block.id.slice(folded ? FOLDED.length : ROOT.length);
        Blockly.Events.disable();
        const state = folded
            ? folds.get(key)!
            : (Blockly.serialization.blocks.save(block) as BlockState);
        block.dispose(false);
        if (folded) {
            folds.delete(key);
            Blockly.serialization.blocks.append(
                { ...state, x: at.x, y: at.y },
                workspace,
            );
        } else fold(key, state, at);
        Blockly.Events.enable();
    };
    // In the context menu of a first block, in place of Blockly's folding of
    // a block alone.
    const first = (block: Blockly.BlockSvg | undefined) =>
        !!block && (block.id.startsWith(ROOT) || block.id.startsWith(FOLDED));
    const collapse = Blockly.ContextMenuRegistry.registry.getItem(
        "blockCollapseExpand",
    );
    if (collapse && "preconditionFn" in collapse) {
        const precondition = collapse.preconditionFn!;
        collapse.preconditionFn = (scope, event) =>
            first(scope.block as Blockly.BlockSvg)
                ? "hidden"
                : precondition(scope, event);
    }
    Blockly.ContextMenuRegistry.registry.register({
        id: "dg_fold_stack",
        scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
        weight: 4,
        displayText: (scope) =>
            scope.block!.id.startsWith(FOLDED)
                ? Blockly.Msg.DG_UNFOLD_STACK
                : Blockly.Msg.DG_FOLD_STACK,
        preconditionFn: (scope) => {
            const block = scope.block as Blockly.BlockSvg | undefined;
            return first(block) && !block!.isCollapsed() ? "enabled" : "hidden";
        },
        callback: (scope) => toggle(scope.block as Blockly.BlockSvg),
    });
    // The programs the blocks write, by key, null for one that shows as
    // text. An object's block left alone (DGPad's "Z;") belongs to the
    // program being edited.
    const stacks = (): Map<string, string | null> => {
        const state = Blockly.serialization.workspaces.save(
            workspace,
        ) as WorkspaceState;
        const tops = state.blocks?.blocks ?? [];
        const alone = tops.filter((block) => block.type === "dg_object");
        return new Map(
            tops.flatMap((root) => {
                if (root.id?.startsWith(FOLDED))
                    return [[root.id.slice(FOLDED.length), null]];
                if (!root.id?.startsWith(ROOT)) return [];
                const key = root.id.slice(ROOT.length);
                if (root.collapsed) return [[key, null]];
                const stack = stackState(state, root);
                if (key === current) stack.blocks!.blocks.push(...alone);
                return [[key, blocksProgram(stack, format)]];
            }),
        );
    };
    let timer = 0;
    // Plugging a block in, choosing in a dropdown or typing a number all
    // end in a change of the programs the blocks write: a number or a text
    // as it is typed, as in DGPad.
    const settle = () => {
        clearTimeout(timer);
        timer = window.setTimeout(() => {
            if (workspace.isDragging() || Blockly.DropDownDiv.isVisible())
                return settle();
            const dropped = workspace
                .getTopBlocks(false)
                .find((block) => block.type in STARTS && !first(block));
            if (dropped) {
                dropped.dispose();
                return actions.start(STARTS[dropped.type]);
            }
            const now = stacks();
            const gone = [...written.keys()].find((key) => !now.has(key));
            if (gone !== undefined) {
                written.delete(gone);
                folds.delete(gone);
                return actions.removed(gone);
            }
            const changes: [string, string][] = [];
            now.forEach((program, key) => {
                if (program === null || program === written.get(key)) return;
                written.set(key, program);
                changes.push([key, program]);
            });
            if (!changes.length) return;
            const input = Blockly.WidgetDiv.getDiv()?.querySelector("input");
            typing = input && edited ? { field: edited, input } : null;
            actions.changed(changes);
        }, 250);
    };
    // The field being typed in when its program was applied: the panel, built
    // again, takes the workspace out of the page, which closes its editor.
    let edited: Blockly.Field | null = null;
    let typing: { field: Blockly.Field; input: HTMLInputElement } | null = null;
    workspace.addChangeListener((event) => {
        // The program of the block clicked becomes the one edited.
        if (event.type === Blockly.Events.SELECTED) {
            const id = workspace
                .getBlockById(
                    (event as Blockly.Events.Selected).newElementId ?? "",
                )
                ?.getRootBlock().id;
            if (id?.startsWith(ROOT) && id.slice(ROOT.length) !== current) {
                current = id.slice(ROOT.length);
                actions.open(current);
            }
        }
        if (event.type === Blockly.Events.BLOCK_FIELD_INTERMEDIATE_CHANGE) {
            const { blockId, name } =
                event as Blockly.Events.BlockFieldIntermediateChange;
            edited = workspace.getBlockById(blockId!)!.getField(name!);
        }
        if (!event.isUiEvent) settle();
    });
    return {
        load(programs, key, degrees, owner, starts) {
            const blocks: BlockState[] = [];
            const variables = new Map<string, { name: string; id: string }>();
            const shown = programs.map(({ hat, program }) => {
                const state = program && programBlocks(program, degrees);
                const [root, ...rest] = state?.blocks!.blocks ?? [
                    { ...hatBlock(hat), collapsed: true },
                ];
                // An event's first block says when it runs.
                const first: BlockState = {
                    ...root,
                    ...(root.type === "dg_program" && hat.kind !== "program"
                        ? hatBlock(hat)
                        : {}),
                    id: ROOT + hat.key,
                };
                // Its procedures, but those of the same name another
                // program has already.
                rest.forEach((block) => {
                    if (
                        !blocks.some(
                            (other) =>
                                other.type === block.type &&
                                other.fields?.NAME === block.fields?.NAME,
                        )
                    )
                        blocks.push(block);
                });
                state?.variables?.forEach((variable) =>
                    variables.set(variable.id, variable),
                );
                return { hat, first, state };
            });
            if (
                !shown.find(({ hat }) => hat.key === key)?.state &&
                programs.length
            )
                return false;
            // In the figure's order, procedures under them.
            const state: WorkspaceState = {
                blocks: {
                    languageVersion: 0,
                    blocks: [...shown.map(({ first }) => first), ...blocks].map(
                        (block, i) => ({ ...block, x: 16, y: 16 + i }),
                    ),
                },
                variables: [...variables.values()],
            };
            named.clear();
            state.blocks!.blocks.forEach(nameObjects);
            Blockly.Events.disable();
            Blockly.serialization.workspaces.load(state, workspace);
            // Those the user folded stay so, with their blocks of now.
            shown.forEach(({ hat, first, state }) => {
                const block = workspace.getBlockById(first.id!);
                if (!state || !folds.has(hat.key) || !block) return;
                const at = block.getRelativeToSurfaceXY();
                block.dispose(false);
                fold(hat.key, first, at);
            });
            if (state.blocks!.blocks.length > 1) workspace.cleanUp();
            // Those without blocks, which show as text.
            workspace.getTopBlocks(false).forEach((block) => {
                if (!block.isCollapsed()) return;
                block.setMovable(false);
                block.setDeletable(false);
                block.setEditable(false);
                block.contextMenu = false;
            });
            Blockly.Events.enable();
            current = key;
            written = stacks();
            workspace.updateToolbox(
                toolbox(
                    programs.map(({ hat }) => hat.kind),
                    owner,
                    starts,
                ),
            );
            // Its first blocks offered, without a program yet.
            if (!programs.length)
                workspace.getToolbox()?.selectItemByPosition(0);
            // Its first block clear of the edge, its top rounded as a hat.
            workspace.scroll(workspace.scrollX + 12, workspace.scrollY + 16);
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
