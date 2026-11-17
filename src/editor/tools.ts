import type { Gesture } from "../construction";
import type { construction_object } from "../objects/construction_object";
import { expression_object } from "../objects/expression_object";
import { point_on_object } from "../objects/point_on_object";
import { point_object } from "../objects/point_object";
import { curve_object } from "../objects/curve_object";
import { image_object } from "../objects/image_object";
import { locus_object } from "../objects/locus_object";
import { polygon_object } from "../objects/polygon_object";
import { primitive_circle_object } from "../objects/primitive_circle_object";
import { primitive_line_object } from "../objects/primitive_line_object";
import { primitive_quadric_object } from "../objects/primitive_quadric_object";
import { text_object } from "../objects/text_object";
import {
    accepts,
    commandName,
    COMMANDS,
    crossable,
    meet,
    otherView,
    TANGENT_TOOL,
    type Arg,
    type Command,
    type Overload,
} from "./catalog";
import { ACTION_ICONS } from "./icons";
import { CONSTRUCTION_ICONS } from "./construction_icons";
import { initialType } from "./macro";
import type { Macro } from "../objects/macro_object";
import { message, type MessageKey } from "./messages";

// The tools shown around a designated object: see EDITOR.md.

export interface Tool {
    // The command, whose arguments are designated one after the other; or a
    // point put on the object or an intersection, where it was designated;
    // or a program to write, of a turtle from a point, of a button put
    // there, or answering the object designated; or a control put there, a
    // checkbox after the objects it shows; or a macro to define, or on the
    // ring, those of the figure that take the object.
    mode:
        | "command"
        | "point"
        | "intersection"
        | "turtle"
        | "button"
        | "control"
        | "event"
        | "macro"
        | "macros";
    // The event's, null for the change of an expression's value.
    gesture?: Gesture | null;
    command: Command;
    overload: Overload;
    icon: string;
    // Its place on the ring, clockwise from the top, in buttons.
    slot: number;
    family: Family;
    // Its name, when its command has more than one item.
    label?: MessageKey;
    // A point's, made also in the void or where two objects cross.
    anywhere?: boolean;
}

export interface Family {
    name: MessageKey;
    hue: number;
    // The saturation, relative to the other families'.
    tone: number;
    first: number;
    last: number;
    // In the tools' menu.
    items: Item[];
}

// A tool of the menu: those of a place of the ring that write the same
// command, the objects designated choosing one.
export interface Item {
    tools: Tool[];
}

const dot = (x: number, y: number) =>
    `<circle cx="${x}" cy="${y}" r="1.8" fill="currentColor" stroke="none"/>`;
const path = (d: string, guide = false) =>
    `<path d="${d}"${guide ? ' class="dge-guide"' : ""}/>`;
const result = (icon: string) => `<g class="dge-result">${icon}</g>`;
const accent = (icon: string) => `<g class="dge-accent">${icon}</g>`;

function tool(
    name: string,
    overload: number,
    icon: string,
    mode: Tool["mode"] = "command",
): Tool {
    const command = COMMANDS.find((candidate) => candidate.name === name)!;
    return {
        mode,
        command,
        overload: command.overloads[overload],
        icon,
    } as Tool;
}

// The tools of a command's first forms, together in one item.
const forms = (name: string, count: number, icon: string): Tool[] =>
    Array.from({ length: count }, (_, overload) => tool(name, overload, icon));

// The tool of an item of its own among its command's.
const labelled = (label: MessageKey, tool: Tool): Tool =>
    Object.assign(tool, { label });

// The program of the gesture on a point (a click on a text), or of the
// change of an expression's value (see startEvent in main.ts).
const event = (label: MessageKey, gesture: Gesture | null, icon: string) =>
    Object.assign(labelled(label, tool("List", 0, icon, "event")), {
        gesture,
    });

