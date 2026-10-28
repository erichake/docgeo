import { describe, expect, it } from "vitest";
// First, as in main.ts: the object classes import each other.
import "../../src/construction";
import type { construction } from "../../src/construction";
import { describeDgo, figureObjects, readDgo } from "../../src/dgo";
import { isCommand } from "../../src/editor/catalog";
import {
    add,
    addPointOn,
    figureIndex,
    lineOf,
    resolve,
} from "../../src/editor/figure";
import { pick } from "../../src/editor/pick";
import { parseLine } from "../../src/editor/text";
import { point_on_object } from "../../src/objects/point_on_object";
import { viewDirection } from "../../src/projection";
import { vAdd, vNorm, vNormalize, vScale, type Vec3 } from "../../src/vec";
import { createConstruction, disposeFigures, expectClose } from "./figures";

disposeFigures();

function space(perspective: boolean, objects: unknown[]): construction {
    const c = createConstruction([800, 600]);
    readDgo(c, {
        dgo: 1,
        v: { o: [400, 300], u: 40, w: 800, h: 600, "3d": 1 },
        o: objects,
    });
    // Seen from aside and above.
    c.GRID.THETA = 0.4;
    c.GRID.PHI = 0.6;
    c.GRID.PERSPECTIVE = perspective;
    c.invalidateProjection();
    c.flush();
    return c;
}

// On its object's near side, at `at`.
function place(point: point_on_object, at: Vec3): void {
    point.alpha = point.alphaFor(at)!;
    point.C.invalidateGeometry(point);
    point.C.flush();
}

function drag(point: point_on_object, at: Vec3 | [number, number]): void {
    const [x, y] = at.length === 3 ? point.C.pt3D(at) : at;
    point.mousedrag(
        new PointerEvent("pointermove", { clientX: x, clientY: y }),
    );
    point.C.flush();
}

// Towards the camera.
const front = (c: construction): Vec3 =>
    vScale(vNormalize(viewDirection(c.projectionFrame))!, -1);

describe.each([false, true])("point on a surface (perspective=%s)", (p) => {
    const sphere = () =>
        space(p, [
            ["Pt", "O", [0, 0, 0]],
            ["Pt", "S", [0, 0, 2]],
            ["Sph", "s", [0, 1]],
            ["On", "M", [2, [1, 0, 0]]],
        ]);
    // Its point in that direction.
    const on = (u: Vec3): Vec3 => vScale(vNormalize(u)!, 2);

    it("follows its sphere", () => {
        const c = sphere();
        const M = c.getObj("M") as point_on_object;
        expectClose(M.coords, [2, 0, 0]);
        const S = c.getObj("S")!;
        (S as unknown as { coords: Vec3 }).coords = [0, 0, 3];
        c.invalidateGeometry(S);
        c.flush();
        expectClose(M.coords, [3, 0, 0]);
    });

    it("moves on the near side of the sphere under the pointer", () => {
        const c = sphere();
        const M = c.getObj("M") as point_on_object;
        place(M, on(front(c)));
        const target = on(vAdd(front(c), [0.3, -0.2, 0.4]));
        drag(M, target);
        expectClose(M.coords, target);
    });

    it("stays on the far side it is on", () => {
        const c = sphere();
        const M = c.getObj("M") as point_on_object;
        const back = (offset: Vec3) => on(vAdd(vScale(front(c), -1), offset));
        M.alpha = vNormalize(back([0.1, 0.1, 0]))!;
        c.invalidateGeometry(M);
        c.flush();
        const target = back([-0.3, 0.2, 0.3]);
        drag(M, target);
        expectClose(M.coords, target);
    });

    it("glides on the outline, then back to the near side", () => {
        const c = sphere();
        const M = c.getObj("M") as point_on_object;
        place(M, on(front(c)));
        const [cx, cy] = c.pt3D([0, 0, 0]);
        drag(M, [cx + 300, cy]);
        expect(vNorm(M.coords)).toBeCloseTo(2);
        const [x, y] = M.screen;
        // On the outline, toward the pointer.
        expect(Math.abs(y - cy)).toBeLessThan(2);
        expect(x).toBeGreaterThan(cx);
        const target = on(vAdd(front(c), [0.2, 0.3, -0.1]));
        drag(M, target);
        expectClose(M.coords, target);
    });

    const cylinder = (cone: boolean) =>
        space(p, [
            ["Pt", "A", [0, 0, 0]],
            ["Pt", "B", [0, 0, 3]],
            [cone ? "Cone" : "Cyl", "k", [0, 1, 1]],
            ["On", "M", [2, [1, 0, 0.5]]],
        ]);

    it.each([false, true])(
        "moves on the side of a cylinder or a cone (cone=%s)",
        (cone) => {
            const c = cylinder(cone);
            const M = c.getObj("M") as point_on_object;
            const radius = cone ? 0.5 : 1;
            expect(Math.hypot(M.coords[0], M.coords[1])).toBeCloseTo(radius);
            expect(M.coords[2]).toBeCloseTo(1.5);
            // The side seen from the camera, at 1/3 of its height.
            const [dx, dy] = front(c);
            const r = cone ? 2 / 3 : 1;
            const angle = Math.atan2(dy, dx) + 0.4;
            place(M, [dx, dy, 1.5]);
            const target: Vec3 = [r * Math.cos(angle), r * Math.sin(angle), 1];
            drag(M, target);
            expectClose(M.coords, target);
        },
    );

    it("stops at the rim of a cylinder", () => {
        const c = cylinder(false);
        const M = c.getObj("M") as point_on_object;
        const [dx, dy] = front(c);
        const angle = Math.atan2(dy, dx);
        drag(M, [Math.cos(angle), Math.sin(angle), 1]);
        const [, top] = c.pt3D([0, 0, 3]);
        const [x] = c.pt3D([0, 0, 0]);
        drag(M, [x, top - 300]);
        expect(M.coords[2]).toBeCloseTo(3);
        expect(Math.hypot(M.coords[0], M.coords[1])).toBeCloseTo(1);
    });
});

describe("point on a surface in the editor", () => {
    const type = (c: construction, text: string) =>
        add(c, resolve(c, parseLine(text, isCommand)));
    const lines = (c: construction): string[] => {
        const index = figureIndex(c);
        const objects = figureObjects(c);
        return objects.map((object) => lineOf(object, index, objects)!);
    };

    it("puts the point where the sphere is designated, and saves it", async () => {
        const c = space(false, []);
        ["O = (0, 0, 0)", "S = (0, 0, 2)", "s = Sphere(O, S)"].forEach((line) =>
            type(c, line),
        );
        c.flush();
        const at: Vec3 = vScale(
            vNormalize(vAdd(front(c), [0.2, 0.3, 0.1]))!,
            2,
        );
        const hit = pick(c, c.pt3D(at)).find(
            ({ object }) => object.name === "s",
        )!;
        const point = addPointOn(c, "P", hit.object, hit.at);
        expectClose(point.coords, at);
        const line = lines(c)[3];
        expect(line).toMatch(/^P = Point\(s, [-\d.]+, [-\d.]+, [-\d.]+\)$/);
        const other = space(false, []);
        readDgo(other, await describeDgo(c));
        expectClose((other.getObj("P") as point_on_object).coords, at);
        expect(lines(other)).toEqual(lines(c));
        type(other, "Q = Point(s, 0, 0, -1)");
        other.flush();
        expectClose((other.getObj("Q") as point_on_object).coords, [0, 0, -2]);
    });
});
