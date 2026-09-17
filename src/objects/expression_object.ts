import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { Vec2 } from "../vec";
import { construction_object } from "./construction_object";

const DEFAULT_CURSOR_LENGTH = 200;
const DEFAULT_CURSOR_COLOR = "#780013";
const DEFAULT_CURSOR_RADIUS = 10;
const CURSOR_BORDER = 2;
const CURSOR_OFFSET_Y = 20;

function formatNumber(value: number, precision: number): string {
    const factor = 10 ** precision;
    return (Math.round(value * factor) / factor).toString().replace(".", ",");
}

function formatValue(value: number | number[], precision: number): string {
    if (Array.isArray(value))
        return (
            "[" +
            value.map((item) => formatNumber(item, precision)).join(" ; ") +
            "]"
        );
    return formatNumber(value, precision);
}

// A rounded "capsule" outline, used for the slider track.
function roundRectPath(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
): string {
    return (
        `M${x + r} ${y}` +
        ` L${x + w - r} ${y}` +
        ` Q${x + w} ${y} ${x + w} ${y + r}` +
        ` L${x + w} ${y + h - r}` +
        ` Q${x + w} ${y + h} ${x + w - r} ${y + h}` +
        ` L${x + r} ${y + h}` +
        ` Q${x} ${y + h} ${x} ${y + h - r}` +
        ` L${x} ${y + r}` +
        ` Q${x} ${y} ${x + r} ${y}` +
        " Z"
    );
}

// Same capsule, but only the left end is rounded: the slider's filled
// progress indicator, which butts up against the knob on its right side.
function progressPath(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
): string {
    const right = x + Math.max(w, 0);
    return (
        `M${x + r} ${y}` +
        ` L${right} ${y}` +
        ` L${right} ${y + h}` +
        ` L${x + r} ${y + h}` +
        ` Q${x} ${y + h} ${x} ${y + h - r}` +
        ` L${x} ${y + r}` +
        ` Q${x} ${y} ${x + r} ${y}` +
        " Z"
    );
}

// A read-only reader's take on DGPad's ExpressionObject: displays a
// constant value (number, complex number as [re, im], or vector) and, when
// bounds are given, a draggable slider that updates it. DGPad expressions
// can be arbitrary math (including functions of other objects, evaluated in
// a sandboxed JS interpreter); this project only supports the constant
// literals it needs to display already-computed figures (see
// parseExpressionValue in dgp_commands.ts).
//
// Unlike every other object in this file, an expression isn't a geometric
// object: DGPad pins it to a fixed window position (screen pixels, from
// SetCoords at the time the figure was saved) and never moves it — not on
// pan/zoom, not on a 3D rotation drag, only via an explicit drag of the
// label itself (unsupported here) or by anchoring it to a point. So `screen`
// is computed once by the caller and never re-projected.
export class expression_object extends construction_object {
    text: string;
    value: number | number[];
    min: number | null;
    max: number | null;
    increment: number;
    cursorLength: number;
    cursorColor: string;
    cursorRadius: number;
    // Matches point_object's own opacity convention: 0 (the default) draws a
    // white knob with a colored border, a nonzero value fills it solid with
    // cursorColor at that opacity instead.
    cursorOpacity: number;
    screen: Vec2;
    private knobX = 0;
    private valueText!: DOMElement;
    private track?: DOMElement;
    private progress?: DOMElement;
    private knob?: DOMElement;

    constructor(
        c: construction,
        name: string | null | undefined,
        text: string,
        value: number | number[],
        min: number | null,
        max: number | null,
        screen: Vec2,
    ) {
        super(c, name, "expression");
        this.text = text;
        this.value = value;
        this.min = min;
        this.max = max;
        this.increment = 0;
        this.cursorLength = DEFAULT_CURSOR_LENGTH;
        this.cursorColor = DEFAULT_CURSOR_COLOR;
        this.cursorRadius = DEFAULT_CURSOR_RADIUS;
        this.cursorOpacity = 0;
        this.screen = screen;
    }

    get isCursor(): boolean {
        return (
            typeof this.value === "number" &&
            this.min !== null &&
            this.max !== null
        );
    }

    mousedrag(ev: PointerEvent): void {
        const [px] = this.C.pointerPosition(ev);
        const [x] = this.screen;
        const min = this.min!;
        const max = this.max!;
        const clampedX = Math.min(Math.max(px, x), x + this.cursorLength);
        let value = min + ((max - min) * (clampedX - x)) / this.cursorLength;
        if (this.increment > 0) {
            const step = this.increment;
            value = min + Math.round((value - min) / step) * step;
            while (value > max) value -= step;
            value = Math.max(min, value);
        }
        this.value = value;
        this.C.invalidateGeometry(this);
    }

    render(): void {
        this.dom.stl("display", this.isVisible ? "block" : "none");
        if (!this.isVisible) return;
        const [x, y] = this.screen;

        const prefix = this.text === "" ? this.name + " = " : this.text;
        this.valueText
            .att("x", x)
            .att("y", y)
            .text(
                this.precision < 0
                    ? prefix
                    : prefix + formatValue(this.value, this.precision),
            );

        if (!this.isCursor || !this.track || !this.progress || !this.knob)
            return;
        const trackY = y + CURSOR_OFFSET_Y;
        const half = this.size / 2;
        this.knobX =
            x +
            (this.cursorLength * ((this.value as number) - this.min!)) /
                (this.max! - this.min!);
        this.track.att(
            "d",
            roundRectPath(x, trackY - half, this.cursorLength, this.size, half),
        );
        this.progress.att(
            "d",
            progressPath(x, trackY - half, this.knobX - x, this.size, half),
        );
        this.knob.att("cx", this.knobX).att("cy", trackY);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as expression_object;
        const dom = t.svg.shape("g");

        t.valueText = t.svg
            .shape("text")
            .stl(
                `fill:${t.stroke_color};font-family:Verdana;font-size:${t.fontSize}px;pointer-events:none`,
            );
        dom.add(t.valueText);

        if (!t.isCursor) return dom;

        t.track = t.svg
            .shape("path")
            .stl(
                `fill:none;stroke:${t.stroke_color};stroke-width:${t.prefs.point.border ?? 1}`,
            );
        t.progress = t.svg
            .shape("path")
            .stl(`fill:${t.stroke_color};stroke:none`);
        const fill = t.cursorOpacity ? t.cursorColor : "white";
        const fillOpacity = t.cursorOpacity || 1;
        t.knob = t.svg
            .shape("circle")
            .att("r", t.cursorRadius)
            .stl(
                `fill:${fill};fill-opacity:${fillOpacity};stroke:${t.cursorColor};stroke-width:${CURSOR_BORDER};cursor:pointer`,
            )
            .drag((event) => t.mousedrag(event));
        dom.add(t.track, t.progress, t.knob);
        return dom;
    }
}

export function createExpression(
    c: construction,
    name: string | null | undefined,
    text: string,
    value: number | number[],
    min: number | null,
    max: number | null,
    screen: Vec2,
): expression_object {
    return c.add(new expression_object(c, name, text, value, min, max, screen));
}
