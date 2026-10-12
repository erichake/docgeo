// First, as in the player: the object classes import each other.
import { construction } from "../construction";
import {
    describeDgo,
    figureObjects,
    importDgoFromBlob,
    importDgoFromUrl,
    readDgo,
    writeDgo,
} from "../dgo";
import { importDgp, importDgpFromUrl } from "../dgp_importer";
import { $, type DOMElement } from "../dom";
import { importGgbFromBlob, importGgbFromUrl } from "../ggb_importer";
import type { construction_object } from "../objects/construction_object";
import { point_object, type magnet_target } from "../objects/point_object";
import { button_object } from "../objects/button_object";
import { expression_object } from "../objects/expression_object";
import { polygon_object } from "../objects/polygon_object";
import { sphere_object } from "../objects/sphere_object";
import { preferences } from "../preferences";
import { vAdd, vIsFinite, vScale, vSub, type Vec2, type Vec3 } from "../vec";
import {
    accepts,
    commandName,
    commandsStarting,
    findCommand,
    overloadFor,
    paramAt,
    type Arg,
    type Overload,
} from "./catalog";
import {
    add,
    addPointOn,
    entryOf,
    figureIndex,
    formatArg,
    FREE_POINT,
    isPointTag,
    lineOf,
    nextName,
    rebuild,
    redefine,
    resolve,
    type Studio,
} from "./figure";
import {
    hideGhosts,
    showGhosts,
    toggleGhost,
    withGhostsHidden,
} from "./eraser";
import { message, type MessageKey } from "./messages";
import { ACTION_ICONS } from "./icons";
import {
    crossing,
    forgetBranches,
    meant,
    nearest,
    nearestBranch,
    pick,
    type Crossing,
    type Hit,
} from "./pick";
import {
    completionAt,
    formatName,
    parseLine,
    TextError,
    type ArgumentCompletion,
} from "./text";
import { RING_SLOTS, toolsFor, type Tool } from "./tools";
import { propertiesPanel } from "./properties";
import {
    attracts,
    dropLostMagnets,
    magnetizable,
    REACHES,
    reachOf,
    setReach,
    showZone,
} from "./magnets";
import "./properties.css";

// The construction editor: see EDITOR.md.

const PANEL_WIDTH = 320;
const RING_BUTTON = 20;
const RING_RADIUS = (RING_SLOTS * (2 * RING_BUTTON + 2)) / (2 * Math.PI);

const studio = { prefs: new preferences() } as Studio;
studio.scene = construction.create(studio);
const scene = () => studio.scene;

$("html").stl("width:100%;height:100%");
// The figure fills the window beside the text.
$("body")
    .cls("dge-editor")
    .stl("position:relative;overflow:hidden;touch-action:none")
    .att("oncontextmenu", "return false;");
$("head").append(`<style>
    .dge-editor { --dge-panel-size: min(${PANEL_WIDTH}px, calc(100vw - 56px)); --dge-panel-width: var(--dge-panel-size); --dge-bar-height: 60px; --dge-slide-duration: 0s; --dge-slide: var(--dge-slide-duration) cubic-bezier(0.22, 1, 0.36, 1); margin: 0; margin-inline-start: var(--dge-panel-width); margin-block-start: var(--dge-bar-height); width: calc(100% - var(--dge-panel-width)); height: calc(100% - var(--dge-bar-height)); transition: margin-inline-start var(--dge-slide), width var(--dge-slide); }
    .dge-editor.dge-panel-animated { --dge-slide-duration: 240ms; }
    .dge-editor.dge-panel-closed { --dge-panel-width: 0px; }
    .dge-panel-closed .dge-panel { transform: translateX(-100%); visibility: hidden; transition-delay: 0s, var(--dge-slide-duration); }
    .dge-panel, .dge-bar, .dge-hint, .dge-ring, .dge-complete, .dge-menu, .dge-magnet { font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2937; }
    .dge-panel { position: fixed; inset-block: var(--dge-bar-height) 0; inset-inline-start: 0; width: var(--dge-panel-size); box-sizing: border-box; padding-block-end: 12px; overflow: auto; background: #fff; border-inline-end: 1px solid #e5e7eb; z-index: 10; touch-action: pan-y; transform: translateX(0); transition: transform var(--dge-slide), visibility 0s; }
    .dge-panel-header { position: sticky; top: 0; display: flex; align-items: center; justify-content: space-between; padding: 8px 12px 8px 16px; background: #fff; border-block-end: 1px solid #e5e7eb; z-index: 1; }
    .dge-panel-header h2 { margin: 0; font-size: 14px; font-weight: 600; }
    .dge-row { display: block; width: 100%; box-sizing: border-box; padding: 5px 14px; border: 0; border-block-end: 1px solid #f1f5f9; background: none; font: 13.5px/1.5 ui-monospace, Menlo, Consolas, monospace; color: inherit; outline: none; }
    .dge-row:focus { background: #eff6ff; box-shadow: inset 3px 0 #2563eb; }
    .dge-row.dge-hover { background: #fef3c7; }
    .dge-row.dge-new { animation: dge-new 1.2s ease-out; }
    .dge-row.dge-error { box-shadow: inset 3px 0 #dc2626; background: #fef2f2; }
    .dge-row[readonly] { color: #9ca3af; }
    .dge-row.dge-hidden { color: #9ca3af; font-style: italic; }
    .dge-input { margin-block-start: 6px; }
    @keyframes dge-new { from { background: #bbf7d0; } }
    .dge-bar { position: fixed; inset-block-start: 0; inset-inline: 0; height: var(--dge-bar-height); box-sizing: border-box; display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f8fafc; border-block-end: 1px solid #e2e8f0; z-index: 11; }
    .dge-bar-group { display: flex; gap: 4px; }
    .dge-bar-group + .dge-bar-group { padding-inline-start: 8px; border-inline-start: 1px solid #dbe2ea; }
    .dge-action { display: grid; place-items: center; flex-shrink: 0; width: 40px; height: 40px; padding: 0; border: 1px solid transparent; border-radius: 10px; background: transparent; color: #536174; cursor: pointer; }
    .dge-action svg { display: block; width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.65; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
    .dge-action:hover:not(:disabled) { background: #e8eef7; color: #1d4ed8; }
    .dge-action:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
    .dge-action:disabled { opacity: 0.3; cursor: default; }
    .dge-action.dge-on { background: #e0ebff; color: #1d4ed8; border-color: #bfd2f5; }
    .dge-action.dge-on:hover { background: #cfdefb; }
    .dge-bar-middle { flex: 1; display: flex; justify-content: center; min-width: 0; }
    .dge-bar .dge-bar-end { padding-inline-start: 0; border: 0; }
    .dge-bar-object { align-items: center; min-width: 0; animation: dge-arrive 180ms ease-out; }
    .dge-editor .dge-bar .dge-bar-object { gap: 4px; padding: 4px; border: 0; border-radius: 26px; background: rgb(219 225 232); }
    .dge-editor .dge-bar .dge-bar-object .dge-action { width: 40px; height: 40px; border-color: hsl(215 14% 60%); border-radius: 50%; background: hsl(215 17.5% 96%); box-shadow: 0 1px 2px rgb(15 23 42 / 0.06), 0 3px 7px rgb(15 23 42 / 0.08); }
    .dge-done { height: 40px; padding: 0 18px; border: 0; border-radius: 20px; background: #2563eb; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
    .dge-done:hover { background: #1d4ed8; }
    .dge-done:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
    .dge-bar-object .dge-action:hover:not(:disabled) { background: #2563eb; border-color: #2563eb; color: #fff; }
    .dge-bar-name { display: flex; align-items: center; gap: 6px; min-width: 0; max-width: 120px; padding-inline: 4px 6px; font-weight: 600; color: #334155; }
    .dge-bar-name span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dge-swatch { flex-shrink: 0; width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 0 1px rgb(15 23 42 / 0.2); }
    .dge-action.dge-delete { color: #dc2626; }
    .dge-bar-object .dge-delete:hover:not(:disabled) { background: #dc2626; border-color: #dc2626; }
    @keyframes dge-arrive { from { opacity: 0; transform: translateY(-8px); } }
    @media (max-width: 600px) { .dge-editor .dge-bar .dge-bar-object { position: fixed; top: calc(var(--dge-bar-height) + 8px); inset-inline: 0; width: fit-content; margin-inline: auto; box-shadow: 0 4px 12px rgb(15 23 42 / 0.12); } }
    .dge-panel-header .dge-action { width: 32px; height: 32px; border-radius: 8px; }
    @media (max-width: 400px) { .dge-bar { gap: 6px; padding-inline: 8px; } .dge-bar-group { gap: 2px; } .dge-bar-group + .dge-bar-group { padding-inline-start: 6px; } .dge-bar .dge-action { width: 36px; } }
    .dge-hint { position: fixed; bottom: 16px; left: calc(50% + var(--dge-panel-width) / 2); transform: translateX(-50%); max-width: calc(100% - var(--dge-panel-width) - 32px); padding: 7px 14px; border-radius: 9px; background: rgb(17 24 39 / 0.86); color: #f9fafb; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13.5px; white-space: pre-wrap; z-index: 11; pointer-events: none; transition: left var(--dge-slide), max-width var(--dge-slide); }
    @media (prefers-reduced-motion: reduce) { .dge-editor.dge-panel-animated { --dge-slide-duration: 0s; } .dge-bar-object { animation: none; } }
    .dge-hint:empty { display: none; }
    .dge-hint.dge-error { background: #b91c1c; }
    .dge-hint button { width: 30px; height: 30px; margin: -4px -8px -4px 10px; padding: 0; border: 0; border-radius: 50%; background: rgb(255 255 255 / 0.18); color: inherit; font-size: 15px; vertical-align: middle; cursor: pointer; pointer-events: auto; }
    .dge-hint button:hover { background: rgb(255 255 255 / 0.32); }
    .dge-ring { position: fixed; width: 0; height: 0; z-index: 12; }
    .dge-ring button { position: absolute; display: grid; place-items: center; width: ${2 * RING_BUTTON}px; height: ${2 * RING_BUTTON}px; margin: -${RING_BUTTON}px; padding: 7px; border: 1px solid hsl(var(--dge-hue) calc(55% * var(--dge-tone)) 60%); border-radius: 50%; background: var(--dge-icon-bg); --dge-icon-bg: hsl(var(--dge-hue) calc(70% * var(--dge-tone)) 96%); color: #536174; box-shadow: 0 1px 2px rgb(15 23 42 / 0.06), 0 3px 7px rgb(15 23 42 / 0.08); cursor: pointer; }
    .dge-ring button:hover { --dge-icon-bg: #2563eb; color: #fff; border-color: #2563eb; box-shadow: 0 2px 4px rgb(15 23 42 / 0.08), 0 4px 10px rgb(15 23 42 / 0.1); }
    .dge-ring button:focus-visible { outline: 2px solid hsl(var(--dge-hue) calc(60% * var(--dge-tone)) 45%); outline-offset: 3px; }
    .dge-ring .dge-sectors { position: absolute; overflow: visible; fill: none; stroke-width: ${2 * RING_BUTTON + 12}px; stroke-linecap: round; pointer-events: none; }
    .dge-ring .dge-tie { stroke: #f59e0b; stroke-width: 2px; stroke-dasharray: 2 5; }
    .dge-ring button svg { display: block; width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.65; stroke-linecap: round; stroke-linejoin: round; }
    .dge-ring .dge-guide { opacity: 0.65; }
    .dge-ring .dge-result { color: #d14343; }
    .dge-ring button:hover .dge-result { color: inherit; }
    .dge-complete, .dge-menu { position: fixed; min-width: 160px; max-height: 240px; overflow: auto; padding: 4px 0; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; box-shadow: 0 6px 20px rgb(0 0 0 / 0.14); z-index: 13; }
    .dge-complete div, .dge-menu div { padding: 3px 12px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13px; cursor: pointer; }
    .dge-complete div.dge-selected, .dge-complete div:hover, .dge-menu div:hover { background: #2563eb; color: #fff; }
    .dge-complete:empty { display: none; }
    .dge-magnet { position: fixed; display: flex; align-items: center; gap: 10px; padding: 6px 12px 6px 6px; border: 1px solid #fecaca; border-radius: 22px; background: #fff; box-shadow: 0 6px 20px rgb(15 23 42 / 0.16); z-index: 12; }
    .dge-magnet input { width: 150px; margin: 0; accent-color: #dc2626; }
    .dge-magnet output { width: 80px; white-space: nowrap; font-weight: 600; font-variant-numeric: tabular-nums; color: #b91c1c; }
    svg .dge-target { filter: drop-shadow(0 0 2px #dc2626) drop-shadow(0 0 2px #dc2626); }
    svg .dge-source { filter: drop-shadow(0 0 2px #2563eb) drop-shadow(0 0 3px #2563eb); }
    svg.dge-magnetizing [data-layer] > :not(.dge-source, .dge-target, .dge-zone, .dge-hover) { opacity: 0.4; }
    svg .dge-zone { opacity: 0.07; pointer-events: none; }
    svg .dge-zone.dge-chosen { opacity: 0.16; }
    svg .dge-zone * { fill: none !important; stroke: #dc2626 !important; stroke-width: var(--dge-reach) !important; stroke-opacity: 1 !important; stroke-dasharray: none !important; stroke-linecap: round; stroke-linejoin: round; pointer-events: none !important; }
    svg .dge-zone text { display: none; }
    svg .dge-hover { filter: drop-shadow(0 0 2px #f59e0b) drop-shadow(0 0 3px #f59e0b); }
    svg .dge-ok { filter: drop-shadow(0 0 2px #16a34a) drop-shadow(0 0 2px #16a34a); }
    svg .dge-preview { opacity: 0.55; }
    .dge-ghost { opacity: 0.3 !important; }
</style>`);

