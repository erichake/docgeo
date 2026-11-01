import { $, DOMElement } from "../dom";

// An item opens a submenu if it has `items`, rather than running.
export interface MenuItem {
    label: string;
    run?: () => void;
    items?: () => MenuItems;
    shortcut?: string;
    icon?: () => DOMElement;
    enabled?: () => boolean;
    checked?: () => boolean;
}

// A null item is a separator.
export type MenuItems = (MenuItem | null)[];

// Its items made when it opens, if a function.
export interface Menu {
    label: string;
    items: MenuItems | (() => MenuItems);
}

const MAC = /Mac|iPhone|iPad/.test(navigator.platform);

// The shortcut of the key with ⌘, or Ctrl, and maybe Shift.
export const shortcut = (key: string, shift = false): string =>
    MAC ? `${shift ? "⇧" : ""}⌘${key}` : `Ctrl+${shift ? "Shift+" : ""}${key}`;

export const DELETE_KEY = MAC ? "⌫" : "Del";

// A menu bar as in an application, its menus' items enabled and checked as
// the editor is when they open, and `end` at its end; then the veil behind
// an open menu.
export function menuBar(menus: Menu[], ...end: DOMElement[]): DOMElement[] {
    const bar = $.create("div").cls("dge-menubar").att("role", "menubar");
    // Pressed outside the menu, it closes and nothing else happens.
    const veil = $.create("div").cls("dge-menu-veil").hide();
    const roots: DOMElement[] = [];
    const popups: DOMElement[] = [];
    // The submenus open, each beside its item in the one before.
    const subs: { popup: DOMElement; item: DOMElement }[] = [];
    let open = -1;

    const closeSubs = (level: number): void => {
        subs.splice(level).forEach(({ popup, item }) => {
            popup.dispose();
            item.removeClass("dge-open").att("aria-expanded", "false");
        });
    };
    const close = (): void => {
        if (open < 0) return;
        closeSubs(0);
        popups[open].hide();
        roots[open].removeClass("dge-open").att("aria-expanded", "false");
        veil.hide();
        open = -1;
    };
    // Where the focus is: the menu, or a submenu.
    const current = (): HTMLElement => {
        const focused = document.activeElement;
        return (
            [...subs]
                .reverse()
                .map(({ popup }) => popup.dom() as HTMLElement)
                .find((popup) => popup.contains(focused)) ??
            (popups[open].dom() as HTMLElement)
        );
    };
    const items = (popup: HTMLElement): HTMLButtonElement[] =>
        [
            ...popup.querySelectorAll<HTMLButtonElement>(":scope > button"),
        ].filter((item) => !item.disabled);
    const level = (popup: HTMLElement): number =>
        subs.findIndex((sub) => sub.popup.dom() === popup) + 1;

    const fill = (popup: DOMElement, list: MenuItems, depth: number): void => {
        list.forEach((item) => {
            if (!item) return void popup.add($.create("hr"));
            const element = $.create("button")
                .att("type", "button")
                .att("role", item.checked ? "menuitemcheckbox" : "menuitem")
                .add($.create("span").text(item.label));
            if (item.icon)
                element
                    .addClass("dge-menu-icon")
                    .add(item.icon().att("aria-hidden", "true"));
            if (item.checked)
                element.att("aria-checked", String(item.checked()));
            if (item.shortcut) element.add($.create("kbd").text(item.shortcut));
            if (item.enabled && !item.enabled()) element.att("disabled", "");
            if (item.items) {
                const opens = item.items;
                element
                    .addClass("dge-menu-sub")
                    .att("aria-haspopup", "menu")
                    .att("aria-expanded", "false");
                element.on(
                    "pointerenter",
                    (event) => {
                        if (event.pointerType === "mouse")
                            openSub(element, opens(), depth);
                    },
                    false,
                );
                element.on(
                    "click",
                    () => openSub(element, opens(), depth),
                    false,
                );
            } else {
                element.on("pointerenter", () => closeSubs(depth), false);
                const index = open;
                element.on(
                    "click",
                    () => {
                        close();
                        (roots[index].dom() as HTMLElement).focus();
                        item.run!();
                    },
                    false,
                );
            }
            popup.add(element);
        });
    };

    // Beside its item, or on the other side when the window is too narrow.
    const openSub = (
        item: DOMElement,
        list: MenuItems,
        depth: number,
    ): void => {
        if (subs[depth]?.item === item) return;
        closeSubs(depth);
        const popup = $.create("div")
            .cls("dge-menu-popup dge-menu-subpopup")
            .att("role", "menu")
            .att("tabindex", "-1");
        fill(popup, list, depth + 1);
        bar.add(popup);
        item.addClass("dge-open").att("aria-expanded", "true");
        subs.push({ popup, item });
        const box = item.dom().getBoundingClientRect();
        const { width, height } = popup.dom().getBoundingClientRect();
        const rtl = getComputedStyle(bar.dom()).direction === "rtl";
        const sides = [box.right + 2, box.left - width - 2];
        const left =
            (rtl ? sides.reverse() : sides).find(
                (side) => side >= 8 && side + width <= window.innerWidth - 8,
            ) ?? Math.max(8, window.innerWidth - width - 8);
        popup
            .stl("left", `${left}px`)
            .stl(
                "top",
                `${Math.max(8, Math.min(box.top - 5, window.innerHeight - height - 8))}px`,
            );
    };

    const show = (index: number, focusFirst: boolean): void => {
        close();
        open = index;
        const { items: list } = menus[index];
        fill(
            popups[index].inner(""),
            typeof list === "function" ? list() : list,
            0,
        );
        popups[index].show("flex");
        veil.show();
        roots[index].addClass("dge-open").att("aria-expanded", "true");
        (focusFirst
            ? items(popups[index].dom() as HTMLElement)[0]
            : (popups[index].dom() as HTMLElement)
        )?.focus();
    };

    menus.forEach((menu, index) => {
        const root = $.create("button")
            .att("type", "button")
            .att("aria-haspopup", "menu")
            .att("aria-expanded", "false")
            .text(menu.label);
        const popup = $.create("div")
            .cls("dge-menu-popup")
            .att("role", "menu")
            .att("tabindex", "-1")
            .hide();
        root.on(
            "click",
            () => (open === index ? close() : show(index, false)),
            false,
        );
        root.on(
            "pointerenter",
            () => {
                if (open >= 0 && open !== index) show(index, false);
            },
            false,
        );
        roots.push(root);
        popups.push(popup);
        bar.add($.create("div").add(root, popup));
    });
    veil.on("pointerdown", close, false);

    bar.on(
        "keydown",
        (event) => {
            const key = event.key;
            const rtl = getComputedStyle(bar.dom()).direction === "rtl";
            const forward = rtl ? "ArrowLeft" : "ArrowRight";
            const backward = rtl ? "ArrowRight" : "ArrowLeft";
            const rootIndex = roots.findIndex(
                (root) => root.dom() === document.activeElement,
            );
            const popup = open >= 0 ? current() : null;
            const depth = popup ? level(popup) : 0;
            const focused = document.activeElement as HTMLElement;
            if (key === "Escape" && open >= 0) {
                const index = open;
                close();
                (roots[index].dom() as HTMLElement).focus();
            } else if (
                key === forward &&
                focused.classList.contains("dge-menu-sub")
            ) {
                focused.click();
                items(subs[depth].popup.dom() as HTMLElement)[0]?.focus();
            } else if (key === backward && depth > 0) {
                const { item } = subs[depth - 1];
                closeSubs(depth - 1);
                (item.dom() as HTMLElement).focus();
            } else if ((key === forward || key === backward) && open >= 0)
                show(
                    (open + (key === forward ? 1 : menus.length - 1)) %
                        menus.length,
                    true,
                );
            else if (key === "ArrowDown" && open < 0 && rootIndex >= 0)
                show(rootIndex, true);
            else if ((key === "ArrowDown" || key === "ArrowUp") && popup) {
                const list = items(popup);
                const at = list.indexOf(focused as HTMLButtonElement);
                const step = key === "ArrowDown" ? 1 : -1;
                list[
                    at < 0
                        ? step > 0
                            ? 0
                            : list.length - 1
                        : (at + step + list.length) % list.length
                ]?.focus();
            } else if (event.metaKey || event.ctrlKey || key === "Escape")
                return;
            else return void event.stopPropagation();
            event.preventDefault();
            event.stopPropagation();
        },
        false,
    );
    return [bar.add(...end), veil];
}

