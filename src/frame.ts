import type { Region } from "./dgo";
import { $, type DOMElement, type PointerDelta } from "./dom";

// A screenshot-like frame over the figure, which stays manipulable inside
// and outside it: only its edges, corners and size label take the pointer.
// Only the visible handles resize it: the rest of its edges moves it.

const MIN_SIZE = 40;
const HANDLES = ["n", "e", "s", "w", "ne", "nw", "se", "sw"];
const EDGES = ["n", "e", "s", "w"];

$("head").append(`<style>
    .docgeo-frame { position: fixed; z-index: 1; pointer-events: none; outline: 1px solid rgb(255 255 255 / 0.9); box-shadow: 0 0 0 1px rgb(0 0 0 / 0.5), 0 0 0 100vmax rgb(0 0 0 / 0.35); }
    .docgeo-frame > * { position: absolute; pointer-events: auto; touch-action: none; }
    .docgeo-frame [data-handle] { width: 24px; height: 24px; }
    .docgeo-frame [data-edge] { cursor: move; }
    .docgeo-frame [data-edge="n"], .docgeo-frame [data-edge="s"] { left: 12px; right: 12px; height: 12px; }
    .docgeo-frame [data-edge="e"], .docgeo-frame [data-edge="w"] { top: 12px; bottom: 12px; width: 12px; }
    .docgeo-frame [data-handle="n"], .docgeo-frame [data-handle="s"] { left: calc(50% - 20px); width: 40px; height: 12px; cursor: ns-resize; }
    .docgeo-frame [data-handle="e"], .docgeo-frame [data-handle="w"] { top: calc(50% - 20px); width: 12px; height: 40px; cursor: ew-resize; }
    .docgeo-frame [data-handle="n"], .docgeo-frame [data-edge="n"] { top: -6px; }
    .docgeo-frame [data-handle="s"], .docgeo-frame [data-edge="s"] { bottom: -6px; }
    .docgeo-frame [data-handle="e"], .docgeo-frame [data-edge="e"] { right: -6px; }
    .docgeo-frame [data-handle="w"], .docgeo-frame [data-edge="w"] { left: -6px; }
    .docgeo-frame [data-handle="nw"] { top: -12px; left: -12px; cursor: nwse-resize; }
    .docgeo-frame [data-handle="ne"] { top: -12px; right: -12px; cursor: nesw-resize; }
    .docgeo-frame [data-handle="sw"] { bottom: -12px; left: -12px; cursor: nesw-resize; }
    .docgeo-frame [data-handle="se"] { bottom: -12px; right: -12px; cursor: nwse-resize; }
    .docgeo-frame [data-handle]::after { content: ""; position: absolute; inset: 0; margin: auto; width: 8px; height: 8px; border: 1px solid rgb(0 0 0 / 0.5); border-radius: 2px; background: #fff; }
    .docgeo-frame [data-handle="n"]::after, .docgeo-frame [data-handle="s"]::after { width: 24px; height: 4px; }
    .docgeo-frame [data-handle="e"]::after, .docgeo-frame [data-handle="w"]::after { width: 4px; height: 24px; }
    .docgeo-frame-size { left: 50%; bottom: calc(100% + 8px); display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 6px; background: rgb(0 0 0 / 0.72); color: #fff; font: 500 12px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; font-variant-numeric: tabular-nums; white-space: nowrap; transform: translateX(-50%); cursor: move; user-select: none; }
    .docgeo-frame-size.inside { top: 8px; bottom: auto; }
    .docgeo-frame-size svg { width: 14px; height: 14px; }
</style>`);

let shown: {
    region: Region;
    element: DOMElement;
    size: DOMElement;
} | null = null;

// Keeps the frame within the window.
let resized: (() => void) | null = null;
$("body").observeResize(() => resized?.());

const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max);

const windowSize = (): [number, number] => {
    const body = $("body");
    return [Math.floor(body.width()), Math.floor(body.height())];
};

// The region a handle's drag leads to from `start`, within the window.
function dragged(
    start: Region,
    handle: string,
    [dx, dy]: PointerDelta,
): Region {
    const [width, height] = windowSize();
    let { x, y, w, h } = start;
    if (handle === "move")
        return {
            x: clamp(Math.round(x + dx), 0, width - w),
            y: clamp(Math.round(y + dy), 0, height - h),
            w,
            h,
        };
    if (handle.includes("w")) {
        const left = clamp(Math.round(x + dx), 0, x + w - MIN_SIZE);
        w += x - left;
        x = left;
    }
    if (handle.includes("e"))
        w = clamp(Math.round(w + dx), MIN_SIZE, width - x);
    if (handle.includes("n")) {
        const top = clamp(Math.round(y + dy), 0, y + h - MIN_SIZE);
        h += y - top;
        y = top;
    }
    if (handle.includes("s"))
        h = clamp(Math.round(h + dy), MIN_SIZE, height - y);
    return { x, y, w, h };
}

// Within the window, as large as it allows.
function fitted({ x, y, w, h }: Region): Region {
    const [width, height] = windowSize();
    w = clamp(w, Math.min(MIN_SIZE, width), width);
    h = clamp(h, Math.min(MIN_SIZE, height), height);
    return { x: clamp(x, 0, width - w), y: clamp(y, 0, height - h), w, h };
}

// In the body's coordinates, where the editor's bars and panel leave it.
function place(region: Region): void {
    const { element, size } = shown!;
    const { left, top } = $("body").dom().getBoundingClientRect();
    shown!.region = region;
    element
        .stl("left", `${left + region.x}px`)
        .stl("top", `${top + region.y}px`)
        .stl("width", `${region.w}px`)
        .stl("height", `${region.h}px`);
    size.find("span")!.text(`${region.w} × ${region.h}`);
    // Above the frame, unless the window's top edge is too close.
    size.toggleClass("inside", region.y < 40);
}

// Centered in the window, as readDgo centers a saved region.
export function showFrame(
    w: number,
    h: number,
    changed: (region: Region) => void,
): void {
    hideFrame();
    const [width, height] = windowSize();
    const element = $.create("div").cls("docgeo-frame");
    const size = $.create("div")
        .cls("docgeo-frame-size")
        .append(
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/></svg><span></span>`,
        );
    // The edges come first, so that the handles lie over them.
    const grips: [DOMElement, string][] = [
        ...EDGES.map((edge): [DOMElement, string] => [
            $.create("div").att("data-edge", edge),
            "move",
        ]),
        ...HANDLES.map((handle): [DOMElement, string] => [
            $.create("div").att("data-handle", handle),
            handle,
        ]),
        [size, "move"],
    ];
    shown = { region: { x: 0, y: 0, w, h }, element, size };
    grips.forEach(([item, handle]) => {
        let start = shown!.region;
        let total: [number, number] = [0, 0];
        item.drag(
            (_, [dx, dy]) => {
                total = [total[0] + dx, total[1] + dy];
                place(dragged(start, handle, total));
            },
            () => {
                start = shown!.region;
                total = [0, 0];
            },
            () => changed(shown!.region),
        );
    });
    $("body").add(element.add(...grips.map(([item]) => item)));
    place(
        fitted({
            x: Math.round((width - w) / 2),
            y: Math.round((height - h) / 2),
            w,
            h,
        }),
    );
    resized = () => {
        const region = fitted(shown!.region);
        const same = JSON.stringify(region) === JSON.stringify(shown!.region);
        place(region);
        if (!same) changed(region);
    };
}

export function hideFrame(): void {
    shown?.element.dispose();
    shown = null;
    resized = null;
}

export function frameRegion(): Region | null {
    return shown?.region ?? null;
}
