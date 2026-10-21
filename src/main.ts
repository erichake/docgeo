import { construction } from "./construction";
import { importDgoFromBlob, importDgoFromUrl, writeDgo } from "./dgo";
import { importDgp, importDgpFromUrl } from "./dgp_importer";
import { $, type DOMElement } from "./dom";
import { dropFigures } from "./drop";
import { embed } from "./embed";
import { importGgbFromBlob, importGgbFromUrl } from "./ggb_importer";
import { DIR, t } from "./i18n";
import { preferences } from "./preferences";

class docgeo {
    prefs: preferences;
    scene: construction;

    constructor() {
        this.document();
        this.prefs = new preferences();
        this.scene = construction.create(this);
    }

    document(): void {
        $("html").stl("width:100%;height:100%");
        $("body")
            .stl(
                "width:100%;height:100%;margin:0;overflow:hidden;touch-action:none",
            )
            .att("oncontextmenu", "return false;");
    }
}

export const DOCGEO = new docgeo();
$("head").append(`<style>
    .docgeo-picker { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; padding: 16px; background: #f4f5f7; }
    .docgeo-picker, .docgeo-notice { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2937; }
    .docgeo-open { display: flex; align-items: center; gap: 14px; padding-block: 16px; padding-inline: 22px 28px; border: 0; border-radius: 12px; background: #2563eb; color: #fff; font: inherit; text-align: start; cursor: pointer; box-shadow: 0 1px 2px rgb(0 0 0 / 0.08), 0 8px 24px rgb(37 99 235 / 0.25); transition: background 0.15s, box-shadow 0.15s, transform 0.15s; }
    .docgeo-open:hover { background: #1d4ed8; box-shadow: 0 1px 2px rgb(0 0 0 / 0.08), 0 12px 32px rgb(37 99 235 / 0.35); transform: translateY(-1px); }
    .docgeo-open:active { transform: translateY(0); }
    .docgeo-open:focus-visible { outline: 3px solid #93c5fd; outline-offset: 3px; }
    .docgeo-open svg { width: 30px; height: 30px; flex: none; }
    .docgeo-open span { display: flex; flex-direction: column; gap: 2px; }
    .docgeo-open strong { font-size: 17px; font-weight: 600; }
    .docgeo-open small { font-size: 13px; opacity: 0.8; }
    .docgeo-error, .docgeo-notice { box-sizing: border-box; max-width: min(560px, 100%); padding: 14px 18px; border-inline-start: 4px solid; border-radius: 10px; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px rgb(0 0 0 / 0.08); font-size: 14px; line-height: 1.45; }
    .docgeo-error { border-color: #dc2626; }
    .docgeo-notice { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); width: calc(100% - 32px); border-color: #d97706; }
    .docgeo-error strong, .docgeo-notice strong { display: block; margin-block-end: 4px; font-size: 15px; }
    .docgeo-error strong { color: #b91c1c; }
    .docgeo-notice strong { color: #b45309; padding-inline-end: 24px; }
    .docgeo-error code, .docgeo-notice ul { display: block; margin: 8px 0 0; padding: 8px 10px; border-radius: 6px; background: #f3f4f6; font: 12.5px/1.5 ui-monospace, Menlo, Consolas, monospace; overflow-wrap: anywhere; }
    .docgeo-notice ul { max-height: 30vh; overflow: auto; list-style: none; }
    .docgeo-notice button { position: absolute; top: 8px; inset-inline-end: 8px; width: 28px; height: 28px; border: 0; border-radius: 6px; background: none; color: #6b7280; font-size: 20px; line-height: 1; cursor: pointer; }
    .docgeo-notice button:hover { background: #f3f4f6; color: #1f2937; }
</style>`);

// The open figure's name, which a save keeps.
let figureName: string | null = null;

// While the picker is shown, what a dropped file is handed to.
let picked: ((file: File) => Promise<void>) | null = null;

// Rather than the browser saving the page.
$("body").on(
    "keydown",
    (event) => {
        if (
            !(event.metaKey || event.ctrlKey) ||
            event.key.toLowerCase() !== "s"
        )
            return;
        event.preventDefault();
        if (figureName) saveFigure(figureName);
    },
    false,
);

