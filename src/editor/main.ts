// First, as in the player: the object classes import each other.
import { AWAKE, construction } from "../construction";
import type { Animation } from "../animation";
import {
    addDgoEntries,
    describeDgo,
    describeMacros,
    dgoJson,
    figureObjects,
    gzipped,
    imageKey,
    importDgo,
    readDgo,
    readDgoFile,
    writeDgo,
    type DgoFigure,
    type Workbook,
} from "../dgo";
import { $, type DOMElement } from "../dom";
import { droppedFigures, dropFigures, hasFiles } from "../drop";
import { FIGURE_URL, fetchFigure } from "../figure_url";
import { DIR, LANG } from "../i18n";
import {
    forgetValues,
    importForeign,
    leavePage,
    openFigureFile,
    showTabs,
    useWorkbook,
    writeWorkbook,
} from "../workbook";
import type { construction_object } from "../objects/construction_object";
import { point_object, type magnet_target } from "../objects/point_object";
import { button_object } from "../objects/button_object";
import type { circle1_object } from "../objects/circle1_object";
import { event_object, type Trigger } from "../objects/event_object";
import { expression_object } from "../objects/expression_object";
import { image_object } from "../objects/image_object";
import { expression_list_object } from "../objects/expression_list_object";
import { panel_object } from "../objects/panel_object";
import { pathData, polygon_object } from "../objects/polygon_object";
import type { segment_object } from "../objects/segment_object";
import { sphere_object } from "../objects/sphere_object";
import { solid_object } from "../objects/solid_object";
import { preferences } from "../preferences";
import { finishSplash } from "../splash";
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
    crossable,
    findCommand,
    FormulaArg,
    FUNCTIONS,
    isCommand,
    mappedSlot,
    meet,
    otherView,
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
    addControl,
    addImage,
    addPointOn,
    builtTag,
    buttonOverload,
    setConditions,
    showOnly,
    showWhile,
    cubeOn,
    entryOf,
    figureIndex,
    formatArg,
    resolveArgument,
    floorOf,
    FREE_POINT,
    addEvent,
    hasName,
    lineOf,
    applyMacroLine,
    openBox,
    resolveMacro,
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
    installed,
    opened,
    saveFile,
    saveOther,
    showChanged,
    standalone,
} from "./file";
import { canInstall, install } from "./install";
import {
    DELETE_KEY,
    contextMenu,
    menuBar,
    shortcut,
    type Menu,
    type MenuItem,
    type MenuItems,
} from "./menus";
import { embedded, embedEditor, requestSave } from "./embed";
import { toolsMenu as applicationToolsMenu } from "./about";
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
    meetings,
    pick as pickObjects,
    PICK_RADIUS,
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
    renameExternals,
    TextError,
    type ArgumentCompletion,
    type ArgText,
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
    macroIcon,
    toolsFor,
    usable,
    type Family,
    type Item,
    type Tool,
} from "./tools";
import { toolPalette, type Entry } from "./palette";
import { listFilters } from "./filters";
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
    isFreePoint,
} from "./magnets";
import { MARK_WIDER, watchMarks } from "./marks";
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
import { askLink, confirmed, framingBar } from "./web_page";
import {
    conflicts,
    describeLibrary,
    emptyLibrary,
    keepMyMacros,
    merge,
    myMacros,
    readLibrary,
    sectionHue,
    shownMacros,
    suppliedLibrary,
    type Library,
} from "./library";
import { macroBadge, manageMyMacros } from "./my_macros";
import { showMacroProgram } from "./macro_program";
import "./properties.css";
import { macroPanel, type MacroState } from "./macro_panel";
import { macro_object, type Macro } from "../objects/macro_object";
import {
    applyMacro,
    boxOf,
    completes,
    macroIndex,
    takesAt,
    designation,
    takesNext,
    firstFixed,
    rememberFixed,
    withFixed,
    typedNumber,
    type Designation,
    type Picked,
} from "./macro";

// The construction editor: see EDITOR.md.

