import { $, type DOMElement } from "../dom";
import { DIR } from "../i18n";
import type { Macro } from "../objects/macro_object";
import { message } from "./messages";
import {
    itemLabel,
    macroIcon,
    TOOL_FAMILIES,
    usable,
    type Family,
    type Item,
} from "./tools";
import "./palette.css";

// The geometric tools at hand, by family, in the properties' place: see
// EDITOR.md, « Palette d'outils ».

export type Entry = Item | Macro;

const FOLDED = "docgeo-palette-folded";

const svg = (icon: string) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`;

export function toolPalette(host: {
    vec3: () => boolean;
    macros: () => Macro[];
    // Whether it takes the objects chosen.
    takes: (entry: Entry) => boolean;
    inHand: (entry: Entry) => boolean;
    choose: (entry: Entry) => void;
    // Hovered, or left.
    hover: (entry: Entry | null) => void;
    close: () => void;
}) {
    const panel = $.create("aside")
        .cls("dge-palette")
        .att("dir", DIR)
        .att("id", "dge-palette")
        .att("aria-label", message("palette"));
    const close = $.create("button")
        .cls("dge-action")
        .att("type", "button")
        .att("aria-label", message("close_palette"))
        .att("title", message("close_palette"))
        .append(svg('<path d="m6 6 12 12M6 18 18 6"/>'));
    close.on("click", host.close);
    const zones = $.create("div");
    panel.add(
        $.create("div")
            .cls("dge-panel-header")
            .add($.create("h2").text(message("palette")), close),
        zones,
    );
    let folded: string[] = [];
    try {
        folded = JSON.parse(localStorage.getItem(FOLDED) ?? "[]");
    } catch {
        // Refused: unfolded, for this page.
    }
    const buttons = new Map<DOMElement, Entry>();
    // What the zones show: the view, and the figure's macros.
    let shown = "";

    function zone(family: Family, entries: [Entry, string, string][]): void {
        const name = message(family.name);
        const open = !folded.includes(family.name);
        const title = $.create("button")
            .cls("dge-palette-title")
            .att("type", "button")
            .att("aria-expanded", String(open))
            .append(svg('<path d="m6 9 6 6 6-6"/>'))
            .add($.create("span").text(name));
        title.on("click", () => {
            const on = title.getAtt("aria-expanded") === "false";
            title.att("aria-expanded", String(on));
            folded = on
                ? folded.filter((other) => other !== family.name)
                : [...folded, family.name];
            try {
                localStorage.setItem(FOLDED, JSON.stringify(folded));
            } catch {
                // Refused: kept for this page.
            }
        });
        const grid = $.create("div")
            .cls("dge-palette-grid")
            .att("role", "group")
            .att("aria-label", name);
        entries.forEach(([entry, icon, label]) => {
            const button = $.create("button")
                .att("type", "button")
                .att("title", label)
                .att("aria-label", label)
                .append(svg(icon));
            button.on("pointerenter", () => host.hover(entry), false);
            button.on("pointerleave", () => host.hover(null), false);
            button.on("click", () => {
                if (!button.dom().classList.contains("dge-off"))
                    host.choose(entry);
            });
            buttons.set(button, entry);
            grid.add(button);
        });
        zones.add(
            $.create("section")
                .cls("dge-palette-zone")
                .stl("--dge-hue", `${family.hue}`)
                .stl("--dge-tone", `${family.tone}`)
                .add(title, grid),
        );
    }

    // Built again when the view or the macros change, the states each time.
    function refresh(): void {
        const vec3 = host.vec3();
        const macros = host.macros();
        const now = `${vec3}${macros.map(({ name, icon }) => `\n${name} ${icon}`)}`;
        if (now !== shown) {
            shown = now;
            buttons.clear();
            zones.inner("");
            TOOL_FAMILIES.forEach((family) => {
                if (family.name === "family_programs") return;
                const entries: [Entry, string, string][] =
                    family.name === "family_macros"
                        ? macros.map((macro) => [
                              macro,
                              macroIcon(macro),
                              macro.name,
                          ])
                        : family.items.flatMap((item) => {
                              const tool = item.tools.find((tool) =>
                                  usable(tool, vec3),
                              );
                              return tool
                                  ? [[item, tool.icon, itemLabel(item)]]
                                  : [];
                          });
                if (entries[0]) zone(family, entries);
            });
        }
        buttons.forEach((entry, button) => {
            const off = !host.takes(entry);
            const on = host.inHand(entry);
            button
                .toggleClass("dge-off", off)
                .toggleClass("dge-armed", on)
                .att("aria-disabled", String(off))
                .att("aria-pressed", String(on));
        });
    }

    return { panel, refresh };
}
