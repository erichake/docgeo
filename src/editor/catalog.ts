import type { DgoRef } from "../objects/construction_object";
import { angle_object } from "../objects/angle_object";
import type { construction_object } from "../objects/construction_object";
import { curve_object } from "../objects/curve_object";
import { expression_object } from "../objects/expression_object";
import { list_object } from "../objects/list_object";
import { locus_object } from "../objects/locus_object";
import { point_on_object } from "../objects/point_on_object";
import { point_object } from "../objects/point_object";
import { polygon_object } from "../objects/polygon_object";
import { primitive_circle_object } from "../objects/primitive_circle_object";
import { primitive_line_object } from "../objects/primitive_line_object";
import { primitive_quadric_object } from "../objects/primitive_quadric_object";
import { segment_object } from "../objects/segment_object";
import { sphere_object } from "../objects/sphere_object";
import { two_points_line_object } from "../objects/two_points_line_object";
import { vector_object } from "../objects/vector_object";
import { polyhedron_object } from "../objects/polyhedron_object";
import { plane_object } from "../objects/plane_object";
import { revolution_object } from "../objects/revolution_object";
import { straightImage } from "../objects/transformed_object";
import { STYLE_NUMBER } from "../import/dgp_expression";
import { TEXTS } from "./messages";
import { formatName } from "./text";

// The commands that build objects, in the text and by gestures: see
// EDITOR.md.

export type Kind =
    | "point"
    | "line"
    | "circle"
    | "conic"
    | "polygon"
    | "plane"
    | "sphere"
    | "curve"
    | "number"
    | "angle"
    | "other";

// What an argument accepts: a number, a number or an expression (real),
// or an object.
export type Param =
    | "number"
    | "real"
    | "expression"
    | "point"
    | "pointOn"
    // What a locus follows: a point, or a line for its envelope.
    | "traced"
    | "line"
    | "segment"
    | "vector"
    | "circle"
    | "polygon"
    // A polygon or a polyhedron.
    | "faceted"
    | "plane"
    // A plane or a polygon.
    | "planar"
    // A line or a plane.
    | "linear"
    | "sphere"
    // What a transformation maps: a point, a line, a circle, a polygon, a
    // conic, a curve, a plane, a sphere or a polyhedron; by an inversion or
    // a macro, none of the last three.
    | "transformable"
    | "invertible"
    | "polyhedron"
    // A cylinder or a cone.
    | "revolution"
    // A sphere, a cylinder, a cone or a polyhedron.
    | "solid"
    // A circle or a conic, and a function's curve.
    | "tangible"
    | "graph"
    | "intersectable"
    // Intersectable, but not a line.
    | "curved"
    | "support"
    // A support whose points take one number, two, or three.
    | "path"
    | "outline"
    // A sphere, a cylinder or a cone.
    | "surface"
    // What a formula reads.
    | "readable"
    // Any object: what a checkbox shows.
    | "any"
    // Written between quotes.
    | "text";

// A number given by a formula, its names designating these objects.
export class FormulaArg {
    constructor(
        readonly source: string,
        readonly refs: ReadonlyMap<string, construction_object>,
    ) {}
}

// A text whose "%formula%" parts show their value, or a panel's HTML, its
// formulas' names designating these objects.
export class TextArg {
    constructor(
        readonly text: string,
        readonly refs: ReadonlyMap<string, construction_object>,
        readonly html = false,
    ) {}
}

export type Arg = construction_object | number | FormulaArg | TextArg;

// The objects the arguments name, those their formulas read included.
export const argObjects = (args: Arg[]): construction_object[] =>
    args.flatMap((arg) =>
        typeof arg === "number"
            ? []
            : arg instanceof FormulaArg || arg instanceof TextArg
              ? [...arg.refs.values()]
              : [arg.reference?.owner ?? arg],
    );

export interface Overload {
    params: Param[];
    // Its last parameter repeats, at least `params.length` arguments.
    variadic?: boolean;
    tag: string;
    // The .dgo parameters, objects being given by their index.
    encode(
        args: Arg[],
        index: (object: construction_object) => DgoRef,
    ): unknown;
    // The arguments of an entry of its tag, null when this overload can't
    // write it.
    decode?(parameters: unknown, at: (index: DgoRef) => Arg): Arg[] | null;
    // The style it gives: 0 takes off, another value is given unless the
    // object it redefines has its own.
    style?: Record<string, number>;
    // The value of an expression it redefines, instead of its own.
    kept?(value: number, args: Arg[]): number;
}

export interface Command {
    name: string;
    reference?: boolean;
    // A function of the formulas, whose overloads build nothing.
    formula?: boolean;
    // The arguments of one, ending with an object, never begin those of
    // another, so that the objects designated tell whether the line goes
    // on: see EDITOR.md.
    overloads: Overload[];
}

