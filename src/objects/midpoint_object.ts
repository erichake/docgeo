import type { construction } from "../construction";
import { vAdd, vScale } from "../vec";
import { point_object } from "./point_object";

// @ts-expect-error - static `create` intentionally has a different signature than
// point_object's (each construction_object subtype has its own factory args).
export class midpoint_object extends point_object {
    P1: point_object;
    P2: point_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        p2: point_object,
    ) {
        super(c, name, [0, 0, 0], "midpoint");
        this.P1 = p1;
        this.P2 = p2;
        this.addParents(p1, p2);
    }

    compute(): void {
        if (!this.P1.defined || !this.P2.defined) {
            this.defined = false;
            return;
        }
        this.coords = vScale(vAdd(this.P1.coords, this.P2.coords), 0.5);
        super.compute();
    }

    mousedrag(_ev: PointerEvent): void {}

    static create(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        p2: point_object,
    ): midpoint_object {
        return c.add(new midpoint_object(c, name, p1, p2)) as midpoint_object;
    }
}
