import type { DgpCall, DgpValue } from "./dgp_parser";
import type { Vec3 } from "../vec";

// A CaRMetal figure (.zir, see CaRMetal's rene/zirkel sources) translated
// into DGP commands, run by the same engine as DGPad's.

export interface ZirImage {
    url: string;
    width: number;
    height: number;
}

// CaRMetal's palette (ZirkelFrame.DefaultColors), and its names.
const COLOR_NAMES = ["black", "green", "blue", "brown", "cyan", "red"];
const COLORS = [
    "#000000",
    "#007c00",
    "#0000b2",
    "#966400",
    "#007c7c",
    "#b40000",
];
// DGP's point shapes: 0 circle, 1 cross, 2 diamond, 3 square.
const SHAPES: Record<string, number> = {
    circle: 0,
    dot: 0,
    cross: 1,
    dcross: 1,
    diamond: 2,
    square: 3,
};
// A name between quotes is an object's that isn't an identifier ("A'").
const TOKEN =
    /\s*(\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+|[\p{L}_][\p{L}\p{N}_]*|"[^"]*"|&&|\|\||<=|>=|==|~=|!=|\S)/guy;
const OPERATORS: Record<string, string> = {
    "=": "==",
    "&": "&&",
    "|": "||",
};
const LOGIC = new Set(["&&", "||", "&", "|"]);
// CaRMetal's conditional styles that hide an object, or that its style
// variants draw.
const HIDDEN = new Set(["hidden", "superhidden"]);
const STYLED = new Set([...COLOR_NAMES, "thick", "thin", "normal"]);
const COMPARISONS = new Set(["<", "<=", ">", ">=", "==", "=", "~=", "!="]);
const STOPS = new Set([",", ")", "!"]);
const SAME = new Set(
    "sin cos tan sqrt exp log round floor ceil abs min max d x y".split(" "),
);
// CaRMetal's window: its center, its half width, its whole height, and the
// pixels of a unit.
const WINDOW = new Map([
    ["windowcx", "windowcx()"],
    ["windowcy", "windowcy()"],
    ["windoww", "(windoww()/2)"],
    ["windowh", "windowh()"],
    ["pixel", "pixel()"],
]);

// The DGP commands of what a point can be attracted to.
const MAGNETS = new Set(
    "Point PointOn MidPoint OrderedIntersection Line Ray Segment Vector Parallel Perpendicular Circle Circle1 Circle3 Quadric Curvus".split(
        " ",
    ),
);
const POINTS = new Set(["Point", "PointOn", "MidPoint", "OrderedIntersection"]);
// DGP's function names, which a variable can't take.
const RESERVED = new Set(
    "i k count x y e pi PI sqrt d sin cos tan asin acos atan atan2 abs floor ceil round exp log min max mod gcd random arg perp cross dot distance conj isNaN pixel windoww windowh windowcx windowcy theta phi rotate dilate".split(
        " ",
    ),
);
// Numerical analysis, as in the GeoGebra import: Simpson's intervals,
// and the samples of a root or an extremum, refined by bisection or
// ternary search.
const SIMPSON_INTERVALS = 1000;
const SAMPLES = 200;
const REFINEMENTS = 60;

export class Unsupported extends Error {}

interface Scope {
    refs: (name: string) => string | undefined;
    // The variables of the functions, which formulas call.
    functions: Set<string>;
    // A hidden expression computed by a script, read by its variable.
    script: (code: string) => string;
    // The center of a circle, by their variables.
    centers: Map<string, string>;
}

// CaRMetal's expression, in degrees as a DGPad figure, with its objects'
// variables, or null if it uses what DGP can't compute.
function formula(
    source: string,
    scope: Scope,
    variable = "",
    as = "x",
): string | null {
    // "@A", an object's name, as "A".
    const tokens = [...source.replace(/@/g, "").matchAll(TOKEN)].map(
        (match) => match[1],
    );
    let i = 0;
    const named = variable.split(" ");
    const call = (name: string, args: string[]): string => {
        // An empty argument, the object named "".
        const unnamed = scope.refs("");
        if (unnamed) args = args.map((arg) => arg || unnamed);
        // A vector's coordinates are its components, not its length's.
        if (name === "x" || name === "y")
            args = args.map((arg) => arg.replace(/^mod\(([^()]*)\)$/, "$1"));
        const [a, b, c] = args.map((arg) => `(${arg})`);
        const own = scope.refs(name);
        if (own && scope.functions.has(own)) return `${own}(${args.join(",")})`;
        const f = scope.functions.has(args[0]) ? args[0] : null;
        if (f && name === "diff") return `${f}'(${args[1]})`;
        if (f && name === "integrate")
            return scope.script(
                `var $h=(${c}-${b})/${SIMPSON_INTERVALS},$s=${f}(${b})+${f}(${c}),$n;for($n=1;$n<${SIMPSON_INTERVALS};$n++){$s+=(2+2*($n%2))*${f}(${b}+$n*$h)};$s*$h/3`,
            );
        if (f && name === "zero")
            return scope.script(
                `var $u=${b},$v=${c},$p=${f}($u),$w,$j;for($j=0;$j<${REFINEMENTS};$j++){$w=($u+$v)/2;if(${f}($w)*$p>0){$u=$w}else{$v=$w}};($u+$v)/2`,
            );
        // Where f is the least or the greatest between a and b.
        if (f && (name === "min" || name === "max")) {
            const better = name === "min" ? "<" : ">";
            return scope.script(
                `var $h=(${c}-${b})/${SAMPLES},$m=${b},$n,$u,$v,$p,$q;for($n=1;$n<=${SAMPLES};$n++){if(${f}(${b}+$n*$h)${better}${f}($m)){$m=${b}+$n*$h}};$u=max(${b},$m-$h);$v=min(${c},$m+$h);for($n=0;$n<${REFINEMENTS};$n++){$p=$u+($v-$u)/3;$q=$v-($v-$u)/3;if(${f}($p)${better}${f}($q)){$v=$q}else{$u=$p}};($u+$v)/2`,
            );
        }
        if (SAME.has(name)) return `${name}(${args.join(",")})`;
        if (/^arc(sin|cos|tan)$/.test(name)) return `a${name.slice(3)}${a}`;
        if (/^r(sin|cos|tan)$/.test(name))
            return `${name.slice(1)}(${a}*180/PI)`;
        if (/^rarc(sin|cos|tan)$/.test(name))
            return `(a${name.slice(4)}${a}*PI/180)`;
        switch (name) {
            case "a":
                return `Angle360(${args.join(",")})`;
            case "angle180":
                return `(${a}-360*floor((${a}+180)/360))`;
            case "angle360":
                return `(${a}-360*floor(${a}/360))`;
            case "if":
                return `(${a}?${b}:${c})`;
            case "sign":
                return `(${a}>0?1:${a}<0?-1:0)`;
            case "deg":
                return `(${a}*180/PI)`;
            // DGP's in radians, CaRMetal's in degrees.
            case "atan2":
                return `(atan2(${args.join(",")})*180/PI)`;
            case "ratan2":
                return `atan2(${args.join(",")})`;
            case "rad":
                return `(${a}*PI/180)`;
            case "sinhyp":
                return `((exp${a}-exp(-${a}))/2)`;
            case "coshyp":
                return `((exp${a}+exp(-${a}))/2)`;
            case "tanhyp":
                return `((exp${a}-exp(-${a}))/(exp${a}+exp(-${a})))`;
            case "Argsinh":
                return `log(${a}+sqrt(${a}^2+1))`;
            case "Argcosh":
                return `log(${a}+sqrt(${a}^2-1))`;
            case "Argtanh":
                return `(log((1+${a})/(1-${a}))/2)`;
        }
        // Drawn again at each computation; with a condition, only when it
        // holds, which DGP can't keep.
        if (name === "random" && args.length === 1) return `(${a}*random())`;
        const center = scope.centers.get(args[1]);
        if (name === "inside" && center)
            return `(distance(${args[0]},${center})<${args[1]}?1:0)`;
        throw new Unsupported(name);
    };
    const objectRef = (name: string): string => {
        const ref = scope.refs(name);
        if (!ref) throw new Unsupported(name);
        return ref;
    };
    // As CaRMetal's precedence: "!" applies to a comparison, which applies
    // to sums, and "~=" is equal within 1e-10.
    const sequence = (): string => {
        let out = negation();
        while (LOGIC.has(tokens[i]))
            out += (OPERATORS[tokens[i++]] ?? tokens[i - 1]) + negation();
        return out;
    };
    const negation = (): string => {
        if (tokens[i] !== "!") return comparison();
        i++;
        return `!(${negation()})`;
    };
    const comparison = (): string => {
        const left = sum();
        if (!COMPARISONS.has(tokens[i])) return left;
        const operator = tokens[i++];
        const right = sum();
        return operator === "~="
            ? `(abs((${left})-(${right}))<1e-10)`
            : `((${left})${OPERATORS[operator] ?? operator}(${right}))`;
    };
    const sum = (): string => {
        let out = "";
        while (
            i < tokens.length &&
            !STOPS.has(tokens[i]) &&
            !LOGIC.has(tokens[i]) &&
            !COMPARISONS.has(tokens[i])
        ) {
            const token = tokens[i++];
            if (token === "(") {
                out += `(${sequence()})`;
                if (tokens[i++] !== ")") throw new Unsupported(source);
            } else if (/^[\p{L}_]/u.test(token)) {
                if (tokens[i] === "(") {
                    i++;
                    const args = [sequence()];
                    while (tokens[i] === ",") {
                        i++;
                        args.push(sequence());
                    }
                    if (tokens[i++] !== ")") throw new Unsupported(source);
                    // CaRMetal's memories: d(x) the change of x since the
                    // last computation, sum(x) the sum of x at each one,
                    // old(x) its previous value, as they are when the
                    // figure opens and at rest. Pinned points, which
                    // d(windoww) moves with the window, are pinned so.
                    if (token === "d" && args.length === 1) {
                        if (/window|pixel/.test(args[0]))
                            throw new Unsupported(token);
                        out += "0";
                    } else if (token === "sum") out += "0";
                    else if (token === "old") out += `(${args[0]})`;
                    else out += call(token, args);
                } else if (token === variable) out += as;
                // A function's variables x, y, z or t, as DGP's.
                else if (/^[xyzt]$/.test(token) && named.includes(token))
                    out += token;
                else if (token === "pi") out += "PI";
                else if (token === "invalid") out += "(0/0)";
                else if (WINDOW.has(token)) out += WINDOW.get(token);
                else out += objectRef(token);
            } else if (token.startsWith('"'))
                out += objectRef(token.slice(1, -1));
            else out += OPERATORS[token] ?? token;
        }
        return out;
    };
    try {
        const out = sequence();
        return i < tokens.length ? null : out;
    } catch (error) {
        if (error instanceof Unsupported) return null;
        throw error;
    }
}

