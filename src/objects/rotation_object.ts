import type { construction } from "../construction";
import { usesView } from "../import/dgp_formula";
import {
    vAdd,
    vCross,
    vDot,
    vNormalize,
    vScale,
    vSub,
    type Vec3,
} from "../vec";
import { dgoRadius, radiusValue, type circle1_radius } from "./circle1_object";
import type { DgoContext } from "./construction_object";
import { point_object } from "./point_object";
import type { primitive_line_object } from "./primitive_line_object";

// P turned by an angle around O (the origin without it), keeping its
// height, or around an axis: d, or the parallel to d through O.
export class rotation_object extends point_object {
    moveable = false;
    center: point_object | null;
    point: point_object;
    angle: circle1_radius;
    axis?: primitive_line_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        center: point_object | null,
        point: point_object,
        angle: circle1_radius,
        axis?: primitive_line_object,
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.center = center;
        this.point = point;
        this.angle = angle;
        this.readsView = typeof angle !== "number" && usesView(angle.formula);
        this.axis = axis;
        this.addParents(
            ...(center ? [center] : []),
            point,
            ...(typeof angle === "number" ? [] : angle.refs.values()),
            ...(axis ? [axis] : []),
        );
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "Rot",
            [
                this.center && context.index(this.center),
                context.index(this.point),
                dgoRadius(this.angle, context),
                ...(this.axis ? [context.index(this.axis)] : []),
            ],
        ];
    }

    computeGeometry(): void {
        const angle = radiusValue(this.angle, this.C);
        const k = this.axis ? vNormalize(this.axis.VEC) : [0, 0, 1];
        if (
            !this.point.defined ||
            this.center?.defined === false ||
            this.axis?.defined === false ||
            angle === null ||
            !k
        ) {
            this.defined = false;
            return;
        }
        const t = angle * (this.C.degrees ? Math.PI / 180 : 1);
        const o: Vec3 = this.center?.coords ??
            this.axis?.P1.coords ?? [0, 0, 0];
        const v = vSub(this.point.coords, o);
        this.coords = vAdd(
            vAdd(o, vScale(v, Math.cos(t))),
            vAdd(
                vScale(vCross(k as Vec3, v), Math.sin(t)),
                vScale(k as Vec3, vDot(k, v) * (1 - Math.cos(t))),
            ),
        );
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createRotation(
    c: construction,
    name: string | null | undefined,
    center: point_object | null,
    point: point_object,
    angle: circle1_radius,
    axis?: primitive_line_object,
): rotation_object {
    return c.add(new rotation_object(c, name, center, point, angle, axis));
}
