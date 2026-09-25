import type { construction } from "../construction";
import {
    GEOMETRY_EPSILON,
    geometryTolerance,
    vAdd,
    vDot,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec3,
} from "../vec";
import { point_object } from "./point_object";
import type { primitive_line_object } from "./primitive_line_object";

// Where a line meets the infinite cylinder of axis AB through R, or without
// B the sphere of center A through R, the roots sorted along the line like
// GeoGebra's Intersect(line, cylinder), which doesn't cut the cylinder off
// at its disks, and Intersect(line, sphere).
export class cylinder_intersection_object extends point_object {
    moveable = false;
    LINE: primitive_line_object;
    A: point_object;
    B: point_object | null;
    R: point_object;
    order: 0 | 1;

    constructor(
        c: construction,
        name: string | null | undefined,
        line: primitive_line_object,
        a: point_object,
        b: point_object | null,
        r: point_object,
        order: 0 | 1,
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.LINE = line;
        this.A = a;
        this.B = b;
        this.R = r;
        this.order = order;
        this.addParents(line, a, ...(b ? [b] : []), r);
    }

    computeGeometry(): void {
        this.defined = false;
        const { LINE: line, A: a, B: b, R: r } = this;
        if (!line.defined || !a.defined || (b && !b.defined) || !r.defined)
            return;
        const axis = b ? vNormalize(vSub(b.coords, a.coords)) : undefined;
        if (axis === null) return;
        const across = (vector: Vec3): Vec3 =>
            axis ? vSub(vector, vScale(axis, vDot(vector, axis))) : vector;
        const u = across(vSub(line.P1.coords, a.coords));
        const v = across(line.VEC);
        const radius = vNorm(across(vSub(r.coords, a.coords)));
        const vv = vDot(v, v);
        if (vv <= GEOMETRY_EPSILON) return;
        const uv = vDot(u, v);
        const discriminant = uv * uv - vv * (vDot(u, u) - radius * radius);
        if (discriminant < -geometryTolerance(uv * uv, radius * radius)) return;
        const offset = Math.sqrt(Math.max(0, discriminant));
        const parameter = (-uv + (this.order === 0 ? -offset : offset)) / vv;
        if (!line.insideBounds(parameter)) return;
        this.coords = vAdd(line.P1.coords, vScale(line.VEC, parameter));
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createCylinderIntersection(
    c: construction,
    name: string | null | undefined,
    line: primitive_line_object,
    a: point_object,
    b: point_object | null,
    r: point_object,
    order: 0 | 1,
): cylinder_intersection_object {
    return c.add(
        new cylinder_intersection_object(c, name, line, a, b, r, order),
    );
}
