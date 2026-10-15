import type { construction } from "../construction";
import { geometryTolerance, numEqual, vAdd, type Vec2 } from "../vec";
import type { DgoContext } from "./construction_object";
import type { point_object } from "./point_object";
import type { primitive_line_object } from "./primitive_line_object";
import { primitive_quadric_object } from "./primitive_quadric_object";

// The parabola of focus F and directrix d.
export class parabola_object extends primitive_quadric_object {
    F: point_object;
    D: primitive_line_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        f: point_object,
        d: primitive_line_object,
    ) {
        super(c, name);
        this.F = f;
        this.D = d;
        this.addParents(f, d);
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["Prb", [this.F, this.D].map(context.index)];
    }

    computeGeometry(): void {
        this.setPlane(this.F.z);
        const [f, q, r] = [
            this.F.coords,
            this.D.P1.coords,
            vAdd(this.D.P1.coords, this.D.VEC),
        ].map((point) => this.toPlane(point));
        const dir: Vec2 = [r[0] - q[0], r[1] - q[1]];
        const t = (f[0] - q[0]) * dir[0] + (f[1] - q[1]) * dir[1];
        const foot: Vec2 = [q[0] + t * dir[0], q[1] + t * dir[1]];
        const p = Math.hypot(f[0] - foot[0], f[1] - foot[1]);
        if (
            !this.F.defined ||
            !this.D.defined ||
            ![f, q, r].every(([, , height]) => numEqual(height, 0)) ||
            !(p > geometryTolerance(...f, ...foot))
        ) {
            this.defined = false;
            this.COEFFS = null;
            return;
        }
        const w: Vec2 = [(f[0] - foot[0]) / p, (f[1] - foot[1]) / p];
        const u: Vec2 = [w[1], -w[0]];
        const vertex: Vec2 = [(f[0] + foot[0]) / 2, (f[1] + foot[1]) / 2];
        // x² = 2py in the frame of the vertex, u and w.
        this.setBranches("parabola", vertex, [
            (s) => {
                const h = (s * s) / (2 * p);
                return [
                    vertex[0] + s * u[0] + h * w[0],
                    vertex[1] + s * u[1] + h * w[1],
                ];
            },
        ]);
        this.setCoeffs(vertex, u, 1, 0, -2 * p, 0);
        this.axes = [
            [...vertex, 0],
            [vertex[0] + p * u[0], vertex[1] + p * u[1], 0],
            [vertex[0] + p * w[0], vertex[1] + p * w[1], 0],
        ];
    }
}

export function createParabola(
    c: construction,
    name: string | null | undefined,
    f: point_object,
    d: primitive_line_object,
): parabola_object {
    return c.add(new parabola_object(c, name, f, d));
}
