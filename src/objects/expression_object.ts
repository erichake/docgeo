import { advance, type Animation } from "../animation";
import type { construction } from "../construction";
import { $, type DOMElement } from "../dom";
import { t } from "../i18n";
import { derivative } from "../import/dgp_derivative";
import {
    evaluateFormula,
    evaluateProgram,
    formulaIdentifiers,
    formulaSource,
    programNodes,
    realPart,
    usesCoords2D,
    usesView,
    type FormulaEnv,
    type FormulaNode,
    type FormulaValue,
    type FormulaView,
    type ObjectMethod,
    type Program,
    type ScriptValue,
} from "../import/dgp_formula";
import type { Vec2 } from "../vec";
import {
    construction_object,
    dgoFormula,
    type DgoContext,
    writeName,
} from "./construction_object";
import { angle_object } from "./angle_object";
import { curve_object } from "./curve_object";
import { point_object } from "./point_object";
import { scriptCenter } from "./primitive_quadric_object";

// In a chunk of its own, loaded only by the figures that show LaTeX.
let katex: Promise<typeof import("katex").default> | undefined;
export const loadKaTeX = () =>
    (katex ??= Promise.all([
        import("katex/dist/katex.min.js"),
        import("katex/dist/katex.min.css"),
    ]).then(([module]) => module.default));

const DEFAULT_CURSOR_LENGTH = 200;
const DEFAULT_CURSOR_COLOR = "#780013";
const DEFAULT_CURSOR_RADIUS = 10;
const CURSOR_BORDER = 2;
const CURSOR_OFFSET_Y = 20;
// GeoGebra's checkbox, from its screen position: its box's offset and
// side, and its caption's gap.
const CHECKBOX_OFFSET: Vec2 = [5, 7];
const CHECKBOX_SIZE = 24;
const CHECKBOX_GAP = 11;
const CHECKBOX_COLOR = "#6557d2";

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

// As DGPad, a long list shows its first items and its size.
const SHOWN_ITEMS = 3;
function formatShown(value: ScriptValue, precision: number): string {
    if (!Array.isArray(value) || value.length <= SHOWN_ITEMS)
        return formatValue(value, precision);
    return `${formatValue(value.slice(0, SHOWN_ITEMS), precision).slice(0, -1)} ; … (${value.length} ${t("list_items")})]`;
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
    refs: Map<string, construction_object>;
    vec3: boolean;
}

// A slider's bounds when one of them reads other objects (e.g. "-3-n"):
// min and max follow them as the figure changes.
export interface SliderBounds {
    min: FormulaNode;
    max: FormulaNode;
    refs: Map<string, construction_object>;
}

// A formula or script that reads other objects' current state instead of
// sweeping "x" (e.g. DGPad's "d(P1,M)", "AI-AM-MI" reading other
// Expressions' live values, or "if(a<0){S1.setHidden(1)};\"text\""):
// recomputed on every geometry update, like formula_point_object, but
// produces a displayed value instead of a point's own coordinates.
export interface ExpressionProgram {
    program: Program;
    refs: Map<string, construction_object>;
    // The objects it styles.
    targets: Map<string, construction_object>;
    // True in a 3D figure (DGPad's legacy SetCoords is3D flag): a
    // referenced point then resolves to its full 3D coordinates (e.g.
    // "d(A,P4)" between two cube vertices) instead of the 2D/complex-number
    // projection a plain 2D point-referencing expression needs.
    vec3: boolean;
}

const functionFormula = (ref: construction_object | undefined) =>
    (ref instanceof expression_object || ref instanceof curve_object) &&
    ref.formula
        ? ref.formula
        : null;

// A call "E1(...)" of a function-valued expression or a curve among `refs`,
// or of its derivative with respect to each of `derivatives` in turn. The
// window is only read if the function needs it.
export function callFunction(
    refs: Map<string, construction_object>,
    name: string,
    args: FormulaValue[],
    view: () => FormulaView,
    derivatives: string[] = [],
): FormulaValue | null {
    const formula = functionFormula(refs.get(name));
    // A prime ("f'(x)") derives with respect to the function's variable.
    const derived =
        formula &&
        derivedFormula(
            formula,
            derivatives.map((variable) =>
                variable === "'" ? formula.variables[0] : variable,
            ),
        );
    return derived ? evaluateFunction(derived, args, view) : null;
}

