import { construction } from "../construction";
import { describeDgo, readDgo, type DgoFigure, type Region } from "../dgo";
import { $, type DOMElement } from "../dom";
import { button_object } from "../objects/button_object";
import { expression_object } from "../objects/expression_object";
import { DIR } from "../i18n";
import { preferences } from "../preferences";
import { message, type MessageKey } from "./messages";
import "./print.css";

// The figure printed, with its preview: see EDITOR.md.

// A page of the figure, described as the region of the window it shows
// first.
export interface Page {
    name: string;
    figure: DgoFigure;
}

// Width and height, in millimeters.
const PAPERS: Record<string, [number, number]> = {
    A4: [210, 297],
    A3: [297, 420],
    A5: [148, 210],
    Letter: [215.9, 279.4],
};
const MARGINS: Record<string, number> = { normal: 15, narrow: 8, wide: 25 };
const PX_PER_MM = 96 / 25.4;
const TITLE_HEIGHT = 10;
// Around the drawing of the figure alone, in pixels.
const CROP_PADDING = 12;
const CONTROL = "data-print-control";

// Kept for the session.
const options = {
    all: false,
    area: "view",
    paper: "A4",
    orientation: "auto",
    margins: "normal",
    title: false,
    background: false,
    gray: false,
    controls: false,
};

const size = ({ v }: DgoFigure): [number, number] => [
    v.w as number,
    v.h as number,
];

// The figure described, drawn at this size, the region it was described
// as centered, as a page of the editor shown in a frame (see fit.ts).
function build(figure: DgoFigure, [width, height]: number[]): construction {
    const c = construction.create({ prefs: new preferences() });
    c.fixedSize = [width, height];
    readDgo(c, figure, true);
    c.flush();
    return c;
}

// A copy of its drawing with the options, the values of its fields kept.
function drawing(c: construction): SVGSVGElement {
    const controls = options.controls
        ? c.OBJS.V.filter(
              (object) =>
                  object.hasView &&
                  (object instanceof button_object ||
                      (object instanceof expression_object &&
                          (object.isCursor ||
                              object.checkbox ||
                              object.inputLength > 0 ||
                              !!object.menu))),
          )
        : [];
    controls.forEach((object) => object.dom.att(CONTROL, ""));
    const original = c.svg.dom() as SVGSVGElement;
    const svg = original.cloneNode(true) as SVGSVGElement;
    controls.forEach((object) => object.dom.dom().removeAttribute(CONTROL));
    svg.querySelectorAll(`[${CONTROL}]`).forEach((element) => element.remove());
    // What the user typed or chose, which a copy doesn't keep.
    const fields = svg.querySelectorAll("input, select");
    original.querySelectorAll("input, select").forEach((field, index) => {
        if (field instanceof HTMLSelectElement)
            (fields[index] as HTMLSelectElement).options[
                field.selectedIndex
            ]?.setAttribute("selected", "");
        else
            fields[index].setAttribute(
                "value",
                (field as HTMLInputElement).value,
            );
    });
    svg.style.cssText = options.background
        ? `background:${original.style.background}`
        : "";
    if (options.gray) svg.style.filter = "grayscale(1)";
    const [width, height] = c.fixedSize!;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    return svg;
}

// The region of the drawing that shows something, the copy being drawn at
// its size.
function drawn(svg: SVGSVGElement, width: number, height: number): Region {
    const origin = svg.getBoundingClientRect();
    let [left, top, right, bottom] = [width, height, 0, 0];
    svg.querySelectorAll(
        "path, line, polyline, polygon, circle, ellipse, rect, text, image, foreignObject > *",
    ).forEach((element) => {
        if (element.closest("defs, clipPath, linearGradient, radialGradient"))
            return;
        const box = element.getBoundingClientRect();
        if (
            (!box.width && !box.height) ||
            box.right < origin.left ||
            box.left > origin.left + width ||
            box.bottom < origin.top ||
            box.top > origin.top + height
        )
            return;
        left = Math.min(left, box.left - origin.left);
        top = Math.min(top, box.top - origin.top);
        right = Math.max(right, box.right - origin.left);
        bottom = Math.max(bottom, box.bottom - origin.top);
    });
    if (left >= right) return { x: 0, y: 0, w: width, h: height };
    const x = Math.floor(Math.max(0, left - CROP_PADDING));
    const y = Math.floor(Math.max(0, top - CROP_PADDING));
    return {
        x,
        y,
        w: Math.ceil(Math.min(width, right + CROP_PADDING)) - x,
        h: Math.ceil(Math.min(height, bottom + CROP_PADDING)) - y,
    };
}

// The figure alone, described as the region of its page's that shows
// something.
async function cropped(
    figure: DgoFigure,
    measure: DOMElement,
): Promise<DgoFigure> {
    const [width, height] = size(figure);
    const c = build(figure, [width, height]);
    const svg = drawing(c);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    measure.add(svg);
    const region = drawn(svg, width, height);
    svg.remove();
    const described = await describeDgo(c, region);
    c.dispose();
    return described;
}

