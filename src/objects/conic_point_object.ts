import type { construction } from "../construction";
import { geometryTolerance, type Vec2 } from "../vec";
import type { DgoContext } from "./construction_object";
import { point_object } from "./point_object";
import type { primitive_quadric_object } from "./primitive_quadric_object";

// GeoGebra's center (C), foci (F1, F2), vertices (V1 to V4), points of its
// directrices (D1, D2, then E1, E2 one unit further along them) and, as its
// abscissa, the eccentricity (e) of a conic, in GeoGebra's order (relevé
// dans GeoGebra): with e0 the unit vector of its major or transverse axis,
// the eigenvector (b/2, μ − a) of its matrix or, for b = 0, the positive one
// of its axis, F1 = C − c·e0, V1 = C − a·e0, V3 = C − b·e1 with e1 = e0
// turned a quarter, D1 on the side of +e0. A parabola has one of each.
export const CONIC_POINTS = [
    "C",
    "F1",
    "F2",
    "V1",
    "V2",
    "V3",
    "V4",
    "D1",
    "D2",
    "E1",
    "E2",
    "e",
] as const;
export type ConicPoint = (typeof CONIC_POINTS)[number];

// In the conic a·x² + b·xy + c·y² + d·x + e·y + f = 0's plane.
function conicPoint(
    [a, b, c, d, e, f]: readonly number[],
    which: ConicPoint,
): Vec2 | null {
    const det = 4 * a * c - b * b;
    const half = Math.hypot((a - c) / 2, b / 2);
    const lambdas = [(a + c) / 2 + half, (a + c) / 2 - half];
    if (Math.abs(det) <= geometryTolerance(a, b, c)) {
        // s² = 2p·t in the frame of its vertex, its directrix's direction
        // u and its axis v (see primitive_quadric_object.setConic).
        const theta = Math.atan2(b, a - c) / 2;
        const curved = Math.abs(lambdas[0]) >= Math.abs(lambdas[1]);
        const u: Vec2 = curved
            ? [Math.cos(theta), Math.sin(theta)]
            : [-Math.sin(theta), Math.cos(theta)];
        const v: Vec2 = [-u[1], u[0]];
        const l = lambdas[curved ? 0 : 1];
        const du = d * u[0] + e * u[1];
        const dv = d * v[0] + e * v[1];
        const p = -dv / (2 * l);
        const [s, t] = {
            V1: [0, 0],
            F1: [0, p / 2],
            D1: [0, -p / 2],
            E1: [1, -p / 2],
        }[which as string] ?? [NaN, NaN];
        if (which === "e") return [1, 0];
        const u0 = -du / (2 * l) + s;
        const v0 = ((du * du) / (4 * l) - f) / dv + t;
        return [u0 * u[0] + v0 * v[0], u0 * u[1] + v0 * v[1]];
    }
    const center: Vec2 = [(b * e - 2 * c * d) / det, (b * d - 2 * a * e) / det];
    const f0 = (d * center[0] + e * center[1]) / 2 + f;
    const [m1, m2] = lambdas.map((lambda) => -f0 / lambda);
    const ellipse = m1 > 0 && m2 > 0;
    if (!(m1 > 0 || m2 > 0)) return null;
    // Its major or transverse axis first.
    const first = ellipse ? m1 >= m2 : m1 > 0;
    const [r1, r2] = first ? [m1, m2] : [m2, m1];
    const mu = lambdas[first ? 0 : 1];
    const [A, B] = [Math.sqrt(r1), Math.sqrt(Math.abs(r2))];
    const k = Math.sqrt(ellipse ? A * A - B * B : A * A + B * B);
    const [x, y] =
        Math.abs(b) <= geometryTolerance(a, b, c)
            ? Math.abs(mu - a) <= Math.abs(mu - c)
                ? [1, 0]
                : [0, 1]
            : [b / 2, mu - a];
    const n = Math.hypot(x, y);
    const e0: Vec2 = [x / n, y / n];
    const e1: Vec2 = [-e0[1], e0[0]];
    const along = (r: number, s = 0): Vec2 => [
        center[0] + r * e0[0] + s * e1[0],
        center[1] + r * e0[1] + s * e1[1],
    ];
    const directrix = (A * A) / k;
    switch (which) {
        case "C":
            return center;
        case "F1":
            return along(-k);
        case "F2":
            return along(k);
        case "V1":
            return along(-A);
        case "V2":
            return along(A);
        case "V3":
            return ellipse ? along(0, -B) : null;
        case "V4":
            return ellipse ? along(0, B) : null;
        case "D1":
            return k ? along(directrix) : null;
        case "D2":
            return k ? along(-directrix) : null;
        case "E1":
            return k ? along(directrix, 1) : null;
        case "E2":
            return k ? along(-directrix, 1) : null;
        case "e":
            return [k / A, 0];
    }
}

export class conic_point_object extends point_object {
    moveable = false;
    CONIC: primitive_quadric_object;
    WHICH: ConicPoint;

    constructor(
        c: construction,
        name: string | null | undefined,
        conic: primitive_quadric_object,
        which: ConicPoint,
    ) {
        super(c, name, [0, 0, 0]);
        this.CONIC = conic;
        this.WHICH = which;
        this.addParents(conic);
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["CnP", [context.index(this.CONIC), this.WHICH]];
    }

    computeGeometry(): void {
        const at =
            this.CONIC.defined && this.CONIC.COEFFS
                ? conicPoint(this.CONIC.COEFFS, this.WHICH)
                : null;
        this.defined = !!at && at.every(Number.isFinite);
        if (!at || !this.defined) return;
        this.coords =
            this.WHICH === "e" ? [at[0], 0, 0] : this.CONIC.fromPlane(at);
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createConicPoint(
    c: construction,
    name: string | null | undefined,
    conic: primitive_quadric_object,
    which: ConicPoint,
): conic_point_object {
    return c.add(new conic_point_object(c, name, conic, which));
}
