import { construction, type DgpadLike } from "../construction";
import {
    addDgoEntries,
    describeDgo,
    figureObjects,
    LOOKS,
    readDgo,
    type DgoFigure,
} from "../dgo";
import {
    expressionContent,
    type ExpressionContent,
} from "../import/dgp_expression";
import {
    formulaIdentifiers,
    formulaSource,
    parseFormula,
    parseProgram,
    programNodes,
    programReferences,
    programTargets,
    withObjects,
} from "../import/dgp_formula";
import { angle_object } from "../objects/angle_object";
import { construction_object } from "../objects/construction_object";
import {
    equationCoeffs,
    equationValue,
    type Equation,
} from "../objects/equation_conic_object";
import { expression_object } from "../objects/expression_object";
import { fixed_angle_object } from "../objects/fixed_angle_object";
import type { formula_point_object } from "../objects/formula_point_object";
import { point_on_object } from "../objects/point_on_object";
import { point_object } from "../objects/point_object";
import { polygon_object } from "../objects/polygon_object";
import { primitive_quadric_object } from "../objects/primitive_quadric_object";
import type { Vec2, Vec3 } from "../vec";
import {
    commandName,
    COMMANDS,
    decodeEntry,
    findCommand,
    overloadFor,
    type Arg,
    type Overload,
} from "./catalog";
import {
    formatName,
    formatNumber,
    pointFormulaText,
    renameFormula,
    TextError,
    unknownMethod,
    type Line,
} from "./text";

// The figure being edited, as .dgo entries: see EDITOR.md.

export interface Studio extends DgpadLike {
    scene: construction;
}

// What a line, or a gesture, defines.
export interface Spec {
    name: string;
    overload: Overload;
    args: Arg[];
}

export const FREE_POINT: Overload = {
    params: ["number", "number"],
    variadic: true,
    tag: "Pt",
    encode: (args) => args,
};

const POINT_TAGS = new Set([
    "Pt",
    "Fix",
    "Fp",
    "On",
    "Mid",
    "Sym",
    "Refl",
    "Rot",
    "Dil",
    "Tra",
    "Ctr",
    "Int",
]);
export const isPointTag = (tag: string): boolean => POINT_TAGS.has(tag);

// Whether the figure writes its name when shown: a point's, or that of an
// object the engine places it beside, as GeoGebra does (nameAt).
export const hasName = (object: construction_object): boolean =>
    object instanceof point_object ||
    object.nameAt !== construction_object.prototype.nameAt;

// Free in formulas, or easily mistaken.
const RESERVED = new Set(["e", "i", "k", "l", "o", "t", "x", "y", "z"]);

// A point's name is a capital letter, any other object's a small one, then
// numbered; not `taken`, about to be given.
export function nextName(
    c: construction,
    point: boolean,
    taken?: string,
): string {
    const letters = [
        ...(point
            ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
            : "abcdefghijklmnopqrstuvwxyz"),
    ].filter((letter) => !RESERVED.has(letter));
    for (let number = 0; ; number++)
        for (const letter of letters) {
            const name = number ? `${letter}${number}` : letter;
            if (!c.getObj(name) && name !== taken) return name;
        }
}

export const figureIndex = (
    c: construction,
): Map<construction_object, number> =>
    new Map(figureObjects(c).map((object, index) => [object, index]));

// Its .dgo type and parameters.
export const entryOf = (
    object: construction_object,
    index: ReadonlyMap<construction_object, number>,
): [string, unknown] =>
    object.dgo({
        index: (other) => index.get(other)!,
        image: (url) => url,
        screen: (position) => position,
    });

export const formatArg = (arg: Arg): string =>
    typeof arg === "number" ? formatNumber(arg) : formatName(arg.name);

const formatValue = (value: unknown): string =>
    typeof value === "number"
        ? formatNumber(value)
        : Array.isArray(value)
          ? `[${value.map(formatValue).join(", ")}]`
          : JSON.stringify(value);

// A formula written with the names of the objects it reads.
const renamed = (
    source: string,
    refs: ReadonlyMap<string, construction_object>,
): string =>
    renameFormula(source, (name) => {
        const ref = refs.get(name);
        return ref && formatName(ref.name);
    });

