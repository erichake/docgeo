import { $, type DOMElement } from "../dom";
import { DIR } from "../i18n";
import type { Macro } from "../objects/macro_object";
import { myMacros, sectionHue, shownMacros, type Library } from "./library";
import { message, type MessageKey } from "./messages";
import { FOLDER } from "./my_macros";
import {
    itemLabel,
    macroIcon,
    TOOL_FAMILIES,
    usable,
    type Family,
    type Item,
} from "./tools";
import "./palette.css";

// The tools at hand, by family, in the properties' place: see EDITOR.md,
// « Palette d'outils ».

export type Entry = Item | Macro;

const FOLDED = "docgeo-palette-folded";
const TAB = "docgeo-palette-tab";

const svg = (icon: string) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`;

export function toolPalette(host: {
    vec3: () => boolean;
    macros: () => Macro[];
    // Out of a frame only, with its tab.
    supplied: (() => Library) | null;
    // Whether it takes the objects chosen.
    takes: (entry: Entry, library?: Library) => boolean;
    inHand: (entry: Entry) => boolean;
    choose: (entry: Entry) => void;
    // Hovered, or left.
    hover: (entry: Entry | null, library?: Library) => void;
    newProgram: DOMElement;
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
    let macrosTab = false;
    if (host.supplied)
        try {
            macrosTab = localStorage.getItem(TAB) === "macros";
        } catch {
            // Refused: the tools, for this page.
        }
    const tabs = ([false, true] as const).map((macros) => {
        const tab = $.create("button")
            .att("type", "button")
            .att("role", "tab")
            .att("aria-selected", String(macros === macrosTab))
            .text(message(macros ? "menu_macros" : "menu_tools"));
        tab.on("click", () => {
            macrosTab = macros;
            tabs.forEach((other) =>
                other.att("aria-selected", String(other === tab)),
            );
            try {
                localStorage.setItem(TAB, macros ? "macros" : "tools");
            } catch {
                // Refused: kept for this page.
            }
            panel.dom().scrollTop = 0;
            refresh();
        });
        return tab;
    });
    panel.add(
        $.create("div")
            .cls("dge-panel-header")
            .add(
                host.supplied
                    ? $.create("div")
                          .cls("dge-palette-tabs")
                          .att("role", "tablist")
                          .add(...tabs)
                    : $.create("h2").text(message("palette")),
                close,
            ),
        zones,
    );
    let folded: string[] = [];
    try {
        folded = JSON.parse(localStorage.getItem(FOLDED) ?? "[]");
    } catch {
        // Refused: unfolded, for this page.
    }
    const buttons = new Map<DOMElement, [Entry, Library?]>();
    // What the zones show: the view and the figure's macros, or the libraries.
    let shown = "";

    function zone(
        key: string,
        name: string,
        { hue, tone }: Pick<Family, "hue" | "tone">,
        entries: [Entry, string, string][],
        library?: Library,
    ): void {
        const open = !folded.includes(key);
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
                ? folded.filter((other) => other !== key)
                : [...folded, key];
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
        if (key === "family_programs") grid.add(host.newProgram);
        entries.forEach(([entry, icon, label]) => {
            const button = $.create("button")
                .att("type", "button")
                .att("title", label)
                .att("aria-label", label)
                .append(svg(icon));
            button.on("pointerenter", () => host.hover(entry, library), false);
            button.on("pointerleave", () => host.hover(null), false);
            button.on("click", () => {
                if (!button.dom().classList.contains("dge-off"))
                    host.choose(entry);
            });
            buttons.set(button, [entry, library]);
            grid.add(button);
        });
        zones.add(
            $.create("section")
                .cls("dge-palette-zone")
                .stl("--dge-hue", `${hue}`)
                .stl("--dge-tone", `${tone}`)
                .add(title, grid),
        );
    }

    function toolZones(vec3: boolean, macros: Macro[]): void {
        TOOL_FAMILIES.forEach((family) => {
            const entries: [Entry, string, string][] = [
                ...family.items.flatMap((item): [Entry, string, string][] => {
                    const tool = item.tools.find((tool) => usable(tool, vec3));
                    return tool ? [[item, tool.icon, itemLabel(item)]] : [];
                }),
                ...(family.name === "family_macros" ? macros : []).map(
                    (macro): [Entry, string, string] => [
                        macro,
                        macroIcon(macro),
                        macro.name,
                    ],
                ),
            ];
            const name: MessageKey =
                family.name === "family_macros" ? "figure_macros" : family.name;
            if (entries[0]) zone(family.name, message(name), family, entries);
        });
    }

    // One zone by folder, in the library's order.
    function libraryZones(
        library: Library,
        indices: number[],
        title: (folder: string[]) => string[],
        hue: (folder: string[]) => number,
    ): void {
        const folders = new Map<string, number[]>();
        for (const index of indices) {
            const name = library.folders[index].join(FOLDER);
            folders.set(name, [...(folders.get(name) ?? []), index]);
        }
        folders.forEach((inside) => {
            const folder = library.folders[inside[0]];
            const name = title(folder).join(FOLDER);
            zone(
                `macros${FOLDER}${name}`,
                name,
                { hue: hue(folder), tone: 1 },
                inside.map((index) => {
                    const macro = library.macros[index];
                    return [macro, macroIcon(macro), macro.name];
                }),
                library,
            );
        });
    }

    // Built again when what it shows changes, the states each time.
    function refresh(): void {
        const vec3 = host.vec3();
        const macros = host.macros();
        const mine = macrosTab ? myMacros() : null;
        const supplied = macrosTab ? host.supplied!() : null;
        const now = mine
            ? JSON.stringify([mine, supplied!.macros.length])
            : `${vec3}${macros.map(({ name, icon }) => `\n${name} ${icon}`)}`;
        if (now !== shown) {
            shown = now;
            buttons.clear();
            zones.inner("");
            if (mine) {
                libraryZones(
                    mine,
                    shownMacros(mine, supplied!),
                    (folder) => [message("my_macros"), ...folder],
                    () => TOOL_FAMILIES.at(-1)!.hue,
                );
                libraryZones(
                    supplied!,
                    supplied!.macros.map((_, index) => index),
                    (folder) => folder,
                    (folder) => sectionHue(supplied!, folder),
                );
            } else toolZones(vec3, macros);
        }
        buttons.forEach(([entry, library], button) => {
            const off = !host.takes(entry, library);
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
