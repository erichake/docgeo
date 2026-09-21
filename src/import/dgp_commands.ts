import type { construction } from "../construction";
import { createAngleBisector } from "../objects/angle_bisector_object";
import { createAngle, angle_object } from "../objects/angle_object";
import { createArc3pts } from "../objects/arc3pts_object";
import { createCenter } from "../objects/center_object";
import { createCircle1 } from "../objects/circle1_object";
import { createCircle3 } from "../objects/circle3_object";
import { createCircle3pts } from "../objects/circle3pts_object";
import { createCircle } from "../objects/circle_object";
import { construction_object } from "../objects/construction_object";
import { createCurve } from "../objects/curve_object";
import {
    createExpression,
    expression_object,
    type ExpressionFormula,
    type PointExpressionFormula,
} from "../objects/expression_object";
import {
    createFixedAngle,
    fixed_angle_object,
} from "../objects/fixed_angle_object";
import { createFixedPoint } from "../objects/fixed_point_object";
import { createFormulaPoint } from "../objects/formula_point_object";
import { createOrderedIntersection } from "../objects/intersection_object";
import {
    createList,
    type ListNature,
    type ListRef,
} from "../objects/list_object";
import { createLocus } from "../objects/locus_object";
import { createMidpoint } from "../objects/midpoint_object";
import { createParallel } from "../objects/parallel_line_object";
import { createPerpendicularBisector } from "../objects/perpendicular_bisector_object";
import { createPlumb } from "../objects/plumb_line_object";
import {
    createPointOn,
    point_on_object,
    type point_support_object,
} from "../objects/point_on_object";
import {
    createPoint,
    point_object,
    type magnet_target,
} from "../objects/point_object";
import { createPolygon } from "../objects/polygon_object";
import { primitive_circle_object } from "../objects/primitive_circle_object";
import { primitive_line_object } from "../objects/primitive_line_object";
import type { primitive_quadric_object } from "../objects/primitive_quadric_object";
import { createQuadric5pts } from "../objects/quadric5pts_object";
import { createRay } from "../objects/ray_line_object";
import { createReflection } from "../objects/reflection_object";
import { createSegment } from "../objects/segment_object";
import { createSymmetry } from "../objects/symmetry_object";
import { createLine } from "../objects/two_points_line_object";
import type { Vec2, Vec3 } from "../vec";
import {
    formulaIdentifiers,
    parseFormula,
    type FormulaNode,
} from "./dgp_formula";
import type { DgpCall, DgpValue } from "./dgp_parser";

type ObjectKind =
    | "point"
    | "pointOn"
    | "line"
    | "circle"
    | "polygon"
    | "quadric"
    | "locus"
    | "angle"
    | "expression"
    | "list"
    | "curve";
type ParameterKind =
    | "string"
    | "number"
    | "boolean"
    | "object"
    | "point"
    | "pointOn"
    | "line"
    | "circle"
    | "intersectable"
    | "pointSupport"
    | "coordinate"
    // PointOn's parameter: a plain number for a line/circle support, or a
    // [number, number] pair for a polygon/quadric support.
    | "numberOrPair"
    // A plain number literal, or a string holding a DGP formula.
    | "formula";

interface Parameter {
    kind: ParameterKind;
    optional?: boolean;
}

type RuntimeValue =
    string | number | boolean | null | construction_object | RuntimeValue[];

interface CommandContext {
    construction: construction;
    variables: Map<string, construction_object>;
    gridChanged: boolean;
    projectionChanged: boolean;
    // DGPad's legacy "fake 3D" figures designate the coordinate system's
    // origin implicitly: it's whichever free point was created first while
    // the figure was in 3D mode (see SetCoords' is3D flag below). That
    // point's own stored (x,y) are meaningless screen-drag leftovers from
    // the old editor, so it must be pinned to [0,0,0] instead.
    is3D: boolean;
    origin3DAssigned: boolean;
}

interface CommandDefinition {
    parameters: Parameter[];
    result?: ObjectKind;
    validate?: (
        args: DgpValue[],
        line: number,
        variables: Map<string, ObjectKind>,
    ) => void;
    execute: (
        context: CommandContext,
        args: RuntimeValue[],
    ) => construction_object | void;
}

const string: Parameter = { kind: "string" };
const number: Parameter = { kind: "number" };
const boolean: Parameter = { kind: "boolean" };
const object: Parameter = { kind: "object" };
const point: Parameter = { kind: "point" };
const pointOn: Parameter = { kind: "pointOn" };
const line: Parameter = { kind: "line" };
const circle: Parameter = { kind: "circle" };
const intersectable: Parameter = { kind: "intersectable" };
const pointSupport: Parameter = { kind: "pointSupport" };
const coordinate: Parameter = { kind: "coordinate" };
const numberOrPair: Parameter = { kind: "numberOrPair" };
const formula: Parameter = { kind: "formula" };
// DGPad's own color parser matches this hex prefix without anchoring the
// end, so a color value with a stray suffix (e.g. a missing ";" merging it
// with the next "key:value" pair, as seen in some exported .dgp files) is
// tolerated: only the leading hex digits are read, the rest is dropped.
const COLOR = /^#(?:[\da-f]{6}|[\da-f]{3})/i;
const STYLE_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
// A point's "mg" style: the objects it magnetizes to while dragged, each
// with its own snap radius (in screen pixels), e.g.
// "[S2,5000],[C1,20]".
const MAGNET_LIST =
    /^\[[A-Za-z_$][\w$]*,\d+(?:\.\d+)?\](?:,\[[A-Za-z_$][\w$]*,\d+(?:\.\d+)?\])*$/;

