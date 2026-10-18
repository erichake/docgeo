import {
    evaluateFormula,
    formulaIdentifiers,
    NO_VIEW,
    parseFormula,
    parseProgram,
    usesView,
    type FormulaNode,
    type Program,
} from "./dgp_formula";

// What a DGPad Expression holds, shared by the import and the editor (see
// EDITOR.md).

export const STYLE_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

// DGPad's legacy 3D figures store a fixed point's coordinates as a vector
// literal inside a string (e.g. Point("X","[1,0,0]","1")) rather than as a
// real DGP array value; the components may themselves be constant
// arithmetic (e.g. "[1,1,1/3]"). Only a literal "[...]" that doesn't
// reference any other object nor the window counts as a fixed point:
// anything else (a bare formula, or a "[...]" that reads another object,
// e.g. "[1-2*cos(E2),1+2*sin(E2),1]") is a dependent point formula instead
// (see Point's execute), not a one-time constant.
export function parseVectorLiteral(value: string): number[] | null {
    let node: FormulaNode;
    try {
        node = parseFormula(value);
    } catch {
        return null;
    }
    if (node.kind !== "vector" || usesView(node)) return null;
    const result = evaluateFormula(node, {
        resolveIdentifier: () => null,
        view: () => NO_VIEW,
    });
    return result === null || typeof result === "number" ? null : [...result];
}

// DGPad's "i" complex-number syntax (e.g. "3i+5", displayed like a
// 2-vector).
const COMPLEX_TERM = /[+-]?(?:\d+(?:\.\d+)?)?i|[+-]?\d+(?:\.\d+)?/g;

function parseComplexLiteral(value: string): [number, number] | null {
    let real = 0;
    let imaginary = 0;
    let hasImaginary = false;
    let consumed = 0;
    for (const match of value.matchAll(COMPLEX_TERM)) {
        if (match.index !== consumed) return null;
        consumed += match[0].length;
        if (match[0].endsWith("i")) {
            hasImaginary = true;
            const coefficient = match[0].slice(0, -1);
            imaginary +=
                coefficient === "" || coefficient === "+"
                    ? 1
                    : coefficient === "-"
                      ? -1
                      : Number(coefficient);
        } else {
            real += Number(match[0]);
        }
    }
    if (!hasImaginary || consumed !== value.length) return null;
    return [real, imaginary];
}

function parseExpressionValue(value: string): number | number[] | null {
    if (STYLE_NUMBER.test(value)) return Number(value);
    // A checkbox's value.
    if (value === "true" || value === "false") return Number(value === "true");
    // Animated, a clock: its dependents recomputed at each frame.
    if (value === "NaN") return NaN;
    return parseVectorLiteral(value) ?? parseComplexLiteral(value);
}

export const FUNCTION_VARIABLES = ["x", "y", "z", "t"];

// A formula of DGPad's function variables (e.g. "0.5x^2-4", or "z^2+c"),
// which the Expression displays and Curvus plots or other Expressions call,
// rather than a value. As in DGPad, an object's name is never a variable.
function functionFormula(
    program: Program,
    objects: { has(name: string): boolean },
): { node: FormulaNode; variables: string[] } | null {
    const [statement] = program.body;
    if (program.body.length !== 1 || statement.kind !== "expression")
        return null;
    const names = formulaIdentifiers(statement.node);
    const variables = FUNCTION_VARIABLES.filter(
        (name) => names.has(name) && !objects.has(name),
    );
    return variables.length ? { node: statement.node, variables } : null;
}

// Its nature, the key of the .dgo's Ex: a constant ("v"), a function of x,
// y, z, t ("f"), or a formula or script that reads the figure ("s"). Throws
// on what the grammar doesn't read.
export type ExpressionContent =
    | { kind: "v"; value: number | number[] }
    | { kind: "f"; program: Program; node: FormulaNode; variables: string[] }
    | { kind: "s"; program: Program };

export function expressionContent(
    source: string,
    objects: { has(name: string): boolean },
): ExpressionContent {
    const value = parseExpressionValue(source);
    if (value !== null) return { kind: "v", value };
    const program = parseProgram(source);
    const fn = functionFormula(program, objects);
    return fn ? { kind: "f", program, ...fn } : { kind: "s", program };
}
