import type { construction } from "../construction";
import type { PrefKey } from "../preferences";
import { vNormalize, vSub } from "../vec";
import type { point_object } from "./point_object";
import { primitive_line_object } from "./primitive_line_object";

export class two_points_line_object extends primitive_line_object {
    P2: point_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        p2: point_object,
        type?: PrefKey,
    ) {
        super(c, name, p1, type);
        this.VEC = vNormalize(vSub(p2.coords, p1.coords));
        this.P2 = p2;
        this.addParents(p2);
        this.createSVG(); // init this.dom
    }

    computeVEC(): void {
        this.VEC = vNormalize(vSub(this.P2.coords, this.P1.coords));
    }

    static create(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        p2: point_object,
    ): two_points_line_object {
        return c.add(
            new two_points_line_object(c, name, p1, p2),
        ) as two_points_line_object;
    }
}
