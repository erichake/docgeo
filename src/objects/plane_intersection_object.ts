import type { construction } from "../construction";
import { vAdd, vDot, vScale, vSub } from "../vec";
import type { DgoContext } from "./construction_object";
import type { plane_object } from "./plane_object";
import { point_object } from "./point_object";
import type { primitive_line_object } from "./primitive_line_object";

// Where a line meets a plane, within the line's bounds, like GeoGebra's
// Intersect(line, plane).
export class plane_intersection_object extends point_object {
    moveable = false;
    LINE: primitive_line_object;
    PLANE: plane_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        line: primitive_line_object,
        plane: plane_object,
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.LINE = line;
        this.PLANE = plane;
        this.addParents(line, plane);
    }

    // Parallel to the plane, the parameter isn't finite, nor the point.
    dgo(context: DgoContext): [string, unknown] {
        return ["PlI", [this.LINE, this.PLANE].map(context.index)];
    }

    computeGeometry(): void {
        this.defined = false;
        const { LINE: line, PLANE: plane } = this;
        if (!line.defined || !plane.defined) return;
        const parameter =
            vDot(plane.NORMAL, vSub(plane.CENTER, line.P1.coords)) /
            vDot(plane.NORMAL, line.VEC);
        if (!line.insideBounds(parameter)) return;
        this.coords = vAdd(line.P1.coords, vScale(line.VEC, parameter));
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createPlaneIntersection(
    c: construction,
    name: string | null | undefined,
    line: primitive_line_object,
    plane: plane_object,
): plane_intersection_object {
    return c.add(new plane_intersection_object(c, name, line, plane));
}
