import type { construction } from "../construction";
import {
    vAdd,
    vCross,
    vDot,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec3,
} from "../vec";
import type { DgoContext } from "./construction_object";
import { polygon_object } from "./polygon_object";
import { primitive_circle_object } from "./primitive_circle_object";
import type { sphere_object } from "./sphere_object";

// Where a plane cuts a sphere, or where two spheres meet: in the plane
// orthogonal to their centers' line where the powers of its points with
// respect to both are equal.
export class sphere_section_object extends primitive_circle_object {
    sphere: sphere_object;
    other: polygon_object | sphere_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        sphere: sphere_object,
        other: polygon_object | sphere_object,
    ) {
        super(c, name);
        this.sphere = sphere;
        this.other = other;
        this.addParents(sphere, other);
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["SphC", [this.sphere, this.other].map(context.index)];
    }

    computeGeometry(): void {
        const { sphere, other } = this;
        const o = sphere.CENTER;
        let normal: Vec3 | null;
        let center: Vec3;
        if (other instanceof polygon_object) {
            normal = other.NORMAL;
            center = vAdd(
                o,
                vScale(normal, vDot(normal, vSub(other.CENTER, o))),
            );
        } else {
            const axis = vSub(other.CENTER, o);
            const square = vDot(axis, axis);
            normal = vNormalize(axis);
            center = vAdd(
                o,
                vScale(
                    axis,
                    (square + sphere.R ** 2 - other.R ** 2) / (2 * square),
                ),
            );
        }
        const radius = Math.sqrt(sphere.R ** 2 - vNorm(vSub(center, o)) ** 2);
        const u =
            normal &&
            (vNormalize(vCross(normal, [0, 0, 1])) ??
                vNormalize(vCross(normal, [1, 0, 0])));
        if (!sphere.defined || !other.defined || !normal || !u) {
            this.defined = false;
            return;
        }
        this.setCircle(center, radius, u, vCross(normal, u));
    }
}

export function createSphereSection(
    c: construction,
    name: string | null | undefined,
    sphere: sphere_object,
    other: polygon_object | sphere_object,
): sphere_section_object {
    return c.add(new sphere_section_object(c, name, sphere, other));
}
