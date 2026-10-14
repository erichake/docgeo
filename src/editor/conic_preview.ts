import { vNorm, vSub, type Vec2, type Vec3 } from "../vec";

// a·x² + b·xy + c·y² + d·x + e·y + f = 0
type Conic = number[];

const value = ([a, b, c, d, e, f]: Conic, [x, y]: Vec2) =>
    a * x * x + b * x * y + c * y * y + d * x + e * y + f;
const line = ([px, py]: Vec2, [qx, qy]: Vec2): Conic => [
    0,
    0,
    0,
    py - qy,
    qx - px,
    px * qy - qx * py,
];
const lines = (l: Conic, m: Conic): Conic => {
    const [u1, v1, w1] = l.slice(3);
    const [u2, v2, w2] = m.slice(3);
    return [
        u1 * u2,
        u1 * v2 + u2 * v1,
        v1 * v2,
        u1 * w2 + u2 * w1,
        v1 * w2 + v2 * w1,
        w1 * w2,
    ];
};
const mix = (s: number, p: Conic, t: number, q: Conic): Conic =>
    p.map((v, i) => s * v + t * q[i]);

// The conic through the points nearest to a circle: through two, the circle
// on their diameter; through three, their circle; through four, the one of
// their pencil whose eigenvalues λ, μ make ((λ − μ)/(λ + μ))² least, the
// circle when they're concyclic, else an ellipse when they're in convex
// position.
function nearestCircle(points: Vec2[]): Conic {
    const [[ax, ay], [bx, by]] = points;
    const diameter = [1, 0, 1, -ax - bx, -ay - by, ax * bx + ay * by];
    if (points.length === 2) return diameter;
    const [A, B, C, D] = points;
    const AB = line(A, B);
    if (points.length === 3)
        return mix(value(AB, C), diameter, -value(diameter, C), AB);
    const p = lines(AB, line(C, D));
    const q = lines(line(A, C), line(B, D));
    // ((λ − μ)/(λ + μ))² = ((a − c)² + b²)/(a + c)², least for s·p + t·q
    // where (s, t) is the adjugate of the numerator's form applied to the
    // denominator's linear form.
    const [m11, m12, m22] = [
        (p[0] - p[2]) ** 2 + p[1] ** 2,
        (p[0] - p[2]) * (q[0] - q[2]) + p[1] * q[1],
        (q[0] - q[2]) ** 2 + q[1] ** 2,
    ];
    const [l1, l2] = [p[0] + p[2], q[0] + q[2]];
    return mix(m22 * l1 - m12 * l2, p, m11 * l2 - m12 * l1, q);
}

// A point of the conic away from the others: the farthest from them of the
// second intersections of the chords from each point at 30° to each other
// one (at 45°, those of a circle would close up after four), a far one being
// worth no more than the points' spread.
function awayOn(conic: Conic, points: Vec2[]): Vec2 {
    const [a, b, c, d, e] = conic;
    const spread = Math.max(
        ...points.flatMap((p) => points.map((q) => vNorm(vSub(p, q)))),
    );
    let best = points[0];
    let score = 0;
    for (const [x, y] of points) {
        const [gx, gy] = [2 * a * x + b * y + d, b * x + 2 * c * y + e];
        for (const [qx, qy] of points) {
            const [dx, dy] = [qx - x, qy - y];
            const r = Math.sqrt(3);
            for (const [ux, uy] of [
                [r * dx - dy, dx + r * dy],
                [r * dx + dy, r * dy - dx],
            ]) {
                const t =
                    -(gx * ux + gy * uy) /
                    (a * ux * ux + b * ux * uy + c * uy * uy);
                if (!Number.isFinite(t)) continue;
                const point: Vec2 = [x + t * ux, y + t * uy];
                const away = Math.min(
                    spread,
                    ...points.map((p) => vNorm(vSub(p, point))),
                );
                if (away > score) [best, score] = [point, away];
            }
        }
    }
    return best;
}

// Where the points missing to the conic through five stand in, from two,
// three or four given: on the conic through them nearest to a circle. When
// there's none, they repeat the first point and the conic isn't defined.
export function conicStandIns(given: Vec3[]): Vec3[] {
    const points = given.map(([x, y]): Vec2 => [x, y]);
    const conic = nearestCircle(points);
    while (points.length < 5) points.push(awayOn(conic, points));
    const z = given[0][2];
    return points.slice(given.length).map(([x, y]): Vec3 => [x, y, z]);
}
