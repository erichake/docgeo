import { describe, expect, it } from "vitest";
import {
    projectPoint,
    screenBasis,
    unprojectPointToZPlane,
    type ProjectionFrame,
} from "../../src/projection";

const topView: ProjectionFrame = {
    origin: [100, 100],
    unit: [10, 20, 30],
    cosPhi: 0,
    sinPhi: 1,
    cosTheta: 0,
    sinTheta: 1,
};

describe("3D projection", () => {
    it("projects known points and basis vectors", () => {
        expect(projectPoint([1, 2, 3], topView)).toEqual([110, 60]);
        expect(screenBasis(topView)).toEqual([
            [110, 100],
            [100, 80],
            [100, 100],
        ]);
    });

    it("inverts a projected point on a fixed z plane", () => {
        const point = [2, -3, 5] as const;
        const screen = projectPoint(point, topView);

        expect(unprojectPointToZPlane(screen, point[2], topView)).toEqual(
            point,
        );
    });

    it("rejects a singular screen plane", () => {
        const singular = { ...topView, cosTheta: 1, sinTheta: 0 };

        expect(unprojectPointToZPlane([100, 100], 0, singular)).toBeNull();
    });
});
