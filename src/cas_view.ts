import { cas } from "./cas";
import { CAS_NAMES, LINE_COMMANDS } from "./import/cas_names";
import type { construction, FigureView } from "./construction";
import { $, type DOMElement } from "./dom";
import { LANG } from "./i18n";
import {
    CAS_DEFINITION,
    casBound,
    casRequest,
    casTree,
    rational,
    SYMBOL,
    type CasFunction,
} from "./import/cas_formula";
import {
    evaluateValue,
    parseFormula,
    withObjects,
    type FormulaNode,
    type ScriptValue,
} from "./import/dgp_formula";
import type { construction_object } from "./objects/construction_object";
import { functionOf } from "./objects/expression_object";

// A computer algebra view (see CAS.md), loaded when a figure shown first has
// one: its lines, each computed by Giac, as in GeoGebra's CAS view. The
// objects of the figure a line reads are written by their values (exact),
// its other letters are free variables; `$2` reads line 2, `a := …` and
// `f(x) := …` define what the next lines read. Radians, as GeoGebra's.
// `Numeric(e)` computes e numerically, `KeepInput(e)` shows e as typed; a
// text (`"…"`) is shown as such. The commands are named in the language of
// the page, written in English (see cas_names.ts).

$("head").append(
    `<style>.docgeo-cas{position:absolute;overflow:auto;background:linear-gradient(90deg,#f7f8fa 44px,#e5e7eb 0,#e5e7eb 45px,#fff 0) local;color:#1f2937;font:14px system-ui,-apple-system,"Segoe UI",sans-serif}.docgeo-cas>div{display:grid;grid-template-columns:45px 1fr;column-gap:14px;padding-right:14px;border-bottom:1px solid #eceef1}.docgeo-cas>div:hover{background:#fbfcfd}.docgeo-cas>div>span{grid-row:span 2;padding:8px 8px 0 0;background:#f7f8fa;border-right:1px solid #e5e7eb;color:#9ca3af;font:12px/19.5px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-align:end}.docgeo-cas>div>:nth-child(2){padding:8px 0 2px;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#374151}.docgeo-cas>div>:nth-child(2):last-child{padding-bottom:8px}.docgeo-cas>div>div{overflow-x:auto;overflow-y:hidden}.docgeo-cas>div>div:last-child{padding:2px 0 9px;min-height:1.2em;color:#111827}.docgeo-cas>div>div:last-child::before{content:"→";margin-right:.6em;color:#b6bcc6;font-size:13px}.docgeo-cas>.t>span{grid-row:auto}.docgeo-cas>.t>div:nth-child(2){padding-bottom:8px;font:italic 14px system-ui,-apple-system,"Segoe UI",sans-serif;color:#6b7280}.docgeo-cas>.t>div:last-child{display:none}</style>`,
);

interface Line {
    // What the line defines, with its variables if it is a function.
    name?: string;
    variables?: string[];
    // Its formula, null if it doesn't read as one.
    node: FormulaNode | null;
    output: DOMElement;
    shown?: string;
}

interface Pane {
    view: FigureView;
    box: DOMElement;
    lines: Line[];
}

const panes = new Map<construction, Pane[]>();

// KaTeX, as the texts load it: its own chunk.
let renderTeX: typeof import("./objects/latex").renderTeX | undefined;
void import("./objects/latex").then((module) => {
    renderTeX = module.renderTeX;
    panes.forEach((_, c) => compute(c));
});

const REFERENCE = /^\$(\d+)$/;
const NAMES = CAS_NAMES[LANG] ?? {};
// A line as typed, its commands named in the language.
const localized = (text: string): string =>
    text.replace(
        /"[^"]*"|(?<![\p{L}\p{N}_.$])(\p{L}+)(?=\s*\()/gu,
        (match, name?: string) => (name && NAMES[name]) || match,
    );
const VARIABLES = ["x", "y", "z", "t"];
const CONSTANTS: Record<string, "PI" | "INFINITY"> = {
    pi: "PI",
    inf: "INFINITY",
};

