import type { construction } from "../construction";
import { point_object } from "./point_object";
import type { primitive_circle_object } from "./primitive_circle_object";

export class center_object extends point_object {
    moveable = false;
    circle: primitive_circle_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        circle: primitive_circle_object,
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.circle = circle;
        this.addParents(circle);
    }

    computeGeometry(): void {
        if (!this.circle.defined) {
            this.defined = false;
            return;
        }
        this.coords = this.circle.CENTER;
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createCenter(
    c: construction,
    name: string | null | undefined,
    circle: primitive_circle_object,
): center_object {
    return c.add(new center_object(c, name, circle));
}
