import type { construction } from "../construction";
import { numEqual, vIsNull, vNormalize, vSub, type Vec3 } from "../vec";
import type { point_object } from "./point_object";
import { primitive_line_object } from "./primitive_line_object";

export class plumb_line_object extends primitive_line_object {
    D: primitive_line_object;

    constructor(c: construction, name: string | null | undefined, p1: point_object, d: primitive_line_object) {
        super(c, name, p1, "plumb");
        this.D = d;
        this.addParents(d);
        this.createSVG(); // init this.dom
    }

    computeVEC(): void {
        const v = this.D.VEC,
            p = this.D.P1.coords,
            m = this.P1.coords;

        // test if p, p+v and m are in the same z-plane :
        if (numEqual(v[2], 0) && numEqual(m[2], p[2])) {
            this.VEC = [v[1], -v[0], 0];
        } else {
            const w = vSub(m, p); // vector PM coordinates
            // cross product v ^ w :
            const c: Vec3 = [v[1] * w[2] - v[2] * w[1], v[2] * w[0] - v[0] * w[2], v[0] * w[1] - v[1] * w[0]];
            // cross product v ^ c :
            const d: Vec3 = [v[1] * c[2] - v[2] * c[1], v[2] * c[0] - v[0] * c[2], v[0] * c[1] - v[1] * c[0]];

            this.VEC = vIsNull(d) ? [0, 0, 0] : vNormalize(d);
        }
    }

    static create(c: construction, name: string | null | undefined, p1: point_object, d: primitive_line_object): plumb_line_object {
        return c.add(new plumb_line_object(c, name, p1, d)) as plumb_line_object;
    }
}
