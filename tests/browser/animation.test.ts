import { describe, expect, it } from "vitest";
// First, as in main.ts: the object classes import each other.
import "../../src/construction";
import type { construction } from "../../src/construction";
import { importDgpFromUrl } from "../../src/dgp_importer";
import { describeDgo } from "../../src/dgo";
import { importGgbFromBlob } from "../../src/ggb_importer";
import type { circle3pts_object } from "../../src/objects/circle3pts_object";
import type { expression_object } from "../../src/objects/expression_object";
import type { point_on_object } from "../../src/objects/point_on_object";
import type { polygon_object } from "../../src/objects/polygon_object";
import type { segment_object } from "../../src/objects/segment_object";
import type { Vec2 } from "../../src/vec";
import { createConstruction, disposeFigures, figure, frame } from "./figures";

disposeFigures();

async function open(name: string): Promise<construction> {
    const c = createConstruction();
    await importDgpFromUrl(c, figure(name));
    await frame();
    return c;
}

async function openGgb(name: string): Promise<construction> {
    const c = createConstruction();
    await importGgbFromBlob(c, await (await fetch(figure(name))).blob());
    await frame();
    return c;
}

const distance = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Moves the object along its animation, the figure brought up to date.
function animate(
    c: construction,
    object: point_on_object | expression_object,
    seconds: number,
): void {
    object.animate(seconds);
    c.flush();
}

