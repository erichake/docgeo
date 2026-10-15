import type { construction } from "../construction";
import { figureObjects } from "../dgo";
import type { construction_object } from "../objects/construction_object";
import { cylinder_section_object } from "../objects/cylinder_section_object";
import { list_object } from "../objects/list_object";
import { net_object } from "../objects/net_object";
import { plane_object } from "../objects/plane_object";
import { point_object } from "../objects/point_object";
import { solid_object } from "../objects/solid_object";
import { sphere_object } from "../objects/sphere_object";
import type { Vec2 } from "../vec";

// The 3D view the bar's button turns to, and back: see EDITOR.md.

// The plane view, seen from above, that of a 2D figure.
export const PLANE = { theta: Math.PI / 2, phi: (5 * Math.PI) / 2 };
// The plane tilted back as a table seen from in front, slightly turned.
export const SPACE = { theta: Math.PI / 5, phi: PLANE.phi - Math.PI / 9 };

const TURN = 900;

const outside = (z: unknown): boolean =>
    typeof z === "number" && Math.abs(z) > 1e-9;

// The first object drawn off the plane z = 0, which keeps a figure in
// space: a plane or a solid too.
export const offPlane = (c: construction): construction_object | undefined =>
    figureObjects(c).find((object) =>
        object instanceof point_object
            ? outside(object.z)
            : object instanceof list_object
              ? object.items.some(
                    ([point]) => Array.isArray(point) && outside(point[2]),
                )
              : object instanceof sphere_object ||
                object instanceof cylinder_section_object ||
                object instanceof plane_object ||
                object instanceof solid_object ||
                object instanceof net_object,
    );

// Turns the camera to these angles, and the origin to `origin`.
export function turnView(
    c: construction,
    { theta, phi }: typeof PLANE,
    origin: Vec2,
): Promise<void> {
    const grid = c.GRID;
    const from = [grid.THETA, grid.PHI, ...grid.ORG];
    const to = [theta, phi, ...origin];
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches
        ? 0
        : TURN;
    const start = performance.now();
    return new Promise((resolve) => {
        const step = (now: number) => {
            const t = duration ? Math.min((now - start) / duration, 1) : 1;
            const eased = t < 0.5 ? 4 * t ** 3 : 1 - (2 - 2 * t) ** 3 / 2;
            const [th, ph, x, y] = from.map(
                (value, index) => value + (to[index] - value) * eased,
            );
            grid.THETA = th;
            grid.PHI = ph;
            grid.ORG = [x, y];
            c.invalidateProjection();
            if (t < 1) requestAnimationFrame(step);
            else resolve();
        };
        requestAnimationFrame(step);
    });
}