const DERIVED = new WeakMap<
    ExpressionFormula,
    Map<string, ExpressionFormula | null>
>();

// Computed once from the formula the object has.
function derivedFormula(
    formula: ExpressionFormula,
    derivatives: string[],
): ExpressionFormula | null {
    if (derivatives.length === 0) return formula;
    const cache = DERIVED.get(formula) ?? new Map();
    DERIVED.set(formula, cache);
    const key = derivatives.join();
    if (!cache.has(key)) {
        const previous = derivedFormula(formula, derivatives.slice(0, -1));
        const node =
            previous &&
            derivative(
                previous.node,
                derivatives[derivatives.length - 1],
                (name) =>
                    functionFormula(formula.refs.get(name))?.variables ?? null,
            );
        cache.set(key, node && { ...formula, node });
    }
    return cache.get(key)!;
}

export function evaluateFunction(
    formula: ExpressionFormula,
    args: FormulaValue[],
    view: () => FormulaView,
): FormulaValue | null {
    return evaluateFormula(formula.node, {
        resolveIdentifier: (name) => {
            const index = formula.variables.indexOf(name);
            return index >= 0
                ? (args[index] ?? null)
                : formula.refs.get(name)!.scriptValue(formula.vec3);
        },
        view,
        callFunction: (name, callArgs, derivatives) =>
            callFunction(formula.refs, name, callArgs, view, derivatives),
    });
}

// DGPad's SET_EXP, as a manipulation: the value of a constant expression,
// a Blockly global among them, or where a free point is. Read later by the
// program, or computed after it as its child. Whether it was set.
export function setValue(
    target: construction_object,
    value: ScriptValue | null,
): boolean {
    if (
        target instanceof expression_object &&
        !target.formula &&
        !target.program
    ) {
        target.value = value;
        target.defined = value !== null;
        target.C.invalidateRender(target);
        return true;
    }
    if (
        target.constructor === point_object &&
        Array.isArray(value) &&
        (value.length === 2 || value.length === 3) &&
        value.every((c) => typeof c === "number")
    ) {
        const point = target as point_object;
        point.coords = [value[0], value[1], (value[2] as number) ?? point.z];
        if (point.pinned) point.pin();
        return true;
    }
    return false;
}

// DGPad's arrows at the end of a List's segments, [length, half width] in
// pixels: none unless both are given.
export const listArrow = (value: unknown): Vec2 | null =>
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((v) => typeof v === "number" && v)
        ? [value[0], value[1]]
        : null;

// A button's program, an expression's when its value changes or a point's
// when it is dragged (see event_object.ts): it styles objects and sets the
// value of expressions or where free points are, as a manipulation does.
export function runProgram(c: construction, expression: ExpressionProgram) {
    const { program, refs, targets, vec3 } = expression;
    evaluateProgram(program, {
        resolveIdentifier: (name) => refs.get(name)!.scriptValue(vec3),
        view: () => c.formulaView(),
        callMethod: (name, method, args) => {
            const target = targets.get(name);
            if (!target) return;
            if (method !== "setExpression")
                styleObject(c, target, method, args);
            else if (setValue(target, args[0])) c.invalidateGeometry(target);
        },
    });
}