const literal = (value: string | number | boolean): DgpValue => ({
    type: "literal",
    value,
});
// An offset of none.
const origin: DgpValue = {
    type: "array",
    items: [literal(0), literal(0)],
};
const ref = (name: string): DgpValue => ({ type: "reference", name });

const quote = (text: string) => `"${text.replace(/[\\"]/g, "\\$&")}"`;

// CaRMetal's LaTeX as KaTeX's: \mbox as \text, the braces CaRMetal
// tolerates unclosed closed.
const katex = (text: string) =>
    text
        .replace(/\\mbox\b/g, "\\text")
        // "^-^1", "_k_-_1": CaRMetal's "^{-1}", "_{k-1}".
        .replace(
            /([_^])[^{\\\s](?:\1[^{\\\s])+/g,
            (run, mark) => `${mark}{${run.split(mark).join("")}}`,
        ) +
    "}".repeat(Math.max(0, text.split("{").length - text.split("}").length));
// A LaTeX text as a DGP string.
const latex = (text: string) => quote(katex(text).replace(/\$/g, ""));

// A line of text with LaTeX between "$" and formulas between "%" (their
// sources in parts' odd items) as one LaTeX formula, its text in \textsf
// (KaTeX writes "≠" only in math).
function mixedLatex(parts: string[]): string {
    let math = false;
    const sans = (text: string) =>
        `\\textsf{${text
            .replace(/[\\{}#%&_~^]/g, (c) =>
                /[~^\\]/.test(c) ? `\\char${c.charCodeAt(0)}` : `\\${c}`,
            )
            .replace(/[≠≤≥±×÷∞→⇒∈∉⊂∩∪]/g, "}$&\\textsf{")}}`;
    return `""${parts
        .map((part, index) =>
            index % 2
                ? math
                    ? `+(${part})`
                    : `+"\\\\textsf{"+(${part})+"}"`
                : part
                      .split("$")
                      .map((piece, k) => {
                          if (k) math = !math;
                          return `+${quote(math ? katex(piece) : sans(piece))}`;
                      })
                      .join(""),
        )
        .join("")}`;
}

const escape = (text: string) =>
    text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

// Without CaRMetal's unclosed tags ("<Preferences<Windowdim …/>"), which
// the XML parser would stop at, and the attributes it writes twice, which
// it rejects.
export function parseZir(xml: string): Document {
    return new DOMParser().parseFromString(
        xml.replace(/<\w+(?=<)/g, "").replace(/<\w+[^<>]*>/g, (tag) => {
            const seen = new Set<string>();
            return tag.replace(/\s([\w.]+)="[^"]*"/g, (attribute, name) =>
                seen.has(name) ? "" : (seen.add(name), attribute),
            );
        }),
        "application/xml",
    );
}

export function translateZir(
    doc: Document,
    images: Map<string, ZirImage>,
    width: number,
    height: number,
): {
    calls: DgpCall[];
    targets: Map<string, Vec3>;
    unsupported: string[];
    menuScripts: { name: string; program: string | Unsupported }[];
} {
    const calls: DgpCall[] = [];
    const targets = new Map<string, Vec3>();
    const unsupported = new Set<string>();
    const variables = new Map<string, string>();
    // The DGP command of each object, by name.
    const commands = new Map<string, string>();
    // Where each point is, for the texts placed at one.
    const places = new Map<string, [number, number]>();
    // The measures of the oriented angles, by name.
    const oriented = new Map<string, string>();
    const panels: DgpCall[] = [];
    const attr = (element: Element, name: string) => element.getAttribute(name);
    const num = (element: Element, name: string, fallback = 0) =>
        Number(attr(element, name) ?? fallback);

    const push = (variable: string | null, name: string, args: DgpValue[]) =>
        calls.push({ variable, name, arguments: args, line: calls.length + 1 });

    const view = doc.querySelector("Construction > Window");
    const dim = doc.querySelector("Construction > Windowdim");
    if (!(width > 0 && height > 0)) {
        width = dim ? num(dim, "w") : 800;
        height = dim ? num(dim, "h") : 600;
    }
    const unit = width / (2 * (view ? num(view, "w", 8) : 8));
    const ox = width / 2 - (view ? num(view, "x") : 0) * unit;
    const oy = height / 2 + (view ? num(view, "y") : 0) * unit;
    push(null, "SetCoords", [ox, oy, unit, false, width, height].map(literal));
    const grid = view?.getAttribute("showgrid") === "true";
    push(null, "SetCoordsStyle", [literal(`isAxis:${grid};isGrid:${grid}`)]);
    const world = (px: number, py: number) => [
        String((px - ox) / unit),
        String((oy - py) / unit),
    ];
    const pixel = (x: number, y: number): [number, number] => [
        ox + x * unit,
        oy - y * unit,
    ];
    // A control, placed in pixels of the window the figure was saved in, at
    // the same place of the figure in this one.
    const [savedWidth, savedHeight] = dim
        ? [num(dim, "w"), num(dim, "h")]
        : [width, height];
    const placed = (px: number, py: number): [number, number] => [
        width / 2 + ((px - savedWidth / 2) * width) / savedWidth,
        height / 2 + ((py - savedHeight / 2) * width) / savedWidth,
    ];
    const preferences = doc.querySelector("Construction > Preferences");
    const digits = (kind: string) =>
        preferences?.getAttribute(`digits.${kind}`) ??
        (kind === "edit" ? "4" : "2");
    const fontSize = Number(preferences?.getAttribute("minfontsize") ?? 12);
    const pointSize = Number(preferences?.getAttribute("minpointsize") ?? 3);
    const background = preferences?.getAttribute("colorbackground");
    const backdrop = (background ?? "255,255,255")
        .split(",")
        .filter(Boolean)
        .map(Number);
    if (background)
        push(null, "SetGeneralStyle", [
            literal(`background-color:${hex(background)}`),
        ]);

    // Its ctag and cexpr attributes, CaRMetal's conditional styles.
    const conditional = (element: Element): Attr[] =>
        [...element.attributes].filter(({ name }) =>
            /^c(tag|expr)\d+$/.test(name),
        );
    // The conditions of its ctags of these values.
    const hiding = (element: Element, values: Set<string>): string[] =>
        [...element.attributes].flatMap(({ name, value }) =>
            /^ctag\d+$/.test(name) && values.has(value)
                ? [attr(element, `cexpr${name.slice(4)}`)!]
                : [],
        );
    const names = new Set(
        [...doc.querySelectorAll("Construction > Objects > [name]")].map(
            (element) => attr(element, "name")!,
        ),
    );
    const define = (
        element: Element,
        command: string,
        args: DgpValue[],
        style = "",
        // Objects drawn with it, styled and hidden as it is.
        companions: string[] = [],
    ): string => {
        const name = attr(element, "name")!;
        // Not "$…", as the helpers' variables: a text's "%…%" names it.
        const variable =
            /^[A-Za-z_]\w*$/.test(name) && !RESERVED.has(name)
                ? name
                : `_${calls.length}_`;
        variables.set(name, variable);
        commands.set(name, command);
        // Shown by its alias, if no other object has that name.
        const alias = attr(element, "alias");
        const shown =
            alias && /^[A-Za-z_]\w*'*$/.test(alias) && !names.has(alias)
                ? alias
                : name;
        names.add(shown);
        push(variable, command, [literal(shown), ...args]);
        const labelled =
            alias !== null &&
            shown !== alias &&
            attr(element, "showname") === "true";
        const full =
            styleOf(element, command) + style + (labelled ? ";lb:false" : "");
        if (full)
            [variable, ...companions].forEach((object) =>
                push(null, "STL", [
                    ref(object),
                    literal(full.replace(/^;/, "")),
                ]),
            );
        const label =
            labelled && attr(element, "hidden") === null
                ? aliasLabel(element, variable, command, alias)
                : undefined;
        // Hidden while a condition holds, with its label, or while one of
        // its style variants is drawn: shown while 1.
        const conditions = [
            ...hiding(element, HIDDEN),
            ...hiding(element, STYLED),
        ];
        const hidden =
            conditions.length > 0 &&
            formula(conditions.map((c) => `(${c})`).join("||"), scope);
        if (hidden) {
            const shown = scope.script(`(${hidden})?0:1`);
            [variable, label, ...companions].forEach(
                (object) =>
                    object &&
                    push(null, "STL", [ref(object), literal(`sc:${shown}`)]),
            );
        }
        return variable;
    };
    // Without a prompt, CaRMetal shows only its value: as a string's, if
    // no other object computes with it.
    const referenced = (name: string): boolean =>
        [...doc.querySelectorAll("Construction > Objects > *")].some(
            (element) =>
                attr(element, "name") !== name &&
                [...element.attributes].some(({ value }) =>
                    new RegExp(
                        `(^|\\W)${name.replace(/\W/g, "\\$&")}($|\\W)`,
                    ).test(value),
                ),
        );
    // A hidden point at these coordinates, a DGP formula.
    const hiddenPoint = (coords: string): string => {
        const point = `$${calls.length}`;
        push(point, "Point", [literal(""), literal(coords), literal("0")]);
        push(null, "STL", [ref(point), literal("h:2")]);
        return point;
    };
    // An alias another object's name takes, or that isn't a name, as a
    // text at the place of the object's label: by a point, or by the middle
    // of a segment.
    const aliasLabel = (
        element: Element,
        variable: string,
        command: string,
        alias: string,
    ): string | undefined => {
        let anchor = variable;
        if (!POINTS.has(command)) {
            const ends = objects(element, "from", "to");
            if (!ends) return;
            anchor = `$${calls.length}`;
            push(anchor, "MidPoint", [literal(""), ...ends]);
            push(null, "STL", [ref(anchor), literal("h:2")]);
        }
        // As CaRMetal: kept close, in the offset's direction, just clear
        // of the point (drawPointLabel); otherwise at the offset, below
        // right.
        const [xc, yc] = [num(element, "xcoffset"), num(element, "ycoffset")];
        const d = Math.hypot(xc, yc);
        const [ux, uy, width, gap] = [
            xc / d,
            yc / d,
            alias.length * fontSize * 0.6,
            2 * pointSize,
        ];
        let extent = Math.max(
            Math.abs(width * ux + fontSize * uy),
            Math.abs(-width * ux + fontSize * uy),
        );
        if (Math.abs(extent * uy) > fontSize + 2 * gap)
            extent = Math.abs((fontSize + 2 * gap) / uy);
        const reach = extent / 2 + 1.5 * gap;
        const [dx, dy] =
            attr(element, "keepclose") === "true" && d > 1e-10
                ? [ux * reach - width / 2, -uy * reach + fontSize * 0.35]
                : [
                      xc * unit + 2 * pointSize,
                      -yc * unit + 2 * pointSize + fontSize * 0.8,
                  ];
        const text = `$${calls.length}`;
        // In LaTeX after a "$".
        const tex = alias.trimStart().startsWith("$");
        push(
            text,
            tex ? "ExpressionOn" : "AnchoredText",
            tex
                ? [
                      ...["", "", "", ""].map(literal),
                      literal(latex(alias)),
                      ref(anchor),
                      { type: "array", items: [literal(dx), literal(dy)] },
                  ]
                : [
                      literal(""),
                      ref(anchor),
                      literal(dx),
                      literal(dy),
                      literal(alias.replace(/%/g, "%%")),
                  ],
        );
        push(null, "STL", [
            ref(text),
            literal(
                `c:${color(element)};f:${fontSize}${tex ? ";tx:true" : ""}`,
            ),
        ]);
        return text;
    };
    const scope: Scope = {
        centers: new Map(),
        // A vector, as its length; an oriented angle, as its measure.
        refs: (name) =>
            commands.get(name) === "Vector"
                ? `mod(${variables.get(name)})`
                : (oriented.get(name) ?? variables.get(name)),
        functions: new Set(),
        script: (code) => {
            const variable = `$${calls.length}`;
            push(
                variable,
                "Expression",
                ["", "", "", "", code, "0", "0"].map(literal),
            );
            push(null, "STL", [ref(variable), literal("h:2")]);
            return variable;
        },
    };
    const points = (element: Element, ...names: string[]) =>
        names.map((name) => attr(element, name));
    // The objects' references, or null if one wasn't imported.
    const objects = (
        element: Element,
        ...names: string[]
    ): DgpValue[] | null => {
        const found = points(element, ...names).map((name) =>
            name === null ? undefined : variables.get(name),
        );
        return found.every(Boolean) ? found.map((name) => ref(name!)) : null;
    };
    const panel = (
        html: string,
        x: number,
        y: number,
        w: number,
        h: number,
        style = "",
    ) =>
        panels.push({
            variable: null,
            name: "Text",
            arguments: [
                literal(html),
                literal(x),
                literal(y),
                literal(w),
                literal(h),
                literal(`c:rgba(0,0,0,0);s:0${style}`),
            ],
            line: 0,
        });
    const label = (element: Element, text: string, x: number, y: number) => {
        const lines = text.split("\n");
        const [px, py] = pixel(x, y);
        panel(
            `<div style="color:${color(element)}">${lines.map(escape).join("<br>")}</div>`,
            px,
            py - 20,
            Math.max(...lines.map((line) => line.length)) * 9 + 20,
            lines.length * 22 + 10,
        );
    };

    // CaRMetal's controls, each setting its expression.
    const controls = new Map<string, Element>();
    doc.querySelectorAll("Construction > *").forEach((element) => {
        if (element.tagName.startsWith("CTRL"))
            controls.set(attr(element, "Ename")!, element);
    });
    // The scripts run as an object moves or a button is pressed, and the
    // texts they read or change, whose content is a hidden expression.
    const dynamicScripts = [...doc.querySelectorAll("CaR > Script")].filter(
        (script) =>
            attr(script, "onload") === "true" || attr(script, "mousedrag"),
    );
    const scriptTexts = new Set(
        dynamicScripts.flatMap((script) =>
            [
                ...script.textContent!.matchAll(
                    /\b[SG]etText\s*\(\s*"([^"]*)"/g,
                ),
            ].map(([, name]) => name),
        ),
    );
    const textContents = new Map<string, string>();
    // A free point at a fixed distance from another, set by a segment.
    const fixedSegments = new Map<string, Element>();
    doc.querySelectorAll("Construction > Objects > Segment[fixed]").forEach(
        (segment) => fixedSegments.set(attr(segment, "to")!, segment),
    );

    const translateObject = (element: Element): void => {
        const tag = element.tagName;
        const name = attr(element, "name")!;
        const translate = (source: string, variable?: string) =>
            formula(source, scope, variable);
        const axis = attr(element, "xaxis") ?? attr(element, "yaxis");
        if (tag === "Line" && axis === "true") {
            define(element, attr(element, "xaxis") ? "X_axis" : "Y_axis", []);
            return;
        }
        let args: DgpValue[] | null;
        switch (tag) {
            case "Point": {
                const [x, y] = [num(element, "x"), num(element, "y")];
                if (attr(element, "actx") === null) {
                    places.set(name, [x, y]);
                    const segment = fixedSegments.get(name);
                    const from = segment && objects(segment, "from");
                    if (from) {
                        const circle = `$${calls.length}`;
                        push(circle, "Circle1", [
                            literal(""),
                            ...from,
                            literal(num(segment!, "fixed")),
                        ]);
                        push(null, "STL", [ref(circle), literal("h:2")]);
                        targets.set(
                            define(element, "PointOn", [
                                ref(circle),
                                literal(0),
                            ]),
                            [x, y, 0],
                        );
                        return;
                    }
                    define(
                        element,
                        "Point",
                        [literal(x), literal(y)],
                        attr(element, "fixed") === "true" ? ";fl:true" : "",
                    );
                    return;
                }
                const [ax, ay] = [num(element, "actx"), num(element, "acty")];
                places.set(name, [ax, ay]);
                const [fx, fy] = points(element, "x", "y").map((source) =>
                    translate(source!),
                );
                if (fx !== null && fy !== null) {
                    define(element, "Point", [
                        literal(`[${fx},${fy}]`),
                        literal("0"),
                    ]);
                    return;
                }
                // One of its coordinates its own, as "x(A)": it moves along the
                // line the other one gives.
                const own = ["x", "y"].map(
                    (axis) =>
                        attr(element, axis)!.replace(/\s/g, "") ===
                        `${axis}(${name})`,
                );
                const other = own[0] ? fy : fx;
                if (own[0] !== own[1] && other !== null) {
                    const ends = [0, 1].map((k) =>
                        ref(
                            hiddenPoint(
                                own[0] ? `[${k},${other}]` : `[${other},${k}]`,
                            ),
                        ),
                    );
                    const line = `$${calls.length}`;
                    push(line, "Line", [literal(""), ...ends]);
                    push(null, "STL", [ref(line), literal("h:2")]);
                    targets.set(
                        define(element, "PointOn", [ref(line), literal(0)]),
                        [ax, ay, 0],
                    );
                    return;
                }
                // Its own coordinates (a style variant's, of the name it
                // copies): a point kept in place on the screen.
                const self = new RegExp(`\\b${name.replace(/#\d*$/, "")}\\b`);
                if (!points(element, "x", "y").some((xy) => self.test(xy!)))
                    unsupported.add(`CaRMetal: Point ${name}`);
                define(
                    element,
                    "Point",
                    [literal(ax), literal(ay)],
                    ";fl:true",
                );
                return;
            }
            case "PointOn": {
                if (!(args = objects(element, "on"))) break;
                // On a polygon, CaRMetal's are on its sides.
                const support = commands.get(attr(element, "on")!);
                const polygon = support === "Polygon";
                // DGP's parameter on a polygon or a conic is a pair.
                const point = define(
                    element,
                    "PointOn",
                    [
                        ...args,
                        polygon || support === "Quadric" ? origin : literal(0),
                    ],
                    polygon ? ";sb:true" : "",
                );
                targets.set(point, [num(element, "x"), num(element, "y"), 0]);
                places.set(name, [num(element, "x"), num(element, "y")]);
                return;
            }
            case "Midpoint":
                if (!(args = objects(element, "first", "second"))) break;
                define(element, "MidPoint", args);
                return;
            case "Intersection":
            case "OtherIntersection": {
                if (!(args = objects(element, "first", "second"))) break;
                // CaRMetal projects it on each object in turn, from where it
                // was: with a polygon, on the side the other object follows,
                // where it can be dragged.
                const polygon = ["first", "second"].findIndex(
                    (key) => commands.get(attr(element, key)!) === "Polygon",
                );
                if (polygon !== -1) {
                    targets.set(
                        define(element, "PointOn", [
                            args[1 - polygon],
                            literal(0),
                        ]),
                        [num(element, "x"), num(element, "y"), 0],
                    );
                    return;
                }
                // The one farther from that point.
                const away = objects(element, "awayfrom");
                if (away) {
                    define(element, "OrderedIntersection", [
                        ...args,
                        literal(0),
                        ...away,
                    ]);
                    return;
                }
                // Of two circles, CaRMetal's first is on DGP's second side.
                const circles = ["first", "second"].every((key) =>
                    /^(Circle|Arc)/.test(commands.get(attr(element, key)!)!),
                );
                const point = define(element, "OrderedIntersection", [
                    ...args,
                    literal(
                        Number(attr(element, "which") === "second") ^
                            Number(circles),
                    ),
                ]);
                // Followed from there, as CaRMetal does.
                if (attr(element, "x") !== null)
                    targets.set(point, [
                        num(element, "x"),
                        num(element, "y"),
                        0,
                    ]);
                return;
            }
            case "Line":
            case "Ray":
            case "Segment":
                if (!(args = objects(element, "from", "to"))) break;
                define(
                    element,
                    attr(element, "arrow") === "true" ? "Vector" : tag,
                    args,
                );
                return;
            case "Parallel":
            case "Plumb":
                if (!(args = objects(element, "line", "point"))) break;
                define(element, tag === "Plumb" ? "Perpendicular" : tag, args);
                return;
            case "Circle": {
                const through = attr(element, "through");
                if (through === null) {
                    const radius = translate(attr(element, "fixed") ?? "");
                    if (
                        radius === null ||
                        !(args = objects(element, "midpoint"))
                    )
                        break;
                    scope.centers.set(
                        define(element, "Circle1", [
                            ...args,
                            /^[\d.]+$/.test(radius)
                                ? literal(Number(radius))
                                : literal(radius),
                        ]),
                        (args[0] as { name: string }).name,
                    );
                    return;
                }
                if (attr(element, "start") !== null) {
                    if (!(args = objects(element, "midpoint", "start", "end")))
                        break;
                    // The smaller arc, through its middle: counterclockwise
                    // from start to end if not over a half turn (CaRMetal's
                    // option, without "acute", false by default).
                    const [m, a, b] = args.map(
                        (arg) => (arg as { name: string }).name,
                    );
                    const [ax, ay, bx, by] = [a, b].flatMap((p) =>
                        ["x", "y"].map((c) => `(${c}(${p})-${c}(${m}))`),
                    );
                    const turn = `atan2(${ax}*${by}-${ay}*${bx},${ax}*${bx}+${ay}*${by})`;
                    const half = scope.script(
                        `(${turn}>-PI+1e-10?${turn}:${turn}+2*PI)*90/PI`,
                    );
                    const middle = hiddenPoint(
                        `[x(${m})+${ax}*cos(${half})-${ay}*sin(${half}),y(${m})+${ax}*sin(${half})+${ay}*cos(${half})]`,
                    );
                    define(element, "Arc3pts", [args[1], ref(middle), args[2]]);
                    return;
                }
                if (!(args = objects(element, "midpoint", "through"))) break;
                scope.centers.set(
                    define(element, "Circle", args),
                    (args[0] as { name: string }).name,
                );
                return;
            }
            case "Circle3":
                if (!(args = objects(element, "from", "to", "midpoint"))) break;
                define(element, "Circle3", args);
                return;
            case "Angle": {
                const fixed = attr(element, "fixed");
                if (fixed === null) {
                    if (!(args = objects(element, "first", "root", "second")))
                        break;
                    define(element, "Angle", args);
                    // Without "acute", from 0 to 360°, DGP's to 180°.
                    if (attr(element, "acute") !== "true")
                        oriented.set(
                            attr(element, "name")!,
                            `Angle360(${["first", "root", "second"].map((key) => variables.get(attr(element, key)!)).join(",")})`,
                        );
                    return;
                }
                const angle = translate(fixed);
                if (
                    angle === null ||
                    !(args = objects(element, "first", "root"))
                )
                    break;
                define(element, "FixedAngle", [
                    ...args,
                    literal(angle),
                    literal(true),
                ]);
                return;
            }
            case "Polygon": {
                const vertices = [...element.attributes]
                    .filter((a) => /^point\d+$/.test(a.name))
                    .map((a) => variables.get(a.value));
                if (!vertices.every(Boolean)) break;
                // Of fewer than three vertices, CaRMetal draws nothing.
                if (vertices.length < 3) return;
                define(element, "Polygon", [
                    literal(vertices.map((v) => `_${v}`).join(",")),
                ]);
                return;
            }
            case "Quadric":
                if (
                    !(args = objects(
                        element,
                        "point1",
                        "point2",
                        "point3",
                        "point4",
                        "point5",
                    ))
                )
                    break;
                define(element, "Quadric", args);
                return;
            case "Track":
                if (!(args = objects(element, "track", "point"))) break;
                define(element, "Locus", args);
                return;
            case "Function": {
                const variable = attr(element, "var") ?? "x";
                const f = attr(element, "f");
                // A user function, shown as its definition.
                if (f !== null) {
                    const body = translate(f, variable);
                    if (body === null) break;
                    scope.functions.add(
                        define(
                            element,
                            "Expression",
                            ["", "", "", body, "0", "0"].map(literal),
                            ";h:1",
                        ),
                    );
                    const at = /^x\((\w+)\)$/.exec(attr(element, "x") ?? "");
                    const [x, y] = at
                        ? (places.get(at[1]) ?? [0, 0])
                        : [num(element, "x"), num(element, "y")];
                    label(element, element.textContent!, x, y);
                    return;
                }
                // Only its points, every d, each drawn as a point.
                if (attr(element, "special") === "true") {
                    const [fx, fy, min, max, step] = [
                        "x",
                        "y",
                        "min",
                        "max",
                        "d",
                    ].map((a) =>
                        formula(attr(element, a) ?? "", scope, variable, "$t"),
                    );
                    if ([fx, fy, min, max, step].includes(null)) break;
                    define(element, "Sequence", [
                        literal("point"),
                        literal(JSON.stringify([["$t", min, max, step]])),
                        literal(JSON.stringify([`[${fx},${fy}]`])),
                    ]);
                    return;
                }
                let [fx, fy, min, max] = ["x", "y", "min", "max"].map((a) =>
                    translate(attr(element, a) ?? "", variable),
                );
                if ([fx, fy, min, max].includes(null)) break;
                // CaRMetal joins its values every d by segments.
                const [from, to] = [Number(min), Number(max)].sort(
                    (a, b) => a - b,
                );
                const step = Math.max(
                    Math.abs(num(element, "d", 0)),
                    (to - from) / 1000,
                );
                const steps = step > 0 ? Math.round((to - from) / step) : 1000;
                // A parametric one, as the locus of its point as t, a point
                // on a hidden segment, goes from min to max.
                if (fx !== "x") {
                    const ends = [min, max].map((bound) =>
                        hiddenPoint(`[${bound},0]`),
                    );
                    const segment = `$${calls.length}`;
                    push(segment, "Segment", [literal(""), ...ends.map(ref)]);
                    push(null, "STL", [ref(segment), literal("h:2")]);
                    const driver = `$${calls.length}`;
                    push(driver, "PointOn", [
                        literal(""),
                        ref(segment),
                        literal(0),
                    ]);
                    push(null, "STL", [ref(driver), literal("h:2")]);
                    const [x, y] = ["x", "y"].map((a) =>
                        formula(
                            attr(element, a)!,
                            scope,
                            variable,
                            `x(${driver})`,
                        ),
                    );
                    define(element, "Locus", [
                        ref(hiddenPoint(`[${x},${y}]`)),
                        ref(driver),
                    ]);
                    push(null, "STL", [
                        ref(variables.get(name)!),
                        literal(`p:${steps + 1}`),
                    ]);
                    return;
                }
                // A few values make a broken line (t==1 ? … : … at t = 0,
                // 1, 2), its vertices joined as t goes between them.
                if (steps < 100) {
                    const k = `min(floor((x-(${from}))/${step}),${steps - 1})`;
                    const s = `((x-(${from}))/${step}-${k})`;
                    const at = (shift: number) =>
                        formula(
                            attr(element, "y")!,
                            scope,
                            variable,
                            `(${from}+(${k}+${shift})*${step})`,
                        );
                    fy = `(${at(0)})*(1-${s})+(${at(1)})*${s}`;
                }
                scope.functions.add(
                    define(element, "Curvus", [
                        literal(min!),
                        literal(max!),
                        literal(fy!),
                    ]),
                );
                return;
            }
            // At its top left corner in the figure, with the values of the
            // formulas between "%", in LaTeX between "$".
            case "Text": {
                const text = element.textContent!;
                // Its formulas between "%", or none if one can't be computed.
                const content = (text: string) => {
                    const parts = text.split("%");
                    const values = parts.map((part, index) =>
                        index % 2 ? translate(part) : part,
                    );
                    return parts.length % 2 === 0 || values.includes(null)
                        ? [text]
                        : values;
                };
                // At a place a formula may give, as by a point.
                const at = ["x", "y"].map((a) => translate(attr(element, a)!));
                if (at.includes(null)) break;
                const anchor = ref(hiddenPoint(`[${at}]`));
                if (scriptTexts.has(name) && !/[%$]/.test(text)) {
                    const content = `_${calls.length}_`;
                    push(
                        content,
                        "Expression",
                        ["", "", "", "", quote(text), "0", "0"].map(literal),
                    );
                    push(null, "STL", [ref(content), literal("h:2")]);
                    textContents.set(name, content);
                    define(
                        element,
                        "AnchoredText",
                        [
                            anchor,
                            literal(0),
                            literal(fontSize),
                            literal(`%${content}%`),
                        ],
                        `;f:${fontSize}`,
                    );
                    return;
                }
                if (/^\s*\$[^]*\$\s*$/.test(text)) {
                    define(
                        element,
                        "ExpressionOn",
                        [
                            ...["", "", ""].map(literal),
                            literal(
                                `""${content(text)
                                    .map((value, index) =>
                                        index % 2
                                            ? `+(${value})`
                                            : `+${latex(value!)}`,
                                    )
                                    .join("")}`,
                            ),
                            anchor,
                            origin,
                        ],
                        `;f:${fontSize};tx:true`,
                    );
                    return;
                }
                // A line after "*" is bold, after "**" large, after "***"
                // both: the large ones as texts of their own, as those with
                // LaTeX between "$", in LaTeX.
                const runs: { lines: string[]; size: number; tex: boolean }[] =
                    [];
                text.split("\n").forEach((line) => {
                    const stars = /^\**/.exec(line)![0].length;
                    const size =
                        stars >= 2 ? Math.round(fontSize * 1.3) : fontSize;
                    line = line.slice(Math.min(stars, 3));
                    // Its last "$" unclosed, closed at its end.
                    if (line.split("$").length % 2 === 0) line += "$";
                    const tex = /\$[^$]+\$/.test(line);
                    const run = runs.at(-1);
                    if (run?.size === size && !run.tex && !tex)
                        run.lines.push(line);
                    else runs.push({ lines: [line], size, tex });
                });
                let dy = 0;
                const texts = runs.map(({ lines, size, tex }) => {
                    dy += size * (dy ? 1.5 : 1);
                    const parts = content(lines.join("\n"));
                    const args = tex
                        ? [
                              ...["", "", ""].map(literal),
                              literal(mixedLatex(parts as string[])),
                              anchor,
                              {
                                  type: "array",
                                  items: [literal(0), literal(dy - size)],
                              } as DgpValue,
                          ]
                        : [
                              anchor,
                              literal(0),
                              literal(dy),
                              literal(
                                  parts
                                      .map((value, index) =>
                                          index % 2
                                              ? value
                                              : value!.replace(/%/g, "%%"),
                                      )
                                      .join("%"),
                              ),
                          ];
                    dy += (lines.length - 1) * size * 1.5;
                    return {
                        command: tex ? "ExpressionOn" : "AnchoredText",
                        args,
                        style: `;f:${size}${tex ? ";tx:true" : ""}`,
                    };
                });
                const companions = texts.slice(1).map(({ command, args }) => {
                    const variable = `$${calls.length}`;
                    push(variable, command, [literal(""), ...args]);
                    return variable;
                });
                define(
                    element,
                    texts[0].command,
                    texts[0].args,
                    texts[0].style,
                    companions,
                );
                companions.forEach((variable, index) =>
                    push(null, "STL", [
                        ref(variable),
                        literal(texts[index + 1].style.slice(1)),
                    ]),
                );
                return;
            }
            case "Expression": {
                const value = translate(attr(element, "value") ?? "0");
                if (value === null) break;
                const control = controls.get(name);
                const kind = control?.tagName;
                if (
                    control &&
                    (kind === "CTRLslider" || kind === "CTRLcheckbox")
                ) {
                    const slider = kind === "CTRLslider";
                    const shown = attr(control, "showC") === "true";
                    define(
                        element,
                        "Expression",
                        [
                            shown ? attr(control, "C")! : "",
                            slider ? attr(control, "min")! : "",
                            slider ? attr(control, "max")! : "",
                            attr(control, "V") ?? value,
                            ...world(
                                ...placed(
                                    num(control, "x"),
                                    num(control, "y") + num(control, "h") / 2,
                                ),
                            ),
                        ].map(literal),
                        slider
                            ? `;h:0;p:${attr(control, "showV") === "true" ? digits("lengths") : -1};i:${num(control, "T", 0) || 0.01};cL:${num(control, "w")}`
                            : ";h:0;cB:true",
                    );
                    return;
                }
                const slider = attr(element, "slider") === "true";
                const [min, max] = ["min", "max"].map((bound) =>
                    slider ? translate(attr(element, bound)!) : "",
                );
                if (min === null || max === null) break;
                const prompt = attr(element, "prompt") ?? "";
                // Its LaTeX caption, which only a text shows.
                const tex = prompt.includes("$");
                // At a place a formula gives, as by a point.
                const [x, y] = ["x", "y"].map((a) => attr(element, a) ?? "0");
                const at = [x, y].some((c) => !isFinite(Number(c)))
                    ? [x, y].map((c) => translate(c))
                    : null;
                if (at?.includes(null)) break;
                const anchor = at && ref(hiddenPoint(`[${at}]`));
                const variable = define(
                    element,
                    at ? "ExpressionOn" : "Expression",
                    [
                        ...[
                            tex ? "" : prompt && `${prompt} = `,
                            min,
                            max,
                            control
                                ? (attr(control, "V") ?? value)
                                : prompt === "" && !referenced(name)
                                  ? `""+(${value})`
                                  : value,
                        ].map(literal),
                        ...(at ? [anchor!, origin] : [literal(x), literal(y)]),
                    ],
                    tex ? ";h:2" : `;f:${fontSize}`,
                );
                if (control) controlPanel(control, variable);
                const scale = `1e${digits("edit")}`;
                if (anchor && tex && attr(element, "hidden") === null) {
                    const text = `$${calls.length}`;
                    push(text, "ExpressionOn", [
                        ...["", "", "", ""].map(literal),
                        literal(
                            `${latex(`${prompt} = `)}+round(${variable}*${scale})/${scale}`,
                        ),
                        anchor,
                        origin,
                    ]);
                    push(null, "STL", [
                        ref(text),
                        literal(`c:${color(element)};f:${fontSize};tx:true`),
                    ]);
                } else if (tex && attr(element, "hidden") === null) {
                    const [px, py] = pixel(
                        num(element, "x"),
                        num(element, "y"),
                    );
                    panel(
                        `<div style="color:${color(element)}">${escape(katex(prompt))} = %${variable}%</div>`,
                        px,
                        py - 20,
                        prompt.length * 9 + 80,
                        40,
                        `;p:${digits("edit")}`,
                    );
                }
                return;
            }
            case "Image": {
                const image = images.get(attr(element, "filename") ?? "");
                if (
                    !image ||
                    !(args = objects(element, "point1", "point2", "point3"))
                )
                    break;
                const [a, b, d] = args.map(
                    (arg) => (arg as { name: string }).name,
                );
                const corner = `$${calls.length}`;
                push(corner, "Point", [
                    literal(""),
                    literal(
                        `[x(${d})+x(${b})-x(${a}),y(${d})+y(${b})-y(${a})]`,
                    ),
                    literal("0"),
                ]);
                push(null, "STL", [ref(corner), literal("h:2")]);
                // GeoGebra's corners: bottom left, bottom right, top left.
                define(element, "Image", [
                    literal(image.url),
                    literal(image.width),
                    literal(image.height),
                    ref(d),
                    ref(corner),
                    ref(a),
                ]);
                return;
            }
        }
        unsupported.add(`CaRMetal: ${tag} ${name}`);
    };

    // A partial line, as CaRMetal draws it around its two points and beyond
    // them by a 20th of the window's width: its line hidden, and the
    // segment returned to be shown in its place.
    const partialLine = (element: Element): Element | null => {
        const ends = objects(element, "from", "to");
        if (element.tagName !== "Line" || !attr(element, "partial") || !ends)
            return null;
        const line = element.cloneNode(true) as Element;
        conditional(line).forEach(({ name }) => line.removeAttribute(name));
        line.setAttribute("hidden", "super");
        translateObject(line);
        const name = attr(element, "name")!;
        const [p, q] = ends.map((end) => (end as { name: string }).name);
        const segment = doc.createElementNS(null, "Segment");
        [...element.attributes].forEach(({ name, value }) =>
            segment.setAttribute(name, value),
        );
        [
            [p, q],
            [q, p],
        ].forEach(([a, b], index) => {
            const end = `${name}#${index}`;
            variables.set(
                end,
                hiddenPoint(
                    `[x(${a})+(x(${a})-x(${b}))/d(${a},${b})*windoww()/20,y(${a})+(y(${a})-y(${b}))/d(${a},${b})*windoww()/20]`,
                ),
            );
            segment.setAttribute(index ? "to" : "from", end);
        });
        segment.setAttribute("name", `${name}#`);
        return segment;
    };

    // CaRMetal's style while a condition holds ("green", "thick"…): a copy
    // of the object with that style, shown only then.
    const styleVariants = (element: Element): Element[] => {
        const changes = new Map<string, [string, string][]>();
        conditional(element).forEach(({ name, value }) => {
            const color = COLOR_NAMES.indexOf(value);
            const change: [string, string] | null =
                color >= 0
                    ? ["color", String(color)]
                    : ["thick", "thin", "normal"].includes(value)
                      ? ["type", value]
                      : null;
            const condition = attr(element, `cexpr${name.slice(4)}`)!;
            if (change)
                changes.set(condition, [
                    ...(changes.get(condition) ?? []),
                    change,
                ]);
        });
        // As CaRMetal, hidden while it should be, the first that applies
        // drawn.
        const hidden = hiding(element, HIDDEN);
        return [...changes].map(([condition, styles], index, all) => {
            const copy = element.cloneNode(true) as Element;
            conditional(copy).forEach(({ name }) => copy.removeAttribute(name));
            ["alias", "showname"].forEach((name) => copy.removeAttribute(name));
            styles.forEach(([key, value]) => {
                if (key === "color") copy.removeAttribute("scolor");
                if (value === "normal") copy.removeAttribute(key);
                else copy.setAttribute(key, value);
            });
            copy.setAttribute("name", `${attr(element, "name")}#${index}`);
            copy.setAttribute("ctag0", "hidden");
            copy.setAttribute(
                "cexpr0",
                [
                    `!(${condition})`,
                    ...hidden,
                    ...all.slice(0, index).map(([before]) => before),
                ]
                    .map((c) => `(${c})`)
                    .join("||"),
            );
            return copy;
        });
    };

    // The variants last: with "@", a condition names an object defined
    // later.
    const variants: Element[] = [];
    // Each object after those it names, as "@A" names a later one: a cycle
    // keeps CaRMetal's order.
    // An arc between two of its circle's intersections: the circle, hidden,
    // and the arc, after them.
    const arcs: Element[] = [];
    const elements = [
        ...doc.querySelectorAll("Construction > Objects > *"),
    ].map((element) => {
        const name = attr(element, "name")!;
        const cut = ["start", "end"].some((end) => {
            const point = doc.querySelector(
                `Construction > Objects > Intersection[name="${CSS.escape(attr(element, end) ?? "")}"]`,
            );
            return (
                point &&
                [attr(point, "first"), attr(point, "second")].includes(name)
            );
        });
        if (element.tagName !== "Circle" || !attr(element, "through") || !cut)
            return element;
        const arc = element.cloneNode(true) as Element;
        arc.setAttribute("name", `${name}#`);
        arcs.push(arc);
        const circle = element.cloneNode(true) as Element;
        ["start", "end"].forEach((end) => circle.removeAttribute(end));
        conditional(circle).forEach(({ name }) => circle.removeAttribute(name));
        circle.setAttribute("hidden", "super");
        return circle;
    });
    const byName = new Map(elements.map((e) => [attr(e, "name")!, e]));
    const ordered = new Set<Element>();
    const visiting = new Set<Element>();
    const visit = (element: Element) => {
        if (visiting.has(element)) return;
        visiting.add(element);
        [...element.attributes]
            .filter(
                ({ name }) =>
                    !/^(name|alias|prompt|n|color|scolor|type|shape|magnetobjs|ctag\d+|cexpr\d+)$/.test(
                        name,
                    ),
            )
            .forEach(({ name, value }) => {
                // An object may be named "".
                const unnamed = byName.get("");
                if (
                    value === "" &&
                    unnamed &&
                    /^(from|to|through|first|second|on|midpoint|point\d*|line)$/.test(
                        name,
                    )
                )
                    visit(unnamed);
                // "x(A)" calls CaRMetal's x, even with an object x.
                for (const [, quoted, name, call] of value.matchAll(
                    /[\d.]+(?:[eE]-?\d+)?|"([^"]*)"|([\p{L}_][\p{L}\p{N}_']*)\s*(\()?/gu,
                )) {
                    const named = quoted ?? name;
                    const dependency = named && byName.get(named);
                    if (
                        dependency &&
                        (!call || dependency.tagName === "Function")
                    )
                        visit(dependency);
                }
            });
        ordered.add(element);
    };
    elements.forEach(visit);
    ordered.forEach((element) => {
        const shown = partialLine(element) ?? element;
        translateObject(shown);
        variants.push(...styleVariants(shown));
    });
    arcs.forEach(translateObject);
    variants.forEach(translateObject);

    function controlPanel(control: Element, target: string): void {
        const caption =
            attr(control, "showC") === "true"
                ? escape(attr(control, "C")!)
                : "";
        const field =
            control.tagName === "CTRLpopup"
                ? `<select target="${target}">${attr(control, "Items")!
                      .split("@@@")
                      .map(
                          (item, index) =>
                              `<option value="${index + 1}">${escape(item)}</option>`,
                      )
                      .join("")}</select>`
                : control.tagName === "CTRLbutton"
                  ? `<input type="button" target="${target}" value="${escape(attr(control, "C")!)}">`
                  : `<input type="text" target="${target}" size="10">`;
        panel(
            `<div>${control.tagName === "CTRLbutton" ? "" : caption}${field}</div>`,
            ...placed(num(control, "x"), num(control, "y")),
            num(control, "w") + caption.length * 8 + 20,
            num(control, "h") + 10,
        );
        push(null, "STL", [ref(target), literal("h:2")]);
    }

    // Its own color, unless formulas give it ("R,,G,,B").
    function customColor(element: Element): string | null {
        const custom = attr(element, "scolor");
        return custom && /^[\d,]+$/.test(custom) ? custom : null;
    }

    function color(element: Element): string {
        const custom = customColor(element);
        return custom
            ? hex(custom)
            : (COLORS[num(element, "color")] ?? COLORS[0]);
    }

    // CaRMetal's light color: 40 % of its own, with the background's for
    // its palette, with white for a custom one.
    function lightColor(element: Element): string {
        const custom = customColor(element);
        const base = custom ? [255, 255, 255] : backdrop;
        return `#${(custom
            ? hex(custom)
            : (COLORS[num(element, "color")] ?? COLORS[0])
        )
            .slice(1)
            .match(/../g)!
            .map((c, i) =>
                Math.round(0.6 * base[i] + 0.4 * parseInt(c, 16))
                    .toString(16)
                    .padStart(2, "0"),
            )
            .join("")}`;
    }

    function styleOf(element: Element, command: string): string {
        // Thin, in its light color.
        const thin = attr(element, "type") === "thin";
        const style = [`c:${thin ? lightColor(element) : color(element)}`];
        const hidden = attr(element, "hidden");
        if (hidden === "super") style.push("h:2");
        else if (hidden === "true") style.push("h:1");
        const thick = attr(element, "type") === "thick";
        if (attr(element, "showvalue") === "true")
            style.push(
                `p:${digits(
                    command.endsWith("Angle")
                        ? "angles"
                        : command.startsWith("Expression")
                          ? "edit"
                          : "lengths",
                )}`,
            );
        if (POINTS.has(command)) {
            const shape = attr(element, "shape") ?? "square";
            style.push(
                shape === "invisible"
                    ? "s:0"
                    : `s:${shape === "dot" ? 1.5 : thick ? 5 : 4}`,
            );
            const increment = Number(attr(element, "increment"));
            if (increment > 0) style.push(`i:${increment}`);
            // Filled with its color, rather than white.
            if (thick || shape === "dot") style.push("o:1");
            if (shape in SHAPES) style.push(`sp:${SHAPES[shape]}`);
            if (attr(element, "showname") === "true") style.push("sn:true");
        } else if (command === "Sequence") {
            const shape = attr(element, "shape") ?? "square";
            style.push(`s:${thick ? 4 : 3}`, `sp:${SHAPES[shape] ?? 3}`);
        } else if (
            command === "Polygon" ||
            (/^Circle[13]?$/.test(command) &&
                attr(element, "filled") === "true")
        ) {
            // CaRMetal fills it with its color if thick, otherwise with its
            // light color (40 % of it) half transparent, unless solid, and
            // outlines it only if neither thick nor thin, or not filled.
            const type = attr(element, "type");
            style.push(
                attr(element, "filled") === "false"
                    ? `o:0;s:${thick ? 2.5 : 1}`
                    : `o:${thick ? 1 : attr(element, "solid") === "true" ? 0.4 : 0.2};s:${type === null ? 1 : 0}`,
            );
        } else if (command === "Angle" || command === "FixedAngle") {
            style.push(`o:${attr(element, "filled") === "true" ? 0.2 : 0}`);
            // CaRMetal's radius, but the one up to its first point.
            const display = attr(element, "display");
            if (display !== "large")
                style.push(
                    `arc:${12 * pointSize * (display === "small" || display === "rectangle" ? 0.5 : display === "larger" ? 2 : 1)}`,
                );
        } else if (
            command !== "Expression" &&
            command !== "ExpressionOn" &&
            command !== "Image" &&
            command !== "AnchoredText" &&
            command !== "Sequence"
        ) {
            style.push(`s:${thick ? 2.5 : 1}`);
            if (thin) style.push("ld:5,5");
            // Its marks, as GeoGebra's ticks.
            const code = Number(attr(element, "code_symbol"));
            if (code >= 1 && code <= 3) style.push(`dc:${code}`);
            if (attr(element, "showname") === "true") style.push("lb:true");
        }
        return style.join(";");
    }

    // A point animated along its segment, 2 pixels every `delay` ms, back
    // and forth.
    doc.querySelectorAll("Construction > Animate").forEach((element) => {
        const name = attr(element, "animate")!;
        const point = [
            ...doc.querySelectorAll("Construction > Objects > PointOn"),
        ].find((point) => attr(point, "name") === name);
        if (
            attr(element, "stopped") !== "true" &&
            point &&
            commands.get(attr(point, "on")!) === "Segment" &&
            variables.has(name)
        )
            push(null, "STL", [
                ref(variables.get(name)!),
                literal(`an:[${2000 / num(element, "delay", 50)},1,true]`),
            ]);
    });
    // Once the objects they attract to are all defined.
    doc.querySelectorAll("Construction > Objects > [magnetobjs]").forEach(
        (element) => {
            const point = variables.get(attr(element, "name")!);
            const radius = Number(attr(element, "magnetd") ?? 20);
            const magnets = attr(element, "magnetobjs")!
                .split(",")
                .flatMap((item) => {
                    const [name, ray = radius] = item.split(":");
                    const pixels = Math.abs(Number(ray));
                    return pixels > 0 && MAGNETS.has(commands.get(name)!)
                        ? [`[${variables.get(name)},${pixels}]`]
                        : [];
                });
            if (point && magnets.length)
                push(null, "STL", [
                    ref(point),
                    literal(`mg:${magnets.join(",")}`),
                ]);
        },
    );
    calls.push(
        ...panels.map((call, index) => ({
            ...call,
            line: calls.length + index + 1,
        })),
    );
    // Its JavaScript, never run: a script run as a point is dragged or a
    // button is pressed becomes its DGPad program ("ondrag", or the
    // "onchange" of the expression the button switches), the others are
    // reported.
    const programs = new Map<string, { mode: string; sources: string[] }>();
    dynamicScripts.forEach((script) => {
        const owner = attr(script, "mousedrag") ?? "";
        const variable = variables.get(owner);
        const command = commands.get(owner);
        const mode =
            attr(script, "onload") === "true"
                ? null
                : command === "Point" || command === "PointOn"
                  ? "ondrag"
                  : controls.get(owner)?.tagName === "CTRLbutton"
                    ? "onchange"
                    : null;
        const source =
            mode &&
            scriptProgram(
                script.textContent!,
                variables,
                textContents,
                commands,
                scope,
            );
        if (!source || source instanceof Unsupported) {
            unsupported.add(`CaRMetal: Script ${attr(script, "Name")}`);
            return;
        }
        if (!programs.has(variable!))
            programs.set(variable!, { mode: mode!, sources: [] });
        programs.get(variable!)!.sources.push(source);
    });
    programs.forEach(({ mode, sources }, variable) =>
        push(null, "BLK", [
            ref(variable),
            literal(JSON.stringify({ [mode]: { sync: sources.join("\n") } })),
        ]),
    );
    // A script the user runs from the menu becomes a button, in a column at
    // the top right corner. One that can't is ignored for now.
    let buttons = 0;
    const menuScripts: { name: string; program: string | Unsupported }[] = [];
    doc.querySelectorAll("CaR > Script").forEach((script) => {
        if (attr(script, "onload") === "true" || attr(script, "mousedrag"))
            return;
        // What it draws, in the list of a hidden expression.
        const drawing = `blk_draw${buttons}`;
        const source = scriptProgram(
            script.textContent!,
            variables,
            textContents,
            commands,
            scope,
            drawing,
        );
        menuScripts.push({ name: attr(script, "Name") ?? "", program: source });
        if (source instanceof Unsupported) return;
        if (source.includes("$show();")) {
            push(
                drawing,
                "Expression",
                ["", "", "", "", "[]", "0", "0"].map(literal),
            );
            push(null, "STL", [ref(drawing), literal("h:2")]);
            push(`${drawing}_list`, "List", [literal(""), ref(drawing)]);
            push(null, "STL", [ref(`${drawing}_list`), literal("sg:1;o:0")]);
        }
        const name = `blk_btn${buttons}`;
        push(name, "BlocklyButton", [
            literal(name),
            literal(attr(script, "Name") ?? ""),
            literal(String((width - 12 - ox) / unit)),
            literal(String((oy - 30 - 50 * buttons++) / unit)),
            literal(source),
        ]);
    });
    return { calls, targets, unsupported: [...unsupported], menuScripts };
}

