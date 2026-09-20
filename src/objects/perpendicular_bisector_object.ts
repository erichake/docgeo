import type { construction } from "../construction";
import { vAdd, vNorm, vNormalize, vScale, vSub, type Vec3 } from "../vec";
import { point_object } from "./point_object";
import { primitive_line_object } from "./primitive_line_object";

export class perpendicular_bisector_object extends primitive_line_object {
    A1: point_object;
    A2: point_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        a1: point_object,
        a2: point_object,
    ) {
        super(c, name, new point_object(c, null, [0, 0, 0]));
        this.A1 = a1;
        this.A2 = a2;
        this.addParents(a1, a2);
    }

    computeVEC(): Vec3 | null {
        if (!this.A1.defined || !this.A2.defined) return null;
        this.P1.coords = vScale(vAdd(this.A1.coords, this.A2.coords), 0.5);
        this.P1.computeGeometry();
        return vNormalize([this.A1.y - this.A2.y, this.A2.x - this.A1.x, 0]);
    }

    project(): void {
        this.P1.project();
        super.project();
    }

    // As wide as the segment it bisects, centered on the midpoint.
    protected referenceSpan(): [Vec3, Vec3] | null {
        if (!this.A1.defined || !this.A2.defined) return null;
        const half = vScale(this.VEC, vNorm(vSub(this.A2.coords, this.A1.coords)) / 2);
        return [vSub(this.P1.coords, half), vAdd(this.P1.coords, half)];
    }
}

export function createPerpendicularBisector(
    c: construction,
    name: string | null | undefined,
    a1: point_object,
    a2: point_object,
): perpendicular_bisector_object {
    return c.add(new perpendicular_bisector_object(c, name, a1, a2));
}
