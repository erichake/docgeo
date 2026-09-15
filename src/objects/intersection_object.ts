import type { construction } from "../construction";
import {
    GEOMETRY_EPSILON,
    geometryTolerance,
    vAdd,
    vCross,
    vDot,
    vIsFinite,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec3,
} from "../vec";
import { point_object } from "./point_object";
import { primitive_circle_object } from "./primitive_circle_object";
import { primitive_line_object } from "./primitive_line_object";

export type intersectable_object =
    primitive_line_object | primitive_circle_object;

export class intersection_object extends point_object {
    O1: intersectable_object;
    O2: intersectable_object;
    order: 0 | 1;
    away?: point_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        o1: intersectable_object,
        o2: intersectable_object,
        order: 0 | 1 = 0,
        away?: point_object,
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.O1 = o1;
        this.O2 = o2;
        this.order = order;
        this.away = away;
        this.addParents(o1, o2, ...(away ? [away] : []));
    }

    computeGeometry(): void {
        this.defined = false;
        INTERSECTION_COMPUTERS.get(
            `${this.O1.familytype}:${this.O2.familytype}`,
        )?.(this);
    }

    computeLineLine(): void {
        if (
            !(this.O1 instanceof primitive_line_object) ||
            !(this.O2 instanceof primitive_line_object)
        ) {
            return;
        }
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

    computeLineCircle(
        line: primitive_line_object,
        circle: primitive_circle_object,
    ): void {
        if (!line.defined || !circle.defined) return;
        const relative = vSub(line.P1.coords, circle.CENTER);
        const planeDistance = vDot(relative, circle.NORMAL);
        const planeDirection = vDot(line.VEC, circle.NORMAL);
        const tolerance = geometryTolerance(vNorm(relative), circle.R);

        if (Math.abs(planeDirection) > GEOMETRY_EPSILON) {
            const parameter = -planeDistance / planeDirection;
            const point = vAdd(line.P1.coords, vScale(line.VEC, parameter));
            if (
                Math.abs(vNorm(vSub(point, circle.CENTER)) - circle.R) <=
                    tolerance &&
                line.insideBounds(parameter)
            ) {
                this.coords = point;
                super.computeGeometry();
            }
            return;
        }
        if (Math.abs(planeDistance) > tolerance) return;

        const projectionParameter = -vDot(relative, line.VEC);
        let discriminant =
            circle.R * circle.R -
            vDot(
                vAdd(relative, vScale(line.VEC, projectionParameter)),
                vAdd(relative, vScale(line.VEC, projectionParameter)),
            );
        if (discriminant < -tolerance) return;
        discriminant = Math.max(0, discriminant);
        const offset = Math.sqrt(discriminant);
        const parameters =
            offset <= tolerance
                ? [projectionParameter]
                : [projectionParameter + offset, projectionParameter - offset];
        const index = this.choose(
            parameters.map((parameter) =>
                vAdd(line.P1.coords, vScale(line.VEC, parameter)),
            ),
        );
        const parameter = parameters[index];
        if (!line.insideBounds(parameter)) return;
        this.coords = vAdd(line.P1.coords, vScale(line.VEC, parameter));
        super.computeGeometry();
    }

    computeCircleCircle(
        first: primitive_circle_object,
        second: primitive_circle_object,
    ): void {
        if (!first.defined || !second.defined) return;
        const centers = vSub(second.CENTER, first.CENTER);
        const distance = vNorm(centers);
        const tolerance = geometryTolerance(distance, first.R, second.R);
        if (
            vNorm(vCross(first.NORMAL, second.NORMAL)) > tolerance ||
            Math.abs(vDot(centers, first.NORMAL)) > tolerance ||
            distance <= tolerance ||
            distance > first.R + second.R + tolerance ||
            distance < Math.abs(first.R - second.R) - tolerance
        ) {
            return;
        }
        const direction = vNormalize(centers);
        if (!direction) return;
        const along =
            (distance * distance + first.R * first.R - second.R * second.R) /
            (2 * distance);
        let heightSquared = first.R * first.R - along * along;
        if (heightSquared < -tolerance) return;
        heightSquared = Math.max(0, heightSquared);
        const base = vAdd(first.CENTER, vScale(direction, along));
        const side = vScale(
            vCross(first.NORMAL, direction),
            Math.sqrt(heightSquared),
        );
        const candidates =
            vNorm(side) <= tolerance
                ? [base]
                : [vAdd(base, side), vSub(base, side)];
        this.coords = candidates[this.choose(candidates)];
        super.computeGeometry();
    }

    private choose(candidates: Vec3[]): number {
        if (candidates.length === 1) return 0;
        if (this.away?.defined) {
            const firstDistance = vNorm(vSub(candidates[0], this.away.coords));
            const secondDistance = vNorm(vSub(candidates[1], this.away.coords));
            return firstDistance < secondDistance ? 1 : 0;
        }
        return this.order;
    }

    mousedrag(_ev: PointerEvent): void {}
}

type IntersectionComputer = (object: intersection_object) => void;

const INTERSECTION_COMPUTERS = new Map<string, IntersectionComputer>([
    ["line:line", (object) => object.computeLineLine()],
    [
        "line:circle",
        (object) =>
            object.computeLineCircle(
                object.O1 as primitive_line_object,
                object.O2 as primitive_circle_object,
            ),
    ],
    [
        "circle:line",
        (object) =>
            object.computeLineCircle(
                object.O2 as primitive_line_object,
                object.O1 as primitive_circle_object,
            ),
    ],
    [
        "circle:circle",
        (object) =>
            object.computeCircleCircle(
                object.O1 as primitive_circle_object,
                object.O2 as primitive_circle_object,
            ),
    ],
]);

export function createIntersection(
    c: construction,
    name: string | null | undefined,
    o1: primitive_line_object,
    o2: primitive_line_object,
): intersection_object {
    return c.add(new intersection_object(c, name, o1, o2));
}

export function createOrderedIntersection(
    c: construction,
    name: string | null | undefined,
    o1: intersectable_object,
    o2: intersectable_object,
    order: 0 | 1,
    away?: point_object,
): intersection_object {
    return c.add(new intersection_object(c, name, o1, o2, order, away));
}
