import { afterEach, describe, expect, it, vi } from "vitest";
import { construction } from "../../src/construction";
import { createIntersection } from "../../src/objects/intersection_object";
import { createMidpoint } from "../../src/objects/midpoint_object";
import { createPlumb } from "../../src/objects/plumb_line_object";
import { createPoint } from "../../src/objects/point_object";
import { createRay } from "../../src/objects/ray_line_object";
import { createSegment } from "../../src/objects/segment_object";
import { createSphere } from "../../src/objects/sphere_object";
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
    it.each([false, true])(
        "updates the floor when a sphere is added or removed (perspective=%s)",
        (perspective) => {
            const c = createConstruction();
            c.GRID.THETA = 0.3;
            c.GRID.PERSPECTIVE = perspective;
            c.invalidateProjection();
            c.flush();
            const floor = c.GRID.floorClipShape.getAtt("d");
            const o = createPoint(c, "O", [0, 0, 4]);
            const s = createPoint(c, "S", [0, 0, 0]);
            const sphere = createSphere(c, "a", o, s);
            c.flush();
            const clipped = c.GRID.floorClipShape.getAtt("d");
            expect(clipped).not.toBe(floor);
            c.invalidateProjection();
            c.flush();
            expect(c.GRID.floorClipShape.getAtt("d")).toBe(clipped);

            c.removeObject(sphere);
            c.flush();
            expect(c.GRID.floorClipShape.getAtt("d")).toBe(floor);
        },
    );

    it.each([
        [-0.3, false],
        [0.3, false],
        [-0.3, true],
        [0.3, true],
    ])(
        "keeps the floor visible with a sphere behind it (theta=%s, perspective=%s)",
        (theta, perspective) => {
            const c = createConstruction();
            c.GRID.THETA = theta;
            c.GRID.PERSPECTIVE = perspective;
            c.invalidateProjection();
            c.OBJS.update();
            const clip = c.GRID.floorClipShape.getAtt("d");
            const height = theta < 0 ? 1 : -1;
            const o = createPoint(c, "O", [0, 0, height]);
            const s = createPoint(c, "S", [0, 0, 0]);
            const sphere = createSphere(c, "a", o, s);
            c.invalidateProjection();
            c.OBJS.update();

            expect(sphere.nearPart).toEqual([]);
            expect(sphere.farPath).toMatch(/^M/);
            expect(c.GRID.floorClipShape.getAtt("d")).toBe(clip);

            o.coords = [0, 0, height * 2];
            c.invalidateGeometry(o);
            s.coords = [0, 0, height];
            c.invalidateGeometry(s);
            c.OBJS.update();
            expect(sphere.nearPart).toEqual([]);
            expect(c.GRID.floorClipShape.getAtt("d")).toBe(clip);

            o.coords = [0, 0, 0];
            c.invalidateGeometry(o);
            c.OBJS.update();
            expect(sphere.nearPart.length).toBeGreaterThan(3);
            const path = new Path2D(c.GRID.floorClipShape.getAtt("d")!);
            const context = new OffscreenCanvas(1, 1).getContext("2d")!;
            expect(context.isPointInPath(path, ...c.pt3D([0, 0, 0]))).toBe(
                false,
            );
            expect(context.isPointInPath(path, ...c.pt3D([4, 4, 0]))).toBe(
                true,
            );
        },
    );

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

        // As in DGPad, the line's direction turned counterclockwise.
        expect(planePlumb.VEC).toEqual([0, 1, 0]);
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

    it("only recomputes the dragged point's descendants, not unrelated objects", () => {
        const c = createConstruction();
        const a = createPoint(c, "A", [0, 0, 0]);
        const b = createPoint(c, "B", [2, 0, 0]);
        const midpoint = createMidpoint(c, "M", a, b);

        const other = createPoint(c, "O", [5, 5, 0]);
        const spy = vi.spyOn(other, "computeGeometry");

        const target = c.pt3D([2, 2, 0]);
        a.mousedrag(
            new PointerEvent("pointermove", {
                clientX: target[0],
                clientY: target[1],
            }),
        );
        c.OBJS.update();

        expect(midpoint.x).toBeCloseTo(2);
        expect(spy).not.toHaveBeenCalled();
    });

    it("recomputes a chain of dependents in construction order after a drag", () => {
        const c = createConstruction();
        const a = createPoint(c, "A", [0, 0, 0]);
        const fixed1 = createPoint(c, "F1", [4, 0, 0]);
        const m1 = createMidpoint(c, "M1", a, fixed1);
        const fixed2 = createPoint(c, "F2", [0, 4, 0]);
        const m2 = createMidpoint(c, "M2", m1, fixed2);

        const target = c.pt3D([4, 0, 0]);
        a.mousedrag(
            new PointerEvent("pointermove", {
                clientX: target[0],
                clientY: target[1],
            }),
        );
        c.OBJS.update();

        // m1 must be recomputed before m2 reads it, or m2 would use m1's
        // stale coordinates from before the drag.
        expect(m1.x).toBeCloseTo(4);
        expect(m1.y).toBeCloseTo(0);
        expect(m2.x).toBeCloseTo(2);
        expect(m2.y).toBeCloseTo(2);
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

    it("skips the SVG view for a hidden object but still computes its geometry", () => {
        const c = createConstruction();
        const a = createPoint(c, "A", [0, 0, 0]);
        const b = createPoint(c, "B", [2, 0, 0]);
        b.hidden = 1;
        b.updateView();
        expect(b.hasView).toBe(false);

        const midpoint = createMidpoint(c, "M", a, b);
        expect(midpoint.coords).toEqual([1, 0, 0]);

        b.hidden = 0;
        b.updateView();
        expect(b.hasView).toBe(true);
        expect(c.svg.dom().contains(b.dom.dom())).toBe(true);
    });

    // As DGPad paints them, whatever the figure went through.
    it("draws the objects of a layer in construction order", () => {
        const c = createConstruction();
        const points = ["A", "B", "C"].map((name, index) =>
            createPoint(c, name, [index, 0, 0]),
        );
        const order = () =>
            [...points[0].dom.dom().parentElement!.children].map((view) =>
                points.find((point) => point.dom.dom() === view)!,
            );
        points[1].hidden = 1;
        points[1].updateView();
        points[0].hidden = 1;
        points[0].updateView();
        points[1].hidden = 0;
        points[1].updateView();
        points[0].hidden = 0;
        points[0].updateView();
        expect(order()).toEqual(points);
        points[1].createSVG();
        expect(order()).toEqual(points);
    });

    it("remounts a view under a mark of the editor's in its layer", () => {
        const c = createConstruction();
        const [first, second] = ["A", "B"].map((name) =>
            createPoint(c, name, [0, 0, 0]),
        );
        const mark = second.dom.dom().cloneNode(true) as Element;
        second.dom.dom().before(mark);
        const old = first.dom.dom();

        first.createSVG();

        expect(old.isConnected).toBe(false);
        expect(first.dom.dom().nextElementSibling).toBe(mark);
        expect(mark.nextElementSibling).toBe(second.dom.dom());
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
    it("pans the coordinate system with a left drag on the background", () => {
        const c = createConstruction();
        const point = createPoint(c, "A", [1, 2, 0]);
        const svg = c.svg.dom();
        const origin = [...c.GRID.ORG];
        const screen = [...point.screen];
        const pointer = (
            type: "pointerdown" | "pointermove" | "pointerup",
            x: number,
            y: number,
        ) =>
            new PointerEvent(type, {
                bubbles: true,
                button: 0,
                clientX: x,
                clientY: y,
                isPrimary: true,
                pointerId: 1,
                pointerType: "mouse",
            });

        svg.dispatchEvent(pointer("pointerdown", 100, 100));
        svg.dispatchEvent(pointer("pointermove", 135, 80));
        svg.dispatchEvent(pointer("pointerup", 135, 80));
        c.OBJS.update();

        expect(c.GRID.ORG).toEqual([origin[0] + 35, origin[1] - 20]);
        expect(point.screen).toEqual([screen[0] + 35, screen[1] - 20]);
    });

    it("does not pan when a left drag starts on an object", () => {
        const c = createConstruction();
        const point = createPoint(c, "A", [1, 2, 0]);
        const other = createPoint(c, "B", [3, 2, 0]);
        const line = createLine(c, "d", point, other);
        const origin = [...c.GRID.ORG];
        const [x, y] = point.screen;
        const pointer = (
            type: "pointerdown" | "pointermove" | "pointerup",
            clientX: number,
            clientY: number,
        ) =>
            new PointerEvent(type, {
                bubbles: true,
                button: 0,
                clientX,
                clientY,
                isPrimary: true,
                pointerId: 1,
                pointerType: "mouse",
            });

        const pointElement = point.dom.dom();
        pointElement.dispatchEvent(pointer("pointerdown", x, y));
        pointElement.dispatchEvent(pointer("pointermove", x + 35, y - 20));
        pointElement.dispatchEvent(pointer("pointerup", x + 35, y - 20));
        expect(c.GRID.ORG).toEqual(origin);

        const lineElement = line.dom.dom().firstElementChild!;
        lineElement.dispatchEvent(pointer("pointerdown", x, y));
        lineElement.dispatchEvent(pointer("pointermove", x + 35, y - 20));
        lineElement.dispatchEvent(pointer("pointerup", x + 35, y - 20));
        expect(c.GRID.ORG).toEqual(origin);
    });

    it("drags an object built from free points alone by translating them", () => {
        const c = createConstruction();
        const a = createPoint(c, "A", [0, 0, 0]);
        const b = createPoint(c, "B", [2, 0, 0]);
        const p = createPoint(c, "P", [1, 1, 0]);
        const segment = createSegment(c, "s", a, b);
        const plumb = createPlumb(c, "d", p, segment);
        const m = createMidpoint(c, "M", a, b);
        const line = createLine(c, "e", m, p);
        c.OBJS.update();
        const [dx, dy] = [c.GRID.UNIT[0], -c.GRID.UNIT[1]];
        const pointer = (
            type: "pointerdown" | "pointermove" | "pointerup",
            clientX: number,
            clientY: number,
        ) =>
            new PointerEvent(type, {
                bubbles: true,
                button: 0,
                clientX,
                clientY,
                isPrimary: true,
                pointerId: 1,
                pointerType: "mouse",
            });
        const drag = (element: Element, [x, y]: readonly number[]) => {
            element.dispatchEvent(pointer("pointerdown", x, y));
            element.dispatchEvent(pointer("pointermove", x + dx, y + dy));
            element.dispatchEvent(pointer("pointerup", x + dx, y + dy));
            c.OBJS.update();
        };
        const at = (...points: [number, number][]) =>
            [a, b, p].forEach(({ coords: [x, y] }, i) => {
                expect(x).toBeCloseTo(points[i][0], 9);
                expect(y).toBeCloseTo(points[i][1], 9);
            });

        drag(segment.dom.dom().firstElementChild!, c.pt3D([1, 0, 0]));
        at([1, 1], [3, 1], [1, 1]);

        drag(plumb.dom.dom().firstElementChild!, c.pt3D([1, 1, 0]));
        at([2, 2], [4, 2], [2, 2]);

        const origin = [...c.GRID.ORG];
        drag(line.dom.dom().firstElementChild!, c.pt3D(p.coords));
        at([2, 2], [4, 2], [2, 2]);
        expect(c.GRID.ORG).toEqual(origin);
    });

    it("zooms around the mouse wheel position", () => {
        const c = createConstruction();
        const point = createPoint(c, "A", [1, 0, 0]);
        const svg = c.svg.dom();
        const anchor = [...point.screen];
        const unit = [...c.GRID.UNIT];
        const event = new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            clientX: anchor[0],
            clientY: anchor[1],
            deltaY: -120,
        });

        svg.dispatchEvent(event);
        c.OBJS.update();

        expect(event.defaultPrevented).toBe(true);
        expect(c.GRID.UNIT[0]).toBeGreaterThan(unit[0]);
        expect(c.GRID.UNIT[0] / unit[0]).toBeCloseTo(Math.exp(120 / 2000));
        expect(point.screen[0]).toBeCloseTo(anchor[0]);
        expect(point.screen[1]).toBeCloseTo(anchor[1]);

        svg.dispatchEvent(
            new WheelEvent("wheel", {
                clientX: anchor[0],
                clientY: anchor[1],
                deltaY: 120,
            }),
        );
        c.OBJS.update();

        c.GRID.UNIT.forEach((value, index) =>
            expect(value).toBeCloseTo(unit[index]),
        );
        expect(point.screen[0]).toBeCloseTo(anchor[0]);
        expect(point.screen[1]).toBeCloseTo(anchor[1]);
    });

    it("gives a trackpad pinch its own sensitivity and keeps its anchor", () => {
        const c = createConstruction();
        const point = createPoint(c, "A", [1, 0, 0]);
        const anchor = [...point.screen];
        const unit = c.GRID.UNIT[0];
        c.svg.dom().dispatchEvent(
            new WheelEvent("wheel", {
                ctrlKey: true,
                deltaY: -100 * Math.log(2),
                clientX: anchor[0],
                clientY: anchor[1],
            }),
        );
        c.flush();
        expect(c.GRID.UNIT[0]).toBeCloseTo(2 * unit);
        expect(point.screen[0]).toBeCloseTo(anchor[0]);
        expect(point.screen[1]).toBeCloseTo(anchor[1]);
    });

    it.each([false, true])(
        "pinches about the two fingers in SVG coordinates (panLocked=%s)",
        (locked) => {
            const c = createConstruction();
            c.panLocked = locked;
            c.svg.stl("touch-action", "none");
            const svg = c.svg.dom();
            vi.spyOn(svg, "setPointerCapture").mockImplementation(() => {});
            const point = createPoint(c, "A", [1, 0, 0]);
            const coords = [...point.coords];
            const unit = c.GRID.UNIT[0];
            const [x, y] = point.screen;
            const matrix = (svg as SVGSVGElement).getScreenCTM()!;
            const send = (type: string, id: number, sx: number, target = svg) =>
                target.dispatchEvent(
                    new PointerEvent(type, {
                        bubbles: true,
                        cancelable: true,
                        pointerType: "touch",
                        pointerId: id,
                        isPrimary: id === 1,
                        clientX: matrix.a * sx + matrix.e,
                        clientY: matrix.d * y + matrix.f,
                    }),
                );
            send("pointerdown", 1, x, point.dom.dom());
            send("pointerdown", 2, x + 100);
            send("pointermove", 2, x + 200);
            c.flush();
            expect(c.GRID.UNIT[0]).toBeCloseTo(2 * unit);
            expect(point.coords).toEqual(coords);
            expect(point.screen[0]).toBeCloseTo(locked ? x - 50 : x);
            send("pointerup", 2, x + 200);
            const origin = [...c.GRID.ORG];
            send("pointermove", 1, x - 20);
            send("pointerup", 1, x - 20);
            expect(c.GRID.ORG).toEqual(origin);
            expect(point.coords).toEqual(coords);
            expect(c.svg.pinching).toBe(false);
        },
    );

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
