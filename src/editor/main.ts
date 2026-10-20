// First, as in the player: the object classes import each other.
import { AWAKE, construction } from "../construction";
import type { Animation } from "../animation";
import {
    describeDgo,
    figureObjects,
    importDgoFromBlob,
    importDgoFromUrl,
    readDgo,
    writeDgo,
    type DgoFigure,
} from "../dgo";
import { importDgp, importDgpFromUrl } from "../dgp_importer";
import { $, type DOMElement } from "../dom";
import { dropFigures } from "../drop";
import { importGgbFromBlob, importGgbFromUrl } from "../ggb_importer";
import { LANG } from "../i18n";
import type { construction_object } from "../objects/construction_object";
import { point_object, type magnet_target } from "../objects/point_object";
import { button_object } from "../objects/button_object";
import { event_object, type Trigger } from "../objects/event_object";
import { expression_object } from "../objects/expression_object";
import { expression_list_object } from "../objects/expression_list_object";
import { panel_object } from "../objects/panel_object";
import { polygon_object } from "../objects/polygon_object";
import { sphere_object } from "../objects/sphere_object";
import { solid_object } from "../objects/solid_object";
import { preferences } from "../preferences";
import {
    vAdd,
    vIsFinite,
    vNorm,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import {
    accepts,
    commandName,
    commandsStarting,
    findCommand,
    FUNCTIONS,
    isCommand,
    overloadFor,
    paramAt,
    readable,
    TextArg,
    type Arg,
    type Command,
    type Overload,
    type Param,
} from "./catalog";
import {
    add,
    addFloor,
    addPointOn,
    buttonOverload,
    cubeOn,
    entryOf,
    figureIndex,
    formatArg,
    floorOf,
    FREE_POINT,
    addEvent,
    hasName,
    lineOf,
    nextName,
    valueText,
    rebuild,
    redefine,
    resolve,
    resolveWithGlobals,
    resolveWithSliders,
    setsValues,
    turtleStart,
    type Spec,
    type Studio,
} from "./figure";
import { conicStandIns } from "./conic_preview";
import {
    chooseFile,
    fileLabel,
    native,
    opened,
    saveFile,
    showChanged,
    standalone,
} from "./file";
import { DELETE_KEY, menuBar, shortcut, type Menu } from "./menus";
import { hideGhosts, showGhosts, toggleGhost, withHidden } from "./eraser";
import { message, type MessageKey } from "./messages";
import { ACTION_ICONS } from "./icons";
import { turtleLayer } from "./turtle";
import { onEnlarge, shrinkBlocks } from "./blocks/view";
import {
    arcAt,
    asleep,
    crossing,
    forgetBranches,
    meant,
    nearest,
    nearestBranch,
    pick,
    vertexOf,
    type Angle,
    type Crossing,
    type Hit,
} from "./pick";
import {
    completionAt,
    formatName,
    parseLine,
    pointFormulaText,
    quoteText,
    TextError,
    type ArgumentCompletion,
    type Line,
} from "./text";
import { labelAt, labelHold, nameElement, placeLabel } from "./labels";
import {
    assign,
    driverOf,
    emptyArgs,
    itemLabel,
    RING_SLOTS,
    TOOL_FAMILIES,
    toolsFor,
    usable,
    type Family,
    type Item,
    type Tool,
} from "./tools";
import { propertiesPanel } from "./properties";
import { resizeHandle } from "./resize";
import {
    attracts,
    dropLostMagnets,
    magnetizable,
    REACHES,
    reachOf,
    setReach,
    showZone,
} from "./magnets";
import { pinnable, togglePin } from "./pin";
import {
    anchorOf,
    ghostAt,
    ghostDrawing,
    handleOf,
    moveGhost,
    pull,
    setAnimation,
    springOf,
    springy,
    type Ghost,
    type Spring,
    type springy_object,
} from "./spring";
import { offPlane, PLANE, SPACE, turnView } from "./space";
import { showStep as showStepOf, stepOf, steps, type Stepping } from "./steps";
import "./properties.css";

// The construction editor: see EDITOR.md.

const PANEL_WIDTH = 320;
// How long the panels take to slide, in milliseconds.
const SLIDE = 240;
const RING_BUTTON = 20;
const RING_RADIUS = (RING_SLOTS * (2 * RING_BUTTON + 2)) / (2 * Math.PI);

function mountButtonTools(object: construction_object): void {
    if (!(object instanceof button_object)) return;
    const tools = object.accessory.stl("cursor:pointer");
    const hit = tools
        .shape("rect")
        .att("x", -14)
        .att("width", 36)
        .att("rx", 7)
        .stl(
            "y:calc(var(--button-height) * -0.5);height:var(--button-height);fill:transparent",
        );
    const circle = tools
        .shape("circle")
        .att("r", 14)
        .stl("fill:#f8f9fa;stroke:#b7bdc6;stroke-width:1");
    tools.add(hit, circle);
    [-5, 0, 5].forEach((y) =>
        tools.add(
            tools
                .shape("circle")
                .att("cy", y)
                .att("r", 1.5)
                .stl(`fill:${object.stroke_color};pointer-events:none`),
        ),
    );
}

const studio = {
    prefs: new preferences(),
    mountObject: mountButtonTools,
} as Studio;
studio.scene = construction.create(studio);
const scene = () => studio.scene;

$("html").att("lang", LANG).stl("width:100%;height:100%");
document.title = message("title");
// The figure fills the window beside the text.
$("body")
    .cls("dge-editor")
    .stl("position:relative;overflow:hidden;touch-action:none")
    .att("oncontextmenu", "return false;");
$("head").append(`<style>
    /* Menlo and DejaVu Sans Mono draw Arabic letters unjoined: a font of the system draws them. */
    @font-face { font-family: dge-code; src: local("Menlo Regular"), local("Menlo-Regular"), local("Consolas"), local("DejaVu Sans Mono"); unicode-range: U+0-5FF, U+700-74F, U+780-89F, U+900-FB4F, U+FE00-FE6F, U+FF00-10FFFF; }
    .dge-editor { --dge-code: ui-monospace, dge-code, "Geeza Pro", "Segoe UI", "Noto Sans Arabic", monospace; --dge-panel-size: min(var(--dge-panel-user, ${PANEL_WIDTH}px), calc(100vw - 56px)); --dge-panel-width: var(--dge-panel-size); --dge-menu-height: 0px; --dge-bar-height: calc(48px + var(--dge-menu-height)); --dge-slide-duration: 0s; --dge-slide: var(--dge-slide-duration) cubic-bezier(0.22, 1, 0.36, 1); margin: 0; margin-inline-start: var(--dge-panel-width); margin-block-start: var(--dge-bar-height); width: calc(100% - var(--dge-panel-width)); height: calc(100% - var(--dge-bar-height)); transition: margin-inline-start var(--dge-slide), width var(--dge-slide); }
    .dge-editor.dge-menus { --dge-menu-height: 32px; }
    .dge-editor.dge-panel-animated { --dge-slide-duration: ${SLIDE}ms; }
    .dge-editor.dge-panel-closed { --dge-panel-width: 0px; }
    .dge-panel-closed .dge-panel { transform: translateX(-100%); visibility: hidden; transition-delay: 0s, var(--dge-slide-duration); }
    .dge-panel, .dge-bar, .dge-hint, .dge-ring, .dge-complete, .dge-menu, .dge-magnet, .dge-tools { font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2937; }
    .dge-panel { position: fixed; inset-block: var(--dge-bar-height) 0; inset-inline-start: 0; width: var(--dge-panel-size); box-sizing: border-box; overflow: auto; background: #fff; border-inline-end: 1px solid #e5e7eb; z-index: 10; touch-action: pan-y; transform: translateX(0); transition: transform var(--dge-slide), visibility 0s; }
    .dge-panel-header { position: sticky; top: 0; display: flex; align-items: center; justify-content: space-between; padding: 8px 12px 8px 16px; background: #fff; border-block-end: 1px solid #e5e7eb; z-index: 1; }
    .dge-panel-header h2 { flex: 1; min-width: 0; margin: 0; overflow: hidden; font-size: 14px; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
    .dge-resize { position: fixed; inset-block: var(--dge-bar-height) 0; width: 9px; margin-inline: -4px; z-index: 11; cursor: col-resize; touch-action: none; }
    .dge-resize::after { content: ""; position: absolute; inset-block: 0; left: 3px; width: 3px; transition: background 0.15s; }
    .dge-resize:hover::after, .dge-resize.dge-on::after { background: #2563eb; transition-delay: 0.1s; }
    .dge-panel + .dge-resize { left: var(--dge-panel-size); }
    .dge-panel-closed .dge-panel + .dge-resize { display: none; }
    .dge-editor.dge-resizing { --dge-slide-duration: 0s; cursor: col-resize; user-select: none; }
    .dge-panel-header h2 .dge-count { margin-inline-start: 8px; padding: 1px 7px; border-radius: 9px; background: #f1f5f9; color: #64748b; font-size: 12px; font-weight: 500; font-variant-numeric: tabular-nums; vertical-align: 1px; }
    .dge-count:empty { display: none; }
    .dge-item { display: flex; align-items: flex-start; padding-inline: 4px; border-block-end: 1px solid #f1f5f9; }
    .dge-item:hover { background: #f8fafc; }
    .dge-item:has(> .dge-hover) { background: #fef3c7; }
    .dge-item:has(> .dge-new) { animation: dge-new 1.2s ease-out; }
    .dge-item:has(> .dge-row:focus) { background: #eff6ff; box-shadow: inset 3px 0 #2563eb; }
    .dge-item:has(> .dge-error) { background: #fef2f2; box-shadow: inset 3px 0 #dc2626; }
    .dge-row { flex: 1; min-width: 0; padding: 7px 4px; border: 0; background: none; font: 13.5px/1.5 var(--dge-code); color: inherit; outline: none; }
    .dge-row[readonly], .dge-row.dge-hidden { color: #9ca3af; }
    .dge-dot { flex-shrink: 0; display: grid; place-items: center; width: 30px; height: 30px; margin-block: 2px; padding: 0; border: 0; border-radius: 50%; background: none; cursor: pointer; }
    .dge-dot::before { content: ""; box-sizing: border-box; width: 13px; height: 13px; border: 2px solid var(--dge-color); border-radius: 50%; background: var(--dge-color); box-shadow: 0 0 0 1px rgb(15 23 42 / 0.1); transition: background 0.15s; }
    .dge-dot[aria-pressed="false"]::before { background: #fff; opacity: 0.7; }
    .dge-dot:hover { background: rgb(15 23 42 / 0.06); }
    .dge-dot:focus-visible, .dge-item .dge-label:focus-visible { outline: 2px solid #2563eb; outline-offset: -2px; }
    .dge-dot:disabled { visibility: hidden; }
    .dge-item .dge-label { width: 30px; height: 30px; margin-block: 2px; border: 0; border-radius: 8px; color: #94a3b8; opacity: 0; }
    .dge-item .dge-label svg { width: 18px; height: 18px; }
    .dge-item .dge-label.dge-on { background: none; color: #475569; opacity: 1; }
    .dge-item:hover .dge-label, .dge-item:focus-within .dge-label { opacity: 1; }
    .dge-item .dge-label:hover { background: rgb(15 23 42 / 0.06); color: #1d4ed8; }
    @media (hover: none) { .dge-item .dge-label { opacity: 1; color: #cbd5e1; } }
    .dge-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .dge-value { margin-block-start: -5px; padding: 0 4px 7px; overflow: hidden; font: 12.5px/1.4 var(--dge-code); color: #64748b; white-space: nowrap; text-overflow: ellipsis; unicode-bidi: plaintext; }
    .dge-value:empty { display: none; }
    .dge-later > .dge-dot, .dge-later > .dge-text { opacity: 0.3; }
    .dge-properties-open .dge-text, .dge-properties-open .dge-row { cursor: pointer; }
    .dge-rows:not(.dge-taking) .dge-item.dge-shown { background: #eff6ff; box-shadow: inset 3px 0 #2563eb; }
    .dge-taking .dge-row { cursor: default; }
    .dge-taking .dge-item:not(.dge-takes, .dge-chosen) > :not(.dge-label) { opacity: 0.3; }
    .dge-item.dge-takes { background: #f0fdf4; box-shadow: inset 3px 0 #16a34a; }
    .dge-item.dge-takes:hover { background: #dcfce7; }
    .dge-item.dge-chosen { background: #eff6ff; box-shadow: inset 3px 0 #2563eb; }
    .dge-item.dge-chosen:hover { background: #dbeafe; }
    .dge-chosen::after { content: attr(data-places); align-self: center; min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 9px; background: #2563eb; color: #fff; font: 600 11px/18px system-ui, -apple-system, "Segoe UI", sans-serif; text-align: center; }
    .dge-item > .dge-label { order: 1; }
    .dge-takes .dge-text, .dge-takes .dge-row { cursor: pointer; }
    .dge-item.dge-current { background: #eff6ff; box-shadow: inset 3px 0 #2563eb; }
    .dge-stepping .dge-item, .dge-stepping .dge-row { cursor: pointer; }
    .dge-stepping .dge-item button { pointer-events: none; }
    .dge-steps { display: none; align-items: center; gap: 2px; }
    .dge-steps .dge-action { width: 34px; height: 34px; border-radius: 8px; }
    .dge-steps .dge-action svg { width: 20px; height: 20px; }
    .dge-step { flex: 1; text-align: center; font-weight: 600; font-variant-numeric: tabular-nums; color: #334155; white-space: nowrap; }
    .dge-stepping .dge-steps { display: flex; }
    .dge-stepping .dge-line { display: none; }
    .dge-line { display: flex; align-items: center; gap: 6px; }
    .dge-line .dge-input { flex: 1; min-width: 0; }
    .dge-line .dge-action { width: 38px; height: 38px; }
    .dge-line .dge-action.dge-armed { background: hsl(var(--dge-hue) calc(70% * var(--dge-tone)) 92%); border-color: hsl(var(--dge-hue) calc(55% * var(--dge-tone)) 55%); color: #334155; box-shadow: inset 0 1px 3px rgb(15 23 42 / 0.18); }
    .dge-entry { container-type: inline-size; }
    @container (max-width: 270px) { .dge-steps .dge-end-step { display: none; } }
    .dge-entry { padding: 10px 12px; border-block-end: 1px solid #e5e7eb; }
    #dge-history { display: flex; flex-direction: column; overflow: hidden; }
    .dge-rows { flex: 1; overflow: auto; }
    .dge-input { width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1px solid #dbe2ea; border-radius: 9px; background: #f8fafc; font: 13.5px/1.5 var(--dge-code); color: inherit; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
    .dge-input:hover { border-color: #c5cfdb; }
    .dge-input:focus { border-color: #2563eb; background: #fff; box-shadow: 0 0 0 3px rgb(37 99 235 / 0.15); }
    .dge-input.dge-error { border-color: #dc2626; background: #fef2f2; box-shadow: 0 0 0 3px rgb(220 38 38 / 0.12); }
    @keyframes dge-new { from { background: #bbf7d0; } }
    .dge-bar { position: fixed; inset-block-start: var(--dge-menu-height); inset-inline: 0; height: calc(var(--dge-bar-height) - var(--dge-menu-height)); box-sizing: border-box; display: flex; align-items: center; gap: 8px; padding: 4px 12px; background: #f8fafc; border-block-end: 1px solid #e2e8f0; z-index: 11; }
    .dge-bar-group { display: flex; gap: 4px; }
    .dge-bar-group + .dge-bar-group { padding-inline-start: 8px; border-inline-start: 1px solid #dbe2ea; }
    .dge-action { display: grid; place-items: center; flex-shrink: 0; width: 40px; height: 40px; padding: 0; border: 1px solid transparent; border-radius: 10px; background: transparent; color: #536174; cursor: pointer; }
    .dge-bar .dge-action { width: 36px; height: 36px; }
    .dge-help { margin-inline-start: 8px; text-decoration: none; }
    .dge-action svg { display: block; width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.65; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
    .dge-action:hover:not(:disabled) { background: #e8eef7; color: #1d4ed8; }
    .dge-action:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
    .dge-action:disabled { opacity: 0.3; cursor: default; }
    .dge-action.dge-on { background: #e0ebff; color: #1d4ed8; border-color: #bfd2f5; }
    .dge-action.dge-on:hover { background: #cfdefb; }
    .dge-bar-middle { flex: 1; display: flex; justify-content: center; min-width: 0; }
    .dge-bar .dge-bar-end { padding-inline-start: 0; border: 0; }
    .dge-menubar { position: fixed; inset-block-start: 0; inset-inline: 0; height: var(--dge-menu-height); box-sizing: border-box; display: flex; align-items: stretch; padding: 3px 8px; background: #fff; border-block-end: 1px solid #e2e8f0; font: 13px/1 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2937; z-index: 20; }
    .dge-menubar > div { position: relative; display: flex; }
    .dge-menubar > div > button { padding: 0 10px; border: 0; border-radius: 6px; background: none; font: inherit; color: inherit; }
    .dge-menubar > div > button:hover, .dge-menubar > div > button.dge-open { background: #eef2f7; }
    .dge-menubar > div > button:focus-visible { outline: 2px solid #2563eb; outline-offset: -2px; }
    .dge-menu-popup { position: absolute; top: calc(100% + 4px); inset-inline-start: 0; flex-direction: column; min-width: 220px; padding: 4px; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; box-shadow: 0 6px 20px rgb(0 0 0 / 0.14); outline: none; }
    .dge-menu-popup button { display: flex; align-items: center; padding: 6px 10px 6px 4px; border: 0; border-radius: 5px; background: none; font: inherit; color: inherit; text-align: start; white-space: nowrap; }
    .dge-menu-popup button::before { content: ""; width: 20px; flex: none; text-align: center; }
    .dge-menu-popup button[aria-checked="true"]::before { content: "✓"; }
    .dge-menu-popup button:not(:disabled):is(:hover, :focus-visible) { background: #2563eb; color: #fff; outline: none; }
    .dge-menu-popup button:disabled { opacity: 0.4; }
    .dge-menu-popup kbd { margin-inline-start: auto; padding-inline-start: 28px; font: inherit; opacity: 0.6; }
    .dge-menu-popup hr { margin: 4px 8px; border: 0; border-block-start: 1px solid #e5e7eb; }
    .dge-menu-veil { position: fixed; inset: 0; z-index: 19; }
    .dge-file { display: flex; align-items: center; gap: 8px; min-width: 0; max-width: min(38vw, 420px); margin-inline-start: auto; padding-inline: 18px 6px; color: #64748b; }
    .dge-file span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dge-file.dge-dirty { color: #1f2937; font-weight: 500; }
    .dge-file.dge-dirty::after { content: ""; flex: none; width: 8px; height: 8px; border-radius: 50%; background: #dc2626; }
    .dge-bar-object { align-items: center; min-width: 0; animation: dge-arrive 180ms ease-out; }
    .dge-editor .dge-bar .dge-bar-object { gap: 4px; padding: 2px; border: 0; border-radius: 20px; background: rgb(219 225 232); }
    .dge-editor .dge-bar .dge-bar-object .dge-action { width: 36px; height: 36px; border-color: hsl(215 14% 60%); border-radius: 50%; background: hsl(215 17.5% 96%); box-shadow: 0 1px 2px rgb(15 23 42 / 0.06), 0 3px 7px rgb(15 23 42 / 0.08); }
    .dge-done { height: 36px; padding: 0 16px; border: 0; border-radius: 18px; background: #2563eb; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
    .dge-done:hover { background: #1d4ed8; }
    .dge-done:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
    .dge-bar-object .dge-action:hover:not(:disabled) { background: #2563eb; border-color: #2563eb; color: #fff; }
    .dge-editor .dge-bar .dge-bar-object .dge-action.dge-on { background: #dbeafe; border-color: #2563eb; color: #1d4ed8; }
    .dge-bar-name { display: flex; align-items: center; gap: 6px; min-width: 0; max-width: 120px; padding-inline: 4px 6px; font-weight: 600; color: #334155; }
    .dge-bar-name span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dge-swatch { flex-shrink: 0; width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 0 1px rgb(15 23 42 / 0.2); }
    .dge-action.dge-delete { color: #dc2626; }
    .dge-bar-object .dge-delete:hover:not(:disabled) { background: #dc2626; border-color: #dc2626; }
    @keyframes dge-arrive { from { opacity: 0; transform: translateY(-8px); } }
    @media (max-width: 680px) { .dge-editor .dge-bar .dge-bar-object { position: fixed; top: calc(var(--dge-bar-height) + 8px); inset-inline: 0; width: fit-content; margin-inline: auto; box-shadow: 0 4px 12px rgb(15 23 42 / 0.12); } }
    .dge-panel-header .dge-action { width: 32px; height: 32px; border-radius: 8px; }
    @media (max-width: 400px) { .dge-bar { gap: 6px; padding-inline: 8px; } .dge-bar-group { gap: 2px; } .dge-bar-group + .dge-bar-group { padding-inline-start: 6px; } .dge-bar .dge-action { width: 32px; } }
    .dge-hint { position: fixed; bottom: 16px; left: calc(50% + var(--dge-panel-width) / 2); transform: translateX(-50%); max-width: calc(100% - var(--dge-panel-width) - 32px); padding: 7px 14px; border-radius: 9px; background: rgb(17 24 39 / 0.86); color: #f9fafb; font-family: var(--dge-code); font-size: 13.5px; white-space: pre-wrap; unicode-bidi: plaintext; z-index: 11; pointer-events: none; transition: left var(--dge-slide), max-width var(--dge-slide); }
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
    .dge-guide { opacity: 0.65; }
    .dge-result { color: #d14343; }
    .dge-ring button:hover .dge-result { color: inherit; }
    .dge-complete, .dge-menu { position: fixed; min-width: 160px; max-height: 240px; overflow: auto; padding: 4px 0; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; box-shadow: 0 6px 20px rgb(0 0 0 / 0.14); z-index: 13; }
    .dge-complete div, .dge-menu div { padding: 3px 12px; font-family: var(--dge-code); font-size: 13px; cursor: pointer; }
    .dge-complete div.dge-selected, .dge-complete div:hover, .dge-menu div:hover { background: #2563eb; color: #fff; }
    .dge-complete:empty { display: none; }
    .dge-tools { position: fixed; max-height: calc(100vh - 16px); box-sizing: border-box; overflow: auto; padding: 4px; border: 1px solid #d1d5db; border-radius: 10px; background: #fff; box-shadow: 0 6px 20px rgb(0 0 0 / 0.14); z-index: 13; }
    .dge-tools button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 3px 10px 3px 3px; border: 0; border-radius: 8px; background: none; font: inherit; color: inherit; text-align: start; white-space: nowrap; cursor: pointer; }
    .dge-tools button:hover, .dge-tools button:focus-visible, .dge-tools button.dge-open { background: hsl(var(--dge-hue) calc(70% * var(--dge-tone)) 93%); outline: none; }
    .dge-tools .dge-family::after { content: "›"; margin-inline-start: auto; padding-inline-start: 16px; font-size: 18px; line-height: 1; color: #94a3b8; }
    .dge-tool-icon { display: grid; place-items: center; flex-shrink: 0; width: 34px; height: 34px; box-sizing: border-box; border: 1px solid hsl(var(--dge-hue) calc(55% * var(--dge-tone)) 60%); border-radius: 50%; background: hsl(var(--dge-hue) calc(70% * var(--dge-tone)) 96%); color: #536174; }
    .dge-tool-icon svg { display: block; width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.65; stroke-linecap: round; stroke-linejoin: round; }
    .dge-bar-object.dge-bar-tool .dge-bar-name { max-width: 240px; }
    .dge-tools button.dge-off { opacity: 0.4; cursor: default; }
    .dge-tools button.dge-off:not(.dge-family) { background: none; }
    svg .dge-picked { filter: drop-shadow(0 0 2px #2563eb) drop-shadow(0 0 3px #2563eb); }
    .dge-badges span { position: fixed; min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 9px; background: #2563eb; color: #fff; font: 600 11px/18px system-ui, -apple-system, "Segoe UI", sans-serif; text-align: center; transform: translate(7px, -25px); pointer-events: none; z-index: 11; }
    .dge-choice { position: fixed; display: flex; gap: 3px; transform: translateY(-50%); z-index: 13; }
    .dge-choice .dge-action, .dge-name .dge-action { width: 28px; height: 28px; border-color: #d1d5db; border-radius: 7px; background: #fff; }
    .dge-choice .dge-action svg, .dge-name .dge-action svg { width: 18px; height: 18px; }
    .dge-name { position: fixed; display: flex; align-items: center; gap: 6px; transform: translateY(-50%); z-index: 13; }
    .dge-name input { min-width: 2ch; margin: 0 0 0 -5px; padding: 1px 4px; border: 1px solid #2563eb; border-radius: 4px; outline: 3px solid rgb(37 99 235 / 0.2); background: #fff; font-family: Verdana, sans-serif; }
    svg.dge-grip { cursor: pointer; }
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
    /* Neither on the group, nor on the transparent hit areas, nor on a shape both filled and stroked whose fill is opaque or empty: each would be painted offscreen, frame after frame, too slow for thousands of ghosts. */
    svg .dge-ghost > :not([style*="transparent"]) { opacity: 0.3 !important; }
    svg .dge-ghost > :is([style*="fill-opacity: 0;"], [style*="fill-opacity: 1;"]) { opacity: 1 !important; stroke-opacity: 0.3 !important; }
    svg .dge-ghost > [style*="fill-opacity: 1;"] { fill-opacity: 0.3 !important; }
    .dge-spring { position: fixed; width: 0; height: 0; z-index: 12; }
    .dge-turtle { position: fixed; width: 0; height: 0; z-index: 9; pointer-events: none; }
    .dge-turtle svg { position: absolute; overflow: visible; }
    .dge-spring svg { position: absolute; overflow: visible; pointer-events: none; }
    .dge-coil { fill: none; stroke: #536174; stroke-width: 1.6; stroke-linejoin: round; stroke-linecap: round; }
    .dge-spring circle { pointer-events: all; cursor: grab; touch-action: none; }
    .dge-spring .dge-grip { fill: transparent; }
    .dge-spring .dge-ball { fill: #f8fafc; stroke: #2563eb; stroke-width: 2.5; transform-box: fill-box; transform-origin: center; }
    .dge-spring circle:hover ~ .dge-ball, .dge-spring .dge-ball:hover, .dge-pulling .dge-ball { fill: #2563eb; }
    .dge-pulling circle { cursor: grabbing; }
    svg .dge-spring-ghost { opacity: 0.4; pointer-events: none; }
    svg .dge-spring-ghost.dge-still { display: none; }
    .dge-spring text { font: 600 13px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #334155; stroke: #fff; stroke-width: 4px; paint-order: stroke; text-anchor: middle; }
</style>`);

// ************************** LAYOUT ******************************

const panel = $.create("aside")
    .cls("dge-panel")
    .att("id", "dge-history")
    .att("aria-label", message("history"));
const rowsBox = $.create("div").cls("dge-rows");
const count = $.create("span").cls("dge-count");
const valuesButton = button("show_values", () => {
    valuesShown = !valuesShown;
    valuesButton
        .toggleClass("dge-on", valuesShown)
        .att("aria-pressed", String(valuesShown));
    refreshRows();
}).att("aria-pressed", "false");
const stepsButton = button("steps", () => setSteps(!stepping)).att(
    "aria-pressed",
    "false",
);
const stepLabel = $.create("span").cls("dge-step").att("aria-live", "polite");
const firstButton = button("first_step", () => go(1)).addClass("dge-end-step");
const previousButton = button("previous_step", () => go(stepping!.at - 1));
const nextButton = button("next_step", () => go(stepping!.at + 1));
const lastButton = button("last_step", () => go(Infinity)).addClass(
    "dge-end-step",
);
const playButton = button("play_steps", play);
const stepsBar = $.create("div")
    .cls("dge-steps")
    .add(
        firstButton,
        previousButton,
        stepLabel,
        nextButton,
        lastButton,
        playButton,
    );
const input = $.create("input")
    .cls("dge-input")
    .att("placeholder", message("input"))
    .att("spellcheck", "false");
// The ring's tools, by family, each kept to build one object after another.
// Pressed during a tool, it drops it and opens the menu at once.
const toolsButton = button("tools", () => {
    if (armed) cancel();
    else if (!toolsMenu.isHidden()) return closeTools();
    openTools();
})
    .att("aria-haspopup", "menu")
    .att("aria-expanded", "false")
    .att("aria-pressed", "false");
const toolsMenu = $.create("div").cls("dge-tools").att("role", "menu").hide();
const toolsSub = $.create("div").cls("dge-tools").att("role", "menu").hide();
// The ranks of the objects selected.
const badges = $.create("div").cls("dge-badges");
const hint = $.create("div").cls("dge-hint");
const ring = $.create("div").cls("dge-ring").hide();
// Escape, for the fingers.
const cancelButton = $.create("button")
    .text("✕")
    .att("title", message("cancel"));
cancelButton.on("click", () => cancel());
const complete = $.create("div").cls("dge-complete");
// A formula whose value is a point, or a list of points, makes an
// expression or what its value draws: buttons at the end of its line
// choose, Enter the one lit.
const CHOICES = {
    point: button("formula_point", () => commitAs("point")),
    points: button("points_list", () => commitAs("points")),
    segments: button("segments_list", () => commitAs("segments")),
    expression: button("as_expression", () => commitAs("expression")),
};
type Choice = keyof typeof CHOICES;
const choice = $.create("div")
    .cls("dge-choice")
    .add(...Object.values(CHOICES))
    .hide();
// Keeps the focus in the line typed.
choice.on("mousedown", () => {});
// The objects under a click, for the user to choose one.
const menu = $.create("div").cls("dge-menu").att("role", "menu").hide();
// Keeps the focus in the line typed.
menu.on("mousedown", () => {});
// A point's name, retyped where it shows, or hidden.
const nameField = $.create("input")
    .att("type", "text")
    .att("spellcheck", "false")
    .att("aria-label", message("name"));
const hideNameButton = button("hide_name", hideName);
// Keeps the focus in the name typed.
hideNameButton.on("mousedown", () => {});
const nameBox = $.create("div")
    .cls("dge-name")
    .add(nameField, hideNameButton)
    .hide();
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
const axesButton = button("axes", () => {
    setAxes(scene().GRID.hidden !== 0);
    properties.refresh(true);
    void record();
});
const spaceButton = button("space", toggleSpace);
eraserButton.att("aria-pressed", "false");
axesButton.att("aria-pressed", "false");
const historyButton = button("history", () =>
    setPanel(
        shrinkBlocks() || historyButton.getAtt("aria-expanded") === "false",
    ),
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
const pinButton = button("pin", () => {
    togglePin(target() as point_object);
    showActions();
    changed();
}).att("aria-pressed", "false");
const magnetButton = button("magnet", () =>
    startMagnets(target() as point_object),
);
// Takes the spring out, or puts it away.
const springButton = button("spring", () => {
    springOut = !springOut;
    showActions();
}).att("aria-pressed", "false");
// An expression's points drawn, joined or not, as by DGPad's calculator.
const pointsButton = button("points_list", () => drawFrom("points"));
const segmentsButton = button("segments_list", () => drawFrom("segments"));
// The point an expression gives, as by DGPad's calculator.
const pointButton = button("formula_point", () => drawFrom("point"));
const turtleButton = button("turtle", openTurtle);
// In place of the actions while the magnets are chosen, or a tool of the
// menu is in use: the way out.
const doneButton = $.create("button")
    .cls("dge-done")
    .att("type", "button")
    .text(message("done"));
doneButton.on("click", () => (armed ? cancel() : stopMagnets()));
const toolIcon = $.create("span").cls("dge-tool-icon").hide();
const swatch = $.create("span").cls("dge-swatch");
const objectName = $.create("span");
// The actions on the selected object.
const actions = $.create("div")
    .cls("dge-bar-group dge-bar-object")
    .att("role", "group")
    .add(
        $.create("span").cls("dge-bar-name").add(toolIcon, swatch, objectName),
        deleteButton,
        settingsButton,
        springButton,
        pinButton,
        magnetButton,
        turtleButton,
        pointButton,
        pointsButton,
        segmentsButton,
        doneButton,
    )
    .hide();
// The spring of the object selected, tied to it, pulled by its ball.
const spring = $.create("div")
    .cls("dge-spring")
    .append(
        `<svg width="1" height="1"><path class="dge-coil"/><text/><circle class="dge-grip" r="13"/><circle class="dge-ball" r="8"/></svg>`,
    )
    .hide();
const coil = spring.find(".dge-coil")!;
const speedText = spring.find("text")!;
const grip = spring.find(".dge-grip")!;
const ball = spring.find(".dge-ball")!;
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
        () =>
            showHint(
                line(
                    selection.length
                        ? selectedNames()
                        : formatName(target()!.name),
                ),
            ),
        false,
    );
    // Keeping what the action refused.
    action.on(
        "pointerleave",
        () => {
            if (!hint.dom().classList.contains("dge-error"))
                showHint(restingHint());
        },
        false,
    );
}
explain(deleteButton, (name) => `${name} =\n${message("delete")}`);
explain(settingsButton, (name) => `${name}\n${message("settings")}`);
explain(
    pinButton,
    (name) =>
        `${name}\n${message((target() as point_object).pinned ? "unpin_hint" : "pin_hint", name)}`,
);
explain(magnetButton, (name) => `${name}\n${message("magnet")}`);
explain(turtleButton, (name) => {
    const turtle = turtleOf(target()!)!;
    const start = turtleStart(turtle);
    return `${name}\n${message("turtle_hint", start ? (start.point?.name ?? start.name) : turtle.name)}`;
});
explain(springButton, (name) => `${name}\n${message("spring_hint", name)}`);
[pointsButton, segmentsButton].forEach((action) =>
    explain(
        action,
        (name) =>
            `${nextName(scene(), false)} = ${commandName(findCommand("List")!)}(${name})\n${message("list_hint", name)}`,
    ),
);
explain(
    pointButton,
    (name) =>
        `${nextName(scene(), true)} = ${pointFormulaText(name)}\n${message("formula_point_hint", name)}`,
);
// The turtle whose program the panel shows.
const turtle = turtleLayer(scene, () =>
    propertiesOpen ? properties.program : null,
);
// The program's line resolved, the globals it adds taken out if refused.
function withGlobals(
    resolveLine: (added: construction_object[]) => Spec,
): Spec {
    const added: construction_object[] = [];
    try {
        return resolveLine(added);
    } catch (error) {
        added.forEach((global) => scene().removeObject(global));
        throw error;
    }
}