// CaRMetal's JavaScript functions a program reads, and the Math ones that
// are DGP's, in radians for none.
const SCRIPT_KEYWORDS = new Set(
    "var let if else while for true false break continue".split(" "),
);
const SCRIPT_MATH = new Set(
    "random sqrt abs floor ceil round min max exp log pow PI E sin cos tan asin acos atan atan2".split(
        " ",
    ),
);

// What CaRMetal's scripts draw: points, segments and polygons, as their
// numbers in $o, [x, y, kind (0 point, 1 segment, 2 polygon), hidden, r, g,
// b, size, vertices], which $show draws into the list of `expression`,
// a hidden expression a List shows.
const DRAWS = new Set("Point Segment Polygon MidPoint Symmetry".split(" "));
const DRAWING = (expression: string) => `$o = [];
function $point(a, b) { $o.push([a, b, 0, 0, 0, 0, 178, 3, []]); return $o.length - 1; }
function $line(k, p) { $o.push([x(p[0]), y(p[0]), k, 0, 0, 0, 178, 1, p]); return $o.length - 1; }
function $show() { var d = [], k, r, j; for (k = 0; k < $o.length; k++) { r = $o[k]; if (!r[3]) { d.push([1, r[4], r[5], r[6]]); d.push([10, 0, 0, r[2] ? r[7] : 0]); d.push([12, 0, 0, r[2] ? 0 : r[7]]); d.push([r[0], r[1]]); for (j = 1; j < r[8].length; j++) { d.push([x(r[8][j]), y(r[8][j])]); } if (r[2] == 2) { d.push([r[0], r[1]]); d.push([4, 0, 0, 30]); } d.push([NaN, NaN]); } } SET_EXP("${expression}", d); }`;

