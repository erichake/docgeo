import { geometryTolerance, type Vec2, type Vec3 } from "../vec";

// a·x² + b·xy + c·y² + d·x + e·y + f = 0
export type ConicCoeffs = readonly [
    number,
    number,
    number,
    number,
    number,
    number,
];

export function realQuadraticRoots(a: number, b: number, c: number): number[] {
    if (Math.abs(a) <= geometryTolerance(b, c)) {
        if (Math.abs(b) <= geometryTolerance(c)) return [];
        return [-c / b];
    }
    const discriminant = b * b - 4 * a * c;
    if (discriminant < -geometryTolerance(a, b, c)) return [];
    const root = Math.sqrt(Math.max(0, discriminant));
    if (root <= geometryTolerance(a, b, c)) return [-b / (2 * a)];
    return [(-b + root) / (2 * a), (-b - root) / (2 * a)];
}

// a·x³ + b·x² + c·x + d = 0. Always has at least one real root; returns all
// of them (1 or 3), via Cardano's method (trigonometric form when there are
// three real roots).
export function realCubicRoots(
    a: number,
    b: number,
    c: number,
    d: number,
): number[] {
    if (Math.abs(a) <= geometryTolerance(b, c, d))
        return realQuadraticRoots(b, c, d);
    b /= a;
    c /= a;
    d /= a;
    const p = c - (b * b) / 3;
    const q = (2 * b * b * b) / 27 - (b * c) / 3 + d;
    const shift = -b / 3;
    if (
        Math.abs(p) <= geometryTolerance() &&
        Math.abs(q) <= geometryTolerance()
    )
        return [shift];
    const discriminant = (q / 2) ** 2 + (p / 3) ** 3;
    if (discriminant > 0) {
        const root = Math.sqrt(discriminant);
        const u = Math.cbrt(-q / 2 + root);
        const v = Math.cbrt(-q / 2 - root);
        return [u + v + shift];
    }
    const radius = Math.sqrt(-((p / 3) ** 3));
    const angle = Math.acos(Math.max(-1, Math.min(1, -q / 2 / radius)));
    const scale = 2 * Math.sqrt(-p / 3);
    return [0, 1, 2].map(
        (k) => scale * Math.cos((angle + 2 * Math.PI * k) / 3) + shift,
    );
}

// a·x⁴ + b·x³ + c·x² + d·x + e = 0. Returns every real root (with
// multiplicity), via Ferrari's method with a real-only resolvent cubic
// (no complex arithmetic needed, since only real roots are wanted). Degrades
// to a lower-degree solve when the leading coefficient(s) vanish, so it
// handles the degenerate cases (e.g. two conics with proportional quadratic
// parts) as a plain side effect rather than a special case.
export function realQuarticRoots(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
): number[] {
    if (Math.abs(a) <= geometryTolerance(b, c, d, e))
        return realCubicRoots(b, c, d, e);
    b /= a;
    c /= a;
    d /= a;
    e /= a;
    const shift = -b / 4;
    const p = c - (3 * b * b) / 8;
    const q = d - (b * c) / 2 + b ** 3 / 8;
    const r = e - (b * d) / 4 + (b * b * c) / 16 - (3 * b ** 4) / 256;

    if (Math.abs(q) <= geometryTolerance(p, r)) {
        // Biquadratic: y⁴ + p·y² + r = 0.
        const roots: number[] = [];
        for (const y2 of realQuadraticRoots(1, p, r)) {
            if (y2 < -geometryTolerance(p, r)) continue;
            const y = Math.sqrt(Math.max(0, y2));
            roots.push(y + shift);
            if (y > geometryTolerance()) roots.push(-y + shift);
        }
        return roots;
    }

    // Resolvent cubic: m³ + p·m² + (p²/4 - r)·m - q²/8 = 0. Any root with
    // m > 0 factors the quartic into two real quadratics.
    const cubicRoots = realCubicRoots(1, p, (p * p) / 4 - r, -(q * q) / 8);
    const positive = cubicRoots.filter((m) => m > geometryTolerance());
    const m =
        positive.length > 0 ? Math.max(...positive) : Math.max(...cubicRoots);
    if (m <= geometryTolerance()) return [];
    const w = Math.sqrt(2 * m);
    const term = q / (2 * w);
    const roots: number[] = [];
    for (const y of realQuadraticRoots(1, -w, p / 2 + m + term))
        roots.push(y + shift);
    for (const y of realQuadraticRoots(1, w, p / 2 + m - term))
        roots.push(y + shift);
    return roots;
}

