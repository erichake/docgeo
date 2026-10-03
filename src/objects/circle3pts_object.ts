import type { construction } from "../construction";
import {
    geometryTolerance,
    vAdd,
    vCross,
    vDot,
    vNorm,
    vScale,
    vSub,
    type Vec3,
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
        this.setCircleThrough(this.P1.coords, this.P2.coords, this.P3.coords);
    }

    // DGPad's Circle3pts3D point number `index`, its parameter: on the arcs
    // from P1 to P2, P2 to P3 then P3 to P1, each without the third point,
    // sampled by its barycentric equation, the last one beyond.
    dgpadSample(index: number): Vec3 {
        const i = Math.min(index, 3 * SAMPLES - 1);
        const arc = Math.floor(i / SAMPLES);
        const k = i / SAMPLES - arc;
        const [p, q, r] = [0, 1, 2].map(
            (offset) => [this.P1, this.P2, this.P3][(arc + offset) % 3].coords,
        );
        const square = (u: Vec3, v: Vec3) => vDot(vSub(u, v), vSub(u, v));
        const inter = square(r, p) * (1 - k) + square(q, r) * k;
        const coef = inter / (inter - square(p, q) * k * (1 - k));
        return vAdd(r, vScale(vAdd(vSub(p, r), vScale(vSub(q, p), k)), coef));
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

// DGPad's samples per arc of a Circle3pts3D.
const SAMPLES = 500;

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
