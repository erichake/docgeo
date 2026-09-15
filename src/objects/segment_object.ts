import type { construction } from "../construction";
import { geometryTolerance, vNorm, vNormalize, vSub } from "../vec";
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

    project(): void {
        super.project();
        if (
            !this.defined ||
            !this.projectionDefined ||
            !this.P2.projectionDefined
        ) {
            this.projectionDefined = false;
            return;
        }
        this.sP1 = this.P1.screen;
        this.sP2 = this.P2.screen;
        this.projectionDefined = vNormalize(vSub(this.sP2, this.sP1)) !== null;
    }

    insideBounds(parameter: number): boolean {
        const length = vNorm(vSub(this.P2.coords, this.P1.coords));
        const tolerance = geometryTolerance(length);
        return parameter >= -tolerance && parameter <= length + tolerance;
    }
}

export function createSegment(
    c: construction,
    name: string | null | undefined,
    p1: point_object,
    p2: point_object,
): segment_object {
    return c.add(new segment_object(c, name, p1, p2));
}