// Its value, or its formula.
export function expressionSource({
    formula,
    program,
    value,
}: expression_object): string {
    if (!formula && !program) return formatValue(value);
    return formula
        ? renamed(formula.source, formula.refs)
        : renamed(
              formulaSource(program!.program),
              new Map([...program!.refs, ...program!.targets]),
          );
}

// On one line, the grammar reading no line break.
const oneLine = (source: string): string => source.replace(/\s*\n\s*/g, " ");

// Its line, null when no command writes it.
// What the object's name means in a formula, shown below its line unless
// the line says it.
export function valueText(
    object: construction_object,
    line: string | null,
    vec3: boolean,
): string {
    const value = object.scriptValue(vec3);
    if (value === null) return "";
    const degrees =
        object.C.degrees &&
        (object instanceof angle_object ||
            object instanceof fixed_angle_object);
    const text =
        object instanceof point_object
            ? `(${(value as number[]).map(formatNumber).join(", ")})`
            : `${formatValue(value)}${degrees ? "°" : ""}`;
    return line?.endsWith(` = ${text}`) ? "" : `= ${text}`;
}

export function lineOf(
    object: construction_object,
    index: ReadonlyMap<construction_object, number>,
    objects: construction_object[],
): string | null {
    const [tag, parameters] = entryOf(object, index);
    const name = formatName(object.name);
    if (tag === "Pt") {
        // In space, its three coordinates.
        const { pinned, coords } = object as point_object;
        const shown =
            object.C.GRID.is2D || pinned ? (parameters as number[]) : coords;
        return `${name} = (${shown.map(formatNumber).join(", ")})`;
    }
    if (tag === "Fp") {
        const { formula, refs } = object as formula_point_object;
        return `${name} = ${pointFormulaText(oneLine(renamed(formulaSource(formula), refs)))}`;
    }
    if (EQUATIONS.includes(tag)) {
        const { equation } = object as unknown as { equation: Equation };
        return `${name} = ${equation.map((side) => oneLine(renamed(side.source, side.refs))).join(" = ")}`;
    }
    const decoded = decodeEntry(tag, parameters, (at) => objects[at]);
    if (decoded)
        return `${name} = ${commandName(decoded.command)}(${decoded.args.map(formatArg).join(", ")})`;
    const { mn, mx } = parameters as Record<string, unknown>;
    // Not a slider whose bounds are formulas.
    if (tag !== "Ex" || (mn !== undefined && mx !== undefined)) return null;
    return `${name} = ${oneLine(expressionSource(object as expression_object))}`;
}

// What the line defines, `target` being the object it redefines.
export function resolve(
    c: construction,
    { name, definition }: Line,
    target?: construction_object,
): Spec {
    const own = new Set(figureObjects(c));
    let overload: Overload | undefined = FREE_POINT;
    let args: Arg[];
    if (definition!.kind === "point") args = definition!.coords;
    else if (definition!.kind === "formula")
        ({ overload, args } = expression(c, definition!.source, target));
    else if (definition!.kind === "pointFormula")
        ({ overload, args } = formulaPoint(c, definition!.source));
    else if (definition!.kind === "equation")
        ({ overload, args } = equation(c, definition!.sides));
    else {
        const call = definition!;
        const command = findCommand(call.command);
        if (!command) throw new TextError("unknown_command", call.command);
        args = call.args.map((arg) => {
            if (arg.kind === "number") return arg.value;
            const object = c.getObj(arg.name);
            if (!object || !own.has(object))
                throw new TextError("unknown_object", arg.name);
            return object;
        });
        overload = overloadFor(command, args, !c.GRID.is2D);
        if (!overload) {
            // A command split from another keeps its name in its own:
            // Circumcircle, OtherIntersection, FixedPoint.
            const other = COMMANDS.find(
                (other) =>
                    other !== command &&
                    commandName(other)
                        .toLowerCase()
                        .includes(commandName(command).toLowerCase()) &&
                    overloadFor(other, args, !c.GRID.is2D),
            );
            if (other)
                throw new TextError(
                    "instead",
                    `${commandName(other)}(${args.map(formatArg).join(", ")})`,
                );
            throw new TextError("arguments", commandName(command));
        }
        if (overload.tag === "Int" && overload.params[2] === "number") {
            const branch = args[2] as number;
            if (!Number.isInteger(branch) || branch < 1 || branch > 4)
                throw new TextError("branch");
        }
        // A slider.
        if (overload.tag === "Ex") {
            const { encode } = overload;
            const values = args;
            ({ overload, args } = expressionSpec(
                c,
                target,
                (index) => encode(values, index) as object,
                values.filter(
                    (arg): arg is construction_object =>
                        typeof arg !== "number",
                ),
            ));
        }
    }
    const chosen =
        name ?? target?.name ?? nextName(c, isPointTag(overload.tag));
    const named = c.getObj(chosen);
    if (named && named !== target) throw new TextError("name_taken", chosen);
    return { name: chosen, overload, args };
}

