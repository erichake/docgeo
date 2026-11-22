import { describe, expect, it } from "vitest";
import type { construction_object } from "../../src/objects/construction_object";
import { predicate } from "../../src/predicates";
import type { Vec3 } from "../../src/vec";

// Objects as the predicates read them.
const shape = (fields: object, value: unknown = null) =>
    ({
        defined: true,
        scriptValue: () => value,
        ...fields,
    }) as unknown as construction_object;
const point = (x: number, y: number) => shape({ coords: [x, y, 0] });
const line = (p: Vec3, d: Vec3, length: number | null = null) =>
    shape({ P1: { coords: p }, VEC: d }, length);
const circle = (c: Vec3, r: number) => shape({ CENTER: c, R: r }, r);

describe("predicates", () => {
    it("are decided numerically, to 1e-9 relatively", () => {
        expect(
            predicate("AreCollinear", [
                point(0, 0),
                point(1e6, 1),
                point(2e6, 2),
            ]),
        ).toBe(1);
        expect(
            predicate("AreCollinear", [
                point(0, 0),
                point(1, 1),
                point(2, 2.001),
            ]),
        ).toBe(0);
        const d = line([0, 0, 0], [3, 4, 0]);
        expect(
            predicate("ArePerpendicular", [d, line([5, 1, 0], [-8, 6, 0])]),
        ).toBe(1);
        expect(predicate("AreParallel", [d, line([5, 1, 0], [-8, 6, 0])])).toBe(
            0,
        );
        expect(
            predicate("AreConcyclic", [
                point(1, 0),
                point(0, 1),
                point(-1, 0),
                point(0.6, -0.8),
            ]),
        ).toBe(1);
        expect(
            predicate("AreConcurrent", [
                line([1, 1, 0], [1, 0, 0]),
                line([1, 1, 0], [0, 1, 0]),
                line([3, 3, 0], [1, 1, 0]),
            ]),
        ).toBe(1);
        expect(predicate("AreEqual", [point(1, 2), point(1, 2)])).toBe(1);
        expect(
            predicate("AreEqual", [circle([0, 0, 0], 2), circle([0, 0, 0], 3)]),
        ).toBe(0);
        expect(predicate("AreEqual", [d, line([6, 8, 0], [-3, -4, 0])])).toBe(
            1,
        );
        // Segments by their lengths, numbers by their values.
        expect(
            predicate("AreEqual", [
                line([0, 0, 0], [3, 4, 0], 5),
                line([9, 9, 0], [5, 0, 0], 5),
            ]),
        ).toBe(1);
        expect(predicate("AreEqual", [shape({}, 2), shape({}, 2.5)])).toBe(0);
    });

    it("are undefined of other objects, or undefined ones", () => {
        expect(
            predicate("AreCollinear", [point(0, 0), point(1, 1), d()]),
        ).toBeNull();
        expect(
            predicate("AreEqual", [point(0, 0), circle([0, 0, 0], 1)]),
        ).toBeNull();
        expect(
            predicate("AreCollinear", [
                point(0, 0),
                point(1, 1),
                shape({ coords: [2, 2, 0], defined: false }),
            ]),
        ).toBeNull();
    });
});

function d() {
    return line([0, 0, 0], [1, 0, 0]);
}
