import type { construction } from "../construction";
import { addDgoEntries, figureObjects, lookTag, objectStyle } from "../dgo";
import { accepts, isCommand } from "./catalog";
import { message } from "./messages";
import { button_object } from "../objects/button_object";
import { center_object } from "../objects/center_object";
import { arc3pts_object } from "../objects/arc3pts_object";
import { center_arc_object } from "../objects/center_arc_object";
import { circle1_object } from "../objects/circle1_object";
import { circle3_object } from "../objects/circle3_object";
import { circle_object } from "../objects/circle_object";
import {
    objectEntry,
    objectIndex,
    type construction_object,
} from "../objects/construction_object";
import { event_object } from "../objects/event_object";
import { expression_object } from "../objects/expression_object";
import { free_vector_object } from "../objects/free_vector_object";
import { image_object } from "../objects/image_object";
import { locus_object } from "../objects/locus_object";
import {
    MACRO_TYPES,
    SUB_OBJECTS,
    type Macro,
    type MacroMethod,
    type macro_object,
} from "../objects/macro_object";
import { panel_object } from "../objects/panel_object";
import { point_object } from "../objects/point_object";
import { polygon_object } from "../objects/polygon_object";
import type { primitive_quadric_object } from "../objects/primitive_quadric_object";
import { imageLook, type transformable } from "../objects/transformed_object";
import { vAdd, vDot, vNorm, vNormalize, vScale, vSub, type Vec3 } from "../vec";
import { figureIndex, imageStyle, nextName } from "./figure";
import { semicircle_object } from "../objects/semicircle_object";

// Defining a macro-construction from the figure: see MACROS.md.

// What an initial of this object would be, if it can be one.
export const initialType = (object: construction_object): string | null =>
    Object.keys(MACRO_TYPES).find((type) => MACRO_TYPES[type](object)) ?? null;

// The object of the figure it is, or that it stands for in the body of an
// application (see standIn in macro_object.ts), if any: not one of a
// body's own.
function figureObject(
    object: construction_object,
    figure: Set<construction_object>,
): construction_object | undefined {
    for (let found = object; found; found = Object.getPrototypeOf(found))
        if (figure.has(found)) return found;
}

// The objects of the figure each sub-object of an initial stands for, in
// the order of initialSlots.
export function subObjects(
    c: construction,
    type: string,
    initial: construction_object,
): construction_object[][] {
    const object = initial as unknown as Record<string, construction_object>;
    const figure = new Set(figureObjects(c));
    const centers = () => [
        ...(initial instanceof circle_object ||
        initial instanceof circle1_object ||
        initial instanceof circle3_object
            ? [object.P1]
            : initial instanceof center_arc_object
              ? [object.M]
              : []),
        ...[...figure].filter(
            (other) =>
                other instanceof center_object && other.circle === initial,
        ),
    ];
    const lists = (): construction_object[][] => {
        switch (type) {
            case "segment":
            case "vector":
                return [[object.P1], [object.P2]];
            case "ray":
            case "sphere":
                return [[object.P1]];
            case "circle":
                return [centers()];
            case "arc":
                return [
                    centers(),
                    initial instanceof arc3pts_object
                        ? [object.P1]
                        : initial instanceof center_arc_object ||
                            initial instanceof semicircle_object
                          ? [object.A]
                          : [],
                    initial instanceof arc3pts_object
                        ? [object.P3]
                        : initial instanceof semicircle_object
                          ? [object.B]
                          : [],
                ];
            case "angle":
                return [[object.A], [object.O], [object.B]];
            default:
                return [];
        }
    };
    return lists().map((objects) =>
        objects.flatMap((found) => figureObject(found, figure) ?? []),
    );
}

// What a manipulation changes, which a macro can't compute, and what acts
// on the figure or names its images, which a body can't hold (see DGO.md).
// A circle's numeric radius, though a manipulation changes it, is a
// constant of the body, and so is the place of a point on an object, but
// for a final, which the application's own manipulation moves (see
// MACROS.md).
const unbuilt = (object: construction_object): boolean =>
    object.constructor === point_object ||
    object instanceof free_vector_object ||
    (object instanceof expression_object &&
        !object.formula &&
        !object.program) ||
    object instanceof button_object ||
    object instanceof event_object ||
    object instanceof panel_object ||
    object instanceof image_object;

