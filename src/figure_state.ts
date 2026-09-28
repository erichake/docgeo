import type { construction } from "./construction";
import { circle1_object } from "./objects/circle1_object";
import { figureObjects, type DgoFigure } from "./dgo";
import type { construction_object } from "./objects/construction_object";
import { expression_object } from "./objects/expression_object";
import { formula_point_object } from "./objects/formula_point_object";
import type { grid_object } from "./objects/grid_object";
import { intersection_object } from "./objects/intersection_object";
import { panel_object } from "./objects/panel_object";
import { point_on_object } from "./objects/point_on_object";
import { point_object } from "./objects/point_object";

// See DGO.md, « État élève ».
type Value = number | null | (number | null)[];
export type FigureState = Record<string, Value>;

export interface Target {
    name: string;
    kind: "point" | "expression";
    hidden: boolean;
    movable: boolean;
}

type Stated = point_object | expression_object | circle1_object;

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
// and points defined by formulas change) and the radii of circles that
// aren't formulas. Besides, the branch of an intersection whose solutions
// are followed as the figure moves (see intersection_object.groupAssign):
// the same objects' values reached otherwise could lead to another one.
function stated(c: construction): Stated[] {
    return figureObjects(c).filter(
        (object): object is Stated =>
            object.constructor === point_object ||
            object instanceof point_on_object ||
            (object instanceof expression_object &&
                !object.formula &&
                !object.program &&
                typeof object.value === "number") ||
            (object instanceof intersection_object &&
                !object.away &&
                object.branch !== null) ||
            (object instanceof circle1_object &&
                typeof object.radius === "number"),
    );
}

// What a manipulation changes directly.
const movable = (c: construction): Stated[] =>
    stated(c).filter((object) => !(object instanceof intersection_object));

function stateValue(object: Stated, vec3: boolean, view: BuiltView): Value {
    if (object instanceof intersection_object) return object.branch;
    if (object instanceof circle1_object) return json(object.radius as number);
    if (object instanceof point_on_object)
        return typeof object.alpha === "number"
            ? json(object.alpha)
            : object.alpha.map(json);
    if (object instanceof point_object) {
        const coords = object.pinned ? object.pinnedIn(view) : object.coords;
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
        if (object instanceof intersection_object) {
            check(Number.isInteger(value) && value >= 0 && value <= 3);
            changed = [...(parameters as unknown[]).slice(0, 2), value];
        } else if (object instanceof circle1_object) {
            check(isReal(value));
            const [center, , ...axis] = parameters as unknown[];
            changed = [center, value, ...axis];
        } else if (object instanceof point_on_object) {
            check(
                typeof object.alpha === "number"
                    ? isReal(value)
                    : isReals(value, 2),
            );
            changed = [(parameters as unknown[])[0], value];
        } else if (object instanceof point_object) {
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

// Of the movable objects, only those named in `except` remain manipulable
// (never a circle, which isn't a target), along with the points defined by
// formulas and the input boxes that change nothing else.
export function lockFigure(c: construction, except: string[]): void {
    except.forEach((name) => target(c, name));
    const locked = new Set<construction_object>(
        movable(c).filter((object) => !except.includes(object.name)),
    );
    figureObjects(c).forEach((object) => {
        // Its fields follow their targets' locks.
        if (object instanceof panel_object) return c.invalidateRender(object);
        const lock =
            locked.has(object) ||
            (object instanceof formula_point_object &&
                object.handles.some(
                    (handle) => handle !== null && locked.has(handle),
                )) ||
            (object instanceof expression_object &&
                object.inputLength > 0 &&
                locked.has(object.program!.refs.values().next().value!));
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
