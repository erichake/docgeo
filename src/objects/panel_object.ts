import type { construction } from "../construction";
import { $, type DOMElement } from "../dom";
import {
    evaluateFormula,
    formulaIdentifiers,
    parseFormula,
    usesView,
    type FormulaEnv,
    type FormulaNode,
    type ScriptValue,
} from "../import/dgp_formula";
import {
    construction_object,
    dgoFormula,
    type DgoContext,
} from "./construction_object";
import { expression_object, formatValue, loadKaTeX } from "./expression_object";

// DGPad's panel inside the frame, and its text.
const PANEL_MARGIN = 10;
const PANEL_TEXT =
    "font-size:16px;font-family:Helvetica,Arial,sans-serif;text-shadow:1px 1px 5px #777;white-space:pre-wrap;text-align:center";

// A panel's content, once sanitized: texts, whose "%formula%" parts show
// their value ("%%" is a "%") and "$TeX$" parts are drawn by KaTeX, and
// elements.
export type PanelNode =
    | string
    | {
          tag: string;
          attributes: [string, string][];
          style: [string, string][];
          children: PanelNode[];
      };

const TAGS: ReadonlySet<string> = new Set(
    "a b big br center div em font h1 h2 h3 h4 h5 h6 hr i input label li ol option p pre s select small span strong sub sup table tbody td tfoot th thead tr u ul".split(
        " ",
    ),
);

// The attributes kept, the others being dropped.
const ATTRIBUTES: Record<string, string[]> = {
    a: ["href"],
    font: ["color", "size", "face"],
    input: ["type", "target", "min", "max", "step", "value", "size"],
    // A menu's options: those of the list of the expression it populates.
    select: ["target", "populate"],
    option: ["value", "selected"],
    table: ["border", "cellpadding", "cellspacing", "width"],
    td: ["colspan", "rowspan", "width", "valign"],
    th: ["colspan", "rowspan", "width", "valign"],
};