// Its parents but the condition it is shown on and a script styling it,
// made its parent only to be run first (see expression_object.ts), which
// DGPad's macros ignore.
const builtFrom = (object: construction_object): construction_object[] =>
    object.parents.filter(
        (parent) =>
            parent !== object.condition &&
            !(
                parent instanceof expression_object &&
                parent.program &&
                [...parent.program.targets.values()].includes(object)
            ),
    );

export interface Analysis {
    // The initials and the objects of the figure their sub-objects stand
    // for.
    given: Set<construction_object>;
    determined(object: construction_object): boolean;
    // What it is built from in the figure: not an object's own inner
    // points, the condition it is shown on, nor a script styling it.
    sources(object: construction_object): construction_object[];
}

// What the initials determine: they and their sub-objects, and what is
// built from them only; a locus, when they determine its point's support
// and what leads from that point to its own. What is built from nothing,
// such as a fixed point, is an initial it misses, as in DGPad and
// GeoGebra.
export function analyse(
    c: construction,
    initials: construction_object[],
): Analysis {
    const given = new Set<construction_object>(initials);
    initials.forEach((initial) =>
        subObjects(c, initialType(initial)!, initial).forEach((objects) =>
            objects.forEach((object) => given.add(object)),
        ),
    );
    const figure = new Set(figureObjects(c));
    const sources = (object: construction_object) =>
        builtFrom(object).filter((parent) => figure.has(parent));
    const known = new Map<construction_object, boolean>();
    const determined = (
        object: construction_object,
        assumed?: construction_object,
    ): boolean => {
        if (given.has(object) || object === assumed) return true;
        if (!assumed && known.has(object)) return known.get(object)!;
        const parents = sources(object);
        const result =
            object instanceof locus_object
                ? determined(object.driver.support, assumed) &&
                  determined(object.target, object.driver)
                : !unbuilt(object) &&
                  parents.length > 0 &&
                  parents.every((parent) => determined(parent, assumed));
        if (!assumed) known.set(object, result);
        return result;
    };
    return { given, determined: (object) => determined(object), sources };
}

// The objects a macro would draw: those chosen, or else the visible ones
// the initials determine.
export function finalsOf(
    c: construction,
    { given, determined }: Analysis,
    chosen: construction_object[],
): construction_object[] {
    return chosen.length
        ? chosen
        : figureObjects(c).filter(
              (object) =>
                  !object.isHidden && !given.has(object) && determined(object),
          );
}

// What the initials miss to determine the object: its ancestors that
// aren't determined, all of whose parents are.
export function missing(
    { given, determined, sources }: Analysis,
    object: construction_object,
): construction_object[] {
    const found = new Set<construction_object>();
    const seen = new Set<construction_object>();
    const visit = (next: construction_object): void => {
        if (seen.has(next) || given.has(next) || determined(next)) return;
        seen.add(next);
        const parents = sources(next);
        if (parents.every(determined)) found.add(next);
        parents.forEach(visit);
    };
    visit(object);
    return [...found];
}