function parseMagnetList(value: string): { name: string; radius: number }[] {
    return value.split("],[").map((chunk) => {
        const [name, radius] = chunk.replace(/^\[|\]$/g, "").split(",");
        return { name, radius: Number(radius) };
    });
}

function properties(value: string): Map<string, string> {
    return new Map(
        value.split(";").map((item) => {
            const separator = item.indexOf(":");
            return [item.slice(0, separator), item.slice(separator + 1)];
        }),
    );
}

function literalString(value: DgpValue): string {
    return (value as { type: "literal"; value: string }).value;
}

// DGPad's legacy 3D figures store a fixed point's coordinates as a vector
// literal inside a string (e.g. Point("X","[1,0,0]","1")) rather than as a
// real DGP array value. Only constant numeric vectors are supported: this
// project is a figure reader, not an expression evaluator.
function parseVectorLiteral(value: string): number[] | null {
    const match = /^\[(.*)\]$/.exec(value);
    if (!match) return null;
    const parts = match[1].split(",").map((part) => part.trim());
    if (parts.some((part) => !STYLE_NUMBER.test(part))) return null;
    return parts.map(Number);
}

// DGPad's Expression() command can hold an arbitrary math expression,
// evaluated against a sandboxed JS interpreter (functions, other objects'
// values, etc.). This project only supports the constant literals actually
// needed to display an already-computed figure: real numbers, DGPad's "i"
// complex-number syntax (e.g. "3i+5", displayed like a 2-vector), and
// vector literals. Anything else is rejected at validate time.
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
    return parseVectorLiteral(value) ?? parseComplexLiteral(value);
}

// A single-variable "function of x" formula (DGPad's Expression used as a
// callable, e.g. Curvus's "E1(x)" or Expression's own "0.5x^2-4"): "x" is
// the free sweep variable (excluded from reference checking), any other
// identifier must be another function-of-x Expression called by name.
function validateFunctionFormulaReferences(
    formulaNode: FormulaNode,
    variables: Map<string, ObjectKind>,
    lineNumber: number,
): void {
    formulaIdentifiers(formulaNode).forEach((name) => {
        if (name === "x") return;
        if (variables.get(name) !== "expression")
            throw new Error(`Unknown DGP reference at line ${lineNumber}`);
    });
}

function functionFormulaRefs(
    formulaNode: FormulaNode,
    variables: Map<string, construction_object>,
): Map<string, expression_object> {
    const refs = new Map<string, expression_object>();
    formulaIdentifiers(formulaNode).forEach((name) => {
        if (name === "x") return;
        refs.set(name, variables.get(name) as expression_object);
    });
    return refs;
}

// An Expression's formula referencing other objects directly (DGPad's
// "d(P1,M)") rather than sweeping "x" (see validateFunctionFormulaReferences):
// recognized when every non-"x" identifier it uses names a point.
function isPointExpressionFormula(
    formulaNode: FormulaNode,
    variables: Map<string, ObjectKind>,
): boolean {
    const names = [...formulaIdentifiers(formulaNode)].filter(
        (name) => name !== "x",
    );
    return (
        names.length > 0 &&
        names.every((name) => variables.get(name) === "point")
    );
}

function isPointExpressionFormulaAt(
    formulaNode: FormulaNode,
    variables: Map<string, construction_object>,
): boolean {
    const names = [...formulaIdentifiers(formulaNode)].filter(
        (name) => name !== "x",
    );
    return (
        names.length > 0 &&
        names.every((name) => variables.get(name)?.type === "point")
    );
}

function pointFormulaRefs(
    formulaNode: FormulaNode,
    variables: Map<string, construction_object>,
): Map<string, point_object> {
    const refs = new Map<string, point_object>();
    formulaIdentifiers(formulaNode).forEach((name) => {
        if (name === "x") return;
        refs.set(name, variables.get(name) as point_object);
    });
    return refs;
}

function parsePointFormula(value: string, lineNumber: number): FormulaNode {
    try {
        return parseFormula(value);
    } catch {
        throw new Error(
            `Unsupported DGP point expression at line ${lineNumber}`,
        );
    }
}

function parseRadiusFormula(value: string, lineNumber: number): FormulaNode {
    try {
        return parseFormula(value);
    } catch {
        throw new Error(`Invalid DGP circle radius at line ${lineNumber}`);
    }
}

function validateFormulaReferences(
    formulaNode: FormulaNode,
    variables: Map<string, ObjectKind>,
    lineNumber: number,
): void {
    formulaIdentifiers(formulaNode).forEach((name) => {
        if (variables.get(name) !== "point")
            throw new Error(`Unknown DGP reference at line ${lineNumber}`);
    });
}

function parseListFormula(value: string, lineNumber: number): FormulaNode {
    try {
        return parseFormula(value);
    } catch {
        throw new Error(`Invalid DGP list formula at line ${lineNumber}`);
    }
}

