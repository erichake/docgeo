import type { construction } from "../construction";
import { realPart, usesView } from "../import/dgp_formula";
import {
    dgoFormula,
    type construction_object,
    type DgoContext,
} from "./construction_object";
import { evaluateFunction, type ExpressionFormula } from "./expression_object";
import { primitive_quadric_object } from "./primitive_quadric_object";

// The equation "left = right" of a line, a circle or a conic, each side a
// formula in x and y.
export type Equation = [ExpressionFormula, ExpressionFormula];

const SAMPLES = [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
];

// Left - right at (x, y), NaN where it is undefined.
export function equationValue(
    equation: Equation,
    c: construction,
    point: number[],
): number {
    const [left, right] = equation.map((side) =>
        realPart(evaluateFunction(side, point, () => c.formulaView())),
    );
    return left === null || right === null ? NaN : left - right;
}

// Its a, b, c, d, e, f, a·x² + b·xy + c·y² + d·x + e·y + f being left -
// right, from its values at SAMPLES: exact for a degree 2 at most.
export function equationCoeffs(
    equation: Equation,
    c: construction,
): number[] | null {
    const values = SAMPLES.map((point) => equationValue(equation, c, point));
    if (!values.every(Number.isFinite)) return null;
    const [g, p, m, q, n, r] = values;
    return [
        (p + m) / 2 - g,
        r - p - q + g,
        (q + n) / 2 - g,
        (p - m) / 2,
        (q - n) / 2,
        g,
    ];
}

export const equationParents = (equation: Equation): construction_object[] =>
    equation.flatMap((side) => [...side.refs.values()]);

export const equationReadsView = (equation: Equation): boolean =>
    equation.some((side) => usesView(side.node));

export const dgoEquation = (equation: Equation, context: DgoContext) =>
    equation.map((side) => dgoFormula(side.source, side.refs, context));

// An ellipse, a hyperbola or a parabola as its coefficients change.
export class equation_conic_object extends primitive_quadric_object {
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
        return ["EqQ", dgoEquation(this.equation, context)];
    }

    computeGeometry(): void {
        this.setPlane(0);
        const coeffs = equationCoeffs(this.equation, this.C);
        if (coeffs) this.setConic(coeffs);
        else {
            this.defined = false;
            this.COEFFS = null;
        }
    }
}

export function createEquationConic(
    c: construction,
    name: string | null | undefined,
    equation: Equation,
): equation_conic_object {
    return c.add(new equation_conic_object(c, name, equation));
}
