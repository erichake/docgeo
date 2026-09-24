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
    const unsupported: string[] = [];
    const objects = new Map<string, { variable: string; kind: Kind }>();
    const segments = new Map<string, [string, string]>();
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
        const variable = IDENTIFIER.test(label) ? label : `$${calls.length}`;
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
            const vertex = labels[index] || auxiliary();
            define(vertex, "point", "Point", [
                literal(
                    `${p}+[${cos}*${dx}-${sin}*${dy},${sin}*${dx}+${cos}*${dy}${is3D ? ",0" : ""}]`,
                ),
                literal(is3D ? "1" : "0"),
            ]);
            return vertex;
        });
    };

    type Handler = (inputs: string[], outputs: string[]) => boolean;
    const onePoint =
        (command: string, arity: number, kind: Kind = "line"): Handler =>
        (inputs, [label]) =>
            inputs.length === arity &&
            points(...inputs) &&
            define(label, kind, command, inputs.map(ref));
    const circumcircleArc = onePoint("Arc3pts", 3, "circle");
    const mirror: Handler = ([source, mirror], [label]) =>
        points(source) &&
        (points(mirror)
            ? define(label, "point", "Symmetry", [ref(mirror), ref(source)])
            : is(mirror, ["line"]) &&
              define(label, "point", "Reflection", [ref(mirror), ref(source)]));

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
        CircumcircleArc: circumcircleArc,
        CircumcircularArc: circumcircleArc,
        Conic: onePoint("Quadric", 5, "quadric"),
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
            define(label, "polygon", "Polygon", [
                literal(
                    inputs
                        .map((input) => `_${objects.get(input)!.variable}`)
                        .join(","),
                ),
            ]);
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
                    define(label, "polygon", "Polygon", [
                        literal(
                            face
                                .map(
                                    (vertex) =>
                                        `_${objects.get(vertices[vertex])!.variable}`,
                                )
                                .join(","),
                        ),
                    ]);
            });
            CUBE_EDGES.forEach(([p, q], index) => {
                const label = outputs[11 + index];
                if (label) defineSegment(label, vertices[p], vertices[q]);
            });
            return true;
        },
        Mirror: mirror,
        Reflect: mirror,
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

    const independent = (label: string, element: Element): boolean => {
        const type = element.getAttribute("type");
        const source = expressions.get(label);
        if (type === "point" || type === "point3d") {
            if (source !== undefined && !NUMERIC_TUPLE.test(source)) {
                const coords = formula(source, VALUE_KINDS);
                return (
                    coords !== null &&
                    define(label, "point", "Point", [
                        literal(coords),
                        literal("0"),
                    ])
                );
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

    return { calls, targets, unsupported, view3D: camera };
}
