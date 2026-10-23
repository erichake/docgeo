import { construction, type DgpadLike } from "./construction";
import { describeDgo, readDgo, type Region } from "./dgo";
import { $ } from "./dom";
import { DIR, t } from "./i18n";

// index.html?fit=…&url=…: the figure in a web page's iframe, the region the
// editor framed scaled to fit the window (see EMBED.md, "Page web").

export interface Fitted extends DgpadLike {
    scene: construction;
}

$("head").append(`<style>
    .docgeo-fit-bar { position: fixed; top: 6px; inset-inline-end: 6px; z-index: 2; display: flex; gap: 2px; padding: 2px; border-radius: 8px; background: rgb(255 255 255 / 0.9); box-shadow: 0 1px 3px rgb(0 0 0 / 0.25); opacity: 0; transition: opacity 0.2s; }
    body:hover .docgeo-fit-bar, .docgeo-fit-bar:focus-within { opacity: 1; }
    @media (hover: none) { .docgeo-fit-bar { opacity: 0.8; } }
    .docgeo-fit-bar > * { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 6px; background: none; color: #475569; cursor: pointer; }
    .docgeo-fit-bar > :hover { background: #e2e8f0; color: #1d4ed8; }
    .docgeo-fit-bar svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
</style>`);

const ICONS = {
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    fullscreen:
        '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    edit_figure:
        '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
};

// `value`, as the editor writes it: the region's size and place w,h,x,y,
// then the view framed: origin ox,oy, unit u and, in 3D, the camera's
// angles θ,φ. Otherwise, the window the figure was saved with.
function framing(c: construction, value: string): Region {
    const numbers = value.split(",").map(Number);
    const grid = c.GRID;
    if (
        (numbers.length === 7 || numbers.length === 9) &&
        numbers.every(Number.isFinite) &&
        numbers[0] > 0 &&
        numbers[1] > 0 &&
        numbers[6] > 0
    ) {
        const [w, h, x, y, ox, oy, u, theta, phi] = numbers;
        grid.ORG = [ox, oy];
        grid.UNIT = [u, u, u];
        if (theta !== undefined) {
            grid.THETA = theta;
            grid.PHI = phi;
        }
        c.invalidateProjection();
        c.flush();
        return { x, y, w, h };
    }
    const [w, h] = c.savedSize ?? [c.width, c.height];
    // Where readDgo and DGPad's import put it.
    return grid.is2D || grid.FRAME2D
        ? { x: 0, y: 0, w, h }
        : {
              x: Math.round((c.width - w) / 2),
              y: Math.round((c.height - h) / 2),
              w,
              h,
          };
}

// The figure opened in `app` becomes the one the page shows, its region
// as large as the window allows, centered.
export async function fitFigure(app: Fitted, value: string): Promise<void> {
    const region = framing(app.scene, value);
    const { w, h } = region;
    const figure = await describeDgo(app.scene, region);
    const body = $("body");
    const place = (): void => {
        const [width, height] = [body.width(), body.height()];
        const scale = Math.min(width / w, height / h);
        app.scene.svg
            .stl("left", `${(width - w * scale) / 2}px`)
            .stl("top", `${(height - h * scale) / 2}px`)
            .stl("width", `${w * scale}px`)
            .stl("height", `${h * scale}px`);
    };
    const build = (): void => {
        app.scene.dispose();
        app.scene = construction.create(app);
        app.scene.fixedSize = [w, h];
        app.scene.svg.att("viewBox", `0 0 ${w} ${h}`);
        readDgo(app.scene, figure, true);
        app.scene.flush();
        place();
        body.stl("background", app.prefs.background.color);
        app.scene.reveal();
    };
    build();
    body.observeResize(place);

    const search = new URLSearchParams(location.search);
    if (search.has("nobar")) return;
    const bar = $.create("div").cls("docgeo-fit-bar").att("dir", DIR);
    const action = (key: keyof typeof ICONS, run: () => void): void => {
        const button = $.create("button")
            .att("type", "button")
            .att("title", t(key))
            .att("aria-label", t(key))
            .append(`<svg viewBox="0 0 24 24">${ICONS[key]}</svg>`);
        button.on("click", run, false);
        bar.add(button);
    };
    action("reset", build);
    // Only where the page's iframe allows it (allow="fullscreen").
    if (document.fullscreenEnabled)
        action(
            "fullscreen",
            () =>
                void (document.fullscreenElement
                    ? document.exitFullscreen()
                    : document.documentElement.requestFullscreen()),
        );
    if (!search.has("noedit"))
        // The editor reads the same url, and lang, ignoring the rest.
        action("edit_figure", () =>
            window.open(`editor.html${location.search}`, "_blank", "noopener"),
        );
    body.add(bar);
}
