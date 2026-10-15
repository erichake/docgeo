import type { construction_object } from "../objects/construction_object";
import { point_on_object } from "../objects/point_on_object";
import { point_object } from "../objects/point_object";
import {
    accepts,
    commandName,
    COMMANDS,
    type Arg,
    type Command,
    type Overload,
} from "./catalog";
import { message, type MessageKey } from "./messages";

// The tools shown around a designated object: see EDITOR.md.

export interface Tool {
    // The command, whose arguments are designated one after the other; or a
    // point put on the object or an intersection, where it was designated.
    mode: "command" | "point" | "intersection";
    command: Command;
    overload: Overload;
    icon: string;
    // Its place on the ring, clockwise from the top, in buttons.
    slot: number;
    family: Family;
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

const SEGMENT = result(path("M6 18L18 6")) + dot(6, 18) + dot(18, 6);
const TRIANGLE =
    path("M4 19L20 19L9 5Z") + dot(4, 19) + dot(20, 19) + dot(9, 5);
const BISECTOR =
    path("M4 12h16M8 10.5v3M16 10.5v3", true) + result(path("M12 4v16"));
const CIRCLE = `<circle cx="12" cy="12" r="7.5"/>`;
const CIRCLE3 = result(CIRCLE) + dot(4.5, 12) + dot(16.5, 18) + dot(16.5, 6);
const MIDPOINT = path("M5 12h14", true) + result(dot(12, 12));

// The families of tools, clockwise from the first one, centred on the top,
// each tool keeping its place whatever the object, so that the hand learns
// it; the tools of a slot never show together. Others are only in the menu.
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
                tool(
                    "Point",
                    0,
                    path("M3 16Q12 2 21 16", true) + result(dot(12, 9)),
                    "point",
                ),
            ],
            [
                tool(
                    "Intersection",
                    1,
                    path("M4 20L20 4M4 4L20 20", true) + result(dot(12, 12)),
                    "intersection",
                ),
            ],
            [
                tool("Midpoint", 0, MIDPOINT + dot(5, 12) + dot(19, 12)),
                tool("Midpoint", 1, MIDPOINT),
                tool("Center", 0, CIRCLE + result(dot(12, 12))),
            ],
        ],
        [
            tool(
                "OtherIntersection",
                0,
                path("M2 12h20", true) +
                    `<circle class="dge-guide" cx="12" cy="12" r="7"/>` +
                    dot(5, 12) +
                    result(dot(19, 12)),
            ),
            // The centers of a triangle, of its three vertices.
            tool(
                "Incenter",
                0,
                TRIANGLE +
                    `<circle class="dge-guide" cx="10.5" cy="14.4" r="4.6"/>` +
                    result(dot(10.5, 14.4)),
            ),
            tool(
                "Centroid",
                0,
                TRIANGLE +
                    path("M4 19L14.5 12M20 19L6.5 12M9 5L12 19", true) +
                    result(dot(11, 14.3)),
            ),
            tool(
                "Circumcenter",
                0,
                TRIANGLE +
                    `<circle class="dge-guide" cx="12" cy="14" r="9.4"/>` +
                    result(dot(12, 14)),
            ),
            tool(
                "Orthocenter",
                0,
                TRIANGLE +
                    path("M9 5V19M4 19L14.5 10.8", true) +
                    result(dot(9, 15.1)),
            ),
        ],
    ],
    [
        "family_lines",
        215,
        [
            [tool("Segment", 0, SEGMENT)],
            [
                tool(
                    "Line",
                    0,
                    result(path("M3 21L21 3")) + dot(7, 17) + dot(17, 7),
                ),
            ],
            [
                tool(
                    "Ray",
                    0,
                    result(path("M6 18L21 3")) + dot(6, 18) + dot(14, 10),
                ),
            ],
            [
                tool(
                    "Vector",
                    0,
                    result(path("M6 18L19 5M13.5 5H19v5.5")) + dot(6, 18),
                ),
            ],
        ],
    ],
    [
        "family_constructions",
        265,
        [
            [
                tool(
                    "Perpendicular",
                    0,
                    path("M3 18h18M12 14h4v4", true) +
                        result(path("M12 4v16")) +
                        dot(12, 7),
                ),
            ],
            [
                tool(
                    "Parallel",
                    0,
                    path("M4 16L16 4", true) +
                        result(path("M8 20L20 8")) +
                        dot(14, 14),
                ),
            ],
            [
                tool(
                    "PerpendicularBisector",
                    0,
                    BISECTOR + dot(4, 12) + dot(20, 12),
                ),
                tool("PerpendicularBisector", 1, BISECTOR),
            ],
            [
                tool(
                    "AngleBisector",
                    0,
                    path("M4 19h16M4 19L13 4", true) +
                        result(path("M4 19L20 10")) +
                        path("M10 19a6 6 0 0 0-3-5.2", true),
                ),
            ],
        ],
        [
            // The point, then a circle or a conic (the first tangent, which
            // the line changes), or a function's curve.
            [0, 1].map((overload) =>
                tool(
                    "Tangent",
                    overload,
                    `<circle cx="11" cy="15" r="6"/>` +
                        result(path("M2 9H22")) +
                        dot(19, 9),
                ),
            ),
        ],
    ],
    [
        "family_circles",
        145,
        [
            [
                tool(
                    "Circle",
                    0,
                    result(CIRCLE) +
                        path("M12 12L18 7.5", true) +
                        dot(12, 12) +
                        dot(18, 7.5),
                ),
            ],
            [
                tool(
                    "Circle",
                    1,
                    result(`<circle cx="9.5" cy="14.5" r="7"/>`) +
                        path("M9.5 14.5h7", true) +
                        dot(9.5, 14.5) +
                        `<text x="15.5" y="9" font-size="12" font-family="Georgia, serif" font-style="italic" fill="currentColor" stroke="none">r</text>`,
                ),
            ],
            [
                tool("Circumcircle", 0, CIRCLE3),
                tool("Circumcircle", 1, CIRCLE3),
            ],
            [
                tool(
                    "Sphere",
                    0,
                    result(
                        CIRCLE +
                            `<ellipse class="dge-guide" cx="12" cy="12" rx="7.5" ry="3"/>`,
                    ) + dot(12, 12),
                ),
            ],
        ],
        [
            // The radius of the first two points, the centre the third.
            tool(
                "Compass",
                0,
                path("M3 20h7", true) +
                    dot(3, 20) +
                    dot(10, 20) +
                    result(`<circle cx="15" cy="10" r="6"/>`) +
                    dot(15, 10),
            ),
            tool(
                "Arc",
                0,
                result(path("M4 17A8 8 0 0 1 20 17")) +
                    dot(4, 17) +
                    dot(12, 9) +
                    dot(20, 17),
            ),
            tool(
                "Sector",
                0,
                result(
                    `<path d="M6 18H18A12 12 0 0 0 6 6Z" fill="currentColor" fill-opacity=".1"/>`,
                ) +
                    dot(18, 18) +
                    dot(14.5, 9.5) +
                    dot(6, 6),
            ),
            // The center, the start, then a point of the ray where it ends.
            tool(
                "CenterArc",
                0,
                path("M6 18L14 4.1", true) +
                    result(path("M18 18A12 12 0 0 0 12 7.6")) +
                    dot(6, 18) +
                    dot(18, 18) +
                    dot(9.5, 11.9),
            ),
            tool(
                "CenterSector",
                0,
                path("M12 7.6L14 4.1", true) +
                    result(
                        `<path d="M6 18H18A12 12 0 0 0 12 7.6Z" fill="currentColor" fill-opacity=".1"/>`,
                    ) +
                    dot(6, 18) +
                    dot(18, 18) +
                    dot(9.5, 11.9),
            ),
            tool(
                "Semicircle",
                0,
                path("M4 16H20", true) +
                    result(path("M4 16A8 8 0 0 1 20 16")) +
                    dot(4, 16) +
                    dot(20, 16),
            ),
            tool(
                "Conic",
                0,
                result(`<ellipse cx="12" cy="12" rx="9" ry="6"/>`) +
                    dot(3, 12) +
                    dot(7.5, 6.8) +
                    dot(16.5, 6.8) +
                    dot(21, 12) +
                    dot(12, 18),
            ),
            // Its foci, then a point.
            tool(
                "Ellipse",
                0,
                result(`<ellipse cx="12" cy="12" rx="9" ry="6"/>`) +
                    path("M5.3 12L16.5 6.8L18.7 12", true) +
                    dot(5.3, 12) +
                    dot(18.7, 12) +
                    dot(16.5, 6.8),
            ),
            tool(
                "Hyperbola",
                0,
                result(
                    path(
                        "M2.6 3.5Q10.3 12 2.6 20.5M21.4 3.5Q13.7 12 21.4 20.5",
                    ),
                ) +
                    dot(4.5, 12) +
                    dot(19.5, 12) +
                    dot(19.4, 6.1),
            ),
            // Its focus, then its directrix.
            tool(
                "Parabola",
                0,
                path("M3 5h18") +
                    result(path("M2 16.3Q12 -0.3 22 16.3")) +
                    dot(12, 11),
            ),
        ],
    ],
    [
        "family_shapes",
        185,
        [
            [
                tool(
                    "Polygon",
                    0,
                    result(
                        `<path d="M5 18L9 5L20 9L17 19Z" fill="currentColor" fill-opacity=".1"/>`,
                    ) +
                        dot(5, 18) +
                        dot(9, 5) +
                        dot(20, 9) +
                        dot(17, 19),
                ),
            ],
            [
                tool(
                    "Angle",
                    0,
                    result(
                        `<path d="M4 19h7a7 7 0 0 0-3.4-6Z" fill="currentColor" fill-opacity=".12" stroke="none"/>` +
                            path("M11 19a7 7 0 0 0-3.4-6"),
                    ) + path("M4 19h16M4 19L13 4"),
                ),
            ],
            [
                tool(
                    "Locus",
                    0,
                    result(path("M3 16Q12 0 21 16")) +
                        path("M3 20h18M14.7 20V8.7", true) +
                        dot(14.7, 20) +
                        dot(14.7, 8.7),
                ),
            ],
        ],
        [
            // Two vertices: a square, which the line changes.
            tool(
                "RegularPolygon",
                0,
                result(
                    `<path d="M7 19H17L20 9.5L12 3.7L4 9.5Z" fill="currentColor" fill-opacity=".1"/>`,
                ) +
                    dot(7, 19) +
                    dot(17, 19),
            ),
        ],
    ],
    [
        "family_transformations",
        320,
        [
            [
                tool(
                    "Reflect",
                    0,
                    path("M5 18L19 6", true) +
                        dot(5, 18) +
                        dot(12, 12) +
                        result(dot(19, 6)),
                ),
            ],
            [
                tool(
                    "Reflect",
                    1,
                    path("M12 3v18") +
                        `<path class="dge-guide" d="M5 10h14" stroke-dasharray="2 3"/>` +
                        dot(5, 10) +
                        result(dot(19, 10)),
                ),
            ],
        ],
        [
            // The point, then the center: a quarter turn, which the line
            // changes.
            tool(
                "Rotation",
                0,
                path("M19 15A12.2 12.2 0 0 0 11.3 5.6", true) +
                    dot(7, 17) +
                    dot(19, 15) +
                    result(dot(11.3, 5.6)),
            ),
            // The point, then the vector.
            tool(
                "Translation",
                0,
                path("M4 9L15 4M11.2 3.2L15 4L12.6 6.9") +
                    `<path class="dge-guide" d="M6 19L17 14" stroke-dasharray="2 3"/>` +
                    dot(6, 19) +
                    result(dot(17, 14)),
            ),
            // The point, then the center: a ratio of 2.
            tool(
                "Dilation",
                0,
                path("M4 20L20 12M4 20L12 4", true) +
                    path("M8 16L12 16L8 12Z") +
                    result(path("M12 12L20 12L12 4Z")) +
                    dot(4, 20),
            ),
            // The point, then the circle.
            tool(
                "Inversion",
                0,
                `<circle cx="9" cy="12" r="6"/>` +
                    path("M9 12H22", true) +
                    dot(12, 12) +
                    result(dot(21, 12)),
            ),
        ],
    ],
];

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
            const item = family.items.find(
                ({ tools: [first] }) =>
                    first.slot === slot && first.command === tool.command,
            );
            if (item) item.tools.push(tool);
            else family.items.push({ tools: [tool] });
        }
        slot++;
    }
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