// A method computing the finals from the initials, in this order: the
// objects of the figure between them, with their styles. A fixed initial
// is looked for by its name (see MACROS.md).
export function methodOf(
    c: construction,
    initials: construction_object[],
    finals: construction_object[],
    messages: string[],
    help: string,
    fixed: construction_object[] = [],
): MacroMethod {
    const local = new Map<construction_object, number>();
    const names: string[] = [];
    let count = 0;
    initials.forEach((initial) => {
        subObjects(c, initialType(initial)!, initial).forEach((objects) => {
            objects.forEach((object) => local.set(object, count));
            names.push(objects[0]?.name ?? "");
            count++;
        });
        local.set(initial, count++);
        names.push(initial.name);
    });
    // Between the initials and the finals.
    const needed = new Set<construction_object>();
    const visit = (object: construction_object): void => {
        if (needed.has(object) || local.has(object)) return;
        needed.add(object);
        builtFrom(object).forEach(visit);
    };
    finals.forEach(visit);
    const context = {
        index: (object: construction_object) =>
            objectIndex(object, (owner) => local.get(owner)!),
        image: (url: string) => url,
        screen: (position: [number, number]) => position,
    };
    const body = figureObjects(c)
        .filter((object) => needed.has(object))
        .map((object) => {
            const [tag, parameters] = objectEntry(object, context);
            const entry = [tag, object.name, parameters];
            local.set(object, count++);
            const style = objectStyle(object, lookTag(object, tag));
            return Object.keys(style).length ? [...entry, style] : entry;
        });
    return {
        initials: initials.map((initial, index) =>
            fixed.includes(initial)
                ? [initialType(initial)!, messages[index] ?? "", initial.name]
                : [initialType(initial)!, messages[index] ?? ""],
        ),
        names,
        help,
        body,
        finals: finals.map((final) => local.get(final)!),
    };
}

// The type of an object a body's entry of this .dgo type gives, to compare
// the finals of two methods.
const TAG_TYPES: Record<string, string> = Object.fromEntries(
    (
        [
            [
                "point",
                "Pt Fix Fp On Mid Sym Refl Rot Dil Tra Inv TC Vtx Ctr DirP PlI Int CyI CubV Abv NetV",
            ],
            ["line", "Line Par Perp Med EqL Tan TanX PlPl Nrm"],
            ["ray", "Ray Bis FA"],
            ["segment", "Seg"],
            ["vector", "Vec VecF"],
            ["circle", "Cir C1 CAx C3 C3p C3s EqC SphC Disk"],
            ["arc", "Arc Sec Arcs Secs CArc CSec CArcs CSecs Semi"],
            ["conic", "Quad Ell Ell1 Hyp Hyp1 Prb EqQ QArc QSec"],
            ["polygon", "Poly RegP PlS"],
            ["plane", "Pl PlP PlL PlO PlE"],
            ["sphere", "Sph Sph1"],
        ] as const
    ).flatMap(([type, tags]) => tags.split(" ").map((tag) => [tag, type])),
);

// A final applied from a macro in the body is of the type of that macro's
// own final, an image by a transformation of its object's, or of the look
// saved (see TRANSFORMATIONS.md).
function finalTypes(
    macros: Macro[],
    { body, finals, initials }: MacroMethod,
): string[] {
    const slots = slotCount(initials);
    const slotTypes = initials.flatMap(([type]) => [
        ...Array<string>(SUB_OBJECTS[type] ?? 0).fill("point"),
        type,
    ]);
    const typeOf = (ref: unknown): string =>
        Array.isArray(ref)
            ? ref[0] === "side"
                ? "segment"
                : ref[0] === "face"
                  ? "polygon"
                  : "point"
            : typeAt(ref as number);
    const typeAt = (index: number): string => {
        if (index < slots) return slotTypes[index];
        const [tag, , parameters] = body[index - slots];
        const values = parameters as unknown[];
        if (["Sym", "Refl", "Rot", "Dil", "Tra"].includes(tag as string))
            return typeOf(values[1]);
        if (tag === "Inv" && typeOf(values[1]) !== "point") return "Inv";
        if (tag === "Mac" && typeof values[3] === "string")
            return TAG_TYPES[values[3]] ?? values[3];
        if (tag !== "Out") return TAG_TYPES[tag as string] ?? (tag as string);
        const [node, rank] = parameters as number[];
        const [macro, method] = body[node - slots][2] as number[];
        return finalTypes(macros, macros[macro].methods[method])[rank - 1];
    };
    return finals.map(typeAt);
}

// The initials and their sub-objects, which a body's indices begin with.
const slotCount = (initials: MacroMethod["initials"]): number =>
    initials.reduce((sum, [type]) => sum + (SUB_OBJECTS[type] ?? 0) + 1, 0);

// What saving the method under this name does: a new macro, a method added
// to the macro of that name, one of its methods replaced, or nothing, and
// why.
export type Saving =
    | { kind: "create" }
    | { kind: "add"; macro: Macro }
    | { kind: "replace"; macro: Macro; method: number }
    | { kind: "finals" | "ambiguous" | "later"; macro: Macro };

