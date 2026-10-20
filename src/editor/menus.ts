import { $, type DOMElement } from "../dom";

export interface MenuItem {
    label: string;
    run: () => void;
    shortcut?: string;
    enabled?: () => boolean;
    checked?: () => boolean;
}

// A null item is a separator.
export interface Menu {
    label: string;
    items: (MenuItem | null)[];
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
    let open = -1;

    const close = (): void => {
        if (open < 0) return;
        popups[open].hide();
        roots[open].removeClass("dge-open").att("aria-expanded", "false");
        veil.hide();
        open = -1;
    };
    const items = (): HTMLButtonElement[] =>
        [...popups[open].dom().querySelectorAll("button")].filter(
            (item) => !item.disabled,
        );
    const show = (index: number, focusFirst: boolean): void => {
        close();
        open = index;
        const popup = popups[index].inner("");
        menus[index].items.forEach((item) => {
            if (!item) return void popup.add($.create("hr"));
            const element = $.create("button")
                .att("type", "button")
                .att("role", item.checked ? "menuitemcheckbox" : "menuitem")
                .add($.create("span").text(item.label));
            if (item.checked)
                element.att("aria-checked", String(item.checked()));
            if (item.shortcut) element.add($.create("kbd").text(item.shortcut));
            if (item.enabled && !item.enabled()) element.att("disabled", "");
            element.on(
                "click",
                () => {
                    close();
                    item.run();
                },
                false,
            );
            popup.add(element);
        });
        popup.show("flex");
        veil.show();
        roots[index].addClass("dge-open").att("aria-expanded", "true");
        (focusFirst ? items()[0] : (popup.dom() as HTMLElement))?.focus();
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
            if (key === "Escape" && open >= 0) {
                const index = open;
                close();
                (roots[index].dom() as HTMLElement).focus();
            } else if ((key === forward || key === backward) && open >= 0)
                show(
                    (open + (key === forward ? 1 : menus.length - 1)) %
                        menus.length,
                    true,
                );
            else if (key === "ArrowDown" && open < 0 && rootIndex >= 0)
                show(rootIndex, true);
            else if ((key === "ArrowDown" || key === "ArrowUp") && open >= 0) {
                const list = items();
                const at = list.indexOf(
                    document.activeElement as HTMLButtonElement,
                );
                const step = key === "ArrowDown" ? 1 : -1;
                list[
                    at < 0
                        ? step > 0
                            ? 0
                            : list.length - 1
                        : (at + step + list.length) % list.length
                ]?.focus();
            } else if (event.metaKey || event.ctrlKey) return;
            else return void event.stopPropagation();
            event.preventDefault();
            event.stopPropagation();
        },
        false,
    );
    return [bar.add(...end), veil];
}