// Unlike validateFormulaReferences (points only), a List formula may also
// read a cursor's numeric value, and its "k"/"count" loop-scope names are
// synthetic (bound per index by list_object itself), never real references.
function validateListFormulaReferences(
    formulaNode: FormulaNode,
    variables: Map<string, ObjectKind>,
    lineNumber: number,
): void {
    formulaIdentifiers(formulaNode).forEach((name) => {
        if (name === "k" || name === "count") return;
        const kind = variables.get(name);
        if (kind !== "point" && kind !== "expression")
            throw new Error(`Unknown DGP reference at line ${lineNumber}`);
    });
}

function listFormulaRefs(
    formulas: FormulaNode[],
    variables: Map<string, construction_object>,
): Map<string, ListRef> {
    const refs = new Map<string, ListRef>();
    formulas.forEach((formulaNode) =>
        formulaIdentifiers(formulaNode).forEach((name) => {
            if (name === "k" || name === "count") return;
            refs.set(name, variables.get(name) as ListRef);
        }),
    );
    return refs;
}

// DGPad's Polygon command stores its vertices as a single comma-separated
// string of point references, each prefixed with "_" (e.g. "_P1,_P2,_P3"),
// rather than as individual DGP arguments.
function polygonPointName(token: string, lineNumber: number): string {
    if (!token.startsWith("_"))
        throw new Error(`Invalid DGP polygon reference at line ${lineNumber}`);
    return token.slice(1);
}

function validateColor(value: string, lineNumber: number): void {
    if (!COLOR.test(value))
        throw new Error(`Invalid DGP color at line ${lineNumber}`);
}

function extractColor(value: string): string {
    return COLOR.exec(value)![0];
}

function validateNumber(
    value: string,
    lineNumber: number,
    minimum: number,
    maximum = Infinity,
): void {
    const numberValue = Number(value);
    if (
        !STYLE_NUMBER.test(value) ||
        !Number.isFinite(numberValue) ||
        numberValue < minimum ||
        numberValue > maximum
    )
        throw new Error(`Invalid DGP style number at line ${lineNumber}`);
}

function validateObjectStyle(
    value: string,
    lineNumber: number,
    variables: Map<string, ObjectKind>,
): void {
    properties(value).forEach((propertyValue, property) => {
        switch (property) {
            case "c":
                validateColor(propertyValue, lineNumber);
                break;
            case "h":
                validateNumber(propertyValue, lineNumber, 0, 2);
                if (!Number.isInteger(Number(propertyValue)))
                    throw new Error(
                        `Invalid DGP style number at line ${lineNumber}`,
                    );
                break;
            case "o":
                validateNumber(propertyValue, lineNumber, 0, 1);
                break;
            case "s":
                validateNumber(propertyValue, lineNumber, 0);
                break;
            case "sn":
            case "sb":
            case "tk":
                if (propertyValue !== "true" && propertyValue !== "false")
                    throw new Error(
                        `Invalid DGP style boolean at line ${lineNumber}`,
                    );
                break;
            case "f":
                validateNumber(propertyValue, lineNumber, 0);
                break;
            case "np":
                validateNumber(propertyValue, lineNumber, 0, 2 * Math.PI);
                break;
            case "p":
                validateNumber(propertyValue, lineNumber, -1);
                if (!Number.isInteger(Number(propertyValue)))
                    throw new Error(
                        `Invalid DGP style number at line ${lineNumber}`,
                    );
                break;
            case "arc":
                validateNumber(propertyValue, lineNumber, 0);
                break;
            case "i":
                validateNumber(propertyValue, lineNumber, 0);
                break;
            case "cL":
                validateNumber(propertyValue, lineNumber, 0);
                break;
            case "cPT": {
                let decoded: string;
                try {
                    decoded = atob(propertyValue);
                } catch {
                    throw new Error(`Invalid DGP style at line ${lineNumber}`);
                }
                validateCursorStyle(decoded, lineNumber);
                break;
            }
            case "mg":
                if (!MAGNET_LIST.test(propertyValue))
                    throw new Error(`Invalid DGP style at line ${lineNumber}`);
                parseMagnetList(propertyValue).forEach(({ name }) => {
                    const kind = variables.get(name);
                    if (
                        kind !== "line" &&
                        kind !== "circle" &&
                        kind !== "list" &&
                        kind !== "curve" &&
                        kind !== "point" &&
                        kind !== "pointOn"
                    )
                        throw new Error(
                            `Unknown DGP reference at line ${lineNumber}`,
                        );
                });
                break;
        }
    });
}

// The Expression command's slider knob (cPT) stores its own small style
// string, base64-encoded inside the expression's "cPT" style property.
// Only color, size and opacity are meaningful for it: it's a plain dot, not
// a full construction_object, so the other object-style keys don't apply.
function validateCursorStyle(value: string, lineNumber: number): void {
    properties(value).forEach((propertyValue, property) => {
        switch (property) {
            case "c":
                validateColor(propertyValue, lineNumber);
                break;
            case "s":
                validateNumber(propertyValue, lineNumber, 0);
                break;
            case "o":
                validateNumber(propertyValue, lineNumber, 0, 1);
                break;
        }
    });
}

