import type { construction } from "./construction";
import {
    formulaIdentifiers,
    parseFormula,
    parseProgram,
    programReferences,
    programTargets,
    type FormulaNode,
    type ScriptValue,
} from "./import/dgp_formula";
import { createAngleBisector } from "./objects/angle_bisector_object";
import {
    angle_object,
    createAngle,
    RIGHT_ANGLE_MARKS,
    type RightAngleMark,
} from "./objects/angle_object";
import { createArc3pts } from "./objects/arc3pts_object";
import { createCenter } from "./objects/center_object";
import { createCircle1 } from "./objects/circle1_object";
import { createCircle3 } from "./objects/circle3_object";
import { createCircle3pts } from "./objects/circle3pts_object";
import { createCircle } from "./objects/circle_object";
import {
    construction_object,
    type DgoContext,
} from "./objects/construction_object";
import { createCurve, curve_object } from "./objects/curve_object";
import { createCylinderIntersection } from "./objects/cylinder_intersection_object";
import { createCylinderSection } from "./objects/cylinder_section_object";
import { createDirectionPoint } from "./objects/direction_point_object";
import {
    createExpression,
    expression_object,
    type ExpressionFormula,
    type ExpressionProgram,
    type SliderBounds,
} from "./objects/expression_object";
import {
    createExpressionList,
    expression_list_object,
} from "./objects/expression_list_object";
import {
    createFixedAngle,
    fixed_angle_object,
    type FixedAngleFormula,
} from "./objects/fixed_angle_object";
import { createFixedPoint } from "./objects/fixed_point_object";
import { createFormulaPoint } from "./objects/formula_point_object";
import { grid_object } from "./objects/grid_object";
import { createImage, image_object } from "./objects/image_object";
import { createOrderedIntersection } from "./objects/intersection_object";
import { createIteration } from "./objects/iteration_object";
import {
    createList,
    list_object,
    type ListNature,
} from "./objects/list_object";
import { createLocus, locus_object } from "./objects/locus_object";
import { createMidpoint } from "./objects/midpoint_object";
import { createParallel } from "./objects/parallel_line_object";
import { createPerpendicularBisector } from "./objects/perpendicular_bisector_object";
import { createPlaneIntersection } from "./objects/plane_intersection_object";
import { createPlumb } from "./objects/plumb_line_object";
import { createPointOn, point_on_object } from "./objects/point_on_object";
import { createPoint, point_object } from "./objects/point_object";
import { createPolygon, polygon_object } from "./objects/polygon_object";
import { primitive_circle_object } from "./objects/primitive_circle_object";
import { primitive_line_object } from "./objects/primitive_line_object";
import { primitive_quadric_object } from "./objects/primitive_quadric_object";
import {
    createQuadric5pts,
    quadric5pts_object,
} from "./objects/quadric5pts_object";
import { createRay } from "./objects/ray_line_object";
import { createReflection } from "./objects/reflection_object";
import { createSegment, segment_object } from "./objects/segment_object";
import { createSphere } from "./objects/sphere_object";
import { createSymmetry } from "./objects/symmetry_object";
import { createText } from "./objects/text_object";
import { createPanel, panelNames, parsePanel } from "./objects/panel_object";
import { createLine } from "./objects/two_points_line_object";
import { createVector } from "./objects/vector_object";
import type { Vec2, Vec3 } from "./vec";

// DocGeo's native format: see DGO.md.
const VERSION = 1;

type Json = unknown;
type Settings = Record<string, Json>;
type Class<T> = abstract new (...args: never[]) => T;
type Classes = Class<construction_object>[];
type Instance<C> = C extends Class<infer T> ? T : never;

export interface DgoFigure {
    dgo: number;
    // The view and the coordinate system.
    v: Settings;
    // Degrees rather than radians, as DGPad by default.
    deg?: number;
    // See construction.segmentsOverPolygons.
    sop?: number;
    bg?: string;
    // The objects' styles, and images, their entries refer to.
    st?: Settings[];
    img?: Record<string, string>;
    // Type, name, parameters and style of each object, in construction
    // order.
    o: Json[][];
}

// ************************** DEFAULTS ****************************
// Frozen with the format, whatever preferences.ts says: changing one would
// change every file already saved.

