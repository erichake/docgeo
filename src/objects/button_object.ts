import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import { formulaSource } from "../import/dgp_formula";
import type { Vec2 } from "../vec";
import {
    construction_object,
    dgoFormula,
    type DgoContext,
} from "./construction_object";
import { runProgram, type ExpressionProgram } from "./expression_object";

export const BUTTON_WIDTH = 40;
const HEIGHT = 40;
const TOOLS_WIDTH = 36;

// Like an expression, it keeps its place in the window, `screen` being
// its right end, halfway up.
export class button_object extends construction_object {
    label: string;
    screen: Vec2;
    program: ExpressionProgram | null;
    private caption!: DOMElement;
    private background!: DOMElement;
    private hit!: DOMElement;
    accessory!: DOMElement;
    frame!: DOMElement;

    constructor(
        c: construction,
        name: string | null | undefined,
        label: string,
        screen: Vec2,
        program: ExpressionProgram | null,
    ) {
        super(c, name, "expression");
        this.label = label;
        this.screen = screen;
        this.program = program;
    }

    dgo(context: DgoContext): [string, unknown] {
        const program = this.program;
        return [
            "Btn",
            {
                t: this.label,
                ...(program && {
                    s: dgoFormula(
                        formulaSource(program.program),
                        new Map([...program.refs, ...program.targets]),
                        context,
                    ),
                }),
                xy: context.screen(this.screen),
            },
        ];
    }

    run(): void {
        if (this.program) runProgram(this.C, this.program);
    }

    render(): void {
        this.dom.stl("display", this.isVisible ? "block" : "none");
        if (!this.isVisible) return;
        const [x, y] = this.screen;
        const height = Math.max(HEIGHT, this.fontSize + 20);
        const width = Math.max(
            BUTTON_WIDTH,
            (this.caption.dom() as SVGTextElement).getComputedTextLength() + 56,
        );
        const tools = this.accessory.dom().childElementCount ? TOOLS_WIDTH : 0;
        this.dom.att(
            "transform",
            `translate(${x - width - tools} ${y - height / 2})`,
        );
        this.background.att("width", width + tools).att("height", height);
        this.hit.att("width", width).att("height", height);
        this.caption.att("x", 36).att("y", height / 2);
        this.frame
            .find("path")!
            .att("transform", `translate(15 ${height / 2})`);
        this.accessory
            .att("transform", `translate(${width + 14} ${height / 2})`)
            .stl("--button-height", `${height}px`);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as button_object;
        t.caption = t.svg
            .shape("text")
            .att("dominant-baseline", "central")
            .stl(
                `fill:${t.stroke_color};font-family:system-ui,sans-serif;font-size:${t.fontSize}px;font-weight:500;pointer-events:none`,
            )
            .text(t.label);
        t.background = t.svg
            .shape("rect")
            .att("rx", 7)
            .stl(
                "fill:#f1f2f4;stroke:#b7bdc6;stroke-width:1;pointer-events:none",
            );
        t.hit = t.svg.shape("rect").att("rx", 7).stl("fill:transparent");
        t.frame = t.svg
            .shape("g")
            .stl("cursor:pointer")
            .add(
                t.hit,
                t.svg
                    .shape("path")
                    .att("d", "M0 -6V6L10 0Z")
                    .stl(`fill:${t.stroke_color};pointer-events:none`),
                t.caption,
            )
            .tap(() => t.run());
        t.frame.on("pointerdown", (event) => event.stopPropagation());
        t.accessory = t.svg.shape("g");
        const button = t.svg.shape("g").add(t.background, t.frame, t.accessory);
        button.on("pointerenter", () => t.background.stl("fill", "#e9eaec"));
        button.on("pointerleave", () => t.background.stl("fill", "#f1f2f4"));
        return button;
    }
}

export function createButton(
    c: construction,
    name: string | null | undefined,
    label: string,
    screen: Vec2,
    program: ExpressionProgram | null,
): button_object {
    return c.add(new button_object(c, name, label, screen, program));
}
