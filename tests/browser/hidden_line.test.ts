import { afterEach, describe, expect, it, vi } from "vitest";
import "../../src/construction";
import { importDgoFromUrl, readDgo } from "../../src/dgo";
import { hiddenIntervals, isOccluded } from "../../src/objects/hidden_line";
import type { point_object } from "../../src/objects/point_object";
import type { polygon_object } from "../../src/objects/polygon_object";
import type { Vec3 } from "../../src/vec";
import { createConstruction, disposeFigures } from "./figures";

afterEach(() => vi.restoreAllMocks());
disposeFigures();

describe("Polygon spatial index", () => {
    it("bounds its work when inverted sides approach and cross the pole", async () => {
        const c = createConstruction([1172, 754]);
        await importDgoFromUrl(c, "/tests/dgo/image_poly.dgo");
        const g = c.getObj("G") as point_object;
        const a = (c.getObj("A") as point_object).coords;
        const h = (c.getObj("H") as point_object).coords;
        const f = (c.getObj("F") as point_object).coords;
        const original = g.coords;
        const image = c.getObj("poly1'") as polygon_object;
        const positions: Vec3[] = [
            [3.83593, 2.7597, 0],
            [6.63648, 2.3203, 0],
        ];
        for (const offset of [
            0.1, 0.01, 0.001, 0.0001, 0.000001, 0, -0.000001, -0.001, -0.1,
        ]) {
            const x = 6.6;
            positions.push(
                [
                    x,
                    h[1] +
                        ((a[1] - h[1]) * (x - h[0])) / (a[0] - h[0]) +
                        offset,
                    0,
                ],
                [2 * a[0] - f[0] + offset, 2 * a[1] - f[1], 0],
            );
        }
        positions.push(a, original);
        const set = Map.prototype.set;
        let cells = 0;
        vi.spyOn(Map.prototype, "set").mockImplementation(function (
            this: Map<unknown, unknown>,
            key,
            value,
        ) {
            // Fail promptly if the old unbounded grid returns, rather than
            // exhausting the browser's memory while running this test.
            if (
                typeof key === "string" &&
                /^-?\d+,-?\d+$/.test(key) &&
                ++cells > 4096
            )
                throw new Error("Spatial index exceeded its cell budget");
            return set.call(this, key, value);
        });
        for (const position of positions) {
            cells = 0;
            g.coords = position;
            c.invalidateGeometry(g);
            c.flush();
            expect(image.defined).toBe(position !== a);
        }
        expect(g.coords).toEqual(original);
    });

    it("keeps large occluders for queries inside and outside the indexed cells", () => {
        const c = createConstruction([800, 600]);
        readDgo(c, {
            dgo: 1,
            v: { o: [400, 300], u: 40, w: 800, h: 600, "3d": 1 },
            o: [
                ["Pt", "A", [-1e6, -1e6, 1]],
                ["Pt", "B", [1e6, -1e6, 1]],
                ["Pt", "C", [1e6, 1e6, 1]],
                ["Pt", "D", [-1e6, 1e6, 1]],
                ["Poly", "large", [0, 1, 2, 3]],
                ["Pt", "E", [2, 2, 1]],
                ["Pt", "F", [3, 2, 1]],
                ["Pt", "G", [2, 3, 1]],
                ["Poly", "small", [5, 6, 7]],
                ["Pt", "P", [-1, 0, 0]],
                ["Pt", "Q", [1, 0, 0]],
                ["Pt", "far", [1000, 0, 0]],
            ],
        });
        c.GRID.PHI = Math.PI / 2;
        c.GRID.THETA = Math.PI / 2;
        c.GRID.SHOWFLOOR = false;
        c.getObj("large")!.opacity = 1;
        c.invalidateProjection();
        c.flush();
        const p = c.getObj("P") as point_object;
        const q = c.getObj("Q") as point_object;
        expect(hiddenIntervals(c, p, q)).toEqual({ visible: [], hidden: [] });
        expect(isOccluded(c, c.getObj("far") as point_object)).toBe(true);
        c.removeObject(c.getObj("small")!);
        c.flush();
        expect(hiddenIntervals(c, p, q)).toEqual({ visible: [], hidden: [] });
        expect(isOccluded(c, c.getObj("far") as point_object)).toBe(true);
    });
});