// Fill and stroke colors, size and opacity of each type.
type Look = [string, string, number, number?];
const POINT: Look = ["rgb(255,255,255)", "rgb(80,80,80)", 6, 0];
const DERIVED_POINT: Look = ["rgb(180,180,180)", "rgb(80,80,80)", 6, 0];
const LINE: Look = ["rgb(35,141,227)", "rgb(80,80,80)", 2];
const RAY: Look = ["rgb(35,141,227)", "#993300", 2];
const SEGMENT: Look = ["rgb(35,141,227)", "rgb(180,80,80)", 4];
const CIRCLE: Look = ["#CC66CC", "#CC66CC", 2, 0];
const POLYGON: Look = ["rgb(35,141,227)", "rgb(80,80,80)", 2, 0];
const CURVE: Look = ["#0b5b94", "#0b5b94", 2];
const LIST: Look = ["#656148", "#656148", 2];
const TEXT: Look = ["#000000", "#000000", 1];
const LOOKS: Record<string, Look> = {
    Pt: POINT,
    Fix: POINT,
    Fp: POINT,
    On: POINT,
    DirP: POINT,
    Mid: DERIVED_POINT,
    Int: DERIVED_POINT,
    CyI: DERIVED_POINT,
    PlI: DERIVED_POINT,
    Ctr: DERIVED_POINT,
    Sym: DERIVED_POINT,
    Refl: DERIVED_POINT,
    Line: LINE,
    Par: LINE,
    Perp: LINE,
    Med: LINE,
    Ray: RAY,
    Bis: RAY,
    Seg: SEGMENT,
    Vec: SEGMENT,
    FA: ["#006633", "#006633", 1, 0],
    Ang: ["#006633", "#006633", 4, 0],
    Cir: CIRCLE,
    C1: CIRCLE,
    C3: CIRCLE,
    C3p: CIRCLE,
    C3s: CIRCLE,
    Arc: CIRCLE,
    Sec: CIRCLE,
    CyS: CIRCLE,
    Quad: CIRCLE,
    Sph: POLYGON,
    Poly: POLYGON,
    Loc: CURVE,
    Cur: CURVE,
    Lst: LIST,
    ELst: LIST,
    Itr: LIST,
    Ex: ["rgb(0,0,178)", "rgb(0,0,178)", 7, 0],
    Txt: TEXT,
    Img: TEXT,
    Html: ["#000000", "#000000", 3],
};

const BACKGROUND = "#FAFAFA";
const COLOR = /^(?:#[\da-f]{3}|#[\da-f]{6}|rgb\(-?\d+,-?\d+,-?\d+\))$/i;
const IMAGE_URL =
    /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z\d+/]*=*$/;
const POINT_SHAPES = ["circle", "cross", "diamond", "rect"];
const LIST_NATURES = ["point", "segment", "line", "label"];
const FUNCTION_VARIABLES = ["x", "y", "z", "t"];

const isNumber = (value: Json): value is number =>
    typeof value === "number" && Number.isFinite(value);
const isFlag = (value: Json): boolean => value === 0 || value === 1;
const isColor = (value: Json): boolean =>
    typeof value === "string" && COLOR.test(value);
const isPair = (value: Json): value is Vec2 =>
    Array.isArray(value) && value.length === 2 && value.every(isNumber);
const isRecord = (value: Json): value is Record<string, Json> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

// ************************* SETTINGS *****************************

type Initial =
    | string
    | number
    | null
    | readonly Json[]
    | ((tag: string, settings: Settings) => Json);

// A setting of an object, the grid included, and its default.
interface Property {
    of: Class<construction_object>[];
    get(owner: construction_object): Json;
    set(owner: construction_object, value: Json): void;
    // It may depend on the object's type and on the settings before it.
    initial: Initial;
    valid(value: Json): boolean;
}

function property<T extends construction_object>(
    of: Class<T> | Class<T>[],
    get: (owner: T) => Json,
    set: (owner: T, value: Json) => void,
    initial: Initial,
    valid: (value: Json) => boolean,
): Property {
    return { of: [of].flat(), get, set, initial, valid } as Property;
}

function field<T extends construction_object>(
    of: Class<T> | Class<T>[],
    key: keyof T,
    initial: Initial,
    valid: (value: Json) => boolean,
): Property {
    return property(
        of,
        (owner) => owner[key],
        (owner, value) => (owner[key] = value as T[keyof T]),
        initial,
        valid,
    );
}

// Saved as 0 or 1.
function flag<T extends construction_object>(
    of: Class<T> | Class<T>[],
    key: keyof T,
    initial: Initial = 0,
): Property {
    return property(
        of,
        (owner) => +owner[key],
        (owner, value) => (owner[key] = (value === 1) as T[keyof T]),
        initial,
        isFlag,
    );
}

// JSON has no infinity: a range's unbounded end is null.
function range(key: "RESTRICT_THETA" | "RESTRICT_PHI", initial: Json[]) {
    return property(
        grid_object,
        (grid) => grid[key].map((end) => (Number.isFinite(end) ? end : null)),
        (grid, value) => {
            const [low, high] = value as (number | null)[];
            grid[key] = [low ?? -Infinity, high ?? Infinity];
        },
        initial,
        (value) =>
            Array.isArray(value) &&
            value.length === 2 &&
            value.every((end) => end === null || isNumber(end)),
    );
}

const object = construction_object;
const isHidden = (value: Json): boolean =>
    value === 0 || value === 1 || value === 2;

