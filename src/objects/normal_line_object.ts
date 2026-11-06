import type { construction } from "../construction";
import { vAdd, vDot, vScale, vSub, type Vec3 } from "../vec";
import type { DgoContext } from "./construction_object";
import type { polygon_object } from "./polygon_object";
import type { point_object } from "./point_object";
import { primitive_line_object } from "./primitive_line_object";

// The line through P orthogonal to a plane.
export class normal_line_object extends primitive_line_object {
    PLANE: polygon_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        plane: polygon_object,
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
        return this.PLANE.spans ? this.PLANE.NORMAL : null;
    }

    // From P to its foot on the plane, so that it visibly crosses it; when
    // P is near the plane, centered on P, as long as half the plane's side.
    protected referenceSpan(): [Vec3, Vec3] | null {
        const p = this.P1.coords;
        const normal = this.PLANE.NORMAL;
        const distance = vDot(vSub(p, this.PLANE.CENTER), normal);
        const half = this.PLANE.HALF / 2;
        if (Math.abs(distance) >= half)
            return [p, vSub(p, vScale(normal, distance))];
        return [vSub(p, vScale(normal, half)), vAdd(p, vScale(normal, half))];
    }
}

export function createNormalLine(
    c: construction,
    name: string | null | undefined,
    plane: polygon_object,
    point: point_object,
): normal_line_object {
    return c.add(new normal_line_object(c, name, plane, point));
}