// A JavaScript token, or a comment (no group).
const SCRIPT_TOKEN =
    /\s*(?:\/\/.*|\/\*[^]*?\*\/|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|[\p{L}_$][\p{L}\p{N}_$]*|[=!]==?|[<>]=?|&&|\|\||[-+*/]=|\+\+|--|\S))/guy;

// A CaRMetal script as a DGPad program (see dgp_formula.ts), or what it
// can't be read past: its
// JavaScript is only rewritten, token by token, into what that closed
// grammar reads, which validates it. Its variables become locals (renamed
// $v… if an object has their name), its calls DGPad's: X("A") x(A),
// GetExpressionValue("E") E, SetExpressionValue("E",v) SET_EXP("E",v),
// Move("A",x,y) SET_EXP("A",[x,y]), GetText or SetText those of the hidden
// expression holding the text's content, Pause(ms) WAIT(ms), Prompt(s) and
// Alert(s) ALERT(s), and SetColor or SetThickness styles. An object is
// named by a string, or by a variable only ever set to its name.
function scriptProgram(
    source: string,
    variables: Map<string, string>,
    texts: Map<string, string>,
    commands: Map<string, string>,
    scope: Scope,
    drawing: string | null = null,
): string | Unsupported {
    const tokens: string[] = [];
    // The tokens after a line break, where JavaScript may end a statement.
    const breaks = new Set<number>();
    let broken = false;
    for (const [match, token] of source.matchAll(SCRIPT_TOKEN)) {
        broken ||= match
            .slice(0, match.length - (token ?? "").length)
            .includes("\n");
        if (token === undefined) continue;
        if (broken) breaks.add(tokens.length);
        broken = false;
        tokens.push(token);
    }
    const isString = (token: string | undefined) => /^["']/.test(token ?? "");
    const isName = (token: string) => /^[\p{L}_$]/u.test(token);
    const decode = (token: string) =>
        token
            .slice(1, -1)
            .replace(
                /\\(.)/g,
                (_, c: string) => ({ n: "\n", t: "\t" })[c] ?? c,
            );
    const used = new Set(
        tokens.filter(
            (token, k) =>
                isName(token) &&
                !SCRIPT_KEYWORDS.has(token) &&
                token !== "Math" &&
                tokens[k + 1] !== "(" &&
                tokens[k - 1] !== ".",
        ),
    );
    const names = new Set(variables.values());
    const locals = new Map(
        [...used].map((name, k) => [
            name,
            /^[A-Za-z]\w*$/.test(name) &&
            !names.has(name) &&
            !/^(PI|Infinity|NaN)$/.test(name)
                ? name
                : `$v${k}`,
        ]),
    );
    const aliases = new Map<string, string | null>();
    tokens.forEach((token, k) => {
        if (tokens[k + 1] !== "=" || !used.has(token)) return;
        const value = tokens[k + 2];
        const name = isString(value)
            ? decode(value)
            : (aliases.get(value) ?? null);
        const ends = /^[;)}]$/.test(tokens[k + 3] ?? ";") || breaks.has(k + 3);
        aliases.set(
            token,
            ends &&
                aliases.get(token) !== null &&
                name !== null &&
                (aliases.get(token) ?? name) === name
                ? name
                : null,
        );
    });
    // The variables set to a text not a name: a formula built.
    const built = new Set(
        tokens.filter(
            (token, k) =>
                tokens[k + 1] === "=" &&
                aliases.get(token) === null &&
                tokens.slice(k + 2, k + 12).some(isString),
        ),
    );
    const draws =
        drawing !== null &&
        tokens.some((token, k) => DRAWS.has(token) && tokens[k + 1] === "(");
    let i = 0;
    const fail = (obstacle = tokens[i - 1] ?? "end"): never => {
        throw new Unsupported(obstacle);
    };
    // CaRMetal replaces "_x" in a string by the value of the variable x.
    const string = (token: string): string => {
        const text = decode(token);
        const pieces: string[] = [];
        let last = 0;
        for (const match of text.matchAll(/_(\w+)/g))
            if (used.has(match[1])) {
                pieces.push(
                    quote(text.slice(last, match.index)),
                    `(${locals.get(match[1])})`,
                );
                last = match.index + match[0].length;
            }
        pieces.push(quote(text.slice(last)));
        return pieces.length > 1 ? `(${pieces.join("+")})` : pieces[0];
    };
    const object = (table: Map<string, string>): string => {
        const [name, ...more] = named();
        return (!more.length && table.get(name)) || fail();
    };
    // The objects "A,B" names, by their CaRMetal names.
    const named = (): string[] => {
        const token = tokens[i++];
        const text = isString(token) ? decode(token) : aliases.get(token);
        return text ? text.split(",") : fail();
    };
    const stop = (token: string) => token === "," || token === ")";
    // A number, as CaRMetal also reads one in a string.
    const number = (): string => {
        if (!isString(tokens[i]) || !stop(tokens[i + 1])) return emit(stop);
        const text = decode(tokens[i++]);
        const named = /^_(\w+)$/.exec(text);
        if (named && used.has(named[1])) return locals.get(named[1])!;
        return text.trim() !== "" && isFinite(Number(text))
            ? String(Number(text))
            : fail();
    };
    const comma = () => tokens[i++] === "," || fail();
    // The arguments of the call whose "(" was just read.
    const argCount = (): number => {
        let depth = 0;
        let count = tokens[i] === ")" ? 0 : 1;
        for (let k = i; depth >= 0 && k < tokens.length; k++) {
            if ("([{".includes(tokens[k])) depth++;
            else if (")]}".includes(tokens[k])) depth--;
            else if (depth === 0 && tokens[k] === ",") count++;
        }
        return count;
    };
    const skipArgument = () => {
        emit(stop);
        comma();
    };
    // The figure's point this string or variable names, if it has it.
    const drawn = (token: string): string | null => {
        const name = isString(token) ? decode(token) : aliases.get(token);
        return name && POINTS.has(commands.get(name)!) ? name : null;
    };
    const figurePoint = (name: string) => ({
        code:
            (POINTS.has(commands.get(name)!) && variables.get(name)) ||
            fail(name),
        figure: true,
    });
    // A point of the figure, by its name, or one the script drew, by its
    // number.
    const point = (): { code: string; figure: boolean } => {
        const token = tokens[i];
        const name = isString(token) ? decode(token) : aliases.get(token);
        if (name != null && stop(tokens[i + 1])) {
            i++;
            return figurePoint(name);
        }
        if (!draws) fail();
        const h = emit(stop);
        return { code: `[$o[${h}][0],$o[${h}][1]]`, figure: false };
    };
    // A coordinate, maybe a CaRMetal formula, in a string, of the figure's
    // objects and of the script's variables: "x_a" the abscissa of the
    // point a names, "_c" the value of c.
    const coordinate = (): string => {
        if (!isString(tokens[i]) || !stop(tokens[i + 1])) {
            const start = i;
            const code = emit(stop);
            if (
                tokens
                    .slice(start, i)
                    .some((token) => isString(token) || built.has(token))
            )
                fail("formula text");
            return code;
        }
        const places = new Map<string, string>();
        const place = (code: string) => {
            const name = `__${places.size}`;
            places.set(name, code);
            return name;
        };
        const text = decode(tokens[i++])
            .replace(/([xy])_(\w+)/gi, (match, axis: string, name: string) => {
                if (!used.has(name)) return match;
                const figure = aliases.get(name);
                return place(
                    figure != null
                        ? `${axis.toLowerCase()}(${figurePoint(figure).code})`
                        : `$o[${locals.get(name)}][${/x/i.test(axis) ? 0 : 1}]`,
                );
            })
            .replace(/_(\w+)/g, (match, name: string) =>
                used.has(name) ? place(`(${locals.get(name)})`) : match,
            );
        return (
            formula(text, {
                ...scope,
                refs: (name) => places.get(name) ?? scope.refs(name),
            }) ?? fail("formula")
        );
    };
    // A style of what the script drew, h (see DRAWING).
    const drawnStyle = (name: string, h: string): string => {
        const token = tokens[i];
        const value = isString(token) ? decode(token) : null;
        const set = (index: number, code: string) => `${h}[${index}]=${code}`;
        switch (name) {
            case "SetHide":
                return set(3, `(${emit(stop)})?1:0`);
            case "SetFilled":
                return set(2, `(${emit(stop)})?2:1`);
            case "SetShowName":
                emit(stop);
                return "";
            case "SetRGBColor": {
                const rgb = [
                    number(),
                    (comma(), number()),
                    (comma(), number()),
                ];
                return rgb.map((c, k) => set(4 + k, c)).join(";");
            }
        }
        i++;
        if (name === "SetColor") {
            const color = COLOR_NAMES.indexOf(value!);
            return color < 0
                ? fail(value!)
                : rgbOf(color)
                      .map((c, k) => set(4 + k, String(c)))
                      .join(";");
        }
        if (name === "SetPointType")
            return value === "point" || value === "dot"
                ? set(7, `${h}[2]?${h}[7]:1.5`)
                : "";
        // SetThickness: of a point, of a line.
        const size = { thick: [4, 2.5], normal: [3, 1], thin: [3, 0.5] }[
            value!
        ];
        return size
            ? set(7, `${h}[2]?${size[1]}:${size[0]}`)
            : fail(value ?? "SetThickness(");
    };
    const call = (name: string): string => {
        let out: string;
        switch (name) {
            case "X":
            case "Y":
                out = `${name.toLowerCase()}(${object(variables)})`;
                break;
            case "GetExpressionValue":
                out = `(${object(variables)})`;
                break;
            case "GetText":
                out = `(${object(texts)})`;
                break;
            case "SetExpressionValue": {
                const target = object(variables);
                comma();
                out = `SET_EXP("${target}",${number()})`;
                break;
            }
            case "SetText": {
                const target = object(texts);
                comma();
                out = `SET_EXP("${target}",${emit(stop)})`;
                break;
            }
            case "Move": {
                const target = object(variables);
                comma();
                const x = number();
                comma();
                out = `SET_EXP("${target}",[${x},${number()}])`;
                break;
            }
            case "Pause":
                out = `${draws ? "$show();" : ""}WAIT(${number()})`;
                break;
            case "Prompt":
            case "Alert":
                out = `ALERT(${emit(stop)})`;
                break;
            // Drawn, as the numbers of what is drawn (see DRAWING): not
            // again what the figure already has, of its own points.
            case "Point": {
                const count = argCount();
                if (count < 2) fail("Point(");
                if (count === 3) {
                    const name = drawn(tokens[i]);
                    skipArgument();
                    if (name) {
                        while (tokens[i] !== ")") i++;
                        out = "-1";
                        break;
                    }
                }
                const x = coordinate();
                comma();
                out = `$point(${x},${coordinate()})`;
                break;
            }
            case "Segment":
            case "MidPoint":
            case "Symmetry": {
                if (argCount() === 3) skipArgument();
                const [a, b] = [point(), (comma(), point())];
                out =
                    a.figure && b.figure
                        ? "-1"
                        : name === "Segment"
                          ? `$line(1,[${a.code},${b.code}])`
                          : name === "MidPoint"
                            ? `$point((x(${a.code})+x(${b.code}))/2,(y(${a.code})+y(${b.code}))/2)`
                            : `$point(2*x(${a.code})-x(${b.code}),2*y(${a.code})-y(${b.code}))`;
                break;
            }
            // Its vertices "A,B,C", or joined: a+","+b+","+c.
            case "Polygon": {
                if (argCount() === 2) skipArgument();
                const vertices: { code: string; figure: boolean }[] = [];
                do {
                    const token = tokens[i];
                    if (isString(token) && decode(token) === ",") i++;
                    else if (isString(token))
                        decode(tokens[i++])
                            .split(",")
                            .forEach((name) =>
                                vertices.push(figurePoint(name)),
                            );
                    else vertices.push(point());
                } while (tokens[i] === "+" && i++);
                out = vertices.every((vertex) => vertex.figure)
                    ? "-1"
                    : `$line(2,[${vertices.map((vertex) => vertex.code)}])`;
                break;
            }
            case "SetRGBColor":
            case "SetColor":
            case "SetThickness":
            case "SetHide":
            case "SetFilled":
            case "SetPointType":
            case "SetShowName": {
                const target = tokens[i];
                if (!isString(target) && aliases.get(target) == null && draws) {
                    const h = `$o[${emit(stop)}]`;
                    comma();
                    out = drawnStyle(name, h);
                    break;
                }
                const targets = named();
                comma();
                if (name === "SetRGBColor") {
                    const rgb = [
                        number(),
                        (comma(), number()),
                        (comma(), number()),
                    ];
                    out = targets
                        .map(
                            (target) =>
                                `${variables.get(target) ?? fail()}.setRGBColor(${rgb})`,
                        )
                        .join(";");
                    break;
                }
                if (name === "SetHide" || name === "SetShowName") {
                    const value = emit(stop);
                    out = targets
                        .map(
                            (target) =>
                                `${variables.get(target) ?? fail()}.${name === "SetHide" ? "setHidden" : "setShowName"}((${value})?${name === "SetHide" ? 1 : "true"}:${name === "SetHide" ? 0 : "false"})`,
                        )
                        .join(";");
                    break;
                }
                if (name !== "SetColor" && name !== "SetThickness")
                    fail(`${name}(`);
                const token = tokens[i++];
                const value = isString(token) ? decode(token) : fail();
                const color = COLOR_NAMES.indexOf(value);
                out = targets
                    .map((target) => {
                        const object = variables.get(target) ?? fail();
                        if (name === "SetColor")
                            return color < 0
                                ? fail()
                                : `${object}.setRGBColor(${rgbOf(color)})`;
                        // A point's, as its style (see translateObject).
                        if (!POINTS.has(commands.get(target)!)) fail();
                        return value === "thick"
                            ? `${object}.setSize(5);${object}.setOpacity(1)`
                            : value === "normal"
                              ? `${object}.setSize(4);${object}.setOpacity(0)`
                              : fail();
                    })
                    .join(";");
                break;
            }
            default:
                return fail(`${name}(`);
        }
        return tokens[i++] === ")" ? out : fail();
    };
    const emit = (until: (token: string) => boolean): string => {
        const out: string[] = [];
        let depth = 0;
        while (i < tokens.length && !(depth === 0 && until(tokens[i]))) {
            if (
                breaks.has(i) &&
                /^([\p{L}\p{N}_$"'.)\]]|\+\+|--)/u.test(tokens[i - 1] ?? "") &&
                /^[\p{L}_$]/u.test(tokens[i]) &&
                tokens[i] !== "else"
            )
                out.push(";");
            const token = tokens[i++];
            // Names joined, "A,B", in a variable: not those of drawings.
            if (
                draws &&
                isString(token) &&
                decode(token) === "," &&
                (tokens[i - 2] === "+" || tokens[i] === "+")
            )
                fail("names joined");
            if (isString(token)) out.push(string(token));
            else if (!isName(token)) {
                if (token === ".") fail(`.${tokens[i]}`);
                if ("([{".includes(token)) depth++;
                else if (")]}".includes(token)) depth--;
                out.push(token);
            } else if (SCRIPT_KEYWORDS.has(token)) out.push(token);
            else if (token === "Math") {
                const fn = tokens[i + 1];
                if (tokens[i] !== "." || !SCRIPT_MATH.has(fn))
                    fail(`Math.${fn}`);
                i += 2;
                // In radians, the figure's in degrees.
                if (/^a?(sin|cos|tan)$/.test(fn)) {
                    if (tokens[i++] !== "(") fail();
                    const arg = emit(stop);
                    if (tokens[i++] !== ")") fail();
                    out.push(
                        fn.startsWith("a")
                            ? `(Math.${fn}(${arg})*Math.PI/180)`
                            : `Math.${fn}((${arg})*180/Math.PI)`,
                    );
                } else out.push(`Math.${fn}`);
            } else if (tokens[i] === "(") {
                const start = i - 1;
                i++;
                const code = call(token);
                // A drawing alone, its number kept: Blockly calls a
                // function that returns a value only in an expression.
                const alone =
                    (start === 0 ||
                        /^[;{}]$/.test(tokens[start - 1]) ||
                        breaks.has(start)) &&
                    (i >= tokens.length ||
                        /^[;}]$/.test(tokens[i]) ||
                        breaks.has(i));
                out.push(
                    alone && /^\$(point|line)\(/.test(code)
                        ? `$n = ${code}`
                        : code,
                );
            } else out.push(locals.get(token)!);
        }
        return out.join(" ");
    };
    try {
        const program = emit(() => false);
        return draws ? `${DRAWING(drawing!)}\n${program}\n$show();` : program;
    } catch (error) {
        if (error instanceof Unsupported) return error;
        throw error;
    }
}

// The channels of CaRMetal's color of this index.
const rgbOf = (color: number) =>
    COLORS[color]
        .slice(1)
        .match(/../g)!
        .map((c) => parseInt(c, 16));

// "r,g,b", CaRMetal's custom colors also being written "r,,g,,b".
function hex(rgb: string): string {
    return `#${rgb
        .split(",")
        .filter(Boolean)
        .map((c) => Number(c).toString(16).padStart(2, "0"))
        .join("")}`;
}