// An object's style: only what differs from its default is saved.
const STYLE: Record<string, Property> = {
    c: field(object, "stroke_color", (tag) => LOOKS[tag][1], isColor),
    // The stroke color, when it's set.
    fc: field(
        object,
        "fill_color",
        (tag, style) => style.c ?? LOOKS[tag][0],
        isColor,
    ),
    s: field(object, "size", (tag) => LOOKS[tag][2], isNumber),
    o: field(
        object,
        "opacity",
        (tag) => LOOKS[tag][3],
        (value) => value === undefined || isNumber(value),
    ),
    h: field(object, "hidden", 0, isHidden),
    sn: flag(object, "showName"),
    f: field(object, "fontSize", 16, isNumber),
    // A locus's number of samples.
    p: field(
        object,
        "precision",
        (tag) => (tag === "Loc" ? 1000 : tag === "Html" ? 4 : -1),
        isNumber,
    ),
    sp: field(point_object, "shape", "circle", (value) =>
        POINT_SHAPES.includes(value as string),
    ),
    np: field(point_object, "namePosition", 0, isNumber),
    tk: flag(point_object, "trace"),
    i: field(point_object, "increment", [0, 0], isPair),
    // Pinned at the window position its coordinates give.
    fl: property(
        point_object,
        (point) => +(point.pinned !== null),
        (point, value) => value === 1 && point.pin(),
        0,
        isFlag,
    ),
    sb: flag(point_on_object, "onBoundary"),
    an: property<point_on_object | expression_object>(
        [point_on_object, expression_object],
        ({ animation }) =>
            animation && [animation.speed, animation.direction, +animation.ar],
        (owner, value) => {
            if (!value) return;
            const [speed, direction, ar] = value as number[];
            owner.C.animations.add(owner, { speed, direction, ar: ar === 1 });
        },
        null,
        (value) =>
            value === null ||
            (Array.isArray(value) &&
                value.length === 3 &&
                isNumber(value[0]) &&
                value[0] >= 0 &&
                (value[1] === 1 || value[1] === -1) &&
                isFlag(value[2])),
    ),
    pl: flag(polygon_object, "plane"),
    su: flag(polygon_object, "section"),
    ar: field<angle_object | fixed_angle_object>(
        [angle_object, fixed_angle_object],
        "arcRadius",
        30,
        isNumber,
    ),
    ra: field(angle_object, "rightAngleMark", "dgpad", (value) =>
        RIGHT_ANGLE_MARKS.includes(value as RightAngleMark),
    ),
    dc: field(segment_object, "decoration", 0, (value) =>
        [0, 1, 2, 3, 4, 5, 6].includes(value as number),
    ),
    dh: flag(primitive_line_object, "dash"),
    is: field(expression_object, "increment", 0, isNumber),
    cL: field(expression_object, "cursorLength", 200, isNumber),
    cV: flag(expression_object, "vertical"),
    cB: flag(expression_object, "checkbox"),
    iB: field(expression_object, "inputLength", 0, isNumber),
    tx: flag(expression_object, "latex"),
    cc: field(expression_object, "cursorColor", "#780013", isColor),
    cr: field(expression_object, "cursorRadius", 10, isNumber),
    co: field(expression_object, "cursorOpacity", 0, isNumber),
    sg: field(expression_list_object, "segmentsSize", -1, isNumber),
};

// The view and the coordinate system, besides the origin and the unit.
const VIEW: Record<string, Property> = {
    "3d": property(
        grid_object,
        (grid) => +!grid.is2D,
        (grid, value) => (grid.is2D = value === 0),
        0,
        isFlag,
    ),
    th: field(grid_object, "THETA", Math.PI / 2, isNumber),
    ph: field(grid_object, "PHI", (5 * Math.PI) / 2, isNumber),
    rt: range("RESTRICT_THETA", [-Math.PI / 2, Math.PI / 2]),
    rp: range("RESTRICT_PHI", [null, null]),
    pe: flag(grid_object, "PERSPECTIVE"),
    // A plane figure has none.
    fl: flag(grid_object, "SHOWFLOOR", (_, view) => view["3d"] ?? 0),
    ax: property(
        grid_object,
        (grid) => +(grid.hidden === 0),
        (grid, value) => (grid.hidden = value === 1 ? 0 : 1),
        1,
        isFlag,
    ),
    gr: flag(grid_object, "showGrid", 1),
    ox: flag(grid_object, "showOx", 1),
    oy: flag(grid_object, "showOy", 1),
    lx: flag(grid_object, "lockOx"),
    ly: flag(grid_object, "lockOy"),
    cz: flag(grid_object, "centerZoom"),
    op: flag(grid_object, "onlyPositive"),
    c: field(grid_object, "stroke_color", "rgb(80,80,80)", isColor),
    f: field(grid_object, "fontSize", 18, isNumber),
    s: field(grid_object, "size", 2, isNumber),
    gw: field(grid_object, "gridWidth", 0.1, isNumber),
};

function initial(property: Property, tag: string, settings: Settings): Json {
    return typeof property.initial === "function"
        ? property.initial(tag, settings)
        : property.initial;
}

