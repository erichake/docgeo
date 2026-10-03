import type { construction } from "../construction";
import {
    numEqual,
    vAdd,
    vCross,
    vDot,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec3,
} from "../vec";
import type { DgoContext } from "./construction_object";
import type { point_object } from "./point_object";
import { primitive_line_object } from "./primitive_line_object";

export class plumb_line_object extends primitive_line_object {
    D: primitive_line_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        d: primitive_line_object,
    ) {
        super(c, name, p1, "plumb");
        this.D = d;
        this.addParents(d);
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["Perp", [this.D, this.P1].map(context.index)];
    }

    computeVEC(): Vec3 | null {
        if (!this.D.defined) return null;
        const v = this.D.VEC,
            p = this.D.P1.coords,
            m = this.P1.coords;

        // As in DGPad, D's direction turned a quarter counterclockwise in its
        // plane, which P1 may lie on D in: the screen plane (see
        // GRID.FRAME2D), or a horizontal one.
        if (this.C.GRID.FRAME2D && this.flat) {
            const [right, up] = this.C.screenPlaneBasis;
            return vNormalize(vCross(vCross(right, up), v));
        }
        if (numEqual(v[2], 0) && numEqual(m[2], p[2])) {
            return vNormalize(vCross([0, 0, 1], v));
        }

        const w = vSub(m, p);
        return vNormalize(vCross(v, vCross(v, w)));
    }

    // The point it passes through, and the foot of the perpendicular on D
    // (the point where this line actually crosses D). When P1 is itself
    // (already) on D — e.g. Perpendicular(I, B) where B defines I — that
    // foot coincides with P1, leaving no natural span; borrow D's own
    // scale instead, centered on P1, like Parallel does.
    protected referenceSpan(): [Vec3, Vec3] | null {
        if (!this.D.defined) return null;
        const foot = vAdd(
            this.D.P1.coords,
            vScale(
                this.D.VEC,
                vDot(vSub(this.P1.coords, this.D.P1.coords), this.D.VEC),
            ),
        );
        const scale = this.D.characteristicLength();
        if (vNorm(vSub(foot, this.P1.coords)) >= scale)
            return [this.P1.coords, foot];
        const half = vScale(this.VEC, scale / 2);
        return [vSub(this.P1.coords, half), vAdd(this.P1.coords, half)];
    }
}

export function createPlumb(
    c: construction,
    name: string | null | undefined,
    p1: point_object,
    d: primitive_line_object,
): plumb_line_object {
    return c.add(new plumb_line_object(c, name, p1, d));
}
