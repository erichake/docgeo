import { $ } from "../dom";
import { splashContent } from "../splash";
import { ACTION_ICONS } from "./icons";
import { message } from "./messages";
import type { Menu } from "./menus";
import docToolsIcon from "./doctools-favicon.png";
import "./about.css";

const GITHUB = "https://github.com/erichake/docgeo";
const DOCTOOLS = "https://doctools.org/";
const link = (text: string, href: string) =>
    $.create("a")
        .text(text)
        .att("href", href)
        .att("target", "_blank")
        .att("rel", "noopener noreferrer");
const icon = (body: string) => () =>
    $.create("span").append(
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`,
    );

function showAbout(): void {
    const dialog = $.create("dialog")
        .cls("dge-about")
        .att("aria-label", message("about"))
        .add(
            splashContent().add(
                $.create("div")
                    .cls("dge-about-doctools")
                    .add(
                        $.create("strong").text(message("doctools_title")),
                        $.create("p").append(
                            message("doctools_description").replace(
                                "DocGeo",
                                "<strong>DocGeo</strong>",
                            ),
                        ),
                        link(message("discover_doctools"), DOCTOOLS),
                    ),
                $.create("div")
                    .cls("dge-about-footer")
                    .add(link(message("license_github"), GITHUB)),
            ),
        );
    const element = dialog.dom() as HTMLDialogElement;
    dialog.on(
        "click",
        (event) => {
            if (event.target === element) element.close();
        },
        false,
    );
    dialog.on("close", () => dialog.dispose(), false);
    dialog.on("keydown", (event) => event.stopPropagation(), false);
    $("body").add(dialog);
    element.showModal();
}

export function toolsMenu(manual: () => void): Menu {
    return {
        label: message("menu_tools"),
        items: [
            {
                label: message("help"),
                run: manual,
                icon: icon(ACTION_ICONS.help),
            },
            {
                label: "DocTools",
                run: () => {
                    window.open(DOCTOOLS, "_blank", "noopener,noreferrer");
                },
                icon: () =>
                    $.create("img").att("src", docToolsIcon).att("alt", ""),
            },
            {
                label: message("license_github"),
                run: () => {
                    window.open(GITHUB, "_blank", "noopener,noreferrer");
                },
                icon: icon(
                    '<path fill="currentColor" stroke="none" d="M12 .7A11.5 11.5 0 0 0 8.36 23.1c.58.1.79-.25.79-.56v-2.02c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.27 3.38.97.1-.75.4-1.27.74-1.56-2.57-.3-5.27-1.29-5.27-5.69 0-1.26.45-2.29 1.19-3.1-.12-.3-.52-1.47.11-3.06 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.41-2.71 5.39-5.29 5.68.42.36.79 1.07.79 2.16v3.02c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z"/>',
                ),
            },
            null,
            {
                label: message("about"),
                run: showAbout,
                icon: icon(
                    '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
                ),
            },
        ],
    };
}
