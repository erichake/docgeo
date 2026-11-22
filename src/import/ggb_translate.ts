import type { Animation } from "../animation";
import type { SegmentMap } from "../objects/iteration_object";
import { $ } from "../dom";
import { CURSOR_OFFSET_Y } from "../objects/expression_object";
import { regularFaces } from "../objects/polyhedron_object";
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
import { LINE_COMMANDS } from "./cas_names";
import { CAS_DEFINITION, casArity } from "./cas_formula";
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
    | "polyhedron"
    | "button";

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
    // The free point dragging a formula point moves (DynamicCoordinates).
    follows: Map<string, string>;
    // Where GeoGebra moved the name of an object other than a point, in
    // pixels from its default place (see anchorName).
    nameShifts: Map<string, Vec2>;
    // The choices of a dropdown list's Expression, by its variable.
    menus: Map<string, string[]>;
    unsupported: string[];
    // The animations of points on paths and sliders that GeoGebra plays,
    // started with the figure if `startAnimation`.
    animations: Map<string, Animation>;
    // The number whose value multiplies an animation's speed, if it depends
    // on the figure.
    rates: Map<string, string>;
    startAnimation: boolean;
    // The variables of the objects built from nested commands, which
    // GeoGebra doesn't name.
    nested: Set<string>;
    // Whether the figure has 3D objects.
    is3D: boolean;
    // Present for a 3D figure: its camera (see applyView3D in
    // ggb_importer.ts).
    view3D?: GgbView3D;
    // The lines of its CAS view, its width in GeoGebra, in pixels, and
    // whether it's on the left of the graphics.
    cas?: { lines: string[]; width: number; first: boolean };
}

type TextPart = string | { formula: string };