function validateCoordsStyle(value: string, lineNumber: number): void {
    const style = properties(value);
    const color = style.get("color");
    if (color !== undefined) validateColor(color, lineNumber);
    const axisWidth = style.get("axisWidth");
    if (axisWidth !== undefined) validateNumber(axisWidth, lineNumber, 0);
}

function validateGeneralStyle(value: string, lineNumber: number): void {
    const background = properties(value).get("background-color");
    if (background !== undefined) validateColor(background, lineNumber);
}

function applyObjectStyle(
    target: construction_object,
    value: string,
    variables: Map<string, construction_object>,
): void {
    properties(value).forEach((propertyValue, property) => {
        switch (property) {
            case "c": {
                const color = extractColor(propertyValue);
                target.fill_color = color;
                target.stroke_color = color;
                break;
            }
            case "h":
                target.hidden = Number(propertyValue);
                break;
            case "o":
                target.opacity = Number(propertyValue);
                break;
            case "s":
                target.size = Number(propertyValue);
                break;
            case "sn":
                target.showName = propertyValue === "true";
                break;
            case "sb":
                if (target instanceof point_on_object)
                    target.onBoundary = propertyValue === "true";
                break;
            case "tk":
                if (target instanceof point_object)
                    target.trace = propertyValue === "true";
                break;
            case "f":
                target.fontSize = Number(propertyValue);
                break;
            case "np":
                if (target instanceof point_object)
                    target.namePosition = Number(propertyValue);
                break;
            case "p":
                target.precision = Number(propertyValue);
                break;
            case "arc":
                if (
                    target instanceof angle_object ||
                    target instanceof fixed_angle_object
                )
                    target.arcRadius = Number(propertyValue);
                break;
            case "i":
                if (target instanceof expression_object)
                    target.increment = Number(propertyValue);
                break;
            case "cL":
                if (target instanceof expression_object)
                    target.cursorLength = Number(propertyValue);
                break;
            case "cPT":
                if (target instanceof expression_object)
                    applyCursorStyle(target, atob(propertyValue));
                break;
            case "mg":
                if (target instanceof point_object)
                    target.magnets = parseMagnetList(propertyValue).map(
                        ({ name, radius }) => ({
                            target: variables.get(name) as magnet_target,
                            radius,
                        }),
                    );
                break;
        }
    });
    target.updateView();
}

function applyCursorStyle(target: expression_object, value: string): void {
    const style = properties(value);
    const color = style.get("c");
    if (color !== undefined) target.cursorColor = extractColor(color);
    const size = style.get("s");
    if (size !== undefined) target.cursorRadius = Number(size);
    const opacity = style.get("o");
    if (opacity !== undefined) target.cursorOpacity = Number(opacity);
}

function applyCoordsStyle(context: CommandContext, value: string): void {
    const style = properties(value);
    const isAxis = style.get("isAxis");
    if (isAxis !== undefined) {
        const visible = isAxis === "true";
        context.construction.GRID.hidden = visible ? 0 : 1;
        context.construction.GRID.SHOWFLOOR = visible;
    }
    const color = style.get("color");
    if (color !== undefined) context.construction.GRID.stroke_color = color;
    const axisWidth = style.get("axisWidth");
    if (axisWidth !== undefined)
        context.construction.GRID.size = Number(axisWidth);
    context.gridChanged = true;
}

function normalizeAngle(angle: number, [low, high]: Vec2): number {
    const turn = 2 * Math.PI;
    const wrapped = low + ((((angle - low) % turn) + turn) % turn);
    return Math.min(wrapped, high);
}

function applyGeneralStyle(c: construction, value: string): void {
    const background = properties(value).get("background-color");
    if (background === undefined) return;
    c.prefs.background.color = background;
    c.svg.stl("background", background);
}

