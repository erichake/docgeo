import type { construction } from "../construction";
import { geometryTolerance, numEqual, type Vec3 } from "../vec";
import type { point_object } from "./point_object";
import { primitive_quadric_object } from "./primitive_quadric_object";

// Fits a·x² + b·xy + c·y² + d·x + e·y + f = 0 through 5 points: a
// homogeneous system with a 1-dimensional null space, solved exactly by
// Gaussian elimination with partial pivoting (rows are pre-normalized so
// pivot comparisons and the degeneracy tolerance stay scale-meaningful).
// Returns null when the 5 points don't determine a unique conic (e.g. too
// many of them collinear).
function fitConic(
    points: readonly { x: number; y: number }[],
): number[] | null {
    const rows = points.map(({ x, y }) => {
        const row = [x * x, x * y, y * y, x, y, 1];
        const norm = Math.hypot(...row);
        return row.map((v) => v / norm);
    });
    const pivotRow: number[] = new Array(6).fill(-1);
    let rank = 0;
    for (let col = 0; col < 6 && rank < 5; col++) {
        let best = rank;
        for (let row = rank + 1; row < 5; row++) {
            if (Math.abs(rows[row][col]) > Math.abs(rows[best][col]))
                best = row;
        }
        if (Math.abs(rows[best][col]) <= geometryTolerance()) continue;
        [rows[rank], rows[best]] = [rows[best], rows[rank]];
        for (let row = rank + 1; row < 5; row++) {
            const factor = rows[row][col] / rows[rank][col];
            for (let k = col; k < 6; k++)
                rows[row][k] -= factor * rows[rank][k];
        }
        pivotRow[col] = rank;
        rank++;
    }
    if (rank < 5) return null;
    const coeffs: number[] = new Array(6).fill(0);
    for (let col = 5; col >= 0; col--) {
        if (pivotRow[col] < 0) {
            coeffs[col] = 1;
            continue;
        }
        const row = rows[pivotRow[col]];
        let sum = 0;
        for (let k = col + 1; k < 6; k++) sum += row[k] * coeffs[k];
        coeffs[col] = -sum / row[col];
    }
    const norm = Math.hypot(...coeffs);
    return coeffs.map((v) => v / norm);
}

export class quadric5pts_object extends primitive_quadric_object {
    P1: point_object;
    P2: point_object;
    P3: point_object;
    P4: point_object;
    P5: point_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        p2: point_object,
        p3: point_object,
        p4: point_object,
        p5: point_object,
    ) {
        super(c, name);
        this.P1 = p1;
        this.P2 = p2;
        this.P3 = p3;
        this.P4 = p4;
        this.P5 = p5;
        this.addParents(p1, p2, p3, p4, p5);
    }

    computeGeometry(): void {
        const points = [this.P1, this.P2, this.P3, this.P4, this.P5];
        if (
            !points.every((point) => point.defined) ||
            !points.every((point) => numEqual(point.z, this.P1.z))
        ) {
            this.defined = false;
            return;
        }
        const coeffs = fitConic(points);
        if (!coeffs) {
            this.defined = false;
            return;
        }
        const [a, b, c, d, e, f] = coeffs;
        const z = this.P1.z;

        // Center: where the quadratic form's gradient vanishes. Singular
        // exactly when the conic has no center, i.e. a parabola (or a fully
        // degenerate pair of parallel/coincident lines).
        const m00 = 2 * a,
            m01 = b,
            m10 = b,
            m11 = 2 * c;
        const det = m00 * m11 - m01 * m10;
        if (Math.abs(det) <= geometryTolerance(a, b, c)) {
            const branch = fitParabola(a, b, c, d, e, f, z);
            if (!branch) {
                this.defined = false;
                return;
            }
            this.setBranches("parabola", branch.vertex, [branch.pointAt]);
            return;
        }
        const r0 = -d,
            r1 = -e;
        const x0 = (r0 * m11 - m01 * r1) / det;
        const y0 = (m00 * r1 - m10 * r0) / det;
        const f0 =
            a * x0 * x0 + b * x0 * y0 + c * y0 * y0 + d * x0 + e * y0 + f;
        const center: Vec3 = [x0, y0, z];

        // Diagonalize the quadratic part (closed-form eigendecomposition of
        // a symmetric 2x2 matrix) to get the conic's own axis directions.
        const p = a,
            q = b / 2,
            s = c;
        const theta = 0.5 * Math.atan2(2 * q, p - s);
        const half = Math.sqrt(((p - s) / 2) ** 2 + q * q);
        const lambda1 = (p + s) / 2 + half;
        const lambda2 = (p + s) / 2 - half;
        const mu1 = -f0 / lambda1;
        const mu2 = -f0 / lambda2;
        const e1: Vec3 = [Math.cos(theta), Math.sin(theta), 0];
        const e2: Vec3 = [-Math.sin(theta), Math.cos(theta), 0];

        if (mu1 > 0 && mu2 > 0) {
            const semiA = Math.sqrt(mu1);
            const semiB = Math.sqrt(mu2);
            this.setEllipse(center, scale(e1, semiA), scale(e2, semiB));
        } else if (mu1 > 0 && mu2 < 0) {
            this.setBranches(
                "hyperbola",
                center,
                hyperbolaBranches(
                    center,
                    e1,
                    Math.sqrt(mu1),
                    e2,
                    Math.sqrt(-mu2),
                ),
            );
        } else if (mu2 > 0 && mu1 < 0) {
            this.setBranches(
                "hyperbola",
                center,
                hyperbolaBranches(
                    center,
                    e2,
                    Math.sqrt(mu2),
                    e1,
                    Math.sqrt(-mu1),
                ),
            );
        } else {
            // No real locus (imaginary ellipse), or a degenerate pair of
            // intersecting lines (f0 ≈ 0): nothing to display.
            this.defined = false;
        }
    }
}