export function show(c: construction): void {
    let shown = panes.get(c);
    if (!shown) {
        shown = c.views.filter((view) => view.cas).map((view) => pane(c, view));
        panes.set(c, shown);
        c.updated = () => compute(c);
        compute(c);
    }
    shown.forEach(({ view, box }) => {
        const { style } = view.svg.dom() as SVGElement;
        box.att(
            "style",
            `left:${style.left};top:${style.top};width:${style.width};height:${style.height};box-shadow:${style.boxShadow}`,
        );
    });
}

export function hide(c: construction): void {
    panes.get(c)?.forEach(({ box }) => box.dispose());
    panes.delete(c);
    c.updated = undefined;
}

// Its lines read, under the editor's panels, which come after it.
function pane(c: construction, view: FigureView): Pane {
    const { lines } = view.cas!;
    const definitions = lines.map((text) => CAS_DEFINITION.exec(text));
    const names = new Set([
        ...c.OBJS.V.map(({ name }) => name),
        ...definitions.flatMap((definition) =>
            definition ? [definition[1]] : [],
        ),
    ]);
    const box = $.create("div").cls("docgeo-cas");
    document.body.prepend(box.dom());
    const pane = {
        view,
        box,
        lines: lines.map((text, k): Line => {
            const definition = definitions[k];
            let node: FormulaNode | null;
            try {
                node = withObjects(names, () =>
                    parseFormula(definition ? definition[3] : text),
                );
            } catch {
                node = null;
            }
            const output = $.create("div");
            const row = $.create("div").add(
                $.create("span").text(String(k + 1)),
                $.create("div").text(
                    node?.kind === "string" ? node.value : localized(text),
                ),
                output,
            );
            if (node?.kind === "string") row.cls("t");
            box.add(row);
            return {
                name: definition?.[1],
                variables: definition?.[2]
                    ?.split(",")
                    .map((variable) => variable.trim()),
                node,
                output,
            };
        }),
    };
    c.dgpad.casShown?.(box.dom() as HTMLElement, view);
    return pane;
}

