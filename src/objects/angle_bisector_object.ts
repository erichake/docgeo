import type { construction } from "../construction";
import {
    geometryTolerance,
    vAdd,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec3,
} from "../vec";
import type { DgoContext } from "./construction_object";
import type { point_object } from "./point_object";
import { primitive_line_object } from "./primitive_line_object";

export class angle_bisector_object extends primitive_line_object {
    A1: point_object;
    A2: point_object;
    protected oneSided = true;

    constructor(
        c: construction,
        name: string | null | undefined,
        vertex: point_object,
        a1: point_object,
        a2: point_object,
    ) {
        super(c, name, vertex, "ray");
        this.A1 = a1;
        this.A2 = a2;
        this.addParents(a1, a2);
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["Bis", [this.A1, this.P1, this.A2].map(context.index)];
    }

    computeVEC(): Vec3 | null {
        if (!this.A1.defined || !this.A2.defined) return null;
        const u1 = vNormalize(vSub(this.A1.coords, this.P1.coords));
        const u2 = vNormalize(vSub(this.A2.coords, this.P1.coords));
        if (!u1 || !u2) return null;
        return vNormalize(vAdd(u1, u2));
    }

    insideBounds(parameter: number): boolean {
        const scale = Math.max(
            vNorm(vSub(this.A1.coords, this.P1.coords)),
            vNorm(vSub(this.A2.coords, this.P1.coords)),
        );
        return parameter >= -geometryTolerance(scale);
    }

    // As long as the farther side of the angle.
    protected referenceSpan(): [Vec3, Vec3] | null {
        const length = Math.max(
            vNorm(vSub(this.A1.coords, this.P1.coords)),
            vNorm(vSub(this.A2.coords, this.P1.coords)),
        );
        return [this.P1.coords, vAdd(this.P1.coords, vScale(this.VEC, length))];
    }
}

export function createAngleBisector(
    c: construction,
    name: string | null | undefined,
    vertex: point_object,
    a1: point_object,
    a2: point_object,
): angle_bisector_object {
    return c.add(new angle_bisector_object(c, name, vertex, a1, a2));
}
