import type { Animation } from "../animation";
import type { SegmentMap } from "../objects/iteration_object";
import { vAdd, vSub, type Vec2, type Vec3 } from "../vec";
import {
    evaluateFormula,
    formulaIdentifiers,
    NO_VIEW,
    parseFormula,
    realPart,
} from "./dgp_formula";
import {
    IDENTIFIER_PART,
    IDENTIFIER_START,
    type DgpCall,
    type DgpValue,
} from "./dgp_parser";

// A GeoGebra figure is translated into the same command list a .dgp file
// parses to, so it goes through the exact same validation and object
// constructors (see executeDgpCommands).

type Kind =
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

export interface GgbTranslation {
    calls: DgpCall[];
    // Saved position of each point whose DGP definition carries a choice
    // GeoGebra encodes differently (a point on a path's parameter, an
    // intersection's branch): resolved against the actual geometry once the
    // figure is built (see settleTargets in ggb_importer.ts).
    targets: Map<string, Vec3>;
    // The free numbers dragging a formula point shifts, per coordinate (see
    // changeableNumber).
    handles: Map<string, [string | null, string | null]>;
    unsupported: string[];
    // The animations of points on paths and sliders that GeoGebra plays,
    // started with the figure if `startAnimation`.
    animations: Map<string, Animation>;
    startAnimation: boolean;
    // Whether the figure has 3D objects.
    is3D: boolean;
    // Present for a 3D figure: its camera (see applyView3D in
    // ggb_importer.ts).
    view3D?: GgbView3D;
}

type TextPart = string | { formula: string };

interface ListFormula {
    count: string;
    item: (n: string) => string | null;
}

export interface GgbView3D {
    phi: number;
    theta: number;
    unit: number;
    // Translation of the world origin, in world units, from the center of
    // the view.
    offset: Vec3;
}

const IDENTIFIER = new RegExp(
    `^${IDENTIFIER_START.source}${IDENTIFIER_PART.source}*$`,
    "u",
);
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const NUMERIC_TUPLE =
    /^\(\s*[+-]?[\d.]+(?:[eE][+-]?\d+)?\s*(?:,\s*[+-]?[\d.]+(?:[eE][+-]?\d+)?\s*){1,2}\)$/;
const THREE_D_TYPES = /3d$|^polyhedron$/;
const COMMAND_EXPRESSION = /^([A-Za-z]+)\((.*)\)$/;
// The commands a formula rewrites as a whole (see commandFormula).
const FORMULA_COMMANDS = new Set([
    "Vector",
    "OrthogonalVector",
    "If",
    "Element",
    "Sum",
    "LaTeX",
]);
const CELL = /^([A-Z]+)(\d+)$/;
const LABEL_WORDS = new RegExp(
    `${IDENTIFIER_START.source}${IDENTIFIER_PART.source}*`,
    "gu",
);
// Applied to a list, GeoGebra's functions apply to each of its items.
const ITEM_FUNCTIONS: Record<string, string> = {
    real: "x",
    imaginary: "y",
    x: "x",
    y: "y",
};
const FUNCTION_DEFINITION = /^[^=]*\(\s*x\s*\)\s*=/;
const FUNCTIONS: Record<string, string> = {
    Distance: "d",
    sqrt: "sqrt",
    sin: "sin",
    cos: "cos",
    tan: "tan",
    asin: "asin",
    arcsin: "asin",
    acos: "acos",
    arccos: "acos",
    atan: "atan",
    arctan: "atan",
    atan2: "atan2",
    abs: "abs",
    floor: "floor",
    x: "x",
    y: "y",
    real: "x",
    imaginary: "y",
};
// GeoGebra's pointStyle → DGP's "sp" shape index (0:circle, 1:cross,
// 2:diamond), plus whether the shape is drawn hollow.
const POINT_SHAPES: Record<number, [number, boolean]> = {
    1: [1, false],
    2: [0, true],
    3: [1, false],
    4: [2, false],
    5: [2, true],
};
const POINT_KINDS: Kind[] = ["point", "pointOn"];
// Cube(A, B, C)'s outputs, after the polyhedron itself: vertices D to H,
// then its faces and edges as vertex indices (A..H = 0..7), in GeoGebra's
// order (see PlatonicSolidsFactory.getCube), which also numbers its nets.
const CUBE_FACES = [
    [3, 0, 1, 2],
    [4, 0, 3, 7],
    [1, 0, 4, 5],
    [2, 1, 5, 6],
    [3, 2, 6, 7],
    [4, 7, 6, 5],
];
const CUBE_EDGES = [
    [0, 3],
    [0, 1],
    [1, 2],
    [2, 3],
    [0, 4],
    [3, 7],
    [4, 7],
    [4, 5],
    [1, 5],
    [5, 6],
    [2, 6],
    [6, 7],
];
const AXES: Record<string, Vec3> = {
    xAxis: [1, 0, 0],
    yAxis: [0, 1, 0],
    zAxis: [0, 0, 1],
};
const DEFAULT_SLIDER_STEP = 0.1;
const CYLINDER_SIDES = 60;
const VALUE_KINDS: Kind[] = ["point", "pointOn", "expression"];

const literal = (value: string | number): DgpValue => ({
    type: "literal",
    value,
});

function child(element: Element, tag: string): Element | undefined {
    return [...element.children].find((item) => item.tagName === tag);
}

function attribute(
    element: Element,
    tag: string,
    name: string,
): string | undefined {
    return child(element, tag)?.getAttribute(name) ?? undefined;
}

function indexedAttributes(element: Element | undefined): string[] {
    const values: string[] = [];
    for (let index = 0; element?.hasAttribute(`a${index}`); index++)
        values.push(element.getAttribute(`a${index}`)!);
    return values;
}

// GeoGebra's legacy "Command[args]" syntax: square brackets never mean
// anything else in its expressions (lists use braces).
function normalizeBrackets(source: string): string {
    return source.replace(/\[/g, "(").replace(/\]/g, ")");
}

// The top-level comma-separated arguments of a call, or null when its
// parentheses don't enclose the whole remaining text (e.g. "f(A) + g(B)").
function splitArguments(text: string): string[] | null {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if ("({".includes(character)) depth++;
        else if (")}".includes(character) && --depth < 0) return null;
        else if (character === "," && depth === 0) {
            parts.push(text.slice(start, index).trim());
            start = index + 1;
        }
    }
    parts.push(text.slice(start).trim());
    return parts;
}

// A GeoGebra text expression's terms, split on its top-level "+", string
// literals kept with their quotes.
function textTerms(text: string): string[] {
    const terms: string[] = [];
    let depth = 0;
    let quoted = false;
    let start = 0;
    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (character === '"') quoted = !quoted;
        else if (quoted) continue;
        else if ("([{".includes(character)) depth++;
        else if (")]}".includes(character)) depth--;
        else if (character === "+" && depth === 0) {
            terms.push(text.slice(start, index).trim());
            start = index + 1;
        }
    }
    terms.push(text.slice(start).trim());
    return terms;
}

// "Name(arguments)" as its name and top-level arguments.
function commandCall(text: string): [string, string[]] | null {
    const match = COMMAND_EXPRESSION.exec(text);
    const args = match && splitArguments(match[2]);
    return args && [match[1], args];
}

// A value in a segment's own frame (see SegmentMap): a number, a point or
// vector as a complex number, or a segment.
type LocalValue = number | Vec2 | SegmentMap;

const isSegment = (value: LocalValue): value is SegmentMap =>
    typeof value !== "number" && typeof value[0] !== "number";

const isComplex = (value: LocalValue): value is Vec2 =>
    typeof value !== "number" && typeof value[0] === "number";

const realValue = (value: LocalValue): number | null =>
    isSegment(value) ? null : realPart(value);

const mapSegment = (
    value: LocalValue,
    transform: (point: Vec2) => Vec2,
): SegmentMap | null =>
    isSegment(value) ? [transform(value[0]), transform(value[1])] : null;

const complexProduct = ([a, b]: Vec2, [c, d]: Vec2): Vec2 => [
    a * c - b * d,
    a * d + b * c,
];

// The commands whose image of a segment is a direct similarity in its own
// frame, as long as their centers and vectors derive from its vertices.
const LOCAL_COMMANDS: Partial<
    Record<string, (args: LocalValue[]) => LocalValue | null>
> = {
    Vertex: ([segment, index, extra]) =>
        extra === undefined &&
        isSegment(segment) &&
        [1, 2].includes(index as number)
            ? segment[(index as number) - 1]
            : null,
    Vector: ([p, q]) =>
        q === undefined
            ? isComplex(p)
                ? p
                : null
            : isComplex(p) && isComplex(q)
              ? vSub(q, p)
              : null,
    Dilate: ([segment, factor, center, extra]) => {
        const k = realValue(factor);
        return extra === undefined && k !== null && isComplex(center)
            ? mapSegment(segment, (point) =>
                  vAdd(center, complexProduct(vSub(point, center), [k, 0])),
              )
            : null;
    },
    Rotate: ([segment, angle, center, extra]) => {
        const a = realValue(angle);
        return extra === undefined && a !== null && isComplex(center)
            ? mapSegment(segment, (point) =>
                  vAdd(
                      center,
                      complexProduct(vSub(point, center), [
                          Math.cos(a),
                          Math.sin(a),
                      ]),
                  ),
              )
            : null;
    },
    Translate: ([segment, vector, extra]) =>
        extra === undefined && isComplex(vector)
            ? mapSegment(segment, (point) => vAdd(point, vector))
            : null,
};

// A GeoGebra expression of the segment `variable`, evaluated in that
// segment's own frame: it may only use it and LOCAL_COMMANDS, so that it
// commutes with any direct similarity of the plane.
function localValue(source: string, variable: string): LocalValue | null {
    const text = source.trim();
    if (text === variable)
        return [
            [0, 0],
            [1, 0],
        ];
    const call = commandCall(text);
    if (call) {
        const command = LOCAL_COMMANDS[call[0]];
        const args = call[1].map((arg) => localValue(arg, variable));
        return command && args.every((arg) => arg !== null)
            ? command(args as LocalValue[])
            : null;
    }
    // Arithmetic, each nested command's value standing in a variable.
    const values: LocalValue[] = [];
    let result = "";
    let index = 0;
    while (index < text.length) {
        if (!IDENTIFIER_START.test(text[index])) {
            result += text[index++];
            continue;
        }
        let end = index + 1;
        while (end < text.length && IDENTIFIER_PART.test(text[end])) end++;
        const word = text.slice(index, end);
        if (word === "pi" || word === "π") result += "π";
        else if (text[end] !== "(") return null;
        else {
            let depth = 0;
            do {
                if (text[end] === "(") depth++;
                else if (text[end] === ")") depth--;
                end++;
            } while (depth > 0 && end < text.length);
            const value = localValue(text.slice(index, end), variable);
            if (value === null) return null;
            result += `v${values.push(value)}`;
        }
        index = end;
    }
    let node;
    try {
        node = parseFormula(result);
    } catch {
        return null;
    }
    const value = evaluateFormula(node, {
        resolveIdentifier: (name) => {
            const value = values[Number(name.slice(1)) - 1];
            return typeof value === "number"
                ? value
                : isComplex(value)
                  ? value
                  : null;
        },
        view: () => NO_VIEW,
    });
    return typeof value === "number" || value?.length === 2 ? value : null;
}

// Whether "+" or "-" is applied outside any parentheses, other than as a
// leading sign.
function hasTopLevelSum(text: string): boolean {
    let depth = 0;
    let afterOperand = false;
    for (const character of text) {
        if (/\s/.test(character)) continue;
        if (depth === 0 && afterOperand && "+-".includes(character))
            return true;
        if ("([".includes(character)) depth++;
        else if (")]".includes(character)) depth--;
        afterOperand = !"+-*/^([,".includes(character);
    }
    return false;
}

function hexColor(element: Element): string {
    return `#${["r", "g", "b"]
        .map((channel) =>
            Number(element.getAttribute(channel)).toString(16).padStart(2, "0"),
        )
        .join("")}`;
}

// Homogeneous coordinates: (x, y, z) in 2D, (x, y, z, w) in 3D.
function pointCoords(element: Element): Vec3 | null {
    const coords = child(element, "coords");
    if (!coords) return null;
    const [x, y, z, w] = ["x", "y", "z", "w"].map((name) =>
        Number(coords.getAttribute(name)),
    );
    const point: Vec3 = coords.hasAttribute("w")
        ? [x / w, y / w, z / w]
        : [x / z, y / z, 0];
    return point.every(Number.isFinite) ? point : null;
}

