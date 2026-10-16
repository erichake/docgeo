import type { construction } from "../construction";
import { vAdd, vCross, vDot, vNorm, vNormalize, vScale, vSub } from "../vec";
import { axisBasis } from "./circle1_object";
import type { DgoContext } from "./construction_object";
import type { point_object } from "./point_object";
import { primitive_circle_object } from "./primitive_circle_object";
import type { primitive_line_object } from "./primitive_line_object";

// The circle of axis d through P: P turned around d (GeoGebra's
// Circle(d, P)).
export class axis_circle_object extends primitive_circle_object {
    AXIS: primitive_line_object;
    P1: point_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        axis: primitive_line_object,
        point: point_object,
    ) {
        super(c, name);
        this.AXIS = axis;
        this.P1 = point;
        this.addParents(axis, point);
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["CAx", [this.AXIS, this.P1].map(context.index)];
    }

    computeGeometry(): void {
        const normal = this.AXIS.defined && vNormalize(this.AXIS.VEC);
        if (!normal || !this.P1.defined) {
            this.defined = false;
            return;
        }
        const p = this.P1.coords;
        const a = this.AXIS.P1.coords;
        const center = vAdd(a, vScale(normal, vDot(vSub(p, a), normal)));
        const radius = vSub(p, center);
        // From the center to P, its angle 0.
        const u = vNormalize(radius) ?? axisBasis(normal);
        this.setCircle(center, vNorm(radius), u, vCross(normal, u));
    }
}

export function createAxisCircle(
    c: construction,
    name: string | null | undefined,
    axis: primitive_line_object,
    point: point_object,
): axis_circle_object {
    return c.add(new axis_circle_object(c, name, axis, point));
}
