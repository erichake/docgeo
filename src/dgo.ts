import {
    BACKGROUND_FITS,
    bandBackground,
    type BackgroundFit,
} from "./background";
import type { construction, FigureView } from "./construction";
import {
    formulaIdentifiers,
    parseFormula,
    parseProgram,
    programReferences,
    programTargets,
    type FormulaNode,
    type Program,
    withObjects,
    type ScriptValue,
} from "./import/dgp_formula";
import { FUNCTION_VARIABLES } from "./import/dgp_expression";
import { createAngleBisector } from "./objects/angle_bisector_object";
import {
    angle_object,
    createAngle,
    RIGHT_ANGLE_MARKS,
    type RightAngleMark,
} from "./objects/angle_object";
import { createArc3pts } from "./objects/arc3pts_object";
import { createCenterArc } from "./objects/center_arc_object";
import { createConicArc } from "./objects/conic_arc_object";
import { createSemicircle } from "./objects/semicircle_object";
import { createTangent } from "./objects/tangent_object";
import { createInversion } from "./objects/inversion_object";
import { createRegularPolygon } from "./objects/regular_polygon_object";
import { createTriangleCenter } from "./objects/triangle_center_object";
import { createVertex } from "./objects/vertex_object";
import { createCenter } from "./objects/center_object";
import { createCircle1, type circle1_radius } from "./objects/circle1_object";
import { createCircle3 } from "./objects/circle3_object";
import { createCircle3pts } from "./objects/circle3pts_object";
import { createCircle } from "./objects/circle_object";
import {
    construction_object,
    embed,
    isDash,
    objectEntry,
    objectIndex,
    type DgoContext,
} from "./objects/construction_object";
import { partOf } from "./objects/polygon_part";
import { createCurve, curve_object } from "./objects/curve_object";
import { createRegion } from "./objects/region_object";
import { createCylinderIntersection } from "./objects/cylinder_intersection_object";
import { createCylinderSection } from "./objects/cylinder_section_object";
import { createDirectionPoint } from "./objects/direction_point_object";
import {
    CONIC_POINTS,
    createConicPoint,
    type ConicPoint,
} from "./objects/conic_point_object";
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
import { createListPolygon } from "./objects/list_polygon_object";
import {
    createPointList,
    embeddedList,
    type ListTree,
} from "./objects/point_list_object";
import {
    createFormulaPoint,
    embeddedPoint,
} from "./objects/formula_point_object";
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
import {
    createSequence,
    SEQUENCE_VARIABLE,
    sequenceShape,
} from "./objects/sequence_object";
import { createMidpoint } from "./objects/midpoint_object";
import { createParallel } from "./objects/parallel_line_object";
import { createPerpendicularBisector } from "./objects/perpendicular_bisector_object";
import { createPlaneIntersection } from "./objects/plane_intersection_object";
import { createPlumb } from "./objects/plumb_line_object";
import {
    createPointOn,
    point_on_object,
    type point_support_object,
} from "./objects/point_on_object";
import { createPoint, point_object } from "./objects/point_object";
import { createPolygon, polygon_object } from "./objects/polygon_object";
import { primitive_circle_object } from "./objects/primitive_circle_object";
import { primitive_line_object } from "./objects/primitive_line_object";
import { primitive_quadric_object } from "./objects/primitive_quadric_object";
import { createQuadric5pts } from "./objects/quadric5pts_object";
import { createFocalConic } from "./objects/focal_conic_object";
import { createParabola } from "./objects/parabola_object";
import { createEquationCircle } from "./objects/equation_circle_object";
import {
    createEquationConic,
    type Equation,
} from "./objects/equation_conic_object";
import { createEquationLine } from "./objects/equation_line_object";
import { dilation_object } from "./objects/dilation_object";
import { rotation_object } from "./objects/rotation_object";
import {
    translation_object,
    type translation_vector,
} from "./objects/translation_object";
import {
    createTransformed,
    imageLooks,
    type transformable,
} from "./objects/transformed_object";
import { createRay } from "./objects/ray_line_object";
import { reflection_object } from "./objects/reflection_object";
import { createSegment, segment_object } from "./objects/segment_object";
import { createSphere, sphere_object } from "./objects/sphere_object";
import { createPlane, plane_object } from "./objects/plane_object";
import { createPlaneLine } from "./objects/plane_line_object";
import { createNormalLine } from "./objects/normal_line_object";
import { createSphereSection } from "./objects/sphere_section_object";
import { createPlaneSection } from "./objects/plane_section_object";
import { createCubeVertex } from "./objects/cube_vertex_object";
import { createAbove } from "./objects/above_object";
import {
    createRevolution,
    revolution_object,
} from "./objects/revolution_object";
import { createDisk } from "./objects/disk_object";
import { createAxisCircle } from "./objects/axis_circle_object";
import {
    createPolyhedron,
    polyhedron_object,
} from "./objects/polyhedron_object";
import { createNetVertex, type net_turn } from "./objects/net_vertex_object";
import { createNet } from "./objects/net_object";
import { symmetry_object } from "./objects/symmetry_object";
import { createText, text_object } from "./objects/text_object";
import { createPanel, panelNames, parsePanel } from "./objects/panel_object";
import { createEvent, runInits } from "./objects/event_object";
import { button_object, createButton } from "./objects/button_object";
import { createLine } from "./objects/two_points_line_object";
import {
    applied_point,
    initialSlots,
    MACRO_TYPES,
    macro_object,
    SUB_OBJECTS,
    type Macro,
    type MacroMethod,
} from "./objects/macro_object";
import { createVector, vector_object } from "./objects/vector_object";
import { createFreeVector } from "./objects/free_vector_object";
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
    // The other views, each with its part of the window.
    vs?: Settings[];
    // Degrees rather than radians, as DGPad by default.
    deg?: number;
    // See construction.segmentsOverPolygons.
    sop?: number;
    bg?: string;
    // The background image's key in `img`, and its layout.
    bgi?: string;
    bgf?: string;
    // The objects' styles, and images, their entries refer to.
    st?: Settings[];
    img?: Record<string, string>;
    // Type, name, parameters and style of each object, in construction
    // order.
    o: Json[][];
    // The macro-constructions, applied or not.
    mac?: Settings[];
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
// Seen through, as GeoGebra's solids.
const SOLID: Look = ["rgb(35,141,227)", "rgb(80,80,80)", 2, 0.4];
const CURVE: Look = ["#0b5b94", "#0b5b94", 2];
const LIST: Look = ["#656148", "#656148", 2];
const TEXT: Look = ["#000000", "#000000", 1];
const PLANES = ["Pl", "PlP", "PlL", "PlO", "PlE"];
export const LOOKS: Record<string, Look> = {
    Pt: POINT,
    Fix: DERIVED_POINT,
    Fp: DERIVED_POINT,
    On: POINT,
    DirP: POINT,
    CnP: DERIVED_POINT,
    Mid: DERIVED_POINT,
    Int: DERIVED_POINT,
    CyI: DERIVED_POINT,
    PlI: DERIVED_POINT,
    Ctr: DERIVED_POINT,
    Sym: DERIVED_POINT,
    Refl: DERIVED_POINT,
    Rot: DERIVED_POINT,
    Inv: DERIVED_POINT,
    CubV: DERIVED_POINT,
    Abv: DERIVED_POINT,
    NetV: DERIVED_POINT,
    TC: DERIVED_POINT,
    Vtx: DERIVED_POINT,
    Dil: DERIVED_POINT,
    Tra: DERIVED_POINT,
    Line: LINE,
    Par: LINE,
    Perp: LINE,
    Med: LINE,
    EqL: LINE,
    Tan: LINE,
    TanX: LINE,
    PlPl: LINE,
    Nrm: LINE,
    Ray: RAY,
    Bis: RAY,
    Seg: SEGMENT,
    Vec: SEGMENT,
    VecF: SEGMENT,
    FA: ["#006633", "#006633", 1, 0],
    Ang: ["#006633", "#006633", 4, 0],
    Cir: CIRCLE,
    C1: CIRCLE,
    CAx: CIRCLE,
    C3: CIRCLE,
    C3p: CIRCLE,
    C3s: CIRCLE,
    Arc: CIRCLE,
    Sec: CIRCLE,
    Arcs: CIRCLE,
    Secs: CIRCLE,
    CArc: CIRCLE,
    CArcs: CIRCLE,
    SphC: CIRCLE,
    Disk: CIRCLE,
    CSec: CIRCLE,
    CSecs: CIRCLE,
    Semi: CIRCLE,
    CyS: CIRCLE,
    EqC: CIRCLE,
    Quad: CIRCLE,
    Ell: CIRCLE,
    Ell1: CIRCLE,
    Hyp: CIRCLE,
    Hyp1: CIRCLE,
    Prb: CIRCLE,
    EqQ: CIRCLE,
    QArc: CIRCLE,
    QSec: CIRCLE,
    Sph: POLYGON,
    Sph1: POLYGON,
    Cyl: SOLID,
    Cone: SOLID,
    Cube: SOLID,
    CubP: SOLID,
    CubZ: SOLID,
    Prsm: SOLID,
    Pyr: SOLID,
    PrsH: SOLID,
    PyrH: SOLID,
    Net: SOLID,
    Poly: POLYGON,
    PolyL: POLYGON,
    RegP: POLYGON,
    PlS: POLYGON,
    Pl: POLYGON,
    PlP: POLYGON,
    PlL: POLYGON,
    PlO: POLYGON,
    PlE: POLYGON,
    Loc: CURVE,
    Cur: CURVE,
    Reg: POLYGON,
    Lst: LIST,
    Seq: LIST,
    Pts: LIST,
    Fl: LIST,
    ELst: LIST,
    Itr: LIST,
    Ex: ["rgb(0,0,178)", "rgb(0,0,178)", 7, 0],
    Txt: TEXT,
    Img: ["#000000", "#000000", 0],
    Html: ["#000000", "#000000", 3],
    Btn: ["#000000", "#000000", 1, 0.05],
    Evt: ["#000000", "#000000", 1],
    Mac: TEXT,
};