export function savingOf(
    macros: Macro[],
    name: string,
    method: MacroMethod,
): Saving {
    const macro = macros.find((other) => other.name === name);
    if (!macro) return { kind: "create" };
    const types = finalTypes(macros, method);
    if (
        macro.finals.length !== types.length ||
        macro.methods.some(
            (other) =>
                JSON.stringify(finalTypes(macros, other)) !==
                JSON.stringify(types),
        )
    )
        return { kind: "finals", macro };
    // A method uses only the macros before its own.
    const index = macros.indexOf(macro);
    if (
        method.body.some(
            ([tag, , parameters]) =>
                tag === "Mac" && (parameters as number[])[0] >= index,
        )
    )
        return { kind: "later", macro };
    const signature = method.initials.map(([type]) => type);
    const same = macro.methods.findIndex(
        ({ initials }) =>
            JSON.stringify(initials.map(([type]) => type)) ===
            JSON.stringify(signature),
    );
    if (same >= 0) return { kind: "replace", macro, method: same };
    const begins = (shorter: string[], longer: string[]) =>
        shorter.length <= longer.length &&
        shorter.every((type, k) => type === longer[k]);
    if (
        macro.methods.some(({ initials }) => {
            const other = initials.map(([type]) => type);
            return begins(other, signature) || begins(signature, other);
        })
    )
        return { kind: "ambiguous", macro };
    return { kind: "add", macro };
}

// Saves it as `savingOf` says, if it can be.
export function save(
    c: construction,
    saving: Saving,
    name: string,
    finalNames: string[],
    icon: string | null,
    method: MacroMethod,
): void {
    if (saving.kind === "create")
        c.macros.push({ name, finals: finalNames, icon, methods: [method] });
    else if (saving.kind === "add") saving.macro.methods.push(method);
    else if (saving.kind === "replace")
        saving.macro.methods[saving.method] = method;
}

// Why it can't be a macro's name, typed as a command.
export const nameProblem = (name: string): string | null =>
    !/^[\p{L}_][\p{L}\p{M}\p{N}_]*$/u.test(name)
        ? message("macro_bad_name")
        : isCommand(name)
          ? message("macro_command_name", name)
          : null;

// A name for a new macro.
export function macroName(c: construction, base: string): string {
    let index = 1;
    while (c.macros.some(({ name }) => name === `${base}${index}`)) index++;
    return `${base}${index}`;
}

// An initial designated, or a number typed.
export type Picked = construction_object | string;

const fits = (type: string, initial: Picked): boolean =>
    typeof initial === "string"
        ? type === "number"
        : type === "invertible"
          ? accepts(initial, type)
          : MACRO_TYPES[type](initial);

// Whether the method maps a point, its last initial, to a point, its only
// final: it then takes an object instead, whose image it gives (see
// TRANSFORMATIONS.md).
export const mapsPoints = (macros: Macro[], method: MacroMethod): boolean =>
    method.initials.at(-1)![0] === "point" &&
    method.finals.length === 1 &&
    finalTypes(macros, method)[0] === "point";

// Its initials, the last one of a method that maps points taking a point
// or an object.
const takenInitials = (
    macros: Macro[],
    method: MacroMethod,
): MacroMethod["initials"] =>
    mapsPoints(macros, method)
        ? [
              ...method.initials.slice(0, -1),
              ["invertible", ...method.initials.at(-1)!.slice(1)] as [
                  string,
                  string,
                  string?,
              ],
          ]
        : method.initials;

// Applying a macro, its initials designated one after the other: the
// method they complete, if any, the type and message of what each method
// they begin takes next, and the types of those that one more completes.
export interface Designation {
    complete: number | null;
    next: MacroMethod["initials"];
    last: string[];
}