export function kindOf(object: construction_object): Kind {
    if (object instanceof point_object) return "point";
    if (object instanceof primitive_line_object) return "line";
    if (object instanceof primitive_circle_object) return "circle";
    if (object instanceof primitive_quadric_object) return "conic";
    if (object instanceof plane_object) return "plane";
    if (object instanceof polygon_object) return "polygon";
    if (object instanceof sphere_object) return "sphere";
    if (
        object instanceof curve_object ||
        object instanceof locus_object ||
        object instanceof list_object
    )
        return "curve";
    if (object instanceof expression_object) return "number";
    if (object instanceof angle_object) return "angle";
    return "other";
}

export function accepts(arg: Arg, param: Param): boolean {
    if (typeof arg === "number") return param === "number" || param === "real";
    if (arg instanceof FormulaArg) return param === "real";
    if (arg instanceof TextArg) return param === "text";
    const kind = kindOf(arg);
    switch (param) {
        case "number":
        case "text":
            return false;
        case "any":
            return true;
        case "real":
        case "expression":
            return kind === "number";
        case "pointOn":
            return arg instanceof point_on_object;
        case "traced":
            return kind === "point" || kind === "line";
        case "segment":
            return arg instanceof segment_object;
        case "vector":
            return arg instanceof vector_object;
        case "tangible":
            return kind === "circle" || kind === "conic";
        case "graph":
            return arg instanceof curve_object;
        case "faceted":
            return kind === "polygon" || arg instanceof polyhedron_object;
        case "planar":
            return arg instanceof polygon_object;
        // In space, a polygon's plane too.
        case "plane":
            return kind === "plane" || (kind === "polygon" && !arg.C.GRID.is2D);
        case "linear":
            return kind === "line" || accepts(arg, "plane");
        case "polyhedron":
            return arg instanceof polyhedron_object;
        case "revolution":
            return arg instanceof revolution_object;
        case "solid":
            return (
                kind === "sphere" ||
                arg instanceof polyhedron_object ||
                arg instanceof revolution_object
            );
        case "intersectable":
            return (
                kind === "line" ||
                kind === "circle" ||
                kind === "conic" ||
                arg instanceof curve_object ||
                arg instanceof locus_object
            );
        case "curved":
            return accepts(arg, "intersectable") && kind !== "line";
        case "support":
            return (
                kind === "line" ||
                kind === "circle" ||
                kind === "conic" ||
                kind === "polygon" ||
                kind === "plane" ||
                kind === "curve" ||
                accepts(arg, "surface")
            );
        case "path":
            return kind === "line" || kind === "circle" || kind === "curve";
        case "outline":
            return (
                arg instanceof polygon_object ||
                arg instanceof primitive_quadric_object
            );
        case "surface":
            return kind === "sphere" || arg instanceof revolution_object;
        case "transformable":
            return (
                accepts(arg, "invertible") ||
                ["plane", "sphere"].includes(kind) ||
                arg instanceof polyhedron_object
            );
        case "invertible":
            return (
                ["point", "line", "circle", "polygon", "conic"].includes(
                    kind,
                ) ||
                arg instanceof curve_object ||
                arg instanceof locus_object
            );
        case "readable":
            return readable(arg);
        default:
            return kind === param;
    }
}

// What the intersection tool takes: a curve, or a surface or a plane a line
// meets.
export const crossable = (object: construction_object): boolean =>
    accepts(object, "intersectable") ||
    accepts(object, "surface") ||
    accepts(object, "plane");

// Whether the editor makes the points where they meet: two curves, or a
// line and a sphere, a cylinder, a cone or a plane.
export const meet = (a: construction_object, b: construction_object) =>
    (accepts(a, "intersectable") && accepts(b, "intersectable")) ||
    (accepts(a, "line") && (accepts(b, "surface") || accepts(b, "plane"))) ||
    ((accepts(a, "surface") || accepts(a, "plane")) && accepts(b, "line"));

// What a formula reads by name (see READABLE in dgp_commands.ts).
export const readable = (object: construction_object): boolean =>
    object instanceof curve_object ||
    (object instanceof list_object && object.nature === "point") ||
    ["point", "line", "circle", "conic", "polygon", "number", "angle"].includes(
        kindOf(object),
    );

const isIndex = (value: unknown): value is DgoRef =>
    (Number.isInteger(value) && (value as number) >= 0) ||
    (Array.isArray(value) &&
        value.length === 3 &&
        ["side", "vertex", "face"].includes(value[0]) &&
        Number.isInteger(value[1]) &&
        value[1] >= 0 &&
        Number.isSafeInteger(value[2]) &&
        value[2] >= 1);