// In the embedded mode (see EMBED.md), the host page provides the figure,
// shows what couldn't be imported and saves it.
const search = new URLSearchParams(window.location.search);
const url = search.get("url");
export const DOCGEO_READY = search.has("embed")
    ? Promise.resolve(embed(DOCGEO))
    : url
      ? openFigure(url, () =>
            /\.ggb$/i.test(url)
                ? importGgbFromUrl(DOCGEO.scene, url)
                : /\.dgo$/i.test(url)
                  ? importDgoFromUrl(DOCGEO.scene, url)
                  : importDgpFromUrl(DOCGEO.scene, url),
        )
      : pickFigure();

// Outside the embedded mode, a figure file dropped on the page opens in
// place of the one shown.
if (!search.has("embed"))
    dropFigures((file) => void (picked ?? openFile)(file));

async function saveFigure(name: string): Promise<void> {
    const href = URL.createObjectURL(await writeDgo(DOCGEO.scene));
    (
        $.create("a")
            .att("href", href)
            .att("download", `${name}.dgo`)
            .dom() as HTMLAnchorElement
    ).click();
    setTimeout(() => URL.revokeObjectURL(href));
}

// Resolves once a figure is open, the user being offered to pick another
// one as long as it fails.
async function openFigure(
    name: string,
    load: () => Promise<string[]>,
): Promise<void> {
    let unsupported: string[];
    try {
        unsupported = await load();
    } catch (error) {
        // Discards what the failed import may have already built.
        DOCGEO.scene.dispose();
        DOCGEO.scene = construction.create(DOCGEO);
        return pickFigure(
            $.create("div")
                .cls("docgeo-error")
                .add(
                    $.create("strong").text(t("open_failed")),
                    $.create("div").text(name),
                    $.create("code").text((error as Error).message),
                ),
        );
    }
    DOCGEO.scene.reveal();
    figureName = name
        .split(/[/\\?#]/)
        .filter(Boolean)
        .pop()!
        .replace(/\.[^.]*$/, "");
    if (unsupported.length > 0) showUnsupported(unsupported);
}

// Opens a chosen or dropped file in place of the figure shown.
function openFile(file: File): Promise<void> {
    DOCGEO.scene.dispose();
    DOCGEO.scene = construction.create(DOCGEO);
    $("body")
        .findAll(".docgeo-notice")
        .forEach((notice) => notice.dispose());
    return openFigure(file.name, async () =>
        /\.ggb$/i.test(file.name)
            ? importGgbFromBlob(DOCGEO.scene, file)
            : /\.dgo$/i.test(file.name)
              ? importDgoFromBlob(DOCGEO.scene, file)
              : importDgp(DOCGEO.scene, await file.text()),
    );
}

// Browsers only open a file picker in response to a user gesture.
function pickFigure(error?: DOMElement): Promise<void> {
    return new Promise((resolve) => {
        const input = $.create("input")
            .att("type", "file")
            .att("accept", ".dgo,.dgp,.ggb");
        const button = $.create("button")
            .cls("docgeo-open")
            .append(
                `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10v6M9 13l3-3 3 3"/></svg>
                <span><strong>${t("open_figure")}</strong><small>${t("figure_formats")}</small></span>`,
            );
        // Hides the empty scene, 3D floor included, until a figure is chosen.
        const overlay = $.create("div").cls("docgeo-picker").att("dir", DIR);
        if (error) overlay.add(error);
        overlay.add(button);
        button.on("click", () => (input.dom() as HTMLInputElement).click());
        picked = async (file) => {
            picked = null;
            overlay.remove();
            await openFile(file);
            resolve();
        };
        input.on("change", () =>
            picked!((input.dom() as HTMLInputElement).files![0]),
        );
        $("body").add(overlay);
    });
}

function showUnsupported(unsupported: string[]): void {
    const notice = $.create("div").cls("docgeo-notice").att("dir", DIR);
    const close = $.create("button").att("aria-label", t("close")).text("×");
    close.on("click", () => notice.dispose());
    const list = $.create("ul");
    unsupported.forEach((item) => list.add($.create("li").text(item)));
    $("body").add(
        notice.add(
            close,
            $.create("strong").text(t("unsupported_title")),
            $.create("div").text(t("unsupported_text")),
            list,
        ),
    );
}