const select = (
    key: MessageKey,
    option: "area" | "paper" | "orientation" | "margins",
    choices: [string, string][],
    changed: () => void,
): DOMElement => {
    const field = $.create("select").add(
        ...choices.map(([value, text]) =>
            $.create("option").att("value", value).text(text),
        ),
    );
    (field.dom() as HTMLSelectElement).value = options[option];
    field.on(
        "change",
        () => {
            options[option] = (field.dom() as HTMLSelectElement).value;
            changed();
        },
        false,
    );
    return $.create("label")
        .cls("dge-print-field")
        .add($.create("span").text(message(key)), field);
};

const check = (
    key: MessageKey,
    option: "all" | "title" | "background" | "gray" | "controls",
    changed: () => void,
): DOMElement => {
    const box = $.create("input").att("type", "checkbox");
    (box.dom() as HTMLInputElement).checked = options[option];
    box.on(
        "change",
        () => {
            options[option] = (box.dom() as HTMLInputElement).checked;
            changed();
        },
        false,
    );
    return $.create("label")
        .cls("dge-print-check")
        .add(box, $.create("span").text(message(key)));
};

// The dialog of the print, with the preview of its sheets, a sheet for each
// page `pages` gives, all those of the workbook or the one shown. Each sheet
// is filled with the figure, drawn anew at its size: a drag moves the
// figure in its sheet, the wheel zooms it, without changing the editor's.
export function showPrint(
    several: boolean,
    pages: (all: boolean) => Promise<Page[]>,
): void {
    const body = $("body").addClass("dge-printing");
    const page = $.create("style");
    const sheets = $.create("div").cls("dge-print-sheets");
    // The figures, as in the editor, are left to right.
    const preview = $.create("div")
        .cls("dge-print-preview")
        .att("dir", "ltr")
        .add(sheets);
    const measure = $.create("div").cls("dge-print-measure");
    const count = $.create("span");
    const printButton = $.create("button")
        .cls("dge-done")
        .text(message("print"));
    let described: Page[] = [];
    let shown: { scene: construction; figure: DOMElement }[] = [];
    // In millimeters.
    let paper = { width: 0, height: 0 };

    // The sheets as large as the preview shows them whole.
    const fit = (): void => {
        if (!paper.width) return;
        const { width, height } = preview.dom().getBoundingClientRect();
        sheets.stl(
            "zoom",
            String(
                Math.min(
                    1,
                    (width - 48) / (paper.width * PX_PER_MM),
                    (height - 48) / (paper.height * PX_PER_MM),
                ),
            ),
        );
    };
    preview.observeResize(fit);

    // In the room of its sheet.
    const draw = (index: number): void => {
        const { scene, figure } = shown[index];
        const svg = drawing(scene);
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        figure.dom().replaceChildren(svg);
    };
    const redraw = (): void => shown.forEach((_, index) => draw(index));

    const dispose = (): void => shown.forEach(({ scene }) => scene.dispose());

    // The figures drawn anew at the size of the sheets, never enlarged:
    // a figure larger than its sheet is printed smaller.
    const rebuild = async (): Promise<void> => {
        const figures = await Promise.all(
            described.map(({ figure }) =>
                options.area === "figure" ? cropped(figure, measure) : figure,
            ),
        );
        const [short, long] = PAPERS[options.paper];
        const [first] = figures.map(size);
        const landscape =
            options.orientation === "auto"
                ? first[0] > first[1]
                : options.orientation === "landscape";
        const [width, height] = landscape ? [long, short] : [short, long];
        const margin = MARGINS[options.margins];
        paper = { width, height };
        page.text(
            `@page { size: ${width}mm ${height}mm; margin: 0; } .dge-print-sheet { width: ${width}mm; height: ${height}mm; padding: ${margin}mm; } @media print { .dge-print-sheet { height: ${height - 0.5}mm; } }`,
        );
        const room = [
            (width - 2 * margin) * PX_PER_MM,
            (height - 2 * margin - (options.title ? TITLE_HEIGHT : 0)) *
                PX_PER_MM,
        ];
        dispose();
        shown = figures.map((figure, index) => {
            const [w, h] = size(figure);
            const scale = Math.min(1, room[0] / w, room[1] / h);
            return {
                scene: build(
                    figure,
                    room.map((side) => side / scale),
                ),
                figure: movable($.create("div").cls("dge-print-figure"), index),
            };
        });
        sheets.inner("").add(
            ...shown.map(({ figure }, index) =>
                $.create("section")
                    .cls("dge-print-sheet")
                    .add(
                        ...(options.title
                            ? [
                                  $.create("div")
                                      .cls("dge-print-title")
                                      .text(described[index].name),
                              ]
                            : []),
                        figure,
                    ),
            ),
        );
        redraw();
        fit();
        count.text(message("print_count", String(shown.length)));
    };

    let loading = Promise.resolve();
    const run = (task: () => Promise<void>): void => {
        (printButton.dom() as HTMLButtonElement).disabled = true;
        loading = loading.then(async () => {
            await task();
            (printButton.dom() as HTMLButtonElement).disabled = false;
            // The figures built may have taken it.
            if (!overlay.dom().contains(document.activeElement))
                (overlay.dom() as HTMLElement).focus();
        });
    };
    const load = (): void =>
        run(async () => {
            described = await pages(several && options.all);
            await rebuild();
        });
    const refresh = (): void => run(rebuild);

    // The moves made at once, those made while the figure is drawn again
    // waiting for the next time.
    let moves: ((c: construction) => void)[] = [];
    const move = (index: number, action: (c: construction) => void): void => {
        moves.push(action);
        if (moves.length > 1) return;
        loading = loading.then(() => {
            const { scene } = shown[index];
            moves.splice(0).forEach((action) => action(scene));
            scene.flush();
            draw(index);
        });
    };

    // Dragged and zoomed by the wheel as the figure itself.
    function movable(figure: DOMElement, index: number): DOMElement {
        // The figure's pixels for one of the preview, and the figure's point
        // under the pointer.
        const scaled = (event: MouseEvent): [number, [number, number]] => {
            const svg = figure.find("svg")!.dom() as SVGSVGElement;
            const box = svg.getBoundingClientRect();
            const { width } = svg.viewBox.baseVal;
            const ratio = width / box.width;
            return [
                ratio,
                [
                    (event.clientX - box.left) * ratio,
                    (event.clientY - box.top) * ratio,
                ],
            ];
        };
        figure.drag((event, [dx, dy]) => {
            const [ratio] = scaled(event);
            move(index, (c) => c.pan(event, [dx * ratio, dy * ratio]));
        });
        figure.on(
            "wheel",
            (event) => {
                const [, point] = scaled(event);
                move(index, (c) => c.mousewheel(event, point));
            },
            { passive: false },
        );
        return figure;
    }

    let closed = false;
    const close = (): void => {
        if (closed) return;
        closed = true;
        void loading.then(() => {
            dispose();
            overlay.dispose();
            body.removeClass("dge-printing");
            $("html").off("keydown", keys, true);
        });
    };
    const cancel = $.create("button")
        .cls("dge-secondary")
        .text(message("dismiss"));
    cancel.on("click", close, false);
    printButton.on("click", () => window.print(), false);

    const overlay = $.create("div")
        .cls("dge-print")
        .att("dir", DIR)
        .att("role", "dialog")
        .att("aria-modal", "true")
        .att("aria-label", message("print"))
        .att("tabindex", "-1")
        .add(
            page,
            $.create("aside")
                .cls("dge-print-controls")
                .add(
                    $.create("h2").text(message("print")),
                    $.create("div")
                        .cls("dge-print-settings")
                        .add(
                            ...(several
                                ? [check("page_list", "all", load)]
                                : []),
                            select(
                                "print_area",
                                "area",
                                [
                                    ["view", message("print_view")],
                                    ["figure", message("print_figure")],
                                ],
                                refresh,
                            ),
                            select(
                                "print_paper",
                                "paper",
                                Object.keys(PAPERS).map((paper) => [
                                    paper,
                                    paper,
                                ]),
                                refresh,
                            ),
                            select(
                                "print_orientation",
                                "orientation",
                                [
                                    ["auto", message("print_auto")],
                                    ["portrait", message("print_portrait")],
                                    ["landscape", message("print_landscape")],
                                ],
                                refresh,
                            ),
                            select(
                                "print_margins",
                                "margins",
                                [
                                    ["normal", message("print_normal")],
                                    ["narrow", message("print_narrow")],
                                    ["wide", message("print_wide")],
                                ],
                                refresh,
                            ),
                            check("print_title", "title", refresh),
                            check("print_background", "background", redraw),
                            check("print_gray", "gray", redraw),
                            check("print_controls", "controls", redraw),
                        ),
                    $.create("div")
                        .cls("dge-print-actions")
                        .add(count, cancel, printButton),
                ),
            preview,
            measure,
        );
    // The editor's shortcuts stay out, wherever the focus is, but not the
    // browser's print.
    const keys = $("html").on(
        "keydown",
        (event) => {
            if (event.key === "Escape") close();
            if (!overlay.dom().contains(event.target as Node))
                event.stopPropagation();
        },
        { capture: true, prevent: false },
    );
    overlay.on("keydown", (event) => event.stopPropagation(), false);
    body.add(overlay);
    (overlay.dom() as HTMLElement).focus();
    load();
}