// ************************** LAYOUT ******************************

const panel = $.create("aside")
    .cls("dge-panel")
    .att("id", "dge-history")
    .att("aria-label", message("history"));
const rowsBox = $.create("div");
const input = $.create("input")
    .cls("dge-row dge-input")
    .att("placeholder", message("input"))
    .att("spellcheck", "false");
const hint = $.create("div").cls("dge-hint");
const ring = $.create("div").cls("dge-ring").hide();
// Escape, for the fingers.
const cancelButton = $.create("button")
    .text("✕")
    .att("title", message("cancel"));
cancelButton.on("click", () => cancel());
const complete = $.create("div").cls("dge-complete");
// The objects under a click, for the user to choose one.
const menu = $.create("div").cls("dge-menu").att("role", "menu").hide();
// Keeps the focus in the line typed.
menu.on("mousedown", () => {});
function button(
    key: keyof typeof ACTION_ICONS,
    action: () => void,
): DOMElement {
    const element = $.create("button")
        .cls("dge-action")
        .att("type", "button")
        .att("title", message(key))
        .att("aria-label", message(key))
        .append(
            `<svg viewBox="0 0 24 24" aria-hidden="true">${ACTION_ICONS[key]}</svg>`,
        );
    element.on("click", action);
    return element;
}
const undoButton = button("undo", () => travel(-1));
const redoButton = button("redo", () => travel(1));
const eraserButton = button("eraser", () => setEraser(!ghosts));
const axesButton = button("axes", () => setAxes(scene().GRID.hidden !== 0));
eraserButton.att("aria-pressed", "false");
axesButton.att("aria-pressed", "false");
const historyButton = button("history", () =>
    setPanel(historyButton.getAtt("aria-expanded") === "false"),
)
    .att("aria-controls", "dge-history")
    .att("aria-expanded", "true")
    .addClass("dge-on");
const propertiesButton = button("properties", () =>
    setProperties(!propertiesOpen),
)
    .att("aria-controls", "dge-properties")
    .att("aria-expanded", "false");
const deleteButton = button("delete", () => remove()).addClass("dge-delete");
const settingsButton = button("settings", () => setProperties(true));
const magnetButton = button("magnet", () =>
    startMagnets(target() as point_object),
);
// In place of the actions while the magnets are chosen: the way out.
const doneButton = $.create("button")
    .cls("dge-done")
    .att("type", "button")
    .text(message("done"));
doneButton.on("click", () => stopMagnets());
const swatch = $.create("span").cls("dge-swatch");
const objectName = $.create("span");
// The actions on the selected object.
const actions = $.create("div")
    .cls("dge-bar-group dge-bar-object")
    .att("role", "group")
    .add(
        $.create("span").cls("dge-bar-name").add(swatch, objectName),
        deleteButton,
        settingsButton,
        magnetButton,
        doneButton,
    )
    .hide();
// The reach of the magnet chosen, near it, as DGPad's slider.
const reachSwatch = $.create("span").cls("dge-swatch");
const reachName = $.create("span");
const reachInput = $.create("input")
    .att("type", "range")
    .att("min", 0)
    .att("max", REACHES.length - 1);
const reachValue = $.create("output");
const magnetCard = $.create("div")
    .cls("dge-magnet")
    .add(
        $.create("span").cls("dge-bar-name").add(reachSwatch, reachName),
        reachInput,
        reachValue,
    )
    .hide();
