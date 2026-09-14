import type { construction } from "../construction";
import type { point_object } from "./point_object";
import { two_points_line_object } from "./two_points_line_object";

export class segment_object extends two_points_line_object {
    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        p2: point_object,
    ) {
        super(c, name, p1, p2, "segment");
    }

    static create(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        p2: point_object,
    ): segment_object {
        return c.add(new segment_object(c, name, p1, p2)) as segment_object;
    }

    compute(): void {
        this.computeVEC();
        this.sP1 = this.P1.screen;
        this.sP2 = this.P2.screen;
    }
}
