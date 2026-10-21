import type { segment_object } from "./segment_object";
import type { construction } from "../construction";
import { vAdd, vScale } from "../vec";
import type { DgoContext } from "./construction_object";
import { point_object } from "./point_object";

export class midpoint_object extends point_object {
    moveable = false;
    side?: segment_object;
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

    dgo(context: DgoContext): [string, unknown] {
        if (this.side) return ["Mid", [context.index(this.side)]];
        return ["Mid", [this.P1, this.P2].map(context.index)];
    }

    computeGeometry(): void {
        if (this.side) {
            if (!this.side.defined) {
                this.defined = false;
                return;
            }
            [this.P1, this.P2] = [this.side.P1, this.side.P2];
        }
        if (!this.P1.defined || !this.P2.defined) {
            this.defined = false;
            return;
        }
        this.coords = vScale(vAdd(this.P1.coords, this.P2.coords), 0.5);
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createMidpoint(
    c: construction,
    name: string | null | undefined,
    p1: point_object,
    p2: point_object,
): midpoint_object {
    return c.add(new midpoint_object(c, name, p1, p2));
}