reachInput.on(
    "input",
    () => {
        const { point, target } = magnetizing!;
        setReach(point, target!, REACHES[+reachField().value]);
        showReach();
    },
    false,
);
reachInput.on(
    "change",
    () => {
        standardReach = REACHES[+reachField().value] || standardReach;
        changed();
    },
    false,
);
// Hovered, an action shows its line, as the ring's tools.
function explain(action: DOMElement, line: (name: string) => string): void {
    action.on(
        "pointerenter",
        () => showHint(line(formatName(target()!.name))),
        false,
    );
    action.on("pointerleave", () => showHint(restingHint()), false);
}
explain(deleteButton, (name) => `${name} =\n${message("delete")}`);
explain(settingsButton, (name) => `${name}\n${message("settings")}`);
explain(magnetButton, (name) => `${name}\n${message("magnet")}`);
const properties = propertiesPanel({
    scene,
    changed: () => changed(),
    rename: async (object, name) => {
        const figure = await describeDgo(scene());
        const index = figureObjects(scene()).indexOf(object);
        (figure.o[index] as unknown[])[1] = name;
        rebuild(studio, figure);
        properties.select(scene().getObj(name)!);
        changed();
    },
    close: () => {
        setProperties(false);
        (propertiesButton.dom() as HTMLButtonElement).focus();
    },
});
properties.panel.dom().toggleAttribute("inert", true);
const fileInput = $.create("input")
    .att("type", "file")
    .att("accept", ".dgo,.dgp,.ggb");
$("body").add(
    panel.add(
        $.create("div")
            .cls("dge-panel-header")
            .add(
                $.create("h2").text(message("construction")),
                button("close_history", () => {
                    setPanel(false);
                    (historyButton.dom() as HTMLButtonElement).focus();
                }),
            ),
        rowsBox,
        input,
    ),
    $.create("nav")
        .cls("dge-bar")
        .att("aria-label", message("actions"))
        .add(
            $.create("div")
                .cls("dge-bar-group")
                .add(
                    button("open", () =>
                        (fileInput.dom() as HTMLInputElement).click(),
                    ),
                    button("save", save),
                ),
            $.create("div")
                .cls("dge-bar-group")
                .add(eraserButton, axesButton, propertiesButton, historyButton),
            $.create("div").cls("dge-bar-middle").add(actions),
            $.create("div")
                .cls("dge-bar-group dge-bar-end")
                .add(undoButton, redoButton),
        ),
    properties.panel,
    hint,
    ring,
    complete,
    menu,
    magnetCard,
);
function setPanel(on: boolean, animate = true): void {
    if (on && propertiesOpen && window.innerWidth <= 900) setProperties(false);
    if (!on) {
        editing()?.blur();
        closeCompletion();
        clearPreview();
        showAccepted([]);
        highlight();
    }
    closeRing();
    panel.dom().toggleAttribute("inert", !on);
    $("body")
        .toggleClass("dge-panel-animated", animate)
        .toggleClass("dge-panel-closed", !on);
    historyButton.toggleClass("dge-on", on).att("aria-expanded", String(on));
}
function setProperties(on: boolean): void {
    if (on) {
        const object = target();
        setEraser(false);
        cancel();
        editing()?.blur();
        closeCompletion();
        showAccepted([]);
        highlight();
        if (window.innerWidth <= 900) setPanel(false);
        properties.refresh();
        properties.select(object ?? properties.selected);
    }
    propertiesOpen = on;
    properties.panel.dom().toggleAttribute("inert", !on);
    $("body")
        .addClass("dge-panel-animated")
        .toggleClass("dge-properties-open", on);
    propertiesButton.toggleClass("dge-on", on).att("aria-expanded", String(on));
    properties.selected?.dom?.toggleClass("dge-property-selected", on);
    showHint("");
}
// Typing doesn't reach the figure's own keys (3D view, floor), shortcuts
// do.
panel.on(
    "keydown",
    (event) => {
        if (!event.metaKey && !event.ctrlKey) event.stopPropagation();
    },
    false,
);

// ************************** STATE *******************************

// The object of each row of the text.
const rows = new Map<construction_object, DOMElement>();
// A tool waiting for its arguments.
let pending: {
    tool: Tool;
    args: (Arg | undefined)[];
} | null = null;
// What the next argument would build, followed by the pointer.
let preview: {
    candidate: construction_object | "pointer";
    objects: construction_object[];
    pointer?: point_object;
    standIn?: point_object;
} | null = null;
let hovered: construction_object[] = [];
let accepted: construction_object[] = [];
let completions: {
    label: string;
    insert: string;
    object?: construction_object;
}[] = [];
let selected = -1;
let figureName = "figure";
// While erasing: the objects hidden, shown pale.
let ghosts: Set<construction_object> | null = null;
let propertiesOpen = false;
// The point whose magnets are being chosen, and the one whose reach is set.
let magnetizing: {
    point: point_object;
    target: magnet_target | null;
    // How far the reach is from its target: set once chosen, the slider
    // not moving under the finger.
    away: number;
} | null = null;
let zones: DOMElement[] = [];
// As DGPad, a new magnet takes the last reach chosen.
let standardReach = 20;

const element = (node: EventTarget | null) =>
    node instanceof Element ? node : null;
const inFigure = (event: Event): boolean =>
    scene().svg.dom().contains(element(event.target));
const editing = (): HTMLInputElement | null => {
    const active = document.activeElement;
    return active instanceof HTMLInputElement && panel.dom().contains(active)
        ? active
        : null;
};
const vec3 = () => !scene().GRID.is2D;
const previewed = () => new Set(preview?.objects ?? []);
const looksHidden = (object: construction_object) =>
    object.isHidden || !!ghosts?.has(object);

function propertyObject(event: PointerEvent): construction_object | null {
    const target = element(event.target);
    const objects = figureObjects(scene()).filter(
        (object) => object.isVisible && object.hasView,
    );
    const direct = objects.find(
        (object) => target && object.dom.dom().contains(target),
    );
    if (direct) return direct;
    const widget = objects.find((object) => {
        if (
            !["expression", "text", "button", "image", "panel"].includes(
                object.type,
            )
        )
            return false;
        const box = object.dom.dom().getBoundingClientRect();
        return (
            event.clientX >= box.left &&
            event.clientX <= box.right &&
            event.clientY >= box.top &&
            event.clientY <= box.bottom
        );
    });
    return widget ?? null;
}

function showHint(text: string, error = false): void {
    hint.text(text).toggleClass("dge-error", error);
    if (pending) hint.add(cancelButton);
}

// ************************** TEXT ********************************

function refreshRows(): void {
    properties.refresh();
    properties.selected?.dom?.toggleClass(
        "dge-property-selected",
        propertiesOpen,
    );
    rows.clear();
    rowsBox.inner("");
    const c = scene();
    const index = figureIndex(c);
    const objects = figureObjects(c);
    const ignored = previewed();
    objects.forEach((object) => {
        if (ignored.has(object)) return;
        const line = lineOf(object, index, objects);
        const row = $.create("input")
            .cls("dge-row")
            .att("spellcheck", "false")
            .toggleClass("dge-hidden", looksHidden(object));
        (row.dom() as HTMLInputElement).value =
            line ?? `${formatName(object.name)} = …`;
        if (line === null)
            row.att("readonly", "").att("title", message("read_only"));
        else bindRow(row, object);
        row.on(
            "pointerdown",
            (event) => {
                if (!propertiesOpen) return;
                event.preventDefault();
                properties.select(object);
            },
            false,
        );
        row.on("mouseenter", () => highlight(object), false);
        row.on("mouseleave", () => highlight(), false);
        rows.set(object, row);
        rowsBox.add(row);
    });
    undoButton.dom().toggleAttribute("disabled", position <= 0);
    redoButton
        .dom()
        .toggleAttribute("disabled", position >= history.length - 1);
}

// The values a drag changes.
function updateRows(): void {
    const c = scene();
    const index = figureIndex(c);
    const objects = figureObjects(c);
    const active = editing();
    rows.forEach((row, object) => {
        if (row.dom() === active || row.getAtt("readonly") !== null) return;
        (row.dom() as HTMLInputElement).value = lineOf(object, index, objects)!;
    });
}

