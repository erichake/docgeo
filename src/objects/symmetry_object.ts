import type { construction } from "../construction";
import { vScale, vSub } from "../vec";
import { point_object } from "./point_object";

export class symmetry_object extends point_object {
    moveable = false;
    center: point_object;
    point: point_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        center: point_object,
        point: point_object,
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.center = center;
        this.point = point;
        this.addParents(center, point);
    }

    computeGeometry(): void {
        if (!this.center.defined || !this.point.defined) {
            this.defined = false;
            return;
        }
        this.coords = vSub(vScale(this.center.coords, 2), this.point.coords);
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createSymmetry(
    c: construction,
    name: string | null | undefined,
    center: point_object,
    point: point_object,
): symmetry_object {
    return c.add(new symmetry_object(c, name, center, point));
}
