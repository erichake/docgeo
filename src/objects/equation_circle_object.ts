import type { construction } from "../construction";
import { geometryTolerance, vAdd, vScale } from "../vec";
import type { DgoContext } from "./construction_object";
import {
    dgoEquation,
    equationCoeffs,
    equationParents,
    equationReadsView,
    type Equation,
} from "./equation_conic_object";
import { primitive_circle_object } from "./primitive_circle_object";

// The circle of an equation whose x² and y² have one coefficient, without
// xy.
export class equation_circle_object extends primitive_circle_object {
    equation: Equation;

    constructor(
        c: construction,
        name: string | null | undefined,
        equation: Equation,
    ) {
        super(c, name);
        this.equation = equation;
        this.readsView = equationReadsView(equation);
        this.addParents(...equationParents(equation));
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["EqC", dgoEquation(this.equation, context)];
    }

    computeGeometry(): void {
        const coeffs = equationCoeffs(this.equation, this.C);
        const k = coeffs && (coeffs[0] + coeffs[2]) / 2;
        if (!coeffs || !(Math.abs(k!) > geometryTolerance(...coeffs))) {
            this.defined = false;
            return;
        }
        const [, , , d, e, f] = coeffs;
        const [x, y] = [-d / (2 * k!), -e / (2 * k!)];
        const [u, v] = this.plane;
        this.setCircle(
            vAdd(vScale(u, x), vScale(v, y)),
            Math.sqrt(x * x + y * y - f / k!),
            u,
            v,
        );
    }
}

export function createEquationCircle(
    c: construction,
    name: string | null | undefined,
    equation: Equation,
): equation_circle_object {
    return c.add(new equation_circle_object(c, name, equation));
}
