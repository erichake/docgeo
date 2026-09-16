import { describe, expect, it } from "vitest";
import {
    conicConicIntersectionsXY,
    lineConicIntersections,
    realCubicRoots,
    realQuarticRoots,
    type ConicCoeffs,
} from "../../src/objects/conic_algebra";

function closeToOneOf(value: number, candidates: number[], tolerance = 1e-5) {
    expect(candidates.some((c) => Math.abs(c - value) <= tolerance)).toBe(true);
}

describe("realCubicRoots", () => {
    it("finds all three real roots of (x+1)(x-2)(x-3)", () => {
        // x^3 -4x^2 +x +6
        const roots = realCubicRoots(1, -4, 1, 6).sort((a, b) => a - b);
        expect(roots.map((r) => Math.round(r * 1e6) / 1e6)).toEqual([-1, 2, 3]);
    });

    it("finds the single real root when the other two are complex", () => {
        // (x-1)(x^2+1) = x^3 - x^2 + x - 1
        const roots = realCubicRoots(1, -1, 1, -1);
        expect(roots).toHaveLength(1);
        expect(roots[0]).toBeCloseTo(1);
    });
});

describe("realQuarticRoots", () => {
    it("finds 4 real roots: (x+2)(x+1)(x-1)(x-3)", () => {
        const roots = realQuarticRoots(1, -1, -7, 1, 6).sort((a, b) => a - b);
        expect(roots.map((r) => Math.round(r * 1e6) / 1e6)).toEqual([
            -2, -1, 1, 3,
        ]);
    });

    it("finds 2 real roots when the other two are complex", () => {
        // (x-1)(x-2)(x^2+1)
        const roots = realQuarticRoots(1, -3, 3, -3, 2).sort((a, b) => a - b);
        expect(roots.map((r) => Math.round(r * 1e6) / 1e6)).toEqual([1, 2]);
    });

    it("finds a double root alongside two simple ones", () => {
        // (x-1)^2 (x-2)(x+2)
        const roots = realQuarticRoots(1, -2, -3, 8, -4).sort((a, b) => a - b);
        expect(roots.map((r) => Math.round(r * 1e6) / 1e6)).toEqual([
            -2, 1, 1, 2,
        ]);
    });

    it("resolves a near-tangent pair of close roots without merging them", () => {
        // Coefficients of (x-1)(x-1.0001)(x+1)(x-5), built by expanding the
        // roots directly to avoid hand-arithmetic mistakes.
        const build = (roots: number[]): number[] => {
            let poly = [1];
            for (const r of roots) {
                const next = new Array(poly.length + 1).fill(0);
                poly.forEach((coefficient, i) => {
                    next[i] += -r * coefficient;
                    next[i + 1] += coefficient;
                });
                poly = next;
            }
            return poly.reverse();
        };
        const [a, b, c, d, e] = build([1, 1.0001, -1, 5]);
        const found = realQuarticRoots(a, b, c, d, e).sort((x, y) => x - y);
        expect(found).toHaveLength(4);
        closeToOneOf(1, found);
        closeToOneOf(1.0001, found);
        closeToOneOf(-1, found);
        closeToOneOf(5, found);
    });

    it("returns no roots for a fully complex quartic", () => {
        expect(realQuarticRoots(1, 0, 0, 0, 1)).toHaveLength(0);
    });

    it("degrades to a cubic solve when the leading coefficient vanishes", () => {
        // 0*x^4 + x^3 -6x^2+11x-6 = (x-1)(x-2)(x-3)
        const roots = realQuarticRoots(0, 1, -6, 11, -6).sort((a, b) => a - b);
        expect(roots.map((r) => Math.round(r * 1e6) / 1e6)).toEqual([1, 2, 3]);
    });
});

describe("lineConicIntersections", () => {
    it("finds both crossings of a line through a circle-shaped conic, sorted by t", () => {
        // x^2+y^2-4=0 (circle radius 2), line y=0 from x=-5 going +x.
        const coeffs: ConicCoeffs = [1, 0, 1, 0, 0, -4];
        const roots = lineConicIntersections([-5, 0, 0], [1, 0, 0], coeffs);
        expect(roots).toHaveLength(2);
        expect(roots[0]).toBeLessThan(roots[1]);
        expect(roots[0]).toBeCloseTo(3); // x=-2
        expect(roots[1]).toBeCloseTo(7); // x=2
    });

    it("returns no roots for a line that misses the conic", () => {
        const coeffs: ConicCoeffs = [1, 0, 1, 0, 0, -4];
        const roots = lineConicIntersections([-5, 10, 0], [1, 0, 0], coeffs);
        expect(roots).toHaveLength(0);
    });
});

describe("conicConicIntersectionsXY", () => {
    it("recovers 4 real intersections including 2 shared construction points", () => {
        // Two conics deliberately fit so their coefficients are unrelated,
        // but both satisfied by (1, 0.5) and (-0.5, 1.2) (verified via the
        // same construction used to validate the algorithm in Python).
        const conic1: ConicCoeffs = [
            0.11671405852770718, -0.048718480886940876, -0.5187291490120317,
            -0.5175725232068022, -0.1787512608082001, 0.6442756227796735,
        ];
        const conic2: ConicCoeffs = [
            0.5569196242176728, -0.06161431081146326, -0.554289228530151,
            -0.5699684839225485, 0.2208077604824313, 0.0720244420019293,
        ];
        const points = conicConicIntersectionsXY(conic1, conic2);
        expect(points.length).toBeGreaterThanOrEqual(2);
        for (const [px, py] of [
            [1, 0.5],
            [-0.5, 1.2],
        ]) {
            expect(
                points.some(([x, y]) => Math.hypot(x - px, y - py) < 1e-4),
            ).toBe(true);
        }
        for (const [x, y] of points) {
            const evaluate = ([a, b, c, d, e, f]: ConicCoeffs) =>
                a * x * x + b * x * y + c * y * y + d * x + e * y + f;
            expect(Math.abs(evaluate(conic1))).toBeLessThan(1e-6);
            expect(Math.abs(evaluate(conic2))).toBeLessThan(1e-6);
        }
    });

    it("returns no points for two conics that don't meet in real space", () => {
        // Two small, far-apart circles.
        const conic1: ConicCoeffs = [1, 0, 1, 0, 0, -1]; // centered origin, r=1
        const conic2: ConicCoeffs = [1, 0, 1, -20, 0, 99]; // centered (10,0), r=1
        expect(conicConicIntersectionsXY(conic1, conic2)).toHaveLength(0);
    });
});
