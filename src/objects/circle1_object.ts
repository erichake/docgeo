import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import {
    evaluateFormula,
    realPart,
    usesView,
    type FormulaNode,
} from "../import/dgp_formula";
import type { construction_object } from "./construction_object";
import { expression_object } from "./expression_object";
import type { point_object } from "./point_object";
import { primitive_circle_object } from "./primitive_circle_object";
import type { primitive_line_object } from "./primitive_line_object";
import { vCross, vNormalize } from "../vec";

export type circle1_radius =
    | number
    | {
          formula: FormulaNode;
          refs: Map<string, point_object | expression_object>;
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
                          resolveIdentifier: (n) => {
                              const ref = definition.refs.get(n)!;
                              if (!ref.defined) return null;
                              if (ref instanceof expression_object)
                                  return typeof ref.value === "number"
                                      ? ref.value
                                      : null;
                              return [ref.coords[0], ref.coords[1]];
                          },
                          view: () => this.C.formulaView(),
                      }),
                  );
        if (radius === null) {
            this.defined = false;
            return;
        }
        if (!this.axis) {
            this.setCircle(this.P1.coords, radius, [1, 0, 0], [0, 1, 0]);
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
        if (typeof t.radius === "number")
            dom.drag((event) => t.mousedrag(event));
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
