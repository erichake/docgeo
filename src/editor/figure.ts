import { construction, type DgpadLike } from "../construction";
import {
    addDgoEntries,
    describeDgo,
    dgoEntry,
    figureObjects,
    lookTag,
    LOOKS,
    objectStyle,
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
    type Program,
    programReferences,
    type Statement,
    globalName,
    globalOf,
    programTargets,
    turtleList,
    withObjects,
    type FormulaNode,
} from "../import/dgp_formula";
import { angle_object } from "../objects/angle_object";
import { BUTTON_WIDTH, button_object } from "../objects/button_object";
import {
    construction_object,
    objectEntry,
    objectIndex,
    type DgoRef,
    type PartKind,
} from "../objects/construction_object";
import { partOf } from "../objects/polygon_part";
import type { curve_object } from "../objects/curve_object";
import {
    equationCoeffs,
    equationValue,
    type Equation,
} from "../objects/equation_conic_object";
import {
    expression_object,
    type ExpressionProgram,
} from "../objects/expression_object";
import { event_object, type Trigger } from "../objects/event_object";
import { expression_list_object } from "../objects/expression_list_object";
import { fixed_angle_object } from "../objects/fixed_angle_object";
import {
    embeddedPoint,
    type formula_point_object,
} from "../objects/formula_point_object";
import { point_on_object } from "../objects/point_on_object";
import { point_object } from "../objects/point_object";
import {
    imageLook,
    straightImage,
    type transformable,
} from "../objects/transformed_object";
import type { primitive_circle_object } from "../objects/primitive_circle_object";
import { plane_object } from "../objects/plane_object";
import { polygon_object } from "../objects/polygon_object";
import { panelNames, parsePanel, panel_object } from "../objects/panel_object";
import { normalOf, polyhedron_object } from "../objects/polyhedron_object";
import { list_object, type ListNature } from "../objects/list_object";
import {
    embeddedList,
    point_list_object,
    type ListTree,
} from "../objects/point_list_object";
import {
    sequenceShape,
    type sequence_object,
} from "../objects/sequence_object";
import { vDot, vScale, vSub, type Vec2, type Vec3 } from "../vec";
import { unreadable } from "../workbook";
import {
    commandName,
    COMMANDS,
    decodeEntry,
    findCommand,
    FormulaArg,
    isCommand,
    mappedSlot,
    TextArg,
    overloadFor,
    accepts,
    argObjects,
    type Arg,
    type Overload,
} from "./catalog";
import {
    externalSource,
    formatName,
    coordinatesText,
    formatNumber,
    parseLine,
    quoteText,
    renameFormula,
    splitProducts,
    TextError,
    unknownMethod,
    type ArgText,
    type Definition,
    type Line,
} from "./text";
import type { ProgramHat } from "./blocks/view";
import {
    applyMacro,
    boxOf,
    designation,
    finalStyle,
    imageVerdict,
    macroIndex,
    typedNumber,
    type Picked,
} from "./macro";
import type { macro_object } from "../objects/macro_object";

// The figure being edited, as .dgo entries: see EDITOR.md.

export interface Studio extends DgpadLike {
    scene: construction;
}