function properties(
    table: Record<string, Property>,
    owner: construction_object,
): [string, Property][] {
    return Object.entries(table).filter(([, property]) =>
        property.of.some((type) => owner instanceof type),
    );
}

function describe(
    table: Record<string, Property>,
    owner: construction_object,
    tag = "",
): Settings {
    const settings: Settings = {};
    properties(table, owner).forEach(([key, property]) => {
        const value = property.get(owner);
        if (
            JSON.stringify(value) !==
            JSON.stringify(initial(property, tag, settings))
        )
            settings[key] = value;
    });
    return settings;
}

function apply(
    table: Record<string, Property>,
    owner: construction_object,
    settings: Settings,
    tag = "",
): void {
    properties(table, owner).forEach(([key, property]) => {
        const value = own(settings, key)
            ? settings[key]
            : initial(property, tag, settings);
        check(property.valid(value));
        property.set(owner, value);
    });
}

const own = (record: object, key: string): boolean =>
    Object.prototype.hasOwnProperty.call(record, key);

// ************************** WRITING *****************************

// A region of the window, in pixels.
export interface Region {
    x: number;
    y: number;
    w: number;
    h: number;
}

// The figure's own objects, without the grid's.
export function figureObjects(c: construction): construction_object[] {
    const grid = c.GRID;
    const internal = new Set<construction_object>([
        grid,
        grid.floorOccluder,
        ...grid.floorOccluder.points,
    ]);
    return c.OBJS.V.filter((object) => !internal.has(object));
}

export async function writeDgo(
    c: construction,
    region?: Region,
): Promise<Blob> {
    const json = JSON.stringify(await describeDgo(c, region));
    return new Response(
        new Blob([json]).stream().pipeThrough(new CompressionStream("gzip")),
    ).blob();
}

// Saved as the given region of the window shows it.
export async function describeDgo(
    c: construction,
    { x, y, w, h }: Region = { x: 0, y: 0, w: c.width, h: c.height },
): Promise<DgoFigure> {
    const grid = c.GRID;
    const objects = figureObjects(c);
    const indices = new Map(objects.map((object, index) => [object, index]));
    const images: Record<string, string> = {};
    const keys = new Map<string, string>();
    for (const object of objects)
        if (object instanceof image_object && !keys.has(object.url)) {
            const key = await imageKey(object.url);
            keys.set(object.url, key);
            images[key] = object.url;
        }
    const context: DgoContext = {
        index: (object) => indices.get(object)!,
        image: (url) => keys.get(url)!,
        screen: ([sx, sy]) => [Math.round(sx - x), Math.round(sy - y)],
    };
    const styles: Settings[] = [];
    const styleIndices = new Map<string, number>();
    const figure: DgoFigure = {
        dgo: VERSION,
        v: {
            o: [grid.ORG[0] - x, grid.ORG[1] - y],
            u: grid.UNIT[0],
            w,
            h,
            ...describe(VIEW, grid),
        },
        ...(!c.degrees && { deg: 0 }),
        ...(c.segmentsOverPolygons && { sop: 1 }),
        ...(c.prefs.background.color !== BACKGROUND && {
            bg: c.prefs.background.color,
        }),
        o: objects.map((object) => {
            const [tag, parameters] = object.dgo(context);
            const style = describe(STYLE, object, tag);
            if (object.condition) style.sc = context.index(object.condition);
            if (object instanceof point_object && object.magnets.length)
                style.mg = object.magnets.map(({ target, radius }) => [
                    context.index(target),
                    radius,
                ]);
            const entry = [tag, object.name, parameters];
            if (Object.keys(style).length === 0) return entry;
            const json = JSON.stringify(style);
            if (!styleIndices.has(json)) {
                styleIndices.set(json, styles.length);
                styles.push(style);
            }
            return [...entry, styleIndices.get(json)];
        }),
    };
    if (styles.length) figure.st = styles;
    if (keys.size) figure.img = images;
    return figure;
}

// Content-addressed, so that the same image is stored once.
async function imageKey(url: string): Promise<string> {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(url),
    );
    return [...new Uint8Array(digest).slice(0, 8)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

// ************************** READING *****************************

export async function importDgoFromUrl(
    c: construction,
    url: string,
): Promise<string[]> {
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`Unable to load DGO file: ${response.status}`);
    return importDgoFromBlob(c, await response.blob());
}

// A plain JSON file is read too, for readable test figures. Nothing is
// ever unsupported. `centered`: see readDgo.
export async function importDgoFromBlob(
    c: construction,
    file: Blob,
    centered = false,
): Promise<string[]> {
    const [first, second] = new Uint8Array(
        await file.slice(0, 2).arrayBuffer(),
    );
    const stream =
        first === 0x1f && second === 0x8b
            ? file.stream().pipeThrough(new DecompressionStream("gzip"))
            : file.stream();
    readDgo(c, JSON.parse(await new Response(stream).text()), centered);
    return [];
}

// The file comes from anywhere: whatever it holds, it is only data, and
// anything malformed rejects it.
function check(condition: unknown): asserts condition {
    if (!condition) throw new Error("Invalid DGO file");
}