function scale([x, y, zc]: Vec3, k: number): Vec3 {
    return [x * k, y * k, zc * k];
}

function hyperbolaBranches(
    center: Vec3,
    transverseDir: Vec3,
    semiTransverse: number,
    conjugateDir: Vec3,
    semiConjugate: number,
): ((t: number) => Vec3)[] {
    const branch =
        (sign: 1 | -1) =>
        (t: number): Vec3 => {
            const u = sign * semiTransverse * Math.cosh(t);
            const v = semiConjugate * Math.sinh(t);
            return [
                center[0] + u * transverseDir[0] + v * conjugateDir[0],
                center[1] + u * transverseDir[1] + v * conjugateDir[1],
                center[2],
            ];
        };
    return [branch(1), branch(-1)];
}

// Reduces a·x² + b·xy + c·y² + d·x + e·y + f = 0 to U² = 4pV in the local
// frame of its own axis (found by rotating away the xy cross term), then
// completing the square along the flat (axis) direction. Returns null when
// that reduction has no v-dependence left, i.e. the "parabola" is actually
// a degenerate pair of parallel lines (or has no real locus).
function fitParabola(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    z: number,
): { vertex: Vec3; pointAt: (t: number) => Vec3 } | null {
    const p = a,
        q = b / 2,
        s = c;
    const theta = 0.5 * Math.atan2(2 * q, p - s);
    const half = Math.sqrt(((p - s) / 2) ** 2 + q * q);
    const lambda1 = (p + s) / 2 + half;
    const lambda2 = (p + s) / 2 - half;
    const curvedIsFirst = Math.abs(lambda1) >= Math.abs(lambda2);
    const lambdaCurved = curvedIsFirst ? lambda1 : lambda2;
    if (Math.abs(lambdaCurved) <= geometryTolerance(a, b, c)) return null;
    const thetaCurved = curvedIsFirst ? theta : theta + Math.PI / 2;
    const cosT = Math.cos(thetaCurved),
        sinT = Math.sin(thetaCurved);
    const dp = d * cosT + e * sinT;
    const ep = -d * sinT + e * cosT;
    if (Math.abs(ep) <= geometryTolerance(d, e)) return null;
    const uVertex = -dp / (2 * lambdaCurved);
    const constTerm = f - (dp * dp) / (4 * lambdaCurved);
    const vVertex = -constTerm / ep;
    const param = -ep / (4 * lambdaCurved);
    const rotateBack = (u: number, v: number): Vec3 => [
        u * cosT - v * sinT,
        u * sinT + v * cosT,
        z,
    ];
    return {
        vertex: rotateBack(uVertex, vVertex),
        pointAt: (t: number) =>
            rotateBack(uVertex + t, vVertex + (t * t) / (4 * param)),
    };
}

export function createQuadric5pts(
    c: construction,
    name: string | null | undefined,
    p1: point_object,
    p2: point_object,
    p3: point_object,
    p4: point_object,
    p5: point_object,
): quadric5pts_object {
    return c.add(new quadric5pts_object(c, name, p1, p2, p3, p4, p5));
}
