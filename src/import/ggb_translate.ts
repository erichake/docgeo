import type { Animation } from "../animation";
import type { SegmentMap } from "../objects/iteration_object";
import { CURSOR_OFFSET_Y } from "../objects/expression_object";
import { vAdd, vSub, type Vec2, type Vec3 } from "../vec";
import {
    evaluateFormula,
    formulaIdentifiers,
    IDENTIFIER_PART,
    IDENTIFIER_START,
    NO_VIEW,
    parseFormula,
    realPart,
    usesView,
} from "./dgp_formula";
import type { DgpCall, DgpValue } from "./dgp_parser";

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
    | "image"
    | "polyhedron";

// What a transformation maps as a whole, its image of the same kind.
const MAPPED_KINDS: Kind[] = [
    "line",
    "circle",
    "polygon",
    "quadric",
    "sphere",
    "polyhedron",
];

// Values computed when first read: the points of an object's image, built
// only if a later command reads them.
class LazyMap<V> extends Map<string, V> {
    private thunks = new Map<string, () => V>();

    defer(key: string, thunk: () => V): void {
        this.thunks.set(key, thunk);
    }

    get(key: string): V | undefined {
        const thunk = this.thunks.get(key);
        if (thunk) {
            this.thunks.delete(key);
            this.set(key, thunk());
        }
        return super.get(key);
    }

    has(key: string): boolean {
        return this.thunks.has(key) || super.has(key);
    }
}

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
    // Where GeoGebra moved the name of an object other than a point, in
    // pixels from its default place (see anchorName).
    nameShifts: Map<string, Vec2>;
    unsupported: string[];
    // The animations of points on paths and sliders that GeoGebra plays,
    // started with the figure if `startAnimation`.
    animations: Map<string, Animation>;
    // The number whose value multiplies an animation's speed, if it depends
    // on the figure.
    rates: Map<string, string>;
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
    // A list of lists: its n-th list, its item being null.
    sub?: (n: string) => ListFormula | null;
}

export interface GgbView3D {
    phi: number;
    theta: number;
    unit: number;
    // Translation of the world origin, in world units, from the center of
    // the view.
    offset: Vec3;
    // In pixels, the view's center from the window's.
    shift: Vec2;
}

const IDENTIFIER = new RegExp(
    `^${IDENTIFIER_START.source}${IDENTIFIER_PART.source}*$`,
    "u",
);
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const NUMERIC_TUPLE =
    /^\(\s*[+-]?[\d.]+(?:[eE][+-]?\d+)?\s*(?:,\s*[+-]?[\d.]+(?:[eE][+-]?\d+)?\s*){1,2}\)$/;
