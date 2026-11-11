import { vAdd, vSub, type Vec3 } from "../vec";
import type { construction_object } from "./construction_object";
import type { point_object } from "./point_object";

const FAMILIES = new Set(["line", "circle", "polygon", "quadric"]);

// The free points an object is built from, directly or through lines,
// circles, polygons and conics built likewise, constants aside; false when
// it also depends on another point or object.
function freePoints(
    object: construction_object,
    points: Set<point_object>,
    seen: Set<construction_object>,
): boolean {
    // A polygon's own vertices, which it computes.
    const own = (object as { ownVertices?: construction_object[] }).ownVertices;
    return object.parents.every((parent) => {
        if (seen.has(parent) || own?.includes(parent)) return true;
        seen.add(parent);
        if (parent.type === "point") {
            const point = parent as point_object;
            points.add(point);
            return (
                !point.parents.length &&
                point.moveable &&
                !point.locked &&
                !point.pinned
            );
        }
        return (
            !parent.parents.length ||
            (FAMILIES.has(parent.familytype) &&
                freePoints(parent, points, seen))
        );
    });
}

// As in DGPad, an object built from free points alone is dragged by
// translating them: the drag and grab callbacks of DOMElement.drag.
export function pointsDrag(
    object: construction_object,
): [(event: PointerEvent) => void, (event: PointerEvent) => boolean] {
    const { C } = object;
    let from: Vec3;
    let moved: point_object[];
    let coords: Vec3[];
    return [
        (event) => {
            const to = C.unprojectToZPlane(C.pointerPosition(event), from[2]);
            if (!to) return;
            // The first point snaps onto the grid, as a point dragged alone.
            const shift = vSub(
                moved[0].snapToIncrement(vAdd(coords[0], vSub(to, from))),
                coords[0],
            );
            moved.forEach((point, index) => {
                point.coords = vAdd(coords[index], shift);
                C.invalidateGeometry(point);
            });
        },
        (event) => {
            const points = new Set<point_object>();
            if (!freePoints(object, points, new Set()) || !points.size)
                return false;
            moved = [...points];
            const start = C.unprojectToZPlane(
                C.pointerPosition(event),
                moved[0].z,
            );
            if (!start) return false;
            from = start;
            coords = moved.map((point) => point.coords);
            return true;
        },
    ];
}