// Objects only, the entry listing them in this order of the arguments.
function objects(tag: string, params: Param[], order?: number[]): Overload {
    const positions = order ?? params.map((_, index) => index);
    return {
        params,
        tag,
        encode: (args, index) =>
            positions.map((position) => index(args[position] as never)),
        decode: (parameters, at) => {
            if (
                !Array.isArray(parameters) ||
                parameters.length !== params.length ||
                !parameters.every(isIndex)
            )
                return null;
            const args: Arg[] = [];
            positions.forEach(
                (position, k) => (args[position] = at(parameters[k])),
            );
            return args;
        },
    };
}

// Of a segment, its ends.
function ofSegment(tag: string): Overload {
    return {
        params: ["segment"],
        tag,
        encode: ([segment], index) => {
            const { P1, P2, reference } = segment as two_points_line_object;
            return reference
                ? [index(segment as construction_object)]
                : [index(P1), index(P2)];
        },
        decode: (parameters, at) =>
            Array.isArray(parameters) &&
            parameters.length === 1 &&
            isIndex(parameters[0])
                ? [at(parameters[0])]
                : null,
    };
}

// An expression, a formula of its name alone.
function realParameter(
    arg: Arg,
    index: (object: construction_object) => DgoRef,
): unknown {
    if (typeof arg === "number") return arg;
    if (!(arg instanceof FormulaArg)) {
        const object = arg as construction_object;
        return [formatName(object.name), { [object.name]: index(object) }];
    }
    const { source, refs } = arg;
    return refs.size
        ? [
              source,
              Object.fromEntries(
                  [...refs].map(([name, object]) => [name, index(object)]),
              ),
          ]
        : source;
}

// A number, also written as a formula, or an object read by name.
function realArgument(parameter: unknown, at: (index: DgoRef) => Arg): Arg {
    if (typeof parameter === "number") return parameter;
    if (typeof parameter === "string")
        return STYLE_NUMBER.test(parameter)
            ? Number(parameter)
            : new FormulaArg(parameter, new Map());
    const [source, refs] = parameter as [string, Record<string, DgoRef>];
    const [name, ...others] = Object.keys(refs);
    return !others.length && source === formatName(name)
        ? at(refs[name])
        : new FormulaArg(
              source,
              new Map(
                  Object.entries(refs).map(([ref, index]) => [
                      ref,
                      at(index) as construction_object,
                  ]),
              ),
          );
}

function textParameter(
    { text, refs }: TextArg,
    index: (object: construction_object) => DgoRef,
): unknown {
    return refs.size
        ? [
              text,
              Object.fromEntries(
                  [...refs].map(([name, object]) => [name, index(object)]),
              ),
          ]
        : text;
}

function textArgument(
    parameter: unknown,
    at: (index: DgoRef) => Arg,
    html = false,
): TextArg {
    const [text, refs = {}] =
        typeof parameter === "string"
            ? [parameter]
            : (parameter as [string, Record<string, DgoRef>]);
    return new TextArg(
        text,
        new Map(
            Object.entries(refs).map(([name, index]) => [
                name,
                at(index) as construction_object,
            ]),
        ),
        html,
    );
}

const isLine = (arg: Arg) =>
    typeof arg !== "number" &&
    !(arg instanceof FormulaArg) &&
    !(arg instanceof TextArg) &&
    kindOf(arg) === "line";

// The intersection of rank n, from 1, not of two lines.
const numbered = (params: Param[]): Overload => ({
    params,
    tag: "Int",
    encode: ([a, b, n], index) => [
        index(a as construction_object),
        index(b as construction_object),
        (n as number) - 1,
    ],
    decode: (parameters, at) => {
        const [a, b, order, away] = parameters as number[];
        return away === undefined ? [at(a), at(b), order + 1] : null;
    },
});

// Objects, then a number.
function withReal(tag: string, params: Param[]): Overload {
    return {
        params: [...params, "real"],
        tag,
        encode: (args, index) => [
            ...args
                .slice(0, -1)
                .map((arg) => index(arg as construction_object)),
            realParameter(args[params.length], index),
        ],
        decode: (parameters, at) => {
            if (
                !Array.isArray(parameters) ||
                parameters.length !== params.length + 1
            )
                return null;
            const objects = parameters.slice(0, -1);
            if (!objects.every(isIndex)) return null;
            return [
                ...objects.map(at),
                realArgument(parameters[params.length], at),
            ];
        },
    };
}

// Objects, then a side, 1 or -1.
const sided = (tag: string, params: Param[]): Overload => ({
    params: [...params, "number"],
    tag,
    encode: (args, index) => [
        ...args.slice(0, -1).map((arg) => index(arg as construction_object)),
        args[params.length],
    ],
    decode: (parameters, at) => {
        const values = parameters as number[];
        return [...values.slice(0, -1).map(at), values[params.length]];
    },
});

