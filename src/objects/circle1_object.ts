import type { construction } from "../construction";
import type { point_object } from "./point_object";
import { primitive_circle_object } from "./primitive_circle_object";

export class circle1_object extends primitive_circle_object {
    P1: point_object;
    radius: number;

    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        radius: number,
    ) {
        super(c, name);
        this.P1 = p1;
        this.radius = radius;
        this.addParents(p1);
    }

    computeGeometry(): void {
        if (!this.P1.defined) {
            this.defined = false;
            return;
        }
        this.setCircle(this.P1.coords, this.radius, [1, 0, 0], [0, 1, 0]);
    }
}

export function createCircle1(
    c: construction,
    name: string | null | undefined,
    center: point_object,
    radius: number,
): circle1_object {
    return c.add(new circle1_object(c, name, center, radius));
}