// Carries out a script's styling method on one of the figure's objects.
export function styleObject(
    c: construction,
    target: construction_object,
    method: ObjectMethod,
    args: (ScriptValue | null)[],
): void {
    switch (method) {
        case "setHidden": {
            // DGPad's setHidden: 0 shown, 1 hidden, 2 super-hidden, and
            // hidden for anything that isn't a number.
            const value = realPart(args[0]);
            const hidden = value === null ? 1 : Math.trunc(Math.abs(value)) % 3;
            if (hidden === target.hidden) return;
            target.hidden = hidden;
            const dirty = target.geometryDirty;
            target.updateView();
            // Shown after the script changed what it depends on ("c = 0",
            // then "show P"): drawn now from parents not yet updated, it is
            // computed again after them.
            if (dirty) c.invalidateGeometry(target);
            // How the objects sharing its edges draw them depends on it
            // (see edgeStroke).
            c.invalidateProjection();
            return;
        }
        case "setShowName": {
            const value = realPart(args[0]);
            if (
                value === null ||
                !(target instanceof point_object) ||
                (value !== 0) === target.showName
            )
                return;
            target.showName = value !== 0;
            break;
        }
        case "setOpacity": {
            const value = realPart(args[0]);
            if (value === null || value === target.opacity) return;
            target.opacity = value;
            break;
        }
        case "setSize": {
            const value = realPart(args[0]);
            if (value === null || value === target.size) return;
            target.size = value;
            break;
        }
        case "setPrecision": {
            const value = realPart(args[0]);
            if (value === null || value === target.precision) return;
            target.precision = value;
            break;
        }
        // The step of a slider, or of a free or on-object point's drag.
        case "setIncrement": {
            const value = realPart(args[0]);
            if (value === null) return;
            if (target instanceof expression_object) target.increment = value;
            else if (target instanceof point_object)
                target.increment = [value, value];
            return;
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
        // An expression_list_object's, which this file can't import.
        case "setArrow":
            if (!("arrow" in target)) return;
            target.arrow = listArrow(args[0]);
            break;
        default:
            return;
    }
    if (target.hasView) target.createSVG();
    // A List's points take its color and size as it computes them.
    if ("segmentsSize" in target) c.invalidateGeometry(target);
    // An opaque face hides the edges behind it (see hidden_line.ts).
    c.invalidateProjection();
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
// label itself (in the editor only) or by anchoring it to a point. So `screen`
// is computed once by the caller and only re-projected along its anchor.
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
    bounds: SliderBounds | null;
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
    // GeoGebra's checkbox, captioned by `text`, worth 1 or 0.
    checkbox = false;
    // The name of DGPad's Blockly global it holds, which programs read and
    // set (see globalName in dgp_formula.ts).
    global: string | null = null;
    // A string value is LaTeX, drawn by KaTeX from its top left corner.
    latex = false;
    // GeoGebra's input box, as many characters wide, from its top left
    // corner: it shows the number its formula reads and changes it.
    inputLength = 0;
    screen: Vec2;
    // ExpressionOn: `screen` follows this point, `alpha` pixels away.
    anchor: point_object | null = null;
    alpha: Vec2 = [0, 0];
    animation: Animation | null = null;
    // What an animation has yet to move a slider by, less than its increment.
    private animationCarry = 0;
    private knobX = 0;
    private valueText!: DOMElement;
    private cursor?: DOMElement;
    private track?: DOMElement;
    private progress?: DOMElement;
    private knob?: DOMElement;
    private box?: DOMElement;
    private tex?: DOMElement;
    private renderedTeX: string | null = null;
    private check?: DOMElement;
    private field?: DOMElement;

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
        bounds: SliderBounds | null = null,
    ) {
        super(c, name, "expression");
        this.text = text;
        this.value = value;
        this.formula = formula;
        this.program = program;
        this.viewDependent =
            program !== null &&
            (programNodes(program.program).some(usesCoords2D) ||
                [...program.refs.values()].some(
                    (ref) =>
                        ref instanceof expression_object && ref.viewDependent,
                ));
        // A script that only reads the window is computed with the geometry,
        // before the objects that read its value.
        this.readsView =
            program !== null && programNodes(program.program).some(usesView);
        this.min = min;
        this.max = max;
        this.bounds = bounds;
        this.increment = 0;
        this.cursorLength = DEFAULT_CURSOR_LENGTH;
        this.vertical = false;
        this.cursorColor = DEFAULT_CURSOR_COLOR;
        this.cursorRadius = DEFAULT_CURSOR_RADIUS;
        this.cursorOpacity = 0;
        this.screen = screen;
        if (formula) this.addParents(...formula.refs.values());
        if (bounds) this.addParents(...bounds.refs.values());
        if (program) {
            this.addParents(...program.refs.values());
            // Not one it reads, which DGPad's SET_EXP may set.
            const refs = [...program.refs.values()];
            program.targets.forEach(
                (target) => refs.includes(target) || target.addParents(this),
            );
        }
    }

    scriptValue(_vec3: boolean): ScriptValue | null {
        return this.defined ? this.value : null;
    }

    dgo(context: DgoContext): [string, unknown] {
        const content = this.program
            ? {
                  s: dgoFormula(
                      formulaSource(this.program.program),
                      new Map([...this.program.refs, ...this.program.targets]),
                      context,
                  ),
              }
            : this.formula
              ? {
                    f: dgoFormula(
                        this.formula.source,
                        this.formula.refs,
                        context,
                    ),
                }
              : { v: this.value };
        return [
            "Ex",
            {
                t: this.text,
                ...content,
                ...(this.global !== null && { g: this.global }),
                ...(this.bounds
                    ? {
                          mn: this.dgoBound(this.bounds.min, context),
                          mx: this.dgoBound(this.bounds.max, context),
                      }
                    : {
                          ...(this.min !== null && { mn: this.min }),
                          ...(this.max !== null && { mx: this.max }),
                      }),
                ...(this.anchor
                    ? {
                          on: context.index(this.anchor),
                          d: this.alpha.map(Math.round),
                      }
                    : { xy: context.screen(this.screen) }),
            },
        ];
    }

    private dgoBound(bound: FormulaNode, context: DgoContext) {
        const names = formulaIdentifiers(bound);
        return dgoFormula(
            formulaSource(bound),
            new Map([...this.bounds!.refs].filter(([name]) => names.has(name))),
            context,
        );
    }

    computeGeometry(): void {
        if (this.bounds) {
            const { min, max, refs } = this.bounds;
            const env: FormulaEnv = {
                resolveIdentifier: (name) =>
                    refs.get(name)!.scriptValue(!this.C.GRID.is2D),
                view: () => this.C.formulaView(),
            };
            this.min = realPart(evaluateFormula(min, env));
            this.max = realPart(evaluateFormula(max, env));
        }
        if (!this.viewDependent) this.evaluateProgram();
    }

    project(): void {
        if (this.anchor)
            this.screen = [
                this.anchor.sx + this.alpha[0],
                this.anchor.sy + this.alpha[1],
            ];
        if (this.viewDependent) this.evaluateProgram();
    }

    private evaluateProgram(): void {
        if (!this.program) return;
        const { program, refs, targets, vec3 } = this.program;
        const view = () => this.C.formulaView();
        this.value = evaluateProgram(program, {
            resolveIdentifier: (name) => refs.get(name)!.scriptValue(vec3),
            view,
            coords2D: (name) => {
                const ref = refs.get(name)!;
                return ref instanceof point_object ? ref.coords2D() : null;
            },
            orientedAngle: (name) => {
                const ref = refs.get(name)!;
                if (!(ref instanceof angle_object) || !ref.defined) return null;
                const direction = (point: point_object) =>
                    Math.atan2(
                        ref.O.screen[1] - point.screen[1],
                        point.screen[0] - ref.O.screen[0],
                    );
                const angle = direction(ref.B) - direction(ref.A);
                const turn = 2 * Math.PI;
                return angle - Math.floor(angle / turn) * turn;
            },
            callFunction: (name, args, derivatives) =>
                callFunction(refs, name, args, view, derivatives),
            center: (name) => scriptCenter(refs.get(name)!, vec3),
            // An expression_list_object's, which this file can't import.
            turtlePoints: (name) =>
                (refs.get(name) as { points?: ScriptValue[] }).points ?? null,
            restrictView: (angle, range) => {
                if (this.C.GRID.restrict(angle, range))
                    this.C.invalidateProjection();
            },
            callMethod: (name, method, args) => {
                // None for an object declared after it (see DGO.md).
                const target = targets.get(name);
                if (!target) return;
                if (method === "setExpression") setValue(target, args[0]);
                else styleObject(this.C, target, method, args);
            },
        });
        this.defined = this.value !== null;
    }

    get isCursor(): boolean {
        return (
            typeof this.value === "number" &&
            !Number.isNaN(this.value) &&
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

    // As in DGPad: a slider moves `speed` fiftieths of its range per second
    // (tenths in GeoGebra), by whole increments if it has one; another
    // number, `speed` per second.
    animate(seconds: number): void {
        if (this.formula || this.program || typeof this.value !== "number")
            return;
        const animation = this.animation!;
        let step = animation.direction * animation.speed * seconds;
        let value: number;
        if (this.isCursor) {
            const [min, max] = [this.min!, this.max!];
            step *= (max - min) / (animation.geogebra ? 10 : 50);
            if (this.increment > 0) {
                this.animationCarry += step;
                if (Math.abs(this.animationCarry) < this.increment) return;
                step =
                    animation.direction *
                    this.increment *
                    Math.floor(Math.abs(this.animationCarry) / this.increment);
                this.animationCarry = 0;
            }
            value = advance(animation, this.value, min, max, step);
        } else value = this.value + step;
        this.value = Math.abs(value) < 1e-13 ? 0 : value;
        this.C.invalidateGeometry(this);
    }

    render(): void {
        this.dom.stl("display", this.isVisible ? "block" : "none");
        if (!this.isVisible) return;
        const [x, y] = this.screen;
        if (this.box && this.check) {
            const [left, top] = [
                x + CHECKBOX_OFFSET[0],
                y + CHECKBOX_OFFSET[1],
            ];
            const checked = this.value !== 0;
            this.box
                .att("x", left)
                .att("y", top)
                .stl("fill", checked ? CHECKBOX_COLOR : "white")
                .stl("stroke", checked ? CHECKBOX_COLOR : "#666");
            this.check
                .att("d", `M${left + 6} ${top + 12}l4.5 4.5l7.5-8.5`)
                .stl("display", checked ? "block" : "none");
            this.valueText
                .att("x", left + CHECKBOX_SIZE + CHECKBOX_GAP)
                .att("y", top + CHECKBOX_SIZE / 2 + this.fontSize / 3)
                .text(this.text);
            return;
        }

        if (this.field) {
            this.field.att("x", x).att("y", y);
            const input = this.field.find("input")!.dom() as HTMLInputElement;
            if (document.activeElement !== input)
                input.value =
                    typeof this.value === "number"
                        ? formatNumber(this.value, Math.max(this.precision, 0))
                        : "";
            return;
        }

        if (this.tex) {
            this.tex.att("x", x).att("y", y);
            // A decimal comma without the space of a punctuation mark.
            const content =
                typeof this.value === "string" ? this.rounded("{,}") : "";
            if (content !== this.renderedTeX) {
                this.renderedTeX = content;
                const div = this.tex.find("div")!;
                loadKaTeX().then((katex) => {
                    if (this.renderedTeX === content)
                        div.inner(
                            katex.renderToString(content, {
                                throwOnError: false,
                            }),
                        );
                });
            }
            return;
        }

        this.valueText.att("x", x).att("y", y);
        if (typeof this.value === "string")
            this.valueText.text(this.rounded(","));
        else {
            const shown =
                this.precision < 0
                    ? ""
                    : this.formula
                      ? this.formula.source
                      : formatShown(this.value!, this.precision);
            if (this.text === "")
                writeName(this.valueText, this.name, " = " + shown);
            else this.valueText.text(this.text + shown);
        }

        if (!this.cursor || !this.track || !this.progress || !this.knob) return;
        // Bounds read from other objects can be undefined.
        this.cursor.stl("display", this.isCursor ? "" : "none");
        if (!this.isCursor) return;
        // A vertical slider is the horizontal one turned a quarter turn
        // counterclockwise around its start.
        const trackY = this.vertical ? y : y + CURSOR_OFFSET_Y;
        const half = this.size / 2;
        // As DGPad, the knob stays on the track when the value is out of
        // bounds that changed.
        const along =
            ((this.value as number) - this.min!) / (this.max! - this.min!);
        this.knobX = x + this.cursorLength * Math.min(Math.max(along, 0), 1);
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

    // The typed number, with a decimal point or comma, becomes the value of
    // the number the formula reads, within its slider's bounds.
    private submit(typed: string): void {
        const [target] =
            this.program!.refs.values() as Iterable<expression_object>;
        const value = Number(typed.trim().replace(",", "."));
        if (typed.trim() !== "" && Number.isFinite(value)) {
            target.value = target.isCursor
                ? Math.min(Math.max(value, target.min!), target.max!)
                : value;
            this.C.invalidateGeometry(target);
        } else this.C.invalidateGeometry(this);
    }

    // As DGPad, a text shows alone, its numbers rounded.
    private rounded(decimalComma: string): string {
        return (this.value as string).replace(/\d+(?:\.\d+)?/g, (number) =>
            formatNumber(Number(number), Math.max(this.precision, 0)).replace(
                ",",
                decimalComma,
            ),
        );
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as expression_object;
        const dom = t.svg.shape("g");

        if (t.latex) {
            t.renderedTeX = null;
            t.tex = t.svg
                .shape("foreignObject")
                .att("width", 1)
                .att("height", 1)
                .stl("overflow:visible;pointer-events:none")
                .add(
                    $.create("div").stl(
                        `width:max-content;color:${t.stroke_color};font-size:${t.fontSize}px`,
                    ),
                );
            return dom.add(t.tex);
        }

        if (t.inputLength) {
            const input = $.create("input")
                .att("type", "text")
                .stl(
                    `width:${0.75 * t.inputLength}em;padding:5px 4px;border:1px solid #dcdcdc;border-radius:5px;font-family:Verdana;font-size:${t.fontSize}px;color:${t.stroke_color}`,
                );
            // Neither a pan of the figure nor its keyboard shortcuts.
            input.on("pointerdown", (event) => event.stopPropagation(), false);
            input.on(
                "keydown",
                (event) => {
                    event.stopPropagation();
                    if (event.key === "Enter")
                        (input.dom() as HTMLInputElement).blur();
                },
                false,
            );
            input.on(
                "change",
                () => t.submit((input.dom() as HTMLInputElement).value),
                false,
            );
            t.field = t.svg
                .shape("foreignObject")
                .att("width", 1)
                .att("height", 1)
                .stl("overflow:visible")
                .add(input);
            return dom.add(t.field);
        }

        t.valueText = t.svg
            .shape("text")
            .stl(
                `fill:${t.stroke_color};font-family:Verdana;font-size:${t.fontSize}px;pointer-events:none`,
            );
        dom.add(t.valueText);

        if (t.checkbox) {
            t.box = t.svg
                .shape("rect")
                .att("width", CHECKBOX_SIZE)
                .att("height", CHECKBOX_SIZE)
                .att("rx", 3)
                .stl("stroke-width:2;cursor:pointer")
                .stl("pointer-events", t.program ? "none" : "auto");
            t.check = t.svg
                .shape("path")
                .stl(
                    "fill:none;stroke:white;stroke-width:2.5;pointer-events:none",
                );
            t.box.drag(
                () => {},
                undefined,
                (_, cancelled) => {
                    if (cancelled) return;
                    t.value = t.value === 0 ? 1 : 0;
                    t.C.invalidateGeometry(t);
                },
            );
            return dom.add(t.box, t.check);
        }

        // Bounds read from other objects are only computed after this.
        if (!t.isCursor && !(t.bounds && typeof t.value === "number"))
            return dom;

        t.track = t.svg
            .shape("path")
            .stl(`fill:none;stroke:${t.stroke_color};stroke-width:1`);
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
    bounds: SliderBounds | null = null,
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
            bounds,
        ),
    );
}
