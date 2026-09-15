import type { construction } from "../construction";
import { numEqual, vCross, vNormalize, vSub, type Vec3 } from "../vec";
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

    computeVEC(): Vec3 | null {
        if (!this.D.defined) return null;
        const v = this.D.VEC,
            p = this.D.P1.coords,
            m = this.P1.coords;

        if (numEqual(v[2], 0) && numEqual(m[2], p[2])) {
            return vNormalize([v[1], -v[0], 0]);
        }

        const w = vSub(m, p);
        return vNormalize(vCross(v, vCross(v, w)));
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
