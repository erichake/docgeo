import { describe, expect, it } from "vitest";
import { conicStandIns } from "../../src/editor/conic_preview";
import type { Vec3 } from "../../src/vec";

const apart = (points: Vec3[]) =>
    Math.min(
        ...points.flatMap((p, i) =>
            points
                .slice(i + 1)
                .map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])),
        ),
    );

describe("Conic preview", () => {
    it("stands in on the circle on the diameter, then the circumcircle", () => {
        const two: Vec3[] = [
            [1, 1, 0],
            [5, 3, 0],
        ];
        const ins = conicStandIns(two);
        expect(ins).toHaveLength(3);
        ins.forEach(([x, y]) =>
            expect(Math.hypot(x - 3, y - 2)).toBeCloseTo(Math.sqrt(5)),
        );
        expect(apart([...two, ...ins])).toBeGreaterThan(1);
        const three: Vec3[] = [
            [5, 0, 0],
            [0, 5, 0],
            [-3, -4, 0],
        ];
        const more = conicStandIns(three);
        expect(more).toHaveLength(2);
        more.forEach(([x, y]) => expect(Math.hypot(x, y)).toBeCloseTo(5));
        expect(apart([...three, ...more])).toBeGreaterThan(1);
    });

    it("keeps four concyclic points on their circle, a rectangle's too", () => {
        const rectangle: Vec3[] = [
            [3, 4, 2],
            [-3, 4, 2],
            [-3, -4, 2],
            [3, -4, 2],
        ];
        const [[x, y, z]] = conicStandIns(rectangle);
        expect(Math.hypot(x, y)).toBeCloseTo(5);
        expect(z).toBe(2);
        expect(apart([...rectangle, [x, y, z]])).toBeGreaterThan(1);
    });

    it("takes the conic of the pencil nearest to a circle", () => {
        const rhombus: Vec3[] = [
            [2, 0, 0],
            [0, 1, 0],
            [-2, 0, 0],
            [0, -1, 0],
        ];
        const [[x, y, z]] = conicStandIns(rhombus);
        expect((x * x) / 4 + y * y).toBeCloseTo(1);
        expect(apart([...rhombus, [x, y, z]])).toBeGreaterThan(0.5);
    });

    it("repeats the first point when no conic passes", () => {
        expect(
            conicStandIns([
                [0, 0, 0],
                [1, 1, 0],
                [2, 2, 0],
            ]),
        ).toEqual([
            [0, 0, 0],
            [0, 0, 0],
        ]);
    });
});