function list(value: Json, min: number, max = min): Json[] {
    check(Array.isArray(value) && value.length >= min && value.length <= max);
    return value;
}

// The names a formula uses must all stand for an object, or be among
// `free` (a function's variables, a List's index…).
function checkNames(
    names: Set<string>,
    refs: ReadonlyMap<string, unknown>,
    free: string[] = [],
): void {
    names.forEach((name) => check(refs.has(name) || free.includes(name)));
}

// `centered`: the saved window's region is centered in this one, to the
// pixel, as the frame that would show it (see frame.ts).
export function readDgo(c: construction, figure: Json, centered = false): void {
    check(isRecord(figure));
    if (figure.dgo !== VERSION)
        throw new Error(`Unsupported DGO version: ${figure.dgo}`);
    const {
        v: view,
        deg = 1,
        sop = 0,
        bg = BACKGROUND,
        st: styles = [],
        img: images = {},
        o: entries,
    } = figure;
    check(isRecord(view) && isFlag(deg) && isFlag(sop) && isColor(bg));
    check(Array.isArray(styles) && styles.every(isRecord));
    check(isRecord(images) && Array.isArray(entries));
    c.degrees = deg === 1;
    c.segmentsOverPolygons = sop === 1;
    c.prefs.background.color = bg as string;
    c.svg.stl("background", bg as string);

    const { o: origin, u: unit, w: width, h: height } = view;
    check(isPair(origin) && isNumber(unit) && unit > 0);
    check(isNumber(width) && isNumber(height));
    const grid = c.GRID;
    apply(VIEW, grid, view);
    grid.UNIT = [unit, unit, unit];
    // Otherwise, a plane figure keeps its origin where it was in the
    // window, as in DGPad; a 3D one, where it was from the window's center.
    const offset: Vec2 = centered
        ? [
              Math.round((c.width - width) / 2),
              Math.round((c.height - height) / 2),
          ]
        : [0, 0];
    grid.ORG = centered
        ? [origin[0] + offset[0], origin[1] + offset[1]]
        : grid.is2D
          ? origin
          : [
                origin[0] + (c.width - width) / 2,
                origin[1] + (c.height - height) / 2,
            ];
    const vec3 = !grid.is2D;

    const objects: construction_object[] = [];
    const styled: [construction_object, Settings][] = [];
    // An earlier object, of one of the given classes.
    const at = <C extends Classes>(
        value: Json,
        ...classes: C
    ): Instance<C[number]> => {
        check(
            Number.isInteger(value) &&
                (value as number) >= 0 &&
                (value as number) < objects.length,
        );
        const object = objects[value as number];
        check(classes.some((type) => object instanceof type));
        return object as Instance<C[number]>;
    };
    const points = (values: Json, count: number): point_object[] =>
        list(values, count).map((value) => at(value, point_object));
    // A formula's text, and the objects of the given classes its names
    // stand for.
    const formula = <C extends Classes>(
        value: Json,
        ...classes: C
    ): { source: string; refs: Map<string, Instance<C[number]>> } => {
        const [source, names = {}] =
            typeof value === "string" ? [value] : list(value, 2);
        check(typeof source === "string" && isRecord(names));
        return {
            source,
            refs: new Map(
                Object.entries(names).map(([name, index]) => [
                    name,
                    at(index, ...classes),
                ]),
            ),
        };
    };

    c.beginBatch();
    entries.forEach((entry) => {
        const [tag, name, parameters, styleIndex] = list(entry, 3, 4);
        check(typeof tag === "string" && own(BUILDERS, tag));
        check(typeof name === "string" && name !== "" && !c.getObj(name));
        const object = BUILDERS[tag](parameters, {
            c,
            name,
            at,
            points,
            formula,
            vec3,
            images,
            offset,
        });
        let style: Settings = {};
        if (styleIndex !== undefined) {
            const chosen = styles[styleIndex as number];
            check(Number.isInteger(styleIndex) && isRecord(chosen));
            style = chosen;
        }
        apply(STYLE, object, style, tag);
        styled.push([object, style]);
        objects.push(object);
    });
    // Conditions and magnets may name later objects.
    styled.forEach(([object, { sc: condition, mg: magnets }]) => {
        if (condition !== undefined) {
            object.condition = at(condition, expression_object);
            object.addParents(object.condition);
        }
        if (magnets !== undefined) {
            check(object instanceof point_object && Array.isArray(magnets));
            object.magnets = magnets.map((magnet) => {
                const [target, radius] = list(magnet, 2);
                check(isNumber(radius));
                return {
                    target: at(
                        target,
                        primitive_line_object,
                        primitive_circle_object,
                        primitive_quadric_object,
                        list_object,
                        curve_object,
                        point_object,
                    ),
                    radius,
                };
            });
        }
    });
    grid.createSVG();
    c.endBatch();
    c.invalidateProjection();
}

