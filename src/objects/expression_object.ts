import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import {
    evaluateFormula,
    realPart,
    type FormulaNode,
    type FormulaValue,
} from "../import/dgp_formula";
import type { Vec2 } from "../vec";
import { construction_object } from "./construction_object";
import type { point_object } from "./point_object";

const DEFAULT_CURSOR_LENGTH = 200;
const DEFAULT_CURSOR_COLOR = "#780013";
const DEFAULT_CURSOR_RADIUS = 10;
const CURSOR_BORDER = 2;
const CURSOR_OFFSET_Y = 20;

export function formatNumber(value: number, precision: number): string {
    const factor = 10 ** precision;
    return (Math.round(value * factor) / factor).toString().replace(".", ",");
}

export function formatValue(
    value: number | number[],
    precision: number,
): string {
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

// A named formula of x (e.g. "0.5x^2-4"), the reader's take on a DGPad
// Expression that isn't a constant: `refs` holds the other function-valued
// expressions its own formula calls by name (e.g. "E1(x)" inside another
// expression's formula), so evaluateAtX can resolve those calls recursively.
export interface ExpressionFormula {
    node: FormulaNode;
    source: string;
    refs: Map<string, expression_object>;
}

// A formula that reads other objects' current state instead of sweeping
// "x" (e.g. DGPad's "d(P1,M)", or "AI-AM-MI" reading other Expressions'
// live values): recomputed on every geometry update, like
// formula_point_object, but produces a displayed value instead of a
// point's own coordinates.
export interface PointExpressionFormula {
    node: FormulaNode;
    source: string;
    refs: Map<string, point_object | expression_object>;
    // True in a 3D figure (DGPad's legacy SetCoords is3D flag): a
    // referenced point then resolves to its full 3D coordinates (e.g.
    // "d(A,P4)" between two cube vertices) instead of the 2D/complex-number
    // projection a plain 2D point-referencing expression needs.
    vec3: boolean;
}

export function evaluateAtX(
    formula: ExpressionFormula,
    x: number,
    pixelScale: number,
): FormulaValue | null {
    return evaluateFormula(formula.node, {
        resolveIdentifier: (name) => (name === "x" ? [x, 0] : null),
        pixelScale: () => pixelScale,
        callFunction: (name, args) => {
            const ref = formula.refs.get(name)?.formula;
            if (!ref) return null;
            const argX = realPart(args[0] ?? null);
            return argX === null ? null : evaluateAtX(ref, argX, pixelScale);
        },
    });
}

// A read-only reader's take on DGPad's ExpressionObject: displays a
// constant value (number, complex number as [re, im], or vector), a named
// formula of x (e.g. "0.5x^2-4", via `formula`, used as a callable function
// by Curvus and other expressions), and, when bounds are given, a draggable
// slider that updates a constant value. DGPad expressions can be arbitrary
// math (including functions of other objects, evaluated in a sandboxed JS
// interpreter); this project only supports the constant literals and
// single-variable formulas it needs to display already-computed figures
// (see parseExpressionValue in dgp_commands.ts).
//
// Unlike every other object in this file, an expression isn't a geometric
// object: DGPad pins it to a fixed window position (screen pixels, from
// SetCoords at the time the figure was saved) and never moves it — not on
// pan/zoom, not on a 3D rotation drag, only via an explicit drag of the
// label itself (unsupported here) or by anchoring it to a point. So `screen`
// is computed once by the caller and never re-projected.
export class expression_object extends construction_object {
    text: string;
    value: number | number[] | null;
    formula: ExpressionFormula | null;
    pointFormula: PointExpressionFormula | null;
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
        value: number | number[] | null,
        min: number | null,
        max: number | null,
        screen: Vec2,
        formula: ExpressionFormula | null = null,
        pointFormula: PointExpressionFormula | null = null,
    ) {
        super(c, name, "expression");
        this.text = text;
        this.value = value;
        this.formula = formula;
        this.pointFormula = pointFormula;
        this.min = min;
        this.max = max;
        this.increment = 0;
        this.cursorLength = DEFAULT_CURSOR_LENGTH;
        this.cursorColor = DEFAULT_CURSOR_COLOR;
        this.cursorRadius = DEFAULT_CURSOR_RADIUS;
        this.cursorOpacity = 0;
        this.screen = screen;
        if (formula) this.addParents(...formula.refs.values());
        if (pointFormula) this.addParents(...pointFormula.refs.values());
    }

    computeGeometry(): void {
        if (!this.pointFormula) return;
        const { refs, vec3 } = this.pointFormula;
        const result = evaluateFormula(this.pointFormula.node, {
            resolveIdentifier: (name) => {
                const ref = refs.get(name);
                if (!ref || !ref.defined) return null;
                if (ref instanceof expression_object)
                    return typeof ref.value === "number"
                        ? [ref.value, 0]
                        : null;
                return vec3 ? ref.coords : [ref.coords[0], ref.coords[1]];
            },
            pixelScale: () => this.C.GRID.UNIT[0],
        });
        this.defined = result !== null;
        this.value =
            result === null || typeof result === "number"
                ? result
                : // A zero-imaginary Vec2 (e.g. "AI-AM-MI", a real-valued
                  // subtraction of scalars each wrapped through the formula
                  // engine's Vec2 slot — see dgp_formula.ts) displays as that
                  // plain number rather than a "[x ; 0]" pair.
                  result.length === 2 && result[1] === 0
                  ? result[0]
                  : [...result];
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
                    : prefix +
                          (this.formula
                              ? this.formula.source
                              : formatValue(
                                    this.value as number | number[],
                                    this.precision,
                                )),
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
    value: number | number[] | null,
    min: number | null,
    max: number | null,
    screen: Vec2,
    formula: ExpressionFormula | null = null,
    pointFormula: PointExpressionFormula | null = null,
): expression_object {
    return c.add(
        new expression_object(
            c,
            name,
            text,
            value,
            min,
            max,
            screen,
            formula,
            pointFormula,
        ),
    );
}
