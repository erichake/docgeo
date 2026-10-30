import { $, type DOMElement } from "../dom";
import type { construction_object } from "../objects/construction_object";
import { solid_object } from "../objects/solid_object";
import { kindOf, type Kind } from "./catalog";
import { message, type MessageKey } from "./messages";

// What the construction's list shows: see EDITOR.md, « Filtres de la liste ».

const KINDS = {
    points: "family_points",
    lines: "kind_lines",
    circles: "family_circles",
    polygons: "kind_polygons",
    angles: "kind_angles",
    curves: "kind_curves",
    expressions: "kind_expressions",
    planes: "family_planes",
    solids: "family_solids",
    other: "kind_other",
} satisfies Record<string, MessageKey>;
type FilterKind = keyof typeof KINDS;

const KIND_OF: Partial<Record<Kind, FilterKind>> = {
    point: "points",
    line: "lines",
    circle: "circles",
    conic: "circles",
    polygon: "polygons",
    angle: "angles",
    curve: "curves",
    number: "expressions",
    plane: "planes",
    sphere: "solids",
};

const filterKind = (object: construction_object): FilterKind =>
    object instanceof solid_object
        ? "solids"
        : (KIND_OF[kindOf(object)] ?? "other");

// The objects reached from these, themselves included.
function reach(
    from: construction_object[],
    next: (object: construction_object) => construction_object[],
): construction_object[] {
    const found = new Set<construction_object>();
    const pending = [...from];
    while (pending.length) {
        const object = pending.pop()!;
        if (found.has(object)) continue;
        found.add(object);
        pending.push(...next(object));
    }
    return [...found];
}

type Shown = "all" | "visible" | "hidden";
const SHOWN: [Shown, MessageKey][] = [
    ["all", "filter_all"],
    ["visible", "filter_visible"],
    ["hidden", "filter_hidden"],
];

// The header's button opens the filters, which its chips show and remove.
export function listFilters(
    button: DOMElement,
    host: {
        objects: () => construction_object[];
        chosen: () => construction_object[];
        hidden: (object: construction_object) => boolean;
        name: (object: construction_object) => string;
        changed: () => void;
    },
) {
    const menu = $.create("div")
        .cls("dge-menu-popup dge-filter-menu")
        .att("role", "menu")
        .hide();
    const chips = $.create("div").cls("dge-filters");
    let shown: Shown = "all";
    const kinds = new Set<FilterKind>();
    // By their names, an undo building the objects again; and what they
    // stand for.
    let linked: string[] = [];
    let linkedText = "";
    let related = new Set<construction_object>();

    const active = (): boolean =>
        shown !== "all" || !!kinds.size || !!linked.length;

    function changed(): void {
        fill();
        showState();
        host.changed();
    }

    function item(
        label: string,
        checked: boolean,
        run: () => void,
        role = "menuitemcheckbox",
    ): DOMElement {
        const element = $.create("button")
            .att("type", "button")
            .att("role", role)
            .att("aria-checked", String(checked))
            .add($.create("span").text(label));
        element.on("click", () => {
            run();
            changed();
        });
        return element;
    }

    function fill(): void {
        if (menu.isHidden()) return;
        menu.inner("");
        SHOWN.forEach(([value, key]) =>
            menu.add(
                item(
                    message(key),
                    shown === value,
                    () => (shown = value),
                    "menuitemradio",
                ),
            ),
        );
        menu.add($.create("hr"));
        const chosen = host.chosen();
        const link = item(message("filter_linked"), !!linked.length, () => {
            linked = linked.length ? [] : chosen.map(({ name }) => name);
            linkedText = chosen.map(host.name).join(", ");
        });
        if (!linked.length && !chosen[0]) link.att("disabled", "");
        menu.add(link);
        const counts = new Map<FilterKind, number>();
        host.objects().forEach((object) => {
            const kind = filterKind(object);
            counts.set(kind, (counts.get(kind) ?? 0) + 1);
        });
        const types = (Object.keys(KINDS) as FilterKind[]).filter(
            (kind) => counts.has(kind) || kinds.has(kind),
        );
        if (types[0]) menu.add($.create("hr"));
        types.forEach((kind) =>
            menu.add(
                item(message(KINDS[kind]), kinds.has(kind), () => {
                    if (!kinds.delete(kind)) kinds.add(kind);
                }).add($.create("small").text(String(counts.get(kind) ?? 0))),
            ),
        );
    }

    function chip(label: string, remove: () => void): DOMElement {
        const element = $.create("button")
            .att("type", "button")
            .att("title", message("filter_remove"))
            .add(
                $.create("span").text(label),
                $.create("span").att("aria-hidden", "true").text("×"),
            );
        element.on("click", () => {
            remove();
            changed();
        });
        return element;
    }

    function showState(): void {
        button
            .toggleClass("dge-on", active())
            .att("aria-pressed", String(active()));
        chips.inner("");
        if (shown !== "all")
            chips.add(
                chip(
                    message(SHOWN.find(([value]) => value === shown)![1]),
                    () => (shown = "all"),
                ),
            );
        if (linked.length)
            chips.add(
                chip(message("filter_linked_to", linkedText), () => {
                    linked = [];
                }),
            );
        kinds.forEach((kind) =>
            chips.add(chip(message(KINDS[kind]), () => kinds.delete(kind))),
        );
    }

    function close(): void {
        menu.hide().inner("");
        button.att("aria-expanded", "false");
    }

    button
        .att("aria-haspopup", "menu")
        .att("aria-expanded", "false")
        .att("aria-pressed", "false");
    return {
        menu,
        chips,
        close,
        active,
        toggle(): void {
            if (!menu.isHidden()) return close();
            menu.show();
            fill();
            const box = button.dom().getBoundingClientRect();
            const { width } = menu.dom().getBoundingClientRect();
            menu.stl(
                "left",
                `${Math.max(8, Math.min(box.right - width, window.innerWidth - width - 8))}px`,
            ).stl("top", `${box.bottom + 6}px`);
            button.att("aria-expanded", "true");
        },

        // Before the rows are shown: the objects linked to those still
        // there.
        prepare(objects: construction_object[]): void {
            if (!linked.length) return;
            const named = objects.filter(({ name }) => linked.includes(name));
            if (!named[0]) {
                linked = [];
                showState();
                return;
            }
            related = new Set([
                ...reach(named, ({ parents }) => parents),
                ...reach(named, ({ children }) => children),
            ]);
        },
        // Whether a row of these objects shows.
        passes(objects: construction_object[]): boolean {
            return objects.some(
                (object) =>
                    (shown === "all" ||
                        host.hidden(object) === (shown === "hidden")) &&
                    (!kinds.size || kinds.has(filterKind(object))) &&
                    (!linked.length || related.has(object)),
            );
        },
        reset(): void {
            shown = "all";
            kinds.clear();
            linked = [];
            close();
            showState();
        },
    };
}
