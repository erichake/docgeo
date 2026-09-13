import type { construction } from "../construction";
import type { point_object } from "./point_object";
import { two_points_line_object } from "./two_points_line_object";

export class ray_line_object extends two_points_line_object {
    constructor(c: construction, name: string | null | undefined, p1: point_object, p2: point_object) {
        super(c, name, p1, p2, "ray");
    }

    compute(): void {
        super.compute();
        this.sP1 = this.P1.screen;
    }

    static create(c: construction, name: string | null | undefined, p1: point_object, p2: point_object): ray_line_object {
        return c.add(new ray_line_object(c, name, p1, p2)) as ray_line_object;
    }
}