// Under the expressions the window shows, as DGPad's calculator stacks them.
function freeSpot(c: construction): Vec2 {
    const shown = figureObjects(c).filter(
        (object): object is expression_object =>
            object instanceof expression_object &&
            !object.anchor &&
            !object.hidden,
    );
    // A slider's track is under its value.
    const bottoms = shown.map(
        ({ screen, isCursor }) => screen[1] + (isCursor ? 30 : 0),
    );
    return [20, Math.max(10, ...bottoms) + 30];
}

// An expression's entry, its nature told by the text (see EDITOR.md).
function expression(
    c: construction,
    source: string,
    target?: construction_object,
): { overload: Overload; args: Arg[] } {
    const own = new Map(
        figureObjects(c).map((object) => [object.name, object]),
    );
    let content: ExpressionContent;
    try {
        content = withObjects(new Set(own.keys()), () =>
            expressionContent(source, own),
        );
    } catch {
        const method = unknownMethod(source);
        throw new TextError(
            method ? "unknown_method" : "syntax",
            method ?? source,
        );
    }
    // A constant written otherwise than its value (`3i-9`, not `[-9, 3]`)
    // keeps its text, as a formula.
    if (
        content.kind === "v" &&
        Array.isArray(content.value) &&
        source.replace(/\s/g, "") !==
            formatValue(content.value).replace(/\s/g, "")
    )
        content = { kind: "s", program: parseProgram(source) };
    const names =
        content.kind === "v"
            ? []
            : content.kind === "f"
              ? [...formulaIdentifiers(content.node)].filter(
                    (name) => !content.variables.includes(name),
                )
              : [
                    ...programReferences(content.program),
                    ...programTargets(content.program),
                ];
    const named = new Map(
        names.map((name) => {
            const object = own.get(name);
            if (object) return [name, object];
            const called =
                content.kind !== "v" &&
                programNodes(content.program).some(
                    (node) => node.kind === "userCall" && node.name === name,
                );
            throw new TextError(
                called ? "unknown_command" : "unknown_object",
                name,
            );
        }),
    );
    return expressionSpec(
        c,
        target,
        (index) => ({
            [content.kind]:
                content.kind === "v"
                    ? content.value
                    : formulaParameter(source, named, index),
        }),
        [...named.values()],
    );
}

// A formula's .dgo parameter, the objects it names given by their index.
const formulaParameter = (
    source: string,
    named: ReadonlyMap<string, construction_object>,
    index: (object: construction_object) => number,
): unknown =>
    named.size
        ? [
              source,
              Object.fromEntries(
                  [...named].map(([name, object]) => [name, index(object)]),
              ),
          ]
        : source;

// A point computed by a formula: the coordinates, or a point, it gives.
function formulaPoint(
    c: construction,
    source: string,
): { overload: Overload; args: Arg[] } {
    const own = new Map(
        figureObjects(c).map((object) => [object.name, object]),
    );
    let references: Set<string>;
    try {
        references = programReferences(
            withObjects(new Set(own.keys()), () => parseProgram(source)),
        );
    } catch {
        throw new TextError("syntax", source);
    }
    const named = new Map(
        [...references].map((name) => {
            const object = own.get(name);
            if (!object) throw new TextError("unknown_object", name);
            return [name, object];
        }),
    );
    return {
        overload: {
            params: [],
            tag: "Fp",
            encode: (_, index) => [formulaParameter(source, named, index)],
        },
        args: [...named.values()],
    };
}

const EQUATIONS = ["EqL", "EqC", "EqQ"];

