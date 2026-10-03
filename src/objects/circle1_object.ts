import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import {
    evaluateFormula,
    formulaSource,
    realPart,
    usesView,
    type FormulaNode,
} from "../import/dgp_formula";
import {
    dgoFormula,
    type construction_object,
    type DgoContext,
} from "./construction_object";
import type { point_object } from "./point_object";
import { primitive_circle_object } from "./primitive_circle_object";
import type { primitive_line_object } from "./primitive_line_object";
import { vCross, vNormalize } from "../vec";

export type circle1_radius =
    | number
    | {
          formula: FormulaNode;
          refs: Map<string, construction_object>;
      };

export class circle1_object extends primitive_circle_object {
    P1: point_object;
    radius: circle1_radius;
    axis?: primitive_line_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        radius: circle1_radius,
        axis?: primitive_line_object,
    ) {
        super(c, name);
        this.P1 = p1;
        this.radius = radius;
        this.readsView = typeof radius !== "number" && usesView(radius.formula);
        this.axis = axis;
        this.addParents(
            p1,
            ...(typeof radius === "number" ? [] : radius.refs.values()),
            ...(axis ? [axis] : []),
        );
    }

    dgo(context: DgoContext): [string, unknown] {
        const radius =
            typeof this.radius === "number"
                ? this.radius
                : dgoFormula(
                      formulaSource(this.radius.formula),
                      this.radius.refs,
                      context,
                  );
        return [
            "C1",
            [
                context.index(this.P1),
                radius,
                ...(this.axis ? [context.index(this.axis)] : []),
            ],
        ];
    }

    computeGeometry(): void {
        if (!this.P1.defined || (this.axis && !this.axis.defined)) {
            this.defined = false;
            return;
        }
        const definition = this.radius;
        const radius =
            typeof definition === "number"
                ? definition
                : realPart(
                      evaluateFormula(definition.formula, {
                          resolveIdentifier: (n) =>
                              definition.refs.get(n)!.scriptValue(false),
                          view: () => this.C.formulaView(),
                      }),
                  );
        if (radius === null) {
            this.defined = false;
            return;
        }
        if (!this.axis) {
            this.setCircle(this.P1.coords, radius, ...this.plane);
            return;
        }
        const normal = vNormalize(this.axis.VEC)!;
        const u =
            vNormalize(vCross(normal, [0, 0, 1])) ??
            vNormalize(vCross(normal, [1, 0, 0]))!;
        this.setCircle(this.P1.coords, radius, u, vCross(normal, u));
    }

    mousedrag(ev: PointerEvent): void {
        const point = this.C.unprojectToZPlane(
            this.C.pointerPosition(ev),
            this.P1.z,
        );
        if (!point) return;
        this.radius = Math.hypot(point[0] - this.P1.x, point[1] - this.P1.y);
        this.C.invalidateGeometry(this);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as circle1_object;
        const dom = primitive_circle_object.createSVG(t);
        if (typeof t.radius !== "number") return dom;
        if (t.locked) t.hitArea.stl("pointer-events", "none");
        else dom.drag((event) => t.mousedrag(event));
        return dom;
    }
}

export function createCircle1(
    c: construction,
    name: string | null | undefined,
    center: point_object,
    radius: circle1_radius,
    axis?: primitive_line_object,
): circle1_object {
    return c.add(new circle1_object(c, name, center, radius, axis));
}