// A center of a triangle, of Kimberling's number n (see
// triangle_center_object.ts).
const center = (n: number): Overload => ({
    params: ["point", "point", "point"],
    tag: "TC",
    encode: (args, index) => [
        ...args.map((arg) => index(arg as construction_object)),
        n,
    ],
    decode: (parameters, at) => {
        const [a, b, c, kind] = parameters as number[];
        return kind === n ? [at(a), at(b), at(c)] : null;
    },
});

export const COMMANDS: Command[] = [
    {
        name: "Side",
        reference: true,
        overloads: [
            { params: ["polygon", "number"], tag: "", encode: () => null },
        ],
    },
    {
        name: "Face",
        reference: true,
        overloads: [
            { params: ["polyhedron", "number"], tag: "", encode: () => null },
        ],
    },
    {
        name: "Point",
        overloads: [
            {
                params: ["path", "number"],
                tag: "On",
                encode: ([support, t], index) => [
                    index(support as construction_object),
                    t,
                ],
                decode: (parameters, at) => {
                    const [support, t] = parameters as unknown[];
                    return typeof t === "number"
                        ? [at(support as number), t]
                        : null;
                },
            },
            {
                params: ["outline", "number", "number"],
                tag: "On",
                encode: ([support, a, b], index) => [
                    index(support as construction_object),
                    [a, b],
                ],
                decode: (parameters, at) => {
                    const [support, t] = parameters as unknown[];
                    return Array.isArray(t) && t.length === 2
                        ? [at(support as number), t[0], t[1]]
                        : null;
                },
            },
            {
                params: ["surface", "number", "number", "number"],
                tag: "On",
                encode: ([support, x, y, z], index) => [
                    index(support as construction_object),
                    [x, y, z],
                ],
                decode: (parameters, at) => {
                    const [support, t] = parameters as unknown[];
                    return Array.isArray(t) && t.length === 3
                        ? [at(support as number), t[0], t[1], t[2]]
                        : null;
                },
            },
        ],
    },
    {
        name: "FixedPoint",
        overloads: [2, 3].map((count) => ({
            params: Array(count).fill("number"),
            tag: "Fix",
            encode: (args) => args,
            decode: (parameters) =>
                (parameters as number[]).length === count
                    ? (parameters as number[])
                    : null,
        })),
    },
    {
        name: "Midpoint",
        overloads: [objects("Mid", ["point", "point"]), ofSegment("Mid")],
    },
    {
        name: "Line",
        overloads: [objects("Line", ["point", "point"])],
    },
    {
        name: "Segment",
        overloads: [objects("Seg", ["point", "point"])],
    },
    {
        name: "Ray",
        overloads: [objects("Ray", ["point", "point"])],
    },
    {
        name: "Vector",
        overloads: [objects("Vec", ["point", "point"])],
    },
    {
        name: "Parallel",
        overloads: [objects("Par", ["point", "line"], [1, 0])],
    },
    // In space, also orthogonal to a plane.
    {
        name: "Perpendicular",
        overloads: [
            objects("Perp", ["point", "line"], [1, 0]),
            objects("Nrm", ["point", "plane"], [1, 0]),
            // The tool's, in space.
            { params: ["point", "linear"], tag: "", encode: () => null },
        ],
    },
    {
        name: "PerpendicularBisector",
        overloads: [objects("Med", ["point", "point"]), ofSegment("Med")],
    },
    {
        name: "AngleBisector",
        overloads: [objects("Bis", ["point", "point", "point"])],
    },
    {
        name: "Circle",
        overloads: [
            objects("Cir", ["point", "point"]),
            withReal("C1", ["point"]),
            // In space: of radius r around a line, or orthogonal to a
            // plane; of axis d through P.
            {
                params: ["point", "real", "linear"],
                tag: "C1",
                encode: ([center, r, axis], index) => [
                    index(center as construction_object),
                    realParameter(r, index),
                    index(axis as construction_object),
                ],
                decode: (parameters, at) => {
                    const [center, r, axis] = parameters as unknown[];
                    return axis === undefined
                        ? null
                        : [
                              at(center as number),
                              realArgument(r, at),
                              at(axis as number),
                          ];
                },
            },
            objects("CAx", ["line", "point"]),
        ],
    },
    {
        name: "Circumcircle",
        overloads: [
            objects("C3p", ["point", "point", "point"]),
            objects("C3s", ["point", "point", "point"]),
        ],
    },
    {
        name: "Compass",
        overloads: [objects("C3", ["point", "point", "point"])],
    },
    // Of a circle or a conic, from P to Q counterclockwise.
    {
        name: "Arc",
        overloads: [
            objects("Arc", ["point", "point", "point"]),
            objects("Arcs", ["point", "point", "point"]),
            objects("QArc", ["tangible", "point", "point"]),
        ],
    },
    {
        name: "Sector",
        overloads: [
            objects("Sec", ["point", "point", "point"]),
            objects("Secs", ["point", "point", "point"]),
            objects("QSec", ["tangible", "point", "point"]),
        ],
    },
    // Of center M, from A to the ray [MB), counterclockwise; in space, the
    // arc of the angle AMB.
    {
        name: "CenterArc",
        overloads: [
            objects("CArc", ["point", "point", "point"]),
            objects("CArcs", ["point", "point", "point"]),
        ],
    },
    {
        name: "CenterSector",
        overloads: [
            objects("CSec", ["point", "point", "point"]),
            objects("CSecs", ["point", "point", "point"]),
        ],
    },
    // On the left of AB.
    { name: "Semicircle", overloads: [objects("Semi", ["point", "point"])] },
    { name: "Center", overloads: [objects("Ctr", ["circle"])] },
    { name: "Incenter", overloads: [center(1)] },
    { name: "Centroid", overloads: [center(2)] },
    { name: "Circumcenter", overloads: [center(3)] },
    { name: "Orthocenter", overloads: [center(4)] },
    // Of rank k, from 1.
    {
        name: "Vertex",
        overloads: [
            {
                params: ["faceted", "number"],
                tag: "Vtx",
                encode: ([polygon, k], index) => [
                    index(polygon as construction_object),
                    (k as number) - 1,
                ],
                decode: (parameters, at) => {
                    const [polygon, rank] = parameters as number[];
                    return [at(polygon), rank + 1];
                },
            },
            // GeoGebra's other order, written as the first.
            {
                params: ["number", "faceted"],
                tag: "Vtx",
                encode: ([k, polygon], index) => [
                    index(polygon as construction_object),
                    (k as number) - 1,
                ],
            },
        ],
    },
    // Through P, the first or the second to a circle or a conic, or to a
    // function's curve.
    {
        name: "Tangent",
        overloads: [
            {
                params: ["point", "tangible", "number"],
                tag: "Tan",
                encode: ([point, curve, n], index) => [
                    index(point as construction_object),
                    index(curve as construction_object),
                    (n as number) - 1,
                ],
                decode: (parameters, at) => {
                    const [point, curve, branch] = parameters as number[];
                    return branch === undefined
                        ? null
                        : [at(point), at(curve), branch + 1];
                },
            },
            objects("Tan", ["point", "graph"]),
            // GeoGebra's other order, written as the first.
            {
                params: ["tangible", "point", "number"],
                tag: "Tan",
                encode: ([curve, point, n], index) => [
                    index(point as construction_object),
                    index(curve as construction_object),
                    (n as number) - 1,
                ],
            },
            objects("Tan", ["graph", "point"], [1, 0]),
        ],
    },
    {
        name: "Intersection",
        overloads: [
            {
                params: ["line", "line"],
                tag: "Int",
                encode: ([a, b], index) => [
                    index(a as construction_object),
                    index(b as construction_object),
                    0,
                ],
                // Two lines meet once, whatever the order.
                decode: (parameters, at) => {
                    const [a, b, , away] = parameters as number[];
                    const args = [at(a), at(b)];
                    return away === undefined && args.every(isLine)
                        ? args
                        : null;
                },
            },
            numbered(["curved", "intersectable", "number"]),
            numbered(["line", "curved", "number"]),
            // Of a line and a sphere, a cylinder or a cone, of rank n from 1.
            {
                params: ["line", "surface", "number"],
                tag: "CyI",
                encode: ([line, surface, n], index) => [
                    index(line as construction_object),
                    index(surface as construction_object),
                    (n as number) - 1,
                ],
                decode: (parameters, at) => {
                    const [line, surface, order] = parameters as number[];
                    return [at(line), at(surface), order + 1];
                },
            },
            {
                params: ["surface", "line", "number"],
                tag: "CyI",
                encode: ([surface, line, n], index) => [
                    index(line as construction_object),
                    index(surface as construction_object),
                    (n as number) - 1,
                ],
            },
            objects("PlI", ["line", "plane"]),
            objects("PlPl", ["plane", "plane"]),
            objects("SphC", ["sphere", "sphere"]),
            objects("PlI", ["plane", "line"], [1, 0]),
        ],
    },
    {
        name: "OtherIntersection",
        overloads: [
            {
                params: ["intersectable", "intersectable", "point"],
                tag: "Int",
                encode: ([a, b, away], index) => [
                    index(a as construction_object),
                    index(b as construction_object),
                    0,
                    index(away as construction_object),
                ],
                // The order only matters while the point is undefined.
                decode: (parameters, at) => {
                    const [a, b, , away] = parameters as number[];
                    return away === undefined ? null : [at(a), at(b), at(away)];
                },
            },
        ],
    },
    // Of n sides on [AB].
    {
        name: "RegularPolygon",
        overloads: [
            {
                params: ["point", "point", "number"],
                tag: "RegP",
                encode: ([a, b, n], index) => [
                    index(a as construction_object),
                    index(b as construction_object),
                    n,
                ],
                decode: (parameters, at) => {
                    const [a, b, n] = parameters as number[];
                    return [at(a), at(b), n];
                },
            },
        ],
    },
    {
        name: "Polygon",
        overloads: [
            {
                params: ["point", "point", "point"],
                variadic: true,
                tag: "Poly",
                encode: (args, index) => args.map(index as never),
                decode: (parameters, at) =>
                    Array.isArray(parameters) && parameters.every(isIndex)
                        ? parameters.map(at)
                        : null,
            },
        ],
    },
    {
        name: "Angle",
        overloads: [objects("Ang", ["point", "point", "point"])],
    },
    {
        name: "Reflect",
        overloads: [
            objects("Sym", ["point", "transformable"]),
            objects("Refl", ["line", "transformable"]),
        ],
    },
    // The transformation first, then the point or the object it maps, as
    // in DGPad: around O by an angle, of center O and ratio k, by u.
    {
        name: "Rotation",
        overloads: [withReal("Rot", ["point", "transformable"])],
    },
    {
        name: "Dilation",
        overloads: [withReal("Dil", ["point", "transformable"])],
    },
    {
        name: "Translation",
        overloads: [objects("Tra", ["vector", "transformable"])],
    },
    // A line or a circle through the center, mapped to a line, is marked.
    {
        name: "Inversion",
        overloads: [
            {
                params: ["circle", "invertible"],
                tag: "Inv",
                encode: ([circle, object], index) => [
                    index(circle as construction_object),
                    index(object as construction_object),
                    ...(object instanceof point_object ||
                    !straightImage(
                        circle as primitive_circle_object,
                        object as construction_object,
                    )
                        ? []
                        : [1]),
                ],
                decode: (parameters, at) =>
                    Array.isArray(parameters) &&
                    [2, 3].includes(parameters.length) &&
                    isIndex(parameters[0]) &&
                    isIndex(parameters[1])
                        ? [at(parameters[0]), at(parameters[1])]
                        : null,
            },
        ],
    },
    {
        name: "Conic",
        overloads: [objects("Quad", Array(5).fill("point"))],
    },
    {
        name: "Ellipse",
        overloads: [
            objects("Ell", ["point", "point", "point"]),
            withReal("Ell1", ["point", "point"]),
        ],
    },
    {
        name: "Hyperbola",
        overloads: [
            objects("Hyp", ["point", "point", "point"]),
            withReal("Hyp1", ["point", "point"]),
        ],
    },
    { name: "Parabola", overloads: [objects("Prb", ["point", "line"])] },
    {
        name: "Sphere",
        overloads: [
            objects("Sph", ["point", "point"]),
            withReal("Sph1", ["point"]),
        ],
    },
    // Solids: of axis AB and radius r, the cube on the square ABCD of
    // plane ABC, or parallel to a plane or horizontal, on the side of its
    // normal or up (1) or the other (-1), a prism or a pyramid on a
    // polygon.
    { name: "Cylinder", overloads: [withReal("Cyl", ["point", "point"])] },
    { name: "Cone", overloads: [withReal("Cone", ["point", "point"])] },
    {
        name: "Cube",
        overloads: [
            objects("Cube", ["point", "point", "point"]),
            sided("CubP", ["point", "point", "planar"]),
            sided("CubZ", ["point", "point"]),
        ],
    },
    { name: "Prism", overloads: [objects("Prsm", ["polygon", "point"])] },
    { name: "Pyramid", overloads: [objects("Pyr", ["polygon", "point"])] },
    // Through three points, or a point and a line; through a point,
    // parallel to a plane or orthogonal to a line.
    {
        name: "Plane",
        overloads: [
            objects("Pl", ["point", "point", "point"]),
            objects("PlL", ["point", "line"]),
        ],
    },
    { name: "ParallelPlane", overloads: [objects("PlP", ["point", "plane"])] },
    {
        name: "OrthogonalPlane",
        overloads: [objects("PlO", ["point", "line"])],
    },
    // By a plane: a sphere's circle, a cylinder's or a cone's conic, a
    // polyhedron's polygon. The menu's tool takes any solid, its form being
    // that of the arguments (see build in main.ts).
    {
        name: "Section",
        overloads: [
            objects("SphC", ["sphere", "plane"]),
            objects("CyS", ["revolution", "plane"]),
            objects("PlS", ["polyhedron", "plane"], [1, 0]),
            { params: ["solid", "plane"], tag: "", encode: () => null },
            objects("SphC", ["plane", "sphere"], [1, 0]),
            objects("CyS", ["plane", "revolution"], [1, 0]),
            objects("PlS", ["plane", "polyhedron"]),
        ],
    },
    // Unfolded by f, from 0 (folded) to 1 (flat).
    { name: "Net", overloads: [withReal("Net", ["polyhedron"])] },
    {
        name: "Locus",
        overloads: [objects("Loc", ["traced", "pointOn"])],
    },
    // The points of an expression's value (see expression_list_object.ts).
    { name: "List", overloads: [objects("ELst", ["expression"])] },
    // A formula for a variable from a to b, by s: see sequence in
    // figure.ts.
    {
        name: "Sequence",
        overloads: [4, 5].map((count) => ({
            params: (
                ["readable", "number", "real", "real", "real"] as Param[]
            ).slice(0, count),
            tag: "Seq",
            encode: () => null,
        })),
    },
    // Of a point, shifted by an offset in pixels; a panel of HTML, framed;
    // an image of the figure, by its corners or at a place of the window.
    // What the line doesn't say is null, kept by a redefinition (see
    // keeping in figure.ts).
    {
        name: "Text",
        overloads: [
            {
                params: ["text", "point"],
                tag: "Txt",
                encode: ([text, point], index) => [
                    index(point as construction_object),
                    null,
                    textParameter(text as TextArg, index),
                ],
                decode: (parameters, at) => {
                    const [point, , text] = parameters as unknown[];
                    return [textArgument(text, at), at(point as number)];
                },
            },
        ],
    },
    {
        name: "Html",
        overloads: [
            {
                params: ["text"],
                tag: "Html",
                encode: ([text], index) => [
                    null,
                    null,
                    textParameter(text as TextArg, index),
                ],
                decode: (parameters, at) => [
                    textArgument((parameters as unknown[])[2], at, true),
                ],
            },
        ],
    },
    {
        name: "Image",
        overloads: [
            {
                params: ["point"],
                variadic: true,
                tag: "Img",
                encode: (corners, index) => [
                    null,
                    null,
                    null,
                    ...corners.map(index as never),
                ],
                decode: (parameters, at) => {
                    const corners = (parameters as unknown[]).slice(3);
                    return corners.every(isIndex) ? corners.map(at) : null;
                },
            },
            {
                params: ["number", "number"],
                tag: "Img",
                encode: (place) => [null, null, null, place],
                decode: (parameters) => {
                    const place = (parameters as unknown[])[3];
                    return Array.isArray(place) ? place : null;
                },
            },
        ],
    },
    // DGPad's button, of this caption, its program and its place written
    // by the editor (see buttonOverload in figure.ts).
    {
        name: "Button",
        overloads: [
            {
                params: ["text"],
                tag: "Btn",
                encode: ([caption]) => ({ t: (caption as TextArg).text }),
                decode: (parameters) => [
                    new TextArg((parameters as { t: string }).t, new Map()),
                ],
            },
        ],
    },
    {
        name: "Slider",
        overloads: [
            {
                params: ["real", "real", "number"],
                // The expression's own keys, the others written by the
                // editor (see expressionOverload in figure.ts).
                tag: "Ex",
                style: { cB: 0, iB: 0 },
                encode: ([min, max, value], index) => ({
                    v: value,
                    mn: realParameter(min, index),
                    mx: realParameter(max, index),
                }),
                decode: (parameters, at) => {
                    const { v, mn, mx } = parameters as Record<string, unknown>;
                    if (
                        typeof v !== "number" ||
                        mn === undefined ||
                        mx === undefined
                    )
                        return null;
                    return [realArgument(mn, at), realArgument(mx, at), v];
                },
            },
        ],
    },
    // Worth 1 or 0, the object it redefines keeping its value. The objects it
    // shows are those whose condition it is, not its parents: `cB`, `iB` and
    // `shown` are given to `decode` by lineOf in figure.ts.
    {
        name: "Checkbox",
        overloads: [["text"], ["text", "any"]].map((params) => ({
            params: params as Param[],
            variadic: params.length > 1,
            tag: "Ex",
            style: { cB: 1, iB: 0 },
            kept: (value: number) => (value ? 1 : 0),
            encode: ([caption]: Arg[]) => ({
                t: (caption as TextArg).text,
                v: 1,
            }),
            decode: (parameters: unknown) => {
                const { cB, t, v, shown } = parameters as {
                    cB?: boolean;
                    t: string;
                    v: unknown;
                    shown?: construction_object[];
                };
                return cB && typeof v === "number"
                    ? [new TextArg(t, new Map()), ...shown!]
                    : null;
            },
        })),
    },
    {
        name: "InputField",
        overloads: [
            {
                params: ["number"],
                tag: "Ex",
                style: { cB: 0, iB: 8 },
                encode: ([value]) => ({ t: "", v: value }),
                decode: (parameters) => {
                    const { iB, v } = parameters as Record<string, unknown>;
                    return iB && typeof v === "number" ? [v] : null;
                },
            },
        ],
    },
    // The number of the choice, which the object it redefines keeps.
    {
        name: "Menu",
        overloads: [
            {
                params: ["text"],
                variadic: true,
                tag: "Ex",
                style: { cB: 0, iB: 0 },
                kept: (value, choices) =>
                    Math.min(Math.max(Math.round(value), 1), choices.length),
                encode: (choices) => ({
                    t: "",
                    v: 1,
                    mu: choices.map((choice) => (choice as TextArg).text),
                }),
                decode: (parameters) => {
                    const { mu } = parameters as { mu?: string[] };
                    return (
                        mu?.map((choice) => new TextArg(choice, new Map())) ??
                        null
                    );
                },
            },
        ],
    },
];

