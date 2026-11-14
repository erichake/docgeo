// First, as in the player: the object classes import each other.
import "../construction";
import type { construction, Gesture } from "../construction";
import { createAngleBisector } from "../objects/angle_bisector_object";
import {
    angle_object,
    createAngle,
    RIGHT_ANGLE_MARKS,
    type RightAngleMark,
} from "../objects/angle_object";
import { createArc3pts } from "../objects/arc3pts_object";
import { createCenterArc } from "../objects/center_arc_object";
import { createConicArc } from "../objects/conic_arc_object";
import { createSemicircle } from "../objects/semicircle_object";
import { createInversion } from "../objects/inversion_object";
import {
    createTransformed,
    type transformable,
} from "../objects/transformed_object";
import {
    createPolyhedron,
    type polyhedron_object,
} from "../objects/polyhedron_object";
import { createRegularPolygon } from "../objects/regular_polygon_object";
import { createTriangleCenter } from "../objects/triangle_center_object";
import { createVertex } from "../objects/vertex_object";
import { createPlane, type plane_object } from "../objects/plane_object";
import { createPlaneLine } from "../objects/plane_line_object";
import { createNormalLine } from "../objects/normal_line_object";
import { createSphereSection } from "../objects/sphere_section_object";
import { createPlaneSection } from "../objects/plane_section_object";
import {
    createRevolution,
    type revolution_object,
} from "../objects/revolution_object";
import { createDisk } from "../objects/disk_object";
import { createNetVertex, type net_turn } from "../objects/net_vertex_object";
import { createTangent, type tangent_support } from "../objects/tangent_object";
import { createCenter } from "../objects/center_object";
import { createCircle1, type circle1_radius } from "../objects/circle1_object";
import { createAxisCircle } from "../objects/axis_circle_object";
import { createCircle3 } from "../objects/circle3_object";
import {
    circle3pts_object,
    createCircle3pts,
} from "../objects/circle3pts_object";
import { createCircle } from "../objects/circle_object";
import { construction_object, isDash } from "../objects/construction_object";
import { createCurve, type CurveBound } from "../objects/curve_object";
import { createButton, type button_object } from "../objects/button_object";
import { createEvent, runInits } from "../objects/event_object";
import { createCylinderIntersection } from "../objects/cylinder_intersection_object";
import { createCylinderSection } from "../objects/cylinder_section_object";
import { createDirectionPoint } from "../objects/direction_point_object";
import {
    createExpression,
    expression_object,
    listArrow,
    type ExpressionFormula,
    type SliderBounds,
    type ExpressionProgram,
} from "../objects/expression_object";
import {
    createExpressionList,
    expression_list_object,
} from "../objects/expression_list_object";
import {
    createFixedAngle,
    fixed_angle_object,
    type FixedAngleFormula,
} from "../objects/fixed_angle_object";
import { createFixedPoint } from "../objects/fixed_point_object";
import { createIteration, type SegmentMap } from "../objects/iteration_object";
import { createText, text_object } from "../objects/text_object";
import {
    createPanel,
    panelFormulas,
    panelNames,
    panelTargets,
    parsePanel,
    withoutEvents,
} from "../objects/panel_object";
import { createImage } from "../objects/image_object";
import { createFormulaPoint } from "../objects/formula_point_object";
import {
    createOrderedIntersection,
    type intersectable_object,
} from "../objects/intersection_object";
import {
    createList,
    list_object,
    type ListNature,
} from "../objects/list_object";
import {
    createSequence,
    SEQUENCE_VARIABLE,
    sequenceShape,
    type SequenceLoop,
} from "../objects/sequence_object";
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
import type { primitive_quadric_object } from "../objects/primitive_quadric_object";
import { primitive_line_object } from "../objects/primitive_line_object";
import { createQuadric5pts } from "../objects/quadric5pts_object";
import { createFocalConic } from "../objects/focal_conic_object";
import { createParabola } from "../objects/parabola_object";
import { createEquationCircle } from "../objects/equation_circle_object";
import {
    createEquationConic,
    type Equation,
} from "../objects/equation_conic_object";
import { createEquationLine } from "../objects/equation_line_object";
import { dilation_object } from "../objects/dilation_object";
import { rotation_object } from "../objects/rotation_object";
import {
    translation_object,
    type translation_vector,
} from "../objects/translation_object";
import { createRay } from "../objects/ray_line_object";
import { reflection_object } from "../objects/reflection_object";
import { createSegment, segment_object } from "../objects/segment_object";
import { createSphere, type sphere_object } from "../objects/sphere_object";
import { symmetry_object } from "../objects/symmetry_object";
import {
    createLine,
    two_points_line_object,
} from "../objects/two_points_line_object";
import { createVector } from "../objects/vector_object";
import type { Vec2, Vec3 } from "../vec";
import {
    blocklySource,
    evaluateFormula,
    formulaIdentifiers,
    globalName,
    NO_VIEW,
    parseFormula,
    parseProgram,
    programNodes,
    programReferences,
    programTargets,
    realPart,
    type FormulaNode,
    type FormulaValue,
    type Program,
    type ScriptValue,
    withObjects,
} from "./dgp_formula";
import {
    expressionContent,
    parseVectorLiteral,
    STYLE_NUMBER,
    type ExpressionContent,
} from "./dgp_expression";
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
    | "image"
    | "button"
    | "polyhedron";
type ParameterKind =
    | "string"
    | "number"
    | "boolean"
    | "object"
    | "point"
    | "pointOn"
    | "line"
    | "circle"
    | "quadric"
    | "intersectable"
    | "pointSupport"
    | "coordinate"
    // PointOn's parameter: a plain number for a line/circle support, a
    // [number, number] pair for a polygon/quadric support, or three numbers
    // for a sphere/cylinder/cone.
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
    result?:
        | ObjectKind
        | ((
              args: DgpValue[],
              variables: Map<string, ObjectKind>,
          ) => ObjectKind);
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
const quadric: Parameter = { kind: "quadric" };
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
// A point's "sp" style: DGPad's shape index (0:circle, 1:cross, 2:diamond,
// 3:square), see PointObject.setShape in the reference implementation.
const POINT_SHAPES = ["circle", "cross", "diamond", "rect"];
// A point's "mg" style: the objects it magnetizes to while dragged, each
// with its own snap radius (in screen pixels), e.g.
// "[S2,5000],[C1,20]".
const MAGNET_LIST =
    /^\[[A-Za-z_$][\w$]*,\d+(?:\.\d+)?\](?:,\[[A-Za-z_$][\w$]*,\d+(?:\.\d+)?\])*$/;
// An "an" style: an animation's speed, direction and back and forth, e.g.
// "[200,1,true]".
const ANIMATION = /^\[(\d+(?:\.\d+)?(?:e[+-]?\d+)?),(-?1),(true|false)\]$/;

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

