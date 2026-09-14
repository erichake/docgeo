import type { construction } from "../construction";
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
        this.createSVG(); // init this.dom
    }

    computeVEC(): void {
        this.VEC = this.D.VEC;
    }

    static create(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        d: primitive_line_object,
    ): parallel_line_object {
        return c.add(
            new parallel_line_object(c, name, p1, d),
        ) as parallel_line_object;
    }
}
