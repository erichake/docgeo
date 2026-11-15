import type { construction } from "./construction";
import { circle1_object } from "./objects/circle1_object";
import { curve_object, typedFormula } from "./objects/curve_object";
import { figureObjects, type DgoFigure } from "./dgo";
import type { construction_object } from "./objects/construction_object";
import { expression_object } from "./objects/expression_object";
import { free_vector_object } from "./objects/free_vector_object";
import type { grid_object } from "./objects/grid_object";
import { intersection_object } from "./objects/intersection_object";
import { list_object } from "./objects/list_object";
import { macro_object } from "./objects/macro_object";
import { point_on_object } from "./objects/point_on_object";
import { point_object } from "./objects/point_object";

// See DGO.md, « État élève ».
type Value = number | string | null | Value[];
export type FigureState = Record<string, Value>;

export interface Target {
    name: string;
    kind: "point" | "expression";
    hidden: boolean;
    movable: boolean;
}

type Stated =
    | point_object
    | expression_object
    | circle1_object
    | free_vector_object
    | macro_object
    | curve_object;

// The view a figure was built with, which pinned points' coordinates are
// read in: a drag changes their window position, not the view, which isn't
// part of the state.
export type BuiltView = Pick<grid_object, "ORG" | "UNIT">;
// The view's origin and unit are replaced, never changed in place.
export const builtView = ({
    GRID: { ORG, UNIT },
}: construction): BuiltView => ({
    ORG,
    UNIT,
});

// JSON has no NaN.
const json = (value: number): number | null =>
    Number.isFinite(value) ? value : null;

function check(condition: unknown): asserts condition {
    if (!condition) throw new Error("Invalid state");
}

const isReal = (value: unknown): boolean =>
    value === null || typeof value === "number";
const isReals = (value: unknown, min: number, max = min): boolean =>
    Array.isArray(value) &&
    value.length >= min &&
    value.length <= max &&
    value.every(isReal);

// What a manipulation changes: free points, pinned ones included, points on
// objects (their parameter), numbers (sliders, checkboxes, what input boxes
// and points defined by formulas change), the radii of circles that aren't
// formulas, free vectors and the functions that input boxes redefine. Besides, the branch of an intersection whose solutions
// are followed as the figure moves (see intersection_object.groupAssign):
// the same objects' values reached otherwise could lead to another one;
// those of a macro's application, by its branches. A macro's final is
// manipulated only along its support, as a point on object.
function stated(c: construction): Stated[] {
    const objects = figureObjects(c);
    const fields = new Set(
        objects.flatMap((object) =>
            object instanceof expression_object && object.inputLength
                ? [object.fieldTarget()]
                : [],
        ),
    );
    return objects.filter(
        (object): object is Stated =>
            (object instanceof curve_object && fields.has(object)) ||
            (object instanceof macro_object &&
                object.branches.flat(Infinity).length > 0) ||
            object instanceof point_on_object ||
            (!object.output &&
                (object.constructor === point_object ||
                    (object instanceof expression_object &&
                        !object.formula &&
                        !object.program &&
                        typeof object.value === "number") ||
                    (object instanceof intersection_object &&
                        !object.away &&
                        object.branch !== null) ||
                    (object instanceof circle1_object &&
                        typeof object.radius === "number") ||
                    object instanceof free_vector_object)),
    );
}

// A point on an object that coordinates can place: its parameter is a number
// that alphaFor finds back from a position.
const placeable = (object: point_on_object): boolean =>
    typeof object.alpha === "number" &&
    object.support.familytype !== "locus" &&
    !(object.support instanceof list_object);

// Coordinates given instead of a point on object's parameter.
const isPlace = (value: unknown): value is number[] =>
    Array.isArray(value) &&
    value.length >= 2 &&
    value.length <= 3 &&
    value.every(Number.isFinite);

// What a manipulation changes directly.
const movable = (c: construction): Stated[] =>
    stated(c).filter((object) => !(object instanceof intersection_object));

