import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import {
    evaluateProgram,
    formulaSource,
    realPart,
    usesView,
    type FormulaEnv,
    type FormulaNode,
} from "../import/dgp_formula";
import { vAdd, type Vec2 } from "../vec";
import {
    construction_object,
    dgoFormula,
    type DgoContext,
} from "./construction_object";
import { callFunction, frameText } from "./expression_object";
import type { point_object } from "./point_object";

// GeoGebra's line spread in a multi-line text.
const LINE_HEIGHT = 1.5;

// A text whose "%formula%" parts show their current value ("%%" is a
// literal "%"), its first line's baseline starting at its anchor's screen
// position shifted by `offset` pixels.
export class text_object extends construction_object {
    anchor: point_object;
    offset: Vec2;
    parts: (string | FormulaNode)[];
    refs: Map<string, construction_object>;
    content = "";
    projectionDefined = false;
    // GeoGebra's bold text.
    bold = false;
    // The color of GeoGebra's background, if any.
    background: string | null = null;
    private backdrop: DOMElement | null = null;
    private position: Vec2 = [0, 0];
    private renderedContent: string | null = null;
    private lines: DOMElement[] = [];
    textElement!: DOMElement;

    constructor(
        c: construction,
        name: string | null | undefined,
        anchor: point_object,
        offset: Vec2,
        parts: (string | FormulaNode)[],
        refs: Map<string, construction_object>,
    ) {
        super(c, name, "text");
        this.anchor = anchor;
        this.offset = offset;
        this.parts = parts;
        this.readsView = parts.some(
            (part) => typeof part !== "string" && usesView(part),
        );
        this.refs = refs;
        this.addParents(anchor, ...refs.values());
    }

    dgo(context: DgoContext): [string, unknown] {
        const content = this.parts
            .map((part, index) =>
                index % 2 === 0
                    ? part
                    : typeof part === "string"
                      ? ""
                      : formulaSource(part),
            )
            .join("%");
        return [
            "Txt",
            [
                context.index(this.anchor),
                this.offset.map(Math.round),
                dgoFormula(content, this.refs, context),
            ],
        ];
    }

    private env(): FormulaEnv {
        return {
            resolveIdentifier: (name) => {
                const ref = this.refs.get(name);
                return ref ? ref.scriptValue(this.C.space) : null;
            },
            view: () => this.C.formulaView(),
            callFunction: (name, args, derivatives) =>
                callFunction(
                    this.refs,
                    name,
                    args,
                    () => this.C.formulaView(),
                    derivatives,
                ),
        };
    }

    computeGeometry(): void {
        this.defined = this.anchor.defined;
        if (!this.defined) return;
        const env = this.env();
        this.content = this.parts
            .map((part) => {
                if (typeof part === "string") return part;
                // A part may also be a string, e.g. a list's word.
                const result = evaluateProgram(
                    {
                        body: [{ kind: "expression", node: part }],
                        locals: new Set(),
                    },
                    env,
                );
                if (typeof result === "string") return result;
                const value = realPart(result);
                if (value === null) return "?";
                const factor = 10 ** Math.max(0, this.precision);
                return String(Math.round(value * factor) / factor);
            })
            .join("");
    }

    project(): void {
        this.projectionDefined = this.defined && this.anchor.projectionDefined;
        if (this.projectionDefined)
            this.position = vAdd(this.anchor.screen, this.offset);
    }

    render(): void {
        this.dom.stl(
            "display",
            this.isVisible && this.projectionDefined ? "block" : "none",
        );
        if (!this.isVisible || !this.projectionDefined) return;
        // Clicked, as GeoGebra's text with a click script, if it has a
        // program for it.
        const clickable = this.children.some(
            (child) => (child as { gesture?: unknown }).gesture === "down",
        );
        this.textElement.stl(
            "pointer-events:" + (clickable ? "auto;cursor:pointer" : "none"),
        );
        const [x, y] = this.position;
        if (this.content !== this.renderedContent) {
            this.renderedContent = this.content;
            this.textElement.text("");
            this.lines = this.content.split("\n").map((line, index) => {
                const tspan = this.svg
                    .shape("tspan")
                    .att("dy", index ? this.fontSize * LINE_HEIGHT : 0);
                tspan.text(line);
                return tspan;
            });
            this.textElement.add(...this.lines);
        }
        this.textElement.att("y", y);
        this.lines.forEach((line) => line.att("x", x));
        if (this.backdrop) frameText(this.backdrop, this.textElement);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as text_object;
        t.renderedContent = null;
        t.textElement = t.svg
            .shape("text")
            .stl(
                `fill:${t.stroke_color};font-family:Verdana;font-size:${t.fontSize}px;white-space:pre;pointer-events:none${t.bold ? ";font-weight:bold" : ""}`,
            )
            .tap(() => t.C.gesture(t, "down"));
        t.textElement.on("pointerdown", (event) => event.stopPropagation());
        t.backdrop = t.background
            ? t.svg.shape("rect").stl("fill", t.background)
            : null;
        return t.svg
            .shape("g")
            .add(...(t.backdrop ? [t.backdrop] : []), t.textElement);
    }
}

export function createText(
    c: construction,
    name: string | null | undefined,
    anchor: point_object,
    offset: Vec2,
    parts: (string | FormulaNode)[],
    refs: Map<string, construction_object>,
): text_object {
    return c.add(new text_object(c, name, anchor, offset, parts, refs));
}
