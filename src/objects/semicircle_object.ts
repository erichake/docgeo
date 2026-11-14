import type { construction } from "../construction";
import {
    geometryTolerance,
    vAdd,
    vCross,
    vDot,
    vNorm,
    vScale,
    vSub,
} from "../vec";
import type { DgoContext } from "./construction_object";
import type { point_object } from "./point_object";
import type { polygon_object } from "./polygon_object";
import { primitive_arc_object } from "./primitive_arc_object";

// The half of the circle of diameter [AB] on the left of AB, clockwise
// from A to B; given a plane, in it, on the left around its normal.
export class semicircle_object extends primitive_arc_object {
    A: point_object;
    B: point_object;
    support?: polygon_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        a: point_object,
        b: point_object,
        plane?: polygon_object,
    ) {
        super(c, name, false);
        this.A = a;
        this.B = b;
        this.support = plane;
        this.addParents(a, b, ...(plane ? [plane] : []));
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "Semi",
            [this.A, this.B, ...(this.support ? [this.support] : [])].map(
                context.index,
            ),
        ];
    }

    computeGeometry(): void {
        const d = vSub(this.B.coords, this.A.coords);
        const [u, v] = this.support
            ? [d, vCross(this.support.NORMAL, d)].map((w) =>
                  vScale(w, 1 / vNorm(d)),
              )
            : this.plane;
        const radius = Math.hypot(vDot(d, u), vDot(d, v)) / 2;
        if (
            !this.A.defined ||
            !this.B.defined ||
            this.support?.defined === false ||
            !(radius > geometryTolerance(...this.A.coords))
        ) {
            this.defined = false;
            return;
        }
        this.setCircle(
            vScale(vAdd(this.A.coords, this.B.coords), 0.5),
            radius,
            u,
            v,
        );
        this.setArc(this.A.coords, this.B.coords, false);
    }
}

export function createSemicircle(
    c: construction,
    name: string | null | undefined,
    a: point_object,
    b: point_object,
    plane?: polygon_object,
): semicircle_object {
    return c.add(new semicircle_object(c, name, a, b, plane));
}