function stateValue(object: Stated, vec3: boolean, view: BuiltView): Value {
    if (object instanceof macro_object) return object.branches as Value;
    if (object instanceof intersection_object) return object.branch;
    if (object instanceof circle1_object) return json(object.radius as number);
    if (object instanceof curve_object) return object.formula.source;
    if (object instanceof free_vector_object)
        return (vec3 ? object.P2.coords : object.P2.coords.slice(0, 2)).map(
            json,
        );
    if (object instanceof point_on_object)
        return typeof object.alpha === "number"
            ? json(object.alpha)
            : object.alpha.map(json);
    if (object instanceof point_object) {
        const coords = !object.pinned
            ? object.coords
            : object.C.GRID.FRAME2D
              ? [...object.pinned, 0]
              : object.pinnedIn(view);
        return (vec3 ? coords : coords.slice(0, 2)).map(json);
    }
    return json(object.value as number);
}

// Each stated object's value, as JSON.
export function figureValues(
    c: construction,
    view: BuiltView,
): Map<string, string> {
    const vec3 = !c.GRID.is2D;
    return new Map(
        stated(c).map((object) => [
            object.name,
            JSON.stringify(stateValue(object, vec3, view)),
        ]),
    );
}

// The values that differ from `base`'s.
export function figureState(
    c: construction,
    base: Map<string, string>,
    view: BuiltView,
): FigureState {
    const state: FigureState = {};
    figureValues(c, view).forEach((value, name) => {
        if (value !== base.get(name)) state[name] = JSON.parse(value);
    });
    return state;
}

// `figure`, which `c` was built from, with the given state: a figure built
// afresh from it is the one the state was taken from. All or nothing:
// anything malformed rejects the whole state.
export function stateFigure(
    c: construction,
    figure: DgoFigure,
    state: unknown,
): DgoFigure {
    check(typeof state === "object" && state !== null && !Array.isArray(state));
    const objects = figureObjects(c);
    const indices = new Map(
        stated(c).map((object) => [object.name, objects.indexOf(object)]),
    );
    const entries = [...figure.o];
    Object.entries(state).forEach(([name, value]) => {
        const index = indices.get(name);
        check(index !== undefined);
        const object = objects[index];
        const [tag, , parameters, ...style] = entries[index];
        let changed: unknown;
        if (object instanceof macro_object) {
            check(Array.isArray(value));
            changed = [...(parameters as unknown[]).slice(0, 3), value];
        } else if (object instanceof intersection_object) {
            check(Number.isInteger(value) && value >= 0 && value <= 3);
            changed = [...(parameters as unknown[]).slice(0, 2), value];
        } else if (object instanceof curve_object) {
            const formula =
                typeof value === "string" && typedFormula(object, value);
            check(formula);
            const { source, refs } = formula;
            changed = [
                refs.size
                    ? [
                          source,
                          Object.fromEntries(
                              [...refs].map(([name, ref]) => [
                                  name,
                                  objects.indexOf(ref),
                              ]),
                          ),
                      ]
                    : source,
                ...(parameters as unknown[]).slice(1),
            ];
        } else if (object instanceof circle1_object) {
            check(isReal(value));
            const [center, , ...axis] = parameters as unknown[];
            changed = [center, value, ...axis];
        } else if (object instanceof point_on_object) {
            // Coordinates leave the parameter to placeOn.
            if (placeable(object) && isPlace(value)) return;
            check(
                typeof object.alpha === "number"
                    ? isReal(value)
                    : isReals(value, object.alpha.length),
            );
            // A macro's final: after its application and rank.
            changed = object.output
                ? [...(parameters as unknown[]).slice(0, 2), value]
                : [(parameters as unknown[])[0], value];
        } else if (
            object instanceof point_object ||
            object instanceof free_vector_object
        ) {
            check(isReals(value, 2, 3));
            changed = value;
        } else {
            check(isReal(value));
            changed = { ...(parameters as object), v: value };
        }
        entries[index] = [tag, name, changed, ...style];
    });
    return { ...figure, o: entries };
}