interface Reader {
    c: construction;
    name: string;
    at<C extends Classes>(value: Json, ...classes: C): Instance<C[number]>;
    points(values: Json, count: number): point_object[];
    formula<C extends Classes>(
        value: Json,
        ...classes: C
    ): { source: string; refs: Map<string, Instance<C[number]>> };
    vec3: boolean;
    images: Record<string, Json>;
    // Added to the window positions read.
    offset: Vec2;
}

type Builder = (parameters: Json, reader: Reader) => construction_object;

// JSON has no NaN: a number that isn't finite, where it can be, is null.
function real(value: Json): number {
    check(value === null || typeof value === "number");
    return value ?? NaN;
}

function coordinates(value: Json): Vec3 {
    const [x, y, z = 0] = list(value, 2, 3).map(real);
    return [x, y, z];
}

function scriptValue(value: Json): ScriptValue {
    if (typeof value === "string") return value;
    return Array.isArray(value) ? value.map(scriptValue) : real(value);
}

// Two points, by which the object is built.
function twoPoints(
    create: (
        c: construction,
        name: string,
        p: point_object,
        q: point_object,
    ) => construction_object,
): Builder {
    return (parameters, { c, name, points }) => {
        const [p, q] = points(parameters, 2);
        return create(c, name, p, q);
    };
}

function threePoints(
    create: (
        c: construction,
        name: string,
        p: point_object,
        q: point_object,
        r: point_object,
    ) => construction_object,
): Builder {
    return (parameters, { c, name, points }) => {
        const [p, q, r] = points(parameters, 3);
        return create(c, name, p, q, r);
    };
}

// A line, then a point.
function linePoint(
    create: (
        c: construction,
        name: string,
        line: primitive_line_object,
        p: point_object,
    ) => construction_object,
): Builder {
    return (parameters, { c, name, at }) => {
        const [line, p] = list(parameters, 2);
        return create(
            c,
            name,
            at(line, primitive_line_object),
            at(p, point_object),
        );
    };
}

const INTERSECTABLE = [
    primitive_line_object,
    primitive_circle_object,
    primitive_quadric_object,
    curve_object,
];

// A List's or a text's formula, "k" and "count" being a List's own.
function listFormula(
    reader: Reader,
    value: Json,
    refs: Map<string, construction_object>,
): FormulaNode {
    const { source, refs: own } = reader.formula(value, construction_object);
    const node = parseFormula(source);
    checkNames(formulaIdentifiers(node), own, ["k", "count"]);
    own.forEach((ref, name) => refs.set(name, ref));
    return node;
}