// A line, a circle or a conic, as the equation's coefficients are now: of
// degree 1, 2 with one coefficient for x² and y² and none for xy, or 2.
function equation(
    c: construction,
    sides: string[],
): { overload: Overload; args: Arg[] } {
    const own = new Map(
        figureObjects(c).map((object) => [object.name, object]),
    );
    const formulas = sides.map((source) => {
        const node = withObjects(new Set(own.keys()), () => {
            try {
                return parseFormula(source);
            } catch {
                throw new TextError("syntax", source);
            }
        });
        const names = [...formulaIdentifiers(node)].filter(
            (name) => name !== "x" && name !== "y",
        );
        const refs = new Map(
            names.map((name) => {
                const object = own.get(name);
                if (!object) throw new TextError("unknown_object", name);
                return [name, object];
            }),
        );
        return { node, source, variables: ["x", "y"], refs, vec3: false };
    }) as Equation;
    const coeffs = equationCoeffs(formulas, c);
    const scale = Math.max(...(coeffs ?? []).map(Math.abs));
    const zero = (value: number) => Math.abs(value) <= 1e-9 * scale;
    // Its other values are those of its polynomial.
    if (
        !coeffs ||
        !scale ||
        [
            [2, 3],
            [-3, 1.5],
            [0.5, -2],
        ].some(([x, y]) => {
            const [a, b, cc, d, e, f] = coeffs;
            return !zero(
                equationValue(formulas, c, [x, y]) -
                    (a * x * x + b * x * y + cc * y * y + d * x + e * y + f),
            );
        })
    )
        throw new TextError("degree");
    const [a, b, cc] = coeffs;
    const tag =
        zero(a) && zero(b) && zero(cc)
            ? "EqL"
            : zero(b) && zero(a - cc)
              ? "EqC"
              : "EqQ";
    return {
        overload: {
            params: [],
            tag,
            encode: (_, index) =>
                formulas.map(({ source, refs }) =>
                    formulaParameter(source, refs, index),
                ),
        },
        args: [...new Set(formulas.flatMap(({ refs }) => [...refs.values()]))],
    };
}

// An expression's entry, `own` giving its value's keys, `parents` the
// objects they name. Redefined, an expression keeps its text, place and
// anchor.
function expressionSpec(
    c: construction,
    target: construction_object | undefined,
    own: (index: (object: construction_object) => number) => object,
    parents: construction_object[],
): { overload: Overload; args: Arg[] } {
    const kept = target instanceof expression_object ? target : null;
    const spot = freeSpot(c);
    return {
        overload: {
            params: [],
            tag: "Ex",
            encode: (_, index) => {
                const { v, f, s, mn, mx, ...rest } = kept
                    ? (kept.dgo({
                          index,
                          image: (url) => url,
                          screen: (position) => position,
                      })[1] as Record<string, unknown>)
                    : { t: "", xy: spot };
                return { ...rest, ...own(index) };
            },
        },
        args: [...parents, ...(kept?.anchor ? [kept.anchor] : [])],
    };
}

// Points in DocGeo's own style, named, those built from others in DGPad's
// grey; regions filled, expressions shown, as by DGPad's tools.
function createdStyle(tag: string): Record<string, unknown> | undefined {
    if (isPointTag(tag))
        return {
            c: "#604820",
            fc: tag === "Pt" || tag === "On" ? "#e4ceb9" : "#cccccc",
            o: 1,
            sn: 1,
            f: 26,
        };
    if (tag === "Poly" || tag === "Sph" || tag === "Sec") return { o: 0.2 };
    // Its value shown, as by DGPad's calculator.
    if (tag === "Ex") return { p: 2, f: 24 };
}

// The stroke and fill colors a tool gives a new object of its type.
export function createdColors(object: construction_object): [string, string] {
    const tag = entryOf(object, new Map())[0];
    const [fill, stroke] = LOOKS[tag];
    const style = createdStyle(tag) as Record<string, string> | undefined;
    return [style?.c ?? stroke, style?.fc ?? style?.c ?? fill];
}

// Adds the object after the others, `styled` as by DGPad's tools.
export function add(
    c: construction,
    { name, overload, args }: Spec,
    styled = true,
): construction_object {
    const index = figureIndex(c);
    const style = styled ? createdStyle(overload.tag) : undefined;
    c.beginBatch();
    addDgoEntries(
        c,
        [
            [
                overload.tag,
                name,
                overload.encode(args, (object) => index.get(object)!),
                ...(style ? [0] : []),
            ],
        ],
        style ? [style] : [],
    );
    c.endBatch();
    return c.getObj(name)!;
}

