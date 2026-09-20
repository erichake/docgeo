import type { construction } from "../construction";
import { vAdd, vScale, vSub, type Vec3 } from "../vec";
import type { point_object } from "./point_object";
import { primitive_line_object } from "./primitive_line_object";

export class parallel_line_object extends primitive_line_object {
    D: primitive_line_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        d: primitive_line_object,
    ) {
        super(c, name, p1, "parallel");
        this.D = d;
        this.addParents(d);
    }

    computeVEC(): Vec3 | null {
        return this.D.defined ? this.D.VEC : null;
    }

    // A parallel line has no point in common with D, so it borrows D's own
    // scale and centers a span of that length on P1.
    protected referenceSpan(): [Vec3, Vec3] | null {
        if (!this.D.defined) return null;
        const half = vScale(this.VEC, this.D.characteristicLength() / 2);
        return [vSub(this.P1.coords, half), vAdd(this.P1.coords, half)];
    }
}

export function createParallel(
    c: construction,
    name: string | null | undefined,
    p1: point_object,
    d: primitive_line_object,
): parallel_line_object {
    return c.add(new parallel_line_object(c, name, p1, d));
}