export function designation(
    macro: Macro,
    picked: Picked[],
    macros: Macro[],
): Designation {
    const begun = macro.methods
        .map((method, index) => ({
            initials: takenInitials(macros, method),
            index,
        }))
        .filter(
            ({ initials }) =>
                initials.length >= picked.length &&
                picked.every((initial, rank) =>
                    fits(initials[rank][0], initial),
                ),
        );
    const after = (more: number) =>
        begun.filter(
            ({ initials }) => initials.length === picked.length + more,
        );
    return {
        complete: after(0)[0]?.index ?? null,
        next: begun.flatMap(({ initials }) =>
            initials.length > picked.length ? [initials[picked.length]] : [],
        ),
        last: after(1).map(({ initials }) => initials[picked.length][0]),
    };
}

export const takesNext = ({ next }: Designation, initial: Picked): boolean =>
    next.some(([type]) => fits(type, initial));

// Whether this initial completes a method.
export const completes = ({ last }: Designation, initial: Picked): boolean =>
    last.some((type) => fits(type, initial));

// By the name a fixed initial is looked for by, the name of the object
// last designated for it, in any figure: what the next application takes
// without asking, as would one so named (see MACROS.md).
const fixedObjects = new Map<string, string>();

// The name a fixed initial is looked for by, if what comes next is one,
// the same for every method begun.
function fixedNext({ next }: Designation): string | null {
    const [first] = next;
    return first?.[2] && next.every(([, , fixed]) => fixed === first[2])
        ? first[2]
        : null;
}

// Whether what comes next is a fixed initial: this object is then the one
// it takes.
export function rememberFixed(next: Designation, initial: Picked): boolean {
    const key = fixedNext(next);
    if (key && typeof initial !== "string") fixedObjects.set(key, initial.name);
    return !!key;
}

// The rank of the first fixed initial designated, or -1.
export const firstFixed = (
    macro: Macro,
    picked: Picked[],
    macros: Macro[],
): number =>
    picked.findIndex(
        (_, rank) =>
            !!fixedNext(designation(macro, picked.slice(0, rank), macros)),
    );

// The initials designated, and after them the fixed ones the figure has,
// unless they would complete a method: an application isn't made without
// a tap.
export function withFixed(
    c: construction,
    macro: Macro,
    picked: Picked[],
    // Those its applications refer to, for a macro of a library.
    macros = c.macros,
): Picked[] {
    const filled = [...picked];
    for (;;) {
        const next = designation(macro, filled, macros);
        const key = fixedNext(next);
        if (!key) return filled;
        const object = [fixedObjects.get(key), key]
            .map((name) => name && c.getObj(name))
            .find((found) => found && takesNext(next, found));
        if (!object || completes(next, object) || filled.includes(object))
            return filled;
        filled.push(object);
    }
}

// A number typed as an initial, as a .dgo formula: null if it isn't one.
export function typedNumber(text: string): string | null {
    const number = text.trim().replace(",", ".");
    return /^-?(\d+\.?\d*|\.\d+)$/.test(number) ? number : null;
}

// The application of the macro's method to the initials, and its finals,
// named as the macro's own unless taken, styled as in its body.
export function applyMacro(
    c: construction,
    index: number,
    method: number,
    initials: Picked[],
    {
        // Of the names, for a preview.
        prefix = "",
        // Of the finals, null for one not wanted.
        names,
    }: { prefix?: string; names?: (string | null)[] } = {},
): construction_object[] {
    const macro = c.macros[index];
    const objects = figureObjects(c);
    const taken = new Set<string>();
    const free = (base: string): string => {
        base = prefix + base;
        let name = base;
        for (let k = 1; c.getObj(name) || taken.has(name); k++)
            name = `${base}${k}`;
        taken.add(name);
        return name;
    };
    const refs = initials.map((initial) =>
        typeof initial === "string"
            ? initial
            : objectIndex(initial, (owner) => objects.indexOf(owner)),
    );
    const source = initials.at(-1)!;
    if (
        typeof source !== "string" &&
        !(source instanceof point_object) &&
        mapsPoints(c.macros, macro.methods[method])
    ) {
        const look = imageVerdict(c, [index, method, refs], source);
        const name = names?.[0] ?? prefix + nextName(c, look);
        c.beginBatch();
        addDgoEntries(
            c,
            [["Mac", name, [index, method, refs, look], 0]],
            [imageStyle(source, look, figureIndex(c))],
        );
        c.endBatch();
        return [c.getObj(name)!];
    }
    const styles: unknown[] = [];
    // Drawn once styled.
    c.beginBatch();
    addDgoEntries(
        c,
        [
            ["Mac", free("mac"), [index, method, refs]],
            ...macro.finals.flatMap((_, rank) => {
                if (names?.[rank] === null) return [];
                const style = finalStyle(macro.methods[method], rank);
                const entry = [
                    "Out",
                    names?.[rank] ?? free(macro.finals[rank]),
                    [objects.length, rank + 1],
                ];
                return [style ? [...entry, styles.push(style) - 1] : entry];
            }),
        ],
        styles,
    );
    c.endBatch();
    return figureObjects(c).slice(objects.length + 1);
}

