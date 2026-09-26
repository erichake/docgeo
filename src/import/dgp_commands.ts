import type { construction } from "../construction";
import { createAngleBisector } from "../objects/angle_bisector_object";
import {
    angle_object,
    createAngle,
    RIGHT_ANGLE_MARKS,
    type RightAngleMark,
} from "../objects/angle_object";
import { createArc3pts } from "../objects/arc3pts_object";
import { createCenter } from "../objects/center_object";
import { createCircle1 } from "../objects/circle1_object";
import { createCircle3 } from "../objects/circle3_object";
import { createCircle3pts } from "../objects/circle3pts_object";
import { createCircle } from "../objects/circle_object";
import { construction_object } from "../objects/construction_object";
import { createCurve } from "../objects/curve_object";
import { createCylinderIntersection } from "../objects/cylinder_intersection_object";
import { createCylinderSection } from "../objects/cylinder_section_object";
import { createDirectionPoint } from "../objects/direction_point_object";
import {
    createExpression,
    expression_object,
    type ExpressionFormula,
    type ExpressionProgram,
} from "../objects/expression_object";
import {
    createExpressionList,
    expression_list_object,
} from "../objects/expression_list_object";
import {
    createFixedAngle,
    fixed_angle_object,
} from "../objects/fixed_angle_object";
import { createFixedPoint } from "../objects/fixed_point_object";
import { createIteration, type SegmentMap } from "../objects/iteration_object";
import { createText, type TextRef } from "../objects/text_object";
import { createImage } from "../objects/image_object";
import { createFormulaPoint } from "../objects/formula_point_object";
import {
    createOrderedIntersection,
    type intersectable_object,
} from "../objects/intersection_object";
import {
    createList,
    type ListNature,
    type ListRef,
} from "../objects/list_object";
import { createLocus } from "../objects/locus_object";
import { createMidpoint } from "../objects/midpoint_object";
import { createParallel } from "../objects/parallel_line_object";
import { createPerpendicularBisector } from "../objects/perpendicular_bisector_object";
import { createPlaneIntersection } from "../objects/plane_intersection_object";
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
import { createPolygon, polygon_object } from "../objects/polygon_object";
import { primitive_circle_object } from "../objects/primitive_circle_object";
import { primitive_line_object } from "../objects/primitive_line_object";
import { createQuadric5pts } from "../objects/quadric5pts_object";
import { createRay } from "../objects/ray_line_object";
import { createReflection } from "../objects/reflection_object";
import { createSegment, segment_object } from "../objects/segment_object";
import { createSphere } from "../objects/sphere_object";
import { createSymmetry } from "../objects/symmetry_object";
import { createLine } from "../objects/two_points_line_object";
import { createVector } from "../objects/vector_object";
import type { Vec2, Vec3 } from "../vec";
import {
    evaluateFormula,
    formulaIdentifiers,
    NO_VIEW,
    parseFormula,
    parseProgram,
    programReferences,
    programTargets,
    realPart,
    type FormulaNode,
    type FormulaValue,
    type Program,
} from "./dgp_formula";
import type { DgpCall, DgpValue } from "./dgp_parser";

type ObjectKind =
    | "point"
    | "pointOn"
    | "line"
    | "circle"
    | "polygon"
    | "quadric"
    | "sphere"
    | "section"
    | "locus"
    | "angle"
    | "expression"
    | "list"
    | "curve"
    | "text"
    | "image";
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
    | "formula"
    // List's second parameter: DGPad's Expression holding the points, or
    // the nature of DocGeo's own List of formulas.
    | "listSource";

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
    // SetCoords' own saved pixel origin (x0,y0), independent of GRID.ORG:
    // an Expression's screen position is computed once from this and
    // stays fixed for the object's lifetime (see Expression's execute),
    // unlike GRID.ORG, which in 3D mode tracks the live viewport instead
    // (see SetCoords' execute) and can keep changing afterward (e.g. on
    // window resize).
    labelOrigin: Vec2;
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
const listSource: Parameter = { kind: "listSource" };
// DGPad's own color parser matches this hex prefix without anchoring the
// end, so a color value with a stray suffix (e.g. a missing ";" merging it
// with the next "key:value" pair, as seen in some exported .dgp files) is
// tolerated: only the leading hex digits are read, the rest is dropped.
const COLOR = /^#(?:[\da-f]{6}|[\da-f]{3})/i;
const IMAGE_URL =
    /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z\d+/]*=*$/;