// Each line's request built, its answer read, shown if it changed.
function compute(c: construction): void {
    const refresh = () => compute(c);
    const objects = {
        get: (name: string) => c.getObj(name),
    } as Map<string, construction_object>;
    const figureFunction = functionOf(objects, () => c.formulaView());
    const env = {
        resolveIdentifier: (name: string) =>
            c.getObj(name)?.scriptValue(c.space) ?? null,
        view: () => c.formulaView(),
    };
    const valueOf = (part: FormulaNode): string | null | undefined => {
        if (part.kind !== "identifier")
            return written(evaluateValue(part, env));
        const object = c.getObj(part.name);
        return object ? written(object.scriptValue(c.space)) : undefined;
    };
    panes.get(c)?.forEach((pane) => {
        const values = new Map<string, FormulaNode>();
        const functions = new Map<string, CasFunction>();
        const casFunction = (name: string) =>
            functions.get(name) ?? figureFunction(name);
        const trees: (FormulaNode | null)[] = [];
        const requests: string[] = [];
        // `Numeric(…)` or `KeepInput(…)`, unless the view or the figure
        // defines a function of this name.
        const lineCommand = (node: FormulaNode) =>
            node.kind === "userCall" &&
            LINE_COMMANDS.includes(node.name) &&
            node.args.length &&
            !casFunction(node.name)
                ? node
                : null;
        pane.lines.forEach((line, k) => {
            const command = line.node && lineCommand(line.node);
            const kept = command?.name === "KeepInput";
            const node = line.node && read(line.node, line.variables, k);
            trees.push(node);
            if (node?.kind === "string") return;
            if (line.name && node)
                if (line.variables)
                    functions.set(line.name, {
                        node,
                        variables: line.variables,
                        value: () => null,
                        functionOf: casFunction,
                    });
                else values.set(line.name, node);
            const built =
                kept || !node
                    ? null
                    : casRequest(node, false, casFunction, valueOf);
            // As GeoGebra evaluates it, the shorter of its normal and
            // gathered forms: √3 for √12 - √3, (x + 1)^2 kept.
            if (built && node!.kind !== "cas")
                built.request = `((dgu,dgv)->when(length(""+dgu)<=length(""+dgv),dgu,dgv))(regroup(normal(${built.request})),regroup(${built.request}))`;
            // To the digits asked for if any.
            if (built && command) {
                const digits = command.args[1];
                built.request = `evalf(${built.request}${digits?.kind === "number" && Number.isInteger(digits.value) && digits.value > 0 ? `,${digits.value}` : ""})`;
            }
            if (built) requests.push(built.request);
            const answer = built && cas.read(line, built.request, refresh);
            const tree =
                typeof answer === "string" &&
                casTree(answer, built!.read, false);
            let tex = "";
            if (kept) tex = texOf(command.args[0], []);
            else if (tree) {
                const names = built!.parameters.map(({ node }) =>
                    node.kind === "identifier" ? node.name : "?",
                );
                const unknown = solved(node!, built!.read, names);
                tex =
                    unknown && tree.kind === "vector"
                        ? `\\left\\{${tree.items.map((item) => `${unknown} = ${texOf(item, names)}`).join(", ")}\\right\\}`
                        : texOf(tree, names);
            } else if (answer !== undefined) tex = "?";
            if (line.name && (kept || tree))
                tex = `${name(line.name)}${line.variables ? `(${line.variables.map(name).join(", ")})` : ""} := ${tex}`;
            if (renderTeX && tex !== line.shown) {
                line.shown = tex;
                line.output.inner(tex && renderTeX(`\\displaystyle ${tex}`)[0]);
            }
        });
        pane.view.cas!.requests = requests;

        // `$n` the tree of line n before it, a name defined before by its
        // value, but a function's variables. Null if it reads a line after
        // it.
        function read(
            node: FormulaNode,
            bound: string[] = [],
            k: number,
        ): FormulaNode | null {
            const command = lineCommand(node);
            if (command) return read(command.args[0], bound, k);
            if (node.kind === "identifier") {
                const reference = REFERENCE.exec(node.name);
                if (reference) {
                    const n = +reference[1] - 1;
                    return n < k ? trees[n] : null;
                }
                // As typed in GeoGebra.
                const constant = CONSTANTS[node.name];
                if (constant && !c.getObj(node.name) && !values.has(node.name))
                    return { kind: "constant", name: constant };
                return (
                    (!bound.includes(node.name) && values.get(node.name)) ||
                    node
                );
            }
            if (node.kind === "cas")
                bound = [...bound, ...(casBound(node) ?? [])];
            const copy: Record<string, unknown> =
                node.kind === "userCall" &&
                node.name === "ln" &&
                !casFunction("ln")
                    ? { kind: "call", fn: "log", args: node.args }
                    : { ...node };
            for (const [key, value] of Object.entries(copy)) {
                const parts = Array.isArray(value) ? value : [value];
                if (!parts.some(isNode)) continue;
                const mapped = parts.map((part) =>
                    isNode(part) ? read(part, bound, k) : part,
                );
                if (mapped.includes(null)) return null;
                copy[key] = Array.isArray(value) ? mapped : mapped[0];
            }
            return copy as FormulaNode;
        }
    });
}

const isNode = (value: unknown): value is FormulaNode =>
    typeof (value as FormulaNode | null)?.kind === "string";

// A value Giac reads: an exact number, a list of them (a point…).
function written(value: ScriptValue | null): string | null {
    if (typeof value === "number")
        return Number.isFinite(value)
            ? rational(Number(value.toPrecision(15)))
            : null;
    if (!Array.isArray(value) || !value.length) return null;
    const items = value.map(written);
    return items.includes(null) ? null : `[${items.join(",")}]`;
}

// The unknown of a Solve or CSolve, whose solutions are shown as
// equations, as GeoGebra's.
function solved(
    node: FormulaNode,
    read: Set<string>,
    names: string[],
): string | null {
    if (node.kind !== "cas" || !node.fn.endsWith("Solve")) return null;
    const [, unknown] = node.args;
    if (unknown?.kind === "identifier") return name(unknown.name);
    const variable =
        VARIABLES.find((variable) => read.has(variable)) ??
        [...read].find((symbol) => SYMBOL.test(symbol));
    return variable
        ? texOf({ kind: "identifier", name: variable }, names)
        : "x";
}

