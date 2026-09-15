import type { construction } from "../construction";
import { geometryTolerance, numEqual } from "../vec";
import type { point_object } from "./point_object";
import { primitive_circle_object } from "./primitive_circle_object";

export class circle3pts_object extends primitive_circle_object {
    P1: point_object;
    P2: point_object;
    P3: point_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        p2: point_object,
        p3: point_object,
    ) {
        super(c, name);
        this.P1 = p1;
        this.P2 = p2;
        this.P3 = p3;
        this.addParents(p1, p2, p3);
    }

    computeGeometry(): void {
        if (!this.P1.defined || !this.P2.defined || !this.P3.defined) {
            this.defined = false;
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
}

export function createCircle3pts(
    c: construction,
    name: string | null | undefined,
    p1: point_object,
    p2: point_object,
    p3: point_object,
): circle3pts_object {
    return c.add(new circle3pts_object(c, name, p1, p2, p3));
}
