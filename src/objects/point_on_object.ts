import type { construction } from "../construction";
import { vAdd, vDot, vScale, vSub, type Vec3 } from "../vec";
import { primitive_circle_object } from "./primitive_circle_object";
import { primitive_line_object } from "./primitive_line_object";
import { point_object } from "./point_object";
import { quadric5pts_object } from "./quadric5pts_object";
import { ray_line_object } from "./ray_line_object";
import { segment_object } from "./segment_object";
import { two_points_line_object } from "./two_points_line_object";

export type point_support_object =
    primitive_line_object | primitive_circle_object | quadric5pts_object;

type Alpha = number | readonly [number, number];

export class point_on_object extends point_object {
    support: point_support_object;
    alpha: Alpha;

    constructor(
        c: construction,
        name: string | null | undefined,
        support: point_support_object,
        alpha: Alpha,
    ) {
        super(c, name, [0, 0, 0]);
        this.support = support;
        this.alpha = alpha;
        this.addParents(support);
    }

    computeGeometry(): void {
        if (!this.support.defined) {
            this.defined = false;
            return;
        }
        if (this.support instanceof primitive_circle_object) {
            this.coords = this.support.pointAt(this.alpha as number);
        } else if (this.support instanceof quadric5pts_object) {
            this.coords = this.support.pointAt(
                this.alpha as readonly [number, number],
            );
        } else if (this.support instanceof two_points_line_object) {
            this.coords = vAdd(
                this.support.P1.coords,
                vScale(
                    vSub(this.support.P2.coords, this.support.P1.coords),
                    this.alpha as number,
                ),
            );
        } else {
            this.coords = vAdd(
                this.support.P1.coords,
                vScale(this.support.VEC, this.alpha as number),
            );
        }
        super.computeGeometry();
    }

    mousedrag(ev: PointerEvent): void {
        const target = this.C.unprojectToZPlane(
            this.C.pointerPosition(ev),
            this.z,
        );
        if (!target) return;
        this.alpha = this.alphaFor(target);
        this.C.invalidateGeometry(this);
    }

    private alphaFor(target: Vec3): Alpha {
        if (this.support instanceof primitive_circle_object) {
            return this.support.alphaOf(target);
        }
        if (this.support instanceof quadric5pts_object) {
            return this.support.alphaOf(target);
        }
        if (this.support instanceof two_points_line_object) {
            const direction = vSub(
                this.support.P2.coords,
                this.support.P1.coords,
            );
            let alpha =
                vDot(vSub(target, this.support.P1.coords), direction) /
                vDot(direction, direction);
            if (this.support instanceof segment_object) {
                alpha = Math.max(0, Math.min(1, alpha));
            } else if (this.support instanceof ray_line_object) {
                alpha = Math.max(0, alpha);
            }
            return alpha;
        }
        return vDot(vSub(target, this.support.P1.coords), this.support.VEC);
    }
}

export function createPointOn(
    c: construction,
    name: string | null | undefined,
    support: point_support_object,
    alpha: Alpha,
): point_on_object {
    return c.add(new point_on_object(c, name, support, alpha));
}