const STYLE_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
// A point's "sp" style: DGPad's shape index (0:circle, 1:cross, 2:diamond,
// 3:square), see PointObject.setShape in the reference implementation.
const POINT_SHAPES = ["circle", "cross", "diamond", "rect"];
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
// real DGP array value; the components may themselves be constant
// arithmetic (e.g. "[1,1,1/3]"). Only a literal "[...]" that doesn't
// reference any other object counts as a fixed point: anything else (a
// bare formula, or a "[...]" that reads another object, e.g.
// "[1-2*cos(E2),1+2*sin(E2),1]") is a dependent point formula instead (see
// Point's execute), not a one-time constant.
function parseVectorLiteral(value: string): number[] | null {
    let node: FormulaNode;
    try {
        node = parseFormula(value);
    } catch {
        return null;
    }
    if (node.kind !== "vector") return null;
    const result = evaluateFormula(node, {
        resolveIdentifier: () => null,
        view: () => NO_VIEW,
    });
    return result === null || typeof result === "number" ? null : [...result];
}

// "M.coords3D()" (a Point mirroring another point's own 3D position): in
// this project's 3D-aware point-formula evaluation (see Point's execute),
// a bare point identifier already resolves to its full 3D coordinates, so
// the ".coords3D()" suffix is a no-op and can just be stripped.
const COORDS3D_MIRROR = /^([A-Za-z_$][\w$]*)\.coords3D\(\)$/;
function stripCoords3DSuffix(value: string): string {
    return COORDS3D_MIRROR.exec(value)?.[1] ?? value;
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

// A constant, reference-free formula (an Expression's slider bound, e.g.
// "π/2"): reuses the general formula grammar/evaluator instead of a plain
// number regex, so it also accepts DGPad's own math notation (π, arithmetic)
// rather than only bare digits.
function tryParseFormula(source: string): FormulaNode | null {
    try {
        return parseFormula(source);
    } catch {
        return null;
    }
}

function evaluateConstant(source: string): FormulaValue | null {
    const node = tryParseFormula(source);
    return (
        node &&
        evaluateFormula(node, {
            resolveIdentifier: () => null,
            view: () => NO_VIEW,
        })
    );
}

function evaluateConstantFormula(source: string): number | null {
    return realPart(evaluateConstant(source));
}

// DGPad's Expression can also hold a script, e.g.
// "if(a>2){S1.setHidden(1)};\"Faces\"": see Program in dgp_formula.ts.
function tryParseProgram(source: string): Program | null {
    try {
        return parseProgram(source);
    } catch {
        return null;
    }
}

const FUNCTION_VARIABLES = ["x", "y", "z", "t"];

// A formula of DGPad's function variables (e.g. "0.5x^2-4", or "z^2+c"),
// which the Expression displays and Curvus plots or other Expressions call,
// rather than a value. As in DGPad, an object's name is never a variable.
function functionFormula(
    program: Program,
    objects: Map<string, unknown>,
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

// Apart from its variables, a function formula reads the figure's points and
// Expressions, and calls function-valued Expressions by name (e.g. "E1(x)").
function functionReferences(
    formulaNode: FormulaNode,
    functionVariables: string[],
): Set<string> {
    const names = formulaIdentifiers(formulaNode);
    functionVariables.forEach((name) => names.delete(name));
    return names;
}

function validateFunctionFormulaReferences(
    formulaNode: FormulaNode,
    functionVariables: string[],
    variables: Map<string, ObjectKind>,
    lineNumber: number,
): void {
    functionReferences(formulaNode, functionVariables).forEach((name) => {
        const kind = variables.get(name);
        if (kind !== "point" && kind !== "pointOn" && kind !== "expression")
            throw new Error(`Unknown DGP reference at line ${lineNumber}`);
    });
}

// A program reads the figure's points and Expressions, and styles any of
// its objects.
function validateProgramReferences(
    program: Program,
    variables: Map<string, ObjectKind>,
    lineNumber: number,
): void {
    programReferences(program).forEach((name) => {
        const kind = variables.get(name);
        if (kind !== "point" && kind !== "pointOn" && kind !== "expression")
            throw new Error(`Unknown DGP reference at line ${lineNumber}`);
    });
    programTargets(program).forEach((name) => {
        if (!variables.has(name))
            throw new Error(`Unknown DGP reference at line ${lineNumber}`);
    });
}

function pointFormulaRefs(
    names: Set<string>,
    variables: Map<string, construction_object>,
): Map<string, point_object | expression_object> {
    return new Map(
        [...names].map((name) => [
            name,
            variables.get(name) as point_object | expression_object,
        ]),
    );
}

// DGPad applies restrictTheta/restrictPhi to the view as it reads the
// figure.
function applyViewRestrictions(
    context: CommandContext,
    program: Program,
): void {
    const grid = context.construction.GRID;
    program.body.forEach((statement) => {
        const node = statement.kind === "expression" ? statement.node : null;
        if (
            node?.kind !== "call" ||
            (node.fn !== "restrictTheta" && node.fn !== "restrictPhi")
        )
            return;
        const range = evaluateFormula(node.args[0], {
            resolveIdentifier: () => null,
            view: () => NO_VIEW,
        });
        if (
            range === null ||
            typeof range === "number" ||
            range.length !== 2 ||
            range[0] > range[1]
        )
            return;
        const angle = node.fn === "restrictTheta" ? "THETA" : "PHI";
        grid[`RESTRICT_${angle}`] = range;
        grid[angle] = Math.min(Math.max(grid[angle], range[0]), range[1]);
        context.projectionChanged = true;
    });
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

// A Point's own dependent formula (e.g. "P1+[-1,-1,1]", "M.coords3D()"):
// unlike a plain object formula, it may also read a slider Expression's
// scalar value (e.g. "[1-2*cos(E2),1+2*sin(E2),1]"), and a "pointOn" is as
// good a point reference as a free/fixed one.
function validatePointFormulaReferences(
    formulaNode: FormulaNode,
    variables: Map<string, ObjectKind>,
    lineNumber: number,
): void {
    formulaIdentifiers(formulaNode).forEach((name) => {
        const kind = variables.get(name);
        if (kind !== "point" && kind !== "pointOn" && kind !== "expression")
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
// read a cursor's numeric value or a polygon's area, and its "k"/"count" loop-scope names are
// synthetic (bound per index by list_object itself), never real references.
function validateListFormulaReferences(
    formulaNode: FormulaNode,
    variables: Map<string, ObjectKind>,
    lineNumber: number,
): void {
    formulaIdentifiers(formulaNode).forEach((name) => {
        if (name === "k" || name === "count") return;
        const kind = variables.get(name);
        if (
            kind !== "point" &&
            kind !== "pointOn" &&
            kind !== "expression" &&
            kind !== "polygon"
        )
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

// An AnchoredText's content: text alternating with "%formula%" parts, "%%"
// being a literal "%".
function textParts(content: string): string[] {
    return content.split("%");
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
            case "fl":
            case "pl":
            case "su":
            case "cV":
            case "cB":
            case "tx":
            case "dh":
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
            case "sp":
                validateNumber(
                    propertyValue,
                    lineNumber,
                    0,
                    POINT_SHAPES.length - 1,
                );
                if (!Number.isInteger(Number(propertyValue)))
                    throw new Error(
                        `Invalid DGP style number at line ${lineNumber}`,
                    );
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
            case "dc":
                validateNumber(propertyValue, lineNumber, 0, 6);
                if (!Number.isInteger(Number(propertyValue)))
                    throw new Error(
                        `Invalid DGP style number at line ${lineNumber}`,
                    );
                break;
            case "ra":
                if (
                    !(RIGHT_ANGLE_MARKS as readonly string[]).includes(
                        propertyValue,
                    )
                )
                    throw new Error(`Invalid DGP style at line ${lineNumber}`);
                break;
            case "i":
                propertyValue
                    .split(",")
                    .forEach((step) => validateNumber(step, lineNumber, 0));
                break;
            case "cL":
                validateNumber(propertyValue, lineNumber, 0);
                break;
            case "sg":
                validateNumber(propertyValue, lineNumber, -Infinity);
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
            case "sc":
                if (variables.get(propertyValue) !== "expression")
                    throw new Error(
                        `Unknown DGP reference at line ${lineNumber}`,
                    );
                break;
            case "mg":
                if (!MAGNET_LIST.test(propertyValue))
                    throw new Error(`Invalid DGP style at line ${lineNumber}`);
                parseMagnetList(propertyValue).forEach(({ name }) => {
                    const kind = variables.get(name);
                    if (
                        kind !== "line" &&
                        kind !== "circle" &&
                        kind !== "quadric" &&
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
    context: CommandContext,
    target: construction_object,
    value: string,
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
            case "pl":
                if (target instanceof polygon_object)
                    target.plane = propertyValue === "true";
                break;
            case "su":
                if (target instanceof polygon_object)
                    target.section = propertyValue === "true";
                break;
            case "tk":
                if (target instanceof point_object)
                    target.trace = propertyValue === "true";
                break;
            // In a 3D figure, it marks the 3D origin instead (see
            // CommandContext).
            case "fl":
                if (
                    propertyValue === "true" &&
                    !context.is3D &&
                    target instanceof point_object &&
                    target.moveable &&
                    target.parents.length === 0
                )
                    target.pin();
                break;
            case "f":
                target.fontSize = Number(propertyValue);
                break;
            case "np":
                if (target instanceof point_object)
                    target.namePosition = Number(propertyValue);
                break;
            case "sp":
                if (target instanceof point_object)
                    target.shape = POINT_SHAPES[Number(propertyValue)];
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
            case "dc":
                if (target instanceof segment_object)
                    target.decoration = Number(propertyValue);
                break;
            case "ra":
                if (target instanceof angle_object)
                    target.rightAngleMark = propertyValue as RightAngleMark;
                break;
            case "i":
                if (target instanceof expression_object)
                    target.increment = Number(propertyValue);
                else if (target instanceof point_object) {
                    const [dx, dy = dx] = propertyValue.split(",").map(Number);
                    target.increment = [dx, dy];
                }
                break;
            case "cL":
                if (target instanceof expression_object)
                    target.cursorLength = Number(propertyValue);
                break;
            case "sg":
                if (target instanceof expression_list_object)
                    target.segmentsSize = Number(propertyValue);
                break;
            case "cV":
                if (target instanceof expression_object)
                    target.vertical = propertyValue === "true";
                break;
            case "cB":
                if (target instanceof expression_object)
                    target.checkbox = propertyValue === "true";
                break;
            case "tx":
                if (target instanceof expression_object)
                    target.latex = propertyValue === "true";
                break;
            case "dh":
                if (target instanceof primitive_line_object)
                    target.dash = propertyValue === "true";
                break;
            case "cPT":
                if (target instanceof expression_object)
                    applyCursorStyle(target, atob(propertyValue));
                break;
            case "sc":
                target.condition = context.variables.get(
                    propertyValue,
                ) as expression_object;
                target.addParents(target.condition);
                break;
            case "mg":
                if (target instanceof point_object)
                    target.magnets = parseMagnetList(propertyValue).map(
                        ({ name, radius }) => ({
                            target: context.variables.get(
                                name,
                            ) as magnet_target,
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
    const grid = context.construction.GRID;
    const flag = (name: string, apply: (value: boolean) => void) => {
        const value = style.get(name);
        if (value !== undefined) apply(value === "true");
    };
    const size = (name: string, apply: (value: number) => void) => {
        const value = style.get(name);
        if (value !== undefined) apply(Number(value));
    };
    flag("isAxis", (visible) => {
        grid.hidden = visible ? 0 : 1;
        grid.SHOWFLOOR = visible;
    });
    flag("isGrid", (value) => (grid.showGrid = value));
    flag("isOx", (value) => (grid.showOx = value));
    flag("isOy", (value) => (grid.showOy = value));
    flag("isLockOx", (value) => (grid.lockOx = value));
    flag("isLockOy", (value) => (grid.lockOy = value));
    flag("centerZoom", (value) => (grid.centerZoom = value));
    flag("onlyPositive", (value) => (grid.onlyPositive = value));
    const color = style.get("color");
    if (color !== undefined) grid.stroke_color = color;
    size("fontSize", (value) => (grid.fontSize = value));
    size("axisWidth", (value) => (grid.size = value));
    size("gridWidth", (value) => (grid.gridWidth = value));
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

function validateExpression(
    args: DgpValue[],
    lineNumber: number,
    variables: Map<string, ObjectKind>,
): void {
    const bound = (value: DgpValue): boolean => {
        const source = literalString(value);
        return source === "" || evaluateConstantFormula(source) !== null;
    };
    if (!bound(args[2]) || !bound(args[3]))
        throw new Error(`Invalid DGP expression bound at line ${lineNumber}`);
    const source = literalString(args[4]);
    if (parseExpressionValue(source) !== null) return;
    const program = tryParseProgram(source);
    if (!program)
        throw new Error(`Unsupported DGP expression at line ${lineNumber}`);
    const fn = functionFormula(program, variables);
    if (fn)
        validateFunctionFormulaReferences(
            fn.node,
            fn.variables,
            variables,
            lineNumber,
        );
    else validateProgramReferences(program, variables, lineNumber);
}

function executeExpression(
    context: CommandContext,
    args: RuntimeValue[],
    screen: Vec2,
): expression_object {
    const min = args[2] as string;
    const max = args[3] as string;
    const source = args[4] as string;
    const constant = parseExpressionValue(source);
    let formula: ExpressionFormula | null = null;
    let program: ExpressionProgram | null = null;
    if (constant === null) {
        const parsed = parseProgram(source);
        const fn = functionFormula(parsed, context.variables);
        if (fn) {
            formula = {
                ...fn,
                source,
                refs: pointFormulaRefs(
                    functionReferences(fn.node, fn.variables),
                    context.variables,
                ),
                vec3: context.is3D,
            };
        } else {
            program = {
                program: parsed,
                refs: pointFormulaRefs(
                    programReferences(parsed),
                    context.variables,
                ),
                targets: new Map(
                    [...programTargets(parsed)].map((name) => [
                        name,
                        context.variables.get(name)!,
                    ]),
                ),
                vec3: context.is3D,
            };
            applyViewRestrictions(context, parsed);
        }
    }
    return createExpression(
        context.construction,
        args[0] as string,
        args[1] as string,
        constant,
        min === "" ? null : evaluateConstantFormula(min),
        max === "" ? null : evaluateConstantFormula(max),
        screen,
        formula,
        program,
    );
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
                context.labelOrigin = [args[0] as number, args[1] as number];
                if (context.is3D) {
                    // In the legacy 3D format, the first two numbers are the
                    // raw camera rotation state (angle = raw * grid.STEP),
                    // the unit the interactive rotation drag already uses.
                    // The raw theta can land outside GRID.RESTRICT_THETA
                    // (whose bounds aren't a full turn wide), which renders
                    // fine since cos/sin are periodic, but the first
                    // rotation drag would then clamp it back onto the
                    // boundary as a visible jump. Normalize to the
                    // equivalent angle inside the restricted window first.
                    grid.PHI = (args[0] as number) * grid.STEP;
                    grid.THETA = normalizeAngle(
                        (args[1] as number) * grid.STEP,
                        grid.RESTRICT_THETA,
                    );
                    // A 3D figure's world origin always projects to the
                    // live viewport's center — matching this legacy
                    // format's own "centerZoom" convention and how the app
                    // already recenters on a live resize (construction.
                    // resize) — rather than reusing the pixel position
                    // saved from a possibly differently-sized window, which
                    // would offset or crop the projected geometry. An
                    // Expression's screen label isn't projected geometry
                    // (see labelOrigin above): it keeps using the saved
                    // pixel position instead, unaffected by this.
                    grid.ORG = [
                        context.construction.width / 2,
                        context.construction.height / 2,
                    ];
                } else {
                    grid.ORG = context.labelOrigin;
                }
                grid.UNIT = [unit, unit, unit];
                context.projectionChanged = true;
            },
        },
    ],
    [
        "Point",
        {
            parameters: [
                string,
                coordinate,
                coordinate,
                { ...number, optional: true },
            ],
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
                if (third.value !== "0" && third.value !== "1")
                    throw new Error(
                        `Invalid DGP point flag at line ${lineNumber}`,
                    );
                const source = stripCoords3DSuffix(second.value);
                const vector = parseVectorLiteral(source);
                if (vector) {
                    if ((third.value === "1") !== (vector.length === 3))
                        throw new Error(
                            `Invalid DGP point flag at line ${lineNumber}`,
                        );
                    return;
                }
                const pointFormula = parsePointFormula(source, lineNumber);
                validatePointFormulaReferences(
                    pointFormula,
                    variables,
                    lineNumber,
                );
            },
            execute: (context, args) => {
                const name = args[0] as string;
                const second = args[1];
                if (typeof second === "string") {
                    const source = stripCoords3DSuffix(second);
                    const vector = parseVectorLiteral(source);
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
                    const formula = parseFormula(source);
                    const refs = new Map(
                        [...formulaIdentifiers(formula)].map((refName) => [
                            refName,
                            context.variables.get(refName) as
                                point_object | expression_object,
                        ]),
                    );
                    return createFormulaPoint(
                        context.construction,
                        name,
                        formula,
                        refs,
                        context.is3D,
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
                    (args[3] as number | undefined) ?? 0,
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
        "Vector",
        {
            parameters: [string, point, point],
            result: "line",
            execute: (context, args) =>
                createVector(
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
                    context.construction.degrees
                        ? Number(args[3] as string)
                        : (Number(args[3] as string) * 180) / Math.PI,
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
            // The optional line is the circle's axis, for a circle outside
            // the horizontal plane.
            parameters: [string, point, formula, { ...line, optional: true }],
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
                validatePointFormulaReferences(
                    radiusFormula,
                    variables,
                    lineNumber,
                );
            },
            execute: (context, args) => {
                const name = args[0] as string;
                const center = args[1] as point_object;
                const radiusArg = args[2];
                const axis = args[3] as primitive_line_object | undefined;
                if (typeof radiusArg !== "string")
                    return createCircle1(
                        context.construction,
                        name,
                        center,
                        radiusArg as number,
                        axis,
                    );
                const radiusFormula = parseFormula(radiusArg);
                const refs = new Map(
                    [...formulaIdentifiers(radiusFormula)].map((refName) => [
                        refName,
                        context.variables.get(refName) as
                            point_object | expression_object,
                    ]),
                );
                return createCircle1(
                    context.construction,
                    name,
                    center,
                    { formula: radiusFormula, refs },
                    axis,
                );
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
        "Sector3pts",
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
                    true,
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
        "Sphere",
        {
            parameters: [string, point, point],
            result: "sphere",
            execute: (context, args) =>
                createSphere(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                ),
        },
    ],
    // Not a DGPad command: GeoGebra's Intersect(line, cylinder), the
    // cylinder being given by its axis AB and a point R on it.
    [
        "CylinderIntersection",
        {
            parameters: [string, line, point, point, point, number],
            result: "point",
            validate: (args, lineNumber) => {
                const order = (args[5] as { value: number }).value;
                if (order !== 0 && order !== 1)
                    throw new Error(
                        `Invalid intersection order at line ${lineNumber}`,
                    );
            },
            execute: (context, args) =>
                createCylinderIntersection(
                    context.construction,
                    args[0] as string,
                    args[1] as primitive_line_object,
                    args[2] as point_object,
                    args[3] as point_object,
                    args[4] as point_object,
                    args[5] as 0 | 1,
                ),
        },
    ],
    // Not a DGPad command: GeoGebra's IntersectPath(plane, cylinder), the
    // cylinder being given by its axis AB and a point R on it, the plane by
    // three of its points.
    [
        "CylinderSection",
        {
            parameters: [string, point, point, point, point, point, point],
            result: "section",
            execute: (context, args) =>
                createCylinderSection(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                    args[3] as point_object,
                    args.slice(4) as [point_object, point_object, point_object],
                ),
        },
    ],
    // Not a DGPad command: GeoGebra's text, anchored at a point shifted by
    // (dx, dy) screen pixels.
    [
        "AnchoredText",
        {
            parameters: [string, point, number, number, string],
            result: "text",
            validate: (args, lineNumber, variables) => {
                const parts = textParts(literalString(args[4]));
                if (parts.length % 2 === 0)
                    throw new Error(`Invalid DGP text at line ${lineNumber}`);
                parts.forEach((part, index) => {
                    if (index % 2 === 1 && part !== "")
                        validateListFormulaReferences(
                            parseListFormula(part, lineNumber),
                            variables,
                            lineNumber,
                        );
                });
            },
            execute: (context, args) => {
                const parts = textParts(args[4] as string).map((part, index) =>
                    index % 2 === 0
                        ? part
                        : part === ""
                          ? "%"
                          : parseFormula(part),
                );
                return createText(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    [args[2] as number, args[3] as number],
                    parts,
                    listFormulaRefs(
                        parts.filter((part) => typeof part !== "string"),
                        context.variables,
                    ) as Map<string, TextRef>,
                );
            },
        },
    ],
    // Not a DGPad command: GeoGebra's image, embedded as a data URL so that
    // nothing is fetched, with its size in pixels and its corners (see
    // image_object).
    [
        "Image",
        {
            parameters: [
                string,
                string,
                number,
                number,
                point,
                point,
                { ...point, optional: true },
            ],
            result: "image",
            validate: (args, lineNumber) => {
                if (
                    !IMAGE_URL.test(literalString(args[1])) ||
                    [args[2], args[3]].some(
                        (size) => !((size as { value: number }).value > 0),
                    )
                )
                    throw new Error(`Invalid DGP image at line ${lineNumber}`);
            },
            execute: (context, args) =>
                createImage(
                    context.construction,
                    args[0] as string,
                    args[1] as string,
                    args[2] as number,
                    args[3] as number,
                    args.slice(4).filter(Boolean) as point_object[],
                ),
        },
    ],
    // Not a DGPad command: GeoGebra's Iteration of segments, from their
    // ends "_P1,_Q1,_P2,_Q2,…", the number of levels, and each map's a and b
    // as "ax,ay,bx,by;…" (see iteration_object).
    [
        "SegmentIteration",
        {
            parameters: [string, string, string, string],
            result: "list",
            validate: (args, lineNumber, variables) => {
                const ends = literalString(args[1]).split(",");
                if (
                    ends.length % 2 !== 0 ||
                    ends.some(
                        (token) =>
                            !accepts(
                                variables.get(
                                    polygonPointName(token, lineNumber),
                                )!,
                                "point",
                            ),
                    )
                )
                    throw new Error(
                        `Unknown DGP reference at line ${lineNumber}`,
                    );
                validateListFormulaReferences(
                    parseListFormula(literalString(args[2]), lineNumber),
                    variables,
                    lineNumber,
                );
                literalString(args[3])
                    .split(";")
                    .forEach((map) => {
                        const values = map.split(",");
                        if (
                            values.length !== 4 ||
                            values.some((value) => !STYLE_NUMBER.test(value))
                        )
                            throw new Error(
                                `Invalid DGP segment map at line ${lineNumber}`,
                            );
                    });
            },
            execute: (context, args) => {
                const ends = (args[1] as string)
                    .split(",")
                    .map(
                        (token) =>
                            context.variables.get(
                                token.slice(1),
                            ) as point_object,
                    );
                const levels = parseFormula(args[2] as string);
                return createIteration(
                    context.construction,
                    args[0] as string,
                    ends.flatMap((end, index) =>
                        index % 2 === 0 ? [[end, ends[index + 1]]] : [],
                    ) as [point_object, point_object][],
                    levels,
                    listFormulaRefs([levels], context.variables),
                    (args[3] as string).split(";").map((map) => {
                        const [ax, ay, bx, by] = map.split(",").map(Number);
                        return [
                            [ax, ay],
                            [bx, by],
                        ] as SegmentMap;
                    }),
                );
            },
        },
    ],
    // Not a DGPad command: GeoGebra's Intersect(line, sphere), the sphere
    // being given by its center and a point on it.
    [
        "SphereIntersection",
        {
            parameters: [string, line, point, point, number],
            result: "point",
            validate: (args, lineNumber) => {
                const order = (args[4] as { value: number }).value;
                if (order !== 0 && order !== 1)
                    throw new Error(
                        `Invalid intersection order at line ${lineNumber}`,
                    );
            },
            execute: (context, args) =>
                createCylinderIntersection(
                    context.construction,
                    args[0] as string,
                    args[1] as primitive_line_object,
                    args[2] as point_object,
                    null,
                    args[3] as point_object,
                    args[4] as 0 | 1,
                ),
        },
    ],
    // Not a DGPad command: GeoGebra's Intersect(line, plane), the plane
    // being given by three of its points.
    [
        "PlaneIntersection",
        {
            parameters: [string, line, point, point, point],
            result: "point",
            execute: (context, args) =>
                createPlaneIntersection(
                    context.construction,
                    args[0] as string,
                    args[1] as primitive_line_object,
                    args.slice(2) as [point_object, point_object, point_object],
                ),
        },
    ],
    // Not a DGPad command: P moved by a line's direction vector.
    [
        "DirectionPoint",
        {
            parameters: [string, line, point],
            result: "point",
            execute: (context, args) =>
                createDirectionPoint(
                    context.construction,
                    args[0] as string,
                    args[1] as primitive_line_object,
                    args[2] as point_object,
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
                    args[1] as intersectable_object,
                    args[2] as intersectable_object,
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
                validateExpression(args, lineNumber, variables);
                if (
                    !STYLE_NUMBER.test(literalString(args[5])) ||
                    !STYLE_NUMBER.test(literalString(args[6]))
                )
                    throw new Error(
                        `Invalid DGP expression position at line ${lineNumber}`,
                    );
            },
            execute: (context, args) => {
                // Unlike geometric objects, an expression's position is a
                // fixed window (screen) coordinate, not a projected math
                // point: DGPad stores it in world units only so it survives
                // a different SetCoords on save/reload, converting it back
                // with the plain 2D origin/unit math below (no 3D rotation
                // involved — see expression_object.ts). It's anchored to
                // SetCoords' own saved pixel origin (context.labelOrigin),
                // not GRID.ORG: in 3D mode GRID.ORG tracks the live
                // viewport instead (see SetCoords' execute).
                const grid = context.construction.GRID;
                const x = Number(args[5] as string);
                const y = Number(args[6] as string);
                return executeExpression(context, args, [
                    context.labelOrigin[0] + x * grid.UNIT[0],
                    context.labelOrigin[1] - y * grid.UNIT[1],
                ]);
            },
        },
    ],
    [
        // An Expression attached to a point: it follows the point, drawn at
        // a fixed pixel offset from it.
        "ExpressionOn",
        {
            parameters: [
                string,
                string,
                string,
                string,
                string,
                point,
                numberOrPair,
            ],
            result: "expression",
            validate: (args, lineNumber, variables) => {
                validateExpression(args, lineNumber, variables);
                if (args[6].type !== "array")
                    throw new Error(
                        `Invalid DGP expression position at line ${lineNumber}`,
                    );
            },
            execute: (context, args) => {
                const expression = executeExpression(context, args, [0, 0]);
                expression.anchor = args[5] as point_object;
                const [dx, dy] = args[6] as number[];
                expression.alpha = [dx, dy];
                expression.addParents(expression.anchor);
                return expression;
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
                    ["x"],
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
                    variables: ["x"],
                    refs: pointFormulaRefs(
                        functionReferences(node, ["x"]),
                        context.variables,
                    ),
                    vec3: context.is3D,
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
                listSource,
                { ...string, optional: true },
                { ...string, optional: true },
                { ...string, optional: true },
            ],
            result: "list",
            validate: (args, lineNumber, variables) => {
                if (args[1].type === "reference") {
                    if (args.length !== 2)
                        throw new Error(
                            `Invalid List argument count at line ${lineNumber}`,
                        );
                    return;
                }
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
                if (args[1] instanceof expression_object)
                    return createExpressionList(
                        context.construction,
                        name,
                        args[1],
                    );
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
                    context,
                    args[0] as construction_object,
                    args[1] as string,
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
        (actual === "expression" && expected === "listSource") ||
        (expected === "intersectable" &&
            (actual === "line" ||
                actual === "circle" ||
                actual === "quadric" ||
                actual === "curve")) ||
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
        if (
            typeof value.value !==
            (parameter.kind === "listSource" ? "string" : parameter.kind)
        )
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

function validateCall(call: DgpCall, variables: Map<string, ObjectKind>): void {
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
}

// Formulas, texts and styles name objects inside string literals.
const IDENTIFIERS = /[$_\p{ID_Start}][$_\u200c\u200d\p{ID_Continue}]*/gu;

function referencedNames(value: DgpValue): string[] {
    if (value.type === "reference") return [value.name];
    if (value.type === "array") return value.items.flatMap(referencedNames);
    return typeof value.value === "string"
        ? (value.value.match(IDENTIFIERS) ?? [])
        : [];
}

function describeValue(value: DgpValue): string {
    if (value.type === "reference") return value.name;
    if (value.type === "array")
        return `[${value.items.map(describeValue).join(", ")}]`;
    return JSON.stringify(value.value);
}

// DGPad's first 3D figures predate its 3D mode: in a 2D figure, a point
// "point3D(O,[x,y,z])" projects the vector from O with view angles read from
// SetCoords' pixel origin (angle = pixel * STEP), exactly as the 3D mode did
// later. Such a figure is imported as a 3D one, O becoming its 3D origin
// when it is the first free point (see CommandContext).
const LEGACY_POINT3D =
    /^point3D\(\s*([A-Za-z_$][\w$]*)\s*,\s*(\[[^\]]*\])\s*\)$/;

function convertLegacyPoint3D(calls: DgpCall[]): DgpCall[] {
    let found = false;
    const converted = calls.map((call) => {
        const source = call.arguments[1];
        const match =
            call.name === "Point" &&
            source?.type === "literal" &&
            typeof source.value === "string"
                ? LEGACY_POINT3D.exec(source.value)
                : null;
        if (!match) return call;
        found = true;
        return {
            ...call,
            arguments: [
                call.arguments[0],
                { type: "literal", value: `${match[1]}+${match[2]}` },
                { type: "literal", value: "1" },
            ],
        } satisfies DgpCall;
    });
    if (!found) return calls;
    return converted.map((call) =>
        call.name === "SetCoords"
            ? {
                  ...call,
                  arguments: call.arguments.map((value, index) =>
                      index === 3 ? { type: "literal", value: true } : value,
                  ),
              }
            : call,
    );
}

// A call that can't be imported is skipped with its dependents, and only
// it is reported: the rest of the figure is still imported.
function validateCalls(calls: DgpCall[]): {
    valid: DgpCall[];
    unsupported: string[];
} {
    const variables = new Map<string, ObjectKind>();
    const skipped = new Set<string>();
    const unsupported: string[] = [];
    const valid = calls.filter((call) => {
        try {
            validateCall(call, variables);
            return true;
        } catch {
            if (
                !call.arguments
                    .flatMap(referencedNames)
                    .some((name) => skipped.has(name))
            )
                unsupported.push(
                    `${call.name}(${call.arguments.map(describeValue).join(", ")})`,
                );
            if (call.variable) skipped.add(call.variable);
            return false;
        }
    });
    return { valid, unsupported };
}

function resolveValue(
    value: DgpValue,
    variables: Map<string, construction_object>,
): RuntimeValue {
    if (value.type === "literal") return value.value;
    if (value.type === "reference") return variables.get(value.name)!;
    return value.items.map((item) => resolveValue(item, variables));
}

// `is3D` starts the figure in 3D without SetCoords' legacy origin pinning
// (see CommandContext): used by imports whose points carry a real z.
export function executeDgpCommands(
    c: construction,
    calls: DgpCall[],
    is3D = false,
): { variables: Map<string, construction_object>; unsupported: string[] } {
    const { valid, unsupported } = validateCalls(convertLegacyPoint3D(calls));
    // DGPad is in degrees unless the figure says otherwise, in its
    // SetGeneralStyle, which comes after the objects that depend on it.
    c.degrees = true;
    valid.forEach((call) => {
        if (call.name !== "SetGeneralStyle") return;
        const degree = properties(literalString(call.arguments[0])).get(
            "degree",
        );
        if (degree !== undefined) c.degrees = degree === "true";
    });
    const context: CommandContext = {
        construction: c,
        variables: new Map(),
        gridChanged: false,
        projectionChanged: false,
        is3D,
        origin3DAssigned: is3D,
        labelOrigin: [0, 0],
    };

    c.beginBatch();
    valid.forEach((call) => {
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
    if (!context.is3D) {
        c.GRID.is2D = true;
        c.GRID.SHOWFLOOR = false;
        context.gridChanged = true;
    }
    if (context.gridChanged) c.GRID.createSVG();
    c.endBatch();
    if (context.projectionChanged) c.invalidateProjection();
    return { variables: context.variables, unsupported };
}