// The circle through three points is in their plane in space, the sphere
// only there.
export const usable = ({ overload: { tag } }: Tool, vec3: boolean): boolean =>
    tag !== (vec3 ? "C3p" : "C3s") && (tag !== "Sph" || vec3);

// The commands of more than one item, told apart.
const LABELS: Partial<Record<string, MessageKey>> = {
    Cir: "tool_circle_point",
    C1: "tool_circle_radius",
    Sym: "tool_central",
    Refl: "tool_axial",
};

export const itemLabel = ({ tools: [tool] }: Item): string => {
    const key = LABELS[tool.overload.tag];
    return key ? message(key) : commandName(tool.command);
};

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
        if (mode === "intersection") return accepts(object, "intersectable");
        // A radius is given by the tool, not designated.
        return overload.params.some(
            (param) => param !== "real" && accepts(object, param),
        );
    });
}

// The point on an object that moves the point, the last built of its
// ancestors, as in DGPad: its path gives the point's locus.
export function driverOf(object: construction_object): point_on_object | null {
    if (!(object instanceof point_object)) return null;
    let driver: point_on_object | null = null;
    const seen = new Set<construction_object>();
    const visit = (parent: construction_object): void => {
        if (seen.has(parent)) return;
        seen.add(parent);
        if (
            parent instanceof point_on_object &&
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
    if (mode === "intersection")
        return objects.length <= 2 &&
            objects.every((object) => accepts(object, "intersectable"))
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
