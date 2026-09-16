import type { construction } from "../construction";
import type { Vec3 } from "../vec";
import { point_object } from "./point_object";

export class fixed_point_object extends point_object {
    mousedrag(_ev: PointerEvent): void {}
}

export function createFixedPoint(
    c: construction,
    name: string | null | undefined,
    pt: Vec3,
): fixed_point_object {
    return c.add(new fixed_point_object(c, name, pt));
}
