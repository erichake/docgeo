import type { construction } from "../construction";
import { figureObjects } from "../dgo";
import { angle_object, RIGHT_ANGLE_TOLERANCE } from "../objects/angle_object";
import type { construction_object } from "../objects/construction_object";
import { intersection_object } from "../objects/intersection_object";
import { curve_object } from "../objects/curve_object";
import { fixed_angle_object } from "../objects/fixed_angle_object";
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
import { accepts } from "./catalog";
import {
    vAdd,
    vDot,
    vIsFinite,
    vNormalize,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";

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
export function nearest(
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

export type Angle = angle_object | fixed_angle_object;

export const vertexOf = (angle: Angle): point_object =>
    angle instanceof angle_object ? angle.O : angle.P1;

function segmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
    const ab = vSub(b, a);
    const t = Math.max(0, Math.min(1, vDot(vSub(p, a), ab) / vDot(ab, ab)));
    return screenDistance(p, vAdd(a, vScale(ab, t)));
}

const cross = (a: Vec2, b: Vec2): number => a[0] * b[1] - a[1] * b[0];

// How far `screen` is from the angle's mark as drawn: its arc, or the mark
// of a right angle.
export function arcDistance(
    c: construction,
    angle: Angle,
    screen: Vec2,
): number {
    const o = vertexOf(angle).screen;
    const u = vNormalize(vSub(angle.A.screen, o));
    const v = vNormalize(
        vSub(
            angle instanceof angle_object
                ? angle.B.screen
                : c.pt3D(vAdd(angle.P1.coords, angle.VEC)),
            o,
        ),
    );
    if (!angle.projectionDefined || !u || !v) return Infinity;
    const r = angle.arcRadius;
    if (
        angle instanceof angle_object &&
        !["none", "dot"].includes(angle.rightAngleMark) &&
        Math.abs(angle.value - Math.PI / 2) < RIGHT_ANGLE_TOLERANCE
    ) {
        const dgpad = angle.rightAngleMark === "dgpad";
        const [U, V] = [u, v].map((w) =>
            vScale(w, dgpad ? r : r * Math.SQRT1_2),
        );
        const corner =
            angle.rightAngleMark === "L" ? vAdd(o, vScale(vAdd(U, V), 0.4)) : o;
        const mark = [
            vAdd(corner, U),
            vAdd(vAdd(corner, U), V),
            vAdd(corner, V),
        ];
        if (angle.rightAngleMark === "square") mark.push(o, mark[0]);
        if (angle.rightAngleMark === "L") mark.splice(1, 1, corner);
        return Math.min(
            ...mark
                .slice(1)
                .map((b, index) => segmentDistance(screen, mark[index], b)),
        );
    }
    const d = vSub(screen, o);
    const turn = cross(u, v);
    return cross(u, d) * turn >= 0 && cross(d, v) * turn >= 0
        ? Math.abs(Math.hypot(...d) - r)
        : Math.min(
              screenDistance(screen, vAdd(o, vScale(u, r))),
              screenDistance(screen, vAdd(o, vScale(v, r))),
          );
}

// The angle whose mark is under the pointer, unless a point or a nearer
// object of `hits` is.
export function arcAt(
    c: construction,
    screen: Vec2,
    hits: Hit[],
): Angle | null {
    let best: Angle | null = null;
    let distance = PICK_RADIUS;
    figureObjects(c).forEach((object) => {
        if (
            !(
                object instanceof angle_object ||
                object instanceof fixed_angle_object
            ) ||
            !object.isVisible ||
            !object.hasView
        )
            return;
        const d = arcDistance(c, object, screen);
        if (d <= distance) [best, distance] = [object, d];
    });
    const hit = hits[0];
    return hit &&
        (hit.object instanceof point_object || hit.distance < distance)
        ? null
        : best;
}

// Within `radius` pixels, points first, then the nearest first. A polygon
// or a sphere is under the pointer inside it, an angle near its mark.
export function pick(
    c: construction,
    screen: Vec2,
    ignored: ReadonlySet<construction_object> = new Set(),
    radius = PICK_RADIUS,
): Hit[] {
    const hits: (Hit & { rank: number })[] = [];
    figureObjects(c).forEach((object) => {
        if (!object.isVisible || !object.hasView || ignored.has(object)) return;
        const at =
            object instanceof angle_object
                ? object.O.coords
                : nearest(c, object, screen);
        if (!at || !vIsFinite(at)) return;
        const distance =
            object instanceof polygon_object || object instanceof sphere_object
                ? radius
                : object instanceof angle_object
                  ? arcDistance(c, object, screen)
                  : screenDistance(c.pt3D(at), screen);
        if (!(distance <= radius)) return;
        const rank = object instanceof point_object ? 0 : radius + 1;
        hits.push({ object, distance, at, rank: rank + distance });
    });
    return hits.sort((a, b) => a.rank - b.rank);
}

// What a click on these hits may mean: the point under it, or else each of
// them, for the user to choose.
export const meant = (hits: Hit[]): Hit[] =>
    hits[0]?.object instanceof point_object ? [hits[0]] : hits;

// The branches of the intersections of pairs of objects, kept until the
// figure changes: the hover asks for them at each move.
let branchMemo: {
    a: construction_object;
    b: construction_object;
    points: (Vec3 | null)[];
}[] = [];

export function forgetBranches(): void {
    branchMemo = [];
}

function branches(
    c: construction,
    a: construction_object,
    b: construction_object,
): (Vec3 | null)[] {
    const known = branchMemo.find((memo) => memo.a === a && memo.b === b);
    if (known) return known.points;
    const points = ([0, 1, 2, 3] as const).map((order) => {
        const point = new intersection_object(
            c,
            "‧i",
            a as never,
            b as never,
            order,
        );
        // Without a view to make and unmake, as hundreds may be per move.
        point.hidden = 1;
        c.add(point);
        const coords =
            point.defined && point.projectionDefined ? point.coords : null;
        c.removeObject(point);
        return coords;
    });
    branchMemo.push({ a, b, points });
    return points;
}

// The branch of their intersection nearest to `screen`, if near enough.
export function nearestBranch(
    c: construction,
    a: construction_object,
    b: construction_object,
    screen: Vec2,
): { order: number; distance: number } | null {
    let best: { order: number; distance: number } | null = null;
    branches(c, a, b).forEach((point, order) => {
        if (!point) return;
        const distance = screenDistance(c.pt3D(point), screen);
        if (distance <= 2 * PICK_RADIUS && (!best || distance < best.distance))
            best = { order, distance };
    });
    return best;
}

export interface Crossing {
    a: construction_object;
    b: construction_object;
    order: number;
    distance: number;
}

// The intersection of two of these objects nearest to `screen`, where a
// point designated there is made, unless a point is under it.
export function crossing(
    c: construction,
    screen: Vec2,
    hits: Hit[],
): Crossing | null {
    if (hits[0]?.object instanceof point_object) return null;
    const curves = hits
        .map(({ object }) => object)
        .filter((object) => accepts(object, "intersectable"));
    let best: Crossing | null = null;
    curves.forEach((a, index) =>
        curves.slice(index + 1).forEach((b) => {
            const branch = nearestBranch(c, a, b, screen);
            if (branch && (!best || branch.distance < best.distance))
                best = { a, b, ...branch };
        }),
    );
    return best;
}
