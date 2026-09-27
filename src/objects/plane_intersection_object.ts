import type { construction } from "../construction";
import { vAdd, vCross, vDot, vScale, vSub } from "../vec";
import type { DgoContext } from "./construction_object";
import { point_object } from "./point_object";
import type { primitive_line_object } from "./primitive_line_object";

// Where a line meets the plane through three points, within the line's
// bounds, like GeoGebra's Intersect(line, plane).
export class plane_intersection_object extends point_object {
    moveable = false;
    LINE: primitive_line_object;
    PLANE: [point_object, point_object, point_object];

    constructor(
        c: construction,
        name: string | null | undefined,
        line: primitive_line_object,
        plane: [point_object, point_object, point_object],
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.LINE = line;
        this.PLANE = plane;
        this.addParents(line, ...plane);
    }

    // Parallel to the plane, the parameter isn't finite, nor the point.
    dgo(context: DgoContext): [string, unknown] {
        return ["PlI", [this.LINE, ...this.PLANE].map(context.index)];
    }

    computeGeometry(): void {
        this.defined = false;
        const { LINE: line, PLANE: plane } = this;
        if (!line.defined || plane.some((point) => !point.defined)) return;
        const [a, b, c] = plane.map((point) => point.coords);
        const normal = vCross(vSub(b, a), vSub(c, a));
        const parameter =
            vDot(normal, vSub(a, line.P1.coords)) / vDot(normal, line.VEC);
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
    plane: [point_object, point_object, point_object],
): plane_intersection_object {
    return c.add(new plane_intersection_object(c, name, line, plane));
}
