import type { DgpCall, DgpValue } from "./dgp_parser";
import type { Vec3 } from "../vec";

// A CaRMetal figure (.zir, see CaRMetal's rene/zirkel sources) translated
// into DGP commands, run by the same engine as DGPad's.

export interface ZirImage {
    url: string;
    width: number;
    height: number;
}

// CaRMetal's palette (ZirkelFrame.DefaultColors).
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
const TOKEN =
    /\s*(\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+|[A-Za-z_]\w*|&&|\|\||<=|>=|==|~=|!=|\S)/gy;
const OPERATORS: Record<string, string> = {
    "~=": "==",
    "=": "==",
    "&": "&&",
    "|": "||",
};
const SAME = new Set(
    "sin cos tan sqrt exp log round floor ceil abs min max atan2 d x y".split(
        " ",
    ),
);
const WINDOW = new Set(["windoww", "windowh", "windowcx", "windowcy", "pixel"]);

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
function formula(source: string, scope: Scope, variable = ""): string | null {
    const tokens = [...source.matchAll(TOKEN)].map((match) => match[1]);
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
    const sequence = (): string => {
        let out = "";
        while (i < tokens.length && tokens[i] !== "," && tokens[i] !== ")") {
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
                } else if (token === variable) out += "x";
                else if (token === "pi") out += "PI";
                else if (WINDOW.has(token)) out += token;
                else {
                    const ref = scope.refs(token);
                    if (!ref) throw new Unsupported(token);
                    out += ref;
                }
            } else out += OPERATORS[token] ?? token;
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
    const background = preferences?.getAttribute("colorbackground");
    if (background)
        push(null, "SetGeneralStyle", [
            literal(`background-color:${hex(background)}`),
        ]);

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
        push(variable, command, [literal(name), ...args]);
        const full = styleOf(element, command) + style;
        if (full)
            push(null, "STL", [ref(variable), literal(full.replace(/^;/, ""))]);
        return variable;
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

    doc.querySelectorAll("Objects > *").forEach((element) => {
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
            case "PointOn":
                if (!(args = objects(element, "on"))) break;
                targets.set(define(element, "PointOn", [...args, literal(0)]), [
                    num(element, "x"),
                    num(element, "y"),
                    0,
                ]);
                places.set(name, [num(element, "x"), num(element, "y")]);
                return;
            case "Midpoint":
                if (!(args = objects(element, "first", "second"))) break;
                define(element, "MidPoint", args);
                return;
            case "Intersection":
            case "OtherIntersection":
                if (!(args = objects(element, "first", "second"))) break;
                intersections.push(
                    define(element, "OrderedIntersection", [
                        ...args,
                        literal(attr(element, "which") === "second" ? 1 : 0),
                    ]),
                );
                return;
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
            case "Text":
                label(
                    element,
                    element.textContent!,
                    num(element, "x"),
                    num(element, "y"),
                );
                return;
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
                const variable = define(
                    element,
                    "Expression",
                    [
                        tex ? "" : prompt && `${prompt} = `,
                        min,
                        max,
                        control ? (attr(control, "V") ?? value) : value,
                        attr(element, "x") ?? "0",
                        attr(element, "y") ?? "0",
                    ].map(literal),
                    tex ? ";h:2" : "",
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
    });

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

    function styleOf(element: Element, command: string): string {
        const style = [`c:${color(element)}`];
        const hidden = attr(element, "hidden");
        if (hidden === "super") style.push("h:2");
        else if (hidden === "true") style.push("h:1");
        const thick = attr(element, "type") === "thick";
        if (attr(element, "showvalue") === "true")
            style.push(
                `p:${digits(command.endsWith("Angle") ? "angles" : "lengths")}`,
            );
        if (
            command === "Point" ||
            command === "PointOn" ||
            command === "MidPoint" ||
            command === "OrderedIntersection"
        ) {
            const shape = attr(element, "shape") ?? "square";
            style.push(shape === "invisible" ? "s:0" : `s:${thick ? 5 : 4}`);
            if (shape in SHAPES) style.push(`sp:${SHAPES[shape]}`);
            if (attr(element, "showname") === "true") style.push("sn:true");
        } else if (command === "Polygon") {
            style.push(
                `o:${attr(element, "solid") === "true" ? 0.5 : 0.2}`,
                "s:0",
            );
        } else if (command === "Angle" || command === "FixedAngle") {
            style.push(`o:${attr(element, "filled") === "true" ? 0.2 : 0}`);
        } else if (command !== "Expression" && command !== "Image") {
            style.push(`s:${thick ? 2.5 : 1}`);
            if (attr(element, "showname") === "true") style.push("lb:true");
        }
        return style.join(";");
    }

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