// The families of tools, clockwise from the first one, centred on the top,
// each tool keeping its place whatever the object, so that the hand learns
// it; the tools of a slot never show together. Others are only in the menu,
// as the programs, which the ring's geometry leaves out.
const FAMILIES: [
    name: MessageKey,
    hue: number,
    slots: Tool[][],
    // The forms of one item together.
    menuOnly?: (Tool | Tool[])[],
    tone?: number,
][] = [
    [
        "family_points",
        35,
        [
            [
                labelled(
                    "tool_point_on",
                    tool("Point", 0, CONSTRUCTION_ICONS.PointOn, "point"),
                ),
            ],
            [
                tool(
                    "Intersection",
                    1,
                    CONSTRUCTION_ICONS.Intersection,
                    "intersection",
                ),
            ],
            [
                tool("Midpoint", 0, CONSTRUCTION_ICONS.Midpoint),
                tool("Midpoint", 1, CONSTRUCTION_ICONS.Midpoint),
                tool("Center", 0, CONSTRUCTION_ICONS.Center),
            ],
        ],
        [
            tool("OtherIntersection", 0, CONSTRUCTION_ICONS.OtherIntersection),
            // The centers of a triangle, of its three vertices.
            tool("Incenter", 0, CONSTRUCTION_ICONS.Incenter),
            tool("Centroid", 0, CONSTRUCTION_ICONS.Centroid),
            tool("Circumcenter", 0, CONSTRUCTION_ICONS.Circumcenter),
            tool("Orthocenter", 0, CONSTRUCTION_ICONS.Orthocenter),
        ],
    ],
    [
        "family_lines",
        215,
        [
            [tool("Segment", 0, CONSTRUCTION_ICONS.Segment)],
            [tool("Line", 0, CONSTRUCTION_ICONS.Line)],
            [tool("Ray", 0, CONSTRUCTION_ICONS.Ray)],
            [tool("Vector", 0, CONSTRUCTION_ICONS.Vector)],
        ],
    ],
    [
        "family_constructions",
        265,
        [
            [0, 2].map((overload) =>
                tool(
                    "Perpendicular",
                    overload,
                    CONSTRUCTION_ICONS.Perpendicular,
                ),
            ),
            [tool("Parallel", 0, CONSTRUCTION_ICONS.Parallel)],
            [
                tool(
                    "PerpendicularBisector",
                    0,
                    CONSTRUCTION_ICONS.PerpendicularBisector,
                ),
                tool(
                    "PerpendicularBisector",
                    1,
                    CONSTRUCTION_ICONS.PerpendicularBisector,
                ),
            ],
            [tool("AngleBisector", 0, CONSTRUCTION_ICONS.AngleBisector)],
        ],
        [
            Object.assign(tool("Tangent", 0, CONSTRUCTION_ICONS.Tangent), {
                overload: TANGENT_TOOL,
            }),
        ],
    ],
    [
        "family_circles",
        145,
        [
            [
                labelled(
                    "tool_circle_point",
                    tool("Circle", 0, CONSTRUCTION_ICONS.CirclePoint),
                ),
            ],
            [
                labelled(
                    "tool_circle_radius",
                    tool("Circle", 1, CONSTRUCTION_ICONS.CircleRadius),
                ),
            ],
            [
                tool("Circumcircle", 0, CONSTRUCTION_ICONS.Circumcircle),
                tool("Circumcircle", 1, CONSTRUCTION_ICONS.Circumcircle),
            ],
            [tool("Sphere", 0, CONSTRUCTION_ICONS.Sphere)],
        ],
        [
            // The radius of the first two points, the centre the third.
            tool("Compass", 0, CONSTRUCTION_ICONS.Compass),
            // In space: the center, then a line or a plane, the radius
            // given; the axis, then a point.
            labelled(
                "tool_circle_direction",
                tool("Circle", 2, CONSTRUCTION_ICONS.CircleDirection),
            ),
            labelled(
                "tool_circle_axis",
                tool("Circle", 3, CONSTRUCTION_ICONS.CircleAxis),
            ),
            // Three points, in the plane or in space, or a conic then two
            // points.
            forms("Arc", 3, CONSTRUCTION_ICONS.Arc),
            forms("Sector", 3, CONSTRUCTION_ICONS.Sector),
            // The center, the start, then a point of the ray where it ends.
            forms("CenterArc", 2, CONSTRUCTION_ICONS.CenterArc),
            forms("CenterSector", 2, CONSTRUCTION_ICONS.CenterSector),
            tool("Semicircle", 0, CONSTRUCTION_ICONS.Semicircle),
            tool("Conic", 0, CONSTRUCTION_ICONS.Conic),
            // Its foci, then a point.
            tool("Ellipse", 0, CONSTRUCTION_ICONS.Ellipse),
            tool("Hyperbola", 0, CONSTRUCTION_ICONS.Hyperbola),
            // Its focus, then its directrix.
            tool("Parabola", 0, CONSTRUCTION_ICONS.Parabola),
        ],
    ],
    [
        "family_shapes",
        185,
        [
            [tool("Polygon", 0, CONSTRUCTION_ICONS.Polygon)],
            [tool("Angle", 0, CONSTRUCTION_ICONS.Angle)],
            [tool("Locus", 0, CONSTRUCTION_ICONS.Locus)],
        ],
        [
            // Two vertices: a square, which the line changes.
            tool("RegularPolygon", 0, CONSTRUCTION_ICONS.RegularPolygon),
        ],
    ],
    [
        "family_transformations",
        320,
        [
            [
                labelled(
                    "tool_central",
                    tool("Reflect", 0, CONSTRUCTION_ICONS.ReflectPoint),
                ),
            ],
            [
                labelled(
                    "tool_axial",
                    tool("Reflect", 1, CONSTRUCTION_ICONS.ReflectLine),
                ),
            ],
        ],
        [
            // The center, then the point: a quarter turn, which the line
            // changes.
            tool("Rotation", 0, CONSTRUCTION_ICONS.Rotation),
            // The vector, then the point.
            tool("Translation", 0, CONSTRUCTION_ICONS.Translation),
            // The center, then the point: a ratio of 2.
            tool("Dilation", 0, CONSTRUCTION_ICONS.Dilation),
            // The circle, then the point.
            tool("Inversion", 0, CONSTRUCTION_ICONS.Inversion),
        ],
    ],
    [
        "family_planes",
        240,
        [],
        [
            // Three points, or a line designated first and a point.
            [
                tool("Plane", 0, CONSTRUCTION_ICONS.Plane),
                tool("Plane", 1, CONSTRUCTION_ICONS.Plane),
            ],
            tool("ParallelPlane", 0, CONSTRUCTION_ICONS.ParallelPlane),
            tool("OrthogonalPlane", 0, CONSTRUCTION_ICONS.OrthogonalPlane),
        ],
    ],
    [
        "family_solids",
        265,
        [],
        [
            // Two points of the axis, then a radius the line changes.
            tool("Cylinder", 0, CONSTRUCTION_ICONS.Cylinder),
            tool("Cone", 0, CONSTRUCTION_ICONS.Cone),
            // Two points, and a third of the face's plane unless they are
            // on a plane or at one height.
            tool("Tetrahedron", 0, CONSTRUCTION_ICONS.Tetrahedron),
            tool("Cube", 0, CONSTRUCTION_ICONS.Cube),
            tool("Octahedron", 0, CONSTRUCTION_ICONS.Octahedron),
            tool("Dodecahedron", 0, CONSTRUCTION_ICONS.Dodecahedron),
            tool("Icosahedron", 0, CONSTRUCTION_ICONS.Icosahedron),
            // The base, then the first top vertex or the apex.
            tool("Prism", 0, CONSTRUCTION_ICONS.Prism),
            tool("Pyramid", 0, CONSTRUCTION_ICONS.Pyramid),
            // The solid, whichever it is, and the plane.
            tool("Section", 3, CONSTRUCTION_ICONS.Section),
            // Flat, the number then unfolding it.
            tool("Net", 0, CONSTRUCTION_ICONS.Net),
        ],
    ],
    [
        "family_controls",
        65,
        [],
        [
            tool(
                "Slider",
                0,
                path("M3 12h18") + accent(`<circle cx="15" cy="12" r="3.5"/>`),
                "control",
            ),
            tool(
                "Checkbox",
                0,
                `<rect x="4" y="4" width="16" height="16" rx="3"/>` +
                    accent(path("m8 12 3 3 5-6")),
                "control",
            ),
            tool(
                "Menu",
                0,
                path("M6 18h12") +
                    `<rect x="3" y="5" width="18" height="8" rx="2"/>` +
                    accent(path("m14 8 2 2 2-2")),
                "control",
            ),
            tool(
                "InputField",
                0,
                `<rect x="3" y="7" width="18" height="10" rx="2"/>` +
                    accent(path("M8 10v4")),
                "control",
            ),
            tool("Text", 0, path("M5 6h14M12 6v14"), "control"),
            tool(
                "Image",
                1,
                `<rect x="3" y="5" width="18" height="14" rx="2"/>` +
                    accent(path("m5 17 5-6 4 4 2-2 3 4")) +
                    dot(16, 9),
                "control",
            ),
        ],
    ],
    [
        "family_programs",
        95,
        [],
        [
            // The list it draws (see openTurtle in main.ts).
            labelled("turtle", tool("List", 0, ACTION_ICONS.turtle, "turtle")),
            tool(
                "Button",
                0,
                path("M2 12h6") +
                    `<rect x="11" y="7" width="11" height="10" rx="3"/>` +
                    accent(
                        `<path d="M15 9.8v4.4l3.4-2.2Z" fill="currentColor"/>`,
                    ),
                "button",
            ),
            event(
                "when_dragged",
                "drag",
                path("M4 20l7-7M6 13h5v5") +
                    accent(`<circle cx="16" cy="8" r="3"/>`),
            ),
            event(
                "when_pressed",
                "down",
                path("M12 2v9m-3-3 3 3 3-3") +
                    accent(`<circle cx="12" cy="17" r="3"/>`),
            ),
            event(
                "when_released",
                "up",
                path("M12 11V2M9 5l3-3 3 3") +
                    accent(`<circle cx="12" cy="17" r="3"/>`),
            ),
            event(
                "when_changed",
                null,
                path("M4 9h14l-3-3") + accent(path("M20 15H6l3 3")),
            ),
        ],
    ],
    [
        "family_macros",
        0,
        // The figure's macros that take the object (see showRingMacros in
        // main.ts), only on the ring.
        [
            [
                labelled(
                    "family_macros",
                    tool(
                        "List",
                        0,
                        path("M4 6h16v12H4Z") +
                            result(dot(9, 12) + dot(15, 12)),
                        "macros",
                    ),
                ),
            ],
        ],
        [
            // Defined from the figure (see startMacro in main.ts).
            labelled(
                "new_macro",
                tool(
                    "List",
                    0,
                    path("M3 4h18v16H3Z", true) +
                        result(path("M7 16 12 8l5 8Z")) +
                        dot(7, 16) +
                        dot(17, 16),
                    "macro",
                ),
            ),
        ],
        0.8,
    ],
];

