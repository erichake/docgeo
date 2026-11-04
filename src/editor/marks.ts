import { $, type DOMElement } from "../dom";

// How many pixels the mark of an object adds to the width of its lines.
export const MARK_WIDER = { hovered: 6, selected: 8 };

// The strongest first: an object in several states has one mark. The
// properties keep the light one, not to hide the colour and width being set.
const STATES = [
    {
        query: "[data-layer] > .dge-picked",
        wider: MARK_WIDER.selected,
        className: "dge-mark dge-mark-strong",
    },
    {
        // A macro's objects have their own paint, see macro.css.
        query: "[data-layer] > :is(.dge-hover, .dge-property-selected):not(.dge-initial, .dge-final, .dge-possible, .dge-missing)",
        wider: MARK_WIDER.hovered,
        className: "dge-mark",
    },
];

const WATCHED = {
    attributeFilter: ["class"],
    attributes: true,
    childList: true,
    subtree: true,
};

const drawMark = (object: Element, wider: number, className: string) => {
    const mark = $(object.cloneNode(true) as Element).cls(className);
    mark.dom()
        .querySelectorAll<SVGElement>("*")
        .forEach(({ style }) => {
            if (style.stroke === "none") style.stroke = style.fill;
            style.strokeWidth = `${(parseFloat(style.strokeWidth) || 1) + wider}px`;
        });
    object.before(mark.dom());
    return mark;
};

// Each object hovered or selected doubled under itself by a wide pale line
// of its own colours, sharp where a glow would blur the figure and tint the
// object. The observer spares every path that changes a state or moves an
// object (gesture, animation, properties, undo...) from redrawing the marks.
export function watchMarks(): void {
    const root = $("body");
    let marks: DOMElement[] = [];
    const observer = new MutationObserver(() => {
        observer.disconnect();
        marks.forEach((mark) => mark.dispose());
        marks = [];
        const marked = new Set<Element>();
        STATES.forEach(({ query, wider, className }) =>
            root.findAll(query).forEach((object) => {
                if (marked.has(object.dom())) return;
                marked.add(object.dom());
                marks.push(drawMark(object.dom(), wider, className));
            }),
        );
        observer.observe(root.dom(), WATCHED);
        marked.forEach((object) =>
            observer.observe(object, { attributes: true, subtree: true }),
        );
    });
    observer.observe(root.dom(), WATCHED);
}