function bindRow(row: DOMElement, object: construction_object | null): void {
    const field = row.dom() as HTMLInputElement;
    let original = field.value;
    row.on(
        "focus",
        () => {
            if (propertiesOpen) {
                if (object) {
                    properties.select(object);
                    field.blur();
                    return;
                }
                setProperties(false);
            }
            setEraser(false);
            stopMagnets();
            original = field.value;
            updateCompletion(field);
        },
        false,
    );
    row.on(
        "input",
        () => {
            row.removeClass("dge-error");
            updateCompletion(field);
        },
        false,
    );
    row.on("click", () => updateCompletion(field), false);
    row.on(
        "blur",
        () => {
            closeCompletion();
            closeMenu();
            clearPreview();
            showAccepted([]);
        },
        false,
    );
    row.on(
        "keydown",
        (event) => {
            if (completions.length && navigate(event, field)) return;
            if (event.key === "Enter") {
                event.preventDefault();
                if (field.value.trim() === original.trim() && object) return;
                void commitText(field, object);
            } else if (event.key === "Escape") {
                field.value = object ? original : "";
                row.removeClass("dge-error");
                closeCompletion();
                field.blur();
            }
        },
        false,
    );
}

async function commitText(
    field: HTMLInputElement,
    object: construction_object | null,
): Promise<void> {
    const c = scene();
    try {
        const line = parseLine(field.value);
        const target =
            object ?? (line.name ? (c.getObj(line.name) ?? null) : null);
        if (!line.definition) {
            if (!target) throw new TextError("unknown_object", line.name!);
            c.removeObject(target);
            return done();
        }
        if (target) {
            const spec = resolve(c, line, target);
            if (
                spec.overload === FREE_POINT &&
                entryOf(target, figureIndex(c))[0] === "Pt" &&
                spec.name === target.name
            ) {
                const [x, y, z = 0] = spec.args as number[];
                (target as point_object).coords = [x, y, z];
                c.invalidateGeometry(target);
                c.flush();
                return done(target);
            }
            await redefine(studio, target, spec);
            return done(scene().getObj(spec.name));
        }
        const spec = resolve(c, line);
        if (field === input.dom()) field.value = "";
        return done(add(c, spec));
    } catch (error) {
        if (!(error instanceof TextError)) throw error;
        $(field).addClass("dge-error");
        showHint(message(error.key as MessageKey, error.detail), true);
    }
}

// What the caret is in: the commands, or the objects an argument accepts.
function updateCompletion(field: HTMLInputElement): void {
    clearPreview();
    const context = completionAt(field.value.slice(0, field.selectionStart!));
    completions = [];
    let candidates: construction_object[] = [];
    if (context?.kind === "command" && context.prefix)
        completions = commandsStarting(context.prefix).map((command) => ({
            label: `${commandName(command)}( )`,
            insert: `${commandName(command)}(`,
        }));
    else if (context?.kind === "argument") {
        const params = overloadsAt(context).map((overload) =>
            paramAt(overload, context.position)!,
        );
        candidates = figureObjects(scene()).filter((object) =>
            params.some((param) => accepts(object, param)),
        );
        const prefix = context.prefix.toLowerCase();
        completions = candidates
            .filter(({ name }) => name.toLowerCase().startsWith(prefix))
            .slice(0, 60)
            .map((object) => ({
                label: formatName(object.name),
                insert: formatName(object.name),
                object,
            }));
    }
    showAccepted(candidates);
    selected = -1;
    showCompletion(field);
}

function showCompletion(field: HTMLInputElement): void {
    complete.inner("");
    completions.forEach(({ label }, index) => {
        const item = $.create("div")
            .text(label)
            .toggleClass("dge-selected", index === selected);
        // Before the field loses the focus.
        item.on("mousedown", () => insertCompletion(field, index));
        complete.add(item);
    });
    const box = field.getBoundingClientRect();
    complete.stl("left", `${box.left + 14}px`).stl("top", `${box.bottom}px`);
}

function closeCompletion(): void {
    completions = [];
    complete.inner("");
}

// Arrows choose a completion, Tab or Enter insert it.
function navigate(event: KeyboardEvent, field: HTMLInputElement): boolean {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const step = event.key === "ArrowDown" ? 1 : -1;
        selected = (selected + step + completions.length) % completions.length;
    } else if (event.key === "Tab" || (event.key === "Enter" && selected >= 0))
        insertCompletion(field, Math.max(selected, 0));
    else if (event.key === "Escape") closeCompletion();
    else return false;
    event.preventDefault();
    showCompletion(field);
    return true;
}

function insertCompletion(field: HTMLInputElement, index: number): void {
    const { insert, object } = completions[index];
    if (object) return designateTyped(field, object);
    insertWord(field, insert);
    updateCompletion(field);
}

// The overloads of the command typed that take the arguments before the
// caret and one more, an unknown name taking anything.
function overloadsAt(context: ArgumentCompletion): Overload[] {
    const c = scene();
    return (findCommand(context.command)?.overloads ?? []).filter(
        (overload) =>
            paramAt(overload, context.position) &&
            context.args.every((arg, position) => {
                const value =
                    arg?.kind === "name" ? c.getObj(arg.name) : arg?.value;
                return (
                    value === undefined ||
                    accepts(value, paramAt(overload, position)!)
                );
            }),
    );
}

// Its name, then what the line expects after it when it ends there: `, `
// if every command it can be still takes more, `)` if none does, and then
// the line is entered. Designating the first vertex of a polygon again
// closes it.
function designateTyped(
    field: HTMLInputElement,
    object: construction_object,
): void {
    if (insertArgument(field, object))
        void commitText(
            field,
            [...rows].find(([, row]) => row.dom() === field)?.[0] ?? null,
        );
    updateCompletion(field);
}

// Whether it closed the line.
function insertArgument(
    field: HTMLInputElement,
    object: construction_object,
): boolean {
    const caret = field.selectionStart!;
    const before = field.value.slice(0, caret);
    const context = completionAt(before);
    if (context?.kind !== "argument" || field.value.slice(caret).trim()) {
        insertWord(field, formatName(object.name));
        return false;
    }
    const { position, args } = context;
    const overloads = overloadsAt(context).filter((overload) =>
        accepts(object, paramAt(overload, position)!),
    );
    const first = args[0]?.kind === "name" && scene().getObj(args[0].name);
    if (
        first === object &&
        overloads.some(
            ({ params, variadic }) => variadic && position >= params.length,
        )
    ) {
        const comma = before.lastIndexOf(",");
        field.value = before.slice(0, comma) + ")";
        field.setSelectionRange(comma + 1, comma + 1);
        $(field).removeClass("dge-error");
        return true;
    }
    const more = overloads.map(
        (overload) => paramAt(overload, position + 1) !== null,
    );
    const closes = more.length > 0 && !more.some(Boolean);
    insertWord(
        field,
        formatName(object.name) +
            (more.length && more.every(Boolean) ? ", " : closes ? ")" : ""),
    );
    return closes;
}

// The line typed, ending in an argument, as a tool waiting for it: the
// arguments before it, and the overloads that take them.
function typedCall(
    field: HTMLInputElement,
): { args: Arg[]; overloads: Overload[] } | null {
    const caret = field.selectionStart!;
    const context = completionAt(field.value.slice(0, caret));
    if (context?.kind !== "argument" || field.value.slice(caret).trim())
        return null;
    const c = scene();
    const args = Array.from({ length: context.position }, (_, position) => {
        const arg = context.args[position];
        return arg?.kind === "name" ? c.getObj(arg.name) : arg?.value;
    });
    if (args.includes(undefined)) return null;
    return {
        args: args as Arg[],
        overloads: overloadsAt(context).filter(
            ({ tag }) => tag !== (vec3() ? "C3p" : "C3s"),
        ),
    };
}

// The overload of the call typed that takes this object next.
const taking = (
    { args, overloads }: { args: Arg[]; overloads: Overload[] },
    object: construction_object,
) =>
    overloads.find((overload) =>
        accepts(object, paramAt(overload, args.length)!),
    );

// Only the line typed below the others makes points where it designates:
// the others' rows are rebuilt with the figure.
const expectsPoint = (
    field: HTMLInputElement,
    call: ReturnType<typeof typedCall>,
) =>
    field === input.dom() &&
    !!call?.overloads.some(
        (overload) => paramAt(overload, call.args.length) === "point",
    );