const PANEL_WIDTH = 320;
// How long the panels take to slide, in milliseconds.
const SLIDE = 240;
const RING_BUTTON = 20;
const RING_RADIUS = (RING_SLOTS * (2 * RING_BUTTON + 2)) / (2 * Math.PI);
// The corner of an HTML frame that sizes it (that of properties.css), and
// its least width and height, in pixels.
const FRAME_GRIP = 14;
const FRAME_MIN = 40;

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
        .stl("fill:#f8f9fa;stroke:#b7bdc6;stroke-width:1;stroke-opacity:1");
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
watchMarks();

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
    .dge-editor { --dge-code: ui-monospace, dge-code, "Geeza Pro", "Segoe UI", "Noto Sans Arabic", monospace; --dge-panel-size: min(var(--dge-panel-user, ${PANEL_WIDTH}px), calc(100vw - 56px)); --dge-panel-width: var(--dge-panel-size); --dge-menu-height: 0px; --dge-bar-height: calc(48px + var(--dge-menu-height)); --dge-slide-duration: 0s; --dge-slide: var(--dge-slide-duration) cubic-bezier(0.22, 1, 0.36, 1); margin: 0; margin-inline-start: var(--dge-panel-width); margin-block-start: var(--dge-bar-height); width: calc(100% - var(--dge-panel-width)); height: calc(100% - var(--dge-bar-height) - var(--docgeo-tabs, 0px)); transition: margin-inline-start var(--dge-slide), width var(--dge-slide); }
    .dge-editor.dge-menus { --dge-menu-height: 32px; }
    .dge-editor .docgeo-tabs > button { transition: transform 0.15s; }
    .docgeo-tabs > button.dge-dragged { z-index: 1; transition: none; box-shadow: 0 2px 8px rgb(0 0 0 / 0.18); }
    .docgeo-tabs > .dge-tabs-button { width: 34px; padding: 0; justify-content: center; border: 0; margin: 0; color: #444; }
    body > .docgeo-drop { bottom: var(--docgeo-tabs, 0px); }
    .dge-drop-tab { position: absolute; inset: auto 28px 28px; margin: 0; pointer-events: none; padding: 20px 16px; border: 2px dashed #93b4f5; border-radius: 12px; background: rgb(255 255 255 / 0.85); color: #2563eb; font-size: 15px; font-weight: 600; text-align: center; transition: background 0.15s, color 0.15s; }
    .dge-drop-tab.on { border-color: #2563eb; background: #2563eb; color: #fff; }
    .dge-tab-more { display: flex; margin-inline: 8px -6px; padding: 4px 2px; color: #a1a1a1; }
    .dge-tab-more:hover { color: #2a2a2a; }
    .docgeo-tabs input { width: 160px; padding: 0 10px; border: 0; outline: 2px solid #2563eb; outline-offset: -2px; color: #222; font: inherit; }
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
    /* The title shortened, rather than the number of objects. */
    #dge-history h2 { display: flex; align-items: center; }
    #dge-history h2 > span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    #dge-history .dge-count { flex: none; }
    .dge-item { display: flex; align-items: flex-start; padding-inline: 4px; border-block-end: 1px solid #f1f5f9; }
    .dge-item:hover { background: #f8fafc; }
    .dge-side-marks path { fill: none; stroke-linecap: round; pointer-events: none; }
    .dge-item:has(> .dge-hover) { background: #fef3c7; }
    .dge-item:has(> .dge-new) { animation: dge-new 1.2s ease-out; }
    .dge-item:has(> .dge-row:focus) { background: #eff6ff; box-shadow: inset 3px 0 #2563eb; }
    .dge-item:has(> .dge-error) { background: #fef2f2; box-shadow: inset 3px 0 #dc2626; }
    .dge-row { flex: 1; min-width: 0; padding: 7px 4px; border: 0; background: none; font: 13.5px/1.5 var(--dge-code); color: inherit; outline: none; }
    .dge-row[readonly], .dge-row.dge-hidden { color: #9ca3af; }
    .dge-dot { flex-shrink: 0; display: grid; place-items: center; width: 30px; height: 30px; margin-block: 2px; padding: 0; border: 0; border-radius: 50%; background: none; cursor: pointer; }
    .dge-dot::before { content: ""; box-sizing: border-box; width: 13px; height: 13px; border: 2px solid var(--dge-color); border-radius: 50%; background: var(--dge-color); box-shadow: 0 0 0 1px rgb(15 23 42 / 0.1); transition: background 0.15s; }
    .dge-dot[aria-pressed="false"]::before { background: #fff; opacity: 0.7; }
    .dge-dot[data-shape]::before { border-width: 1.5px; background: var(--dge-fill); box-shadow: none; }
    .dge-dot[data-shape][aria-pressed="false"]::before { opacity: 0.3; }
    .dge-dot[data-shape="rect"]::before, .dge-dot[data-shape="diamond"]::before { width: 11px; height: 11px; border-radius: 1px; }
    .dge-dot[data-shape="diamond"]::before { transform: rotate(45deg); }
    .dge-dot[data-shape="cross"]::before { width: 11px; height: 11px; border: 0; border-radius: 0; background: linear-gradient(45deg, transparent calc(50% - 1px), var(--dge-color) 0 calc(50% + 1px), transparent 0), linear-gradient(-45deg, transparent calc(50% - 1px), var(--dge-color) 0 calc(50% + 1px), transparent 0); }
    .dge-dot:hover { background: rgb(15 23 42 / 0.06); }
    .dge-dot:focus-visible, .dge-item .dge-label:focus-visible { outline: 2px solid #2563eb; outline-offset: -2px; }
    .dge-dot:disabled { visibility: hidden; }
    .dge-item .dge-label { width: 30px; height: 30px; margin-block: 2px; border: 0; border-radius: 8px; color: #94a3b8; opacity: 0; }
    .dge-item .dge-label svg { width: 18px; height: 18px; }
    .dge-item .dge-label.dge-on { background: none; color: #475569; opacity: 1; }
    .dge-item:hover .dge-label, .dge-item:focus-within .dge-label { opacity: 1; }
    .dge-item .dge-label:hover { background: rgb(15 23 42 / 0.06); color: #1d4ed8; }
    .dge-item .dge-delete:hover { background: #fef2f2; color: #dc2626; }
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
    .dge-item > .dge-fold { order: -1; width: 22px; height: 30px; margin-block: 2px; margin-inline-end: -6px; padding: 0; border: 0; border-radius: 6px; background: none; color: #64748b; cursor: pointer; }
    .dge-fold svg { width: 16px; height: 16px; }
    .dge-fold:dir(rtl):not(.dge-on) svg { transform: scaleX(-1); }
    .dge-fold:hover { background: rgb(15 23 42 / 0.06); color: #1d4ed8; }
    .dge-item.dge-sub { padding-inline-start: 26px; }
    .dge-sub .dge-row:not(.dge-hidden) { color: inherit; }
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
    .dge-line .dge-palette-button { display: none; }
    @media (max-width: 500px) { .dge-line .dge-palette-button { display: grid; } }
    .dge-item.dge-filtered { display: none; }
    .dge-filters { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px 0; }
    .dge-filters:empty { display: none; }
    .dge-filters button { display: flex; align-items: center; gap: 6px; max-width: 100%; padding: 2px 6px 2px 10px; border: 1px solid #bfdbfe; border-radius: 12px; background: #eff6ff; font: 12px/18px system-ui, -apple-system, "Segoe UI", sans-serif; color: #1d4ed8; cursor: pointer; }
    .dge-filters button span:first-child { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .dge-filters button span:last-child { font-size: 15px; line-height: 1; }
    .dge-filters button:hover { border-color: #2563eb; }
    .dge-menu-popup.dge-filter-menu { position: fixed; inset: auto; max-height: calc(100dvh - 16px); overflow-y: auto; font: 13px/1 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2937; z-index: 13; }
    .dge-filter-menu small { margin-inline-start: auto; padding-inline-start: 28px; font: inherit; opacity: 0.6; font-variant-numeric: tabular-nums; }
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
    .dge-menu-popup button { display: flex; align-items: center; min-height: 32px; padding: 6px 12px 6px 4px; border: 0; border-radius: 5px; background: none; font: inherit; color: inherit; text-align: start; white-space: nowrap; }
    .dge-menu-popup button::before { content: ""; width: 20px; flex: none; text-align: center; }
    .dge-menu-popup button[aria-checked="true"]::before { content: "✓"; }
    .dge-menu-popup button:not(:disabled):is(:hover, :focus-visible) { background: #2563eb; color: #fff; outline: none; }
    .dge-menu-popup button:disabled { opacity: 0.4; }
    .dge-menu-popup kbd { margin-inline-start: auto; padding-inline-start: 28px; font: inherit; opacity: 0.6; }
    .dge-menu-popup hr { margin: 4px 8px; border: 0; border-block-start: 1px solid #e5e7eb; }
    .dge-menubar > .dge-menu-subpopup { position: fixed; inset-inline: auto; display: flex; max-height: calc(100dvh - 16px); overflow-y: auto; }
    .dge-menu-sub::after { content: "›"; margin-inline-start: auto; padding-inline-start: 24px; font-size: 16px; line-height: 1; opacity: 0.6; }
    .dge-menu-sub:dir(rtl)::after { content: "‹"; }
    .dge-menu-subpopup > * { flex: none; }
    .dge-menu-popup .dge-menu-icon > .dge-tool-icon:last-child { width: 28px; height: 28px; margin-inline: 2px 10px; }
    .dge-menu-popup .dge-menu-icon > .dge-tool-icon svg { width: 20px; height: 20px; }
    .dge-menu-popup button:not(:disabled):is(:hover, :focus-visible) .dge-tool-icon { border-color: #fff; }
    .dge-menu-popup button.dge-menu-sub.dge-open:not(:hover, :focus-visible) { background: #eef2f7; }
    .dge-menu-veil { position: fixed; inset: 0; z-index: 19; }
    .dge-menu-popup.dge-context-menu { position: fixed; inset: auto; display: flex; font: 13px/1 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2937; z-index: 20; }
    .dge-menu-popup.dge-context-menu button.dge-menu-icon::before { display: block; }
    .dge-context-menu .dge-page-swatch { order: 0; width: 12px; height: 12px; margin-inline: auto 0; border-radius: 3px; }
    .dge-context-menu .dge-menu-icon > span:first-child { padding-inline-end: 24px; }
    .dge-page-colors { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 12px 6px 24px; }
    .dge-page-colors small { width: 100%; font: inherit; opacity: 0.6; }
    .dge-menu-popup .dge-page-colors button, .dge-menu-popup .dge-page-colors button:not(:disabled):is(:hover, :focus-visible) { width: 20px; min-height: 0; height: 20px; padding: 0; border: 1px solid rgb(0 0 0 / 0.15); border-radius: 4px; background: var(--dge-swatch, linear-gradient(to top right, transparent 45%, #ef4444 45% 55%, transparent 55%) #fff); }
    .dge-menu-popup .dge-page-colors button::before { content: none; }
    .dge-menu-popup .dge-page-colors button:is(:hover, :focus-visible, .on) { outline: 2px solid #2563eb; outline-offset: 1px; }
    .dge-file { display: flex; align-items: center; gap: 8px; min-width: 0; max-width: min(38vw, 420px); margin-inline-start: auto; padding-inline: 18px 6px; color: #64748b; }
    .dge-file span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: normal; }
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
    .dge-hint { position: fixed; bottom: calc(16px + var(--docgeo-tabs, 0px)); left: calc(50% + var(--dge-panel-width) / 2); transform: translateX(-50%); max-width: calc(100% - var(--dge-panel-width) - 32px); padding: 7px 14px; border-radius: 9px; background: rgb(17 24 39 / 0.86); color: #f9fafb; font-family: var(--dge-code); font-size: 13.5px; white-space: pre-wrap; unicode-bidi: plaintext; z-index: 11; pointer-events: none; transition: left var(--dge-slide), max-width var(--dge-slide); }
    @media (prefers-reduced-motion: reduce) { .dge-editor.dge-panel-animated { --dge-slide-duration: 0s; } .dge-bar-object { animation: none; } }
    .dge-hint:empty { display: none; }
    .dge-hint.dge-error { background: #b91c1c; }
    .dge-hint button { width: 30px; height: 30px; margin: -4px -8px -4px 10px; padding: 0; border: 0; border-radius: 50%; background: rgb(255 255 255 / 0.18); color: inherit; font-size: 15px; vertical-align: middle; cursor: pointer; pointer-events: auto; }
    .dge-hint button:hover { background: rgb(255 255 255 / 0.32); }
    .dge-hint button.dge-hint-text { width: auto; height: 26px; margin-inline-start: 10px; padding: 0 10px; border-radius: 6px; font: inherit; font-size: 12.5px; }
    .dge-hint input { width: 7ch; margin: -3px 0 -3px 10px; padding: 2px 6px; border: 0; border-radius: 5px; font: inherit; pointer-events: auto; }
    .dge-hint input.dge-error { outline: 2px solid #f87171; }
    .dge-ring { position: fixed; width: 0; height: 0; z-index: 12; }
    .dge-ring button { position: absolute; display: grid; place-items: center; width: ${2 * RING_BUTTON}px; height: ${2 * RING_BUTTON}px; margin: -${RING_BUTTON}px; padding: 7px; border: 1px solid hsl(var(--dge-hue) calc(55% * var(--dge-tone)) 60%); border-radius: 50%; background: var(--dge-icon-bg); --dge-icon-bg: hsl(var(--dge-hue) calc(70% * var(--dge-tone)) 96%); color: #536174; box-shadow: 0 1px 2px rgb(15 23 42 / 0.06), 0 3px 7px rgb(15 23 42 / 0.08); cursor: pointer; touch-action: none; }
    .dge-ring button:hover { --dge-icon-bg: #2563eb; color: #fff; border-color: #2563eb; box-shadow: 0 2px 4px rgb(15 23 42 / 0.08), 0 4px 10px rgb(15 23 42 / 0.1); }
    .dge-ring button:focus-visible { outline: 2px solid hsl(var(--dge-hue) calc(60% * var(--dge-tone)) 45%); outline-offset: 3px; }
    .dge-ring .dge-sectors { position: absolute; overflow: visible; fill: none; stroke-width: ${2 * RING_BUTTON + 12}px; stroke-linecap: round; pointer-events: none; }
    .dge-ring .dge-tie { stroke: #f59e0b; stroke-width: 2px; stroke-dasharray: 2 5; }
    .dge-ring button svg { display: block; width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.65; stroke-linecap: round; stroke-linejoin: round; }
    .dge-guide { opacity: 0.65; }
    .dge-result { color: #d14343; }
    .dge-accent { color: #1683e8; }
    .dge-ring button:hover .dge-result { color: inherit; }
    .dge-ring button:hover .dge-construction-icon, .dge-palette-grid button:not(.dge-off):hover .dge-construction-icon { --dge-icon-ink: #fff; --dge-icon-blue: #93c5fd; --dge-icon-red: #fca5a5; --dge-icon-guide: #bfdbfe; --dge-icon-polygon: #fed7aa; }
    .dge-complete, .dge-menu { position: fixed; min-width: 160px; max-height: 240px; overflow: auto; padding: 4px 0; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; box-shadow: 0 6px 20px rgb(0 0 0 / 0.14); z-index: 13; }
    .dge-complete div, .dge-menu div { padding: 3px 12px; font-family: var(--dge-code); font-size: 13px; cursor: pointer; }
    .dge-complete div.dge-selected, .dge-complete div:hover, .dge-menu div:hover { background: #2563eb; color: #fff; }
    .dge-complete:empty { display: none; }
    .dge-tools { position: fixed; max-height: calc(100vh - 16px); box-sizing: border-box; overflow: auto; padding: 4px; border: 1px solid #d1d5db; border-radius: 10px; background: #fff; box-shadow: 0 6px 20px rgb(0 0 0 / 0.14); z-index: 13; }
    .dge-tools button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 3px 10px 3px 3px; border: 0; border-radius: 8px; background: none; font: inherit; color: inherit; text-align: start; white-space: nowrap; cursor: pointer; }
    .dge-tools button:hover, .dge-tools button:focus-visible { background: hsl(var(--dge-hue) calc(70% * var(--dge-tone)) 93%); outline: none; }
    .dge-tool-icon { display: grid; place-items: center; flex-shrink: 0; width: 34px; height: 34px; box-sizing: border-box; border: 1px solid hsl(var(--dge-hue) calc(55% * var(--dge-tone)) 60%); border-radius: 50%; --dge-icon-bg: hsl(var(--dge-hue) calc(70% * var(--dge-tone)) 96%); background: var(--dge-icon-bg); color: #536174; }
    .dge-tool-icon svg { display: block; width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.65; stroke-linecap: round; stroke-linejoin: round; }
    .dge-bar-object.dge-bar-tool .dge-bar-name { max-width: 240px; }
    svg .dge-mark { opacity: 0.3 !important; pointer-events: none; stroke-linecap: round; stroke-linejoin: round; }
    svg .dge-mark-strong { opacity: 0.5 !important; }
    svg .dge-mark * { fill: none !important; stroke-opacity: 1 !important; stroke-dasharray: none !important; stroke-linecap: round !important; pointer-events: none !important; }
    svg .dge-mark :is(text, image, foreignObject, [style*="transparent"]) { display: none; }
    svg :is(.dge-hover, .dge-picked) > text { stroke: #bfdbfe; stroke-opacity: 1; stroke-width: 6px; stroke-linejoin: round; paint-order: stroke; }
    svg :is(.dge-hover, .dge-picked) > foreignObject > div { background: #dbeafe; border-radius: 4px; }
    svg :is(.dge-hover, .dge-picked) > image { filter: drop-shadow(0 0 3px #475569); }
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
    svg.dge-magnetizing [data-layer] > :not(.dge-source, .dge-target, .dge-zone, .dge-hover, .dge-side-marks) { opacity: 0.4; }
    svg .dge-zone { opacity: 0.07; pointer-events: none; }
    svg .dge-zone.dge-chosen { opacity: 0.16; }
    svg .dge-zone * { fill: none !important; stroke: #dc2626 !important; stroke-width: var(--dge-reach) !important; stroke-opacity: 1 !important; stroke-dasharray: none !important; stroke-linecap: round; stroke-linejoin: round; pointer-events: none !important; }
    svg .dge-zone text { display: none; }
    svg .dge-refused { opacity: 0.4; }
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
const filterButton = button("filter", () => filters.toggle());
const filters = listFilters(filterButton, {
    objects: () =>
        figureObjects(scene()).filter(
            (object) => !(object instanceof macro_object),
        ),
    chosen: () => chosen().map(({ object }) => object),
    hidden: (object) => looksHidden(object),
    name: (object) => formatName(object.name),
    changed: () => refreshRows(),
});
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
// The macros of the figure that take the object of the ring.
const ringMacrosMenu = $.create("div")
    .cls("dge-tools")
    .att("role", "menu")
    .hide();
// The ranks of the objects selected.
const badges = $.create("div").cls("dge-badges");
// The ranks of a macro's initials.
const ranks = $.create("div").cls("dge-badges");
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
// A field a line is typed in: a row, the line below them, or the
// definition the properties show as a line.
type LineField = HTMLInputElement | HTMLTextAreaElement;
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
const paletteButton = button("palette", () => setPalette(!paletteOpen))
    .addClass("dge-palette-button")
    .att("aria-controls", "dge-palette")
    .att("aria-expanded", "false");
// In the bar's place when it is full.
const linePaletteButton = button("palette", () => setPalette(!paletteOpen))
    .addClass("dge-palette-button")
    .att("aria-controls", "dge-palette")
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
const openBoxButton = button("open_box", () => void openApplication());
// The program of the macro being applied, on the initials designated, or
// of the application of the final selected, on its initials.
const programButton = button("macro_program", () => {
    if (applying)
        return showMacroProgram(scene(), appliedIndex(), applying.picked);
    const node = target()!.output!.node as macro_object;
    showMacroProgram(
        scene(),
        scene().macros.indexOf(node.macro),
        node.initials,
    );
});
// In place of the actions while the magnets are chosen, or a tool of the
// menu is in use: the way out.
const doneButton = $.create("button")
    .cls("dge-done")
    .att("type", "button")
    .text(message("done"));
doneButton.on("click", () =>
    armed ? cancel() : applying ? stopApply() : stopMagnets(),
);
// The figure framed for a web page, from its published file.
const framing = framingBar(
    scene,
    () => new URL(published!.url, location.href).href,
    showHint,
    () => framing.stop(),
);
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
        openBoxButton,
        programButton,
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
explain(openBoxButton, () => {
    const c = scene();
    const final = target()!;
    const box = boxOf(c, final.output!.node as macro_object);
    const line = lineOf(final, figureIndex(c), figureObjects(c));
    return box
        ? `${line}\n${message("open_box_hint", String(box.objects.length))}`
        : `${line}\n${message("open_box_point")}`;
});
openBoxButton.on("pointerenter", previewBox, false);
openBoxButton.on("pointerleave", clearPreview, false);
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
    line: (object) => {
        const c = scene();
        const index = figureIndex(c);
        return entryOf(object, index)[0] === "Pt"
            ? null
            : lineOf(object, index, figureObjects(c));
    },
    enter: async (object, line) => {
        await enterLine(line, object);
    },
    condition: (objects, source) => {
        setConditions(scene(), objects, source);
        changed();
    },
    bind: (editor, head, apply) => {
        const area = editor.dom() as HTMLTextAreaElement;
        definitionLine = { area, head, apply };
        bindField(editor);
        editor.on(
            "focus",
            () => {
                stopMagnets();
                if (armed) cancel();
                updateCompletion(area);
            },
            false,
        );
        editor.on(
            "keydown",
            (event) => {
                if (completions.length && navigate(event, area))
                    event.stopPropagation();
            },
            false,
        );
    },
    figure: (patch) => {
        recording = recording
            .then(() => reframe({}, undefined, patch))
            .catch(failed);
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
// The tool of the menu, or the macro being applied.
const inHand = (entry: Entry): boolean =>
    "tools" in entry ? armed === entry : applying?.name === entry.name;
const palette = toolPalette({
    vec3: () => vec3(),
    macros: () => scene().macros,
    supplied: standalone ? () => supplied : null,
    newProgram: button("new_program", () => {
        setProperties(true);
        properties.create(nextName(scene(), false));
    }).removeClass("dge-action"),
    takes: (entry, library) =>
        "tools" in entry
            ? !!takes(entry)
            : beginsMacro(
                  entry,
                  chosen().map(({ object }) => object),
                  library?.macros,
              ),
    inHand,
    choose: (entry) => {
        if (inHand(entry)) return cancel();
        if ("tools" in entry) return arm(entry);
        const objects = chosen().map(({ object }) => object);
        const library = scene().macros.includes(entry)
            ? null
            : libraries().find(({ macros }) =>
                  macros.some(({ name }) => name === entry.name),
              )!;
        if (library) void applyFrom(library, entry.name);
        else cancel();
        if (window.matchMedia("(max-width: 600px)").matches) setPalette(false);
        if (!library) startApply(scene().macros.indexOf(entry), objects);
    },
    hover: (entry, library) => {
        if (!entry || "tools" in entry) return hoverItem(entry);
        clearPreview();
        showHint(startHint(entry, library?.macros));
    },
    close: () => {
        setPalette(false);
        (paletteButton.dom() as HTMLButtonElement).focus();
    },
});
// The macros shipped with DocGeo, and the user's own, out of a frame only
// (see MACROS.md, « Bibliothèque »).
let supplied = emptyLibrary();
if (standalone)
    void suppliedLibrary().then((library) => {
        supplied = library;
        if (paletteOpen) palette.refresh();
    });

// A macro being defined (see MACROS.md).
const macros = macroPanel({
    scene,
    show: showMacro,
    hint: (text) => showHint(text),
    saved: () => changed(),
    close: () => stopMacro(),
});

properties.panel.dom().toggleAttribute("inert", true);
palette.panel.dom().toggleAttribute("inert", true);
const fileInput = $.create("input")
    .att("type", "file")
    .att("accept", ".dgo,.dgp,.ggb");
const pageInput = $.create("input")
    .att("type", "file")
    .att("accept", ".dgo,.dgp,.ggb")
    .att("multiple", "");
const chooseFigure = () =>
    chooseFile(fileInput.dom() as HTMLInputElement, openChosen);
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
        items: () => [
            {
                label: message("new_figure"),
                shortcut: installed ? shortcut("N") : undefined,
                run: askNewFigure,
            },
            {
                label: message("new_page"),
                shortcut: installed ? shortcut("T") : undefined,
                run: () => void addPage(),
            },
            {
                label: message("delete_page"),
                run: () => void deletePage(),
                enabled: () => !!book,
            },
            {
                label: `${message("open")}…`,
                shortcut: shortcut("O"),
                run: chooseFigure,
            },
            {
                label: `${message("open_in_tab")}…`,
                run: () =>
                    chooseFile(
                        pageInput.dom() as HTMLInputElement,
                        (files) => void openInTabs(files),
                    ),
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
            {
                label: message("save_page_as"),
                run: () => void savePage(),
                enabled: () => !!book,
            },
            null,
            {
                label: `${message("embed_page")}…`,
                run: () => void embedInPage(),
            },
            ...(canInstall()
                ? [null, { label: `${message("install_app")}…`, run: install }]
                : []),
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
            toggle("palette", paletteButton),
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
    { label: message("menu_macros"), items: macrosMenu },
    applicationToolsMenu(press(helpLink)),
];
if (standalone) $("body").addClass("dge-menus");
$("body").add(
    panel.add(
        $.create("div")
            .cls("dge-panel-header")
            .add(
                $.create("h2").add(
                    $.create("span").text(message("construction")),
                    count,
                ),
                valuesButton,
                stepsButton,
                filterButton,
                button("close_history", () => {
                    setPanel(false);
                    (historyButton.dom() as HTMLButtonElement).focus();
                }),
            ),
        filters.chips,
        $.create("div")
            .cls("dge-entry")
            .add(
                $.create("div").cls("dge-line").add(input, linePaletteButton),
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
                    paletteButton,
                    propertiesButton,
                    historyButton,
                ),
            $.create("div")
                .cls("dge-bar-middle")
                .add(actions, framing.elements[0]),
            $.create("div")
                .cls("dge-bar-group dge-bar-end")
                .add(undoButton, redoButton, helpLink),
        ),
    ...(standalone ? menuBar(menus, ...(native ? [fileLabel] : [])) : []),
    framing.elements[1],
    properties.panel,
    resizeHandle(properties.panel, "right", () =>
        document.body.classList.contains("dge-properties-wide")
            ? "--dge-properties-wide-user"
            : "--dge-properties-user",
    ),
    macros.panel,
    resizeHandle(macros.panel, "right", () => "--dge-properties-user"),
    palette.panel,
    resizeHandle(palette.panel, "right", () => "--dge-properties-user"),
    hint,
    ring,
    complete,
    choice,
    menu,
    ringMacrosMenu,
    filters.menu,
    badges,
    ranks,
    magnetCard,
    turtle.element,
    spring,
    nameBox,
);
function setPanel(on: boolean, animate = true): void {
    if (on && window.innerWidth <= 900) {
        if (propertiesOpen) setProperties(false);
        if (paletteOpen) setPalette(false);
    }
    if (!on) {
        setSteps(false);
        editing()?.blur();
        closeCompletion();
        clearPreview();
        showRefused([]);
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
        if (paletteOpen) setPalette(false);
        stopMacro();
        stopApply();
        const objects = selection.length
            ? selection.map(({ object }) => object)
            : target();
        setEraser(false);
        cancel(true);
        editing()?.blur();
        closeCompletion();
        showRefused([]);
        highlight();
        if (window.innerWidth <= 900) setPanel(false);
        properties.refresh();
        properties.select(objects ?? properties.selection);
    }
    showPropertiesPanel(on);
    if (!on && overPalette) {
        overPalette = false;
        setPalette(true);
    }
}
function showPropertiesPanel(on: boolean): void {
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
// A right click shows what it points at, the figure's settings elsewhere, at
// any time: a tool in hand keeps its arguments. Only a macro's definition,
// which has the panel's place and would be lost, keeps it.
function inspect(object: construction_object | null): void {
    if (macros.active) return;
    const group = propertiesOpen
        ? properties.selection
        : selection.map(({ object }) => object);
    const objects = object && group.includes(object) ? group : object;
    setEraser(false);
    setSteps(false);
    stopMagnets();
    closeRing();
    clearSelection();
    if (!propertiesOpen) {
        editing()?.blur();
        closeCompletion();
        if (window.innerWidth <= 900) setPanel(false);
        overPalette = paletteOpen;
        if (paletteOpen) setPalette(false, false);
        properties.refresh();
    }
    if (objects) properties.select(objects);
    else properties.figure();
    showPropertiesPanel(true);
}
// In the properties' place, the figure kept for building, the tool in
// hand too.
function setPalette(on: boolean, remember = true): void {
    if (on) {
        overPalette = false;
        if (propertiesOpen) setProperties(false);
        stopMacro();
        if (window.innerWidth <= 900) setPanel(false);
        // Its object stays chosen.
        ring.hide().inner("");
        ringMacrosMenu.hide().inner("");
    }
    paletteOpen = on;
    palette.panel.dom().toggleAttribute("inert", !on);
    $("body")
        .addClass("dge-panel-animated")
        .toggleClass("dge-palette-open", on);
    [paletteButton, linePaletteButton].forEach((button) =>
        button.toggleClass("dge-on", on).att("aria-expanded", String(on)),
    );
    if (on) palette.refresh();
    if (!remember) return;
    try {
        localStorage.setItem(PALETTE_STORAGE, String(on));
    } catch {
        // Storage refused: keep the state for this page.
    }
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
// A tool waiting for its arguments, and the objects selected before it,
// which aren't kept.
let pending: {
    tool: Tool;
    args: (Arg | undefined)[];
    prefixed?: construction_object[];
} | null = null;
// The arguments of the tool of the menu designated with Shift, or kept from
// the hint, by their places: it takes them again after each object, until
// it is left.
let kept: { tool: Tool; objects: Map<number, construction_object> } | null =
    null;
// Whether the figure's designation is made with Shift.
let keeping = false;
// What the next argument would build, followed by the pointer.
let preview: {
    // A tool hovered in the menu or the palette, built from the selection.
    candidate: construction_object | "pointer" | "floor" | "tool";
    objects: construction_object[];
    pointer?: point_object;
    standIns: point_object[];
} | null = null;
let hovered: construction_object[] = [];
let refused: construction_object[] = [];
// The definition the properties show as a line, after its head.
let definitionLine: {
    area: HTMLTextAreaElement;
    head: string;
    apply: () => void;
} | null = null;
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
let paletteOpen = false;
// The panel a right click put in the palette's place, which closing it gives
// back.
let overPalette = false;
const PALETTE_STORAGE = "docgeo-palette-open";
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
const editing = (): LineField | null => {
    const active = document.activeElement;
    return (active instanceof HTMLInputElement &&
        panel.dom().contains(active)) ||
        active === definitionLine?.area
        ? (active as LineField)
        : null;
};
// The line typed in a field, up to the caret.
const typedBefore = (field: LineField): string =>
    (field === definitionLine?.area ? definitionLine.head : "") +
    field.value.slice(0, field.selectionStart!);
const vec3 = () => !scene().GRID.is2D;
const pick = (
    c: construction,
    screen: Vec2,
    ignored?: ReadonlySet<construction_object>,
): Hit[] =>
    pickObjects(
        c,
        screen,
        ignored,
        PICK_RADIUS,
        !inspecting() && !ghosts && !stepping,
    );

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
    object.dom
        ?.toggleClass("dge-property-selected", on)
        .toggleClass("dge-framed", on && object instanceof panel_object);
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

function propertyObject(
    event: Pick<PointerEvent, "target" | "clientX" | "clientY">,
): construction_object | null {
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

function showHint(
    text: string,
    error = false,
    buttons: DOMElement[] = [],
): void {
    hint.text(text)
        .toggleClass("dge-error", error)
        .add(...buttons);
    if (pending) hint.add(cancelButton);
    if (
        applying &&
        text &&
        designated().next.some(([type]) => type === "number")
    ) {
        (numberField.dom() as HTMLInputElement).value = "";
        hint.add(numberField.removeClass("dge-error"));
    }
    if (applying && text) {
        const { picked, reached, kept } = applying;
        if (reached > kept)
            hint.add(
                keepInitial.text(
                    message("keep_arg", initialName(picked[reached - 1])),
                ),
            );
        const fixed = picked[changedRank()];
        if (fixed !== undefined)
            hint.add(
                changeFixed.text(
                    message("macro_fixed_change", initialName(fixed)),
                ),
            );
    }
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

// The applications of macros whose finals have their own rows, by the name
// of their node.
const unfolded = new Set<string>();

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
    filters.prepare(objects);
    objects.forEach((object) => {
        if (ignored.has(object) || object instanceof macro_object) return;
        const node = object.output?.node;
        // An application of a macro with several finals shows as one row,
        // which unfolds into theirs.
        if (!node || node.children.length < 2)
            return addRow(object, index, objects);
        const finals = node.children;
        const open = unfolded.has(node.name);
        if (
            object ===
            finals.reduce((first, final) =>
                index.get(final)! < index.get(first)! ? final : first,
            )
        ) {
            const { row, item } = addRow(object, index, objects, finals);
            item.add(
                button(open ? "fold_finals" : "unfold_finals", () => {
                    if (open) unfolded.delete(node.name);
                    else unfolded.add(node.name);
                    refreshRows();
                })
                    .addClass("dge-fold")
                    .toggleClass("dge-on", open)
                    .att("aria-expanded", String(open)),
            );
            if (!open)
                finals.forEach((final) => {
                    rows.set(final, row);
                    items.set(final, item);
                });
        }
        if (open) addRow(object, index, objects, [], true);
    });
    count.text(
        !rows.size
            ? ""
            : filters.active()
              ? `${[...rows.keys()].filter((object) => filters.passes([object])).length} / ${rows.size}`
              : String(rows.size),
    );
    macros.refresh();
    if (paletteOpen) palette.refresh();
    if (applying) showApply();
    shine(propertiesOpen);
    markTaken();
    if (stepping) markSteps();
    undoButton.dom().toggleAttribute("disabled", position <= 0);
    redoButton
        .dom()
        .toggleAttribute("disabled", position >= history.length - 1);
}

// The object's row, or, given `finals`, that of their application, or, if
// `final`, that of one of them, which only names it.
function addRow(
    object: construction_object,
    index: ReadonlyMap<construction_object, number>,
    objects: construction_object[],
    finals: construction_object[] = [],
    final = false,
): { row: DOMElement; item: DOMElement } {
    const line = final ? null : lineOf(object, index, objects);
    const row = $.create("input")
        .cls("dge-row")
        .att("spellcheck", "false")
        .toggleClass("dge-hidden", looksHidden(object));
    (row.dom() as HTMLInputElement).value = final
        ? formatName(object.name)
        : (line ??
          (object instanceof event_object
              ? message(
                    EVENT_TEXTS[object.gesture ?? "change"],
                    formatName(object.owner.name),
                )
              : `${formatName(object.name)} = …`));
    if (final) row.att("readonly", "");
    else if (line === null)
        row.att("readonly", "").att("title", message("read_only"));
    else bindRow(row, object);
    const text = $.create("div").cls("dge-text").add(row);
    // With a tool, the row designates its object instead of being
    // edited.
    text.on(
        "pointerdown",
        (event) => {
            if (event.button === 2) {
                event.preventDefault();
                if (object instanceof event_object && !macros.active)
                    properties.showBlocks();
                return inspect(object);
            }
            if (macros.active) {
                event.preventDefault();
                return macros.tap(object);
            }
            if (applying) {
                event.preventDefault();
                if (takesNext(designated(), object))
                    pickInitial(object, event.shiftKey);
                return;
            }
            const program = object instanceof event_object;
            if (!pending && !propertiesOpen && !program) return;
            event.preventDefault();
            keeping = event.shiftKey;
            if (pending) {
                if (rowTakes(object)) designateRow(object);
            } else if (program) showProgram(object);
            else showProperties(event, object);
        },
        false,
    );
    if (valuesShown && !finals.length) {
        const value = $.create("div")
            .cls("dge-value")
            .text(valueText(object, line, vec3()));
        values.set(object, value);
        text.add(value);
    }
    const shown = finals.length ? finals : [object];
    const item = $.create("div")
        .cls("dge-item")
        .toggleClass("dge-sub", final)
        .toggleClass("dge-filtered", !filters.passes(shown))
        .add(visibilityToggle(shown), text);
    if (line !== null && entryOf(object, index)[0] !== "Pt")
        item.add(
            button("edit_definition", () => {
                if (!propertiesOpen) setProperties(true);
                properties.edit(object);
            }).addClass("dge-label"),
        );
    item.add(
        button("delete", () => remove(shown))
            .addClass("dge-label")
            .addClass("dge-delete"),
    );
    if (!finals.length && hasName(object)) item.add(nameToggle(object));
    item.on("mouseenter", () => highlight(...shown), false);
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
    if (!finals.length) {
        rows.set(object, row);
        items.set(object, item);
    }
    rowsBox.add(item);
    return { row, item };
}

// As in GeoGebra's algebra view, a dot of the objects' colour, full when
// one shows, which shows or hides them all. Super-hidden objects, which
// nobody ever saw, stay so. A point's dot has its shape and colours, faded
// when hidden, since a cross or a white point can't be emptied.
function visibilityToggle(objects: construction_object[]): DOMElement {
    const [first] = objects;
    const dot = $.create("button")
        .cls("dge-dot")
        .att("type", "button")
        .stl("--dge-color", first.stroke_color);
    if (first instanceof point_object)
        dot.att("data-shape", first.shape).stl(
            "--dge-fill",
            first.opacity
                ? `color-mix(in srgb, ${first.fill_color} ${first.opacity * 100}%, transparent)`
                : first.auto_fill_color,
        );
    const seen = objects.filter((object) => object.hidden !== 2);
    if (!seen.length) return dot.att("disabled", "");
    const shown = seen.some((object) => !looksHidden(object));
    dot.att("aria-pressed", String(shown))
        .att("aria-label", message("visible"))
        .att("title", message(shown ? "hide_object" : "show_object"))
        .on("click", () => {
            seen.forEach((object) => {
                if (looksHidden(object) === shown) return;
                if (ghosts) toggleGhost(ghosts, object);
                else {
                    object.hidden = shown ? 1 : 0;
                    object.updateView();
                }
            });
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
    bindField(row);
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

// Completed as typed, lighting the objects an argument accepts.
function bindField(row: DOMElement): void {
    const field = row.dom() as LineField;
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
            showRefused([]);
        },
        false,
    );
}

async function commitText(
    field: LineField,
    object: construction_object | null,
    as: Choice = choosing?.field === field ? choosing.lit : "expression",
): Promise<void> {
    try {
        if ((await enterLine(field.value, object, as)) && field === input.dom())
            field.value = "";
    } catch (error) {
        if (!(error instanceof TextError)) throw error;
        $(field).addClass("dge-error");
        showHint(message(error.key as MessageKey, error.detail), true);
    }
}

// Whether the line adds an object. Throws a TextError where it's wrong, the
// figure as it was.
async function enterLine(
    text: string,
    object: construction_object | null,
    as: Choice = "expression",
): Promise<boolean> {
    const c = scene();
    closeCompletion();
    hideChoice();
    // The sliders of the names the line reads that no object has.
    const sliders: construction_object[] = [];
    let borrowed = false;
    try {
        const line = parseLine(text, isCall);
        // A library's macro, copied into the figure to be applied.
        const call =
            line.definition?.kind === "call"
                ? libraryMacro(line.definition.command)
                : null;
        if (call) {
            c.macros = merge(
                figureLibrary(),
                call.library,
                [call.macro.name],
                false,
            ).library.macros;
            borrowed = true;
        }
        const target =
            object ?? (line.name ? (c.getObj(line.name) ?? null) : null);
        // A macro applied, or its application redefined.
        const spec = resolveMacro(c, line);
        if (spec) {
            const node = (target?.output?.node ??
                line.names
                    ?.map((name) => c.getObj(name)?.output?.node)
                    .find(Boolean)) as macro_object | undefined;
            // The image of an object by a macro that maps points.
            const image =
                target && !node && entryOf(target, figureIndex(c))[0] === "Mac"
                    ? target
                    : undefined;
            if (target && !node && !image)
                throw new TextError("macro_taken", formatName(target.name));
            const made = await applyMacroLine(studio, spec, node, image);
            done(made[0]);
            return !node && !image;
        }
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
            done();
            return false;
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
                done(target);
                return false;
            }
            await redefine(studio, target, spec);
            const result = made(scene().getObj(spec.name));
            // The figure was built again.
            if (spec.shown)
                showOnly(
                    result as expression_object,
                    spec.shown.map(({ name }) => scene().getObj(name)!),
                );
            if (await refusedOffPlane()) throw new TextError("off_plane");
            done(result);
            return false;
        }
        const built = resolveWithSliders(c, line, undefined, sliders);
        const result = made(add(c, built));
        if (built.shown) showOnly(result as expression_object, built.shown);
        if (await refusedOffPlane()) throw new TextError("off_plane");
        if (result instanceof button_object) showProgram(result);
        done(result);
        return true;
    } catch (error) {
        if (
            error instanceof TextError &&
            (sliders.length || borrowed) &&
            error.key !== "off_plane"
        )
            await reframe({}, history[position]);
        throw error;
    }
}

// A command, or one of the figure's macros, or of a library.
const isCall = (name: string): boolean =>
    isCommand(name) ||
    macroIndex(scene(), name) >= 0 ||
    libraryMacro(name) !== null;

// The libraries a line may apply a macro of, out of a frame: the one
// shipped, then mine.
const libraries = (): Library[] => (standalone ? [supplied, myMacros()] : []);

// The macro of a library of this name, unless a command or the figure's
// has it.
function libraryMacro(name: string): { library: Library; macro: Macro } | null {
    if (isCommand(name) || macroIndex(scene(), name) >= 0) return null;
    for (const library of libraries()) {
        const macro = library.macros.find((other) => other.name === name);
        if (macro) return { library, macro };
    }
    return null;
}

const calls = (commands: Command[]) =>
    commands.map((command) => ({
        label: `${commandName(command)}( )`,
        insert: `${commandName(command)}(`,
    }));

// What the caret is in: the commands, the objects an argument accepts, or
// in a formula, its functions and the objects it reads.
function updateCompletion(field: LineField): void {
    clearPreview();
    const context = completionAt(typedBefore(field));
    const call =
        context?.kind === "argument" ? findCommand(context.command) : undefined;
    const macro =
        context?.kind === "argument"
            ? (scene().macros[macroIndex(scene(), context.command)] ??
              libraryMacro(context.command)?.macro)
            : undefined;
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
    } else if (macro)
        candidates = figureObjects(scene()).filter((object) =>
            takesAt(macro, (context as ArgumentCompletion).position, object),
        );
    else if (context && (context.kind !== "command" || context.formula))
        candidates = figureObjects(scene()).filter(readable);
    completions =
        call || macro || prefix
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
            completions.push(
                ...calls(
                    commandsStarting(prefix).filter(
                        (command) => !command.reference,
                    ),
                ),
                ...[
                    ...new Set(
                        [scene(), ...libraries()].flatMap(({ macros }) =>
                            macros.map(({ name }) => name),
                        ),
                    ),
                ]
                    .filter((name) =>
                        name.toLowerCase().startsWith(prefix.toLowerCase()),
                    )
                    .map((name) => ({
                        label: `${formatName(name)}( )`,
                        insert: `${formatName(name)}(`,
                    })),
            );
        if (
            call &&
            overloadsAt(context as ArgumentCompletion).some((overload) =>
                [
                    "segment",
                    "line",
                    "linear",
                    "plane",
                    "planar",
                    "path",
                    "support",
                    "outline",
                    "intersectable",
                ].includes(
                    paramAt(
                        overload,
                        (context as ArgumentCompletion).position,
                    )!,
                ),
            )
        )
            completions.push(
                ...calls(
                    commandsStarting(prefix).filter(
                        (command) => command.reference,
                    ),
                ),
            );
        if (functions)
            completions.push(...calls(commandsStarting(prefix, FUNCTIONS)));
    }
    // A slot that takes a number takes a formula: nothing to point at.
    const accepted = new Set(candidates);
    showRefused(
        macro || (call && !functions)
            ? figureObjects(scene()).filter((object) => !accepted.has(object))
            : [],
    );
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
function offerChoice(field: LineField): void {
    hideChoice();
    if (!(field instanceof HTMLInputElement)) return;
    let line: Line;
    try {
        line = parseLine(field.value, isCall);
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
            const line = parseLine(field.value, isCall);
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

function showCompletion(field: LineField): void {
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
    if (field instanceof HTMLInputElement)
        return void complete
            .stl("left", `${box.left + 14}px`)
            .stl("top", `${box.bottom}px`);
    // Below the caret, found in a copy of the area's text up to it, laid
    // out as the area lays it.
    const style = getComputedStyle(field);
    const caret = $.create("span").text("\u200b");
    const copy = $.create("div")
        .text(field.value.slice(0, field.selectionStart!))
        .add(caret);
    const mirror = copy.dom() as HTMLElement;
    for (const property of [
        "font",
        "padding",
        "border",
        "boxSizing",
        "whiteSpace",
        "overflowWrap",
        "tabSize",
    ] as const)
        mirror.style[property] = style[property];
    copy.stl("position", "fixed")
        .stl("left", `${box.left}px`)
        .stl("top", `${box.top}px`)
        .stl("width", `${field.clientWidth + 2 * field.clientLeft}px`)
        .stl("visibility", "hidden");
    $("body").add(copy);
    const at = caret.dom().getBoundingClientRect();
    copy.remove();
    const width = (complete.dom() as HTMLElement).offsetWidth;
    complete
        .stl(
            "left",
            `${Math.max(Math.min(at.left - field.scrollLeft, window.innerWidth - width - 4), 0)}px`,
        )
        .stl("top", `${at.bottom - field.scrollTop}px`);
}

function closeCompletion(): void {
    completions = [];
    complete.inner("");
}

// Arrows choose a completion, Tab or Enter insert it.
function navigate(event: KeyboardEvent, field: LineField): boolean {
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

function insertCompletion(field: LineField, index: number): void {
    const { insert, object } = completions[index];
    if (object) return designateTyped(field, object, true);
    insertWord(field, insert);
    updateCompletion(field);
}

function completedArgument(arg: ArgText | undefined): Arg | undefined {
    if (!arg) return undefined;
    try {
        return resolveArgument(scene(), arg);
    } catch (error) {
        if (error instanceof TextError) return undefined;
        throw error;
    }
}

// The overloads of the command typed that take the arguments before the
// caret and one more, an unknown name taking anything.
function overloadsAt(context: ArgumentCompletion): Overload[] {
    return (findCommand(context.command)?.overloads ?? []).filter(
        (overload) =>
            paramAt(overload, context.position) &&
            context.args.every((arg, position) => {
                const value = completedArgument(arg);
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
    field: LineField,
    object: construction_object,
    replace = false,
): void {
    if (insertArgument(field, object, replace)) {
        if (field === definitionLine?.area) definitionLine.apply();
        else
            void commitText(
                field,
                [...rows].find(([, row]) => row.dom() === field)?.[0] ?? null,
            );
    }
    updateCompletion(field);
}

// Whether it closed the line.
function insertArgument(
    field: LineField,
    object: construction_object,
    replace: boolean,
): boolean {
    const caret = field.selectionStart!;
    const before = field.value.slice(0, caret);
    const context = completionAt(typedBefore(field));
    if (context?.kind !== "argument" || field.value.slice(caret).trim()) {
        insertWord(field, formatArg(object), replace);
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
        replaceText(field, before.lastIndexOf(","), field.value.length, ")");
        return true;
    }
    const more = overloads.map(
        (overload) => paramAt(overload, position + 1) !== null,
    );
    const closes = more.length > 0 && !more.some(Boolean);
    insertWord(
        field,
        formatArg(object) +
            (more.length && more.every(Boolean) ? ", " : closes ? ")" : ""),
        replace,
    );
    return closes && !findCommand(context.command)!.formula;
}

// The line typed, ending in an argument, as a tool waiting for it: the
// arguments before it, and the overloads that take them.
function typedCall(
    field: LineField,
): { args: Arg[]; overloads: Overload[] } | null {
    const context = completionAt(typedBefore(field));
    if (
        context?.kind !== "argument" ||
        field.value.slice(field.selectionStart!).trim()
    )
        return null;
    const args = Array.from({ length: context.position }, (_, position) => {
        const arg = context.args[position];
        return completedArgument(arg);
    });
    if (args.includes(undefined)) return null;
    return {
        args: args as Arg[],
        overloads: overloadsAt(context).filter(
            ({ tag }) => !otherView(tag, vec3()),
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
const expectsPoint = (field: LineField, call: ReturnType<typeof typedCall>) =>
    field === input.dom() &&
    !!call?.overloads.some(
        (overload) => paramAt(overload, call.args.length) === "point",
    );

// In place of the word typed at the caret, unless, not to `replace` it, it
// already names an object: the word only completes a name being typed.
function insertWord(field: LineField, word: string, replace = true): void {
    const caret = field.selectionStart!;
    const before = field.value.slice(0, caret);
    const typed = /[\p{L}_$][\p{L}\p{M}\p{N}_$']*$/u.exec(before)?.[0] ?? "";
    const start =
        before.length - (replace || !scene().getObj(typed) ? typed.length : 0);
    replaceText(field, start, field.selectionEnd!, word);
}

// The area's, as typed, to be undone so.
function replaceText(
    field: LineField,
    start: number,
    end: number,
    text: string,
): void {
    if (field instanceof HTMLTextAreaElement) {
        field.focus();
        field.setSelectionRange(start, end);
        document.execCommand("insertText", false, text);
    } else {
        field.setRangeText(text, start, end, "end");
        field.focus();
    }
    $(field).removeClass("dge-error");
}

// ************************** FIGURE ******************************

let sideMarks: DOMElement | null = null;

function markSides(): void {
    const c = scene();
    if (!c.svg.dom().contains(sideMarks?.dom() ?? null)) {
        sideMarks?.dispose();
        sideMarks = c.svg
            .shape("g")
            .att("class", "dge-side-marks")
            .stl("pointer-events:none");
        c.svg.add(sideMarks);
    }
    sideMarks!.inner("");
    const sides = new Set([
        ...hovered,
        ...selection.map(({ object }) => object),
    ]);
    sides.forEach((object) => {
        if (
            !object.reference ||
            object.reference.kind === "vertex" ||
            !object.defined ||
            !object.reference.owner.isVisible
        )
            return;
        const strong = selection.some((picked) => picked.object === object);
        if (object.reference.kind === "face") {
            object.reference.owner.dom.dom().after(sideMarks!.dom());
            sideMarks!.add(
                c.svg
                    .shape("path")
                    .att(
                        "d",
                        pathData(
                            (object as polygon_object).points.map(
                                ({ screen }) => screen,
                            ),
                        ),
                    )
                    .att(
                        "class",
                        strong ? "dge-mark dge-mark-strong" : "dge-mark",
                    )
                    .stl("fill", object.reference.owner.stroke_color),
            );
            return;
        }
        const side = object as segment_object;
        const [a, b] = [side.P1.screen, side.P2.screen];
        // Under its polygon and so under its ends, which it would tint.
        object.reference.owner.dom.dom().before(sideMarks!.dom());
        sideMarks!.add(
            c.svg
                .shape("path")
                .att("d", `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`)
                .att("class", strong ? "dge-mark dge-mark-strong" : "dge-mark")
                .att("stroke", object.reference.owner.stroke_color)
                .att(
                    "stroke-width",
                    Math.max(2, object.reference.owner.size) +
                        (strong ? MARK_WIDER.selected : MARK_WIDER.hovered),
                ),
        );
    });
}

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
    markSides();
    objects.forEach((object) => {
        if (object.hasView) object.dom.addClass("dge-hover");
        rows.get(object)?.addClass("dge-hover");
    });
}

function showRefused(objects: construction_object[]): void {
    refused.forEach((object) => {
        if (object.hasView) object.dom.removeClass("dge-refused");
    });
    refused = objects;
    objects.forEach((object) => {
        if (object.hasView) object.dom.addClass("dge-refused");
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
            return mode === "command"
                ? makesPoint(hits)
                : mode === "point"
                  ? !!pending.tool.anywhere
                  : mode !== "button" && mode !== "control";
        return (
            mode === "command" &&
            makesPoints(overload) &&
            pointNext(paramAt(overload, nextSlot())!, hits)
        );
    }
    const field = editing();
    if (!field)
        return !propertiesOpen && !paletteOpen && !ghosts && !magnetizing;
    const call = typedCall(field);
    return (
        expectsPoint(field, call) &&
        !hits.some(({ object }) => taking(call!, object))
    );
}

type Built = { overload: Overload; args: Arg[] };

// Numbered, unless of two lines.
function intersection(
    a: construction_object,
    b: construction_object,
    order: number,
): Built {
    const once =
        (accepts(a, "line") && accepts(b, "line")) ||
        accepts(a, "plane") ||
        accepts(b, "plane");
    const args = [a, b, order + 1].slice(0, once ? 2 : 3);
    return {
        overload: overloadFor(findCommand("Intersection")!, args, vec3())!,
        args,
    };
}

// All their points, as GeoGebra's tool makes them: one of two lines or a
// line and a plane, two of a line or a circle and a line, a circle, a conic
// or a surface, those found now, up to four, of conics or curves.
function intersections(a: construction_object, b: construction_object) {
    const both = [a, b];
    const count = both.every(
        (object) => accepts(object, "line") || accepts(object, "plane"),
    )
        ? 1
        : !both.some((object) => accepts(object, "graph")) &&
            (both.some((object) => accepts(object, "line")) ||
                both.every((object) => accepts(object, "circle")))
          ? 2
          : Math.max(1, meetings(scene(), a, b));
    return Array.from({ length: count }, (_, order) =>
        intersection(a, b, order),
    );
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
    const args = emptyArgs(tool);
    args[tool.overload.params.findIndex((param) => accepts(object, param))] =
        object;
    return giveNumber(tool, args);
}

// The number the tool gives, in its place.
function giveNumber(
    { overload }: Tool,
    args: (Arg | undefined)[],
): (Arg | undefined)[] {
    const given = overload.params.findIndex(
        (param) => param === "real" || param === "number",
    );
    if (given >= 0) args[given] = defaultReal(overload.tag);
    return args;
}

// The line the tool writes, its missing arguments elided, and what remains
// to designate.
function describe(tool: Tool, args: (Arg | undefined)[]): string {
    if (tool.mode === "macro") return message("macro_step_initials");
    if (tool.mode === "macros") return message("family_macros");
    if (tool.mode === "turtle")
        return `${message("turtle")}\n${message("designate_point")}`;
    if (tool.mode === "event")
        return `${message(tool.label!)}\n${message(tool.gesture ? "designate_moveable" : "designate_expression")}`;
    if (tool.mode === "control")
        return `${commandName(tool.command)}\n${message(tool.command.name === "Checkbox" ? "designate_checkbox" : "designate_control")}`;
    if (tool.mode === "button")
        return `${formatName(nextName(scene(), "Btn"))} = ${commandName(tool.command)}(${quoteText(message("button_caption"))})\n${message("designate_button")}`;
    const kind = tool.mode !== "command" || builtTag(tool.overload, args);
    const shown = args.map((arg) => (arg === undefined ? "…" : formatArg(arg)));
    if (tool.mode !== "command" || tool.overload.variadic) shown.push("…");
    const line = `${formatName(nextName(scene(), kind))} = ${commandName(tool.command)}(${shown.join(", ")})`;
    if (tool.mode === "point")
        return args.length
            ? line
            : `${line}\n${message(tool.anywhere ? "designate_place" : "designate_support")}`;
    if (tool.mode === "intersection") {
        // A surface or a plane meets a line only.
        const first = args[0] as construction_object | undefined;
        const key =
            first && (accepts(first, "surface") || accepts(first, "plane"))
                ? "designate_line"
                : vec3() && (!first || accepts(first, "line"))
                  ? "designate_crossable"
                  : "designate_intersectable";
        return `${line}\n${message(key)}`;
    }
    if (tool.overload.variadic && args.length >= 3)
        return `${line}\n${message("polygon_end")}`;
    if (!tool.overload.variadic && !args.includes(undefined)) return line;
    // No tool takes a text.
    const param = paramAt(tool.overload, nextSlot({ tool, args })) as Exclude<
        Param,
        "text" | "any"
    >;
    return `${line}\n${message(`designate_${param}`)}`;
}

function prompt(): void {
    showHint(
        pending ? describe(pending.tool, pending.args) : "",
        false,
        pending ? keepButtons() : [],
    );
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
        return (
            object !== args[0] && meet(args[0] as construction_object, object)
        );
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

// Hovered in the menu or the palette, the item's line and what it would
// build; left, the hint again.
function hoverItem(item: Item | null): void {
    if (item) {
        showHint(itemHint(item));
        return previewItem(item);
    }
    clearPreview();
    if (pending) prompt();
    else showHint(restingHint());
}

// The line the item writes, from the objects chosen if it takes them.
function itemHint(item: Item): string {
    const objects = chosen().map(({ object }) => object);
    const tool = takes(item);
    const shown = tool || item.tools.find((tool) => usable(tool, vec3()))!;
    return describe(
        shown,
        tool && objects[0]
            ? assign(tool, objects, defaultReal(tool.overload.tag))!
            : emptyArgs(shown),
    );
}

// No keyboard comes up: the arguments are designated in the figure, which
// a narrow window shows whole.
function arm(item: Item): void {
    const picked = chosen();
    cancel();
    if (item.tools[0].mode === "macro") return startMacro(picked);
    armed = item;
    if (window.matchMedia("(max-width: 600px)").matches) {
        setPanel(false);
        if (propertiesOpen) setProperties(false);
        if (paletteOpen) setPalette(false);
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
    if (kept) retake(kept);
    showActions();
}

// The tool takes again the arguments kept that the figure still has: by
// their names in the figure an undo rebuilds, a polygon's side or vertex
// while its polygon is the same.
function retake({ tool, objects }: NonNullable<typeof kept>): void {
    const c = scene();
    const args = emptyArgs(tool);
    objects.forEach((object, slot) => {
        const owner = object.reference?.owner;
        const found = owner
            ? c.getObj(owner.name) === owner && object
            : c.getObj(object.name);
        if (found) args[slot] = found;
        else objects.delete(slot);
    });
    if (!objects.size || !armed?.tools.includes(tool) || !usable(tool, vec3()))
        return void (kept = null);
    pending = { tool, args: giveNumber(tool, args) };
}

// Whether the argument designated at this place is kept: only by the tool
// of the menu, the ring's building a single object, and never one that
// would complete the object, which is built at once.
function keep(slot: number): void {
    const { tool, args } = pending!;
    if (
        !armed ||
        tool.mode !== "command" ||
        tool.overload.variadic ||
        !args.includes(undefined)
    )
        return;
    if (kept?.tool !== tool) kept = { tool, objects: new Map() };
    kept.objects.set(slot, args[slot] as construction_object);
}

function unkeep(slot: number): void {
    kept!.objects.delete(slot);
    pending!.args[slot] = undefined;
    prompt();
}

// The arguments designated, each to keep or kept, to change, in the hint.
function keepButtons(): DOMElement[] {
    const { tool, args, prefixed } = pending!;
    if (!armed || tool.mode !== "command" || tool.overload.variadic) return [];
    return args.flatMap((arg, slot) => {
        if (
            typeof arg !== "object" ||
            prefixed?.includes(arg as construction_object) ||
            arg instanceof FormulaArg ||
            arg instanceof TextArg
        )
            return [];
        const on = kept?.tool === tool && kept.objects.has(slot);
        const button = $.create("button")
            .cls("dge-hint-text")
            .text(
                message(on ? "macro_fixed_change" : "keep_arg", formatArg(arg)),
            );
        if (!on) button.att("title", message("keep_shift"));
        button.on("click", () => {
            if (on) return unkeep(slot);
            keep(slot);
            prompt();
        });
        return [button];
    });
}

// ************************** SELECTION ***************************

// The objects selected, or the one whose ring is open.
const chosen = (): Hit[] =>
    selection.length ? [...selection] : held ? [held.hit] : [];

const selectedNames = (): string =>
    selection.map(({ object }) => formatArg(object)).join(", ");

// The form of the item that takes the objects chosen, any without them.
function takes(
    item: Item,
    objects = chosen().map(({ object }) => object),
): Tool | undefined {
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
    // The selection is gone: the form is that of the objects picked.
    const tool = takes(armed!, objects)!;
    if (tool.mode === "point")
        return done(addPointOn(c, nextName(c, true), objects[0], picked[0].at));
    if (tool.mode === "turtle") return startTurtle(objects[0]);
    if (tool.mode === "event") return answer(tool, objects[0]);
    if (tool.mode === "control" && tool.command.name === "Checkbox")
        objects.forEach(toggleRevealed);
    if (tool.mode === "button" || tool.mode === "control") return prompt();
    pending = {
        tool,
        args: assign(tool, objects, defaultReal(tool.overload.tag))!,
        prefixed: objects,
    };
    const built = builtFrom(tool, picked);
    if (built) buildAll(built);
    else prompt();
}

// What the tool builds at once from the objects picked, when they are all
// its arguments: the intersections of two objects, a polygon closed from
// three vertices, a cube from two points.
function builtFrom(tool: Tool, picked: Hit[]): Built[] | null {
    const objects = picked.map(({ object }) => object);
    if (tool.mode === "intersection")
        return objects[1] ? intersections(objects[0], objects[1]) : null;
    if (tool.mode !== "command") return null;
    const args = assign(tool, objects, defaultReal(tool.overload.tag))!;
    if (tool.overload.variadic)
        return args.length >= 3
            ? [{ overload: tool.overload, args: args as Arg[] }]
            : null;
    const built =
        cubeOn(scene(), tool.overload, args) ??
        (args.includes(undefined)
            ? null
            : { overload: formOf(tool, args as Arg[]), args: args as Arg[] });
    return built && [built];
}

// Hovered, the item shows pale and nameless what it would build at once
// from the objects chosen.
function previewItem(item: Item): void {
    clearPreview();
    const picked = chosen();
    const tool = takes(item);
    const built = tool && picked[0] && builtFrom(tool, picked);
    if (!built) return;
    const results = built.map((spec, k) =>
        add(scene(), { name: `‧r${k}`, ...spec }),
    );
    results.forEach(ghostResult);
    preview = { candidate: "tool", objects: results, standIns: [] };
}

// Pale and nameless, a sphere's part behind the floor drawn outside the
// preview group.
function ghostResult(result: construction_object): void {
    result.showName = false;
    const sphere = result instanceof sphere_object;
    if (sphere) result.opacity! *= 0.55;
    if (!result.hasView) return;
    result.createSVG();
    result.dom.addClass("dge-preview");
    if (sphere) result.dom.stl("opacity", 1);
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
    markSides();
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
    if (mode === "point" && !pending!.tool.anywhere) {
        const supports = hits.filter(({ object }) =>
            accepts(object, "support"),
        );
        if (supports[0] && !(hits[0].object instanceof point_object))
            chooseHit(supports, client, (hit) => choose(pending!.tool, hit));
        return;
    }
    if (mode === "point")
        return designatePoint(screen, hits, client, (point) => {
            if (point !== hits[0]?.object) done(point);
        });
    if (mode === "turtle")
        return designatePoint(screen, hits, client, startTurtle);
    if (mode === "button") return placeButton(screen);
    if (mode === "control") return designateControl(screen, hits, client);
    if (mode === "intersection") {
        const cross = crossing(c, screen, hits);
        if (cross) return done(addCrossing(cross));
        const curves = hits.filter(({ object }) => crossable(object));
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

// Selects the object, and opens the ring of its tools if it has some, but
// not with the palette, which then shows them.
function openRing(hit: Hit, client: Vec2): void {
    const c = scene();
    held = { hit, client, screen: hold(c, hit, c.pt3D(hit.at)) };
    highlight(hit.object);
    showActions();
    if (paletteOpen) return;
    const tools = toolsFor(hit.object, vec3()).filter(
        (tool) => tool.mode !== "macros" || ringMacros(hit.object).length > 0,
    );
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
            .att("aria-label", itemLabel({ tools: [tool] }))
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
            if (!event.isPrimary || event.button !== 0) return;
            if (tool.mode === "macros") return showRingMacros(item, hit);
            const box = item.dom().getBoundingClientRect();
            item.dom().releasePointerCapture(event.pointerId);
            closeRing();
            if (tool.overload.tag === "C1") {
                begin(tool, hit.object);
                const circle = add(scene(), {
                    name: "‧r",
                    overload: tool.overload,
                    args: pending!.args as Arg[],
                }) as circle1_object;
                ghostResult(circle);
                preview = {
                    candidate: "tool",
                    objects: [circle],
                    standIns: [],
                };
                drawnCircle = { circle, pointerId: event.pointerId };
                scene().svg.dom().setPointerCapture(event.pointerId);
                return followRadius(event);
            }
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

// The figure's macros that may take the object first, by their index.
const ringMacros = (object: construction_object): number[] =>
    scene().macros.flatMap((macro, index) =>
        takesNext(
            designation(macro, withFixed(scene(), macro, []), scene().macros),
            object,
        )
            ? [index]
            : [],
    );

// Beside their place on the ring, the macros that take its object, the
// one chosen starting from it.
function showRingMacros(item: DOMElement, hit: Hit): void {
    const macros = scene().macros;
    const family = TOOL_FAMILIES.at(-1)!;
    ringMacrosMenu.inner("");
    ringMacros(hit.object).forEach((index) => {
        const macro = macros[index];
        const entry = toolEntry(macroIcon(macro), macro.name, family);
        entry.on("pointerenter", () => showHint(startHint(macro)), false);
        entry.on("click", () => {
            closeRing();
            startApply(index, [hit.object]);
        });
        ringMacrosMenu.add(entry);
    });
    ringMacrosMenu.show();
    const box = item.dom().getBoundingClientRect();
    const { width, height } = ringMacrosMenu.dom().getBoundingClientRect();
    const left =
        box.right + 4 + width <= window.innerWidth - 8
            ? box.right + 4
            : box.left - width - 4;
    ringMacrosMenu
        .stl("left", `${Math.max(8, left)}px`)
        .stl(
            "top",
            `${Math.max(8, Math.min(box.top, window.innerHeight - height - 8))}px`,
        );
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
    ringMacrosMenu.hide().inner("");
    ring.hide().inner("");
    highlight();
    showActions();
    if (!pending) showHint("");
}

// The object the actions act on, Delete included.
const target = (): construction_object | null =>
    propertiesOpen
        ? properties.selected
        : held?.hit.object.reference
          ? null
          : (held?.hit.object ?? null);

// Panel open, a click designates for it, unless a tool or the line being
// typed takes it.
const inspecting = (): boolean => propertiesOpen && !pending && !editing();

const OBJECT_ACTIONS = [
    deleteButton,
    programButton,
    settingsButton,
    openBoxButton,
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
    if (paletteOpen) palette.refresh();
    const object = held?.hit.object ?? magnetizing?.point;
    actions.toggleClass("dge-bar-tool", !!armed || !!applying);
    if (applying) {
        const macro = appliedMacro();
        const family = TOOL_FAMILIES.at(-1)!;
        toolIcon
            .inner(toolSvg(macroIcon(macro)))
            .stl("--dge-hue", `${family.hue}`)
            .stl("--dge-tone", `${family.tone}`)
            .show("grid");
        swatch.hide();
        objectName.text(macro.name);
        OBJECT_ACTIONS.forEach((action) => action.hide());
        programButton.show("grid");
        doneButton.show();
        actions.att("aria-label", macro.name).show("flex");
        return;
    }
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
        [deleteButton, settingsButton].forEach((action) =>
            selection.some(({ object }) => object.reference)
                ? action.hide()
                : action.show("grid"),
        );
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
    const name = formatArg(object);
    const label = magnetizing ? message("magnets_of", name) : name;
    swatch.stl("background", object.stroke_color);
    objectName.text(label);
    [deleteButton, settingsButton].forEach((action) =>
        magnetizing || object.reference ? action.hide() : action.show("grid"),
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
    [openBoxButton, programButton].forEach((action) =>
        !magnetizing && object.output ? action.show("grid") : action.hide(),
    );
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
    overPaletteProperties();
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
    overPaletteProperties();
    done(addEvent(c, owner, gesture));
}

// From the menu's tool, which is put down.
function answer(tool: Tool, owner: construction_object): void {
    cancel();
    startEvent(owner as point_object | expression_object, tool.gesture ?? null);
}

// The properties of a tool's program, which give back the palette they take
// the place of when they close.
function overPaletteProperties(): void {
    if (propertiesOpen) return;
    const back = paletteOpen;
    if (back) setPalette(false, false);
    setProperties(true);
    overPalette = back;
}

// A program, in blocks.
function showProgram(button: construction_object): void {
    properties.showBlocks();
    overPaletteProperties();
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

// What the checkbox being put shows, lit until it is put.
let revealed: construction_object[] = [];

function toggleRevealed(object: construction_object): void {
    const owner = object.reference?.owner ?? object;
    const on = !revealed.includes(owner);
    revealed = on
        ? [...revealed, owner]
        : revealed.filter((other) => other !== owner);
    if (owner.hasView) owner.dom.toggleClass("dge-picked", on);
}

function forgetRevealed(): void {
    revealed.forEach((object) => {
        if (object.hasView) object.dom.removeClass("dge-picked");
    });
    revealed = [];
}

// An object designated for the checkbox, or a widget, which the figure doesn't
// pick; elsewhere, the place of the control.
function designateControl(screen: Vec2, hits: Hit[], client: Vec2): void {
    const { tool } = pending!;
    // An image's first anchor.
    imageCorner =
        tool.command.name === "Image" && hits[0]?.object instanceof point_object
            ? hits[0].object
            : null;
    if (tool.command.name === "Checkbox") {
        if (hits[0])
            return chooseHit(hits, client, ({ object }) =>
                toggleRevealed(object),
            );
        const [clientX, clientY] = client;
        const widget = propertyObject({
            target: document.elementFromPoint(clientX, clientY),
            clientX,
            clientY,
        });
        if (widget) return toggleRevealed(widget);
    }
    placeControl(tool, screen);
}

const CONTROLS: Record<string, () => Line["definition"] | null> = {
    Slider: () => null,
    Checkbox: () => ({
        kind: "call",
        command: "Checkbox",
        args: [{ kind: "string", value: message("checkbox_caption") }],
    }),
    Menu: () => ({
        kind: "call",
        command: "Menu",
        args: [1, 2, 3].map((rank) => ({
            kind: "string",
            value: message("menu_choice", String(rank)),
        })),
    }),
    InputField: () => ({
        kind: "call",
        command: "InputField",
        args: [{ kind: "number", value: 1 }],
    }),
    Text: () => ({
        kind: "formula",
        source: quoteText(commandName(findCommand("Text")!)),
    }),
};

// There, by the palette's tool, which is put down; its properties show.
function placeControl({ command: { name } }: Tool, at: Vec2): void {
    if (name === "Image") {
        imageSpot = at;
        cancel();
        return (imageInput.dom() as HTMLInputElement).click();
    }
    const c = scene();
    const shown = revealed.filter((object) => c.getObj(object.name) === object);
    cancel();
    const control = addControl(c, CONTROLS[name](), at);
    shown.forEach((object) => showWhile(object, control));
    showPlaced(control);
}

// Closing the properties brings the palette back, as after a right click.
function showPlaced(object: construction_object): void {
    inspect(object);
    done(object);
}

// Where the image being chosen goes: from a point of the figure, or a place,
// to the right of it, as GeoGebra's between two anchors that size it and tie
// it to the construction. In space, a third anchor keeps it in its plane,
// horizontal at first, which turns with the figure.
let imageSpot: Vec2 = [0, 0];
let imageCorner: point_object | null = null;
const IMAGE_SIZE = 400;
const imageInput = $.create("input")
    .att("type", "file")
    .att("accept", "image/png,image/jpeg,image/gif,image/webp,image/svg+xml");
imageInput.on(
    "change",
    async () => {
        const field = imageInput.dom() as HTMLInputElement;
        const file = field.files![0];
        field.value = "";
        const url = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
        });
        const image = new Image();
        image.src = url;
        // Any file can still be chosen.
        const read = await image.decode().then(
            () =>
                /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,/.test(url),
            () => false,
        );
        if (!read) return showHint(message("image_unreadable"), true);
        const [width, height] = [
            image.naturalWidth || IMAGE_SIZE,
            image.naturalHeight || IMAGE_SIZE,
        ];
        const scale = Math.min(1, IMAGE_SIZE / Math.max(width, height));
        const size: Vec2 = [width * scale, height * scale];
        const key = await imageKey(url);
        const c = scene();
        const first = (imageCorner ?? addFreePoint(imageSpot)) as point_object;
        // Seen along the ground, where no point can be made.
        if (!first) return showPlaced(addImage(c, url, key, size, imageSpot));
        const anchor = (dx: number, dy: number) =>
            add(c, {
                name: nextName(c, true),
                overload: FREE_POINT,
                args: [
                    first.coords[0] + dx,
                    first.coords[1] + dy,
                    first.coords[2],
                ],
            });
        const wide = size[0] / c.GRID.UNIT[0];
        const corners = vec3()
            ? [first, anchor(wide, 0), anchor(0, (wide * size[1]) / size[0])]
            : [first, addFreePoint(vAdd(first.screen, [size[0], 0]))!];
        showPlaced(addImage(c, url, key, size, corners));
    },
    false,
);

function drawFrom(as: Exclude<Choice, "expression">): void {
    const source = target() as expression_object;
    closeRing();
    const drawn = derive(source, as);
    void refusedOffPlane().then((refused) =>
        refused ? showHint(message("off_plane"), true) : done(drawn),
    );
}

function remove(
    objects = selection.length
        ? selection.map(({ object }) => object)
        : propertiesOpen
          ? properties.selection
          : [target()!],
): void {
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

// ************************** BOX *********************************

// What opening the box of the selected final's application brings, its
// finals apart, pale and nameless, hidden if they will be.
function previewBox(): void {
    clearPreview();
    const c = scene();
    const node = target()!.output!.node as macro_object;
    const box = boxOf(c, node);
    if (!box) return;
    const objects = figureObjects(c);
    const inner = box.objects.filter(
        (object) => !node.children.includes(object),
    );
    const positions = new Map(
        [...objects, ...inner].map((object, index) => [object, index]),
    );
    addDgoEntries(
        c,
        inner.map((object, rank) => {
            const [tag, parameters] = box.entry(object, (other) =>
                positions.get(other)!,
            );
            return [tag, `‧${rank}`, parameters];
        }),
    );
    const added = figureObjects(c).slice(objects.length);
    added.forEach((object, rank) => {
        object.showName = false;
        object.hidden = inner[rank].hidden;
        if (!object.hasView) return;
        object.createSVG();
        object.dom.addClass("dge-preview");
    });
    preview = { candidate: node, objects: added, standIns: [] };
}

// The application of the selected final replaced by its construction.
async function openApplication(): Promise<void> {
    const node = target()!.output!.node as macro_object;
    clearPreview();
    const opened = await openBox(scene(), node);
    if (!opened) return showHint(message("open_box_point"), true);
    closeRing();
    rebuild(studio, opened.figure);
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

// ************************** MACROS ******************************

// The figure behind a veil, but for the objects of the macro.
function startMacro(picked: Hit[]): void {
    stopApply();
    setEraser(false);
    if (propertiesOpen) setProperties(false);
    if (paletteOpen) setPalette(false);
    if (window.innerWidth <= 900) setPanel(false);
    closeRing();
    $("body").addClass("dge-panel-animated").addClass("dge-macro-open");
    spots.clear();
    picked.forEach(({ object, at }) => spots.set(object.name, at));
    macros.start(picked.map(({ object }) => object));
}

function stopMacro(): void {
    if (!macros.active) return;
    macros.stop();
    $("body").addClass("dge-panel-animated").removeClass("dge-macro-open");
    showHint("");
}

// ************************** LIBRARY *****************************

const figureLibrary = (): Library => ({
    macros: scene().macros,
    folders: scene().macros.map(() => []),
});

const macroItem = (
    macro: Macro,
    run: () => void,
    enabled?: () => boolean,
    hue?: number,
): MenuItem => ({
    label: macro.name,
    run,
    enabled,
    icon: () => macroBadge(macro, hue),
});

// Its folders, then its macros, in the order of the library.
function libraryItems(
    library: Library,
    shown: number[],
    path: string[] = [],
): MenuItems {
    const inside = shown.filter((index) =>
        path.every((name, depth) => library.folders[index][depth] === name),
    );
    const folders = [
        ...new Set(
            inside.flatMap((index) =>
                library.folders[index].slice(path.length, path.length + 1),
            ),
        ),
    ];
    return [
        ...folders.map((name) => ({
            label: name,
            items: () => libraryItems(library, inside, [...path, name]),
        })),
        ...inside
            .filter((index) => library.folders[index].length === path.length)
            .map((index) =>
                macroItem(
                    library.macros[index],
                    () => void applyFrom(library, library.macros[index].name),
                    undefined,
                    library === supplied
                        ? sectionHue(library, library.folders[index])
                        : undefined,
                ),
            ),
    ];
}

function macrosMenu(): MenuItems {
    const c = scene();
    const picked = chosen();
    const objects = picked.map(({ object }) => object);
    const mine = myMacros();
    const shown = shownMacros(mine, supplied);
    // Not the copies of the library's.
    const own = shownMacros(figureLibrary(), supplied);
    return [
        {
            label: message("new_macro"),
            run: () => {
                cancel();
                startMacro(picked);
            },
        },
        null,
        // A figure may have many.
        {
            label: message("figure_macros"),
            items: () =>
                c.macros.map((macro, index) =>
                    macroItem(
                        macro,
                        () => {
                            cancel();
                            startApply(index, objects);
                        },
                        () => beginsMacro(macro, objects),
                    ),
                ),
            enabled: () => c.macros.length > 0,
        },
        {
            label: message("macro_library"),
            items: () =>
                libraryItems(
                    supplied,
                    supplied.macros.map((_, index) => index),
                ),
            enabled: () => supplied.macros.length > 0,
        },
        {
            label: message("my_macros"),
            items: () => libraryItems(mine, shown),
            enabled: () => shown.length > 0,
        },
        null,
        {
            label: message("add_to_my_macros"),
            items: () =>
                own.map((index) =>
                    macroItem(
                        c.macros[index],
                        () =>
                            void addToMine(figureLibrary(), [
                                c.macros[index].name,
                            ]),
                    ),
                ),
            enabled: () => own.length > 0,
        },
        { label: `${message("manage_my_macros")}…`, run: manageMine },
        { label: `${message("import_macros")}…`, run: chooseMacros },
        {
            label: `${message("export_my_macros")}…`,
            run: () => void exportMine(),
            enabled: () => shown.length > 0,
        },
    ];
}

// Copied into the figure with the macros it applies, and applied as a
// tool. A version the figure has of one of them may be replaced, the
// figure rebuilt; refused, the figure's are applied.
async function applyFrom(library: Library, name: string): Promise<void> {
    let objects = chosen().map(({ object }) => object);
    cancel();
    const taken = conflicts(figureLibrary(), library, [name]);
    const replace =
        taken.length > 0 &&
        (await confirmed(
            message("macros_taken_figure", taken.map(formatName).join(", ")),
            message("menu_macros"),
            "macros_replace",
        ));
    const before = scene().macros;
    const {
        library: merged,
        indices,
        rewritten,
    } = merge(figureLibrary(), library, [name], replace);
    if (rewritten) {
        if (!(await rewriteMacros(merged.macros, indices))) return;
        // Rebuilt.
        objects = [];
    } else scene().macros = merged.macros;
    startApply(
        macroIndex(scene(), name),
        objects,
        rewritten
            ? []
            : scene().macros.filter((macro) => !before.includes(macro)),
    );
}

// The figure rebuilt with these macros, each of its applications following
// its own where it moved. Kept as it was if they don't suit the new ones.
async function rewriteMacros(
    macros: Macro[],
    indices: number[],
): Promise<boolean> {
    let rewritten = false;
    recording = recording
        .then(async () => {
            const figure = await asSaved(() => describeDgo(scene()));
            const styles = [...(figure.st ?? [])];
            const images = { ...figure.img };
            for (const { icon } of macros)
                if (icon) images[await imageKey(icon)] = icon;
            const keys = new Map(
                Object.entries(images).map(([key, url]) => [url, key]),
            );
            const mac = describeMacros(
                macros,
                (url) => keys.get(url)!,
                (style) => styles.push(style) - 1,
            );
            const o = figure.o.map(([tag, name, parameters, ...style]) => {
                if (tag !== "Mac") return [tag, name, parameters, ...style];
                const [index, ...rest] = parameters as number[];
                return [tag, name, [indices[index], ...rest], ...style];
            });
            try {
                await reframe({}, undefined, {
                    o,
                    mac,
                    st: styles,
                    img: images,
                });
                rewritten = true;
            } catch {
                await reframe({}, history[position]);
                showHint(message("macros_replace_failed"), true);
            }
        })
        .catch(failed);
    await recording;
    if (rewritten) await record();
    return rewritten;
}

// The macros named of `from` and those they apply, but for those of the
// library, which can't be; mine of the same name may be replaced.
async function addToMine(from: Library, names: string[]): Promise<void> {
    const mine = myMacros();
    const refused = names.filter(
        (name) =>
            conflicts(supplied, from, [name]).length > 0 ||
            supplied.macros.some((macro) => macro.name === name),
    );
    const kept = names.filter((name) => !refused.includes(name));
    const taken = conflicts(mine, from, kept);
    const replace =
        taken.length > 0 &&
        (await confirmed(
            message("macros_taken_mine", taken.map(formatName).join(", ")),
            message("my_macros"),
            "macros_replace",
        ));
    await keepMyMacros(merge(mine, from, kept, replace).library);
    if (paletteOpen) palette.refresh();
    const added = kept.filter((name) => replace || !taken.includes(name));
    showHint(
        [
            added.length &&
                message("macros_added", added.map(formatName).join(", ")),
            refused.length &&
                message(
                    "macros_supplied_name",
                    refused.map(formatName).join(", "),
                ),
        ]
            .filter(Boolean)
            .join("\n"),
        refused.length > 0,
    );
}

const macrosInput = $.create("input").att("type", "file").att("accept", ".dgo");
const chooseMacros = (): void =>
    (macrosInput.dom() as HTMLInputElement).click();
macrosInput.on(
    "change",
    async () => {
        const field = macrosInput.dom() as HTMLInputElement;
        const file = field.files![0];
        field.value = "";
        let library: Library;
        try {
            library = readLibrary(await dgoJson(file));
        } catch (error) {
            return showHint(
                message("open_failed", (error as Error).message),
                true,
            );
        }
        if (!library.macros.length)
            return showHint(message("macros_none"), true);
        await addToMine(
            library,
            library.macros.flatMap((macro) =>
                shownMacros(library, supplied).includes(
                    library.macros.indexOf(macro),
                )
                    ? [macro.name]
                    : [],
            ),
        );
    },
    false,
);

const exportMine = (): Promise<void> =>
    saveOther(
        async () => gzipped(await describeLibrary(myMacros())),
        `${message("my_macros")}.dgo`,
    );

const manageMine = (): void =>
    manageMyMacros({
        supplied: () => supplied,
        importMacros: chooseMacros,
        exportMacros: () => void exportMine(),
        changed: () => {
            if (paletteOpen) palette.refresh();
        },
    });

const MACRO_STATES: MacroState[] = ["initial", "final", "possible", "missing"];

// Each object of the macro painted in the figure and lit in its row, each
// initial's rank beside it.
function showMacro(
    states: Map<construction_object, MacroState>,
    initials: construction_object[],
): void {
    const c = scene();
    c.svg.toggleClass("dge-defining", states.size > 0 || macros.active);
    const classes = MACRO_STATES.map((state) => `dge-${state}`);
    [
        ...c.svg.findAll(classes.map((name) => `.${name}`).join()),
        ...items.values(),
    ].forEach((element) =>
        classes.forEach((name) => element.removeClass(name)),
    );
    states.forEach((state, object) => {
        if (object.hasView) object.dom.addClass(`dge-${state}`);
        items.get(object)?.addClass(`dge-${state}`);
    });
    ranked = initials;
    ranks.inner("");
    initials.forEach((_, index) =>
        ranks.add($.create("span").text(String(index + 1))),
    );
    placeRanks();
}

// Where each initial was touched, by name, the figure being rebuilt by
// undo and redo.
const spots = new Map<string, Vec3>();
let ranked: construction_object[] = [];

// Each rank where its initial was touched, or, designated in its row, at
// its point nearest to the middle of the figure.
function placeRanks(): void {
    if (!ranked[0]) return;
    const c = scene();
    c.flush();
    const box = c.svg.dom().getBoundingClientRect();
    const middle: Vec2 = [box.width / 2, box.height / 2];
    ranked.forEach((object, index) => {
        const rank = $(ranks.dom().children[index]);
        if (object.isHidden || !object.hasView) return rank.hide();
        const at = spots.get(object.name) ?? nearest(c, object, middle);
        let x: number, y: number;
        if (at) {
            const hit = { object, distance: 0, at };
            [x, y] = hold(c, hit, c.pt3D(at));
            spots.set(object.name, hit.at);
        } else {
            // A number: by its view.
            const view = object.dom.dom().getBoundingClientRect();
            [x, y] = [view.left - box.left, view.top - box.top];
        }
        rank.show()
            .stl("left", `${box.left + x}px`)
            .stl("top", `${box.top + y}px`);
    });
}

// A macro applied as a tool: its initials designated one after the
// other, among its methods, until one is complete. Those copied into the
// figure from a library to be applied are taken back if it isn't.
// The fixed initials are taken without asking, but when others are being
// designated. The macros by their names: undo and redo rebuild the figure,
// whose macros may then be others. After the initial last designated
// (`reached`), the fixed ones; those `kept` at the head, up to one
// designated with Shift or kept from the hint, taken again by the next
// application.
let applying: {
    name: string;
    picked: Picked[];
    copied: string[];
    applied: boolean;
    asking: boolean;
    reached: number;
    kept: number;
} | null = null;
const appliedIndex = (): number => macroIndex(scene(), applying!.name);
const appliedMacro = (): Macro => scene().macros[appliedIndex()];
// A number typed as the next initial, when one is taken.
const numberField = $.create("input")
    .att("type", "text")
    .att("inputmode", "decimal")
    .att("aria-label", message("designate_number"));
numberField.on(
    "keydown",
    (event) => {
        if (event.key !== "Enter") return;
        const number = typedNumber(
            (numberField.dom() as HTMLInputElement).value,
        );
        numberField.toggleClass("dge-error", number === null);
        if (number !== null) pickInitial(number);
    },
    false,
);

const designated = (): Designation =>
    designation(appliedMacro(), applying!.picked, scene().macros);

// Whether these objects, in this order, begin one of its methods, after
// the fixed initials the figure has.
function beginsMacro(
    macro: Macro,
    objects: construction_object[],
    macros = scene().macros,
): boolean {
    let picked = withFixed(scene(), macro, [], macros);
    for (const object of objects) {
        if (!takesNext(designation(macro, picked, macros), object))
            return false;
        picked = withFixed(scene(), macro, [...picked, object], macros);
    }
    return true;
}

// What applying it asks first.
function startHint(macro: Macro, macros = scene().macros): string {
    const picked = withFixed(scene(), macro, [], macros);
    return applyHint(macro, designation(macro, picked, macros), picked.length);
}

// The fixed initials the figure has, after those designated.
function fillFixed(): void {
    if (!applying!.asking)
        applying!.picked = withFixed(scene(), appliedMacro(), applying!.picked);
}

// Others designated in place of the initials kept, or of the fixed ones
// taken.
const changeFixed = $.create("button").cls("dge-hint-text");
changeFixed.on("click", () => {
    const rank = changedRank();
    applying!.picked = applying!.picked.slice(0, rank);
    applying!.reached = Math.min(applying!.reached, rank);
    applying!.kept = 0;
    applying!.asking = true;
    clearPreview();
    showApply();
});
const changedRank = (): number =>
    applying!.kept
        ? 0
        : firstFixed(appliedMacro(), applying!.picked, scene().macros);
const keepInitial = $.create("button")
    .cls("dge-hint-text")
    .att("title", message("keep_shift"));
keepInitial.on("click", () => {
    applying!.kept = applying!.reached;
    showApply();
});
const initialName = (initial: Picked): string =>
    typeof initial === "string" ? initial : formatName(initial.name);

// Its help, and what it takes next, among how many.
function applyHint(
    macro: Macro,
    { next }: Designation,
    picked = applying?.picked.length ?? 0,
): string {
    const wanted = [
        ...new Set(
            next.map(
                ([type, text]) =>
                    text || message(`designate_${type}` as MessageKey),
            ),
        ),
    ].join(" · ");
    const total = Math.min(
        ...macro.methods
            .map(({ initials }) => initials.length)
            .filter((length) => length > picked),
    );
    const help = macro.methods.find(({ help }) => help)?.help;
    return `${help ? `${help}\n` : ""}${picked + 1}/${total} – ${wanted}`;
}

function startApply(
    index: number,
    objects: construction_object[],
    copied: Macro[] = [],
): void {
    stopMacro();
    applying = {
        name: scene().macros[index].name,
        picked: [],
        copied: copied.map(({ name }) => name),
        applied: false,
        asking: false,
        reached: 0,
        kept: 0,
    };
    showApply();
    objects.forEach((object) => {
        if (applying && takesNext(designated(), object)) pickInitial(object);
    });
    // Those designated before it aren't kept from the hint.
    if (objects[0] && applying) {
        applying.reached = 0;
        showApply();
    }
}

function stopApply(): void {
    if (!applying) return;
    const { copied, applied } = applying;
    const c = scene();
    if (!applied)
        c.macros = c.macros.filter(({ name }) => !copied.includes(name));
    applying = null;
    clearPreview();
    showRefused([]);
    scene()
        .svg.findAll(".dge-picked")
        .forEach((picked) => picked.removeClass("dge-picked"));
    showActions();
    showHint("");
}

function pickInitial(initial: Picked, keep = false): void {
    const c = scene();
    clearPreview();
    if (rememberFixed(designated(), initial)) applying!.asking = false;
    applying!.picked.push(initial);
    applying!.reached = applying!.picked.length;
    if (keep) applying!.kept = applying!.reached;
    fillFixed();
    const { complete } = designated();
    if (complete === null) return showApply();
    applyMacro(c, appliedIndex(), complete, applying!.picked);
    // Not the initial that completed it.
    applying!.kept = applying!.reached = Math.min(
        applying!.kept,
        applying!.reached - 1,
    );
    applying!.picked = applying!.picked.slice(0, applying!.kept);
    applying!.applied = true;
    fillFixed();
    changed();
}

// The initials designated lit: the hint says what the next one may be. The
// figure rebuilt, they are taken again by their names, or the tool left if
// the figure has lost its macro (an undo before a library's was copied).
function showApply(): void {
    const c = scene();
    const macro = appliedMacro();
    if (!macro) return stopApply();
    const again = applying!.picked.map((initial) =>
        typeof initial === "string" ? initial : c.getObj(initial.name),
    );
    applying!.picked = again.every(
        (initial, rank) =>
            initial !== undefined &&
            takesNext(
                designation(macro, again.slice(0, rank) as Picked[], c.macros),
                initial,
            ),
    )
        ? (again as Picked[])
        : [];
    applying!.kept = Math.min(applying!.kept, applying!.picked.length);
    applying!.reached = Math.min(applying!.reached, applying!.picked.length);
    fillFixed();
    const { picked } = applying!;
    c.svg
        .findAll(".dge-picked")
        .forEach((element) => element.removeClass("dge-picked"));
    picked.forEach(
        (object) =>
            typeof object !== "string" &&
            object.hasView &&
            object.dom.addClass("dge-picked"),
    );
    showActions();
    showHint(restingHint());
}

// The types of the initials a point made where the pointer is can be: a
// point, or one that a macro mapping points maps.
const POINTS = ["point", "invertible"];

// What the last initial would build, its point following the pointer.
function previewMacro(screen: Vec2, hits: Hit[]): void {
    const next = designated();
    const hit = hits.find(
        ({ object }) =>
            completes(next, object) && !applying!.picked.includes(object),
    );
    const coords = freeCoords(screen);
    const candidate =
        hit?.object ??
        (next.last.some((type) => POINTS.includes(type)) && coords
            ? ("pointer" as const)
            : null);
    if (!candidate) return clearPreview();
    const c = scene();
    if (preview?.candidate !== candidate) {
        clearPreview();
        const objects: construction_object[] = [];
        const argument =
            candidate === "pointer"
                ? add(c, { name: "‧p", overload: FREE_POINT, args: coords! })
                : candidate;
        if (candidate === "pointer") objects.push(argument);
        const initials = [...applying!.picked, argument];
        const count = figureObjects(c).length;
        applyMacro(
            c,
            appliedIndex(),
            designation(appliedMacro(), initials, c.macros).complete!,
            initials,
            { prefix: "‧" },
        );
        objects.push(...figureObjects(c).slice(count));
        // Nameless, pale.
        objects.forEach((object) => {
            object.showName = false;
            if (!object.hasView) return;
            object.createSVG();
            object.dom.addClass("dge-preview");
        });
        preview = {
            candidate,
            objects,
            pointer:
                candidate === "pointer"
                    ? (argument as point_object)
                    : undefined,
            standIns: [],
        };
    }
    if (preview.pointer && coords) {
        const [x, y, z = 0] = coords;
        preview.pointer.coords = [x, y, z];
        c.invalidateGeometry(preview.pointer);
    }
}

// ************************** MAGNETS *****************************

const reachField = () => reachInput.dom() as HTMLInputElement;

const restingHint = (): string =>
    applying
        ? applyHint(appliedMacro(), designated())
        : macros.active
          ? macros.hint
          : ghosts
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
                (hit.object.reference
                    ? formatArg(hit.object)
                    : lineOf(hit.object, index, objects)) ??
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
    begin(tool, object);
    // An intersection waits for its second object.
    if (tool.mode === "intersection") return prompt();
    proceed();
}

function begin(tool: Tool, object: construction_object): void {
    pending = { tool, args: firstArgs(tool, object) };
    if (keeping) keep(pending.args.indexOf(object));
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
    buildAll([{ overload, args }]);
}

function buildAll(built: Built[]): void {
    clearPreview();
    const c = scene();
    done(
        built
            .map(({ overload, args }) =>
                add(c, {
                    name: nextName(c, builtTag(overload, args)),
                    overload,
                    args,
                }),
            )
            .at(-1),
    );
}

// Whether the argument is a point, made there if none is under the
// pointer, rather than an object a transformation maps.
const pointNext = (param: Param, hits: Hit[]): boolean =>
    param === "point" ||
    (mappedSlot([param]) === 0 &&
        (!hits[0] ||
            hits[0].object instanceof point_object ||
            !accepts(hits[0].object, param)));

// Whether the tool or the line being typed takes the object next.
function takesNow(object: construction_object): boolean {
    if (pending) return fresh() ? !!fitting(object) : rowTakes(object);
    const field = editing();
    if (field) {
        const call = typedCall(field);
        return !!call && !!taking(call, object);
    }
    return !!applying && takesNext(designated(), object);
}

// A polyhedron's face first where a click takes it rather than the polyhedron.
function aimed(hits: Hit[]): Hit[] {
    const face = hits.find(({ object }) => object.reference?.kind === "face");
    return face &&
        (pending || editing() || applying) &&
        !takesNow(face.object.reference!.owner) &&
        (takesNow(face.object) || wantsPoint(hits))
        ? [face]
        : hits;
}

function designate(screen: Vec2, hits: Hit[], client: Vec2): void {
    if (fresh()) return designateFirst(screen, hits, client);
    const { tool, args } = pending!;
    if (tool.mode === "intersection") {
        const first = args[0] as construction_object;
        const curves = hits.filter(
            ({ object }) => object !== first && meet(first, object),
        );
        if (!curves[0]) return;
        return chooseHit(curves, client, ({ object }) =>
            buildAll(intersections(first, object)),
        );
    }
    const overload = tool.overload;
    const param = paramAt(overload, nextSlot())!;
    if (pointNext(param, hits) && makesPoints(overload)) {
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
    else {
        const slot = nextSlot();
        args[slot] = arg;
        if (keeping) keep(slot);
    }
    proceed();
}

// Designated in its row, the object takes no place.
function designateRow(object: construction_object): void {
    clearPreview();
    if (fresh()) {
        const tool = fitting(object)!;
        if (tool.mode === "turtle") return startTurtle(object);
        if (tool.mode === "event") return answer(tool, object);
        if (tool.mode === "control") return toggleRevealed(object);
        begin(tool, object);
        return tool.mode === "intersection" ? prompt() : proceed();
    }
    const { tool, args } = pending!;
    if (tool.mode !== "intersection") return designateNext(object);
    buildAll(intersections(args[0] as construction_object, object));
}

function clearPreview(): void {
    if (drawnCircle) {
        const { pointerId } = drawnCircle;
        drawnCircle = null;
        const svg = scene().svg.dom();
        if (svg.hasPointerCapture(pointerId))
            svg.releasePointerCapture(pointerId);
    }
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
    field: LineField,
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
    // A formula's function builds nothing to show, nor what a checkbox shows.
    if (!overload?.tag || overload.style) return null;
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
    const hit =
        mappedSlot([param]) === 0 && pointNext(param, hits)
            ? hits.find(({ object }) => object instanceof point_object)
            : hits.find(({ object }) => accepts(object, param));
    const candidate =
        hit?.object ??
        (pointNext(param, hits) && free
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
            argument.createSVG();
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
            const result = add(c, { name: "‧r", ...form });
            ghostResult(result);
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
    if (on) {
        stopMacro();
        stopApply();
    }
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
    forgetRevealed();
    setSteps(false);
    stopMagnets();
    if (keepTool && applying) {
        applying.picked = applying.picked.slice(0, applying.kept);
        applying.reached = applying.kept;
    } else stopApply();
    if (!keepTool) armed = kept = null;
    aim = null;
    clearPreview();
    closeMenu();
    closeRing();
    clearSelection();
    rearm();
    prompt();
}

function rightClick(event: PointerEvent): void {
    const c = scene();
    const screen = c.pointerPosition(event);
    const hits = pick(c, screen, previewed());
    const client: Vec2 = [event.clientX, event.clientY];
    const named = labelAt(c, client);
    if (named && !(hits[0]?.object instanceof point_object))
        return inspect(named);
    const widget = propertyObject(event);
    if (widget && !hits.some(({ object }) => object === widget))
        return inspect(widget);
    if (hits[0])
        return chooseHit(hits, client, ({ object }) => inspect(object));
    inspect(null);
}

function escape(): void {
    if (!menu.isHidden()) closeMenu();
    else if (!filters.menu.isHidden()) filters.close();
    else if (macros.active) stopMacro();
    else if (overPalette) setProperties(false);
    else if (applying) stopApply();
    else if (framing.shown) framing.stop();
    else if (propertiesOpen && !pending) setProperties(false);
    else if (paletteOpen && !pending && !held && !selection[0])
        setPalette(false);
    else if (ghosts) setEraser(false);
    else cancel();
}

function done(object?: construction_object): void {
    if (object && propertiesOpen) properties.select(object);
    rearm();
    clearPreview();
    highlight();
    showRefused([]);
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
    recording = recording
        .then(async () => {
            const c = scene();
            const off = !c.GRID.is2D && offPlane(c);
            if (off)
                return showHint(
                    message("in_space", formatName(off.name)),
                    true,
                );
            await (c.GRID.is2D ? toSpace() : toPlane());
        })
        .catch(failed);
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
    // The arguments kept, taken again in the figure rebuilt.
    if (kept) {
        rearm();
        prompt();
    }
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
    if (book) {
        const page = book.pages[book.current].name;
        const old = object.name;
        renameReferences((other, target) =>
            other === page && target === old ? [page, name] : undefined,
        );
    }
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
let typing: LineField | null = null;
let dragFrame: number | null = null;
// A pointer pressed while a tool waits: it aims and designates where it's
// released, unless still on the button that chose the tool.
let aim: { button: Vec2 | null } | null = null;
// The name being dragged, and where it was taken from (see labelHold).
let label: { object: construction_object; grab: Vec2 } | null = null;
// The angle whose mark is being dragged, its radius and the pointer's
// distance to its vertex when taken.
let sized: { angle: Angle; radius: number; from: number } | null = null;
let drawnCircle: { circle: circle1_object; pointerId: number } | null = null;

function followRadius(event: PointerEvent): void {
    const { circle } = drawnCircle!;
    circle.mousedrag(event);
    pending!.args[1] = circle.radius as number;
    showHint(describe(pending!.tool, pending!.args));
}
// The expression or button being dragged, and where it was taken from its
// position.
let moved: {
    expression: expression_object | button_object | image_object;
    grab: Vec2;
    // Where an image's anchors were, which move with it.
    anchors?: Vec2[];
} | null = null;

// What the bare drag of a control, which works it, doesn't move: the right
// button, and a press with its properties shown, the way of the finger.
function moveWidget(
    widget: expression_object | button_object | image_object,
    event: PointerEvent,
): void {
    const at = scene().pointerPosition(event);
    moved =
        widget instanceof image_object && !widget.screen
            ? {
                  expression: widget,
                  grab: at,
                  anchors: widget.corners.map(({ screen }) => screen),
              }
            : { expression: widget, grab: vSub(at, widget.screen!) };
    event.preventDefault();
    event.stopPropagation();
    scene().svg.dom().setPointerCapture(event.pointerId);
}

const movesAlone = (
    object: construction_object | null,
): object is expression_object | button_object | image_object =>
    object instanceof expression_object ||
    object instanceof button_object ||
    (object instanceof image_object &&
        (!!object.screen ||
            object.corners.every(
                (corner) => isFreePoint(corner) && !corner.pinned,
            )));
// The HTML frame being moved, or sized by its corner, its box and the
// pointer's position when taken.
let framed: {
    panel: panel_object;
    size: boolean;
    box: [number, number, number, number];
    from: Vec2;
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
    else if (applying) previewMacro(screen, hits);
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
    // As when tapped, a widget, which the figure doesn't pick.
    const widget = (applying || macros.active) && propertyObject(event);
    if (widget && !hits.some(({ object }) => object === widget))
        return macros.active || takesNext(designated(), widget)
            ? highlight(widget)
            : highlight();
    // The two objects whose intersection a click would make.
    const cross = wantsPoint(hits) && crossing(c, screen, hits);
    const shown = magnetizing
        ? hits.filter(({ object }) => attracts(magnetizing!.point, object))
        : aimed(hits);
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
            !filters.menu.isHidden() &&
            ![filters.menu, filterButton].some((box) =>
                box.dom().contains(element(event.target)),
            )
        ) {
            filters.close();
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
            moved = null;
            const widget = propertyObject(event);
            if (movesAlone(widget)) return moveWidget(widget, event);
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
        const widget = pending ? null : propertyObject(event);
        moved = null;
        if (
            movesAlone(widget) &&
            (widget instanceof button_object
                ? widget.accessory.dom().contains(element(event.target))
                : widget instanceof image_object ||
                  !widget.dom.dom().contains(element(event.target))) &&
            !pick(c, screen)[0]
        )
            return moveWidget(widget, event);
        // A frame of the properties moves, or is sized by its corner; its
        // fields and links keep their clicks.
        const frame = inspecting() && propertyObject(event);
        framed = null;
        if (
            frame instanceof panel_object &&
            properties.selection.includes(frame) &&
            !element(event.target)?.closest("input, select, a")
        ) {
            const div = frame.dom.find("foreignObject > div")!.dom();
            const { left, top } = div.getBoundingClientRect();
            framed = {
                panel: frame,
                size:
                    event.clientX >=
                        left + div.clientLeft + div.clientWidth - FRAME_GRIP &&
                    event.clientY >=
                        top + div.clientTop + div.clientHeight - FRAME_GRIP,
                box: [...frame.box],
                from: screen,
            };
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
                    (object.checkbox || object.inputLength > 0 || object.menu))
            ) {
                event.preventDefault();
                event.stopPropagation();
                showProperties(event, object);
                if (object instanceof button_object) down = null;
                else moveWidget(object, event);
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
        markSides();
        placeBadges();
        placeRanks();
        showMagnets();
        if (renaming) placeName();
        macros.follow();
    });
}

$("body").on(
    "wheel",
    (event) => {
        if (inFigure(event)) dragged();
    },
    { prevent: false, passive: true },
);

$("html").on(
    "pointermove",
    () => {
        if (scene().svg.pinching) dragged();
    },
    { capture: true, prevent: false, passive: true },
);

$("body").on(
    "pointercancel",
    (event) => {
        if (drawnCircle?.pointerId === event.pointerId) return cancel();
        if (!event.isPrimary || !inFigure(event)) return;
        down = label = sized = moved = framed = typing = aim = null;
        clearPreview();
        highlight();
        window.setTimeout(() => {
            scene().flush();
            void record().then(() => updateRows());
        });
    },
    { capture: true, prevent: false },
);

$("body").on(
    "lostpointercapture",
    (event) => {
        if (drawnCircle?.pointerId === event.pointerId) cancel();
    },
    false,
);

$("body").on(
    "pointermove",
    (event) => {
        if (drawnCircle?.pointerId === event.pointerId)
            return followRadius(event);
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
            const { expression, grab, anchors } = moved;
            if (anchors) {
                const c = scene();
                const shift = vSub(c.pointerPosition(event), grab);
                (expression as image_object).corners.forEach((corner, at) => {
                    const coords = c.unprojectToZPlane(
                        vAdd(anchors[at], shift),
                        corner.z,
                    );
                    if (coords) corner.coords = coords;
                    c.invalidateGeometry(corner);
                });
                return;
            }
            expression.screen = vSub(scene().pointerPosition(event), grab);
            if (expression instanceof expression_object && expression.anchor)
                expression.alpha = vSub(
                    expression.screen!,
                    expression.anchor.screen,
                );
            if (expression instanceof image_object) expression.project();
            return scene().invalidateRender(expression);
        }
        if (framed && event.isPrimary && event.buttons) {
            const { panel, size, box, from } = framed;
            const [dx, dy] = vSub(scene().pointerPosition(event), from).map(
                Math.round,
            );
            const [x, y, width, height] = box;
            panel.box = size
                ? [
                      x,
                      y,
                      Math.max(FRAME_MIN, width + dx),
                      Math.max(FRAME_MIN, height + dy),
                  ]
                : [x + dx, y + dy, width, height];
            panel.createSVG();
            return lit(panel, true);
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
        if (drawnCircle?.pointerId === event.pointerId) {
            followRadius(event);
            return build(pending!.tool.overload, pending!.args as Arg[]);
        }
        if (!event.isPrimary) return;
        // The figure may have changed since the hover.
        forgetBranches();
        if (aim) {
            const designates = aiming(event);
            keeping = event.shiftKey;
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
        if (expression && !tap) {
            // An image's line says its place.
            if (expression instanceof image_object) {
                if (properties.selection.includes(expression))
                    properties.select(properties.selection);
                void record().then(() => updateRows());
                return;
            }
            return void record();
        }
        const frame = framed;
        framed = null;
        if (frame && !tap) return void record();
        const line = editing();
        if (expression && line) return designateTyped(line, expression);
        if (!inFigure(event)) return;
        // A long press, or a click with ⌘, Ctrl or Shift, adds the object to
        // the selection.
        const adding =
            event.button !== 2 &&
            !ghosts &&
            !magnetizing &&
            !macros.active &&
            !applying &&
            !stepping &&
            (tap ? event.metaKey || event.ctrlKey || event.shiftKey : still);
        // Once the point has its pointerup too (this listener captures):
        // the programs it runs when let go are then in the step and rows.
        if (!tap)
            window.setTimeout(() => {
                scene().flush();
                void record().then(() => updateRows());
            });
        if (event.button === 2) return void (still && rightClick(event));
        if (!adding && !tap) return;
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
        // The palette open, no ring shows: another object is chosen at once.
        if (!adding && held && !(paletteOpen && hits[0])) return closeRing();
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
        // A widget, which the figure doesn't pick: a number as an initial.
        const shown = (applying || macros.active) && propertyObject(event);
        if (shown && !hits.some(({ object }) => object === shown)) {
            if (macros.active) return macros.tap(shown);
            if (takesNext(designated(), shown))
                pickInitial(shown, event.shiftKey);
            return;
        }
        // The next initial, a point made there if one is taken.
        if (applying) {
            const next = designated();
            const taken = hits.filter(
                ({ object }) =>
                    takesNext(next, object) &&
                    !applying!.picked.includes(object),
            );
            if (taken[0])
                return chooseHit(taken, client, ({ object }) =>
                    pickInitial(object, event.shiftKey),
                );
            if (next.next.some(([type]) => POINTS.includes(type))) {
                clearPreview();
                designatePoint(screen, hits, client, (point) =>
                    pickInitial(point, event.shiftKey),
                );
            }
            return;
        }
        // A tap in the void keeps the definition.
        if (macros.active) {
            if (hits[0])
                chooseHit(hits, client, ({ object, at }) => {
                    const owner = object.reference?.owner ?? object;
                    if (owner === object) spots.set(object.name, at);
                    macros.tap(owner);
                });
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
        // The palette open, its tool makes the points.
        const cross = !paletteOpen && crossing(c, screen, hits);
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
        // Ticked once it has its pointerup too.
        if (
            widget instanceof expression_object &&
            widget.checkbox &&
            widget.dom.dom().contains(element(event.target))
        ) {
            window.setTimeout(() => void record());
            return dragged();
        }
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
        if (paletteOpen && !field) return;
        const point = addFreePoint(screen);
        if (!point) return;
        done(point);
        if (field) designateTyped(field, point);
    },
    { capture: true, prevent: false },
);

// A field of the figure changed: a step to undo.
$("body").on(
    "change",
    ({ target }) => {
        if (!scene().svg.dom().contains(element(target))) return;
        scene().flush();
        void record().then(() => updateRows());
    },
    false,
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
            installed &&
            command &&
            !event.shiftKey &&
            event.key.toLowerCase() === "n"
        ) {
            event.preventDefault();
            void askNewFigure();
        } else if (
            installed &&
            command &&
            !event.shiftKey &&
            event.key.toLowerCase() === "t"
        ) {
            event.preventDefault();
            void addPage();
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
// A change of the figure that fails is told, and doesn't stop the next
// ones, which wait for it, nor saving.
const failed = (error: unknown): void => {
    console.error(error);
    showHint(message("failed", String(error)), true);
};
// The step last saved, or opened.
let saved = "";

type Steps = { history: typeof history; position: number; saved: string };

// The workbook of which the figure is the page shown, if it is one, the
// steps of each other page shown since it was opened, and whether pages
// were added, deleted or renamed since it was saved.
let book: Workbook | null = null;
let away = new Map<number, Steps>();
let reshaped = false;

const unsaved = (): boolean =>
    reshaped ||
    [{ history, position, saved }, ...away.values()].some(
        ({ history, position, saved }) => history[position].figure !== saved,
    );

// A view's window and camera, or, if not `kept`, the rest.
const camera = (view: DgoFigure["v"], kept: boolean): DgoFigure["v"] =>
    Object.fromEntries(
        Object.entries(view).filter(
            ([key]) => ["w", "h", "th", "ph"].includes(key) === kept,
        ),
    );

function record(): Promise<void> {
    recording = recording
        .then(async () => {
            const figure = await asSaved(() => describeDgo(scene()));
            const { o, u, ...view } = figure.v;
            const step = JSON.stringify({ ...figure, v: camera(view, false) });
            if (step === history[position]?.figure) return;
            history = [
                ...history.slice(0, position + 1),
                { figure: step, o, u },
            ];
            position = history.length - 1;
            showChanged(unsaved());
        })
        .catch(failed);
    return recording;
}

function travel(step: number): void {
    recording = recording
        .then(async () => {
            if (!history[position + step]) return;
            cancel(true);
            position += step;
            const target = history[position];
            showChanged(unsaved());
            const space = JSON.parse(target.figure).v["3d"] === 1;
            if (space === scene().GRID.is2D)
                await (space ? toSpace(target) : toPlane(target));
            else await reframe({}, target);
        })
        .catch(failed);
}

// ************************** FILES *******************************

async function save(as = false): Promise<void> {
    if (embedded && !as) return requestSave();
    let step = "";
    const written = await saveFile(async () => {
        await recording;
        step = history[position].figure;
        return asSaved(write);
    }, as);
    if (!written) return;
    saved = step;
    reshaped = false;
    away.forEach((page) => (page.saved = page.history[page.position].figure));
}

// The page shown alone, in a file of its own.
async function savePage(): Promise<void> {
    await recording;
    const { name } = book!.pages[book!.current];
    await saveOther(() => asSaved(() => writeDgo(scene())), `${name}.dgo`);
}

async function saveFigure(): Promise<Blob> {
    await recording;
    return asSaved(write);
}

const write = (): Promise<Blob> =>
    book ? writeWorkbook(book, scene()) : writeDgo(scene());

// A figure opened from `name`, a file name or a URL, which a save writes back
// to if `from` is its file, or, if `name` is null, a page of the workbook,
// with its `steps` if it was shown before.
async function open(
    name: string | null,
    load: (c: construction) => Promise<string[]>,
    from?: FileSystemHandle | null,
    steps?: Steps,
): Promise<string[]> {
    // Shown again if the file is refused.
    const shown = history.length
        ? await asSaved(() => describeDgo(scene()))
        : null;
    setEraser(false);
    stopMacro();
    stopApply();
    cancel();
    framing.stop();
    properties.select(null);
    studio.scene.dispose();
    studio.scene = construction.create(studio);
    let unsupported: string[];
    try {
        unsupported = await load(studio.scene);
    } catch (error) {
        if (shown) {
            rebuild(studio, shown);
            showAxes();
            showSpace();
            refreshRows();
        }
        throw error;
    }
    if (name !== null) published = null;
    studio.scene.flush();
    studio.scene.reveal();
    showAxes();
    showSpace();
    planeAxes = null;
    planeFlaw = studio.scene.GRID.is2D && offPlane(studio.scene) !== undefined;
    if (steps) ({ history, position, saved } = steps);
    else {
        history = [];
        position = -1;
        await record();
        saved = history[0].figure;
    }
    if (name !== null) opened(name, from);
    else showChanged(unsaved());
    filters.reset();
    refreshRows();
    showHint(
        unsupported.length
            ? message("unsupported", unsupported.join(", "))
            : "",
        unsupported.length > 0,
    );
    return unsupported;
}

// A chosen or dropped file.
async function openFile(
    file: File,
    from?: Promise<FileSystemHandle | null> | FileSystemHandle,
): Promise<string[]> {
    let found: Workbook | null = null;
    const unsupported = await open(
        file.name,
        async (c) => {
            const figure = await openFigureFile(c, file);
            found = figure.book;
            return figure.unsupported;
        },
        await from,
    );
    setBook(found);
    return unsupported;
}

// Opened in place of the figure shown, several files making a workbook of
// their pages, which a save doesn't write back to any of them.
async function openFiles(
    files: File[],
    from?: Promise<FileSystemHandle | null> | FileSystemHandle,
): Promise<void> {
    if (files.length === 1) return void (await openFile(files[0], from));
    await openFile(files[0]);
    book ??= {
        pages: [{ name: fileTitle(files[0]), figure: blank(scene()) }],
        current: 0,
    };
    await openInTabs(files.slice(1), book.pages.length);
}

const fileTitle = (file: File): string => file.name.replace(/\.[^.]*$/, "");

// Whether the figure shown can be replaced: the user doesn't mind losing
// its changes, if it has any.
const discarded = async (): Promise<boolean> =>
    !unsaved() || confirmed(message("embed_unsaved"), message("open"));

function setBook(shown: Workbook | null): void {
    book = shown;
    useWorkbook(book);
    away.clear();
    reshaped = false;
    tabs();
}

// The page being shown.
let paging: Promise<unknown> = Promise.resolve();

// The tabs of the pages: a right click on one, or its arrow, opens the menu
// of its page, once shown.
let pageTabs: DOMElement[] = [];

const PAGE_COLORS = [
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#06b6d4",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
];

function tabs(): void {
    pageTabs = [];
    showTabs(
        book,
        (index) => (paging = showPage(index).catch(failed)),
        pageTab,
        [
            tabsButton(
                "new_page",
                '<path d="M12 5v14M5 12h14"/>',
                () => void addPage(),
            ),
            tabsButton(
                "page_list",
                '<rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/>',
                (box) =>
                    contextMenu(
                        book!.pages.map(({ name, color }, index) => ({
                            label: name,
                            checked: () => index === book!.current,
                            icon: color
                                ? () =>
                                      $.create("span")
                                          .cls("dge-page-swatch")
                                          .stl("background", color)
                                : undefined,
                            run: () =>
                                (pageTabs[index].dom() as HTMLElement).click(),
                        })),
                        box.left,
                        box.top,
                    ),
            ),
        ],
    );
    if (pageTabs.length) dropOnTabs($(pageTabs[0].dom().parentElement!));
}

// Figure files dropped on the tabs open in new pages where they're dropped,
// the tabs after making way for them.
function dropOnTabs(bar: DOMElement): void {
    let boxes: DOMRect[] | null = null;
    let place = 0;
    const makeWay = (way: boolean): void =>
        pageTabs.forEach((tab, at) =>
            tab.stl(
                "transform",
                way && at >= place
                    ? `translateX(${DIR === "rtl" ? -48 : 48}px)`
                    : "",
            ),
        );
    const leave = (): void => {
        boxes = null;
        makeWay(false);
    };
    // Not shown over the tabs, the veil is only shown again over the figure.
    bar.on(
        "dragenter",
        (event) => {
            if (hasFiles(event)) event.stopPropagation();
        },
        false,
    );
    bar.on(
        "dragover",
        (event) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            boxes ??= pageTabs.map((tab) => tab.dom().getBoundingClientRect());
            place = boxes.filter(
                (box) =>
                    box.left + box.width / 2 < event.clientX !==
                    (DIR === "rtl"),
            ).length;
            makeWay(true);
        },
        false,
    );
    bar.on(
        "dragleave",
        (event) => {
            if (!bar.dom().contains(event.relatedTarget as Node)) leave();
        },
        false,
    );
    bar.on(
        "drop",
        (event) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            event.stopPropagation();
            leave();
            const { files } = droppedFigures(event);
            if (files.length) void openInTabs(files, place);
        },
        false,
    );
}

function tabsButton(
    title: MessageKey,
    icon: string,
    run: (box: DOMRect) => void,
): DOMElement {
    const button = $.create("button")
        .cls("dge-tabs-button")
        .att("title", message(title))
        .append(
            `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">${icon}</svg>`,
        );
    button.on("click", () => run(button.dom().getBoundingClientRect()));
    return button;
}

function pageTab(tab: DOMElement, index: number): void {
    pageTabs[index] = tab;
    const more = $.create("span")
        .cls("dge-tab-more")
        .att("title", message("page_menu"))
        .append(
            '<svg viewBox="0 0 10 6" width="9" height="6"><path d="M0 0h10L5 6z" fill="currentColor"/></svg>',
        );
    tab.add(more);
    const menu = (x: number, y: number): void =>
        void paging.then(() => {
            let close = (): void => {};
            close = contextMenu(
                pageMenu(() => close()),
                x,
                y,
            );
        });
    tab.on(
        "click",
        (event) => {
            if (!more.dom().contains(event.target as Node)) return;
            const box = more.dom().getBoundingClientRect();
            menu(box.left, box.top);
        },
        false,
    );
    tab.on("contextmenu", (event) => {
        if (index !== book!.current) (tab.dom() as HTMLElement).click();
        menu(event.clientX, event.clientY);
    });
    tab.on("dblclick", (event) => {
        if (!more.dom().contains(event.target as Node))
            void paging.then(() => renamePage(index));
    });
    draggable(tab, index, more);
}

// Dragged, a tab takes the place where it's dropped, the others making way
// for it.
function draggable(tab: DOMElement, index: number, more: DOMElement): void {
    let shift = 0;
    let moving = false;
    let place = index;
    let boxes: DOMRect[] = [];
    tab.drag(
        (_, [dx]) => {
            shift += dx;
            if (!moving && Math.abs(shift) < 6) return;
            moving = true;
            tab.addClass("dge-dragged").stl(
                "transform",
                `translateX(${shift}px)`,
            );
            const rtl = DIR === "rtl";
            const { left, width } = boxes[index];
            const center = left + width / 2 + shift;
            place = boxes.filter(
                (box, other) =>
                    other !== index &&
                    box.left + box.width / 2 < center !== rtl,
            ).length;
            pageTabs.forEach((other, at) => {
                if (at === index) return;
                const step =
                    at > index && at <= place
                        ? -1
                        : at < index && at >= place
                          ? 1
                          : 0;
                other.stl(
                    "transform",
                    step
                        ? `translateX(${step * (rtl ? -1 : 1) * (width - 1)}px)`
                        : "",
                );
            });
        },
        (event) => {
            if (more.dom().contains(event.target as Node)) return false;
            shift = 0;
            moving = false;
            place = index;
            boxes = pageTabs.map((other) =>
                other.dom().getBoundingClientRect(),
            );
        },
        (_, cancelled) => {
            if (!moving) return;
            if (cancelled || place === index) tabs();
            else movePage(index, place);
        },
    );
}

// The menu of the page shown, which its colors close.
function pageMenu(close: () => void): (MenuItem | DOMElement | null)[] {
    const at = book!.current;
    const page = book!.pages[at];
    const swatch = (color?: string): DOMElement => {
        const button = $.create("button")
            .att("type", "button")
            .att("title", color ?? message("page_no_color"))
            .toggleClass("on", color === page.color)
            .stl("--dge-swatch", color ?? "");
        button.on(
            "click",
            () => {
                close();
                if (color === page.color) return;
                if (color) page.color = color;
                else delete page.color;
                reshape();
            },
            false,
        );
        return button;
    };
    return [
        { label: message("rename_page"), run: () => renamePage(at) },
        { label: message("duplicate_page"), run: () => void duplicatePage() },
        { label: message("delete_page"), run: () => void deletePage() },
        null,
        {
            label: message("move_page_before"),
            run: () => movePage(at, at - 1),
            enabled: () => at > 0,
        },
        {
            label: message("move_page_after"),
            run: () => movePage(at, at + 1),
            enabled: () => at < book!.pages.length - 1,
        },
        null,
        $.create("div")
            .cls("dge-page-colors")
            .add(
                $.create("small").text(message("page_color")),
                swatch(),
                ...PAGE_COLORS.map(swatch),
            ),
    ];
}

const reshape = (): void => {
    reshaped = true;
    showChanged(true);
    tabs();
};

// A new page, empty, after the others, shown: the figure is the first page
// of a workbook if it wasn't one.
async function addPage(): Promise<void> {
    await recording;
    book ??= {
        pages: [{ name: message("page_name", "1"), figure: blank(scene()) }],
        current: 0,
    };
    useWorkbook(book);
    let n = book.pages.length + 1;
    while (pageNamed(message("page_name", String(n)))) n++;
    await insertPage(book.pages.length, {
        name: message("page_name", String(n)),
        figure: blank(scene()),
    });
}

// Formulas read other pages by their names, which are unique.
const pageNamed = (name: string): boolean =>
    book!.pages.some((page) => page.name === name);

// A copy of the page shown, after it, shown.
async function duplicatePage(): Promise<void> {
    await recording;
    const at = book!.current;
    const { name, color } = book!.pages[at];
    let copy = message("page_copy", name);
    for (let n = 2; pageNamed(copy); n++)
        copy = `${message("page_copy", name)} ${n}`;
    await insertPage(at + 1, {
        name: copy,
        ...(color && { color }),
        figure: await asSaved(() => describeDgo(scene())),
    });
}

// Inserted after the page shown, and shown.
async function insertPage(
    at: number,
    page: Workbook["pages"][number],
): Promise<void> {
    book!.pages.splice(at, 0, page);
    shiftAway(at, 1);
    reshaped = true;
    await showPage(at).catch(failed);
    tabs();
}

// Opened in new pages from `at`, each file's shown in turn, the user told
// why one can't be: a figure is named after its file, a workbook gives its
// pages, whose references to each other follow their names, made unique.
async function openInTabs(
    files: File[],
    at = book ? book.current + 1 : 1,
): Promise<void> {
    await recording;
    const was = reshaped;
    book ??= {
        pages: [{ name: message("page_name", "1"), figure: blank(scene()) }],
        current: 0,
    };
    useWorkbook(book);
    for (const file of files) {
        let pages: Workbook["pages"];
        let shown = 0;
        let load: ((c: construction) => Promise<string[]>) | undefined;
        try {
            if (/\.dgo$/i.test(file.name)) {
                const read = await readDgoFile(file);
                pages = read.book?.pages ?? [
                    { name: fileTitle(file), figure: read.figure as DgoFigure },
                ];
                shown = read.book?.current ?? 0;
            } else {
                pages = [{ name: fileTitle(file), figure: blank(scene()) }];
                load = (c) => importForeign(c, file);
            }
        } catch (error) {
            showHint(message("open_failed", (error as Error).message), true);
            break;
        }
        const names = new Map<string, string>();
        for (const page of pages) {
            let name = page.name;
            for (
                let n = 2;
                pageNamed(name) || [...names.values()].includes(name);
                n++
            )
                name = `${page.name} ${n}`;
            names.set(page.name, name);
        }
        for (const page of pages) {
            page.name = names.get(page.name)!;
            page.figure = renamedJson(page.figure, (other, object) =>
                names.has(other) ? [names.get(other)!, object] : undefined,
            ) as DgoFigure;
        }
        book.pages.splice(at, 0, ...pages);
        shiftAway(at, pages.length);
        if (book.current >= at) book.current += pages.length;
        reshaped = true;
        forgetValues();
        try {
            await showPage(at + shown, load);
        } catch (error) {
            book.pages.splice(at, pages.length);
            shiftAway(at + pages.length, -pages.length);
            if (book.current >= at) book.current -= pages.length;
            forgetValues();
            showHint(message("open_failed", (error as Error).message), true);
            break;
        }
        at += pages.length;
    }
    if (book.pages.length === 1) {
        book = null;
        useWorkbook(null);
        reshaped = was;
    }
    showChanged(unsaved());
    tabs();
}

// The steps of the pages from `at` once `count` pages are inserted there.
const shiftAway = (at: number, count: number): void =>
    void (away = new Map(
        [...away].map(([index, steps]) => [
            index + (index >= at ? count : 0),
            steps,
        ]),
    ));

// The page at `from` moved to `to`.
function movePage(from: number, to: number): void {
    const order = book!.pages.map((_, index) => index);
    order.splice(to, 0, ...order.splice(from, 1));
    book!.pages = order.map((index) => book!.pages[index]);
    away = new Map(
        [...away].map(([index, steps]) => [order.indexOf(index), steps]),
    );
    book!.current = order.indexOf(book!.current);
    reshape();
}

// The page shown, once confirmed, in place of which its neighbour is shown:
// a single page left is a figure again.
async function deletePage(): Promise<void> {
    const deleted = book!.current;
    if (!confirm(message("delete_page_confirm", book!.pages[deleted].name)))
        return;
    await recording;
    const shown = deleted ? deleted - 1 : 1;
    const steps = away.get(shown);
    // Shown without it, its formulas reading it no longer.
    const [page] = book!.pages.splice(deleted, 1);
    book!.current = shown - (shown > deleted ? 1 : 0);
    forgetValues();
    try {
        await open(
            null,
            async (c) => {
                importDgo(c, book!.pages[book!.current].figure);
                return [];
            },
            null,
            steps,
        );
    } catch (error) {
        book!.pages.splice(deleted, 0, page);
        book!.current = deleted;
        throw error;
    }
    away = new Map(
        [...away]
            .filter(([index]) => index !== shown)
            .map(([index, page]) => [index - (index > deleted ? 1 : 0), page]),
    );
    if (book!.pages.length === 1) {
        book = null;
        useWorkbook(null);
    }
    reshape();
}

// The name of the page shown, edited in its tab.
function renamePage(index: number): void {
    const field = $.create("input")
        .att("dir", "auto")
        .att("value", book!.pages[index].name);
    const input = field.dom() as HTMLInputElement;
    let done = false;
    const finish = (keep: boolean) => {
        if (done) return;
        done = true;
        const name = input.value.trim();
        const page = book!.pages[index];
        if (keep && name && name !== page.name) {
            if (pageNamed(name))
                showHint(message("page_name_taken", name), true);
            else {
                const old = page.name;
                page.name = name;
                renameReferences((other, target) =>
                    other === old ? [name, target] : undefined,
                );
                reshaped = true;
                showChanged(true);
            }
        }
        tabs();
    };
    field.on(
        "keydown",
        (event) => {
            event.stopPropagation();
            if (event.key === "Enter" || event.key === "Escape")
                finish(event.key === "Enter");
        },
        false,
    );
    field.on("blur", () => finish(true), false);
    pageTabs[index].dom().replaceWith(input);
    input.focus();
    input.select();
}

type Rename = (page: string, name: string) => [string, string] | undefined;

// A description whose formulas' references to objects of other pages are
// written anew.
const renamedJson = (json: unknown, rename: Rename): unknown =>
    typeof json === "string"
        ? json.includes("!")
            ? renameExternals(json, rename)
            : json
        : Array.isArray(json)
          ? json.map((item) => renamedJson(item, rename))
          : json && typeof json === "object"
            ? Object.fromEntries(
                  Object.entries(json).map(([key, value]) => [
                      key,
                      renamedJson(value, rename),
                  ]),
              )
            : json;

// The formulas of the other pages, their steps included, whose references
// to objects of the page shown are written anew (see DGO.md).
function renameReferences(rename: Rename): void {
    const text = (figure: string): string =>
        figure.includes("!")
            ? JSON.stringify(renamedJson(JSON.parse(figure), rename))
            : figure;
    book!.pages.forEach((page, index) => {
        if (index !== book!.current)
            page.figure = renamedJson(page.figure, rename) as DgoFigure;
    });
    away.forEach((steps) => {
        steps.history = steps.history.map((step) => ({
            ...step,
            figure: text(step.figure),
        }));
        steps.saved = text(steps.saved);
    });
}

// The workbook's page of this index, in place of the one shown, opened by
// `load` if its description isn't known yet.
async function showPage(
    index: number,
    load = async (c: construction): Promise<string[]> => {
        importDgo(c, book!.pages[index].figure);
        return [];
    },
): Promise<void> {
    await recording;
    const left = book!.current;
    book!.pages[left].figure = await asSaved(() => describeDgo(scene()));
    leavePage(scene());
    away.set(left, { history, position, saved });
    book!.current = index;
    const steps = away.get(index);
    away.delete(index);
    try {
        await open(null, load, null, steps);
    } catch (error) {
        // A malformed page: the one left is shown again.
        away.delete(left);
        if (steps) away.set(index, steps);
        book!.current = left;
        tabs();
        throw error;
    }
}

// Opened by the user, once sure to replace the figure shown, who is told
// why it can't be.
const openChosen = async (
    files: File[],
    from?: Promise<FileSystemHandle | null> | FileSystemHandle,
): Promise<void> => {
    if (await discarded())
        await openFiles(files, from).catch((error: Error) =>
            showHint(message("open_failed", error.message), true),
        );
};

for (const [element, run] of [
    [fileInput, openChosen],
    [pageInput, openInTabs],
] as const)
    element.on(
        "change",
        () => {
            const input = element.dom() as HTMLInputElement;
            void run([...input.files!]);
            input.value = "";
        },
        false,
    );

// Dropped on the band at the bottom of the veil, figure files open in new
// pages after the page shown.
const dropBand = $.create("p").cls("dge-drop-tab").text(message("open_in_tab"));
const inBand = (event: DragEvent): boolean =>
    event.clientY >= dropBand.dom().getBoundingClientRect().top;
dropFigures((files, from, event) =>
    inBand(event) ? void openInTabs(files) : void openChosen(files, from),
).add(dropBand);
$("body").on(
    "dragover",
    (event) => dropBand.toggleClass("on", inBand(event)),
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

// The link the figure was opened from, and its step then: what a web page
// embeds.
let published: { url: string; step: string } | null = null;

async function openPublished(url: string): Promise<void> {
    const file = await fetchFigure(url);
    // A page instead of the file (a private file's sign-in page…), refused
    // before the figure shown is replaced.
    if ((await file.slice(0, 200).text()).trimStart().startsWith("<"))
        throw new Error("Not a figure file");
    await openFile(file);
    published = { url, step: history[position].figure };
}

// Framed from the published figure, once the user gave its link, or knows
// the changes made since aren't published.
async function embedInPage(): Promise<void> {
    if (!published)
        return askLink(
            history[position].figure === saved
                ? message("embed_replaced")
                : `${message("embed_replaced")} ${message("embed_unsaved")}`,
            async (url) => {
                await openPublished(url);
                // A reload, or the user's bookmark, opens it again.
                const query = location.search.replace(/[?&]url=.*$/, "");
                window.history.replaceState(
                    null,
                    "",
                    `${query}${query ? "&" : "?"}url=${url}`,
                );
                framing.start();
            },
        );
    if (
        history[position].figure !== published.step &&
        !(await confirmed(message("embed_modified")))
    )
        return;
    cancel();
    framing.start();
}

let showPalette = true;
try {
    showPalette = localStorage.getItem(PALETTE_STORAGE) !== "false";
} catch {
    // Storage refused: use the initial default.
}
if (showPalette) setPalette(true);

export const EDITOR_READY =
    !embedded && FIGURE_URL ? openPublished(FIGURE_URL) : newFigure();

if (embedded)
    void EDITOR_READY.then(() =>
        embedEditor({
            load: async (file, name) => {
                await recording;
                const unsupported = await openFile(file);
                if (name) opened(name);
                return unsupported;
            },
            save: saveFigure,
        }),
    );

finishSplash(EDITOR_READY);

// Figure files opened from the system with the installed application (see
// public/editor.webmanifest), in a window of their own.
window.launchQueue?.setConsumer(({ files }) => {
    if (files.length)
        void EDITOR_READY.then(async () =>
            openChosen(
                await Promise.all(files.map((from) => from.getFile())),
                files[0],
            ),
        );
});

async function askNewFigure(): Promise<void> {
    if (await discarded()) await newFigure();
}

async function newFigure(): Promise<void> {
    setBook(null);
    await open("figure", async (c) => {
        readDgo(c, blank(c));
        return [];
    });
}

function blank(c: construction): DgoFigure {
    return {
        dgo: 1,
        v: {
            o: [c.width / 2, c.height / 2],
            u: 40,
            w: c.width,
            h: c.height,
            ax: 0,
        },
        bg: "#FFFFFF",
        o: [],
    };
}

export { studio };
