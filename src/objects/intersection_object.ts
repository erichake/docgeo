import type { construction } from "../construction";
import {
    GEOMETRY_EPSILON,
    geometryTolerance,
    vAdd,
    vCross,
    vDot,
    vIsFinite,
    vNorm,
    vScale,
    vSub,
} from "../vec";
import { point_object } from "./point_object";
import type { primitive_line_object } from "./primitive_line_object";

export class intersection_object extends point_object {
    O1: primitive_line_object;
    O2: primitive_line_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        o1: primitive_line_object,
        o2: primitive_line_object,
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.O1 = o1;
        this.O2 = o2;
        this.addParents(o1, o2);
    }

    computeGeometry(): void {
        this.defined = false;
        INTERSECTION_COMPUTERS.get(
            `${this.O1.familytype}:${this.O2.familytype}`,
        )?.(this);
    }

    computeLineLine(): void {
        if (!this.O1.defined || !this.O2.defined) return;

        const p = this.O1.P1.coords,
            u = this.O1.VEC,
            m = this.O2.P1.coords,
            v = this.O2.VEC;
        const normal = vCross(u, v);
        const denominator = vDot(normal, normal);
        if (denominator <= GEOMETRY_EPSILON * GEOMETRY_EPSILON) return;

        const betweenOrigins = vSub(m, p);
        const parameter1 =
            vDot(vCross(betweenOrigins, v), normal) / denominator;
        const parameter2 =
            vDot(vCross(betweenOrigins, u), normal) / denominator;
        const point1 = vAdd(p, vScale(u, parameter1));
        const point2 = vAdd(m, vScale(v, parameter2));
        if (!vIsFinite(point1) || !vIsFinite(point2)) return;

        if (
            vNorm(vSub(point1, point2)) >
                geometryTolerance(vNorm(point1), vNorm(point2)) ||
            !this.O1.insideBounds(parameter1) ||
            !this.O2.insideBounds(parameter2)
        ) {
            return;
        }

        this.coords = vScale(vAdd(point1, point2), 0.5);
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

type IntersectionComputer = (object: intersection_object) => void;

const INTERSECTION_COMPUTERS = new Map<string, IntersectionComputer>([
    ["line:line", (object) => object.computeLineLine()],
]);

export function createIntersection(
    c: construction,
    name: string | null | undefined,
    o1: primitive_line_object,
    o2: primitive_line_object,
): intersection_object {
    return c.add(new intersection_object(c, name, o1, o2));
}
