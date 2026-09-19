import type { construction } from "../construction";
import { evaluateFormula, type FormulaNode } from "../import/dgp_formula";
import type { point_object } from "./point_object";
import { primitive_circle_object } from "./primitive_circle_object";

export type circle1_radius =
    number | { formula: FormulaNode; refs: Map<string, point_object> };

export class circle1_object extends primitive_circle_object {
    P1: point_object;
    radius: circle1_radius;

    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        radius: circle1_radius,
    ) {
        super(c, name);
        this.P1 = p1;
        this.radius = radius;
        this.addParents(
            p1,
            ...(typeof radius === "number" ? [] : radius.refs.values()),
        );
    }

    computeGeometry(): void {
        if (!this.P1.defined) {
            this.defined = false;
            return;
        }
        const definition = this.radius;
        const radius =
            typeof definition === "number"
                ? definition
                : evaluateFormula(definition.formula, {
                      resolveIdentifier: (n) => {
                          const p = definition.refs.get(n)!;
                          return p.defined ? [p.coords[0], p.coords[1]] : null;
                      },
                      pixelScale: () => this.C.GRID.UNIT[0],
                  });
        if (typeof radius !== "number") {
            this.defined = false;
            return;
        }
        this.setCircle(this.P1.coords, radius, [1, 0, 0], [0, 1, 0]);
    }
}

export function createCircle1(
    c: construction,
    name: string | null | undefined,
    center: point_object,
    radius: circle1_radius,
): circle1_object {
    return c.add(new circle1_object(c, name, center, radius));
}
