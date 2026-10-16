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
    // A support whose points take one number, or two.
    | "path"
    | "outline";

export type Arg = construction_object | number;

export interface Overload {
    params: Param[];
    // Its last parameter repeats, at least `params.length` arguments.
    variadic?: boolean;
    tag: string;
    // The .dgo parameters, objects being given by their index.
    encode(
        args: Arg[],
        index: (object: construction_object) => number,
    ): unknown;
    // The arguments of an entry of its tag, null when this overload can't
    // write it.
    decode?(parameters: unknown, at: (index: number) => Arg): Arg[] | null;
}

export interface Command {
    name: string;
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
    const kind = kindOf(arg);
    switch (param) {
        case "number":
            return false;
        case "real":
        case "expression":
            return kind === "number";
        case "pointOn":
            return arg instanceof point_on_object;
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
        case "linear":
            return kind === "line" || kind === "plane";
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
                arg instanceof curve_object
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
                kind === "curve"
            );
        case "path":
            return kind === "line" || kind === "circle" || kind === "curve";
        case "outline":
            return (
                arg instanceof polygon_object ||
                arg instanceof primitive_quadric_object
            );
        default:
            return kind === param;
    }
}

// What a formula reads by name (see READABLE in dgp_commands.ts).
export const readable = (object: construction_object): boolean =>
    object instanceof curve_object ||
    ["point", "line", "circle", "conic", "polygon", "number", "angle"].includes(
        kindOf(object),
    );

const isIndex = (value: unknown): value is number =>
    Number.isInteger(value) && (value as number) >= 0;

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
            const { P1, P2 } = segment as two_points_line_object;
            return [index(P1), index(P2)];
        },
    };
}

// An expression, a formula of its name alone.
const realParameter = (
    arg: Arg,
    index: (object: construction_object) => number,
): unknown =>
    typeof arg === "number"
        ? arg
        : [formatName(arg.name), { [arg.name]: index(arg) }];

// A number, also written as a formula, or an object read by name.
function realArgument(
    parameter: unknown,
    at: (index: number) => Arg,
): Arg | null {
    if (typeof parameter === "number") return parameter;
    if (typeof parameter === "string")
        return STYLE_NUMBER.test(parameter) ? Number(parameter) : null;
    const [source, refs] = parameter as [string, Record<string, number>];
    const [name, ...others] = Object.keys(refs);
    return !others.length && source === formatName(name)
        ? at(refs[name])
        : null;
}

const isLine = (arg: Arg) => typeof arg !== "number" && kindOf(arg) === "line";

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

// Objects, then a number, the entry listing the objects in this order of
// the arguments.
function withReal(tag: string, params: Param[], order?: number[]): Overload {
    const positions = order ?? params.map((_, index) => index);
    return {
        params: [...params, "real"],
        tag,
        encode: (args, index) => [
            ...positions.map((position) =>
                index(args[position] as construction_object),
            ),
            realParameter(args[params.length], index),
        ],
        decode: (parameters, at) => {
            if (
                !Array.isArray(parameters) ||
                parameters.length !== params.length + 1
            )
                return null;
            const arg = realArgument(parameters[params.length], at);
            const objects = parameters.slice(0, -1);
            if (!objects.every(isIndex) || arg === null) return null;
            const args: Arg[] = [];
            positions.forEach(
                (position, k) => (args[position] = at(objects[k])),
            );
            return [...args, arg];
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
                    return Array.isArray(t)
                        ? [at(support as number), t[0], t[1]]
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
                    const radius =
                        axis === undefined ? null : realArgument(r, at);
                    return radius === null
                        ? null
                        : [at(center as number), radius, at(axis as number)];
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
    {
        name: "Arc",
        overloads: [objects("Arc", ["point", "point", "point"])],
    },
    {
        name: "Sector",
        overloads: [objects("Sec", ["point", "point", "point"])],
    },
    // Of center M, from A to the ray [MB), counterclockwise.
    {
        name: "CenterArc",
        overloads: [objects("CArc", ["point", "point", "point"])],
    },
    {
        name: "CenterSector",
        overloads: [objects("CSec", ["point", "point", "point"])],
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
            objects("PlI", ["line", "plane"]),
            objects("PlPl", ["plane", "plane"]),
            objects("SphC", ["sphere", "sphere"]),
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
            objects("Sym", ["point", "point"], [1, 0]),
            objects("Refl", ["point", "line"], [1, 0]),
        ],
    },
    // Of a point P: around O by an angle, of center O and ratio k, by u.
    {
        name: "Rotation",
        overloads: [withReal("Rot", ["point", "point"], [1, 0])],
    },
    {
        name: "Dilation",
        overloads: [withReal("Dil", ["point", "point"], [1, 0])],
    },
    {
        name: "Translation",
        overloads: [objects("Tra", ["point", "vector"], [1, 0])],
    },
    {
        name: "Inversion",
        overloads: [objects("Inv", ["point", "circle"], [1, 0])],
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
        ],
    },
    // Unfolded by f, from 0 (folded) to 1 (flat).
    { name: "Net", overloads: [withReal("Net", ["polyhedron"])] },
    {
        name: "Locus",
        overloads: [objects("Loc", ["point", "pointOn"])],
    },
    // The points of an expression's value (see expression_list_object.ts).
    { name: "List", overloads: [objects("ELst", ["expression"])] },
    {
        name: "Slider",
        overloads: [
            {
                params: ["real", "real", "number"],
                // The expression's own keys, the others written by the
                // editor (see expressionOverload in figure.ts).
                tag: "Ex",
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
                    const bounds = [mn, mx].map((bound) =>
                        realArgument(bound, at),
                    );
                    return bounds.includes(null)
                        ? null
                        : [...(bounds as Arg[]), v];
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

// The overload that takes these arguments.
export const overloadFor = (
    command: Command,
    args: Arg[],
    vec3: boolean,
): Overload | undefined =>
    command.overloads.find(
        (overload) =>
            matches(overload, args) &&
            // The circle through three points is in their plane in space.
            overload.tag !== (vec3 ? "C3p" : "C3s"),
    );

// The command, and its arguments, that writes this entry.
export function decodeEntry(
    tag: string,
    parameters: unknown,
    at: (index: number) => Arg,
): { command: Command; args: Arg[] } | null {
    for (const command of COMMANDS)
        for (const overload of command.overloads) {
            if (overload.tag !== tag || !overload.decode) continue;
            const args = overload.decode(parameters, at);
            if (args && matches(overload, args)) return { command, args };
        }
    return null;
}
