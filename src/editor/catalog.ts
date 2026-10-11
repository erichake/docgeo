import { LANG } from "../i18n";
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
import { quadric5pts_object } from "../objects/quadric5pts_object";
import { segment_object } from "../objects/segment_object";
import { sphere_object } from "../objects/sphere_object";
import { two_points_line_object } from "../objects/two_points_line_object";

// The commands that build objects, in the text and by gestures: see
// EDITOR.md.

export type Kind =
    | "point"
    | "line"
    | "circle"
    | "conic"
    | "polygon"
    | "sphere"
    | "curve"
    | "number"
    | "angle"
    | "other";

// What an argument accepts: a number, or an object.
export type Param =
    | "real"
    | "point"
    | "pointOn"
    | "line"
    | "segment"
    | "circle"
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
    fr: string;
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
    if (typeof arg === "number") return param === "real";
    const kind = kindOf(arg);
    switch (param) {
        case "real":
            return false;
        case "pointOn":
            return arg instanceof point_on_object;
        case "segment":
            return arg instanceof segment_object;
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
                kind === "curve"
            );
        case "path":
            return kind === "line" || kind === "circle" || kind === "curve";
        case "outline":
            return (
                arg instanceof polygon_object ||
                arg instanceof quadric5pts_object
            );
        default:
            return kind === param;
    }
}

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

export const COMMANDS: Command[] = [
    {
        name: "Point",
        fr: "Point",
        overloads: [
            {
                params: ["path", "real"],
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
                params: ["outline", "real", "real"],
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
        fr: "PointFixe",
        overloads: [2, 3].map((count) => ({
            params: Array(count).fill("real"),
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
        fr: "Milieu",
        overloads: [objects("Mid", ["point", "point"]), ofSegment("Mid")],
    },
    {
        name: "Line",
        fr: "Droite",
        overloads: [objects("Line", ["point", "point"])],
    },
    {
        name: "Segment",
        fr: "Segment",
        overloads: [objects("Seg", ["point", "point"])],
    },
    {
        name: "Ray",
        fr: "DemiDroite",
        overloads: [objects("Ray", ["point", "point"])],
    },
    {
        name: "Vector",
        fr: "Vecteur",
        overloads: [objects("Vec", ["point", "point"])],
    },
    {
        name: "Parallel",
        fr: "Parallèle",
        overloads: [objects("Par", ["point", "line"], [1, 0])],
    },
    {
        name: "Perpendicular",
        fr: "Perpendiculaire",
        overloads: [objects("Perp", ["point", "line"], [1, 0])],
    },
    {
        name: "PerpendicularBisector",
        fr: "Médiatrice",
        overloads: [objects("Med", ["point", "point"]), ofSegment("Med")],
    },
    {
        name: "AngleBisector",
        fr: "Bissectrice",
        overloads: [objects("Bis", ["point", "point", "point"])],
    },
    {
        name: "Circle",
        fr: "Cercle",
        overloads: [
            objects("Cir", ["point", "point"]),
            {
                params: ["point", "real"],
                tag: "C1",
                encode: ([center, radius], index) => [
                    index(center as construction_object),
                    radius,
                ],
                decode: (parameters, at) => {
                    const [center, radius] = parameters as unknown[];
                    return (parameters as unknown[]).length === 2 &&
                        typeof radius === "number"
                        ? [at(center as number), radius]
                        : null;
                },
            },
        ],
    },
    {
        name: "Circumcircle",
        fr: "CercleCirconscrit",
        overloads: [
            objects("C3p", ["point", "point", "point"]),
            objects("C3s", ["point", "point", "point"]),
        ],
    },
    {
        name: "Compass",
        fr: "Compas",
        overloads: [objects("C3", ["point", "point", "point"])],
    },
    {
        name: "Arc",
        fr: "Arc",
        overloads: [objects("Arc", ["point", "point", "point"])],
    },
    {
        name: "Sector",
        fr: "Secteur",
        overloads: [objects("Sec", ["point", "point", "point"])],
    },
    { name: "Center", fr: "Centre", overloads: [objects("Ctr", ["circle"])] },
    {
        name: "Intersection",
        fr: "Intersection",
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
            numbered(["curved", "intersectable", "real"]),
            numbered(["line", "curved", "real"]),
        ],
    },
    {
        name: "OtherIntersection",
        fr: "AutreIntersection",
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
    {
        name: "Polygon",
        fr: "Polygone",
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
        fr: "Angle",
        overloads: [objects("Ang", ["point", "point", "point"])],
    },
    {
        name: "Reflect",
        fr: "Symétrie",
        overloads: [
            objects("Sym", ["point", "point"], [1, 0]),
            objects("Refl", ["point", "line"], [1, 0]),
        ],
    },
    {
        name: "Conic",
        fr: "Conique",
        overloads: [objects("Quad", Array(5).fill("point"))],
    },
    {
        name: "Sphere",
        fr: "Sphère",
        overloads: [objects("Sph", ["point", "point"])],
    },
    {
        name: "Locus",
        fr: "Lieu",
        overloads: [objects("Loc", ["point", "pointOn"])],
    },
];

export const FRENCH = LANG === "fr";

export const commandName = (command: Command): string =>
    FRENCH ? command.fr : command.name;

// Names are compared without case nor accents.
const fold = (name: string): string =>
    name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const BY_NAME = new Map(
    COMMANDS.flatMap((command) => [
        [fold(command.name), command],
        [fold(command.fr), command],
    ]),
);

export const findCommand = (name: string): Command | undefined =>
    BY_NAME.get(fold(name));

// The commands whose localized name starts with `prefix`.
export const commandsStarting = (prefix: string): Command[] =>
    COMMANDS.filter((command) =>
        fold(commandName(command)).startsWith(fold(prefix)),
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
            if (args) return { command, args };
        }
    return null;
}