// In place of the word typed at the caret.
function insertWord(field: HTMLInputElement, word: string): void {
    const caret = field.selectionStart!;
    const before = field.value.slice(0, caret);
    const start =
        before.length -
        (/[\p{L}_][\p{L}\p{N}_']*$/u.exec(before)?.[0].length ?? 0);
    field.value = field.value.slice(0, start) + word + field.value.slice(caret);
    field.setSelectionRange(start + word.length, start + word.length);
    field.focus();
    $(field).removeClass("dge-error");
}

// ************************** FIGURE ******************************

function highlight(...objects: construction_object[]): void {
    if (
        objects.length === hovered.length &&
        objects.every((object, index) => object === hovered[index])
    )
        return;
    hovered.forEach((object) => {
        if (object.hasView) object.dom.removeClass("dge-hover");
        rows.get(object)?.removeClass("dge-hover");
    });
    hovered = objects;
    objects.forEach((object) => {
        if (object.hasView) object.dom.addClass("dge-hover");
        rows.get(object)?.addClass("dge-hover");
    });
}

function showAccepted(objects: construction_object[]): void {
    accepted.forEach((object) => {
        if (object.hasView) object.dom.removeClass("dge-ok");
    });
    accepted = objects;
    objects.forEach((object) => {
        if (object.hasView) object.dom.addClass("dge-ok");
    });
}

const groundPoint = (screen: Vec2): Vec3 | null =>
    scene().unprojectToZPlane(screen, 0);

// The coordinates of a free point there.
function freeCoords(screen: Vec2): number[] | null {
    const point = groundPoint(screen);
    return point && (vec3() ? [...point] : [point[0], point[1]]);
}

function addFreePoint(screen: Vec2): construction_object | null {
    const coords = freeCoords(screen);
    if (!coords) return null;
    return add(scene(), {
        name: nextName(scene(), true),
        overload: FREE_POINT,
        args: coords,
    });
}

function addCrossing({ a, b, order }: Crossing): construction_object {
    const c = scene();
    return add(c, { name: nextName(c, true), ...intersection(a, b, order) });
}

// Whether a click there would designate a point, made where it is.
function wantsPoint(hits: Hit[]): boolean {
    if (pending)
        return (
            pending.tool.mode === "command" &&
            paramAt(pending.tool.overload, nextSlot()) === "point"
        );
    const field = editing();
    if (!field) return !propertiesOpen && !ghosts && !magnetizing;
    const call = typedCall(field);
    return (
        expectsPoint(field, call) &&
        !hits.some(({ object }) => taking(call!, object))
    );
}

// Numbered, unless of two lines.
function intersection(
    a: construction_object,
    b: construction_object,
    order: number,
): { overload: Overload; args: Arg[] } {
    const args = [a, b, order + 1].slice(
        0,
        accepts(a, "line") && accepts(b, "line") ? 2 : 3,
    );
    return {
        overload: overloadFor(findCommand("Intersection")!, args, vec3())!,
        args,
    };
}

// The point a designation there gives: the point under it, or a new one,
// at the intersection of two objects, on one, or free.
function designatePoint(
    screen: Vec2,
    hits: Hit[],
    client: Vec2,
    then: (point: construction_object) => void,
): void {
    const c = scene();
    if (hits[0] && hits[0].object instanceof point_object)
        return then(hits[0].object);
    const cross = crossing(c, screen, hits);
    if (cross) return then(addCrossing(cross));
    const supports = hits.filter(({ object }) => accepts(object, "support"));
    if (supports[0])
        return chooseHit(supports, client, ({ object, at }) =>
            then(addPointOn(c, nextName(c, true), object, at)),
        );
    const point = addFreePoint(screen);
    if (point) then(point);
}

function nextSlot({ tool, args } = pending!): number {
    if (tool.overload.variadic) return args.length;
    return args.findIndex((arg) => arg === undefined);
}

// The tool's arguments, the object designated first.
function firstArgs(
    tool: Tool,
    object: construction_object,
): (Arg | undefined)[] {
    if (tool.mode !== "command") return [object];
    const { params, variadic } = tool.overload;
    const args: (Arg | undefined)[] = variadic
        ? []
        : Array(params.length).fill(undefined);
    args[params.findIndex((param) => accepts(object, param))] = object;
    return args;
}

// The line the tool writes, its missing arguments elided, and what remains
// to designate.
function describe(tool: Tool, args: (Arg | undefined)[]): string {
    const point = tool.mode !== "command" || isPointTag(tool.overload.tag);
    const shown = args.map((arg) => (arg === undefined ? "…" : formatArg(arg)));
    if (tool.mode !== "command" || tool.overload.variadic) shown.push("…");
    const line = `${formatName(nextName(scene(), point))} = ${commandName(tool.command)}(${shown.join(", ")})`;
    if (tool.mode === "point") return line;
    if (tool.mode === "intersection")
        return `${line}\n${message("designate", message("intersectable"))}`;
    if (tool.overload.variadic && args.length >= 3)
        return `${line}\n${message("polygon_end")}`;
    const param = paramAt(tool.overload, nextSlot({ tool, args }))!;
    return `${line}\n${message("designate", message(param as MessageKey))}`;
}

function prompt(): void {
    showHint(pending ? describe(pending.tool, pending.args) : "");
}

const onRing = (slot: number): Vec2 => {
    const angle = -Math.PI / 2 + (2 * Math.PI * slot) / RING_SLOTS;
    return [RING_RADIUS * Math.cos(angle), RING_RADIUS * Math.sin(angle)];
};

// The ring's object, where the ring was opened on the screen and the
// object's point it holds there.
let held: { hit: Hit; client: Vec2; screen: Vec2 } | null = null;

// The point held, moved with its object: the nearest to where it was, or the
// centre of a polygon or a sphere.
function hold(c: construction, hit: Hit, previous: Vec2): Vec2 {
    const { object } = hit;
    if (object instanceof sphere_object) return c.pt3D(object.CENTER);
    if (object instanceof polygon_object)
        return vScale(
            object.points.reduce<Vec2>(
                (sum, { screen }) => vAdd(sum, screen),
                [0, 0],
            ),
            1 / object.points.length,
        );
    const at = nearest(c, object, previous);
    if (!at || !vIsFinite(at)) return previous;
    hit.at = at;
    return c.pt3D(at);
}

// Selects the object, and opens the ring of its tools if it has some.
function openRing(hit: Hit, client: Vec2): void {
    const c = scene();
    held = { hit, client, screen: hold(c, hit, c.pt3D(hit.at)) };
    highlight(hit.object);
    showActions();
    const tools = toolsFor(hit.object, vec3());
    if (!tools[0]) return;
    // Each family's sector, even its places without a tool for the object.
    const sectors = [...new Set(tools.map(({ family }) => family))]
        .map(({ hue, tone, first, last }) => {
            const [x0, y0] = onRing(first);
            const [x1, y1] = onRing(last);
            return `<path d="M${x0} ${y0}A${RING_RADIUS} ${RING_RADIUS} 0 0 1 ${x1} ${y1}" style="stroke:hsl(${hue} ${70 * tone}% 50% / 0.2)"/>`;
        })
        .join("");
    ring.inner(
        `<svg class="dge-sectors" width="1" height="1">${sectors}<path class="dge-tie"/></svg>`,
    );
    placeRing();
    tools.forEach((tool) => {
        const [x, y] = onRing(tool.slot);
        const item = $.create("button")
            .att("aria-label", commandName(tool.command))
            .stl("left", `${x}px`)
            .stl("top", `${y}px`)
            .stl("--dge-hue", `${tool.family.hue}`)
            .stl("--dge-tone", `${tool.family.tone}`)
            .append(
                `<svg viewBox="0 0 24 24" aria-hidden="true">${tool.icon}</svg>`,
            );
        item.on(
            "pointerenter",
            () => showHint(describe(tool, firstArgs(tool, hit.object))),
            false,
        );
        item.on("pointerleave", () => showHint(""), false);
        // Pressed, the tool waits for its arguments, and the same gesture
        // may go on to designate one.
        item.on("pointerdown", (event) => {
            const box = item.dom().getBoundingClientRect();
            item.dom().releasePointerCapture(event.pointerId);
            closeRing();
            choose(tool, hit);
            if (!pending) return;
            aim = {
                button: [box.x + box.width / 2, box.y + box.height / 2],
            };
            follow(event);
        });
        ring.add(item);
    });
    ring.show();
}

function placeRing(): void {
    const { client } = held!;
    // Whole in the figure, the ring moves inwards rather than folding, its
    // tools keeping their places.
    const box = scene().svg.dom().getBoundingClientRect();
    const margin = RING_RADIUS + RING_BUTTON + 6;
    const inside = (at: number, from: number, size: number) =>
        Math.max(from + margin, Math.min(at, from + size - margin));
    let left = inside(client[0], box.left, box.width);
    let top = inside(client[1], box.top, box.height);
    let dx = client[0] - left;
    let dy = client[1] - top;
    // The object not under a button, but beyond them.
    const clear = margin - RING_RADIUS + 14;
    const distance = Math.hypot(dx, dy);
    if (Math.abs(distance - RING_RADIUS) < clear) {
        const scale = (RING_RADIUS + clear) / distance;
        [dx, dy] = [dx * scale, dy * scale];
        [left, top] = [client[0] - dx, client[1] - dy];
    }
    // Moved, it stays tied to its object.
    ring.find(".dge-tie")!.att("d", dx || dy ? `M0 0L${dx} ${dy}` : "");
    ring.stl("left", `${left}px`).stl("top", `${top}px`);
}

// The ring follows its object, dragged or moved with the view.
function moveRing(): void {
    if (!held || ring.isHidden()) return;
    const c = scene();
    c.flush();
    const screen = hold(c, held.hit, held.screen);
    held.client = vAdd(held.client, vSub(screen, held.screen));
    held.screen = screen;
    placeRing();
}

function closeRing(): void {
    held = null;
    ring.hide().inner("");
    highlight();
    showActions();
    if (!pending) showHint("");
}

// The object the actions act on, Delete included.
const target = (): construction_object | null =>
    propertiesOpen ? properties.selected : (held?.hit.object ?? null);

// The bar's actions, shown with the ring, and gone once one is applied.
function showActions(): void {
    const object = held?.hit.object ?? magnetizing?.point;
    if (!object) {
        actions.hide();
        return;
    }
    const name = formatName(object.name);
    const label = magnetizing ? message("magnets_of", name) : name;
    swatch.stl("background", object.stroke_color);
    objectName.text(label);
    [deleteButton, settingsButton].forEach((action) =>
        magnetizing ? action.hide() : action.show("grid"),
    );
    if (!magnetizing && magnetizable(object)) magnetButton.show("grid");
    else magnetButton.hide();
    if (magnetizing) doneButton.show();
    else doneButton.hide();
    actions.att("aria-label", label).show("flex");
}

function remove(): void {
    const object = target()!;
    stopMagnets();
    closeRing();
    scene().removeObject(object);
    done();
}

// ************************** MAGNETS *****************************

const reachField = () => reachInput.dom() as HTMLInputElement;

const restingHint = (): string =>
    ghosts
        ? message("erasing")
        : magnetizing
          ? message("magnet_hint", formatName(magnetizing.point.name))
          : "";

// Its targets attract the point while it's dragged, as in DGPad: a tap on
// an object makes it one, or chooses it to set its reach.
function startMagnets(point: point_object): void {
    magnetizing = { point, target: null, away: 0 };
    closeRing();
    point.dom.addClass("dge-source");
    showMagnets();
    showHint(restingHint());
}

function stopMagnets(): void {
    if (!magnetizing) return;
    magnetizing.point.dom.removeClass("dge-source");
    magnetizing = null;
    magnetCard.hide();
    showMagnets();
    showActions();
    showHint("");
}

function chooseTarget(target: magnet_target): void {
    const { point } = magnetizing!;
    magnetizing!.target = target;
    if (!reachOf(point, target)) {
        setReach(point, target, standardReach);
        changed();
    }
    const name = formatName(target.name);
    reachSwatch.stl("background", target.stroke_color);
    reachName.text(name);
    reachInput.att("aria-label", message("reach", name));
    const reach = reachOf(point, target);
    magnetizing!.away = 16 + Math.min(reach, 100);
    reachField().value = String(
        REACHES.reduce((best, stop, index) =>
            Math.abs(stop - reach) < Math.abs(REACHES[best] - reach)
                ? index
                : best,
        ),
    );
    magnetCard.show("flex");
    showReach();
}

function showReach(): void {
    const { point, target } = magnetizing!;
    const reach = reachOf(point, target!);
    reachValue.text(
        reach
            ? reach < REACHES[REACHES.length - 1]
                ? `${reach} px`
                : message("full_reach")
            : message("no_reach"),
    );
    showMagnets();
}

// The other objects behind a white veil, the targets in red, as in DGPad,
// over the zones where they attract the point, and the reach of the one
// chosen beyond its zone, where it attracts the point most.
function showMagnets(): void {
    const c = scene();
    c.svg.toggleClass("dge-magnetizing", !!magnetizing);
    c.svg
        .findAll(".dge-target")
        .forEach((target) => target.removeClass("dge-target"));
    zones.forEach((zone) => zone.remove());
    zones = [];
    if (!magnetizing) return;
    c.flush();
    const { point, target, away } = magnetizing;
    point.magnets.forEach(({ target: shown, radius }) => {
        if (shown.hasView) shown.dom.addClass("dge-target");
        const zone = showZone(shown, radius);
        if (zone) zones.push(zone.toggleClass("dge-chosen", shown === target));
    });
    if (!target) return;
    const at = nearest(c, target, point.SCREEN);
    const screen = at && c.pt3D(at);
    const [x, y] = screen && vIsFinite(screen) ? screen : point.SCREEN;
    const box = c.svg.dom().getBoundingClientRect();
    const { width, height } = magnetCard.dom().getBoundingClientRect();
    const left = box.left + x - width / 2;
    const top = box.top + y + away;
    // Above the hint.
    const bottom = hint.text()
        ? hint.dom().getBoundingClientRect().top
        : window.innerHeight;
    magnetCard
        .stl(
            "left",
            `${Math.max(8, Math.min(left, window.innerWidth - width - 8))}px`,
        )
        .stl(
            "top",
            `${Math.max(8, top + height > bottom - 8 ? top - 2 * away - height : top)}px`,
        );
}

// The object meant by a click on these hits, chosen in a menu when several
// may be.
function chooseHit(hits: Hit[], client: Vec2, then: (hit: Hit) => void): void {
    const candidates = meant(hits);
    if (!candidates[1]) return then(candidates[0]);
    const c = scene();
    const index = figureIndex(c);
    const objects = figureObjects(c);
    menu.inner("");
    candidates.forEach((hit) => {
        const item = $.create("div")
            .att("role", "menuitem")
            .text(
                lineOf(hit.object, index, objects) ??
                    `${formatName(hit.object.name)} = …`,
            );
        item.on("pointerenter", () => highlight(hit.object), false);
        item.on("click", () => {
            closeMenu();
            then(hit);
        });
        menu.add(item);
    });
    const [x, y] = vAdd(client, [8, 8]);
    menu.stl("left", `${x}px`).stl("top", `${y}px`).show();
    const { width, height } = menu.dom().getBoundingClientRect();
    menu.stl("left", `${Math.min(x, window.innerWidth - width - 8)}px`).stl(
        "top",
        `${Math.min(y, window.innerHeight - height - 8)}px`,
    );
}

function closeMenu(): void {
    if (menu.isHidden()) return;
    menu.hide().inner("");
    highlight();
}

function choose(tool: Tool, { object, at }: Hit): void {
    const c = scene();
    if (tool.mode === "point")
        return done(addPointOn(c, nextName(c, true), object, at));
    pending = { tool, args: firstArgs(tool, object) };
    // An intersection waits for its second object.
    if (tool.mode === "intersection") return prompt();
    proceed();
}

// Builds the object once all its arguments are designated.
function proceed(): void {
    const { tool, args } = pending!;
    if (tool.overload.variadic || args.includes(undefined)) return prompt();
    build(tool.overload, args as Arg[]);
}

function build(overload: Overload, args: Arg[]): void {
    clearPreview();
    const c = scene();
    const point = isPointTag(overload.tag);
    done(add(c, { name: nextName(c, point), overload, args }));
}

function designate(screen: Vec2, hits: Hit[], client: Vec2): void {
    const { tool, args } = pending!;
    if (tool.mode === "intersection") {
        const first = args[0] as construction_object;
        const curves = hits.filter(
            ({ object }) =>
                object !== first && accepts(object, "intersectable"),
        );
        if (!curves[0]) return;
        return chooseHit(curves, client, ({ object }) => {
            const { overload, args: found } = intersection(
                first,
                object,
                nearestBranch(scene(), first, object, screen)?.order ?? 0,
            );
            build(overload, found);
        });
    }
    const overload = tool.overload;
    const param = paramAt(overload, nextSlot())!;
    if (overload.variadic && args.length >= 3 && hits[0]?.object === args[0])
        return build(overload, args as Arg[]);
    const next = (arg: construction_object) => {
        if (overload.variadic) args.push(arg);
        else args[nextSlot()] = arg;
        proceed();
    };
    if (param === "point") {
        clearPreview();
        return designatePoint(screen, hits, client, (arg) => {
            if (arg !== hits[0]?.object) changed(arg);
            next(arg);
        });
    }
    const taken = hits.filter(({ object }) => accepts(object, param));
    if (taken[0]) chooseHit(taken, client, ({ object }) => next(object));
}

function clearPreview(): void {
    if (!preview) return;
    const c = scene();
    preview.objects.forEach((object) => {
        if (c.getObj(object.name) === object) c.removeObject(object);
    });
    preview = null;
}

// `point` turned around `center` by `angle`, parallel to the plane z = 0.
function turn(point: Vec3, center: Vec3, angle: number): Vec3 {
    const [x, y, z] = vSub(point, center);
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    return vAdd(center, [x * cos - y * sin, x * sin + y * cos, z]);
}

// While the argument after the next one is missing too, a point stands in
// for it, from the first argument and the next one, as in DGPad: the
// bisector and the angle at the pointer, the circle on the diameter from the
// first point to the pointer, the polygon reduced to a segment.
const STAND_INS: Partial<Record<string, (first: Vec3, next: Vec3) => Vec3>> = {
    Bis: (first) => first,
    Ang: (first, next) => turn(first, next, Math.PI / 3),
    C3p: (first, next) =>
        turn(first, vScale(vAdd(first, next), 0.5), Math.PI / 2),
    Poly: (_, next) => next,
};
STAND_INS.C3s = STAND_INS.C3p;

// The line typed as a tool waiting for its next argument, the object under
// the pointer or a point there.
function typedPending(
    field: HTMLInputElement,
    hits: Hit[],
): { overload: Overload; args: (Arg | undefined)[]; free: boolean } | null {
    const call = typedCall(field);
    if (!call) return null;
    const hit = hits.find(({ object }) => taking(call, object));
    const free = expectsPoint(field, call);
    const overload = hit
        ? taking(call, hit.object)
        : free
          ? call.overloads.find(
                (overload) => paramAt(overload, call.args.length) === "point",
            )
          : undefined;
    if (!overload) return null;
    const { args } = call;
    return {
        overload,
        args: overload.variadic
            ? args
            : [...args, ...Array(overload.params.length - args.length)],
        free,
    };
}

// What the tool, or the line typed, would build, its next argument being
// under the pointer.
function updatePreview(screen: Vec2, hits: Hit[]): void {
    const field = editing();
    const call = pending
        ? pending.tool.mode === "command" && {
              overload: pending.tool.overload,
              args: pending.args,
              free: true,
          }
        : field && typedPending(field, hits);
    if (!call) return clearPreview();
    const { overload, args, free } = call;
    const slot = overload.variadic ? args.length : args.indexOf(undefined);
    // After the next one.
    const missing = overload.variadic
        ? overload.params.length - args.length - 1
        : args.filter((arg) => arg === undefined).length - 1;
    const stand = missing === 1 && STAND_INS[overload.tag];
    if (missing > 0 && !stand) return clearPreview();
    const param = paramAt(overload, slot)!;
    const hit = hits.find(({ object }) => accepts(object, param));
    const candidate =
        hit?.object ??
        (param === "point" && free ? ("pointer" as const) : null);
    const c = scene();
    const coords = freeCoords(screen);
    if (!candidate || (candidate === "pointer" && !coords))
        return clearPreview();
    if (preview?.candidate !== candidate) {
        clearPreview();
        const objects: construction_object[] = [];
        const argument =
            candidate === "pointer"
                ? add(
                      c,
                      { name: "‧p", overload: FREE_POINT, args: coords! },
                      false,
                  )
                : candidate;
        if (candidate === "pointer") objects.push(argument);
        const full = [...args];
        if (overload.variadic) full.push(argument);
        else full[slot] = argument;
        let standIn: point_object | undefined;
        if (stand) {
            standIn = add(
                c,
                { name: "‧s", overload: FREE_POINT, args: coords ?? [0, 0] },
                false,
            ) as point_object;
            standIn.hidden = 1;
            standIn.updateView();
            objects.push(standIn);
            if (overload.variadic) full.push(standIn);
            else full[full.indexOf(undefined)] = standIn;
        }
        const result = add(
            c,
            { name: "‧r", overload, args: full as Arg[] },
            false,
        );
        if (result.hasView) result.dom.addClass("dge-preview");
        objects.push(result);
        preview = {
            candidate,
            objects,
            pointer:
                candidate === "pointer"
                    ? (argument as point_object)
                    : undefined,
            standIn,
        };
    }
    const { pointer, standIn } = preview;
    if (pointer) {
        const [x, y, z = 0] = coords!;
        pointer.coords = [x, y, z];
        c.invalidateGeometry(pointer);
    }
    if (stand) {
        standIn!.coords = stand(
            (args[0] as point_object).coords,
            (pointer ?? (candidate as point_object)).coords,
        );
        c.invalidateGeometry(standIn!);
    }
}

// A tap hides or shows the object under it, and nothing is built.
function setEraser(on: boolean): void {
    if (on && propertiesOpen) setProperties(false);
    if (on === !!ghosts) return;
    cancel();
    if (ghosts) hideGhosts(ghosts);
    ghosts = on ? showGhosts(scene()) : null;
    eraserButton.toggleClass("dge-on", on).att("aria-pressed", String(on));
    rows.forEach((row, object) =>
        row.toggleClass("dge-hidden", looksHidden(object)),
    );
    showHint(on ? message("erasing") : "");
}

// The axes with the grid, or in 3D the trihedron with the floor, as
// DGPad's isAxis.
function setAxes(on: boolean): void {
    const c = scene();
    c.GRID.hidden = on ? 0 : 1;
    if (on) c.GRID.showGrid = true;
    if (!c.GRID.is2D) c.GRID.SHOWFLOOR = on;
    c.invalidateProjection();
    axesButton.toggleClass("dge-on", on).att("aria-pressed", String(on));
}

function cancel(): void {
    stopMagnets();
    pending = null;
    aim = null;
    clearPreview();
    closeMenu();
    closeRing();
    showHint("");
}

function done(object?: construction_object): void {
    pending = null;
    clearPreview();
    highlight();
    showAccepted([]);
    changed(object);
}

// After a change of the figure: its text, and a step to undo.
function changed(object?: construction_object): void {
    forgetBranches();
    dropLostMagnets(scene());
    scene().flush();
    void record().then(() => {
        refreshRows();
        const row = object && rows.get(object);
        if (row) {
            row.addClass("dge-new").dom().scrollIntoView({ block: "nearest" });
            setTimeout(() => row.removeClass("dge-new"), 1200);
        }
        if (pending) prompt();
        else
            showHint(
                row ? (row.dom() as HTMLInputElement).value : restingHint(),
            );
    });
}

// ************************** POINTER *****************************

let down: { x: number; y: number; time: number } | null = null;
// The line typed for which a tap in the void makes a point.
let typing: HTMLInputElement | null = null;
let dragFrame: number | null = null;
// A pointer pressed while a tool waits: it aims and designates where it's
// released, unless still on the button that chose the tool.
let aim: { button: Vec2 | null } | null = null;

const onButton = (event: PointerEvent): boolean =>
    !!aim?.button &&
    Math.hypot(event.clientX - aim.button[0], event.clientY - aim.button[1]) <=
        RING_BUTTON;
const aiming = (event: PointerEvent): boolean =>
    inFigure(event) && !onButton(event);

// What the pointer designates there. Still on the button, it designates
// nothing, but what it would build already follows it.
function follow(event: PointerEvent): void {
    const button = onButton(event);
    if (!button && !inFigure(event)) {
        clearPreview();
        return highlight();
    }
    const c = scene();
    const screen = c.pointerPosition(event);
    const hits = button ? [] : pick(c, screen, previewed());
    if (pending || editing()) updatePreview(screen, hits);
    if (held) return;
    // The two objects whose intersection a click would make.
    const cross = wantsPoint(hits) && crossing(c, screen, hits);
    const shown = magnetizing
        ? hits.filter(({ object }) => attracts(magnetizing!.point, object))
        : hits;
    highlight(
        ...(cross
            ? [cross.a, cross.b]
            : shown.slice(0, 1).map(({ object }) => object)),
    );
}

$("body").on(
    "pointerdown",
    (event) => {
        // Pressed elsewhere, the menu closes, and the figure does nothing.
        if (!menu.isHidden() && !menu.dom().contains(element(event.target))) {
            closeMenu();
            if (inFigure(event)) {
                down = null;
                event.stopPropagation();
                return;
            }
        }
        if (!inFigure(event) || !event.isPrimary) return;
        down = { x: event.clientX, y: event.clientY, time: performance.now() };
        const c = scene();
        const screen = c.pointerPosition(event);
        if (propertiesOpen) {
            const object = propertyObject(event);
            if (
                object instanceof button_object ||
                (object instanceof expression_object &&
                    (object.checkbox || object.inputLength > 0))
            ) {
                down = null;
                event.preventDefault();
                event.stopPropagation();
                properties.select(object);
            }
            return;
        }
        const field = editing();
        typing = null;
        if (field) {
            const hits = pick(c, screen, previewed());
            if (!hits[0]) {
                if (expectsPoint(field, typedCall(field))) typing = field;
                return;
            }
            clearPreview();
            const call = typedCall(field);
            const taken = call
                ? hits.filter(({ object }) => taking(call, object))
                : [];
            const client: Vec2 = [event.clientX, event.clientY];
            if (!taken[0] && expectsPoint(field, call))
                designatePoint(screen, hits, client, (point) => {
                    changed(point);
                    designateTyped(field, point);
                });
            else
                chooseHit(taken[0] ? taken : hits, client, ({ object }) =>
                    designateTyped(field, object),
                );
            down = null;
            event.stopPropagation();
            return;
        }
        // Nothing is dragged while aiming, and the finger's first aim has
        // no hover before it.
        if (pending) {
            down = null;
            aim = { button: null };
            event.stopPropagation();
            follow(event);
        }
    },
    { capture: true, prevent: false },
);

// The field being edited keeps the focus.
$("body").on(
    "mousedown",
    (event) => {
        if (inFigure(event) && editing() && (!down || typing))
            event.preventDefault();
    },
    { capture: true, prevent: false },
);

// Once a frame, what follows the figure.
function dragged(): void {
    dragFrame ??= requestAnimationFrame(() => {
        dragFrame = null;
        forgetBranches();
        updateRows();
        moveRing();
        showMagnets();
    });
}

$("body").on(
    "wheel",
    (event) => {
        if (inFigure(event)) dragged();
    },
    { prevent: false, passive: true },
);

$("body").on(
    "pointermove",
    (event) => {
        if (!event.isPrimary || (!aim && !inFigure(event))) return;
        if (event.buttons && !aim) return dragged();
        follow(event);
    },
    { capture: true, prevent: false, passive: true },
);

$("body").on(
    "pointerup",
    (event) => {
        if (!event.isPrimary) return;
        // The figure may have changed since the hover.
        forgetBranches();
        if (aim) {
            const designates = aiming(event);
            aim = null;
            if (designates) {
                const c = scene();
                const screen = c.pointerPosition(event);
                designate(screen, pick(c, screen, previewed()), [
                    event.clientX,
                    event.clientY,
                ]);
            }
            // A finger lifted no longer shows what it would designate.
            if (event.pointerType === "touch") {
                clearPreview();
                highlight();
            }
            return;
        }
        if (!down) return;
        const tap =
            Math.hypot(event.clientX - down.x, event.clientY - down.y) <=
                $.clickRadius && performance.now() - down.time <= $.clickDelay;
        down = null;
        if (!inFigure(event)) return;
        if (!tap) {
            void record().then(updateRows);
            return;
        }
        if (held) return closeRing();
        const c = scene();
        const screen = c.pointerPosition(event);
        const hits = pick(c, screen, previewed());
        const client: Vec2 = [event.clientX, event.clientY];
        if (magnetizing) {
            const { point } = magnetizing;
            const targets = hits.filter(({ object }) =>
                attracts(point, object),
            );
            if (hits[0]?.object === point) return;
            if (targets[0])
                return chooseHit(targets, client, ({ object }) =>
                    chooseTarget(object as magnet_target),
                );
            return stopMagnets();
        }
        if (propertiesOpen) {
            // A widget, or an object the figure can't pick, as an angle.
            const object = propertyObject(event);
            if (!hits.some((hit) => hit.object === object) && object)
                return properties.select(object);
            if (!hits[0]) return properties.select(null);
            return chooseHit(hits, client, (hit) =>
                properties.select(hit.object),
            );
        }
        if (ghosts) {
            if (!hits[0]) return;
            const erasing = ghosts;
            return chooseHit(hits, client, ({ object }) => {
                toggleGhost(erasing, object);
                changed();
            });
        }
        const cross = crossing(c, screen, hits);
        if (cross) return done(addCrossing(cross));
        if (hits[0])
            return chooseHit(hits, client, (hit) => openRing(hit, client));
        const field = typing;
        const point = addFreePoint(screen);
        if (!point) return;
        done(point);
        if (field) designateTyped(field, point);
    },
    { capture: true, prevent: false },
);

$("body").on(
    "keydown",
    (event) => {
        const command = event.metaKey || event.ctrlKey;
        if (command && event.key.toLowerCase() === "s") {
            event.preventDefault();
            void save();
        } else if (
            editing() ||
            ([properties.panel, magnetCard].some((box) =>
                box.dom().contains(element(event.target)),
            ) &&
                event.key !== "Escape")
        )
            return;
        else if (command && event.key.toLowerCase() === "z") {
            event.preventDefault();
            travel(event.shiftKey ? 1 : -1);
        } else if (command && event.key.toLowerCase() === "y") {
            event.preventDefault();
            travel(1);
        } else if (
            (event.key === "Delete" || event.key === "Backspace") &&
            target()
        ) {
            event.preventDefault();
            remove();
        } else if (event.key === "Escape") {
            if (!menu.isHidden()) closeMenu();
            else if (propertiesOpen) setProperties(false);
            else if (ghosts) setEraser(false);
            else cancel();
        }
    },
    false,
);

// ************************** HISTORY *****************************

// Each step's figure, but its view.
let history: string[] = [];
let position = -1;
let recording = Promise.resolve();

function record(): Promise<void> {
    recording = recording.then(async () => {
        const figure = await withGhostsHidden(ghosts ?? [], () =>
            describeDgo(scene()),
        );
        const step = JSON.stringify({ ...figure, v: undefined });
        if (step === history[position]) return;
        history = [...history.slice(0, position + 1), step];
        position = history.length - 1;
    });
    return recording;
}

function travel(step: number): void {
    recording = recording.then(async () => {
        if (!history[position + step]) return;
        cancel();
        position += step;
        const { v } = await describeDgo(scene());
        rebuild(studio, { ...JSON.parse(history[position]), v });
        if (ghosts) ghosts = showGhosts(scene());
        refreshRows();
    });
}

// ************************** FILES *******************************

async function save(): Promise<void> {
    const href = URL.createObjectURL(
        await withGhostsHidden(ghosts ?? [], () => writeDgo(scene())),
    );
    (
        $.create("a")
            .att("href", href)
            .att("download", `${figureName}.dgo`)
            .dom() as HTMLAnchorElement
    ).click();
    setTimeout(() => URL.revokeObjectURL(href));
}

async function open(
    name: string,
    load: (c: construction) => Promise<string[]>,
): Promise<void> {
    setEraser(false);
    cancel();
    properties.select(null);
    studio.scene.dispose();
    studio.scene = construction.create(studio);
    const unsupported = await load(studio.scene);
    studio.scene.flush();
    studio.scene.reveal();
    axesButton
        .toggleClass("dge-on", studio.scene.GRID.hidden === 0)
        .att("aria-pressed", String(studio.scene.GRID.hidden === 0));
    figureName = name
        .split(/[/\\?#]/)
        .filter(Boolean)
        .pop()!
        .replace(/\.[^.]*$/, "");
    history = [];
    position = -1;
    await record();
    refreshRows();
    showHint(
        unsupported.length
            ? message("unsupported", unsupported.join(", "))
            : "",
        unsupported.length > 0,
    );
}

fileInput.on(
    "change",
    () => {
        const file = (fileInput.dom() as HTMLInputElement).files![0];
        void open(file.name, async (c) =>
            /\.ggb$/i.test(file.name)
                ? importGgbFromBlob(c, file)
                : /\.dgo$/i.test(file.name)
                  ? importDgoFromBlob(c, file)
                  : importDgp(c, await file.text()),
        );
        (fileInput.dom() as HTMLInputElement).value = "";
    },
    false,
);

bindRow(input, null);
$("body").observeResize(() => {
    if (
        propertiesOpen &&
        window.innerWidth <= 900 &&
        historyButton.getAtt("aria-expanded") === "true"
    )
        setPanel(false);
});
if (window.matchMedia("(max-width: 600px)").matches) setPanel(false, false);

const url = new URLSearchParams(window.location.search).get("url");
export const EDITOR_READY = url
    ? open(url, (c) =>
          /\.ggb$/i.test(url)
              ? importGgbFromUrl(c, url)
              : /\.dgo$/i.test(url)
                ? importDgoFromUrl(c, url)
                : importDgpFromUrl(c, url),
      )
    : open("figure", async (c) => {
          readDgo(c, {
              dgo: 1,
              v: {
                  o: [c.width / 2, c.height / 2],
                  u: 40,
                  w: c.width,
                  h: c.height,
                  ax: 0,
              },
              o: [],
          });
          return [];
      });

export { studio };