// The functions of the formulas that read objects, or numbers: those of
// DGPad (see FORMULA_ARITY in dgp_formula.ts).
const formulaFunction = (name: string, params: Param[], variadic = false) => ({
    name,
    formula: true,
    overloads: [{ params, variadic, tag: "", encode: () => null }],
});

export const FUNCTIONS: Command[] = [
    formulaFunction("d", ["point", "point"]),
    formulaFunction("x", ["point"]),
    formulaFunction("y", ["point"]),
    ...[
        "sqrt",
        "abs",
        "sin",
        "cos",
        "tan",
        "asin",
        "acos",
        "atan",
        "exp",
        "log",
        "floor",
        "ceil",
        "round",
    ].map((name) => formulaFunction(name, ["real"])),
    formulaFunction("atan2", ["real", "real"]),
    // The image of a point around a center, by an angle or a ratio.
    formulaFunction("rotate", ["point", "point", "real"]),
    formulaFunction("dilate", ["point", "point", "real"]),
    formulaFunction("min", ["real"], true),
    formulaFunction("max", ["real"], true),
];

export const commandName = (command: Command): string =>
    TEXTS.commands?.[command.name] ?? command.name;

// Names are compared without case nor accents, the marks of other scripts
// kept: Hindi's vowels.
const fold = (name: string): string =>
    name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// English names hold in every language. Commands of one name, as Midpoint