const COMMANDS = new Map<string, CommandDefinition>([
    [
        "SetCoords",
        {
            parameters: [number, number, number, boolean, number, number],
            validate: (args, lineNumber) => {
                const unit = (args[2] as { value: number }).value;
                if (unit <= 0)
                    throw new Error(`Invalid DGP unit at line ${lineNumber}`);
            },
            execute: (context, args) => {
                const unit = args[2] as number;
                const grid = context.construction.GRID;
                context.is3D = args[3] as boolean;
                if (context.is3D) {
                    // In the legacy 3D format, SetCoords' first two numbers
                    // stop meaning a screen origin and instead carry the raw
                    // camera rotation state (angle = raw * grid.STEP), the
                    // same unit the interactive rotation drag already uses.
                    // The raw angle can land outside GRID.RESTRICT_PHI/THETA
                    // (those bounds aren't a full turn wide), which renders
                    // fine since cos/sin are periodic, but the first
                    // rotation drag would then clamp it back onto the
                    // boundary as a visible jump. Normalize to the
                    // equivalent angle inside the restricted window first.
                    grid.PHI = normalizeAngle(
                        (args[0] as number) * grid.STEP,
                        grid.RESTRICT_PHI,
                    );
                    grid.THETA = normalizeAngle(
                        (args[1] as number) * grid.STEP,
                        grid.RESTRICT_THETA,
                    );
                } else {
                    grid.ORG = [args[0] as number, args[1] as number];
                }
                grid.UNIT = [unit, unit, unit];
                context.projectionChanged = true;
            },
        },
    ],
    [
        "Point",
        {
            parameters: [string, coordinate, coordinate],
            result: "point",
            validate: (args, lineNumber, variables) => {
                const second = args[1];
                const third = args[2];
                if (second.type !== "literal" || third.type !== "literal")
                    return;
                if (typeof second.value !== "string") return;
                if (typeof third.value !== "string")
                    throw new Error(
                        `Invalid DGP point coordinates at line ${lineNumber}`,
                    );
                const vector = parseVectorLiteral(second.value);
                if (!vector) {
                    if (third.value !== "0")
                        throw new Error(
                            `Invalid DGP point flag at line ${lineNumber}`,
                        );
                    const pointFormula = parsePointFormula(
                        second.value,
                        lineNumber,
                    );
                    validateFormulaReferences(
                        pointFormula,
                        variables,
                        lineNumber,
                    );
                    return;
                }
                if (vector.length !== 2 && vector.length !== 3)
                    throw new Error(
                        `Unsupported DGP point expression at line ${lineNumber}`,
                    );
                if (
                    (third.value === "1") !== (vector.length === 3) ||
                    (third.value !== "0" && third.value !== "1")
                )
                    throw new Error(
                        `Invalid DGP point flag at line ${lineNumber}`,
                    );
            },
            execute: (context, args) => {
                const name = args[0] as string;
                const second = args[1];
                if (typeof second === "string") {
                    const vector = parseVectorLiteral(second);
                    if (vector) {
                        const coords: Vec3 =
                            vector.length === 3
                                ? [vector[0], vector[1], vector[2]]
                                : [vector[0], vector[1], 0];
                        return createFixedPoint(
                            context.construction,
                            name,
                            coords,
                        );
                    }
                    const formula = parseFormula(second);
                    const refs = new Map(
                        [...formulaIdentifiers(formula)].map((refName) => [
                            refName,
                            context.variables.get(refName) as point_object,
                        ]),
                    );
                    return createFormulaPoint(
                        context.construction,
                        name,
                        formula,
                        refs,
                    );
                }
                if (context.is3D && !context.origin3DAssigned) {
                    context.origin3DAssigned = true;
                    return createFixedPoint(
                        context.construction,
                        name,
                        [0, 0, 0],
                    );
                }
                return createPoint(context.construction, name, [
                    second as number,
                    args[2] as number,
                    0,
                ]);
            },
        },
    ],
    [
        "PointOn",
        {
            parameters: [string, pointSupport, numberOrPair],
            result: "pointOn",
            validate: (args, lineNumber, variables) => {
                const support = args[1] as {
                    type: "reference";
                    name: string;
                };
                const pair = args[2].type === "array";
                const kind = variables.get(support.name);
                if ((kind === "polygon" || kind === "quadric") !== pair)
                    throw new Error(
                        `Invalid PointOn parameter at line ${lineNumber}`,
                    );
            },
            execute: (context, args) =>
                createPointOn(
                    context.construction,
                    args[0] as string,
                    args[1] as point_support_object,
                    args[2] as number | readonly [number, number],
                ),
        },
    ],
    [
        "Locus",
        {
            parameters: [string, point, pointOn],
            result: "locus",
            execute: (context, args) =>
                createLocus(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_on_object,
                ),
        },
    ],
    [
        "Line",
        {
            parameters: [string, point, point],
            result: "line",
            execute: (context, args) =>
                createLine(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                ),
        },
    ],
    [
        "Ray",
        {
            parameters: [string, point, point],
            result: "line",
            execute: (context, args) =>
                createRay(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                ),
        },
    ],
    [
        "Segment",
        {
            parameters: [string, point, point],
            result: "line",
            execute: (context, args) =>
                createSegment(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                ),
        },
    ],
    [
        "Parallel",
        {
            parameters: [string, line, point],
            result: "line",
            execute: (context, args) =>
                createParallel(
                    context.construction,
                    args[0] as string,
                    args[2] as point_object,
                    args[1] as primitive_line_object,
                ),
        },
    ],
    [
        "Perpendicular",
        {
            parameters: [string, line, point],
            result: "line",
            execute: (context, args) =>
                createPlumb(
                    context.construction,
                    args[0] as string,
                    args[2] as point_object,
                    args[1] as primitive_line_object,
                ),
        },
    ],
    [
        "AngleBisector",
        {
            parameters: [string, point, point, point],
            result: "line",
            execute: (context, args) =>
                createAngleBisector(
                    context.construction,
                    args[0] as string,
                    args[2] as point_object,
                    args[1] as point_object,
                    args[3] as point_object,
                ),
        },
    ],
    [
        "Angle",
        {
            parameters: [string, point, point, point],
            result: "angle",
            execute: (context, args) =>
                createAngle(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                    args[3] as point_object,
                ),
        },
    ],
    [
        "FixedAngle",
        {
            parameters: [string, point, point, string, boolean],
            result: "line",
            validate: (args, lineNumber) => {
                const expression = args[3];
                if (
                    expression.type === "literal" &&
                    typeof expression.value === "string" &&
                    !STYLE_NUMBER.test(expression.value)
                )
                    throw new Error(
                        `Unsupported DGP expression at line ${lineNumber}`,
                    );
            },
            execute: (context, args) =>
                createFixedAngle(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                    Number(args[3] as string),
                    args[4] as boolean,
                ),
        },
    ],
    [
        "PerpendicularBisector",
        {
            parameters: [string, point, point],
            result: "line",
            execute: (context, args) =>
                createPerpendicularBisector(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                ),
        },
    ],
    [
        "Circle",
        {
            parameters: [string, point, point],
            result: "circle",
            execute: (context, args) =>
                createCircle(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                ),
        },
    ],
    [
        "Circle1",
        {
            parameters: [string, point, formula],
            result: "circle",
            validate: (args, lineNumber, variables) => {
                const radiusArg = args[2];
                if (
                    radiusArg.type !== "literal" ||
                    typeof radiusArg.value !== "string"
                )
                    return;
                const radiusFormula = parseRadiusFormula(
                    radiusArg.value,
                    lineNumber,
                );
                validateFormulaReferences(radiusFormula, variables, lineNumber);
            },
            execute: (context, args) => {
                const name = args[0] as string;
                const center = args[1] as point_object;
                const radiusArg = args[2];
                if (typeof radiusArg !== "string")
                    return createCircle1(
                        context.construction,
                        name,
                        center,
                        radiusArg as number,
                    );
                const radiusFormula = parseFormula(radiusArg);
                const refs = new Map(
                    [...formulaIdentifiers(radiusFormula)].map((refName) => [
                        refName,
                        context.variables.get(refName) as point_object,
                    ]),
                );
                return createCircle1(context.construction, name, center, {
                    formula: radiusFormula,
                    refs,
                });
            },
        },
    ],
    [
        "Circle3",
        {
            parameters: [string, point, point, point],
            result: "circle",
            execute: (context, args) =>
                createCircle3(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                    args[3] as point_object,
                ),
        },
    ],
    [
        "Circle3pts",
        {
            parameters: [string, point, point, point],
            result: "circle",
            execute: (context, args) =>
                createCircle3pts(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                    args[3] as point_object,
                ),
        },
    ],
    [
        "Arc3pts",
        {
            parameters: [string, point, point, point],
            result: "circle",
            execute: (context, args) =>
                createArc3pts(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                    args[3] as point_object,
                ),
        },
    ],
    [
        "Quadric",
        {
            parameters: [string, point, point, point, point, point],
            result: "quadric",
            execute: (context, args) =>
                createQuadric5pts(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                    args[3] as point_object,
                    args[4] as point_object,
                    args[5] as point_object,
                ),
        },
    ],
    [
        "OrderedIntersection",
        {
            parameters: [
                string,
                intersectable,
                intersectable,
                number,
                { ...point, optional: true },
            ],
            result: "point",
            validate: (args, lineNumber) => {
                const order = (args[3] as { value: number }).value;
                if (![0, 1, 2, 3].includes(order))
                    throw new Error(
                        `Invalid intersection order at line ${lineNumber}`,
                    );
            },
            execute: (context, args) =>
                createOrderedIntersection(
                    context.construction,
                    args[0] as string,
                    args[1] as
                        | primitive_line_object
                        | primitive_circle_object
                        | primitive_quadric_object,
                    args[2] as
                        | primitive_line_object
                        | primitive_circle_object
                        | primitive_quadric_object,
                    args[3] as 0 | 1 | 2 | 3,
                    args[4] as point_object | undefined,
                ),
        },
    ],
    [
        "MidPoint",
        {
            parameters: [string, point, point],
            result: "point",
            execute: (context, args) =>
                createMidpoint(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                ),
        },
    ],
    [
        "Symmetry",
        {
            parameters: [string, point, point],
            result: "point",
            execute: (context, args) =>
                createSymmetry(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                ),
        },
    ],
    [
        "Reflection",
        {
            parameters: [string, line, point],
            result: "point",
            execute: (context, args) =>
                createReflection(
                    context.construction,
                    args[0] as string,
                    args[1] as primitive_line_object,
                    args[2] as point_object,
                ),
        },
    ],
    [
        "Center",
        {
            parameters: [string, circle],
            result: "point",
            execute: (context, args) =>
                createCenter(
                    context.construction,
                    args[0] as string,
                    args[1] as primitive_circle_object,
                ),
        },
    ],
    [
        "Polygon",
        {
            parameters: [string, string],
            result: "polygon",
            validate: (args, lineNumber, variables) =>
                literalString(args[1])
                    .split(",")
                    .forEach((token) => {
                        const name = polygonPointName(token, lineNumber);
                        if (!accepts(variables.get(name)!, "point"))
                            throw new Error(
                                `Unknown DGP reference at line ${lineNumber}`,
                            );
                    }),
            execute: (context, args) =>
                createPolygon(
                    context.construction,
                    args[0] as string,
                    (args[1] as string)
                        .split(",")
                        .map(
                            (token) =>
                                context.variables.get(
                                    token.slice(1),
                                ) as point_object,
                        ),
                ),
        },
    ],
    [
        "Expression",
        {
            parameters: [
                string,
                string,
                string,
                string,
                string,
                string,
                string,
            ],
            result: "expression",
            validate: (args, lineNumber, variables) => {
                const bound = (value: DgpValue): boolean => {
                    const source = literalString(value);
                    return source === "" || STYLE_NUMBER.test(source);
                };
                if (!bound(args[2]) || !bound(args[3]))
                    throw new Error(
                        `Invalid DGP expression bound at line ${lineNumber}`,
                    );
                const source = literalString(args[4]);
                if (parseExpressionValue(source) === null) {
                    let formulaNode: FormulaNode;
                    try {
                        formulaNode = parseFormula(source);
                    } catch {
                        throw new Error(
                            `Unsupported DGP expression at line ${lineNumber}`,
                        );
                    }
                    if (!isPointExpressionFormula(formulaNode, variables))
                        validateFunctionFormulaReferences(
                            formulaNode,
                            variables,
                            lineNumber,
                        );
                }
                if (
                    !STYLE_NUMBER.test(literalString(args[5])) ||
                    !STYLE_NUMBER.test(literalString(args[6]))
                )
                    throw new Error(
                        `Invalid DGP expression position at line ${lineNumber}`,
                    );
            },
            execute: (context, args) => {
                const min = args[2] as string;
                const max = args[3] as string;
                // Unlike geometric objects, an expression's position is a
                // fixed window (screen) coordinate, not a projected math
                // point: DGPad stores it in world units only so it survives
                // a different SetCoords on save/reload, converting it back
                // with the plain 2D origin/unit math below (no 3D rotation
                // involved — see expression_object.ts).
                const grid = context.construction.GRID;
                const x = Number(args[5] as string);
                const y = Number(args[6] as string);
                const source = args[4] as string;
                const constant = parseExpressionValue(source);
                let formula: ExpressionFormula | null = null;
                let pointFormula: PointExpressionFormula | null = null;
                if (constant === null) {
                    const node = parseFormula(source);
                    if (isPointExpressionFormulaAt(node, context.variables)) {
                        pointFormula = {
                            node,
                            source,
                            refs: pointFormulaRefs(node, context.variables),
                        };
                    } else {
                        formula = {
                            node,
                            source,
                            refs: functionFormulaRefs(node, context.variables),
                        };
                    }
                }
                return createExpression(
                    context.construction,
                    args[0] as string,
                    args[1] as string,
                    constant,
                    min === "" ? null : Number(min),
                    max === "" ? null : Number(max),
                    [
                        grid.ORG[0] + x * grid.UNIT[0],
                        grid.ORG[1] - y * grid.UNIT[1],
                    ],
                    formula,
                    pointFormula,
                );
            },
        },
    ],
    [
        "Curvus",
        {
            parameters: [string, string, string, string],
            result: "curve",
            validate: (args, lineNumber, variables) => {
                const bound = (value: DgpValue): boolean => {
                    const source = literalString(value);
                    return source === "" || STYLE_NUMBER.test(source);
                };
                if (!bound(args[1]) || !bound(args[2]))
                    throw new Error(
                        `Invalid DGP curve bound at line ${lineNumber}`,
                    );
                let formulaNode: FormulaNode;
                try {
                    formulaNode = parseFormula(literalString(args[3]));
                } catch {
                    throw new Error(
                        `Invalid DGP curve formula at line ${lineNumber}`,
                    );
                }
                validateFunctionFormulaReferences(
                    formulaNode,
                    variables,
                    lineNumber,
                );
            },
            execute: (context, args) => {
                const min = args[1] as string;
                const max = args[2] as string;
                const source = args[3] as string;
                const node = parseFormula(source);
                const formula: ExpressionFormula = {
                    node,
                    source,
                    refs: functionFormulaRefs(node, context.variables),
                };
                return createCurve(
                    context.construction,
                    args[0] as string,
                    formula,
                    min === "" ? null : Number(min),
                    max === "" ? null : Number(max),
                );
            },
        },
    ],
    [
        "List",
        {
            parameters: [
                string,
                string,
                string,
                string,
                { ...string, optional: true },
            ],
            result: "list",
            validate: (args, lineNumber, variables) => {
                const nature = literalString(args[1]);
                if (
                    nature !== "point" &&
                    nature !== "segment" &&
                    nature !== "line" &&
                    nature !== "label"
                )
                    throw new Error(
                        `Invalid DGP list nature at line ${lineNumber}`,
                    );
                const expectedArgs = nature === "point" ? 4 : 5;
                if (args.length !== expectedArgs)
                    throw new Error(
                        `Invalid List argument count at line ${lineNumber}`,
                    );
                const countFormula = parseListFormula(
                    literalString(args[2]),
                    lineNumber,
                );
                validateListFormulaReferences(
                    countFormula,
                    variables,
                    lineNumber,
                );
                const formula1 = parseListFormula(
                    literalString(args[3]),
                    lineNumber,
                );
                validateListFormulaReferences(formula1, variables, lineNumber);
                if (expectedArgs === 5) {
                    const formula2 = parseListFormula(
                        literalString(args[4]),
                        lineNumber,
                    );
                    validateListFormulaReferences(
                        formula2,
                        variables,
                        lineNumber,
                    );
                }
            },
            execute: (context, args) => {
                const name = args[0] as string;
                const nature = args[1] as ListNature;
                const countFormula = parseFormula(args[2] as string);
                const formula1 = parseFormula(args[3] as string);
                const formulas =
                    nature === "point"
                        ? [formula1]
                        : [formula1, parseFormula(args[4] as string)];
                const refs = listFormulaRefs(
                    [countFormula, ...formulas],
                    context.variables,
                );
                return createList(
                    context.construction,
                    name,
                    nature,
                    countFormula,
                    formulas,
                    refs,
                );
            },
        },
    ],
    [
        "STL",
        {
            parameters: [object, string],
            validate: (args, lineNumber, variables) =>
                validateObjectStyle(
                    literalString(args[1]),
                    lineNumber,
                    variables,
                ),
            execute: (context, args) =>
                applyObjectStyle(
                    args[0] as construction_object,
                    args[1] as string,
                    context.variables,
                ),
        },
    ],
    [
        "SetCoordsStyle",
        {
            parameters: [string],
            validate: (args, lineNumber) =>
                validateCoordsStyle(literalString(args[0]), lineNumber),
            execute: (context, args) =>
                applyCoordsStyle(context, args[0] as string),
        },
    ],
    [
        "SetGeneralStyle",
        {
            parameters: [string],
            validate: (args, lineNumber) =>
                validateGeneralStyle(literalString(args[0]), lineNumber),
            execute: (context, args) =>
                applyGeneralStyle(context.construction, args[0] as string),
        },
    ],
]);

