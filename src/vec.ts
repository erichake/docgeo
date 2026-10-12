export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

export const GEOMETRY_EPSILON = 1e-10;
const GEOMETRY_RELATIVE_EPSILON = 64 * Number.EPSILON;

export function vAdd(a: Vec2, b: Vec2): Vec2;
export function vAdd(a: Vec3, b: Vec3): Vec3;
export function vAdd(
    a: readonly number[],
    b: readonly number[],
): readonly number[] {
    if (a.length === 3) return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    if (a.length === 2) return [a[0] + b[0], a[1] + b[1]];
    return a.map((v, i) => v + b[i]);
}

export function vSub(a: Vec2, b: Vec2): Vec2;
export function vSub(a: Vec3, b: Vec3): Vec3;
export function vSub(
    a: readonly number[],
    b: readonly number[],
): readonly number[] {
    if (a.length === 3) return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    if (a.length === 2) return [a[0] - b[0], a[1] - b[1]];
    return a.map((v, i) => v - b[i]);
}

export function vScale(a: Vec2, k: number): Vec2;
export function vScale(a: Vec3, k: number): Vec3;
export function vScale(a: readonly number[], k: number): readonly number[] {
    if (a.length === 3) return [k * a[0], k * a[1], k * a[2]];
    if (a.length === 2) return [k * a[0], k * a[1]];
    return a.map((v) => k * v);
}

export function vNorm(a: readonly number[]): number {
    return a.length === 3
        ? Math.hypot(a[0], a[1], a[2])
        : a.length === 2
          ? Math.hypot(a[0], a[1])
          : Math.hypot(...a);
}

export function vNormalize(a: Vec2): Vec2 | null;
export function vNormalize(a: Vec3): Vec3 | null;
export function vNormalize(a: readonly number[]): readonly number[] | null {
    const norm = vNorm(a);
    return Number.isFinite(norm) && norm > GEOMETRY_EPSILON
        ? a.map((value) => value / norm)
        : null;
}

export function vDot(a: readonly number[], b: readonly number[]): number {
    let result = 0;
    for (let i = 0; i < a.length; i++) result += a[i] * b[i];
    return result;
}

export function vCross(a: Vec3, b: Vec3): Vec3 {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
}

export function vIsFinite(a: readonly number[]): boolean {
    for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return false;
    return true;
}

export function geometryTolerance(...values: number[]): number {
    let scale = 1;
    for (const value of values) scale = Math.max(scale, Math.abs(value));
    return GEOMETRY_EPSILON + GEOMETRY_RELATIVE_EPSILON * scale;
}

export function numEqual(a: number, b: number): boolean {
    return Math.abs(a - b) <= geometryTolerance(a, b);
}

export function pointInPolygon(
    [x, y]: Vec2,
    vertices: readonly Vec2[],
): boolean {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i][0];
        const yi = vertices[i][1];
        const xj = vertices[j][0];
        const yj = vertices[j][1];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
            inside = !inside;
    }
    return inside;
}

// Parameter (0..1) along segment [p1, p2] where it crosses segment [a, b],
// or null if the two segments don't cross within their own bounds.
export function segmentIntersectionParameter(
    p1: Vec2,
    p2: Vec2,
    a: Vec2,
    b: Vec2,
): number | null {
    const d1 = vSub(p2, p1);
    const d2 = vSub(b, a);
    const denominator = d1[0] * d2[1] - d1[1] * d2[0];
    if (Math.abs(denominator) <= GEOMETRY_EPSILON) return null;
    const pa = vSub(a, p1);
    const t = (pa[0] * d2[1] - pa[1] * d2[0]) / denominator;
    const u = (pa[0] * d1[1] - pa[1] * d1[0]) / denominator;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return t;
}