// and Center in German, are told apart by their arguments.
const BY_NAME = new Map<string, Command>();
for (const command of COMMANDS)
    for (const name of new Set(
        [command.name, commandName(command)].map(fold),
    )) {
        const known = BY_NAME.get(name);
        BY_NAME.set(
            name,
            known
                ? {
                      ...known,
                      overloads: [...known.overloads, ...command.overloads],
                  }
                : command,
        );
    }

// A formula's function, by its exact name.
export const findCommand = (name: string): Command | undefined =>
    BY_NAME.get(fold(name)) ??
    FUNCTIONS.find((command) => command.name === name);

export const isCommand = (name: string): boolean => BY_NAME.has(fold(name));

// The commands, or the functions, whose localized name starts with
// `prefix`, each name once.
export const commandsStarting = (
    prefix: string,
    commands = COMMANDS,
): Command[] =>
    commands.filter(
        (command, index) =>
            fold(commandName(command)).startsWith(fold(prefix)) &&
            commands.findIndex(
                (other) => commandName(other) === commandName(command),
            ) === index,
    );

// Where a transformation takes the point or the object it maps, -1 for
// another command.
export const mappedSlot = (params: Param[]): number =>
    params.findIndex(
        (param) => param === "transformable" || param === "invertible",
    );

export function paramAt(overload: Overload, position: number): Param | null {
    const { params, variadic } = overload;
    if (position < params.length) return params[position];
    return variadic ? params[params.length - 1] : null;
}

