import type { construction } from "../construction";
import { geometryTolerance, vAdd, vDot, vScale, vSub } from "../vec";
import type { DgoContext } from "./construction_object";
import { point_object } from "./point_object";
import type { primitive_line_object } from "./primitive_line_object";
import { revolution_object } from "./revolution_object";
import type { sphere_object } from "./sphere_object";

// Where a line meets the side of a cylinder or a cone, extended beyond its
// disks as GeoGebra's Intersect(line, cylinder) is, or a sphere, the roots
// sorted along the line.
export class cylinder_intersection_object extends point_object {
    moveable = false;
    LINE: primitive_line_object;
    SOLID: revolution_object | sphere_object;
    order: 0 | 1;

    constructor(
        c: construction,
        name: string | null | undefined,
        line: primitive_line_object,
        solid: revolution_object | sphere_object,
        order: 0 | 1,
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.LINE = line;
        this.SOLID = solid;
        this.order = order;
        this.addParents(line, solid);
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "CyI",
            [context.index(this.LINE), context.index(this.SOLID), this.order],
        ];
    }

    computeGeometry(): void {
        this.defined = false;
        const { LINE: line, SOLID: solid } = this;
        if (!line.defined || !solid.defined) return;
        const p = line.P1.coords;
        const v = line.VEC;
        let roots: number[];
        if (solid instanceof revolution_object) roots = solid.meet(p, v);
        else {
            const u = vSub(p, solid.CENTER);
            const [vv, uv] = [vDot(v, v), vDot(u, v)];
            const disc = uv * uv - vv * (vDot(u, u) - solid.R ** 2);
            roots =
                disc < -geometryTolerance(uv * uv, solid.R ** 2)
                    ? []
                    : [-1, 1].map(
                          (sign) =>
                              (-uv + sign * Math.sqrt(Math.max(0, disc))) / vv,
                      );
        }
        const parameter = roots[this.order];
        if (parameter === undefined || !line.insideBounds(parameter)) return;
        this.coords = vAdd(p, vScale(v, parameter));
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createCylinderIntersection(
    c: construction,
    name: string | null | undefined,
    line: primitive_line_object,
    solid: revolution_object | sphere_object,
    order: 0 | 1,
): cylinder_intersection_object {
    return c.add(new cylinder_intersection_object(c, name, line, solid, order));
}
