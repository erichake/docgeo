import type { construction } from "../construction";
import { vAdd, vCross, vDot, vScale, vSub, type Vec3 } from "../vec";
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
        const [a, b, c] = [this.P1, this.P2, this.P3].map(
            (point) => point.coords,
        );
        if (this.space) this.setCircleInSpace(a, b, c);
        else this.setCircleThrough(a, b, c);
    }

    // DGPad's Circle3pts3D point number `index`, its parameter: on the arcs
    // from P1 to P2, P2 to P3 then P3 to P1, each without the third point,
    // sampled by its barycentric equation, the last one beyond.
    dgpadSample(index: number): Vec3 {
        const i = Math.min(index, 3 * SAMPLES - 1);
        const arc = Math.floor(i / SAMPLES);
        const k = i / SAMPLES - arc;
        const [p, q, r] = this.arc(arc);
        const square = (u: Vec3, v: Vec3) => vDot(vSub(u, v), vSub(u, v));
        const inter = square(r, p) * (1 - k) + square(q, r) * k;
        const coef = inter / (inter - square(p, q) * k * (1 - k));
        return vAdd(r, vScale(vAdd(vSub(p, r), vScale(vSub(q, p), k)), coef));
    }

    // The inverse of dgpadSample for a point of the circle: the sample of an
    // arc is where its chord meets the line from the arc's third point.
    dgpadIndex(point: Vec3): number {
        let index = 0;
        let gap = Infinity;
        for (let arc = 0; arc < 3; arc++) {
            const [p, q, r] = this.arc(arc);
            const d = vSub(point, r);
            const a = vSub(p, r);
            const b = vSub(q, p);
            const normal = vCross(a, b);
            const k = -vDot(vCross(d, a), normal) / vDot(vCross(d, b), normal);
            const outside = Math.max(-k, k - 1, 0);
            if (outside < gap) {
                gap = outside;
                index = SAMPLES * (arc + Math.min(Math.max(k, 0), 1));
            }
        }
        return index;
    }

    private arc(arc: number): Vec3[] {
        return [0, 1, 2].map(
            (offset) => [this.P1, this.P2, this.P3][(arc + offset) % 3].coords,
        );
    }
}

// DGPad's samples per arc of a Circle3pts3D.
export const SAMPLES = 500;

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
