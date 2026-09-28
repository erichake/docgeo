import type { construction } from "../construction";
import {
    geometryTolerance,
    numEqual,
    vAdd,
    vCross,
    vDot,
    vNorm,
    vScale,
    vSub,
} from "../vec";
import type { DgoContext } from "./construction_object";
import type { point_object } from "./point_object";
import { primitive_circle_object } from "./primitive_circle_object";

// The circle through three points: horizontal, as DGPad's Circle3pts, or
// in their own plane, as its Circle3pts3D (`space`).
export class circle3pts_object extends primitive_circle_object {
    P1: point_object;
    P2: point_object;
    P3: point_object;
    space: boolean;

    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        p2: point_object,
        p3: point_object,
        space = false,
    ) {
        super(c, name);
        this.P1 = p1;
        this.P2 = p2;
        this.P3 = p3;
        this.space = space;
        this.addParents(p1, p2, p3);
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            this.space ? "C3s" : "C3p",
            [this.P1, this.P2, this.P3].map(context.index),
        ];
    }

    computeGeometry(): void {
        if (!this.P1.defined || !this.P2.defined || !this.P3.defined) {
            this.defined = false;
            return;
        }
        if (this.space) {
            this.computeInSpace();
            return;
        }
        if (
            !numEqual(this.P1.z, this.P2.z) ||
            !numEqual(this.P1.z, this.P3.z)
        ) {
            this.defined = false;
            return;
        }
        const [ax, ay] = this.P1.coords;
        const [bx, by] = this.P2.coords;
        const [cx, cy] = this.P3.coords;
        const abx = bx - ax;
        const aby = by - ay;
        const acx = cx - ax;
        const acy = cy - ay;
        const denominator = 2 * (abx * acy - aby * acx);
        const scale = Math.hypot(abx, aby) * Math.hypot(acx, acy);
        if (Math.abs(denominator) <= 2 * geometryTolerance(scale)) {
            this.defined = false;
            return;
        }
        const ab2 = abx * abx + aby * aby;
        const ac2 = acx * acx + acy * acy;
        const center: [number, number, number] = [
            ax + (acy * ab2 - aby * ac2) / denominator,
            ay + (abx * ac2 - acx * ab2) / denominator,
            this.P1.z,
        ];
        this.setCircle(
            center,
            Math.hypot(center[0] - ax, center[1] - ay),
            [1, 0, 0],
            [0, 1, 0],
        );
    }

    private computeInSpace(): void {
        const a = this.P1.coords;
        const u = vSub(this.P2.coords, a);
        const v = vSub(this.P3.coords, a);
        const normal = vCross(u, v);
        const normal2 = vDot(normal, normal);
        const scale = vNorm(u) * vNorm(v);
        if (Math.sqrt(normal2) <= geometryTolerance(scale)) {
            this.defined = false;
            return;
        }
        const center = vAdd(
            a,
            vScale(
                vAdd(
                    vScale(vCross(v, normal), vDot(u, u)),
                    vScale(vCross(normal, u), vDot(v, v)),
                ),
                1 / (2 * normal2),
            ),
        );
        this.setCircle(center, vNorm(vSub(a, center)), u, vCross(normal, u));
    }
}

export function createCircle3pts(
    c: construction,
    name: string | null | undefined,
    p1: point_object,
    p2: point_object,
    p3: point_object,
    space = false,
): circle3pts_object {
    return c.add(new circle3pts_object(c, name, p1, p2, p3, space));
}
