import type { construction } from "../construction";
import {
    vAdd,
    vCross,
    vDot,
    vNormalize,
    vScale,
    vSub,
    type Vec3,
} from "../vec";
import type { DgoContext } from "./construction_object";
import type { plane_object } from "./plane_object";
import { point_object } from "./point_object";
import { primitive_line_object } from "./primitive_line_object";

// Where two planes meet, from the foot of their centers' midpoint, drawn as
// far as the planes are wide, so its tips frame them.
export class plane_line_object extends primitive_line_object {
    planes: [plane_object, plane_object];
    private reach: Vec3 = [0, 0, 0];

    constructor(
        c: construction,
        name: string | null | undefined,
        planes: [plane_object, plane_object],
    ) {
        super(c, name, new point_object(c, null, [0, 0, 0]));
        this.planes = planes;
        this.addParents(...planes);
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["PlPl", this.planes.map(context.index)];
    }

    computeVEC(): Vec3 | null {
        const [p, q] = this.planes;
        if (!p.defined || !q.defined) return null;
        const direction = vNormalize(vCross(p.NORMAL, q.NORMAL));
        if (!direction) return null;
        const across = vCross(p.NORMAL, direction);
        const onBoth = vAdd(
            p.CENTER,
            vScale(
                across,
                vDot(q.NORMAL, vSub(q.CENTER, p.CENTER)) /
                    vDot(q.NORMAL, across),
            ),
        );
        const middle = vScale(vAdd(p.CENTER, q.CENTER), 0.5);
        this.P1.coords = vAdd(
            onBoth,
            vScale(direction, vDot(vSub(middle, onBoth), direction)),
        );
        this.P1.computeGeometry();
        this.reach = vScale(direction, (p.HALF + q.HALF) / 2);
        return direction;
    }

    project(): void {
        this.P1.project();
        super.project();
    }

    protected referenceSpan(): [Vec3, Vec3] | null {
        return [
            vSub(this.P1.coords, this.reach),
            vAdd(this.P1.coords, this.reach),
        ];
    }
}

export function createPlaneLine(
    c: construction,
    name: string | null | undefined,
    planes: [plane_object, plane_object],
): plane_line_object {
    return c.add(new plane_line_object(c, name, planes));
}