// "M.coords3D()" (a Point mirroring another point's own 3D position): in
// this project's 3D-aware point-formula evaluation (see Point's execute),
// a bare point identifier already resolves to its full 3D coordinates, so
// the ".coords3D()" suffix is a no-op and can just be stripped.
const COORDS3D_MIRROR = /^([A-Za-z_$][\w$]*)\.coords3D\(\)$/;
function stripCoords3DSuffix(value: string): string {
    return COORDS3D_MIRROR.exec(value)?.[1] ?? value;
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

// The objects a formula reads by name: those with a value (see
// construction_object.scriptValue), and conics for their center (see
// scriptCenter).
const READABLE: ReadonlySet<ObjectKind> = new Set([
    "point",
    "pointOn",
    "expression",
    "polygon",
    "line",
    "circle",
    "angle",
    "curve",
    "quadric",
    "list",
]);

// A List's own names (see list_object).
const LIST_NAMES = ["k", "count"];

class UnknownReference extends Error {
    constructor(
        readonly reference: string,
        lineNumber: number,
    ) {
        super(`Unknown DGP reference at line ${lineNumber}`);
    }
}

const GLOBAL_NAME = /GLOBAL_(?:SET|GET|INC)\(\s*\\?(["'])(.*?)\\?\1/g;

// DGPad's Blockly globals the figure's programs name, an Ex each (see
// globalName in dgp_formula.ts), with the values the figure saved
// (BLK_GLOB_SET), undefined for the others.
function figureGlobals(calls: DgpCall[]): Map<string, ScriptValue | null> {
    const globals = new Map<string, ScriptValue | null>();
    calls.forEach((call) => {
        if (isRestrictionsProgram(call)) return;
        call.arguments.forEach((value) => {
            if (value.type !== "literal" || typeof value.value !== "string")
                return;
            for (const [, , name] of value.value.matchAll(GLOBAL_NAME))
                globals.set(name, null);
        });
    });
    const saved = calls.find((call) => call.name === "BLK_GLOB_SET")
        ?.arguments[0];
    let values: unknown = null;
    try {
        values = saved?.type === "literal" && JSON.parse(String(saved.value));
    } catch {
        // Values of a file DGPad didn't write: undefined.
    }
    if (values && typeof values === "object")
        Object.entries(values).forEach(([name, value]) => {
            if (globals.has(name)) globals.set(name, jsonValue(value));
        });
    return globals;
}

// A saved global's value: true and false as DGPad's programs read them.
function jsonValue(value: unknown): ScriptValue | null {
    if (typeof value === "number" || typeof value === "string") return value;
    if (typeof value === "boolean") return +value;
    if (!Array.isArray(value)) return null;
    const items = value.map(jsonValue);
    return items.includes(null) ? null : (items as ScriptValue[]);
}

// The points an Expression's turtles start from.
function turtleStarts(call: DgpCall): string[] {
    const source = call.arguments[4];
    const program =
        call.name === "Expression" && source?.type === "literal"
            ? tryParseProgram(String(source.value))
            : null;
    return program
        ? programNodes(program).flatMap((node) =>
              node.kind === "turtle" &&
              node.fn === "TURTLE_INIT" &&
              node.args[1].kind === "identifier"
                  ? [node.args[1].name]
                  : [],
          )
        : [];
}

function validateReferences(
    names: Iterable<string>,
    variables: Map<string, ObjectKind>,
    lineNumber: number,
    free: string[] = [],
): void {
    for (const name of names) {
        const kind = variables.get(name);
        if (!free.includes(name) && !(kind && READABLE.has(kind)))
            throw new UnknownReference(name, lineNumber);
    }
}

// DGPad's programs of a point's gestures.
const GESTURES: Record<string, Gesture> = {
    ondrag: "drag",
    onmousedown: "down",
    onmouseup: "up",
};

function formulaRefs(
    names: Iterable<string>,
    variables: Map<string, construction_object>,
    free: string[] = [],
): Map<string, construction_object> {
    return new Map(
        [...names]
            .filter((name) => !free.includes(name))
            .map((name) => [name, variables.get(name)!]),
    );
}

// The objects a program styles or sets that the figure has: styling one it
// lacks (a typo of its author, or one DGPad deleted) changes nothing.
function programTargetRefs(
    program: Program,
    variables: Map<string, construction_object>,
): Map<string, construction_object> {
    return new Map(
        [...programTargets(program)].flatMap((name) => {
            const target = variables.get(name);
            return target ? [[name, target]] : [];
        }),
    );
}

// A program reads the figure's objects, and styles any of them.
function validateProgramReferences(
    program: Program,
    variables: Map<string, ObjectKind>,
    lineNumber: number,
): void {
    validateReferences(programReferences(program), variables, lineNumber);
    // The objects it styles aren't checked: one declared later (the List
    // drawing it) already has its style, and styling one the figure lacks
    // (a typo of its author) changes nothing.
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
        if (grid.restrict(node.fn === "restrictTheta" ? "THETA" : "PHI", range))
            context.projectionChanged = true;
    });
}

function parsePointFormula(value: string, lineNumber: number): Program {
    try {
        return parseProgram(value);
    } catch {
        throw new Error(
            `Unsupported DGP point expression at line ${lineNumber}`,
        );
    }
}

function parseAngleFormula(value: string, lineNumber: number): FormulaNode {
    try {
        return parseFormula(value);
    } catch {
        throw new Error(`Invalid DGP fixed angle at line ${lineNumber}`);
    }
}

function parseRadiusFormula(value: string, lineNumber: number): FormulaNode {
    try {
        return parseFormula(value);
    } catch {
        throw new Error(`Invalid DGP circle radius at line ${lineNumber}`);
    }
}

// A circle's radius or a conic's semi-axis: a number, or a formula.
function validateRadius(
    arg: DgpValue,
    lineNumber: number,
    variables: Map<string, ObjectKind>,
): void {
    if (arg.type !== "literal" || typeof arg.value !== "string") return;
    validateReferences(
        formulaIdentifiers(parseRadiusFormula(arg.value, lineNumber)),
        variables,
        lineNumber,
    );
}

function radiusArgument(
    arg: RuntimeValue,
    context: CommandContext,
): circle1_radius {
    if (typeof arg !== "string") return arg as number;
    const node = parseFormula(arg);
    return {
        formula: node,
        refs: formulaRefs(formulaIdentifiers(node), context.variables),
    };
}

// The image of a point, or of an object (see transformed_object.ts), by
// the map making a point's.
function image(
    c: construction,
    name: string,
    source: point_object | transformable,
    map: (name: string | null, point: point_object) => point_object,
): construction_object {
    return source instanceof point_object
        ? c.add(map(name, source))
        : createTransformed(c, name, source, (point) => map(null, point));
}

// Of the kind of the object it maps, the `at`-th argument.
const imageKind =
    (at: number) =>
    (args: DgpValue[], variables: Map<string, ObjectKind>): ObjectKind => {
        const kind = variables.get((args[at] as { name: string }).name)!;
        return kind === "pointOn" ? "point" : kind;
    };

const polyhedronOn = (
    tag: "Prsm" | "Pyr" | "PrsH" | "PyrH",
    second: Parameter,
): CommandDefinition => ({
    parameters: [string, object, second],
    result: "polyhedron",
    validate:
        second === formula
            ? (args, lineNumber, variables) =>
                  validateRadius(args[2], lineNumber, variables)
            : undefined,
    execute: (context, args) => {
        const base = args[1] as polygon_object;
        return createPolyhedron(
            context.construction,
            args[0] as string,
            tag === "PrsH" || tag === "PyrH"
                ? { tag, base, height: radiusArgument(args[2], context) }
                : { tag, base, point: args[2] as point_object },
        );
    },
});

// Of foci F and G, through a point or of a semi-major axis.
const focalConic = (
    hyperbola: boolean,
    third: Parameter,
): CommandDefinition => ({
    parameters: [string, point, point, third],
    result: "quadric",
    validate:
        third === formula
            ? (args, lineNumber, variables) =>
                  validateRadius(args[3], lineNumber, variables)
            : undefined,
    execute: (context, args) =>
        createFocalConic(
            context.construction,
            args[0] as string,
            hyperbola,
            args[1] as point_object,
            args[2] as point_object,
            third === point
                ? (args[3] as point_object)
                : radiusArgument(args[3], context),
        ),
});

// Of center M, from A to the ray [MB); in space, the arc of the angle AMB.
const centerArc = (sector: boolean, space = false): CommandDefinition => ({
    parameters: [string, point, point, point, { ...boolean, optional: true }],
    result: "circle",
    execute: (context, args) =>
        createCenterArc(
            context.construction,
            args[0] as string,
            args[1] as point_object,
            args[2] as point_object,
            args[3] as point_object,
            sector,
            args[4] === true,
            space,
        ),
});

// Of a circle or a conic, from P to Q counterclockwise.
const arcOn = (support: Parameter, sector: boolean): CommandDefinition => ({
    parameters: [string, support, point, point],
    result: support === circle ? "circle" : "quadric",
    execute: (context, args) =>
        createConicArc(
            context.construction,
            args[0] as string,
            args[1] as primitive_circle_object | primitive_quadric_object,
            args[2] as point_object,
            args[3] as point_object,
            sector,
        ),
});

// Of an equation, its two sides each a formula in x and y, or in x, y and
// z for a plane.
const equationCommand = (
    result: ObjectKind,
    create: (
        c: construction,
        name: string,
        equation: Equation,
    ) => construction_object,
    variables = ["x", "y"],
): CommandDefinition => ({
    parameters: [string, string, string],
    result,
    validate: (args, lineNumber, names) =>
        args.slice(1).forEach((arg) => {
            const node = tryParseFormula(literalString(arg));
            if (!node)
                throw new Error(`Invalid DGP equation at line ${lineNumber}`);
            validateReferences(
                functionReferences(node, variables),
                names,
                lineNumber,
            );
        }),
    execute: (context, args) =>
        create(
            context.construction,
            args[0] as string,
            args.slice(1).map((source) => {
                const node = parseFormula(source as string);
                return {
                    node,
                    source: source as string,
                    variables,
                    refs: formulaRefs(
                        functionReferences(node, variables),
                        context.variables,
                    ),
                    vec3: variables.length === 3,
                };
            }) as Equation,
        ),
});

function parseListFormula(
    value: string,
    lineNumber: number,
    variables?: string[],
): FormulaNode {
    try {
        return parseFormula(value, variables);
    } catch {
        throw new Error(`Invalid DGP list formula at line ${lineNumber}`);
    }
}

// A Sequence's loops and formulas, from their JSON texts, and the names
// they read that its variables don't stand for.
function sequenceParts(
    loopsText: string,
    formulasText: string,
    lineNumber: number,
): { loops: SequenceLoop[]; formulas: FormulaNode[]; names: string[] } {
    const invalid = () =>
        new Error(`Invalid DGP sequence at line ${lineNumber}`);
    let loops: unknown;
    let sources: unknown;
    try {
        loops = JSON.parse(loopsText);
        sources = JSON.parse(formulasText);
    } catch {
        throw invalid();
    }
    if (!Array.isArray(loops) || !loops.length || !Array.isArray(sources))
        throw invalid();
    const variables: string[] = [];
    const names: string[] = [];
    const read = (source: unknown): FormulaNode => {
        if (typeof source !== "string") throw invalid();
        const node = parseListFormula(source, lineNumber, variables);
        formulaIdentifiers(node).forEach((name) => {
            if (!variables.includes(name)) names.push(name);
        });
        return node;
    };
    const parsed = loops.map((loop: unknown) => {
        if (!Array.isArray(loop) || loop.length < 3 || loop.length > 4)
            throw invalid();
        const [variable, from, to, step] = loop as unknown[];
        if (
            typeof variable !== "string" ||
            !SEQUENCE_VARIABLE.test(variable) ||
            variables.includes(variable)
        )
            throw invalid();
        const bounds = {
            variable,
            from: read(from),
            to: read(to),
            step: step === undefined ? null : read(step),
        };
        variables.push(variable);
        return bounds;
    });
    return { loops: parsed, formulas: sources.map(read), names };
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

// DGPad's Text: its color, possibly with an opacity, its frame's width
// and radius, and its numbers' precision.
const PANEL_COLOR =
    /^(?:rgba?\(\s*(\d+\s*,\s*\d+\s*,\s*\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?\)|#[\da-f]{3}|#[\da-f]{6})$/i;
const PANEL_BORDER = 3;
const PANEL_RADIUS = 5;

function validatePanelStyle(value: string, lineNumber: number): void {
    properties(value).forEach((propertyValue, property) => {
        if (property === "c" && !PANEL_COLOR.test(propertyValue))
            throw new Error(`Invalid DGP text color at line ${lineNumber}`);
        if (["s", "r", "p"].includes(property))
            validateNumber(propertyValue, lineNumber, 0);
    });
}

function validateImage(args: DgpValue[], lineNumber: number): void {
    if (
        !IMAGE_URL.test(literalString(args[1])) ||
        [args[2], args[3]].some(
            (size) => !((size as { value: number }).value > 0),
        )
    )
        throw new Error(`Invalid DGP image at line ${lineNumber}`);
}

// DGPad's dash pattern, whatever the stroke width.
const DGPAD_DASH = [6, 10];

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

const NUMBER = STYLE_NUMBER.source.slice(1, -1);
// DGPad's "ar" style of a List: "[8,3]".
const STYLE_PAIR = new RegExp(`^\\[${NUMBER},${NUMBER}\\]$`);

function validateObjectStyle(
    value: string,
    lineNumber: number,
    variables: Map<string, ObjectKind>,
): void {
    properties(value).forEach((propertyValue, property) => {
        switch (property) {
            case "c":
            case "fc":
            case "bg":
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
            case "lo":
                validateNumber(propertyValue, lineNumber, 0, 1);
                break;
            case "s":
            case "iB":
            case "pb":
                validateNumber(propertyValue, lineNumber, 0);
                break;
            case "sn":
            case "lb":
            case "ho":
            case "sb":
            case "tk":
            case "tp":
            case "bf":
            case "fl":
            case "pl":
            case "su":
            case "fx":
            case "nmi":
            case "cV":
            case "cN":
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
            case "ld":
                propertyValue
                    .split(",")
                    .forEach((length) => validateNumber(length, lineNumber, 0));
                if (!isDash(propertyValue.split(",").map(Number)))
                    throw new Error(`Invalid DGP style at line ${lineNumber}`);
                break;
            case "cL":
                validateNumber(propertyValue, lineNumber, 0);
                break;
            case "sg":
            case "l":
                validateNumber(propertyValue, lineNumber, -Infinity);
                break;
            case "ar":
                if (!STYLE_PAIR.test(propertyValue))
                    throw new Error(`Invalid DGP style at line ${lineNumber}`);
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
            case "rgb":
                if (variables.get(propertyValue) !== "expression")
                    throw new Error(
                        `Unknown DGP reference at line ${lineNumber}`,
                    );
                break;
            case "an":
                if (!ANIMATION.test(propertyValue))
                    throw new Error(`Invalid DGP style at line ${lineNumber}`);
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

const DGPAD_KNOB_COLOR = "#780013";

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
    ["color", "gridColor"].forEach((name) => {
        const color = style.get(name);
        if (color !== undefined) validateColor(color, lineNumber);
    });
    [
        "axisWidth",
        "tickDistanceX",
        "tickDistanceY",
        "gridDistanceX",
        "gridDistanceY",
        "gridSubdivisions",
    ].forEach((name) => {
        const value = style.get(name);
        if (value !== undefined) validateNumber(value, lineNumber, 0);
    });
    ["tickStyleX", "tickStyleY"].forEach((name) => {
        const value = style.get(name);
        if (value !== undefined && !/^[012]$/.test(value))
            throw new Error(`Invalid DGP style at line ${lineNumber}`);
    });
    const subdivisions = style.get("gridSubdivisions");
    if (subdivisions !== undefined && !Number.isInteger(Number(subdivisions)))
        throw new Error(`Invalid DGP style at line ${lineNumber}`);
    const dash = style.get("gridDash");
    if (dash !== undefined) {
        dash.split(",").forEach((length) =>
            validateNumber(length, lineNumber, 0),
        );
        if (!isDash(dash.split(",").map(Number)))
            throw new Error(`Invalid DGP style at line ${lineNumber}`);
    }
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
            // DocGeo's fill, after "c".
            case "fc":
                target.fill_color = extractColor(propertyValue);
                break;
            case "h":
                target.hidden = Number(propertyValue);
                break;
            case "o":
                target.opacity = Number(propertyValue);
                break;
            case "lo":
                target.strokeOpacity = Number(propertyValue);
                break;
            case "s":
                target.size = Number(propertyValue);
                break;
            // DGPad writes only a point's name.
            case "sn":
                if (target instanceof point_object)
                    target.showName = propertyValue === "true";
                break;
            // DocGeo's, for GeoGebra's names of the other objects.
            case "lb":
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
            case "fx":
                if (target instanceof polygon_object)
                    target.fixed = propertyValue === "true";
                break;
            case "nmi":
                target.inert = propertyValue === "true";
                break;
            case "tk":
                if (target instanceof point_object)
                    target.trace = propertyValue === "true";
                break;
            case "tp":
                if (target instanceof point_object)
                    target.traceDots = propertyValue === "true";
                break;
            // GeoGebra's empty point, its ring.
            case "ho":
                if (target instanceof point_object)
                    target.hollow = propertyValue === "true";
                break;
            case "pb":
                if (target instanceof point_object)
                    target.border = Number(propertyValue);
                break;
            // GeoGebra's caption, URI-encoded.
            case "cp":
                target.caption = decodeURIComponent(propertyValue);
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
                if (
                    target instanceof point_object ||
                    target instanceof list_object
                )
                    target.shape = POINT_SHAPES[Number(propertyValue)];
                break;
            case "p":
                target.precision = Number(propertyValue);
                break;
            // Truncated, as by DGPad.
            case "l":
                target.level = parseInt(propertyValue);
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
            case "ar":
                if (target instanceof expression_list_object)
                    target.arrow = listArrow(
                        propertyValue.slice(1, -1).split(",").map(Number),
                    );
                break;
            case "cV":
                if (target instanceof expression_object)
                    target.vertical = propertyValue === "true";
                break;
            case "cN":
                if (target instanceof expression_object)
                    target.unlabeled = propertyValue === "true";
                break;
            case "cB":
                if (target instanceof expression_object)
                    target.checkbox = propertyValue === "true";
                break;
            case "iB":
                if (target instanceof expression_object)
                    target.inputLength = Number(propertyValue);
                break;
            case "tx":
                if (target instanceof expression_object)
                    target.latex = propertyValue === "true";
                break;
            case "bf":
                if (
                    target instanceof expression_object ||
                    target instanceof text_object
                )
                    target.bold = propertyValue === "true";
                break;
            case "bg":
                if (
                    target instanceof expression_object ||
                    target instanceof text_object
                )
                    target.background = propertyValue;
                break;
            case "dh":
                target.dash = propertyValue === "true" ? DGPAD_DASH : [];
                break;
            case "ld":
                target.dash = propertyValue.split(",").map(Number);
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
            case "rgb":
                target.dynamicColor = context.variables.get(
                    propertyValue,
                ) as expression_object;
                target.addParents(target.dynamicColor);
                break;
            case "an":
                if (
                    target instanceof point_on_object ||
                    target instanceof expression_object
                ) {
                    const [, speed, direction, ar] =
                        ANIMATION.exec(propertyValue)!;
                    context.construction.animations.add(target, {
                        speed: Number(speed),
                        direction: Number(direction),
                        ar: ar === "true",
                    });
                }
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
    if (color !== undefined) grid.stroke_color = extractColor(color);
    size("fontSize", (value) => (grid.fontSize = value));
    size("axisWidth", (value) => (grid.size = value));
    size("gridWidth", (value) => (grid.gridWidth = value));
    // DocGeo's, for GeoGebra's grid.
    size(
        "gridDistanceX",
        (value) => (grid.gridDistances = [value, grid.gridDistances[1]]),
    );
    size(
        "gridDistanceY",
        (value) => (grid.gridDistances = [grid.gridDistances[0], value]),
    );
    size("gridSubdivisions", (value) => (grid.gridSubdivisions = value));
    const gridColor = style.get("gridColor");
    if (gridColor !== undefined) grid.gridColor = extractColor(gridColor);
    const gridDash = style.get("gridDash");
    if (gridDash !== undefined) grid.gridDash = gridDash.split(",").map(Number);
    // DocGeo's, for GeoGebra's graduations.
    size(
        "tickDistanceX",
        (value) => (grid.tickDistances = [value, grid.tickDistances[1]]),
    );
    size(
        "tickDistanceY",
        (value) => (grid.tickDistances = [grid.tickDistances[0], value]),
    );
    size(
        "tickStyleX",
        (value) => (grid.tickStyles = [value, grid.tickStyles[1]]),
    );
    size(
        "tickStyleY",
        (value) => (grid.tickStyles = [grid.tickStyles[0], value]),
    );
    flag("boldNumbers", (value) => (grid.boldNumbers = value));
    flag("geogebraAxes", (value) => (grid.geogebraAxes = value));
    // DocGeo's, for GeoGebra's axes, their texts URI-encoded.
    (["X", "Y"] as const).forEach((name, axis) => {
        const text = (key: string, texts: [string, string]) => {
            const value = style.get(key + name);
            if (value !== undefined) texts[axis] = decodeURIComponent(value);
        };
        text("axisLabel", grid.axisLabels);
        text("axisUnit", grid.axisUnits);
        flag("numbers" + name, (value) => (grid.showNumbers[axis] = value));
    });
    size("arrows", (value) => (grid.arrows = value));
    context.gridChanged = true;
}

function normalizeAngle(angle: number, [low, high]: Vec2): number {
    const turn = 2 * Math.PI;
    const wrapped = low + ((((angle - low) % turn) + turn) % turn);
    return Math.min(wrapped, high);
}

function applyGeneralStyle(c: construction, value: string): void {
    const property = properties(value).get("background-color");
    if (property === undefined) return;
    const background = extractColor(property);
    c.prefs.background.color = background;
    c.svg.stl("background", background);
}

function validateExpression(
    args: DgpValue[],
    lineNumber: number,
    variables: Map<string, ObjectKind>,
): void {
    [args[2], args[3]].forEach((value) => {
        const source = literalString(value);
        if (source === "" || evaluateConstantFormula(source) !== null) return;
        const node = tryParseFormula(source);
        if (!node)
            throw new Error(
                `Invalid DGP expression bound at line ${lineNumber}`,
            );
        validateReferences(formulaIdentifiers(node), variables, lineNumber);
    });
    let content: ExpressionContent;
    try {
        content = expressionContent(literalString(args[4]), variables);
    } catch {
        throw new Error(`Unsupported DGP expression at line ${lineNumber}`);
    }
    if (content.kind === "v") return;
    if (content.kind === "f")
        validateReferences(
            functionReferences(content.node, content.variables),
            variables,
            lineNumber,
        );
    else validateProgramReferences(content.program, variables, lineNumber);
}

function executeExpression(
    context: CommandContext,
    args: RuntimeValue[],
    screen: Vec2,
): expression_object {
    const min = args[2] as string;
    const max = args[3] as string;
    const source = args[4] as string;
    const content = expressionContent(source, context.variables);
    let formula: ExpressionFormula | null = null;
    let program: ExpressionProgram | null = null;
    if (content.kind === "f") {
        const { node, variables } = content;
        formula = {
            node,
            variables,
            source,
            refs: formulaRefs(
                functionReferences(node, variables),
                context.variables,
            ),
            vec3: context.is3D,
        };
    } else if (content.kind === "s") {
        const parsed = content.program;
        program = {
            program: parsed,
            refs: formulaRefs(programReferences(parsed), context.variables),
            targets: programTargetRefs(parsed, context.variables),
            vec3: context.is3D,
        };
        applyViewRestrictions(context, parsed);
    }
    const bound = (source: string) =>
        source === "" ? null : evaluateConstantFormula(source);
    let bounds: SliderBounds | null = null;
    if (
        min !== "" &&
        max !== "" &&
        (bound(min) === null || bound(max) === null)
    ) {
        const [minNode, maxNode] = [parseFormula(min), parseFormula(max)];
        bounds = {
            min: minNode,
            max: maxNode,
            refs: formulaRefs(
                [
                    ...formulaIdentifiers(minNode),
                    ...formulaIdentifiers(maxNode),
                ],
                context.variables,
            ),
        };
    }
    const expression = createExpression(
        context.construction,
        args[0] as string,
        args[1] as string,
        content.kind === "v" ? content.value : null,
        bound(min),
        bound(max),
        screen,
        formula,
        program,
        bounds,
    );
    expression.cursorColor = DGPAD_KNOB_COLOR;
    return expression;
}

// DGPad's axes, lines through the origin that a figure builds on but that
// are never drawn: the line through two fixed points, all super-hidden.
function axis(direction: Vec3): CommandDefinition {
    return {
        parameters: [string],
        result: "line",
        execute: (context, args) => {
            const c = context.construction;
            const name = args[0] as string;
            // A DGPad 3D figure's axes are 2D ones (see GRID.FRAME2D).
            const [origin, unit] = [[0, 0, 0] as Vec3, direction].map(
                (coords, index) => {
                    const pointName = `${name}.${index ? "I" : "O"}`;
                    return c.GRID.FRAME2D
                        ? createFormulaPoint(
                              c,
                              pointName,
                              parseProgram(`[${coords[0]},${coords[1]}]`),
                              new Map(),
                              true,
                          )
                        : createFixedPoint(c, pointName, coords);
                },
            );
            const line = createLine(c, name, origin, unit);
            [origin, unit, line].forEach((object) => (object.hidden = 2));
            return line;
        },
    };
}

const COMMANDS = new Map<string, CommandDefinition>([
    [
        "SetCoords",
        {
            // Early figures give neither the 3D flag nor the window size.
            parameters: [
                number,
                number,
                number,
                { ...boolean, optional: true },
                { ...number, optional: true },
                { ...number, optional: true },
                // DocGeo's: a 2D view's own unit along y (GeoGebra's).
                { ...number, optional: true },
            ],
            validate: (args, lineNumber) => {
                const unit = (args[2] as { value: number }).value;
                const yUnit = (args[6] as { value: number } | undefined)?.value;
                if (unit <= 0 || (yUnit !== undefined && yUnit <= 0))
                    throw new Error(`Invalid DGP unit at line ${lineNumber}`);
            },
            execute: (context, args) => {
                const unit = args[2] as number;
                const grid = context.construction.GRID;
                context.is3D = (args[3] as boolean | undefined) ?? false;
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
                    // Until the figure's origin point gives its place (see
                    // Point), at the viewport's center: the first two
                    // numbers aren't a position here.
                    grid.ORG = [
                        context.construction.width / 2,
                        context.construction.height / 2,
                    ];
                    grid.FRAME2D = [0, 0];
                } else {
                    grid.ORG = context.labelOrigin;
                }
                grid.UNIT = [
                    unit,
                    (args[6] as number | undefined) ?? unit,
                    unit,
                ];
                if (args[4] && args[5])
                    context.construction.savedSize = [
                        args[4] as number,
                        args[5] as number,
                    ];
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
                validateReferences(
                    programReferences(parsePointFormula(source, lineNumber)),
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
                    if (
                        vector &&
                        !(
                            context.construction.GRID.FRAME2D &&
                            vector.length === 2
                        )
                    ) {
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
                    const formula = parseProgram(source);
                    const refs = formulaRefs(
                        programReferences(formula),
                        context.variables,
                    );
                    return createFormulaPoint(
                        context.construction,
                        name,
                        formula,
                        refs,
                        context.is3D,
                    );
                }
                const grid = context.construction.GRID;
                if (context.is3D && !context.origin3DAssigned) {
                    context.origin3DAssigned = true;
                    grid.FRAME2D = [second as number, args[2] as number];
                    // As in DGPad, the origin is where it was in the
                    // window, like the plane coordinates' one and the
                    // Expressions (see labelOrigin).
                    grid.ORG = [
                        context.labelOrigin[0] +
                            (second as number) * grid.UNIT[0],
                        context.labelOrigin[1] -
                            (args[2] as number) * grid.UNIT[1],
                    ];
                    return createFixedPoint(
                        context.construction,
                        name,
                        [0, 0, 0],
                    );
                }
                const point = createPoint(context.construction, name, [
                    second as number,
                    args[2] as number,
                    (args[3] as number | undefined) ?? 0,
                ]);
                if (grid.FRAME2D) point.pin();
                return point;
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
                const length =
                    args[2].type === "array" ? args[2].items.length : 1;
                const kind = variables.get(support.name);
                if (
                    kind !== "list" &&
                    length !==
                        (kind === "sphere"
                            ? 3
                            : kind === "polygon" || kind === "quadric"
                              ? 2
                              : 1)
                )
                    throw new Error(
                        `Invalid PointOn parameter at line ${lineNumber}`,
                    );
            },
            execute: (context, args) => {
                const support = args[1] as point_support_object;
                // On a List, DGPad's [item, fraction to the next one].
                if (support instanceof list_object && Array.isArray(args[2]))
                    return createPointOn(
                        context.construction,
                        args[0] as string,
                        support,
                        (args[2][0] as number) + (args[2][1] as number),
                    );
                // On a line built from a point and a direction
                // (Perpendicular, Parallel…), DGPad stores the distance
                // from that point in pixels, its own internal unit.
                const alpha =
                    support instanceof primitive_line_object &&
                    !(support instanceof two_points_line_object)
                        ? (args[2] as number) /
                          context.construction.GRID.UNIT[0]
                        : (args[2] as
                              | number
                              | readonly [number, number]
                              | readonly [number, number, number]);
                const point = createPointOn(
                    context.construction,
                    args[0] as string,
                    support,
                    alpha,
                );
                if (support instanceof circle3pts_object && support.space)
                    point.dgpadSample = alpha as number;
                return point;
            },
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
        "Envelope",
        {
            parameters: [string, line, pointOn],
            result: "locus",
            execute: (context, args) =>
                createLocus(
                    context.construction,
                    args[0] as string,
                    args[1] as primitive_line_object,
                    args[2] as point_on_object,
                ),
        },
    ],
    ["X_axis", axis([1, 0, 0])],
    ["Y_axis", axis([0, 1, 0])],
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
            validate: (args, lineNumber, variables) => {
                const source = literalString(args[3]);
                if (STYLE_NUMBER.test(source)) return;
                validateReferences(
                    formulaIdentifiers(parseAngleFormula(source, lineNumber)),
                    variables,
                    lineNumber,
                );
            },
            execute: (context, args) => {
                const source = args[3] as string;
                let angle: number | FixedAngleFormula;
                if (STYLE_NUMBER.test(source)) {
                    angle = context.construction.degrees
                        ? Number(source)
                        : (Number(source) * 180) / Math.PI;
                } else {
                    const formula = parseFormula(source);
                    angle = {
                        formula,
                        refs: formulaRefs(
                            formulaIdentifiers(formula),
                            context.variables,
                        ),
                    };
                }
                return createFixedAngle(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                    angle,
                    args[4] as boolean,
                );
            },
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
            validate: (args, lineNumber, variables) =>
                validateRadius(args[2], lineNumber, variables),
            execute: (context, args) =>
                createCircle1(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    radiusArgument(args[2], context),
                    args[3] as primitive_line_object | undefined,
                ),
        },
    ],
    // Not a DGPad command: GeoGebra's Circle(d, P), of axis d through P.
    [
        "AxisCircle",
        {
            parameters: [string, line, point],
            result: "circle",
            execute: (context, args) =>
                createAxisCircle(
                    context.construction,
                    args[0] as string,
                    args[1] as primitive_line_object,
                    args[2] as point_object,
                ),
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
        "Circle3pts3D",
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
                    true,
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
    // Not DGPad commands: GeoGebra's CircleArc, CircleSector and
    // Semicircle, clockwise as images by a reflection.
    // Not a DGPad command: GeoGebra's Tangent through a point, to a circle
    // or a conic (one of two), or to a function's curve.
    [
        "Tangent",
        {
            parameters: [string, point, object, { ...number, optional: true }],
            result: "line",
            execute: (context, args) =>
                createTangent(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as tangent_support,
                    (args[3] as number | undefined) ?? 0,
                ),
        },
    ],
    // Not DGPad commands: GeoGebra's planes, through three points, through
    // a point parallel to a plane, containing a line or orthogonal to it, or
    // of an equation in x, y and z; where two planes, a plane and a sphere or
    // two spheres meet; a line orthogonal to a plane; a plane's section of a
    // polyhedron, by its edges' ends.
    [
        "Plane",
        {
            parameters: [string, point, point, point],
            result: "polygon",
            execute: (context, args) =>
                createPlane(context.construction, args[0] as string, {
                    tag: "Pl",
                    points: args.slice(1) as [
                        point_object,
                        point_object,
                        point_object,
                    ],
                }),
        },
    ],
    [
        "ParallelPlane",
        {
            parameters: [string, point, object],
            result: "polygon",
            execute: (context, args) =>
                createPlane(context.construction, args[0] as string, {
                    tag: "PlP",
                    point: args[1] as point_object,
                    plane: args[2] as plane_object,
                }),
        },
    ],
    ...(
        [
            ["LinePlane", "PlL"],
            ["OrthogonalPlane", "PlO"],
        ] as const
    ).map(([name, tag]): [string, CommandDefinition] => [
        name,
        {
            parameters: [string, point, line],
            result: "polygon",
            execute: (context, args) =>
                createPlane(context.construction, args[0] as string, {
                    tag,
                    point: args[1] as point_object,
                    line: args[2] as primitive_line_object,
                }),
        },
    ]),
    [
        "EquationPlane",
        equationCommand(
            "polygon",
            (c, name, equation) =>
                createPlane(c, name, { tag: "PlE", equation }),
            ["x", "y", "z"],
        ),
    ],
    // Its turns' points, by fours.
    [
        "NetVertex",
        {
            parameters: [string, point, formula, string],
            result: "point",
            validate: (args, lineNumber, variables) => {
                validateRadius(args[2], lineNumber, variables);
                literalString(args[3])
                    .split(",")
                    .filter(Boolean)
                    .forEach((token) => {
                        const name = polygonPointName(token, lineNumber);
                        if (!accepts(variables.get(name)!, "point"))
                            throw new Error(
                                `Unknown DGP reference at line ${lineNumber}`,
                            );
                    });
            },
            execute: (context, args) => {
                const points = (args[3] as string)
                    .split(",")
                    .filter(Boolean)
                    .map(
                        (token) =>
                            context.variables.get(
                                token.slice(1),
                            ) as point_object,
                    );
                return createNetVertex(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    radiusArgument(args[2], context),
                    points.flatMap((_, index) =>
                        index % 4 ? [] : [points.slice(index, index + 4)],
                    ) as net_turn[],
                );
            },
        },
    ],
    [
        "PlaneLine",
        {
            parameters: [string, object, object],
            result: "line",
            execute: (context, args) =>
                createPlaneLine(
                    context.construction,
                    args[0] as string,
                    args.slice(1) as [plane_object, plane_object],
                ),
        },
    ],
    [
        "NormalLine",
        {
            parameters: [string, object, point],
            result: "line",
            execute: (context, args) =>
                createNormalLine(
                    context.construction,
                    args[0] as string,
                    args[1] as plane_object,
                    args[2] as point_object,
                ),
        },
    ],
    [
        "SphereSection",
        {
            parameters: [string, object, object],
            result: "circle",
            execute: (context, args) =>
                createSphereSection(
                    context.construction,
                    args[0] as string,
                    args[1] as sphere_object,
                    args[2] as plane_object | sphere_object,
                ),
        },
    ],
    [
        "PlaneSection",
        {
            parameters: [string, object, string],
            result: "polygon",
            // Its edges' ends in turn, or a polyhedron.
            validate: (args, lineNumber, variables) => {
                const tokens = literalString(args[2]).split(",");
                tokens.forEach((token) => {
                    const kind = variables.get(
                        polygonPointName(token, lineNumber),
                    )!;
                    if (
                        !accepts(kind, "point") &&
                        !(tokens.length === 1 && kind === "polyhedron")
                    )
                        throw new Error(
                            `Unknown DGP reference at line ${lineNumber}`,
                        );
                });
            },
            execute: (context, args) => {
                const ends = (args[2] as string)
                    .split(",")
                    .map((token) => context.variables.get(token.slice(1)));
                return createPlaneSection(
                    context.construction,
                    args[0] as string,
                    args[1] as plane_object,
                    ends.length === 1
                        ? (ends[0] as polyhedron_object)
                        : (ends.flatMap((end, index) =>
                              index % 2 ? [] : [[end, ends[index + 1]]],
                          ) as [point_object, point_object][]),
                );
            },
        },
    ],
    // Not DGPad commands: GeoGebra's Polygon(A, B, n), its vertices,
    // Mirror(P, circle) and TriangleCenter(A, B, C, n).
    [
        "RegularPolygon",
        {
            parameters: [
                string,
                point,
                point,
                formula,
                { ...object, optional: true },
            ],
            result: "polygon",
            validate: (args, lineNumber, variables) =>
                validateRadius(args[3], lineNumber, variables),
            execute: (context, args) =>
                createRegularPolygon(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                    radiusArgument(args[3], context),
                    args[4] as plane_object | undefined,
                ),
        },
    ],
    [
        "Vertex",
        {
            parameters: [
                string,
                object,
                number,
                { ...boolean, optional: true },
            ],
            result: "point",
            execute: (context, args) =>
                createVertex(
                    context.construction,
                    args[0] as string,
                    args[1] as polygon_object | polyhedron_object,
                    args[2] as number,
                    args[3] as boolean | undefined,
                ),
        },
    ],
    // GeoGebra's cube on the square ABCD of plane ABC, on the side of
    // AB × BC, or parallel to a polygon or a plane, on the side of its
    // normal.
    [
        "Cube",
        {
            parameters: [string, point, point, object],
            result: "polyhedron",
            execute: (context, args) => {
                const [name, a, b, third] = args as [
                    string,
                    point_object,
                    point_object,
                    point_object | polygon_object,
                ];
                return createPolyhedron(
                    context.construction,
                    name,
                    third instanceof point_object
                        ? { tag: "Cube", points: [a, b, third] }
                        : {
                              tag: "CubP",
                              points: [a, b],
                              plane: third,
                              side: 1,
                          },
                );
            },
        },
    ],
    // On a polygon, by a point, its apex or its first top vertex, or of a
    // height.
    ["Prism", polyhedronOn("Prsm", point)],
    ["Pyramid", polyhedronOn("Pyr", point)],
    ["PrismHeight", polyhedronOn("PrsH", formula)],
    ["PyramidHeight", polyhedronOn("PyrH", formula)],
    // Of a point or an object, `straight` when a line or a circle through
    // the center is mapped to a line.
    [
        "Inversion",
        {
            parameters: [
                string,
                circle,
                object,
                { ...boolean, optional: true },
            ],
            result: ([, , source, straight], variables) => {
                const kind = variables.get((source as { name: string }).name);
                if (kind === "point" || kind === "pointOn") return "point";
                if (kind === "polygon") return "polygon";
                if (kind !== "line" && kind !== "circle") return "locus";
                return straight?.type === "literal" && straight.value
                    ? "line"
                    : "circle";
            },
            execute: (context, args) =>
                createInversion(
                    context.construction,
                    args[0] as string,
                    args[1] as primitive_circle_object,
                    args[2] as point_object | transformable,
                    args[3] === true,
                ),
        },
    ],
    [
        "TriangleCenter",
        {
            parameters: [string, point, point, point, number],
            result: "point",
            execute: (context, args) =>
                createTriangleCenter(
                    context.construction,
                    args[0] as string,
                    args.slice(1, 4) as point_object[],
                    args[4] as number,
                ),
        },
    ],
    ["CenterArc", centerArc(false)],
    ["CenterSector", centerArc(true)],
    ["SpaceCenterArc", centerArc(false, true)],
    ["SpaceCenterSector", centerArc(true, true)],
    ["ArcOnCircle", arcOn(circle, false)],
    ["SectorOnCircle", arcOn(circle, true)],
    ["ArcOnConic", arcOn(quadric, false)],
    ["SectorOnConic", arcOn(quadric, true)],
    [
        "Semicircle",
        {
            parameters: [string, point, point, { ...object, optional: true }],
            result: "circle",
            execute: (context, args) =>
                createSemicircle(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                    args[3] as polygon_object | undefined,
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
    // Not DGPad commands: GeoGebra's Ellipse, Hyperbola and Parabola.
    ["Ellipse", focalConic(false, point)],
    ["Ellipse1", focalConic(false, formula)],
    ["Hyperbola", focalConic(true, point)],
    ["Hyperbola1", focalConic(true, formula)],
    [
        "Parabola",
        {
            parameters: [string, point, line],
            result: "quadric",
            execute: (context, args) =>
                createParabola(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as primitive_line_object,
                ),
        },
    ],
    // Not DGPad commands: GeoGebra's lines, circles and conics given by an
    // equation.
    ["EquationLine", equationCommand("line", createEquationLine)],
    ["EquationCircle", equationCommand("circle", createEquationCircle)],
    ["EquationConic", equationCommand("quadric", createEquationConic)],
    // Not DGPad commands: GeoGebra's Rotate, Dilate and Translate of a
    // point, around the origin without a center.
    [
        "Rotation",
        {
            parameters: [string, object, formula, { ...point, optional: true }],
            result: imageKind(1),
            validate: (args, lineNumber, variables) =>
                validateRadius(args[2], lineNumber, variables),
            execute: (context, args) => {
                const c = context.construction;
                const center = (args[3] as point_object | undefined) ?? null;
                const angle = radiusArgument(args[2], context);
                return image(
                    c,
                    args[0] as string,
                    args[1] as point_object,
                    (name, p) => new rotation_object(c, name, center, p, angle),
                );
            },
        },
    ],
    [
        "AxisRotation",
        {
            parameters: [
                string,
                object,
                formula,
                line,
                { ...point, optional: true },
            ],
            result: imageKind(1),
            validate: (args, lineNumber, variables) =>
                validateRadius(args[2], lineNumber, variables),
            execute: (context, args) => {
                const c = context.construction;
                const center = (args[4] as point_object | undefined) ?? null;
                const angle = radiusArgument(args[2], context);
                const axis = args[3] as primitive_line_object;
                return image(
                    c,
                    args[0] as string,
                    args[1] as point_object,
                    (name, p) =>
                        new rotation_object(c, name, center, p, angle, axis),
                );
            },
        },
    ],
    [
        "Dilation",
        {
            parameters: [string, object, formula, { ...point, optional: true }],
            result: imageKind(1),
            validate: (args, lineNumber, variables) =>
                validateRadius(args[2], lineNumber, variables),
            execute: (context, args) => {
                const c = context.construction;
                const center = (args[3] as point_object | undefined) ?? null;
                const ratio = radiusArgument(args[2], context);
                return image(
                    c,
                    args[0] as string,
                    args[1] as point_object,
                    (name, p) => new dilation_object(c, name, center, p, ratio),
                );
            },
        },
    ],
    // By a vector or a point's position vector, or by a formula.
    [
        "Translation",
        {
            parameters: [string, object, object],
            result: imageKind(1),
            execute: (context, args) => {
                const c = context.construction;
                const vector = args[2] as translation_vector;
                return image(
                    c,
                    args[0] as string,
                    args[1] as point_object,
                    (name, p) => new translation_object(c, name, vector, p),
                );
            },
        },
    ],
    [
        "Translation1",
        {
            parameters: [string, object, formula],
            result: imageKind(1),
            validate: (args, lineNumber, variables) =>
                validateRadius(args[2], lineNumber, variables),
            execute: (context, args) => {
                const c = context.construction;
                const vector = radiusArgument(
                    args[2],
                    context,
                ) as translation_vector;
                return image(
                    c,
                    args[0] as string,
                    args[1] as point_object,
                    (name, p) => new translation_object(c, name, vector, p),
                );
            },
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
    // Not a DGPad command: GeoGebra's Sphere(A, r).
    [
        "Sphere1",
        {
            parameters: [string, point, formula],
            result: "sphere",
            validate: (args, lineNumber, variables) =>
                validateRadius(args[2], lineNumber, variables),
            execute: (context, args) =>
                createSphere(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    radiusArgument(args[2], context),
                ),
        },
    ],
    // Not DGPad commands: GeoGebra's Intersect(line, solid) for a cylinder,
    // a cone or a sphere.
    [
        "CylinderIntersection",
        {
            parameters: [string, line, object, number],
            result: "point",
            validate: (args, lineNumber) => {
                const order = (args[3] as { value: number }).value;
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
                    args[2] as revolution_object | sphere_object,
                    args[3] as 0 | 1,
                ),
        },
    ],
    // GeoGebra's Cylinder(A, B, r) and Cone(A, B, r), and their disks.
    ...[false, true].map((cone): [string, CommandDefinition] => [
        cone ? "Cone" : "Cylinder",
        {
            parameters: [string, point, point, formula],
            result: "sphere",
            validate: (args, lineNumber, variables) =>
                validateRadius(args[3], lineNumber, variables),
            execute: (context, args) =>
                createRevolution(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                    radiusArgument(args[3], context),
                    cone,
                ),
        },
    ]),
    [
        "Disk",
        {
            parameters: [string, object, boolean],
            result: "circle",
            execute: (context, args) =>
                createDisk(
                    context.construction,
                    args[0] as string,
                    args[1] as revolution_object,
                    args[2] as boolean,
                ),
        },
    ],
    // Not a DGPad command: GeoGebra's IntersectPath(plane, cylinder or cone).
    [
        "CylinderSection",
        {
            parameters: [string, object, object],
            result: "section",
            execute: (context, args) =>
                createCylinderSection(
                    context.construction,
                    args[0] as string,
                    args[1] as revolution_object,
                    args[2] as plane_object,
                ),
        },
    ],
    // Not a DGPad command: GeoGebra's text, anchored at a point shifted by
    // (dx, dy) screen pixels.
    [
        "Text",
        {
            parameters: [
                string,
                number,
                number,
                number,
                number,
                { ...string, optional: true },
            ],
            validate: (args, lineNumber, variables) => {
                const nodes = parsePanel(withoutEvents(literalString(args[0])));
                validateReferences(
                    [...panelFormulas(nodes).values()].flatMap((formula) => [
                        ...formulaIdentifiers(formula),
                    ]),
                    variables,
                    lineNumber,
                );
                panelTargets(nodes).forEach((name) => {
                    if (variables.get(name) !== "expression")
                        throw new Error(
                            `Unknown DGP reference at line ${lineNumber}`,
                        );
                });
                if (args[5])
                    validatePanelStyle(literalString(args[5]), lineNumber);
            },
            execute: (context, args) => {
                const content = withoutEvents(args[0] as string);
                const style = properties((args[5] as string | undefined) ?? "");
                const panel = createPanel(
                    context.construction,
                    null,
                    [
                        args[1] as number,
                        args[2] as number,
                        args[3] as number,
                        args[4] as number,
                    ],
                    Number(style.get("r") ?? PANEL_RADIUS),
                    content,
                    formulaRefs(
                        panelNames(parsePanel(content)),
                        context.variables,
                    ),
                    context.is3D,
                );
                const color = style.get("c");
                if (color) {
                    const [, rgb, alpha] = PANEL_COLOR.exec(color)!;
                    panel.stroke_color = panel.fill_color = rgb
                        ? `rgb(${rgb})`
                        : color;
                    panel.opacity = alpha === undefined ? 1 : Number(alpha);
                }
                panel.size = Number(style.get("s") ?? PANEL_BORDER);
                if (style.has("p")) panel.precision = Number(style.get("p"));
                return panel;
            },
        },
    ],
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
                        validateReferences(
                            formulaIdentifiers(
                                parseListFormula(part, lineNumber),
                            ),
                            variables,
                            lineNumber,
                            LIST_NAMES,
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
                    formulaRefs(
                        (
                            parts.filter(
                                (part) => typeof part !== "string",
                            ) as FormulaNode[]
                        ).flatMap((node) => [...formulaIdentifiers(node)]),
                        context.variables,
                        LIST_NAMES,
                    ),
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
                { ...point, optional: true },
                { ...point, optional: true },
            ],
            result: "image",
            validate: validateImage,
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
    // Not a DGPad command: GeoGebra's image fixed in the window, at the
    // position of its top left corner, in units as an Expression's.
    [
        "ScreenImage",
        {
            parameters: [string, string, number, number, number, number],
            result: "image",
            validate: validateImage,
            execute: (context, args) => {
                const grid = context.construction.GRID;
                const image = createImage(
                    context.construction,
                    args[0] as string,
                    args[1] as string,
                    args[2] as number,
                    args[3] as number,
                    [],
                );
                image.screen = [
                    context.labelOrigin[0] + (args[4] as number) * grid.UNIT[0],
                    context.labelOrigin[1] - (args[5] as number) * grid.UNIT[1],
                ];
                return image;
            },
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
                validateReferences(
                    formulaIdentifiers(
                        parseListFormula(literalString(args[2]), lineNumber),
                    ),
                    variables,
                    lineNumber,
                    LIST_NAMES,
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
                    formulaRefs(
                        formulaIdentifiers(levels),
                        context.variables,
                        LIST_NAMES,
                    ),
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
    // Not a DGPad command: GeoGebra's Intersect(line, plane), the plane
    // being given by three of its points.
    [
        "PlaneIntersection",
        {
            parameters: [string, line, object],
            result: "point",
            execute: (context, args) =>
                createPlaneIntersection(
                    context.construction,
                    args[0] as string,
                    args[1] as primitive_line_object,
                    args[2] as plane_object,
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
                    args[3] as number,
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
            parameters: [string, point, object],
            result: imageKind(2),
            execute: (context, args) => {
                const c = context.construction;
                const center = args[1] as point_object;
                return image(
                    c,
                    args[0] as string,
                    args[2] as point_object,
                    (name, p) => new symmetry_object(c, name, center, p),
                );
            },
        },
    ],
    [
        "Reflection",
        {
            parameters: [string, line, object],
            result: imageKind(2),
            execute: (context, args) => {
                const c = context.construction;
                const axis = args[1] as primitive_line_object;
                return image(
                    c,
                    args[0] as string,
                    args[2] as point_object,
                    (name, p) => new reflection_object(c, name, axis, p),
                );
            },
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
                // A number, or a formula of other objects ("a*c/d").
                [args[1], args[2]].forEach((value) => {
                    const source = literalString(value);
                    if (source === "" || STYLE_NUMBER.test(source)) return;
                    const node = tryParseFormula(source);
                    if (!node)
                        throw new Error(
                            `Invalid DGP curve bound at line ${lineNumber}`,
                        );
                    validateReferences(
                        formulaIdentifiers(node),
                        variables,
                        lineNumber,
                    );
                });
                let formulaNode: FormulaNode;
                try {
                    formulaNode = parseFormula(literalString(args[3]));
                } catch {
                    throw new Error(
                        `Invalid DGP curve formula at line ${lineNumber}`,
                    );
                }
                validateReferences(
                    functionReferences(formulaNode, ["x"]),
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
                    refs: formulaRefs(
                        functionReferences(node, ["x"]),
                        context.variables,
                    ),
                    vec3: context.is3D,
                };
                const bound = (source: string): CurveBound => {
                    if (source === "") return null;
                    if (STYLE_NUMBER.test(source)) return Number(source);
                    const node = parseFormula(source);
                    return {
                        node,
                        source,
                        variables: [],
                        refs: formulaRefs(
                            formulaIdentifiers(node),
                            context.variables,
                        ),
                        vec3: context.is3D,
                    };
                };
                return createCurve(
                    context.construction,
                    args[0] as string,
                    formula,
                    bound(min),
                    bound(max),
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
                    nature !== "label" &&
                    nature !== "polygon" &&
                    nature !== "polygons" &&
                    nature !== "circle"
                )
                    throw new Error(
                        `Invalid DGP list nature at line ${lineNumber}`,
                    );
                const expectedArgs =
                    nature === "point" || nature.startsWith("polygon") ? 4 : 5;
                if (args.length !== expectedArgs)
                    throw new Error(
                        `Invalid List argument count at line ${lineNumber}`,
                    );
                const countFormula = parseListFormula(
                    literalString(args[2]),
                    lineNumber,
                );
                validateReferences(
                    formulaIdentifiers(countFormula),
                    variables,
                    lineNumber,
                    LIST_NAMES,
                );
                const formula1 = parseListFormula(
                    literalString(args[3]),
                    lineNumber,
                );
                validateReferences(
                    formulaIdentifiers(formula1),
                    variables,
                    lineNumber,
                    LIST_NAMES,
                );
                if (expectedArgs === 5) {
                    const formula2 = parseListFormula(
                        literalString(args[4]),
                        lineNumber,
                    );
                    validateReferences(
                        formulaIdentifiers(formula2),
                        variables,
                        lineNumber,
                        LIST_NAMES,
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
                    nature === "point" || nature.startsWith("polygon")
                        ? [formula1]
                        : [formula1, parseFormula(args[4] as string)];
                const refs = formulaRefs(
                    ([countFormula, ...formulas] as FormulaNode[]).flatMap(
                        (node) => [...formulaIdentifiers(node)],
                    ),
                    context.variables,
                    LIST_NAMES,
                );
                return createList(
                    context.construction,
                    name,
                    nature,
                    countFormula,
                    formulas,
                    refs,
                    context.is3D,
                );
            },
        },
    ],
    [
        // Not a DGPad command: GeoGebra's Sequence (see sequence_object),
        // its loops and formulas in JSON.
        "Sequence",
        {
            parameters: [string, string, string, string],
            result: "list",
            validate: (args, lineNumber, variables) => {
                const { formulas, names } = sequenceParts(
                    literalString(args[2]),
                    literalString(args[3]),
                    lineNumber,
                );
                if (!sequenceShape(literalString(args[1]), formulas.length))
                    throw new Error(
                        `Invalid DGP sequence at line ${lineNumber}`,
                    );
                validateReferences(names, variables, lineNumber);
            },
            execute: (context, args) => {
                const { loops, formulas, names } = sequenceParts(
                    args[2] as string,
                    args[3] as string,
                    0,
                );
                return createSequence(
                    context.construction,
                    args[0] as string,
                    args[1] as ListNature,
                    loops,
                    formulas,
                    formulaRefs(names, context.variables),
                    context.is3D,
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
        // Its program, from its BLK (see attachButtonPrograms).
        "BlocklyButton",
        {
            parameters: [
                string,
                string,
                string,
                string,
                { ...string, optional: true },
            ],
            result: "button",
            validate: (args, lineNumber, variables) => {
                if (
                    !STYLE_NUMBER.test(literalString(args[2])) ||
                    !STYLE_NUMBER.test(literalString(args[3]))
                )
                    throw new Error(
                        `Invalid DGP button position at line ${lineNumber}`,
                    );
                if (args.length < 5) return;
                const program = tryParseProgram(literalString(args[4]));
                if (!program)
                    throw new Error(
                        `Unsupported Blockly program at line ${lineNumber}`,
                    );
                validateProgramReferences(program, variables, lineNumber);
            },
            execute: (context, args) => {
                const grid = context.construction.GRID;
                const source = args[4] as string | undefined;
                const program =
                    source === undefined ? null : parseProgram(source);
                return createButton(
                    context.construction,
                    args[0] as string,
                    args[1] as string,
                    [
                        context.labelOrigin[0] + Number(args[2]) * grid.UNIT[0],
                        context.labelOrigin[1] - Number(args[3]) * grid.UNIT[1],
                    ],
                    program && {
                        program,
                        refs: formulaRefs(
                            programReferences(program),
                            context.variables,
                        ),
                        targets: programTargetRefs(program, context.variables),
                        vec3: context.is3D,
                    },
                );
            },
        },
    ],
    [
        "BLK",
        {
            // The source of an object's Blockly editor: an Expression's
            // "oncompute" program is also its formula, run as any script,
            // and a point's turtle ("onlogo") is compiled into the
            // Expression its List draws. An Expression's "onchange" runs
            // when its value changes, a point's "ondrag", "onmousedown" and
            // "onmouseup" at these gestures (see event_object.ts), a text's
            // "onmousedown" (DocGeo's) when it is clicked. The
            // "oninit" of an Expression or a button runs once, as DGPad
            // runs it when it opens the figure. The other programs never
            // run.
            parameters: [object, string],
            validate: (args, lineNumber, variables) => {
                const modes = JSON.parse(literalString(args[1]));
                const owner = args[0];
                const kind =
                    owner.type === "reference"
                        ? variables.get(owner.name)
                        : undefined;
                const point = kind === "point" || kind === "pointOn";
                const events = Object.keys(modes).filter(
                    (mode) =>
                        mode === "onchange" ||
                        mode === "oninit" ||
                        Object.prototype.hasOwnProperty.call(GESTURES, mode),
                );
                if (
                    Object.keys(modes).some(
                        (mode) =>
                            mode !== "oncompute" &&
                            mode !== "onlogo" &&
                            mode !== "current" &&
                            !events.includes(mode),
                    ) ||
                    events.some((mode) =>
                        mode === "onchange"
                            ? kind !== "expression"
                            : mode === "oninit"
                              ? kind !== "expression" && kind !== "button"
                              : !point &&
                                !(mode === "onmousedown" && kind === "text"),
                    )
                )
                    throw new Error(
                        `Unsupported Blockly program at line ${lineNumber}`,
                    );
                events.forEach((mode) => {
                    const program = tryParseProgram(String(modes[mode].sync));
                    if (!program)
                        throw new Error(
                            `Unsupported Blockly program at line ${lineNumber}`,
                        );
                    validateProgramReferences(program, variables, lineNumber);
                });
            },
            execute: (context, args) => {
                const modes = JSON.parse(args[1] as string);
                const owner = args[0] as
                    | expression_object
                    | point_object
                    | button_object
                    | text_object;
                ["onchange", "oninit", ...Object.keys(GESTURES)].forEach(
                    (mode) => {
                        const sync = modes[mode]?.sync;
                        if (typeof sync !== "string") return;
                        const program = parseProgram(sync);
                        const expression: ExpressionProgram = {
                            program,
                            refs: formulaRefs(
                                programReferences(program),
                                context.variables,
                            ),
                            targets: programTargetRefs(
                                program,
                                context.variables,
                            ),
                            vec3: context.is3D,
                        };
                        createEvent(
                            context.construction,
                            `${owner.name}.${mode}`,
                            owner,
                            expression,
                            mode === "oninit"
                                ? "init"
                                : (GESTURES[mode] ?? null),
                        );
                    },
                );
            },
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
                actual === "curve" ||
                actual === "locus")) ||
        (expected === "pointSupport" &&
            (actual === "line" ||
                actual === "circle" ||
                actual === "polygon" ||
                actual === "quadric" ||
                actual === "locus" ||
                actual === "list" ||
                actual === "curve" ||
                actual === "sphere"))
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
            value.items.length < 2 ||
            value.items.length > 3 ||
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
        const { result } = definition;
        variables.set(
            call.variable,
            typeof result === "function"
                ? result(call.arguments, variables)
                : result!,
        );
    }
}

// Formulas, texts and styles name objects inside string literals.
const IDENTIFIERS = /[$_\p{ID_Start}][$_\u200c\u200d\p{ID_Continue}]*/gu;

// A polygon's vertices are prefixed with "_" (see polygonPointName).
function referencedNames(value: DgpValue): string[] {
    if (value.type === "reference") return [value.name];
    if (value.type === "array") return value.items.flatMap(referencedNames);
    return typeof value.value === "string"
        ? (value.value.match(IDENTIFIERS) ?? []).flatMap((name) =>
              name.startsWith("_") ? [name, name.slice(1)] : [name],
          )
        : [];
}

function describeValue(value: DgpValue): string {
    if (value.type === "reference") return value.name;
    if (value.type === "array")
        return `[${value.items.map(describeValue).join(", ")}]`;
    // Scripts and Blockly programs would flood the report.
    if (typeof value.value === "string" && value.value.length > DESCRIBED)
        return JSON.stringify(value.value.slice(0, DESCRIBED) + "…");
    return JSON.stringify(value.value);
}

const DESCRIBED = 60;

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
                  arguments: [
                      ...call.arguments.slice(0, 3),
                      { type: "literal", value: true },
                      ...call.arguments.slice(4),
                  ],
              }
            : call,
    );
}

// DGPad reads a slider's bounds only when it needs them: they may name an
// object the file declares later, which is then moved before the slider,
// with the declarations it names in turn.
function orderSliderBounds(calls: DgpCall[]): DgpCall[] {
    const declarations = new Map(
        calls.flatMap((call) => (call.variable ? [[call.variable, call]] : [])),
    );
    const ordered = new Set<DgpCall>();
    const pending = new Set<DgpCall>();
    const place = (call: DgpCall, names: string[]): void => {
        if (ordered.has(call) || pending.has(call)) return;
        pending.add(call);
        names.forEach((name) => {
            const declaration = declarations.get(name);
            if (declaration)
                place(
                    declaration,
                    declaration.arguments.flatMap(referencedNames),
                );
        });
        ordered.add(call);
    };
    calls.forEach((call) =>
        place(
            call,
            call.name.startsWith("Expression")
                ? call.arguments.slice(2, 4).flatMap(referencedNames)
                : [],
        ),
    );
    return [...ordered];
}

// A BlocklyButton's program is the "onprogram" of its BLK, at the end of
// the file: the button moves there, with its program, which may read any
// object, followed by its style and by its "oninit", left to the BLK.
function attachButtonPrograms(calls: DgpCall[]): DgpCall[] {
    const buttons = new Map(
        calls.flatMap((call) =>
            call.name === "BlocklyButton" && call.variable
                ? [[call.variable, call]]
                : [],
        ),
    );
    const programs = new Map<DgpCall, DgpCall>();
    const inits = new Map<DgpCall, DgpCall[]>();
    calls.forEach((call) => {
        const [target, source] = call.arguments;
        const button =
            call.name === "BLK" && target?.type === "reference"
                ? buttons.get(target.name)
                : undefined;
        if (!button || source?.type !== "literal") return;
        const { oninit, ...modes } = JSON.parse(String(source.value));
        if (
            Object.keys(modes).every(
                (mode) => mode === "onprogram" || mode === "current",
            ) &&
            typeof modes.onprogram?.sync === "string"
        ) {
            programs.set(call, {
                ...button,
                arguments: [
                    ...button.arguments,
                    { type: "literal", value: modes.onprogram.sync },
                ],
            });
            inits.set(
                call,
                oninit
                    ? [
                          {
                              ...call,
                              arguments: [
                                  target,
                                  {
                                      type: "literal",
                                      value: JSON.stringify({ oninit }),
                                  },
                              ],
                          },
                      ]
                    : [],
            );
        }
    });
    const moved = new Set([...programs.values()].map((call) => call.variable));
    const follows = (call: DgpCall, name: string | null) =>
        call.name !== "BlocklyButton" &&
        call.arguments.some(
            (value) => value.type === "reference" && value.name === name,
        );
    return calls.flatMap((call) => {
        const button = programs.get(call);
        if (button)
            return [
                button,
                ...calls.filter(
                    (other) =>
                        other !== call && follows(other, button.variable),
                ),
                ...inits.get(call)!,
            ];
        return moved.has(call.variable) ||
            [...moved].some((name) => follows(call, name))
            ? []
            : [call];
    });
}

// DGPad rebuilds the Expression of a turtle ("onlogo") or an "oncompute"
// from its BLK's source, as it reads the file: the source the Expression
// saved has lost the escaping of its texts' quotes (TURTLE_TEXT('L'arc')).
function compileBlocklyPrograms(calls: DgpCall[]): DgpCall[] {
    const sources = new Map<string, string>();
    calls.forEach((call) => {
        const [target, source] = call.arguments;
        if (
            call.name !== "BLK" ||
            target?.type !== "reference" ||
            source?.type !== "literal"
        )
            return;
        const modes = JSON.parse(String(source.value));
        const logo = blocklySource(modes, "onlogo", target.name);
        if (logo !== null) sources.set(`blk_turtle_exp_${target.name}`, logo);
        const compute = blocklySource(modes, "oncompute", target.name);
        if (compute !== null) sources.set(target.name, compute);
    });
    return calls.map((call) => {
        const source =
            call.name === "Expression"
                ? sources.get(call.variable!)
                : undefined;
        if (source === undefined) return call;
        const args = [...call.arguments];
        args[4] = { type: "literal", value: source };
        return { ...call, arguments: args };
    });
}

// DGPad finds the objects a script styles when it runs: a script styling
// objects the file declares later is moved after them, with the objects
// that read it (e.g. the List drawing a turtle styling a later point).
function orderStyleTargets(calls: DgpCall[]): DgpCall[] {
    const declared = new Map(
        calls.flatMap((call, i) => (call.variable ? [[call.variable, i]] : [])),
    );
    const movedTo = new Map<string, number>();
    const moved = new Map<number, DgpCall[]>();
    const later = new Set<DgpCall>();
    calls.forEach((call, i) => {
        const source = call.arguments[4];
        const program =
            call.name.startsWith("Expression") && source?.type === "literal"
                ? tryParseProgram(String(source.value))
                : null;
        // Not after an object that reads it.
        const last = Math.max(
            ...[...(program ? programTargets(program) : [])].map((name) => {
                const at = declared.get(name) ?? -1;
                return at >= 0 &&
                    calls[at].arguments
                        .flatMap(referencedNames)
                        .includes(call.variable!)
                    ? -1
                    : at;
            }),
            ...call.arguments
                .flatMap(referencedNames)
                .map((name) => movedTo.get(name) ?? -1),
        );
        if (last <= i) return;
        moved.set(last, [...(moved.get(last) ?? []), call]);
        later.add(call);
        if (call.variable) movedTo.set(call.variable, last);
    });
    return calls.flatMap((call, i) => [
        ...(later.has(call) ? [] : [call]),
        ...(moved.get(i) ?? []),
    ]);
}

// The "restrictions" expression, copied from figure to figure, only locks
// DGPad's interface (zoom, drag, control panel…), which DocGeo deliberately
// doesn't reproduce: it is dropped, with its style and blocks, unreported.
// Its program finds itself through this marker.
function isRestrictionsProgram(call: DgpCall): boolean {
    const source = call.arguments[4];
    return (
        call.name === "Expression" &&
        source?.type === "literal" &&
        typeof source.value === "string" &&
        source.value.includes("ceci_est_un_texte_a_chercher_dans_moi_meme")
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
    const named = new Set(calls.flatMap((call) => call.variable ?? []));
    figureGlobals(calls).forEach((_, name) =>
        variables.set(globalName(name), "expression"),
    );
    const valid = calls.filter((call) => {
        // Read with the globals (see figureGlobals).
        if (call.name === "BLK_GLOB_SET") return false;
        if (isRestrictionsProgram(call)) {
            skipped.add(call.variable!);
            return false;
        }
        try {
            validateCall(call, variables);
            return true;
        } catch (error) {
            // A turtle naming an object the figure lacks, as its point
            // DGPad deleted keeping its program, fails there in DGPad and
            // draws nothing.
            const deleted =
                error instanceof UnknownReference &&
                !named.has(error.reference) &&
                turtleStarts(call).length > 0;
            if (
                !deleted &&
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
// A GeoGebra figure says beforehand whether it is in space, a DGPad one in
// its SetCoords.
export function executeDgpCommands(
    c: construction,
    calls: DgpCall[],
    is3D?: boolean,
): { variables: Map<string, construction_object>; unsupported: string[] } {
    return withObjects(
        new Set(calls.flatMap((call) => call.variable ?? [])),
        () => executeCalls(c, calls, is3D),
    );
}

function executeCalls(
    c: construction,
    calls: DgpCall[],
    is3D: boolean | undefined,
): { variables: Map<string, construction_object>; unsupported: string[] } {
    const { valid, unsupported } = validateCalls(
        orderStyleTargets(
            orderSliderBounds(
                attachButtonPrograms(
                    compileBlocklyPrograms(convertLegacyPoint3D(calls)),
                ),
            ),
        ),
    );
    // Before the images, built in the plane or in space (see
    // createTransformed).
    if (is3D === false) c.GRID.is2D = true;
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
        is3D: is3D ?? false,
        origin3DAssigned: is3D ?? false,
        labelOrigin: [0, 0],
    };

    c.beginBatch();
    // First, as the programs read them.
    const names = new Set(calls.flatMap((call) => call.variable ?? []));
    figureGlobals(calls).forEach((value, global) => {
        let name = global;
        for (let n = 1; names.has(name) || c.getObj(name); n++)
            name = `${global}${n}`;
        const expression = createExpression(
            c,
            name,
            "",
            value,
            null,
            null,
            [0, 0],
        );
        expression.global = global;
        expression.hidden = 2;
        context.variables.set(globalName(global), expression);
    });
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
    runInits(c);
    if (context.projectionChanged) c.invalidateProjection();
    return { variables: context.variables, unsupported };
}