interface Net {
    // Each point's vertex of the polyhedron, and the face it belongs to.
    points: { vertex: string; face: number }[];
    // Each face's points.
    faces: number[][];
    parents: number[];
    // The edge each face turns around, from o to e, a vertex of the face
    // and one of its parent off that edge; null for the base face.
    links: ({
        edge: [string, string];
        inside: string;
        parentInside: string;
    } | null)[];
}

// GeoGebra's net of a convex polyhedron (AlgoPolyhedronNetConvex): each
// face hangs from the first face reached, breadth first from the base,
// through an edge that isn't cut, and the points are numbered in the same
// order. Null when the cuts split the faces apart.
function unfold(
    faces: string[][],
    base: number,
    cuts: [string, string][],
): Net | null {
    if (base < 0) return null;
    const key = (p: string, q: string): string => [p, q].sort().join("\n");
    const cutKeys = new Set(cuts.map(([p, q]) => key(p, q)));
    const edges: { ends: [string, string]; faces: number[] }[] = [];
    const indices = new Map<string, number>();
    const faceEdges = faces.map((face, index) =>
        face.map((vertex, position) => {
            const next = face[(position + 1) % face.length];
            const edgeKey = key(vertex, next);
            if (!indices.has(edgeKey)) {
                indices.set(edgeKey, edges.length);
                edges.push({ ends: [vertex, next], faces: [] });
            }
            const edge = indices.get(edgeKey)!;
            edges[edge].faces.push(index);
            return edge;
        }),
    );

    const UNKNOWN = -2;
    const parents = faces.map((_, face): number =>
        face === base ? -1 : UNKNOWN,
    );
    const ranks = faces.map(() => 0);
    const links = faces.map(() => -1);
    const children: number[][] = faces.map(() => []);
    let found = 1;
    for (let rank = 1, grew = true; found < faces.length && grew; rank++) {
        grew = false;
        faces.forEach((_, face) => {
            if (
                parents[face] === UNKNOWN ||
                children[face].length > 0 ||
                ranks[face] >= rank
            )
                return;
            faceEdges[face].forEach((edge) => {
                if (cutKeys.has(key(...edges[edge].ends))) return;
                const child = edges[edge].faces.find((other) => other !== face);
                if (child === undefined || parents[child] !== UNKNOWN) return;
                parents[child] = face;
                ranks[child] = rank;
                links[child] = edge;
                children[face].push(child);
                found++;
                grew = true;
            });
        });
    }
    if (found < faces.length) return null;

    // Each edge's first and last point, as the face being numbered sees it.
    const start = edges.map(() => -1);
    const end = edges.map(() => -1);
    const shifts: number[] = [];
    const netFaces: number[][] = faces.map(() => []);
    let count = 0;
    const number = (face: number): void => {
        const sides = faceEdges[face];
        const n = sides.length;
        const side = (index: number): number => sides[(index + n) % n];
        let shift = 0;
        if (face === base)
            sides.forEach((edge, index) => {
                end[edge] = count;
                start[side(index + 1)] = count++;
            });
        else {
            // The link edge's points are its parent's, run backwards.
            const link = links[face];
            shift = sides.indexOf(link);
            for (let index = 0; index < shift; index++)
                start[sides[index]] = end[sides[index]] = -1;
            start[side(shift + 1)] = start[link];
            end[side(shift - 1)] = end[link];
            [start[link], end[link]] = [end[link], start[link]];
            for (let index = shift + 1; index < n; index++) {
                if (index > shift + 1) start[sides[index]] = -1;
                if (index < n - 1 || shift !== 0) end[sides[index]] = -1;
            }
            sides.forEach((edge, index) => {
                if (start[edge] === -1) {
                    start[edge] = count;
                    end[side(index - 1)] = count++;
                }
                if (end[edge] === -1) {
                    end[edge] = count;
                    start[side(index + 1)] = count++;
                }
            });
        }
        shifts[face] = shift;
        for (let index = shift; index < shift + n; index++)
            netFaces[face].push(start[side(index)]);
        children[face].forEach(number);
    };
    number(base);

    const points: Net["points"] = [];
    netFaces.forEach((facePoints, face) =>
        facePoints.forEach((point, index) => {
            if (face === base || index >= 2)
                points[point] = {
                    vertex: faces[face][
                        (index + shifts[face]) % faces[face].length
                    ],
                    face,
                };
        }),
    );
    return {
        points,
        faces: netFaces,
        parents,
        links: links.map((edge, face) => {
            if (edge < 0) return null;
            const ends = edges[edge].ends;
            const outside = (vertex: string) => !ends.includes(vertex);
            return {
                edge: ends,
                inside: faces[face][(shifts[face] + 2) % faces[face].length],
                parentInside: faces[parents[face]].find(outside)!,
            };
        }),
    };
}

// An image of the .ggb archive, as a data URL, with its size in pixels.
export interface GgbImage {
    url: string;
    width: number;
    height: number;
}

