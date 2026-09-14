export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export const GEOMETRY_EPSILON = 1e-10;
const GEOMETRY_RELATIVE_EPSILON = 64 * Number.EPSILON;

export function vAdd<T extends readonly number[]>(a: T, b: T): T {
    return a.map((v, i) => v + b[i]) as unknown as T;
}

export function vSub<T extends readonly number[]>(a: T, b: T): T {
    return a.map((v, i) => v - b[i]) as unknown as T;
}

export function vScale<T extends readonly number[]>(a: T, k: number): T {
    return a.map((v) => k * v) as unknown as T;
}

export function vNorm(a: readonly number[]): number {
    return Math.hypot(...a);
}

export function vNormalize<T extends readonly number[]>(a: T): T | null {
    const norm = vNorm(a);
    return Number.isFinite(norm) && norm > GEOMETRY_EPSILON
        ? vScale(a, 1 / norm)
        : null;
}

export function vDot(a: readonly number[], b: readonly number[]): number {
    return a.reduce((result, value, index) => result + value * b[index], 0);
}

export function vCross(a: Vec3, b: Vec3): Vec3 {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
}

export function vIsFinite(a: readonly number[]): boolean {
    return a.every(Number.isFinite);
}

export function geometryTolerance(...values: number[]): number {
    const scale = Math.max(1, ...values.map(Math.abs));
    return GEOMETRY_EPSILON + GEOMETRY_RELATIVE_EPSILON * scale;
}

export function numEqual(a: number, b: number): boolean {
    return Math.abs(a - b) <= geometryTolerance(a, b);
}
