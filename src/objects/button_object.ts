import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import {
    evaluateProgram,
    formulaSource,
    type ScriptValue,
} from "../import/dgp_formula";
import type { Vec2 } from "../vec";
import {
    construction_object,
    dgoFormula,
    type DgoContext,
} from "./construction_object";
import {
    expression_object,
    styleObject,
    type ExpressionProgram,
} from "./expression_object";

const WIDTH = 40;
const HEIGHT = 35;
const RADIUS = 10;
const LABEL_GAP = 20;

// DGPad's BlocklyButton: a "play" button, captioned on its left, that runs
// its program when clicked. Like an expression, it keeps its place in the
// window, `screen` being its right end, halfway up.
export class button_object extends construction_object {
    label: string;
    screen: Vec2;
    program: ExpressionProgram | null;
    private caption!: DOMElement;
    private frame!: DOMElement;

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

    // A program sets a number only, as a manipulation does.
    run(): void {
        if (!this.program) return;
        const { program, refs, targets, vec3 } = this.program;
        evaluateProgram(program, {
            resolveIdentifier: (name) => refs.get(name)!.scriptValue(vec3),
            view: () => this.C.formulaView(),
            callMethod: (name, method, args) => {
                const target = targets.get(name);
                if (!target) return;
                if (method !== "setExpression")
                    styleObject(this.C, target, method, args);
                else if (
                    target instanceof expression_object &&
                    !target.formula &&
                    !target.program &&
                    args[0] !== null
                ) {
                    target.value = args[0] as ScriptValue;
                    this.C.invalidateGeometry(target);
                }
            },
        });
    }

    render(): void {
        this.dom.stl("display", this.isVisible ? "block" : "none");
        if (!this.isVisible) return;
        const [x, y] = this.screen;
        this.caption.att("x", x - WIDTH - LABEL_GAP).att("y", y);
        this.frame.att("transform", `translate(${x - WIDTH} ${y - 20})`);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as button_object;
        t.caption = t.svg
            .shape("text")
            .att("text-anchor", "end")
            .att("dominant-baseline", "middle")
            .stl(
                `fill:${t.stroke_color};font-family:Verdana;font-size:${t.fontSize}px;pointer-events:none`,
            )
            .text(t.label);
        const [w, h] = [WIDTH / 5, HEIGHT / 5];
        t.frame = t.svg
            .shape("g")
            .stl("cursor:pointer")
            .add(
                t.svg
                    .shape("rect")
                    .att("width", WIDTH)
                    .att("height", HEIGHT)
                    .att("rx", RADIUS)
                    .stl(
                        `fill:${t.fill_color};fill-opacity:${t.opacity};stroke:${t.stroke_color};stroke-width:${t.size}`,
                    ),
                t.svg
                    .shape("path")
                    .att("d", `M${w} ${h}V${4 * h}L${4 * w} ${HEIGHT / 2}Z`)
                    .stl(`fill:${t.stroke_color}`),
            )
            .drag(
                () => {},
                undefined,
                (_, cancelled) => {
                    if (!cancelled) t.run();
                },
            );
        return t.svg.shape("g").add(t.caption, t.frame);
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
