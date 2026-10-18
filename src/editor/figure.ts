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
    FUNCTION_VARIABLES,
    type ExpressionContent,
} from "../import/dgp_expression";
import {
    formulaIdentifiers,
    formulaSource,
    parseFormula,
    parseProgram,
    programNodes,
    programReferences,
    globalName,
    globalOf,
    programTargets,
    turtleList,
    withObjects,
    type FormulaNode,
} from "../import/dgp_formula";
import { angle_object } from "../objects/angle_object";
import { construction_object } from "../objects/construction_object";
import type { curve_object } from "../objects/curve_object";
import {
    equationCoeffs,
    equationValue,
    type Equation,
} from "../objects/equation_conic_object";
import { expression_object } from "../objects/expression_object";
import { expression_list_object } from "../objects/expression_list_object";
import { fixed_angle_object } from "../objects/fixed_angle_object";
import type { formula_point_object } from "../objects/formula_point_object";
import { point_on_object } from "../objects/point_on_object";
import { point_object } from "../objects/point_object";
import { plane_object } from "../objects/plane_object";
import { polygon_object } from "../objects/polygon_object";
import { panelNames, parsePanel, panel_object } from "../objects/panel_object";
import { normalOf } from "../objects/polyhedron_object";
import { primitive_quadric_object } from "../objects/primitive_quadric_object";
import { list_object, type ListNature } from "../objects/list_object";
import {
    sequenceShape,
    type sequence_object,
} from "../objects/sequence_object";
import { vDot, vScale, vSub, type Vec2, type Vec3 } from "../vec";
import {
    commandName,
    COMMANDS,
    decodeEntry,
    findCommand,
    FormulaArg,
    isCommand,
    TextArg,
    overloadFor,
    argObjects,
    type Arg,
    type Overload,
} from "./catalog";
import {
    formatName,
    coordinatesText,
    formatNumber,
    parseLine,
    pointFormulaText,
    quoteText,
    renameFormula,
    splitProducts,
    TextError,
    unknownMethod,
    type ArgText,
    type Definition,
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

// `u = (1, 2)`, named with a small letter, as in GeoGebra.
const FREE_VECTOR: Overload = { ...FREE_POINT, tag: "VecF" };

// The floor, the plane z = 0 (GeoGebra's xOyPlane): the figure's plane of
// that equation, or one added hidden, the floor being drawn already.
export function floorOf(c: construction): plane_object | undefined {
    return figureObjects(c).find(
        (object): object is plane_object =>
            object instanceof plane_object &&
            object.definition.tag === "PlE" &&
            object.definition.equation[0].source === "z" &&
            object.definition.equation[1].source === "0",
    );
}

export function addFloor(
    c: construction,
    name = nextName(c, false),
    hidden = 1,
) {
    const floor = add(c, {
        name,
        overload: { params: [], tag: "PlE", encode: () => ["z", "0"] },
        args: [],
    });
    floor.hidden = hidden;
    floor.updateView();
    return floor as plane_object;
}

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
    "TC",
    "Vtx",
    "Inv",
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

// As GeoGebra names them, π being a number.
const LETTERS: Record<string, string> = {
    Vec: "uvw",
    VecF: "uvw",
    Ang: "αβγδεζηθκλμνξρστυφχψω",
};

// A point's name is a capital letter, a vector's u, v or w, an angle's a
// Greek letter, any other object's a small one, then numbered; not `taken`,
// about to be given. `kind` is true for a point, or the object's type.
export function nextName(
    c: construction,
    kind: boolean | string,
    taken?: string,
): string {
    const letters = [
        ...(kind === true || (typeof kind === "string" && isPointTag(kind))
            ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
            : (LETTERS[kind as string] ?? "abcdefghijklmnopqrstuvwxyz")),
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
    typeof arg === "number"
        ? formatNumber(arg)
        : arg instanceof FormulaArg
          ? oneLine(renamed(arg.source, arg.refs))
          : arg instanceof TextArg
            ? quoteText(renamedText(arg))
            : formatName(arg.name);

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

// A text written with the names of the objects it reads: in its formulas
// ("%…%"), outside the tags of a panel's HTML, and its fields' targets.
function renamedText({ text, refs, html }: TextArg): string {
    const formulas = (source: string) =>
        source
            .split("%")
            .map((part, index) =>
                index % 2 && part ? renamed(part, refs) : part,
            )
            .join("%");
    if (!html) return formulas(text);
    return text
        .replace(
            /(^|>)([^<]*)/g,
            (_, tag: string, between: string) => tag + formulas(between),
        )
        .replace(
            /(\btarget\s*=\s*(["']?))([^"'\s>]+)\2/gi,
            (_, before: string, quote: string, name: string) =>
                before + (refs.get(name)?.name ?? name) + quote,
        );
}

// What the properties' definition edits: an expression's value, formula or
// program, a panel's HTML.
export function definitionSource(
    object: expression_object | panel_object,
): string {
    return object instanceof panel_object
        ? renamedText(new TextArg(object.content, object.refs, true))
        : expressionSource(object);
}

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
    // A list's values are what it draws.
    const value =
        object instanceof list_object ? null : object.scriptValue(vec3);
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
    if (tag === "Cur") {
        const { formula, min, max } = object as curve_object;
        return min === null && max === null
            ? `${name}(x) = ${oneLine(renamed(formula.source, formula.refs))}`
            : null;
    }
    if (tag === "Seq") {
        const { nature, loops, formulas, refs } = object as sequence_object;
        const text = (formula: FormulaNode) => {
            const source = oneLine(renamed(formulaSource(formula), refs));
            return coordinatesText(source, true) ?? source;
        };
        const items = formulas.map(text).join(", ");
        let body =
            nature === "point"
                ? items
                : `${commandName(findCommand(ITEM_COMMANDS[nature]!)!)}(${items})`;
        for (const { variable, from, to, step } of [...loops].reverse())
            body = `${commandName(findCommand("Sequence")!)}(${[
                body,
                variable,
                ...[from, to, ...(step ? [step] : [])].map(text),
            ].join(", ")})`;
        return `${name} = ${body}`;
    }
    if (tag === "VecF")
        return `${name} = (${(parameters as number[]).map(formatNumber).join(", ")})`;
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
        const { equation } = (object instanceof plane_object
            ? object.definition
            : object) as unknown as { equation: Equation };
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
    if (definition!.kind === "point") {
        args = definition!.coords;
        // A free point stays one.
        const kept = target && entryOf(target, figureIndex(c))[0];
        if (
            kept !== "Pt" &&
            (kept === "VecF" || /^\p{Ll}/u.test(name ?? target?.name ?? ""))
        )
            overload = FREE_VECTOR;
    } else if (definition!.kind === "formula")
        ({ overload, args } = expression(c, definition!.source, target));
    else if (definition!.kind === "pointFormula")
        ({ overload, args } = formulaPoint(c, definition!.source));
    else if (definition!.kind === "equation")
        ({ overload, args } = equation(c, definition!.sides));
    else if (definition!.kind === "curve")
        ({ overload, args } = curve(c, definition!.source));
    else if (findCommand(definition!.command)?.name === "Sequence")
        ({ overload, args } = sequence(c, definition!.args));
    else {
        const call = definition!;
        const command = findCommand(call.command);
        if (!command) throw new TextError("unknown_command", call.command);
        args = call.args.map((arg) => {
            if (arg.kind === "number") return arg.value;
            if (arg.kind === "string")
                return textArg(c, arg.value, command.name === "Html");
            if (arg.kind === "formula") return formulaArg(c, arg.source);
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
        if (
            overload.tag === "Tan" &&
            overload.params[2] === "number" &&
            args[2] !== 1 &&
            args[2] !== 2
        )
            throw new TextError("tangent_branch");
        // A polygon's number of sides, a vertex's rank.
        const count = args[overload.params.indexOf("number")] as number;
        if (
            (overload.tag === "RegP" || overload.tag === "Vtx") &&
            !(
                Number.isInteger(count) &&
                count >= (overload.tag === "Vtx" ? 1 : 3)
            )
        )
            throw new TextError("arguments", commandName(command));
        if (overload.tag === "Img" && args.length > 3)
            throw new TextError("arguments", commandName(command));
        if (["Txt", "Html", "Img"].includes(overload.tag))
            overload = keeping(overload, target);
        // A slider.
        if (overload.tag === "Ex") {
            const { encode } = overload;
            const values = args;
            ({ overload, args } = expressionSpec(
                c,
                target,
                (index) => encode(values, index) as object,
                argObjects(values),
            ));
        }
    }
    const chosen = name ?? target?.name ?? nextName(c, overload.tag);
    const named = c.getObj(chosen);
    if (named && named !== target) throw new TextError("name_taken", chosen);
    return { name: chosen, overload, args };
}

// Unsaid by its line, as null: a text's offset, a panel's frame, an image's
// file and size, those of the object it redefines; an image comes with its
// file only.
const UNSAID: Record<string, unknown[]> = {
    Txt: [, [0, 0]],
    Html: [[20, 20, 300, 150], 15],
};

function keeping(
    overload: Overload,
    target: construction_object | undefined,
): Overload {
    const [tag, parameters] = target
        ? entryOf(target, new Map())
        : [null, null];
    const kept = tag === overload.tag ? (parameters as unknown[]) : null;
    if (overload.tag === "Img" && !kept) throw new TextError("image_file");
    return {
        ...overload,
        encode: (args, index) =>
            (overload.encode(args, index) as unknown[]).map(
                (value, at) => value ?? kept?.[at] ?? UNSAID[overload.tag][at],
            ),
    };
}

// What a slider stands for when no object has the name, as in GeoGebra: a
// name starting with a small letter, but the formulas' own.
const SLIDER_NAME = /^\p{Ll}[\p{L}\p{N}_]*$/u;
const FREE_NAMES = new Set([...FUNCTION_VARIABLES, "e", "i", "π"]);

// The line resolved as GeoGebra reads it, `ax^2 + bx` being a x^2 + b x
// (see splitProducts), a slider added first for each name it reads that no
// object has, which `added` gets: the caller undoes them if the line is
// refused.
export function resolveWithSliders(
    c: construction,
    line: Line,
    target: construction_object | undefined,
    added: construction_object[],
): Spec {
    const split = (source: string) =>
        splitProducts(source, (name) => !!c.getObj(name));
    const definition = line.definition && products(line.definition, split);
    return resolveAdding(c, { ...line, definition }, target, added, (name) =>
        SLIDER_NAME.test(name) && !FREE_NAMES.has(name) && name !== line.name
            ? addSlider(c, name)
            : null,
    );
}

// The line resolved, a global added first for each one it names that no
// object holds, which `added` gets: the caller removes them if the line is
// refused.
export const resolveWithGlobals = (
    c: construction,
    line: Line,
    target: construction_object | undefined,
    added: construction_object[],
): Spec => resolveAdding(c, line, target, added, () => null);

function resolveAdding(
    c: construction,
    line: Line,
    target: construction_object | undefined,
    added: construction_object[],
    missing: (name: string) => construction_object | null,
): Spec {
    for (;;) {
        try {
            return resolve(c, line, target);
        } catch (error) {
            const name =
                error instanceof TextError && error.key === "unknown_object"
                    ? error.detail
                    : "";
            const global = globalOf(name);
            const object =
                global !== null ? addGlobal(c, global) : missing(name);
            if (!object) throw error;
            added.push(object);
        }
    }
}

function products(
    definition: Definition,
    split: (source: string) => string,
): Definition {
    switch (definition.kind) {
        case "formula":
        case "pointFormula":
        case "curve":
            return { ...definition, source: split(definition.source) };
        case "equation":
            return {
                ...definition,
                sides: definition.sides.map(split) as [string, string],
            };
        case "call":
            return {
                ...definition,
                args: definition.args.map((arg) =>
                    arg.kind === "formula"
                        ? { ...arg, source: split(arg.source) }
                        : arg,
                ),
            };
    }
    return definition;
}

// From −5 to 5 by 0.1; of a Greek letter, an angle, from 0 to 360° by 1°.
function addSlider(c: construction, name: string): expression_object {
    const angle = /^\p{Script=Greek}/u.test(name);
    const [min, max, value, step]: [number, number | string, number, number] =
        !angle
            ? [-5, 5, 1, 0.1]
            : c.degrees
              ? [0, 360, 45, 1]
              : [0, "2π", Math.PI / 4, Math.PI / 180];
    const slider = add(
        c,
        resolve(c, {
            name,
            definition: {
                kind: "call",
                command: "Slider",
                args: [min, max, value].map((value) =>
                    typeof value === "number"
                        ? { kind: "number", value }
                        : { kind: "formula", source: value },
                ),
            },
        }),
    ) as expression_object;
    slider.increment = step;
    return slider;
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

// A turtle's program, from TURTLE_INIT("A", A): the name TURTLE_GET reads
// it by, and the point it starts from.
export function turtleStart(
    object: construction_object,
): { name: string; point: construction_object | undefined } | null {
    if (!(object instanceof expression_object) || !object.program) return null;
    const { program, refs } = object.program;
    const init = programNodes(program).find(
        (node) => node.kind === "turtle" && node.fn === "TURTLE_INIT",
    );
    if (init?.kind !== "turtle") return null;
    const [name, point] = init.args;
    return name.kind === "string"
        ? {
              name: name.value,
              point:
                  point.kind === "identifier"
                      ? refs.get(point.name)
                      : undefined,
          }
        : null;
}

// The lists that draw turtles, by the turtles' names: found by what they
// draw, whatever their own names (DGPad's blk_turtle_list_A).
export const figureTurtles = (
    c: construction,
): [string, expression_list_object][] =>
    figureObjects(c).flatMap((object) => {
        const start =
            object instanceof expression_list_object &&
            turtleStart(object.source);
        return start ? [[start.name, object]] : [];
    });

// What a formula can read, by name: the objects, and the turtles' lists by
// the name TURTLE_GET reads them by (see turtleList).
const readable = (c: construction): Map<string, construction_object> =>
    new Map<string, construction_object>([
        ...figureObjects(c).map(
            (object) => [object.name, object] as [string, construction_object],
        ),
        ...figureTurtles(c).map(
            ([name, list]) =>
                [turtleList(name), list] as [string, construction_object],
        ),
        ...figureGlobals(c).map(
            (object) =>
                [globalName(object.global!), object] as [
                    string,
                    construction_object,
                ],
        ),
    ]);

// Whether a program sets values (SET_EXP, a global), which trying it would.
export const setsValues = (source: string): boolean =>
    programNodes(parseProgram(source)).some(
        (node) => node.kind === "method" && node.method === "setExpression",
    );

// DGPad's Blockly globals: an Ex each, which programs read and set.
export const figureGlobals = (c: construction): expression_object[] =>
    figureObjects(c).filter(
        (object): object is expression_object =>
            object instanceof expression_object && object.global !== null,
    );

// A global that a program names before any other does, undefined until one
// sets it, hidden as DGPad's.
function addGlobal(c: construction, global: string): expression_object {
    let name = global;
    for (let n = 1; c.getObj(name); n++) name = `${global}${n}`;
    const object = add(
        c,
        {
            name,
            overload: {
                params: [],
                tag: "Ex",
                encode: () => ({ t: "", v: null, g: global, xy: [0, 0] }),
            },
            args: [],
        },
        false,
    ) as expression_object;
    object.hidden = 2;
    object.updateView();
    return object;
}

const shownName = (name: string): string =>
    name.startsWith(turtleList(""))
        ? quoteText(name.slice(turtleList("").length))
        : name;

// An expression's entry, its nature told by the text (see EDITOR.md).
function expression(
    c: construction,
    source: string,
    target?: construction_object,
): { overload: Overload; args: Arg[] } {
    const own = readable(c);
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
                shownName(name),
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
    const own = readable(c);
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
            if (!object) throw new TextError("unknown_object", shownName(name));
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

// A number computed by a formula, read in an argument, or a function of
// these variables.
function formulaArg(
    c: construction,
    source: string,
    variables: string[] = [],
): FormulaArg {
    const own = new Map(
        figureObjects(c).map((object) => [object.name, object]),
    );
    let names: Set<string>;
    try {
        names = formulaIdentifiers(
            withObjects(new Set(own.keys()), () =>
                parseFormula(source, variables),
            ),
        );
    } catch {
        throw new TextError("syntax", source);
    }
    return new FormulaArg(
        source,
        new Map(
            [...names]
                .filter((name) => !variables.includes(name))
                .map((name) => {
                    const object = own.get(name);
                    if (!object) throw new TextError("unknown_object", name);
                    return [name, object];
                }),
        ),
    );
}

// A text, the objects its formulas name, or a panel's HTML, those of its
// formulas and fields: both read as the figure reads them.
function textArg(c: construction, text: string, html: boolean): TextArg {
    const own = new Map(
        figureObjects(c).map((object) => [object.name, object]),
    );
    let names: Set<string>;
    try {
        names = withObjects(new Set(own.keys()), () => {
            if (html) return panelNames(parsePanel(text));
            const parts = text.split("%");
            if (parts.length % 2 === 0) throw new Error();
            return new Set(
                parts.flatMap((part, index) =>
                    index % 2 && part
                        ? [...formulaIdentifiers(parseFormula(part))]
                        : [],
                ),
            );
        });
    } catch {
        throw new TextError(html ? "html" : "syntax", html ? "" : text);
    }
    return new TextArg(
        text,
        new Map(
            [...names].map((name) => {
                const object = own.get(name);
                if (!object) throw new TextError("unknown_object", name);
                return [name, object];
            }),
        ),
        html,
    );
}

// An argument as typed.
const argSource = (arg: ArgText): string =>
    arg.kind === "name"
        ? formatName(arg.name)
        : arg.kind === "number"
          ? formatNumber(arg.value)
          : arg.kind === "string"
            ? quoteText(arg.value)
            : arg.source;

// Of a nature, the command a Sequence's items are written with.
const ITEM_COMMANDS: Partial<Record<ListNature, string>> = {
    segment: "Segment",
    line: "Line",
    circle: "Circle",
    polygons: "Polygon",
};

// Sequence(f, k, a, b, s): f for k from a to b by s, f being a point or a
// number, Segment(P, Q), Line(P, Q), Circle(O, r) or Polygon(A, B, C, …) of
// formulas, or another Sequence, whose bounds read k (see
// sequence_object.ts).
function sequence(
    c: construction,
    args: ArgText[],
): { overload: Overload; args: Arg[] } {
    const loops: [string, ...FormulaArg[]][] = [];
    const variables: string[] = [];
    let body = args;
    for (;;) {
        const [expression, variable, ...bounds] = body;
        if (
            variable?.kind !== "name" ||
            bounds.length < 2 ||
            bounds.length > 3 ||
            variables.includes(variable.name)
        )
            throw new TextError(
                "arguments",
                commandName(findCommand("Sequence")!),
            );
        loops.push([
            variable.name,
            ...bounds.map((bound) =>
                formulaArg(c, argSource(bound), variables),
            ),
        ]);
        variables.push(variable.name);
        const inner = parseLine(argSource(expression), isCommand).definition!;
        const command =
            inner.kind === "call" ? findCommand(inner.command)!.name : "";
        if (command === "Sequence") {
            body = (inner as { args: ArgText[] }).args;
            continue;
        }
        const nature = (Object.keys(ITEM_COMMANDS) as ListNature[]).find(
            (key) => ITEM_COMMANDS[key] === command,
        );
        // Each a formula, or coordinates, read as on a line of its own.
        const item = (text: string): string => {
            const read = parseLine(text, isCommand).definition!;
            if (read.kind === "point") return `[${read.coords.join(", ")}]`;
            if (read.kind === "formula" || read.kind === "pointFormula")
                return read.source;
            throw new TextError("syntax", text);
        };
        const items =
            inner.kind === "call"
                ? inner.args.map((arg) => item(argSource(arg)))
                : [item(argSource(expression))];
        if (!sequenceShape(nature ?? "point", items.length))
            throw new TextError("syntax", argSource(expression));
        const formulas = items.map((item) => formulaArg(c, item, variables));
        const parameter = (
            { source, refs }: FormulaArg,
            index: (object: construction_object) => number,
        ) => formulaParameter(source, refs, index);
        return {
            overload: {
                params: [],
                tag: "Seq",
                encode: (_, index) => [
                    nature ?? "point",
                    loops.map(([name, ...range]) => [
                        name,
                        ...range.map((bound) => parameter(bound, index)),
                    ]),
                    ...formulas.map((formula) => parameter(formula, index)),
                ],
            },
            args: argObjects([
                ...loops.flatMap(([, ...range]) => range),
                ...formulas,
            ]),
        };
    }
}

// `f(x) = …`, the curve of a function of x, which formulas call as one.
function curve(
    c: construction,
    source: string,
): { overload: Overload; args: Arg[] } {
    const { refs } = formulaArg(c, source, ["x"]);
    return {
        overload: {
            params: [],
            tag: "Cur",
            encode: (_, index) => [
                formulaParameter(source, refs, index),
                null,
                null,
            ],
        },
        args: [...refs.values()],
    };
}

const EQUATIONS = ["EqL", "EqC", "EqQ", "PlE"];

// A line, a circle or a conic, as the equation's coefficients are now: of
// degree 1, 2 with one coefficient for x² and y² and none for xy, or 2; a
// plane, of degree 1, when it reads z, which names no object.
function equation(
    c: construction,
    sides: string[],
): { overload: Overload; args: Arg[] } {
    const own = new Map(
        figureObjects(c).map((object) => [object.name, object]),
    );
    const nodes = sides.map((source) =>
        withObjects(new Set(own.keys()), () => {
            try {
                return parseFormula(source);
            } catch {
                throw new TextError("syntax", source);
            }
        }),
    );
    const plane =
        !own.has("z") &&
        nodes.some((node) => formulaIdentifiers(node).has("z"));
    const variables = plane ? ["x", "y", "z"] : ["x", "y"];
    const formulas = nodes.map((node, index) => {
        const names = [...formulaIdentifiers(node)].filter(
            (name) => !variables.includes(name),
        );
        const refs = new Map(
            names.map((name) => {
                const object = own.get(name);
                if (!object) throw new TextError("unknown_object", name);
                return [name, object];
            }),
        );
        return { node, source: sides[index], variables, refs, vec3: plane };
    }) as Equation;
    const tag = plane ? planeTag(formulas, c) : conicTag(formulas, c);
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

// Its other values are those of its polynomial.
const OTHERS = [
    [2, 3, -1],
    [-3, 1.5, 2],
    [0.5, -2, 4],
];

function conicTag(formulas: Equation, c: construction): string {
    const coeffs = equationCoeffs(formulas, c);
    const scale = Math.max(...(coeffs ?? []).map(Math.abs));
    const zero = (value: number) => Math.abs(value) <= 1e-9 * scale;
    if (
        !coeffs ||
        !scale ||
        OTHERS.some(([x, y]) => {
            const [a, b, cc, d, e, f] = coeffs;
            return !zero(
                equationValue(formulas, c, [x, y]) -
                    (a * x * x + b * x * y + cc * y * y + d * x + e * y + f),
            );
        })
    )
        throw new TextError("degree");
    const [a, b, cc] = coeffs;
    return zero(a) && zero(b) && zero(cc)
        ? "EqL"
        : zero(b) && zero(a - cc)
          ? "EqC"
          : "EqQ";
}

function planeTag(formulas: Equation, c: construction): string {
    const value = (point: number[]) => equationValue(formulas, c, point);
    const g = value([0, 0, 0]);
    const normal = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
    ].map((point) => value(point) - g);
    const scale = Math.max(Math.abs(g), ...normal.map(Math.abs));
    if (
        !Number.isFinite(scale) ||
        normal.every((coefficient) => !coefficient) ||
        OTHERS.some(
            (point) =>
                Math.abs(
                    value(point) -
                        point.reduce(
                            (sum, coordinate, index) =>
                                sum + normal[index] * coordinate,
                            g,
                        ),
                ) >
                1e-9 * scale,
        )
    )
        throw new TextError("degree");
    return "PlE";
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
    if (
        [
            "Poly",
            "Sph",
            "Sph1",
            "Sec",
            "PlS",
            "Pl",
            "PlP",
            "PlL",
            "PlO",
            "PlE",
        ].includes(tag)
    )
        return { o: 0.2 };
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

// Cube(A, B, C) with A and B alone: two points on one plane or polygon
// give its square, the cube on the camera's side; two free points at one
// height, as on the floor, a horizontal square, the cube above.
export function cubeOn(
    c: construction,
    { tag }: Overload,
    [a, b, third]: (Arg | undefined)[],
): Omit<Spec, "name"> | null {
    if (tag !== "Cube" || !b || third) return null;
    const [, onPlane, horizontal] = findCommand("Cube")!.overloads;
    const [p, q] = [a, b] as point_object[];
    if (p instanceof point_on_object && q instanceof point_on_object) {
        const { support } = p;
        const normal =
            support === q.support &&
            support instanceof polygon_object &&
            normalOf(support);
        if (!normal) return null;
        const { dir, focal } = c.projectionFrame;
        const facing =
            focal === undefined
                ? -vDot(normal, dir!)
                : vDot(normal, vSub(vScale(dir!, -focal), p.coords));
        return {
            overload: onPlane,
            args: [p, q, support, facing < 0 ? -1 : 1],
        };
    }
    const free = (point: point_object) => entryOf(point, new Map())[0] === "Pt";
    return free(p) && free(q) && p.coords[2] === q.coords[2]
        ? { overload: horizontal, args: [p, q, 1] }
        : null;
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
    const parents = argObjects(args);
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
    const parameters = overload.encode(args, (object) => order.indexOf(object));
    // An image's file, by its key.
    if (overload.tag === "Img")
        (parameters as unknown[])[0] = Object.keys(figure.img!).find(
            (key) => figure.img![key] === (parameters as unknown[])[0],
        );
    const entry: unknown[] = [overload.tag, name, parameters];
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
