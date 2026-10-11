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
import { createOrderedIntersection } from "../objects/intersection_object";
import { point_object } from "../objects/point_object";
import { preferences } from "../preferences";
import { vAdd, vScale, vSub, type Vec2, type Vec3 } from "../vec";
import {
    accepts,
    commandName,
    commandsStarting,
    findCommand,
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
import { message, type MessageKey } from "./messages";
import { pick, PICK_RADIUS, type Hit } from "./pick";
import { completionAt, formatName, parseLine, TextError } from "./text";
import { RING_SLOTS, toolsFor, type Tool } from "./tools";

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
    .stl(
        "position:relative;height:100%;margin:0;overflow:hidden;touch-action:none",
    )
    .stl("margin-inline-start", `${PANEL_WIDTH}px`)
    .stl("width", `calc(100% - ${PANEL_WIDTH}px)`)
    .att("oncontextmenu", "return false;");
$("head").append(`<style>
    .dge-panel, .dge-bar, .dge-hint, .dge-ring, .dge-complete { font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2937; }
    .dge-panel { position: fixed; inset-block: 0; inset-inline-start: 0; width: ${PANEL_WIDTH}px; box-sizing: border-box; padding: 52px 0 12px; overflow: auto; background: #fff; border-inline-end: 1px solid #e5e7eb; z-index: 10; }
    .dge-row { display: block; width: 100%; box-sizing: border-box; padding: 5px 14px; border: 0; border-block-end: 1px solid #f1f5f9; background: none; font: 13.5px/1.5 ui-monospace, Menlo, Consolas, monospace; color: inherit; outline: none; }
    .dge-row:focus { background: #eff6ff; box-shadow: inset 3px 0 #2563eb; }
    .dge-row.dge-hover { background: #fef3c7; }
    .dge-row.dge-new { animation: dge-new 1.2s ease-out; }
    .dge-row.dge-error { box-shadow: inset 3px 0 #dc2626; background: #fef2f2; }
    .dge-row[readonly] { color: #9ca3af; }
    .dge-row.dge-hidden { color: #9ca3af; font-style: italic; }
    .dge-input { margin-block-start: 6px; }
    @keyframes dge-new { from { background: #bbf7d0; } }
    .dge-bar { position: fixed; top: 8px; inset-inline-start: 8px; display: flex; gap: 4px; z-index: 11; }
    .dge-bar button { padding: 5px 10px; border: 1px solid #d1d5db; border-radius: 7px; background: #fff; font: inherit; color: inherit; cursor: pointer; }
    .dge-bar button:hover { background: #f3f4f6; }
    .dge-bar button:disabled { opacity: 0.4; cursor: default; }
    .dge-hint { position: fixed; bottom: 16px; left: calc(50% + ${PANEL_WIDTH / 2}px); transform: translateX(-50%); max-width: calc(100% - ${PANEL_WIDTH + 32}px); padding: 7px 14px; border-radius: 9px; background: rgb(17 24 39 / 0.86); color: #f9fafb; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13.5px; white-space: pre-wrap; z-index: 11; pointer-events: none; }
    .dge-hint:empty { display: none; }
    .dge-hint.dge-error { background: #b91c1c; }
    .dge-hint button { width: 30px; height: 30px; margin: -4px -8px -4px 10px; padding: 0; border: 0; border-radius: 50%; background: rgb(255 255 255 / 0.18); color: inherit; font-size: 15px; vertical-align: middle; cursor: pointer; pointer-events: auto; }
    .dge-hint button:hover { background: rgb(255 255 255 / 0.32); }
    .dge-ring { position: fixed; width: 0; height: 0; z-index: 12; }
    .dge-ring button { position: absolute; width: ${2 * RING_BUTTON}px; height: ${2 * RING_BUTTON}px; margin: -${RING_BUTTON}px; padding: 7px; border: 1px solid #d1d5db; border-radius: 50%; background: #fff; color: #1f2937; box-shadow: 0 2px 8px rgb(0 0 0 / 0.15); cursor: pointer; }
    .dge-ring button:hover { background: #2563eb; color: #fff; border-color: #2563eb; }
    .dge-ring .dge-sectors { position: absolute; overflow: visible; fill: none; stroke-width: ${2 * RING_BUTTON + 12}px; stroke-linecap: round; pointer-events: none; }
    .dge-ring .dge-tie { stroke: #f59e0b; stroke-width: 2px; stroke-dasharray: 2 5; }
    .dge-ring button svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .dge-complete { position: fixed; min-width: 160px; max-height: 240px; overflow: auto; padding: 4px 0; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; box-shadow: 0 6px 20px rgb(0 0 0 / 0.14); z-index: 13; }
    .dge-complete div { padding: 3px 12px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13px; cursor: pointer; }
    .dge-complete div.dge-selected, .dge-complete div:hover { background: #2563eb; color: #fff; }
    .dge-complete:empty { display: none; }
    svg .dge-hover { filter: drop-shadow(0 0 2px #f59e0b) drop-shadow(0 0 3px #f59e0b); }
    svg .dge-ok { filter: drop-shadow(0 0 2px #16a34a) drop-shadow(0 0 2px #16a34a); }
    svg .dge-preview { opacity: 0.55; }
</style>`);

// ************************** LAYOUT ******************************

const panel = $.create("div").cls("dge-panel");
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
function button(key: MessageKey, action: () => void): DOMElement {
    const element = $.create("button").text(message(key));
    element.on("click", action);
    return element;
}
const undoButton = button("undo", () => travel(-1));
const redoButton = button("redo", () => travel(1));
const fileInput = $.create("input")
    .att("type", "file")
    .att("accept", ".dgo,.dgp,.ggb");
$("body").add(
    panel.add(rowsBox, input),
    $.create("div")
        .cls("dge-bar")
        .add(
            button("open", () => (fileInput.dom() as HTMLInputElement).click()),
            button("save", save),
            undoButton,
            redoButton,
        ),
    hint,
    ring,
    complete,
);
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
let hovered: construction_object | null = null;
let accepted: construction_object[] = [];
let completions: { label: string; insert: string }[] = [];
let selected = -1;
let figureName = "figure";

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

function showHint(text: string, error = false): void {
    hint.text(text).toggleClass("dge-error", error);
    if (pending) hint.add(cancelButton);
}

// ************************** TEXT ********************************

function refreshRows(): void {
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
            .toggleClass("dge-hidden", object.isHidden);
        (row.dom() as HTMLInputElement).value =
            line ?? `${formatName(object.name)} = …`;
        if (line === null)
            row.att("readonly", "").att("title", message("read_only"));
        else bindRow(row, object);
        row.on("mouseenter", () => highlight(object), false);
        row.on("mouseleave", () => highlight(null), false);
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
    const context = completionAt(field.value.slice(0, field.selectionStart!));
    completions = [];
    let candidates: construction_object[] = [];
    if (context?.kind === "command" && context.prefix)
        completions = commandsStarting(context.prefix).map((command) => ({
            label: `${commandName(command)}( )`,
            insert: `${commandName(command)}(`,
        }));
    else if (context?.kind === "argument") {
        const command = findCommand(context.command);
        const params = command
            ? command.overloads.flatMap(
                  (overload) => paramAt(overload, context.position) ?? [],
              )
            : [];
        candidates = figureObjects(scene()).filter((object) =>
            params.some((param) => accepts(object, param)),
        );
        const prefix = context.prefix.toLowerCase();
        completions = candidates
            .filter(({ name }) => name.toLowerCase().startsWith(prefix))
            .slice(0, 60)
            .map(({ name }) => ({
                label: formatName(name),
                insert: formatName(name),
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
    insertWord(field, completions[index].insert);
    updateCompletion(field);
}

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

function highlight(object: construction_object | null): void {
    if (object === hovered) return;
    if (hovered) {
        if (hovered.hasView) hovered.dom.removeClass("dge-hover");
        rows.get(hovered)?.removeClass("dge-hover");
    }
    hovered = object;
    if (object) {
        if (object.hasView) object.dom.addClass("dge-hover");
        rows.get(object)?.addClass("dge-hover");
    }
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

// The branch of their intersection nearest to `screen`, if near enough.
function nearestBranch(
    a: construction_object,
    b: construction_object,
    screen: Vec2,
): number | null {
    const c = scene();
    let best: { order: number; distance: number } | null = null;
    for (const order of [0, 1, 2, 3] as const) {
        const point = createOrderedIntersection(
            c,
            "‧i",
            a as never,
            b as never,
            order,
        );
        if (point.defined && point.projectionDefined) {
            const [x, y] = c.pt3D(point.coords);
            const distance = Math.hypot(x - screen[0], y - screen[1]);
            if (
                distance <= 2 * PICK_RADIUS &&
                (!best || distance < best.distance)
            )
                best = { order, distance };
        }
        c.removeObject(point);
    }
    return best && best.order;
}

// The point a designation there gives: the point under it, or a new one,
// at the intersection of two objects, on one, or free.
function designatePoint(screen: Vec2, hits: Hit[]): construction_object | null {
    const c = scene();
    if (hits[0] && hits[0].object instanceof point_object)
        return hits[0].object;
    const curves = hits.filter(({ object }) =>
        accepts(object, "intersectable"),
    );
    if (curves.length >= 2) {
        const [a, b] = curves.map(({ object }) => object);
        const order = nearestBranch(a, b, screen);
        if (order !== null)
            return add(c, {
                name: nextName(c, true),
                overload: findCommand("Intersection")!.overloads[1],
                args: [a, b, order + 1],
            });
    }
    const support = hits.find(({ object }) => accepts(object, "support"));
    if (support)
        return addPointOn(c, nextName(c, true), support.object, support.at);
    return addFreePoint(screen);
}

function nextSlot({ tool, args } = pending!): number {
    if (tool.overload!.variadic) return args.length;
    return args.findIndex((arg) => arg === undefined);
}

// The tool's arguments, the object designated first.
function firstArgs(
    tool: Tool,
    object: construction_object,
): (Arg | undefined)[] {
    if (tool.mode !== "command") return [object];
    const { params, variadic } = tool.overload!;
    const args: (Arg | undefined)[] = variadic
        ? []
        : Array(params.length).fill(undefined);
    args[params.findIndex((param) => accepts(object, param))] = object;
    return args;
}

// The line the tool writes, its missing arguments elided, and what remains
// to designate.
function describe(tool: Tool, args: (Arg | undefined)[]): string {
    if (tool.mode === "delete")
        return `${formatArg(args[0]!)} =\n${message("delete")}`;
    const point = tool.mode !== "command" || isPointTag(tool.overload!.tag);
    const shown = args.map((arg) => (arg === undefined ? "…" : formatArg(arg)));
    if (tool.mode !== "command" || tool.overload!.variadic) shown.push("…");
    const line = `${formatName(nextName(scene(), point))} = ${commandName(tool.command!)}(${shown.join(", ")})`;
    if (tool.mode === "point") return line;
    if (tool.mode === "intersection")
        return `${line}\n${message("designate", message("intersectable"))}`;
    if (tool.overload!.variadic && args.length >= 3)
        return `${line}\n${message("polygon_end")}`;
    const param = paramAt(tool.overload!, nextSlot({ tool, args }))!;
    return `${line}\n${message("designate", message(param as MessageKey))}`;
}

function prompt(): void {
    showHint(pending ? describe(pending.tool, pending.args) : "");
}

const onRing = (slot: number): Vec2 => {
    const angle = -Math.PI / 2 + (2 * Math.PI * slot) / RING_SLOTS;
    return [RING_RADIUS * Math.cos(angle), RING_RADIUS * Math.sin(angle)];
};

function openRing(hit: Hit, client: Vec2): void {
    const tools = toolsFor(hit.object, vec3());
    // Each family's sector, even its places without a tool for the object.
    const sectors = [...new Set(tools.map(({ family }) => family))]
        .map(({ hue, first, last }) => {
            const [x0, y0] = onRing(first);
            const [x1, y1] = onRing(last);
            return `<path d="M${x0} ${y0}A${RING_RADIUS} ${RING_RADIUS} 0 0 1 ${x1} ${y1}" style="stroke:hsl(${hue} 70% 50% / 0.2)"/>`;
        })
        .join("");
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
    const tie = dx || dy ? `<path class="dge-tie" d="M0 0L${dx} ${dy}"/>` : "";
    ring.inner(
        `<svg class="dge-sectors" width="1" height="1">${sectors}${tie}</svg>`,
    )
        .stl("left", `${left}px`)
        .stl("top", `${top}px`);
    tools.forEach((tool) => {
        const [x, y] = onRing(tool.slot);
        const item = $.create("button")
            .att(
                "aria-label",
                tool.command ? commandName(tool.command) : message("delete"),
            )
            .stl("left", `${x}px`)
            .stl("top", `${y}px`)
            .stl("border-color", `hsl(${tool.family.hue} 60% 55%)`)
            .append(`<svg viewBox="0 0 24 24">${tool.icon}</svg>`);
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
            if (pending)
                aim = {
                    button: [box.x + box.width / 2, box.y + box.height / 2],
                };
        });
        ring.add(item);
    });
    ring.show();
    highlight(hit.object);
}

function closeRing(): void {
    ring.hide().inner("");
    if (!pending) showHint("");
}

function choose(tool: Tool, { object, at }: Hit): void {
    const c = scene();
    if (tool.mode === "delete") {
        c.removeObject(object);
        return done();
    }
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
    if (tool.overload!.variadic || args.includes(undefined)) return prompt();
    build(tool.overload!, args as Arg[]);
}

function build(overload: Overload, args: Arg[]): void {
    clearPreview();
    const c = scene();
    const point = isPointTag(overload.tag);
    done(add(c, { name: nextName(c, point), overload, args }));
}

function designate(screen: Vec2, hits: Hit[]): void {
    const { tool, args } = pending!;
    if (tool.mode === "intersection") {
        const hit = hits.find(
            ({ object }) =>
                object !== args[0] && accepts(object, "intersectable"),
        );
        if (!hit) return;
        const order =
            nearestBranch(args[0] as construction_object, hit.object, screen) ??
            0;
        return build(tool.overload!, [args[0]!, hit.object, order + 1]);
    }
    const overload = tool.overload!;
    const param = paramAt(overload, nextSlot())!;
    if (overload.variadic && args.length >= 3 && hits[0]?.object === args[0])
        return build(overload, args as Arg[]);
    let arg: construction_object | null;
    if (param === "point") {
        clearPreview();
        arg = designatePoint(screen, hits);
        if (arg && arg !== hits[0]?.object) changed(arg);
    } else
        arg = hits.find(({ object }) => accepts(object, param))?.object ?? null;
    if (!arg) return;
    if (overload.variadic) args.push(arg);
    else args[nextSlot()] = arg;
    proceed();
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

// What the tool would build, its next argument being under the pointer.
function updatePreview(screen: Vec2, hits: Hit[]): void {
    if (!pending || pending.tool.mode !== "command") return clearPreview();
    const { tool, args } = pending;
    const overload = tool.overload!;
    const slot = nextSlot();
    // After the next one.
    const missing = overload.variadic
        ? overload.params.length - args.length - 1
        : args.filter((arg) => arg === undefined).length - 1;
    const stand = missing === 1 && STAND_INS[overload.tag];
    if (missing > 0 && !stand) return clearPreview();
    const param = paramAt(overload, slot)!;
    const hit = hits.find(({ object }) => accepts(object, param));
    const candidate =
        hit?.object ?? (param === "point" ? ("pointer" as const) : null);
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

function cancel(): void {
    pending = null;
    aim = null;
    clearPreview();
    closeRing();
    showHint("");
}

function done(object?: construction_object): void {
    pending = null;
    clearPreview();
    highlight(null);
    showAccepted([]);
    changed(object);
}

// After a change of the figure: its text, and a step to undo.
function changed(object?: construction_object): void {
    scene().flush();
    void record().then(() => {
        refreshRows();
        const row = object && rows.get(object);
        if (row) {
            row.addClass("dge-new").dom().scrollIntoView({ block: "nearest" });
            setTimeout(() => row.removeClass("dge-new"), 1200);
        }
        if (pending) prompt();
        else showHint(row ? (row.dom() as HTMLInputElement).value : "");
    });
}

// ************************** POINTER *****************************

let down: { x: number; y: number; time: number } | null = null;
let dragFrame: number | null = null;
// A pointer pressed while a tool waits: it aims and designates where it's
// released, unless still on the button that chose the tool.
let aim: { button: Vec2 | null } | null = null;

const aiming = (event: PointerEvent): boolean =>
    inFigure(event) &&
    !(
        aim?.button &&
        Math.hypot(
            event.clientX - aim.button[0],
            event.clientY - aim.button[1],
        ) <= RING_BUTTON
    );

// What the pointer designates there.
function follow(event: PointerEvent): void {
    if (!aiming(event)) {
        clearPreview();
        return highlight(null);
    }
    const c = scene();
    const screen = c.pointerPosition(event);
    const hits = pick(c, screen, previewed());
    if (pending) updatePreview(screen, hits);
    if (ring.isHidden()) highlight(hits[0]?.object ?? null);
}

$("body").on(
    "pointerdown",
    (event) => {
        if (!inFigure(event) || !event.isPrimary) return;
        down = { x: event.clientX, y: event.clientY, time: performance.now() };
        const c = scene();
        const screen = c.pointerPosition(event);
        const field = editing();
        if (field) {
            const [hit] = pick(c, screen);
            if (!hit) return;
            insertWord(field, formatName(hit.object.name));
            updateCompletion(field);
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
        if (inFigure(event) && editing() && !down) event.preventDefault();
    },
    { capture: true, prevent: false },
);

$("body").on(
    "pointermove",
    (event) => {
        if (!event.isPrimary || (!aim && !inFigure(event))) return;
        if (event.buttons && !aim) {
            dragFrame ??= requestAnimationFrame(() => {
                dragFrame = null;
                updateRows();
            });
            return;
        }
        follow(event);
    },
    { capture: true, prevent: false, passive: true },
);

$("body").on(
    "pointerup",
    (event) => {
        if (!event.isPrimary) return;
        if (aim) {
            const designates = aiming(event);
            aim = null;
            if (designates) {
                const c = scene();
                const screen = c.pointerPosition(event);
                designate(screen, pick(c, screen, previewed()));
            }
            // A finger lifted no longer shows what it would designate.
            if (event.pointerType === "touch") {
                clearPreview();
                highlight(null);
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
        if (!ring.isHidden()) return closeRing();
        const c = scene();
        const screen = c.pointerPosition(event);
        const hits = pick(c, screen, previewed());
        if (hits[0]) return openRing(hits[0], [event.clientX, event.clientY]);
        const point = addFreePoint(screen);
        if (point) done(point);
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
        } else if (editing()) return;
        else if (command && event.key.toLowerCase() === "z") {
            event.preventDefault();
            travel(event.shiftKey ? 1 : -1);
        } else if (command && event.key.toLowerCase() === "y") {
            event.preventDefault();
            travel(1);
        } else if (event.key === "Escape") cancel();
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
        const figure = await describeDgo(scene());
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
        refreshRows();
    });
}

// ************************** FILES *******************************

async function save(): Promise<void> {
    const href = URL.createObjectURL(await writeDgo(scene()));
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
    cancel();
    studio.scene.dispose();
    studio.scene = construction.create(studio);
    const unsupported = await load(studio.scene);
    studio.scene.flush();
    studio.scene.reveal();
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
