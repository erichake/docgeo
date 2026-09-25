import type { Vec3 } from "../vec";
import { formulaIdentifiers, parseFormula } from "./dgp_formula";
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
    | "locus"
    | "angle"
    | "expression"
    | "curve";

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
    // Present for a 3D figure: its camera (see applyView3D in
    // ggb_importer.ts).
    view3D?: GgbView3D;
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
const VECTOR_COMMANDS = new Set(["Vector", "OrthogonalVector"]);
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
    x: "x",
    y: "y",
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
// order.
const CUBE_FACES = [
    [0, 1, 2, 3],
    [0, 3, 7, 4],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [4, 5, 6, 7],
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
        if (character === "(") depth++;
        else if (character === ")" && --depth < 0) return null;
        else if (character === "," && depth === 0) {
            parts.push(text.slice(start, index).trim());
            start = index + 1;
        }
    }
    parts.push(text.slice(start).trim());
    return parts;
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

function wrapAngle(angle: number, low: number): number {
    const turn = 2 * Math.PI;
    return low + ((((angle - low) % turn) + turn) % turn);
}

export function translateGgb(xml: string): GgbTranslation {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    const construction = document.querySelector("construction");
    if (document.querySelector("parsererror") || !construction)
        throw new Error("Invalid GGB XML");

    const calls: DgpCall[] = [];
    const targets = new Map<string, Vec3>();
    const handles = new Map<string, [string | null, string | null]>();
    const unsupported: string[] = [];
    const objects = new Map<string, { variable: string; kind: Kind }>();
    const segments = new Map<string, [string, string]>();
    const vectors = new Map<string, [string, string]>();
    const polygons = new Map<string, string[]>();
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
    const coordSystem = view && child(view, "coordSystem");
    const origin: [number, number] = coordSystem
        ? [
              Number(coordSystem.getAttribute("xZero")),
              Number(coordSystem.getAttribute("yZero")),
          ]
        : [0, 0];
    const unit = Number(coordSystem?.getAttribute("scale") ?? 50);

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
    // variables, "(a, b)" tuples become "[a,b]" vectors. Returns null for
    // anything the DGP formula engine can't evaluate.
    const formula = (
        source: string,
        kinds: Kind[],
        allowX = false,
    ): string | null => {
        const known = objects.get(source);
        if (known) return kinds.includes(known.kind) ? known.variable : null;
        const text = normalizeBrackets(source)
            .replace(/²/g, "^2")
            .replace(/³/g, "^3")
            .replace(/°/g, "*π/180")
            .replace(/\s+/g, " ");
        const groups: { start: number; call: boolean; comma: boolean }[] = [];
        let result = "";
        let index = 0;
        while (index < text.length) {
            const character = text[index];
            if (IDENTIFIER_START.test(character)) {
                let end = index + 1;
                while (end < text.length && IDENTIFIER_PART.test(text[end]))
                    end++;
                const word = text.slice(index, end);
                if (text[end] === "(" && VECTOR_COMMANDS.has(word)) {
                    let depth = 0;
                    do {
                        if (text[end] === "(") depth++;
                        else if (text[end] === ")") depth--;
                        end++;
                    } while (depth > 0 && end < text.length);
                    const vector = vectorFormula(text.slice(index, end));
                    if (vector === null) return null;
                    result += vector;
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
                else if (word === "x" && allowX) result += "x";
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
            } else if (/[\d.+\-*/^ ]/.test(character)) result += character;
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
                    `np:${Math.atan2(
                        -Number(offset.getAttribute("y")),
                        Number(offset.getAttribute("x")),
                    )}`,
                );
            if (attribute(element, "trace", "val") === "true")
                parts.push("tk:true");
        } else {
            const thickness = attribute(element, "lineStyle", "thickness");
            if (thickness) parts.push(`s:${Number(thickness) / 2}`);
            const alpha = Number(color?.getAttribute("alpha") ?? 0);
            if (alpha > 0 && alpha <= 1) parts.push(`o:${alpha}`);
            const arc = attribute(element, "arcSize", "val");
            if (kind === "angle" && arc) parts.push(`arc:${arc}`);
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
        // "i" is the imaginary unit in a DGP formula.
        const variable =
            IDENTIFIER.test(label) && label !== "i"
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

    const definePolygon = (label: string, vertices: string[]): true =>
        define(label, "polygon", "Polygon", [
            literal(
                vertices
                    .map((vertex) => `_${objects.get(vertex)!.variable}`)
                    .join(","),
            ),
        ]);

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
        return true;
    };

    const segmentEnds = (input: string): [string, string] | undefined =>
        segments.get(input);

    const points = (...labels: (string | undefined)[]): boolean =>
        labels.every((label) => is(label, POINT_KINDS));

    const sliderScreen = (slider: Element): [number, number] => {
        const x = Number(slider.getAttribute("x"));
        const y = Number(slider.getAttribute("y"));
        return (slider.getAttribute("absoluteScreenLocation") ??
            slider.getAttribute("fixed")) === "true"
            ? [(x - origin[0]) / unit, (origin[1] - y) / unit]
            : [x, y];
    };

    // Polygon(A, B, n)'s other vertices, counterclockwise like GeoGebra's:
    // the k-th is A + (B - A)·(1 - w^k)/(1 - w) with w = e^(2iπ/n), i.e.
    // B - A rotated by (k - 1)π/n and scaled by sin(kπ/n)/sin(π/n).
    const regularVertices = (
        a: string,
        b: string,
        n: number,
        labels: string[],
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
                `${p}+${planar(`${cos}*${dx}-${sin}*${dy}`, `${sin}*${dx}+${cos}*${dy}`)}`,
                labels[index],
            );
        });
    };

    const planar = (x: string, y: string): string =>
        `[${x},${y}${is3D ? ",0" : ""}]`;

    const formulaPoint = (source: string, label = auxiliary()): string => {
        define(label, "point", "Point", [
            literal(source),
            literal(is3D ? "1" : "0"),
        ]);
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
        OrthogonalLine: ([p, line, extra], [label]) =>
            extra === undefined &&
            points(p) &&
            is(line, ["line"]) &&
            define(label, "line", "Perpendicular", [ref(line), ref(p)]),
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
            const [a, b, count] = inputs;
            if (inputs.length === 3 && points(a, b) && NUMBER.test(count)) {
                const n = Number(count);
                if (!Number.isInteger(n) || n < 3) return false;
                return HANDLERS.Polygon(
                    [a, b, ...regularVertices(a, b, n, sides.slice(n))],
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
        Cube: (inputs, [, ...outputs]) => {
            if (inputs.length !== 3 || !points(...inputs)) return false;
            const [a, b, c] = inputs.map(
                (input) => objects.get(input)!.variable,
            );
            // The square ABCD lies in plane ABC, the cube on the side of
            // AB × BC, exactly as GeoGebra builds it.
            const side = `(${b}-${a})`;
            const normal = `cross(${side},${c}-${b})`;
            const normalLength = `d(${normal},[0,0,0])`;
            const across = `cross(${normal},${side})/${normalLength}`;
            const up = `${normal}*d(${a},${b})/${normalLength}`;
            const vertices = [
                ...inputs,
                ...outputs.slice(0, 5).map((label) => label || auxiliary()),
            ];
            [
                `${a}+${across}`,
                `${a}+${up}`,
                `${b}+${up}`,
                `${b}+${across}+${up}`,
                `${a}+${across}+${up}`,
            ].forEach((vertex, index) =>
                define(vertices[index + 3], "point", "Point", [
                    literal(vertex),
                    literal("1"),
                ]),
            );
            CUBE_FACES.forEach((face, index) => {
                const label = outputs[5 + index];
                if (label)
                    definePolygon(
                        label,
                        face.map((vertex) => vertices[vertex]),
                    );
            });
            CUBE_EDGES.forEach(([p, q], index) => {
                const label = outputs[11 + index];
                if (label) defineSegment(label, vertices[p], vertices[q]);
            });
            return true;
        },
        // Pyramid(A, B, C, …, S): the base, then each lateral face V(i)V(i+1)S;
        // the base edges, then each lateral edge V(i)S.
        Pyramid: (inputs, [, ...outputs]) => {
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
        // Plane(A, B, C), drawn like GeoGebra's clipped plane: a square in
        // plane ABC around the triangle's centroid, along AB, at least as
        // large as the floor and always reaching past A, B and C.
        Plane: (inputs, [label]) => {
            if (inputs.length !== 3 || !points(...inputs)) return false;
            const [a, b, c] = inputs.map(
                (input) => objects.get(input)!.variable,
            );
            const center = `(${a}+${b}+${c})/3`;
            const half = `sqrt(25+d(${center},${a})^2+d(${center},${b})^2+d(${center},${c})^2)`;
            const normal = `cross(${b}-${a},${c}-${a})`;
            const u = `(${b}-${a})*${half}/d(${a},${b})`;
            const v = `cross(${normal},${b}-${a})*${half}/d(${normal},[0,0,0])/d(${a},${b})`;
            definePolygon(
                label,
                [
                    [-1, -1],
                    [1, -1],
                    [1, 1],
                    [-1, 1],
                ].map(([s, t]) =>
                    formulaPoint(`${center}+${s}*${u}+${t}*${v}`),
                ),
            );
            push(null, "STL", [ref(label), literal("pl:true")]);
            return true;
        },
        Mirror: mirror,
        Reflect: mirror,
        // Rotate(P, a, C) as P + (R(a) - I)(P - C), which keeps P's height
        // in 3D; C defaults to the origin.
        Rotate: ([source, angle, center, extra], [label]) => {
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
        },
        Dilate: ([source, factor, center, extra], [label]) => {
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
        },
        Vector: ([p, q], [label]) => {
            if (!points(p, q)) return false;
            vectors.set(label, [p, q]);
            return define(label, "line", "Vector", [ref(p), ref(q)]);
        },
        Translate: ([source, vector, extra], [label]) => {
            const ends = vectors.get(vector);
            if (extra !== undefined || !ends || !points(source)) return false;
            const [p, a, b] = [source, ...ends].map(
                (input) => objects.get(input)!.variable,
            );
            formulaPoint(`${p}+${b}-${a}`, label);
            return true;
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
        return parts.join(";");
    };

    const numeric = (label: string, element: Element): boolean => {
        const slider = child(element, "slider");
        const source = expressions.get(label);
        const value = attribute(element, "value", "val") ?? "";
        const style = expressionStyle(element, !!slider);
        if (slider) {
            const min = formula(slider.getAttribute("min") ?? "", []);
            const max = formula(slider.getAttribute("max") ?? "", []);
            if (min === null || max === null || !NUMBER.test(value))
                return false;
            const [x, y] = sliderScreen(slider);
            return define(
                label,
                "expression",
                "Expression",
                ["", min, max, value, String(x), String(y)].map(literal),
                style,
            );
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
            if (source !== undefined && !NUMERIC_TUPLE.test(source)) {
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
            );
        }
        if (type === "numeric" || type === "angle")
            return numeric(label, element);
        if (type === "function" && source !== undefined) {
            const body = formula(
                source.replace(FUNCTION_DEFINITION, ""),
                ["expression"],
                true,
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
    // (kept inside GRID.RESTRICT_PHI) and theta = xAngle.
    const camera: GgbView3D | undefined = coordSystem3D
        ? {
              phi: wrapAngle(-degrees("zAngle"), (3 * Math.PI) / 2),
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
        push(null, "SetCoordsStyle", [
            literal(
                `isAxis:${attribute(styledView, "evSettings", "axes") === "true"}${
                    axesColor ? `;color:${hexColor(axesColor)}` : ""
                }`,
            ),
        ]);
        const background = child(styledView, "bgColor");
        if (background)
            push(null, "SetGeneralStyle", [
                literal(`background-color:${hexColor(background)}`),
            ]);
    }

    // A command input that isn't an existing label may be a nested command
    // (e.g. "Segment[A, B]") or a constant point: built as a hidden
    // auxiliary object, like GeoGebra does.
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
        const match = COMMAND_EXPRESSION.exec(text);
        const args = match && splitArguments(match[2]);
        const handler = match && HANDLERS[match[1]];
        return args && handler?.(args.map(resolve), [label]) ? label : input;
    };

    [...construction.children].forEach((node) => {
        if (node.tagName === "command") {
            const name = node.getAttribute("name") ?? "";
            const sources = indexedAttributes(child(node, "input"));
            const outputs = indexedAttributes(child(node, "output"));
            const handler = HANDLERS[name];
            if (
                !outputs.some(Boolean) ||
                !handler?.(sources.map(resolve), outputs)
            )
                unsupported.push(`${name}(${sources.join(", ")})`);
        } else if (node.tagName === "element") {
            const label = node.getAttribute("label") ?? "";
            if (commandOutputs.has(label)) return;
            if (!independent(label, node))
                unsupported.push(`${node.getAttribute("type")} ${label}`);
        }
    });

    return { calls, targets, handles, unsupported, view3D: camera };
}