// The menu of `list`, or elements of their own, at the point (x, y), above
// it if it doesn't fit below, closed when one of its items runs, by Escape
// or by a press outside it: closed by the function returned.
export function contextMenu(
    list: (MenuItem | DOMElement | null)[],
    x: number,
    y: number,
): () => void {
    const veil = $.create("div").cls("dge-menu-veil");
    const popup = $.create("div")
        .cls("dge-menu-popup dge-context-menu")
        .att("role", "menu")
        .att("tabindex", "-1");
    const close = (): void => {
        veil.dispose();
        popup.dispose();
    };
    list.forEach((item) => {
        if (!item) return void popup.add($.create("hr"));
        if (item instanceof DOMElement) return void popup.add(item);
        const element = $.create("button")
            .att("type", "button")
            .att("role", item.checked ? "menuitemcheckbox" : "menuitem")
            .add($.create("span").text(item.label));
        if (item.icon)
            element
                .addClass("dge-menu-icon")
                .add(item.icon().att("aria-hidden", "true"));
        if (item.checked) element.att("aria-checked", String(item.checked()));
        if (item.enabled && !item.enabled()) element.att("disabled", "");
        element.on(
            "click",
            () => {
                close();
                item.run!();
            },
            false,
        );
        popup.add(element);
    });
    veil.on("pointerdown", close);
    popup.on(
        "keydown",
        (event) => {
            event.stopPropagation();
            if (event.key === "Escape") return close();
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            const items = [
                ...popup
                    .dom()
                    .querySelectorAll<HTMLButtonElement>(
                        "button:not(:disabled)",
                    ),
            ];
            const at = items.indexOf(
                document.activeElement as HTMLButtonElement,
            );
            const step = event.key === "ArrowDown" ? 1 : -1;
            items[
                at < 0
                    ? step > 0
                        ? 0
                        : items.length - 1
                    : (at + step + items.length) % items.length
            ]?.focus();
        },
        false,
    );
    $("body").add(veil, popup);
    const { width, height } = popup.dom().getBoundingClientRect();
    popup
        .stl(
            "left",
            `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`,
        )
        .stl(
            "top",
            `${y + height <= window.innerHeight - 8 ? y : Math.max(8, y - height)}px`,
        );
    (popup.dom() as HTMLElement).focus();
    return close;
}