function accepts(actual: ObjectKind, expected: ParameterKind): boolean {
    return (
        expected === "object" ||
        actual === expected ||
        (actual === "pointOn" && expected === "point") ||
        (expected === "intersectable" &&
            (actual === "line" ||
                actual === "circle" ||
                actual === "quadric")) ||
        (expected === "pointSupport" &&
            (actual === "line" ||
                actual === "circle" ||
                actual === "polygon" ||
                actual === "quadric" ||
                actual === "locus" ||
                actual === "list" ||
                actual === "curve"))
    );
}

function validateValue(
    value: DgpValue,
    parameter: Parameter,
    variables: Map<string, ObjectKind>,
    lineNumber: number,
): void {
    if (value.type === "literal") {
        if (parameter.kind === "coordinate" || parameter.kind === "formula") {
            if (
                typeof value.value !== "number" &&
                typeof value.value !== "string"
            )
                throw new Error(
                    `Invalid ${parameter.kind} argument at line ${lineNumber}`,
                );
            return;
        }
        if (parameter.kind === "numberOrPair") {
            if (typeof value.value !== "number")
                throw new Error(
                    `Invalid numberOrPair argument at line ${lineNumber}`,
                );
            return;
        }
        if (typeof value.value !== parameter.kind)
            throw new Error(
                `Invalid ${parameter.kind} argument at line ${lineNumber}`,
            );
        return;
    }
    if (value.type === "array") {
        if (
            parameter.kind !== "numberOrPair" ||
            value.items.length !== 2 ||
            value.items.some(
                (item) =>
                    item.type !== "literal" || typeof item.value !== "number",
            )
        )
            throw new Error(`Unexpected array at line ${lineNumber}`);
        return;
    }
    const actual = variables.get(value.name);
    if (!actual) throw new Error(`Unknown DGP reference at line ${lineNumber}`);
    if (!accepts(actual, parameter.kind))
        throw new Error(`Invalid DGP reference at line ${lineNumber}`);
}

