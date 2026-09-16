import { describe, expect, it } from "vitest";
import {
    projectPoint,
    projectPointOnLine,
    projectPointOnPlane,
    screenBasis,
    unprojectPointToZPlane,
    viewDirection,
    type ProjectionFrame,
} from "../../src/projection";
import { vNormalize, type Vec3 } from "../../src/vec";

const topView: ProjectionFrame = {
    origin: [100, 100],
    unit: [10, 20, 30],
    cosPhi: 0,
    sinPhi: 1,
    cosTheta: 0,
    sinTheta: 1,
};

// A tilted view (not the degenerate top-down angle above) with perspective
// switched on, so depth actually varies across the scene.
const perspectiveView: ProjectionFrame = {
    origin: [100, 100],
    unit: [10, 20, 30],
    cosPhi: Math.cos(0.4),
    sinPhi: Math.sin(0.4),
    cosTheta: Math.cos(0.5),
    sinTheta: Math.sin(0.5),
    focal: 8,
};
perspectiveView.dir = vNormalize(viewDirection(perspectiveView))!;

function expectVec3Close(actual: Vec3, expected: Vec3, precision = 6): void {
    expect(actual[0]).toBeCloseTo(expected[0], precision);
    expect(actual[1]).toBeCloseTo(expected[1], precision);
    expect(actual[2]).toBeCloseTo(expected[2], precision);
}

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

describe("perspective projection", () => {
    it("scales nearer points more than farther ones", () => {
        const dir = perspectiveView.dir!;
        const near = [0.5, 0.5, 0.5] as const;
        const far: Vec3 = [
            near[0] + dir[0],
            near[1] + dir[1],
            near[2] + dir[2],
        ];

        const orthoNear = projectPoint(near, {
            ...perspectiveView,
            focal: undefined,
        });
        const orthoFar = projectPoint(far, {
            ...perspectiveView,
            focal: undefined,
        });
        const perspNear = projectPoint(near, perspectiveView);
        const perspFar = projectPoint(far, perspectiveView);

        // Orthographic doesn't care about depth: the two points project the
        // same distance apart regardless of which one is "near".
        expect(orthoNear).toEqual(orthoFar);
        // Perspective does: moving a point away from the camera along `dir`
        // shrinks it toward the vanishing point, so it no longer lands on
        // the same screen spot as the near point.
        expect(perspNear).not.toEqual(perspFar);
    });

    it("inverts a projected point on a fixed z plane", () => {
        const point: Vec3 = [2, -3, 5];
        const screen = projectPoint(point, perspectiveView);

        const recovered = unprojectPointToZPlane(
            screen,
            point[2],
            perspectiveView,
        );
        expect(recovered).not.toBeNull();
        expectVec3Close(recovered!, point);
    });

    it("inverts a projected point on an arbitrary plane", () => {
        const origin: Vec3 = [1, 1, 1];
        const basis: [Vec3, Vec3] = [
            [1, 0.3, -0.2],
            [0, 1, 0.4],
        ];
        const point: Vec3 = [
            origin[0] + 0.6 * basis[0][0] + -0.4 * basis[1][0],
            origin[1] + 0.6 * basis[0][1] + -0.4 * basis[1][1],
            origin[2] + 0.6 * basis[0][2] + -0.4 * basis[1][2],
        ];
        const screen = projectPoint(point, perspectiveView);

        const recovered = projectPointOnPlane(
            screen,
            origin,
            basis,
            perspectiveView,
        );
        expect(recovered).not.toBeNull();
        expectVec3Close(recovered!, point);
    });

    it("recovers a point along a 3D line from its screen position", () => {
        const origin: Vec3 = [-1, 2, 0.5];
        const direction: Vec3 = [1, -1, 2];
        const point: Vec3 = [
            origin[0] + 0.7 * direction[0],
            origin[1] + 0.7 * direction[1],
            origin[2] + 0.7 * direction[2],
        ];
        const screen = projectPoint(point, perspectiveView);

        const recovered = projectPointOnLine(
            screen,
            origin,
            direction,
            perspectiveView,
        );
        expect(recovered).not.toBeNull();
        expectVec3Close(recovered!, point);
    });

    it("agrees with plain affine interpolation when perspective is off", () => {
        const origin: Vec3 = [0, 0, 0];
        const direction: Vec3 = [3, -1, 2];
        const point: Vec3 = [
            0.4 * direction[0],
            0.4 * direction[1],
            0.4 * direction[2],
        ];
        const screen = projectPoint(point, topView);

        expect(projectPointOnLine(screen, origin, direction, topView)).toEqual(
            point,
        );
    });
});