// A macro's icon, drawn from its figure or chosen by its author, or a box.
export const macroIcon = ({ icon }: Pick<Macro, "icon">): string =>
    icon
        ? `<image href="${icon}" x="2" y="2" width="20" height="20"/>`
        : path("M4 6h16v12H4Z") + result(dot(9, 12) + dot(15, 12));

// Between two families, in buttons.
const GAP = 0.45;

export const TOOLS: Tool[] = [];
export const TOOL_FAMILIES: Family[] = [];
const start = (1 - FAMILIES[0][2].length) / 2;
let slot = start;
for (const [name, hue, slots, menuOnly = [], tone = 1] of FAMILIES) {
    const family: Family = {
        name,
        hue,
        tone,
        first: slot,
        last: slot + slots.length - 1,
        items: [],
    };
    TOOL_FAMILIES.push(family);
    for (const tools of slots) {
        for (const tool of tools) {
            TOOLS.push(Object.assign(tool, { slot, family }));
            if (tool.mode === "macros") continue;
            const item = family.items.find(
                ({ tools: [first] }) =>
                    first.slot === slot && first.command === tool.command,
            );
            if (item) item.tools.push(tool);
            else family.items.push({ tools: [tool] });
        }
        slot++;
    }
    // A family only in the menu takes no room on the ring.
    if (!slots.length) slot -= GAP;
    for (const tools of menuOnly)
        family.items.push({
            tools: [tools]
                .flat()
                .map((tool) => Object.assign(tool, { slot: -1, family })),
        });
    slot += GAP;
}
// The ring's circumference, in buttons.
export const RING_SLOTS = slot - start;

