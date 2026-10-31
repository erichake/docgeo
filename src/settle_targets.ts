import type { construction } from "./construction";
import { cylinder_intersection_object } from "./objects/cylinder_intersection_object";
import { intersection_object } from "./objects/intersection_object";
import { point_on_object } from "./objects/point_on_object";
import type { construction_object } from "./objects/construction_object";
import { vNorm, vSub, type Vec3 } from "./vec";

// GeoGebra and CaRMetal save where each point on a path or intersection
// actually is, not a DGP-style parameter or branch index: one construction-order pass
// moves each onto its saved position, parents being already settled.
export function settleTargets(
    c: construction,
    targets: Map<construction_object, Vec3>,
): void {
    if (targets.size === 0) return;
    // A conic×conic intersection follows its previous position (see
    // intersection_object.groupAssign), so seeding it with the saved one
    // selects the right root.
    targets.forEach((coords, object) => {
        if (object instanceof intersection_object) object.coords = coords;
    });
    c.OBJS.frame++;
    c.OBJS.V.forEach((object) => {
        object.computeGeometry();
        const coords = targets.get(object);
        if (!coords) return;
        if (
            object instanceof point_on_object &&
            object.support.familytype !== "locus"
        ) {
            const alpha = object.alphaFor(coords);
            if (alpha === null) return;
            object.alpha = alpha;
            object.computeGeometry();
        } else if (
            object instanceof intersection_object ||
            object instanceof cylinder_intersection_object
        ) {
            const order = object.order;
            const distance = object.defined
                ? vNorm(vSub(object.coords, coords))
                : Infinity;
            object.order = order === 0 ? 1 : 0;
            object.computeGeometry();
            if (
                !object.defined ||
                vNorm(vSub(object.coords, coords)) >= distance
            ) {
                object.order = order;
                object.computeGeometry();
            }
        }
    });
}
