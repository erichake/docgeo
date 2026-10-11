import { construction, type DgpadLike } from "../construction";
import {
    addDgoEntries,
    describeDgo,
    figureObjects,
    readDgo,
    type DgoFigure,
} from "../dgo";
import type { construction_object } from "../objects/construction_object";
import { point_on_object } from "../objects/point_on_object";
import type { point_object } from "../objects/point_object";
import { polygon_object } from "../objects/polygon_object";
import { quadric5pts_object } from "../objects/quadric5pts_object";
import type { Vec3 } from "../vec";
import {
    commandName,
    COMMANDS,
    decodeEntry,
    findCommand,
    overloadFor,
    type Arg,
    type Overload,
} from "./catalog";
import { formatName, formatNumber, TextError, type Line } from "./text";

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
    params: ["real", "real"],
    variadic: true,
    tag: "Pt",
    encode: (args) => args,
};

const POINT_TAGS = new Set([
    "Pt",
    "Fix",
    "On",
    "Mid",
    "Sym",
    "Refl",
    "Ctr",
    "Int",
]);
export const isPointTag = (tag: string): boolean => POINT_TAGS.has(tag);

// Free in formulas, or easily mistaken.
const RESERVED = new Set(["e", "i", "k", "l", "o", "t", "x", "y", "z"]);

// A point's name is a capital letter, any other object's a small one, then
// numbered.
export function nextName(c: construction, point: boolean): string {
    const letters = [
        ...(point
            ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
            : "abcdefghijklmnopqrstuvwxyz"),
    ].filter((letter) => !RESERVED.has(letter));
    for (let number = 0; ; number++)
        for (const letter of letters) {
            const name = number ? `${letter}${number}` : letter;
            if (!c.getObj(name)) return name;
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

// Its line, null when no command writes it.
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
    const decoded = decodeEntry(tag, parameters, (at) => objects[at]);
    return (
        decoded &&
        `${name} = ${commandName(decoded.command)}(${decoded.args.map(formatArg).join(", ")})`
    );
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
        if (overload.tag === "Int" && overload.params[2] === "real") {
            const branch = args[2] as number;
            if (!Number.isInteger(branch) || branch < 1 || branch > 4)
                throw new TextError("branch");
        }
    }
    const chosen =
        name ?? target?.name ?? nextName(c, isPointTag(overload.tag));
    const named = c.getObj(chosen);
    if (named && named !== target) throw new TextError("name_taken", chosen);
    return { name: chosen, overload, args };
}

// As DGPad's tools build them: points named, regions filled.
function createdStyle(tag: string): Record<string, unknown> | undefined {
    if (isPointTag(tag)) return { sn: 1 };
    if (tag === "Poly" || tag === "Sph" || tag === "Sec") return { o: 0.2 };
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
        support instanceof quadric5pts_object;
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

// Rebuilds the figure, `target` redefined: the objects are reordered so that
// each comes after those it is built from.
export async function redefine(
    studio: Studio,
    target: construction_object,
    { name, overload, args }: Spec,
): Promise<void> {
    const c = studio.scene;
    const after = descendants(target);
    const parents = args.filter(
        (arg): arg is construction_object => typeof arg !== "number",
    );
    if (parents.some((parent) => after.has(parent)))
        throw new TextError("cycle");
    const objects = figureObjects(c);
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
            (object === target ? parents : object.parents)
                .filter(
                    (parent) =>
                        parent !== object.condition &&
                        own.has(parent) &&
                        !placed.has(parent),
                )
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