// The sphere keeps its ring slot among circles, but is listed with solids.
const circles = TOOL_FAMILIES.find(({ name }) => name === "family_circles")!;
const sphere = circles.items.findIndex(
    ({ tools: [tool] }) => tool.command.name === "Sphere",
);
TOOL_FAMILIES.find(({ name }) => name === "family_solids")!.items.unshift(
    ...circles.items.splice(sphere, 1),
);

// Only in the menu, the point made anywhere leads the points: the ring's is
// put on its object.
const points = TOOL_FAMILIES[0];
points.items.unshift({
    tools: [
        Object.assign(tool("Point", 0, CONSTRUCTION_ICONS.Point, "point"), {
            slot: -1,
            family: points,
            anywhere: true,
        }),
    ],
});

// The circle and the arcs through three points, the arcs of a center are
// in their plane in space, the perpendicular there to a line or a plane;
// the sphere, the circles around an axis, the tools taking a plane, the
// planes and the solids only there.
export const usable = (
    { command, overload: { tag, params }, family }: Tool,
    vec3: boolean,
): boolean =>
    !otherView(tag, vec3) &&
    (command.name !== "Perpendicular" || !tag === vec3) &&
    (vec3 ||
        (!["Sph", "CAx"].includes(tag) &&
            !params.includes("linear") &&
            !SPACE.includes(family.name)));

