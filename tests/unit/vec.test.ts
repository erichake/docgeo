import { describe, expect, it } from "vitest";
import {
    vAdd,
    vCross,
    vDot,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec3,
} from "../../src/vec";

describe("vector operations", () => {
    it("normalizes a vector without mutating it", () => {
        const vector: Vec3 = [3, 4, 0];

        expect(vNormalize(vector)).toEqual([0.6, 0.8, 0]);
        expect(vector).toEqual([3, 4, 0]);
    });

    it("rejects zero and non-finite vectors", () => {
        expect(vNormalize([0, 0])).toBeNull();
        expect(vNormalize([Number.POSITIVE_INFINITY, 1])).toBeNull();
    });

    it("keeps large finite norms finite", () => {
        expect(vNorm([1e308, 1e308])).toBeCloseTo(Math.SQRT2 * 1e308);
    });

    it("computes pure 2D and 3D operations", () => {
        expect(vAdd([1, 2], [3, 4])).toEqual([4, 6]);
        expect(vSub([4, 6, 8], [1, 2, 3])).toEqual([3, 4, 5]);
        expect(vScale([1, 2, 3], 2)).toEqual([2, 4, 6]);
        expect(vDot([1, 2, 3], [4, 5, 6])).toBe(32);
        expect(vCross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    });
});