const THREE_D_TYPES = /3d$|^polyhedron$/;
// GeoGebra's dash patterns by line type (EuclidianStatic.getStroke), for a
// stroke `width` pixels wide.
const GGB_DASHES: Record<string, (width: number) => number[]> = {
    10: (width) => [4 + width, 4],
    15: (width) => [8 + width, 8],
    20: (width) => [width, 3],
    30: (width) => [8 + width, 4, width, 4],
};
const COMMAND_EXPRESSION = /^([A-Za-z]+)\((.*)\)$/;
// The commands a formula rewrites as a whole (see commandFormula).
const FORMULA_COMMANDS = new Set([
    "Vector",
    "OrthogonalVector",
    "UnitVector",
    "If",
    "Element",
    "Sum",
    "LaTeX",
    "Corner",
    "FractionText",
    "Slope",
    "Length",
    "PathParameter",
    "Rotate",
    "Translate",
]);
// The commands whose list listFormula reads from their own sources.
const LIST_COMMANDS = new Set(["Take", "First", "Last", "Mode"]);
const BINDING_COMMANDS = new Set(["Sequence", "IterationList", "Iteration"]);
const CELL = /^([A-Z]+)(\d+)$/;
// A GeoGebra label, which may have primes and braced indices: "A'_{1}".
const LABEL_WORDS =
    /[$_\p{ID_Start}](?:_\{[^{}]*\}|[$'\u200c\u200d\p{ID_Continue}])*/gu;
const LABEL = new RegExp(`^${LABEL_WORDS.source}`, "u");
// A parenthesis without any other inside, after the name of what it calls.
const INNERMOST = new RegExp(`(${LABEL_WORDS.source}\\s*)?\\(([^()]*)\\)`, "u");
// Applied to a list, GeoGebra's functions apply to each of its items.
const ITEM_FUNCTIONS: Record<string, string> = {
    real: "x",
    imaginary: "y",
    x: "x",
    y: "y",
};
const FUNCTION_DEFINITION = /^[^=]*\(\s*x\s*\)\s*=/;
// A function GeoGebra has but DGP formulas don't, written with theirs, its
// arguments being already translated.
type Expansion = (args: string[]) => string;
// The value of a formula that reads neither the figure nor the window.
const evaluateConstant = (source: string): number | null =>
    realPart(
        evaluateFormula(parseFormula(source), {
            resolveIdentifier: () => null,
            view: () => NO_VIEW,
        }),
    );
const FUNCTIONS: Record<string, string | Expansion> = {
    Distance: "d",
    exp: "exp",
    ln: "log",
    log: ([a, b]) => (b ? `(log(${b})/log(${a}))` : `log(${a})`),
    round: ([a, n]) =>
        n ? `(round((${a})*10^(${n}))/10^(${n}))` : `round(${a})`,
    ceil: "ceil",
    sgn: ([a]) => `(((${a})>0)-((${a})<0))`,
    cot: ([a]) => `(1/tan(${a}))`,
    min: "min",
    max: "max",
    Min: "min",
    Max: "max",
    // GeoGebra's modulo is never negative.
    Mod: ([a, b]) => `((${a})-floor((${a})/(${b}))*(${b}))`,
    z: ([a]) => `dot(${a},[0,0,1])`,
    // Drawn once, at import, between constant bounds: GeoGebra saves no
    // value for a random number in a function (a "?" fails the formula).
    Random: (bounds) => {
        const [a, b] = bounds.map(evaluateConstant);
        return a === null || b === null
            ? "?"
            : String(Math.floor(a + Math.random() * (b - a + 1)));
    },
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
// Numerical analysis: a derivative's step, the intervals of an integral's
// Simpson rule and of its drawn region, and the samples an interval's
// extremum is sought among for a lower or upper sum.
const DERIVATIVE_STEP = 1e-4;
const SIMPSON_INTERVALS = 1000;
const REGION_INTERVALS = 200;
const EXTREMUM_SAMPLES = 16;
// The samples among which a function's roots are sought.
const ROOT_SAMPLES = 200;
const VALUE_KINDS: Kind[] = ["point", "pointOn", "expression"];
// Its terms, each a coefficient and a monomial, written as a teacher
// would: "x - 2y + 3".
const polynomial = (terms: [number, string][]): string =>
    terms
        .filter(([k]) => k !== 0)
        .map(
            ([k, monomial], index) =>
                (k < 0 ? (index ? " - " : "-") : index ? " + " : "") +
                (Math.abs(k) === 1 && monomial ? "" : Math.abs(k)) +
                monomial,
        )
        .join("") || "0";

// A plane's equation keeps x, y and z.
const PLANE_VARIABLES = new Map(["x", "y", "z"].map((name) => [name, name]));
// An equation's x and y stay its variables, z of the plane is 0.
const EQUATION_VARIABLES = new Map([
    ["x", "x"],
    ["y", "y"],
    ["z", "0"],
]);
// A text also reads a polygon, as its area.
const TEXT_KINDS: Kind[] = [...VALUE_KINDS, "polygon"];

const literal = (value: string | number | boolean): DgpValue => ({
    type: "literal",
    value,
});

// A control's caption, or its name. Its LaTeX is only text in real figures:
// `$\text{Réponse}$`, `$\bold{A\;B}$`.
const caption = (element: Element, label: string): string => {
    const text = attribute(element, "caption", "val") ?? label;
    return /^\$.*\$$/.test(text)
        ? text
              .slice(1, -1)
              .replace(/\\[;,: \\]/g, " ")
              .replace(/\\(?:text|sf|bold|mathbf|mathrm|rm)\b|[{}]/g, "")
        : text;
};

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

// Replaces each command of a user-defined tool (geogebra_macro.xml) by the
// tool's construction, its inputs and outputs renamed to the command's and
// its other objects to fresh ones, hidden as GeoGebra doesn't have them.
function expandMacros(construction: Element, xml: string): void {
    const macros = new Map(
        [
            ...new DOMParser()
                .parseFromString(xml, "application/xml")
                .querySelectorAll("macro"),
        ].map((macro) => [macro.getAttribute("cmdName"), macro]),
    );
    const outputsOf = (node: Element): string[] =>
        node.tagName === "command"
            ? indexedAttributes(child(node, "output"))
            : [node.getAttribute("label") ?? ""];
    const used = new Set([...construction.children].flatMap(outputsOf));
    const words = new RegExp(`"[^"]*"|${LABEL_WORDS.source}`, "gu");
    let node = construction.firstElementChild;
    while (node) {
        const macro =
            node.tagName === "command" && macros.get(node.getAttribute("name"));
        if (!macro) {
            node = node.nextElementSibling;
            continue;
        }
        const names = new Map<string, string>();
        const inputs = indexedAttributes(child(macro, "macroInput"));
        const outputs = indexedAttributes(child(macro, "macroOutput"));
        const sources = indexedAttributes(child(node, "input"));
        const labels = indexedAttributes(child(node, "output"));
        inputs.forEach((input, index) => {
            const source = sources[index] ?? "";
            names.set(
                input,
                LABEL.exec(source)?.[0] === source ? source : `(${source})`,
            );
        });
        outputs.forEach(
            (output, index) =>
                labels[index] && names.set(output, labels[index]),
        );
        const body = [...child(macro, "construction")!.children];
        body.flatMap(outputsOf).forEach((label) => {
            if (names.has(label)) return;
            let index = 1;
            while (used.has(`${label}_{${index}}`)) index++;
            used.add(`${label}_{${index}}`);
            names.set(label, `${label}_{${index}}`);
        });
        const rename = (text: string) =>
            text.replace(words, (word) => names.get(word) ?? word);
        let first: Element | null = null;
        for (const source of body) {
            const [label] = outputsOf(source);
            if (
                inputs.includes(label) ||
                (source.tagName === "element" && outputs.includes(label))
            )
                continue;
            const copy = construction.ownerDocument.importNode(source, true);
            for (const item of [copy, ...copy.querySelectorAll("*")])
                for (const attr of item.attributes)
                    if (
                        ["input", "output"].includes(item.tagName) ||
                        ["label", "exp", "showObject"].includes(attr.name)
                    )
                        attr.value = rename(attr.value);
            if (copy.tagName === "element") {
                const show =
                    child(copy, "show") ??
                    copy.appendChild(
                        construction.ownerDocument.createElement("show"),
                    );
                show.setAttribute("object", "false");
            }
            construction.insertBefore(copy, node);
            first ??= copy;
        }
        const next = first ?? node.nextElementSibling;
        node.remove();
        node = next;
    }
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

// GeoGebra's net of a prism or a pyramid (AlgoPolyhedronNetPrism,
// AlgoPolyhedronNetPyramid), its faces the base, the lateral faces
// V(i)V(i+1)… and the top: the base's points, then each lateral face's
// own, its top vertices or the apex, then the top's others, the top
// hanging from the first lateral face. Each face's points in the order of
// its edges' outputs.
function sidedNet(faces: string[][], prism: boolean): Net {
    const base = faces[0];
    const n = base.length;
    const top = prism ? faces[n + 1] : [];
    const points: Net["points"] = base.map((vertex) => ({ vertex, face: 0 }));
    const own = (vertices: string[], face: number) =>
        vertices.map((vertex) => points.push({ vertex, face }) - 1);
    const netFaces = [base.map((_, k) => k)];
    const links: Net["links"] = [null];
    base.forEach((vertex, k) => {
        const lateral = prism ? [top[k], top[(k + 1) % n]] : [faces[k + 1][2]];
        netFaces.push([k, ...own(lateral, k + 1), (k + 1) % n]);
        links.push({
            edge: [vertex, base[(k + 1) % n]],
            inside: lateral[0],
            parentInside: base[(k + 2) % n],
        });
    });
    if (prism) {
        netFaces.push([n, n + 1, ...own(top.slice(2), n + 1)]);
        links.push({
            edge: [top[0], top[1]],
            inside: top[2],
            parentInside: base[0],
        });
    }
    return {
        points,
        faces: netFaces,
        parents: faces.map((_, k) => (k ? (k > n ? 1 : 0) : -1)),
        links,
    };
}

// GeoGebra chains comparisons: "a < x ≤ b" is "a < x ∧ x ≤ b". Each
// nesting level remembers where the operand after its last comparison
// starts, forgotten past an operator of lower precedence.
function chainComparisons(formula: string): string {
    const middles = [-1];
    let result = "";
    for (let index = 0; index < formula.length; index++) {
        const character = formula[index];
        if (character === '"') {
            const end = formula.indexOf('"', index + 1);
            result += formula.slice(index, end + 1);
            index = end;
            continue;
        }
        const op = /^(?:[<>]=?|&&|\|\||==|!=|[?:,])/.exec(
            formula.slice(index),
        )?.[0];
        const depth = middles.length - 1;
        if ("([".includes(character)) middles.push(-1);
        else if (")]".includes(character)) middles.pop();
        else if (op) {
            const comparison = /^[<>]/.test(op);
            if (comparison && middles[depth] >= 0)
                result += `&&${result.slice(middles[depth])}`;
            result += op;
            middles[depth] = comparison ? result.length : -1;
            index += op.length - 1;
            continue;
        }
        result += character;
    }
    return result;
}

// Whether a formula reads neither the figure nor the window.
function isConstant(source: string): boolean {
    const node = parseFormula(source);
    return formulaIdentifiers(node).size === 0 && !usesView(node);
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
    macros?: string,
): GgbTranslation {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    const construction = document.querySelector("construction");
    if (document.querySelector("parsererror") || !construction)
        throw new Error("Invalid GGB XML");
    if (macros) expandMacros(construction, macros);

    const calls: DgpCall[] = [];
    const targets = new Map<string, Vec3>();
    const handles = new Map<string, [string | null, string | null]>();
    const nameShifts = new Map<string, Vec2>();
    const animations = new Map<string, Animation>();
    const rateSources = new Map<string, string>();
    const unsupported: string[] = [];
    const objects = new Map<string, { variable: string; kind: Kind }>();
    const segments = new LazyMap<[string, string]>();
    // The planes, GeoGebra's xOy plane being z = 0 (see isPlane).
    const planes = new Set<string>();
    // A cylinder or a cone, by its solid's or its side's label.
    const revolutions = new Map<string, { label: string; cone: boolean }>();
    const spheres = new Set<string>();
    const vectors = new LazyMap<[string, string]>();
    // A point of each line, where it is known.
    const lineStarts = new Map<string, string>();
    // A tangent to a function's curve, of the function through a point:
    // its slope triangle starts where it touches.
    const curveTangents = new Map<string, [string, string]>();
    // GeoGebra places a point on a line from its start along its direction,
    // not normalized: the vector between two points, turned by quarter
    // turns. Only kept for the lines DGP draws from a unit vector.
    const lineEnds = new Map<string, string[]>();
    // A line bisector's segment, its direction turned a quarter turn.
    const bisectors = new Map<string, string[]>();
    const directedLines = new Map<
        string,
        { start: string; ends: string[]; turns: number }
    >();
    const polygons = new LazyMap<string[]>();
    // The path of each point on one.
    const paths = new Map<string, string>();
    const polyhedra = new Map<string, [string, string][]>();
    // A polyhedron's faces, by their vertices.
    const shells = new LazyMap<string[][]>();
    // The prisms and the pyramids, which GeoGebra unfolds its own way.
    const sided = new Map<string, boolean>();
    // The objects drawing an object that isn't one itself.
    const parts = new Map<string, string[]>();
    // The points an object is built from, and how to build it from others:
    // its image by a similarity is built from their images, `direct` false
    // when the similarity reverses the orientation.
    const shapes = new Map<
        string,
        {
            points: string[];
            build: (label: string, points: string[], direct: boolean) => void;
        }
    >();
    const labels = new Map<string, string>();
    const iterations = new Map<
        string,
        { ends: string[][]; levels: string; maps: SegmentMap[] }
    >();
    const lists = new Map<string, ListFormula>();
    // The functions of x, which a formula calls by name.
    const functions = new Set<string>();
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

    const is3D =
        document.querySelector('gui view[id="512"][visible="true"]') !== null ||
        [...elements.values()].some((element) =>
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

    // Vector(P, Q) as the formula Q-P. OrthogonalVector of a segment or of
    // any vector is GeoGebra's (-dy, dx), not normalized: the 2D vector
    // times i.
    const vectorFormula = (
        source: string,
        locals: Map<string, string>,
    ): string | null => {
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
                      ? vectorFormula(`Vector(${ends.join(",")})`, locals)
                      : (vectorFormula(
                            arg.replace(/^Segment\(/, "Vector("),
                            locals,
                        ) ?? formula(arg, VALUE_KINDS, locals));
            return vector && `(${vector}*1i)`;
        }
        // Of a segment, from its start to its end.
        if (match[1] === "UnitVector") {
            const [arg] = args;
            if (args.length !== 1) return null;
            const ends = segments.get(arg);
            if (!ends && is(arg, ["line"])) return unitDirection(arg);
            const vector = ends
                ? vectorFormula(`Vector(${ends.join(",")})`, locals)
                : formula(arg, VALUE_KINDS, locals);
            return vector && `unitVector(${vector})`;
        }
        if (match[1] !== "Vector") return null;
        if (args.length === 1) {
            const v = formula(args[0], VALUE_KINDS, locals);
            return v && `(${v})`;
        }
        if (args.length !== 2) return null;
        const [p, q] = args.map((arg) => formula(arg, POINT_KINDS, locals));
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
        // A number reads a segment as its length, an angle as its value.
        const readable = (word: string): boolean =>
            is(word, kinds) ||
            (kinds.includes("expression") &&
                (segments.has(word) || is(word, ["angle"])));
        const known = objects.get(source);
        if (known && !vectors.has(source))
            return readable(source) ? known.variable : null;
        const text = normalizeBrackets(source)
            .replace(/²/g, "^2")
            .replace(/³/g, "^3")
            // "°" is a constant, written after an operand ("90°") or as
            // one ("90*°", "α / °").
            .replace(/([\p{L}\p{N}_.)\]'])\s*°/gu, "$1*(π/180)")
            .replace(/°/g, "(π/180)")
            .replace(/≟/g, "==")
            .replace(/≠/g, "!=")
            .replace(/≤/g, "<=")
            .replace(/≥/g, ">=")
            .replace(/∧/g, "&&")
            .replace(/∨/g, "||")
            .replace(/¬/g, "!")
            // The least or greatest of a list's items.
            .replace(/\b(Min|Max)\(\{([^{}]*)\}\)/g, "$1($2)")
            .replace(/\s+/g, " ");
        const flat = is3D ? ",0" : "";
        const groups: {
            start: number;
            call: boolean;
            commas: number[];
            semicolons?: number[];
            expand?: Expansion;
        }[] = [];
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
                const word = LABEL.exec(text.slice(index))![0];
                let end = index + word.length;
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
                    // A constant, read without kinds, calls none; a list
                    // l(n) is its n-th item.
                    const list = lists.get(word);
                    const fn = functions.has(word)
                        ? kinds.length > 0 && objects.get(word)!.variable
                        : list
                          ? ([n]: string[]) => `(${list.item(n) ?? "?"})`
                          : FUNCTIONS[word];
                    if (!fn) return null;
                    const expand = typeof fn === "function" ? fn : undefined;
                    groups.push({
                        start: result.length,
                        call: true,
                        commas: [],
                        expand,
                    });
                    result += expand ? "(" : `${fn}(`;
                    index++;
                } else if (word === "π" || word === "pi") result += "π";
                else if (word === "ℯ") result += "exp(1)";
                else if (word === "true" || word === "false") result += word;
                // GeoGebra's imaginary unit.
                else if (word === "ί") result += "i";
                else if (locals.has(word)) {
                    // An equation's x stays x, unless a call would read it.
                    const local = locals.get(word)!;
                    result +=
                        IDENTIFIER.test(local) &&
                        !/^ ?\(/.test(text.slice(index, index + 2))
                            ? local
                            : `(${local})`;
                } else if (vectors.has(word) && kinds.length > 0) {
                    const [p, q] = vectors
                        .get(word)!
                        .map((end) => objects.get(end)!.variable);
                    result += `(${q}-${p})`;
                } else if (readable(word))
                    result += objects.get(word)!.variable;
                else return null;
                continue;
            }
            index++;
            if (character === "(") {
                groups.push({ start: result.length, call: false, commas: [] });
                result += "(";
            } else if (character === ")") {
                const group = groups.pop();
                if (!group) return null;
                if (group.expand) {
                    const ends = [...group.commas, result.length];
                    result =
                        result.slice(0, group.start) +
                        group.expand(
                            ends.map((end, n) =>
                                result.slice(
                                    n ? ends[n - 1] + 1 : group.start + 1,
                                    end,
                                ),
                            ),
                        );
                } else if (group.semicolons) {
                    // Polar (r; θ) or spherical (r; θ; φ) coordinates.
                    const ends = [...group.semicolons, result.length];
                    const [r, t, f] = ends.map((end, n) =>
                        result.slice(
                            n ? ends[n - 1] + 1 : group.start + 1,
                            end,
                        ),
                    );
                    if (ends.length > 3 || group.commas.length > 0) return null;
                    const c = f ? `(${r})*cos(${f})` : `(${r})`;
                    result = `${result.slice(0, group.start)}[${c}*cos(${t}),${c}*sin(${t})${f ? `,(${r})*sin(${f})` : flat}]`;
                } else if (!group.call && group.commas.length > 0)
                    // In space, (x, y) is (x, y, 0).
                    result = `${result.slice(0, group.start)}[${result.slice(group.start + 1)}${group.commas.length === 1 ? flat : ""}]`;
                else result += ")";
            } else if (character === ",") {
                const group = groups[groups.length - 1];
                if (!group) return null;
                group.commas.push(result.length);
                result += ",";
            } else if (character === ";") {
                const group = groups[groups.length - 1];
                if (!group || group.call) return null;
                (group.semicolons ??= []).push(result.length);
                result += ";";
            } else if (/[\d.+\-*/^ =!<>&|]/.test(character))
                result += character;
            else return null;
        }
        if (groups.length > 0) return null;
        result = chainComparisons(result);
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
                return hiddenExpression(
                    `var $s=0;for(var $n=1;$n<=${list.count};$n++){$s+=${item}};$s`,
                );
            }
            // As GeoGebra writes a number, or a point in its own style.
            case "LaTeX": {
                const value =
                    args.length === 1 && formula(args[0], TEXT_KINDS, locals);
                if (!value) return null;
                if (!is(args[0], POINT_KINDS)) return `(""+(${value}))`;
                const [x, y] = [`x(${value})`, `y(${value})`];
                return attribute(
                    elements.get(args[0])!,
                    "coordStyle",
                    "style",
                ) === "complex"
                    ? `(${x}+(${y}<0?" - ":" + ")+abs(${y})+"i")`
                    : `("("+${x}+", "+${y}+")")`;
            }
            case "Corner":
                return cornerFormula(args);
            case "Slope":
                return args.length === 1 && is(args[0], ["line"])
                    ? slopeFormula(args[0])
                    : null;
            case "Length":
                return args.length === 1
                    ? lengthFormula(args[0], locals)
                    : null;
            // Of a point on a segment, from 0 at its start to 1 at its end.
            case "PathParameter": {
                const ends = segments.get(paths.get(args[0]) ?? "");
                if (args.length !== 1 || !ends) return null;
                const [m, p, q] = [args[0], ...ends].map(
                    (point) => objects.get(point)!.variable,
                );
                return `(d(${p},${m})/d(${p},${q}))`;
            }
            // Of a point or a vector, around a point.
            case "Rotate":
            case "Translate": {
                const values = args.map((arg) =>
                    formula(arg, VALUE_KINDS, locals),
                );
                if (values.includes(null)) return null;
                const [p, a, c] = values as string[];
                if (name === "Translate")
                    return args.length === 2 ? `(${p}+${a})` : null;
                return args.length <= 3
                    ? `rotate(${p},${c ?? planar("0", "0")},${a})`
                    : null;
            }
            // GeoGebra's LaTeX fraction, the first continued fraction
            // convergent within 1e-8.
            case "FractionText": {
                const value =
                    args.length === 1 && formula(args[0], TEXT_KINDS, locals);
                return value
                    ? hiddenExpression(
                          `var $v=${value},$x=abs($v),$h=floor($x),$k=1,$p=1,$q=0,$z=$x-$h,$a,$t;while(abs($x-$h/$k)>=0.00000001){$z=1/$z;$a=floor($z);$z=$z-$a;$t=$h;$h=$a*$h+$p;$p=$t;$t=$k;$k=$a*$k+$q;$q=$t};$h=$v<0?-$h:$h;$k==1?""+$h:" \\\\frac{ "+$h+" }{ "+$k+" } "`,
                      )
                    : null;
            }
            default:
                return vectorFormula(source, locals);
        }
    };

    // A vector's or a line's unit direction.
    const unitDirection = (input: string): string | null => {
        const ends = vectors.get(input);
        if (ends) {
            const [e, f] = ends.map((end) => objects.get(end)!.variable);
            return `(${f}-${e})/d(${e},${f})`;
        }
        if (!is(input, ["line"])) return null;
        const origin = planar("0", "0");
        const tip = auxiliary();
        define(tip, "point", "DirectionPoint", [
            ref(input),
            ref(formulaPoint(origin)),
        ]);
        const t = objects.get(tip)!.variable;
        return `${t}/d(${t},${origin})`;
    };

    // A line's point: GeoGebra draws its slope triangle from it.
    const linePoint = (line: string): string | undefined =>
        lineStarts.get(line) ?? segments.get(line)?.[0];

    const lineDirection = (line: string) => {
        const ends = segments.get(line) ?? lineEnds.get(line);
        const bisected = bisectors.get(line);
        return (
            directedLines.get(line) ??
            (is3D
                ? undefined
                : ends
                  ? { start: ends[0], ends, turns: 0 }
                  : bisected && {
                        start: bisected[0],
                        ends: bisected,
                        turns: 1,
                    })
        );
    };

    // A point from another along a line's direction.
    const alongDirection = (
        from: string,
        { ends, turns }: { ends: string[]; turns: number },
        label?: string,
    ): string => {
        const [s, a, b] = [from, ...ends].map((p) => objects.get(p)!.variable);
        const [dx, dy] = [`(x(${b})-x(${a}))`, `(y(${b})-y(${a}))`];
        const [u, v] = [
            [dx, dy],
            [`-${dy}`, dx],
            [`-${dx}`, `-${dy}`],
            [dy, `-${dx}`],
        ][turns % 4];
        return formulaPoint(`[x(${s})+${u},y(${s})+${v}]`, label);
    };

    // A line through the start of a directed line and its direction's tip,
    // on which a point is placed as GeoGebra's is.
    const directedLine = (line: string): string => {
        const direction = directedLines.get(line)!;
        const through = auxiliary();
        define(through, "line", "Line", [
            ref(direction.start),
            ref(alongDirection(direction.start, direction)),
        ]);
        return through;
    };

    const slopeFormula = (line: string): string => {
        const u = unitDirection(line);
        return `(y(${u})/x(${u}))`;
    };

    // A list's size, or a segment's, a vector's or a point's length.
    const lengthFormula = (
        source: string,
        locals: Map<string, string>,
    ): string | null => {
        const list = listFormula(source, locals);
        if (list) return `(${list.count})`;
        if (segments.has(source)) return formula(source, VALUE_KINDS);
        const call = commandCall(normalizeBrackets(source));
        const ends =
            vectors.get(source) ??
            (call?.[1].length === 2 && ["Segment", "Vector"].includes(call[0])
                ? call[1]
                : null);
        if (ends) {
            const [p, q] = ends.map((end) => formula(end, VALUE_KINDS, locals));
            return p === null || q === null ? null : `d(${p},${q})`;
        }
        const v = formula(source, VALUE_KINDS, locals);
        return v && `sqrt(dot(${v},${v}))`;
    };

    // The graphics view's corners, counterclockwise from its bottom left
    // one, then its size in pixels, the window's size standing for the
    // applet's.
    const cornerFormula = (args: string[]): string | null => {
        const [view, n] = args.length === 2 ? args : ["1", ...args];
        if (args.length > 2 || view !== "1") return null;
        if (n === "5" || n === "6")
            return "[windoww()*pixel(),windowh()*pixel()]";
        const corner = ["1", "2", "3", "4"].indexOf(n);
        if (corner < 0) return null;
        const x = corner === 1 || corner === 2 ? "+" : "-";
        const y = corner > 1 ? "+" : "-";
        return `[windowcx()${x}windoww()/2,windowcy()${y}windowh()/2]`;
    };

    // A GeoGebra list as its size and its n-th item (from 1), as formulas.
    const listFormula = (
        source: string,
        locals = new Map<string, string>(),
    ): ListFormula | null => {
        const text = normalizeBrackets(source.trim());
        const known = lists.get(text);
        if (known) return known;
        if (/^\{.*\}$/.test(text)) {
            const items = splitArguments(text.slice(1, -1))?.map((item) =>
                formula(item, VALUE_KINDS, locals),
            );
            return items?.every((item) => item !== null)
                ? {
                      count: String(items.length),
                      item: (n) => `[${items.join(",")}][(${n})-1]`,
                  }
                : null;
        }
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
            const at = (n: string) =>
                new Map([...locals, [variable, `(${a})+((${n})-1)*(${s})`]]);
            // With a margin for the bounds' rounding errors.
            const count = `floor(((${b})-(${a}))/(${s})+1.000001)`;
            const sub = (n: string) => listFormula(expression, at(n));
            return sub("1")
                ? { count, item: () => null, sub }
                : {
                      count,
                      item: (n) => formula(expression, VALUE_KINDS, at(n)),
                  };
        }
        if (name === "Element" && args.length === 2) {
            const n = formula(args[1], VALUE_KINDS, locals);
            return (
                (n !== null && listFormula(args[0], locals)?.sub?.(n)) || null
            );
        }
        // Sequence(b) and Sequence(a, b): the integers up to b.
        if (name === "Sequence" && args.length <= 2)
            return listFormula(
                `Sequence($i,$i,${args.length === 2 ? args : `1,${args}`})`,
                locals,
            );
        // Take(list, m, n), First(list, n) and Last(list, n): n items from
        // the start-th on.
        if (["Take", "First", "Last"].includes(name)) {
            const list = listFormula(args[0], locals);
            const [m = "1", n] = args
                .slice(1)
                .map((arg) => formula(arg, VALUE_KINDS, locals));
            if (!list || m === null || n === null) return null;
            const [start, count] =
                name === "Take"
                    ? [m, `${n ?? list.count}-(${m})+1`]
                    : [name === "First" ? "1" : `${list.count}-(${m})+1`, m];
            return {
                count,
                item: (k) => list.item(`(${start})+(${k})-1`),
            };
        }
        // The other lists are computed by a hidden Expression's script, as
        // an array: outside a Sequence, whose index it can't read.
        if (locals.size > 0) return null;
        const script = (code: string): ListFormula => {
            const array = hiddenExpression(
                `var $t=[],$x,$c,$j,$k,$f;${code};$t`,
            );
            return {
                count: `${array}.length`,
                item: (n) => `${array}[(${n})-1]`,
            };
        };
        // The roots of f between a and b, as points: where ROOT_SAMPLES
        // samples change sign, refined by bisection.
        if (name === "Roots" && args.length === 3) {
            const f = functionOf(args[0]);
            const [a, b] = args
                .slice(1)
                .map((bound) => formula(bound, VALUE_KINDS));
            if (!f || a === null || b === null) return null;
            const root = (x: string) => `$t.push(${planar(x, "0")})`;
            return script(
                `var $h=((${b})-(${a}))/${ROOT_SAMPLES},$u,$v,$p,$w;for(var $n=0;$n<${ROOT_SAMPLES};$n++){$u=(${a})+$n*$h;$v=$u+$h;$p=${f}($u);if($p==0){${root("$u")}}else if($p*${f}($v)<0){for($j=0;$j<60;$j++){$w=($u+$v)/2;if(${f}($w)*$p>0){$u=$w}else{$v=$w}};${root("($u+$v)/2")}}};if(${f}(${b})==0){${root(b)}}`,
            );
        }
        // The most frequent values, if any is repeated, in ascending order.
        if (name === "Mode" && args.length === 1) {
            const list = listFormula(args[0]);
            const item = (n: string) => list?.item(n);
            if (!item("$n") || !item("$j")) return null;
            const count = list!.count;
            const occurrences = `$c=0;for($j=1;$j<=${count};$j++){if(${item("$j")}==${item("$n")}){$c=$c+1}}`;
            return script(
                `var $m=1;for(var $n=1;$n<=${count};$n++){${occurrences};$m=max($m,$c)};for(var $n=1;$n<=${count};$n++){${occurrences};$f=$c==$m&&$m>1;for($k=0;$k<$t.length;$k++){if($t[$k]==${item("$n")}){$f=0}};if($f){$t.push(${item("$n")})}};for($j=0;$j<$t.length;$j++){for($k=0;$k<$t.length-1;$k++){if($t[$k]>$t[$k+1]){$x=$t[$k];$t[$k]=$t[$k+1];$t[$k+1]=$x}}}`,
            );
        }
        return null;
    };

    // A list read by name, of lists `depth` deep.
    const named = (list: string, depth: number): ListFormula => {
        const at = (n: string) =>
            `${list}[${IDENTIFIER.test(n) || NUMBER.test(n) ? n : `(${n})`}-1]`;
        return {
            count: `${list}.length`,
            item: (n) => (depth > 1 ? null : at(n)),
            sub: depth > 1 ? (n) => named(at(n), depth - 1) : undefined,
        };
    };

    // A list of lists as the items of its lists in turn, when their size
    // doesn't depend on their index.
    const flatten = (list: ListFormula): ListFormula | null => {
        if (!list.sub) return list;
        const row = (n: string) => {
            const sub = list.sub!(n);
            return sub && flatten(sub);
        };
        const size = row("$a")?.count;
        if (!size || size !== row("$b")?.count) return null;
        return {
            count: `(${list.count})*(${size})`,
            item: (n) =>
                row(`floor(((${n})-1)/(${size}))+1`)?.item(
                    `((${n})-1)%(${size})+1`,
                ) ?? null,
        };
    };

    const objectStyle = (element: Element, kind: Kind): string => {
        const parts: string[] = [];
        const color = child(element, "objColor");
        if (color) parts.push(`c:${hexColor(color)}`);
        if (attribute(element, "show", "object") === "false") parts.push("h:1");
        if (attribute(element, "show", "label") === "true") {
            const mode = attribute(element, "labelMode", "val") ?? "0";
            if (kind === "point" || kind === "pointOn") parts.push("sn:true");
            // An angle's value, alone or after its name.
            else if (kind === "angle" && (mode === "1" || mode === "2"))
                parts.push(`p:${decimals}`);
            // Its name, not its value nor its caption.
            else if (mode === "0") parts.push("lb:true");
        }
        // GeoGebra's 3D view ignores layers: only depth orders it.
        const layer = attribute(element, "layer", "val");
        if (layer && layer !== "0" && !is3D) parts.push(`l:${layer}`);
        if (
            kind === "polygon" &&
            (attribute(element, "fixed", "val") === "true" ||
                attribute(element, "selectionAllowed", "val") === "false")
        )
            parts.push("fx:true");
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
            // A frame, which GeoGebra's image doesn't have.
            if (thickness && kind !== "image")
                parts.push(`s:${Number(thickness) / 2}`);
            const dash =
                GGB_DASHES[attribute(element, "lineStyle", "type") ?? ""];
            if (dash)
                parts.push(`ld:${dash(Number(thickness ?? 5) / 2).join(",")}`);
            const lineOpacity = attribute(element, "lineStyle", "opacity");
            if (lineOpacity) parts.push(`lo:${Number(lineOpacity) / 255}`);
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
        labels.set(variable, label);
        const name = label.startsWith("aux ") ? freshName(kind) : label;
        const sources = args.map((arg) =>
            arg.type === "reference" ? labels.get(arg.name) : undefined,
        );
        if (args.length > 0 && points(...sources))
            shapes.set(label, {
                points: sources as string[],
                build: (image, vertices) =>
                    define(image, kind, command, vertices.map(ref)),
            });
        push(variable, command, [literal(name), ...args]);
        const element = elements.get(label);
        // Without its own element (an unlabeled output, or an auxiliary
        // object built from a nested command), GeoGebra doesn't draw it:
        // super-hidden, nobody shows it again.
        const shown = style ?? (element ? objectStyle(element, kind) : "h:2");
        push(null, "STL", [
            { type: "reference", name: variable },
            literal(shown),
        ]);
        const offset = element && child(element, "labelOffset");
        if (offset && shown.split(";").includes("lb:true"))
            nameShifts.set(variable, [
                Number(offset.getAttribute("x")),
                Number(offset.getAttribute("y")),
            ]);
        return true;
    };

    // A number no view shows, as its variable.
    const hiddenExpression = (content: string, label = auxiliary()): string => {
        define(
            label,
            "expression",
            "Expression",
            ["", "", "", content, "0", "0"].map(literal),
            "h:2",
        );
        return objects.get(label)!.variable;
    };

    const defineFunction = (
        label: string,
        body: string,
        min = "",
        max = "",
    ): true => {
        functions.add(label);
        return define(label, "curve", "Curvus", [
            literal(min),
            literal(max),
            literal(body),
        ]);
    };

    // A function of the figure, or an expression of x, as a formula of x.
    const functionBody = (source: string): string | null =>
        formula(
            functions.has(source) ? `${source}(x)` : source,
            ["expression"],
            new Map([["x", "x"]]),
        );

    // A function's variable, an expression of x being defined as a hidden
    // function.
    const functionOf = (source: string): string | null => {
        if (functions.has(source)) return objects.get(source)!.variable;
        const body = functionBody(source);
        if (body === null) return null;
        const label = auxiliary();
        defineFunction(label, body);
        return objects.get(label)!.variable;
    };

    const derivative = (f: string, x: string): string =>
        `((${f}((${x})+${DERIVATIVE_STEP})-${f}((${x})-${DERIVATIVE_STEP}))/${2 * DERIVATIVE_STEP})`;

    const shapeStyle = (element: Element): string =>
        objectStyle(element, "polygon")
            .split(";")
            .filter((part) => part !== "lb:true")
            .join(";");

    // The region GeoGebra shades for a number, bounded by a list's points.
    const region = (label: string, count: string, item: string): void => {
        const element = elements.get(label);
        if (element)
            define(
                auxiliary(),
                "list",
                "List",
                [literal("polygon"), literal(count), literal(item)],
                shapeStyle(element),
            );
    };

    // Lower and upper sums, each rectangle's height being the least or
    // greatest of the function's samples on its interval.
    const riemannSum =
        (extremum: "min" | "max"): Handler =>
        ([f, a, b, n, extra], [label]) => {
            const fn = functionOf(f);
            const values = [a, b, n].map((value) =>
                formula(value ?? "", VALUE_KINDS),
            );
            if (extra !== undefined || !fn || values.includes(null))
                return false;
            const [p, q, m] = values.map((value) => hiddenExpression(value!));
            const w = `(${q}-${p})/${m}`;
            const heights = hiddenExpression(
                `var $t=[],$e,$j;for(var $n=0;$n<${m};$n++){$e=${fn}(${p}+$n*${w});for($j=1;$j<=${EXTREMUM_SAMPLES};$j++){$e=${extremum}($e,${fn}(${p}+($n+$j/${EXTREMUM_SAMPLES})*${w}))};$t.push($e)};$t`,
            );
            hiddenExpression(
                `var $s=0;for(var $n=0;$n<${m};$n++){$s+=${heights}[$n]};$s*${w}`,
                label,
            );
            region(
                label,
                `4*${m}`,
                `[${p}+(floor(k/4)+(k%4>1))*${w},(k%4==1||k%4==2)*${heights}[floor(k/4)]]`,
            );
            return true;
        };

    const target = (label: string): void => {
        const element = elements.get(label);
        const coords = element && pointCoords(element);
        if (coords) targets.set(objects.get(label)!.variable, coords);
    };

    // GeoGebra's xOy plane is made when first needed, hidden.
    const isPlane = (input: string): boolean => {
        if (input === "xOyPlane" && !planes.has(input)) {
            define(
                input,
                "polygon",
                "EquationPlane",
                [literal("z"), literal("0")],
                "h:2",
            );
            planes.add(input);
        }
        return planes.has(input);
    };
    // Where GeoGebra takes a direction, a polygon stands for its plane.
    const isDirection = (input: string): boolean =>
        isPlane(input) || is(input, ["polygon"]);

    // After its style, a plane sits with the floor, whatever GeoGebra's
    // layer (see polygon_object.plane).
    const definePlane = (
        label: string,
        command: string,
        args: DgpValue[],
    ): true => {
        planes.add(label);
        define(label, "polygon", command, args);
        push(null, "STL", [ref(label), literal("pl:true")]);
        // Its image, the polygon of its corners' images: made when needed.
        const corners: string[] = [];
        shapes.set(label, {
            get points() {
                if (!corners.length)
                    for (let rank = 0; rank < 4; rank++) {
                        corners.push(auxiliary());
                        define(corners[rank], "point", "Vertex", [
                            ref(label),
                            literal(rank),
                        ]);
                    }
                return corners;
            },
            build: (image, points) => definePolygon(image, points),
        });
        return true;
    };

    // A solid whose faces and edges GeoGebra draws as its own objects: it
    // stays hidden.
    const defineSolid = (label: string, command: string, args: DgpValue[]) => {
        const element = elements.get(label);
        define(
            label,
            "polyhedron",
            command,
            args,
            element && `${objectStyle(element, "polyhedron")};h:1`,
        );
    };
    const vertexOf = (solid: string, rank: number, label?: string) => {
        const vertex = label || auxiliary();
        define(vertex, "point", "Vertex", [ref(solid), literal(rank)]);
        return vertex;
    };

    const defineSegment = (label: string, p: string, q: string): true => {
        segments.set(label, [p, q]);
        return define(label, "line", "Segment", [ref(p), ref(q)]);
    };

    const definePolygon = (
        label: string,
        vertices: string[],
        style?: string,
    ): true => {
        shapes.set(label, {
            points: vertices,
            build: (image, points) => definePolygon(image, points),
        });
        return define(
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
    };

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

    // Of a point or, of the same kind, of an object.
    type PointMap = (source: string, label: string, kind?: Kind) => void;
    // The image of a point, of an object as a whole (see MAPPED_KINDS), of
    // an object built from points (see shapes), of a written list of them
    // or, by a direct similarity, of an iteration: the iteration of its
    // start segments' images, since its maps commute with it.
    const transform =
        (
            mapOf: (params: string[]) => PointMap | null,
            direct = true,
        ): Handler =>
        ([list, ...params], [output]) => {
            const map = mapOf(params);
            if (!map) return false;
            const images = new Map<string, string>();
            const image = (point: string): string => {
                let result = images.get(point);
                if (!result) {
                    images.set(point, (result = auxiliary()));
                    map(point, result);
                }
                return result;
            };
            const imageOf = (source: string, label: string): boolean => {
                if (points(source)) {
                    map(source, label);
                    return true;
                }
                const iteration = iterations.get(source);
                if (iteration && direct)
                    return defineIteration(
                        label,
                        iteration.ends.map((ends) => ends.map(image)),
                        iteration.levels,
                        iteration.maps,
                    );
                const kind = kindOf(source)!;
                if (MAPPED_KINDS.includes(kind)) {
                    map(source, label, kind);
                    for (const known of [
                        segments,
                        vectors,
                        polygons,
                    ] as LazyMap<string[]>[])
                        if (known.has(source))
                            known.defer(label, () =>
                                known.get(source)!.map(image),
                            );
                    if (shells.has(source))
                        shells.defer(label, () =>
                            shells.get(source)!.map((face) => face.map(image)),
                        );
                    return true;
                }
                const shape = shapes.get(source);
                if (shape) {
                    shape.build(label, shape.points.map(image), direct);
                    for (const known of [segments, vectors, polygons] as Map<
                        string,
                        string[]
                    >[]) {
                        const vertices = known.get(source);
                        if (vertices) known.set(label, vertices.map(image));
                    }
                    return true;
                }
                return false;
            };
            // A written list's items, drawn in its style.
            const items = /^\{.*\}$/.test(list)
                ? splitArguments(list.slice(1, -1))!.map(resolve)
                : null;
            if (!items) return imageOf(list, output);
            const drawn = items.flatMap((item) => {
                const part = auxiliary();
                return imageOf(item, part) ? (parts.get(part) ?? [part]) : [""];
            });
            if (drawn.includes("")) return false;
            const element = elements.get(output);
            if (element)
                drawn.forEach((part) =>
                    push(null, "STL", [
                        ref(part),
                        literal(`h:0;${shapeStyle(element)}`),
                    ]),
                );
            parts.set(output, drawn);
            return true;
        };

    // A speed that depends on the figure is read once every object exists.
    const animate = (label: string): void => {
        const element = elements.get(label);
        const animation = element && child(element, "animation");
        if (animation?.getAttribute("playing") !== "true") return;
        const source = animation.getAttribute("speed") ?? "1";
        const speed = NUMBER.test(source) ? Number(source) : 1;
        if (speed !== Number(source)) rateSources.set(label, source);
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
        paths.set(label, support);
        const kind = kindOf(support);
        const pair = kind === "polygon" || kind === "quadric";
        const element = elements.get(label);
        define(
            label,
            "pointOn",
            "PointOn",
            [
                ref(support),
                // On a surface, a direction.
                kind === "sphere" || pair
                    ? {
                          type: "array",
                          items: (pair ? [0, 0] : [1, 0, 0]).map(literal),
                      }
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

    // GeoGebra draws a horizontal slider's track at its position, DocGeo
    // CURSOR_OFFSET_Y pixels below.
    const sliderScreen = (slider: Element): [number, number] => {
        const absolute =
            (slider.getAttribute("absoluteScreenLocation") ??
                slider.getAttribute("fixed")) === "true";
        const shift =
            slider.getAttribute("horizontal") === "false" ? 0 : CURSOR_OFFSET_Y;
        const y = Number(slider.getAttribute("y"));
        return screenPosition(
            Number(slider.getAttribute("x")),
            absolute ? y - shift : y + shift / unit,
            absolute,
        );
    };

    // Polygon(A, B, n)'s other vertices, counterclockwise like GeoGebra's:
    // the k-th is A + (B - A)·(1 - w^k)/(1 - w) with w = e^(2iπ/n), i.e.
    // B - A rotated by (k - 1)π/n and scaled by sin(kπ/n)/sin(π/n). In a
    // plane, the rotation is around its normal.
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

    // An object of points whose image by a reflection runs the other way,
    // as do the images of that image: `build` makes it, reversed or not.
    const orientedShape = (
        label: string,
        points: string[],
        build: (label: string, points: string[], reversed: boolean) => void,
        reversed = false,
    ): true => {
        build(label, points, reversed);
        shapes.set(label, {
            points,
            build: (image, images, direct) =>
                orientedShape(
                    image,
                    images,
                    build,
                    direct ? reversed : !reversed,
                ),
        });
        return true;
    };

    // CircleArc(M, A, B): counterclockwise from A to the ray MB, on the
    // circle centered at M through A; clockwise, its image by a reflection.
    const centerArc =
        (sector: boolean): Handler =>
        (inputs, [label]) =>
            inputs.length === 3 &&
            points(...inputs) &&
            orientedShape(label, inputs, (image, [m, a, b], reversed) =>
                define(image, "circle", sector ? "CenterSector" : "CenterArc", [
                    ref(m),
                    ref(a),
                    ref(b),
                    ...(reversed ? [literal(true)] : []),
                ]),
            );

    // Arc(c, P, Q) of a circle or an ellipse: from P to Q counterclockwise,
    // each taken where it projects onto c.
    const arcOn =
        (sector: boolean): Handler =>
        ([support, p, q, extra], [label]) => {
            if (extra !== undefined || !points(p, q)) return false;
            const circle = is(support, ["circle"]);
            return (
                (circle || is(support, ["quadric"])) &&
                define(
                    label,
                    circle ? "circle" : "quadric",
                    `${sector ? "Sector" : "Arc"}On${circle ? "Circle" : "Conic"}`,
                    [support, p, q].map(ref),
                )
            );
        };

    // Ellipse(F, G, P) and Hyperbola(F, G, P) through P, or with semi-major
    // axis a.
    const focalConic =
        (command: string): Handler =>
        ([f, g, third, extra], [label]) => {
            if (extra !== undefined || !points(f, g)) return false;
            if (points(third))
                return define(
                    label,
                    "quadric",
                    command,
                    [f, g, third].map(ref),
                );
            const a = formula(third, VALUE_KINDS);
            return (
                a !== null &&
                define(label, "quadric", `${command}1`, [
                    ref(f),
                    ref(g),
                    literal(a),
                ])
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
    // A point reflection is a half turn, which keeps the orientation.
    const pointReflection = transform(
        ([center]) =>
            (p, label, kind = "point") =>
                define(label, kind, "Symmetry", [ref(center), ref(p)]),
    );
    const lineReflection = transform(
        ([line]) =>
            is(line, ["line"])
                ? (p, label, kind = "point") =>
                      define(label, kind, "Reflection", [ref(line), ref(p)])
                : null,
        false,
    );
    // By a circle, the inverse of a point or the image of an object, of the
    // kind the Inversion command gives: a line when GeoGebra's is a
    // degenerate conic, from a line or a circle through the center.
    const inversion: Handler = ([source, circle], [label]) => {
        const type = elements.get(source)?.getAttribute("type");
        const element = elements.get(label);
        const matrix = element && child(element, "matrix");
        const straight =
            !!matrix &&
            ["A0", "A1"].every(
                (name) => Number(matrix.getAttribute(name)) === 0,
            );
        const kind: Kind | null = points(source)
            ? "point"
            : is(source, ["polygon"])
              ? "polygon"
              : is(source, ["circle"]) ||
                  (is(source, ["line"]) &&
                      (type === "line" || type === "segment"))
                ? straight
                    ? "line"
                    : "circle"
                : is(source, ["quadric", "curve", "locus"])
                  ? "locus"
                  : null;
        return (
            kind !== null &&
            define(label, kind, "Inversion", [
                ref(circle),
                ref(source),
                ...(straight ? [literal(true)] : []),
            ])
        );
    };
    const mirror: Handler = (inputs, outputs) =>
        (is(inputs[1], ["circle"])
            ? inversion
            : points(inputs[1])
              ? pointReflection
              : lineReflection)(inputs, outputs);

    let auxiliaries = 0;
    const auxiliary = (): string => `aux ${++auxiliaries}`;
    // An auxiliary object's name, as the editor gives one (see nextName in
    // src/editor/figure.ts): a capital letter for a point, a small one
    // otherwise, then numbered, none of GeoGebra's labels.
    const given = new Set<string>();
    const freshName = (kind: Kind): string => {
        const letters =
            kind === "point" || kind === "pointOn"
                ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                : "abcdfghjmnpqrsuvw";
        for (let number = 0; ; number++)
            for (const letter of letters) {
                const name = number ? `${letter}${number}` : letter;
                if (!elements.has(name) && !given.has(name)) {
                    given.add(name);
                    return name;
                }
            }
    };

    // A random number or point keeps the value GeoGebra saved.
    const savedValue: Handler = (_, [label]) => {
        const element = elements.get(label);
        const coords = element && pointCoords(element);
        return coords
            ? define(label, "point", "Point", vectorLiteral(coords))
            : element?.getAttribute("type") === "numeric" &&
                  numeric(label, element);
    };

    // A command a formula computes: a text, a point or a number.
    const formulaCommand =
        (name: string): Handler =>
        (inputs, [label]) => {
            const source = `${name}(${inputs.join(",")})`;
            const element = elements.get(label);
            const type = element?.getAttribute("type");
            if (type === "text") return text(label, element!, source);
            const value = formula(source, VALUE_KINDS);
            if (value === null) return false;
            if (type === "point") formulaPoint(value, label);
            else hiddenExpression(value, label);
            return true;
        };

    // Cylinder(A, B, r), Cone(A, B, r) of apex B: drawn in the style of
    // GeoGebra's side, which it is, and its disks.
    const revolution =
        (cone: boolean): Handler =>
        ([a, b, radius, extra], [solid, bottom, ...rest]) => {
            const [top, side] = cone ? [undefined, rest[0]] : rest;
            const r = formula(radius, VALUE_KINDS);
            if (extra !== undefined || r === null || !points(a, b))
                return false;
            // Its disks draw its rims.
            const label = side || solid || auxiliary();
            const element = elements.get(label);
            define(
                label,
                "sphere",
                cone ? "Cone" : "Cylinder",
                [ref(a), ref(b), literal(r)],
                element && `${objectStyle(element, "sphere")};s:0`,
            );
            [solid, side].forEach((name) => {
                if (!name) return;
                revolutions.set(name, { label, cone });
                objects.set(name, objects.get(label)!);
            });
            define(bottom || auxiliary(), "circle", "Disk", [
                ref(label),
                literal(false),
            ]);
            if (!cone)
                define(top || auxiliary(), "circle", "Disk", [
                    ref(label),
                    literal(true),
                ]);
            return true;
        };

    const HANDLERS: Record<string, Handler> = {
        // On a path, or a point translated by a vector.
        Point: ([support, extra, rest], [label]) => {
            if (extra === undefined)
                return (
                    is(support, [
                        "line",
                        "circle",
                        "polygon",
                        "quadric",
                        "curve",
                        "locus",
                        "sphere",
                    ]) &&
                    pointOn(
                        label,
                        directedLines.has(support)
                            ? directedLine(support)
                            : support,
                        kindOf(support) === "polygon",
                    )
                );
            const value = formula(extra, VALUE_KINDS);
            if (rest !== undefined || !points(support) || value === null)
                return false;
            formulaPoint(`${objects.get(support)!.variable}+(${value})`, label);
            return true;
        },
        PointIn: ([region, extra], [label]) =>
            extra === undefined &&
            is(region, ["polygon"]) &&
            pointOn(label, region, false),
        Intersect: ([first, second, third], outputs) => {
            const [path, surface] = is(first, ["line"])
                ? [first, second]
                : [second, first];
            const solid =
                revolutions.get(surface)?.label ??
                (spheres.has(surface) ? surface : undefined);
            if (solid) {
                if (third !== undefined || !is(path, ["line"])) return false;
                outputs.slice(0, 2).forEach((label, index) => {
                    if (!label) return;
                    define(label, "point", "CylinderIntersection", [
                        ref(path),
                        ref(solid),
                        literal(index),
                    ]);
                    target(label);
                });
                return true;
            }
            if (isPlane(surface)) {
                if (third !== undefined || !is(path, ["line"])) return false;
                return define(outputs[0], "point", "PlaneIntersection", [
                    ref(path),
                    ref(surface),
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
            !!hiddenExpression(
                `d(${objects.get(p)!.variable},${objects.get(q)!.variable})`,
                label,
            ),
        Center: ([circle], [label]) =>
            is(circle, ["circle"]) &&
            define(label, "point", "Center", [ref(circle)]),
        Line: ([p, q], [label]) => {
            if (!points(p)) return false;
            lineStarts.set(label, p);
            if (points(q)) {
                lineEnds.set(label, [p, q]);
                return define(label, "line", "Line", [ref(p), ref(q)]);
            }
            const direction = lineDirection(q);
            if (direction) directedLines.set(label, { ...direction, start: p });
            return (
                is(q, ["line"]) &&
                define(label, "line", "Parallel", [ref(q), ref(p)])
            );
        },
        Segment: ([p, q, extra], [label]) =>
            extra === undefined && points(p, q) && defineSegment(label, p, q),
        Ray: onePoint("Ray", 2),
        // In space, or in the xOy plane, a line's orthogonal through P is
        // DGP's perpendicular (see plumb_line_object).
        OrthogonalLine: ([p, line, extra], [label]) => {
            const plane = isDirection(line);
            if (
                (extra !== undefined &&
                    ((extra !== "space" && extra !== "xOyPlane") || plane)) ||
                !points(p)
            )
                return false;
            if (plane)
                return define(label, "line", "NormalLine", [ref(line), ref(p)]);
            const direction = extra === undefined && lineDirection(line);
            if (direction)
                directedLines.set(label, {
                    start: p,
                    ends: direction.ends,
                    turns: direction.turns + 1,
                });
            return (
                is(line, ["line"]) &&
                define(label, "line", "Perpendicular", [ref(line), ref(p)])
            );
        },
        LineBisector: ([p, q], [label]) => {
            const ends = q === undefined ? segmentEnds(p) : [p, q];
            if (!ends || !points(...ends)) return false;
            bisectors.set(label, ends);
            return define(
                label,
                "line",
                "PerpendicularBisector",
                ends.map(ref),
            );
        },
        AngularBisector: onePoint("AngleBisector", 3),
        // Of two lines, from the first's direction to the second's, at
        // their intersection.
        Angle: (inputs, outputs) => {
            const [g, h] = inputs;
            if (inputs.length !== 2 || !is(g, ["line"]) || !is(h, ["line"]))
                return onePoint("Angle", 3, "angle")(inputs, outputs);
            const directions = [g, h].map(lineDirection);
            if (!directions[0] || !directions[1]) return false;
            const vertex = auxiliary();
            define(vertex, "point", "OrderedIntersection", [
                ref(g),
                ref(h),
                literal(0),
            ]);
            const [p, q] = directions.map((d) => alongDirection(vertex, d!));
            return define(outputs[0], "angle", "Angle", [
                ref(p),
                ref(vertex),
                ref(q),
            ]);
        },
        Circle: ([center, second, third], [label]) => {
            // Of axis d through P.
            if (is(center, ["line"]))
                return (
                    third === undefined &&
                    points(second) &&
                    define(label, "circle", "AxisCircle", [
                        ref(center),
                        ref(second),
                    ])
                );
            if (!points(center)) return false;
            if (points(second, third))
                return define(label, "circle", "Circle3pts", [
                    ref(center),
                    ref(second),
                    ref(third),
                ]);
            if (third !== undefined) {
                const radius = formula(second, VALUE_KINDS);
                if (radius === null) return false;
                // A plane's direction, its normal through the center.
                let axis = third;
                if (isDirection(third)) {
                    axis = auxiliary();
                    define(axis, "line", "NormalLine", [
                        ref(third),
                        ref(center),
                    ]);
                } else if (!is(third, ["line"])) return false;
                return define(label, "circle", "Circle1", [
                    ref(center),
                    literal(radius),
                    ref(axis),
                ]);
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
        Arc: arcOn(false),
        Sector: arcOn(true),
        CircleArc: centerArc(false),
        CircularArc: centerArc(false),
        CircleSector: centerArc(true),
        CircularSector: centerArc(true),
        // On the left of AB: its image by a reflection is on the left of
        // B'A'.
        Semicircle: ([a, b, extra], [label]) =>
            extra === undefined &&
            points(a, b) &&
            orientedShape(label, [a, b], (image, [p, q], reversed) =>
                define(
                    image,
                    "circle",
                    "Semicircle",
                    (reversed ? [q, p] : [p, q]).map(ref),
                ),
            ),
        Conic: onePoint("Quadric", 5, "quadric"),
        Ellipse: focalConic("Ellipse"),
        Hyperbola: focalConic("Hyperbola"),
        Parabola: ([focus, directrix, extra], [label]) => {
            if (
                extra !== undefined ||
                !points(focus) ||
                !is(directrix, ["line"])
            )
                return false;
            // Its image, of the images of its focus and directrix.
            const line = shapes.get(directrix);
            if (line)
                shapes.set(label, {
                    get points() {
                        return [focus, ...line.points];
                    },
                    build: (image, [f, ...ends], direct) => {
                        const d = auxiliary();
                        line.build(d, ends, direct);
                        define(image, "quadric", "Parabola", [f, d].map(ref));
                    },
                });
            return define(
                label,
                "quadric",
                "Parabola",
                [focus, directrix].map(ref),
            );
        },
        Polygon: (inputs, [label, ...sides]) => {
            const [a, b, count, plane] = inputs;
            const onPlane = plane !== undefined && isDirection(plane);
            if (
                inputs.length === (onPlane ? 4 : 3) &&
                points(a, b) &&
                NUMBER.test(count)
            ) {
                const n = Number(count);
                if (!Number.isInteger(n) || n < 3) return false;
                // Its vertices, GeoGebra's outputs after its sides;
                // its image by a reflection is on B'A'.
                if (onPlane)
                    define(label, "polygon", "RegularPolygon", [
                        ref(a),
                        ref(b),
                        literal(n),
                        ref(plane),
                    ]);
                else
                    orientedShape(label, [a, b], (image, [p, q], reversed) =>
                        define(image, "polygon", "RegularPolygon", [
                            ...(reversed ? [q, p] : [p, q]).map(ref),
                            literal(n),
                        ]),
                    );
                const vertices = [
                    a,
                    b,
                    ...Array.from({ length: n - 2 }, (_, index) => {
                        const vertex = sides[n + index] || auxiliary();
                        define(vertex, "point", "Vertex", [
                            ref(label),
                            literal(index + 2),
                        ]);
                        return vertex;
                    }),
                ];
                polygons.set(label, vertices);
                // On a plane, its image is the polygon of its vertices'.
                if (onPlane)
                    shapes.set(label, {
                        points: vertices,
                        build: (image, points) => definePolygon(image, points),
                    });
                sides
                    .slice(0, n)
                    .forEach(
                        (side, index) =>
                            side &&
                            defineSegment(
                                side,
                                vertices[index],
                                vertices[(index + 1) % n],
                            ),
                    );
                return true;
            }
            // A list's points, in turn.
            const list = inputs.length === 1 && listFormula(inputs[0]);
            const item = list && list.item("k+1");
            if (item)
                return define(label, "list", "List", [
                    literal("polygon"),
                    literal(list.count),
                    literal(item),
                ]);
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
        // plane or polygon p.
        Cube: (inputs, [solid, ...outputs]) => {
            const [a, b, c] = inputs;
            const plane = isDirection(c);
            if (inputs.length !== 3 || !points(a, b) || !(plane || points(c)))
                return false;
            // The square ABCD lies in plane ABC, the cube on the side of
            // AB × BC, exactly as GeoGebra builds it; or on the side of p's
            // normal. Its vertices C (unless given), D, …, H are its own.
            defineSolid(solid, "Cube", [a, b, c].map(ref));
            const ranks = plane ? [2, 3, 4, 5, 6, 7] : [3, 4, 5, 6, 7];
            const vertices = [
                ...inputs.slice(0, plane ? 2 : 3),
                ...ranks.map((rank, index) =>
                    vertexOf(solid, rank, outputs[index]),
                ),
            ];
            const others = ranks;
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
            shells.set(solid, faces);
            return true;
        },
        // Net(P, v, base, e1, e2, …): P's net unfolded by v (0: folded, 1:
        // flat) from its base face, e1, e2, … being cut, which a prism or a
        // pyramid ignores; after the net itself come its points, its faces
        // as P's and then its edges.
        Net: ([solid, value, ...rest], [, ...outputs]) => {
            const faces = shells.get(solid);
            const f = formula(value, VALUE_KINDS);
            if (!faces || f === null) return false;
            const base = polygons.get(rest[0]);
            const cuts = (base ? rest.slice(1) : rest).map((edge) =>
                segments.get(edge),
            );
            if (cuts.some((edge) => !edge)) return false;
            const prism = sided.get(solid);
            const net =
                prism !== undefined
                    ? sidedNet(faces, prism)
                    : unfold(
                          faces,
                          base
                              ? faces.findIndex(
                                    (face) =>
                                        face.length === base.length &&
                                        face.every((vertex) =>
                                            base.includes(vertex),
                                        ),
                                )
                              : 0,
                          cuts as [string, string][],
                      );
            if (!net) return false;
            // Each face turns by f times its angle with its parent around
            // their common edge, taking its descendants along: a point is
            // turned by its own face first, then by each of its ancestors.
            const vertexLabels = net.points.map(({ vertex, face }, index) => {
                const turns: string[] = [];
                for (let at = face; net.links[at]; at = net.parents[at]) {
                    const link = net.links[at]!;
                    turns.push(...link.edge, link.inside, link.parentInside);
                }
                const label = outputs[index] || auxiliary();
                define(label, "point", "NetVertex", [
                    ref(vertex),
                    literal(f),
                    literal(
                        turns
                            .map((point) => `_${objects.get(point)!.variable}`)
                            .join(","),
                    ),
                ]);
                return label;
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
        // Pyramid(poly, S) or Pyramid(poly, h), whose apex, over the base's
        // center, comes first: only the lateral faces, then edges.
        Pyramid: (inputs, [solid, ...outputs]) => {
            const polygon = polygons.get(inputs[0]);
            if (polygon ? inputs.length !== 2 : inputs.length < 4) return false;
            const base = polygon ?? inputs.slice(0, -1);
            let apex = inputs[inputs.length - 1];
            const h =
                polygon && !points(apex) ? formula(apex, VALUE_KINDS) : null;
            if (!points(...base) || !(h !== null || points(apex))) return false;
            const n = base.length;
            // On an existing polygon, or on its first face.
            const bottom = polygon ? inputs[0] : outputs[0] || auxiliary();
            if (!polygon) definePolygon(bottom, base);
            if (h !== null) {
                defineSolid(solid, "PyramidHeight", [ref(bottom), literal(h)]);
                apex = vertexOf(solid, n, outputs.shift());
            } else defineSolid(solid, "Pyramid", [ref(bottom), ref(apex)]);
            const faces = [
                ...(polygon ? [] : [base]),
                ...base.map((vertex, index) => [
                    vertex,
                    base[(index + 1) % n],
                    apex,
                ]),
            ];
            faces.forEach((face, index) => {
                const label = outputs[index];
                if (label && label !== bottom) definePolygon(label, face);
            });
            [
                ...(polygon
                    ? []
                    : base.map((vertex, index) => [
                          vertex,
                          base[(index + 1) % n],
                      ])),
                ...base.map((vertex) => [vertex, apex]),
            ].forEach(([p, q], index) => {
                const label = outputs[faces.length + index];
                if (label) defineSegment(label, p, q);
            });
            polyhedra.set(
                solid,
                base.flatMap((vertex, index): [string, string][] => [
                    [apex, vertex],
                    [vertex, base[(index + 1) % n]],
                ]),
            );
            shells.set(solid, polygon ? [base, ...faces] : faces);
            sided.set(solid, false);
            return true;
        },
        // Prism(A, B, C, …, P) or Prism(poly, P): P is the top vertex over A,
        // the others are translated by P - A. After the top vertices come the
        // base, the lateral faces V(i)V(i+1)W(i+1)W(i) and the top face, then
        // the base, lateral and top edges; the base and its edges are omitted
        // when it is an existing polygon.
        Prism: (inputs, [solid, ...outputs]) => {
            const polygon = polygons.get(inputs[0]);
            if (polygon ? inputs.length !== 2 : inputs.length < 4) return false;
            const base = polygon ?? inputs.slice(0, -1);
            const apex = inputs[inputs.length - 1];
            // Prism(poly, h): the first top vertex comes first.
            const h =
                polygon && !points(apex) ? formula(apex, VALUE_KINDS) : null;
            if (!points(...base) || !(h !== null || points(apex))) return false;
            const n = base.length;
            const tops = outputs.splice(0, h === null ? n - 1 : n);
            // On an existing polygon, or on its first face.
            const bottom = polygon ? inputs[0] : outputs[0] || auxiliary();
            if (!polygon) definePolygon(bottom, base);
            if (h !== null)
                defineSolid(solid, "PrismHeight", [ref(bottom), literal(h)]);
            else defineSolid(solid, "Prism", [ref(bottom), ref(apex)]);
            const top = [
                ...(h === null ? [apex] : []),
                ...tops.map((label, index) =>
                    vertexOf(solid, n + index + (h === null ? 1 : 0), label),
                ),
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
                const label = outputs[index];
                if (label && label !== bottom) definePolygon(label, face);
            });
            [
                ...(polygon
                    ? []
                    : base.map((vertex, index) => [vertex, base[next(index)]])),
                ...base.map((vertex, index) => [vertex, top[index]]),
                ...top.map((vertex, index) => [vertex, top[next(index)]]),
            ].forEach(([p, q], index) => {
                const label = outputs[faces.length + index];
                if (label) defineSegment(label, p, q);
            });
            shells.set(solid, polygon ? [base, ...faces] : faces);
            sided.set(solid, true);
            return true;
        },
        Cylinder: revolution(false),
        // Cone(C, S, r): the base centered at C, the apex S.
        Cone: revolution(true),
        // Sphere(A, B) or Sphere(A, r), through B or A + (r, 0, 0).
        Sphere: ([center, through, extra], [label]) => {
            if (extra !== undefined || !points(center)) return false;
            const r = !points(through) && formula(through, VALUE_KINDS);
            if (r === null) return false;
            spheres.add(label);
            return define(label, "sphere", r ? "Sphere1" : "Sphere", [
                ref(center),
                r ? literal(r) : ref(through),
            ]);
        },
        // Plane(A, B, C), Plane(A, p) through A parallel to p, Plane(A, f)
        // through A and f.
        Plane: (inputs, [label]) => {
            const [point, other] = inputs;
            const command =
                inputs.length === 3
                    ? points(...inputs) && "Plane"
                    : inputs.length === 2 &&
                      points(point) &&
                      (isDirection(other)
                          ? "ParallelPlane"
                          : is(other, ["line"]) && "LinePlane");
            return !!command && definePlane(label, command, inputs.map(ref));
        },
        OrthogonalPlane: ([point, line, extra], [label]) => {
            if (extra !== undefined || !points(point) || !is(line, ["line"]))
                return false;
            return definePlane(label, "OrthogonalPlane", [
                ref(point),
                ref(line),
            ]);
        },
        // Where plane p cuts a sphere, the side of a cylinder or a cone, or a
        // polyhedron (a vertex where p cuts each edge), or where planes p and
        // q meet.
        IntersectPath: ([first, second, extra], [label, ...outputs]) => {
            if (extra !== undefined || !isPlane(first)) return false;
            if (spheres.has(second))
                return define(label, "circle", "SphereSection", [
                    ref(second),
                    ref(first),
                ]);
            const solid = revolutions.get(second);
            if (solid)
                return define(label, "section", "CylinderSection", [
                    ref(solid.label),
                    ref(first),
                ]);
            // A pyramid's section has its vertices in the order of its
            // edges; another polyhedron's, around its center.
            const edges = polyhedra.get(second);
            const faces = edges ? undefined : shells.get(second);
            if (edges || faces) {
                const name = (end: string) => `_${objects.get(end)!.variable}`;
                define(label, "polygon", "PlaneSection", [
                    ref(first),
                    literal(
                        edges ? edges.flat().map(name).join(",") : name(second),
                    ),
                ]);
                const count =
                    edges?.length ??
                    new Set(
                        faces!.flatMap((face) =>
                            face.map((end, index) =>
                                [end, face[(index + 1) % face.length]]
                                    .sort()
                                    .join(),
                            ),
                        ),
                    ).size;
                // GeoGebra names the section's vertices in turn, whichever
                // edges they lie on: they take its first vertex's style,
                // without a name. Several polygons may come before them.
                const element = outputs
                    .map((output) => elements.get(output))
                    .find((item) =>
                        item?.getAttribute("type")?.startsWith("point"),
                    );
                const style =
                    element &&
                    objectStyle(element, "point")
                        .split(";")
                        .filter((part) => part !== "sn:true")
                        .join(";");
                for (let index = 0; index < count; index++)
                    define(
                        auxiliary(),
                        "point",
                        "Vertex",
                        [ref(label), literal(index)],
                        style,
                    );
                return true;
            }
            return (
                isPlane(second) &&
                define(label, "line", "PlaneLine", [ref(first), ref(second)])
            );
        },
        // A plane's section of a sphere, or the circle where two spheres meet,
        // in the plane orthogonal to their centers' line where the powers
        // of its points with respect to both spheres are equal.
        IntersectConic: ([first, second, extra], outputs) => {
            if (extra !== undefined || !spheres.has(second)) return false;
            if (!spheres.has(first))
                return HANDLERS.IntersectPath([first, second], outputs);
            return define(outputs[0], "circle", "SphereSection", [
                ref(first),
                ref(second),
            ]);
        },
        Mirror: mirror,
        Reflect: mirror,
        // Rotate(P, a, C), keeping P's height; C defaults to the origin.
        // In space, around a line, or around the axis through a point
        // along a vector or a line.
        Rotate: transform(([angle, center, axis]) => {
            const a = formula(angle, VALUE_KINDS);
            const line = axis ?? (points(center) ? undefined : center);
            if (
                a === null ||
                (line !== undefined && !is(line, ["line"])) ||
                (axis !== undefined && !points(center))
            )
                return null;
            return (p, label, kind = "point") =>
                line === undefined
                    ? define(label, kind, "Rotation", [
                          ref(p),
                          literal(a),
                          ...(center ? [ref(center)] : []),
                      ])
                    : define(label, kind, "AxisRotation", [
                          ref(p),
                          literal(a),
                          ref(line),
                          ...(axis ? [ref(center)] : []),
                      ]);
        }),
        Dilate: transform(([factor, center, extra]) => {
            const k = formula(factor, VALUE_KINDS);
            if (
                extra !== undefined ||
                k === null ||
                (center !== undefined && !points(center))
            )
                return null;
            return (p, label, kind = "point") =>
                define(label, kind, "Dilation", [
                    ref(p),
                    literal(k),
                    ...(center ? [ref(center)] : []),
                ]);
        }),
        Vector: ([p, q], [label]) => {
            if (!points(p, q)) return false;
            vectors.set(label, [p, q]);
            return define(label, "line", "Vector", [ref(p), ref(q)]);
        },
        // By a vector, a point's position vector or a formula.
        Translate: transform(([vector, extra]) => {
            if (extra !== undefined) return null;
            if (vectors.has(vector) || points(vector))
                return (p, label, kind = "point") =>
                    define(label, kind, "Translation", [ref(p), ref(vector)]);
            const v = formula(vector, VALUE_KINDS);
            return v
                ? (p, label, kind = "point") =>
                      define(label, kind, "Translation1", [ref(p), literal(v)])
                : null;
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
        // Sequence(f(i), i, a, b, s): the list of f(a), f(a + s), … up to
        // b, f being a point or a number, a segment, a polygon, a circle by
        // its radius, or another Sequence, whose bounds read i (see
        // sequence_object.ts). Read by name, a list of points is its value.
        Sequence: (
            [expression, variable, from, to, step = "1", extra],
            [label],
        ) => {
            const loops = [[variable, from, to, step]];
            let inner = normalizeBrackets(expression);
            let call = commandCall(inner);
            while (
                call?.[0] === "Sequence" &&
                call[1].length >= 4 &&
                call[1].length <= 5
            ) {
                const [nested, name, a, b, s = "1"] = call[1];
                loops.push([name, a, b, s]);
                inner = nested;
                call = commandCall(inner);
            }
            const nature =
                call?.[0] === "Circle" &&
                (call[1].length === 2 || call[1].length === 3)
                    ? "circle"
                    : call?.[0] === "Segment" && call[1].length === 2
                      ? "segment"
                      : call?.[0] === "Polygon" && call[1].length > 2
                        ? "polygons"
                        : "point";
            const ends = nature === "point" ? [inner] : call![1];
            // Circle(M, A) as Circle(M, Distance(M, A)).
            if (nature === "circle" && points(ends[1]))
                ends[1] = `Distance(${ends})`;
            const names = loops.map(([name]) => name);
            if (
                extra !== undefined ||
                !names.every((name) => IDENTIFIER.test(name)) ||
                new Set(names).size < names.length
            )
                return false;
            const locals = new Map<string, string>();
            const bounds = loops.map(([name, ...range]) => {
                const values = range.map((bound) =>
                    formula(bound, VALUE_KINDS, locals),
                );
                locals.set(name, name);
                return [
                    name,
                    ...(values[2] === "1" ? values.slice(0, 2) : values),
                ];
            });
            const formulas = ends.map((end) =>
                formula(end, VALUE_KINDS, locals),
            );
            if (bounds.flat().includes(null) || formulas.includes(null))
                return false;
            const element = elements.get(label);
            const size = element && attribute(element, "pointSize", "val");
            define(
                label,
                "list",
                "Sequence",
                [nature, JSON.stringify(bounds), JSON.stringify(formulas)].map(
                    literal,
                ),
                element &&
                    `${objectStyle(element, "list")}${nature === "point" && size ? `;s:${size}` : ""}`,
            );
            if (nature === "point")
                lists.set(
                    label,
                    named(objects.get(label)!.variable, loops.length),
                );
            return true;
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
                "h:2",
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
                    attribute(element, "show", "label") === "true"
                        ? caption(element, label)
                        : "",
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
            if (type === "function") {
                const body = ifFormula(
                    inputs,
                    ["expression"],
                    new Map([["x", "x"]]),
                );
                return body !== null && defineFunction(label, body);
            }
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
        // Kimberling's first centers, by their barycentric coordinates:
        // incenter, centroid, circumcenter, orthocenter and nine-point
        // center.
        TriangleCenter: ([a, b, c, n], [label]) =>
            points(a, b, c) &&
            ["1", "2", "3", "4", "5"].includes(n) &&
            define(label, "point", "TriangleCenter", [
                ...[a, b, c].map(ref),
                literal(Number(n)),
            ]),
        Corner: (inputs, [label]) => {
            const corner = cornerFormula(inputs);
            if (corner === null) return false;
            formulaPoint(corner, label);
            return true;
        },
        Text: ([source, point], [label]) => {
            const element = elements.get(label);
            const at = point === undefined ? undefined : pointAt(point);
            return !!element && at !== null && text(label, element, source, at);
        },
        FractionText: formulaCommand("FractionText"),
        Element: formulaCommand("Element"),
        // At x(A) on a function's graph; at A on a circle through it; from
        // A, touching the circle where the circle of diameter A and its
        // center cuts it.
        // Through a point, to a function's curve, also at an abscissa, or
        // to a circle or a conic: two tangents.
        Tangent: ([p, curve, extra], outputs) => {
            if (extra !== undefined) return false;
            if (functions.has(curve)) {
                const abscissa = points(p) ? null : formula(p, VALUE_KINDS);
                if (!points(p) && abscissa === null) return false;
                const at =
                    abscissa === null ? p : formulaPoint(planar(abscissa, "0"));
                curveTangents.set(outputs[0], [curve, at]);
                return define(outputs[0], "line", "Tangent", [
                    ref(at),
                    ref(curve),
                ]);
            }
            if (!points(p) || !is(curve, ["circle", "quadric"])) return false;
            outputs.forEach(
                (output, index) =>
                    output &&
                    define(output, "line", "Tangent", [
                        ref(p),
                        ref(curve),
                        literal(index),
                    ]),
            );
            return true;
        },
        // Drawn as GeoGebra's slope triangle, from the line's start point.
        Slope: ([line, extra], [label]) => {
            if (extra !== undefined || !is(line, ["line"])) return false;
            const m = hiddenExpression(slopeFormula(line), label);
            const tangent = curveTangents.get(line);
            const [f, p] = (tangent ?? []).map(
                (input) => objects.get(input)!.variable,
            );
            const start =
                linePoint(line) ??
                (tangent && formulaPoint(planar(`x(${p})`, `${f}(x(${p}))`)));
            const element = elements.get(label);
            if (start && element) {
                const s = objects.get(start)!.variable;
                definePolygon(
                    auxiliary(),
                    [
                        start,
                        formulaPoint(`${s}+${planar("1", "0")}`),
                        formulaPoint(`${s}+${planar("1", m)}`),
                    ],
                    shapeStyle(element),
                );
            }
            return true;
        },
        Length: formulaCommand("Length"),
        PathParameter: formulaCommand("PathParameter"),
        Function: ([f, a, b, extra], [label]) => {
            const body = functionBody(f);
            const [min, max] = [a, b].map((bound) =>
                formula(bound ?? "", VALUE_KINDS),
            );
            if (
                extra !== undefined ||
                body === null ||
                min === null ||
                max === null
            )
                return false;
            return NUMBER.test(min) && NUMBER.test(max)
                ? defineFunction(label, body, min, max)
                : defineFunction(
                      label,
                      `(x>=(${min})&&x<=(${max}))?(${body}):(0/0)`,
                  );
        },
        Derivative: ([f, extra], [label]) => {
            const fn = extra === undefined && functionOf(f);
            return !!fn && defineFunction(label, derivative(fn, "x"));
        },
        // By Simpson's rule, drawn as the region between the graph and the
        // x-axis.
        Integral: ([f, a, b, extra], [label]) => {
            const fn = functionOf(f);
            const bounds = [a, b].map((bound) =>
                formula(bound ?? "", VALUE_KINDS),
            );
            if (extra !== undefined || !fn || bounds.includes(null))
                return false;
            const [p, q] = bounds.map((bound) => hiddenExpression(bound!));
            hiddenExpression(
                `var $h=(${q}-${p})/${SIMPSON_INTERVALS},$s=${fn}(${p})+${fn}(${q});for(var $n=1;$n<${SIMPSON_INTERVALS};$n++){$s+=(2+2*($n%2))*${fn}(${p}+$n*$h)};$s*$h/3`,
                label,
            );
            const x = `${p}+(k-1)*(${q}-${p})/${REGION_INTERVALS}`;
            region(
                label,
                String(REGION_INTERVALS + 3),
                `k==0||k==count-1?[k?${q}:${p},0]:[${x},${fn}(${x})]`,
            );
            return true;
        },
        LowerSum: riemannSum("min"),
        UpperSum: riemannSum("max"),
        Random: savedValue,
        RandomBetween: savedValue,
        RandomUniform: savedValue,
        // Drawn at import when GeoGebra saved no value, as for a text.
        RandomElement: (inputs, outputs) =>
            savedValue(inputs, outputs) ||
            formulaCommand("Element")(
                [inputs[0], `Random(1,Length(${inputs[0]}))`],
                outputs,
            ),
        Min: formulaCommand("Min"),
        Max: formulaCommand("Max"),
        Mod: formulaCommand("Mod"),
        // Each root as its own point.
        Roots: (inputs, outputs) => {
            const list = listFormula(`Roots(${inputs.join(",")})`);
            if (!list) return false;
            outputs.forEach(
                (label, index) =>
                    label && formulaPoint(list.item(String(index + 1))!, label),
            );
            return true;
        },
        Locus: ([p, q, extra], [label]) =>
            extra === undefined &&
            points(p) &&
            is(q, ["pointOn"]) &&
            define(label, "locus", "Locus", [ref(p), ref(q)]),
        // On its swept part only, as for a locus, where GeoGebra draws the
        // whole algebraic curve.
        Envelope: ([d, q, extra], [label]) =>
            extra === undefined &&
            is(d, ["line"]) &&
            is(q, ["pointOn"]) &&
            define(label, "locus", "Envelope", [ref(d), ref(q)]),
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
        if (slider && attribute(element, "show", "label") === "false")
            parts.push("cN:true");
        return parts.join(";");
    };

    // A list of points is drawn, other lists only read by formulas.
    const defineList = (
        label: string,
        element: Element,
        source: string,
    ): boolean => {
        const list = listFormula(source);
        if (!list) return false;
        lists.set(label, list);
        if (attribute(element, "listType", "val") !== "point") {
            // Written {…}, an expression the formulas read by name.
            const text = normalizeBrackets(source.trim());
            if (!/^\{.*\}$/.test(text)) return true;
            const items = splitArguments(text.slice(1, -1))!.map((item) =>
                formula(item, VALUE_KINDS),
            );
            define(
                label,
                "expression",
                "Expression",
                ["", "", "", `[${items}]`, "0", "0"].map(literal),
                "h:1",
            );
            lists.set(label, {
                ...named(objects.get(label)!.variable, 1),
                count: list.count,
            });
            return true;
        }
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
            dependent !== null && !isConstant(dependent) ? dependent : value;
        if (content !== dependent && !NUMBER.test(content)) return false;
        // Untranslated, it keeps its saved value, but is reported.
        if (source !== undefined && dependent === null)
            unsupported.push(`numeric ${label}`);
        return define(
            label,
            "expression",
            "Expression",
            ["", "", "", content, "0", "0"].map(literal),
            style,
        );
    };

    // A text's literal strings and formulas: GeoGebra adds up the numbers
    // before its first string, then concatenates every term, writing an
    // object's name, an angle in degrees and a point as its coordinates.
    const textParts = (source: string): TextPart[] | null => {
        const parts: TextPart[] = [];
        let concatenating = false;
        let sum: string[] = [];
        const addSum = (): boolean => {
            if (sum.length === 0) return true;
            const value = formula(sum.join("+"), TEXT_KINDS);
            sum = [];
            if (value === null) return false;
            parts.push({ formula: value });
            return true;
        };
        for (const term of textTerms(source)) {
            let inner = term;
            while (
                /^\(.*\)$/.test(inner) &&
                splitArguments(inner.slice(1, -1))?.length === 1
            )
                inner = inner.slice(1, -1).trim();
            const name = /^Name\[(.*)\]$/.exec(inner)?.[1];
            if (/^"[^"]*"$/.test(inner) || (name && elements.has(name))) {
                if (!addSum()) return null;
                parts.push(name ?? inner.slice(1, -1));
                concatenating = true;
                continue;
            }
            const variable = objects.get(inner)?.variable;
            if (is(inner, ["angle"])) {
                if (!addSum()) return null;
                parts.push({ formula: `${variable}*180/π` }, "°");
                continue;
            }
            if (points(inner)) {
                if (
                    !addSum() ||
                    attribute(elements.get(inner)!, "coordStyle", "style") ===
                        "complex"
                )
                    return null;
                parts.push(
                    "(",
                    ...[`x(${variable})`, `y(${variable})`]
                        .concat(is3D ? [`dot(${variable},[0,0,1])`] : [])
                        .flatMap((coordinate, index) => [
                            ...(index ? [", "] : []),
                            { formula: coordinate },
                        ]),
                    ")",
                );
                continue;
            }
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
    // gather environments as aligned and gathered, and refuses the "$"
    // delimiters GeoGebra ignores in its math mode.
    const inlineTeX = (tex: string): string =>
        tex
            .replace(/\\(begin|end)\{(align|gather)\*?\}/g, "\\$1{$2ed}")
            .replace(/\\?\$/g, (match) => (match.length > 1 ? match : ""));

    // A point, or a point's coordinates such as "A + (0, 1)" as a hidden
    // point.
    const pointAt = (input: string): string | null => {
        if (points(input)) return input;
        const coords = formula(input, VALUE_KINDS);
        return coords && formulaPoint(coords);
    };

    // Anchored at `at` or else at its start point.
    const text = (
        label: string,
        element: Element,
        source: string,
        at?: string,
    ): boolean => {
        const parts = textParts(source);
        if (parts === null) return false;
        const latex = attribute(element, "isLaTeX", "val") === "true";
        const content = `""${parts
            .map((part) =>
                typeof part === "string"
                    ? `+"${(latex ? inlineTeX(part) : part).replace(/[\\"]/g, "\\$&")}"`
                    : `+(${part.formula})`,
            )
            .join("")}`;
        if (
            child(element, "absoluteScreenLocation") ||
            (latex && attribute(element, "show", "object") === "false")
        )
            return textExpression(label, element, content);
        const start = child(element, "startPoint");
        const exp = start?.getAttribute("exp");
        const anchor = at ?? (exp ? pointAt(resolve(exp)) : auxiliary());
        if (anchor === null) return false;
        if (!at && !exp) {
            const [x, y, z] = ["x", "y", "z"].map((name) =>
                Number(start?.getAttribute(name) ?? (name === "z" ? 1 : 0)),
            );
            define(anchor, "point", "Point", vectorLiteral([x / z, y / z, 0]));
        }
        if (!points(anchor)) return false;
        const offset = ["x", "y"].map((name) =>
            literal(Number(attribute(element, "labelOffset", name) ?? 0)),
        );
        if (latex)
            return define(
                label,
                "expression",
                "ExpressionOn",
                [
                    ...["", "", "", content].map(literal),
                    ref(anchor),
                    { type: "array", items: offset },
                ],
                `${textStyle(element)};tx:true`,
            );
        return define(
            label,
            "text",
            "AnchoredText",
            [
                ref(anchor),
                ...offset,
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
        // A plane, of its equation or of the one GeoGebra saves: xX + yY +
        // zZ + w = 0.
        if (type === "plane3d") {
            const saved = ["x", "y", "z", "w"].map((name) =>
                Number(attribute(element, "coords", name)),
            );
            const [a, b, c, d] = saved;
            const sides =
                source === undefined
                    ? saved.every(Number.isFinite) && [
                          polynomial([
                              [a, "x"],
                              [b, "y"],
                              [c, "z"],
                              [d, ""],
                          ]),
                          "0",
                      ]
                    : source
                          .split("=")
                          .map((side) =>
                              formula(
                                  side.trim(),
                                  VALUE_KINDS,
                                  PLANE_VARIABLES,
                              ),
                          );
            if (!sides || sides.length !== 2 || sides.includes(null))
                return false;
            return definePlane(
                label,
                "EquationPlane",
                (sides as string[]).map(literal),
            );
        }
        // A line, a circle or a conic of the plane, of its equation or of
        // the one GeoGebra saves: xX + yY + z = 0 for a line, A0x² + A1y² +
        // A2 + 2A3xy + 2A4x + 2A5y = 0 for a conic, a circle when A0 = A1
        // and A3 = 0.
        if ((type === "line" || type === "conic") && !is3D) {
            const line = type === "line";
            const saved = (
                line
                    ? ["x", "y", "z"].map((name) =>
                          attribute(element, "coords", name),
                      )
                    : [0, 1, 2, 3, 4, 5].map((index) =>
                          attribute(element, "matrix", `A${index}`),
                      )
            ).map(Number);
            const [a0, a1, a2, a3, a4, a5] = saved;
            const circle = !line && a0 !== 0 && a0 === a1 && a3 === 0;
            const sides =
                source === undefined
                    ? saved.every(Number.isFinite) && [
                          polynomial(
                              line
                                  ? [
                                        [a0, "x"],
                                        [a1, "y"],
                                        [a2, ""],
                                    ]
                                  : [
                                        [a0, "x^2"],
                                        [2 * a3, "x*y"],
                                        [a1, "y^2"],
                                        [2 * a4, "x"],
                                        [2 * a5, "y"],
                                        [a2, ""],
                                    ],
                          ),
                          "0",
                      ]
                    : source
                          .split("=")
                          .map((side) =>
                              formula(
                                  side.trim(),
                                  VALUE_KINDS,
                                  EQUATION_VARIABLES,
                              ),
                          );
            if (!sides || sides.length !== 2 || sides.includes(null))
                return false;
            return define(
                label,
                line ? "line" : circle ? "circle" : "quadric",
                line
                    ? "EquationLine"
                    : circle
                      ? "EquationCircle"
                      : "EquationConic",
                (sides as string[]).map(literal),
            );
        }
        if (type === "numeric" || type === "angle")
            return numeric(label, element);
        if (type === "text" && source !== undefined)
            return text(label, element, source);
        if (type === "list" && source !== undefined)
            return defineList(label, element, source);
        // Scripts never run: a button has nothing to do.
        if (type === "button") return true;
        // A boolean is a checkbox, at its label's place on screen, that
        // only an independent one lets tick.
        if (type === "boolean") {
            const value =
                source === undefined ? "" : formula(source, VALUE_KINDS);
            if (value === null) return false;
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
                    caption(element, label),
                    "",
                    "",
                    value && !isConstant(value)
                        ? value
                        : attribute(element, "value", "val") === "true"
                          ? "1"
                          : "0",
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
            if (!image) return false;
            const picture = [image.url, image.width, image.height].map(literal);
            const location = child(element, "absoluteScreenLocation");
            if (location)
                return define(label, "image", "ScreenImage", [
                    ...picture,
                    ...screenPosition(
                        Number(location.getAttribute("x")),
                        Number(location.getAttribute("y")),
                        true,
                    ).map(literal),
                ]);
            const [a, b] = corners;
            let d = corners[2];
            if (!points(a, ...corners.filter(Boolean))) return false;
            // Without its bottom right corner, the image keeps its
            // proportions: its bottom goes right of its left side, as long.
            if (d && !b) {
                const [va, vd] = [a, d].map((p) => objects.get(p)!.variable);
                const ratio = image.width / image.height;
                corners[1] = formulaPoint(
                    `[x(${va})+(y(${vd})-y(${va}))*${ratio},y(${va})-(x(${vd})-x(${va}))*${ratio}]`,
                );
            }
            if (corners[1]) {
                const build = (image: string, points: string[]) =>
                    define(image, "image", "Image", [
                        ...picture,
                        ...points.map(ref),
                    ]);
                // Its top left corner, built only for its image, which a
                // reflection turns over.
                const topLeft = (): string => {
                    const [va, vb] = [a, corners[1]].map(
                        (p) => objects.get(p)!.variable,
                    );
                    const ratio = image.height / image.width;
                    return formulaPoint(
                        `[x(${va})-(y(${vb})-y(${va}))*${ratio},y(${va})+(x(${vb})-x(${va}))*${ratio}]`,
                    );
                };
                shapes.set(label, {
                    get points() {
                        return [a, corners[1], d ?? (d = topLeft())];
                    },
                    build,
                });
            }
            return define(label, "image", "Image", [
                ...picture,
                ...corners.map(ref),
            ]);
        }
        if (type === "function" && source !== undefined) {
            const body = formula(
                source.replace(FUNCTION_DEFINITION, ""),
                ["expression"],
                new Map([["x", "x"]]),
            );
            return body !== null && defineFunction(label, body);
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
    // Beside the 3D view, a graphics view whose widgets stay where they are
    // in it, from the window's top left corner: the 3D view is centered in
    // the rest of the window.
    const location = (id: string) =>
        document
            .querySelector(`gui view[id="${id}"][visible="true"]`)
            ?.getAttribute("location")
            ?.split(",");
    const graphicsAt = location("1");
    const spaceAt = location("512");
    const side =
        graphicsAt &&
        spaceAt &&
        graphicsAt.find((digit, index) => digit !== spaceAt[index]);
    const across = side === "1" || side === "3";
    const strip =
        side && view
            ? Number(attribute(view, "size", across ? "width" : "height") ?? 0)
            : 0;
    const camera: GgbView3D | undefined = coordSystem3D
        ? {
              shift: across ? [strip / 2, 0] : [0, strip / 2],
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
        const axis = (id: string) =>
            [...styledView.children].find(
                (item) =>
                    item.tagName === "axis" && item.getAttribute("id") === id,
            );
        const shown = ["0", "1"].filter(
            (id) => axes && axis(id)?.getAttribute("show") !== "false",
        );
        // In 2D, as GeoGebra draws them: a line 1 pixel wide, 2 if bold,
        // numbers at three quarters of the figure's font size, and only the
        // axes' positive halves, if the shown ones all say so (DGPad's
        // option is for both).
        const bold = Number(attribute(styledView, "lineStyle", "axes")) & 2;
        const positive =
            shown.length > 0 &&
            shown.every(
                (id) => axis(id)!.getAttribute("positiveAxis") === "true",
            );
        const numbers = Math.max(Math.round(fontSize * 0.75), 10);
        // Per axis: its fixed distance between two numbers, if not
        // automatic, whether it has minor and major graduations (0), only
        // major ones (1) or none (2), its name (a LaTeX one as its text),
        // whether it shows its numbers and their unit.
        const graduations = ["X", "Y"]
            .map((name, id) => {
                const settings = axis(String(id));
                const distance = Number(settings?.getAttribute("tickDistance"));
                const style = settings?.getAttribute("tickStyle") ?? "";
                const text = (attribute: string) =>
                    encodeURIComponent(
                        (settings?.getAttribute(attribute) ?? "").replace(
                            /^\$(.*)\$$/,
                            "$1",
                        ),
                    );
                return `;tickDistance${name}:${distance > 0 ? distance : 0};tickStyle${name}:${/^[012]$/.test(style) ? style : 1};axisLabel${name}:${text("label")};numbers${name}:${settings?.getAttribute("showNumbers") !== "false"};axisUnit${name}:${text("unitLabel")}`;
            })
            .join("");
        // Its arrows: none, open or filled.
        const lineType = Number(
            attribute(styledView, "lineStyle", "axes") ?? 1,
        );
        const arrows = lineType & 1 ? (lineType & 8 ? 3 : 2) : 1;
        const labelStyle = Number(attribute(styledView, "labelStyle", "axes"));
        // The grid: its major lines at a fixed distance if it has one, else
        // at the numbers', five minor intervals between two with a subgrid
        // (type 3), its color, a line 2 pixels wide if bold, its dashes.
        const gridDistances = child(styledView, "grid");
        const gridWidth =
            attribute(styledView, "evSettings", "gridIsBold") === "true"
                ? 2
                : 1;
        const gridColor = child(styledView, "gridColor");
        const gridDash =
            GGB_DASHES[attribute(styledView, "lineStyle", "grid") ?? ""];
        const gridStyle = `;gridSubdivisions:${attribute(styledView, "evSettings", "gridType") === "3" ? 5 : 1};gridWidth:${gridWidth}${
            gridDistances
                ? `;gridDistanceX:${gridDistances.getAttribute("distX")};gridDistanceY:${gridDistances.getAttribute("distY")}`
                : ""
        }${gridColor ? `;gridColor:${hexColor(gridColor)}` : ""}${
            gridDash ? `;gridDash:${gridDash(gridWidth).join(",")}` : ""
        }`;
        const plane = is3D
            ? ""
            : `;axisWidth:${bold ? 2 : 1};fontSize:${numbers};onlyPositive:${positive}${graduations};arrows:${arrows};boldNumbers:${Boolean(labelStyle & 1)};geogebraAxes:true${gridStyle}`;
        push(null, "SetCoordsStyle", [
            literal(
                `isAxis:${axes || (grid && !is3D)};isGrid:${grid};isOx:${shown.includes("0")};isOy:${shown.includes("1")}${
                    axesColor ? `;color:${hexColor(axesColor)}` : ""
                }${plane}`,
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

    // A point's expression: a tuple, or a point outside any call, as in
    // "B + (-2, -2)" but not "x(B) + 2". Each innermost parenthesis becomes
    // a number, or "⊙" if it's a point.
    const isPoint = (text: string): boolean => {
        let rest = text.replace(/"[^"]*"/g, "");
        const point = (part: string): boolean =>
            part.includes("⊙") ||
            (part.match(LABEL_WORDS) ?? []).some((word) =>
                is(word, POINT_KINDS),
            );
        for (let match; (match = INNERMOST.exec(rest));)
            rest = `${rest.slice(0, match.index)}${
                !match[1] && (/[,;]/.test(match[2]) || point(match[2]))
                    ? "⊙"
                    : "0"
            }${rest.slice(match.index + match[0].length)}`;
        return point(rest);
    };
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
            lineStarts.set(text, origin);
            return text;
        }
        const label = auxiliary();
        if (NUMERIC_TUPLE.test(text)) {
            const [x, y, z] = text.slice(1, -1).split(",").map(Number);
            define(label, "point", "Point", vectorLiteral([x, y, z ?? 0]));
            return label;
        }
        const coords = isPoint(text) ? formula(text, VALUE_KINDS) : null;
        if (coords !== null) return formulaPoint(coords, label);
        const call = commandCall(text);
        return call && HANDLERS[call[0]]?.(inputs(...call), [label])
            ? label
            : input;
    };
    // A command that binds a variable reads its own inputs: built
    // beforehand, Polygon(Translate(A, k u)) would read k as an object of
    // the figure, not as Sequence's index.
    const inputs = (name: string, sources: string[]): string[] =>
        BINDING_COMMANDS.has(name) ? sources : sources.map(resolve);

    const translated = new Set<string>();
    const translate = (node: Element): void => {
        if (node.tagName === "command") {
            const name = node.getAttribute("name") ?? "";
            const sources = indexedAttributes(child(node, "input"));
            const outputs = indexedAttributes(child(node, "output"));
            const handler = HANDLERS[name];
            // A random list (Shuffle, a Sequence of random numbers…) keeps
            // the value GeoGebra saved; a list command is read from its own
            // sources.
            const list =
                child(node, "output")?.getAttribute("randomResult") ??
                (LIST_COMMANDS.has(name) ||
                (name === "Sequence" && sources.length < 3)
                    ? `${name}(${sources.join(",")})`
                    : undefined);
            const element = elements.get(outputs[0]);
            // Without any output, GeoGebra failed to evaluate the command:
            // it builds nothing.
            if (
                outputs.some(Boolean) &&
                !(list && element
                    ? defineList(outputs[0], element, list)
                    : handler?.(inputs(name, sources), outputs))
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
                  ? [
                        expressions.get(label) ?? "",
                        ...[...node.children].map((item) =>
                            item.tagName === "startPoint"
                                ? (item.getAttribute("exp") ?? "")
                                : "",
                        ),
                    ].join(",")
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
        const drawn = parts.get(label) ?? [label];
        if (
            source === undefined ||
            !objects.has(drawn[0]) ||
            (element.getAttribute("type") === "numeric" &&
                !child(element, "slider"))
        )
            return;
        if (!conditions.has(source)) {
            const content = formula(source, VALUE_KINDS);
            if (content === null) {
                unsupported.push(`condition ${source}`);
                conditions.set(source, null);
            } else conditions.set(source, hiddenExpression(content));
        }
        const condition = conditions.get(source);
        if (condition)
            drawn.forEach((part) =>
                push(null, "STL", [ref(part), literal(`h:0;sc:${condition}`)]),
            );
    });

    const rates = new Map<string, string>();
    rateSources.forEach((source, label) => {
        const variable = objects.get(label)!.variable;
        const content = formula(source, VALUE_KINDS);
        if (content === null) {
            unsupported.push(`animation ${label}`);
            animations.delete(variable);
        } else
            rates.set(
                variable,
                is(source, ["expression"])
                    ? objects.get(source)!.variable
                    : hiddenExpression(content),
            );
    });

    return {
        calls,
        targets,
        handles,
        nameShifts,
        animations,
        rates,
        startAnimation:
            document
                .querySelector("kernel > startAnimation")
                ?.getAttribute("val") === "true",
        unsupported,
        is3D,
        view3D: camera,
    };
}
