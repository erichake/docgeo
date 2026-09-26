import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import {
    evaluateFormula,
    realPart,
    usesView,
    type FormulaEnv,
    type FormulaNode,
} from "../import/dgp_formula";
import { vAdd, type Vec2 } from "../vec";
import { construction_object } from "./construction_object";
import { resolveRef, type ListRef } from "./list_object";
import type { point_object } from "./point_object";

// GeoGebra's line spread in a multi-line text.
const LINE_HEIGHT = 1.5;

export type TextRef = ListRef;

// A text whose "%formula%" parts show their current value ("%%" is a
// literal "%"), its first line's baseline starting at its anchor's screen
// position shifted by `offset` pixels.
export class text_object extends construction_object {
    anchor: point_object;
    offset: Vec2;
    parts: (string | FormulaNode)[];
    refs: Map<string, TextRef>;
    content = "";
    projectionDefined = false;
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
        refs: Map<string, TextRef>,
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

    private env(): FormulaEnv {
        return {
            resolveIdentifier: (name) => {
                const ref = this.refs.get(name);
                return ref ? resolveRef(ref) : null;
            },
            view: () => this.C.formulaView(),
        };
    }

    computeGeometry(): void {
        this.defined = this.anchor.defined;
        if (!this.defined) return;
        const env = this.env();
        this.content = this.parts
            .map((part) => {
                if (typeof part === "string") return part;
                const value = realPart(evaluateFormula(part, env));
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
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as text_object;
        t.renderedContent = null;
        t.textElement = t.svg
            .shape("text")
            .stl(
                `fill:${t.stroke_color};font-family:Verdana;font-size:${t.fontSize}px;white-space:pre;pointer-events:none`,
            );
        return t.svg.shape("g").add(t.textElement);
    }
}

export function createText(
    c: construction,
    name: string | null | undefined,
    anchor: point_object,
    offset: Vec2,
    parts: (string | FormulaNode)[],
    refs: Map<string, TextRef>,
): text_object {
    return c.add(new text_object(c, name, anchor, offset, parts, refs));
}