export function matches(overload: Overload, args: Arg[]): boolean {
    const { params, variadic } = overload;
    return (
        (variadic
            ? args.length >= params.length
            : args.length === params.length) &&
        args.every((arg, position) =>
            accepts(arg, paramAt(overload, position)!),
        )
    );
}

// The forms in the plane, and in space, in the plane of their points, of
// the circle and the arcs through three points and of the arcs of a center.
const SPACE_FORMS: Record<string, string> = {
    C3p: "C3s",
    Arc: "Arcs",
    Sec: "Secs",
    CArc: "CArcs",
    CSec: "CSecs",
};

// A form of the other view: in space, one in the plane.
export const otherView = (tag: string, vec3: boolean): boolean =>
    vec3 ? tag in SPACE_FORMS : Object.values(SPACE_FORMS).includes(tag);

// The overload that takes these arguments.
export const overloadFor = (
    command: Command,
    args: Arg[],
    vec3: boolean,
): Overload | undefined =>
    command.overloads.find(
        (overload) => matches(overload, args) && !otherView(overload.tag, vec3),
    );

// The command, and its arguments, that writes this entry.
export function decodeEntry(
    tag: string,
    parameters: unknown,
    at: (index: DgoRef) => Arg,
): { command: Command; args: Arg[] } | null {
    for (const command of COMMANDS)
        for (const overload of command.overloads) {
            if (overload.tag !== tag || !overload.decode) continue;
            const args = overload.decode(parameters, at);
            if (args && matches(overload, args)) return { command, args };
        }
    return null;
}