const name = (text: string): string =>
    text.length > 1
        ? `\\mathrm{${text.replace(/_/g, "\\_")}}`
        : text.replace(/_/g, "\\_");

const FUNCTIONS: Record<string, string> = {
    log: "\\ln",
    sin: "\\sin",
    cos: "\\cos",
    tan: "\\tan",
    asin: "\\arcsin",
    acos: "\\arccos",
    atan: "\\arctan",
};

const product = (left: FormulaNode, right: FormulaNode): FormulaNode =>
    left.kind === "number" && left.value === 1
        ? right
        : { kind: "binary", op: "*", left, right };

// A product's numerator and denominator, its divisions gathered.
function fraction(node: FormulaNode): [FormulaNode, FormulaNode | null] {
    if (node.kind !== "binary" || !"*/".includes(node.op)) return [node, null];
    const [numerator, denominator] = fraction(node.left);
    return node.op === "/"
        ? [
              numerator,
              denominator ? product(denominator, node.right) : node.right,
          ]
        : [denominator ? product(numerator, node.right) : node, denominator];
}

// As GeoGebra shows it: 2x, fractions, roots, lists in braces.
function texOf(node: FormulaNode, names: string[]): string {
    const tex = (part: FormulaNode) => texOf(part, names);
    // In parentheses where an operator binds tighter.
    const operand = (part: FormulaNode, sums: boolean, products = false) =>
        (part.kind === "binary" &&
            ((sums && /^[-+]|==$/.test(part.op)) ||
                (products && "*/".includes(part.op)))) ||
        (part.kind === "unary" && products)
            ? `\\left(${tex(part)}\\right)`
            : tex(part);
    switch (node.kind) {
        case "number":
            return String(node.value).replace(
                /e\+?(-?\d+)$/,
                " \\cdot 10^{$1}",
            );
        case "constant":
            return node.name === "PI"
                ? "\\pi"
                : node.name === "E"
                  ? "e"
                  : node.name === "INFINITY"
                    ? "\\infty"
                    : `\\sqrt{${node.name === "SQRT2" ? 2 : "\\frac{1}{2}"}}`;
        case "imaginary":
            return "i";
        case "identifier": {
            if (node.name === "pi") return "\\pi";
            const symbol = SYMBOL.exec(node.name);
            return name(symbol ? names[+symbol[1]] : node.name);
        }
        case "unary":
            return `-${operand(node.operand, true)}`;
        case "binary": {
            const { op, left, right } = node;
            if (op === "==") return `${tex(left)} = ${tex(right)}`;
            // Giac's 1/2*h/n, h/(2n).
            if (op === "/") {
                const [numerator, denominator] = fraction(node);
                return `\\frac{${tex(numerator)}}{${tex(denominator!)}}`;
            }
            if (op === "^")
                return `${
                    left.kind === "identifier" ||
                    left.kind === "constant" ||
                    (left.kind === "number" && left.value >= 0)
                        ? tex(left)
                        : `\\left(${tex(left)}\\right)`
                }^{${tex(right)}}`;
            if (op === "+") {
                const sum = tex(right);
                return `${tex(left)} ${sum.startsWith("-") ? "" : "+ "}${sum}`;
            }
            if (op === "-") return `${tex(left)} - ${operand(right, true)}`;
            const factor = operand(right, true, right.kind === "unary");
            return `${operand(left, true)}${/^\d/.test(factor) ? " \\cdot " : " "}${factor}`;
        }
        case "vector":
            return `\\left\\{${node.items.map(tex).join(", ")}\\right\\}`;
        // As typed, a line's input kept.
        case "userCall":
        case "cas":
            return `${name(node.kind === "cas" ? (NAMES[node.fn] ?? node.fn) : node.name)}\\left(${node.args.map(tex).join(", ")}\\right)`;
        case "call": {
            const arg = tex(node.args[0]);
            if (node.fn === "sqrt") return `\\sqrt{${arg}}`;
            if (node.fn === "abs") return `\\left|${arg}\\right|`;
            if (node.fn === "exp") return `e^{${arg}}`;
            return `${FUNCTIONS[node.fn]}\\left(${arg}\\right)`;
        }
    }
    return "?";
}