// The look of the image of the object by a macro that maps points, found
// from the images of points of it, each the application of the method
// `call`, saved with it (see TRANSFORMATIONS.md): straight, round, a
// conic, or else the locus of the image of a point, for a polygon the
// polygon of the images of points along its sides.
export function imageVerdict(
    c: construction,
    call: unknown[],
    source: construction_object,
): string {
    const trial = <T extends construction_object>(look: string): T => {
        c.beginBatch();
        addDgoEntries(
            c,
            [["Mac", "‧t", [...call, look], 0]],
            [{ h: 1, p: 100 }],
        );
        c.endBatch();
        const object = c.getObj("‧t") as T;
        c.removeObject(object);
        return object;
    };
    const images = (object: polygon_object | locus_object): Vec3[] =>
        (object instanceof polygon_object
            ? object.points.map((point) => point.defined && point.coords)
            : object.points
        ).filter((point): point is Vec3 => !!point);
    const kind = source as transformable;
    if (kind instanceof polygon_object) {
        const sampled = trial<polygon_object>("Loc");
        return sampled.defined &&
            kind.vertices.every((_, side) =>
                straight(images(sampled).slice(32 * side, 32 * side + 33)),
            )
            ? "Poly"
            : "Loc";
    }
    if (imageLook(kind) === "Loc") return "Loc";
    const points = images(trial<locus_object>("Loc"));
    if (imageLook(kind) === "Quad") {
        const conic = trial<primitive_quadric_object>("Quad");
        return conic.defined &&
            points.every((point) =>
                near(point, conic.projectPoint(point), point),
            )
            ? "Quad"
            : "Loc";
    }
    if (straight(points)) {
        const look = imageLook(kind, true);
        return look === "Loc" ? imageLook(kind) : look;
    }
    return round(points) ? imageLook(kind, false) : "Loc";
}

// Equal, up to rounding errors, at the scale of `at`.
const near = (p: Vec3, q: Vec3, at: Vec3): boolean =>
    vNorm(vSub(p, q)) <= 1e-6 * (1 + vNorm(at));

// Whether the points are on a line.
function straight(points: Vec3[]): boolean {
    const [a] = points;
    const far = points.reduce((best, point) =>
        vNorm(vSub(point, a)) > vNorm(vSub(best, a)) ? point : best,
    );
    const u = vNormalize(vSub(far, a));
    return (
        points.length > 2 &&
        !!u &&
        points.every((point) =>
            near(
                point,
                vAdd(a, vScale(u, vDot(vSub(point, a), u))),
                vSub(point, a),
            ),
        )
    );
}

// Whether the points are on a circle of the plane.
function round(points: Vec3[]): boolean {
    const n = points.length;
    if (n < 4) return false;
    const [[ax, ay], [bx, by], [cx, cy]] = [0, 1, 2].map(
        (k) => points[Math.floor((k * n) / 3)],
    );
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    const square = (x: number, y: number) => x * x + y * y;
    const center: Vec3 = [
        (square(ax, ay) * (by - cy) +
            square(bx, by) * (cy - ay) +
            square(cx, cy) * (ay - by)) /
            d,
        (square(ax, ay) * (cx - bx) +
            square(bx, by) * (ax - cx) +
            square(cx, cy) * (bx - ax)) /
            d,
        0,
    ];
    const radius = Math.hypot(ax - center[0], ay - center[1]);
    return (
        Number.isFinite(radius) &&
        points.every(
            ([x, y, z]) =>
                Math.abs(Math.hypot(x - center[0], y - center[1]) - radius) <=
                    1e-6 * (1 + radius) && Math.abs(z - points[0][2]) <= 1e-9,
        )
    );
}

