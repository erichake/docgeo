import type { construction } from "../construction";
import {
    geometryTolerance,
    vAdd,
    vNorm,
    vNormalize,
    vSub,
    type Vec3,
} from "../vec";
import type { point_object } from "./point_object";
import { primitive_line_object } from "./primitive_line_object";

export class angle_bisector_object extends primitive_line_object {
    A1: point_object;
    A2: point_object;

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

    project(): void {
        super.project();
        if (!this.defined || !this.projectionDefined) return;
        this.sP1 = this.P1.screen;
        const [, point3D2] = this.extendedPoints();
        this.updateHiddenSplit(this.P1.coords, point3D2);
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