describe("animations", () => {
    it("reads and saves DGPad's", async () => {
        const c = await open("Animations02.dgp");
        const animation = (name: string) =>
            (c.getObj(name) as point_on_object).animation;
        expect(animation("P5")).toEqual({
            speed: 400,
            direction: 1,
            ar: false,
        });
        expect(animation("P12")).toEqual({
            speed: 50,
            direction: -1,
            ar: true,
        });
        expect(animation("E2")).toEqual({ speed: 10, direction: -1, ar: true });
        const styles = (await describeDgo(c)).st!;
        expect(styles.map((style) => style.an).filter(Boolean)).toEqual([
            [10, 1, 0],
            [10, -1, 1],
            [400, 1, 0],
            [1.2217304763960306, 1, 0],
            [50, -1, 1],
            [50, 1, 0],
        ]);
    });

    it("moves a point along a segment at its speed in pixels", async () => {
        const c = await open("Animations.dgp");
        const M = c.getObj("M") as point_on_object;
        const before = M.screen;
        animate(c, M, 0.1);
        expect(distance(M.screen, before)).toBeCloseTo(20);
    });

    it("goes back and forth or around", async () => {
        const c = await open("Animations02.dgp");
        const P12 = c.getObj("P12") as point_on_object;
        const P13 = c.getObj("P13") as point_on_object;
        const length = (point: point_on_object) => {
            const { P1, P2 } = point.support as segment_object;
            return distance(P1.screen, P2.screen);
        };
        // Beyond its first end, back from it.
        const alpha12 = P12.alpha as number;
        animate(c, P12, 1);
        expect(P12.animation!.direction).toBe(1);
        expect(P12.alpha).toBeCloseTo(50 / length(P12) - alpha12);
        // Beyond its second end, around from the first.
        const alpha13 = P13.alpha as number;
        animate(c, P13, 1);
        expect(P13.animation!.direction).toBe(1);
        expect(P13.alpha).toBeCloseTo(alpha13 + 50 / length(P13) - 1);
    });

    it("turns a point around a circle in radians", async () => {
        const c = await open("Animations02.dgp");
        const P7 = c.getObj("P7") as point_on_object;
        const alpha = P7.alpha as number;
        animate(c, P7, 1);
        expect(P7.alpha).toBeCloseTo(
            (alpha + 1.2217304763960306) % (2 * Math.PI),
        );
    });

    it("turns a point around a Circle3pts3D through its samples", async () => {
        const c = await open("ParaboloideHyper5Ressorts.dgp");
        const M = c.getObj("M") as point_on_object;
        const C1 = M.support as circle3pts_object;
        expect(C1.dgpadIndex(M.coords)).toBeCloseTo(1378);
        // 5 × 100 samples, around from the first beyond the last, 1499.
        animate(c, M, 1);
        expect(C1.dgpadIndex(M.coords)).toBeCloseTo(1378 + 500 - 1499);
    });

    it("walks a point along a polygon's boundary", async () => {
        const c = await open("Animations02.dgp");
        const P5 = c.getObj("P5") as point_on_object;
        const vertices = (P5.support as polygon_object).points.map(
            (point) => point.screen,
        );
        const perimeter = vertices.reduce(
            (sum, vertex, index) =>
                sum + distance(vertex, vertices[(index + 1) % vertices.length]),
            0,
        );
        const before = P5.screen;
        animate(c, P5, 0.01);
        expect(distance(P5.screen, before)).toBeCloseTo(4);
        for (let step = 1; step < 100; step++)
            animate(c, P5, (perimeter / 400 - 0.01) / 99);
        expect(distance(P5.screen, before)).toBeLessThan(1e-6);
    });

    it("moves sliders, by whole increments if they have one", async () => {
        const c = await open("Animations02.dgp");
        const E1 = c.getObj("E1") as expression_object;
        const E2 = c.getObj("E2") as expression_object;
        const value = E1.value as number;
        animate(c, E1, 0.5);
        expect(E1.value).toBeCloseTo(value + 1);
        animate(c, E2, 0.3);
        expect(E2.value).toBe(5);
        animate(c, E2, 0.3);
        expect(E2.value).toBe(4);
    });

    it("runs until paused", async () => {
        const c = await open("Animations.dgp");
        const M = c.getObj("M") as point_on_object;
        const button = document.querySelector("button")!;
        const alpha = M.alpha;
        c.animations.paused = false;
        await frame();
        await frame();
        await frame();
        expect(M.alpha).not.toBe(alpha);
        button.dispatchEvent(
            new PointerEvent("pointerdown", { bubbles: true }),
        );
        const paused = M.alpha;
        await frame();
        await frame();
        expect(M.alpha).toBe(paused);
        expect(c.animations.paused).toBe(true);
    });

    it("plays GeoGebra's, around a circle in 10 s at speed 1", async () => {
        const c = await openGgb("Animation.ggb");
        const A = c.getObj("A") as point_on_object;
        const B = c.getObj("B") as point_on_object;
        expect(B.animation).toEqual({
            speed: 1,
            direction: 1,
            ar: false,
            geogebra: true,
        });
        const angle = () =>
            Math.atan2(B.coords[1] - A.coords[1], B.coords[0] - A.coords[0]);
        const before = angle();
        animate(c, B, 1);
        expect((angle() - before + 4 * Math.PI) % (2 * Math.PI)).toBeCloseTo(
            (2 * Math.PI) / 10,
        );
        const styles = (await describeDgo(c)).st!;
        expect(styles.map((style) => style.an).filter(Boolean)).toEqual([
            [1, 1, 0, 1],
        ]);
    });

    it("plays GeoGebra's along a path, a slider's range", async () => {
        const c = await openGgb("Animations02.ggb");
        const P = c.getObj("P") as point_on_object;
        const Q = c.getObj("Q") as point_on_object;
        const k = c.getObj("k") as expression_object;
        // Increasing once, along a segment from (0, 0) to (4, 0).
        animate(c, P, 1);
        expect(P.coords[0]).toBeCloseTo(1.4);
        animate(c, P, 10);
        expect(P.coords[0]).toBeCloseTo(4);
        expect(P.animation!.speed).toBe(0);
        // Decreasing, a unit per edge of the triangle (0, 0), (4, 0), (4, 3),
        // from (4, 1).
        animate(c, Q, 1);
        expect(Q.coords[0]).toBeCloseTo(4);
        expect(Q.coords[1]).toBeCloseTo(0.55);
        animate(c, Q, 3);
        expect(Q.coords[0]).toBeCloseTo(44 / 15);
        expect(Q.coords[1]).toBeCloseTo(0);
        // Oscillating from 3, between 0 and 10, by whole increments.
        animate(c, k, 0.5);
        expect(k.value).toBe(4);
        animate(c, k, 3.5);
        expect(k.value).toBe(9);
        expect(k.animation!.direction).toBe(-1);
        const styles = (await describeDgo(c)).st!;
        expect(styles.map((style) => style.an).filter(Boolean)).toEqual([
            [0, 1, 2, 1],
            [0.5, -1, 0, 1],
            [2, -1, 1, 1],
        ]);
    });
});
