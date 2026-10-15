import type { construction } from "../construction";
import { vAdd, type Vec3 } from "../vec";
import type { DgoContext } from "./construction_object";
import type { plane_object } from "./plane_object";
import type { point_object } from "./point_object";
import { primitive_line_object } from "./primitive_line_object";

// The line through P orthogonal to a plane.
export class normal_line_object extends primitive_line_object {
    PLANE: plane_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        plane: plane_object,
        point: point_object,
    ) {
        super(c, name, point);
        this.PLANE = plane;
        this.addParents(plane);
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["Nrm", [this.PLANE, this.P1].map(context.index)];
    }

    computeVEC(): Vec3 | null {
        return this.PLANE.defined ? this.PLANE.NORMAL : null;
    }

    protected referenceSpan(): [Vec3, Vec3] | null {
        return [this.P1.coords, vAdd(this.P1.coords, this.PLANE.NORMAL)];
    }
}

export function createNormalLine(
    c: construction,
    name: string | null | undefined,
    plane: plane_object,
    point: point_object,
): normal_line_object {
    return c.add(new normal_line_object(c, name, plane, point));
}
