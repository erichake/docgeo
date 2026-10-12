import type { construction_object } from "../objects/construction_object";
import { accepts, COMMANDS, type Command, type Overload } from "./catalog";
import { ACTION_ICONS } from "./icons";

// The tools shown around a designated object: see EDITOR.md.

export interface Tool {
    // The command, whose arguments are designated one after the other; a
    // point put on the object or an intersection, where it was designated;
    // the object's properties; or deletion.
    mode: "command" | "point" | "intersection" | "properties" | "delete";
    command?: Command;
    overload?: Overload;
    icon: string;
    // Its place on the ring, clockwise from the top, in buttons.
    slot: number;
    family: Family;
}

export interface Family {
    hue: number;
    // The saturation, relative to the other families'.
    tone: number;
    first: number;
    last: number;
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
const BISECTOR =
    path("M4 12h16M8 10.5v3M16 10.5v3", true) + result(path("M12 4v16"));
const CIRCLE = `<circle cx="12" cy="12" r="7.5"/>`;
const CIRCLE3 = result(CIRCLE) + dot(4.5, 12) + dot(16.5, 18) + dot(16.5, 6);
const MIDPOINT = path("M5 12h14", true) + result(dot(12, 12));

// The families of tools, clockwise from the first one, centred on the top,
// each tool keeping its place whatever the object, so that the hand learns
// it; the tools of a slot never show together.
const FAMILIES: [hue: number, slots: Tool[][], tone?: number][] = [
    [
        215,
        [
            [{ mode: "properties", icon: ACTION_ICONS.properties } as Tool],
            [
                {
                    mode: "delete",
                    icon: result(
                        path(
                            "M5 7h14M9 7V4.5h6V7M7 7l.8 12a1 1 0 0 0 1 1h6.4a1 1 0 0 0 1-1L17 7M10 10.5v6M14 10.5v6",
                        ),
                    ),
                } as Tool,
            ],
        ],
        0.25,
    ],
    [
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
    ],
    [
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
    ],
    [
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
    ],
    [
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
        ],
    ],
    [
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
    ],
];

// Between two families, in buttons.
const GAP = 0.45;

export const TOOLS: Tool[] = [];
const start = (1 - FAMILIES[0][1].length) / 2;
let slot = start;
for (const [hue, slots, tone = 1] of FAMILIES) {
    const family = { hue, tone, first: slot, last: slot + slots.length - 1 };
    for (const tools of slots) {
        for (const tool of tools)
            TOOLS.push(Object.assign(tool, { slot, family }));
        slot++;
    }
    slot += GAP;
}
// The ring's circumference, in buttons.
export const RING_SLOTS = slot - start;

// The tools that take the object as one of their arguments.
export function toolsFor(object: construction_object, vec3: boolean): Tool[] {
    return TOOLS.filter(({ mode, overload }) => {
        if (mode === "properties" || mode === "delete") return true;
        if (overload!.tag === (vec3 ? "C3p" : "C3s")) return false;
        if (overload!.tag === "Sph" && !vec3) return false;
        // A point is put on the object, an intersection with another.
        if (mode === "point") return accepts(object, "support");
        if (mode === "intersection") return accepts(object, "intersectable");
        return overload!.params.some((param) => accepts(object, param));
    });
}