// What a line, or a gesture, defines.
export interface Spec {
    name: string;
    overload: Overload;
    args: Arg[];
    // What a checkbox shows, once it is built (see showOnly).
    shown?: construction_object[];
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
    "PlI",
    "CyI",
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
    objectEntry(object, {
        index: (other) => objectIndex(other, (owner) => index.get(owner)!),
        image: (url) => url,
        screen: (position) => position,
    });

const PART_COMMANDS: Record<PartKind, string> = {
    side: "Side",
    vertex: "Vertex",
    face: "Face",
};

export const formatArg = (arg: Arg): string =>
    typeof arg === "number"
        ? formatNumber(arg)
        : arg instanceof FormulaArg
          ? oneLine(renamed(arg.source, arg.refs))
          : arg instanceof TextArg
            ? quoteText(renamedText(arg))
            : arg.reference
              ? `${commandName(findCommand(PART_COMMANDS[arg.reference.kind])!)}(${formatName(arg.reference.owner.name)}, ${arg.reference.rank})`
              : arg.embedded
                ? arg instanceof point_list_object
                    ? listText(arg)!
                    : pointText(arg as formula_point_object, true)
                : formatName(arg.name);

// What Element writes: L[(n)-1], and L[(i)-1][(j)-1] for a list of lists.
const ELEMENT = /^(.+)\[\((.*)\)-1\]$/;

// Whether each of its brackets closes after it opens.
function balanced(text: string): boolean {
    let depth = 0;
    for (const char of text) {
        if ("([{".includes(char)) depth++;
        else if (")]}".includes(char) && --depth < 0) return false;
    }
    return !depth;
}

// Element(L, n…), when the formula takes an item of a list it reads, a
// point unless `list`: Element(L, n) of a list of points, Element(L, i, j)
// of a list of lists, or Element(L, i), a list, of the latter.
function elementText(
    source: string,
    refs: ReadonlyMap<string, construction_object>,
    list = false,
): string | null {
    const ranks: string[] = [];
    let name = source;
    for (
        let match = ELEMENT.exec(name);
        match && balanced(match[2]);
        match = ELEMENT.exec(name)
    ) {
        ranks.unshift(match[2]);
        name = match[1];
    }
    return [...refs.values()].some(
        (ref) =>
            formatName(ref.name) === name &&
            (accepts(ref, "lists")
                ? ranks.length === (list ? 1 : 2)
                : !list && ranks.length === 1 && accepts(ref, "points")),
    )
        ? `${commandName(findCommand("Element")!)}(${[name, ...ranks].join(", ")})`
        : null;
}

const isList = (object: construction_object) =>
    accepts(object, "points") || accepts(object, "lists");

// A list of a list of lists, written as Element.
const listText = ({ tree, refs }: point_list_object) =>
    elementText(
        oneLine(renamed(formulaSource(tree as FormulaNode), refs)),
        refs,
        true,
    );

// Its coordinates, or Point(formula); numbers only if `numeric`, which a
// line would read as a free point.
function pointText(
    { formula, refs }: formula_point_object,
    numeric = false,
): string {
    const source = oneLine(
        renamed(formulaSource(formula), refs, ownNames(formula)),
    );
    return (
        elementText(source, refs) ??
        coordinatesText(source, numeric) ??
        `Point(${source})`
    );
}

const formatValue = (value: unknown): string =>
    typeof value === "number"
        ? formatNumber(value)
        : Array.isArray(value)
          ? `[${value.map(formatValue).join(", ")}]`
          : JSON.stringify(value);

// A formula written with the names of the objects it reads, and a
// program's own variables, renamed if one of those would hide them: they
// are named after the body of a macro whose box was opened, and the
// objects after the figure's.
function renamed(
    source: string,
    refs: ReadonlyMap<string, construction_object>,
    own: Set<string> = new Set(),
): string {
    const names = new Set(
        [...refs.values()].map(({ name }) => formatName(name)),
    );
    const taken = new Set([...names, ...own, ...refs.keys()]);
    const fresh = new Map<string, string>();
    own.forEach((local) => {
        if (!names.has(local)) return;
        let k = 1;
        while (taken.has(`${local}${k}`)) k++;
        taken.add(`${local}${k}`);
        fresh.set(local, `${local}${k}`);
    });
    return renameFormula(source, (name) => {
        const ref = refs.get(name);
        return ref ? formatName(ref.name) : fresh.get(name);
    });
}

// A program's own variables, its functions' included.
function ownNames({ body, locals }: Program): Set<string> {
    const names = new Set(locals);
    const visit = (statements: Statement[]): void =>
        statements.forEach((statement) => {
            if (statement.kind === "if") {
                visit(statement.then);
                visit(statement.otherwise);
            } else if (statement.kind === "loop") visit(statement.body);
            else if (statement.kind === "function") {
                statement.locals.forEach((name) => names.add(name));
                visit(statement.body);
            }
        });
    visit(body);
    return names;
}

// A text written with the names of the objects it reads: in its formulas
// ("%…%"), outside the tags of a panel's HTML, and its fields' targets.
function renamedText({ text, refs, html }: TextArg): string {
    // Nothing to rename, a button's caption reading no formula between "%".
    if (!refs.size) return text;
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
// program, a panel's HTML, a button's program.
export function definitionSource(
    object: expression_object | panel_object | button_object | event_object,
): string {
    return object instanceof panel_object
        ? renamedText(new TextArg(object.content, object.refs, true))
        : object instanceof button_object
          ? object.program
              ? programSource(object.program)
              : ""
          : object instanceof event_object
            ? programSource(object.program)
            : expressionSource(object);
}

const programSource = ({ program, refs, targets }: ExpressionProgram) =>
    renamed(
        formulaSource(program),
        new Map([...refs, ...targets]),
        ownNames(program),
    );

// Its value, or its formula.
export function expressionSource({
    formula,
    program,
    value,
}: expression_object): string {
    if (!formula && !program) return formatValue(value);
    return formula
        ? renamed(formula.source, formula.refs)
        : programSource(program!);
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
    if (tag === "Out")
        return applicationLine(object.output!.node as macro_object);
    const at = (ref: DgoRef) =>
        typeof ref === "number"
            ? objects[ref]
            : ref.length === 2
              ? object.embeddedPoints!.find(
                    (point) =>
                        JSON.stringify(
                            objectIndex(point, (owner) => index.get(owner)!),
                        ) === JSON.stringify(ref),
                )!
              : partOf(ref[0], objects[ref[1]], ref[2]);
    // An image by a macro that maps points.
    if (tag === "Mac" && typeof (parameters as unknown[])[3] === "string") {
        const [macro, , initials] = parameters as [number, number, unknown[]];
        const args = initials.map((initial) =>
            typeof initial === "string"
                ? initial
                : formatArg(at(initial as DgoRef)),
        );
        return `${name} = ${formatName(object.C.macros[macro].name)}(${args.join(", ")})`;
    }
    if (tag === "Cur") {
        const { formula, bounds } = object as curve_object;
        const [min, max] = bounds.map((bound) =>
            typeof bound === "object" && bound
                ? oneLine(renamed(bound.source, bound.refs))
                : bound,
        );
        const body = `${name}(x) = ${oneLine(renamed(formula.source, formula.refs))}`;
        // As GeoGebra writes a function on an interval.
        return min === null && max === null
            ? body
            : `${body}, (${min === null ? "" : `${min} ≤ `}x${max === null ? "" : ` ≤ ${max}`})`;
    }
    const text = (formula: FormulaNode) => {
        const source = oneLine(
            renamed(formulaSource(formula), (object as list_object).refs),
        );
        return coordinatesText(source, true) ?? source;
    };
    if (tag === "Pts") {
        const write = (tree: ListTree): string =>
            Array.isArray(tree)
                ? `{${tree.map(write).join(", ")}}`
                : text(tree);
        return `${name} = ${write((object as point_list_object).tree)}`;
    }
    if (tag === "Fl") {
        const element = listText(object as point_list_object);
        return element && `${name} = ${element}`;
    }
    if (tag === "Seq") {
        const { nature, loops, formulas } = object as sequence_object;
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
    if (tag === "Fp")
        return `${name} = ${pointText(object as formula_point_object)}`;
    if (EQUATIONS.includes(tag)) {
        const { equation } = (object instanceof plane_object
            ? object.definition
            : object) as unknown as { equation: Equation };
        return `${name} = ${equation.map((side) => oneLine(renamed(side.source, side.refs))).join(" = ")}`;
    }
    const decoded = decodeEntry(
        tag,
        object instanceof expression_object
            ? {
                  ...(parameters as object),
                  cB: object.checkbox,
                  iB: object.inputLength,
                  shown: object.children
                      .filter(
                          (child) =>
                              child.condition === object && index.has(child),
                      )
                      .sort((a, b) => index.get(a)! - index.get(b)!),
              }
            : parameters,
        at,
    );
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
    let overload: Overload | undefined = FREE_POINT;
    let args: Arg[];
    let shown: construction_object[] | undefined;
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
        ({ overload, args } =
            target instanceof button_object
                ? buttonProgram(c, definition!.source, target)
                : target instanceof event_object
                  ? eventProgram(c, definition!.source, target)
                  : expression(c, definition!.source, target));
    else if (definition!.kind === "pointFormula")
        ({ overload, args } = formulaPoint(c, definition!.source));
    else if (definition!.kind === "equation")
        ({ overload, args } = equation(c, definition!.sides));
    else if (definition!.kind === "curve")
        ({ overload, args } = curve(c, definition!.source));
    else if (definition!.kind === "list")
        ({ overload, args } = pointList(c, definition!.items));
    else if (findCommand(definition!.command)?.name === "Sequence")
        ({ overload, args } = sequence(c, definition!.args));
    else {
        const call = definition!;
        const command = findCommand(call.command);
        if (!command) throw new TextError("unknown_command", call.command);
        if (command.reference)
            throw new TextError("arguments", commandName(command));
        args = call.args.map((arg) => resolveArgument(c, arg, command.name));
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
            // A curve or a locus may be cut more than four times.
            const branch = args[2] as number;
            const many = args.some((arg) =>
                ["curve", "locus"].includes(
                    (arg as construction_object).familytype,
                ),
            );
            if (
                !Number.isInteger(branch) ||
                branch < 1 ||
                (branch > 4 && !many)
            )
                throw new TextError("branch");
        }
        if (overload.tag === "CyI" && args[2] !== 1 && args[2] !== 2)
            throw new TextError("surface_branch");
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
        if (overload.tag === "Btn") overload = buttonOverload(c, target);
        // A slider.
        if (overload.tag === "Ex") {
            const { encode, kept, style } = overload;
            const values = args;
            if (style?.cB) {
                shown = (values.slice(1) as construction_object[]).map(
                    (object) => object.reference?.owner ?? object,
                );
                const refused = shown.find(
                    (object) => target && descendants(object).has(target),
                );
                if (refused)
                    throw new TextError(
                        "condition_reads",
                        formatName(refused.name),
                    );
            }
            const value =
                target instanceof expression_object ? target.value : null;
            ({ overload, args } = expressionSpec(
                c,
                target,
                (index) => ({
                    ...(encode(values, index) as object),
                    ...(kept &&
                        typeof value === "number" && {
                            v: kept(value, values),
                        }),
                }),
                argObjects(shown ? values.slice(0, 1) : values),
                style,
            ));
        }
    }
    const chosen =
        name ?? target?.name ?? nextName(c, builtTag(overload, args));
    const named = c.getObj(chosen);
    if (named && named !== target) throw new TextError("name_taken", chosen);
    return { name: chosen, overload, args, ...(shown && { shown }) };
}

export function resolveArgument(
    c: construction,
    arg: ArgText,
    command = "",
): Arg {
    if (arg.kind === "number") return arg.value;
    if (arg.kind === "string")
        return ["Button", "Checkbox", "Menu", "InputField"].includes(command)
            ? new TextArg(arg.value, new Map())
            : textArg(c, arg.value, command === "Html");
    if (arg.kind === "formula") {
        // L(n), a list's item, as GeoGebra's.
        const listed = (name: string) => {
            const object = readable(c).get(name);
            return object && isList(object) ? object : undefined;
        };
        const line = parseLine(
            arg.source,
            (name) => isCommand(name) || !!listed(name),
        );
        const call = line.definition;
        if (call?.kind === "call") {
            const named = findCommand(call.command)?.name === "Element";
            const [list, ...ranks] = named
                ? [
                      call.args.length > 1 && resolveArgument(c, call.args[0]),
                      ...call.args.slice(1),
                  ]
                : [listed(call.command), ...call.args];
            if (named || list) {
                // A list of lists' list, or its point.
                const nested =
                    list instanceof construction_object &&
                    accepts(list, "lists");
                if (
                    !(list instanceof construction_object) ||
                    !isList(list) ||
                    !(
                        ranks.length === 1 ||
                        (ranks.length === 2 && nested && named)
                    )
                )
                    throw new TextError("arguments", call.command);
                const source = `${formatName(list.name)}${ranks.map((rank) => `[(${argSource(rank)})-1]`).join("")}`;
                if (nested && ranks.length === 1) {
                    const { refs } = formulaArg(c, source);
                    return embeddedList(
                        c,
                        withObjects(new Set(refs.keys()), () =>
                            parseFormula(source),
                        ),
                        new Map(refs),
                        !c.GRID.is2D,
                    );
                }
                return embeddedPoint(
                    c,
                    ...pointProgram(c, source),
                    !c.GRID.is2D,
                );
            }
        }
        if (
            call?.kind === "call" &&
            Object.values(PART_COMMANDS).includes(
                findCommand(call.command)?.name ?? "",
            )
        ) {
            const resolved = call.args.map((arg) => resolveArgument(c, arg));
            // The rank also first, as GeoGebra's Vertex.
            const [owner, rank] =
                typeof resolved[0] === "number" ? resolved.reverse() : resolved;
            const face = findCommand(call.command)!.name === "Face";
            if (
                call.args.length !== 2 ||
                !(face
                    ? owner instanceof polyhedron_object
                    : owner instanceof polygon_object &&
                      !owner.plane &&
                      !owner.reference) ||
                typeof rank !== "number" ||
                !Number.isSafeInteger(rank) ||
                rank < 1
            )
                throw new TextError("arguments", call.command);
            return partOf(
                face
                    ? "face"
                    : findCommand(call.command)!.name === "Side"
                      ? "side"
                      : "vertex",
                owner as construction_object,
                rank,
            );
        }
        // Coordinates, or a point's formula, which the object will hold.
        const point =
            line.definition?.kind === "point"
                ? `[${line.definition.coords.join(", ")}]`
                : line.definition?.kind === "pointFormula"
                  ? line.definition.source
                  : null;
        if (point !== null || givesPoint(c, arg.source))
            return embeddedPoint(
                c,
                ...pointProgram(c, point ?? arg.source),
                !c.GRID.is2D,
            );
        return formulaArg(c, arg.source);
    }
    const object = c.getObj(arg.name);
    if (!object || !figureIndex(c).has(object))
        throw new TextError("unknown_object", arg.name);
    return object;
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

// A control, where the palette's tool puts it (see placeControl in main.ts).
export function addControl(
    c: construction,
    definition: Line["definition"] | null,
    at: Vec2,
): expression_object {
    const name = nextName(c, "Ex");
    const control = definition
        ? (add(c, resolve(c, { name, definition })) as expression_object)
        : addSlider(c, name);
    control.screen = at;
    c.invalidateRender(control);
    return control;
}

// An image of the figure, on these two points, or at a place of the window.
export function addImage(
    c: construction,
    url: string,
    key: string,
    size: Vec2,
    place: Vec2 | construction_object[],
): construction_object {
    const name = nextName(c, "Img");
    const index = figureIndex(c);
    const where = (place as unknown[]).every(
        (corner) => corner instanceof construction_object,
    )
        ? (place as construction_object[]).map((corner) =>
              objectIndex(corner, (owner) => index.get(owner)!),
          )
        : [place as Vec2];
    c.beginBatch();
    addDgoEntries(c, [["Img", name, [key, ...size, ...where]]], [], {
        [key]: url,
    });
    c.endBatch();
    return c.getObj(name)!;
}

// What decides whether it shows, as its field in the properties writes it:
// the name of an expression shown, or the formula of a hidden one.
export const conditionText = ({ condition }: construction_object): string =>
    !condition
        ? ""
        : condition.hidden === 2
          ? expressionSource(condition)
          : formatName(condition.name);

// Shown only while it is true, or always; the hidden expression that
// computed its condition goes with it. A condition mustn't be built from
// the object: nothing could show it again once it hides.
export function showWhile(
    object: construction_object,
    condition: expression_object | null,
): void {
    const old = object.condition;
    if (old) {
        object.parents = object.parents.filter((parent) => parent !== old);
        old.children = old.children.filter((child) => child !== object);
    }
    object.condition = condition;
    if (condition) object.addParents(condition);
    object.C.invalidateGeometry(object);
    if (old?.hidden === 2 && !old.children[0]) object.C.removeObject(old);
}

// The checkbox shows these objects, and no longer the others it showed.
export function showOnly(
    checkbox: expression_object,
    shown: construction_object[],
): void {
    checkbox.children
        .filter(
            (child) => child.condition === checkbox && !shown.includes(child),
        )
        .forEach((child) => showWhile(child, null));
    shown
        .filter((object) => object.condition !== checkbox)
        .forEach((object) => showWhile(object, checkbox));
}

// The condition typed for these objects: an expression's name, a formula, or
// nothing.
export function setConditions(
    c: construction,
    objects: construction_object[],
    source: string,
): void {
    const text = source.trim();
    const named = c.getObj(text.replace(/^"|"$/g, ""));
    const spec =
        !text || named instanceof expression_object
            ? null
            : { name: nextName(c, "Ex"), ...expression(c, text) };
    const reads: construction_object[] = spec
        ? (spec.args as construction_object[])
        : text
          ? [named!]
          : [];
    const refused = objects.find((object) => {
        const built = descendants(object);
        return reads.some((read) => built.has(read));
    });
    if (refused)
        throw new TextError("condition_reads", formatName(refused.name));
    let condition: expression_object | null = null;
    if (spec) {
        condition = add(c, spec) as expression_object;
        condition.hidden = 2;
        condition.updateView();
    } else if (text) condition = named as expression_object;
    objects.forEach((object) => showWhile(object, condition));
}

// Under the expressions the window shows, as DGPad's calculator stacks them.
function freeSpot(c: construction): Vec2 {
    const shown = figureObjects(c).filter(
        (object): object is expression_object =>
            object instanceof expression_object &&
            !object.anchor &&
            !object.hidden,
    );
    // A slider's track is under its value; a menu or a field goes down from
    // its place, a checkbox's box a little.
    const bottoms = shown.map(
        ({ screen, isCursor, menu, inputLength, checkbox }) =>
            screen[1] +
            (menu || inputLength ? 36 : checkbox ? 10 : isCursor ? 30 : 0),
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
    if (content.kind !== "v") checkExternals(programNodes(content.program));
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
    const named = namedObjects(
        own,
        names,
        content.kind === "v" ? null : content.program,
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

// The objects a formula or a program names, an unknown name being refused.
const namedObjects = (
    own: ReadonlyMap<string, construction_object>,
    names: Iterable<string>,
    program: Program | null,
): Map<string, construction_object> =>
    new Map(
        [...names].map((name) => {
            const object = own.get(name);
            if (object) return [name, object];
            const called =
                program &&
                programNodes(program).some(
                    (node) => node.kind === "userCall" && node.name === name,
                );
            throw new TextError(
                called ? "unknown_command" : "unknown_object",
                shownName(name),
            );
        }),
    );

// The objects a program run by a button or an event names.
function programObjects(
    c: construction,
    source: string,
): Map<string, construction_object> {
    const own = readable(c);
    let program: Program;
    try {
        program = withObjects(new Set(own.keys()), () => parseProgram(source));
    } catch {
        const method = unknownMethod(source);
        throw new TextError(
            method ? "unknown_method" : "syntax",
            method ?? source,
        );
    }
    checkExternals(programNodes(program));
    return namedObjects(
        own,
        [...programReferences(program), ...programTargets(program)],
        program,
    );
}

// A button's program, its caption and place kept.
function buttonProgram(
    c: construction,
    source: string,
    target: button_object,
): { overload: Overload; args: Arg[] } {
    const named = programObjects(c, source);
    return {
        overload: {
            params: [],
            tag: "Btn",
            encode: (_, index) => ({
                ...buttonEntry(target, index),
                s: formulaParameter(source, named, index),
            }),
        },
        args: [...named.values()],
    };
}

// An event's program, answering the same gesture on the same point, or the
// change of the same expression.
function eventProgram(
    c: construction,
    source: string,
    target: event_object,
): { overload: Overload; args: Arg[] } {
    const named = programObjects(c, source);
    return {
        overload: eventOverload(target.owner, target.gesture, (index) =>
            formulaParameter(source, named, index),
        ),
        args: [target.owner, ...named.values()],
    };
}

const eventOverload = (
    owner: construction_object,
    gesture: Trigger | null,
    script: (index: (object: construction_object) => DgoRef) => unknown,
): Overload => ({
    params: [],
    tag: "Evt",
    encode: (_, index) => ({
        on: index(owner),
        ...(gesture && { e: gesture }),
        s: script(index),
    }),
});

// An empty program for the gesture on the point, the change of the
// expression, or the opening of the figure.
export function addEvent(
    c: construction,
    owner: point_object | expression_object | button_object,
    gesture: Trigger | null,
): construction_object {
    const event = add(
        c,
        {
            name: nextName(c, false),
            overload: eventOverload(owner, gesture, () => ""),
            args: [owner],
        },
        false,
    );
    event.hidden = 2;
    event.updateView();
    return event;
}

// The object whose programs show together: the point a turtle starts from,
// the object an event answers.
export function programOwner(object: construction_object): construction_object {
    if (object instanceof event_object) return object.owner;
    return turtleStart(object)?.point ?? object;
}

// A program by its first block.
export function programHat(object: construction_object): ProgramHat {
    if (object instanceof event_object)
        return {
            key: object.name,
            kind: object.gesture ?? "change",
            object: object.owner.name,
        };
    const start = turtleStart(object);
    return start
        ? {
              key: object.name,
              kind: "turtle",
              object: start.point?.name ?? start.name,
          }
        : { key: object.name, kind: "program", object: object.name };
}

// Its programs, in the figure's order: its turtles, those its events run,
// its own (a button's, an expression's).
export const ownPrograms = (
    c: construction,
    owner: construction_object,
): construction_object[] =>
    figureObjects(c).filter(
        (object) =>
            (object === owner &&
                (object instanceof button_object ||
                    (object instanceof expression_object &&
                        !!object.program))) ||
            (object !== owner && programOwner(object) === owner),
    );

const buttonEntry = (
    button: button_object,
    index: (object: construction_object) => DgoRef,
): object =>
    button.dgo({
        index,
        image: (url) => url,
        screen: (position) => position,
    })[1] as object;

// A button keeps the program and the place of the button it redefines; a
// new one has its arrow centred on `at`, the window's centre by default.
export function buttonOverload(
    c: construction,
    target?: construction_object,
    [x, y]: Vec2 = [c.width / 2, c.height / 2],
): Overload {
    const overload = findCommand("Button")!.overloads[0];
    return {
        ...overload,
        encode: (args, index) => ({
            ...(target instanceof button_object
                ? buttonEntry(target, index)
                : { xy: [x + BUTTON_WIDTH / 2, y] }),
            ...(overload.encode(args, index) as object),
        }),
    };
}

// A formula's .dgo parameter, the objects it names given by their index.
const formulaParameter = (
    source: string,
    named: ReadonlyMap<string, construction_object>,
    index: (object: construction_object) => DgoRef,
): unknown =>
    named.size
        ? [
              source,
              Object.fromEntries(
                  [...named].map(([name, object]) => [name, index(object)]),
              ),
          ]
        : source;

// A point's formula, and the objects it names.
function pointProgram(
    c: construction,
    source: string,
): [Program, Map<string, construction_object>] {
    const own = readable(c);
    let program: Program;
    try {
        program = withObjects(new Set(own.keys()), () => parseProgram(source));
    } catch {
        throw new TextError("syntax", source);
    }
    // `(a, 1)` with a list `a`: never a point, unlike a coordinate undefined
    // for now.
    const value = probe(c, source);
    if (Array.isArray(value) && value.some(Array.isArray))
        throw new TextError("coordinate_list");
    return [
        program,
        new Map(
            [...programReferences(program)].map((name) => {
                const object = own.get(name);
                if (!object)
                    throw new TextError("unknown_object", shownName(name));
                return [name, object];
            }),
        ),
    ];
}

// A formula's value, tried on an expression added and removed at once;
// undefined when it isn't an expression.
function probe(c: construction, source: string): unknown {
    let spec: { overload: Overload; args: Arg[] };
    try {
        spec = expression(c, source);
    } catch (error) {
        if (error instanceof TextError) return undefined;
        throw error;
    }
    const probed = add(c, { ...spec, name: "‧v" }, false);
    c.flush();
    const { value } = probed as expression_object;
    c.removeObject(probed);
    return value;
}

// Whether a formula gives a point's coordinates, as `a[0]` for a list of
// them.
function givesPoint(c: construction, source: string): boolean {
    const value = probe(c, source);
    return (
        Array.isArray(value) &&
        (value.length === 2 || value.length === 3) &&
        value.every((item) => typeof item === "number")
    );
}

// A point computed by a formula: the coordinates, or a point, it gives.
function formulaPoint(
    c: construction,
    source: string,
): { overload: Overload; args: Arg[] } {
    const [, named] = pointProgram(c, source);
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
    let node: FormulaNode;
    try {
        node = withObjects(new Set(own.keys()), () =>
            parseFormula(source, variables),
        );
    } catch {
        throw new TextError("syntax", source);
    }
    checkExternals(formulaNodes(node));
    const names = formulaIdentifiers(node);
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

const formulaNodes = (node: FormulaNode): FormulaNode[] =>
    programNodes({ body: [{ kind: "expression", node }], locals: new Set() });

// Refused if it reads an object of another page that the page shown can't
// read (see workbook.ts).
function checkExternals(nodes: FormulaNode[]): void {
    for (const node of nodes) {
        if (node.kind !== "external") continue;
        const error = unreadable(node.page, node.name);
        if (error)
            throw new TextError(error, externalSource(node.page, node.name));
    }
}

// A text, the objects its formulas name, or a panel's HTML, those of its
// formulas and fields: both read as the figure reads them.
function textArg(c: construction, text: string, html: boolean): TextArg {
    const own = new Map(
        figureObjects(c).map((object) => [object.name, object]),
    );
    let names: Set<string>;
    const formulas: FormulaNode[] = [];
    try {
        names = withObjects(new Set(own.keys()), () => {
            if (html) return panelNames(parsePanel(text));
            const parts = text.split("%");
            if (parts.length % 2 === 0) throw new Error();
            parts.forEach(
                (part, index) =>
                    index % 2 && part && formulas.push(parseFormula(part)),
            );
            return new Set(
                formulas.flatMap((node) => [...formulaIdentifiers(node)]),
            );
        });
    } catch {
        throw new TextError(html ? "html" : "syntax", html ? "" : text);
    }
    checkExternals(formulas.flatMap(formulaNodes));
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
// number, Segment(P, Q), Line(P, Q), Circle(O, r), Circle(O, r, u) of axis
// direction u or Polygon(A, B, C, …) of formulas, or another Sequence, whose
// bounds read k (see
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
        const items =
            inner.kind === "call"
                ? inner.args.map((arg) => item(argSource(arg)))
                : [item(argSource(expression))];
        if (!sequenceShape(nature ?? "point", items.length))
            throw new TextError("syntax", argSource(expression));
        const formulas = items.map((item) => formulaArg(c, item, variables));
        const parameter = (
            { source, refs }: FormulaArg,
            index: (object: construction_object) => DgoRef,
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

// An item, a formula or coordinates, read as on a line of its own.
function item(text: string): string {
    const read = parseLine(text, isCommand).definition!;
    if (read.kind === "point") return `[${read.coords.join(", ")}]`;
    if (read.kind === "formula" || read.kind === "pointFormula")
        return read.source;
    throw new TextError("syntax", text);
}

type ItemTree = FormulaArg | ItemTree[];
const formulas = (tree: ItemTree): FormulaArg[] =>
    Array.isArray(tree) ? tree.flatMap(formulas) : [tree];

// `{A, (1, 2), …}`, a list of points, or of lists, `{{A, B}, {C}}`.
function pointList(
    c: construction,
    items: string[],
): { overload: Overload; args: Arg[] } {
    const read = (text: string): ItemTree => {
        const line = parseLine(text, isCommand).definition!;
        return line.kind === "list"
            ? line.items.map(read)
            : formulaArg(c, item(text));
    };
    const tree = items.map(read);
    const encode = (
        tree: ItemTree,
        index: Parameters<Overload["encode"]>[1],
    ): unknown =>
        Array.isArray(tree)
            ? tree.map((tree) => encode(tree, index))
            : formulaParameter(tree.source, tree.refs, index);
    return {
        overload: {
            params: [],
            tag: "Pts",
            encode: (_, index) => encode(tree, index),
        },
        args: argObjects(formulas(tree)),
    };
}

// `f(x) = …`, the curve of a function of x, which formulas call as one,
// or `f(x) = …, (a ≤ x ≤ b)` on an interval, as in GeoGebra.
function curve(
    c: construction,
    text: string,
): { overload: Overload; args: Arg[] } {
    const [, source, min, max] = INTERVAL.exec(text) ?? [, text];
    const parts = [source!, min, max].map((part, index) =>
        part === undefined
            ? null
            : index && /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(part)
              ? Number(part)
              : formulaArg(c, part, index ? [] : ["x"]),
    );
    return {
        overload: {
            params: [],
            tag: "Cur",
            encode: (_, index) =>
                parts.map((part) =>
                    part instanceof FormulaArg
                        ? formulaParameter(part.source, part.refs, index)
                        : part,
                ),
        },
        args: [
            ...new Set(
                parts.flatMap((part) =>
                    part instanceof FormulaArg ? [...part.refs.values()] : [],
                ),
            ),
        ],
    };
}

const INTERVAL =
    /^(.*),\s*\(\s*(?:(.+?)\s*(?:≤|<=)\s*)?x\s*(?:(?:≤|<=)\s*(.+?)\s*)?\)$/;

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
    own: (index: (object: construction_object) => DgoRef) => object,
    parents: construction_object[],
    style?: Overload["style"],
): { overload: Overload; args: Arg[] } {
    const kept = target instanceof expression_object ? target : null;
    const spot = freeSpot(c);
    return {
        overload: {
            params: [],
            tag: "Ex",
            style,
            encode: (_, index) => {
                const { v, f, s, mn, mx, mu, ...rest } = kept
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

// DocGeo's own colors, one per type, chosen by the author.
const CREATED_COLORS: Record<string, Record<string, string>> = {};
for (const [c, tags] of [
    ["#D62728", ["Seg"]],
    ["#8C564B", ["Vec", "VecF"]],
    ["#1F77B4", ["Line", "EqL", "PlPl"]],
    ["#17BECF", ["Ray"]],
    ["#2CA02C", ["Par"]],
    ["#9467BD", ["Perp", "Nrm"]],
    ["#E377C2", ["Med"]],
    ["#9C9D1C", ["Bis"]],
    ["#7F7F7F", ["Tan", "TanX"]],
    ["#637939", ["Ang", "FA"]],
    ["#396D26", ["Cir", "C1", "CAx", "C3", "C3p", "C3s", "EqC", "SphC"]],
    ["#AD494A", ["Arc", "Arcs", "CArc", "CArcs", "QArc", "Semi"]],
    ["#CE6DBD", ["Sec", "Secs", "CSec", "CSecs", "QSec"]],
    ["#0E7C7B", ["Quad", "Ell", "Ell1", "Hyp", "Hyp1", "Prb", "EqQ", "CyS"]],
] as const)
    for (const tag of tags) CREATED_COLORS[tag] = { c };
for (const tag of ["Poly", "RegP", "PlS", "Pl", "PlP", "PlL", "PlO", "PlE"])
    CREATED_COLORS[tag] = { c: "#5254A3", fc: "#6B6ECF" };

// What a new slider looks like. Not a style of the Slider command, which
// would also apply to the slider it redefines.
export const SLIDER_LOOK = { c: "#186291", cf: "#8EB5CC", co: 1 };

// Points named, those built from others in grey; regions filled,
// expressions shown, as by DGPad's tools, panels light.
function createdStyle(tag: string): Record<string, unknown> | undefined {
    if (isPointTag(tag))
        return {
            c: "#1E293B",
            fc: tag === "Pt" || tag === "On" ? "#F59E0B" : "#CBD5E1",
            o: 1,
            sn: 1,
            f: 26,
        };
    if (tag === "Sph" || tag === "Sph1") return { o: 0.5 };
    if (
        [
            "Poly",
            "Sec",
            "Secs",
            "QSec",
            "PlS",
            "Pl",
            "PlP",
            "PlL",
            "PlO",
            "PlE",
        ].includes(tag)
    )
        return { ...CREATED_COLORS[tag], o: 0.2 };
    // Its value shown, as by DGPad's calculator.
    if (tag === "Ex") return { p: 2, f: 18 };
    if (tag === "Html") return { c: "#94A3B8", fc: "#F1F5F9", o: 0.8 };
    return CREATED_COLORS[tag];
}

// The stroke and fill colors a tool gives a new object of its type.
export function createdColors(object: construction_object): [string, string] {
    const { output } = object;
    const tag = lookTag(object, entryOf(object, new Map())[0]);
    const [fill, stroke] = LOOKS[tag];
    const node = output?.node as macro_object | undefined;
    const style = (
        node
            ? finalStyle(node.macro.methods[node.method], output!.rank - 1)
            : object instanceof expression_object && object.isCursor
              ? SLIDER_LOOK
              : createdStyle(tag)
    ) as Record<string, string> | undefined;
    return [style?.c ?? stroke, style?.fc ?? style?.c ?? fill];
}

// The object a transformation maps, other than a point.
function mapped(
    { params }: Overload,
    args: (Arg | undefined)[],
): transformable | null {
    const source = args[mappedSlot(params)];
    return source instanceof construction_object &&
        !(source instanceof point_object)
        ? (source as transformable)
        : null;
}

// The type of what the entry builds: an image by a transformation has its
// object's, or a line's or a circle's by an inversion (see
// transformed_object.ts).
export function builtTag(
    overload: Overload,
    args: (Arg | undefined)[],
): string {
    const source = mapped(overload, args);
    if (!source) return overload.tag;
    return imageLook(
        source,
        overload.tag === "Inv"
            ? straightImage(args[0] as primitive_circle_object, source)
            : undefined,
    );
}

// What an image by a transformation keeps of its object's style.
const KEPT_STYLE = ["c", "fc", "s", "o", "dh", "dc"];

// The style of an image by a transformation, of this type: as a tool
// gives it, with its object's colors, size, opacity and dashes.
export function imageStyle(
    source: construction_object,
    tag: string,
    index: ReadonlyMap<construction_object, number>,
): Record<string, unknown> {
    const kept = objectStyle(
        source,
        lookTag(source, entryOf(source, index)[0]),
    );
    return {
        ...createdStyle(tag),
        ...Object.fromEntries(
            KEPT_STYLE.flatMap((key) =>
                key in kept ? [[key, kept[key]]] : [],
            ),
        ),
    };
}

// Adds the object after the others, `styled` as by DGPad's tools, an
// image by a transformation as its object.
export function add(
    c: construction,
    { name, overload, args }: Spec,
    styled = true,
): construction_object {
    const index = figureIndex(c);
    const source = mapped(overload, args);
    const parameters = overload.encode(args, (object) =>
        objectIndex(object, (owner) => index.get(owner)!),
    );
    const slider =
        overload.tag === "Ex" && (parameters as { mn?: unknown }).mn != null;
    const style = !styled
        ? undefined
        : source
          ? imageStyle(source, builtTag(overload, args), index)
          : overload.style
            ? {
                  ...createdStyle(overload.tag),
                  ...overload.style,
                  ...(slider && SLIDER_LOOK),
              }
            : createdStyle(overload.tag);
    c.beginBatch();
    addDgoEntries(
        c,
        [[overload.tag, name, parameters, ...(style ? [0] : [])]],
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
    const values = accepts(support, "surface")
        ? [1, 0, 0]
        : accepts(support, "outline")
          ? [0, 0]
          : [0];
    const point = add(c, {
        name,
        overload: findCommand("Point")!.overloads[values.length - 1],
        args: [support, ...values],
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
    const parameters = overload.encode(args, (object) =>
        objectIndex(object, (owner) => order.indexOf(owner)),
    );
    // An image's file, by its key.
    if (overload.tag === "Img")
        (parameters as unknown[])[0] = Object.keys(figure.img!).find(
            (key) => figure.img![key] === (parameters as unknown[])[0],
        );
    const entry: unknown[] = [overload.tag, name, parameters];
    if (style !== undefined || overload.style) {
        const before = style === undefined ? {} : figure.st![style];
        const kept: Record<string, unknown> =
            tag === overload.tag
                ? { ...before }
                : Object.fromEntries(
                      Object.entries(before).filter(([key]) =>
                          COMMON_STYLE.includes(key),
                      ),
                  );
        Object.entries(overload.style ?? {}).forEach(([key, value]) => {
            kept[key] = (value && kept[key]) || value;
        });
        figure.st ??= [];
        figure.st.push(kept as (typeof figure.st)[number]);
        entry.push(figure.st.length - 1);
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

// The line of a macro's application, shared by its finals: their names, in
// order, "_" for one deleted, then the call.
function applicationLine({ macro, initials, children }: macro_object): string {
    const names = macro.finals.map((_, rank) => {
        const final = children.find(({ output }) => output!.rank === rank + 1);
        return final ? formatName(final.name) : "_";
    });
    const args = initials.map((initial) =>
        typeof initial === "string" ? initial : formatArg(initial),
    );
    return `${names.join(", ")} = ${formatName(macro.name)}(${args.join(", ")})`;
}

// What a line applying a macro gives: its method, the initials, and the
// names of the finals, null for one not wanted, or all null if the line
// names none. Null if it applies none.
export interface MacroSpec {
    index: number;
    method: number;
    initials: Picked[];
    names: (string | null)[] | null;
}

export function resolveMacro(c: construction, line: Line): MacroSpec | null {
    const call = line.definition;
    const index = call?.kind === "call" ? macroIndex(c, call.command) : -1;
    if (index < 0) {
        if (line.names) throw new TextError("macro_unknown");
        return null;
    }
    const macro = c.macros[index];
    const named = formatName(macro.name);
    const initials = (call as { args: ArgText[] }).args.map((arg): Picked => {
        const value = resolveArgument(c, arg);
        if (typeof value === "number") return String(value);
        if (value instanceof construction_object && !value.embedded)
            return value;
        const typed =
            value instanceof FormulaArg && !value.refs.size
                ? typedNumber(value.source)
                : null;
        if (typed === null) throw new TextError("arguments", named);
        return typed;
    });
    const method = designation(macro, initials, c.macros).complete;
    if (method === null) throw new TextError("arguments", named);
    const given = line.names ?? (line.name ? [line.name] : null);
    if (
        given &&
        (given.length !== macro.finals.length ||
            given.every((name) => name === "_"))
    )
        throw new TextError("macro_names", String(macro.finals.length));
    return {
        index,
        method,
        initials,
        names: given?.map((name) => (name === "_" ? null : name)) ?? null,
    };
}

// Applies it, or redefines the application `node`: its names are then
// those of its finals, or free; or redefines the image of an object by a
// macro that maps points.
export async function applyMacroLine(
    studio: Studio,
    { index, method, initials, names }: MacroSpec,
    node?: macro_object,
    image?: construction_object,
): Promise<construction_object[]> {
    const c = studio.scene;
    if (image) {
        const source = initials.at(-1)!;
        if (typeof source === "string" || source instanceof point_object)
            throw new TextError("macro_taken", formatName(image.name));
        const objects = figureObjects(c);
        const at = objects.indexOf(image);
        const refs = initials.map((initial) =>
            typeof initial === "string"
                ? initial
                : objectIndex(initial, (owner) => objects.indexOf(owner)),
        );
        if (
            refs.some(
                (ref) =>
                    typeof ref !== "string" &&
                    (Array.isArray(ref) ? (ref[1] as number) : ref) >= at,
            )
        )
            throw new TextError("macro_order");
        const call = [index, method, refs];
        const look = imageVerdict(c, call, source);
        const figure = await describeDgo(c);
        const [, name, , style] = figure.o[at];
        figure.o[at] = [
            "Mac",
            names?.[0] ?? name,
            [...call, look],
            ...(style === undefined ? [] : [style]),
        ];
        rebuild(studio, figure);
        return [];
    }
    const own = new Set<construction_object>(node?.children);
    names?.forEach((name, rank) => {
        if (name === null) return;
        const existing = c.getObj(name);
        if ((existing && !own.has(existing)) || names.indexOf(name) !== rank)
            throw new TextError("macro_taken", formatName(name));
    });
    if (!node)
        return applyMacro(c, index, method, initials, {
            names: names ?? undefined,
        });
    const objects = figureObjects(c);
    const at = objects.indexOf(node);
    const refs = initials.map((initial) =>
        typeof initial === "string"
            ? initial
            : objectIndex(initial, (owner) => objects.indexOf(owner)),
    );
    if (
        refs.some(
            (ref) =>
                typeof ref !== "string" &&
                (Array.isArray(ref) ? (ref[1] as number) : ref) >= at,
        )
    )
        throw new TextError("macro_order");
    const figure = await describeDgo(c);
    const [, name, , style] = figure.o[at];
    figure.o[at] = [
        "Mac",
        name,
        [index, method, refs],
        ...(style === undefined ? [] : [style]),
    ];
    // The finals not wanted, deleted once the others are there.
    const unwanted: string[] = [];
    node.children.forEach((final) => {
        const rank = final.output!.rank;
        const wanted = names ? names[rank - 1] : final.name;
        if (wanted === null) unwanted.push(final.name);
        else figure.o[objects.indexOf(final)][1] = wanted;
    });
    names?.forEach((wanted, rank) => {
        if (
            wanted !== null &&
            !node.children.some(({ output }) => output!.rank === rank + 1)
        )
            figure.o.push(["Out", wanted, [at, rank + 1]]);
    });
    rebuild(studio, figure);
    unwanted.forEach((gone) =>
        studio.scene.removeObject(studio.scene.getObj(gone)!),
    );
    return [];
}

// Opens the application's box: in its place, the objects of its body its
// finals need, named, the finals keeping their names and styles, the
// others the styles of their types: the figure, and their names, or null
// if the box can't be opened.
export async function openBox(
    c: construction,
    node: macro_object,
): Promise<{ figure: DgoFigure; names: string[] } | null> {
    const box = boxOf(c, node);
    if (!box) return null;
    const figure = await describeDgo(c);
    const objects = figureObjects(c);
    const at = objects.indexOf(node);
    const finals = new Set(node.children);
    const order = [
        ...objects.slice(0, at),
        ...box.objects,
        ...objects.slice(at + 1).filter((object) => !finals.has(object)),
    ];
    const positions = new Map(order.map((object, index) => [object, index]));
    const position = (object: construction_object) => positions.get(object)!;
    const keys = new Map(
        Object.entries(figure.img ?? {}).map(([key, url]) => [url, key]),
    );
    const context = {
        index: (object: construction_object) => objectIndex(object, position),
        image: (url: string) => keys.get(url)!,
        screen: ([x, y]: Vec2): Vec2 => [Math.round(x), Math.round(y)],
    };
    const styles = (figure.st ??= []);
    const known = new Map(
        styles.map((style, index) => [JSON.stringify(style), index]),
    );
    const styleIndex = (style: object): number => {
        const json = JSON.stringify(style);
        if (!known.has(json)) known.set(json, styles.push(style as never) - 1);
        return known.get(json)!;
    };
    const names: string[] = [];
    // m1 taken, m2.
    const free = (wanted: string): string => {
        const [, base, number] = /^(.*?)(\d*)$/.exec(wanted)!;
        let name = wanted;
        for (let k = +number + 1; c.getObj(name) || names.includes(name); k++)
            name = `${base}${k}`;
        names.push(name);
        return name;
    };
    const inside = new Set(box.objects);
    figure.o = order.map((object) => {
        if (!inside.has(object)) return dgoEntry(object, context, styleIndex);
        const written = box.entry(object, position);
        // A number typed, under the expressions shown.
        if (written[0] === "Ex" && !box.names.has(object))
            (written[1] as { xy: Vec2 }).xy = freeSpot(c);
        // A point made, named as the editor names those it makes; the
        // others styled as in the figure where the macro was defined.
        if (!box.names.has(object) && object instanceof point_object)
            object.showName = true;
        const entry = dgoEntry(object, context, styleIndex, written);
        if (finals.has(object)) names.push(object.name);
        else entry[1] = free(box.names.get(object) ?? nextName(c, written[0]));
        return entry;
    });
    return { figure, names };
}
