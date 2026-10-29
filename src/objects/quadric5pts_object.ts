import type { construction } from "../construction";
import { geometryTolerance, numEqual, type Vec3 } from "../vec";
import type { ConicCoeffs } from "./conic_algebra";
import type { DgoContext } from "./construction_object";
import type { point_object } from "./point_object";
import { primitive_quadric_object } from "./primitive_quadric_object";

// Fits a·x² + b·xy + c·y² + d·x + e·y + f = 0 through 5 points: a
// homogeneous system with a 1-dimensional null space, solved exactly by
// Gaussian elimination with partial pivoting (rows are pre-normalized so
// pivot comparisons and the degeneracy tolerance stay scale-meaningful).
// Returns null when the 5 points don't determine a unique conic (e.g. too
// many of them collinear).
function fitConic(points: readonly Vec3[]): ConicCoeffs | null {
    const rows = points.map(([x, y]) => {
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
    return coeffs.map((v) => v / norm) as unknown as ConicCoeffs;
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

    dgo(context: DgoContext): [string, unknown] {
        return [
            "Quad",
            [this.P1, this.P2, this.P3, this.P4, this.P5].map(context.index),
        ];
    }

    computeGeometry(): void {
        const points = [this.P1, this.P2, this.P3, this.P4, this.P5];
        this.setPlane(this.P1.z);
        const local = points.map((point) => this.toPlane(point.coords));
        if (
            !points.every((point) => point.defined) ||
            !local.every(([, , height]) => numEqual(height, 0))
        ) {
            this.defined = false;
            this.COEFFS = null;
            return;
        }
        const coeffs = fitConic(local);
        if (!coeffs) {
            this.defined = false;
            this.COEFFS = null;
            return;
        }
        this.setConic(coeffs);
    }

    // Its first 3 points, in plane coordinates.
    frame(): Vec3[] {
        return [this.P1, this.P2, this.P3].map((point) =>
            this.toPlane(point.coords),
        );
    }
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
