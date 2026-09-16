import type { construction } from "../construction";
import { geometryTolerance, vNorm, vSub } from "../vec";
import type { point_object } from "./point_object";
import { two_points_line_object } from "./two_points_line_object";

export class ray_line_object extends two_points_line_object {
    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        p2: point_object,
    ) {
        super(c, name, p1, p2, "ray");
    }

    project(): void {
        super.project();
        if (!this.defined || !this.projectionDefined) return;
        this.sP1 = this.P1.screen;
        const [, point3D2] = this.extendedPoints();
        this.updateHiddenSplit(this.P1.coords, point3D2);
    }

    insideBounds(parameter: number): boolean {
        const scale = vNorm(vSub(this.P2.coords, this.P1.coords));
        return parameter >= -geometryTolerance(scale);
    }
}

export function createRay(
    c: construction,
    name: string | null | undefined,
    p1: point_object,
    p2: point_object,
): ray_line_object {
    return c.add(new ray_line_object(c, name, p1, p2));
}
