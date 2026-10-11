import type { construction } from "../construction";
import { figureObjects } from "../dgo";
import type { construction_object } from "../objects/construction_object";
import { curve_object } from "../objects/curve_object";
import { list_object } from "../objects/list_object";
import { locus_object } from "../objects/locus_object";
import { point_object } from "../objects/point_object";
import { polygon_object } from "../objects/polygon_object";
import { primitive_circle_object } from "../objects/primitive_circle_object";
import { primitive_line_object } from "../objects/primitive_line_object";
import { primitive_quadric_object } from "../objects/primitive_quadric_object";
import { ray_line_object } from "../objects/ray_line_object";
import { segment_object } from "../objects/segment_object";
import { sphere_object } from "../objects/sphere_object";
import { two_points_line_object } from "../objects/two_points_line_object";
import { projectPointOnLine, projectPointOnPlane } from "../projection";
import { vAdd, vIsFinite, vSub, type Vec2, type Vec3 } from "../vec";

// The objects under the pointer: see EDITOR.md.

export const PICK_RADIUS = 12;

export interface Hit {
    object: construction_object;
    // In pixels.
    distance: number;
    // Its point nearest to the pointer, for a point to be put on it.
    at: Vec3;
}

const screenDistance = ([x, y]: Vec2, [u, v]: Vec2): number =>
    Math.hypot(x - u, y - v);

// The point of the object nearest to `screen`, on the screen.
function nearest(
    c: construction,
    object: construction_object,
    screen: Vec2,
): Vec3 | null {
    const frame = c.projectionFrame;
    if (object instanceof point_object)
        return object.projectionDefined ? object.coords : null;
    if (object instanceof primitive_line_object) {
        const origin = object.P1.coords;
        const direction =
            object instanceof two_points_line_object
                ? vSub(object.P2.coords, origin)
                : object.VEC;
        const a = c.pt3D(origin);
        const b = c.pt3D(vAdd(origin, direction));
        const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
        const length = dx * dx + dy * dy;
        if (!(length > 0)) return null;
        let t = ((screen[0] - a[0]) * dx + (screen[1] - a[1]) * dy) / length;
        if (object instanceof segment_object) t = Math.max(0, Math.min(1, t));
        else if (
            object instanceof ray_line_object ||
            (object as unknown as { oneSided: boolean }).oneSided
        )
            t = Math.max(0, t);
        return projectPointOnLine(
            [a[0] + t * dx, a[1] + t * dy],
            origin,
            direction,
            frame,
        );
    }
    if (object instanceof primitive_circle_object) {
        const inPlane = projectPointOnPlane(
            screen,
            object.CENTER,
            [object.U, object.V],
            frame,
        );
        return inPlane && object.pointAt(object.alphaOf(inPlane));
    }
    if (object instanceof primitive_quadric_object) {
        const inPlane = projectPointOnPlane(
            screen,
            object.ORIGIN,
            object.PLANE,
            frame,
        );
        return inPlane && object.projectPoint(inPlane);
    }
    if (
        object instanceof curve_object ||
        object instanceof locus_object ||
        object instanceof list_object
    ) {
        const alpha = object.alphaAtScreen(screen);
        return alpha === null ? null : object.pointAt(alpha);
    }
    if (object instanceof sphere_object)
        return object.projectionDefined && inside(object.contour, screen)
            ? object.CENTER
            : null;
    if (object instanceof polygon_object && object.points.length >= 3) {
        const [p, q, r] = object.points.map(({ coords }) => coords);
        return inside(
            object.points.map(({ screen }) => screen),
            screen,
        )
            ? projectPointOnPlane(screen, p, [vSub(q, p), vSub(r, p)], frame)
            : null;
    }
    return null;
}

function inside(polygon: Vec2[], [x, y]: Vec2): boolean {
    let result = false;
    polygon.forEach(([xi, yi], index) => {
        const [xj, yj] = polygon[(index || polygon.length) - 1];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
            result = !result;
    });
    return result;
}

// Within `radius` pixels, points first, then the nearest first. A polygon
// or a sphere is under the pointer inside it.
export function pick(
    c: construction,
    screen: Vec2,
    ignored: ReadonlySet<construction_object> = new Set(),
    radius = PICK_RADIUS,
): Hit[] {
    const hits: (Hit & { rank: number })[] = [];
    figureObjects(c).forEach((object) => {
        if (!object.isVisible || !object.hasView || ignored.has(object)) return;
        const at = nearest(c, object, screen);
        if (!at || !vIsFinite(at)) return;
        const distance =
            object instanceof polygon_object || object instanceof sphere_object
                ? radius
                : screenDistance(c.pt3D(at), screen);
        if (!(distance <= radius)) return;
        const rank = object instanceof point_object ? 0 : radius + 1;
        hits.push({ object, distance, at, rank: rank + distance });
    });
    return hits.sort((a, b) => a.rank - b.rank);
}