function evaluateConic(
    [a, b, c, d, e, f]: ConicCoeffs,
    x: number,
    y: number,
): number {
    return a * x * x + b * x * y + c * y * y + d * x + e * y + f;
}

// Roots (as line parameters t, ascending) of the conic evaluated along the
// line point1 + t·vec. At most 2, since substituting a line into a conic
// always yields a quadratic in t regardless of the conic's own type.
export function lineConicIntersections(
    point1: Vec3,
    vec: Vec3,
    coeffs: ConicCoeffs,
): number[] {
    const [a, b, c, d, e] = coeffs;
    const [x0, y0] = point1;
    const [vx, vy] = vec;
    const A = a * vx * vx + b * vx * vy + c * vy * vy;
    const B =
        2 * a * x0 * vx +
        b * (x0 * vy + vx * y0) +
        2 * c * y0 * vy +
        d * vx +
        e * vy;
    const C = evaluateConic(coeffs, x0, y0);
    return realQuadraticRoots(A, B, C).sort((p, q) => p - q);
}

// Real intersection points of two conics, unordered. Eliminates y via the
// resultant of the two conics treated as quadratics in y (a quartic in x in
// general), then recovers y at each real x root by solving the y-quadratic
// from whichever conic has the better-conditioned leading coefficient there
// and keeping only the candidate(s) that satisfy both conics — robust even
// when both conics share that x value at more than one y (e.g. conics with
// proportional quadratic parts), unlike a direct linear back-substitution.
export function conicConicIntersectionsXY(
    conic1: ConicCoeffs,
    conic2: ConicCoeffs,
): Vec2[] {
    const [a1, b1, c1, d1, e1, f1] = conic1;
    const [a2, b2, c2, d2, e2, f2] = conic2;
    // Each conic as A·y² + B(x)·y + C(x) = 0.
    const A1 = c1,
        B1 = [e1, b1], // B1(x) = e1 + b1·x
        C1 = [f1, d1, a1]; // C1(x) = f1 + d1·x + a1·x²
    const A2 = c2,
        B2 = [e2, b2],
        C2 = [f2, d2, a2];
    // P = A1·C2 - A2·C1 (deg ≤2), Q = A1·B2 - A2·B1 (deg ≤1),
    // R = B1·C2 - B2·C1 (deg ≤3); resultant = P² - Q·R (deg ≤4).
    const P = subtract(scale(C2, A1), scale(C1, A2));
    const Q = subtract(scale(B2, A1), scale(B1, A2));
    const R = subtract(multiply(B1, C2), multiply(B2, C1));
    const resultant = subtract(multiply(P, P), multiply(Q, R));
    const [k0, k1, k2, k3, k4] = [
        resultant[0] ?? 0,
        resultant[1] ?? 0,
        resultant[2] ?? 0,
        resultant[3] ?? 0,
        resultant[4] ?? 0,
    ];
    const xs = realQuarticRoots(k4, k3, k2, k1, k0);

    const points: Vec2[] = [];
    for (const x of xs) {
        const ys = [
            ...realQuadraticRoots(
                A1,
                B1[0] + B1[1] * x,
                C1[0] + C1[1] * x + C1[2] * x * x,
            ),
            ...realQuadraticRoots(
                A2,
                B2[0] + B2[1] * x,
                C2[0] + C2[1] * x + C2[2] * x * x,
            ),
        ];
        for (const y of ys) {
            const tolerance = geometryTolerance(x, y);
            if (
                Math.abs(evaluateConic(conic1, x, y)) <= tolerance &&
                Math.abs(evaluateConic(conic2, x, y)) <= tolerance &&
                !points.some(
                    ([px, py]) => Math.hypot(px - x, py - y) <= tolerance,
                )
            ) {
                points.push([x, y]);
            }
        }
    }
    return points;
}

function scale(poly: readonly number[], k: number): number[] {
    return poly.map((v) => v * k);
}

function subtract(a: readonly number[], b: readonly number[]): number[] {
    const n = Math.max(a.length, b.length);
    return Array.from({ length: n }, (_, i) => (a[i] ?? 0) - (b[i] ?? 0));
}

function multiply(a: readonly number[], b: readonly number[]): number[] {
    const result = new Array(a.length + b.length - 1).fill(0);
    a.forEach((x, i) => b.forEach((y, j) => (result[i + j] += x * y)));
    return result;
}