const BUILDERS: Record<string, Builder> = {
    Pt: (parameters, { c, name }) =>
        createPoint(c, name, coordinates(parameters)),
    Fix: (parameters, { c, name }) =>
        createFixedPoint(c, name, coordinates(parameters)),
    Fp: (parameters, { c, name, at, formula, vec3 }) => {
        const [value, ...handles] = list(parameters, 1, 3);
        const { source, refs } = formula(value, construction_object);
        const node = parseFormula(source);
        checkNames(formulaIdentifiers(node), refs);
        const point = createFormulaPoint(c, name, node, refs, vec3);
        if (handles.length) {
            check(handles.length === 2);
            point.setHandles(
                handles.map(
                    (handle) => handle && at(handle, expression_object),
                ) as [expression_object | null, expression_object | null],
            );
        }
        return point;
    },
    On: (parameters, { c, name, at }) => {
        const [supportIndex, alpha] = list(parameters, 2);
        const support = at(
            supportIndex,
            primitive_line_object,
            primitive_circle_object,
            polygon_object,
            quadric5pts_object,
            locus_object,
            list_object,
            curve_object,
        );
        if (
            !(support instanceof polygon_object) &&
            !(support instanceof quadric5pts_object)
        )
            return createPointOn(c, name, support, real(alpha));
        const [a, b] = list(alpha, 2).map(real);
        return createPointOn(c, name, support, [a, b]);
    },
    Mid: twoPoints(createMidpoint),
    Sym: twoPoints(createSymmetry),
    Refl: linePoint(createReflection),
    Ctr: (parameters, { c, name, at }) => {
        const [circle] = list(parameters, 1);
        return createCenter(c, name, at(circle, primitive_circle_object));
    },
    DirP: linePoint(createDirectionPoint),
    PlI: (parameters, { c, name, at, points }) => {
        const [line, ...plane] = list(parameters, 4);
        return createPlaneIntersection(
            c,
            name,
            at(line, primitive_line_object),
            points(plane, 3) as [point_object, point_object, point_object],
        );
    },
    Int: (parameters, { c, name, at }) => {
        const [o1, o2, order, away] = list(parameters, 3, 4);
        check(order === 0 || order === 1 || order === 2 || order === 3);
        return createOrderedIntersection(
            c,
            name,
            at(o1, ...INTERSECTABLE),
            at(o2, ...INTERSECTABLE),
            order,
            away === undefined ? undefined : at(away, point_object),
        );
    },
    CyI: (parameters, { c, name, at }) => {
        const [line, a, b, r, order] = list(parameters, 5);
        check(order === 0 || order === 1);
        return createCylinderIntersection(
            c,
            name,
            at(line, primitive_line_object),
            at(a, point_object),
            b === null ? null : at(b, point_object),
            at(r, point_object),
            order,
        );
    },
    Line: twoPoints(createLine),
    Ray: twoPoints(createRay),
    Seg: twoPoints(createSegment),
    Vec: twoPoints(createVector),
    Par: (parameters, reader) =>
        linePoint((c, name, line, p) => createParallel(c, name, p, line))(
            parameters,
            reader,
        ),
    Perp: (parameters, reader) =>
        linePoint((c, name, line, p) => createPlumb(c, name, p, line))(
            parameters,
            reader,
        ),
    Med: twoPoints(createPerpendicularBisector),
    Bis: threePoints((c, name, a, vertex, b) =>
        createAngleBisector(c, name, vertex, a, b),
    ),
    FA: (parameters, { c, name, at, formula }) => {
        const [a, vertex, degrees, trigo] = list(parameters, 4);
        check(isFlag(trigo));
        let angle: number | FixedAngleFormula = degrees as number;
        if (!isNumber(degrees)) {
            const { source, refs } = formula(degrees, construction_object);
            const node = parseFormula(source);
            checkNames(formulaIdentifiers(node), refs);
            angle = { formula: node, refs };
        }
        return createFixedAngle(
            c,
            name,
            at(a, point_object),
            at(vertex, point_object),
            angle,
            trigo === 1,
        );
    },
    Cir: twoPoints(createCircle),
    C1: (parameters, { c, name, at, formula }) => {
        const [center, radius, axis] = list(parameters, 2, 3);
        const line =
            axis === undefined ? undefined : at(axis, primitive_line_object);
        if (radius === null || isNumber(radius))
            return createCircle1(
                c,
                name,
                at(center, point_object),
                real(radius),
                line,
            );
        const { source, refs } = formula(radius, construction_object);
        const node = parseFormula(source);
        checkNames(formulaIdentifiers(node), refs);
        return createCircle1(
            c,
            name,
            at(center, point_object),
            { formula: node, refs },
            line,
        );
    },
    C3: threePoints(createCircle3),
    C3p: threePoints(createCircle3pts),
    C3s: threePoints((c, name, p, q, r) =>
        createCircle3pts(c, name, p, q, r, true),
    ),
    Arc: threePoints(createArc3pts),
    Sec: threePoints((c, name, p, q, r) =>
        createArc3pts(c, name, p, q, r, true),
    ),
    Quad: (parameters, { c, name, points }) => {
        const [p1, p2, p3, p4, p5] = points(parameters, 5);
        return createQuadric5pts(c, name, p1, p2, p3, p4, p5);
    },
    Sph: twoPoints(createSphere),
    CyS: (parameters, { c, name, points }) => {
        const [a, b, r, ...plane] = points(parameters, 6);
        return createCylinderSection(
            c,
            name,
            a,
            b,
            r,
            plane as [point_object, point_object, point_object],
        );
    },
    Poly: (parameters, { c, name, points }) => {
        check(Array.isArray(parameters));
        return createPolygon(c, name, points(parameters, parameters.length));
    },
    Loc: (parameters, { c, name, at }) => {
        const [target, driver] = list(parameters, 2);
        return createLocus(
            c,
            name,
            at(target, point_object),
            at(driver, point_on_object),
        );
    },
    Ang: threePoints(createAngle),
    Ex: (parameters, { c, name, at, formula: read, vec3, offset }) => {
        check(isRecord(parameters));
        const { t: text, v: value, f, s, mn = null, mx = null } = parameters;
        check(typeof text === "string");
        check([value, f, s].filter((item) => item !== undefined).length === 1);
        // Bounds that read other objects are formulas.
        const numeric = (bound: Json) => bound === null || isNumber(bound);
        let bounds: SliderBounds | null = null;
        if (!numeric(mn) || !numeric(mx)) {
            check(mn !== null && mx !== null);
            const refs = new Map<string, construction_object>();
            const [min, max] = [mn, mx].map((bound) => {
                if (isNumber(bound)) return parseFormula(String(bound));
                const { source, refs: own } = read(bound, construction_object);
                const node = parseFormula(source);
                checkNames(formulaIdentifiers(node), own);
                own.forEach((ref, refName) => refs.set(refName, ref));
                return node;
            });
            bounds = { min, max, refs };
        }
        let formula: ExpressionFormula | null = null;
        let program: ExpressionProgram | null = null;
        if (f !== undefined) {
            const { source, refs } = read(f, construction_object);
            const [statement] = parseProgram(source).body;
            check(statement.kind === "expression");
            const names = formulaIdentifiers(statement.node);
            const variables = FUNCTION_VARIABLES.filter(
                (name) => names.has(name) && !refs.has(name),
            );
            checkNames(names, refs, variables);
            formula = { node: statement.node, source, variables, refs, vec3 };
        } else if (s !== undefined) {
            const { source, refs } = read(s, construction_object);
            const parsed = parseProgram(source);
            const references = programReferences(parsed);
            const targets = programTargets(parsed);
            checkNames(references, refs);
            checkNames(targets, refs);
            program = {
                program: parsed,
                refs: new Map(
                    [...references].map((name) => [name, refs.get(name)!]),
                ),
                targets: new Map(
                    [...targets].map((name) => [name, refs.get(name)!]),
                ),
                vec3,
            };
        }
        const anchored = parameters.on !== undefined;
        const screen = anchored ? parameters.d : parameters.xy;
        check(isPair(screen));
        const expression = createExpression(
            c,
            name,
            text,
            value === undefined ? null : scriptValue(value),
            bounds ? null : (mn as number | null),
            bounds ? null : (mx as number | null),
            anchored ? [0, 0] : [screen[0] + offset[0], screen[1] + offset[1]],
            formula,
            program,
            bounds,
        );
        if (anchored) {
            expression.anchor = at(parameters.on, point_object);
            expression.alpha = screen;
            expression.addParents(expression.anchor);
        }
        return expression;
    },
    Cur: (parameters, { c, name, formula, vec3 }) => {
        const [value, min, max] = list(parameters, 3);
        check(
            (min === null || isNumber(min)) && (max === null || isNumber(max)),
        );
        const { source, refs } = formula(value, construction_object);
        const node = parseFormula(source);
        checkNames(formulaIdentifiers(node), refs, ["x"]);
        return createCurve(
            c,
            name,
            { node, source, variables: ["x"], refs, vec3 },
            min,
            max,
        );
    },
    Lst: (parameters, reader) => {
        check(Array.isArray(parameters));
        const [nature, count, ...formulas] = list(
            parameters,
            3,
            parameters[0] === "point" ? 3 : 4,
        );
        check(LIST_NATURES.includes(nature as string));
        check(formulas.length === (nature === "point" ? 1 : 2));
        const refs = new Map<string, construction_object>();
        return createList(
            reader.c,
            reader.name,
            nature as ListNature,
            listFormula(reader, count, refs),
            formulas.map((formula) => listFormula(reader, formula, refs)),
            refs,
        );
    },
    ELst: (parameters, { c, name, at }) => {
        const [source] = list(parameters, 1);
        return createExpressionList(c, name, at(source, expression_object));
    },
    Itr: (parameters, reader) => {
        const [ends, levels, maps] = list(parameters, 3);
        check(Array.isArray(ends) && ends.length % 2 === 0);
        const points = reader.points(ends, ends.length);
        const refs = new Map<string, construction_object>();
        const node = listFormula(reader, levels, refs);
        check(Array.isArray(maps));
        return createIteration(
            reader.c,
            reader.name,
            points.flatMap((end, index) =>
                index % 2 === 0 ? [[end, points[index + 1]]] : [],
            ) as [point_object, point_object][],
            node,
            refs,
            maps.map((map) => {
                const [ax, ay, bx, by] = list(map, 4);
                check([ax, ay, bx, by].every(isNumber));
                return [
                    [ax, ay],
                    [bx, by],
                ] as [Vec2, Vec2];
            }),
        );
    },
    Html: (parameters, { c, name, formula, offset }) => {
        const [box, radius, content] = list(parameters, 3);
        check(Array.isArray(box) && box.length === 4 && box.every(isNumber));
        check(isNumber(radius));
        const { source, refs } = formula(content, construction_object);
        const nodes = parsePanel(source);
        checkNames(panelNames(nodes), refs);
        const [x, y, width, height] = box as number[];
        return createPanel(
            c,
            name,
            [x + offset[0], y + offset[1], width, height],
            radius,
            source,
            refs,
        );
    },
    Txt: (parameters, { c, name, at, formula }) => {
        const [anchor, offset, content] = list(parameters, 3);
        check(isPair(offset));
        const { source, refs } = formula(content, construction_object);
        const parts = source.split("%");
        check(parts.length % 2 === 1);
        return createText(
            c,
            name,
            at(anchor, point_object),
            offset,
            parts.map((part, index) => {
                if (index % 2 === 0) return part;
                if (part === "") return "%";
                const node = parseFormula(part);
                checkNames(formulaIdentifiers(node), refs);
                return node;
            }),
            refs,
        );
    },
    Img: (parameters, { c, name, points, images }) => {
        check(Array.isArray(parameters));
        const [key, width, height, ...corners] = list(parameters, 5, 6);
        const url =
            typeof key === "string" && own(images, key) ? images[key] : null;
        check(typeof url === "string" && IMAGE_URL.test(url));
        check(isNumber(width) && width > 0 && isNumber(height) && height > 0);
        return createImage(
            c,
            name,
            url,
            width,
            height,
            points(corners, corners.length),
        );
    },
};