const SPACE = ["family_planes", "family_solids"];

export const itemLabel = ({ tools: [tool] }: Item): string =>
    tool.label ? message(tool.label) : commandName(tool.command);

// What a program may answer the click on (see event_object.ts), but a
// point.
export const clickable = (object: construction_object): boolean =>
    [
        text_object,
        polygon_object,
        primitive_line_object,
        primitive_circle_object,
        primitive_quadric_object,
        curve_object,
        locus_object,
        image_object,
    ].some((kind) => object instanceof kind);

// The point a turtle starts from, the point dragged, the text or shape
// clicked or the expression whose value changes that a program answers.
function answers({ mode, gesture }: Tool, object: construction_object) {
    if (mode === "turtle") return object instanceof point_object;
    if (gesture === "down" && clickable(object)) return true;
    return gesture
        ? object instanceof point_object && object.moveable
        : object instanceof expression_object && !object.program;
}

// The tools that take the object as one of their arguments.
export function toolsFor(
    object: construction_object,
    vec3: boolean,
    tools = TOOLS,
): Tool[] {
    return tools.filter((tool) => {
        const { mode, overload } = tool;
        if (!usable(tool, vec3)) return false;
        if (overload.tag === "Loc") return driverOf(object) !== null;
        // A point is put on the object, an intersection with another.
        if (mode === "point") return accepts(object, "support");
        if (mode === "turtle" || mode === "event") return answers(tool, object);
        if (mode === "control") return tool.command.name === "Checkbox";
        if (mode === "macros") return true;
        if (mode === "intersection") return crossable(object);
        // A radius is given by the tool, not designated.
        return overload.params.some(
            (param) => param !== "real" && accepts(object, param),
        );
    });
}

// The point on an object that moves the point or the line, the last built of
// its ancestors, as in DGPad: its path gives the locus. A surface isn't a path.
export function driverOf(object: construction_object): point_on_object | null {
    if (!accepts(object, "traced")) return null;
    let driver: point_on_object | null = null;
    const seen = new Set<construction_object>();
    const visit = (parent: construction_object): void => {
        if (seen.has(parent)) return;
        seen.add(parent);
        if (
            parent instanceof point_on_object &&
            !accepts(parent.support, "surface") &&
            (!driver || parent.sequence > driver.sequence)
        )
            driver = parent;
        parent.parents.forEach(visit);
    };
    object.parents.forEach(visit);
    return driver;
}

// The arguments of a tool, none designated yet.
export const emptyArgs = ({ mode, overload }: Tool): (Arg | undefined)[] =>
    mode !== "command" || overload.variadic
        ? []
        : Array(overload.params.length).fill(undefined);

// The tool's arguments, the objects taking in their order the first places
// that accept them, its number given (a circle's radius, an angle, a
// ratio); null if one fits nowhere.
export function assign(
    tool: Tool,
    objects: construction_object[],
    real?: number,
): (Arg | undefined)[] | null {
    const { mode, overload } = tool;
    if (mode === "point")
        return objects.length === 1 && accepts(objects[0], "support")
            ? [...objects]
            : null;
    if (mode === "turtle" || mode === "event")
        return objects.length === 1 && answers(tool, objects[0])
            ? [...objects]
            : null;
    // A button or a control takes no object, the selection ignored or what
    // the checkbox shows (see take in main.ts).
    if (mode === "button" || mode === "control") return [];
    // The objects selected are the initials.
    if (mode === "macro")
        return objects.every((object) => initialType(object))
            ? [...objects]
            : null;
    if (mode === "intersection")
        return objects.length <= 2 &&
            objects.every(crossable) &&
            (!objects[1] || meet(objects[0], objects[1]))
            ? [...objects]
            : null;
    if (overload.tag === "Loc") {
        const driver = objects.length === 1 && driverOf(objects[0]);
        return driver ? [objects[0], driver] : null;
    }
    if (overload.variadic)
        return objects.every((object) => accepts(object, overload.params[0]))
            ? [...objects]
            : null;
    const args = emptyArgs(tool);
    for (const object of objects) {
        const slot = overload.params.findIndex(
            (param, index) =>
                args[index] === undefined && accepts(object, param),
        );
        if (slot < 0) return null;
        args[slot] = object;
    }
    const at = overload.params.findIndex(
        (param) => param === "real" || param === "number",
    );
    if (at >= 0) args[at] ??= real;
    return args;
}
