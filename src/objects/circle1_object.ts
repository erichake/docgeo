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
import { polygon_object } from "./polygon_object";
import type { point_object } from "./point_object";
import { primitive_circle_object } from "./primitive_circle_object";
import type { primitive_line_object } from "./primitive_line_object";
import { vCross, vNormalize, type Vec3 } from "../vec";

export type circle1_radius =
    | number
    | {
          formula: FormulaNode;
          refs: Map<string, construction_object>;
      };

export function radiusValue(
    radius: circle1_radius,
    c: construction,
): number | null {
    return typeof radius === "number"
        ? radius
        : realPart(
              evaluateFormula(radius.formula, {
                  resolveIdentifier: (n) =>
                      radius.refs.get(n)!.scriptValue(c.space),
                  view: () => c.formulaView(),
              }),
          );
}

// A first direction of the plane orthogonal to a unit normal.
export const axisBasis = (normal: Vec3): Vec3 =>
    vNormalize(vCross(normal, [0, 0, 1])) ??
    vNormalize(vCross(normal, [1, 0, 0]))!;

// Its value, as a .dgo parameter.
export function dgoRadius(
    radius: circle1_radius,
    context: DgoContext,
): unknown {
    return typeof radius === "number"
        ? radius
        : dgoFormula(formulaSource(radius.formula), radius.refs, context);
}

export class circle1_object extends primitive_circle_object {
    P1: point_object;
    radius: circle1_radius;
    // A line, or a plane by its normal.
    axis?: primitive_line_object | polygon_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        radius: circle1_radius,
        axis?: primitive_line_object | polygon_object,
    ) {
        super(c, name);
        this.P1 = p1;
        this.radius = radius;
        this.readsView =
            (c.GRID.FRAME2D !== null && !axis) ||
            (typeof radius !== "number" && usesView(radius.formula));
        this.axis = axis;
        this.addParents(
            p1,
            ...(typeof radius === "number" ? [] : radius.refs.values()),
            ...(axis ? [axis] : []),
        );
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "C1",
            [
                context.index(this.P1),
                dgoRadius(this.radius, context),
                ...(this.axis ? [context.index(this.axis)] : []),
            ],
        ];
    }

    computeGeometry(): void {
        if (!this.P1.defined || (this.axis && !this.axis.defined)) {
            this.defined = false;
            return;
        }
        const radius = radiusValue(this.radius, this.C);
        if (radius === null) {
            this.defined = false;
            return;
        }
        if (!this.axis) {
            // As in DGPad, a circle of the screen even around a 3D center.
            this.setCircle(
                this.P1.coords,
                radius,
                ...(this.C.GRID.FRAME2D ? this.C.screenPlaneBasis : this.plane),
            );
            return;
        }
        const { axis } = this;
        const normal = vNormalize(
            axis instanceof polygon_object ? axis.NORMAL : axis.VEC,
        );
        if (!normal) {
            this.defined = false;
            return;
        }
        const u = axisBasis(normal);
        this.setCircle(this.P1.coords, radius, u, vCross(normal, u));
    }

    mousedrag(ev: PointerEvent): void {
        if (this.C.GRID.FRAME2D) {
            const [x, y] = this.C.pt3D(this.P1.coords);
            const [px, py] = this.C.pointerPosition(ev);
            this.radius = Math.hypot(px - x, py - y) / this.C.GRID.UNIT[0];
            this.C.invalidateGeometry(this);
            return;
        }
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
        // A macro's final: its radius is a constant of the body.
        if (typeof t.radius !== "number" || t.output) return dom;
        // On its stroke, before the group's drag of its center.
        t.hitArea.drag((event) => t.mousedrag(event));
        return dom;
    }
}

export function createCircle1(
    c: construction,
    name: string | null | undefined,
    center: point_object,
    radius: circle1_radius,
    axis?: primitive_line_object | polygon_object,
): circle1_object {
    return c.add(new circle1_object(c, name, center, radius, axis));
}