// A point on the support, where `at` is.
export function addPointOn(
    c: construction,
    name: string,
    support: construction_object,
    at: Vec3,
): point_on_object {
    const pair =
        support instanceof polygon_object ||
        support instanceof primitive_quadric_object;
    const point = add(c, {
        name,
        overload: findCommand("Point")!.overloads[pair ? 1 : 0],
        args: pair ? [support, 0, 0] : [support, 0],
    }) as point_on_object;
    const alpha = point.alphaFor(at);
    if (alpha !== null) point.alpha = alpha;
    c.invalidateGeometry(point);
    c.flush();
    return point;
}

export function descendants(
    object: construction_object,
): Set<construction_object> {
    const found = new Set<construction_object>();
    const pending = [object];
    while (pending.length) {
        const next = pending.pop()!;
        if (found.has(next)) continue;
        found.add(next);
        pending.push(...next.children);
    }
    return found;
}

// Style keys every type has.
const COMMON_STYLE = [
    "c",
    "fc",
    "s",
    "o",
    "h",
    "sn",
    "f",
    "p",
    "l",
    "dh",
    "lo",
    "sc",
];

// What a program styles, which comes before it in the figure though it is
// recomputed after it.
const styled = (object: construction_object): construction_object[] =>
    object instanceof expression_object && object.program
        ? [...object.program.targets.values()]
        : [];

// The objects its entry names, which come before it.
const entryParents = (object: construction_object): construction_object[] => [
    ...object.parents.filter(
        (parent) =>
            parent !== object.condition && !styled(parent).includes(object),
    ),
    ...styled(object),
];

// Rebuilds the figure, `target` redefined: the objects are reordered so that
// each comes after those it is built from.
export async function redefine(
    studio: Studio,
    target: construction_object,
    { name, overload, args }: Spec,
): Promise<void> {
    const c = studio.scene;
    const parents = args.filter(
        (arg): arg is construction_object => typeof arg !== "number",
    );
    const objects = figureObjects(c);
    // Each object's entry naming only earlier ones, one pass finds those
    // that name it, directly or not.
    const after = new Set([target]);
    objects.forEach((object) => {
        if (entryParents(object).some((parent) => after.has(parent)))
            after.add(object);
    });
    if (parents.some((parent) => after.has(parent)))
        throw new TextError("cycle");
    const own = new Set(objects);
    const placed = new Set<construction_object>();
    const order: construction_object[] = [];
    // Depth first, each object after its parents, without recursion: a
    // figure can chain thousands of objects.
    objects.forEach((root) => {
        const stack: [construction_object, boolean][] = [[root, false]];
        while (stack.length) {
            const [object, ready] = stack.pop()!;
            if (ready) {
                order.push(object);
                continue;
            }
            if (placed.has(object)) continue;
            placed.add(object);
            stack.push([object, true]);
            (object === target ? parents : entryParents(object))
                .filter((parent) => own.has(parent) && !placed.has(parent))
                .reverse()
                .forEach((parent) => stack.push([parent, false]));
        }
    });
    const internal = c.OBJS.V.filter((object) => !placed.has(object));
    c.OBJS.V = [...internal, ...order];
    const figure = await describeDgo(c);
    const position = order.indexOf(target);
    const [tag, , , style] = figure.o[position] as [
        string,
        string,
        unknown,
        number?,
    ];
    const entry: unknown[] = [
        overload.tag,
        name,
        overload.encode(args, (object) => order.indexOf(object)),
    ];
    if (style !== undefined) {
        const kept =
            tag === overload.tag
                ? figure.st![style]
                : Object.fromEntries(
                      Object.entries(figure.st![style]).filter(([key]) =>
                          COMMON_STYLE.includes(key),
                      ),
                  );
        figure.st!.push(kept);
        entry.push(figure.st!.length - 1);
    }
    figure.o[position] = entry;
    rebuild(studio, figure);
}

export function rebuild(studio: Studio, figure: DgoFigure): void {
    studio.scene.dispose();
    studio.scene = construction.create(studio);
    readDgo(studio.scene, figure);
    studio.scene.flush();
    studio.scene.reveal();
}
