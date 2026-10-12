import { $, type DOMElement } from "../dom";

const MIN_WIDTH = 180;

// The handle on the inner edge of a side panel, set just after it in the
// body: dragging it gives the panel's width to the CSS variable named,
// which the stylesheet bounds by the window's width.
export function resizeHandle(
    panel: DOMElement,
    side: "left" | "right",
    variable: () => string,
): DOMElement {
    const body = $("body");
    const handle = $.create("div").cls("dge-resize");
    const along = (event: PointerEvent) =>
        side === "left" ? event.clientX : window.innerWidth - event.clientX;
    let grab = 0;
    handle.drag(
        (event) =>
            body.stl(
                variable(),
                `${Math.max(MIN_WIDTH, Math.round(along(event) + grab))}px`,
            ),
        (event) => {
            grab = panel.width() - along(event);
            body.addClass("dge-resizing");
            handle.addClass("dge-on");
        },
        () => {
            body.removeClass("dge-resizing");
            handle.removeClass("dge-on");
        },
    );
    handle.on("dblclick", () => body.stl(variable(), ""));
    return handle;
}