// The style a final, from 0, is applied with: that in the body.
export function finalStyle(
    { initials, body, finals }: MacroMethod,
    rank: number,
): Record<string, unknown> | undefined {
    return body[finals[rank] - slotCount(initials)][3] as
        Record<string, unknown> | undefined;
}

// The figure's macro of this name, by its index, or -1.
export const macroIndex = (c: construction, name: string): number =>
    c.macros.findIndex((macro) => macro.name === name);

// Whether one of its methods takes the object at this place.
export const takesAt = (
    macro: Macro,
    position: number,
    object: construction_object,
): boolean =>
    macro.methods.some(({ initials }) =>
        initials[position] ? fits(initials[position][0], object) : false,
    );

// What opening an application brings into the figure, in order: what
// stands for its initials' sub-objects the figure lacks (a circle's
// center), a number typed as an expression, then the objects of its body that its finals
// need, among which the finals themselves.
export interface Box {
    objects: construction_object[];
    // The names of those of the body, in it.
    names: Map<construction_object, string>;
    // Its .dgo type and parameters, given the positions of the figure's
    // objects and of the box's.
    entry(
        object: construction_object,
        index: (object: construction_object) => number,
    ): [string, unknown];
}

// Null if a final needs an end of an arc the figure doesn't have, which no
// entry describes.
export function boxOf(c: construction, node: macro_object): Box | null {
    const { macro, method, initials, local } = node;
    const { initials: types, body } = macro.methods[method];
    const slots = local.length - body.length;
    // The object of the figure each of the body's stands for.
    const inFigure = new Set(figureObjects(c));
    const figure = new Map<construction_object, construction_object>(
        node.standIns.flatMap((standIn) => {
            const found = figureObject(standIn, inFigure);
            return found ? [[standIn, found]] : [];
        }),
    );
    const typed = new Set<construction_object>();
    let slot = 0;
    initials.forEach((initial, rank) => {
        if (typeof initial === "string") {
            typed.add(local[slot++]);
            return;
        }
        subObjects(c, types[rank][0], initial).forEach(([found]) => {
            if (found) figure.set(local[slot], found);
            slot++;
        });
        slot++;
    });
    const entry = (
        object: construction_object,
        index: (object: construction_object) => number,
    ): [string, unknown] => {
        const position = (other: construction_object) =>
            index(figure.get(other) ?? other);
        const context = {
            index: (other: construction_object) =>
                objectIndex(figure.get(other) ?? other, position),
            image: (url: string) => url,
            screen: ([x, y]: [number, number]): [number, number] => [
                Math.round(x),
                Math.round(y),
            ],
        };
        const at = local.indexOf(object) - slots;
        // A final of an application in the body, whose own may have been
        // taken by this one.
        if (at >= 0 && body[at][0] === "Out") {
            const [inner, rank] = body[at][2] as number[];
            return ["Out", [context.index(local[inner]), rank]];
        }
        return object.dgo(context);
    };
    // What the finals in the figure need, never an object of the figure.
    const needed = new Set<construction_object>();
    const visit = (object: construction_object): void => {
        if (needed.has(object) || inFigure.has(object)) return;
        needed.add(object);
        entry(object, (other) => {
            visit(other);
            return 0;
        });
    };
    node.children.forEach((final) => {
        needed.add(final);
        entry(final, (other) => {
            visit(other);
            return 0;
        });
    });
    const objects = local.filter((object) => needed.has(object));
    if (
        objects.some(
            (object) =>
                local.indexOf(object) < slots &&
                !typed.has(object) &&
                !(object instanceof center_object),
        )
    )
        return null;
    return {
        objects,
        names: new Map(
            body.map(([, name], at) => [local[slots + at], name as string]),
        ),
        entry,
    };
}