const BACKGROUND = "#FAFAFA";
const COLOR = /^(?:#[\da-f]{3}|#[\da-f]{6}|rgb\(-?\d+,-?\d+,-?\d+\))$/i;
const IMAGE_URL =
    /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z\d+/]*=*$/;
const POINT_SHAPES = ["circle", "cross", "diamond", "rect"];
const LIST_NATURES = [
    "point",
    "segment",
    "line",
    "label",
    "polygon",
    "polygons",
    "circle",
];
const ONE_FORMULA: unknown[] = ["point", "polygon", "polygons"];

const isNumber = (value: Json): value is number =>
    typeof value === "number" && Number.isFinite(value);
const isFlag = (value: Json): boolean => value === 0 || value === 1;
const isColor = (value: Json): boolean =>
    typeof value === "string" && COLOR.test(value);
const isOptionalColor = (value: Json): boolean =>
    value === null || isColor(value);
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

// Per axis, Ox and Oy, and Oz in a 3D figure: read from a pair, Oz keeps
// its default.
function perAxis(
    key:
        | "tickDistances"
        | "tickStyles"
        | "axisLabels"
        | "showNumbers"
        | "axisUnits",
    initial: Json,
    valid: (value: Json) => boolean,
): Property {
    const flags = key === "showNumbers";
    return property(
        grid_object,
        (grid) =>
            grid[key]
                .slice(0, grid.is2D ? 2 : 3)
                .map((value) => (flags ? +value : value)),
        (grid, value) => {
            const values: unknown[] = [...grid[key]];
            (value as Json[]).forEach(
                (item, axis) => (values[axis] = flags ? item === 1 : item),
            );
            (grid[key] as unknown[]) = values;
        },
        (_, view) => Array((view["3d"] ?? 0) ? 3 : 2).fill(initial),
        (value) =>
            Array.isArray(value) &&
            (value.length === 2 || value.length === 3) &&
            value.every(valid),
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

// The type whose default style an object of this entry type has: a
// macro's final has its own in the body, an image by a transformation its
// object's.
export const lookTag = (object: construction_object, tag: string): string =>
    object.look ?? object.output?.tag ?? tag;

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
    // An application of a macro is never shown.
    h: field(object, "hidden", (tag) => (tag === "Mac" ? 2 : 0), isHidden),
    sn: flag(object, "showName"),
    cp: field(
        object,
        "caption",
        null,
        (value) => value === null || typeof value === "string",
    ),
    in: flag(object, "inert"),
    f: field(object, "fontSize", 16, isNumber),
    // A locus's number of samples.
    p: field(
        object,
        "precision",
        (tag) => (tag === "Loc" ? 1000 : tag === "Html" ? 4 : -1),
        isNumber,
    ),
    l: field(object, "level", 0, Number.isInteger),
    sp: field<point_object | list_object>(
        [point_object, list_object],
        "shape",
        "circle",
        (value) => POINT_SHAPES.includes(value as string),
    ),
    pb: field(point_object, "border", 1, isNumber),
    ho: flag(point_object, "hollow"),
    np: field(point_object, "namePosition", 0, isNumber),
    no: field(
        object,
        "nameOffset",
        null,
        (value) =>
            value === null ||
            (Array.isArray(value) &&
                [2, 3].includes(value.length) &&
                value.every(isNumber)),
    ),
    nd: field(
        point_object,
        "nameDistance",
        null,
        (value) => value === null || isNumber(value),
    ),
    tk: flag(point_object, "trace"),
    tp: flag(point_object, "traceDots"),
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
            animation && [
                animation.speed,
                animation.direction,
                animation.once ? 2 : +animation.ar,
                ...(animation.geogebra
                    ? [1, ...(animation.stopped ? [1] : [])]
                    : []),
            ],
        (owner, value) => {
            if (!value) return;
            const [speed, direction, end, geogebra, stopped] =
                value as number[];
            owner.C.animations.add(owner, {
                speed,
                direction,
                ar: end === 1,
                ...(end === 2 && { once: true }),
                ...(geogebra === 1 && { geogebra: true }),
                ...(stopped === 1 && { stopped: true }),
            });
        },
        null,
        (value) =>
            value === null ||
            (Array.isArray(value) &&
                value.length >= 3 &&
                value.length <= 5 &&
                value.slice(3).every(isFlag) &&
                isNumber(value[0]) &&
                value[0] >= 0 &&
                (value[1] === 1 || value[1] === -1) &&
                (isFlag(value[2]) || value[2] === 2)),
    ),
    pl: flag(polygon_object, "plane", (tag) => +PLANES.includes(tag)),
    su: flag(polygon_object, "section", (tag) => +(tag === "PlS")),
    fx: flag(polygon_object, "fixed"),
    ar: field<angle_object | fixed_angle_object>(
        [angle_object, fixed_angle_object],
        "arcRadius",
        30,
        isNumber,
    ),
    ao: field(angle_object, "orientation", 0, (value) =>
        [0, 1, 2].includes(value as number),
    ),
    ra: field(angle_object, "rightAngleMark", "dgpad", (value) =>
        RIGHT_ANGLE_MARKS.includes(value as RightAngleMark),
    ),
    dc: field(segment_object, "decoration", 0, (value) =>
        [0, 1, 2, 3, 4, 5, 6].includes(value as number),
    ),
    dh: field(
        construction_object,
        "dash",
        [],
        (value) =>
            Array.isArray(value) && value.every(isNumber) && isDash(value),
    ),
    lo: field(
        construction_object,
        "strokeOpacity",
        (tag) => (tag === "Btn" ? 0.25 : 1),
        (value) => isNumber(value) && value >= 0 && value <= 1,
    ),
    is: field(expression_object, "increment", 0, isNumber),
    cL: field(expression_object, "cursorLength", 200, isNumber),
    cV: flag(expression_object, "vertical"),
    cD: flag(expression_object, "degrees"),
    cN: flag(expression_object, "unlabeled"),
    cB: flag(expression_object, "checkbox"),
    iB: field(expression_object, "inputLength", 0, isNumber),
    tx: flag(expression_object, "latex"),
    bf: flag<expression_object | text_object>(
        [expression_object, text_object],
        "bold",
    ),
    bg: field<expression_object | text_object>(
        [expression_object, text_object],
        "background",
        null,
        isOptionalColor,
    ),
    cc: field(expression_object, "cursorColor", null, isOptionalColor),
    cf: field(expression_object, "cursorFill", null, isOptionalColor),
    cr: field(expression_object, "cursorRadius", 10, isNumber),
    co: field(expression_object, "cursorOpacity", 0, isNumber),
    sg: field(expression_list_object, "segmentsSize", -1, isNumber),
    sa: field(
        expression_list_object,
        "arrow",
        null,
        (value) => value === null || isPair(value),
    ),
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
    bg: field(
        grid_object,
        "background",
        null,
        (value) => value === null || isColor(value),
    ),
    bgf: field(
        grid_object,
        "backgroundFit",
        "repeat",
        (value) => typeof value === "string" && own(BACKGROUND_FITS, value),
    ),
    ph: field(grid_object, "PHI", (5 * Math.PI) / 2, isNumber),
    rt: range("RESTRICT_THETA", [-Math.PI / 2, Math.PI / 2]),
    rp: range("RESTRICT_PHI", [null, null]),
    pe: flag(grid_object, "PERSPECTIVE"),
    f2: field(
        grid_object,
        "FRAME2D",
        null,
        (value) => value === null || isPair(value),
    ),
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
    oz: flag(grid_object, "showOz", 1),
    lx: flag(grid_object, "lockOx"),
    ly: flag(grid_object, "lockOy"),
    cz: flag(grid_object, "centerZoom"),
    lk: flag(grid_object, "locked"),
    op: flag(grid_object, "onlyPositive"),
    c: field(grid_object, "stroke_color", "rgb(80,80,80)", isColor),
    f: field(grid_object, "fontSize", 18, isNumber),
    s: field(grid_object, "size", 2, isNumber),
    gw: field(grid_object, "gridWidth", 0.1, isNumber),
    gd: field(
        grid_object,
        "gridDistances",
        [0, 0],
        (value) => isPair(value) && value.every((distance) => distance >= 0),
    ),
    gs: field(
        grid_object,
        "gridSubdivisions",
        0,
        (value) => Number.isInteger(value) && (value as number) >= 0,
    ),
    gc: field(
        grid_object,
        "gridColor",
        null,
        (value) => value === null || isColor(value),
    ),
    gl: field(
        grid_object,
        "gridDash",
        [],
        (value) =>
            Array.isArray(value) && value.every(isNumber) && isDash(value),
    ),
    td: perAxis("tickDistances", 0, (value) => isNumber(value) && value >= 0),
    ts: perAxis("tickStyles", 0, (value) =>
        [0, 1, 2].includes(value as number),
    ),
    nb: flag(grid_object, "boldNumbers"),
    gg: flag(grid_object, "geogebraAxes"),
    al: perAxis("axisLabels", "", (value) => typeof value === "string"),
    nu: perAxis("showNumbers", 1, isFlag),
    au: perAxis("axisUnits", "", (value) => typeof value === "string"),
    gb: field(grid_object, "boxSize", 1, (value) =>
        [0, 1, 2].includes(value as number),
    ),
    gi: field(grid_object, "viewInset", [0, 0], isPair),
    gp: field(
        grid_object,
        "pivot",
        null,
        (value) =>
            value === null ||
            (Array.isArray(value) &&
                value.length === 3 &&
                value.every(isNumber)),
    ),
    ah: field(grid_object, "arrows", 0, (value) =>
        [0, 1, 2, 3].includes(value as number),
    ),
    fc: field(
        grid_object,
        "floorColor",
        null,
        (value) => value === null || isColor(value),
    ),
    fo: field(
        grid_object,
        "floorOpacity",
        0.3,
        (value) => isNumber(value) && value >= 0 && value <= 1,
    ),
    fd: field(
        grid_object,
        "floorStep",
        1,
        (value) => isNumber(value) && (value === 0 || value >= 0.05),
    ),
    fg: field(
        grid_object,
        "floorLineColor",
        null,
        (value) => value === null || isColor(value),
    ),
    fw: field(
        grid_object,
        "floorLineWidth",
        0.5,
        (value) => isNumber(value) && value >= 0,
    ),
    fe: field(
        grid_object,
        "floorExtent",
        8,
        (value) => isNumber(value) && value > 0 && value <= 100,
    ),
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

// What its style saves, for a body of its .dgo type.
export const objectStyle = (
    object: construction_object,
    tag: string,
): Settings => describe(STYLE, object, tag);

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

// The figure's own objects, without its views' grids.
export function figureObjects(c: construction): construction_object[] {
    const internal = new Set<construction_object>(
        c.views.flatMap(({ grid }) => [
            grid,
            grid.floorOccluder,
            ...grid.floorOccluder.points,
        ]),
    );
    return c.OBJS.V.filter((object) => !internal.has(object));
}

export async function writeDgo(
    c: construction,
    region?: Region,
): Promise<Blob> {
    return gzipped(await describeDgo(c, region));
}

export const gzipped = (figure: unknown): Promise<Blob> =>
    new Response(
        new Blob([JSON.stringify(figure)])
            .stream()
            .pipeThrough(new CompressionStream("gzip")),
    ).blob();

// Saved as the given region of the window shows it, the whole window when
// the figure has several views.
export async function describeDgo(
    c: construction,
    region?: Region,
): Promise<DgoFigure> {
    const [width, height] = c.windowSize;
    const { x, y, w, h } =
        region && c.views.length === 1
            ? region
            : { x: 0, y: 0, w: width, h: height };
    const objects = figureObjects(c);
    const indices = new Map(objects.map((object, index) => [object, index]));
    const images: Record<string, string> = {};
    const keys = new Map<string, string>();
    const { image: backgroundImage, fit } = c.prefs.background;
    for (const url of [
        ...(backgroundImage ? [backgroundImage] : []),
        ...c.views.flatMap(({ grid }) =>
            grid.backgroundImage ? [grid.backgroundImage] : [],
        ),
        ...objects.flatMap((object) =>
            object instanceof image_object ? [object.url] : [],
        ),
        ...c.macros.flatMap(({ icon }) => (icon ? [icon] : [])),
    ])
        if (!keys.has(url)) {
            const key = await imageKey(url);
            keys.set(url, key);
            images[key] = url;
        }
    const context: DgoContext = {
        index: (object) => objectIndex(object, (owner) => indices.get(owner)!),
        image: (url) => keys.get(url)!,
        screen: ([sx, sy]) => [Math.round(sx - x), Math.round(sy - y)],
    };
    const styles: Settings[] = [];
    const styleIndices = new Map<string, number>();
    const styleIndex = (style: Settings): number => {
        const json = JSON.stringify(style);
        if (!styleIndices.has(json)) {
            styleIndices.set(json, styles.length);
            styles.push(style);
        }
        return styleIndices.get(json)!;
    };
    const several = c.views.length > 1;
    const view = (
        { grid, rect }: FigureView,
        [dx, dy]: Vec2,
        size: Settings,
    ): Settings => ({
        o: [grid.ORG[0] - dx, grid.ORG[1] - dy],
        u: grid.UNIT[0],
        ...(grid.UNIT[1] !== grid.UNIT[0] && { uy: grid.UNIT[1] }),
        ...size,
        ...(several && { cw: rect[2] }),
        ...describe(VIEW, grid),
        ...(grid.backgroundImage && { bgi: keys.get(grid.backgroundImage)! }),
    });
    const [first, ...others] = c.views;
    const figure: DgoFigure = {
        dgo: VERSION,
        v: view(first, [x, y], { w, h }),
        ...(others.length && {
            vs: others.map((other) => view(other, [0, 0], {})),
        }),
        ...(!c.degrees && { deg: 0 }),
        ...(c.segmentsOverPolygons && { sop: 1 }),
        ...(c.prefs.background.color !== BACKGROUND && {
            bg: c.prefs.background.color,
        }),
        ...(backgroundImage && { bgi: keys.get(backgroundImage)! }),
        ...(backgroundImage && fit !== "repeat" && { bgf: fit }),
        o: objects.map((object) =>
            c.inView(object.view, () => dgoEntry(object, context, styleIndex)),
        ),
    };
    if (c.macros.length)
        figure.mac = describeMacros(
            c.macros,
            (url) => keys.get(url)!,
            styleIndex,
        );
    if (styles.length) figure.st = styles;
    if (keys.size) figure.img = images;
    return figure;
}

// Their `mac`, given the keys of their icons and the indices of their
// styles.
export const describeMacros = (
    macros: Macro[],
    image: (url: string) => string,
    styleIndex: (style: Settings) => number,
): Settings[] =>
    macros.map(({ name, finals, icon, methods }) => ({
        n: name,
        f: finals,
        ...(icon && { ic: image(icon) }),
        m: methods.map(({ initials, names, help, body, finals }) => ({
            i: initials.map(([type, message, fixed]) =>
                fixed
                    ? [type, message, fixed]
                    : message
                      ? [type, message]
                      : [type],
            ),
            ...(names && { n: names }),
            ...(help && { h: help }),
            b: body.map(([tag, name, parameters, style]) =>
                style === undefined
                    ? [tag, name, parameters]
                    : [tag, name, parameters, styleIndex(style as Settings)],
            ),
            f: finals,
        })),
    }));

// Its entry in `o`, of this type and these parameters.
export function dgoEntry(
    object: construction_object,
    context: DgoContext,
    styleIndex: (style: Settings) => number,
    [tag, parameters] = objectEntry(object, context),
): unknown[] {
    const style = describe(STYLE, object, lookTag(object, tag));
    if (object.view) style.vw = object.view;
    if (object.condition) style.sc = context.index(object.condition);
    if (object.dynamicColor) style.rgb = context.index(object.dynamicColor);
    const rate =
        (object instanceof point_on_object ||
            object instanceof expression_object) &&
        object.animation?.rate;
    if (rate) style.av = context.index(rate);
    if (object instanceof point_object && object.magnets.length)
        style.mg = object.magnets.map(({ target, radius }) => [
            context.index(target),
            radius,
        ]);
    const entry = [tag, object.name, parameters];
    if (Object.keys(style).length === 0) return entry;
    return [...entry, styleIndex(style)];
}

// Content-addressed, so that the same image is stored once.
export async function imageKey(url: string): Promise<string> {
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
// ever unsupported. `centered`: see readDgo. Of a workbook, its page shown.
export async function importDgoFromBlob(
    c: construction,
    file: Blob,
    centered = false,
): Promise<string[]> {
    importDgo(c, (await readDgoFile(file)).figure, centered);
    return [];
}

// The workbook the file is, if it is one, and the figure of its page shown.
export async function readDgoFile(
    file: Blob,
): Promise<{ book: Workbook | null; figure: Json }> {
    const json = await dgoJson(file);
    const book = dgoWorkbook(json);
    return { book, figure: book ? book.pages[book.current].figure : json };
}

export function importDgo(c: construction, figure: Json, centered = false) {
    readDgo(c, figure, centered);
    runInits(c);
}

// Figures shown one at a time, each with its name and the color of its tab,
// and the one shown.
export interface Workbook {
    pages: { name: string; color?: string; figure: DgoFigure }[];
    current: number;
}

function dgoWorkbook(json: Json): Workbook | null {
    if (!isRecord(json) || json.pg === undefined) return null;
    const { dgo, pg: pages, p: current = 0 } = json;
    check(Array.isArray(pages) && pages.length > 0);
    check(typeof current === "number" && Number.isInteger(current));
    check(current >= 0 && current < pages.length);
    return {
        pages: pages.map((page) => {
            check(isRecord(page) && typeof page.n === "string");
            const { n, c, ...figure } = page;
            check(c === undefined || isColor(c));
            return {
                name: n as string,
                ...(c !== undefined && { color: c as string }),
                figure: { ...figure, dgo } as DgoFigure,
            };
        }),
        current,
    };
}

export const describeWorkbook = ({ pages, current }: Workbook) => ({
    dgo: VERSION,
    pg: pages.map(({ name, color, figure: { dgo, ...figure } }) => ({
        n: name,
        ...(color && { c: color }),
        ...figure,
    })),
    ...(current > 0 && { p: current }),
});

// Gzipped or not.
export async function dgoJson(file: Blob): Promise<Json> {
    const [first, second] = new Uint8Array(
        await file.slice(0, 2).arrayBuffer(),
    );
    const stream =
        first === 0x1f && second === 0x8b
            ? file.stream().pipeThrough(new DecompressionStream("gzip"))
            : file.stream();
    return JSON.parse(await new Response(stream).text());
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
        vs: views = [],
        deg = 1,
        sop = 0,
        bg = BACKGROUND,
        bgi = null,
        bgf = "repeat",
        st: styles = [],
        img: images = {},
        o: entries,
        mac: macros = [],
    } = figure;
    check(isRecord(view) && isFlag(deg) && isFlag(sop) && isColor(bg));
    check(Array.isArray(styles) && styles.every(isRecord));
    check(isRecord(images) && Array.isArray(entries));
    c.degrees = deg === 1;
    c.segmentsOverPolygons = sop === 1;
    // A background image, by its key.
    const imageOf = (key: unknown): string | null => {
        const url =
            typeof key === "string" && own(images, key) ? images[key] : null;
        check(key === null || (typeof url === "string" && IMAGE_URL.test(url)));
        return url as string | null;
    };
    const image = imageOf(bgi);
    check(typeof bgf === "string" && own(BACKGROUND_FITS, bgf));
    c.prefs.background = {
        color: bg as string,
        image: image as string | null,
        fit: bgf as BackgroundFit,
    };
    c.macros = readMacros(macros, styles, images);

    const { w: width, h: height } = view;
    check(isNumber(width) && isNumber(height));
    c.savedSize = [width, height];
    check(Array.isArray(views) && views.every(isRecord));
    const several = views.length > 0;
    // Each view's column of the window, then its coordinate system, its
    // origin from its top left corner.
    const grids = [view, ...views].map((settings, index) => {
        const { cw: share = 1 } = settings;
        check(isNumber(share) && share > 0);
        if (index) c.addView(share);
        else c.views[0].share = share;
        const grid = c.views[index].grid;
        apply(VIEW, grid, settings);
        grid.backgroundImage = imageOf(settings.bgi ?? null);
        const { o: origin, u: unit, uy = unit } = settings;
        check(isPair(origin) && isNumber(unit) && unit > 0);
        check(isNumber(uy) && uy > 0);
        grid.UNIT = [unit, uy, unit];
        return grid;
    });
    c.arrangeViews();
    c.measureViews();
    const [grid] = grids;
    // Before the background image, GeoGebra's graphics view's color.
    const { gv = null } = view;
    check(gv === null || isColor(gv));
    if (gv && !image && (grid.viewInset[0] || grid.viewInset[1]))
        Object.assign(
            c.prefs.background,
            bandBackground(gv as string, grid.viewInset),
        );
    c.paintBackground();
    // Otherwise, a DGPad figure keeps its origin where it was in the window,
    // as in DGPad; another 3D one, where it was from the window's center.
    const offset: Vec2 =
        centered && !several
            ? [
                  Math.round((c.width - width) / 2),
                  Math.round((c.height - height) / 2),
              ]
            : [0, 0];
    const [windowWidth, windowHeight] = c.windowSize;
    grids.forEach((grid, index) => {
        const [x, y] = [view, ...views][index].o as Vec2;
        const [, , w, h] = c.views[index].rect;
        grid.ORG =
            centered && !several
                ? [x + offset[0], y + offset[1]]
                : grid.is2D || grid.FRAME2D
                  ? [x, y]
                  : [
                        x + ((windowWidth - width) * w) / 2,
                        y + ((windowHeight - height) * h) / 2,
                    ];
    });
    c.beginBatch();
    addDgoEntries(c, entries, styles, images, offset);
    grids.forEach((grid) => grid.createSVG());
    c.endBatch();
    c.invalidateProjection();
}

// Adds the objects of these entries after the figure's own, which their
// indices go on from: see readDgo.
export function addDgoEntries(
    c: construction,
    entries: Json[],
    styles: Json[] = [],
    images: Record<string, Json> = {},
    offset: Vec2 = [0, 0],
): void {
    const objects = figureObjects(c);
    const at = objectAt(objects);
    const styled = readEntries(
        { c, root: c, macros: c.macros, images, offset },
        objects,
        entries,
        (index) => {
            if (index === undefined) return {};
            const chosen = styles[index as number];
            check(Number.isInteger(index) && isRecord(chosen));
            return chosen;
        },
    );
    // Conditions, dynamic colors, magnets and animation rates may name
    // later objects.
    styled.forEach(
        ([object, { sc: condition, rgb: color, mg: magnets, av: rate }]) => {
            if (rate !== undefined) {
                check(
                    (object instanceof point_on_object ||
                        object instanceof expression_object) &&
                        object.animation,
                );
                object.animation.rate = at(rate, expression_object);
            }
            if (condition !== undefined) {
                object.condition = at(condition, expression_object);
                object.addParents(object.condition);
            }
            if (color !== undefined) {
                object.dynamicColor = at(color, expression_object);
                object.addParents(object.dynamicColor);
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
        },
    );
}

// An earlier object of `objects`, of one of the given classes.
function objectAt(objects: construction_object[]) {
    const at = <C extends Classes>(
        value: Json,
        ...classes: C
    ): Instance<C[number]> => {
        if (Array.isArray(value)) {
            const [kind, owner, rank] = list(value, 3);
            check(
                (kind === "side" || kind === "vertex" || kind === "face") &&
                    Number.isInteger(owner) &&
                    Number.isSafeInteger(rank) &&
                    (rank as number) >= 1,
            );
            const whole =
                kind === "face"
                    ? at(owner, polyhedron_object)
                    : at(owner, polygon_object);
            check(whole instanceof polyhedron_object || !whole.plane);
            const object = partOf(kind, whole, rank as number);
            check(classes.some((type) => object instanceof type));
            return object as Instance<C[number]>;
        }
        check(
            Number.isInteger(value) &&
                (value as number) >= 0 &&
                (value as number) < objects.length,
        );
        const object = objects[value as number];
        check(classes.some((type) => object instanceof type));
        return object as Instance<C[number]>;
    };
    return at;
}

// Where entries are read: the figure, or the body of a macro's
// application.
export interface Scope {
    c: construction;
    // The figure's.
    root: construction;
    // Those it may apply.
    macros: Macro[];
    images: Record<string, Json>;
    offset: Vec2;
}

// What reads entries after `objects`, which their indices go on from.
function entryReader(
    scope: Scope,
    objects: construction_object[],
): (name: string) => Reader {
    const { c } = scope;
    const vec3 = c.space;
    const indexed = objectAt(objects);
    // An object written in the definition, out of the figure: its entry
    // without name, a formula for a point or a list given by one.
    const at = <C extends Classes>(
        value: Json,
        ...classes: C
    ): Instance<C[number]> => {
        if (!Array.isArray(value) || !own(BUILDERS, value[0] as string))
            return indexed(value, ...classes);
        const [tag, parameters] = list(value, 2) as [string, Json];
        let object: construction_object;
        if (tag === "Fp")
            object = embeddedPoint(c, ...pointFormula(parameters), vec3);
        else if (tag === "Fl") {
            const { source, refs } = formula(parameters, construction_object);
            const node = parseFormula(source);
            checkNames(formulaIdentifiers(node), refs);
            object = embeddedList(c, node, refs, vec3);
        } else {
            check(!UNEMBEDDED.includes(tag));
            // Built as in the figure, without being added to it.
            const built = Object.assign(Object.create(c) as construction, {
                add: <T>(object: T) => object,
            });
            object = embed(
                BUILDERS[tag](parameters, { ...read(""), c: built }),
            );
        }
        check(classes.some((type) => object instanceof type));
        return object as Instance<C[number]>;
    };
    const read = (name: string): Reader => ({
        ...scope,
        name,
        at,
        points,
        formula,
        pointFormula,
        vec3,
    });
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

    const pointFormula = (
        value: Json,
    ): [Program, Map<string, construction_object>] => {
        const { source, refs } = formula(value, construction_object);
        const program = parseProgram(source);
        checkNames(programReferences(program), refs);
        return [program, refs];
    };

    return read;
}

// An object written in another's definition, read in the figure.
export const readEmbedded = (
    c: construction,
    value: Json,
): construction_object => {
    const objects = figureObjects(c);
    return withObjects(new Set(objects.map(({ name }) => name)), () =>
        entryReader(
            { c, root: c, macros: c.macros, images: {}, offset: [0, 0] },
            objects,
        )("").at(value, construction_object),
    );
};

// Reads the entries after `objects`, which their indices go on from, each
// with the style `style` finds for its fourth element.
export function readEntries(
    scope: Scope,
    objects: construction_object[],
    entries: Json[],
    style: (value: Json) => Settings,
): [construction_object, Settings][] {
    const { c } = scope;
    const styled: [construction_object, Settings][] = [];
    const read = entryReader(scope, objects);
    const names = [
        ...objects.map((object) => object.name),
        ...entries.flatMap((entry) =>
            Array.isArray(entry) && typeof entry[1] === "string"
                ? [entry[1]]
                : [],
        ),
    ];
    withObjects(new Set(names), () =>
        entries.forEach((entry) => {
            const [tag, name, parameters, styleValue] = list(entry, 3, 4);
            check(typeof tag === "string" && own(BUILDERS, tag));
            check(typeof name === "string" && name !== "" && !c.getObj(name));
            const object = BUILDERS[tag](parameters, read(name));
            const settings = style(styleValue);
            apply(STYLE, object, settings, lookTag(object, tag));
            // Drawn in the view it names, else in the one it is added in.
            const { vw: view } = settings;
            if (view !== undefined) {
                check(
                    Number.isInteger(view) &&
                        (view as number) >= 0 &&
                        (view as number) < c.views.length,
                );
                c.moveToView(object, view as number);
            }
            styled.push([object, settings]);
            objects.push(object);
        }),
    );
    return styled;
}

interface Reader extends Scope {
    name: string;
    at<C extends Classes>(value: Json, ...classes: C): Instance<C[number]>;
    points(values: Json, count: number): point_object[];
    formula<C extends Classes>(
        value: Json,
        ...classes: C
    ): { source: string; refs: Map<string, Instance<C[number]>> };
    pointFormula(value: Json): [Program, Map<string, construction_object>];
    vec3: boolean;
}

// What builds an application's body: its objects stay out of the figure.
export function privateConstruction(
    c: construction,
    objects: construction_object[],
): construction {
    const names = new Map<string, construction_object>();
    return Object.assign(Object.create(c) as construction, {
        add: <T extends construction_object>(object: T): T => {
            objects.push(object);
            names.set(object.name, object);
            return object;
        },
        getObj: (name: string) => names.get(name),
        // Where a locus finds the objects between its points.
        OBJS: Object.assign(Object.create(c.OBJS), { V: objects }),
    });
}

// Not in a body: free objects, which would be missing initials, what a
// manipulation changes, what acts on the figure, and images, whose keys
// are the figure's.
const UNBUILT = ["Pt", "VecF", "Btn", "Evt", "Html", "Img"];

// Never written in another's definition: what is moved, edited, shown or
// applied by itself.
export const UNEMBEDDED = [...UNBUILT, "On", "Ex", "Txt", "Mac", "Out"];

// The figure's macros: what can be checked before reading their bodies,
// read with each application.
export function readMacros(
    value: Json,
    styles: Json[],
    images: Record<string, Json>,
): Macro[] {
    check(Array.isArray(value));
    const macros = value.map((macro): Macro => {
        check(isRecord(macro));
        const { n: name, f: finals, ic: icon = null, m: methods } = macro;
        check(typeof name === "string" && name !== "");
        check(
            Array.isArray(finals) &&
                finals.length > 0 &&
                finals.every((final) => typeof final === "string"),
        );
        const url =
            icon === null
                ? null
                : typeof icon === "string" && own(images, icon)
                  ? images[icon]
                  : undefined;
        check(url === null || (typeof url === "string" && IMAGE_URL.test(url)));
        check(Array.isArray(methods) && methods.length > 0);
        return {
            name,
            finals: finals as string[],
            icon: url,
            methods: methods.map((method) =>
                readMethod(method, finals.length, styles),
            ),
        };
    });
    check(new Set(macros.map(({ name }) => name)).size === macros.length);
    // No signature is another's, nor begins it.
    macros.forEach(({ methods }) =>
        methods.forEach(({ initials: shorter }, i) =>
            methods.forEach(({ initials: longer }, j) =>
                check(
                    i === j ||
                        shorter.length > longer.length ||
                        shorter.some(([type], k) => type !== longer[k][0]),
                ),
            ),
        ),
    );
    return macros;
}

function readMethod(method: Json, count: number, styles: Json[]): MacroMethod {
    check(isRecord(method));
    const { i: values, n: names, h: help = "", b: body, f: finals } = method;
    check(Array.isArray(values) && values.length > 0);
    check(typeof help === "string" && Array.isArray(body));
    const initials = values.map((value): [string, string, string?] => {
        const [type, message = "", fixed] = list(value, 1, 3);
        check(typeof type === "string" && own(MACRO_TYPES, type));
        check(typeof message === "string");
        if (fixed === undefined) return [type, message];
        check(typeof fixed === "string" && fixed !== "");
        return [type, message, fixed];
    });
    const slots = initials.reduce(
        (sum, [type]) => sum + (SUB_OBJECTS[type] ?? 0) + 1,
        0,
    );
    check(
        names === undefined ||
            list(names, slots).every((name) => typeof name === "string"),
    );
    check(
        list(finals, count, count).every(
            (index, rank) =>
                Number.isInteger(index) &&
                (index as number) >= slots &&
                (index as number) < slots + body.length &&
                (finals as Json[]).indexOf(index) === rank,
        ),
    );
    return {
        initials,
        ...(names !== undefined && { names: names as string[] }),
        help,
        body: body.map((entry) => {
            const [tag, name, parameters, styleIndex] = list(entry, 3, 4);
            check(typeof tag === "string" && !UNBUILT.includes(tag));
            // A number nothing computes, that a manipulation changes.
            check(
                tag !== "Ex" ||
                    (isRecord(parameters) &&
                        !own(parameters, "v") &&
                        !own(parameters, "g")),
            );
            if (styleIndex === undefined) return [tag, name, parameters];
            check(Number.isInteger(styleIndex));
            const style = styles[styleIndex as number];
            check(
                isRecord(style) &&
                    !own(style, "sc") &&
                    !own(style, "rgb") &&
                    !own(style, "mg") &&
                    !own(style, "av"),
            );
            return [tag, name, parameters, style];
        }),
        finals: finals as number[],
    };
}

function setBranches(node: macro_object, value: Json): void {
    const { branched } = node;
    list(value, branched.length, branched.length).forEach((branch, index) => {
        const object = branched[index];
        if (object instanceof macro_object) return setBranches(object, branch);
        check(Number.isInteger(branch) && (branch as number) >= 0);
        object.order = branch as number;
    });
}

type Builder = (parameters: Json, reader: Reader) => construction_object;

// A point on this object's parameter: a pair on a polygon or a conic.
function onParameter(
    support: point_support_object,
    alpha: Json,
): number | [number, number] | Vec3 {
    if (
        support instanceof sphere_object ||
        support instanceof revolution_object
    ) {
        const [x, y, z] = list(alpha, 3).map(real);
        return [x, y, z];
    }
    if (
        !(support instanceof polygon_object) &&
        !(support instanceof primitive_quadric_object)
    )
        return real(alpha);
    const [a, b] = list(alpha, 2).map(real);
    return [a, b];
}

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

// A number, or a formula.
function radius(value: Json, { formula }: Reader): circle1_radius {
    if (value === null || isNumber(value)) return real(value);
    const { source, refs } = formula(value, construction_object);
    const node = parseFormula(source);
    checkNames(formulaIdentifiers(node), refs);
    return { formula: node, refs };
}

// A prism or a pyramid on a polygon, by a point or of a height.
const onPolygon =
    (tag: "Prsm" | "Pyr" | "PrsH" | "PyrH"): Builder =>
    (parameters, reader) => {
        const [base, other] = list(parameters, 2);
        const polygon = reader.at(base, polygon_object);
        return createPolyhedron(
            reader.c,
            reader.name,
            tag === "Prsm" || tag === "Pyr"
                ? { tag, base: polygon, point: reader.at(other, point_object) }
                : { tag, base: polygon, height: radius(other, reader) },
        );
    };

// A cylinder or a cone of axis AB and radius r.
const revolution =
    (cone: boolean): Builder =>
    (parameters, reader) => {
        const [a, b, value] = list(parameters, 3);
        return createRevolution(
            reader.c,
            reader.name,
            reader.at(a, point_object),
            reader.at(b, point_object),
            radius(value, reader),
            cone,
        );
    };

// Through a point, containing a line or orthogonal to it.
const throughLine =
    (tag: "PlL" | "PlO"): Builder =>
    (parameters, { c, name, at }) => {
        const [point, line] = list(parameters, 2);
        return createPlane(c, name, {
            tag,
            point: at(point, point_object),
            line: at(line, primitive_line_object),
        });
    };

// Of center M, from A to the ray [MB), clockwise after a 1.
const centerArc =
    (sector: boolean): Builder =>
    (parameters, { c, name, at }) => {
        const [m, a, b, clockwise] = list(parameters, 3, 4);
        check(clockwise === undefined || clockwise === 1);
        return createCenterArc(
            c,
            name,
            at(m, point_object),
            at(a, point_object),
            at(b, point_object),
            sector,
            clockwise === 1,
        );
    };

// Of a circle or a conic, from P to Q counterclockwise.
const conicArc =
    (sector: boolean): Builder =>
    (parameters, { c, name, at }) => {
        const [conic, p, q] = list(parameters, 3);
        return createConicArc(
            c,
            name,
            at(conic, primitive_quadric_object, primitive_circle_object),
            at(p, point_object),
            at(q, point_object),
            sector,
        );
    };

// Of an equation, its two sides each a formula in x and y, or in x, y and
// z for a plane.
const equation =
    (
        create: (
            c: construction,
            name: string | null,
            equation: Equation,
        ) => construction_object,
        variables = ["x", "y"],
    ): Builder =>
    (parameters, { c, name, formula }) =>
        create(
            c,
            name,
            list(parameters, 2).map((side) => {
                const { source, refs } = formula(side, construction_object);
                const node = parseFormula(source);
                checkNames(formulaIdentifiers(node), refs, variables);
                return {
                    node,
                    source,
                    variables,
                    refs,
                    vec3: variables.length === 3,
                };
            }) as Equation,
        );

// The ellipse or the hyperbola of two foci, through a third point or of a
// semi-major axis.
const focalConic =
    (hyperbola: boolean): Builder =>
    (parameters, { c, name, points }) => {
        const [f, g, p] = points(parameters, 3);
        return createFocalConic(c, name, hyperbola, f, g, p);
    };
const focalConic1 =
    (hyperbola: boolean): Builder =>
    (parameters, reader) => {
        const [f, g, value] = list(parameters, 3);
        return createFocalConic(
            reader.c,
            reader.name,
            hyperbola,
            reader.at(f, point_object),
            reader.at(g, point_object),
            radius(value, reader),
        );
    };

function ofSegment<T extends construction_object & { side?: segment_object }>(
    create: (
        c: construction,
        name: string,
        a: point_object,
        b: point_object,
    ) => T,
): Builder {
    return (parameters, reader) => {
        if (Array.isArray(parameters) && parameters.length === 1) {
            const side = reader.at(parameters[0], segment_object);
            const made = create(reader.c, reader.name, side.P1, side.P2);
            made.side = side;
            return made;
        }
        return twoPoints(create)(parameters, reader);
    };
}

// A transformation's entry, of `min` to `max` parameters: the image of the
// second one, a point or an object (see transformed_object.ts), `map`
// reading the others and making the image of a point.
function transformation(
    min: number,
    max: number,
    map: (
        parameters: Json[],
        reader: Reader,
    ) => (name: string | null, point: point_object) => point_object,
): Builder {
    return (parameters, reader) => {
        const values = list(parameters, min, max);
        const image = map(values, reader);
        const source = reader.at(values[1], point_object, ...TRANSFORMABLE);
        return source instanceof point_object
            ? reader.c.add(image(reader.name, source))
            : createTransformed(reader.c, reader.name, source, (point) =>
                  image(null, point),
              );
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
    locus_object,
];

// What a transformation maps, besides points.
const TRANSFORMABLE = [
    primitive_line_object,
    primitive_circle_object,
    polygon_object,
    primitive_quadric_object,
    curve_object,
    locus_object,
    sphere_object,
    polyhedron_object,
];

// What an inversion or a macro maps: not a plane, a sphere nor a
// polyhedron.
const invertible = (object: construction_object): boolean =>
    TRANSFORMABLE.some((type) => object instanceof type) &&
    !(object instanceof plane_object) &&
    !(object instanceof sphere_object) &&
    !(object instanceof polyhedron_object);

// A List's or a text's formula, "k" and "count" being a List's own, or a
// Sequence's, which reads its variables.
function listFormula(
    reader: Reader,
    value: Json,
    refs: Map<string, construction_object>,
    variables?: string[],
): FormulaNode {
    const { source, refs: own } = reader.formula(value, construction_object);
    const node = parseFormula(source, variables);
    checkNames(formulaIdentifiers(node), own, variables ?? ["k", "count"]);
    own.forEach((ref, name) => refs.set(name, ref));
    return node;
}

// An expression's or a button's script: the objects it reads, and those it
// styles.
function scriptProgram(reader: Reader, value: Json): ExpressionProgram {
    const { source, refs } = reader.formula(value, construction_object);
    const program = parseProgram(source);
    const references = programReferences(program);
    const targets = programTargets(program);
    checkNames(references, refs);
    // An object declared after it, as the List drawing it, isn't styled.
    const named = (names: Set<string>) =>
        new Map(
            [...names].flatMap((name) =>
                refs.has(name) ? [[name, refs.get(name)!]] : [],
            ),
        );
    return {
        program,
        refs: named(references),
        targets: named(targets),
        vec3: reader.vec3,
    };
}

// An application of a macro's method to the initials, outside the figure.
function application(
    reader: Reader,
    name: string | null,
    index: number,
    rank: number,
    initials: (construction_object | string)[],
): macro_object {
    const { c, root, macros, images } = reader;
    const macro = macros[index];
    const method = macro.methods[rank];
    const objects: construction_object[] = [];
    const body = privateConstruction(c, objects);
    const standIns = new Map<construction_object, construction_object>();
    const local = initials.flatMap((initial, i) =>
        typeof initial === "string"
            ? [
                  createExpression(
                      body,
                      null,
                      "",
                      null,
                      null,
                      null,
                      [0, 0],
                      null,
                      scriptProgram(reader, initial),
                  ),
              ]
            : initialSlots(body, method.initials[i][0], initial, standIns),
    );
    const slots = local.length;
    readEntries(
        {
            c: body,
            root,
            macros: macros.slice(0, index),
            images,
            offset: [0, 0],
        },
        local,
        method.body,
        (style) => (style ?? {}) as Settings,
    );
    objects.forEach((object) => (object.C = root));
    return new macro_object(
        c,
        name,
        macro,
        rank,
        initials,
        objects,
        [...standIns.values()],
        local,
        method.finals.map((final) =>
            lookTag(local[final], method.body[final - slots][0] as string),
        ),
    );
}

const BUILDERS: Record<string, Builder> = {
    Pt: (parameters, { c, name }) =>
        createPoint(c, name, coordinates(parameters)),
    Fix: (parameters, { c, name }) =>
        createFixedPoint(c, name, coordinates(parameters)),
    Fp: (parameters, { c, name, at, pointFormula, vec3 }) => {
        const [value, ...handles] = list(parameters, 1, 3);
        const point = createFormulaPoint(c, name, ...pointFormula(value), vec3);
        if (handles.length === 1)
            point.setFollows(at(handles[0], point_object));
        else if (handles.length) {
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
            primitive_quadric_object,
            locus_object,
            list_object,
            curve_object,
            sphere_object,
            revolution_object,
        );
        return createPointOn(c, name, support, onParameter(support, alpha));
    },
    Mid: ofSegment(createMidpoint),
    Sym: transformation(2, 2, ([center], { c, at }) => {
        const o = at(center, point_object);
        return (name, point) => new symmetry_object(c, name, o, point);
    }),
    Refl: transformation(2, 2, ([line], { c, at }) => {
        const d = at(line, primitive_line_object);
        return (name, point) => new reflection_object(c, name, d, point);
    }),
    Rot: transformation(3, 4, ([center, , angle, axis], reader) => {
        const o = center === null ? null : reader.at(center, point_object);
        const a = radius(angle, reader);
        const d =
            axis === undefined
                ? undefined
                : reader.at(axis, primitive_line_object);
        return (name, point) =>
            new rotation_object(reader.c, name, o, point, a, d);
    }),
    Dil: transformation(3, 3, ([center, , ratio], reader) => {
        const o = center === null ? null : reader.at(center, point_object);
        const k = radius(ratio, reader);
        return (name, point) =>
            new dilation_object(reader.c, name, o, point, k);
    }),
    Tra: transformation(2, 2, ([vector], reader) => {
        // An object, written in the definition or not, or a formula.
        const u =
            isNumber(vector) || (Array.isArray(vector) && !isRecord(vector[1]))
                ? reader.at(vector, vector_object, point_object)
                : radius(vector, reader);
        check(typeof u !== "number");
        return (name, point) =>
            new translation_object(
                reader.c,
                name,
                u as translation_vector,
                point,
            );
    }),
    Ctr: (parameters, { c, name, at }) => {
        const [circle] = list(parameters, 1);
        return createCenter(c, name, at(circle, primitive_circle_object));
    },
    DirP: linePoint(createDirectionPoint),
    CnP: (parameters, { c, name, at }) => {
        const [conic, which] = list(parameters, 2);
        check(CONIC_POINTS.includes(which as ConicPoint));
        return createConicPoint(
            c,
            name,
            at(conic, primitive_quadric_object),
            which as ConicPoint,
        );
    },
    PlI: (parameters, { c, name, at }) => {
        const [line, plane] = list(parameters, 2);
        return createPlaneIntersection(
            c,
            name,
            at(line, primitive_line_object),
            at(plane, polygon_object),
        );
    },
    Int: (parameters, { c, name, at }) => {
        const [o1, o2, order, away] = list(parameters, 3, 4);
        check(Number.isInteger(order) && (order as number) >= 0);
        return createOrderedIntersection(
            c,
            name,
            at(o1, ...INTERSECTABLE),
            at(o2, ...INTERSECTABLE),
            order as number,
            away === undefined ? undefined : at(away, point_object),
        );
    },
    CyI: (parameters, { c, name, at }) => {
        const [line, solid, order] = list(parameters, 3);
        check(order === 0 || order === 1);
        return createCylinderIntersection(
            c,
            name,
            at(line, primitive_line_object),
            at(solid, revolution_object, sphere_object),
            order,
        );
    },
    Line: twoPoints(createLine),
    Ray: twoPoints(createRay),
    Seg: twoPoints(createSegment),
    Vec: twoPoints(createVector),
    VecF: (parameters, { c, name }) =>
        createFreeVector(c, name, coordinates(parameters)),
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
    Med: ofSegment(createPerpendicularBisector),
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
    C1: (parameters, reader) => {
        const [center, value, axis] = list(parameters, 2, 3);
        return createCircle1(
            reader.c,
            reader.name,
            reader.at(center, point_object),
            radius(value, reader),
            axis === undefined
                ? undefined
                : reader.at(axis, primitive_line_object, polygon_object),
        );
    },
    CAx: (parameters, { c, name, at }) => {
        const [axis, point] = list(parameters, 2);
        return createAxisCircle(
            c,
            name,
            at(axis, primitive_line_object),
            at(point, point_object),
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
    Arcs: threePoints((c, name, p, q, r) =>
        createArc3pts(c, name, p, q, r, false, true),
    ),
    Secs: threePoints((c, name, p, q, r) =>
        createArc3pts(c, name, p, q, r, true, true),
    ),
    Inv: (parameters, { c, name, at }) => {
        const [index, object, straight] = list(parameters, 2, 3);
        const circle = at(index, primitive_circle_object);
        const source = at(object, point_object, ...TRANSFORMABLE);
        check(
            source instanceof point_object
                ? straight === undefined
                : invertible(source) &&
                      (straight === undefined || straight === 1),
        );
        return createInversion(
            c,
            name,
            circle,
            source as point_object | transformable,
            straight === 1,
        );
    },
    TC: (parameters, { c, name, points }) => {
        check(Array.isArray(parameters) && parameters.length === 4);
        const kind = (parameters as Json[])[3];
        check(isNumber(kind) && [1, 2, 3, 4, 5].includes(kind));
        return createTriangleCenter(
            c,
            name,
            points((parameters as Json[]).slice(0, 3), 3),
            kind as number,
        );
    },
    RegP: (parameters, reader) => {
        const { c, name, at } = reader;
        const [a, b, sides, plane] = list(parameters, 3, 4);
        check(
            isNumber(sides)
                ? Number.isInteger(sides) && sides >= 3
                : sides !== null,
        );
        return createRegularPolygon(
            c,
            name,
            at(a, point_object),
            at(b, point_object),
            radius(sides, reader),
            plane === undefined ? undefined : at(plane, polygon_object),
        );
    },
    Vtx: (parameters, { c, name, at }) => {
        const [polygon, rank, wrap = 0] = list(parameters, 2, 3);
        check(Number.isInteger(rank) && (rank as number) >= 0 && isFlag(wrap));
        return createVertex(
            c,
            name,
            wrap
                ? at(polygon, polygon_object)
                : at(polygon, polygon_object, polyhedron_object),
            rank as number,
            wrap === 1,
        );
    },
    Tan: (parameters, { c, name, at }) => {
        const [point, support, branch] = list(parameters, 2, 3);
        const curve = branch === undefined;
        check(curve || branch === 0 || branch === 1);
        return createTangent(
            c,
            name,
            at(point, point_object),
            curve
                ? at(support, curve_object)
                : at(
                      support,
                      primitive_circle_object,
                      primitive_quadric_object,
                  ),
            curve ? 0 : (branch as number),
        );
    },
    TanX: (parameters, reader) => {
        const [abscissa, curve] = list(parameters, 2);
        return createTangent(
            reader.c,
            reader.name,
            radius(abscissa, reader),
            reader.at(curve, curve_object),
        );
    },
    CArc: centerArc(false),
    CSec: centerArc(true),
    CArcs: threePoints((c, name, m, a, b) =>
        createCenterArc(c, name, m, a, b, false, false, true),
    ),
    CSecs: threePoints((c, name, m, a, b) =>
        createCenterArc(c, name, m, a, b, true, false, true),
    ),
    QArc: conicArc(false),
    QSec: conicArc(true),
    Semi: (parameters, { c, name, at }) => {
        const [a, b, plane] = list(parameters, 2, 3);
        return createSemicircle(
            c,
            name,
            at(a, point_object),
            at(b, point_object),
            plane === undefined ? undefined : at(plane, polygon_object),
        );
    },
    Quad: (parameters, { c, name, points }) => {
        const [p1, p2, p3, p4, p5] = points(parameters, 5);
        return createQuadric5pts(c, name, p1, p2, p3, p4, p5);
    },
    Ell: focalConic(false),
    Ell1: focalConic1(false),
    Hyp: focalConic(true),
    Hyp1: focalConic1(true),
    Prb: (parameters, { c, name, at }) => {
        const [focus, directrix] = list(parameters, 2);
        return createParabola(
            c,
            name,
            at(focus, point_object),
            at(directrix, primitive_line_object),
        );
    },
    EqL: equation(createEquationLine),
    EqC: equation(createEquationCircle),
    EqQ: equation(createEquationConic),
    Sph: twoPoints(createSphere),
    CyS: (parameters, { c, name, at }) => {
        const [solid, plane] = list(parameters, 2);
        return createCylinderSection(
            c,
            name,
            at(solid, revolution_object),
            at(plane, polygon_object),
        );
    },
    Cube: (parameters, { c, name, points }) =>
        createPolyhedron(c, name, {
            tag: "Cube",
            points: points(parameters, 3) as [
                point_object,
                point_object,
                point_object,
            ],
        }),
    CubP: (parameters, { c, name, at }) => {
        const [a, b, plane, side] = list(parameters, 4);
        check(side === 1 || side === -1);
        return createPolyhedron(c, name, {
            tag: "CubP",
            points: [at(a, point_object), at(b, point_object)],
            plane: at(plane, polygon_object),
            side,
        });
    },
    CubZ: (parameters, { c, name, points }) => {
        const [a, b, side] = list(parameters, 3);
        check(side === 1 || side === -1);
        return createPolyhedron(c, name, {
            tag: "CubZ",
            points: points([a, b], 2) as [point_object, point_object],
            side,
        });
    },
    Prsm: onPolygon("Prsm"),
    Pyr: onPolygon("Pyr"),
    PrsH: onPolygon("PrsH"),
    PyrH: onPolygon("PyrH"),
    Net: (parameters, reader) => {
        const [solid, value] = list(parameters, 2);
        return createNet(
            reader.c,
            reader.name,
            reader.at(solid, polyhedron_object),
            radius(value, reader),
        );
    },
    Cyl: revolution(false),
    Cone: revolution(true),
    Disk: (parameters, { c, name, at }) => {
        const [solid, top] = list(parameters, 2);
        check(top === 0 || top === 1);
        return createDisk(c, name, at(solid, revolution_object), top === 1);
    },
    Sph1: (parameters, reader) => {
        const [center, value] = list(parameters, 2);
        return createSphere(
            reader.c,
            reader.name,
            reader.at(center, point_object),
            radius(value, reader),
        );
    },
    Pl: (parameters, { c, name, points }) =>
        createPlane(c, name, {
            tag: "Pl",
            points: points(parameters, 3) as [
                point_object,
                point_object,
                point_object,
            ],
        }),
    PlP: (parameters, { c, name, at }) => {
        const [point, plane] = list(parameters, 2);
        return createPlane(c, name, {
            tag: "PlP",
            point: at(point, point_object),
            plane: at(plane, polygon_object),
        });
    },
    PlL: throughLine("PlL"),
    PlO: throughLine("PlO"),
    PlE: equation(
        (c, name, equation) => createPlane(c, name, { tag: "PlE", equation }),
        ["x", "y", "z"],
    ),
    NetV: (parameters, reader) => {
        check(Array.isArray(parameters) && parameters.length % 4 === 2);
        const [vertex, unfolding, ...ends] = parameters as Json[];
        const points = reader.points(ends, ends.length);
        return createNetVertex(
            reader.c,
            reader.name,
            reader.at(vertex, point_object),
            radius(unfolding, reader),
            points.flatMap((_, index) =>
                index % 4 ? [] : [points.slice(index, index + 4)],
            ) as net_turn[],
        );
    },
    Abv: (parameters, reader) => {
        const [polygon, height, rank] = list(parameters, 3);
        check(Number.isInteger(rank) && (rank as number) >= -1);
        return createAbove(
            reader.c,
            reader.name,
            reader.at(polygon, polygon_object),
            radius(height, reader),
            rank as number,
        );
    },
    CubV: (parameters, { c, name, at }) => {
        const [a, b, third, rank] = list(parameters, 4);
        check(
            Number.isInteger(rank) &&
                (rank as number) >= 0 &&
                (rank as number) < 6,
        );
        return createCubeVertex(
            c,
            name,
            at(a, point_object),
            at(b, point_object),
            at(third, point_object, polygon_object),
            rank as number,
        );
    },
    PlPl: (parameters, { c, name, at }) => {
        const [p, q] = list(parameters, 2);
        return createPlaneLine(c, name, [
            at(p, polygon_object),
            at(q, polygon_object),
        ]);
    },
    Nrm: (parameters, { c, name, at }) => {
        const [plane, point] = list(parameters, 2);
        return createNormalLine(
            c,
            name,
            at(plane, polygon_object),
            at(point, point_object),
        );
    },
    SphC: (parameters, { c, name, at }) => {
        const [sphere, other] = list(parameters, 2);
        return createSphereSection(
            c,
            name,
            at(sphere, sphere_object),
            at(other, polygon_object, sphere_object),
        );
    },
    PlS: (parameters, { c, name, at, points }) => {
        check(
            Array.isArray(parameters) &&
                (parameters.length === 2 ||
                    (parameters.length % 2 === 1 && parameters.length >= 7)),
        );
        const [plane, ...ends] = parameters as Json[];
        if (ends.length === 1)
            return createPlaneSection(
                c,
                name,
                at(plane, polygon_object),
                at(ends[0], polyhedron_object),
            );
        const vertices = points(ends, ends.length);
        return createPlaneSection(
            c,
            name,
            at(plane, polygon_object),
            vertices.flatMap((end, index) =>
                index % 2 ? [] : [[end, vertices[index + 1]]],
            ) as [point_object, point_object][],
        );
    },
    Poly: (parameters, { c, name, points }) => {
        check(Array.isArray(parameters));
        return createPolygon(c, name, points(parameters, parameters.length));
    },
    PolyL: (parameters, { c, name, at }) => {
        const points = at(list(parameters, 1)[0], list_object);
        check(points.nature === "point");
        return createListPolygon(c, name, points);
    },
    Loc: (parameters, { c, name, at }) => {
        const [target, driver] = list(parameters, 2);
        return createLocus(
            c,
            name,
            at(target, point_object, primitive_line_object),
            at(driver, point_on_object),
        );
    },
    Ang: threePoints(createAngle),
    Ex: (parameters, reader) => {
        const { c, name, at, formula: read, vec3, offset } = reader;
        check(isRecord(parameters));
        const {
            t: text,
            v: value,
            f,
            s,
            g,
            mu,
            mn = null,
            mx = null,
        } = parameters;
        check(typeof text === "string");
        check(g === undefined || typeof g === "string");
        check(
            mu === undefined ||
                (Array.isArray(mu) &&
                    mu.length > 0 &&
                    mu.every((choice) => typeof choice === "string")),
        );
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
        } else if (s !== undefined) program = scriptProgram(reader, s);
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
        expression.global = (g as string | undefined) ?? null;
        expression.menu = (mu as string[] | undefined) ?? null;
        if (anchored) {
            expression.anchor = at(parameters.on, point_object);
            expression.alpha = screen;
            expression.addParents(expression.anchor);
        }
        return expression;
    },
    Cur: (parameters, { c, name, formula, vec3 }) => {
        const [value, min, max] = list(parameters, 3);
        const read = (value: Json, variables: string[]): ExpressionFormula => {
            const { source, refs } = formula(value, construction_object);
            const node = parseFormula(source);
            checkNames(formulaIdentifiers(node), refs, variables);
            return { node, source, variables, refs, vec3 };
        };
        const bound = (value: Json) =>
            value === null || isNumber(value) ? value : read(value, []);
        return createCurve(c, name, read(value, ["x"]), bound(min), bound(max));
    },
    Reg: (parameters, { c, name, formula, vec3 }) => {
        const { source, refs } = formula(parameters, construction_object);
        const node = parseFormula(source);
        checkNames(formulaIdentifiers(node), refs, ["x", "y"]);
        return createRegion(c, name, {
            node,
            source,
            variables: ["x", "y"],
            refs,
            vec3,
        });
    },
    Lst: (parameters, reader) => {
        check(Array.isArray(parameters));
        const [nature, count, ...formulas] = list(
            parameters,
            3,
            ONE_FORMULA.includes(parameters[0]) ? 3 : 4,
        );
        check(LIST_NATURES.includes(nature as string));
        check(formulas.length === (ONE_FORMULA.includes(nature) ? 1 : 2));
        const refs = new Map<string, construction_object>();
        return createList(
            reader.c,
            reader.name,
            nature as ListNature,
            listFormula(reader, count, refs),
            formulas.map((formula) => listFormula(reader, formula, refs)),
            refs,
            reader.vec3,
        );
    },
    // Each variable read by the loops inside its own and the formulas.
    Seq: (parameters, reader) => {
        const [nature, loops, ...formulas] = list(parameters, 3, Infinity);
        check(
            sequenceShape(nature, formulas.length) &&
                Array.isArray(loops) &&
                loops.length > 0,
        );
        const refs = new Map<string, construction_object>();
        const variables: string[] = [];
        const read = (value: Json) =>
            listFormula(reader, value, refs, variables);
        const parsed = loops.map((loop) => {
            const [variable, from, to, step] = list(loop, 3, 4);
            check(
                typeof variable === "string" &&
                    SEQUENCE_VARIABLE.test(variable) &&
                    !variables.includes(variable),
            );
            const bounds = {
                variable,
                from: read(from),
                to: read(to),
                step: step === undefined ? null : read(step),
            };
            variables.push(variable);
            return bounds;
        });
        return createSequence(
            reader.c,
            reader.name,
            nature as ListNature,
            parsed,
            formulas.map(read),
            refs,
            reader.vec3,
        );
    },
    // A list in it is an array of its items, a formula being a text, or an
    // array of a text and an object, its refs.
    Pts: (parameters, reader) => {
        const refs = new Map<string, construction_object>();
        const tree = (value: Json): ListTree =>
            Array.isArray(value) &&
            (typeof value[1] !== "object" || Array.isArray(value[1]))
                ? list(value, 1, Infinity).map(tree)
                : listFormula(reader, value, refs, []);
        return createPointList(
            reader.c,
            reader.name,
            list(parameters, 1, Infinity).map(tree),
            refs,
            reader.vec3,
        );
    },
    Fl: (parameters, reader) => {
        const refs = new Map<string, construction_object>();
        return createPointList(
            reader.c,
            reader.name,
            listFormula(reader, list(parameters, 1)[0], refs, []),
            refs,
            reader.vec3,
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
    Btn: (parameters, reader) => {
        check(isRecord(parameters));
        const { t: label, s, xy } = parameters;
        check(typeof label === "string" && isPair(xy));
        return createButton(
            reader.c,
            reader.name,
            label,
            [xy[0] + reader.offset[0], xy[1] + reader.offset[1]],
            s === undefined ? null : scriptProgram(reader, s),
        );
    },
    Evt: (parameters, reader) => {
        check(isRecord(parameters) && parameters.s !== undefined);
        const { e } = parameters;
        check(
            e === undefined ||
                e === "drag" ||
                e === "down" ||
                e === "up" ||
                e === "init",
        );
        return createEvent(
            reader.c,
            reader.name,
            e === "init"
                ? reader.at(parameters.on, expression_object, button_object)
                : e === "down"
                  ? reader.at(parameters.on, point_object, text_object)
                  : reader.at(
                        parameters.on,
                        e ? point_object : expression_object,
                    ),
            scriptProgram(reader, parameters.s),
            e ?? null,
        );
    },
    Html: (parameters, { c, name, formula, offset, vec3 }) => {
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
            vec3,
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
    Img: (parameters, { c, name, points, images, offset }) => {
        check(Array.isArray(parameters));
        const [key, width, height, ...corners] = list(parameters, 4, 6);
        const url =
            typeof key === "string" && own(images, key) ? images[key] : null;
        check(typeof url === "string" && IMAGE_URL.test(url));
        check(isNumber(width) && width > 0 && isNumber(height) && height > 0);
        const [screen] = corners;
        const fixed = Array.isArray(screen);
        const image = createImage(
            c,
            name,
            url,
            width,
            height,
            fixed ? [] : points(corners, corners.length),
        );
        if (fixed) {
            check(isPair(screen) && corners.length === 1);
            image.screen = [screen[0] + offset[0], screen[1] + offset[1]];
        }
        return image;
    },
    Mac: (parameters, reader) => {
        const { c, name, at, macros } = reader;
        const [index, rank, values, extra] = list(parameters, 3, 4);
        check(Number.isInteger(index) && Number.isInteger(rank));
        const method = macros[index as number]?.methods[rank as number];
        check(method !== undefined);
        const types = method.initials.map(([type]) => type);
        const initials = list(values, types.length).map((value, i) =>
            types[i] === "number" && typeof value === "string"
                ? value
                : at(value, construction_object),
        );
        const source = initials.at(-1)!;
        initials
            .slice(0, -1)
            .forEach((initial, i) =>
                check(
                    typeof initial === "string" ||
                        MACRO_TYPES[types[i]](initial),
                ),
            );
        // A transformation macro's image of an object, of the look found
        // when it was applied (see TRANSFORMATIONS.md).
        if (
            types.at(-1) === "point" &&
            method.finals.length === 1 &&
            typeof source !== "string" &&
            !(source instanceof point_object)
        ) {
            check(
                invertible(source) &&
                    imageLooks(source as transformable).includes(
                        extra as string,
                    ),
            );
            const template = new construction_object(c, null, "expression");
            template.addParents(
                ...initials.filter(
                    (initial): initial is construction_object =>
                        typeof initial !== "string",
                ),
            );
            template.dgo = (context) => [
                "Mac",
                [
                    index,
                    rank,
                    initials.map((initial) =>
                        typeof initial === "string"
                            ? initial
                            : context.index(initial),
                    ),
                    extra,
                ],
            ];
            return createTransformed(
                c,
                name,
                source as transformable,
                (point) => {
                    const node = application(
                        reader,
                        null,
                        index as number,
                        rank as number,
                        [...initials.slice(0, -1), point],
                    );
                    node.parents.forEach(
                        (parent) =>
                            (parent.children = parent.children.filter(
                                (child) => child !== node,
                            )),
                    );
                    check(node.finals[0] instanceof point_object);
                    return new applied_point(c, node, point);
                },
                { look: extra as string, template },
            );
        }
        check(
            typeof source === "string"
                ? types.at(-1) === "number"
                : MACRO_TYPES[types.at(-1)!](source),
        );
        const node = c.add(
            application(
                reader,
                name,
                index as number,
                rank as number,
                initials,
            ),
        );
        if (extra !== undefined) setBranches(node, extra);
        return node;
    },
    Out: (parameters, { c, name, at }) => {
        const [index, rank, alpha] = list(parameters, 2, 3);
        const node = at(index, macro_object);
        check(Number.isInteger(rank));
        // Perhaps adopted in the body already, from an application there.
        const final = node.finals[(rank as number) - 1];
        check(final !== undefined && final.output?.node !== node);
        final.output = {
            node,
            rank: rank as number,
            tag: node.finalTags[(rank as number) - 1],
        };
        final.name = name;
        final.parents = [];
        final.addParents(node);
        // But along its support, where it was moved to.
        if (final instanceof point_on_object) {
            if (alpha !== undefined)
                final.alpha = onParameter(final.support, alpha);
        } else {
            check(alpha === undefined);
            if (final instanceof point_object) final.moveable = false;
        }
        return c.add(final);
    },
};