interface ListFormula {
    count: string;
    item: (n: string) => string | null;
    // A list of lists: its n-th list, its item being null.
    sub?: (n: string) => ListFormula | null;
    // Written out as a whole, when its items are.
    array?: string;
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
    // The graphics view above or below it, `inset` pixels high, in its own
    // background color.
    band?: { color: string; inset: Vec2 };
    // Its plane view on its left (see VUES.md), and that view's width in
    // GeoGebra, in pixels (0: none).
    planeFirst: boolean;
    planeWidth: number;
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
const COMMAND_EXPRESSION = /^([A-Za-z][A-Za-z\d]*)\((.*)\)$/;
// "+ 0.7" after a point, the whole of its sum's right operand.
const POINT_SHIFT = /^ ?([+-]) ?(\d+(?:\.\d*)?|\.\d+)(?= ?(?:[)+,-]|$))/;
// The commands a formula rewrites as a whole (see commandFormula).
const FORMULA_COMMANDS = new Set([
    "Radius",
    "SelectedIndex",
    "SelectedElement",
    "Vector",
    "OrthogonalVector",
    "UnitVector",
    "UnitOrthogonalVector",
    "If",
    "Element",
    "Sum",
    "LaTeX",
    "Corner",
    "FractionText",
    "TableText",
    "ContingencyTable",
    "Max",
    "Min",
    "Mean",
    "SD",
    "SampleSD",
    "Median",
    "Q1",
    "Q3",
    "IndexOf",
    "RotateText",
    "Text",
    "First",
    "Last",
    "Slope",
    "Length",
    "PathParameter",
    "Point",
    "Rotate",
    "Translate",
    "Dilate",
    "Angle",
    "Intersect",
    "Mirror",
]);
// GeoGebra's statistics, as DocGeo's formulas name them.
const STATISTICS: Record<string, string> = {
    Mean: "mean",
    Median: "median",
    Q1: "q1",
    Q3: "q3",
    SD: "sd",
    SampleSD: "sampleSD",
};
// The commands whose list listFormula reads from their own sources.
const LIST_COMMANDS = new Set([
    "Take",
    "First",
    "Last",
    "Mode",
    "Insert",
    "Reverse",
    "Sort",
]);
// What a seed draws again (see drawFormula).
const RANDOM_DRAWS = ["Random", "RandomBetween", "RandomUniform"];
// A command whose saved list GeoGebra drew at random.
const RANDOM_LIST = /\b(?:random|Random[A-Za-z]*|Shuffle|Sample)\s*[([]/;
// The transformations a Sequence's items may be images by.
const TRANSFORMS = ["Rotate", "Translate", "Dilate", "Mirror"];
const BINDING_COMMANDS = new Set([
    "Sequence",
    "IterationList",
    "Iteration",
    "CurveCartesian",
]);
const CELL = /^([A-Z]+)(\d+)$/;
// A GeoGebra label, which may have primes and braced indices: "A'_{1}".
const LABEL_WORDS =
    /[$_\p{ID_Start}](?:_\{[^{}]*\}|[$'\u200c\u200d\p{ID_Continue}])*/gu;
const LABEL = new RegExp(`^${LABEL_WORDS.source}`, "u");
// Its labels, and its strings, which a label doesn't run into.
const QUOTED_WORDS = new RegExp(`"[^"]*"|${LABEL_WORDS.source}`, "gu");
// A DGP formula's names, and its innermost calls.
const WORDS = new RegExp(
    `${IDENTIFIER_START.source}${IDENTIFIER_PART.source}*`,
    "gu",
);
const CALL = new RegExp(`${IDENTIFIER_PART.source}+\\([^()]*\\)`, "gu");
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
// What `name(…)` calls as a whole, null if it's not that.
function wrapped(text: string, name: string): string | null {
    if (!text.startsWith(`${name}(`) || !text.endsWith(")")) return null;
    const inner = text.slice(name.length + 1, -1);
    let depth = 0;
    for (const character of inner)
        if ((depth += character === "(" ? 1 : character === ")" ? -1 : 0) < 0)
            return null;
    return inner;
}
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
    // Computed by Giac (see CAS.md).
    Derivative: "Derivative",
    Integral: "Integral",
    Limit: "Limit",
    TaylorPolynomial: "TaylorPolynomial",
    Factor: "Factor",
    IFactor: "IFactor",
    Expand: "Expand",
    Simplify: "Simplify",
    Solve: "Solve",
    CSolve: "CSolve",
    Distance: "d",
    Dot: "dot",
    Midpoint: ([p, q]) => (q ? `((${p})+(${q}))/2` : "?"),
    // Of a complex number written with the imaginary unit, a complex one.
    exp: ([a]) =>
        /\bi\b/.test(a)
            ? `(exp(x(${a}))*[cos(y(${a})),sin(y(${a}))])`
            : `exp(${a})`,
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
    z: ([a]) => `z(${a})`,
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
    sinh: ([a]) => `((exp(${a})-exp(-(${a})))/2)`,
    cosh: ([a]) => `((exp(${a})+exp(-(${a})))/2)`,
    tanh: ([a]) => `(1-2/(exp(2*(${a}))+1))`,
    asinh: ([a]) => `log((${a})+sqrt((${a})^2+1))`,
    acosh: ([a]) => `log((${a})+sqrt((${a})^2-1))`,
    atanh: ([a]) => `(log((1+(${a}))/(1-(${a})))/2)`,
    floor: "floor",
    x: "x",
    y: "y",
    real: "x",
    imaginary: "y",
    // Of a complex number, its modulus.
    abs: "mod",
    // In ]-π, π], where DGPad's arg is in [0, 2π[.
    arg: ([a]) => `atan2(y((${a})+0*i),x((${a})+0*i))`,
};

// The other end of the bracket at `index`, searching `step`wards.
function matchingBracket(text: string, index: number, step: 1 | -1): number {
    let depth = 0;
    do {
        if ("([".includes(text[index])) depth += step;
        else if (")]".includes(text[index])) depth -= step;
        index += step;
    } while (depth !== 0 && index >= 0 && index < text.length);
    return index - step;
}

// GeoGebra takes a complex number's argument in ]-π, π], DGPad's power in
// [0, 2π[: each b^e of a DGP formula whose b `complex` may be is written
// |b|^e·(cos(e·arg b), sin(e·arg b)), a real b's staying real. The other
// powers are DGPad's.
function geogebraPowers(
    text: string,
    complex: (base: string) => boolean,
): string {
    const word = (index: number) =>
        index >= 0 && index < text.length && IDENTIFIER_PART.test(text[index]);
    for (let at = text.indexOf("^"); at >= 0; at = text.indexOf("^", at + 1)) {
        if (text.slice(0, at).split('"').length % 2 === 0) continue;
        let start = at;
        if (")]".includes(text[start - 1]))
            start = matchingBracket(text, start - 1, -1);
        while (word(start - 1)) start--;
        let end = at + 1;
        while ("+- ".includes(text[end])) end++;
        while (word(end)) end++;
        while ("([".includes(text[end]))
            end = matchingBracket(text, end, 1) + 1;
        const base = text.slice(start, at);
        if (text[end] === "^" || !complex(base)) continue;
        const z = `((${base})+0*i)`;
        const e = `(${text.slice(at + 1, end)})`;
        const angle = `${e}*atan2(y(${z}),x(${z}))`;
        const power = `(y(${z})==0?pow(x(${z}),${e}):pow(mod(${z}),${e})*[cos(${angle}),sin(${angle})])`;
        text = text.slice(0, start) + power + text.slice(end);
        at = start + power.length - 1;
    }
    return text;
}
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

// What a click script may belong to, as in GeoGebra.
const CLICKED: Kind[] = [
    ...POINT_KINDS,
    "text",
    "line",
    "circle",
    "polygon",
    "quadric",
    "locus",
    "curve",
    "image",
];
// The axes' names in a script, English or French.
const AXIS_NAME = /^(?:([xyz])Axis|axe([XYZ]))$/;
const AXES: Record<string, Vec3> = {
    xAxis: [1, 0, 0],
    yAxis: [0, 1, 0],
    zAxis: [0, 0, 1],
};
const DEFAULT_SLIDER_STEP = 0.1;
// The milliseconds between two steps of an animation a script starts.
const ANIMATION_FRAME = 40;
// The colors a script names, as GeoGebra reads them (relevé dans GeoGebra):
// its own palette, then HTML's names. Case and spaces don't matter.
const COLOR_NAMES = new Map(
    "black000000 darkgray202020 gray808080 lightgrayA0A0A0 silver404040 whiteFFFFFF redFF0000 darkred8B0000 crimsonDC143C maroon800000 pinkFFC0CB lightpinkFFB6C1 magentaFF00FF fuchsiaFF00FF purple800080 violet7F00FF lightvioletE0B0FF darkviolet9400D3 indigo4B0082 lightpurpleCCCCFF blue0000FF darkblue1C39BB lightblue7D7DFF navy000080 aquaBCD4E6 cyan00FFFF turquoiseAFEEEE teal008080 green00FF00 darkgreen006400 lightgreenD0F0C0 limeBFFF00 olive808000 yellowFFFF00 lightyellowFFFACD goldFFD700 orangeFF7F00 lightorangeFFEFD5 darkorangeFF8C00 brown993300 tanD2B48C beigeF5F5DC salmonFA8072 coralFF7F50 orchidDA70D6 khakiF0E68C chocolateD2691E siennaA0522D plumDDA0DD skyblue87CEEB forestgreen228B22"
        .split(" ")
        .map((entry) => [entry.slice(0, -6), entry.slice(-6)]),
);
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
// An equation's x and y stay its variables, z of the plane is 0, unless
// the figure has a number z.
const EQUATION_VARIABLES = new Map([
    ["x", "x"],
    ["y", "y"],
    ["z", "0"],
]);
const PLANAR_VARIABLES = new Map([
    ["x", "x"],
    ["y", "y"],
]);
// A text or a number also reads a polygon, as its area.
const TEXT_KINDS: Kind[] = [...VALUE_KINDS, "polygon"];

const literal = (value: string | number | boolean): DgpValue => ({
    type: "literal",
    value,
});

// A control's caption, or its name. Its LaTeX is only text in real figures:
// `$\text{Réponse}$`, `$\bold{A\;B}$`.
// GeoGebra's default point size is 5.
const pointSize = (element: Element): number =>
    Number(attribute(element, "pointSize", "val") ?? 5);

// GeoGebra's indices in a plain text, "u_{n+1}" or "u_n", as subscript
// characters where Unicode has them all.
const SUBSCRIPT_FROM = [..."0123456789+-=()aehijklmnoprstuvx"];
const SUBSCRIPT_TO = [..."₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ"];
const subscripts = (text: string): string =>
    text.replace(/_(?:\{([^{}]*)\}|(.))/gu, (match, group, single) => {
        const chars = [...(group ?? single)].map(
            (char) => SUBSCRIPT_TO[SUBSCRIPT_FROM.indexOf(char)],
        );
        return chars.every(Boolean) ? chars.join("") : match;
    });

// The Greek letters, from alpha, as their LaTeX commands name them (the
// empty one being the final sigma).
const GREEK =
    "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho  sigma tau upsilon phi chi psi omega".split(
        " ",
    );

const caption = (element: Element, label: string): string => {
    const text = attribute(element, "caption", "val") ?? label;
    return /^\$.*\$$/.test(text)
        ? text
              .slice(1, -1)
              .replace(/\\[;,: \\]/g, " ")
              .replace(/\\(?:text|sf|bold|mathbf|mathrm|rm)\b|[{}]/g, "")
              .replace(/\\([A-Za-z]+) ?/g, (command, name: string) => {
                  const index = GREEK.indexOf(name.toLowerCase());
                  return index < 0 || name.slice(1) !== GREEK[index].slice(1)
                      ? command
                      : String.fromCharCode(
                            (name < "a" ? 0x391 : 0x3b1) + index,
                        );
              })
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

// The spreadsheet's absolute references, A$12 or $A12, as their cell's
// label, outside strings.
function absoluteCells(construction: Element): void {
    for (const item of construction.querySelectorAll(
        "input, expression, objColor",
    ))
        for (const attr of item.attributes)
            if (attr.value.includes("$"))
                attr.value = attr.value.replace(
                    /"[^"]*"|(?<![\w$])\$?([A-Z]+)\$?(\d+)(?!\w)/g,
                    (match, column, row) => (column ? column + row : match),
                );
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
    absoluteCells(construction);

    const calls: DgpCall[] = [];
    const targets = new Map<string, Vec3>();
    const handles = new Map<string, [string | null, string | null]>();
    const follows = new Map<string, string>();
    const nameShifts = new Map<string, Vec2>();
    const menus = new Map<string, string[]>();
    // A circle's radius, as a formula, where it is known.
    const radii = new Map<string, string>();
    // A hidden region y > f(x) (or <, ≥, ≤): its sign and f(x).
    const halfPlanes = new Map<string, [string, string]>();
    // A dropdown list's Expression, its selected item's number, by the
    // list's label.
    const selections = new Map<string, string>();
    const animations = new Map<string, Animation>();
    const rateSources = new Map<string, string>();
    const unsupported: string[] = [];
    const objects = new Map<string, { variable: string; kind: Kind }>();
    const segments = new LazyMap<[string, string]>();
    // The planes, GeoGebra's xOy plane being z = 0 (see isPlane).
    const planes = new Set<string>();
    // Whether GeoGebra turns a plane against its normal in DocGeo, for the
    // planes whose orientation is known: Plane(A, f)'s is turned.
    const turnedPlanes = new Map<string, boolean>([["xOyPlane", false]]);
    // A cylinder or a cone, by its solid's or its side's label.
    const revolutions = new Map<string, { label: string; cone: boolean }>();
    const spheres = new Set<string>();
    // The surfaces z = f(x, y).
    const surfaces = new Set<string>();
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
    // The center, start and end of each CircleArc of the plane.
    const arcs = new Map<string, string[]>();
    const sectors = new Set<string>();
    // Each Sequence's inputs, and the vertices of a Sequence of polygons
    // with its variable and bounds.
    const sequences = new Map<string, string[]>();
    const polygonLists = new Map<
        string,
        { vertices: string[]; loop: string[] }
    >();
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
    // The Sequences of points, whose items are points.
    const pointLists = new Set<string>();
    // The functions of x, which a formula calls by name.
    const functions = new Set<string>();
    // The hidden functions of x and y, by their expression, which a
    // formula writes out where it calls them.
    const twoVariables = new Map<string, string>();
    const elements = new Map<string, Element>();
    const expressions = new Map<string, string>();
    // A drawn text's source, which a formula reads as its value.
    const texts = new Map<string, string>();
    // The variable of the hidden number a script's UpdateConstruction
    // draws again, 0 for the values GeoGebra saved, from which the random
    // objects are drawn (see uniform).
    let seed: string | null = null;
    let draws = 0;
    // The variables of the numbers and lists drawn from the seed, or read
    // from them only, which no manipulation changes.
    const fixed = new Set<string>();
    const commandOutputs = new Set<string>();
    const inequalities = new Set<string>();
    // How an object is defined, as an expression.
    const definitions = new Map<string, string>();
    [...construction.children].forEach((node) => {
        const label = node.getAttribute("label") ?? "";
        if (node.tagName === "element") elements.set(label, node);
        else if (node.tagName === "expression") {
            expressions.set(label, node.getAttribute("exp") ?? "");
            definitions.set(label, node.getAttribute("exp") ?? "");
            if (node.getAttribute("type") === "inequality")
                inequalities.add(label);
        } else if (node.tagName === "command") {
            const outputs = indexedAttributes(child(node, "output"));
            outputs.forEach((output) => commandOutputs.add(output));
            if (outputs.length === 1)
                definitions.set(
                    outputs[0],
                    `${node.getAttribute("name")}(${indexedAttributes(child(node, "input")).join(",")})`,
                );
        }
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

    // A polyhedron defined by nothing draws nothing (see independent).
    const orphan = (label: string, element: Element): boolean =>
        ["polyhedron", "polygon3d"].includes(element.getAttribute("type")!) &&
        !commandOutputs.has(label) &&
        !expressions.has(label);
    const is3D =
        document.querySelector('gui view[id="512"][visible="true"]') !== null ||
        [...elements].some(
            ([label, element]) =>
                !orphan(label, element) &&
                THREE_D_TYPES.test(element.getAttribute("type") ?? ""),
        );
    // GeoGebra's graphics view n, and whether its window shows it.
    const graphicsView = (n: number): Element | undefined =>
        [...document.querySelectorAll("euclidianView")].find(
            (view) => attribute(view, "viewNumber", "viewNo") === String(n),
        );
    const shownView = (id: string): boolean =>
        document.querySelector(`gui view[id="${id}"][visible="true"]`) !== null;
    // Where the window shows a view: a digit per level of its panes.
    const location = (id: string) =>
        document
            .querySelector(`gui view[id="${id}"][visible="true"]`)
            ?.getAttribute("location")
            ?.split(",");
    // Its second graphics view, beside the first (a view of its own) or
    // alone (DocGeo's only one).
    const second =
        !is3D && shownView("16") && graphicsView(2)
            ? shownView("1")
                ? "beside"
                : "alone"
            : null;
    // Beside the first, DocGeo's views being columns: its first one if
    // it's on the left of the first or above it (the first digit of its
    // location that differs from the first's: 0 north, 3 west).
    const firstAt = location("1") ?? [];
    const secondFirst =
        second === "beside" &&
        ["0", "3"].includes(
            (location("16") ?? []).find(
                (digit, index) => digit !== firstAt[index],
            ) ?? "",
        );
    // A 3D figure's graphics view on the left or right of its 3D view:
    // DocGeo's plane view, a column of its own (see VUES.md), its first
    // if it's on the left (3 west).
    const planeId = is3D ? ["1", "16"].find(shownView) : undefined;
    const spaceAt = location("512") ?? [];
    const planeSide =
        planeId &&
        location(planeId)!.find((digit, index) => digit !== spaceAt[index]);
    const plane = planeSide === "1" || planeSide === "3" ? planeId : null;
    // Bit 0 of "ev": not in the first graphics view, bit 1: in the second,
    // bit 2: in the 3D view, bit 3: not in it (see
    // GeoElement.getXMLvisualTags).
    const views = (element: Element): number =>
        Number(attribute(element, "show", "ev")) || 0;
    // Controls are never drawn in the 3D view, texts only if said so.
    const inSpace = (element: Element): boolean => {
        const type = element.getAttribute("type")!;
        return (
            !/^(numeric|boolean|button|textfield|image)$/.test(type) &&
            !child(element, "slider") &&
            ((views(element) & 4) !== 0 ||
                ((views(element) & 8) === 0 && type !== "text"))
        );
    };
    // Shown in the graphics view of the plane view.
    const inGraphics = (element: Element): boolean =>
        plane !== null &&
        (plane === "1"
            ? (views(element) & 1) === 0
            : (views(element) & 2) !== 0);
    // Drawn in the plane view: shown in its graphics view and not in the
    // 3D view.
    const inPlane = (element: Element): boolean =>
        inGraphics(element) && !inSpace(element);
    // Drawn in DocGeo's first view and also in its second: shown in both
    // graphics views side by side, or in the 3D view and in the graphics
    // view, which draws an object of space while it lies in the plane
    // z = 0 (see inGround), not a plane, a solid nor a point of space's
    // locus.
    const inBoth = (element: Element): boolean =>
        (second === "beside" && (views(element) & 3) === 2) ||
        (inGraphics(element) &&
            inSpace(element) &&
            !/^(?!(point|segment|line|ray|vector|polygon)3d$).*3d$|^(quadric|polyhedron|net|functionnvar)/.test(
                element.getAttribute("type")!,
            ) &&
            elements
                .get(
                    /^Locus\(([^,]*),/.exec(
                        definitions.get(element.getAttribute("label")!) ?? "",
                    )?.[1] ?? "",
                )
                ?.getAttribute("type") !== "point3d");
    // Drawn in DocGeo's second view: shown only in the graphics view of
    // the right column, or in the plane view of a figure in space.
    const inSecond = (element: Element): boolean =>
        (second === "beside" &&
            (views(element) & 3) === (secondFirst ? 0 : 3)) ||
        inPlane(element);
    // Hidden, or else out of the graphics views DocGeo draws.
    const outOfView = (element: Element): boolean => {
        if (is3D)
            return plane !== null && !inSpace(element) && !inPlane(element);
        const shown = views(element) & 3;
        return second === "alone"
            ? (shown & 2) === 0
            : second === "beside"
              ? shown === 1
              : (shown & 1) === 1;
    };
    const hidden = (element: Element): boolean =>
        attribute(element, "show", "object") === "false" || outOfView(element);
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
    const view =
        second === "alone" || secondFirst || plane === "16"
            ? graphicsView(2)!
            : document.querySelector("euclidianView");
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
    const yUnit = Number(coordSystem?.getAttribute("yscale") ?? unit);
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
                : (vectorFormula(
                      arg.replace(/^Segment\(/, "Vector("),
                      locals,
                  ) ?? formula(arg, VALUE_KINDS, locals));
            return vector && `unitVector(${vector})`;
        }
        if (match[1] === "UnitOrthogonalVector") {
            const vector = vectorFormula(
                `OrthogonalVector(${match[2]})`,
                locals,
            );
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
        if (
            known &&
            !vectors.has(source) &&
            !locals.has(source) &&
            !texts.has(source)
        )
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
            // Not the cells "!A1" (see TABLEUR.md).
            .replace(/¬\s*([A-Z]+\d)/g, "! $1")
            .replace(/¬/g, "!")
            // The least or greatest of a list's items.
            .replace(/\b(Min|Max)\(\{([^{}]*)\}\)/g, "$1($2)")
            .replace(
                new RegExp(`\\b(Min|Max)\\((${LABEL_WORDS.source})\\)`, "gu"),
                (call, name: string, list: string) => {
                    const count = Number(lists.get(list)?.count);
                    return count > 0
                        ? `${name}(${Array.from(
                              { length: count },
                              (_, n) => `Element(${list},${n + 1})`,
                          )})`
                        : call;
                },
            )
            // The product of two vectors is their dot product.
            .replace(
                new RegExp(
                    `(${LABEL_WORDS.source})\\s*\\*\\s*(${LABEL_WORDS.source})`,
                    "gu",
                ),
                (call, u: string, v: string) =>
                    vectors.has(u) && vectors.has(v) ? `Dot(${u},${v})` : call,
            )
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
                    // A line f(x) is its ordinate at x.
                    const start =
                        kinds.length > 0 &&
                        is(word, ["line"]) &&
                        linePoint(word);
                    const fn =
                        seed && RANDOM_DRAWS.includes(word)
                            ? ([a, b]: string[]) =>
                                  drawFormula(word, a, b, locals)
                            : functions.has(word)
                              ? kinds.length > 0 && objects.get(word)!.variable
                              : surfaces.has(word)
                                ? kinds.length > 0 &&
                                  objects.get(word)!.variable
                                : twoVariables.has(word)
                                  ? ([x, y]: string[]) =>
                                        `(${formula(
                                            twoVariables.get(word)!,
                                            ["expression"],
                                            new Map([
                                                ["x", x],
                                                ["y", y],
                                            ]),
                                        )})`
                                  : list
                                    ? ([n]: string[]) =>
                                          `(${list.item(n) ?? "?"})`
                                    : start
                                      ? ([x]: string[]) => {
                                            const p =
                                                objects.get(start)!.variable;
                                            return `(y(${p})+${slopeFormula(word)}*((${x})-x(${p})))`;
                                        }
                                      : (FUNCTIONS[word] ?? locals.get(word));
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
                else if (word === "NaN" && !objects.has(word))
                    result += "(0/0)";
                else if (word === "ℯ") result += "exp(1)";
                else if (word === "true" || word === "false") result += word;
                // GeoGebra's imaginary unit, typed "i" in a script.
                else if (
                    word === "ί" ||
                    (word === "i" && !objects.has(word) && !locals.has(word))
                )
                    result += "i";
                else if (locals.has(word)) {
                    // An equation's x stays x, unless a call would read it.
                    const local = locals.get(word)!;
                    result +=
                        IDENTIFIER.test(local) &&
                        !/^ ?\(/.test(text.slice(index, index + 2))
                            ? local
                            : `(${local})`;
                } else if (arcs.has(word) && kinds.includes("expression")) {
                    // An arc's length, a sector's area (relevé dans GeoGebra).
                    const [m, a, b] = arcs
                        .get(word)!
                        .map((point) => objects.get(point)!.variable);
                    result += sectors.has(word)
                        ? `(d(${m},${a})^2*Angle360(${a},${m},${b})/2)`
                        : `(d(${m},${a})*Angle360(${a},${m},${b}))`;
                } else if (vectors.has(word) && kinds.length > 0) {
                    const [p, q] = vectors
                        .get(word)!
                        .map((end) => objects.get(end)!.variable);
                    result += `(${q}-${p})`;
                } else if (texts.has(word) && kinds.length > 0) {
                    const value = textFormula(texts.get(word)!);
                    if (value === null) return null;
                    result += value;
                } else if (readable(word)) {
                    const variable = objects.get(word)!.variable;
                    // A point plus a number: GeoGebra adds it to each
                    // coordinate, a DGP formula to the real part.
                    const shift = POINT_SHIFT.exec(text.slice(index));
                    if (
                        shift &&
                        is(word, POINT_KINDS) &&
                        /(^|[(,+])$/.test(result.trimEnd())
                    ) {
                        const n = shift[2];
                        result += `(${variable}${shift[1]}[${n},${n}${is3D ? `,${n}` : ""}])`;
                        index += shift[0].length;
                    } else result += variable;
                } else return null;
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
        result = geogebraPowers(chainComparisons(result), (base) => {
            // Outside the calls, which read a point as a real number.
            let outside = base;
            while (outside !== (outside = outside.replace(CALL, "")));
            return (outside.match(WORDS) ?? []).some(
                (name) => name === "i" || is(labels.get(name), POINT_KINDS),
            );
        });
        try {
            parseFormula(result);
        } catch {
            return null;
        }
        return result;
    };

    // The lines of DocGeo's CAS view (see CAS.md): the cells of GeoGebra's,
    // and its Suite's symbolic rows that read free variables. A line is
    // typed `name := …` or `f(x) := …`, of the figure's objects by their
    // names, its other letters being free variables, `$n` the line of row
    // n, and the functions the lines before define. Null if unread.
    const casLines: string[] = [];
    const casRows = new Map<number, number>();
    const casFunctions = new Set<string>();
    const casLine = (
        typed: string,
        evaluated: string,
        keep: boolean,
    ): string | null => {
        const definition = CAS_DEFINITION.exec(typed);
        let body = evaluated.trim();
        // Nor GeoGebra's Evaluate, nor parentheses around it all.
        let inner;
        while (
            (inner = wrapped(body, "Evaluate") ?? wrapped(body, "")) !== null
        )
            body = inner.trim();
        const locals = new Map<string, string>();
        for (const { 0: word, index } of body.matchAll(QUOTED_WORDS)) {
            if (word.startsWith('"') || objects.has(word) || word === "π")
                continue;
            const row = /^\$(\d+)$/.exec(word);
            if (row) {
                const line = casRows.get(+row[1]);
                if (line === undefined) return null;
                locals.set(word, `dgrow${line}`);
            } else if (!/^\s*\(/.test(body.slice(index + word.length)))
                locals.set(word, word);
            else if (casFunctions.has(word) || LINE_COMMANDS.includes(word))
                locals.set(word, word);
            else if (!(word in FUNCTIONS) && !FORMULA_COMMANDS.has(word))
                return null;
        }
        const result = formula(body, VALUE_KINDS, locals);
        // Nor what reads an object of a name DocGeo's formulas don't have.
        if (result === null || /\$/.test(result)) return null;
        const line = (keep ? `KeepInput(${result})` : result).replace(
            /\bdgrow(\d+)/g,
            "$$$1",
        );
        if (!definition) return line;
        const [, name, variables] = definition;
        if (variables !== undefined) casFunctions.add(name);
        return `${name}${
            variables === undefined
                ? ""
                : `(${variables
                      .split(",")
                      .map((variable) => variable.trim())
                      .join(", ")})`
        } := ${line}`;
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
        // Unread when a string literal opens or closes a bracket.
        const call = commandCall(source);
        if (!call) return null;
        const [name, args] = call;
        switch (name) {
            case "If":
                return ifFormula(args, kinds, locals);
            // Element(m, i, j…) of a list of lists.
            case "Element": {
                const indices = args
                    .slice(1)
                    .map((arg) => formula(arg, VALUE_KINDS, locals));
                let list = args.length > 1 && listFormula(args[0], locals);
                if (!list || indices.includes(null)) return null;
                for (const n of indices.slice(0, -1))
                    if (!(list = list.sub?.(n!) ?? null)) return null;
                const item = list.item(indices.at(-1)!);
                return item ? `(${item})` : null;
            }
            // Summed by a hidden Expression's script, whose own variable
            // stands for the item's index. Not of a list reading a local
            // variable, which only a script's loop has (see scripted).
            case "Sum": {
                // Sum(e, k, a, b), computed by Giac, k bound.
                if (args.length === 4) {
                    const index = args[1].trim();
                    const inner = new Map([...locals, [index, index]]);
                    const values = args.map((arg, k) =>
                        formula(arg, VALUE_KINDS, k < 2 ? inner : locals),
                    );
                    return LABEL.exec(index)?.[0] === index &&
                        !values.includes(null)
                        ? `Sum(${values.join(",")})`
                        : null;
                }
                const list =
                    args.length === 1 &&
                    !args[0]
                        .match(LABEL_WORDS)
                        ?.some((word) => locals.has(word)) &&
                    listFormula(args[0]);
                const item = list && list.item("$n");
                if (!item) return null;
                return hiddenExpression(
                    `var $s=0;for(var $n=1;$n<=${list.count};$n++){$s+=${item}};$s`,
                );
            }
            // As GeoGebra writes a number, a point in its own style, or a
            // conic's equation as typed, with the values of its objects.
            case "LaTeX": {
                const source = expressions.get(args[0]);
                if (
                    args.length === 1 &&
                    is(args[0], ["quadric"]) &&
                    source &&
                    attribute(elements.get(args[0])!, "eqnStyle", "style") ===
                        "user"
                )
                    return equationLatex(source, locals);
                const value =
                    args.length === 1 && formula(args[0], TEXT_KINDS, locals);
                if (!value) return null;
                // An angle in degrees, even defined by an expression.
                if (
                    is(args[0], ["angle"]) ||
                    elements.get(args[0])?.getAttribute("type") === "angle"
                )
                    return `(""+((${value})*180/π)+"°")`;
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
            // ABC, counterclockwise from BA to BC, or from a line's
            // direction to another's, within [0, 2π).
            case "Angle": {
                const values =
                    args.length === 2
                        ? [
                              lineVector(args[0], locals),
                              planar("0", "0"),
                              lineVector(args[1], locals),
                          ]
                        : args.map((arg) => formula(arg, POINT_KINDS, locals));
                return values.length === 3 && !is3D && !values.includes(null)
                    ? `Angle360(${values})`
                    : null;
            }
            case "Radius":
                return radii.get(args[0]) ?? null;
            case "SelectedIndex":
                return selections.get(args[0]) ?? null;
            case "SelectedElement": {
                const selection = selections.get(args[0]);
                const item =
                    selection && listFormula(args[0], locals)?.item(selection);
                return item ? `(${item})` : null;
            }
            case "Corner":
                return cornerFormula(args);
            case "Slope":
                return args.length === 1 && is(args[0], ["line"])
                    ? slopeFormula(args[0])
                    : null;
            // A text's number of characters.
            case "Length":
                if (texts.has(args[0])) {
                    const text = textFormula(args[0]);
                    return text && `(${text}.length)`;
                }
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
            // Point(s, t) of a segment, from its start (0) to its end (1).
            case "Point": {
                const ends = args.length === 2 && segments.get(args[0]);
                const t = ends && formula(args[1], VALUE_KINDS, locals);
                if (!t) return null;
                const [p, q] = ends.map(
                    (point) => objects.get(point)!.variable,
                );
                return `(${p}+(${t})*(${q}-${p}))`;
            }
            // Intersect(Segment(P, Q), solid, n), of a cylinder, a cone, a
            // sphere or a surface: its n-th point on [PQ], as GeoGebra.
            case "Intersect": {
                const solid =
                    revolutions.get(args[1])?.label ??
                    (spheres.has(args[1]) || surfaces.has(args[1])
                        ? args[1]
                        : undefined);
                const path = commandCall(normalizeBrackets(args[0]));
                const ends =
                    path?.[0] === "Segment" && path[1].length === 2
                        ? path[1]
                        : segments.get(args[0]);
                const [p, q] = (ends ?? []).map((end) =>
                    formula(end, VALUE_KINDS, locals),
                );
                return solid && p && q && (args[2] === "1" || args[2] === "2")
                    ? `meet(${p},${q},${objects.get(solid)!.variable},${args[2]})`
                    : null;
            }
            // A point's image by the plane z = 0.
            case "Mirror": {
                const p =
                    args[1] === "xOyPlane" &&
                    formula(args[0], VALUE_KINDS, locals);
                return p ? `(${p}-[0,0,2*z(${p})])` : null;
            }
            // Of a point or a vector, around a point.
            case "Rotate":
            case "Translate":
            case "Dilate": {
                const values = args.map((arg) =>
                    formula(arg, VALUE_KINDS, locals),
                );
                if (values.includes(null)) return null;
                const [p, a, c] = values as string[];
                if (name === "Translate")
                    return args.length === 2 ? `(${p}+${a})` : null;
                if (name === "Dilate")
                    return args.length <= 3
                        ? `(${c ?? 0}+(${p}-${c ?? 0})*(${a}))`
                        : null;
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
            case "TableText":
                return tableFormula(args, locals);
            case "ContingencyTable":
                return contingencyFormula(args, locals);
            // Of a list's items, by a hidden Expression's script, which
            // can't read a Sequence's variable.
            case "Max":
            case "Min": {
                const list =
                    args.length === 1 &&
                    !args[0]
                        .match(LABEL_WORDS)
                        ?.some((word) => locals.has(word)) &&
                    listFormula(args[0]);
                const item = list && list.item("$k");
                if (!item) {
                    const values = args.map((arg) =>
                        formula(arg, kinds, locals),
                    );
                    return values.includes(null)
                        ? null
                        : `${name.toLowerCase()}(${values.join(",")})`;
                }
                return hiddenExpression(
                    `var $m=${list.item("1")};for(var $k=2;$k<=${list.count};$k++){$m=${name.toLowerCase()}($m,${item})};$m`,
                );
            }
            // Of a list's items (see statistic in dgp_formula.ts).
            case "Mean":
            case "SD":
            case "SampleSD":
            case "Median":
            case "Q1":
            case "Q3": {
                const list = args.length === 1 && arrayFormula(args[0], locals);
                return list ? `${STATISTICS[name]}(${list})` : null;
            }
            // The first index of a value in a list, undefined if none.
            case "IndexOf": {
                const list =
                    args.length === 2 && !locals.size && listFormula(args[1]);
                const item = list && list.item("$k");
                const value = item && formula(args[0], VALUE_KINDS);
                if (!value) return null;
                return hiddenExpression(
                    `var $i=0/0;for(var $k=${list.count};$k>=1;$k=$k-1){if((${item})==(${value})){$i=$k}};$i`,
                );
            }
            // A text's first or last n characters.
            case "First":
            case "Last": {
                const value = texts.has(args[0]) && textFormula(args[0]);
                const n =
                    args.length === 2
                        ? formula(args[1], VALUE_KINDS, locals)
                        : "1";
                if (!value || n === null || args.length > 2) return null;
                return name === "First"
                    ? `(${value}.slice(0,${n}))`
                    : `(${value}.slice(-(${n})))`;
            }
            // Wherever it is placed: what reads it doesn't.
            case "Text":
                return args.length === 1 ||
                    (args.length === 2 && points(args[1]))
                    ? textFormula(args[0])
                    : null;
            // "\\rotatebox{90}{ \\text{ abc }  }" (relevé dans GeoGebra),
            // a LaTeX text kept as is. Drawn turned (see latex.ts).
            case "RotateText": {
                // A text not in LaTeX isn't read by a formula: its own
                // expression is.
                const value =
                    textFormula(expressions.get(args[0]) ?? args[0]) ??
                    formula(args[0], TEXT_KINDS, locals);
                const angle = formula(args[1], TEXT_KINDS, locals);
                if (args.length !== 2 || !value || !angle) return null;
                const text = elements.get(args[0]);
                const latex =
                    !!text && attribute(text, "isLaTeX", "val") === "true";
                return `("\\\\rotatebox{"+((${angle})*180/π)+"}{"+${latex ? value : `"\\\\text{ "+${value}+" }"`}+"}")`;
            }
            default:
                return vectorFormula(source, locals);
        }
    };

    // GeoGebra's LaTeX array of lists, each one a row, or a column with
    // "v". "|" and "_" draw the vertical and horizontal lines, or those
    // whose digit isn't 0 ("|0110"); "l", "c" or "r" align every column,
    // or each one in turn.
    const tableFormula = (
        args: string[],
        locals: Map<string, string>,
    ): string | null => {
        const last = args.at(-1)!;
        const options = /^"[^"]*"$/.test(last) ? last.slice(1, -1) : "";
        const sources = options ? args.slice(0, -1) : args;
        const literal = normalizeBrackets(sources[0].trim());
        const rows = (
            sources.length === 1 && /^\{.*\}$/.test(literal)
                ? splitArguments(literal.slice(1, -1))
                : sources
        )?.map((source) => listFormula(source, locals));
        if (!rows || locals.size || !/^[vhlcr|_\d]*$/.test(options))
            return null;
        const cells = rows.map((row) => row && row.item("$k"));
        if (cells.some((cell) => !cell)) return null;
        const size = rows
            .map((row) => `(${row!.count})`)
            .reduce((a, b) => `max(${a},${b})`);
        const flags = (mark: string) => {
            const digits = new RegExp(`\\${mark}(\\d*)`).exec(options)?.[1];
            return (k: string) =>
                digits === undefined
                    ? "0"
                    : digits
                      ? `(${k}<${digits.length}?[${[...digits]}][${k}]:1)`
                      : "1";
        };
        const [vertical, horizontal] = ["|", "_"].map(flags);
        const aligns = options.match(/[lcr]/g) ?? ["l"];
        const columns = options.includes("v") ? rows.length : "$n";
        const cell = (row: number, k: string) =>
            `$k=${k};$v=$k<=${rows[row]!.count}?${cells[row]}:"";$s=$s+(isNaN($v*1)?($v.split(" ").length>1?"\\\\text{"+$v+"}":$v):$v)`;
        const line = (j: string) =>
            `$s=$s+" \\\\\\\\ "+(${horizontal(j)}?"\\\\hline ":"")`;
        const body = options.includes("v")
            ? `for($j=1;$j<=$n;$j++){${rows.map((_, row) => `${row ? '$s=$s+"&";' : ""}${cell(row, "$j")}`).join(";")};${line("$j")}}`
            : rows
                  .map(
                      (_, row) =>
                          `for($j=1;$j<=$n;$j++){$s=$s+($j>1?"&":"");${cell(row, "$j")}};${line(String(row + 1))}`,
                  )
                  .join(";");
        return hiddenExpression(
            `var $n=${size},$s="{\\\\begin{array}{",$j,$k,$v;for(var $i=0;$i<=${columns};$i++){$s=$s+(${vertical("$i")}?"|":"")+($i<${columns}?[${aligns.map((a) => `"${a}"`)}][min($i,${aligns.length - 1})]:"")};$s=$s+"}"+(${horizontal("0")}?"\\\\hline ":"");${body};$s+"\\\\end{array}}"`,
        );
    };

    // The counts of the pairs of values of two lists of texts, by row and
    // column, each sorted as strings, and their totals, as GeoGebra writes
    // them (in English).
    const contingencyFormula = (
        args: string[],
        locals: Map<string, string>,
    ): string | null => {
        const lists = args.map((arg) => listFormula(arg, locals));
        const [x, y] = lists.map((list) => list?.item("$k"));
        if (args.length !== 2 || locals.size || !x || !y) return null;
        const values = (item: string, array: string) =>
            `${array}=[];for($k=1;$k<=$n;$k++){$v=${item};$f=1;for($i=0;$i<${array}.length;$i++){if(${array}[$i]==$v){$f=0}};if($f){${array}.push($v)}};for($i=0;$i<${array}.length;$i++){for($j=0;$j<${array}.length-1;$j++){if(${array}[$j]>${array}[$j+1]){$v=${array}[$j];${array}[$j]=${array}[$j+1];${array}[$j+1]=$v}}};`;
        const count = (test: string) =>
            `$m=0;for($k=1;$k<=$n;$k++){if(${test}){$m=$m+1}};`;
        return hiddenExpression(
            `var $n=${lists[0]!.count},$r,$c,$k,$i,$j,$v,$f,$m,$t,$s;${values(x, "$r")}${values(y, "$c")}$s="{\\\\begin{array}{|l|";for($j=0;$j<$c.length;$j++){$s=$s+"r|"};$s=$s+"|r|}\\\\hline \\\\text{Frequency}";for($j=0;$j<$c.length;$j++){$s=$s+"&\\\\text{"+$c[$j]+"}"};$s=$s+"&\\\\text{Total}\\\\\\\\\\\\hline ";for($i=0;$i<$r.length;$i++){$s=$s+"\\\\text{"+$r[$i]+"}";$t=0;for($j=0;$j<$c.length;$j++){${count(`(${x})==$r[$i]&&(${y})==$c[$j]`)}$s=$s+"&"+$m;$t=$t+$m};$s=$s+"&"+$t+"\\\\\\\\\\\\hline "};$s=$s+"\\\\hline \\\\text{Total}";for($j=0;$j<$c.length;$j++){${count(`(${y})==$c[$j]`)}$s=$s+"&"+$m};$s+"&"+$n+"\\\\\\\\\\\\hline \\\\end{array}}"`,
        );
    };

    // An equation's LaTeX, as GeoGebra writes it as typed: x and y kept, the
    // other names and calls replaced by their values, rounded, a negative
    // one after "+" or "-" turning it into the other.
    const equationLatex = (
        source: string,
        locals: Map<string, string>,
    ): string | null => {
        const tokens =
            source.match(
                /\d+(?:\.\d+)?|[\p{L}_][\p{L}\d_']*(?:\{[^}]*\})?|\S/gu,
            ) ?? [];
        let at = 0;
        const text = (latex: string) => JSON.stringify(latex);
        const round = (value: string) =>
            `round((${value})*1e${decimals})/1e${decimals}`;
        type Term = { latex: string; value?: string; inner?: string };
        const primary = (): Term | null => {
            const token = tokens[at++];
            if (token === "(") {
                const inner = sum();
                if (!inner || tokens[at++] !== ")") return null;
                return {
                    latex: `${text("\\left(")}+${inner.latex}+${text(" \\right)")}`,
                    inner: inner.latex,
                };
            }
            if (token === "-") {
                const operand = power();
                return operand && { latex: `${text("-")}+${operand.latex}` };
            }
            if (/^\d/.test(token ?? "")) return { latex: text(token) };
            if ((token === "x" || token === "y") && tokens[at] !== "(")
                return { latex: text(token) };
            let name = token ?? "";
            if (tokens[at] === "(") {
                let depth = 0;
                do {
                    const next = tokens[at++];
                    if (next === undefined) return null;
                    depth += next === "(" ? 1 : next === ")" ? -1 : 0;
                    name += next;
                } while (depth);
            }
            const value = formula(name, VALUE_KINDS, locals);
            return value ? { latex: `(""+${round(value)})`, value } : null;
        };
        const power = (): Term | null => {
            const base = primary();
            if (!base || tokens[at] !== "^") return base;
            at++;
            const exponent = power();
            return (
                exponent && {
                    latex: `${base.latex}+${text("^{")}+${exponent.inner ?? exponent.latex}+${text("}")}`,
                }
            );
        };
        const product = (): Term | null => {
            let left = power();
            while (left && (tokens[at] === "*" || tokens[at] === "/")) {
                const op = tokens[at++];
                const right = power();
                if (!right) return null;
                left = {
                    latex:
                        op === "/"
                            ? `${text("\\frac{")}+${left.latex}+${text("}{")}+${right.latex}+${text("}")}`
                            : `${left.latex}+${text(" \\cdot ")}+${right.latex}`,
                };
            }
            return left;
        };
        const sum = (): Term | null => {
            let left = product();
            while (left && (tokens[at] === "+" || tokens[at] === "-")) {
                const minus = tokens[at++] === "-";
                const right = product();
                if (!right) return null;
                const sign = (negative: boolean) =>
                    text(negative ? " - " : " + ");
                left = {
                    latex: right.value
                        ? `${left.latex}+((${right.value})<0?${sign(!minus)}+${round(`-(${right.value})`)}:${sign(minus)}+${round(right.value)})`
                        : `${left.latex}+${sign(minus)}+${right.latex}`,
                };
            }
            return left;
        };
        const left = sum();
        if (!left || tokens[at++] !== "=") return null;
        const right = sum();
        return right && at === tokens.length
            ? `(${left.latex}+${text("\\, = \\,")}+${right.latex})`
            : null;
    };

    // A line's direction, written Line(P, Q) or named.
    const lineVector = (
        source: string,
        locals: Map<string, string>,
    ): string | null => {
        const call = commandCall(source);
        if (call?.[0] === "Line" && call[1].length === 2) {
            const [p, q] = call[1].map((end) =>
                formula(end, POINT_KINDS, locals),
            );
            return p === null || q === null ? null : `(${q}-${p})`;
        }
        return unitDirection(source);
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
        if (view === "-1" && is3D) return boxCorner(Number(n));
        if (args.length > 2 || view !== "1") return null;
        if (n === "5" || n === "6")
            return "[windoww()*pixel(),windowh()*pixel()]";
        const corner = ["1", "2", "3", "4"].indexOf(n);
        if (corner < 0) return null;
        const x = corner === 1 || corner === 2 ? "+" : "-";
        const y = corner > 1 ? "+" : "-";
        return `[windowcx()${x}windoww()/2,windowcy()${y}windowh()/2]`;
    };

    // The list of `count` items in the order of their keys: the n-th item is
    // the one with n - 1 keys before it, equal keys kept in order. Only of
    // a short list, its formula growing as its size squared.
    const sortedList = (
        list: ListFormula,
        count: number,
        keys: (string | null)[],
    ): ListFormula | null => {
        const indices = Array.from({ length: count }, (_, i) => i + 1);
        const items = indices.map((i) => list.item(String(i)));
        if (!(count <= 20) || items.includes(null) || keys.includes(null))
            return null;
        const rank = (i: number) =>
            `1${indices
                .filter((j) => j !== i)
                .map(
                    (j) =>
                        `+((${keys[j - 1]})${j < i ? "<=" : "<"}(${keys[i - 1]})?1:0)`,
                )
                .join("")}`;
        return {
            count: list.count,
            item: (n) =>
                indices
                    .slice(0, -1)
                    .reduceRight(
                        (rest, i) =>
                            `((${rank(i)})==(${n})?(${items[i - 1]}):${rest})`,
                        `(${items[count - 1]})`,
                    ),
        };
    };

    // A GeoGebra list as its size and its n-th item (from 1), as formulas.
    const listFormula = (
        source: string,
        locals = new Map<string, string>(),
    ): ListFormula | null => {
        const text = normalizeBrackets(source.trim());
        const known = lists.get(text);
        if (known) return known;
        const range = /^([A-Z]+\d+):([A-Z]+\d+)$/.exec(text);
        if (range)
            return listFormula(`CellRange(${range[1]},${range[2]})`, locals);
        if (/^\{.*\}$/.test(text)) {
            const items = splitArguments(text.slice(1, -1))?.map((item) =>
                formula(item, VALUE_KINDS, locals),
            );
            return items?.every((item) => item !== null)
                ? {
                      count: String(items.length),
                      item: (n) => `[${items.join(",")}][(${n})-1]`,
                      array: `[${items.join(",")}]`,
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
            // A shown text cell, by its text.
            const values = labels.map((label) =>
                texts.has(label)
                    ? textFormula(texts.get(label)!)
                    : is(label, VALUE_KINDS)
                      ? objects.get(label)!.variable
                      : null,
            );
            if (labels.length === 0 || values.includes(null)) return null;
            const items = `[${values.join(",")}]`;
            return {
                count: String(labels.length),
                item: (n) => `${items}[(${n})-1]`,
                array: items,
            };
        }
        // Computed by a hidden Expression's script, its size varying.
        if (name === "RemoveUndefined" && !locals.size) {
            let counter = 0;
            const value = scripted(text, new Map(), () => `$q${++counter}`);
            return value?.depth === 1
                ? named(hiddenExpression(scriptedProgram(value)), 1)
                : null;
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
        if (name === "Reverse" && args.length === 1) {
            const list = listFormula(args[0], locals);
            return (
                list && {
                    count: list.count,
                    item: (n) => list.item(`${list.count}-(${n})+1`),
                }
            );
        }
        // Sort(list) or Sort(list, keys), of a list whose size is known.
        if (name === "Sort" && args.length <= 2) {
            const [list, keys = list] = args.map((arg) =>
                listFormula(arg, locals),
            );
            const count = list && evaluateConstant(list.count);
            if (!list || !keys || count === null || keys.count !== list.count)
                return null;
            return sortedList(
                list,
                count,
                Array.from({ length: count }, (_, i) =>
                    keys.item(String(i + 1)),
                ),
            );
        }
        // Drawn again from the seed: sorted by random keys.
        if (name === "Shuffle" && seed && args.length === 1) {
            const list = listFormula(args[0], locals);
            const count = list && evaluateConstant(list.count);
            // Its keys a hidden list, which a Sequence's variable can't be read by.
            if (!list || count === null || locals.size) return null;
            const keys = hiddenExpression(
                `[${Array.from({ length: count }, () => uniform(locals))}]`,
            );
            return sortedList(
                list,
                count,
                Array.from({ length: count }, (_, i) => `${keys}[${i}]`),
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
        // Insert(object, list, n): the object at the n-th place, the end's
        // n-th from it when n is negative.
        if (name === "Insert" && args.length === 3) {
            const list = listFormula(args[1], locals);
            const [object, n] = [args[0], args[2]].map((arg) =>
                formula(arg, VALUE_KINDS, locals),
            );
            if (!list || object === null || n === null || listFormula(args[0]))
                return null;
            const at = `((${n})<0?(${list.count})+(${n})+2:(${n}))`;
            return {
                count: `(${list.count})+1`,
                item: (k) => {
                    const [before, after] = [k, `(${k})-1`].map(list.item);
                    return (
                        before &&
                        after &&
                        `((${k})<${at}?(${before}):(${k})==${at}?(${object}):(${after}))`
                    );
                },
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

    // GeoGebra's value as a hidden Expression's script computes it, loops
    // included, which a formula has none: the statements it needs first,
    // then its formula, of lists `depth` deep. A Sequence's variable and a
    // CountIf's x are the script's own variables. A Sequence GeoGebra drew
    // at random keeps the items it saved (`saved`, the array at this
    // depth, as long as `guard`). Its other items are drawn by a
    // generator of fixed seed (Park and Miller's, its state `$qs`), so that
    // the figure, and a student's state, open again the same.
    interface Scripted {
        code: string;
        value: string;
        depth: number;
    }
    interface Saved {
        array: string;
        guard: string;
    }
    const SCRIPTED =
        /\b(Sequence|CountIf|Sum|BinomialDist|Random|RemoveUndefined)\(/;
    const scripted = (
        source: string,
        locals: Map<string, string>,
        fresh: () => string,
        saved?: Saved,
    ): Scripted | null => {
        let text = normalizeBrackets(source.trim());
        const call = commandCall(text);
        if (call && SCRIPTED.test(`${call[0]}(`))
            return scriptedCall(call, locals, fresh, saved);
        let code = "";
        const inner = new Map(locals);
        for (let match; (match = SCRIPTED.exec(text));) {
            const end =
                matchingBracket(text, match.index + match[1].length, 1) + 1;
            const part = commandCall(text.slice(match.index, end));
            const value = part && scriptedCall(part, locals, fresh);
            if (!value || value.depth) return null;
            const name = fresh();
            code += `${value.code}var ${name}=${value.value};`;
            inner.set(name, name);
            text = text.slice(0, match.index) + name + text.slice(end);
        }
        const value = formula(text, VALUE_KINDS, inner);
        return value === null ? null : { code, value, depth: 0 };
    };
    const scriptedProgram = ({ code, value }: Scripted) =>
        `var $qs=${seed ? `${seed}==0?1:floor(${seed}*2147483646)+1` : 1};${code}${value}`;
    const scriptedCall = (
        [name, args]: [string, string[]],
        locals: Map<string, string>,
        fresh: () => string,
        saved?: Saved,
    ): Scripted | null => {
        const values = (sources: string[]) => {
            const parts = sources.map((source) =>
                scripted(source, locals, fresh),
            );
            return parts.every((part) => part && !part.depth)
                ? (parts as Scripted[])
                : null;
        };
        if (name === "Random" && args.length === 2) {
            const bounds = values(args);
            if (!bounds) return null;
            const [a, b] = bounds.map(({ value }) => `(${value})`);
            return {
                code: `${bounds.map(({ code }) => code).join("")}$qs=$qs*16807%2147483647;`,
                value: `floor(${a}+$qs/2147483647*(${b}-${a}+1))`,
                depth: 0,
            };
        }
        // P(X ≤ k) or P(X = k), X following the binomial law B(n, p).
        if (
            name === "BinomialDist" &&
            args.length === 4 &&
            ["true", "false"].includes(args[3])
        ) {
            const parts = values(args.slice(0, 3));
            if (!parts) return null;
            const [n, p, k] = parts.map(({ value }) => `(${value})`);
            const [sum, binomial, j, term] = [
                fresh(),
                fresh(),
                fresh(),
                fresh(),
            ];
            return {
                code: `${parts.map(({ code }) => code).join("")}var ${sum}=0,${binomial}=1,${term}=0;for(var ${j}=0;${j}<=floor(${k});${j}++){${term}=${binomial}*pow(${p},${j})*pow(1-${p},${n}-${j});${sum}=${sum}+${term};${binomial}=${binomial}*(${n}-${j})/(${j}+1)};`,
                value: args[3] === "true" ? sum : term,
                depth: 0,
            };
        }
        if (name === "CountIf" && args.length === 2) {
            const [condition, source] = args;
            const list = listFormula(source, locals);
            const items = list ? null : scripted(source, locals, fresh);
            if (!list && items?.depth !== 1) return null;
            const [count, index] = [fresh(), fresh()];
            const x = list ? list.item(index) : `${items!.value}[${index}-1]`;
            const test =
                x === null
                    ? null
                    : scripted(
                          condition,
                          new Map([...locals, ["x", x]]),
                          fresh,
                      );
            if (!test || test.depth) return null;
            return {
                code: `${items?.code ?? ""}var ${count}=0;for(var ${index}=1;${index}<=${list ? list.count : `${items!.value}.length`};${index}++){${test.code}if(${test.value}){${count}=${count}+1}};`,
                value: count,
                depth: 0,
            };
        }
        // Its first item plus the others, which may be points.
        if (name === "Sum" && args.length === 1) {
            const list = listFormula(args[0], locals);
            const items = list ? null : scripted(args[0], locals, fresh);
            if (!list && items?.depth !== 1) return null;
            const [sum, index] = [fresh(), fresh()];
            const x = (n: string) =>
                list ? list.item(n) : `${items!.value}[${n}-1]`;
            if (x(index) === null) return null;
            return {
                code: `${items?.code ?? ""}var ${sum}=${x("1")};for(var ${index}=2;${index}<=${list ? list.count : `${items!.value}.length`};${index}++){${sum}=${sum}+${x(index)}};`,
                value: sum,
                depth: 0,
            };
        }
        if (name === "RemoveUndefined" && args.length === 1) {
            const list = listFormula(args[0], locals);
            const items = list ? null : scripted(args[0], locals, fresh);
            if (!list && items?.depth !== 1) return null;
            const [kept, index, item] = [fresh(), fresh(), fresh()];
            const x = list ? list.item(index) : `${items!.value}[${index}-1]`;
            if (x === null) return null;
            return {
                code: `${items?.code ?? ""}var ${kept}=[],${item};for(var ${index}=1;${index}<=${list ? list.count : `${items!.value}.length`};${index}++){${item}=${x};if(isNaN(${item})==0){${kept}.push(${item})}};`,
                value: kept,
                depth: 1,
            };
        }
        if (name === "Sequence" && args.length >= 4 && args.length <= 5) {
            const [expression, variable, ...range] = args;
            const bounds = values(range);
            if (!bounds || !IDENTIFIER.test(variable)) return null;
            const [a, b, step = "1"] = bounds.map(({ value }) => `(${value})`);
            const [items, at] = [fresh(), fresh()];
            const here = saved && {
                array: `${saved.array}[${items}.length]`,
                guard: `${saved.guard}&&${items}.length<${saved.array}.length`,
            };
            const item = scripted(
                expression,
                new Map([...locals, [variable, at]]),
                fresh,
                here,
            );
            if (!item) return null;
            const value =
                here && !item.depth
                    ? `(${here.guard})?${here.array}:(${item.value})`
                    : item.value;
            return {
                code: `${bounds.map(({ code }) => code).join("")}var ${items}=[];for(var ${at}=${a};${at}<=${b}+0.000001;${at}=${at}+${step}){${item.code}${items}.push(${value})};`,
                value: items,
                depth: item.depth + 1,
            };
        }
        return null;
    };

    // A command that only a script computes, as a hidden Expression, its
    // list read by name, drawn as a Sequence of its items if GeoGebra draws
    // it.
    const scriptCommand = (
        name: string,
        sources: string[],
        [label]: string[],
        random?: string,
    ): boolean => {
        const element = elements.get(label);
        const type = element?.getAttribute("type");
        if (
            !SCRIPTED.test(`${name}(`) ||
            (type !== "list" && type !== "numeric")
        )
            return false;
        let counter = 0;
        const fresh = () => `$q${++counter}`;
        const values =
            random && /^[-\d.,\s{}eE]*$/.test(random)
                ? hiddenExpression(
                      random.replace(/\{/g, "[").replace(/\}/g, "]"),
                  )
                : null;
        const value = scripted(
            `${name}(${sources.join(",")})`,
            new Map(),
            fresh,
            values
                ? { array: values, guard: seed ? `${seed}==0` : "true" }
                : undefined,
        );
        if (!value || (type === "list") !== value.depth > 0) return false;
        const program = scriptedProgram(value);
        if (type === "numeric") {
            hiddenExpression(program, label);
            return true;
        }
        const drawn = attribute(element!, "show", "object") === "true";
        const array = hiddenExpression(program, drawn ? auxiliary() : label);
        lists.set(label, named(array, value.depth));
        if (name === "Sequence" && value.depth === 1 && isPoint(sources[0]))
            pointLists.add(label);
        if (!drawn) return true;
        return define(
            label,
            "list",
            "Sequence",
            [
                "point",
                JSON.stringify([["n", "1", `${array}.length`]]),
                JSON.stringify([`${array}[n-1]`]),
            ].map(literal),
            `${objectStyle(element!, "list")};s:${attribute(element!, "pointSize", "val") ?? 5}`,
        );
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

    // A list's items lie on its level (see below).
    // GeoGebra's 3D view ignores layers: only depth orders it. In a
    // layer, it paints lists beneath its other objects: each layer spans
    // two levels, the lower one for lists.
    const layerStyle = (element: Element, list = false): string[] => {
        const level =
            2 * Number(attribute(element, "layer", "val") ?? 0) - Number(list);
        return level && !is3D ? [`l:${level}`] : [];
    };

    const objectStyle = (
        element: Element,
        kind: Kind,
        list = kind === "list",
    ): string => {
        const parts: string[] = [];
        const color = child(element, "objColor");
        if (color) parts.push(`c:${hexColor(color)}`);
        if (hidden(element)) parts.push("h:1");
        // A line 0 pixels wide, which GeoGebra doesn't draw, has no label.
        if (
            attribute(element, "show", "label") === "true" &&
            !(
                kind === "line" &&
                attribute(element, "lineStyle", "thickness") === "0"
            )
        ) {
            const mode = attribute(element, "labelMode", "val") ?? "0";
            const point = kind === "point" || kind === "pointOn";
            // Its caption, its name for "%n", unless it shows values
            // ("%v"): the name only when it has none.
            const text = attribute(element, "caption", "val");
            const written =
                mode === "3" && text
                    ? caption(element, "").replace(
                          /%n/g,
                          element.getAttribute("label")!,
                      )
                    : null;
            // A point's coordinates ("%v"), or its name and them.
            const shown =
                point && (mode === "1" || mode === "2")
                    ? `${mode === "2" ? `${element.getAttribute("label")} = ` : ""}%v`
                    : written;
            const value = point && !!shown?.includes("%v");
            if (
                shown !== null &&
                !(value ? shown.replace(/%v/g, "") : shown).includes("%")
            )
                parts.push(
                    point ? "sn:true" : "lb:true",
                    `cp:${encodeURIComponent(shown)}`,
                    ...(value ? [`p:${decimals}`] : []),
                );
            // A point's name, whatever else it shows, but a caption.
            else if (point) {
                if (mode !== "3" || !text) parts.push("sn:true");
            }
            // An angle's value, alone or after its name; a segment's length
            // alone, written along it as DGPad does; a polygon's area alone.
            else if (
                (kind === "angle" && (mode === "1" || mode === "2")) ||
                ((element.getAttribute("type")?.startsWith("segment") ||
                    kind === "polygon") &&
                    mode === "2")
            )
                parts.push(`p:${decimals}`);
            // Its name, not its value nor its caption.
            else if (mode === "0" || (mode === "3" && !text))
                parts.push("lb:true");
        }
        parts.push(...layerStyle(element, list));
        const unselectable =
            attribute(element, "selectionAllowed", "val") === "false";
        // Neither moved nor clicked, it lets the pointer through to the
        // objects beneath, as DGPad's inert ones.
        if (unselectable && kind !== "expression") parts.push("nmi:true");
        if (
            kind === "polygon" &&
            (attribute(element, "fixed", "val") === "true" || unselectable)
        )
            parts.push("fx:true");
        if (kind === "point" || kind === "pointOn") {
            const size = pointSize(element);
            parts.push(`s:${size}`);
            const [shape, hollow] = POINT_SHAPES[
                Number(attribute(element, "pointStyle", "val") ?? 0)
            ] ?? [0, false];
            // Its ring half its size wide, as GeoGebra draws it.
            parts.push(
                `sp:${shape}`,
                hollow ? `o:1;ho:true;pb:${size / 2}` : "o:1",
            );
            if (attribute(element, "trace", "val") === "true")
                parts.push("tk:true", "tp:true");
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
                // In the plane: from 0 to 360° counterclockwise by default,
                // not reflex, reflex or unbounded.
                const orientation = "1021"[
                    Number(attribute(element, "angleStyle", "val") ?? 0)
                ];
                if (!is3D && orientation !== "0")
                    parts.push(`ao:${orientation}`);
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
        if (name !== label) nested.add(variable);
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
        const [dx, dy] = ["x", "y"].map((name) =>
            Number(offset?.getAttribute(name) ?? 0),
        );
        const parts = shown.split(";");
        if (offset && parts.includes("lb:true"))
            nameShifts.set(variable, [dx, dy]);
        // A point's name starts 4 pixels right of it, its baseline twice
        // its size above it (see GeoGebra's DrawPoint).
        if (parts.includes("sn:true") && POINT_KINDS.includes(kind))
            nameShifts.set(variable, [4 + dx, dy - 2 * pointSize(element!)]);
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

    // A number in [0, 1) drawn from the seed, its own for each call and
    // each value of the locals (a Sequence's variable).
    const uniform = (locals: Map<string, string>): string => {
        const h = `abs(sin(${seed}*${12.9898 + ++draws * 0.7}+(${[...locals.values()].join("+") || 0})*78.233+${draws}))*43758.5453`;
        return `(${h}-floor(${h}))`;
    };
    // Random(a, b), RandomBetween(a, b) or RandomUniform(a, b) from the
    // seed, but its draw at import while it is 0.
    const drawFormula = (
        name: string,
        a: string,
        b: string,
        locals: Map<string, string>,
    ): string => {
        const u = uniform(locals);
        if (name === "RandomUniform") return `((${a})+${u}*((${b})-(${a})))`;
        const first = (FUNCTIONS.Random as Expansion)([a, b]);
        const value = `floor((${a})+${u}*((${b})-(${a})+1))`;
        return first === "?"
            ? `(${value})`
            : `((${seed})==0?${first}:${value})`;
    };
    // Whether the formula reads only what is drawn from the seed.
    const readsFixed = (source: string): boolean =>
        [...formulaIdentifiers(parseFormula(source))].every((name) =>
            fixed.has(name),
        );
    // The formula with the seed at 0.
    const unseeded = (source: string): string =>
        source.replace(
            new RegExp(`${seed!.replace(/\$/g, "\\$")}(?![\\w$])`, "g"),
            "0",
        );

    // GeoGebra's clipping box, small, medium or large, which bounds its
    // surfaces even unused.
    const clippingSize = Number(
        document
            .querySelector("euclidianView3D > clipping")
            ?.getAttribute("size") ?? 1,
    );
    const defineSurface = (
        label: string,
        body: string,
        element: Element,
    ): true => {
        surfaces.add(label);
        return define(
            label,
            "sphere",
            "Surface",
            [literal(body), literal(clippingSize)],
            `${objectStyle(element, "sphere")};s:0`,
        );
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

    // A function of x and y's expression, the functions of x and y it calls
    // with x and y (a(x, y)) written out in it, if none calls itself.
    const writtenOut = (label: string, calling: Set<string>): string | null => {
        const source = expressions.get(label);
        if (source === undefined || calling.has(label)) return null;
        let failed = false;
        const text = source
            .replace(/^[^=]*\(\s*[xy]\s*(?:,\s*y\s*)?\)\s*=/, "")
            .replace(
                new RegExp(
                    `(${LABEL_WORDS.source})\\s*\\(\\s*x\\s*,\\s*y\\s*\\)`,
                    "gu",
                ),
                (call, name: string) => {
                    if (
                        !/^functionnvar$/i.test(
                            elements.get(name)?.getAttribute("type") ?? "",
                        )
                    )
                        return call;
                    const inner = writtenOut(
                        name,
                        new Set([...calling, label]),
                    );
                    failed ||= inner === null;
                    return `(${inner})`;
                },
            );
        return failed ? null : text.trim();
    };

    const shapeStyle = (
        element: Element,
        kind: Kind = "polygon",
        list?: boolean,
    ): string =>
        objectStyle(element, kind, list)
            .split(";")
            .filter((part) => part !== "lb:true" && part !== "sn:true")
            .join(";");

    // A variable for a formula, none of the figure's names.
    const freeVariable = () =>
        ["k", "j", "m", "p", "q", "t", "z"].find(
            (name) => !elements.has(name) && !objects.has(name),
        )!;

    // A list's points as a Sequence of its items, its variable none of the
    // figure's names; or the polygon on them.
    const pointSequence = (
        label: string,
        list: ListFormula,
        style?: string,
        polygon = false,
    ): boolean => {
        const k = freeVariable();
        const item = list.item(k);
        if (!item) return false;
        const points = polygon ? auxiliary() : label;
        define(
            points,
            "list",
            "Sequence",
            [
                "point",
                JSON.stringify([[k, "1", list.count]]),
                JSON.stringify([item]),
            ].map(literal),
            polygon ? undefined : style,
        );
        return (
            !polygon ||
            define(label, "polygon", "PolygonList", [ref(points)], style)
        );
    };

    // GeoGebra's integral of a function, or its lower or upper sum, drawn
    // by the engine, its value a number (see integral_object.ts).
    const integral =
        (command: string, count: number): Handler =>
        ([f, ...bounds], [label]) => {
            const element = elements.get(label);
            const values = bounds.map((bound) => formula(bound, VALUE_KINDS));
            const body = functions.has(f) || functionBody(f);
            if (
                !element ||
                !body ||
                values.length !== count ||
                values.includes(null)
            )
                return false;
            const curve = functions.has(f) ? f : auxiliary();
            if (body !== true) defineFunction(curve, body);
            return define(
                label,
                "expression",
                command,
                [ref(curve), ...(values as string[]).map(literal)],
                shapeStyle(element),
            );
        };

    // Of a function, computed by Giac (see CAS.md), with respect to x, a
    // derivative also of an order.
    const casFunction = (
        command: string,
        [f, ...rest]: string[],
        label: string,
    ): boolean => {
        const body = functions.has(f)
            ? objects.get(f)!.variable
            : functionBody(f);
        return (
            body !== null &&
            rest.every(
                (arg) =>
                    arg === "x" ||
                    (command === "Derivative" && /^[1-9]\d*$/.test(arg)),
            ) &&
            defineFunction(label, `${command}(${[body, ...rest].join(", ")})`)
        );
    };

    // A list as a whole: a formula that reads it, its items written out.
    const arrayFormula = (
        source: string,
        locals = new Map<string, string>(),
    ): string | null =>
        formula(source, VALUE_KINDS, locals) ??
        listFormula(source, locals)?.array ??
        null;

    // Drawn by the engine, its value the median.
    const boxPlot: Handler = ([y, s, data, extra], [label]) => {
        const element = elements.get(label);
        const values = [y, s, data].map(
            (value, index) =>
                value !== undefined &&
                (index < 2 ? formula(value, VALUE_KINDS) : arrayFormula(value)),
        );
        if (extra !== undefined || !element || !values.every(Boolean))
            return false;
        return define(
            label,
            "expression",
            "BoxPlot",
            (values as string[]).map(literal),
            shapeStyle(element),
        );
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
    // A list's objects, each drawn in its style, but an image, drawn as it
    // is, above the objects before it, as GeoGebra paints them in order.
    const drawList = (label: string, drawn: string[]): true => {
        const element = elements.get(label);
        if (element)
            drawn.forEach((part, index) =>
                push(null, "STL", [
                    ref(part),
                    literal(
                        `h:0;${
                            is(part, ["image"])
                                ? `l:${2 * Number(attribute(element, "layer", "val") ?? 0) - +!index}`
                                : shapeStyle(
                                      element,
                                      is(part, POINT_KINDS)
                                          ? "point"
                                          : "polygon",
                                      true,
                                  )
                        }`,
                    ),
                ]),
            );
        parts.set(label, drawn);
        return true;
    };

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
            // A written list's items, also by its name, or those of another
            // list's image, drawn in its style.
            const written = [list, expressions.get(list)?.trim() ?? ""].find(
                (source) => /^\{.*\}$/.test(source),
            );
            const items = written
                ? splitArguments(written.slice(1, -1))!.map(resolve)
                : !objects.has(list) && parts.get(list);
            if (!items) return imageOf(list, output);
            const drawn = items.flatMap((item) => {
                const part = auxiliary();
                return imageOf(item, part) ? (parts.get(part) ?? [part]) : [""];
            });
            return !drawn.includes("") && drawList(output, drawn);
        };

    // A speed that depends on the figure is read once every object exists.
    // Not playing, it waits for a script to start it.
    const animate = (label: string, scripted = false): void => {
        const element = elements.get(label);
        const animation = element && child(element, "animation");
        const playing = animation?.getAttribute("playing") === "true";
        if (!playing && !scripted) return;
        const source = animation?.getAttribute("speed") ?? "1";
        const speed = NUMBER.test(source) ? Number(source) : 1;
        if (speed !== Number(source)) rateSources.set(label, source);
        // Oscillating, increasing, decreasing or increasing once.
        const type = animation?.getAttribute("type");
        animations.set(objects.get(label)!.variable, {
            speed: Math.abs(speed),
            direction: speed < 0 !== (type === "2") ? -1 : 1,
            ar: type === "0" || type === null,
            ...(type === "3" && { once: true }),
            geogebra: true,
            ...(!playing && { stopped: true }),
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
    // camera's unit being already applied (see importGgb): in pixels from
    // its top left corner, also the plane view's (see inPlane).
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
            ? [(x - origin[0]) / unit, (origin[1] - y) / yUnit]
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
    // Of a point of space, GeoGebra's arc of the angle AMB, in its plane.
    const centerArc =
        (sector: boolean): Handler =>
        (inputs, [label]) => {
            const command = sector ? "CenterSector" : "CenterArc";
            return (
                inputs.length === 3 &&
                points(...inputs) &&
                (inputs.some(
                    (input) =>
                        elements.get(input)?.getAttribute("type") === "point3d",
                )
                    ? define(
                          label,
                          "circle",
                          `Space${command}`,
                          inputs.map(ref),
                      )
                    : arcs.set(label, inputs) &&
                      (!sector || sectors.add(label)) &&
                      orientedShape(
                          label,
                          inputs,
                          (image, [m, a, b], reversed) =>
                              define(image, "circle", command, [
                                  ref(m),
                                  ref(a),
                                  ref(b),
                                  ...(reversed ? [literal(true)] : []),
                              ]),
                      ))
            );
        };

    // Arc(c, P, Q) of a circle or an ellipse: from P to Q counterclockwise,
    // each taken where it projects onto c.
    const arcOn =
        (sector: boolean): Handler =>
        ([support, p, q, extra], [label]) => {
            const circle = is(support, ["circle"]);
            // Between two angles of a circle (relevé dans GeoGebra): its
            // points at those angles, its radius read from a hidden point
            // on it.
            const angles = [p, q].map((t) => formula(t, VALUE_KINDS));
            if (circle && !is3D && !points(p, q) && !angles.includes(null)) {
                const [center, on] = [auxiliary(), auxiliary()];
                define(center, "point", "Center", [ref(support)]);
                pointOn(on, support, false);
                const [m, a] = [center, on].map(
                    (point) => objects.get(point)!.variable,
                );
                [p, q] = angles.map((t) =>
                    formulaPoint(`${m}+d(${m},${a})*[cos(${t}),sin(${t})]`),
                );
            }
            if (extra !== undefined || !points(p, q)) return false;
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
    // Objects, each built apart in its style, shown while its branch's
    // condition holds, as long as no other object reads it: its parts,
    // whose own condition is joined to theirs once every object exists.
    const branchTests = new Map<string, string>();
    const ifObjects = (
        inputs: string[],
        label: string,
        element: Element,
    ): boolean => {
        const condition = formula(inputs[0], VALUE_KINDS);
        const reads = [...definitions].some(
            ([owner, source]) =>
                owner !== label && source.match(LABEL_WORDS)?.includes(label),
        );
        // Built from its nested commands beforehand (see inputs).
        const built = inputs
            .slice(1)
            .map((input) =>
                input.startsWith("aux ") && objects.has(input) ? input : null,
            );
        if (
            inputs.length < 2 ||
            inputs.length > 3 ||
            condition === null ||
            reads ||
            built.includes(null)
        )
            return false;
        parts.set(label, built as string[]);
        if (!hidden(element))
            built.forEach((object, index) => {
                const test = hiddenExpression(
                    index ? `!(${condition})` : condition,
                );
                branchTests.set(object!, test);
                push(null, "STL", [
                    ref(object!),
                    literal(
                        `${objectStyle(element, objects.get(object!)!.kind)};h:0;sc:${test}`,
                    ),
                ]);
            });
        return true;
    };

    // A checkbox, computed by a formula if it isn't constant.
    const checkbox = (
        label: string,
        element: Element,
        value: string,
    ): boolean => {
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
                attribute(element, "show", "label") === "false"
                    ? ""
                    : caption(element, label),
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
    };

    // A conic's center, foci, vertices, directrices' points or eccentricity,
    // in GeoGebra's order (see conic_point_object.ts), of a cylinder's or a
    // cone's section too.
    const conicPoints =
        (names: string[]): Handler =>
        ([conic], outputs) =>
            is(conic, ["quadric", "section"]) &&
            outputs.every((label, index) => {
                if (!label) return true;
                if (
                    !define(label, "point", "ConicPoint", [
                        ref(conic),
                        literal(names[index]),
                    ])
                )
                    return false;
                // GeoGebra keeps its axes' previous orientation, which
                // may swap two of them (see settleTargets).
                target(label);
                return true;
            });
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
    const nested = new Set<string>();
    // An auxiliary object's name, as the editor gives one (see nextName in
    // src/editor/figure.ts): a capital letter for a point, a small one
    // otherwise, then numbered, none of GeoGebra's labels nor a word of its
    // CAS cells and symbolic rows, where a free variable reads no object.
    const given = new Set(
        [
            ...construction.querySelectorAll(
                ":scope > cascell expression, :scope > expression",
            ),
        ].flatMap((expression) =>
            expression.tagName === "expression" &&
            expression.parentElement === construction &&
            elements
                .get(expression.getAttribute("label") ?? "")
                ?.getAttribute("type") !== "symbolic"
                ? []
                : ((
                      expression.getAttribute("value") ??
                      expression.getAttribute("exp") ??
                      ""
                  ).match(LABEL_WORDS) ?? []),
        ),
    );
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

    // A random number or point keeps the value GeoGebra saved, a number
    // drawn again from the seed (`draw`, of the command's inputs) if any.
    const savedValue =
        (draw: (inputs: string[]) => string): Handler =>
        (inputs, [label]) => {
            const element = elements.get(label);
            const coords = element && pointCoords(element);
            const source = seed ? draw(inputs) : undefined;
            const drawn =
                source !== undefined && formula(source, VALUE_KINDS) !== null;
            return coords
                ? define(label, "point", "Point", vectorLiteral(coords))
                : element?.getAttribute("type") === "numeric" &&
                      numeric(
                          label,
                          element,
                          drawn ? source : undefined,
                          drawn,
                      );
        };

    // Polygon(A, B, n)'s vertices in the plane, the k-th being A + (B -
    // A)·(1 - w^k)/(1 - w) as complex numbers (see planar); Polygon(A, B,
    // C, …)'s points.
    const polygonVertices = (args: string[]): string[] | null => {
        const sides = args.length === 3 ? formula(args[2], []) : null;
        const n = sides === null ? null : evaluateConstant(sides);
        if (n === null) return args;
        if (is3D || !Number.isInteger(n) || n < 3) return null;
        const [a, b] = args.map((point) => `(${point})`);
        return Array.from({ length: n }, (_, k) => {
            const r = Math.sin((k * Math.PI) / n) / Math.sin(Math.PI / n);
            const [x, y] = [Math.cos, Math.sin].map((f) =>
                (r * f(((k - 1) * Math.PI) / n)).toFixed(15),
            );
            return `${a}+(${b}-${a})*(${x}+${y}*ί)`;
        });
    };

    // Element(l, n) of a Sequence of polygons: its vertices for its
    // variable n, undefined out of its bounds.
    const polygonItem = (list: string, index: string): string | null => {
        const sequence = polygonLists.get(list);
        if (!sequence) return null;
        const [variable, from, to, step] = sequence.loop;
        if (step !== "1") return null;
        return sequence.vertices
            .map(
                (vertex) =>
                    `If((${from}) <= (${index}) <= (${to}), ${vertex.replace(
                        LABEL_WORDS,
                        (word) => (word === variable ? `(${index})` : word),
                    )})`,
            )
            .join(",");
    };

    // A command a formula computes: a text, a point or a number.
    // Read from its own inputs, which a formula reads, commands included.
    const formulaInputs = new Set<string>(["BoxPlot"]);
    const formulaCommand = (name: string): Handler => {
        formulaInputs.add(name);
        return (inputs, [label]) => {
            const source = `${name}(${inputs.join(",")})`;
            const element = elements.get(label);
            const type = element?.getAttribute("type");
            if (type === "text") return text(label, element!, source);
            const value = formula(source, VALUE_KINDS);
            if (value === null) return false;
            if (type === "point") formulaPoint(value, label);
            else if (type === "vector") formulaVector(label, value);
            else hiddenExpression(value, label);
            return true;
        };
    };

    // A vector of coordinates `value`, drawn from its start point, if any,
    // or else from the origin. Zero, it still translates (see Translate).
    const formulaVectors = new Set<string>();
    const formulaVector = (label: string, value: string): true => {
        formulaVectors.add(label);
        const exp = attribute(elements.get(label)!, "startPoint", "exp");
        const start = exp && points(exp) ? exp : formulaPoint(planar("0", "0"));
        const end = formulaPoint(`${objects.get(start)!.variable}+(${value})`);
        vectors.set(label, [start, end]);
        return define(label, "line", "Vector", [ref(start), ref(end)]);
    };

    // Cube(A, B, C), Tetrahedron(A, B, C)…, on the face ABC… of plane ABC,
    // on the side of AB × BC, exactly as GeoGebra builds them, or (A, B, p)
    // on AB parallel to plane or polygon p, on the side of its normal. Their
    // vertices C (unless given), D… are their own; then come their faces and
    // their edges, those of each face in turn, in GeoGebra's order.
    const regular =
        (command: string, tag: string): Handler =>
        (inputs, [solid, ...outputs]) => {
            const [a, b, c] = inputs;
            const plane = isDirection(c);
            if (inputs.length !== 3 || !points(a, b) || !(plane || points(c)))
                return false;
            defineSolid(solid, command, [a, b, c].map(ref));
            const faces = regularFaces(tag);
            const given = plane ? 2 : 3;
            const vertices = Array.from(
                { length: Math.max(...faces.flat()) + 1 },
                (_, rank) =>
                    rank < given
                        ? inputs[rank]
                        : vertexOf(solid, rank, outputs[rank - given]),
            );
            const rest = outputs.slice(vertices.length - given);
            const shell = faces.map((face) =>
                face.map((vertex) => vertices[vertex]),
            );
            shell.forEach((face, index) => {
                const label = rest[index];
                if (!label) return;
                polygons.set(label, face);
                definePolygon(label, face);
            });
            const edges = new Map<string, [number, number]>();
            faces.forEach((face) =>
                face.forEach((p, index) => {
                    const q = face[(index + 1) % face.length];
                    edges.set(`${Math.min(p, q)},${Math.max(p, q)}`, [
                        Math.min(p, q),
                        Math.max(p, q),
                    ]);
                }),
            );
            [...edges.values()].forEach(([p, q], index) => {
                const label = rest[faces.length + index];
                if (label) defineSegment(label, vertices[p], vertices[q]);
            });
            shells.set(solid, shell);
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
            const arc = arcs
                .get(support)
                ?.map((point) => objects.get(point)!.variable);
            if (rest !== undefined || value === null) return false;
            // On a CircleArc, at the fraction t of its angle.
            if (arc) {
                const [m, a, b] = arc;
                formulaPoint(
                    `rotate(${a},${m},(${value})*Angle360(${a},${m},${b}))`,
                    label,
                );
                return true;
            }
            if (!points(support)) return false;
            formulaPoint(`${objects.get(support)!.variable}+(${value})`, label);
            return true;
        },
        PointIn: ([region, extra], [label]) => {
            if (extra !== undefined) return false;
            const half = halfPlanes.get(region);
            // A sphere's region is its surface.
            if (!half)
                return (
                    (is(region, ["polygon"]) || spheres.has(region)) &&
                    pointOn(label, region, false)
                );
            // Following a hidden free point, held in the region vertically.
            const coords = pointCoords(elements.get(label)!);
            if (!coords) return false;
            const free = auxiliary();
            define(free, "point", "Point", vectorLiteral(coords), "h:2");
            const f = objects.get(free)!.variable;
            const bound = formula(
                half[1],
                VALUE_KINDS,
                new Map([["x", `x(${f})`]]),
            );
            if (bound === null) return false;
            formulaPoint(
                `[x(${f}),${half[0] === ">" ? "max" : "min"}(y(${f}),${bound})]`,
                label,
            );
            follows.set(objects.get(label)!.variable, f);
            return true;
        },
        Intersect: ([first, second, third], outputs) => {
            const [path, surface] = is(first, ["line"])
                ? [first, second]
                : [second, first];
            const solid =
                revolutions.get(surface)?.label ??
                (spheres.has(surface) || surfaces.has(surface)
                    ? surface
                    : undefined);
            if (solid) {
                // Intersect(path, solid, n), the n-th of the two points.
                const nth = third === undefined ? 0 : Number(third) - 1;
                if ((nth !== 0 && nth !== 1) || !is(path, ["line"]))
                    return false;
                outputs.slice(0, 2 - nth).forEach((label, index) => {
                    if (!label) return;
                    define(label, "point", "CylinderIntersection", [
                        ref(path),
                        ref(solid),
                        literal(index + nth),
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
            // Of two functions, from a point: Newton's method on their
            // difference, from its abscissa.
            if (functions.has(first) && functions.has(second)) {
                if (!points(third) || outputs.length !== 1) return false;
                const [f, g, p] = [first, second, third].map(
                    (input) => objects.get(input)!.variable,
                );
                const h = (x: string) => `(${f}(${x})-${g}(${x}))`;
                const x = hiddenExpression(
                    `var $x=x(${p}),$d=1,$k=0;while($k<100&&abs($d)>0.000000000001){$d=${h("$x")}*0.000001/(${h("$x+0.000001")}-${h("$x")});$x=$x-$d;$k=$k+1};$x`,
                );
                formulaPoint(`[${x},${f}(${x})]`, outputs[0]);
                return true;
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
        // From a point to a segment's nearest point, to a line; between two
        // lines or segments, 0 unless they are parallel (relevé dans
        // GeoGebra : Distance de deux segments sécants est 0).
        Distance: (inputs, [label]) => {
            const [p, q] = points(inputs[1]) ? [inputs[1], inputs[0]] : inputs;
            const v = (point: string) => objects.get(point)!.variable;
            if (points(q))
                return (
                    points(p) && !!hiddenExpression(`d(${v(p)},${v(q)})`, label)
                );
            // A line's point and direction, a quarter turn kept or not.
            const line = (label: string) => {
                const direction = !is3D && lineDirection(label);
                if (!direction) return undefined;
                const [s, a, b] = [direction.start, ...direction.ends].map(v);
                const along = `(${b}-${a})`;
                return {
                    s,
                    a,
                    along,
                    u: direction.turns % 2 ? `perp${along}` : along,
                };
            };
            const target = line(q);
            if (!target) return false;
            const { s, a, along, u } = target;
            const across = (point: string) =>
                `abs(dot(perp(${u}),${point}-${s}))`;
            if (points(p))
                return !!hiddenExpression(
                    segments.has(q)
                        ? `d(${v(p)},${a}+max(0,min(1,dot(${v(p)}-${a},${along})/dot(${along},${along})))*${along})`
                        : across(v(p)),
                    label,
                );
            const other = line(p);
            return (
                !!other &&
                !!hiddenExpression(
                    `abs(dot(perp(${u}),${other.u}))<0.000000001*sqrt(dot(${other.u},${other.u}))?${across(other.s)}:0`,
                    label,
                )
            );
        },
        Center: ([circle], [label]) =>
            is(circle, ["circle"])
                ? define(label, "point", "Center", [ref(circle)])
                : conicPoints(["C"])([circle], [label]),
        Focus: conicPoints(["F1", "F2"]),
        Vertex: conicPoints(["V1", "V2", "V3", "V4"]),
        // Through a point of each and one unit further along it.
        Directrix: ([conic], outputs) =>
            is(conic, ["quadric", "section"]) &&
            outputs.every((label, index) => {
                if (!label) return true;
                const [d, e] = ["D", "E"].map((name) => {
                    const point = auxiliary();
                    conicPoints([`${name}${index + 1}`])([conic], [point]);
                    return point;
                });
                return HANDLERS.Line([d, e], [label]);
            }),
        Eccentricity: ([conic], [label]) =>
            is(conic, ["quadric"]) &&
            !!hiddenExpression(
                `eccentricity(${objects.get(conic)!.variable})`,
                label,
            ),
        // A polygon's center of mass, not its vertices': the sum of
        // (P(i) + P(i+1))·(P(i) × P(i+1)) over 3 times the shoelace sum.
        Centroid: ([polygon, extra], [label]) => {
            const vertices = polygons.get(polygon);
            if (!vertices || extra !== undefined || is3D) return false;
            const p = vertices.map((vertex) => objects.get(vertex)!.variable);
            const terms = p.map((a, index) => {
                const b = p[(index + 1) % p.length];
                return [`(${a}+${b})`, `(x(${a})*y(${b})-x(${b})*y(${a}))`];
            });
            formulaPoint(
                `(${terms.map(([sum, cross]) => `${sum}*${cross}`).join("+")})/(3*(${terms.map(([, cross]) => cross).join("+")}))`,
                label,
            );
            return true;
        },
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
        // Of two lines, through their intersection, along the sum of their
        // unit directions, then along the second's minus the first's.
        AngularBisector: (inputs, outputs) => {
            // Of an angle ABC: a line along DGPad's half-line.
            if (inputs.length !== 2) {
                const ray = auxiliary();
                lineStarts.set(outputs[0], inputs[1]);
                return (
                    onePoint("AngleBisector", 3)(inputs, [ray]) &&
                    define(outputs[0], "line", "Parallel", [
                        ref(ray),
                        ref(inputs[1]),
                    ])
                );
            }
            const directions = inputs.map(lineDirection);
            if (!directions[0] || !directions[1]) return false;
            const vertex = auxiliary();
            define(vertex, "point", "OrderedIntersection", [
                ...inputs.map(ref),
                literal(0),
            ]);
            const x = objects.get(vertex)!.variable;
            const [u, v] = directions.map((direction) => {
                const tip = objects.get(alongDirection(vertex, direction!))!;
                return `(${tip.variable}-${x})/d(${x},${tip.variable})`;
            });
            return [`${u}+${v}`, `${v}-${u}`].every(
                (sum, index) =>
                    !outputs[index] ||
                    HANDLERS.Line(
                        [vertex, formulaPoint(`${x}+${sum}`)],
                        [outputs[index]],
                    ),
            );
        },
        // Of two lines, from the first's direction to the second's, at
        // their intersection.
        Angle: (inputs, outputs) => {
            const [g, h] = inputs;
            // Of a polygon, at each vertex, from the next one to the
            // previous one (relevé dans GeoGebra).
            const vertices = inputs.length === 1 && polygons.get(g);
            if (vertices) {
                const n = vertices.length;
                return (
                    !is3D &&
                    outputs.length === n &&
                    outputs.every((label, i) =>
                        define(
                            label,
                            "angle",
                            "Angle",
                            [i + 1, i, i + n - 1].map((k) =>
                                ref(vertices[k % n]),
                            ),
                        ),
                    )
                );
            }
            if (inputs.length !== 2 || !is(g, ["line"]) || !is(h, ["line"]))
                return onePoint("Angle", 3, "angle")(inputs, outputs);
            if (is3D) return false;
            const vertex = auxiliary();
            define(vertex, "point", "OrderedIntersection", [
                ref(g),
                ref(h),
                literal(0),
            ]);
            // Along each direction, GeoGebra's, or the line's own.
            const [p, q] = [g, h].map((line) => {
                const direction = lineDirection(line);
                if (direction) return alongDirection(vertex, direction);
                const tip = auxiliary();
                define(tip, "point", "DirectionPoint", [
                    ref(line),
                    ref(vertex),
                ]);
                return tip;
            });
            return define(outputs[0], "angle", "Angle", [
                ref(p),
                ref(vertex),
                ref(q),
            ]);
        },
        // Of a polygon, at each vertex, the inside one, whichever way the
        // polygon turns, even once dragged to turn the other way.
        InteriorAngles: ([g], outputs) => {
            const vertices = polygons.get(g);
            if (!vertices || is3D || outputs.length !== vertices.length)
                return false;
            const n = vertices.length;
            const v = vertices.map((p) => objects.get(p)!.variable);
            const turn = hiddenExpression(
                v
                    .map((p, i) => {
                        const q = v[(i + 1) % n];
                        return `x(${p})*y(${q})-x(${q})*y(${p})`;
                    })
                    .join("+"),
            );
            return outputs.every((label, i) => {
                const [next, previous] = [v[(i + 1) % n], v[(i + n - 1) % n]];
                return define(label, "angle", "Angle", [
                    ref(formulaPoint(`${turn}<0?${previous}:${next}`)),
                    ref(vertices[i]),
                    ref(formulaPoint(`${turn}<0?${next}:${previous}`)),
                ]);
            });
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
            // In space, in their own plane.
            if (points(second, third))
                return define(
                    label,
                    "circle",
                    is3D ? "Circle3pts3D" : "Circle3pts",
                    [ref(center), ref(second), ref(third)],
                );
            const [c, p] = [center, second].map(
                (point) => objects.get(point)?.variable,
            );
            if (third !== undefined) {
                const radius = formula(second, VALUE_KINDS);
                if (radius === null) return false;
                radii.set(label, `(${radius})`);
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
            if (points(second)) {
                radii.set(label, `d(${c},${p})`);
                return define(label, "circle", "Circle", [
                    ref(center),
                    ref(second),
                ]);
            }
            const ends = segmentEnds(second);
            if (ends) {
                const [e, f] = ends.map((end) => objects.get(end)!.variable);
                radii.set(label, `d(${e},${f})`);
                return define(label, "circle", "Circle3", [
                    ref(ends[0]),
                    ref(ends[1]),
                    ref(center),
                ]);
            }
            // Always a formula string, even for a plain number: GeoGebra's
            // Circle(A, r) radius isn't draggable, unlike DGP's numeric one.
            const radius = formula(second, VALUE_KINDS);
            if (radius !== null) radii.set(label, `(${radius})`);
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
        // In plane p, on the left of AB around its normal as GeoGebra
        // orients it (see turnedPlanes).
        Semicircle: ([a, b, plane, extra], [label]) =>
            extra === undefined &&
            points(a, b) &&
            (plane !== undefined
                ? turnedPlanes.has(plane) &&
                  define(
                      label,
                      "circle",
                      "Semicircle",
                      [
                          ...(turnedPlanes.get(plane) ? [b, a] : [a, b]),
                          plane,
                      ].map(ref),
                  )
                : orientedShape(label, [a, b], (image, [p, q], reversed) =>
                      define(
                          image,
                          "circle",
                          "Semicircle",
                          (reversed ? [q, p] : [p, q]).map(ref),
                      ),
                  )),
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
        Polygon: (inputs, outputs) => {
            // Polygon({A, B, C}), of a list of its points.
            const listed = /^\{(.*)\}$/.exec(inputs.join());
            const items = listed && splitArguments(listed[1]);
            const written = items?.map((item) => formula(item, POINT_KINDS));
            if (items && items.length > 2)
                if (points(...items)) inputs = items;
                else if (!written!.includes(null))
                    inputs = written!.map((item) => formulaPoint(item!));
            const [label, ...sides] = outputs;
            const [a, b, count, plane] = inputs;
            const onPlane = plane !== undefined && isDirection(plane);
            // Of a slider's n, GeoGebra's outputs are those of its largest.
            const fixed = NUMBER.test(count);
            const variable =
                elements.get(count)?.getAttribute("type") === "numeric"
                    ? formula(count, VALUE_KINDS)
                    : null;
            if (
                inputs.length === (onPlane ? 4 : 3) &&
                points(a, b) &&
                (fixed || variable !== null)
            ) {
                const n = fixed ? Number(count) : (sides.length + 2) / 2;
                if (!Number.isInteger(n) || n < 3) return false;
                const sideCount = literal(variable ?? n);
                // Its vertices, GeoGebra's outputs after its sides;
                // its image by a reflection is on B'A'.
                if (onPlane)
                    define(label, "polygon", "RegularPolygon", [
                        ref(a),
                        ref(b),
                        sideCount,
                        ref(plane),
                    ]);
                else
                    orientedShape(label, [a, b], (image, [p, q], reversed) =>
                        define(image, "polygon", "RegularPolygon", [
                            ...(reversed ? [q, p] : [p, q]).map(ref),
                            sideCount,
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
                // Of a slider's n, the closing side's end wraps to A.
                sides.slice(0, n).forEach((side, index) => {
                    if (!side) return;
                    let end = vertices[(index + 1) % n];
                    if (variable !== null && index > 0) {
                        end = auxiliary();
                        define(end, "point", "Vertex", [
                            ref(label),
                            literal(index + 1),
                            literal(true),
                        ]);
                    }
                    defineSegment(side, vertices[index], end);
                });
                return true;
            }
            // A list's points, in turn.
            if (inputs.length === 1 && objects.get(inputs[0])?.kind === "list")
                return define(label, "polygon", "PolygonList", [
                    ref(inputs[0]),
                ]);
            const list = inputs.length === 1 && listFormula(inputs[0]);
            if (list) return pointSequence(label, list, undefined, true);
            if (inputs.length < 3 || !points(...inputs)) return false;
            polygons.set(label, inputs);
            definePolygon(label, inputs);
            // In space, undefined in GeoGebra unless its vertices are
            // coplanar.
            if (is3D && inputs.length > 3)
                push(null, "STL", [ref(label), literal("pn:true")]);
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
        Cube: regular("Cube", "Cube"),
        Tetrahedron: regular("Tetrahedron", "Tetr"),
        Octahedron: regular("Octahedron", "Octa"),
        Dodecahedron: regular("Dodecahedron", "Dode"),
        Icosahedron: regular("Icosahedron", "Icos"),
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
            if (!command) return false;
            const turned =
                command === "ParallelPlane"
                    ? turnedPlanes.get(other)
                    : command === "LinePlane";
            if (turned !== undefined) turnedPlanes.set(label, turned);
            return definePlane(label, command, inputs.map(ref));
        },
        OrthogonalPlane: ([point, line, extra], [label]) => {
            if (extra !== undefined || !points(point) || !is(line, ["line"]))
                return false;
            turnedPlanes.set(label, false);
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
            // Of two quadrics, neither a sphere nor a plane, which meet
            // along no conic: undefined, as GeoGebra saved it.
            const matrix = child(elements.get(outputs[0])!, "matrix");
            if (
                extra === undefined &&
                ![first, second].some(
                    (input) => spheres.has(input) || isPlane(input),
                ) &&
                matrix &&
                [...matrix.attributes].every(({ value }) => value === "NaN")
            )
                return true;
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
            if (
                (vectors.has(vector) && !formulaVectors.has(vector)) ||
                points(vector)
            )
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
            // Of another's polygons.
            const item =
                call?.[0] === "Element" && call[1].length === 2
                    ? polygonItem(call[1][0], call[1][1])
                    : null;
            if (item) {
                inner = `Polygon(${item})`;
                call = commandCall(inner);
            }
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
            // Of lists of one command, its items by another loop.
            const items = itemLoop(
                inner,
                loops.map(([name]) => name),
            );
            if (items) {
                loops.push(items[1]);
                inner = items[0];
                call = commandCall(inner);
            }
            // Of a polygon's or a segment's images, maybe images of
            // images, the polygon of its vertices' images, the segment of
            // its ends'.
            const images: [string, string[]][] = [];
            let source = call;
            let polygon = "";
            while (source && TRANSFORMS.includes(source[0])) {
                images.unshift([source[0], source[1].slice(1)]);
                polygon = source[1][0];
                source = commandCall(polygon);
            }
            const corners =
                source?.[0] === "Segment"
                    ? source[1]
                    : polygon && polygons.get(polygon);
            if (images.length && corners) {
                inner = `${source?.[0] === "Segment" ? "Segment" : "Polygon"}(${corners.map(
                    (vertex) =>
                        images.reduce(
                            (image, [name, rest]) =>
                                `${name}(${[image, ...rest]})`,
                            vertex,
                        ),
                )})`;
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
            const ends =
                nature === "point"
                    ? [inner]
                    : nature === "polygons"
                      ? polygonVertices(call![1])
                      : call![1];
            if (!ends) return false;
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
                return (
                    !!call &&
                    loops.length === 1 &&
                    sequenceItems(label, inner, loops[0])
                );
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
            if (nature === "point") {
                lists.set(
                    label,
                    named(objects.get(label)!.variable, loops.length),
                );
                if (isPoint(inner)) pointLists.add(label);
            }
            if (nature === "polygons" && loops.length === 1)
                polygonLists.set(label, { vertices: ends, loop: loops[0] });
            sequences.set(label, [expression, variable, from, to, step]);
            return true;
        },
        // IterationList(f(z), z, {s}, n): s, f(s), f(f(s)), … n times
        // (see iteration_list_object.ts). IterationList(f, s, n) is
        // IterationList(f(z), z, {s}, n), z none of the figure's names.
        IterationList: (inputs, [label]) => {
            const fresh = freeVariable();
            const [expression, variable, start, count, extra] =
                inputs.length === 3
                    ? [`${inputs[0]}(${fresh})`, fresh, ...inputs.slice(1)]
                    : inputs;
            const s = formula(start.replace(/^\{(.*)\}$/, "$1"), VALUE_KINDS);
            const n = formula(count ?? "", VALUE_KINDS);
            const f = formula(
                expression,
                VALUE_KINDS,
                new Map([[variable, variable]]),
            );
            if (extra !== undefined || s === null || n === null || f === null)
                return false;
            const element = elements.get(label);
            const size = element && attribute(element, "pointSize", "val");
            define(
                label,
                "list",
                "IterationList",
                [JSON.stringify([[variable, s, n]]), JSON.stringify([f])].map(
                    literal,
                ),
                element &&
                    `${objectStyle(element, "list")}${size ? `;s:${size}` : ""}`,
            );
            lists.set(label, named(objects.get(label)!.variable, 1));
            return true;
        },
        // An input box of a number or of a function, at its top left corner.
        Textfield: ([linked, extra], [label]) => {
            const element = elements.get(label);
            if (
                !element ||
                extra !== undefined ||
                !(is(linked, ["expression"]) || functions.has(linked))
            )
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
            if (
                element &&
                !["point", "point3d", "numeric", "text", "boolean"].includes(
                    type!,
                )
            )
                return ifObjects(inputs, label, element);
            const content = ifFormula(inputs, VALUE_KINDS);
            if (!element || content === null) return false;
            if (type === "boolean") return checkbox(label, element, content);
            if (type === "point" || type === "point3d") {
                formulaPoint(content, label);
                return true;
            }
            // Drawn from the seed: kept as GeoGebra saved it until it changes.
            if (type === "numeric" && seed && unseeded(content) !== content)
                return numeric(label, element, `If(${inputs})`);
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
        CornerThreeD: (inputs, [label]) => HANDLERS.Corner(inputs, [label]),
        // A point whose drag moves the point it reads.
        DynamicCoordinates: ([point, ...coordinates], [label]) => {
            const values = coordinates.map((c) => formula(c, VALUE_KINDS));
            if (
                !is(point, POINT_KINDS) ||
                values.length !== (is3D ? 3 : 2) ||
                values.includes(null)
            )
                return false;
            formulaPoint(`[${values.join(",")}]`, label);
            follows.set(
                objects.get(label)!.variable,
                objects.get(point)!.variable,
            );
            return true;
        },
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
        TableText: formulaCommand("TableText"),
        ContingencyTable: formulaCommand("ContingencyTable"),
        RotateText: formulaCommand("RotateText"),
        // A polygon of a Sequence, by its vertices.
        Element: (inputs, [label]) => {
            const item =
                inputs.length === 2 && polygonItem(inputs[0], inputs[1]);
            if (!item) return formulaCommand("Element")(inputs, [label]);
            const vertices = splitArguments(item)!.map((vertex) => {
                const coords = formula(vertex, VALUE_KINDS);
                return coords && formulaPoint(coords);
            });
            if (vertices.includes(null)) return false;
            polygons.set(label, vertices as string[]);
            definePolygon(label, vertices as string[]);
            return true;
        },
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
        // Drawn as GeoGebra's slope triangle, from the line's start point,
        // else where it crosses the y-axis.
        Slope: ([line, extra], [label]) => {
            if (extra !== undefined || !is(line, ["line"])) return false;
            const m = hiddenExpression(slopeFormula(line), label);
            const tangent = curveTangents.get(line);
            const [f, p] = (tangent ?? []).map(
                (input) => objects.get(input)!.variable,
            );
            const element = elements.get(label);
            if (element) {
                const start =
                    linePoint(line) ??
                    (tangent
                        ? formulaPoint(planar(`x(${p})`, `${f}(x(${p}))`))
                        : auxiliary());
                if (!objects.has(start))
                    define(start, "point", "OrderedIntersection", [
                        ref(line),
                        ref(resolve("yAxis")),
                        literal(0),
                    ]);
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
        Radius: formulaCommand("Radius"),
        Sum: formulaCommand("Sum"),
        Mean: formulaCommand("Mean"),
        SD: formulaCommand("SD"),
        SampleSD: formulaCommand("SampleSD"),
        Median: formulaCommand("Median"),
        Q1: formulaCommand("Q1"),
        Q3: formulaCommand("Q3"),
        BoxPlot: boxPlot,
        UnitVector: formulaCommand("UnitVector"),
        UnitOrthogonalVector: formulaCommand("UnitOrthogonalVector"),
        OrthogonalVector: formulaCommand("OrthogonalVector"),
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
        Derivative: (inputs, [label]) =>
            inputs.length <= 3 && casFunction("Derivative", inputs, label),
        // Between bounds, a number; else a function's antiderivative.
        Integral: (inputs, outputs) =>
            inputs.length > 2
                ? integral("Integral", 2)(inputs, outputs)
                : casFunction("Integral", inputs, outputs[0]),
        Limit: formulaCommand("Limit"),
        TaylorPolynomial: ([f, ...rest], [label]) => {
            const body = functions.has(f)
                ? objects.get(f)!.variable
                : functionBody(f);
            const values = rest.map((arg) => formula(arg, VALUE_KINDS));
            return (
                body !== null &&
                values.length === 2 &&
                !values.includes(null) &&
                defineFunction(label, `TaylorPolynomial(${body},${values})`)
            );
        },
        LowerSum: integral("LowerSum", 3),
        UpperSum: integral("UpperSum", 3),
        Random: savedValue((inputs) => `Random(${inputs})`),
        RandomBetween: savedValue((inputs) => `Random(${inputs})`),
        RandomUniform: savedValue((inputs) => `RandomUniform(${inputs})`),
        // Drawn at import when GeoGebra saved no value, as for a text.
        RandomElement: (inputs, outputs) =>
            savedValue(
                ([list]) => `Element(${list},Random(1,Length(${list})))`,
            )(inputs, outputs) ||
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
        // CurveCartesian(x(t), y(t), t, a, b): the locus of (x(t), y(t)),
        // t being the abscissa of a point on a hidden y = 0 from a to b.
        // In space, CurveCartesian(x(t), y(t), z(t), t, a, b), or
        // CurveCartesian((x(t), y(t), z(t)), t, a, b).
        CurveCartesian: (args, [label]) => {
            const tuple =
                args.length === 4 && /^\(.*\)$/.test(args[0])
                    ? splitArguments(args[0].slice(1, -1))
                    : null;
            if (tuple) args = [...tuple, ...args.slice(1)];
            const coords = args.slice(0, is3D ? 3 : 2);
            const [t, a, b, extra] = args.slice(coords.length);
            if (b === undefined || extra !== undefined) return false;
            const [min, max] = [a, b].map((bound) =>
                formula(bound, VALUE_KINDS),
            );
            if (min === null || max === null) return false;
            const path = auxiliary();
            defineFunction(path, "0", min, max);
            const driver = auxiliary();
            pointOn(driver, path, false);
            const locals = new Map([
                [t, `x(${objects.get(driver)!.variable})`],
            ]);
            const values = coords.map((f) => formula(f, VALUE_KINDS, locals));
            return (
                !values.includes(null) &&
                define(label, "locus", "Locus", [
                    ref(formulaPoint(`[${values.join(",")}]`)),
                    ref(driver),
                ])
            );
        },
        // Of a point on a path, or of a slider.
        Locus: ([p, q, extra], [label]) =>
            extra === undefined &&
            points(p) &&
            (is(q, ["pointOn"]) ||
                (is(q, ["expression"]) &&
                    !!elements.get(q)?.querySelector(":scope > slider"))) &&
            define(label, "locus", "Locus", [ref(p), ref(q)]),
        // The whole algebraic curve, by Giac, else the swept part.
        Envelope: ([d, q, extra], [label]) =>
            extra === undefined &&
            is(d, ["line"]) &&
            is(q, ["pointOn"]) &&
            define(label, "locus", "Envelope", [ref(d), ref(q)]),
        LocusEquation: ([p, q, extra], [label]) =>
            extra === undefined &&
            points(p) &&
            is(q, ["pointOn"]) &&
            define(label, "locus", "LocusEquation", [ref(p), ref(q)]),
    };

    const expressionStyle = (element: Element, slider: boolean): string => {
        const parts = [
            `p:${decimals}`,
            `f:${fontSize}`,
            ...layerStyle(element),
        ];
        const color = child(element, "objColor");
        if (color) {
            const hex = hexColor(color);
            parts.push(`c:${hex}`, `cPT:${btoa(`c:${hex};o:1`)}`);
        }
        if (!slider || hidden(element)) parts.push("h:1");
        const thickness = attribute(element, "lineStyle", "thickness");
        if (thickness) parts.push(`s:${Number(thickness) / 2}`);
        const width = attribute(element, "slider", "width");
        if (width) parts.push(`cL:${width}`);
        if (slider) {
            const step =
                attribute(element, "animation", "step") ??
                String(DEFAULT_SLIDER_STEP);
            // An angle slider's step in degrees ("°", "5°", "5*°"), its
            // value being in radians.
            const degrees = /^([\d.]*)\s*\*?\s*°$/.exec(step);
            parts.push(
                `i:${degrees ? (Number(degrees[1] || 1) * Math.PI) / 180 : step}`,
            );
        }
        if (attribute(element, "slider", "horizontal") === "false")
            parts.push("cV:true");
        if (slider && element.getAttribute("type") === "angle")
            parts.push("cD:true");
        if (slider && attribute(element, "show", "label") === "false")
            parts.push("cN:true");
        const text = attribute(element, "caption", "val");
        if (slider && attribute(element, "labelMode", "val") === "3" && text)
            parts.push(
                `cp:${encodeURIComponent(caption(element, "").replace(/%n/g, element.getAttribute("label")!))}`,
            );
        return parts.join(";");
    };

    // A dropdown list of numbers and texts, as an Expression whose value is
    // its selected item's number, at its top left corner.
    const dropdown = (
        label: string,
        element: Element,
        items: (string | null)[],
    ) => {
        const choices = items.map((item) => {
            if (item === null) return null;
            const value =
                /^"([^"]*)"$/.exec(item)?.[1] ?? evaluateConstant(item);
            return typeof value === "number"
                ? String(Number(value.toFixed(decimals)))
                : value;
        });
        if (choices.includes(null)) return;
        const selection = auxiliary();
        const [x, y] = screenPosition(
            Number(attribute(element, "labelOffset", "x") ?? 0),
            Number(attribute(element, "labelOffset", "y") ?? 0),
            true,
        );
        // Without a caption, GeoGebra's label is three no-break spaces.
        define(
            selection,
            "expression",
            "Expression",
            [
                attribute(element, "show", "label") === "true"
                    ? attribute(element, "caption", "val")
                        ? caption(element, label)
                        : "\u00a0\u00a0\u00a0"
                    : "",
                "",
                "",
                String(
                    Number(attribute(element, "selectedIndex", "val") ?? 0) + 1,
                ),
                String(x),
                String(y),
            ].map(literal),
            textStyle(element),
        );
        menus.set(objects.get(selection)!.variable, choices as string[]);
        selections.set(label, objects.get(selection)!.variable);
    };

    // A list of points is drawn, other lists only read by formulas.
    // A random list (`drawn`, its command) is drawn again from the seed.
    const defineList = (
        label: string,
        element: Element,
        source: string,
        drawn?: string,
    ): boolean => {
        const list = listFormula(source);
        if (!list) return false;
        lists.set(label, list);
        // Take, Insert… of a list of points.
        if (
            commandCall(normalizeBrackets(source))?.[1].some((arg) =>
                pointLists.has(arg),
            )
        )
            pointLists.add(label);
        if (
            attribute(element, "listType", "val") !== "point" &&
            !pointLists.has(label)
        ) {
            // Written {…}, an expression the formulas read by name.
            const text = normalizeBrackets(source.trim());
            if (!/^\{.*\}$/.test(text)) return true;
            const items = splitArguments(text.slice(1, -1))!.map((item) =>
                formula(item, VALUE_KINDS),
            );
            const again = drawn === undefined ? null : listFormula(drawn);
            const fresh =
                again && evaluateConstant(again.count) === items.length
                    ? items.map((_, n) => again.item(String(n + 1)))
                    : [];
            define(
                label,
                "expression",
                "Expression",
                [
                    "",
                    "",
                    "",
                    fresh.length && !fresh.includes(null)
                        ? `(${seed})==0?[${items}]:[${fresh}]`
                        : `[${items}]`,
                    "0",
                    "0",
                ].map(literal),
                "h:1",
            );
            if (fresh.length && !fresh.includes(null))
                fixed.add(objects.get(label)!.variable);
            lists.set(label, {
                ...named(objects.get(label)!.variable, 1),
                count: list.count,
            });
            if (attribute(element, "comboBox", "val") === "true")
                dropdown(label, element, items);
            return true;
        }
        const size = attribute(element, "pointSize", "val");
        return pointSequence(
            label,
            list,
            `${objectStyle(element, "list")}${size ? `;s:${size}` : ""}`,
        );
    };

    // `drawn`: of a random command, whose saved value holds until the seed
    // changes, whatever its bounds read, as that of a formula drawing from
    // the seed what no manipulation changes.
    const numeric = (
        label: string,
        element: Element,
        source = expressions.get(label),
        drawn = false,
    ): boolean => {
        const slider = child(element, "slider");
        const value = attribute(element, "value", "val") ?? "";
        const style = expressionStyle(element, !!slider);
        if (slider) {
            // Or reading a list, which saves no value.
            const [min, max] = ["min", "max"].map((bound) => {
                const source = slider.getAttribute(bound) ?? "";
                return (
                    formula(source, [], savedNumbers) ??
                    formula(source, VALUE_KINDS)
                );
            });
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
            // GeoGebra writes its label from its knob (see DrawSlider), a
            // LaTeX caption 10 pixels higher and 4 further.
            if (slider.getAttribute("horizontal") !== "false") {
                const [dx, dy] = ["x", "y"].map((name) =>
                    Number(attribute(element, "labelOffset", name) ?? 0),
                );
                const latex = /^\$.*\$$/.test(
                    attribute(element, "caption", "val") ?? "",
                );
                nameShifts.set(
                    objects.get(label)!.variable,
                    latex ? [dx - 7, dy - 25] : [dx - 11, dy - 15],
                );
            }
            animate(label);
            return true;
        }
        const dependent =
            source === undefined ? null : formula(source, TEXT_KINDS);
        // Drawn from the seed alone: the value GeoGebra saved until a
        // script draws it again.
        const seeded =
            seed !== null &&
            dependent !== null &&
            NUMBER.test(value) &&
            unseeded(dependent) !== dependent &&
            (drawn || readsFixed(unseeded(dependent)));
        // A free number GeoGebra saved undefined stays so.
        const content = seeded
            ? `(${seed})==0?${value}:(${dependent})`
            : dependent !== null && !isConstant(dependent)
              ? dependent
              : value === "NaN"
                ? "0/0"
                : value;
        if (
            !seeded &&
            content !== dependent &&
            !NUMBER.test(content) &&
            content !== "0/0"
        )
            return false;
        // Untranslated, it keeps its saved value, but is reported.
        if (source !== undefined && dependent === null)
            unsupported.push(`numeric ${label}`);
        define(
            label,
            "expression",
            "Expression",
            ["", "", "", content, "0", "0"].map(literal),
            style,
        );
        if (seeded || (seed && content === dependent && readsFixed(content)))
            fixed.add(objects.get(label)!.variable);
        return true;
    };

    // A function of x as GeoGebra writes it in a text, its numbers' values
    // read live: "0.5 (x - 8) + 8", "8 - 0.5 x" for a negative a, "2x²".
    const functionText = (label: string): TextPart[] | null => {
        const source = expressions.get(label);
        if (
            elements.get(label)?.getAttribute("type") !== "function" ||
            !source ||
            !FUNCTION_DEFINITION.test(source)
        )
            return null;
        const tokens: string[] = [];
        const token = new RegExp(
            `\\s*(\\d+(?:\\.\\d+)?|${LABEL_WORDS.source}|[-+*/^(),])`,
            "uy",
        );
        const body = source.replace(FUNCTION_DEFINITION, "").trim();
        for (let match; (match = token.exec(body));) tokens.push(match[1]);
        if (tokens.join("") !== body.replace(/\s/g, "")) return null;
        type Printed = {
            parts: TextPart[];
            first: "number" | "value" | "letter" | "paren" | "minus";
            value?: string;
            op?: string;
        };
        let at = 0;
        const accept = (text: string): boolean =>
            tokens[at] === text && ++at > 0;
        const paren = (p: Printed): Printed => ({
            parts: ["(", ...p.parts, ")"],
            first: "paren",
        });
        const sum = (p: Printed): boolean => p.op === "+" || p.op === "-";
        const SUPERSCRIPTS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
        const binary = (op: string, l: Printed, r: Printed): Printed => {
            let parts: TextPart[];
            if (op === "+" || op === "-") {
                if (op === "-" && (sum(r) || r.first === "minus")) r = paren(r);
                const v = r.value;
                parts =
                    r.first === "value"
                        ? [
                              {
                                  formula: `(${v}<0?" ${op === "+" ? "-" : "+"} ":" ${op} ")`,
                              },
                              { formula: `abs(${v})` },
                              ...r.parts.slice(1),
                          ]
                        : r.first === "minus"
                          ? [" - ", ...r.parts.slice(1)]
                          : [` ${op} `, ...r.parts];
            } else if (op === "*") {
                if (sum(l)) l = paren(l);
                if (sum(r) || r.first === "minus") r = paren(r);
                const v = r.value;
                parts =
                    r.first === "value"
                        ? [
                              { formula: `(${v}<0?" (":" * ")` },
                              ...r.parts,
                              { formula: `(${v}<0?")":"")` },
                          ]
                        : [
                              r.first === "number"
                                  ? " * "
                                  : r.first === "letter" &&
                                      l.first === "number" &&
                                      !l.op
                                    ? ""
                                    : " ",
                              ...r.parts,
                          ];
            } else if (op === "/") {
                if (sum(l)) l = paren(l);
                if (r.op) r = paren(r);
                parts = [" / ", ...r.parts];
            } else {
                if (l.op || l.first === "minus") l = paren(l);
                const n = r.first === "number" && !r.op ? String(r.parts) : "";
                parts = /^\d+$/.test(n)
                    ? [[...n].map((d) => SUPERSCRIPTS[+d]).join("")]
                    : [
                          "^",
                          ...(r.op || r.first === "minus" ? paren(r) : r).parts,
                      ];
            }
            return { ...l, parts: [...l.parts, ...parts], op };
        };
        const atom = (): Printed | null => {
            const t = tokens[at++];
            if (t === undefined) return null;
            if (t === "(") {
                const inner = expression();
                return inner && accept(")") ? inner : null;
            }
            if (/^\d/.test(t)) return { parts: [t], first: "number" };
            if (t === "x") return { parts: ["x"], first: "letter" };
            if (accept("(")) {
                const args: TextPart[] = [];
                do {
                    const arg = expression();
                    if (!arg) return null;
                    args.push(...(args.length ? [", "] : []), ...arg.parts);
                } while (accept(","));
                return !objects.has(t) && accept(")")
                    ? { parts: [t, "(", ...args, ")"], first: "letter" }
                    : null;
            }
            const value = formula(t, VALUE_KINDS);
            return value === null
                ? null
                : { parts: [{ formula: value }], first: "value", value };
        };
        const unary = (): Printed | null => {
            if (accept("-")) {
                const a = unary();
                return (
                    a && {
                        parts: ["-", ...(sum(a) ? paren(a) : a).parts],
                        first: "minus",
                    }
                );
            }
            let base = atom();
            while (base && accept("^")) {
                const exponent = unary();
                base = exponent && binary("^", base, exponent);
            }
            return base;
        };
        const level = (
            ops: string[],
            next: () => Printed | null,
        ): Printed | null => {
            let left = next();
            while (left && ops.includes(tokens[at])) {
                const op = tokens[at++];
                const right = next();
                left = right && binary(op, left, right);
            }
            return left;
        };
        const expression = (): Printed | null =>
            level(["+", "-"], () => level(["*", "/"], unary));
        const printed = expression();
        return printed && at === tokens.length ? printed.parts : null;
    };

    // Whether a list's items, or a value, are texts.
    const textValued = (source: string): boolean => {
        const text = normalizeBrackets(source.trim());
        if (/^"[^"]*"$/.test(text)) return true;
        if (elements.has(text))
            return elements.get(text)!.getAttribute("type") === "text";
        if (/^\{.*\}$/.test(text))
            return (
                splitArguments(text.slice(1, -1))?.every(textValued) ?? false
            );
        const [name, args] = commandCall(text) ?? ["", []];
        return (
            [
                "CellRange",
                "Element",
                "RemoveUndefined",
                "Sequence",
                "If",
            ].includes(name) && textValued(args[name === "If" ? 1 : 0] ?? "")
        );
    };

    // A list in a text, as GeoGebra writes it: {"A", "B"}, {1, 2.5}.
    const listText = (source: string): string | null => {
        const list = listFormula(source);
        const item = list?.item("$k");
        if (!item) return null;
        const quote = textValued(source) ? `+'"'` : "";
        return hiddenExpression(
            `var $o="{";for(var $k=1;$k<=${list!.count};$k++){$o=$o+($k>1?", ":"")${quote}+(${item})${quote}};$o+"}"`,
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
                splitArguments(normalizeBrackets(inner.slice(1, -1)))
                    ?.length === 1
            )
                inner = inner.slice(1, -1).trim();
            const name = /^Name\[(.*)\]$/.exec(inner)?.[1];
            if (/^"[^"]*"$/.test(inner) || name !== undefined) {
                if (!addSum()) return null;
                // Of an expression, its definition as GeoGebra writes it.
                parts.push(
                    name === undefined
                        ? inner.slice(1, -1)
                        : elements.has(name)
                          ? name
                          : normalizeBrackets(name).replace(
                                /CellRange\((\w+),\s*(\w+)(?:,\s*"[^"]*")?\)/g,
                                "$1:$2",
                            ),
                );
                concatenating = true;
                continue;
            }
            const list = /^(\{|(RemoveUndefined|Sequence|CellRange)[[(])/.test(
                inner,
            )
                ? listText(inner)
                : null;
            if (list) {
                if (!addSum()) return null;
                parts.push({ formula: list });
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
                        .concat(is3D ? [`z(${variable})`] : [])
                        .flatMap((coordinate, index) => [
                            ...(index ? [", "] : []),
                            { formula: coordinate },
                        ]),
                    ")",
                );
                continue;
            }
            const written = functionText(inner);
            if (written) {
                if (!addSum()) return null;
                parts.push(...written);
                concatenating = true;
                continue;
            }
            sum.push(term);
            if (concatenating && !addSum()) return null;
        }
        return addSum() ? parts : null;
    };

    // A text as a formula, its parts joined.
    const textFormula = (source: string): string | null => {
        const parts = textParts(source);
        return (
            parts &&
            `(""${parts.map((part) => (typeof part === "string" ? `+"${part.replace(/[\\"]/g, "\\$&")}"` : `+(${part.formula})`)).join("")})`
        );
    };

    const textStyle = (element: Element): string => {
        const color = child(element, "objColor");
        const background = child(element, "bgColor");
        return [
            ...(color ? [`c:${hexColor(color)}`] : []),
            ...(background ? [`bg:${hexColor(background)}`] : []),
            ...(hidden(element) ? ["h:1"] : []),
            // A LaTeX one is a \boldsymbol (see text).
            ...((Number(attribute(element, "font", "style")) & 1) === 1 &&
            attribute(element, "isLaTeX", "val") !== "true"
                ? ["bf:true"]
                : []),
            `p:${decimals}`,
            `f:${fontSize * Number(attribute(element, "font", "sizeM") ?? 1)}`,
            ...layerStyle(element),
        ].join(";");
    };

    // Beside a 3D view, a text of the graphics view's only (bit 3 of "ev",
    // see outOfView) at a constant point: where it is in that view, in
    // pixels as the plane view's (see screenPosition).
    const flatStart = (element: Element): [number, number] | null => {
        const start = child(element, "startPoint");
        if (
            !is3D ||
            !start ||
            start.hasAttribute("exp") ||
            (Number(attribute(element, "show", "ev")) & 9) !== 8
        )
            return null;
        const [x, y, z] = ["x", "y", "z"].map((name) =>
            Number(start.getAttribute(name) ?? (name === "z" ? 1 : 0)),
        );
        return [x / z, y / z];
    };

    // A text pinned on screen, or hidden, as an Expression whose value is
    // its string: DGPad's Expressions stay where they are on screen.
    const textExpression = (
        label: string,
        element: Element,
        content: string,
    ): boolean => {
        const location = child(element, "absoluteScreenLocation");
        const flat = flatStart(element);
        if (
            !location &&
            !flat &&
            attribute(element, "show", "object") !== "false"
        )
            return false;
        const [x, y] = location
            ? screenPosition(
                  Number(location.getAttribute("x")),
                  Number(location.getAttribute("y")),
                  true,
              )
            : flat
              ? screenPosition(flat[0], flat[1], false)
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
    // gather environments as aligned and gathered, refuses the "$"
    // delimiters GeoGebra ignores in its math mode, and breaks lines only at
    // "\\" (out of a \boldsymbol), as GeoGebra does at a line break of its
    // text mode (outside "$", in a text that has any) outside environments:
    // after a space, which keeps an empty line's height. In its math mode, a
    // line break is a space. A bold text's lines are each a \boldsymbol, as
    // GeoGebra's, its \text a \textbf; a sans serif one's \text is \textsf
    // (KaTeX can't make it bold too without its closing brace, which a
    // formula may write). GeoGebra writes a "%", a comment for KaTeX.
    const inlineTeX = (
        tex: string,
        breaks: boolean,
        bold: boolean,
        sans: boolean,
        mode: { math: boolean },
    ): string =>
        tex
            .replace(
                /\\text\{/g,
                sans ? "\\textsf{" : bold ? "\\textbf{" : "$&",
            )
            .replace(/\\(begin|end)\{(align|gather)\*?\}/g, "\\$1{$2ed}")
            .replace(/(^|[^\\])%/g, "$1\\%")
            .replace(/\\\\|\\?\$|\n/g, (match) => {
                const line = bold ? "}\\\\\\boldsymbol{" : "\\\\";
                if (match === "\\\\") return breaks ? line : match;
                if (match === "$") mode.math = !mode.math;
                if (match !== "\n") return match.length > 1 ? match : "";
                if (mode.math) return " ";
                return breaks ? `~${line}` : "\n";
            });

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
        const breaks = !source.includes("\\begin");
        const bold =
            latex && (Number(attribute(element, "font", "style")) & 1) === 1;
        const sans = attribute(element, "font", "serif") !== "true";
        // GeoGebra draws its LaTeX in display style, in sans serif unless
        // the text is serif.
        const [open, close] = !latex
            ? ["", ""]
            : [
                  `\\displaystyle${sans ? "\\sf" : ""}${bold ? "\\boldsymbol{" : " "}`,
                  bold ? "}" : "",
              ];
        const mode = {
            math: !parts.some(
                (part) => typeof part === "string" && /(^|[^\\])\$/.test(part),
            ),
        };
        // Its neighboring strings joined: a constant text is one string,
        // which a script may set. A string first, so that "+" joins texts.
        const terms: (string | { formula: string })[] = [];
        [
            open,
            ...parts.map((part) =>
                typeof part === "string"
                    ? latex
                        ? inlineTeX(part, breaks, bold, sans, mode)
                        : subscripts(part)
                    : part,
            ),
            close,
        ].forEach((term) => {
            const last = terms.length - 1;
            if (typeof term === "string" && typeof terms[last] === "string")
                terms[last] += term;
            else terms.push(term);
        });
        const content = terms
            .map((term) =>
                typeof term === "string"
                    ? `"${term.replace(/[\\"]/g, "\\$&")}"`
                    : `(${term.formula})`,
            )
            .join("+");
        if (
            child(element, "absoluteScreenLocation") ||
            flatStart(element) ||
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
        texts.set(label, source);
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
                                ? subscripts(part).replace(/%/g, "%%")
                                : `%${part.formula}%`,
                        )
                        .join(""),
                ),
            ],
            textStyle(element),
        );
    };

    // {C(a₁, b₁), C(a₂, b₂)…}, a list of one command C, as C(Element({a₁,
    // a₂…}, j), Element({b₁, b₂…}, j)) for j from 1 to its size, j not
    // being one of `taken` nor a word of the list.
    const itemLoop = (
        list: string,
        taken: string[],
    ): [string, string[]] | null => {
        const calls = /^\{.*\}$/.test(list)
            ? splitArguments(list.slice(1, -1))?.map(commandCall)
            : null;
        const [name, args] = calls?.[0] ?? [];
        if (
            !args ||
            !calls!.every(
                (item) => item?.[1].length === args.length && item[0] === name,
            )
        )
            return null;
        let j = "j";
        while (taken.includes(j) || new RegExp(`\\b${j}\\b`).test(list))
            j += "j";
        return [
            `${name}(${args.map(
                (_, index) =>
                    `Element({${calls!.map((item) => item![1][index])}}, ${j})`,
            )})`,
            [j, "1", String(calls!.length), "1"],
        ];
    };

    // Sequence(f(i), i, a, b, s), f being a command no Sequence draws: an
    // object for each value i may take, a and b being numbers or sliders,
    // shown between a and b.
    const sequenceItems = (
        label: string,
        inner: string,
        [variable, from, to, step]: string[],
    ): boolean => {
        const element = elements.get(label);
        const constant = (bound: string) => {
            const value = formula(bound, []);
            return (value === null ? null : evaluateConstant(value)) ?? NaN;
        };
        // The values a bound may take, reading at most a slider: those at
        // its ends.
        const extent = (bound: string) => {
            const [name, ...others] = (bound.match(LABEL_WORDS) ?? []).filter(
                (word) => elements.has(word),
            );
            const slider = elements.get(name);
            if (!slider || others.length || !child(slider, "slider"))
                return [constant(bound), constant(bound)];
            const ends = ["min", "max"].map((end) =>
                constant(
                    bound.replace(LABEL_WORDS, (word) =>
                        word === name
                            ? `(${attribute(slider, "slider", end)})`
                            : word,
                    ),
                ),
            );
            return [Math.min(...ends), Math.max(...ends)];
        };
        const [low] = extent(from);
        const [, high] = extent(to);
        const s = constant(step);
        const count = Math.floor((high - low) / s + 1.000001);
        const fixed = !isNaN(constant(from) + constant(to));
        if (!element || !(count > 0 && count <= 100)) return false;
        const items: string[] = [];
        for (let n = 0; n < count; n++) {
            const value = `(${low + n * s})`;
            const [command, inside] = [
                inner,
                `(${from}) <= ${variable} <= (${to})`,
            ].map((input) =>
                input.replace(QUOTED_WORDS, (word) =>
                    word === variable ? value : word,
                ),
            );
            const test = fixed ? "1" : formula(inside, VALUE_KINDS);
            const [name, [source, point, ...rest]] = commandCall(command)!;
            const anchor = name === "Text" && point && pointAt(point);
            let object = auxiliary();
            if (anchor) {
                // Its integer terms as strings, joined to those around
                // them: "u_{" + (1) + "}" is "u_{1}", 1 in subscript.
                const written = textTerms(source)
                    .map((term) => {
                        const value = /^"/.test(term) ? null : constant(term);
                        return Number.isInteger(value) ? `"${value}"` : term;
                    })
                    .join("+")
                    .replace(/"\+"/g, "");
                if (rest.length || !text(object, element, written, anchor))
                    return false;
            } else object = resolve(command);
            if (test === null || !objects.has(object)) return false;
            items.push(object);
            const shown = fixed ? "" : hiddenExpression(test);
            if (shown) branchTests.set(object, shown);
            if (!hidden(element))
                push(null, "STL", [
                    ref(object),
                    literal(
                        `${anchor ? "" : `${objectStyle(element, objects.get(object)!.kind)};`}h:0${shown && `;sc:${shown}`}`,
                    ),
                ]);
        }
        parts.set(label, items);
        return true;
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
        if (orphan(label, element)) return true;
        const half =
            /^functionnvar$/i.test(type ?? "") &&
            hidden(element) &&
            /^[^=]*\(\s*x\s*,\s*y\s*\)\s*=\s*y\s*([<>≤≥])(.*)$/.exec(
                source ?? "",
            );
        if (half) {
            halfPlanes.set(label, [/[>≥]/.test(half[1]) ? ">" : "<", half[2]]);
            return true;
        }
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
        // In space, a quadric z = f(x, y), a surface; hidden, another
        // draws nothing.
        if (type === "quadric" && is3D && source !== undefined) {
            const graph = /^\s*z\s*=(.*)$/.exec(source);
            const body =
                graph &&
                !/\bz\b/.test(graph[1]) &&
                formula(graph[1].trim(), VALUE_KINDS, PLANAR_VARIABLES);
            if (body) return defineSurface(label, body, element);
            return hidden(element);
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
                                  objects.has("z")
                                      ? PLANAR_VARIABLES
                                      : EQUATION_VARIABLES,
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
        // A row of GeoGebra's symbolic mode (its Suite), computed by Giac,
        // which its graphics don't draw: a hidden number of the figure,
        // unless it reads free variables; and a line of the CAS view where
        // the algebra view shows it, `name := …` if named (GeoGebra's
        // unnamed rows are labeled ¥¦§¨©ª).
        if (type === "symbolic" && source !== undefined) {
            const content = formula(source, VALUE_KINDS, new Map([["x", "x"]]));
            const shown = shownView("2");
            if (content === null || shown) {
                const named = !label.startsWith("¥");
                const line = casLine(
                    named ? `${label} := ${source}` : source,
                    source,
                    false,
                );
                if (line === null) return false;
                casLines.push(line);
                if (content === null || !named) return true;
            }
            const call = commandCall(content);
            return define(
                label,
                "expression",
                "Expression",
                [
                    "",
                    "",
                    "",
                    call && casArity(call[0])
                        ? content
                        : `Simplify(${content})`,
                    "0",
                    "0",
                ].map(literal),
                expressionStyle(element, false),
            );
        }
        if (type === "numeric" || type === "angle")
            return numeric(label, element);
        if (type === "text" && source !== undefined)
            return text(label, element, source);
        const ends =
            type === "segment" &&
            source !== undefined &&
            segments.get(source.trim());
        if (ends) return defineSegment(label, ends[0], ends[1]);
        if (type === "vector" && source !== undefined) {
            const value = formula(source, VALUE_KINDS);
            return value !== null && formulaVector(label, value);
        }
        // A free vector, of saved coordinates (w = 0 in space).
        const coords = child(element, "coords");
        if ((type === "vector" || type === "vector3d") && coords)
            return formulaVector(
                label,
                `[${["x", "y", ...(is3D ? ["z"] : [])].map((name) => Number(coords.getAttribute(name)))}]`,
            );
        // A copy of a list of segments, each another.
        const drawn = source !== undefined && parts.get(source.trim());
        if (type === "list" && drawn) {
            const copies = drawn.map((part) => {
                const ends = segments.get(part);
                const copy = auxiliary();
                return ends
                    ? defineSegment(copy, ends[0], ends[1]) && copy
                    : "";
            });
            return !copies.includes("") && drawList(label, copies);
        }
        // A copy of a Sequence, as another.
        const copied = source !== undefined && sequences.get(source.trim());
        if (type === "list" && copied)
            return HANDLERS.Sequence(copied, [label]);
        // Written {C(…), C(…)…}, a Sequence of its items.
        const items =
            type === "list" &&
            source !== undefined &&
            itemLoop(normalizeBrackets(source.trim()), []);
        if (items) return HANDLERS.Sequence([items[0], ...items[1]], [label]);
        // A hidden list of objects only draws its images.
        if (type === "list" && source !== undefined)
            return (
                defineList(label, element, source) ||
                (hidden(element) &&
                    /^\{.*\}$/.test(source.trim()) &&
                    splitArguments(source.trim().slice(1, -1))!.every((item) =>
                        objects.has(item.trim()),
                    ))
            );
        // A copy of a polygon, through its vertices: a regular polygon's
        // shape is built from its first two only.
        const vertices =
            type === "polygon" &&
            is(source, ["polygon"]) &&
            (polygons.get(source!) ?? shapes.get(source!)?.points);
        if (vertices) return definePolygon(label, vertices);
        // Its program may read later objects (see buttons below).
        if (type === "button") return true;
        // A boolean is a checkbox, at its label's place on screen, that
        // only an independent one lets tick.
        if (type === "boolean") {
            const value =
                source === undefined ? "" : formula(source, VALUE_KINDS);
            return value !== null && checkbox(label, element, value);
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
                // An image's image is mapped again from its corners.
                const build = (image: string, points: string[]): true => {
                    shapes.set(image, { points, build });
                    return define(image, "image", "Image", [
                        ...picture,
                        ...points.map(ref),
                    ]);
                };
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
        // An inequality, x ≤ k, x² < 2 or of x and y: in the plane, the
        // region where it holds, the inequalities of x and y it calls
        // (a(x, y)) written out in it, one of them hidden drawing nothing.
        const single =
            type === "function" &&
            (inequalities.has(label) ||
                /^(?:[^=]*\(\s*[xy]\s*\)\s*=)?\s*[xy]\s*[<>≤≥]/.test(
                    source ?? "",
                ));
        if (single || /^functionnvar$/i.test(type ?? "")) {
            const text = writtenOut(label, new Set());
            // In space, a surface, which formulas call.
            if (!single && hidden(element) && !is3D) {
                if (
                    text !== null &&
                    !/[<>≤≥]/.test(text) &&
                    formula(text, ["expression"], PLANAR_VARIABLES) !== null
                )
                    twoVariables.set(label, text);
                return true;
            }
            if (text === null) return false;
            if (is3D) {
                const body =
                    !single &&
                    !/[<>≤≥]/.test(text) &&
                    formula(text, VALUE_KINDS, PLANAR_VARIABLES);
                return body
                    ? defineSurface(label, body, element)
                    : !single && hidden(element);
            }
            if (!/[<>≤≥]/.test(text)) return false;
            const body = formula(text, VALUE_KINDS, PLANAR_VARIABLES);
            return (
                body !== null &&
                define(
                    label,
                    "polygon",
                    "Region",
                    [literal(body)],
                    shapeStyle(element),
                )
            );
        }
        if (
            type === "function" &&
            source !== undefined &&
            !inequalities.has(label)
        ) {
            const body = formula(
                source.replace(FUNCTION_DEFINITION, "").trim(),
                ["expression"],
                new Map([["x", "x"]]),
            );
            return body !== null && defineFunction(label, body);
        }
        // f(z) = …, a complex function, which GeoGebra saves as a surface.
        const complex =
            type === "surfacecartesian" &&
            hidden(element) &&
            /^[^=(]*\(\s*z\s*\)\s*=(.*)$/.exec(source ?? "");
        if (complex) {
            const body = formula(
                complex[1].trim(),
                ["expression"],
                new Map([["z", "x"]]),
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
    // Above or below the 3D view, a graphics view whose widgets stay where
    // they are in it, from the window's top left corner: the 3D view is
    // centered in the rest of the window.
    const graphicsAt = location("1");
    const side =
        graphicsAt &&
        graphicsAt.find((digit, index) => digit !== spaceAt[index]);
    const across = side === "1" || side === "3";
    const strip =
        side && view && !plane
            ? Number(attribute(view, "size", across ? "width" : "height") ?? 0)
            : 0;
    const inset: Vec2 = across ? [strip, 0] : [0, strip];
    const band = strip && view && child(view, "bgColor");
    const camera: GgbView3D | undefined = coordSystem3D
        ? {
              shift: across ? [strip / 2, 0] : [0, strip / 2],
              ...(band && { band: { color: hexColor(band), inset } }),
              planeFirst: planeSide === "3" && plane !== null,
              planeWidth: plane
                  ? Number(attribute(view!, "size", "width")) || 0
                  : 0,
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
    // GeoGebra's clipping box (see grid.geogebraBox): its corner n, from
    // the window and the camera, the 3D view starting `inset` pixels right
    // of and below the window's top left corner.
    const boxSize = Number(
        (view3D && attribute(view3D, "clipping", "size")) ?? 1,
    );
    const boxCorner = (n: number): string | null => {
        if (!Number.isInteger(n) || n < 1 || n > 8) return null;
        const [left, top] = inset;
        const a = `(windowcx()+${left / 2}/pixel())`;
        const b = `(windowcy()-${top / 2}/pixel())`;
        const factor = [Math.sqrt(1 / 3), Math.SQRT1_2, 1][boxSize] / 2;
        const wide = `(windoww()-${left}/pixel())*${factor}`;
        const high = `(windowh()-${top}/pixel())*${factor}`;
        const sign = (positive: boolean) => (positive ? "+" : "-");
        // At the depth of the point at the view's center when it opens.
        const [px, py, pz] = (camera?.offset ?? [0, 0, 0]).map((v) => -v);
        const depth = `((${px})*cos(phi())*cos(theta())-(${py})*sin(phi())*cos(theta())+(${pz})*sin(theta()))`;
        return `[${a}*sin(phi())-${b}*cos(phi())*sin(theta())+${depth}*cos(phi())*cos(theta())${sign([2, 3, 6, 7].includes(n))}${wide},${a}*cos(phi())+${b}*sin(phi())*sin(theta())-${depth}*sin(phi())*cos(theta())${sign([3, 4, 7, 8].includes(n))}${wide},${b}*cos(theta())+${depth}*sin(theta())${sign(n > 4)}${high}]`;
    };
    const styledView = view3D ?? view;
    if (!is3D && coordSystem)
        push(null, "SetCoords", [
            literal(origin[0]),
            literal(origin[1]),
            literal(unit),
            { type: "literal", value: false },
            literal(Number(attribute(view!, "size", "width") ?? 0)),
            literal(Number(attribute(view!, "size", "height") ?? 0)),
            ...(yUnit === unit ? [] : [literal(yUnit)]),
        ]);
    const coordsStyle = (styledView: Element, spaceView = is3D): string => {
        const axesColor = child(styledView, "axesColor");
        const axes = attribute(styledView, "evSettings", "axes") === "true";
        const grid = attribute(styledView, "evSettings", "grid") === "true";
        const axis = (id: string) =>
            [...styledView.children].find(
                (item) =>
                    item.tagName === "axis" && item.getAttribute("id") === id,
            );
        const shown = (spaceView ? ["0", "1", "2"] : ["0", "1"]).filter(
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
        const graduations = (spaceView ? ["X", "Y", "Z"] : ["X", "Y"])
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
        // In 3D, its plate, colored axes across its clipping box, and the
        // graphics view beside it.
        const spaceStyle = `;isOz:${shown.includes("2")};isFloor:${attribute(styledView, "plate", "show") !== "false"};fontSize:${numbers};onlyPositive:${positive}${graduations};geogebraAxes:true;boxSize:${boxSize};viewInset:${inset.join(",")}`;
        const planeStyle = spaceView
            ? spaceStyle
            : `;axisWidth:${bold ? 2 : 1};fontSize:${numbers};onlyPositive:${positive}${graduations};arrows:${arrows};boldNumbers:${Boolean(labelStyle & 1)};geogebraAxes:true${gridStyle}`;
        return `isAxis:${axes || (grid && !spaceView)};isGrid:${grid};isOx:${shown.includes("0")};isOy:${shown.includes("1")}${
            axesColor && !spaceView ? `;color:${hexColor(axesColor)}` : ""
        }${planeStyle}`;
    };
    if (styledView) {
        push(null, "SetCoordsStyle", [literal(coordsStyle(styledView))]);
        // GeoGebra's shown clipping box: its gray edges.
        if (is3D && attribute(styledView, "clipping", "show") === "true") {
            const corners = [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
                formulaPoint(boxCorner(n)!),
            );
            [
                [1, 2],
                [1, 4],
                [1, 5],
                [3, 4],
                [3, 2],
                [3, 7],
                [6, 5],
                [6, 7],
                [6, 2],
                [8, 7],
                [8, 5],
                [8, 4],
            ].forEach(([from, to]) =>
                define(
                    auxiliary(),
                    "line",
                    "Segment",
                    [ref(corners[from - 1]), ref(corners[to - 1])],
                    "c:#808080;s:0.5;nmi:true",
                ),
            );
        }
    }
    // The second graphics view beside the first: two columns, as wide as
    // they are in GeoGebra, the right one with its own coordinate system,
    // style and background. Beside the 3D view, the plane view is the
    // second, then given its width in pixels and moved to the left if it's
    // there (see importGgb).
    const right = plane
        ? view
        : second === "beside"
          ? secondFirst
              ? (graphicsView(1) ?? document.querySelector("euclidianView")!)
              : graphicsView(2)!
          : null;
    if (view && right) {
        const width = (element: Element) =>
            Number(attribute(element, "size", "width")) || 1;
        const share = plane ? 0.5 : width(view) / (width(view) + width(right));
        const coords = child(right, "coordSystem");
        const number = (name: string, fallback: number) =>
            Number(coords?.getAttribute(name) ?? fallback);
        const color = child(right, "bgColor");
        push(null, "View", [0, share].map(literal));
        push(null, "View", [
            ...[
                1,
                1 - share,
                number("xZero", 0),
                number("yZero", 0),
                number("scale", 50),
                number("yscale", number("scale", 50)),
            ].map(literal),
            literal(
                `${plane ? `${coordsStyle(right, false)};isPlane:true` : coordsStyle(right)}${color ? `;background:${hexColor(color)}` : ""}`,
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
        // A complex number is a point.
        const point = (part: string): boolean =>
            part.includes("⊙") ||
            (part.match(LABEL_WORDS) ?? []).some(
                (word) => word === "ί" || is(word, POINT_KINDS),
            );
        // An item of a list of points is a point.
        for (let match; (match = INNERMOST.exec(rest));)
            rest = `${rest.slice(0, match.index)}${
                (!match[1] && (/[,;]/.test(match[2]) || point(match[2]))) ||
                (match[1]?.trim() === "Element" &&
                    pointLists.has(match[2].split(",")[0].trim()))
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
        // A line x = c or y = c of the plane.
        const [, variable, c] =
            (!is3D && /^([xy]) ?= ?(-?\d+(?:\.\d+)?)$/.exec(text)) || [];
        const k = Number(c);
        const axis =
            AXES[text] ??
            (variable && (variable === "x" ? [0, 1, 0] : [1, 0, 0]));
        if (axis) {
            const start: Vec3 =
                variable === "x" ? [k, 0, 0] : variable ? [0, k, 0] : [0, 0, 0];
            const [origin, tip] = [start, vAdd(start, axis)].map((coords) => {
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
        BINDING_COMMANDS.has(name) || formulaInputs.has(name)
            ? sources
            : sources.map(resolve);

    // GeoGebra reads a command's name whatever its case: "mean".
    const names = new Map(
        Object.keys(HANDLERS).map((name) => [name.toLowerCase(), name]),
    );
    construction.querySelectorAll("command").forEach((node) => {
        const name = names.get(node.getAttribute("name")!.toLowerCase());
        if (name) node.setAttribute("name", name);
    });

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
            const result = child(node, "output")?.getAttribute("randomResult");
            const random =
                result && RANDOM_LIST.test(`${name}(${sources})`)
                    ? result
                    : undefined;
            const list =
                random ??
                (LIST_COMMANDS.has(name) ||
                (name === "Sequence" && sources.length < 3)
                    ? `${name}(${sources.join(",")})`
                    : undefined);
            const element = elements.get(outputs[0]);
            // An image of a Sequence, maybe an image of images: the
            // Sequence of its items' images.
            const imageOf = (text: string): string[] | null => {
                const call = commandCall(normalizeBrackets(text));
                const loop =
                    call && TRANSFORMS.includes(call[0])
                        ? imageOf(call[1][0])
                        : null;
                return loop
                    ? [
                          `${call![0]}(${[loop[0], ...call![1].slice(1)]})`,
                          ...loop.slice(1),
                      ]
                    : (sequences.get(text.trim()) ?? null);
            };
            const sequence =
                TRANSFORMS.includes(name) && imageOf(`${name}(${sources})`);
            // Without any output, GeoGebra failed to evaluate the command:
            // it builds nothing.
            if (
                outputs.some(Boolean) &&
                !(list && element
                    ? defineList(
                          outputs[0],
                          element,
                          list,
                          random && seed
                              ? `${name}(${sources.join(",")})`
                              : undefined,
                      )
                    : sequence
                      ? HANDLERS.Sequence(sequence, outputs)
                      : handler?.(inputs(name, sources), outputs)) &&
                !scriptCommand(name, sources, outputs, random)
            )
                unsupported.push(`${name}(${sources.join(", ")})`);
            // GeoGebra draws the border of a polygon only without sides of
            // its own: with them, hidden or not, its sides are its border.
            else if (
                element?.getAttribute("type")?.startsWith("polygon") &&
                objects.has(outputs[0]) &&
                outputs.some((output) =>
                    elements
                        .get(output)
                        ?.getAttribute("type")
                        ?.startsWith("segment"),
                )
            )
                push(null, "STL", [ref(outputs[0]), literal("s:0")]);
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
    if (
        [...construction.querySelectorAll("ggbscript")].some((script) =>
            /UpdateConstruction/.test(script.getAttribute("val") ?? ""),
        ) &&
        [...construction.querySelectorAll("command, expression")].some((node) =>
            RANDOM_LIST.test(
                node.tagName === "command"
                    ? `${node.getAttribute("name")}(${indexedAttributes(child(node, "input"))})`
                    : (node.getAttribute("exp") ?? ""),
            ),
        )
    )
        seed = hiddenExpression("0");
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
        // But the variable a Sequence binds, which may be named as an
        // object.
        const name = node.getAttribute("name") ?? "";
        const inputs = indexedAttributes(child(node, "input"));
        const bound = BINDING_COMMANDS.has(name)
            ? inputs[name === "CurveCartesian" ? inputs.length - 3 : 1]
            : undefined;
        // Not its own name (f(x) = …): what reads it would wait for the
        // end, then translated in the file's order.
        const reads = (
            source.replace(/"[^"]*"/g, "").match(LABEL_WORDS) ?? []
        ).filter(
            (word) =>
                (elements.has(word) || commandOutputs.has(word)) &&
                !translated.has(word) &&
                word !== bound &&
                word !== label,
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

    // A script's statement for a value, as Blockly writes it, so that it
    // opens as blocks: for an If, in its branches.
    const branched = (
        value: string,
        statement: (value: string) => string | null,
    ): string | null => {
        const text = normalizeBrackets(value.trim());
        const call = COMMAND_EXPRESSION.exec(text);
        const args = call?.[1] === "If" ? splitArguments(call[2]) : null;
        if (!args || args.length < 2) return statement(text);
        const condition = formula(args[0], VALUE_KINDS);
        const then = branched(args[1], statement);
        const otherwise =
            args.length === 2
                ? ""
                : branched(
                      args.length === 3
                          ? args[2]
                          : `If(${args.slice(2).join(",")})`,
                      statement,
                  );
        if (condition === null || then === null || otherwise === null)
            return null;
        if (!then) return otherwise && `if (!(${condition})) {${otherwise}}`;
        return `if (${condition}) {${then}}${otherwise && ` else {${otherwise}}`}`;
    };

    // GeoGebra's script setting `target` to `value`.
    const setValue = (target: string, value: string): string | null =>
        branched(value, (text) => {
            if (text === target) return "";
            const content = formula(text, VALUE_KINDS);
            return (
                content &&
                `${objects.get(target)!.variable}.setExpression(${content});`
            );
        });

    // SetVisibleInView(object, view, shown) of an object, or of an axis
    // in the 3D view.
    const showInView = (
        object: string,
        view: string,
        shown: string,
    ): string | null => {
        const condition = formula(shown, VALUE_KINDS);
        const axis = AXIS_NAME.exec(object)?.slice(1).join("");
        if (condition === null) return null;
        if (axis && view === "-1" && is3D)
            return `SHOW_AXIS(${"XYZ".indexOf(axis.toUpperCase())},${condition});`;
        return objects.has(object) && (view === "1" || view === "-1")
            ? `${objects.get(object)!.variable}.setHidden(!(${condition}));`
            : null;
    };

    // StartAnimation(n) of a slider increasing once, from its value to its
    // maximum: GeoGebra's speed runs through its range in 10 s at 1. The
    // script goes on meanwhile, so that its program steps them all at its
    // end.
    const animationStep = (label: string): [string, string] | null => {
        const element = elements.get(label);
        if (!element) return null;
        const animation = child(element, "animation");
        const [low, high, speed] = [
            attribute(element, "slider", "min"),
            attribute(element, "slider", "max"),
            animation?.getAttribute("speed") ?? "1",
        ].map(Number);
        if (
            animation?.getAttribute("type") !== "3" ||
            ![low, high, speed].every(Number.isFinite)
        )
            return null;
        const n = objects.get(label)!.variable;
        const step = +(
            ((high - low) * speed * ANIMATION_FRAME) /
            10000
        ).toPrecision(12);
        return [
            `${n} < ${high}`,
            `${n}.setExpression(min(${n} + ${step}, ${high}));`,
        ];
    };

    // A style method called on each object a GeoGebra object is drawn as.
    const styled = (label: string, method: string, args: string[]): string =>
        (parts.get(label) ?? [label])
            .map(
                (part) =>
                    `${objects.get(part)!.variable}.${method}(${args.join(",")});`,
            )
            .join("");

    // SetColor's color: a name, "#RRGGBB" or "#AARRGGBB", whose alpha is
    // the object's filling.
    const colorStatement = (label: string, text: string): string | null => {
        const name = /^"?([\w# ]+)"?$/.exec(text)?.[1];
        const hex = name?.startsWith("#")
            ? name.slice(1)
            : COLOR_NAMES.get(name?.toLowerCase().replace(/ /g, "") ?? "");
        if (!hex || !/^([\dA-F]{2})?[\dA-F]{6}$/i.test(hex)) return null;
        const channels = hex
            .slice(-6)
            .match(/../g)!
            .map((channel) => String(parseInt(channel, 16)));
        return `${styled(label, "setRGBColor", channels)}${
            hex.length === 8
                ? styled(label, "setOpacity", [
                      String(+(parseInt(hex.slice(0, 2), 16) / 255).toFixed(3)),
                  ])
                : ""
        }`;
    };

    // Its lines, each a SetValue, an assignment or an UpdateConstruction,
    // which draws the random objects again by changing the seed, if there
    // is one.
    // "#" starts a comment.
    // A button's own program may change its caption, the button being
    // defined after it under its label.
    const scriptProgram = (source: string, button?: string): string | null => {
        const started: [string, string][] = [];
        const line = (source: string): string | null => {
            // A label typed sol_a stands for sol_{a}, as in GeoGebra.
            const text = normalizeBrackets(
                source.trim().replace(/;$/, ""),
            ).replace(QUOTED_WORDS, (word) => {
                const braced = word.replace(/_([^{].*)$/, "_{$1}");
                return objects.has(word) || !objects.has(braced)
                    ? word
                    : braced;
            });
            if (!text || text.startsWith("#")) return "";
            // A StartAnimation stepped at the program's end, not in a branch.
            return branched(text, (part) => command(part, part === text));
        };
        const command = (text: string, top: boolean): string | null => {
            // The view a script's next commands are about: there is one.
            if (/^UpdateConstruction\(\s*\)$/.test(text))
                return seed ? `${seed}.setExpression(random());` : "";
            if (/^(?:SetActiveView\(.*\)|ZoomIn\(\s*1\s*\))$/.test(text))
                return "";
            const call = COMMAND_EXPRESSION.exec(text);
            const args = call && splitArguments(call[2])?.map((a) => a.trim());
            // Its commands, written in constant strings.
            if (call?.[1] === "Execute") {
                const strings = /^\{\s*("[^"]*"\s*(?:,\s*"[^"]*"\s*)*)\}$/.exec(
                    call[2].trim(),
                );
                const lines = strings?.[1]
                    .match(/"[^"]*"/g)!
                    .map((string) => line(string.slice(1, -1)));
                return lines && !lines.includes(null) ? lines.join("\n") : null;
            }
            const [object, setting] = args ?? [];
            const style =
                args &&
                objects.has(object) &&
                {
                    ShowLabel: "setShowName",
                    SetFilling: "setOpacity",
                    SetLineThickness: "setSize",
                    SetPointSize: "setSize",
                }[call[1]];
            if (style && args.length === 2) {
                const content = formula(
                    call[1] === "SetLineThickness"
                        ? `(${setting}) / 2`
                        : setting,
                    VALUE_KINDS,
                );
                return content && styled(object, style, [content]);
            }
            if (call?.[1] === "SetColor" && args && objects.has(object)) {
                if (args.length === 2)
                    return branched(setting, (color) =>
                        colorStatement(object, color),
                    );
                const channels = args
                    .slice(1)
                    .map((channel) => formula(`255 (${channel})`, VALUE_KINDS));
                return channels.length === 3 && !channels.includes(null)
                    ? styled(object, "setRGBColor", channels as string[])
                    : null;
            }
            // A slider increasing once, stepped by the program. Another
            // animated object, slider or point on an object, its last
            // argument telling whether it plays.
            if (call?.[1] === "StartAnimation" && args) {
                const step = top && animationStep(call[2].trim());
                if (step) {
                    started.push(step);
                    return "";
                }
                const animatable = (label: string) =>
                    is(label, ["pointOn"]) ||
                    (is(label, ["expression"]) &&
                        !!child(elements.get(label)!, "slider"));
                const playing =
                    args.length > 1 && !animatable(args.at(-1)!)
                        ? args.pop()!
                        : "true";
                const condition = formula(playing, VALUE_KINDS);
                if (condition === null || !args.every(animatable)) return null;
                args.forEach((label) => {
                    if (!animations.has(objects.get(label)!.variable))
                        animate(label, true);
                });
                return args
                    .map((label) => styled(label, "setAnimated", [condition]))
                    .join("");
            }
            // Toward a point, the view looks along the line through it from
            // its side nearest the camera.
            if (call?.[1] === "SetViewDirection")
                return args?.length === 1
                    ? branched(args[0], (value) => {
                          const direction = isPoint(value)
                              ? formula(value, VALUE_KINDS)
                              : null;
                          return direction && `VIEW_DIRECTION(${direction});`;
                      })
                    : null;
            // The graphics view's grid, the view (1) being the only one.
            if (call?.[1] === "ShowGrid") {
                const shown = args?.at(-1) || "true";
                const condition =
                    (args?.length ?? 0) < 3 && formula(shown, VALUE_KINDS);
                return condition ? `SHOW_GRID(${condition});` : null;
            }
            if (call?.[1] === "CenterView")
                return args?.length === 1
                    ? branched(args[0], (value) => {
                          const center = isPoint(value)
                              ? formula(value, VALUE_KINDS)
                              : null;
                          return center && `CENTER_VIEW(${center});`;
                      })
                    : null;
            // A point's trace, as GeoGebra's: copies of the point.
            if (call?.[1] === "SetTrace") {
                const shown =
                    args?.length === 2 && formula(setting, VALUE_KINDS);
                if (!shown || !is(object, POINT_KINDS)) return null;
                push(null, "STL", [ref(object), literal("tp:true")]);
                return styled(object, "setTrace", [shown]);
            }
            if (call?.[1] === "SetCaption") {
                const variable =
                    objects.get(object)?.variable ??
                    (object === button ? object : undefined);
                const text =
                    args?.length === 2 && formula(setting, VALUE_KINDS);
                return variable && text
                    ? `${variable}.setCaption(${text});`
                    : null;
            }
            // A view moved by nothing, which only erases the traces.
            if (call?.[1] === "Pan")
                return args?.every((value) => Number(value) === 0)
                    ? "CLEAR_TRACES();"
                    : null;
            // The view's, the figure having one, of channels from 0 to 1 or
            // of a color's name.
            if (call?.[1] === "SetBackgroundColor") {
                const name =
                    args?.length === 1 && /^"([\w ]+)"$/.exec(object)?.[1];
                const hex =
                    name &&
                    COLOR_NAMES.get(name.toLowerCase().replace(/ /g, ""));
                const channels = hex
                    ? hex
                          .match(/../g)!
                          .map((channel) => String(parseInt(channel, 16)))
                    : args?.length === 3 && !objects.has(object)
                      ? args.map((channel) =>
                            formula(`255 (${channel})`, VALUE_KINDS),
                        )
                      : null;
                return channels && !channels.includes(null)
                    ? `BACKGROUND(${channels.join(",")});`
                    : null;
            }
            if (call?.[1] === "SetVisibleInView")
                return args?.length === 3
                    ? showInView(args[0], args[1], args[2])
                    : null;
            if (call?.[1] === "SetCoords")
                return args &&
                    args.length === (is3D ? 4 : 3) &&
                    is(args[0], POINT_KINDS)
                    ? setValue(args[0], `(${args.slice(1).join(",")})`)
                    : null;
            const [target, value] =
                (call?.[1] === "SetValue" ? args : null) ??
                /^([^=:!<>(]+?)\s*:?=(?!=)(.+)$/.exec(text)?.slice(1) ??
                [];
            if (value === undefined) return null;
            const label = target.trim();
            // SetValue moves a point, draws a random number again, and
            // changes nothing else that depends on others; an assignment
            // redefines it.
            const source = expressions.get(label);
            if (
                call &&
                is(label, ["expression"]) &&
                !/random/i.test(definitions.get(label) ?? "") &&
                (commandOutputs.has(label) ||
                    (source !== undefined && formula(source, []) === null))
            )
                return "";
            return is(label, ["expression", ...(call ? POINT_KINDS : [])])
                ? setValue(label, value)
                : null;
        };
        const statements = source.split("\n").map(line);
        // Blockly has no imaginary unit: a DGP formula multiplies points as
        // complex numbers.
        if (started.length)
            statements.push(
                `while (${started.map(([test]) => test).join(" || ")}) {\n${started.map(([, update]) => update).join("\n")}\nWAIT(${ANIMATION_FRAME});\n}`,
            );
        return statements.includes(null)
            ? null
            : statements
                  .join("\n")
                  .split('"')
                  .map((part, index) =>
                      index % 2
                          ? part
                          : part.replace(WORDS, (name) =>
                                name === "i" ? "[0,1]" : name,
                            ),
                  )
                  .join('"');
    };

    // An update script runs once a number has changed, as DGPad's
    // "onchange", once a free point or a point on an object is dragged or
    // animated, and once another point has moved, as the "onchange" of a
    // hidden number of its coordinates.
    const updateScript = (label: string, program: string | null): boolean => {
        if (!program) return program === "";
        const source = expressions.get(label);
        const free =
            is(label, ["pointOn"]) ||
            (is(label, ["point"]) &&
                !commandOutputs.has(label) &&
                (source === undefined || NUMERIC_TUPLE.test(source)));
        const variable = objects.get(label)?.variable;
        const owner =
            free || is(label, ["expression"])
                ? variable
                : is(label, POINT_KINDS) && hiddenExpression(variable!);
        if (!owner) return false;
        push(null, "BLK", [
            { type: "reference", name: owner },
            literal(
                JSON.stringify({
                    [free ? "ondrag" : "onchange"]: { sync: program },
                }),
            ),
        ]);
        return true;
    };

    // A click script, run when a button, a text, a point or a shape is
    // clicked, and an update script are translated: a button keeps its
    // place in the window. The other scripts aren't.
    elements.forEach((element, label) => {
        const scripts = [...element.children].filter(
            (item) =>
                item.tagName === "ggbscript" || item.tagName === "javascript",
        );
        if (!scripts.length) return;
        const [script] = scripts;
        const type = element.getAttribute("type");
        const click = script.getAttribute("val") || null;
        // GeoGebra runs a boolean's update script before it updates what
        // depends on it, whose values are still those for its opposite.
        const update = script.getAttribute("onUpdate") ?? "";
        const read =
            type === "boolean"
                ? update.replace(LABEL_WORDS, (word, at: number) => {
                      const source = definitions.get(word);
                      // Not what a command sets.
                      return word !== label &&
                          !/Set\w+[([]\s*$/.test(update.slice(0, at)) &&
                          source?.match(LABEL_WORDS)?.includes(label)
                          ? `(${source.replace(LABEL_WORDS, (name) => (name === label ? `(¬${label})` : name))})`
                          : word;
                  })
                : update;
        const program =
            scripts.length === 1 &&
            script.tagName === "ggbscript" &&
            [...script.attributes].every(
                ({ name }) => name === "val" || name === "onUpdate",
            ) &&
            (click === null || type === "button" || is(label, CLICKED))
                ? scriptProgram(
                      click ?? "",
                      type === "button" && IDENTIFIER.test(label)
                          ? label
                          : undefined,
                  )
                : null;
        if (program === null || !updateScript(label, scriptProgram(read)))
            return void unsupported.push(`script ${label}`);
        if (type !== "button") {
            if (program)
                push(null, "BLK", [
                    ref(label),
                    literal(JSON.stringify({ onmousedown: { sync: program } })),
                ]);
            return;
        }
        const offset = child(element, "labelOffset");
        const height = Number(attribute(element, "dimensions", "height") ?? 0);
        // Its "size" is an offset from the application's font size, of
        // which "sizeM" is the factor.
        const font = Math.max(
            1,
            Math.min(
                fontSize * Number(attribute(element, "font", "sizeM") ?? 1),
                height ? height - 20 : Infinity,
            ),
        );
        const text = caption(element, label);
        // DocGeo's width (see button_object.ts).
        const context = (
            $.create("canvas").dom() as HTMLCanvasElement
        ).getContext("2d")!;
        context.font = `500 ${font}px system-ui,sans-serif`;
        const width = Math.max(40, context.measureText(text).width + 56);
        const [x, y] = screenPosition(
            Number(offset?.getAttribute("x") ?? 0) + width,
            Number(offset?.getAttribute("y") ?? 0) +
                (height || Math.max(40, font + 20)) / 2,
            true,
        );
        const color = child(element, "objColor");
        const background = child(element, "bgColor");
        define(
            label,
            "button",
            "BlocklyButton",
            [text, String(x), String(y), ...(program ? [program] : [])].map(
                literal,
            ),
            [
                ...(color ? [`c:${hexColor(color)}`] : []),
                ...(background ? [`fc:${hexColor(background)}`, "o:1"] : []),
                `f:${font}`,
                ...(hidden(element) ? ["h:1"] : []),
            ].join(";"),
        );
    });

    // Once every object exists, since a condition may read a later one. It
    // then decides alone whether the object is shown, whatever its show
    // flag (see GeoElement.isEuclidianVisible), except for a number without
    // a slider, which is never drawn, and a solid, drawn by its faces.
    const conditions = new Map<string, string | null>();
    elements.forEach((element, label) => {
        const source = attribute(element, "condition", "showObject");
        const drawn = parts.get(label) ?? [label];
        const type = element.getAttribute("type");
        if (
            source === undefined ||
            outOfView(element) ||
            !objects.has(drawn[0]) ||
            type === "polyhedron" ||
            (type === "numeric" && !child(element, "slider"))
        )
            return;
        if (!conditions.has(source)) {
            const content = formula(source, VALUE_KINDS);
            if (content === null) {
                unsupported.push(`condition ${source}`);
                conditions.set(source, null);
            } else
                conditions.set(
                    source,
                    // A checkbox or a number, itself.
                    is(source, ["expression"])
                        ? objects.get(source)!.variable
                        : hiddenExpression(content),
                );
        }
        const condition = conditions.get(source);
        if (condition)
            drawn.forEach((part) => {
                const branch = branchTests.get(part);
                push(null, "STL", [
                    ref(part),
                    literal(
                        `h:0;sc:${branch ? hiddenExpression(`(${branch})&&(${condition})`) : condition}`,
                    ),
                ]);
            });
    });

    // GeoGebra's dynamic colors in RGB, which may read later objects: a
    // constant one is a static color.
    elements.forEach((element, label) => {
        const color = child(element, "objColor");
        const drawn = parts.get(label) ?? [label];
        if (
            !color?.hasAttribute("dynamicr") ||
            (color.getAttribute("colorSpace") ?? "0") !== "0" ||
            !objects.has(drawn[0])
        )
            return;
        const channels = ["r", "g", "b"].map((channel) =>
            formula(color.getAttribute(`dynamic${channel}`)!, VALUE_KINDS),
        );
        if (channels.includes(null)) return unsupported.push(`color ${label}`);
        const style = channels.every((channel) => isConstant(channel!))
            ? `c:#${channels
                  .map((channel) => {
                      const t = Math.abs(evaluateConstant(channel!)!) % 2;
                      return Math.floor((t > 1 ? 2 - t : t) * 255)
                          .toString(16)
                          .padStart(2, "0");
                  })
                  .join("")}`
            : `rgb:${hiddenExpression(`[${channels}]`)}`;
        drawn.forEach((part) => push(null, "STL", [ref(part), literal(style)]));
    });

    // What only the second graphics view shows is drawn in its view, what
    // both show in both.
    elements.forEach((element, label) => {
        const drawn = parts.get(label) ?? [label];
        const view = inSecond(element)
            ? "vw:1"
            : inBoth(element)
              ? "vws:1"
              : null;
        if (view && objects.has(drawn[0]))
            drawn.forEach((part) =>
                push(null, "STL", [ref(part), literal(view)]),
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

    // GeoGebra's CAS view, if its window shows it: a text cell in quotes, a
    // cell kept as typed or computed numerically as GeoGebra's.
    if (shownView("8"))
        construction
            .querySelectorAll(":scope > cascell")
            .forEach((cell, row) => {
                const input = cell.querySelector("inputCell > expression");
                const typed = input?.getAttribute("value") ?? "";
                const line = cell.querySelector("useAsText")
                    ? `"${typed.replace(/"/g, "'")}"`
                    : casLine(
                          typed,
                          input?.getAttribute("eval") ?? typed,
                          input?.getAttribute("evalCmd") === "KeepInput",
                      );
                if (line === null) unsupported.push(`cascell ${typed}`);
                else casRows.set(row + 1, casLines.push(line));
            });
    // In place of the CAS view, or of the algebra view showing the Suite's
    // rows, as wide.
    const casView = ["8", "2"].find(shownView);
    const casAt = casView && location(casView);
    const mainAt = location(is3D ? "512" : second === "alone" ? "16" : "1");
    const cas = casLines.length
        ? {
              lines: casLines,
              width: Number(
                  document
                      .querySelector(`gui view[id="${casView}"]`)
                      ?.getAttribute("size") ?? 300,
              ),
              first:
                  !!casAt &&
                  !!mainAt &&
                  ["0", "3"].includes(
                      casAt.find((digit, index) => digit !== mainAt[index]) ??
                          "",
                  ),
          }
        : undefined;

    return {
        cas,
        calls,
        targets,
        handles,
        follows,
        nameShifts,
        menus,
        animations,
        rates,
        startAnimation:
            document
                .querySelector("kernel > startAnimation")
                ?.getAttribute("val") === "true",
        unsupported,
        nested,
        is3D,
        view3D: camera,
    };
}
