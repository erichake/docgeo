import type { construction } from "../construction";
import { geometryTolerance, vNormalize, type Vec3 } from "../vec";
import type { DgoContext } from "./construction_object";
import {
    dgoEquation,
    equationCoeffs,
    equationParents,
    equationReadsView,
    type Equation,
} from "./equation_conic_object";
import { point_object } from "./point_object";
import { primitive_line_object } from "./primitive_line_object";

// The line of an equation of degree 1, from its point nearest the origin.
export class equation_line_object extends primitive_line_object {
    equation: Equation;

    constructor(
        c: construction,
        name: string | null | undefined,
        equation: Equation,
    ) {
        super(c, name, new point_object(c, null, [0, 0, 0]));
        this.equation = equation;
        this.readsView = equationReadsView(equation);
        this.addParents(...equationParents(equation));
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["EqL", dgoEquation(this.equation, context)];
    }

    computeVEC(): Vec3 | null {
        const coeffs = equationCoeffs(this.equation, this.C);
        if (!coeffs) return null;
        const [, , , d, e, f] = coeffs;
        const norm = d * d + e * e;
        if (!(norm > geometryTolerance(f) ** 2)) return null;
        this.P1.coords = [(-f * d) / norm, (-f * e) / norm, 0];
        this.P1.computeGeometry();
        // Along GeoGebra's direction.
        return vNormalize([e, -d, 0]);
    }

    project(): void {
        this.P1.project();
        super.project();
    }
}

export function createEquationLine(
    c: construction,
    name: string | null | undefined,
    equation: Equation,
): equation_line_object {
    return c.add(new equation_line_object(c, name, equation));
}
