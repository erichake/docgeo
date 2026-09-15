import type { construction } from "../construction";
import { vSub } from "../vec";
import type { point_object } from "./point_object";
import { primitive_circle_object } from "./primitive_circle_object";

export class circle_object extends primitive_circle_object {
    P1: point_object;
    P2: point_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        p2: point_object,
    ) {
        super(c, name);
        this.P1 = p1;
        this.P2 = p2;
        this.addParents(p1, p2);
    }

    computeGeometry(): void {
        if (!this.P1.defined || !this.P2.defined) {
            this.defined = false;
            return;
        }
        const direction = vSub(this.P2.coords, this.P1.coords);
        this.setCircle(
            this.P1.coords,
            Math.hypot(direction[0], direction[1]),
            [1, 0, 0],
            [0, 1, 0],
        );
    }
}

export function createCircle(
    c: construction,
    name: string | null | undefined,
    center: point_object,
    point: point_object,
): circle_object {
    return c.add(new circle_object(c, name, center, point));
}