// Scripts, and DGPad's own behaviors of its fields, which aren't read: the
// panel isn't imported.
const REJECTED_ATTRIBUTE = /^(?:on|editable$|interactiveinput$)/i;
// "texte", a mistake of some figures, is a text field as in DGPad.
const INPUT_TYPES = [
    "text",
    "texte",
    "number",
    "range",
    "checkbox",
    "button",
    "hidden",
];
const LINK = /^https?:\/\//i;
// A resource other than an embedded image.
const EXTERNAL = /image-set\(|url\(\s*(?!["']?data:image\/)/i;

// DGPad's text without its elements' event attributes, scripts the import
// drops (a field selecting its text when clicked): a text that keeps another
// script is still refused by parsePanel.
export function withoutEvents(html: string): string {
    const { head, body } = new DOMParser().parseFromString(html, "text/html");
    let dropped = false;
    body.querySelectorAll("*").forEach((element) =>
        element.getAttributeNames().forEach((name) => {
            if (!/^on/i.test(name)) return;
            element.removeAttribute(name);
            dropped = true;
        }),
    );
    return dropped && !head.childNodes.length ? body.innerHTML : html;
}

// Only the allowed elements, attributes and styles are kept, so that
// nothing in it runs or loads. Throws on a script (DGPad's "§…§" buttons,
// an element or attribute that holds one), and on an element it doesn't
// know.
export function parsePanel(html: string): PanelNode[] {
    if (html.includes("§")) throw new Error("Unsupported DGP panel script");
    // An inert document: nothing in it runs or loads.
    const { head, body } = new DOMParser().parseFromString(html, "text/html");
    // Where a leading script, style or link lands.
    if (head.childNodes.length)
        throw new Error(
            `Unsupported DGP panel ${head.firstElementChild?.tagName}`,
        );
    return [...body.childNodes].flatMap(panelNode);
}

function panelNode(node: Node): PanelNode[] {
    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent!;
        if (text.split("$").some((part) => part.split("%").length % 2 === 0))
            throw new Error("Invalid DGP panel formula");
        return [text];
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return [];
    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    if (!TAGS.has(tag)) throw new Error(`Unsupported DGP panel ${tag}`);
    const kept = ["align", ...(ATTRIBUTES[tag] ?? [])];
    const attributes: [string, string][] = [];
    for (const { name, value } of element.attributes) {
        if (REJECTED_ATTRIBUTE.test(name))
            throw new Error(`Unsupported DGP panel ${name}`);
        if (kept.includes(name) && (name !== "href" || LINK.test(value)))
            attributes.push([name, value]);
    }
    const type = element.getAttribute("type")?.toLowerCase() ?? "text";
    if (tag === "input" && !INPUT_TYPES.includes(type))
        throw new Error(`Unsupported DGP panel input ${type}`);
    const style: [string, string][] = [];
    for (const name of Array.from(element.style)) {
        const value = element.style.getPropertyValue(name);
        if (name !== "position" && !EXTERNAL.test(value))
            style.push([name, value]);
    }
    return [
        {
            tag,
            attributes,
            style,
            children: [...element.childNodes].flatMap(panelNode),
        },
    ];
}

function panelTexts(nodes: PanelNode[]): string[] {
    return nodes.flatMap((node) =>
        typeof node === "string" ? [node] : panelTexts(node.children),
    );
}

export function panelTargets(nodes: PanelNode[]): string[] {
    return nodes.flatMap((node) =>
        typeof node === "string"
            ? []
            : [
                  ...node.attributes
                      .filter(
                          ([name]) => name === "target" || name === "populate",
                      )
                      .map(([, value]) => value),
                  ...panelTargets(node.children),
              ],
    );
}

// The formulas of the panel's texts, by source.
export function panelFormulas(nodes: PanelNode[]): Map<string, FormulaNode> {
    return new Map(
        panelTexts(nodes)
            .flatMap((text) =>
                text
                    .split("$")
                    .flatMap((part) =>
                        part
                            .split("%")
                            .filter((formula, index) => index % 2 && formula),
                    ),
            )
            .map((source) => [source, parseFormula(source)]),
    );
}

// The objects the panel reads: its formulas' and its fields' targets.
export function panelNames(nodes: PanelNode[]): Set<string> {
    return new Set([
        ...[...panelFormulas(nodes).values()].flatMap((formula) => [
            ...formulaIdentifiers(formula),
        ]),
        ...panelTargets(nodes),
    ]);
}

// DGPad's Text: HTML in a frame at a fixed place of the window, `box` giving
// its position and its inner size in pixels, its colors its frame's and its
// background's, its opacity the whole panel's, its size its frame's width. A field of it that targets
// an Expression changes that Expression's number, as a slider does.
export class panel_object extends construction_object {
    box: [number, number, number, number];
    radius: number;
    content: string;
    nodes: PanelNode[];
    formulas: Map<string, FormulaNode>;
    refs: Map<string, construction_object>;
    private vec3: boolean;
    private texts: {
        element: DOMElement;
        source: string;
        rendered: string | null;
    }[] = [];
    private fields: {
        element: DOMElement;
        target: expression_object;
        type: string;
    }[] = [];
    private menus: {
        element: DOMElement;
        list: expression_object;
        shown: string | null;
    }[] = [];

    constructor(
        c: construction,
        name: string | null | undefined,
        box: [number, number, number, number],
        radius: number,
        content: string,
        refs: Map<string, construction_object>,
        vec3: boolean,
    ) {
        super(c, name, "panel");
        this.box = box;
        this.radius = radius;
        this.content = content;
        this.nodes = parsePanel(content);
        this.formulas = panelFormulas(this.nodes);
        this.readsView = [...this.formulas.values()].some(usesView);
        this.refs = refs;
        this.vec3 = vec3;
        this.precision = 4;
        this.addParents(...refs.values());
    }

    dgo(context: DgoContext): [string, unknown] {
        const [x, y, width, height] = this.box;
        return [
            "Html",
            [
                [...context.screen([x, y]), width, height],
                this.radius,
                dgoFormula(this.content, this.refs, context),
            ],
        ];
    }

    private env(): FormulaEnv {
        return {
            resolveIdentifier: (name) =>
                this.refs.get(name)?.scriptValue(this.vec3) ?? null,
            view: () => this.C.formulaView(),
        };
    }

    // The text with its formulas' values, split into its plain parts
    // (even) and its TeX parts (odd).
    private display(source: string): string[] {
        return source.split("$").map((text, tex) =>
            text
                .split("%")
                .map((part, index) => {
                    if (index % 2 === 0) return part;
                    if (part === "") return "%";
                    const value = evaluateFormula(
                        this.formulas.get(part)!,
                        this.env(),
                    );
                    if (value === null) return "???";
                    const shown = formatValue(value, this.precision);
                    // A decimal comma without the space of a punctuation
                    // mark.
                    return tex % 2 ? shown.replace(/,/g, "{,}") : shown;
                })
                .join(""),
        );
    }

    render(): void {
        this.dom.stl("display", this.isVisible ? "block" : "none");
        if (!this.isVisible) return;
        this.texts.forEach((text) => {
            const parts = this.display(text.source);
            const rendered = parts.join("$");
            if (rendered === text.rendered) return;
            text.rendered = rendered;
            text.element.text("");
            text.element.add(
                ...parts.map((part, index) =>
                    index % 2 === 0 ? new Text(part) : $.create("span"),
                ),
            );
            if (parts.length === 1) return;
            loadKaTeX().then((katex) => {
                if (text.rendered !== rendered) return;
                const spans = text.element.findAll(":scope > span");
                parts
                    .filter((_, index) => index % 2)
                    .forEach((tex, index) =>
                        spans[index].inner(
                            katex.renderToString(tex, { throwOnError: false }),
                        ),
                    );
            });
        });
        this.menus.forEach((menu) => {
            const { value } = menu.list;
            const shown = JSON.stringify(value);
            if (shown === menu.shown) return;
            menu.shown = shown;
            // As DGPad: [value, caption] or a value that is its own caption,
            // a caption between quotes being shown without them.
            const caption = (item: ScriptValue) =>
                typeof item === "string"
                    ? item.replace(/^'(.*)'$/, "$1")
                    : formatValue(item, this.precision);
            menu.element.text("");
            menu.element.add(
                ...(Array.isArray(value) ? value : []).map((item) => {
                    const [option, text] =
                        Array.isArray(item) && item.length === 2
                            ? item
                            : [item, item];
                    return $.create("option")
                        .att("value", caption(option).replace(",", "."))
                        .text(caption(text));
                }),
            );
        });
        this.fields.forEach(({ element, target, type }) => {
            const field = element.dom() as HTMLInputElement | HTMLSelectElement;
            // Only a number that nothing defines changes.
            field.disabled = target.formula !== null || target.program !== null;
            // A button's value is its caption.
            if (document.activeElement === field || type === "button") return;
            const value = target.value;
            if (type === "checkbox")
                (field as HTMLInputElement).checked =
                    typeof value === "number" && value !== 0;
            else field.value = typeof value === "number" ? String(value) : "";
        });
    }

    // A field's value becomes its target's number, which a checkbox sets
    // to 1 or 0 and a button switches between them.
    private change(
        field: HTMLInputElement | HTMLSelectElement,
        target: expression_object,
        type: string,
    ): void {
        const typed = field.value.trim().replace(",", ".");
        const value =
            type === "checkbox"
                ? Number((field as HTMLInputElement).checked)
                : type === "button"
                  ? Number(target.value === 0)
                  : typed === ""
                    ? NaN
                    : Number(typed);
        if (!Number.isFinite(value)) return;
        target.value = target.isCursor
            ? Math.min(Math.max(value, target.min!), target.max!)
            : value;
        this.C.invalidateGeometry(target);
    }

    private build(node: PanelNode): Node | DOMElement {
        if (typeof node === "string") {
            if (!/[%$]/.test(node)) return new Text(node);
            const element = $.create("span");
            this.texts.push({ element, source: node, rendered: null });
            return element;
        }
        const element = $.create(node.tag as keyof HTMLElementTagNameMap);
        node.attributes.forEach(([name, value]) => element.att(name, value));
        node.style.forEach(([name, value]) => element.stl(name, value));
        if (node.tag === "a")
            element
                .att("target", "_blank")
                .att("rel", "noopener noreferrer")
                .stl("pointer-events", "auto");
        if (node.tag === "input" || node.tag === "select") {
            element.stl("pointer-events", "auto");
            // Neither a pan of the figure nor its keyboard shortcuts.
            element.on(
                "pointerdown",
                (event) => event.stopPropagation(),
                false,
            );
            element.on("keydown", (event) => event.stopPropagation(), false);
            const list = this.refs.get(element.getAtt("populate") ?? "");
            if (node.tag === "select" && list instanceof expression_object)
                this.menus.push({ element, list, shown: null });
            const target = this.refs.get(element.getAtt("target") ?? "");
            if (target instanceof expression_object) {
                const type = element.getAtt("type")?.toLowerCase() ?? "";
                const field = element.dom() as
                    HTMLInputElement | HTMLSelectElement;
                this.fields.push({ element, target, type });
                element.on(
                    type === "button"
                        ? "click"
                        : type === "checkbox" || node.tag === "select"
                          ? "change"
                          : "input",
                    () => this.change(field, target, type),
                    false,
                );
            }
        }
        element.add(...node.children.map((child) => this.build(child)));
        return element;
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as panel_object;
        t.texts = [];
        t.fields = [];
        t.menus = [];
        const [x, y, width, height] = t.box;
        const opacity = (t.opacity ?? 1) * 100;
        const mix = (color: string) =>
            `color-mix(in srgb, ${color} ${opacity}%, transparent)`;
        const text = $.create("div")
            .stl(PANEL_TEXT)
            .stl("position", "absolute")
            .stl("left", `${PANEL_MARGIN}px`)
            .stl("top", `${PANEL_MARGIN}px`)
            .stl("width", `${width - 2 * PANEL_MARGIN}px`)
            .stl("height", `${height - 2 * PANEL_MARGIN}px`)
            .add(...t.nodes.map((node) => t.build(node)));
        const frame = $.create("div")
            .stl("position", "relative")
            .stl("box-sizing", "content-box")
            .stl("width", `${width}px`)
            .stl("height", `${height}px`)
            .stl("border", `${t.size}px solid ${mix(t.stroke_color)}`)
            .stl("border-radius", `${t.radius}px`)
            .stl("background", mix(t.fill_color))
            .add(text);
        const panel = t.svg
            .shape("foreignObject")
            .att("x", x)
            .att("y", y)
            .att("width", width + 2 * t.size)
            .att("height", height + 2 * t.size)
            .stl("overflow:visible;pointer-events:none")
            .add(frame);
        return t.svg.shape("g").add(panel);
    }
}

export function createPanel(
    c: construction,
    name: string | null | undefined,
    box: [number, number, number, number],
    radius: number,
    content: string,
    refs: Map<string, construction_object>,
    vec3: boolean,
): panel_object {
    return c.add(new panel_object(c, name, box, radius, content, refs, vec3));
}