// Moves the points on objects that `state`, already checked by stateFigure,
// gives coordinates to the nearest place on their object, in construction
// order, as a drag would: `c` is the figure built from stateFigure's result.
export function placeOn(c: construction, state: FigureState): void {
    figureObjects(c).forEach((object) => {
        const value = state[object.name];
        if (
            !(object instanceof point_on_object) ||
            !placeable(object) ||
            !isPlace(value)
        )
            return;
        c.flush();
        const [x, y, z = 0] = value;
        const alpha = object.alphaFor([x, y, z]);
        if (alpha === null) return;
        object.alpha = alpha;
        c.invalidateGeometry(object);
    });
}

export function figureTargets(c: construction): Target[] {
    const movables = new Set<construction_object>(movable(c));
    return figureObjects(c)
        .filter(
            (object) =>
                object instanceof point_object ||
                object instanceof expression_object,
        )
        .map((object) => ({
            name: object.name,
            kind: object instanceof point_object ? "point" : "expression",
            hidden: object.isHidden,
            movable: movables.has(object),
        }));
}

function target(
    c: construction,
    name: string,
): point_object | expression_object {
    const object = figureObjects(c).find(
        (candidate) => candidate.name === name,
    );
    if (!(
        object instanceof point_object || object instanceof expression_object
    ))
        throw new Error(`No point or expression named ${name}`);
    return object;
}

// A point's coordinates, an expression's number (or numbers: a complex
// number, a vector), null for anything else or not finite.
export function objectValue(c: construction, name: string): Value {
    const object = target(c, name);
    if (!object.defined) return null;
    if (object instanceof point_object)
        return (c.GRID.is2D ? [object.x, object.y] : object.coords).map(json);
    const { value } = object;
    if (typeof value === "number") return json(value);
    return Array.isArray(value) &&
        value.every((item) => typeof item === "number")
        ? value.map(json)
        : null;
}

// Of the free points and the points on objects, only those named in `except`
// remain manipulable: what changes a number (sliders, checkboxes, input
// boxes, panels, points defined by formulas, radii of circles), and free
// vectors, which aren't targets, always does.
// The 2D view no longer pans with the left mouse button or a finger.
export function lockFigure(c: construction, except: string[]): void {
    except.forEach((name) => target(c, name));
    c.panLocked = true;
    const locked = new Set<construction_object>(
        movable(c).filter(
            (object) =>
                object instanceof point_object && !except.includes(object.name),
        ),
    );
    figureObjects(c).forEach((object) => {
        const lock = locked.has(object);
        if (lock === object.locked) return;
        object.locked = lock;
        if (object.hasView) object.createSVG();
    });
}

// Shows or hides `name` in the figure built from `figure`, and returns
// `figure` likewise changed.
export function hideTarget(
    c: construction,
    figure: DgoFigure,
    name: string,
    hidden: boolean,
): DgoFigure {
    const object = target(c, name);
    object.hidden = hidden ? object.hidden || 1 : 0;
    object.updateView();
    const index = figureObjects(c).indexOf(object);
    const [tag, , parameters, styleIndex] = figure.o[index];
    const styles = [...(figure.st ?? [])];
    const style = {
        ...(styleIndex === undefined ? {} : styles[styleIndex as number]),
    };
    if (hidden) style.h ||= 1;
    else delete style.h;
    const entry = [tag, name, parameters];
    if (Object.keys(style).length) {
        const json = JSON.stringify(style);
        let at = styles.findIndex((other) => JSON.stringify(other) === json);
        if (at < 0) at = styles.push(style) - 1;
        entry.push(at);
    }
    const entries = [...figure.o];
    entries[index] = entry;
    return { ...figure, st: styles, o: entries };
}
