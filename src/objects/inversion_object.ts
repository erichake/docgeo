import type { construction } from "../construction";
import { vAdd, vDot, vScale, vSub } from "../vec";
import type { construction_object, DgoContext } from "./construction_object";
import { point_object } from "./point_object";
import type { primitive_circle_object } from "./primitive_circle_object";
import {
    createTransformed,
    imageLook,
    type transformable,
} from "./transformed_object";

// The inverse of P in a circle of center M and radius r: on [MP), at r²/MP
// from M.
export class inversion_object extends point_object {
    moveable = false;
    circle: primitive_circle_object;
    point: point_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        circle: primitive_circle_object,
        point: point_object,
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.circle = circle;
        this.point = point;
        this.addParents(circle, point);
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["Inv", [this.circle, this.point].map(context.index)];
    }

    computeGeometry(): void {
        const { circle } = this;
        const v = vSub(this.point.coords, circle.CENTER);
        const square = vDot(v, v);
        if (!circle.defined || !this.point.defined || !(square > 0)) {
            this.defined = false;
            return;
        }
        this.coords = vAdd(
            circle.CENTER,
            vScale(v, (circle.R * circle.R) / square),
        );
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

// The inverse of a point, or the image of an object, `straight` when a line
// or a circle through the center is mapped to a line (see TRANSFORMATIONS.md).
export function createInversion(
    c: construction,
    name: string | null | undefined,
    circle: primitive_circle_object,
    source: point_object | transformable,
    straight = false,
): construction_object {
    if (source instanceof point_object)
        return c.add(new inversion_object(c, name, circle, source));
    return createTransformed(
        c,
        name,
        source,
        (point) => new inversion_object(c, null, circle, point),
        {
            look: imageLook(source, straight),
            pole: () => circle.CENTER,
            mark: straight ? 1 : undefined,
        },
    );
}
