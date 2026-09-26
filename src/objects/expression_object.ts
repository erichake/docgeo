import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import {
    evaluateFormula,
    evaluateProgram,
    programNodes,
    realPart,
    usesCoords2D,
    usesView,
    type FormulaNode,
    type FormulaValue,
    type FormulaView,
    type ObjectMethod,
    type Program,
    type ScriptValue,
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

export function formatValue(value: ScriptValue, precision: number): string {
    if (typeof value === "string") return value;
    if (typeof value === "number") return formatNumber(value, precision);
    return (
        "[" +
        value.map((item) => formatValue(item, precision)).join(" ; ") +
        "]"
    );
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

// A named formula of DGPad's function variables x, y, z, t (e.g.
// "0.5x^2-4", or "z^2+c" applied to a complex number), the reader's take on
// a DGPad Expression that isn't a constant: `refs` holds the points and
// expressions it reads, including the function-valued ones its formula calls
// by name (e.g. "E1(x)"), so evaluateFunction resolves those calls
// recursively.
export interface ExpressionFormula {
    node: FormulaNode;
    source: string;
    variables: string[];
    refs: Map<string, point_object | expression_object>;
    vec3: boolean;
}

// A formula or script that reads other objects' current state instead of
// sweeping "x" (e.g. DGPad's "d(P1,M)", "AI-AM-MI" reading other
// Expressions' live values, or "if(a<0){S1.setHidden(1)};\"text\""):
// recomputed on every geometry update, like formula_point_object, but
// produces a displayed value instead of a point's own coordinates.
export interface ExpressionProgram {
    program: Program;
    refs: Map<string, point_object | expression_object>;
    // The objects it styles.
    targets: Map<string, construction_object>;
    // True in a 3D figure (DGPad's legacy SetCoords is3D flag): a
    // referenced point then resolves to its full 3D coordinates (e.g.
    // "d(A,P4)" between two cube vertices) instead of the 2D/complex-number
    // projection a plain 2D point-referencing expression needs.
    vec3: boolean;
}

export function referenceValue(
    ref: point_object | expression_object,
    vec3: boolean,
): ScriptValue | null {
    if (!ref.defined) return null;
    if (ref instanceof expression_object) return ref.value;
    return vec3 ? [...ref.coords] : [ref.coords[0], ref.coords[1]];
}

// A call "E1(...)" of a function-valued expression among `refs`.
function callFunction(
    refs: Map<string, point_object | expression_object>,
    name: string,
    args: FormulaValue[],
    view: FormulaView,
): FormulaValue | null {
    const ref = refs.get(name);
    return ref instanceof expression_object && ref.formula
        ? evaluateFunction(ref.formula, args, view)
        : null;
}

export function evaluateFunction(
    formula: ExpressionFormula,
    args: FormulaValue[],
    view: FormulaView,
): FormulaValue | null {
    return evaluateFormula(formula.node, {
        resolveIdentifier: (name) => {
            const index = formula.variables.indexOf(name);
            return index >= 0
                ? (args[index] ?? null)
                : referenceValue(formula.refs.get(name)!, formula.vec3);
        },
        view: () => view,
        callFunction: (name, callArgs) =>
            callFunction(formula.refs, name, callArgs, view),
    });
}

// A read-only reader's take on DGPad's ExpressionObject: displays a
// constant value (number, complex number as [re, im], or vector), a named
// function (e.g. "0.5x^2-4", via `formula`, used as a callable function
// by Curvus and other expressions), the value of a formula or script of
// other objects (via `program`), and, when bounds are given, a draggable
// slider that updates a constant value.
//
// Unlike every other object in this file, an expression isn't a geometric
// object: DGPad pins it to a fixed window position (screen pixels, from
// SetCoords at the time the figure was saved) and never moves it — not on
// pan/zoom, not on a 3D rotation drag, only via an explicit drag of the
// label itself (unsupported here) or by anchoring it to a point. So `screen`
// is computed once by the caller and never re-projected.
export class expression_object extends construction_object {
    text: string;
    value: ScriptValue | null;
    formula: ExpressionFormula | null;
    program: ExpressionProgram | null;
    // Computed with the projection rather than the geometry, since it reads
    // where points are drawn (see coords2D in dgp_formula.ts).
    viewDependent: boolean;
    min: number | null;
    max: number | null;
    increment: number;
    cursorLength: number;
    // A vertical slider rises from its screen position, its value written
    // beside its knob.
    vertical: boolean;
    cursorColor: string;
    cursorRadius: number;
    // Matches point_object's own opacity convention: 0 (the default) draws a
    // white knob with a colored border, a nonzero value fills it solid with
    // cursorColor at that opacity instead.
    cursorOpacity: number;
    screen: Vec2;
    private knobX = 0;
    private valueText!: DOMElement;
    private cursor?: DOMElement;
    private track?: DOMElement;
    private progress?: DOMElement;
    private knob?: DOMElement;

    constructor(
        c: construction,
        name: string | null | undefined,
        text: string,
        value: ScriptValue | null,
        min: number | null,
        max: number | null,
        screen: Vec2,
        formula: ExpressionFormula | null = null,
        program: ExpressionProgram | null = null,
    ) {
        super(c, name, "expression");
        this.text = text;
        this.value = value;
        this.formula = formula;
        this.program = program;
        this.viewDependent =
            program !== null &&
            (programNodes(program.program).some(
                (node) => usesCoords2D(node) || usesView(node),
            ) ||
                [...program.refs.values()].some(
                    (ref) =>
                        ref instanceof expression_object && ref.viewDependent,
                ));
        this.min = min;
        this.max = max;
        this.increment = 0;
        this.cursorLength = DEFAULT_CURSOR_LENGTH;
        this.vertical = false;
        this.cursorColor = DEFAULT_CURSOR_COLOR;
        this.cursorRadius = DEFAULT_CURSOR_RADIUS;
        this.cursorOpacity = 0;
        this.screen = screen;
        if (formula) this.addParents(...formula.refs.values());
        if (program) {
            this.addParents(...program.refs.values());
            program.targets.forEach((target) => target.addParents(this));
        }
    }

    computeGeometry(): void {
        if (!this.viewDependent) this.evaluateProgram();
    }

    project(): void {
        if (this.viewDependent) this.evaluateProgram();
    }

    private evaluateProgram(): void {
        if (!this.program) return;
        const { program, refs, targets, vec3 } = this.program;
        const grid = this.C.GRID;
        this.value = evaluateProgram(program, {
            resolveIdentifier: (name) => referenceValue(refs.get(name)!, vec3),
            view: () => this.C.formulaView(),
            coords2D: (name) => {
                const ref = refs.get(name)!;
                if (
                    ref instanceof expression_object ||
                    !ref.defined ||
                    !ref.projectionDefined
                )
                    return null;
                const [x, y] = ref.screen;
                return [
                    (x - grid.ORG[0]) / grid.UNIT[0],
                    (grid.ORG[1] - y) / grid.UNIT[1],
                ];
            },
            callFunction: (name, args) =>
                callFunction(refs, name, args, this.C.formulaView()),
            callMethod: (name, method, args) =>
                this.style(targets.get(name)!, method, args),
        });
        this.defined = this.value !== null;
    }

    private style(
        target: construction_object,
        method: ObjectMethod,
        args: (ScriptValue | null)[],
    ): void {
        switch (method) {
            case "setHidden": {
                // DGPad's setHidden: 0 shown, 1 hidden, 2 super-hidden, and
                // hidden for anything that isn't a number.
                const value = realPart(args[0]);
                const hidden =
                    value === null ? 1 : Math.trunc(Math.abs(value)) % 3;
                if (hidden === target.hidden) return;
                target.hidden = hidden;
                target.updateView();
                // How the objects sharing its edges draw them depends on it
                // (see edgeStroke).
                this.C.invalidateProjection();
                return;
            }
            case "setOpacity": {
                const value = realPart(args[0]);
                if (value === null || value === target.opacity) return;
                target.opacity = value;
                break;
            }
            case "setRGBColor": {
                const channels = args.map(realPart);
                if (channels.includes(null)) return;
                const color = `rgb(${channels.map((c) => Math.round(c!)).join(",")})`;
                if (color === target.stroke_color) return;
                target.fill_color = color;
                target.stroke_color = color;
                break;
            }
            default:
                return;
        }
        if (target.hasView) target.createSVG();
        // An opaque face hides the edges behind it (see hidden_line.ts).
        this.C.invalidateProjection();
    }

    get isCursor(): boolean {
        return (
            typeof this.value === "number" &&
            this.min !== null &&
            this.max !== null
        );
    }

    mousedrag(ev: PointerEvent): void {
        const [px, py] = this.C.pointerPosition(ev);
        const [x, y] = this.screen;
        const min = this.min!;
        const max = this.max!;
        const along = Math.min(
            Math.max(this.vertical ? y - py : px - x, 0),
            this.cursorLength,
        );
        let value = min + ((max - min) * along) / this.cursorLength;
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
                typeof this.value === "string"
                    ? // As DGPad, a text shows alone, its numbers rounded.
                      this.value.replace(/\d+(?:\.\d+)?/g, (number) =>
                          formatNumber(
                              Number(number),
                              Math.max(this.precision, 0),
                          ),
                      )
                    : this.precision < 0
                      ? prefix
                      : prefix +
                        (this.formula
                            ? this.formula.source
                            : formatValue(this.value!, this.precision)),
            );

        if (
            !this.isCursor ||
            !this.cursor ||
            !this.track ||
            !this.progress ||
            !this.knob
        )
            return;
        // A vertical slider is the horizontal one turned a quarter turn
        // counterclockwise around its start.
        const trackY = this.vertical ? y : y + CURSOR_OFFSET_Y;
        const half = this.size / 2;
        this.knobX =
            x +
            (this.cursorLength * ((this.value as number) - this.min!)) /
                (this.max! - this.min!);
        this.cursor.att(
            "transform",
            this.vertical ? `rotate(-90 ${x} ${y})` : "",
        );
        if (this.vertical)
            this.valueText
                .att("x", x + this.cursorRadius + CURSOR_BORDER + 4)
                .att("y", y - (this.knobX - x) + this.fontSize / 3);
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
        t.cursor = t.svg.shape("g").add(t.track, t.progress, t.knob);
        dom.add(t.cursor);
        return dom;
    }
}

export function createExpression(
    c: construction,
    name: string | null | undefined,
    text: string,
    value: ScriptValue | null,
    min: number | null,
    max: number | null,
    screen: Vec2,
    formula: ExpressionFormula | null = null,
    program: ExpressionProgram | null = null,
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
            program,
        ),
    );
}
