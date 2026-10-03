import type { construction } from "../construction";
import { vAdd, vSub } from "../vec";
import type { DgoContext } from "./construction_object";
import type { point_object } from "./point_object";
import { primitive_circle_object } from "./primitive_circle_object";

export class circle3_object extends primitive_circle_object {
    P1: point_object;
    P2: point_object;
    P3: point_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        p3: point_object,
        p2: point_object,
        p1: point_object,
    ) {
        super(c, name);
        this.P1 = p1;
        this.P2 = p2;
        this.P3 = p3;
        this.addParents(p1, p2, p3);
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["C3", [this.P3, this.P2, this.P1].map(context.index)];
    }

    computeGeometry(): void {
        if (!this.P1.defined || !this.P2.defined || !this.P3.defined) {
            this.defined = false;
            return;
        }
        this.setPlaneCircle(
            this.P1.coords,
            vAdd(this.P1.coords, vSub(this.P2.coords, this.P3.coords)),
        );
    }
}

export function createCircle3(
    c: construction,
    name: string | null | undefined,
    radiusPoint1: point_object,
    radiusPoint2: point_object,
    center: point_object,
): circle3_object {
    return c.add(
        new circle3_object(c, name, radiusPoint1, radiusPoint2, center),
    );
}
