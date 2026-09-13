export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

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
    return Math.sqrt(a.reduce((acc, v) => acc + v * v, 0));
}

export function vNormalize<T extends readonly number[]>(a: T): T {
    return vScale(a, 1 / vNorm(a));
}

export function vIsNull(a: readonly number[]): boolean {
    const s = a.reduce((acc, v) => acc + Math.abs(v), 0);
    return s < 1e-13;
}

export function numEqual(a: number, b: number): boolean {
    return Math.abs(a - b) < 1e-13;
}

export function rnd0(n: number): number {
    return Math.abs(n) < 1e-13 ? 0 : n;
}