function validateCalls(calls: DgpCall[]): void {
    const variables = new Map<string, ObjectKind>();
    calls.forEach((call) => {
        const definition = COMMANDS.get(call.name);
        if (!definition)
            throw new Error(
                `Unsupported DGP command ${call.name} at line ${call.line}`,
            );
        const required = definition.parameters.filter(
            (parameter) => !parameter.optional,
        ).length;
        if (
            call.arguments.length < required ||
            call.arguments.length > definition.parameters.length
        )
            throw new Error(`Invalid argument count at line ${call.line}`);
        if (definition.result && !call.variable)
            throw new Error(`Missing assignment at line ${call.line}`);
        if (!definition.result && call.variable)
            throw new Error(`Unexpected assignment at line ${call.line}`);
        call.arguments.forEach((value, index) =>
            validateValue(
                value,
                definition.parameters[index],
                variables,
                call.line,
            ),
        );
        definition.validate?.(call.arguments, call.line, variables);
        if (call.variable) {
            if (variables.has(call.variable))
                throw new Error(`Duplicate DGP variable at line ${call.line}`);
            variables.set(call.variable, definition.result!);
        }
    });
}

function resolveValue(
    value: DgpValue,
    variables: Map<string, construction_object>,
): RuntimeValue {
    if (value.type === "literal") return value.value;
    if (value.type === "reference") return variables.get(value.name)!;
    return value.items.map((item) => resolveValue(item, variables));
}

export function executeDgpCommands(c: construction, calls: DgpCall[]): void {
    validateCalls(calls);
    const context: CommandContext = {
        construction: c,
        variables: new Map(),
        gridChanged: false,
        projectionChanged: false,
        is3D: false,
        origin3DAssigned: false,
    };

    c.beginBatch();
    calls.forEach((call) => {
        const definition = COMMANDS.get(call.name)!;
        const result = definition.execute(
            context,
            call.arguments.map((value) =>
                resolveValue(value, context.variables),
            ),
        );
        if (call.variable)
            context.variables.set(call.variable, result as construction_object);
    });
    if (context.gridChanged) c.GRID.createSVG();
    c.endBatch();
    if (context.projectionChanged) c.invalidateProjection();
}