const properties = propertiesPanel({
    scene,
    changed: () => changed(),
    shown: () => turtle.watch(),
    mark: (object, on) => lit(object, on),
    rename,
    define: async (object, source) => {
        const spec = withGlobals((added) =>
            resolveWithGlobals(
                scene(),
                {
                    name: object.name,
                    definition:
                        object instanceof panel_object
                            ? {
                                  kind: "call",
                                  command: "Html",
                                  args: [{ kind: "string", value: source }],
                              }
                            : { kind: "formula", source },
                },
                object,
                added,
            ),
        );
        await redefine(studio, object, spec);
        properties.select(scene().getObj(spec.name)!);
        changed();
    },
    figure: (patch) => {
        recording = recording.then(() => reframe({}, undefined, patch));
    },
    start: (kind, object) =>
        kind === "turtle"
            ? editTurtle(object)
            : startEvent(
                  object as point_object | expression_object | button_object,
                  kind === "change" ? null : (kind as Trigger),
              ),
    remove: (program) => {
        scene().removeObject(program);
        done();
    },
    create: async (name, source) => {
        const c = scene();
        const object = add(
            c,
            withGlobals((added) =>
                resolveWithGlobals(
                    c,
                    {
                        name: name || null,
                        definition: { kind: "formula", source },
                    },
                    undefined,
                    added,
                ),
            ),
        );
        properties.select(object);
        done(object);
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
const chooseFigure = () =>
    chooseFile(
        fileInput.dom() as HTMLInputElement,
        (file, from) => void openFile(file, from),
    );
const helpLink = $.create("a")
    .cls("dge-action dge-help")
    .att("href", `tutorials/index.html?lang=${LANG}`)
    .att("target", "_blank")
    .att("rel", "noopener")
    .att("title", message("help"))
    .att("aria-label", message("help"))
    .append(
        `<svg viewBox="0 0 24 24" aria-hidden="true">${ACTION_ICONS.help}</svg>`,
    );
// The menus of the editor out of a frame, which press the bar's buttons.
const press = (element: DOMElement) => () =>
    (element.dom() as HTMLElement).click();
const toggle = (key: MessageKey, element: DOMElement) => ({
    label: message(key),
    run: press(element),
    checked: () =>
        element.getAtt("aria-pressed") === "true" ||
        element.getAtt("aria-expanded") === "true",
});
const menus: Menu[] = [
    {
        label: message("menu_file"),
        items: [
            { label: message("new_figure"), run: () => void newFigure() },
            {
                label: `${message("open")}…`,
                shortcut: shortcut("O"),
                run: chooseFigure,
            },
            null,
            {
                label: message("save"),
                shortcut: shortcut("S"),
                run: () => void save(),
            },
            {
                label: message("save_as"),
                shortcut: shortcut("S", true),
                run: () => void save(true),
            },
        ],
    },
    {
        label: message("menu_edit"),
        items: [
            {
                label: message("undo"),
                shortcut: shortcut("Z"),
                run: press(undoButton),
                enabled: () => !undoButton.dom().hasAttribute("disabled"),
            },
            {
                label: message("redo"),
                shortcut: shortcut("Z", true),
                run: press(redoButton),
                enabled: () => !redoButton.dom().hasAttribute("disabled"),
            },
            null,
            {
                label: message("delete"),
                shortcut: DELETE_KEY,
                run: remove,
                enabled: () => !!(target() || selection.length),
            },
            toggle("eraser", eraserButton),
        ],
    },
    {
        label: message("menu_view"),
        items: [
            toggle("axes", axesButton),
            toggle("space", spaceButton),
            null,
            toggle("history", historyButton),
            toggle("properties", propertiesButton),
            ...(document.fullscreenEnabled
                ? [
                      null,
                      {
                          label: message("fullscreen"),
                          run: () =>
                              void (document.fullscreenElement
                                  ? document.exitFullscreen()
                                  : document.documentElement.requestFullscreen()),
                          checked: () => !!document.fullscreenElement,
                      },
                  ]
                : []),
        ],
    },
    {
        label: message("menu_help"),
        items: [{ label: message("help"), run: press(helpLink) }],
    },
];
if (standalone) $("body").addClass("dge-menus");
$("body").add(
    panel.add(
        $.create("div")
            .cls("dge-panel-header")
            .add(
                $.create("h2").text(message("construction")).add(count),
                valuesButton,
                stepsButton,
                button("new_program", () => {
                    setProperties(true);
                    properties.create(nextName(scene(), false));
                }),
                button("close_history", () => {
                    setPanel(false);
                    (historyButton.dom() as HTMLButtonElement).focus();
                }),
            ),
        $.create("div")
            .cls("dge-entry")
            .add(
                $.create("div").cls("dge-line").add(input, toolsButton),
                stepsBar,
            ),
        rowsBox,
    ),
    resizeHandle(panel, "left", () => "--dge-panel-user"),
    $.create("nav")
        .cls("dge-bar")
        .att("aria-label", message("actions"))
        .add(
            $.create("div")
                .cls("dge-bar-group")
                .add(
                    button("open", chooseFigure),
                    button("save", () => void save()),
                ),
            $.create("div")
                .cls("dge-bar-group")
                .add(
                    eraserButton,
                    axesButton,
                    spaceButton,
                    propertiesButton,
                    historyButton,
                ),
            $.create("div").cls("dge-bar-middle").add(actions),
            $.create("div")
                .cls("dge-bar-group dge-bar-end")
                .add(undoButton, redoButton, helpLink),
        ),
    ...(standalone ? menuBar(menus, ...(native ? [fileLabel] : [])) : []),
    properties.panel,
    resizeHandle(properties.panel, "right", () =>
        document.body.classList.contains("dge-properties-wide")
            ? "--dge-properties-wide-user"
            : "--dge-properties-user",
    ),
    hint,
    ring,
    complete,
    choice,
    menu,
    toolsMenu,
    toolsSub,
    badges,
    magnetCard,
    turtle.element,
    spring,
    nameBox,
);
function setPanel(on: boolean, animate = true): void {
    if (on && propertiesOpen && window.innerWidth <= 900) setProperties(false);
    if (!on) {
        setSteps(false);
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
        const objects = selection.length
            ? selection.map(({ object }) => object)
            : target();
        setEraser(false);
        cancel(true);
        editing()?.blur();
        closeCompletion();
        showAccepted([]);
        highlight();
        if (window.innerWidth <= 900) setPanel(false);
        properties.refresh();
        properties.select(objects ?? properties.selection);
    }
    if (!on) shrinkBlocks();
    propertiesOpen = on;
    properties.panel.dom().toggleAttribute("inert", !on);
    $("body")
        .addClass("dge-panel-animated")
        .toggleClass("dge-properties-open", on)
        .toggleClass(AWAKE, on);
    propertiesButton.toggleClass("dge-on", on).att("aria-expanded", String(on));
    shine(on);
    if (!pending) showHint("");
}
// Preserve the figure's screen coordinates while the panels fade over it.
let narrowing = 0;
onEnlarge((out, duration) => {
    clearTimeout(narrowing);
    if (out) widen(true);
    $("body")
        .stl("--dge-blocks-duration", `${duration}ms`)
        .addClass("dge-blocks-transition")
        .toggleClass("dge-blocks-out", out);
    narrowing = window.setTimeout(() => {
        if (!out) widen(false);
        $("body").removeClass("dge-blocks-transition");
    }, duration);
});
function widen(on: boolean): void {
    const c = scene();
    const [x, y] = c.GRID.ORG;
    const before = c.svg.dom().getBoundingClientRect().left;
    const body = $("body").stl("transition", "none");
    body.toggleClass("dge-blocks-wide", on);
    const { left, width, height } = c.svg.dom().getBoundingClientRect();
    body.stl("transition", "");
    c.resize(width, height);
    c.GRID.ORG = [x + before - left, y];
    c.traceEpoch++;
    c.invalidateProjection();
}
// Typing doesn't reach the figure's own keys (3D view, floor), shortcuts
// do.
panel.on(
    "keydown",
    (event) => {
        if (!editing() && !stepKey(event) && event.key === "Escape") escape();
        if (!event.metaKey && !event.ctrlKey) event.stopPropagation();
    },
    false,
);

// ************************** STATE *******************************

// The object of each row of the text, its row and the value shown below.
const rows = new Map<construction_object, DOMElement>();
const items = new Map<construction_object, DOMElement>();
const values = new Map<construction_object, DOMElement>();
let valuesShown = false;
// Step by step, the step shown and the objects of the steps after it,
// hidden meanwhile.
let stepping: Stepping | null = null;
let playing: number | null = null;
// The tool chosen in the menu, kept to build one object after another.
let armed: Item | null = null;
// The objects selected one after the other, the tools' arguments in this
// order.
let selection: Hit[] = [];
// A tool waiting for its arguments.
let pending: {
    tool: Tool;
    args: (Arg | undefined)[];
} | null = null;
// What the next argument would build, followed by the pointer.
let preview: {
    candidate: construction_object | "pointer" | "floor";
    objects: construction_object[];
    pointer?: point_object;
    standIns: point_object[];
} | null = null;
let hovered: construction_object[] = [];
let accepted: construction_object[] = [];
let completions: {
    label: string;
    insert: string;
    object?: construction_object;
}[] = [];
let selected = -1;
// The line offered the choice, and what Enter makes.
let choosing: {
    field: HTMLInputElement;
    object: construction_object | null;
    lit: Choice;
} | null = null;
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
// The object whose spring is shown, and while it's pulled, where from on the
// screen.
let sprung: {
    object: springy_object;
    pulled: {
        anchor: Vec2;
        spring: Spring;
        vector: Vec2;
        // The animation the pull gives, none before the ball moves, and the
        // one the object had, held still meanwhile.
        animation: Animation | null;
        before: Animation | null;
        ghost: Ghost & { node: DOMElement };
        // The last frame, and when the ball was let go.
        time: number | null;
        released: number | null;
        launched: boolean;
    } | null;
} | null = null;
let springFrame: number | null = null;
// The spring button pressed for the object selected.
let springOut = false;

const element = (node: EventTarget | null) =>
    node instanceof Element ? node : null;
// Keys typed in a text field, even one outside the panels (Blockly's
// dialogs and field editors live in the body), never act on the figure.
const typed = (node: EventTarget | null) =>
    node instanceof HTMLInputElement ||
    node instanceof HTMLTextAreaElement ||
    (node instanceof HTMLElement && node.isContentEditable);
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
    (object.isHidden && !stepping?.later.has(object)) || !!ghosts?.has(object);
// What `write` makes of the figure as saved: ghosts hidden, steps after the
// one shown not.
const asSaved = <T>(write: () => Promise<T>): Promise<T> =>
    withHidden(ghosts ?? [], 1, () =>
        withHidden(stepping?.later ?? [], 0, write),
    );

// The objects of the properties lit, in the figure and in the text, while
// they are shown.
const lit = (object: construction_object, on: boolean) => {
    object.dom?.toggleClass("dge-property-selected", on);
    items.get(object)?.toggleClass("dge-shown", on);
};
const shine = (on: boolean) =>
    properties.selection.forEach((object) => lit(object, on));

// With ⌘, Ctrl or Shift, the object is added to those of the properties.
const showProperties = (
    event: PointerEvent,
    object: construction_object,
): void =>
    event.metaKey || event.ctrlKey || event.shiftKey
        ? properties.toggle(object)
        : properties.select(object);

function propertyObject(event: PointerEvent): construction_object | null {
    const target = element(event.target);
    const ignored = previewed();
    const objects = figureObjects(scene()).filter(
        (object) =>
            object.isVisible &&
            object.hasView &&
            !ignored.has(object) &&
            !asleep(object),
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

// An event's line: when its program runs.
const EVENT_TEXTS: Record<string, MessageKey> = {
    drag: "event_drag",
    down: "event_down",
    up: "event_up",
    change: "event_change",
    init: "event_init",
};

function refreshRows(): void {
    properties.refresh();
    rows.clear();
    items.clear();
    values.clear();
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
            line ??
            (object instanceof event_object
                ? message(
                      EVENT_TEXTS[object.gesture ?? "change"],
                      formatName(object.owner.name),
                  )
                : `${formatName(object.name)} = …`);
        if (line === null)
            row.att("readonly", "").att("title", message("read_only"));
        else bindRow(row, object);
        const text = $.create("div").cls("dge-text").add(row);
        // With a tool, the row designates its object instead of being
        // edited.
        text.on(
            "pointerdown",
            (event) => {
                const program = object instanceof event_object;
                if (!pending && !propertiesOpen && !program) return;
                event.preventDefault();
                if (pending) {
                    if (rowTakes(object)) designateRow(object);
                } else if (program) showProgram(object);
                else showProperties(event, object);
            },
            false,
        );
        if (valuesShown) {
            const value = $.create("div")
                .cls("dge-value")
                .text(valueText(object, line, vec3()));
            values.set(object, value);
            text.add(value);
        }
        const item = $.create("div")
            .cls("dge-item")
            .add(visibilityToggle(object), text);
        if (hasName(object)) item.add(nameToggle(object));
        item.on("mouseenter", () => highlight(object), false);
        item.on("mouseleave", () => highlight(), false);
        item.on(
            "pointerdown",
            (event) => {
                if (!stepping) return;
                event.preventDefault();
                go(stepOf(scene(), stepping, object));
            },
            false,
        );
        rows.set(object, row);
        items.set(object, item);
        rowsBox.add(item);
    });
    count.text(rows.size ? String(rows.size) : "");
    shine(propertiesOpen);
    markTaken();
    if (stepping) markSteps();
    undoButton.dom().toggleAttribute("disabled", position <= 0);
    redoButton
        .dom()
        .toggleAttribute("disabled", position >= history.length - 1);
}

// As in GeoGebra's algebra view, a dot of the object's colour, full when it
// shows. Super-hidden objects, which nobody ever saw, stay so.
function visibilityToggle(object: construction_object): DOMElement {
    const dot = $.create("button")
        .cls("dge-dot")
        .att("type", "button")
        .stl("--dge-color", object.stroke_color);
    if (object.hidden === 2) return dot.att("disabled", "");
    const shown = !looksHidden(object);
    dot.att("aria-pressed", String(shown))
        .att("aria-label", message("visible"))
        .att("title", message(shown ? "hide_object" : "show_object"))
        .on("click", () => {
            if (ghosts) toggleGhost(ghosts, object);
            else {
                object.hidden = shown ? 1 : 0;
                if (shown) object.updateView();
                else object.createSVG();
            }
            changed();
        });
    return dot;
}

function nameToggle(object: construction_object): DOMElement {
    const on = object.showName;
    return button("show_name", () => {
        object.showName = !on;
        if (object.isHidden) object.updateView();
        else object.createSVG();
        changed();
    })
        .addClass("dge-label")
        .toggleClass("dge-on", on)
        .att("aria-pressed", String(on))
        .att("title", message(on ? "hide_name" : "show_name"));
}

// ************************** STEPS *******************************

const allSteps = () => steps(scene(), stepping!.later);

function setSteps(on: boolean): void {
    if (on === !!stepping) return;
    if (on) {
        if (propertiesOpen) setProperties(false);
        setEraser(false);
        cancel();
        editing()?.blur();
        closeCompletion();
        stepping = { at: 0, later: new Set() };
        showStep(1);
    } else {
        pause();
        showStep(Infinity);
        stepping = null;
        items.forEach((item) =>
            item.removeClass("dge-later").removeClass("dge-current"),
        );
        showHint("");
    }
    panel.toggleClass("dge-stepping", on);
    stepsButton.toggleClass("dge-on", on).att("aria-pressed", String(on));
}

function showStep(at: number): void {
    stepping = showStepOf(scene(), stepping!.later, at);
    markSteps();
}

function markSteps(): void {
    const { at } = stepping!;
    const all = allSteps();
    const index = figureIndex(scene());
    const current = all[at - 1];
    const last = current ? index.get(current)! : -1;
    items.forEach((item, object) =>
        item
            .toggleClass("dge-later", index.get(object)! > last)
            .toggleClass("dge-current", object === current),
    );
    stepLabel.text(message("step", `${at} / ${all.length}`));
    [firstButton, previousButton].forEach((action) =>
        action.dom().toggleAttribute("disabled", at <= 1),
    );
    [nextButton, lastButton].forEach((action) =>
        action.dom().toggleAttribute("disabled", at >= all.length),
    );
    const item = current && items.get(current);
    item?.dom().scrollIntoView({ block: "nearest" });
    showHint(
        current ? (rows.get(current)!.dom() as HTMLInputElement).value : "",
    );
}

function go(at: number): void {
    pause();
    showStep(at);
}

function play(): void {
    if (playing !== null) return pause();
    if (stepping!.at >= allSteps().length) showStep(1);
    playing = window.setInterval(() => {
        if (stepping!.at >= allSteps().length) pause();
        else showStep(stepping!.at + 1);
    }, 1000);
    showPlaying();
}

function pause(): void {
    if (playing === null) return;
    clearInterval(playing);
    playing = null;
    showPlaying();
}

function showPlaying(): void {
    const key = playing === null ? "play_steps" : "pause_steps";
    playButton
        .inner(
            `<svg viewBox="0 0 24 24" aria-hidden="true">${ACTION_ICONS[key]}</svg>`,
        )
        .att("title", message(key))
        .att("aria-label", message(key));
}

// The keys of the steps: arrows, Home and End, and Escape out.
function stepKey(event: KeyboardEvent): boolean {
    if (!stepping) return false;
    const at: Record<string, number> = {
        ArrowLeft: stepping.at - 1,
        ArrowRight: stepping.at + 1,
        Home: 1,
        End: Infinity,
    };
    if (event.key === "Escape") setSteps(false);
    else if (event.key in at) go(at[event.key]);
    else return false;
    event.preventDefault();
    return true;
}

// The rows in sight, which alone follow a drag: rewriting thousands of
// them each frame would slow it down.
function rowsInSight(): construction_object[] {
    const objects = [...items.keys()];
    const { top, bottom } = rowsBox.dom().getBoundingClientRect();
    const box = (index: number) =>
        items.get(objects[index])!.dom().getBoundingClientRect();
    let first = 0;
    let after = objects.length;
    while (first < after) {
        const middle = (first + after) >> 1;
        if (box(middle).bottom <= top) first = middle + 1;
        else after = middle;
    }
    let last = first;
    while (last < objects.length && box(last).top < bottom) last++;
    return objects.slice(first, last);
}

// The values a drag changes.
function updateRows(shown = [...rows.keys()]): void {
    const c = scene();
    const index = figureIndex(c);
    const objects = figureObjects(c);
    const active = editing();
    shown.forEach((object) => {
        const row = rows.get(object)!;
        const field = row.dom() as HTMLInputElement;
        const line =
            field === active || row.getAtt("readonly") !== null
                ? null
                : lineOf(object, index, objects)!;
        if (line !== null) field.value = line;
        values.get(object)?.text(valueText(object, line, vec3()));
    });
}

function bindRow(row: DOMElement, object: construction_object | null): void {
    const field = row.dom() as HTMLInputElement;
    let original = field.value;
    row.on(
        "focus",
        () => {
            if (propertiesOpen && object) {
                properties.select(object);
                field.blur();
                return;
            }
            setEraser(false);
            setSteps(false);
            stopMagnets();
            if (armed) cancel();
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
    row.on(
        "click",
        () => {
            if (editing() === field) updateCompletion(field);
        },
        false,
    );
    row.on(
        "blur",
        () => {
            closeCompletion();
            hideChoice();
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
    as: Choice = choosing?.field === field ? choosing.lit : "expression",
): Promise<void> {
    const c = scene();
    closeCompletion();
    hideChoice();
    // The sliders of the names the line reads that no object has.
    const sliders: construction_object[] = [];
    try {
        const line = parseLine(field.value, isCommand);
        const target =
            object ?? (line.name ? (c.getObj(line.name) ?? null) : null);
        // What the expression draws, the expression kept, hidden.
        const drawn = drawnFrom(line, target, as);
        if (as === "point" && !drawn && line.definition?.kind === "formula")
            line.definition = {
                kind: "pointFormula",
                source: line.definition.source,
            };
        const made = (object: construction_object | undefined) =>
            drawn
                ? derive(
                      object as expression_object,
                      as as Exclude<Choice, "expression">,
                  )
                : object;
        if (!line.definition) {
            if (!target) throw new TextError("unknown_object", line.name!);
            c.removeObject(target);
            return done();
        }
        if (target) {
            const spec = resolveWithSliders(c, line, target, sliders);
            if (
                spec.overload === FREE_POINT &&
                entryOf(target, figureIndex(c))[0] === "Pt" &&
                spec.name === target.name
            ) {
                const [x, y, z = 0] = spec.args as number[];
                const point = target as point_object;
                point.coords = [x, y, z];
                if (point.pinned) point.pin();
                c.invalidateGeometry(target);
                if (await refusedOffPlane()) throw new TextError("off_plane");
                return done(target);
            }
            await redefine(studio, target, spec);
            const result = made(scene().getObj(spec.name));
            if (await refusedOffPlane()) throw new TextError("off_plane");
            return done(result);
        }
        const result = made(
            add(c, resolveWithSliders(c, line, undefined, sliders)),
        );
        if (await refusedOffPlane()) throw new TextError("off_plane");
        if (field === input.dom()) field.value = "";
        if (result instanceof button_object) showProgram(result);
        return done(result);
    } catch (error) {
        if (!(error instanceof TextError)) throw error;
        if (sliders.length && error.key !== "off_plane")
            await reframe({}, history[position]);
        $(field).addClass("dge-error");
        showHint(message(error.key as MessageKey, error.detail), true);
    }
}

const calls = (commands: Command[]) =>
    commands.map((command) => ({
        label: `${commandName(command)}( )`,
        insert: `${commandName(command)}(`,
    }));

// What the caret is in: the commands, the objects an argument accepts, or
// in a formula, its functions and the objects it reads.
function updateCompletion(field: HTMLInputElement): void {
    clearPreview();
    const context = completionAt(field.value.slice(0, field.selectionStart!));
    const call =
        context?.kind === "argument" ? findCommand(context.command) : undefined;
    const prefix = context?.prefix ?? "";
    let candidates: construction_object[] = [];
    // A formula's functions, where it can be written.
    let functions = !call || !!call.formula;
    if (call) {
        const { position } = context as ArgumentCompletion;
        const params = overloadsAt(context as ArgumentCompletion).map(
            (overload) => paramAt(overload, position)!,
        );
        functions ||= params.includes("real");
        candidates = figureObjects(scene()).filter((object) =>
            params.some((param) => accepts(object, param)),
        );
    } else if (context && (context.kind !== "command" || context.formula))
        candidates = figureObjects(scene()).filter(readable);
    completions =
        call || prefix
            ? candidates
                  .filter(({ name }) =>
                      name.toLowerCase().startsWith(prefix.toLowerCase()),
                  )
                  .slice(0, 60)
                  .map((object) => ({
                      label: formatName(object.name),
                      insert: formatName(object.name),
                      object,
                  }))
            : [];
    if (prefix) {
        if (context!.kind === "command")
            completions.push(...calls(commandsStarting(prefix)));
        if (functions)
            completions.push(...calls(commandsStarting(prefix, FUNCTIONS)));
    }
    showAccepted(candidates);
    selected = -1;
    showCompletion(field);
    offerChoice(field);
}

// A list drawn from the expression the line makes, or a point from an
// expression redefined; a new point holds the formula itself.
const drawnFrom = (
    line: Line,
    target: construction_object | null,
    as: Choice,
): boolean =>
    line.definition?.kind === "formula" &&
    as !== "expression" &&
    (as !== "point" || target instanceof expression_object);

// When the formula typed gives a point or a list of points, the choice of
// what it makes, tried on an expression added and removed at once; a point
// by default for a capitalized name, as the editor names points, or a point
// redefined, else an expression.
function offerChoice(field: HTMLInputElement): void {
    hideChoice();
    let line: Line;
    try {
        line = parseLine(field.value, isCommand);
    } catch (error) {
        if (error instanceof TextError) return;
        throw error;
    }
    if (
        line.definition?.kind !== "formula" ||
        setsValues(line.definition.source)
    )
        return;
    const c = scene();
    const object =
        [...rows].find(([, row]) => row.dom() === field)?.[0] ?? null;
    const target = object ?? (line.name ? (c.getObj(line.name) ?? null) : null);
    let spec: Spec;
    try {
        spec = resolve(c, line, target ?? undefined);
    } catch (error) {
        if (error instanceof TextError) return;
        throw error;
    }
    const probe = add(c, { ...spec, name: "‧v" }, false);
    c.flush();
    const point = pointValue(probe);
    const list = pointList(probe);
    c.removeObject(probe);
    if (!point && !list) return;
    choosing = {
        field,
        object,
        lit:
            point &&
            (target
                ? entryOf(target, figureIndex(c))[0] === "Fp"
                : /^\p{Lu}/u.test(line.name ?? ""))
                ? "point"
                : "expression",
    };
    for (const [key, action] of Object.entries(CHOICES)) {
        const shown = key === "expression" || (key === "point" ? point : list);
        if (shown) action.show("grid");
        else action.hide();
        action.toggleClass("dge-on", key === choosing.lit);
    }
    const box = field.getBoundingClientRect();
    choice
        .stl("right", `${window.innerWidth - box.right + 8}px`)
        .stl("top", `${box.top + box.height / 2}px`)
        .show("flex");
    $(field).stl(
        "padding-inline-end",
        `${choice.dom().getBoundingClientRect().width + 14}px`,
    );
}

function hideChoice(): void {
    if (choosing) $(choosing.field).stl("padding-inline-end", "");
    choosing = null;
    choice.hide();
}

function commitAs(as: Choice): void {
    const { field, object } = choosing!;
    void commitText(field, object, as);
}

// Hovered, a choice shows the lines it writes.
for (const [key, action] of Object.entries(CHOICES) as [Choice, DOMElement][])
    action.on(
        "pointerenter",
        () => {
            const { field, object } = choosing!;
            const line = parseLine(field.value, isCommand);
            const { source } = line.definition as { source: string };
            const c = scene();
            const target =
                object ?? (line.name ? (c.getObj(line.name) ?? null) : null);
            // The expression's name, which the line gives or the editor.
            const name =
                line.name ?? target?.name ?? nextName(c, key === "point");
            const shown = formatName(name);
            if (!drawnFrom(line, target, key))
                return showHint(
                    `${shown} = ${key === "point" ? pointFormulaText(source) : source}\n${message(key === "point" ? "point_choice" : "expression_choice")}`,
                );
            const drawn =
                key === "point"
                    ? pointFormulaText(shown)
                    : `${commandName(findCommand("List")!)}(${shown})`;
            showHint(
                `${shown} = ${source}\n${nextName(c, key === "point", name)} = ${drawn}\n${message(key === "point" ? "formula_point_hint" : "list_hint", shown)}`,
            );
        },
        false,
    );

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
    if (object) return designateTyped(field, object, true);
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
// the line is entered, unless the call is a formula's. Designating the
// first vertex of a polygon again closes it. Chosen in the completions, it
// replaces the word typed.
function designateTyped(
    field: HTMLInputElement,
    object: construction_object,
    replace = false,
): void {
    if (insertArgument(field, object, replace))
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
    replace: boolean,
): boolean {
    const caret = field.selectionStart!;
    const before = field.value.slice(0, caret);
    const context = completionAt(before);
    if (context?.kind !== "argument" || field.value.slice(caret).trim()) {
        insertWord(field, formatName(object.name), replace);
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
        replace,
    );
    return closes && !findCommand(context.command)!.formula;
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

// In place of the word typed at the caret, unless, not to `replace` it, it
// already names an object: the word only completes a name being typed.
function insertWord(
    field: HTMLInputElement,
    word: string,
    replace = true,
): void {
    const caret = field.selectionStart!;
    const before = field.value.slice(0, caret);
    const typed = /[\p{L}_$][\p{L}\p{M}\p{N}_$']*$/u.exec(before)?.[0] ?? "";
    const start =
        before.length - (replace || !scene().getObj(typed) ? typed.length : 0);
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
    if (pending) {
        const { mode, overload } = pending.tool;
        if (fresh())
            return mode === "command" ? makesPoint(hits) : mode !== "button";
        return (
            mode === "command" &&
            makesPoints(overload) &&
            paramAt(overload, nextSlot()) === "point"
        );
    }
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

// About 150 pixels, rounded to two significant digits.
// The number a tool gives: a circle's radius of about 150 px, a quarter
// turn, a ratio of 2, the first tangent, a square, a flat net.
const defaultReal = (tag: string): number | undefined =>
    ["C1", "Sph1", "Cyl", "Cone"].includes(tag)
        ? Number((150 / scene().GRID.UNIT[0]).toPrecision(2))
        : tag === "Rot"
          ? scene().degrees
              ? 90
              : Math.PI / 2
          : tag === "Dil"
            ? 2
            : tag === "Tan"
              ? 1
              : tag === "RegP"
                ? 4
                : tag === "Net"
                  ? 1
                  : undefined;

// The tool's arguments, the object designated first.
function firstArgs(
    tool: Tool,
    object: construction_object,
): (Arg | undefined)[] {
    if (tool.mode !== "command") return [object];
    if (tool.overload.tag === "Loc") return [object, driverOf(object)!];
    const { params, variadic, tag } = tool.overload;
    const args: (Arg | undefined)[] = variadic
        ? []
        : Array(params.length).fill(undefined);
    args[params.findIndex((param) => accepts(object, param))] = object;
    const given = params.findIndex(
        (param) => param === "real" || param === "number",
    );
    if (given >= 0) args[given] = defaultReal(tag);
    return args;
}

// The line the tool writes, its missing arguments elided, and what remains
// to designate.
function describe(tool: Tool, args: (Arg | undefined)[]): string {
    if (tool.mode === "turtle")
        return `${message("turtle")}\n${message("designate_point")}`;
    if (tool.mode === "event")
        return `${message(tool.label!)}\n${message(tool.gesture ? "designate_moveable" : "designate_expression")}`;
    if (tool.mode === "button")
        return `${formatName(nextName(scene(), "Btn"))} = ${commandName(tool.command)}(${quoteText(message("button_caption"))})\n${message("designate_button")}`;
    const kind = tool.mode !== "command" || tool.overload.tag;
    const shown = args.map((arg) => (arg === undefined ? "…" : formatArg(arg)));
    if (tool.mode !== "command" || tool.overload.variadic) shown.push("…");
    const line = `${formatName(nextName(scene(), kind))} = ${commandName(tool.command)}(${shown.join(", ")})`;
    if (tool.mode === "point")
        return args.length ? line : `${line}\n${message("designate_place")}`;
    if (tool.mode === "intersection")
        return `${line}\n${message("designate_intersectable")}`;
    if (tool.overload.variadic && args.length >= 3)
        return `${line}\n${message("polygon_end")}`;
    if (!tool.overload.variadic && !args.includes(undefined)) return line;
    // No tool takes a text.
    const param = paramAt(tool.overload, nextSlot({ tool, args })) as Exclude<
        Param,
        "text"
    >;
    return `${line}\n${message(`designate_${param}`)}`;
}

function prompt(): void {
    showHint(pending ? describe(pending.tool, pending.args) : "");
    markTaken();
}

// Whether the tool takes the object of a row, hidden or not, as its next
// argument: only the figure gives a place, where a point would be made.
function rowTakes(object: construction_object): boolean {
    if (fresh()) {
        const tool = fitting(object);
        return !!tool && tool.mode !== "point";
    }
    const { tool, args } = pending!;
    if (tool.mode === "intersection")
        return object !== args[0] && accepts(object, "intersectable");
    return accepts(object, paramAt(tool.overload, nextSlot())!);
}

// With a tool, the rows it takes are marked, the others faded, and those
// already designated show their places in the line.
function markTaken(): void {
    rowsBox.toggleClass("dge-taking", !!pending);
    items.forEach((item, object) => {
        const places = pending
            ? pending.args.flatMap((arg, index) =>
                  arg === object ? [index + 1] : [],
              )
            : [];
        item.toggleClass("dge-takes", !!pending && rowTakes(object))
            .toggleClass("dge-chosen", !!places[0])
            .att("data-places", places.join(" "));
    });
}

// ************************** TOOLS MENU **************************

const toolSvg = (icon: string) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`;

function toolEntry(icon: string, label: string, family: Family): DOMElement {
    return $.create("button")
        .att("type", "button")
        .att("role", "menuitem")
        .stl("--dge-hue", `${family.hue}`)
        .stl("--dge-tone", `${family.tone}`)
        .add(
            $.create("span").cls("dge-tool-icon").append(toolSvg(icon)),
            $.create("span").text(label),
        );
}

// The families of the ring, each opening its tools; those that don't take
// the objects selected are greyed.
function openTools(): void {
    toolsMenu.inner("");
    TOOL_FAMILIES.forEach((family) => {
        const items = family.items.filter(({ tools }) =>
            tools.some((tool) => usable(tool, vec3())),
        );
        if (!items[0]) return;
        const row = toolEntry(
            items[0].tools[0].icon,
            message(family.name),
            family,
        )
            .addClass("dge-family")
            .toggleClass("dge-off", !items.some((item) => takes(item)))
            .att("aria-haspopup", "menu");
        row.on(
            "pointerenter",
            (event) => {
                if (event.pointerType === "mouse")
                    openFamily(row, family, items);
            },
            false,
        );
        row.on("click", () => openFamily(row, family, items));
        toolsMenu.add(row);
    });
    const box = toolsButton.dom().getBoundingClientRect();
    toolsMenu.show();
    const { width } = toolsMenu.dom().getBoundingClientRect();
    toolsMenu
        .stl(
            "left",
            `${Math.max(8, Math.min(box.right - width, window.innerWidth - width - 8))}px`,
        )
        .stl("top", `${box.bottom + 6}px`);
    toolsButton.att("aria-expanded", "true");
}

// Beside the menu, or over it when the window is too narrow.
function openFamily(row: DOMElement, family: Family, items: Item[]): void {
    toolsMenu
        .findAll(".dge-open")
        .forEach((open) => open.removeClass("dge-open"));
    row.addClass("dge-open");
    toolsSub.inner("");
    const objects = chosen().map(({ object }) => object);
    items.forEach((item) => {
        const tool = takes(item);
        const shown = tool || item.tools.find((tool) => usable(tool, vec3()))!;
        const entry = toolEntry(shown.icon, itemLabel(item), family)
            .toggleClass("dge-off", !tool)
            .att("aria-disabled", String(!tool));
        entry.on(
            "pointerenter",
            () =>
                showHint(
                    describe(
                        shown,
                        tool && objects[0]
                            ? assign(
                                  tool,
                                  objects,
                                  defaultReal(tool.overload.tag),
                              )!
                            : emptyArgs(shown),
                    ),
                ),
            false,
        );
        entry.on(
            "pointerleave",
            () => (pending ? prompt() : showHint(restingHint())),
            false,
        );
        entry.on("click", () => {
            if (tool) arm(item);
        });
        toolsSub.add(entry);
    });
    toolsSub.show();
    const menuBox = toolsMenu.dom().getBoundingClientRect();
    const rowBox = row.dom().getBoundingClientRect();
    const { width, height } = toolsSub.dom().getBoundingClientRect();
    const beside = [menuBox.right + 4, menuBox.left - width - 4].find(
        (left) => left >= 8 && left + width <= window.innerWidth - 8,
    );
    const top = beside === undefined ? rowBox.bottom : rowBox.top - 5;
    toolsSub
        .stl(
            "left",
            `${beside ?? Math.max(8, Math.min(rowBox.left + 24, window.innerWidth - width - 8))}px`,
        )
        .stl(
            "top",
            `${Math.max(8, Math.min(top, window.innerHeight - height - 8))}px`,
        );
}

function closeTools(): void {
    toolsMenu.hide().inner("");
    toolsSub.hide().inner("");
    toolsButton.att("aria-expanded", "false");
}

// No keyboard comes up: the arguments are designated in the figure, which
// a narrow window shows whole.
function arm(item: Item): void {
    const picked = chosen();
    closeTools();
    cancel();
    armed = item;
    if (window.matchMedia("(max-width: 600px)").matches) {
        setPanel(false);
        if (propertiesOpen) setProperties(false);
    }
    rearm();
    if (picked[0]) take(picked);
    else prompt();
}

// The tool of the menu waits for its first argument.
function rearm(): void {
    const tool = armed?.tools.find((tool) => usable(tool, vec3()));
    if (!tool) armed = null;
    pending = tool ? { tool, args: emptyArgs(tool) } : null;
    const shown = armed?.tools[0];
    toolsButton
        .inner(toolSvg(shown?.icon ?? ACTION_ICONS.tools))
        .toggleClass("dge-armed", !!shown)
        .att("aria-pressed", String(!!shown));
    if (shown)
        toolsButton
            .stl("--dge-hue", `${shown.family.hue}`)
            .stl("--dge-tone", `${shown.family.tone}`);
    showActions();
}

// ************************** SELECTION ***************************

// The objects selected, or the one whose ring is open.
const chosen = (): Hit[] =>
    selection.length ? [...selection] : held ? [held.hit] : [];

const selectedNames = (): string =>
    selection.map(({ object }) => formatName(object.name)).join(", ");

// The form of the item that takes the objects chosen, any without them.
function takes(item: Item): Tool | undefined {
    const objects = chosen().map(({ object }) => object);
    return item.tools.find(
        (tool) =>
            usable(tool, vec3()) &&
            (!objects[0] ||
                assign(tool, objects, defaultReal(tool.overload.tag))),
    );
}

// The objects chosen are the first arguments of the tool of the menu, a
// polygon of three vertices or more closed at once.
function take(picked: Hit[]): void {
    const c = scene();
    const objects = picked.map(({ object }) => object);
    const tool = takes(armed!)!;
    const args = assign(tool, objects, defaultReal(tool.overload.tag))!;
    if (tool.mode === "point")
        return done(addPointOn(c, nextName(c, true), objects[0], picked[0].at));
    if (tool.mode === "turtle") return startTurtle(objects[0]);
    if (tool.mode === "event") return answer(tool, objects[0]);
    if (tool.mode === "button") return prompt();
    pending = { tool, args };
    if (tool.mode === "intersection") {
        if (!args[1]) return prompt();
        const [a, b] = objects;
        const found = intersection(
            a,
            b,
            nearestBranch(c, a, b, c.pt3D(picked[1].at))?.order ?? 0,
        );
        return build(found.overload, found.args);
    }
    if (tool.overload.variadic && args.length >= 3)
        return build(tool.overload, args as Arg[]);
    proceed();
}

// Added, or removed if it was, after the object whose ring is open.
function select(hit: Hit): void {
    const first = held?.hit;
    closeRing();
    if (first && !selection[0] && first.object !== hit.object)
        selection.push(first);
    const at = selection.findIndex(({ object }) => object === hit.object);
    if (at < 0) selection.push(hit);
    else selection.splice(at, 1);
    showSelection();
}

function clearSelection(): void {
    if (!selection[0]) return;
    selection = [];
    showSelection();
}

// Each object selected lit, its rank beside it.
function showSelection(): void {
    const c = scene();
    c.svg
        .findAll(".dge-picked")
        .forEach((picked) => picked.removeClass("dge-picked"));
    badges.inner("");
    selection.forEach(({ object }, index) => {
        if (object.hasView) object.dom.addClass("dge-picked");
        badges.add($.create("span").text(String(index + 1)));
    });
    placeBadges();
    showActions();
    showHint(restingHint());
}

function placeBadges(): void {
    if (!selection[0]) return;
    const c = scene();
    c.flush();
    const box = c.svg.dom().getBoundingClientRect();
    selection.forEach((hit, index) => {
        const [x, y] = hold(c, hit, c.pt3D(hit.at));
        $(badges.dom().children[index])
            .stl("left", `${box.left + x}px`)
            .stl("top", `${box.top + y}px`);
    });
}

// A tool of the menu before its first argument, which chooses its form.
const fresh = (): boolean =>
    !!armed && !!pending && pending.args.every((arg) => arg === undefined);

// The form of the tool of the menu that takes the object first.
const fitting = (object: construction_object): Tool | undefined =>
    toolsFor(object, vec3(), armed!.tools)[0];

// In space, the floor takes a plane where no object does.
const FLOORED: Param[] = ["plane", "planar", "linear"];
const floorTakes = (param: Param, screen: Vec2): boolean =>
    vec3() && FLOORED.includes(param) && !!groundPoint(screen);

function designateFloor(then: (floor: construction_object) => void): void {
    // Its preview's floor gone, not taken.
    clearPreview();
    const c = scene();
    const known = floorOf(c);
    const floor = known ?? addFloor(c);
    if (!known) changed(floor);
    then(floor);
}

// Whether, nothing it takes being designated, a point is made there for it.
const makesPoint = (hits: Hit[]): boolean =>
    !hits.some(({ object }) => fitting(object)) &&
    armed!.tools.some(
        (tool) =>
            tool.mode === "command" &&
            usable(tool, vec3()) &&
            makesPoints(tool.overload) &&
            tool.overload.params.includes("point"),
    );

// A locus takes a point that a point on an object moves, the other
// intersection a point already there.
const makesPoints = ({ tag }: Overload): boolean =>
    tag !== "Loc" && tag !== "Int";

function designateFirst(screen: Vec2, hits: Hit[], client: Vec2): void {
    const c = scene();
    const { mode } = pending!.tool;
    if (mode === "point")
        return designatePoint(screen, hits, client, (point) => {
            if (point !== hits[0]?.object) done(point);
        });
    if (mode === "turtle")
        return designatePoint(screen, hits, client, startTurtle);
    if (mode === "button") return placeButton(screen);
    if (mode === "intersection") {
        const cross = crossing(c, screen, hits);
        if (cross) return done(addCrossing(cross));
        const curves = hits.filter(({ object }) =>
            accepts(object, "intersectable"),
        );
        if (curves[0])
            chooseHit(curves, client, ({ object }) => {
                pending!.args = [object];
                prompt();
            });
        return;
    }
    const start = (hit: Hit) => choose(fitting(hit.object)!, hit);
    const taken = hits.filter(({ object }) => fitting(object));
    if (taken[0]) return chooseHit(taken, client, start);
    if (makesPoint(hits))
        designatePoint(screen, hits, client, (point) => {
            if (point !== hits[0]?.object) changed(point);
            start({
                object: point,
                distance: 0,
                at: (point as point_object).coords,
            });
        });
    else if (
        armed!.tools.some(
            (tool) =>
                tool.mode === "command" &&
                usable(tool, vec3()) &&
                tool.overload.params.some((param) => floorTakes(param, screen)),
        )
    )
        designateFloor((floor) =>
            start({ object: floor, distance: 0, at: groundPoint(screen)! }),
        );
}

const onRing = (slot: number): Vec2 => {
    const angle = -Math.PI / 2 + (2 * Math.PI * slot) / RING_SLOTS;
    return [RING_RADIUS * Math.cos(angle), RING_RADIUS * Math.sin(angle)];
};

// The ring's object, where the ring was opened on the screen and the
// object's point it holds there.
let held: { hit: Hit; client: Vec2; screen: Vec2 } | null = null;

// The point held, moved with its object: the nearest to where it was, or the
// centre of a polygon, a sphere or a solid's outline.
function hold(c: construction, hit: Hit, previous: Vec2): Vec2 {
    const { object } = hit;
    if (object instanceof sphere_object) return c.pt3D(object.CENTER);
    if (object instanceof solid_object)
        return vScale(object.outline.reduce(vAdd), 1 / object.outline.length);
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

// Panel open, a click designates for it, unless a tool or the line being
// typed takes it.
const inspecting = (): boolean => propertiesOpen && !pending && !editing();

const OBJECT_ACTIONS = [
    deleteButton,
    settingsButton,
    springButton,
    pinButton,
    magnetButton,
    turtleButton,
    pointButton,
    pointsButton,
    segmentsButton,
];

// The bar's actions, shown with the ring, and gone once one is applied.
function showActions(): void {
    const object = held?.hit.object ?? magnetizing?.point;
    actions.toggleClass("dge-bar-tool", !!armed);
    if (armed) {
        const { icon, family } = armed.tools[0];
        const label = itemLabel(armed);
        toolIcon
            .inner(toolSvg(icon))
            .stl("--dge-hue", `${family.hue}`)
            .stl("--dge-tone", `${family.tone}`)
            .show("grid");
        swatch.hide();
        objectName.text(label);
        OBJECT_ACTIONS.forEach((action) => action.hide());
        doneButton.show();
        actions.att("aria-label", label).show("flex");
        return;
    }
    toolIcon.hide();
    // Several objects selected: their names, in their order, and Delete.
    if (selection.length) {
        springOut = false;
        showSpring(null);
        const label = selectedNames();
        swatch.hide();
        objectName.text(label);
        OBJECT_ACTIONS.forEach((action) => action.hide());
        [deleteButton, settingsButton].forEach((action) => action.show("grid"));
        doneButton.hide();
        actions.att("aria-label", label).show("flex");
        return;
    }
    swatch.show();
    if (!object) {
        springOut = false;
        showSpring(null);
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
    if (!magnetizing && pinnable(object)) {
        const on = !!object.pinned;
        pinButton
            .toggleClass("dge-on", on)
            .att("aria-pressed", String(on))
            .show("grid");
    } else pinButton.hide();
    if (!magnetizing && magnetizable(object)) magnetButton.show("grid");
    else magnetButton.hide();
    if (!magnetizing && springy(object))
        springButton
            .toggleClass("dge-on", springOut)
            .att("aria-pressed", String(springOut))
            .show("grid");
    else springButton.hide();
    [pointsButton, segmentsButton].forEach((action) =>
        !magnetizing && pointList(object) ? action.show("grid") : action.hide(),
    );
    if (!magnetizing && pointValue(object)) pointButton.show("grid");
    else pointButton.hide();
    if (!magnetizing && turtleOf(object)) turtleButton.show("grid");
    else turtleButton.hide();
    showSpring(springOut && !magnetizing && springy(object) ? object : null);
    if (magnetizing) doneButton.show();
    else doneButton.hide();
    actions.att("aria-label", label).show("flex");
}

// An expression whose value is a list of points (among the turtle's
// drawing instructions).
const pointList = (object: construction_object) =>
    object instanceof expression_object &&
    Array.isArray(object.value) &&
    object.value.some((item) => Array.isArray(item) && item.length <= 3) &&
    object.value.every((item) => Array.isArray(item) && item.length >= 2);

const pointValue = (object: construction_object) =>
    object instanceof expression_object &&
    Array.isArray(object.value) &&
    (object.value.length === 2 || object.value.length === 3) &&
    object.value.every((item) => typeof item === "number");

// The point, or the list of the points, the expression's value gives, the
// expression kept, its text hidden.
function derive(
    source: expression_object,
    as: Exclude<Choice, "expression">,
): construction_object {
    const c = scene();
    const drawn =
        as === "point"
            ? add(
                  c,
                  resolve(c, {
                      name: null,
                      definition: {
                          kind: "pointFormula",
                          source: formatName(source.name),
                      },
                  }),
              )
            : add(c, {
                  name: nextName(c, false),
                  overload: findCommand("List")!.overloads[0],
                  args: [source],
              });
    // DGPad's segments.
    if (as === "segments") (drawn as expression_list_object).segmentsSize = 1;
    source.hidden = 1;
    source.updateView();
    c.invalidateGeometry(drawn);
    return drawn;
}

// DGPad's turtles: from a point, a program, super-hidden, whose value a
// list draws. They are found by what they draw, whatever their names
// (DGPad's blk_turtle_exp_A and blk_turtle_list_A, see figureTurtles).

// The point that starts a turtle, or the program of the turtle the object
// is or draws.
const turtleOf = (object: construction_object): construction_object | null =>
    object instanceof point_object || turtleStart(object)
        ? object
        : object instanceof expression_list_object && turtleStart(object.source)
          ? object.source
          : null;

function openTurtle(): void {
    const turtle = turtleOf(target()!)!;
    closeRing();
    editTurtle(turtle);
}

// From the menu's tool, which is put down.
function startTurtle(point: construction_object): void {
    cancel();
    editTurtle(point);
}

// The turtle's program in blocks, made if it has none.
function editTurtle(turtle: construction_object): void {
    properties.showBlocks();
    const c = scene();
    const existing =
        turtle instanceof point_object
            ? figureObjects(c).find(
                  (object) => turtleStart(object)?.point === turtle,
              )
            : turtle;
    if (!propertiesOpen) setProperties(true);
    if (existing) return properties.select(existing);
    const { name } = turtle;
    const program = add(
        c,
        resolve(c, {
            name: nextName(c, false),
            definition: {
                kind: "formula",
                source: `TURTLE_INIT(${quoteText(name)}, ${formatName(name)});\nreturn TURTLE_RESULT();`,
            },
        }),
    );
    program.hidden = 2;
    program.updateView();
    const list = add(c, {
        name: nextName(c, false),
        overload: findCommand("List")!.overloads[0],
        args: [program],
    }) as expression_list_object;
    list.segmentsSize = 1;
    c.invalidateGeometry(list);
    done(program);
}

// The program of the point's gesture, of the change of the expression's
// value, or of the opening of the figure, in blocks, made if it has none.
function startEvent(
    owner: point_object | expression_object | button_object,
    gesture: Trigger | null,
): void {
    const c = scene();
    const existing = figureObjects(c).find(
        (object) =>
            object instanceof event_object &&
            object.owner === owner &&
            object.gesture === gesture,
    );
    if (existing) return showProgram(existing);
    properties.showBlocks();
    if (!propertiesOpen) setProperties(true);
    done(addEvent(c, owner, gesture));
}

// From the menu's tool, which is put down.
function answer(tool: Tool, owner: construction_object): void {
    cancel();
    startEvent(owner as point_object | expression_object, tool.gesture ?? null);
}

// A program, in blocks.
function showProgram(button: construction_object): void {
    properties.showBlocks();
    if (!propertiesOpen) setProperties(true);
    properties.select(button);
}

// Its arrow there, by the menu's tool, which is put down.
function placeButton(at: Vec2): void {
    cancel();
    const c = scene();
    const button = add(c, {
        name: nextName(c, "Btn"),
        overload: buttonOverload(c, undefined, at),
        args: [new TextArg(message("button_caption"), new Map())],
    });
    showProgram(button);
    done(button);
}

function drawFrom(as: Exclude<Choice, "expression">): void {
    const source = target() as expression_object;
    closeRing();
    const drawn = derive(source, as);
    void refusedOffPlane().then((refused) =>
        refused ? showHint(message("off_plane"), true) : done(drawn),
    );
}

function remove(): void {
    const objects = selection.length
        ? selection.map(({ object }) => object)
        : propertiesOpen
          ? properties.selection
          : [target()!];
    stopMagnets();
    closeRing();
    clearSelection();
    const c = scene();
    // Some may go with others built from them.
    objects.forEach((object) => {
        if (c.getObj(object.name) === object) c.removeObject(object);
    });
    done();
}

// ************************** SPRING ******************************

function showSpring(object: springy_object | null): void {
    if (object === (sprung?.object ?? null)) return;
    const pulled = sprung?.pulled;
    if (pulled) {
        pulled.ghost.node.remove();
        if (!pulled.launched && pulled.before)
            sprung!.object.animation = pulled.before;
    }
    sprung = object && { object, pulled: null };
    if (springFrame !== null) cancelAnimationFrame(springFrame);
    springFrame = null;
    spring.removeClass("dge-pulling");
    if (!object) return void spring.hide();
    springFrame = requestAnimationFrame(drawSpring);
}

// Let go, the ball springs back to the point, which leaves as it passes
// it, and beyond, a little less each time.
const LAUNCH = 0.12;
const RECOIL = 0.45;
const recoil = (seconds: number) =>
    Math.cos((Math.PI / 2) * (seconds / LAUNCH)) * Math.exp(-seconds / LAUNCH);

// Each frame, as the object moves, animated or dragged: a coil of six
// turns from the anchor to the ball, and the speed along it, as DGPad's;
// while pulled, the ghost ahead.
function drawSpring(time: number): void {
    springFrame = requestAnimationFrame(drawSpring);
    const { object, pulled } = sprung!;
    if (!object.isVisible) return void spring.hide();
    let vector: Vec2;
    if (pulled?.released !== null && pulled?.released !== undefined) {
        const seconds = (time - pulled.released) / 1000;
        if (!pulled.launched && seconds >= LAUNCH) launch();
        if (seconds >= RECOIL) {
            closeRing();
            return changed();
        }
        vector = vScale(pulled.vector, recoil(seconds));
    } else if (pulled) {
        vector = pulled.vector;
        const { ghost } = pulled;
        const seconds = pulled.time === null ? 0 : (time - pulled.time) / 1000;
        pulled.time = time;
        const [gx, gy] = moveGhost(object, ghost, seconds);
        ghost.node
            .att("transform", `translate(${gx} ${gy})`)
            .toggleClass("dge-still", !ghost.animation.speed);
    } else vector = handleOf(springOf(object), object.animation);
    const [x, y] = pulled?.anchor ?? anchorOf(object);
    const [dx, dy] = vector;
    const length = Math.hypot(dx, dy) || 1;
    const [ux, uy] = [dx / length, dy / length];
    const turns = 12;
    const lead = 4;
    // To the ball's edge.
    const end = Math.max(length - 8, 2 * lead);
    const width = 5;
    const points = [`M0 0L${ux * lead} ${uy * lead}`];
    for (let index = 0; index < turns; index++) {
        const along = lead + ((index + 0.5) * (end - 2 * lead)) / turns;
        const side = index % 2 ? -width : width;
        points.push(`L${ux * along - uy * side} ${uy * along + ux * side}`);
    }
    points.push(
        `L${ux * (end - lead)} ${uy * (end - lead)}L${ux * end} ${uy * end}`,
    );
    coil.att("d", points.join(""));
    [grip, ball].forEach((circle) => circle.att("cx", dx).att("cy", dy));
    // Along the spring, upright, beside it.
    const angle = Math.atan2(dy, dx);
    const upright = Math.abs(angle) > Math.PI / 2 ? angle + Math.PI : angle;
    speedText
        .text(
            pulled?.animation && pulled.released === null
                ? pull(pulled.spring, pulled.vector).label
                : "",
        )
        .att(
            "transform",
            `translate(${dx / 2} ${dy / 2}) rotate(${(upright * 180) / Math.PI}) translate(0 -${width + 6})`,
        );
    const box = scene().svg.dom().getBoundingClientRect();
    spring
        .stl("left", `${box.left + x}px`)
        .stl("top", `${box.top + y}px`)
        .show();
}

// Taken, the spring holds the object where it is, and a ghost of it goes
// ahead at the speed the pull gives.
function takeSpring(event: PointerEvent): void {
    const { object } = sprung!;
    if (sprung!.pulled) return;
    const taken = springOf(object);
    const before = object.animation && { ...object.animation };
    if (object.animation) object.animation.speed = 0;
    const node = ghostDrawing(object)
        .removeClass("dge-hover")
        .addClass("dge-spring-ghost")
        .addClass("dge-still");
    object.dom.dom().after(node.dom());
    sprung!.pulled = {
        anchor: anchorOf(object),
        spring: taken,
        vector: handleOf(taken, before),
        animation: null,
        before,
        ghost: {
            at: ghostAt(object),
            animation: { speed: 0, direction: 1, ar: false },
            node,
        },
        time: null,
        released: null,
        launched: false,
    };
    // Out of the way of the pull.
    ring.hide();
    grip.dom().setPointerCapture(event.pointerId);
    spring.addClass("dge-pulling");
    showHint("");
}

function pullSpring(event: PointerEvent): void {
    const pulled = sprung?.pulled;
    if (!pulled || pulled.released !== null) return;
    const box = scene().svg.dom().getBoundingClientRect();
    pulled.vector = vSub(
        [event.clientX - box.left, event.clientY - box.top],
        pulled.anchor,
    );
    const { animation } = pull(pulled.spring, pulled.vector);
    // The same animation is kept: a back and forth keeps its direction.
    if (JSON.stringify(animation) === JSON.stringify(pulled.animation)) return;
    pulled.animation = animation;
    pulled.ghost.animation = { ...animation };
    if (!animation.speed) pulled.ghost.at = ghostAt(sprung!.object);
}

// Let go unmoved, the ball leaves the point as it was.
function releaseSpring(): void {
    const pulled = sprung?.pulled;
    if (!pulled || pulled.released !== null) return;
    spring.removeClass("dge-pulling");
    if (!pulled.animation) {
        closeRing();
        return;
    }
    pulled.released = performance.now();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        launch();
        closeRing();
        changed();
    }
}

function launch(): void {
    const { object, pulled } = sprung!;
    pulled!.launched = true;
    pulled!.ghost.node.remove();
    setAnimation(object, pulled!.animation!);
    scene().animations.paused = false;
}

[grip, ball].forEach((circle) => {
    circle.on("pointerdown", takeSpring);
    circle.on("pointermove", pullSpring, false);
    circle.on("pointerup", releaseSpring, false);
    circle.on("pointercancel", releaseSpring, false);
    circle.on(
        "pointerenter",
        () =>
            !sprung?.pulled &&
            showHint(message("spring_hint", formatName(sprung!.object.name))),
        false,
    );
    circle.on(
        "pointerleave",
        () => !sprung?.pulled && showHint(restingHint()),
        false,
    );
});

// ************************** MAGNETS *****************************

const reachField = () => reachInput.dom() as HTMLInputElement;

const restingHint = (): string =>
    ghosts
        ? message("erasing")
        : magnetizing
          ? message("magnet_hint", formatName(magnetizing.point.name))
          : selection.length
            ? `${selectedNames()}\n${message("selection_hint")}`
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
    if (tool.mode === "event") return answer(tool, object);
    pending = { tool, args: firstArgs(tool, object) };
    // An intersection waits for its second object.
    if (tool.mode === "intersection") return prompt();
    proceed();
}

// Builds the object once all its arguments are designated, or a cube
// from two points that give its plane.
function proceed(): void {
    const { tool, args } = pending!;
    const cube = cubeOn(scene(), tool.overload, args);
    if (cube) return build(cube.overload, cube.args);
    if (tool.overload.variadic || args.includes(undefined)) return prompt();
    build(formOf(tool, args as Arg[]), args as Arg[]);
}

// A tool of the menu that takes any solid builds the form of its arguments.
const formOf = ({ command, overload }: Tool, args: Arg[]): Overload =>
    overload.tag ? overload : overloadFor(command, args, vec3())!;

function build(overload: Overload, args: Arg[]): void {
    clearPreview();
    const c = scene();
    done(add(c, { name: nextName(c, overload.tag), overload, args }));
}

function designate(screen: Vec2, hits: Hit[], client: Vec2): void {
    if (fresh()) return designateFirst(screen, hits, client);
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
    if (param === "point" && makesPoints(overload)) {
        clearPreview();
        return designatePoint(screen, hits, client, (arg) => {
            if (arg !== hits[0]?.object) changed(arg);
            designateNext(arg);
        });
    }
    const taken = hits.filter(({ object }) => accepts(object, param));
    if (taken[0])
        chooseHit(taken, client, ({ object }) => designateNext(object));
    else if (floorTakes(param, screen)) designateFloor(designateNext);
}

// The first vertex designated again closes the polygon.
function designateNext(arg: construction_object): void {
    const { overload } = pending!.tool;
    const { args } = pending!;
    if (overload.variadic && args.length >= 3 && arg === args[0])
        return build(overload, args as Arg[]);
    if (overload.variadic) args.push(arg);
    else args[nextSlot()] = arg;
    proceed();
}

// Designated in its row, the object takes no place: an intersection of two
// curves is their first.
function designateRow(object: construction_object): void {
    clearPreview();
    if (fresh()) {
        const tool = fitting(object)!;
        if (tool.mode === "turtle") return startTurtle(object);
        if (tool.mode === "event") return answer(tool, object);
        pending = { tool, args: firstArgs(tool, object) };
        return tool.mode === "intersection" ? prompt() : proceed();
    }
    const { tool, args } = pending!;
    if (tool.mode !== "intersection") return designateNext(object);
    const found = intersection(args[0] as construction_object, object, 0);
    build(found.overload, found.args);
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
// first point to the pointer, the polygon reduced to a segment. The conic
// through five points, which DGPad doesn't show, has up to three, from the
// second point on.
const STAND_INS: Partial<Record<string, (given: Vec3[]) => Vec3[]>> = {
    Bis: ([first]) => [first],
    Ang: ([first, next]) => [turn(first, next, Math.PI / 3)],
    C3p: ([first, next]) => [
        turn(first, vScale(vAdd(first, next), 0.5), Math.PI / 2),
    ],
    Poly: ([, next]) => [next],
    Quad: conicStandIns,
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
    // A formula's function builds nothing to show.
    if (!overload?.tag) return null;
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
              free: makesPoints(pending.tool.overload),
          }
        : field && typedPending(field, hits);
    if (!call) return clearPreview();
    const { overload, args, free } = call;
    const slot = overload.variadic ? args.length : args.indexOf(undefined);
    // After the next one.
    const missing = overload.variadic
        ? overload.params.length - args.length - 1
        : args.filter((arg) => arg === undefined).length - 1;
    const stand =
        missing > 0 &&
        missing <= (overload.tag === "Quad" ? 3 : 1) &&
        STAND_INS[overload.tag];
    // A cube from two points, which may not give its plane.
    const cube = !!pending && overload.tag === "Cube" && slot === 1;
    if (missing > 0 && !stand && !cube) return clearPreview();
    const param = paramAt(overload, slot)!;
    const hit = hits.find(({ object }) => accepts(object, param));
    const candidate =
        hit?.object ??
        (param === "point" && free
            ? ("pointer" as const)
            : pending && floorTakes(param, screen)
              ? ("floor" as const)
              : null);
    const c = scene();
    const coords = freeCoords(screen);
    if (
        !candidate ||
        (candidate === "pointer" &&
            (!coords ||
                // Not free there, the cube can't be told.
                (cube &&
                    hits.some(({ object }) => accepts(object, "support")))))
    )
        return clearPreview();
    if (preview?.candidate !== candidate) {
        clearPreview();
        const objects: construction_object[] = [];
        // Shown until the tool is applied, the floor hidden in the figure.
        const known = floorOf(c);
        const floor = candidate === "floor" ? addFloor(c, "‧f", 0) : null;
        if (floor) {
            floor.dom.addClass("dge-preview");
            objects.push(floor);
        }
        const argument =
            candidate === "pointer"
                ? add(c, { name: "‧p", overload: FREE_POINT, args: coords! })
                : candidate === "floor"
                  ? (known ?? floor!)
                  : candidate;
        if (candidate === "pointer") {
            argument.showName = false;
            argument.updateView();
            objects.push(argument);
        }
        const full = [...args];
        if (overload.variadic) full.push(argument);
        else full[slot] = argument;
        const standIns = Array.from({ length: stand ? missing : 0 }, (_, i) => {
            const standIn = add(
                c,
                {
                    name: `‧s${i}`,
                    overload: FREE_POINT,
                    args: coords ?? [0, 0],
                },
                false,
            ) as point_object;
            standIn.hidden = 1;
            standIn.updateView();
            objects.push(standIn);
            if (overload.variadic) full.push(standIn);
            else full[full.indexOf(undefined)] = standIn;
            return standIn;
        });
        const form = cube
            ? cubeOn(c, overload, full)
            : {
                  overload: pending
                      ? formOf(pending.tool, full as Arg[])
                      : overload,
                  args: full as Arg[],
              };
        if (form) {
            const result = add(c, { name: "‧r", ...form }, false);
            if (result.hasView) result.dom.addClass("dge-preview");
            objects.push(result);
        }
        preview = {
            candidate,
            objects,
            pointer:
                candidate === "pointer"
                    ? (argument as point_object)
                    : undefined,
            standIns,
        };
    }
    const { pointer, standIns } = preview;
    if (pointer) {
        const [x, y, z = 0] = coords!;
        pointer.coords = [x, y, z];
        c.invalidateGeometry(pointer);
    }
    if (stand)
        stand(
            [...args.filter(Boolean), pointer ?? candidate].map(
                (point) => (point as point_object).coords,
            ),
        ).forEach((coords, index) => {
            standIns[index].coords = coords;
            c.invalidateGeometry(standIns[index]);
        });
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

// The axes with the grid as set, or in 3D the trihedron with the floor, as
// DGPad's isAxis.
function setAxes(on: boolean): void {
    const c = scene();
    c.GRID.hidden = on ? 0 : 1;
    if (!c.GRID.is2D) c.GRID.SHOWFLOOR = on;
    c.invalidateProjection();
    showAxes();
}

// Near an axis drawn in the plane.
function onAxis([x, y]: Vec2): boolean {
    const { is2D, hidden, showOx, showOy, ORG } = scene().GRID;
    return (
        is2D &&
        hidden === 0 &&
        ((showOx && Math.abs(y - ORG[1]) < 6) ||
            (showOy && Math.abs(x - ORG[0]) < 6))
    );
}

function showAxes(): void {
    const on = scene().GRID.hidden === 0;
    axesButton.toggleClass("dge-on", on).att("aria-pressed", String(on));
}

// Drops the tool waiting, or with `keepTool`, takes the tool of the menu
// again from its first argument.
function cancel(keepTool = false): void {
    setSteps(false);
    stopMagnets();
    if (!keepTool) armed = null;
    aim = null;
    clearPreview();
    closeMenu();
    closeRing();
    clearSelection();
    rearm();
    prompt();
}

function escape(): void {
    if (!menu.isHidden()) closeMenu();
    else if (!toolsMenu.isHidden()) closeTools();
    else if (propertiesOpen && !pending) setProperties(false);
    else if (ghosts) setEraser(false);
    else cancel();
}

function done(object?: construction_object): void {
    if (object && propertiesOpen) properties.select(object);
    rearm();
    clearPreview();
    highlight();
    showAccepted([]);
    changed(object);
}

// After a change of the figure: its text, and a step to undo.
function changed(object?: construction_object): void {
    showAxes();
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

// ************************** SPACE *******************************

type Step = (typeof history)[number];

// Whether the plane view the figure left for space showed the axes, and
// whether it had, when opened, objects off its plane, which aren't then
// refused.
let planeAxes: boolean | null = null;
let planeFlaw = false;

function showSpace(): void {
    const { is2D, FRAME2D } = scene().GRID;
    spaceButton.toggleClass("dge-on", !is2D).att("aria-pressed", String(!is2D));
    // DGPad's 3D figures keep theirs.
    if (FRAME2D) spaceButton.hide();
    else spaceButton.show("grid");
}

// Back to the plane only without objects off it.
function toggleSpace(): void {
    cancel(true);
    recording = recording.then(async () => {
        const c = scene();
        const off = !c.GRID.is2D && offPlane(c);
        if (off)
            return showHint(message("in_space", formatName(off.name)), true);
        await (c.GRID.is2D ? toSpace() : toPlane());
    });
    void record().then(refreshRows);
}

// Read in space seen from above, as the plane was, the camera then turns.
async function toSpace(step?: Step): Promise<void> {
    planeAxes = scene().GRID.hidden === 0;
    await reframe(
        { "3d": 1, th: PLANE.theta, ph: PLANE.phi, ax: 1, fl: 1 },
        step,
    );
    const c = scene();
    await turnView(c, SPACE, [c.width / 2, c.height / 2]);
}

async function toPlane(step?: Step): Promise<void> {
    const c = scene();
    const turns = Math.round((c.GRID.PHI - PLANE.phi) / (2 * Math.PI));
    const above = { ...PLANE, phi: PLANE.phi + turns * 2 * Math.PI };
    await turnView(c, above, c.GRID.ORG);
    await reframe(
        {
            "3d": 0,
            th: PLANE.theta,
            ph: PLANE.phi,
            pe: 0,
            fl: 0,
            ...(planeAxes !== null && { ax: +planeAxes }),
        },
        step,
    );
}

// The figure, or the step given, read again in the current view changed by
// `view` (but a step keeps its own coordinate system), a step's pinned
// points keeping their place in the window. `patch`: the figure's settings
// changed.
async function reframe(
    view: DgoFigure["v"],
    step?: Step,
    patch: Partial<DgoFigure> = {},
): Promise<void> {
    const figure = await asSaved(() => describeDgo(scene()));
    const { v } = figure;
    if (held) closeRing();
    const saved: DgoFigure | null = step && JSON.parse(step.figure);
    rebuild(
        studio,
        saved
            ? {
                  ...saved,
                  v: {
                      ...saved.v,
                      ...camera({ ...v, ...view }, true),
                      o: step!.o,
                      u: step!.u,
                  },
              }
            : { ...figure, ...patch, v: { ...v, ...view } },
    );
    const c = scene();
    if (step) {
        c.GRID.ORG = v.o as Vec2;
        c.GRID.UNIT = [v.u, v.u, v.u] as Vec3;
        c.invalidateProjection();
        c.flush();
    }
    if (ghosts) ghosts = showGhosts(c);
    showAxes();
    showSpace();
    refreshRows();
}

// In a plane figure, an object put off the plane is refused, the figure
// going back to its last step.
async function refusedOffPlane(): Promise<boolean> {
    const c = scene();
    c.flush();
    if (!c.GRID.is2D || planeFlaw || !offPlane(c)) return false;
    await reframe({}, history[position]);
    return true;
}

// ************************** NAMES *******************************

// The object whose name is retyped.
let renaming: construction_object | null = null;

const nameInput = () => nameField.dom() as HTMLInputElement;

async function rename(object: construction_object, name: string) {
    const figure = await describeDgo(scene());
    const index = figureObjects(scene()).indexOf(object);
    (figure.o[index] as unknown[])[1] = name;
    rebuild(studio, figure);
    properties.select(
        properties.selection.map((shown) =>
            scene().getObj(shown === object ? name : shown.name)!,
        ),
    );
    changed();
}

// The field over the name, in its font, which it hides.
function placeName(): void {
    const box = nameElement(renaming!)!.dom().getBoundingClientRect();
    nameBox
        .stl("left", `${box.left}px`)
        .stl("top", `${box.top + box.height / 2}px`);
}

function editName(object: construction_object): void {
    renaming = object;
    nameElement(object)!.stl("visibility", "hidden");
    nameInput().value = object.name;
    nameField
        .att("size", String(object.name.length))
        .stl("font-size", `${object.fontSize}px`)
        .stl("color", object.stroke_color);
    placeName();
    nameBox.show("flex");
    nameInput().focus();
    nameInput().select();
    highlight(object);
    showHint(message("rename_hint", formatName(object.name)));
}

function closeName(): void {
    if (renaming) nameElement(renaming)?.stl("visibility", "");
    renaming = null;
    nameBox.hide();
    highlight();
    showHint(restingHint());
}

// Why the name typed can't be taken.
function nameError(): string {
    const value = nameInput().value.trim();
    const taken = scene().getObj(value);
    return !value
        ? message("name_required")
        : taken && taken !== renaming
          ? message("name_taken", value)
          : "";
}

function hideName(): void {
    const object = renaming!;
    closeName();
    object.showName = false;
    object.createSVG();
    changed();
}

nameField.on(
    "input",
    () => nameField.att("size", String(Math.max(nameInput().value.length, 1))),
    false,
);
nameField.on(
    "keydown",
    (event) => {
        event.stopPropagation();
        if (event.key === "Escape") closeName();
        if (event.key !== "Enter") return;
        const error = nameError();
        if (error) showHint(error, true);
        else nameInput().blur();
    },
    false,
);
// Left, the name typed is taken, if it can be.
nameField.on(
    "blur",
    () => {
        const object = renaming;
        if (!object) return;
        const name = nameInput().value.trim();
        const valid = !nameError();
        closeName();
        if (valid && name !== object.name) void rename(object, name);
    },
    false,
);

// ************************** POINTER *****************************

let down: { x: number; y: number; time: number } | null = null;
// A right press passed on to the object under it as a left one.
let relaying = false;
// The line typed for which a tap in the void makes a point.
let typing: HTMLInputElement | null = null;
let dragFrame: number | null = null;
// A pointer pressed while a tool waits: it aims and designates where it's
// released, unless still on the button that chose the tool.
let aim: { button: Vec2 | null } | null = null;
// The name being dragged, and where it was taken from (see labelHold).
let label: { object: construction_object; grab: Vec2 } | null = null;
// The angle whose mark is being dragged, its radius and the pointer's
// distance to its vertex when taken.
let sized: { angle: Angle; radius: number; from: number } | null = null;
// The expression or button being dragged, and where it was taken from its
// position.
let moved: {
    expression: expression_object | button_object;
    grab: Vec2;
} | null = null;

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
    // As when pressed, a point near its name is taken rather than the name.
    const named =
        !(hits[0]?.object instanceof point_object) &&
        !pending &&
        !editing() &&
        labelAt(c, [event.clientX, event.clientY]);
    // As when pressed, an angle's mark rather than what is farther.
    const arc = !named && !pending && !editing() && arcAt(c, screen, hits);
    c.svg.toggleClass("dge-grip", !!named || !!arc);
    if (held) return;
    if (named) return highlight(named);
    if (arc) return highlight(arc);
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
        if (relaying) return;
        // Pressed elsewhere, the menus close, and the figure does nothing.
        if (
            !toolsMenu.isHidden() &&
            ![toolsMenu, toolsSub, toolsButton].some((box) =>
                box.dom().contains(element(event.target)),
            )
        ) {
            closeTools();
            if (inFigure(event)) {
                down = null;
                event.stopPropagation();
                return;
            }
        }
        if (!menu.isHidden() && !menu.dom().contains(element(event.target))) {
            closeMenu();
            if (inFigure(event)) {
                down = null;
                event.stopPropagation();
                return;
            }
        }
        // Pressed elsewhere, the name typed is taken, and the figure does
        // nothing.
        if (renaming && !nameBox.dom().contains(element(event.target))) {
            nameInput().blur();
            if (inFigure(event)) {
                down = null;
                event.stopPropagation();
                return;
            }
        }
        if (!inFigure(event) || !event.isPrimary) return;
        // The right button drags the objects, and elsewhere the view, even
        // while a tool waits or a line is typed.
        if (event.button === 2) {
            down = {
                x: event.clientX,
                y: event.clientY,
                time: performance.now(),
            };
            const target = element(event.target);
            const ignored = previewed();
            const object = figureObjects(scene()).find(
                (object) =>
                    object.hasView &&
                    !ignored.has(object) &&
                    object.dom.dom().contains(target),
            );
            if (!object) return;
            event.stopPropagation();
            relaying = true;
            object.dom.dom().dispatchEvent(
                new PointerEvent("pointerdown", {
                    pointerId: event.pointerId,
                    pointerType: event.pointerType,
                    isPrimary: true,
                    clientX: event.clientX,
                    clientY: event.clientY,
                    button: 0,
                    buttons: 1,
                }),
            );
            relaying = false;
            return;
        }
        // Only a line already begun takes what the figure designates.
        const blank = editing();
        if (blank && !blank.value.trim()) blank.blur();
        down = { x: event.clientX, y: event.clientY, time: performance.now() };
        const c = scene();
        const screen = c.pointerPosition(event);
        label = null;
        sized = null;
        // A point near its name is dragged rather than the name.
        const named =
            !pending &&
            !editing() &&
            labelAt(c, [event.clientX, event.clientY]);
        if (named && !(pick(c, screen)[0]?.object instanceof point_object)) {
            label = { object: named, grab: vSub(screen, labelHold(named)) };
            // Pressed twice quickly, the name would be selected as text.
            event.preventDefault();
            event.stopPropagation();
            c.svg.dom().setPointerCapture(event.pointerId);
            return;
        }
        // As in DGPad, an angle's mark is dragged to change its radius.
        const angle =
            !pending && !editing() && arcAt(c, screen, pick(c, screen));
        if (angle) {
            sized = {
                angle,
                radius: angle.arcRadius,
                from: vNorm(vSub(screen, vertexOf(angle).screen)),
            };
            event.preventDefault();
            event.stopPropagation();
            c.svg.dom().setPointerCapture(event.pointerId);
            return;
        }
        // The tools circle also drags a button; a tap still opens its tools.
        const widget = !pending && propertyObject(event);
        moved = null;
        if (
            (widget instanceof expression_object ||
                widget instanceof button_object) &&
            (widget instanceof button_object
                ? widget.accessory.dom().contains(element(event.target))
                : !widget.dom.dom().contains(element(event.target))) &&
            !pick(c, screen)[0]
        ) {
            moved = { expression: widget, grab: vSub(screen, widget.screen) };
            event.preventDefault();
            event.stopPropagation();
            c.svg.dom().setPointerCapture(event.pointerId);
            return;
        }
        if (inspecting()) {
            const object = propertyObject(event);
            // Its arrow and label run the program being edited, its tools
            // circle selects it.
            if (
                (object instanceof button_object &&
                    !object.frame.dom().contains(element(event.target))) ||
                (object instanceof expression_object &&
                    (object.checkbox || object.inputLength > 0))
            ) {
                down = null;
                event.preventDefault();
                event.stopPropagation();
                showProperties(event, object);
            }
            return;
        }
        const field = editing();
        typing = null;
        if (field) {
            const hits = pick(c, screen, previewed());
            // A slider, a text…: its name.
            const widget = !hits[0] && propertyObject(event);
            if (widget) {
                designateTyped(field, widget);
                down = null;
                event.stopPropagation();
                return;
            }
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
        if (inFigure(event) && editing() && (!down || typing || moved))
            event.preventDefault();
    },
    { capture: true, prevent: false },
);

// Once a frame, what follows the figure.
function dragged(): void {
    dragFrame ??= requestAnimationFrame(() => {
        dragFrame = null;
        forgetBranches();
        const shown = rowsInSight();
        // The figure first: its measures would force a layout after the
        // rows are written.
        scene().flush();
        updateRows(shown);
        moveRing();
        placeBadges();
        showMagnets();
        if (renaming) placeName();
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
        if (label && event.isPrimary && event.buttons)
            return placeLabel(
                label.object,
                vSub(scene().pointerPosition(event), label.grab),
            );
        if (sized && event.isPrimary && event.buttons) {
            const { angle, radius, from } = sized;
            const to = vNorm(
                vSub(scene().pointerPosition(event), vertexOf(angle).screen),
            );
            // The bounds of the properties' field.
            angle.arcRadius = Math.min(
                200,
                Math.max(5, Math.round((radius * to) / Math.max(from, 1))),
            );
            angle.project();
            return scene().invalidateRender(angle);
        }
        if (moved && event.isPrimary && event.buttons) {
            const { expression, grab } = moved;
            expression.screen = vSub(scene().pointerPosition(event), grab);
            if (expression instanceof expression_object && expression.anchor)
                expression.alpha = vSub(
                    expression.screen,
                    expression.anchor.screen,
                );
            return scene().invalidateRender(expression);
        }
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
        const still =
            Math.hypot(event.clientX - down.x, event.clientY - down.y) <=
            $.clickRadius;
        const tap = still && performance.now() - down.time <= $.clickDelay;
        down = null;
        const named = label?.object;
        label = null;
        if (named && !tap) {
            if (properties.selection.includes(named))
                properties.select(properties.selection);
            return void record();
        }
        const resized = sized?.angle;
        sized = null;
        if (resized && !tap) {
            if (properties.selection.includes(resized))
                properties.select(properties.selection);
            return void record();
        }
        const expression = moved?.expression;
        moved = null;
        if (expression && !tap) return void record();
        const line = editing();
        if (expression && line) return designateTyped(line, expression);
        if (!inFigure(event)) return;
        // A long press, or a click with ⌘, Ctrl or Shift, adds the object to
        // the selection.
        const adding =
            event.button !== 2 &&
            !ghosts &&
            !magnetizing &&
            !stepping &&
            (tap ? event.metaKey || event.ctrlKey || event.shiftKey : still);
        // Once the point has its pointerup too (this listener captures):
        // the programs it runs when let go are then in the step and rows.
        if (!tap)
            window.setTimeout(() => {
                scene().flush();
                void record().then(() => updateRows());
            });
        if (!adding && (!tap || event.button === 2)) return;
        if (!adding && held) return closeRing();
        if (!adding && selection[0]) return clearSelection();
        const c = scene();
        const screen = c.pointerPosition(event);
        // A tap on a name designates its object, a point there, on an
        // angle's mark its angle.
        const hits = named
            ? [
                  {
                      object: named,
                      distance: 0,
                      at: nearest(c, named, screen) ?? [0, 0, 0],
                  },
              ]
            : resized
              ? [
                    {
                        object: resized,
                        distance: 0,
                        at:
                            nearest(c, resized, screen) ??
                            vertexOf(resized).coords,
                    },
                ]
              : pick(c, screen, previewed());
        const box = c.svg.dom().getBoundingClientRect();
        const client: Vec2 =
            named instanceof point_object
                ? [box.left + named.sx, box.top + named.sy]
                : [event.clientX, event.clientY];
        if (adding && inspecting()) {
            const object = propertyObject(event);
            if (!hits.some((hit) => hit.object === object) && object)
                return properties.toggle(object);
            if (hits[0])
                chooseHit(hits, client, (hit) => properties.toggle(hit.object));
            return;
        }
        if (adding) {
            if (hits[0]) chooseHit(hits, client, select);
            return;
        }
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
        if (inspecting()) {
            // A widget, or an object the figure can't pick.
            const object = propertyObject(event);
            if (
                object instanceof button_object &&
                object.frame.dom().contains(element(event.target))
            )
                return dragged();
            if (!hits.some((hit) => hit.object === object) && object)
                return properties.select(object);
            if (!hits[0])
                return onAxis(screen)
                    ? properties.figure()
                    : properties.select(null);
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
        if (stepping) return;
        if (named) return editName(named);
        const cross = crossing(c, screen, hits);
        if (cross) return done(addCrossing(cross));
        if (hits[0])
            return chooseHit(hits, client, (hit) => openRing(hit, client));
        // The rows show the button's values on the next frame, after it runs.
        const widget = propertyObject(event);
        if (
            widget instanceof button_object &&
            widget.frame.dom().contains(element(event.target))
        )
            return dragged();
        if (widget)
            return openRing(
                {
                    object: widget,
                    distance: 0,
                    at: groundPoint(screen) ?? [0, 0, 0],
                },
                client,
            );
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
            void save(event.shiftKey);
        } else if (command && event.key.toLowerCase() === "o") {
            event.preventDefault();
            chooseFigure();
        } else if (
            editing() ||
            typed(event.target) ||
            ([properties.panel, magnetCard].some((box) =>
                box.dom().contains(element(event.target)),
            ) &&
                event.key !== "Escape")
        )
            return;
        else if (stepKey(event)) return;
        else if (command && event.key.toLowerCase() === "z") {
            event.preventDefault();
            travel(event.shiftKey ? 1 : -1);
        } else if (command && event.key.toLowerCase() === "y") {
            event.preventDefault();
            travel(1);
        } else if (
            (event.key === "Delete" || event.key === "Backspace") &&
            (target() || selection.length)
        ) {
            event.preventDefault();
            remove();
        } else if (event.key === "Escape") escape();
    },
    false,
);

// ************************** HISTORY *****************************

// Each step's figure, its view without the window and the camera, and the
// origin and unit its pinned points' coordinates are given in.
let history: { figure: string; o: unknown; u: unknown }[] = [];
let position = -1;
let recording = Promise.resolve();
// The step last saved, or opened.
let saved = "";

// A view's window and camera, or, if not `kept`, the rest.
const camera = (view: DgoFigure["v"], kept: boolean): DgoFigure["v"] =>
    Object.fromEntries(
        Object.entries(view).filter(
            ([key]) => ["w", "h", "th", "ph"].includes(key) === kept,
        ),
    );

function record(): Promise<void> {
    recording = recording.then(async () => {
        const figure = await asSaved(() => describeDgo(scene()));
        const { o, u, ...view } = figure.v;
        const step = JSON.stringify({ ...figure, v: camera(view, false) });
        if (step === history[position]?.figure) return;
        history = [...history.slice(0, position + 1), { figure: step, o, u }];
        position = history.length - 1;
        showChanged(step !== saved);
    });
    return recording;
}

function travel(step: number): void {
    recording = recording.then(async () => {
        if (!history[position + step]) return;
        cancel(true);
        position += step;
        const target = history[position];
        showChanged(target.figure !== saved);
        const space = JSON.parse(target.figure).v["3d"] === 1;
        if (space === scene().GRID.is2D)
            await (space ? toSpace(target) : toPlane(target));
        else await reframe({}, target);
    });
}

// ************************** FILES *******************************

async function save(as = false): Promise<void> {
    let step = "";
    const written = await saveFile(async () => {
        await recording;
        step = history[position].figure;
        return asSaved(() => writeDgo(scene()));
    }, as);
    if (written) saved = step;
}

// A figure opened from `name`, a file name or a URL, which a save writes back
// to if `from` is its file.
async function open(
    name: string,
    load: (c: construction) => Promise<string[]>,
    from?: FileSystemHandle | null,
): Promise<void> {
    setEraser(false);
    cancel();
    properties.select(null);
    studio.scene.dispose();
    studio.scene = construction.create(studio);
    const unsupported = await load(studio.scene);
    studio.scene.flush();
    studio.scene.reveal();
    showAxes();
    showSpace();
    planeAxes = null;
    planeFlaw = studio.scene.GRID.is2D && offPlane(studio.scene) !== undefined;
    history = [];
    position = -1;
    await record();
    saved = history[0].figure;
    opened(name, from);
    refreshRows();
    showHint(
        unsupported.length
            ? message("unsupported", unsupported.join(", "))
            : "",
        unsupported.length > 0,
    );
}

// A chosen or dropped file.
async function openFile(
    file: File,
    from?: Promise<FileSystemHandle | null> | FileSystemHandle,
): Promise<void> {
    return open(
        file.name,
        async (c) =>
            /\.ggb$/i.test(file.name)
                ? importGgbFromBlob(c, file)
                : /\.dgo$/i.test(file.name)
                  ? importDgoFromBlob(c, file)
                  : importDgp(c, await file.text()),
        await from,
    );
}

fileInput.on(
    "change",
    () => {
        void openFile((fileInput.dom() as HTMLInputElement).files![0]);
        (fileInput.dom() as HTMLInputElement).value = "";
    },
    false,
);

dropFigures((file, from) => void openFile(file, from));

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
    : newFigure();

function newFigure(): Promise<void> {
    return open("figure", async (c) => {
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
}

export { studio };