export function translateGgb(
    xml: string,
    images = new Map<string, GgbImage>(),
): GgbTranslation {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    const construction = document.querySelector("construction");
    if (document.querySelector("parsererror") || !construction)
        throw new Error("Invalid GGB XML");

    const calls: DgpCall[] = [];
    const targets = new Map<string, Vec3>();
    const handles = new Map<string, [string | null, string | null]>();
    const animations = new Map<string, Animation>();
    const unsupported: string[] = [];
    const objects = new Map<string, { variable: string; kind: Kind }>();
    const segments = new Map<string, [string, string]>();
    // A plane, drawn around its center, and three of its points.
    const planes = new Map<
        string,
        { center: string; normal: string; half: string; points?: string[] }
    >([["xOyPlane", { center: "[0,0,0]", normal: "[0,0,1]", half: "5" }]]);
    // A cylinder's side, by its axis and a point on it.
    const cylinders = new Map<string, [string, string, string]>();
    // The same, for a limited cylinder.
    const solidCylinders = new Map<string, [string, string, string]>();
    // A sphere, by its center and a point on it.
    const spheres = new Map<string, [string, string]>();
    const vectors = new Map<string, [string, string]>();
    const polygons = new Map<string, string[]>();
    const polyhedra = new Map<string, [string, string][]>();
    // A convex polyhedron's faces, as their vertices.
    const solids = new Map<string, string[][]>();
    const iterations = new Map<
        string,
        { ends: string[][]; levels: string; maps: SegmentMap[] }
    >();
    const lists = new Map<string, ListFormula>();
    const elements = new Map<string, Element>();
    const expressions = new Map<string, string>();
    const commandOutputs = new Set<string>();
    [...construction.children].forEach((node) => {
        const label = node.getAttribute("label") ?? "";
        if (node.tagName === "element") elements.set(label, node);
        else if (node.tagName === "expression")
            expressions.set(label, node.getAttribute("exp") ?? "");
        else if (node.tagName === "command")
            indexedAttributes(child(node, "output")).forEach((output) =>
                commandOutputs.add(output),
            );
    });

    // Each number's saved value, standing for it in a slider's bounds,
    // which only a constant can give.
    const savedNumbers = new Map(
        [...elements].flatMap(([label, element]) => {
            const value = attribute(element, "value", "val");
            return value !== undefined && NUMBER.test(value)
                ? [[label, value] as const]
                : [];
        }),
    );

    const is3D = [...elements.values()].some((element) =>
        THREE_D_TYPES.test(element.getAttribute("type") ?? ""),
    );
    // A constant point, as a DGP fixed-point vector literal and its
    // dimension flag.
    const vectorLiteral = ([x, y, z]: Vec3): DgpValue[] =>
        is3D
            ? [literal(`[${x},${y},${z}]`), literal("1")]
            : [literal(`[${x},${y}]`), literal("0")];

    const fontSize = Number(
        document.querySelector("gui > font")?.getAttribute("size") ?? 16,
    );
    const decimals = Number(
        document.querySelector("kernel > decimals")?.getAttribute("val") ?? 2,
    );
    const view = document.querySelector("euclidianView");
    const rightAngleMark = ["none", "square", "dot", "L"][
        Number(
            document
                .querySelector("evSettings[rightAngleStyle]")
                ?.getAttribute("rightAngleStyle") ?? 1,
        )
    ];
    const coordSystem = view && child(view, "coordSystem");
    const origin: [number, number] = coordSystem
        ? [
              Number(coordSystem.getAttribute("xZero")),
              Number(coordSystem.getAttribute("yZero")),
          ]
        : [0, 0];
    const unit = Number(coordSystem?.getAttribute("scale") ?? 50);
    // GeoGebra's "fixed to grid" point capturing: free points move by the
    // grid's steps, its own distances or else the axes numbering distance
    // for the scale (the largest 1-2-5 step under 100 pixels, up to
    // GeoGebra's 1e-8 tolerance).
    const gridIncrement = ((): string | null => {
        if (!view || attribute(view, "evSettings", "pointCapturing") !== "2")
            return null;
        const grid = child(view, "grid");
        if (grid)
            return `${grid.getAttribute("distX")},${grid.getAttribute("distY")}`;
        const units = 100 / unit;
        const power = 10 ** Math.floor(Math.log10(units));
        const ratio = units / power - 1e-8;
        return `${(ratio > 5 ? 5 : ratio > 2 ? 2 : 1) * power}`;
    })();

    const push = (
        variable: string | null,
        name: string,
        args: DgpValue[],
    ): void => {
        calls.push({ variable, name, arguments: args, line: calls.length + 1 });
    };
    const kindOf = (label: string | undefined): Kind | undefined =>
        label === undefined ? undefined : objects.get(label)?.kind;
    const is = (label: string | undefined, kinds: Kind[]): boolean => {
        const kind = kindOf(label);
        return kind !== undefined && kinds.includes(kind);
    };
    const ref = (label: string): DgpValue => ({
        type: "reference",
        name: objects.get(label)!.variable,
    });

    // Vector(P, Q) as the formula Q-P. OrthogonalVector of a segment or
    // vector is GeoGebra's (-dy, dx), not normalized: the 2D vector times i.
    const vectorFormula = (source: string): string | null => {
        const match = COMMAND_EXPRESSION.exec(source);
        const args = match && splitArguments(match[2]);
        if (!args) return null;
        if (match[1] === "OrthogonalVector") {
            const [arg] = args;
            const ends = segments.get(arg);
            const vector =
                args.length !== 1 || is3D
                    ? null
                    : ends
                      ? vectorFormula(`Vector(${ends.join(",")})`)
                      : vectorFormula(arg.replace(/^Segment\(/, "Vector("));
            return vector && `(${vector}*1i)`;
        }
        if (match[1] !== "Vector" || args.length !== 2) return null;
        const [p, q] = args.map((arg) => formula(arg, POINT_KINDS));
        return p === null || q === null ? null : `(${q}-${p})`;
    };

    // GeoGebra's expression syntax → a DGP formula: labels become their DGP
    // variables, "(a, b)" tuples become "[a,b]" vectors and `locals` words
    // their own formulas. Returns null for anything the DGP formula engine
    // can't evaluate.
    const formula = (
        source: string,
        kinds: Kind[],
        locals = new Map<string, string>(),
    ): string | null => {
        const known = objects.get(source);
        if (known) return kinds.includes(known.kind) ? known.variable : null;
        const text = normalizeBrackets(source)
            .replace(/²/g, "^2")
            .replace(/³/g, "^3")
            .replace(/°/g, "*π/180")
            .replace(/≟/g, "==")
            .replace(/≠/g, "!=")
            .replace(/≤/g, "<=")
            .replace(/≥/g, ">=")
            .replace(/∧/g, "&&")
            .replace(/∨/g, "||")
            .replace(/\s+/g, " ");
        const groups: { start: number; call: boolean; comma: boolean }[] = [];
        let result = "";
        let index = 0;
        while (index < text.length) {
            const character = text[index];
            if (character === '"') {
                const end = text.indexOf('"', index + 1) + 1;
                if (end === 0) return null;
                result += text.slice(index, end);
                index = end;
                continue;
            }
            if (IDENTIFIER_START.test(character)) {
                let end = index + 1;
                while (end < text.length && IDENTIFIER_PART.test(text[end]))
                    end++;
                const word = text.slice(index, end);
                if (text[end] === "(" && FORMULA_COMMANDS.has(word)) {
                    let depth = 0;
                    do {
                        if (text[end] === "(") depth++;
                        else if (text[end] === ")") depth--;
                        end++;
                    } while (depth > 0 && end < text.length);
                    const value = commandFormula(
                        text.slice(index, end),
                        kinds,
                        locals,
                    );
                    if (value === null) return null;
                    result += value;
                    index = end;
                    continue;
                }
                index = end;
                if (text[index] === "(") {
                    const name = FUNCTIONS[word];
                    if (!name) return null;
                    groups.push({
                        start: result.length,
                        call: true,
                        comma: false,
                    });
                    result += `${name}(`;
                    index++;
                } else if (word === "π" || word === "pi") result += "π";
                // GeoGebra's imaginary unit.
                else if (word === "ί") result += "i";
                else if (locals.has(word)) result += `(${locals.get(word)})`;
                else if (is(word, kinds)) result += objects.get(word)!.variable;
                else return null;
                continue;
            }
            index++;
            if (character === "(") {
                groups.push({
                    start: result.length,
                    call: false,
                    comma: false,
                });
                result += "(";
            } else if (character === ")") {
                const group = groups.pop();
                if (!group) return null;
                if (!group.call && group.comma)
                    result = `${result.slice(0, group.start)}[${result.slice(group.start + 1)}]`;
                else result += ")";
            } else if (character === ",") {
                const group = groups[groups.length - 1];
                if (!group) return null;
                if (!group.call) group.comma = true;
                result += ",";
            } else if (/[\d.+\-*/^ =!<>&|]/.test(character))
                result += character;
            else return null;
        }
        if (groups.length > 0) return null;
        try {
            parseFormula(result);
        } catch {
            return null;
        }
        return result;
    };

    // If(c1, v1, c2, v2, …, otherwise), undefined without otherwise.
    const ifFormula = (
        args: string[],
        kinds: Kind[],
        locals = new Map<string, string>(),
    ): string | null => {
        if (args.length < 2) return null;
        const values = args.map((arg, index) =>
            formula(
                arg,
                index % 2 || index === args.length - 1 ? kinds : VALUE_KINDS,
                locals,
            ),
        );
        if (values.includes(null)) return null;
        let result = args.length % 2 ? values.pop()! : "0/0";
        for (let index = values.length - 2; index >= 0; index -= 2)
            result = `(${values[index]})?(${values[index + 1]}):(${result})`;
        return `(${result})`;
    };

    const commandFormula = (
        source: string,
        kinds: Kind[],
        locals: Map<string, string>,
    ): string | null => {
        const [name, args] = commandCall(source)!;
        switch (name) {
            case "If":
                return ifFormula(args, kinds, locals);
            case "Element": {
                const list = args.length === 2 && listFormula(args[0], locals);
                const n = formula(args[1], VALUE_KINDS, locals);
                const item = list && n !== null && list.item(n);
                return item ? `(${item})` : null;
            }
            // Summed by a hidden Expression's script, whose own variable
            // stands for the item's index.
            case "Sum": {
                const list = args.length === 1 && listFormula(args[0]);
                const item = list && list.item("$n");
                if (!item) return null;
                const sum = auxiliary();
                define(
                    sum,
                    "expression",
                    "Expression",
                    [
                        "",
                        "",
                        "",
                        `var $s=0;for(var $n=1;$n<=${list.count};$n++){$s+=${item}};$s`,
                        "0",
                        "0",
                    ].map(literal),
                    "h:1",
                );
                return objects.get(sum)!.variable;
            }
            // As GeoGebra writes a number, or a point in its own style.
            case "LaTeX": {
                const value =
                    args.length === 1 && formula(args[0], VALUE_KINDS, locals);
                if (!value) return null;
                if (!is(args[0], POINT_KINDS)) return `(""+(${value}))`;
                const [x, y] = [`x(${value})`, `y(${value})`];
                return attribute(
                    elements.get(args[0])!,
                    "coordStyle",
                    "style",
                ) === "complex"
                    ? `(${x}+(${y}<0?" - ":" + ")+abs(${y})+"i")`
                    : `("("+${x}+"; "+${y}+")")`;
            }
            default:
                return vectorFormula(source);
        }
    };

    // A GeoGebra list as its size and its n-th item (from 1), as formulas.
    const listFormula = (
        source: string,
        locals = new Map<string, string>(),
    ): ListFormula | null => {
        const text = normalizeBrackets(source.trim());
        const known = lists.get(text);
        if (known) return known;
        const call = commandCall(text);
        if (!call) return null;
        const [name, args] = call;
        const fn = ITEM_FUNCTIONS[name];
        if (fn) {
            const list =
                args.length === 1 ? listFormula(args[0], locals) : null;
            return (
                list && {
                    count: list.count,
                    item: (n) => {
                        const item = list.item(n);
                        return item && `${fn}(${item})`;
                    },
                }
            );
        }
        // The cells of a column, from first to last.
        if (name === "CellRange" && args.length >= 2 && args.length <= 3) {
            const [first, last] = args.map((arg) => CELL.exec(arg));
            if (!first || !last || first[1] !== last[1]) return null;
            const labels = Array.from(
                { length: Number(last[2]) - Number(first[2]) + 1 },
                (_, index) => `${first[1]}${Number(first[2]) + index}`,
            );
            if (
                labels.length === 0 ||
                !labels.every((label) => is(label, VALUE_KINDS))
            )
                return null;
            const items = `[${labels.map((label) => objects.get(label)!.variable).join(",")}]`;
            return {
                count: String(labels.length),
                item: (n) => `${items}[(${n})-1]`,
            };
        }
        if (name === "Sequence" && args.length >= 4 && args.length <= 5) {
            const [expression, variable, from, to, step = "1"] = args;
            const [a, b, s] = [from, to, step].map((bound) =>
                formula(bound, VALUE_KINDS, locals),
            );
            if (a === null || b === null || s === null) return null;
            return {
                // With a margin for the bounds' rounding errors.
                count: `floor(((${b})-(${a}))/(${s})+1.000001)`,
                item: (n) =>
                    formula(
                        expression,
                        VALUE_KINDS,
                        new Map([
                            ...locals,
                            [variable, `(${a})+((${n})-1)*(${s})`],
                        ]),
                    ),
            };
        }
        return null;
    };

    const objectStyle = (element: Element, kind: Kind): string => {
        const parts: string[] = [];
        const color = child(element, "objColor");
        if (color) parts.push(`c:${hexColor(color)}`);
        if (attribute(element, "show", "object") === "false") parts.push("h:1");
        if (attribute(element, "show", "label") === "true")
            parts.push("sn:true");
        if (kind === "point" || kind === "pointOn") {
            const size = attribute(element, "pointSize", "val");
            if (size) parts.push(`s:${size}`);
            const [shape, hollow] = POINT_SHAPES[
                Number(attribute(element, "pointStyle", "val") ?? 0)
            ] ?? [0, false];
            parts.push(`sp:${shape}`, `o:${hollow ? 0 : 1}`);
            const offset = child(element, "labelOffset");
            if (offset)
                parts.push(
                    `np:${
                        (Math.atan2(
                            -Number(offset.getAttribute("y")),
                            Number(offset.getAttribute("x")),
                        ) +
                            2 * Math.PI) %
                        (2 * Math.PI)
                    }`,
                );
            if (attribute(element, "trace", "val") === "true")
                parts.push("tk:true");
        } else {
            const thickness = attribute(element, "lineStyle", "thickness");
            if (thickness) parts.push(`s:${Number(thickness) / 2}`);
            const alpha = Number(color?.getAttribute("alpha") ?? 0);
            if (alpha > 0 && alpha <= 1) parts.push(`o:${alpha}`);
            const decoration = attribute(element, "decoration", "type");
            if (
                element.getAttribute("type")?.startsWith("segment") &&
                decoration
            )
                parts.push(`dc:${decoration}`);
            const arc = attribute(element, "arcSize", "val");
            if (kind === "angle") {
                if (arc) parts.push(`arc:${arc}`);
                parts.push(
                    `ra:${
                        attribute(element, "emphasizeRightAngle", "val") ===
                        "false"
                            ? "none"
                            : rightAngleMark
                    }`,
                );
            }
        }
        parts.push(`f:${fontSize}`);
        return parts.join(";");
    };

    const define = (
        label: string,
        kind: Kind,
        command: string,
        args: DgpValue[],
        style?: string,
    ): true => {
        // "i" is the imaginary unit in a DGP formula, "k" and "count" are
        // bound by a List's own formulas.
        const variable =
            IDENTIFIER.test(label) && !["i", "k", "count"].includes(label)
                ? label
                : `$${calls.length}`;
        objects.set(label, { variable, kind });
        push(variable, command, [literal(label), ...args]);
        const element = elements.get(label);
        // Without its own element (an unlabeled output, or an auxiliary
        // object built from a nested command), GeoGebra doesn't draw it.
        push(null, "STL", [
            { type: "reference", name: variable },
            literal(style ?? (element ? objectStyle(element, kind) : "h:1")),
        ]);
        return true;
    };

    const target = (label: string): void => {
        const element = elements.get(label);
        const coords = element && pointCoords(element);
        if (coords) targets.set(objects.get(label)!.variable, coords);
    };

    const defineSegment = (label: string, p: string, q: string): true => {
        segments.set(label, [p, q]);
        return define(label, "line", "Segment", [ref(p), ref(q)]);
    };

    // A plane, drawn like GeoGebra's clipped plane: a square of half side
    // `half` around `center`, along the unit vector u orthogonal to `normal`.
    const definePlane = (
        label: string,
        center: string,
        normal: string,
        half: string,
        u: string,
    ): true => {
        const v = `cross(${normal},${u})/d(${normal},[0,0,0])`;
        const corners = [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
        ].map(([s, t]) =>
            formulaPoint(`${center}+(${s}*${u}+${t}*${v})*${half}`),
        );
        definePolygon(label, corners);
        push(null, "STL", [ref(label), literal("pl:true")]);
        planes.set(label, { center, normal, half, points: corners });
        return true;
    };

    const planePoints = (plane: { points?: string[] }): string[] =>
        (plane.points ??= ["[0,0,0]", "[1,0,0]", "[0,1,0]"].map((point) =>
            formulaPoint(point),
        )).slice(0, 3);

    // A plane through a point: a square around the foot of the origin,
    // where GeoGebra's view is centered, at least as large as the floor and
    // always reaching past the point. (-sin θ, cos θ, 0), θ = atan2(y, x) of
    // the normal, is orthogonal to it (see Cylinder).
    const planeThrough = (
        label: string,
        point: string,
        normal: string,
    ): true => {
        const p = objects.get(point)!.variable;
        const center = objects.get(
            formulaPoint(
                `${normal}*dot(${normal},${p})/dot(${normal},${normal})`,
            ),
        )!.variable;
        const angle = `atan2(y(${normal}),x(${normal}))`;
        return definePlane(
            label,
            center,
            normal,
            `sqrt(25+d(${center},${p})^2)`,
            `[-sin(${angle}),cos(${angle}),0]`,
        );
    };

    const definePolygon = (
        label: string,
        vertices: string[],
        style?: string,
    ): true =>
        define(
            label,
            "polygon",
            "Polygon",
            [
                literal(
                    vertices
                        .map((vertex) => `_${objects.get(vertex)!.variable}`)
                        .join(","),
                ),
            ],
            style,
        );

    const defineIteration = (
        label: string,
        ends: string[][],
        levels: string,
        maps: SegmentMap[],
    ): true => {
        iterations.set(label, { ends, levels, maps });
        return define(label, "list", "SegmentIteration", [
            literal(
                ends
                    .flat()
                    .map((end) => `_${objects.get(end)!.variable}`)
                    .join(","),
            ),
            literal(levels),
            literal(maps.map((map) => map.flat().join(",")).join(";")),
        ]);
    };

    // The image of an iteration by a direct similarity is the iteration of
    // its start segments' images, since its maps commute with it.
    const iterationImage =
        (transform: Handler): Handler =>
        (inputs, outputs) => {
            const iteration = iterations.get(inputs[0]);
            if (!iteration) return transform(inputs, outputs);
            const ends = iteration.ends.map((pair) =>
                pair.map((end) => {
                    const image = auxiliary();
                    return transform([end, ...inputs.slice(1)], [image])
                        ? image
                        : "";
                }),
            );
            return (
                ends.flat().every(Boolean) &&
                defineIteration(
                    outputs[0],
                    ends,
                    iteration.levels,
                    iteration.maps,
                )
            );
        };

    // Only a constant speed: GeoGebra's may depend on the figure.
    const animate = (label: string): void => {
        const element = elements.get(label);
        const animation = element && child(element, "animation");
        if (animation?.getAttribute("playing") !== "true") return;
        const speed = Number(animation.getAttribute("speed") ?? 1);
        if (!Number.isFinite(speed)) {
            unsupported.push(`animation ${label}`);
            return;
        }
        // Oscillating, increasing, decreasing or increasing once.
        const type = animation.getAttribute("type");
        animations.set(objects.get(label)!.variable, {
            speed: Math.abs(speed),
            direction: speed < 0 !== (type === "2") ? -1 : 1,
            ar: type === "0" || type === null,
            ...(type === "3" && { once: true }),
            geogebra: true,
        });
    };

    const pointOn = (label: string, support: string, boundary: boolean) => {
        const kind = kindOf(support);
        const pair = kind === "polygon" || kind === "quadric";
        const element = elements.get(label);
        define(
            label,
            "pointOn",
            "PointOn",
            [
                ref(support),
                pair
                    ? { type: "array", items: [literal(0), literal(0)] }
                    : literal(0),
            ],
            element &&
                `${objectStyle(element, "pointOn")}${boundary ? ";sb:true" : ""}`,
        );
        target(label);
        animate(label);
        return true;
    };

    const segmentEnds = (input: string): [string, string] | undefined =>
        segments.get(input);

    const points = (...labels: (string | undefined)[]): boolean =>
        labels.every((label) => is(label, POINT_KINDS));

    // In a 3D figure, a slider stays where it is in the graphics view, the
    // camera's unit being already applied (see importGgb).
    const screenPosition = (
        x: number,
        y: number,
        absolute: boolean,
    ): [number, number] => {
        if (camera) {
            const [px, py] = absolute
                ? [x, y]
                : [origin[0] + x * unit, origin[1] - y * unit];
            return [px / camera.unit, -py / camera.unit];
        }
        return absolute
            ? [(x - origin[0]) / unit, (origin[1] - y) / unit]
            : [x, y];
    };

    const sliderScreen = (slider: Element): [number, number] =>
        screenPosition(
            Number(slider.getAttribute("x")),
            Number(slider.getAttribute("y")),
            (slider.getAttribute("absoluteScreenLocation") ??
                slider.getAttribute("fixed")) === "true",
        );

    // Polygon(A, B, n)'s other vertices, counterclockwise like GeoGebra's:
    // the k-th is A + (B - A)·(1 - w^k)/(1 - w) with w = e^(2iπ/n), i.e.
    // B - A rotated by (k - 1)π/n and scaled by sin(kπ/n)/sin(π/n). In a
    // plane, the rotation is around its normal.
    const regularVertices = (
        a: string,
        b: string,
        n: number,
        labels: string[],
        normal?: string,
    ): string[] => {
        const [p, q] = [a, b].map((label) => objects.get(label)!.variable);
        const dx = `(x(${q})-x(${p}))`;
        const dy = `(y(${q})-y(${p}))`;
        return Array.from({ length: n - 2 }, (_, index) => {
            const k = index + 2;
            const scale = Math.sin((k * Math.PI) / n) / Math.sin(Math.PI / n);
            const angle = ((k - 1) * Math.PI) / n;
            const cos = scale * Math.cos(angle);
            const sin = scale * Math.sin(angle);
            return formulaPoint(
                normal
                    ? `${p}+${cos}*(${q}-${p})+${sin}*cross(${normal},${q}-${p})/d(${normal},[0,0,0])`
                    : `${p}+${planar(`${cos}*${dx}-${sin}*${dy}`, `${sin}*${dx}+${cos}*${dy}`)}`,
                labels[index],
            );
        });
    };

    const planar = (x: string, y: string): string =>
        `[${x},${y}${is3D ? ",0" : ""}]`;

    const formulaPoint = (
        source: string,
        label = auxiliary(),
        style?: string,
    ): string => {
        define(
            label,
            "point",
            "Point",
            [literal(source), literal(is3D ? "1" : "0")],
            style,
        );
        return label;
    };

    // An arc drawn by Arc3pts (or its sector) from a start point, through a
    // middle point, to an end point, all on the circle.
    const arcThrough = (
        label: string,
        sector: boolean,
        ends: [string, string],
        middle: string,
    ): true =>
        define(label, "circle", sector ? "Sector3pts" : "Arc3pts", [
            ref(ends[0]),
            ref(middle),
            ref(ends[1]),
        ]);

    // CircleArc(M, A, B): counterclockwise from A to the ray MB, on the
    // circle centered at M through A. Its middle is at the start angle plus
    // half the span atan2(-sin, -cos) + π, which lies in ]0, 2π].
    const centerArc =
        (sector: boolean): Handler =>
        ([center, start, direction], [label]) => {
            if (!points(center, start, direction)) return false;
            const [m, a, b] = [center, start, direction].map(
                (input) => objects.get(input)!.variable,
            );
            const [ax, ay, bx, by] = [
                `(x(${a})-x(${m}))`,
                `(y(${a})-y(${m}))`,
                `(x(${b})-x(${m}))`,
                `(y(${b})-y(${m}))`,
            ];
            const span = `(atan2(${ay}*${bx}-${ax}*${by},-${ax}*${bx}-${ay}*${by})+π)`;
            const angle = `(atan2(${ay},${ax})+${span}/2)`;
            return arcThrough(
                label,
                sector,
                [
                    start,
                    formulaPoint(`${m}+(${b}-${m})*d(${m},${a})/d(${m},${b})`),
                ],
                formulaPoint(
                    `${m}+d(${m},${a})*${planar(`cos(${angle})`, `sin(${angle})`)}`,
                ),
            );
        };

    // A conic as the Quadric through five points given in its own frame:
    // origin, unit axis (ux, uy) and local coordinates (along, across).
    const conicThrough = (
        label: string,
        origin: string,
        [ux, uy]: [string, string],
        local: [string, string][],
    ): true =>
        define(
            label,
            "quadric",
            "Quadric",
            local.map(([p, q]) =>
                ref(
                    formulaPoint(
                        `${origin}+${planar(`(${p})*${ux}-(${q})*${uy}`, `(${p})*${uy}+(${q})*${ux}`)}`,
                    ),
                ),
            ),
        );

    // Ellipse(F, G, P) and Hyperbola(F, G, P) through P, or with semi-major
    // axis a: both centered at the foci's midpoint, along FG.
    const focalConic =
        (hyperbola: boolean): Handler =>
        ([f, g, third, extra], [label]) => {
            if (extra !== undefined || !points(f, g)) return false;
            const [p, q] = [f, g].map((input) => objects.get(input)!.variable);
            let a: string | null;
            if (points(third)) {
                const r = objects.get(third)!.variable;
                a = `sqrt((d(${r},${p})${hyperbola ? "-" : "+"}d(${r},${q}))^2)/2`;
            } else a = formula(third, VALUE_KINDS);
            if (a === null) return false;
            const c = `(d(${p},${q})/2)`;
            const b = hyperbola
                ? `sqrt(${c}^2-(${a})^2)`
                : `sqrt((${a})^2-${c}^2)`;
            const axis: [string, string] = [
                `(x(${q})-x(${p}))/d(${p},${q})`,
                `(y(${q})-y(${p}))/d(${p},${q})`,
            ];
            const [cosh, sinh] = [Math.cosh(1), Math.sinh(1)];
            const local: [number, number][] = hyperbola
                ? [
                      [1, 0],
                      [-1, 0],
                      [cosh, sinh],
                      [cosh, -sinh],
                      [-cosh, sinh],
                  ]
                : Array.from({ length: 5 }, (_, k) => [
                      Math.cos((2 * k * Math.PI) / 5),
                      Math.sin((2 * k * Math.PI) / 5),
                  ]);
            return conicThrough(
                label,
                `(${p}+${q})/2`,
                axis,
                local.map(([s, t]) => [`${s}*(${a})`, `${t}*${b}`]),
            );
        };

    const circumcircleArc =
        (sector: boolean): Handler =>
        (inputs, [label]) =>
            inputs.length === 3 &&
            points(...inputs) &&
            arcThrough(label, sector, [inputs[0], inputs[2]], inputs[1]);

    type Handler = (inputs: string[], outputs: string[]) => boolean;
    const onePoint =
        (command: string, arity: number, kind: Kind = "line"): Handler =>
        (inputs, [label]) =>
            inputs.length === arity &&
            points(...inputs) &&
            define(label, kind, command, inputs.map(ref));
    const mirror: Handler = ([source, mirror], [label]) =>
        points(source) &&
        (points(mirror)
            ? define(label, "point", "Symmetry", [ref(mirror), ref(source)])
            : is(mirror, ["line"])
              ? define(label, "point", "Reflection", [ref(mirror), ref(source)])
              : is(mirror, ["circle"]) && inversion(label, source, mirror));

    // The inverse of P in a circle of center M and radius r is
    // M + (P - M)·r²/MP², r being read off a point where MP meets it.
    const inversion = (label: string, source: string, circle: string): true => {
        const center = auxiliary();
        define(center, "point", "Center", [ref(circle)]);
        const line = auxiliary();
        define(line, "line", "Line", [ref(center), ref(source)]);
        const onCircle = auxiliary();
        define(onCircle, "point", "OrderedIntersection", [
            ref(line),
            ref(circle),
            literal(0),
        ]);
        const [p, m, t] = [source, center, onCircle].map(
            (input) => objects.get(input)!.variable,
        );
        formulaPoint(`${m}+(${p}-${m})*d(${m},${t})^2/d(${m},${p})^2`, label);
        return true;
    };

    let auxiliaries = 0;
    const auxiliary = (): string => `aux ${++auxiliaries}`;

    // The circle of a sphere centered at o through t, centered at `center`
    // in the plane orthogonal to `normal`.
    const sphereSection = (
        label: string,
        [o, t]: string[],
        normal: string,
        center: string,
    ): true => {
        const point = formulaPoint(center);
        const m = objects.get(point)!.variable;
        const axis = auxiliary();
        define(axis, "line", "Line", [
            ref(point),
            ref(formulaPoint(`${m}+${normal}`)),
        ]);
        // Computed by a 3D point, as Circle1 drops its formula points' z;
        // complex, hence undefined, when the plane misses the sphere.
        const radius = objects.get(
            formulaPoint(`[sqrt(d(${o},${t})^2-d(${o},${m})^2),0,0]`),
        )!.variable;
        return define(label, "circle", "Circle1", [
            ref(point),
            literal(`x(${radius})`),
            ref(axis),
        ]);
    };

    const HANDLERS: Record<string, Handler> = {
        Point: ([support, extra], [label]) =>
            extra === undefined &&
            is(support, [
                "line",
                "circle",
                "polygon",
                "quadric",
                "curve",
                "locus",
            ]) &&
            pointOn(label, support, kindOf(support) === "polygon"),
        PointIn: ([region, extra], [label]) =>
            extra === undefined &&
            is(region, ["polygon"]) &&
            pointOn(label, region, false),
        Intersect: ([first, second, third], outputs) => {
            const [path, surface] = is(first, ["line"])
                ? [first, second]
                : [second, first];
            const cylinder = cylinders.get(surface);
            const sphere = spheres.get(surface);
            if (cylinder || sphere) {
                if (third !== undefined || !is(path, ["line"])) return false;
                outputs.slice(0, 2).forEach((label, index) => {
                    if (!label) return;
                    define(
                        label,
                        "point",
                        cylinder
                            ? "CylinderIntersection"
                            : "SphereIntersection",
                        [
                            ref(path),
                            ...(cylinder ?? sphere!).map(ref),
                            literal(index),
                        ],
                    );
                    target(label);
                });
                return true;
            }
            const plane = planes.get(surface);
            if (plane) {
                if (third !== undefined || !is(path, ["line"])) return false;
                return define(outputs[0], "point", "PlaneIntersection", [
                    ref(path),
                    ...planePoints(plane).map(ref),
                ]);
            }
            const kinds: Kind[] = ["line", "circle", "quadric"];
            const withCurve =
                (is(first, ["curve"]) && is(second, kinds)) ||
                (is(first, kinds) && is(second, ["curve"]));
            if (!withCurve && (!is(first, kinds) || !is(second, kinds)))
                return false;
            let base = 0;
            if (third !== undefined) {
                if (NUMBER.test(third)) base = Number(third) - 1;
                else if (!points(third)) return false;
            }
            outputs.forEach((label, index) => {
                if (!label) return;
                define(label, "point", "OrderedIntersection", [
                    ref(first),
                    ref(second),
                    literal(Math.max(0, Math.min(3, base + index))),
                ]);
                target(label);
            });
            return true;
        },
        Midpoint: ([p, q], [label]) => {
            if (q !== undefined)
                return (
                    points(p, q) &&
                    define(label, "point", "MidPoint", [ref(p), ref(q)])
                );
            if (is(p, ["circle"]))
                return define(label, "point", "Center", [ref(p)]);
            const ends = segmentEnds(p);
            return (
                !!ends &&
                define(label, "point", "MidPoint", [ref(ends[0]), ref(ends[1])])
            );
        },
        Distance: ([p, q], [label]) =>
            points(p, q) &&
            define(
                label,
                "expression",
                "Expression",
                [
                    "",
                    "",
                    "",
                    `d(${objects.get(p)!.variable},${objects.get(q)!.variable})`,
                    "0",
                    "0",
                ].map(literal),
                "h:1",
            ),
        Center: ([circle], [label]) =>
            is(circle, ["circle"]) &&
            define(label, "point", "Center", [ref(circle)]),
        Line: ([p, q], [label]) =>
            points(p) &&
            (points(q)
                ? define(label, "line", "Line", [ref(p), ref(q)])
                : is(q, ["line"]) &&
                  define(label, "line", "Parallel", [ref(q), ref(p)])),
        Segment: ([p, q, extra], [label]) =>
            extra === undefined && points(p, q) && defineSegment(label, p, q),
        Ray: onePoint("Ray", 2),
        OrthogonalLine: ([p, line, extra], [label]) => {
            const plane = planes.get(line);
            if (extra !== undefined || !points(p)) return false;
            if (plane)
                return define(label, "line", "Line", [
                    ref(p),
                    ref(
                        formulaPoint(
                            `${objects.get(p)!.variable}+${plane.normal}`,
                        ),
                    ),
                ]);
            return (
                is(line, ["line"]) &&
                define(label, "line", "Perpendicular", [ref(line), ref(p)])
            );
        },
        LineBisector: ([p, q], [label]) => {
            const ends = q === undefined ? segmentEnds(p) : [p, q];
            return (
                !!ends &&
                points(...ends) &&
                define(label, "line", "PerpendicularBisector", ends.map(ref))
            );
        },
        AngularBisector: onePoint("AngleBisector", 3),
        Angle: onePoint("Angle", 3, "angle"),
        Circle: ([center, second, third], [label]) => {
            if (!points(center)) return false;
            if (points(second, third))
                return define(label, "circle", "Circle3pts", [
                    ref(center),
                    ref(second),
                    ref(third),
                ]);
            if (third !== undefined) {
                const radius = formula(second, VALUE_KINDS);
                return (
                    radius !== null &&
                    is(third, ["line"]) &&
                    define(label, "circle", "Circle1", [
                        ref(center),
                        literal(radius),
                        ref(third),
                    ])
                );
            }
            if (points(second))
                return define(label, "circle", "Circle", [
                    ref(center),
                    ref(second),
                ]);
            const ends = segmentEnds(second);
            if (ends)
                return define(label, "circle", "Circle3", [
                    ref(ends[0]),
                    ref(ends[1]),
                    ref(center),
                ]);
            // Always a formula string, even for a plain number: GeoGebra's
            // Circle(A, r) radius isn't draggable, unlike DGP's numeric one.
            const radius = formula(second, VALUE_KINDS);
            return (
                radius !== null &&
                define(label, "circle", "Circle1", [
                    ref(center),
                    literal(radius),
                ])
            );
        },
        CircumcircleArc: circumcircleArc(false),
        CircumcircularArc: circumcircleArc(false),
        CircumcircleSector: circumcircleArc(true),
        CircumcircularSector: circumcircleArc(true),
        CircleArc: centerArc(false),
        CircularArc: centerArc(false),
        CircleSector: centerArc(true),
        CircularSector: centerArc(true),
        // Clockwise from A to B, i.e. on the left of B - A.
        Semicircle: ([a, b, extra], [label]) => {
            if (extra !== undefined || !points(a, b)) return false;
            const [p, q] = [a, b].map((input) => objects.get(input)!.variable);
            return arcThrough(
                label,
                false,
                [a, b],
                formulaPoint(
                    planar(
                        `(x(${p})+x(${q})+y(${p})-y(${q}))/2`,
                        `(y(${p})+y(${q})-x(${p})+x(${q}))/2`,
                    ),
                ),
            );
        },
        Conic: onePoint("Quadric", 5, "quadric"),
        Ellipse: focalConic(false),
        Hyperbola: focalConic(true),
        // With p the focus-directrix distance, the vertex midway, and
        // y = x²/(2p) in the frame whose axis points to the focus.
        Parabola: ([focus, directrix, extra], [label]) => {
            if (
                extra !== undefined ||
                !points(focus) ||
                !is(directrix, ["line"])
            )
                return false;
            const image = auxiliary();
            define(image, "point", "Reflection", [ref(directrix), ref(focus)]);
            const [f, g] = [focus, image].map(
                (input) => objects.get(input)!.variable,
            );
            const p = `(d(${f},${g})/2)`;
            return conicThrough(
                label,
                `(3*${f}+${g})/4`,
                [
                    `(x(${f})-x(${g}))/d(${f},${g})`,
                    `(y(${f})-y(${g}))/d(${f},${g})`,
                ],
                [0, 1, -1, 2, -2].map((t) => [
                    `${(t * t) / 2}*${p}`,
                    `${t}*${p}`,
                ]),
            );
        },
        Polygon: (inputs, [label, ...sides]) => {
            const [a, b, count, plane] = inputs;
            const normal = planes.get(plane)?.normal;
            if (
                inputs.length === (normal ? 4 : 3) &&
                points(a, b) &&
                NUMBER.test(count)
            ) {
                const n = Number(count);
                if (!Number.isInteger(n) || n < 3) return false;
                return HANDLERS.Polygon(
                    [a, b, ...regularVertices(a, b, n, sides.slice(n), normal)],
                    [label, ...sides.slice(0, n)],
                );
            }
            if (inputs.length < 3 || !points(...inputs)) return false;
            polygons.set(label, inputs);
            definePolygon(label, inputs);
            sides.forEach(
                (side, index) =>
                    side &&
                    defineSegment(
                        side,
                        inputs[index],
                        inputs[(index + 1) % inputs.length],
                    ),
            );
            return true;
        },
        // Cube(A, B, C), or Cube(A, B, p) whose square ABCD is parallel to
        // plane p.
        Cube: (inputs, [solid, ...outputs]) => {
            const plane = planes.get(inputs[2]);
            if (
                inputs.length !== 3 ||
                !points(...(plane ? inputs.slice(0, 2) : inputs))
            )
                return false;
            const [a, b, c] = inputs.map(
                (input) => objects.get(input)?.variable,
            );
            // The square ABCD lies in plane ABC, the cube on the side of
            // AB × BC, exactly as GeoGebra builds it; or on the side of p's
            // normal.
            const side = `(${b}-${a})`;
            const normal = plane?.normal ?? `cross(${side},${c}-${b})`;
            const normalLength = `d(${normal},[0,0,0])`;
            const across = `cross(${normal},${side})/${normalLength}`;
            const up = `${normal}*d(${a},${b})/${normalLength}`;
            const others = [
                `${b}+${across}`,
                `${a}+${across}`,
                `${a}+${up}`,
                `${b}+${up}`,
                `${b}+${across}+${up}`,
                `${a}+${across}+${up}`,
            ].slice(plane ? 0 : 1);
            const vertices = [
                ...inputs.slice(0, plane ? 2 : 3),
                ...others.map((vertex, index) =>
                    formulaPoint(vertex, outputs[index] || auxiliary()),
                ),
            ];
            const faces = CUBE_FACES.map((face) =>
                face.map((vertex) => vertices[vertex]),
            );
            faces.forEach((face, index) => {
                const label = outputs[others.length + index];
                if (!label) return;
                polygons.set(label, face);
                definePolygon(label, face);
            });
            CUBE_EDGES.forEach(([p, q], index) => {
                const label = outputs[others.length + 6 + index];
                if (label) defineSegment(label, vertices[p], vertices[q]);
            });
            solids.set(solid, faces);
            return true;
        },
        // Net(P, v, base, e1, e2, …): P's net unfolded by v (0: folded, 1:
        // flat) from its base face, e1, e2, … being cut; after the net
        // itself come its points, its faces as P's and then its edges.
        Net: ([solid, value, ...rest], [, ...outputs]) => {
            const faces = solids.get(solid);
            const f = formula(value, VALUE_KINDS);
            if (!faces || f === null) return false;
            const base = polygons.get(rest[0]);
            const cuts = (base ? rest.slice(1) : rest).map((edge) =>
                segments.get(edge),
            );
            if (cuts.some((edge) => !edge)) return false;
            const net = unfold(
                faces,
                base
                    ? faces.findIndex(
                          (face) =>
                              face.length === base.length &&
                              face.every((vertex) => base.includes(vertex)),
                      )
                    : 0,
                cuts as [string, string][],
            );
            if (!net) return false;
            // Each face turns by f times its angle with its parent around
            // their common edge, taking its descendants along: a point is
            // turned by its own face first, then by each of its ancestors.
            const turns = net.links.map((link, face) => {
                if (!link) return null;
                const [o, e, c, q] = [
                    ...link.edge,
                    link.inside,
                    link.parentInside,
                ].map((label) => objects.get(label)!.variable);
                const k = objects.get(
                    formulaPoint(`(${e}-${o})/d(${e},${o})`),
                )!.variable;
                // The angle from c's direction off the edge to the direction
                // away from the parent face, in the parent's plane.
                const away = `(${k}*dot(${k},${q}-${o})-(${q}-${o}))`;
                const angle = auxiliary();
                define(
                    angle,
                    "expression",
                    "Expression",
                    [
                        "",
                        "",
                        "",
                        `(${f})*atan2(dot(${k},cross(${c}-${o},${away})),dot(${c}-${o},${away}))`,
                        "0",
                        "0",
                    ].map(literal),
                    "h:1",
                );
                return {
                    o,
                    k,
                    t: objects.get(angle)!.variable,
                    parent: net.parents[face],
                };
            });
            const vertexLabels = net.points.map(({ vertex, face }, index) => {
                let point = objects.get(vertex)!.variable;
                for (let turn = turns[face]; turn; turn = turns[turn.parent]) {
                    const { o, k, t } = turn;
                    point = objects.get(
                        formulaPoint(
                            `${o}+(${point}-${o})*cos(${t})+cross(${k},${point}-${o})*sin(${t})+${k}*dot(${k},${point}-${o})*(1-cos(${t}))`,
                        ),
                    )!.variable;
                }
                return formulaPoint(point, outputs[index] || auxiliary());
            });
            const edges = new Set<string>();
            let output = net.points.length + faces.length;
            net.faces.forEach((face, index) => {
                const vertices = face.map((point) => vertexLabels[point]);
                const label = outputs[net.points.length + index];
                if (label) definePolygon(label, vertices);
                face.forEach((point, position) => {
                    const next = face[(position + 1) % face.length];
                    const key = [point, next].sort().join();
                    if (edges.has(key)) return;
                    edges.add(key);
                    const label = outputs[output++];
                    if (label)
                        defineSegment(
                            label,
                            vertexLabels[point],
                            vertexLabels[next],
                        );
                });
            });
            return true;
        },
        // Pyramid(A, B, C, …, S): the base, then each lateral face V(i)V(i+1)S;
        // the base edges, then each lateral edge V(i)S. A plane cuts either
        // every lateral edge, or two base edges and the lateral edges in
        // between, so its section follows SV1, V1V2, SV2, V2V3, …
        Pyramid: (inputs, [solid, ...outputs]) => {
            if (inputs.length < 4 || !points(...inputs)) return false;
            const base = inputs.slice(0, -1);
            const apex = inputs[inputs.length - 1];
            const n = base.length;
            const faces = [
                base,
                ...base.map((vertex, index) => [
                    vertex,
                    base[(index + 1) % n],
                    apex,
                ]),
            ];
            faces.forEach((face, index) => {
                const label = outputs[index];
                if (label) definePolygon(label, face);
            });
            [
                ...base.map((vertex, index) => [vertex, base[(index + 1) % n]]),
                ...base.map((vertex) => [vertex, apex]),
            ].forEach(([p, q], index) => {
                const label = outputs[n + 1 + index];
                if (label) defineSegment(label, p, q);
            });
            polyhedra.set(
                solid,
                base.flatMap((vertex, index): [string, string][] => [
                    [apex, vertex],
                    [vertex, base[(index + 1) % n]],
                ]),
            );
            return true;
        },
        // Prism(A, B, C, …, P) or Prism(poly, P): P is the top vertex over A,
        // the others are translated by P - A. After the top vertices come the
        // base, the lateral faces V(i)V(i+1)W(i+1)W(i) and the top face, then
        // the base, lateral and top edges; the base and its edges are omitted
        // when it is an existing polygon.
        Prism: (inputs, [, ...outputs]) => {
            const polygon = polygons.get(inputs[0]);
            if (polygon ? inputs.length !== 2 : inputs.length < 4) return false;
            const base = polygon ?? inputs.slice(0, -1);
            const apex = inputs[inputs.length - 1];
            if (!points(...base, apex)) return false;
            const n = base.length;
            const shift = `${objects.get(apex)!.variable}-${objects.get(base[0])!.variable}`;
            const top = [
                apex,
                ...base.slice(1).map((vertex, index) => {
                    const label = outputs[index] || auxiliary();
                    formulaPoint(
                        `${objects.get(vertex)!.variable}+${shift}`,
                        label,
                    );
                    return label;
                }),
            ];
            const next = (index: number) => (index + 1) % n;
            const faces = [
                ...(polygon ? [] : [base]),
                ...base.map((vertex, index) => [
                    vertex,
                    base[next(index)],
                    top[next(index)],
                    top[index],
                ]),
                top,
            ];
            faces.forEach((face, index) => {
                const label = outputs[n - 1 + index];
                if (label) definePolygon(label, face);
            });
            [
                ...(polygon
                    ? []
                    : base.map((vertex, index) => [vertex, base[next(index)]])),
                ...base.map((vertex, index) => [vertex, top[index]]),
                ...top.map((vertex, index) => [vertex, top[next(index)]]),
            ].forEach(([p, q], index) => {
                const label = outputs[n - 1 + faces.length + index];
                if (label) defineSegment(label, p, q);
            });
            return true;
        },
        // Cylinder(A, B, r): the bottom and top disks as regular polygons,
        // defined first so that they own, and outline, the edges they share
        // with the lateral faces, which have no outline. (-sin θ, cos θ, 0),
        // θ = atan2(y, x) of AB, is a unit vector orthogonal to AB even when
        // AB is vertical, since atan2(0, 0) = 0.
        Cylinder: ([a, b, radius, extra], [solid, bottom, top, side]) => {
            const r = formula(radius, VALUE_KINDS);
            if (extra !== undefined || r === null || !points(a, b))
                return false;
            const [p, q] = [a, b].map((input) => objects.get(input)!.variable);
            const angle = `atan2(y(${q}-${p}),x(${q}-${p}))`;
            const u = objects.get(
                formulaPoint(`[-sin(${angle}),cos(${angle}),0]`),
            )!.variable;
            const v = objects.get(
                formulaPoint(`cross(${q}-${p},${u})/d(${p},${q})`),
            )!.variable;
            const rim = (center: string) =>
                Array.from({ length: CYLINDER_SIDES }, (_, index) => {
                    const t = (2 * Math.PI * index) / CYLINDER_SIDES;
                    return formulaPoint(
                        `${center}+(${r})*(${Math.cos(t)}*${u}+${Math.sin(t)}*${v})`,
                    );
                });
            const [lower, upper] = [p, q].map(rim);
            definePolygon(bottom || auxiliary(), lower);
            definePolygon(top || auxiliary(), upper);
            if (solid) solidCylinders.set(solid, [a, b, lower[0]]);
            if (side) cylinders.set(side, [a, b, lower[0]]);
            const element = elements.get(side);
            if (!element) return true;
            const style = [
                ...objectStyle(element, "polygon")
                    .split(";")
                    .filter((part) => !/^sn?:/.test(part)),
                "s:0",
            ].join(";");
            lower.forEach((vertex, index) => {
                const next = (index + 1) % CYLINDER_SIDES;
                definePolygon(
                    auxiliary(),
                    [vertex, lower[next], upper[next], upper[index]],
                    style,
                );
            });
            return true;
        },
        // Sphere(A, B) or Sphere(A, r), through B or A + (r, 0, 0).
        Sphere: ([center, through, extra], [label]) => {
            if (extra !== undefined || !points(center)) return false;
            let point = through;
            if (!points(through)) {
                const r = formula(through, VALUE_KINDS);
                if (r === null) return false;
                point = formulaPoint(
                    `${objects.get(center)!.variable}+[${r},0,0]`,
                );
            }
            spheres.set(label, [center, point]);
            return define(label, "sphere", "Sphere", [ref(center), ref(point)]);
        },
        // Plane(A, B, C): a square in plane ABC around the triangle's
        // centroid, along AB, at least as large as the floor and always
        // reaching past A, B and C. Plane(A, p): through A, parallel to p.
        // Plane(A, f): through A and f, normal to f's direction and to A's
        // reflection in f.
        Plane: (inputs, [label]) => {
            const parallel = planes.get(inputs[1]);
            if (inputs.length === 2 && points(inputs[0]) && parallel)
                return planeThrough(label, inputs[0], parallel.normal);
            const [point, line] = inputs;
            if (inputs.length === 2 && points(point) && is(line, ["line"])) {
                const [tip, image] = [auxiliary(), auxiliary()];
                define(tip, "point", "DirectionPoint", [ref(line), ref(point)]);
                define(image, "point", "Reflection", [ref(line), ref(point)]);
                const [a, t, r] = [point, tip, image].map(
                    (input) => objects.get(input)!.variable,
                );
                return planeThrough(label, point, `cross(${t}-${a},${r}-${a})`);
            }
            if (inputs.length !== 3 || !points(...inputs)) return false;
            const [a, b, c] = inputs.map(
                (input) => objects.get(input)!.variable,
            );
            const center = `(${a}+${b}+${c})/3`;
            return definePlane(
                label,
                center,
                `cross(${b}-${a},${c}-${a})`,
                `sqrt(25+d(${center},${a})^2+d(${center},${b})^2+d(${center},${c})^2)`,
                `(${b}-${a})/d(${a},${b})`,
            );
        },
        OrthogonalPlane: ([point, line, extra], [label]) => {
            if (extra !== undefined || !points(point) || !is(line, ["line"]))
                return false;
            const tip = auxiliary();
            define(tip, "point", "DirectionPoint", [ref(line), ref(point)]);
            const [p, q] = [point, tip].map(
                (input) => objects.get(input)!.variable,
            );
            return planeThrough(label, point, `(${q}-${p})`);
        },
        // The section of a pyramid by plane p, with a vertex where p cuts each
        // edge; the circle where p cuts a sphere; the part of the ellipse
        // where p cuts a cylinder that lies on its side; or the line where
        // planes p and q meet, defined like a line AB
        // by two points centered on the foot of the planes' centers'
        // midpoint, as far apart as the planes are wide, so its tips frame
        // them.
        IntersectPath: ([first, second, extra], [label, vertex]) => {
            const [p, q] = [first, second].map((input) => planes.get(input));
            const sphere = spheres.get(second);
            if (extra === undefined && p && sphere) {
                const [o, t] = sphere.map(
                    (input) => objects.get(input)!.variable,
                );
                return sphereSection(
                    label,
                    [o, t],
                    p.normal,
                    `${o}+${p.normal}*dot(${p.normal},${p.center}-${o})/dot(${p.normal},${p.normal})`,
                );
            }
            const cylinder =
                cylinders.get(second) ?? solidCylinders.get(second);
            if (extra === undefined && p && cylinder)
                return define(label, "section", "CylinderSection", [
                    ...cylinder.map(ref),
                    ...planePoints(p).map(ref),
                ]);
            const edges = polyhedra.get(second);
            if (extra === undefined && p && edges) {
                // GeoGebra names the section's vertices in turn, whichever
                // edges they lie on: they take its first vertex's style,
                // without a name.
                const element = elements.get(vertex);
                const style =
                    element &&
                    objectStyle(element, "point")
                        .split(";")
                        .filter((part) => part !== "sn:true")
                        .join(";");
                // asin(2t - 1) is undefined unless the plane cuts the edge.
                definePolygon(
                    label,
                    edges.map((ends) => {
                        const [a, b] = ends.map(
                            (end) => objects.get(end)!.variable,
                        );
                        const t = `dot(${p.normal},${p.center}-${a})/dot(${p.normal},${b}-${a})`;
                        return formulaPoint(
                            `${a}+(${b}-${a})*(${t}+0*asin(2*${t}-1))`,
                            auxiliary(),
                            style,
                        );
                    }),
                );
                push(null, "STL", [ref(label), literal("su:true")]);
                return true;
            }
            if (extra !== undefined || !p || !q) return false;
            const direction = `cross(${p.normal},${q.normal})`;
            const across = `cross(${p.normal},${direction})`;
            const onBoth = `(${p.center}+${across}*dot(${q.normal},${q.center}-${p.center})/dot(${q.normal},${across}))`;
            const foot = objects.get(
                formulaPoint(
                    `${onBoth}+${direction}*dot((${p.center}+${q.center})/2-${onBoth},${direction})/dot(${direction},${direction})`,
                ),
            )!.variable;
            const reach = `${direction}*(${p.half}+${q.half})/2/sqrt(dot(${direction},${direction}))`;
            return define(label, "line", "Line", [
                ref(formulaPoint(`${foot}-${reach}`)),
                ref(formulaPoint(`${foot}+${reach}`)),
            ]);
        },
        // A plane's section of a sphere, or the circle where two spheres meet,
        // in the plane orthogonal to their centers' line where the powers
        // of its points with respect to both spheres are equal.
        IntersectConic: ([first, second, extra], outputs) => {
            const [a, b] = [first, second].map((input) => spheres.get(input));
            if (extra !== undefined || !b) return false;
            if (!a) return HANDLERS.IntersectPath([first, second], outputs);
            const [o, t, p, q] = [...a, ...b].map(
                (input) => objects.get(input)!.variable,
            );
            return sphereSection(
                outputs[0],
                [o, t],
                `(${p}-${o})`,
                `${o}+(${p}-${o})*(d(${o},${p})^2+d(${o},${t})^2-d(${p},${q})^2)/(2*d(${o},${p})^2)`,
            );
        },
        Mirror: mirror,
        Reflect: mirror,
        // Rotate(P, a, C) as P + (R(a) - I)(P - C), which keeps P's height
        // in 3D; C defaults to the origin.
        Rotate: iterationImage(([source, angle, center, extra], [label]) => {
            const a = formula(angle, VALUE_KINDS);
            if (
                extra !== undefined ||
                a === null ||
                !points(source) ||
                (center !== undefined && !points(center))
            )
                return false;
            const p = objects.get(source)!.variable;
            const c = center && objects.get(center)!.variable;
            const [dx, dy] = c
                ? [`(x(${p})-x(${c}))`, `(y(${p})-y(${c}))`]
                : [`x(${p})`, `y(${p})`];
            formulaPoint(
                `${p}+${planar(
                    `(cos(${a})-1)*${dx}-sin(${a})*${dy}`,
                    `sin(${a})*${dx}+(cos(${a})-1)*${dy}`,
                )}`,
                label,
            );
            return true;
        }),
        Dilate: iterationImage(([source, factor, center, extra], [label]) => {
            const k = formula(factor, VALUE_KINDS);
            if (
                extra !== undefined ||
                k === null ||
                !points(source) ||
                (center !== undefined && !points(center))
            )
                return false;
            const p = objects.get(source)!.variable;
            const c = center && objects.get(center)!.variable;
            formulaPoint(c ? `${c}+(${p}-${c})*(${k})` : `${p}*(${k})`, label);
            return true;
        }),
        Vector: ([p, q], [label]) => {
            if (!points(p, q)) return false;
            vectors.set(label, [p, q]);
            return define(label, "line", "Vector", [ref(p), ref(q)]);
        },
        Translate: iterationImage(([source, vector, extra], [label]) => {
            const ends = vectors.get(vector);
            if (extra !== undefined || !ends || !points(source)) return false;
            const [p, a, b] = [source, ...ends].map(
                (input) => objects.get(input)!.variable,
            );
            formulaPoint(`${p}+${b}-${a}`, label);
            return true;
        }),
        // Iteration(Flatten(Zip({f1(k), f2(k), …}, k, m)), m, {s1, …}, n):
        // n times, each segment k is replaced by its images f1(k), f2(k), …
        Iteration: ([expression, variable, start, count, extra], [label]) => {
            const flatten = commandCall(normalizeBrackets(expression));
            const zip =
                flatten?.[0] === "Flatten" && flatten[1].length === 1
                    ? commandCall(flatten[1][0])
                    : null;
            const [images, segment, list, rest] =
                zip?.[0] === "Zip" ? zip[1] : [];
            const ends = splitArguments(start.replace(/[{}]/g, ""))?.map(
                (input) => segments.get(input),
            );
            const levels = formula(count ?? "", VALUE_KINDS);
            if (
                extra !== undefined ||
                rest !== undefined ||
                list !== variable ||
                !/^\{.*\}$/.test(images ?? "") ||
                !ends?.every(Boolean) ||
                levels === null
            )
                return false;
            const maps = splitArguments(images.slice(1, -1))!.map((image) =>
                localValue(image, segment),
            );
            return (
                maps.every((map) => map !== null && isSegment(map)) &&
                defineIteration(
                    label,
                    ends as string[][],
                    levels,
                    maps as SegmentMap[],
                )
            );
        },
        // Sequence(f(i), i, a, b, s): the List of f(a), f(a + s), … up to b,
        // f being a point or a segment.
        Sequence: (
            [expression, variable, from, to, step = "1", extra],
            [label],
        ) => {
            const [a, b, s] = [from, to, step].map((bound) =>
                formula(bound ?? "", VALUE_KINDS),
            );
            if (
                extra !== undefined ||
                is3D ||
                a === null ||
                b === null ||
                s === null ||
                !IDENTIFIER.test(variable)
            )
                return false;
            const call = commandCall(normalizeBrackets(expression));
            const ends =
                call?.[0] === "Segment" && call[1].length === 2
                    ? call[1]
                    : [expression];
            const locals = new Map([[variable, `${a}+k*(${s})`]]);
            const formulas = ends.map((end) =>
                formula(end, VALUE_KINDS, locals),
            );
            if (formulas.some((value) => value === null)) return false;
            const element = elements.get(label);
            const size = element && attribute(element, "pointSize", "val");
            return define(
                label,
                "list",
                "List",
                [
                    literal(ends.length === 2 ? "segment" : "point"),
                    // Rounded by the List: floor(r) + 1 values, with a margin
                    // for r's rounding errors.
                    literal(`((${b})-(${a}))/(${s})+0.500001`),
                    ...formulas.map((value) => literal(value!)),
                ],
                element &&
                    `${objectStyle(element, "list")}${ends.length === 1 && size ? `;s:${size}` : ""}`,
            );
        },
        // IterationList(f(z), z, {s}, n): s, f(s), f(f(s)), … n times,
        // computed by a hidden Expression's script.
        IterationList: (
            [expression, variable, start, count, extra],
            [label],
        ) => {
            const s = formula(start.replace(/^\{(.*)\}$/, "$1"), VALUE_KINDS);
            const n = formula(count ?? "", VALUE_KINDS);
            const f = formula(
                expression,
                VALUE_KINDS,
                new Map([[variable, "$t[$n]"]]),
            );
            if (extra !== undefined || s === null || n === null || f === null)
                return false;
            const terms = auxiliary();
            define(
                terms,
                "expression",
                "Expression",
                [
                    "",
                    "",
                    "",
                    `var $t=[${s}];for(var $n=0;$n<${n};$n++){$t.push(${f})};$t`,
                    "0",
                    "0",
                ].map(literal),
                "h:1",
            );
            const list = {
                count: `(${n})+1`,
                item: (k: string) =>
                    `${objects.get(terms)!.variable}[(${k})-1]`,
            };
            lists.set(label, list);
            const element = elements.get(label);
            const size = element && attribute(element, "pointSize", "val");
            return define(
                label,
                "list",
                "List",
                [
                    literal("point"),
                    literal(list.count),
                    literal(list.item("k+1")),
                ],
                element &&
                    `${objectStyle(element, "list")}${size ? `;s:${size}` : ""}`,
            );
        },
        // An input box of a number, at its top left corner.
        Textfield: ([linked, extra], [label]) => {
            const element = elements.get(label);
            if (!element || extra !== undefined || !is(linked, ["expression"]))
                return false;
            const [x, y] = screenPosition(
                Number(attribute(element, "labelOffset", "x") ?? 0),
                Number(attribute(element, "labelOffset", "y") ?? 0),
                true,
            );
            return define(
                label,
                "expression",
                "Expression",
                [
                    "",
                    "",
                    "",
                    objects.get(linked)!.variable,
                    String(x),
                    String(y),
                ].map(literal),
                `${textStyle(element)};iB:${attribute(element, "length", "val") ?? 20}`,
            );
        },
        If: (inputs, [label]) => {
            const element = elements.get(label);
            const type = element?.getAttribute("type");
            const content = ifFormula(inputs, VALUE_KINDS);
            if (!element || content === null) return false;
            if (type === "point" || type === "point3d") {
                formulaPoint(content, label);
                return true;
            }
            if (type === "numeric")
                return define(
                    label,
                    "expression",
                    "Expression",
                    ["", "", "", content, "0", "0"].map(literal),
                    expressionStyle(element, false),
                );
            return type === "text" && textExpression(label, element, content);
        },
        Locus: ([p, q, extra], [label]) =>
            extra === undefined &&
            points(p) &&
            is(q, ["pointOn"]) &&
            define(label, "locus", "Locus", [ref(p), ref(q)]),
    };

    const expressionStyle = (element: Element, slider: boolean): string => {
        const parts = [`p:${decimals}`, `f:${fontSize}`];
        const color = child(element, "objColor");
        if (color) {
            const hex = hexColor(color);
            parts.push(`c:${hex}`, `cPT:${btoa(`c:${hex};o:1`)}`);
        }
        if (!slider || attribute(element, "show", "object") === "false")
            parts.push("h:1");
        const thickness = attribute(element, "lineStyle", "thickness");
        if (thickness) parts.push(`s:${Number(thickness) / 2}`);
        const width = attribute(element, "slider", "width");
        if (width) parts.push(`cL:${width}`);
        if (slider)
            parts.push(
                `i:${attribute(element, "animation", "step") ?? DEFAULT_SLIDER_STEP}`,
            );
        if (attribute(element, "slider", "horizontal") === "false")
            parts.push("cV:true");
        return parts.join(";");
    };

    const numeric = (label: string, element: Element): boolean => {
        const slider = child(element, "slider");
        const source = expressions.get(label);
        const value = attribute(element, "value", "val") ?? "";
        const style = expressionStyle(element, !!slider);
        if (slider) {
            const [min, max] = ["min", "max"].map((bound) =>
                formula(slider.getAttribute(bound) ?? "", [], savedNumbers),
            );
            if (min === null || max === null || !NUMBER.test(value))
                return false;
            const [x, y] = sliderScreen(slider);
            define(
                label,
                "expression",
                "Expression",
                ["", min, max, value, String(x), String(y)].map(literal),
                style,
            );
            animate(label);
            return true;
        }
        const dependent =
            source === undefined ? null : formula(source, VALUE_KINDS);
        const content =
            dependent !== null &&
            formulaIdentifiers(parseFormula(dependent)).size > 0
                ? dependent
                : value;
        if (content !== dependent && !NUMBER.test(content)) return false;
        return define(
            label,
            "expression",
            "Expression",
            ["", "", "", content, "0", "0"].map(literal),
            style,
        );
    };

    // A text's literal strings and formulas: GeoGebra adds up the numbers
    // before its first string, then concatenates every term. An angle would
    // need GeoGebra's degree formatting: not supported.
    const textParts = (source: string): TextPart[] | null => {
        const parts: TextPart[] = [];
        let concatenating = false;
        let sum: string[] = [];
        const addSum = (): boolean => {
            if (sum.length === 0) return true;
            const value = formula(sum.join("+"), ["expression", "polygon"]);
            sum = [];
            if (value === null) return false;
            parts.push({ formula: value });
            return true;
        };
        for (const term of textTerms(source)) {
            if (/^"[^"]*"$/.test(term)) {
                if (!addSum()) return null;
                parts.push(term.slice(1, -1));
                concatenating = true;
                continue;
            }
            const words = term.match(/[^\s+\-*/^(),]+/g) ?? [];
            if (
                words.some(
                    (word) =>
                        elements.get(word)?.getAttribute("type") === "angle",
                )
            )
                return null;
            sum.push(term);
            if (concatenating && !addSum()) return null;
        }
        return addSum() ? parts : null;
    };

    const textStyle = (element: Element): string => {
        const color = child(element, "objColor");
        return [
            ...(color ? [`c:${hexColor(color)}`] : []),
            ...(attribute(element, "show", "object") === "false"
                ? ["h:1"]
                : []),
            `p:${decimals}`,
            `f:${fontSize * Number(attribute(element, "font", "sizeM") ?? 1)}`,
        ].join(";");
    };

    // A text pinned on screen, or hidden, as an Expression whose value is
    // its string: DGPad's Expressions stay where they are on screen.
    const textExpression = (
        label: string,
        element: Element,
        content: string,
    ): boolean => {
        const location = child(element, "absoluteScreenLocation");
        if (!location && attribute(element, "show", "object") !== "false")
            return false;
        const [x, y] = location
            ? screenPosition(
                  Number(location.getAttribute("x")),
                  Number(location.getAttribute("y")),
                  true,
              )
            : [0, 0];
        return define(
            label,
            "expression",
            "Expression",
            ["", "", "", content, String(x), String(y)].map(literal),
            `${textStyle(element)}${attribute(element, "isLaTeX", "val") === "true" ? ";tx:true" : ""}`,
        );
    };

    // KaTeX, which renders texts inline, only takes GeoGebra's align and
    // gather environments as aligned and gathered.
    const inlineTeX = (tex: string): string =>
        tex.replace(/\\(begin|end)\{(align|gather)\*?\}/g, "\\$1{$2ed}");

    const text = (label: string, element: Element, source: string): boolean => {
        const parts = textParts(source);
        if (parts === null) return false;
        const latex = attribute(element, "isLaTeX", "val") === "true";
        if (child(element, "absoluteScreenLocation") || latex)
            return textExpression(
                label,
                element,
                `""${parts
                    .map((part) =>
                        typeof part === "string"
                            ? `+"${(latex ? inlineTeX(part) : part).replace(/[\\"]/g, "\\$&")}"`
                            : `+(${part.formula})`,
                    )
                    .join("")}`,
            );
        const start = child(element, "startPoint");
        const exp = start?.getAttribute("exp");
        const anchor = exp ? resolve(exp) : auxiliary();
        if (!exp) {
            const [x, y, z] = ["x", "y", "z"].map((name) =>
                Number(start?.getAttribute(name) ?? (name === "z" ? 1 : 0)),
            );
            define(anchor, "point", "Point", vectorLiteral([x / z, y / z, 0]));
        }
        if (!points(anchor)) return false;
        return define(
            label,
            "text",
            "AnchoredText",
            [
                ref(anchor),
                literal(Number(attribute(element, "labelOffset", "x") ?? 0)),
                literal(Number(attribute(element, "labelOffset", "y") ?? 0)),
                literal(
                    parts
                        .map((part) =>
                            typeof part === "string"
                                ? part.replace(/%/g, "%%")
                                : `%${part.formula}%`,
                        )
                        .join(""),
                ),
            ],
            textStyle(element),
        );
    };

    // GeoGebra drags a point "(xExpression, yExpression)" by shifting each
    // coordinate written "n" or "n + rest", n being a free, unfixed number
    // (not "rest + n", nor "n + rest - 1", whose top operation isn't that
    // plus).
    const changeableNumber = (coordinate: string): string | null => {
        const [, label, rest] =
            /^([^\s+]+)\s*(?:\+(.*))?$/.exec(coordinate) ?? [];
        const element = elements.get(label);
        const source = expressions.get(label);
        return element?.getAttribute("type") === "numeric" &&
            is(label, ["expression"]) &&
            !commandOutputs.has(label) &&
            (source === undefined || NUMBER.test(source)) &&
            attribute(element, "fixed", "val") !== "true" &&
            (rest === undefined || !hasTopLevelSum(rest))
            ? objects.get(label)!.variable
            : null;
    };

    const independent = (label: string, element: Element): boolean => {
        const type = element.getAttribute("type");
        const source = expressions.get(label);
        if (type === "point" || type === "point3d") {
            // A constant, such as the complex number "1 + (2 * ί)", is a
            // free point.
            if (
                source !== undefined &&
                !NUMERIC_TUPLE.test(source) &&
                formula(source, []) === null
            ) {
                const coords = formula(source, VALUE_KINDS);
                if (coords === null) return false;
                define(label, "point", "Point", [
                    literal(coords),
                    literal("0"),
                ]);
                const text = source.trim();
                const tuple =
                    text.startsWith("(") &&
                    text.endsWith(")") &&
                    splitArguments(text.slice(1, -1));
                const numbers =
                    tuple && tuple.length === 2
                        ? tuple.map(changeableNumber)
                        : [null, null];
                if (numbers.some(Boolean))
                    handles.set(
                        objects.get(label)!.variable,
                        numbers as [string | null, string | null],
                    );
                return true;
            }
            const coords = pointCoords(element);
            if (!coords) return false;
            if (attribute(element, "fixed", "val") === "true")
                return define(label, "point", "Point", vectorLiteral(coords));
            return define(
                label,
                "point",
                "Point",
                (is3D ? coords : coords.slice(0, 2)).map(literal),
                gridIncrement && !is3D
                    ? `${objectStyle(element, "point")};i:${gridIncrement}`
                    : undefined,
            );
        }
        // GeoGebra saves a conic as A0x² + A1y² + A2 + 2A3xy + 2A4x + 2A5y
        // = 0: a circle when A0 = A1 and A3 = 0.
        if (type === "conic" && !is3D) {
            const [a0, a1, a2, a3, a4, a5] = [0, 1, 2, 3, 4, 5].map((index) =>
                Number(attribute(element, "matrix", `A${index}`)),
            );
            const r2 = (a4 * a4 + a5 * a5) / (a0 * a0) - a2 / a0;
            if (a0 === 0 || a0 !== a1 || a3 !== 0 || !(r2 > 0)) return false;
            const center = auxiliary();
            define(
                center,
                "point",
                "Point",
                vectorLiteral([-a4 / a0, -a5 / a0, 0]),
            );
            return define(label, "circle", "Circle1", [
                ref(center),
                literal(String(Math.sqrt(r2))),
            ]);
        }
        if (type === "numeric" || type === "angle")
            return numeric(label, element);
        if (type === "text" && source !== undefined)
            return text(label, element, source);
        // A list of points is drawn, other lists only read by formulas.
        if (type === "list" && source !== undefined) {
            const list = listFormula(source);
            if (!list) return false;
            lists.set(label, list);
            if (attribute(element, "listType", "val") !== "point") return true;
            const item = list.item("k+1");
            const size = attribute(element, "pointSize", "val");
            return (
                item !== null &&
                define(
                    label,
                    "list",
                    "List",
                    [literal("point"), literal(list.count), literal(item)],
                    `${objectStyle(element, "list")}${size ? `;s:${size}` : ""}`,
                )
            );
        }
        // Scripts never run: a button has nothing to do.
        if (type === "button") return true;
        // An independent boolean is a checkbox, at its label's place on
        // screen.
        if (type === "boolean" && source === undefined) {
            const offset = child(element, "labelOffset");
            const [x, y] = screenPosition(
                Number(offset?.getAttribute("x") ?? 0),
                Number(offset?.getAttribute("y") ?? 0),
                true,
            );
            return define(
                label,
                "expression",
                "Expression",
                [
                    attribute(element, "caption", "val") ?? label,
                    "",
                    "",
                    attribute(element, "value", "val") === "true" ? "1" : "0",
                    String(x),
                    String(y),
                ].map(literal),
                `${textStyle(element)};cB:true`,
            );
        }
        if (type === "image") {
            const image = images.get(attribute(element, "file", "name") ?? "");
            const corners: string[] = [];
            [...element.children].forEach((start) => {
                if (start.tagName !== "startPoint") return;
                const exp = start.getAttribute("exp");
                let corner = exp && resolve(exp);
                if (!corner) {
                    corner = auxiliary();
                    const [x, y, z] = ["x", "y", "z"].map((name) =>
                        Number(start.getAttribute(name) ?? 1),
                    );
                    define(
                        corner,
                        "point",
                        "Point",
                        vectorLiteral([x / z, y / z, 0]),
                    );
                }
                corners[Number(start.getAttribute("number") ?? 0)] = corner;
            });
            return (
                !!image &&
                corners.length >= 2 &&
                points(...corners) &&
                define(label, "image", "Image", [
                    literal(image.url),
                    literal(image.width),
                    literal(image.height),
                    ...corners.map(ref),
                ])
            );
        }
        if (type === "function" && source !== undefined) {
            const body = formula(
                source.replace(FUNCTION_DEFINITION, ""),
                ["expression"],
                new Map([["x", "x"]]),
            );
            return (
                body !== null &&
                define(label, "curve", "Curvus", [
                    literal(""),
                    literal(""),
                    literal(body),
                ])
            );
        }
        return false;
    };

    const view3D = is3D ? document.querySelector("euclidianView3D") : null;
    const coordSystem3D = view3D && child(view3D, "coordSystem");
    const degrees = (name: string): number =>
        (Number(coordSystem3D!.getAttribute(name)) * Math.PI) / 180;
    // GeoGebra rotates the scene by zAngle around Oz, then tilts it by
    // xAngle: in DGP's projection (see projection.ts), that's phi = -zAngle
    // and theta = xAngle.
    const camera: GgbView3D | undefined = coordSystem3D
        ? {
              phi: -degrees("zAngle"),
              theta: degrees("xAngle"),
              unit: Number(coordSystem3D.getAttribute("scale")),
              offset: [
                  Number(coordSystem3D.getAttribute("xZero")),
                  Number(coordSystem3D.getAttribute("yZero")),
                  Number(coordSystem3D.getAttribute("zZero")),
              ],
          }
        : undefined;
    const styledView = view3D ?? view;
    if (!is3D && coordSystem)
        push(null, "SetCoords", [
            literal(origin[0]),
            literal(origin[1]),
            literal(unit),
            { type: "literal", value: false },
            literal(Number(attribute(view!, "size", "width") ?? 0)),
            literal(Number(attribute(view!, "size", "height") ?? 0)),
        ]);
    if (styledView) {
        const axesColor = child(styledView, "axesColor");
        const axes = attribute(styledView, "evSettings", "axes") === "true";
        const grid = attribute(styledView, "evSettings", "grid") === "true";
        const axisShown = (id: string): boolean =>
            axes &&
            [...styledView.children]
                .find(
                    (item) =>
                        item.tagName === "axis" &&
                        item.getAttribute("id") === id,
                )
                ?.getAttribute("show") !== "false";
        push(null, "SetCoordsStyle", [
            literal(
                `isAxis:${axes || (grid && !is3D)};isGrid:${grid};isOx:${axisShown("0")};isOy:${axisShown("1")}${
                    axesColor ? `;color:${hexColor(axesColor)}` : ""
                }`,
            ),
        ]);
    }
    const background = styledView && child(styledView, "bgColor");
    // GeoGebra's functions work in radians.
    push(null, "SetGeneralStyle", [
        literal(
            `degree:false${background ? `;background-color:${hexColor(background)}` : ""}`,
        ),
    ]);

    // A command input that isn't an existing label may be a nested command
    // (e.g. "Segment[A, B]") or a point, constant or not (e.g. "(t, 0)"):
    // built as a hidden auxiliary object, like GeoGebra does.
    const resolve = (input: string): string => {
        if (objects.has(input)) return input;
        const text = normalizeBrackets(input.trim());
        const axis = AXES[text];
        if (axis) {
            const [origin, tip] = [[0, 0, 0] as Vec3, axis].map((coords) => {
                const point = auxiliary();
                define(point, "point", "Point", vectorLiteral(coords));
                return point;
            });
            define(text, "line", "Line", [ref(origin), ref(tip)]);
            return text;
        }
        const label = auxiliary();
        if (NUMERIC_TUPLE.test(text)) {
            const [x, y, z] = text.slice(1, -1).split(",").map(Number);
            define(label, "point", "Point", vectorLiteral([x, y, z ?? 0]));
            return label;
        }
        const tuple =
            text.startsWith("(") &&
            text.endsWith(")") &&
            splitArguments(text.slice(1, -1));
        const coords =
            tuple && tuple.length > 1 ? formula(text, VALUE_KINDS) : null;
        if (coords !== null) return formulaPoint(coords, label);
        const call = commandCall(text);
        return call && HANDLERS[call[0]]?.(call[1].map(resolve), [label])
            ? label
            : input;
    };

    const translated = new Set<string>();
    const translate = (node: Element): void => {
        if (node.tagName === "command") {
            const name = node.getAttribute("name") ?? "";
            const sources = indexedAttributes(child(node, "input"));
            const outputs = indexedAttributes(child(node, "output"));
            const handler = HANDLERS[name];
            // Without any output, GeoGebra failed to evaluate the command:
            // it builds nothing.
            if (
                outputs.some(Boolean) &&
                !handler?.(sources.map(resolve), outputs)
            )
                unsupported.push(`${name}(${sources.join(", ")})`);
            outputs.forEach((output) => translated.add(output));
        } else {
            const label = node.getAttribute("label") ?? "";
            if (!independent(label, node))
                unsupported.push(`${node.getAttribute("type")} ${label}`);
            translated.add(label);
        }
    };
    // GeoGebra may save an object before those it reads, e.g. a
    // spreadsheet's CellRange before its cells: it is translated once they
    // are.
    const pending: { node: Element; reads: string[] }[] = [];
    [...construction.children].forEach((node) => {
        const label = node.getAttribute("label") ?? "";
        const source =
            node.tagName === "command"
                ? indexedAttributes(child(node, "input")).join(",")
                : node.tagName === "element" && !commandOutputs.has(label)
                  ? (expressions.get(label) ?? "")
                  : null;
        if (source === null) return;
        const reads = (
            source.replace(/"[^"]*"/g, "").match(LABEL_WORDS) ?? []
        ).filter(
            (word) =>
                (elements.has(word) || commandOutputs.has(word)) &&
                !translated.has(word),
        );
        pending.push({ node, reads });
        for (let index = 0; index < pending.length;) {
            if (pending[index].reads.every((word) => translated.has(word))) {
                translate(pending.splice(index, 1)[0].node);
                index = 0;
            } else index++;
        }
    });
    pending.forEach(({ node }) => translate(node));

    // Once every object exists, since a condition may read a later one. It
    // then decides alone whether the object is shown, whatever its show
    // flag (see GeoElement.isEuclidianVisible), except for a number without
    // a slider, which is never drawn.
    const conditions = new Map<string, string | null>();
    elements.forEach((element, label) => {
        const source = attribute(element, "condition", "showObject");
        if (
            source === undefined ||
            !objects.has(label) ||
            (element.getAttribute("type") === "numeric" &&
                !child(element, "slider"))
        )
            return;
        if (!conditions.has(source)) {
            const content = formula(source, VALUE_KINDS);
            if (content === null) {
                unsupported.push(`condition ${source}`);
                conditions.set(source, null);
            } else {
                const condition = auxiliary();
                define(
                    condition,
                    "expression",
                    "Expression",
                    ["", "", "", content, "0", "0"].map(literal),
                    "h:1",
                );
                conditions.set(source, objects.get(condition)!.variable);
            }
        }
        const condition = conditions.get(source);
        if (condition)
            push(null, "STL", [ref(label), literal(`h:0;sc:${condition}`)]);
    });

    return {
        calls,
        targets,
        handles,
        animations,
        startAnimation:
            document
                .querySelector("kernel > startAnimation")
                ?.getAttribute("val") === "true",
        unsupported,
        is3D,
        view3D: camera,
    };
}
