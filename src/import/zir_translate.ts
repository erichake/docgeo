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
    /\s*(\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+|[A-Za-z_]\w*|"[^"]*"|&&|\|\||<=|>=|==|~=|!=|\S)/gy;
const OPERATORS: Record<string, string> = {
    "=": "==",
    "&": "&&",
    "|": "||",
};
const LOGIC = new Set(["&&", "||", "&", "|"]);
const COMPARISONS = new Set(["<", "<=", ">", ">=", "==", "=", "~=", "!="]);
const STOPS = new Set([",", ")", "!"]);
const SAME = new Set(
    "sin cos tan sqrt exp log round floor ceil abs min max atan2 d x y".split(
        " ",
    ),
);
// CaRMetal's window: its center, its half width and height, and the pixels
// of a unit.
const WINDOW = new Map([
    ["windowcx", "windowcx()"],
    ["windowcy", "windowcy()"],
    ["windoww", "(windoww()/2)"],
    ["windowh", "(windowh()/2)"],
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

class Unsupported extends Error {}

interface Scope {
    refs: (name: string) => string | undefined;
    // The variables of the functions, which formulas call.
    functions: Set<string>;
    // A hidden expression computed by a script, read by its variable.
    script: (code: string) => string;
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
    const call = (name: string, args: string[]): string => {
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
            case "rad":
                return `(${a}*PI/180)`;
        }
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
            } else if (/^[A-Za-z_]/.test(token)) {
                if (tokens[i] === "(") {
                    i++;
                    const args = [sequence()];
                    while (tokens[i] === ",") {
                        i++;
                        args.push(sequence());
                    }
                    if (tokens[i++] !== ")") throw new Unsupported(source);
                    // d(windoww)…: a change since the last computation.
                    if (token === "d" && args.length === 1)
                        throw new Unsupported(token);
                    out += call(token, args);
                } else if (token === variable) out += as;
                else if (token === "pi") out += "PI";
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

const escape = (text: string) =>
    text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

// CaRMetal writes some attributes twice, which an XML parser rejects.
export function parseZir(xml: string): Document {
    return new DOMParser().parseFromString(
        xml.replace(/<\w+[^<>]*>/g, (tag) => {
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
    intersections: string[];
    unsupported: string[];
} {
    const calls: DgpCall[] = [];
    const targets = new Map<string, Vec3>();
    const intersections: string[] = [];
    const unsupported = new Set<string>();
    const variables = new Map<string, string>();
    // The DGP command of each object, by name.
    const commands = new Map<string, string>();
    // Where each point is, for the texts placed at one.
    const places = new Map<string, [number, number]>();
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
    const preferences = doc.querySelector("Construction > Preferences");
    const digits = (kind: string) =>
        preferences?.getAttribute(`digits.${kind}`) ?? "2";
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
    const names = new Set(
        [...doc.querySelectorAll("Objects > [name]")].map((element) =>
            attr(element, "name")!,
        ),
    );
    const define = (
        element: Element,
        command: string,
        args: DgpValue[],
        style = "",
    ): string => {
        const name = attr(element, "name")!;
        const variable =
            /^[A-Za-z_]\w*$/.test(name) && !RESERVED.has(name)
                ? name
                : `$${calls.length}`;
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
            push(null, "STL", [ref(variable), literal(full.replace(/^;/, ""))]);
        const label =
            labelled && attr(element, "hidden") === null
                ? aliasLabel(element, variable, command, alias)
                : undefined;
        // Hidden while a condition holds, with its label: shown while 1.
        const tag = [...element.attributes].find(
            ({ name, value }) =>
                /^ctag\d+$/.test(name) &&
                (value === "hidden" || value === "superhidden"),
        );
        const hidden =
            tag && formula(attr(element, `cexpr${tag.name.slice(4)}`)!, scope);
        if (hidden) {
            const shown = scope.script(`(${hidden})?0:1`);
            [variable, label].forEach(
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
        [...doc.querySelectorAll("Objects > *")].some(
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
        // As CaRMetal: kept close, at a fixed distance in the offset's
        // direction; otherwise at the offset, below right.
        const [xc, yc] = [num(element, "xcoffset"), num(element, "ycoffset")];
        const d = Math.hypot(xc, yc);
        const reach = 3 * pointSize + fontSize / 2;
        const [dx, dy] =
            attr(element, "keepclose") === "true" && d > 1e-10
                ? [
                      (xc / d) * reach - alias.length * fontSize * 0.3,
                      (-yc / d) * reach + fontSize * 0.35,
                  ]
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
                      literal(
                          `"${alias.replace(/\$/g, "").replace(/[\\"]/g, "\\$&")}"`,
                      ),
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
        refs: (name) => variables.get(name),
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
        const found = points(element, ...names).map(
            (name) => name && variables.get(name),
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
    // A free point at a fixed distance from another, set by a segment.
    const fixedSegments = new Map<string, Element>();
    doc.querySelectorAll("Objects > Segment[fixed]").forEach((segment) =>
        fixedSegments.set(attr(segment, "to")!, segment),
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
                // Its own coordinates: a point kept in place on the screen.
                if (!new RegExp(`\\b${name}\\b`).test(attr(element, "x")!))
                    unsupported.add(`CaRMetal: ${name}`);
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
                const polygon =
                    commands.get(attr(element, "on")!) === "Polygon";
                const point = define(
                    element,
                    "PointOn",
                    [...args, polygon ? origin : literal(0)],
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
                intersections.push(
                    define(element, "OrderedIntersection", [
                        ...args,
                        literal(attr(element, "which") === "second" ? 1 : 0),
                    ]),
                );
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
                    define(element, "Circle1", [
                        ...args,
                        /^[\d.]+$/.test(radius)
                            ? literal(Number(radius))
                            : literal(radius),
                    ]);
                    return;
                }
                if (attr(element, "start") !== null) {
                    if (!(args = objects(element, "midpoint", "start", "end")))
                        break;
                    define(element, "CenterArc", args);
                    return;
                }
                if (!(args = objects(element, "midpoint", "through"))) break;
                define(element, "Circle", args);
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
                const [fx, fy, min, max] = ["x", "y", "min", "max"].map((a) =>
                    translate(attr(element, a) ?? "", variable),
                );
                if ([fx, fy, min, max].includes(null)) break;
                scope.functions.add(
                    define(element, "Curvus", [
                        literal(min!),
                        literal(max!),
                        literal(fx === "x" ? fy! : `[${fx},${fy}]`),
                    ]),
                );
                return;
            }
            // At its top left corner in the figure, with the values of the
            // formulas between "%", in LaTeX between "$".
            case "Text": {
                const text = element.textContent!;
                const parts = text.split("%");
                const values = parts.map((part, index) =>
                    index % 2 ? translate(part) : part,
                );
                if (parts.length % 2 === 0 || values.includes(null)) {
                    values.length = 1;
                    values[0] = text;
                }
                const anchor = ref(
                    hiddenPoint(`[${num(element, "x")},${num(element, "y")}]`),
                );
                if (/^\s*\$[^]*\$\s*$/.test(text)) {
                    define(
                        element,
                        "ExpressionOn",
                        [
                            ...["", "", ""].map(literal),
                            literal(
                                `""${values
                                    .map((value, index) =>
                                        index % 2
                                            ? `+(${value})`
                                            : `+"${value!.replace(/\$/g, "").replace(/[\\"]/g, "\\$&")}"`,
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
                define(
                    element,
                    "AnchoredText",
                    [
                        anchor,
                        literal(0),
                        literal(fontSize),
                        literal(
                            values
                                .map((value, index) =>
                                    index % 2
                                        ? value
                                        : value!.replace(/%/g, "%%"),
                                )
                                .join("%"),
                        ),
                    ],
                    `;f:${fontSize}`,
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
                                num(control, "x"),
                                num(control, "y") + num(control, "h") / 2,
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
                        ...(at
                            ? [ref(hiddenPoint(`[${at}]`)), origin]
                            : [literal(x), literal(y)]),
                    ],
                    tex ? ";h:2" : `;f:${fontSize}`,
                );
                if (control) controlPanel(control, variable);
                if (tex && attr(element, "hidden") === null) {
                    const [px, py] = pixel(
                        num(element, "x"),
                        num(element, "y"),
                    );
                    panel(
                        `<div style="color:${color(element)}">${escape(prompt)} = %${variable}%</div>`,
                        px,
                        py - 20,
                        prompt.length * 9 + 80,
                        40,
                        `;p:${digits("lengths")}`,
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
        return [...changes].map(([condition, styles], index) => {
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
            copy.setAttribute("cexpr0", `!(${condition})`);
            return copy;
        });
    };

    // The variants last: with "@", a condition names an object defined
    // later.
    const variants: Element[] = [];
    doc.querySelectorAll("Objects > *").forEach((element) => {
        const shown = partialLine(element) ?? element;
        translateObject(shown);
        variants.push(...styleVariants(shown));
    });
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
            num(control, "x"),
            num(control, "y"),
            num(control, "w") + caption.length * 8 + 20,
            num(control, "h") + 10,
        );
        push(null, "STL", [ref(target), literal("h:2")]);
    }

    function color(element: Element): string {
        const custom = attr(element, "scolor");
        return custom
            ? hex(custom)
            : (COLORS[num(element, "color")] ?? COLORS[0]);
    }

    // CaRMetal's light color: 40 % of its own, with the background's for
    // its palette, with white for a custom one.
    function lightColor(element: Element): string {
        const custom = attr(element, "scolor");
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
                `p:${digits(command.endsWith("Angle") ? "angles" : "lengths")}`,
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
            if (thick) style.push("o:1");
            if (shape in SHAPES) style.push(`sp:${SHAPES[shape]}`);
            if (attr(element, "showname") === "true") style.push("sn:true");
        } else if (command === "Sequence") {
            const shape = attr(element, "shape") ?? "square";
            style.push(`s:${thick ? 4 : 3}`, `sp:${SHAPES[shape] ?? 3}`);
        } else if (command === "Polygon") {
            // CaRMetal fills it with its color if thick, otherwise with its
            // light color (40 % of it) half transparent, unless solid, and
            // outlines it only if neither thick nor thin.
            // and outlines it only if neither thick nor thin, or not filled.
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
        const point = [...doc.querySelectorAll("Objects > PointOn")].find(
            (point) => attr(point, "name") === name,
        );
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
    doc.querySelectorAll("Objects > [magnetobjs]").forEach((element) => {
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
            push(null, "STL", [ref(point), literal(`mg:${magnets.join(",")}`)]);
    });
    calls.push(
        ...panels.map((call, index) => ({
            ...call,
            line: calls.length + index + 1,
        })),
    );
    return { calls, targets, intersections, unsupported: [...unsupported] };
}

// "r,g,b", CaRMetal's custom colors also being written "r,,g,,b".
function hex(rgb: string): string {
    return `#${rgb
        .split(",")
        .filter(Boolean)
        .map((c) => Number(c).toString(16).padStart(2, "0"))
        .join("")}`;
}
