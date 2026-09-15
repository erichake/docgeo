import { afterEach, describe, expect, it, vi } from "vitest";
import { construction } from "../../src/construction";
import { createIntersection } from "../../src/objects/intersection_object";
import { createMidpoint } from "../../src/objects/midpoint_object";
import { createPlumb } from "../../src/objects/plumb_line_object";
import { createPoint } from "../../src/objects/point_object";
import { createRay } from "../../src/objects/ray_line_object";
import { createSegment } from "../../src/objects/segment_object";
import { createLine } from "../../src/objects/two_points_line_object";
import { preferences } from "../../src/preferences";
import { vDot } from "../../src/vec";

function createConstruction(): construction {
    document.documentElement.style.width = "100%";
    document.documentElement.style.height = "100%";
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    document.body.style.margin = "0";
    return construction.create({ prefs: new preferences() });
}

afterEach(() => {
    construction.constructions.slice().forEach((item) => item.dispose());
    document.body.removeAttribute("style");
    document.documentElement.removeAttribute("style");
});

describe("geometric construction", () => {
    it("recovers a line after two defining points stop being coincident", () => {
        const c = createConstruction();
        const a = createPoint(c, "A", [0, 0, 0]);
        const b = createPoint(c, "B", [0, 0, 0]);
        const line = createLine(c, "d", a, b);

        expect(line.defined).toBe(false);
        expect(line.dom.isHidden()).toBe(true);

        b.coords = [1, 0, 0];
        c.invalidateGeometry(b);
        c.OBJS.update();

        expect(line.defined).toBe(true);
        expect(line.dom.isHidden()).toBe(false);
    });

    it("handles line, segment and ray intersections in 3D", () => {
        const c = createConstruction();
        const origin = createPoint(c, "O", [0, 0, 0]);
        const x = createPoint(c, "X", [1, 0, 0]);
        const xAxis = createLine(c, "xAxis", origin, x);

        const low = createPoint(c, "L", [0.5, -1, 0]);
        const high = createPoint(c, "H", [0.5, 1, 0]);
        const crossing = createLine(c, "crossing", low, high);
        expect(createIntersection(c, "I", xAxis, crossing).coords).toEqual([
            0.5, 0, 0,
        ]);

        const parallelA = createPoint(c, "PA", [0, 1, 0]);
        const parallelB = createPoint(c, "PB", [1, 1, 0]);
        const parallel = createLine(c, "parallel", parallelA, parallelB);
        expect(createIntersection(c, "IP", xAxis, parallel).defined).toBe(
            false,
        );

        const coincidentA = createPoint(c, "CA", [2, 0, 0]);
        const coincidentB = createPoint(c, "CB", [3, 0, 0]);
        const coincident = createLine(
            c,
            "coincident",
            coincidentA,
            coincidentB,
        );
        expect(createIntersection(c, "IC", xAxis, coincident).defined).toBe(
            false,
        );

        const skewA = createPoint(c, "SA", [0.5, -1, 1]);
        const skewB = createPoint(c, "SB", [0.5, 1, 1]);
        const skew = createLine(c, "skew", skewA, skewB);
        expect(createIntersection(c, "IS", xAxis, skew).defined).toBe(false);

        const segment = createSegment(c, "segment", origin, x);
        const outsideA = createPoint(c, "OA", [2, -1, 0]);
        const outsideB = createPoint(c, "OB", [2, 1, 0]);
        const outside = createLine(c, "outside", outsideA, outsideB);
        expect(createIntersection(c, "IT", segment, outside).defined).toBe(
            false,
        );

        const ray = createRay(c, "ray", origin, x);
        const behindA = createPoint(c, "BA", [-1, -1, 0]);
        const behindB = createPoint(c, "BB", [-1, 1, 0]);
        const behind = createLine(c, "behind", behindA, behindB);
        expect(createIntersection(c, "IR", ray, behind).defined).toBe(false);
    });

    it("constructs perpendicular lines in a plane and in space", () => {
        const c = createConstruction();
        const origin = createPoint(c, "O", [0, 0, 0]);
        const x = createPoint(c, "X", [1, 0, 0]);
        const axis = createLine(c, "axis", origin, x);
        const planePoint = createPoint(c, "P", [0, 1, 0]);
        const spacePoint = createPoint(c, "S", [0, 1, 1]);
        const planePlumb = createPlumb(c, "planePlumb", planePoint, axis);
        const spacePlumb = createPlumb(c, "spacePlumb", spacePoint, axis);

        expect(planePlumb.VEC).toEqual([0, -1, 0]);
        expect(vDot(spacePlumb.VEC, axis.VEC)).toBeCloseTo(0);
    });

    it("updates descendants and removes complete dependency branches", () => {
        const c = createConstruction();
        const a = createPoint(c, "A", [0, 0, 0]);
        const b = createPoint(c, "B", [2, 0, 0]);
        const midpoint = createMidpoint(c, "M", a, b);
        const segment = createSegment(c, "s", a, midpoint);

        const target = c.pt3D([2, 2, 0]);
        a.mousedrag(
            new PointerEvent("pointermove", {
                clientX: target[0],
                clientY: target[1],
            }),
        );
        c.OBJS.update();

        expect(midpoint.x).toBeCloseTo(2);
        expect(midpoint.y).toBeCloseTo(1);
        expect(midpoint.z).toBe(0);
        expect(segment.sP1).toEqual(a.screen);

        c.removeObject(a);

        expect(c.getObj("A")).toBeUndefined();
        expect(c.getObj("M")).toBeUndefined();
        expect(c.getObj("s")).toBeUndefined();
        expect(c.getObj("B")).toBe(b);
        expect(c.svg.dom().contains(a.dom.dom())).toBe(false);
    });

    it("reprojects without recomputing geometry when the camera rotates", () => {
        const c = createConstruction();
        const point = createPoint(c, "A", [1, 2, 3]);
        const geometry = c.OBJS.V.map((object) =>
            vi.spyOn(object, "computeGeometry"),
        );
        const oldScreen = point.screen;

        c.GRID.PHI -= 0.2;
        c.invalidateProjection();
        c.OBJS.update();

        geometry.forEach((spy) => expect(spy).not.toHaveBeenCalled());
        expect(point.screen).not.toEqual(oldScreen);
    });

    it("contains no non-finite SVG coordinate after a degeneration", () => {
        const c = createConstruction();
        const point = createPoint(c, "A", [0, 0, 0]);
        const other = createPoint(c, "B", [0, 0, 0]);
        createLine(c, "d", point, other);

        expect(c.svg.dom().innerHTML).not.toMatch(/NaN|Infinity/);
    });
});

describe("SVG scene", () => {
    it("owns the background and recenters itself after resizing", async () => {
        const c = createConstruction();
        const point = createPoint(c, "A", [0, 0, 0]);

        expect(document.querySelector("canvas")).toBeNull();
        expect(c.svg.getAtt("style")).toContain("background");

        c.svg.stl("width", "640px").stl("height", "480px");
        await vi.waitFor(() => expect(c.GRID.ORG).toEqual([320, 240]));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        expect(point.screen).toEqual([320, 240]);
    });

    it("disposes the complete construction", () => {
        const c = createConstruction();
        const point = createPoint(c, "A", [0, 0, 0]);
        const other = createPoint(c, "B", [1, 0, 0]);
        const line = createLine(c, "d", point, other);
        const svg = c.svg.dom();

        c.dispose();

        expect(construction.constructions).not.toContain(c);
        expect(document.body.contains(svg)).toBe(false);
        expect(c.OBJS.V).toHaveLength(0);
        expect(point.parents).toHaveLength(0);
        expect(point.children).toHaveLength(0);
        expect(line.parents).toHaveLength(0);
    });
});
