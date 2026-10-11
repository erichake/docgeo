import type { construction_object } from "../objects/construction_object";
import { accepts, COMMANDS, type Command, type Overload } from "./catalog";

// The tools shown around a designated object: see EDITOR.md.

export interface Tool {
    // The command, whose arguments are designated one after the other; a
    // point put on the object or an intersection, where it was designated;
    // or deletion.
    mode: "command" | "point" | "intersection" | "delete";
    command?: Command;
    overload?: Overload;
    icon: string;
    // Its place on the ring, clockwise from the top, in buttons.
    slot: number;
    family: Family;
}

export interface Family {
    hue: number;
    first: number;
    last: number;
}

const dot = (x: number, y: number) =>
    `<circle cx="${x}" cy="${y}" r="2.2" fill="currentColor" stroke="none"/>`;
const path = (d: string) => `<path d="${d}"/>`;

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

const SEGMENT = path("M5 18L19 6") + dot(5, 18) + dot(19, 6);
const BISECTOR = path("M4 12h16M12 4v16");
const CIRCLE = `<circle cx="12" cy="12" r="8"/>`;
const CIRCLE3 = CIRCLE + dot(4, 12) + dot(17, 18) + dot(16, 5);
const MIDPOINT = path("M4 12h16") + dot(12, 12);

// The families of tools, clockwise from the top, each tool keeping its place
// whatever the object, so that the hand learns it; the tools of a slot never
// show together.
const FAMILIES: [hue: number, slots: Tool[][]][] = [
    [
        0,
        [
            [
                {
                    mode: "delete",
                    icon: path(
                        "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6",
                    ),
                } as Tool,
            ],
        ],
    ],
    [
        35,
        [
            [
                tool(
                    "Point",
                    0,
                    path("M3 17C8 5 16 5 21 13") + dot(12, 8.3),
                    "point",
                ),
            ],
            [
                tool(
                    "Intersection",
                    1,
                    path("M3 19L21 5M3 6L21 18") + dot(12, 12),
                    "intersection",
                ),
            ],
            [
                tool("Midpoint", 0, MIDPOINT + dot(4, 12) + dot(20, 12)),
                tool("Midpoint", 1, MIDPOINT),
                tool("Center", 0, CIRCLE + dot(12, 12)),
            ],
        ],
    ],
    [
        215,
        [
            [tool("Segment", 0, SEGMENT)],
            [tool("Line", 0, path("M2 21L22 3") + dot(8, 15.6) + dot(16, 8.4))],
            [tool("Ray", 0, path("M5 18L22 3") + dot(5, 18) + dot(13, 11))],
            [tool("Vector", 0, path("M5 18L19 6M13 6h6v6") + dot(5, 18))],
        ],
    ],
    [
        265,
        [
            [
                tool(
                    "Perpendicular",
                    0,
                    path("M3 18h18M12 3v15M12 14h4v4") + dot(12, 7),
                ),
            ],
            [tool("Parallel", 0, path("M3 16L17 4M7 20L21 8") + dot(14, 14))],
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
                    path("M4 19L20 19M4 19L15 5M4 19L20 11") +
                        dot(20, 19) +
                        dot(15, 5),
                ),
            ],
        ],
    ],
    [
        145,
        [
            [tool("Circle", 0, CIRCLE + dot(12, 12) + dot(19.6, 9.5))],
            [
                tool("Circumcircle", 0, CIRCLE3),
                tool("Circumcircle", 1, CIRCLE3),
            ],
            [
                tool(
                    "Sphere",
                    0,
                    CIRCLE +
                        `<ellipse cx="12" cy="12" rx="8" ry="3"/>` +
                        dot(12, 12),
                ),
            ],
        ],
    ],
    [
        185,
        [
            [
                tool(
                    "Polygon",
                    0,
                    path("M4 18L9 5L20 9L17 19Z") + dot(4, 18) + dot(9, 5),
                ),
            ],
            [
                tool(
                    "Angle",
                    0,
                    path("M4 19L20 19M4 19L15 5M11 19a7 7 0 0 0-2.7-5.5"),
                ),
            ],
        ],
    ],
    [
        320,
        [
            [
                tool(
                    "Reflect",
                    0,
                    dot(5, 17) + dot(12, 12) + dot(19, 7) + path("M5 17L19 7"),
                ),
            ],
            [tool("Reflect", 1, path("M12 3v18") + dot(6, 9) + dot(18, 9))],
        ],
    ],
];

// Between two families, in buttons.
const GAP = 0.45;

export const TOOLS: Tool[] = [];
let slot = 0;
for (const [hue, slots] of FAMILIES) {
    const family = { hue, first: slot, last: slot + slots.length - 1 };
    for (const tools of slots) {
        for (const tool of tools)
            TOOLS.push(Object.assign(tool, { slot, family }));
        slot++;
    }
    slot += GAP;
}
// The ring's circumference, in buttons.
export const RING_SLOTS = slot;

// The tools that take the object as one of their arguments.
export function toolsFor(object: construction_object, vec3: boolean): Tool[] {
    return TOOLS.filter(({ mode, overload }) => {
        if (mode === "delete") return true;
        if (overload!.tag === (vec3 ? "C3p" : "C3s")) return false;
        if (overload!.tag === "Sph" && !vec3) return false;
        // A point is put on the object, an intersection with another.
        if (mode === "point") return accepts(object, "support");
        if (mode === "intersection") return accepts(object, "intersectable");
        return overload!.params.some((param) => accepts(object, param));
    });
}
