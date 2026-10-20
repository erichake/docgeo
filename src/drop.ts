import { $ } from "./dom";
import { DIR, t } from "./i18n";

$("head").append(`<style>
    .docgeo-drop { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgb(244 245 247 / 0.7); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2937; opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 0.15s, visibility 0.15s; }
    .docgeo-drop.on { opacity: 1; visibility: visible; pointer-events: auto; }
    .docgeo-drop::before { content: ""; position: absolute; inset: 12px; border: 3px dashed #2563eb; border-radius: 18px; background: rgb(37 99 235 / 0.06); }
    .docgeo-drop div { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 28px 36px; border-radius: 16px; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 0.08), 0 12px 32px rgb(37 99 235 / 0.25); text-align: center; pointer-events: none; transform: scale(0.94); transition: transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.3); }
    .docgeo-drop.on div { transform: none; }
    .docgeo-drop svg { width: 60px; height: 60px; margin-block-end: 12px; padding: 15px; box-sizing: border-box; border-radius: 50%; background: #2563eb; color: #fff; box-shadow: 0 0 0 8px rgb(37 99 235 / 0.15); }
    .docgeo-drop g { animation: docgeo-drop 1.1s ease-in-out infinite; }
    .docgeo-drop strong { font-size: 17px; font-weight: 600; }
    .docgeo-drop small { font-size: 13px; color: #6b7280; }
    @keyframes docgeo-drop { 50% { transform: translateY(3px); } }
    @media (prefers-reduced-motion: reduce) { .docgeo-drop, .docgeo-drop div { transition: none; } .docgeo-drop g { animation: none; } }
</style>`);

// A figure file dropped on the page is handed to `open`, with its handle
// where the browser gives one, a veil showing where it can be dropped. Other
// drops, of text into a field, are left alone.
export function dropFigures(
    open: (file: File, from?: Promise<FileSystemHandle | null>) => void,
): void {
    const veil = $.create("div")
        .cls("docgeo-drop")
        .att("dir", DIR)
        .append(
            `<div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/><g><path d="M12 3v12M7 10l5 5 5-5"/></g></svg>
            <strong>${t("drop_figure")}</strong><small>${t("figure_formats")}</small></div>`,
        );
    const hasFiles = (event: DragEvent) =>
        event.dataTransfer!.types.includes("Files");
    $("body").add(veil);
    $("body").on(
        "dragenter",
        (event) => {
            if (hasFiles(event)) veil.addClass("on");
        },
        false,
    );
    $("body").on(
        "dragover",
        (event) => {
            if (hasFiles(event)) event.preventDefault();
        },
        false,
    );
    // The veil's content ignoring the pointer, it is only left with the window.
    veil.on("dragleave", () => veil.removeClass("on"), false);
    $("body").on(
        "drop",
        (event) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            veil.removeClass("on");
            // The handle is only given during the event.
            const item = [...event.dataTransfer!.items].find((item) =>
                /\.(dgo|dgp|ggb)$/i.test(item.getAsFile()?.name ?? ""),
            );
            if (item) open(item.getAsFile()!, item.getAsFileSystemHandle?.());
        },
        false,
    );
}
