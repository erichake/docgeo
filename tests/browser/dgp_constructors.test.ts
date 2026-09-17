import { afterEach, describe, expect, it } from "vitest";
import { construction } from "../../src/construction";
import { createAngleBisector } from "../../src/objects/angle_bisector_object";
import { createAngle } from "../../src/objects/angle_object";
import { createCenter } from "../../src/objects/center_object";
import { createCircle1 } from "../../src/objects/circle1_object";
import { createCircle3 } from "../../src/objects/circle3_object";
import { createCircle3pts } from "../../src/objects/circle3pts_object";
import { createCircle } from "../../src/objects/circle_object";
import { createOrderedIntersection } from "../../src/objects/intersection_object";
import { createPerpendicularBisector } from "../../src/objects/perpendicular_bisector_object";
import {
    createPointOn,
    point_on_object,
} from "../../src/objects/point_on_object";
import { createPoint } from "../../src/objects/point_object";
import { createPolygon } from "../../src/objects/polygon_object";
import { createReflection } from "../../src/objects/reflection_object";
import { createSegment } from "../../src/objects/segment_object";
import { createSymmetry } from "../../src/objects/symmetry_object";
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

describe("DGPad geometric constructors", () => {
    it("constructs the four circle variants and their centers", () => {
        const c = createConstruction();
        const o = createPoint(c, "O", [1, 2, 0]);
        const a = createPoint(c, "A", [4, 2, 0]);
        const b = createPoint(c, "B", [1, 6, 0]);
        const circle = createCircle(c, "C", o, a);
        const circle1 = createCircle1(c, "C1", o, 5);
        const circle3 = createCircle3(c, "C3", a, b, o);
        const circle3pts = createCircle3pts(c, "C3P", o, a, b);
        const center = createCenter(c, "M", circle3pts);

        expect(circle.R).toBeCloseTo(3);
        expect(circle1.R).toBeCloseTo(5);
        expect(circle3.R).toBeCloseTo(5);
        expect(circle3.CENTER).toEqual(o.coords);
        expect(circle3pts.CENTER[0]).toBeCloseTo(2.5);
        expect(circle3pts.CENTER[1]).toBeCloseTo(4);
        expect(circle3pts.R).toBeCloseTo(2.5);
        expect(center.coords[0]).toBeCloseTo(2.5);
        expect(center.coords[1]).toBeCloseTo(4);
        const onCircle = createPointOn(c, "Q", circle, Math.PI / 2);
        expect(onCircle.x).toBeCloseTo(1);
        expect(onCircle.y).toBeCloseTo(5);
        expect(circle.dom.dom().innerHTML).not.toMatch(/NaN|Infinity/);
    });

    it("keeps PointOn constrained to lines, segments and circles", () => {
        const c = createConstruction();
        const o = createPoint(c, "O", [0, 0, 0]);
        const a = createPoint(c, "A", [4, 0, 0]);
        const line = createLine(c, "d", o, a);
        const segment = createSegment(c, "s", o, a);
        const circle = createCircle1(c, "C", o, 2);

        expect(createPointOn(c, "L", line, 1.5).coords).toEqual([6, 0, 0]);
        expect(createPointOn(c, "S", segment, 0.25).coords).toEqual([1, 0, 0]);
        const onCircle = createPointOn(c, "P", circle, Math.PI / 2);
        expect(onCircle.x).toBeCloseTo(0);
        expect(onCircle.y).toBeCloseTo(2);
    });

    it("keeps PointOn inside a polygon", () => {
        const c = createConstruction();
        const a = createPoint(c, "A", [0, 0, 0]);
        const b = createPoint(c, "B", [4, 0, 0]);
        const d = createPoint(c, "D", [4, 4, 0]);
        const e = createPoint(c, "E", [0, 4, 0]);
        const polygon = createPolygon(c, "poly", [a, b, d, e]);
        const inside = createPointOn(c, "P", polygon, [0.25, 0.25]);
        const outside = createPointOn(c, "Q", polygon, [1, 0.5]);

        expect(inside.coords).toEqual([2, 1, 0]);
        expect(outside.coords).toEqual([4, 2, 0]);
        expect(outside.alpha).toEqual([0.5, 0.5]);

        const target = c.pt3D([-3, 3, 0]);
        inside.mousedrag(
            new PointerEvent("pointermove", {
                clientX: target[0],
                clientY: target[1],
            }),
        );
        c.OBJS.update();

        expect(inside).toBeInstanceOf(point_on_object);
        expect(inside.coords[0]).toBeCloseTo(0);
        expect(inside.coords[1]).toBeCloseTo(3);
        expect(inside.coords[2]).toBeCloseTo(0);
    });

    it("constructs symmetry, reflection and perpendicular bisectors", () => {
        const c = createConstruction();
        const a = createPoint(c, "A", [-2, 0, 0]);
        const b = createPoint(c, "B", [2, 0, 0]);
        const p = createPoint(c, "P", [1, 3, 0]);
        const axis = createLine(c, "d", a, b);
        const symmetry = createSymmetry(c, "S", a, p);
        const reflection = createReflection(c, "R", axis, p);
        const bisector = createPerpendicularBisector(c, "m", a, b);

        expect(symmetry.coords).toEqual([-5, -3, 0]);
        expect(reflection.coords).toEqual([1, -3, 0]);
        expect(bisector.P1.coords).toEqual([0, 0, 0]);
        expect(vDot(bisector.VEC, axis.VEC)).toBeCloseTo(0);
    });

    it("constructs an angle bisector ray from a vertex and two arms", () => {
        const c = createConstruction();
        const vertex = createPoint(c, "P1", [0, 0, 0]);
        const arm1 = createPoint(c, "P2", [3, 0, 0]);
        const arm2 = createPoint(c, "P3", [0, 5, 0]);
        const bisector = createAngleBisector(c, "R3", vertex, arm1, arm2);

        expect(bisector.P1.coords).toEqual([0, 0, 0]);
        expect(bisector.VEC[0]).toBeCloseTo(Math.SQRT1_2);
        expect(bisector.VEC[1]).toBeCloseTo(Math.SQRT1_2);
        expect(bisector.insideBounds(0)).toBe(true);
        expect(bisector.insideBounds(-1)).toBe(false);

        arm2.coords = [-5, 0, 0];
        c.invalidateGeometry(arm2);
        c.OBJS.update();

        expect(bisector.defined).toBe(false);
    });

    it("measures an angle and hides its label when precision is negative", () => {
        const c = createConstruction();
        const vertex = createPoint(c, "O", [0, 0, 0]);
        const a = createPoint(c, "A", [1, 0, 0]);
        const b = createPoint(c, "B", [0, 1, 0]);
        const angle = createAngle(c, "Ang", a, vertex, b);
        c.OBJS.update();

        expect(angle.value).toBeCloseTo(Math.PI / 2);
        expect(angle.valueText).toBeUndefined();
        expect(angle.dom.dom().innerHTML).not.toMatch(/NaN|Infinity/);

        a.coords = [0, 0, 0];
        c.invalidateGeometry(a);
        c.OBJS.update();

        expect(angle.defined).toBe(false);
    });

    it("selects ordered line-circle and circle-circle intersections", () => {
        const c = createConstruction();
        const o = createPoint(c, "O", [0, 0, 0]);
        const x = createPoint(c, "X", [1, 0, 0]);
        const line = createLine(c, "d", o, x);
        const firstCircle = createCircle1(c, "C1", o, 2);
        const otherCenter = createPoint(c, "M", [2, 0, 0]);
        const secondCircle = createCircle1(c, "C2", otherCenter, 2);
        const lineFirst = createOrderedIntersection(
            c,
            "I0",
            line,
            firstCircle,
            0,
        );
        const lineSecond = createOrderedIntersection(
            c,
            "I1",
            line,
            firstCircle,
            1,
        );
        const circleFirst = createOrderedIntersection(
            c,
            "J0",
            firstCircle,
            secondCircle,
            0,
        );
        const circleSecond = createOrderedIntersection(
            c,
            "J1",
            firstCircle,
            secondCircle,
            1,
        );
        const away = createOrderedIntersection(
            c,
            "IA",
            line,
            firstCircle,
            0,
            lineFirst,
        );
        const left = createPoint(c, "L", [-3, 0, 0]);
        const bounded = createSegment(c, "T", left, o);
        const boundedIntersection = createOrderedIntersection(
            c,
            "IB",
            bounded,
            firstCircle,
            1,
        );

        expect(lineFirst.coords).toEqual([2, 0, 0]);
        expect(lineSecond.coords).toEqual([-2, 0, 0]);
        expect(circleFirst.x).toBeCloseTo(1);
        expect(circleFirst.y).toBeCloseTo(Math.sqrt(3));
        expect(circleSecond.x).toBeCloseTo(1);
        expect(circleSecond.y).toBeCloseTo(-Math.sqrt(3));
        expect(away.coords).toEqual([-2, 0, 0]);
        expect(boundedIntersection.coords).toEqual([-2, 0, 0]);
    });

    it("propagates degeneracy and recovers after parent movement", () => {
        const c = createConstruction();
        const a = createPoint(c, "A", [0, 0, 0]);
        const b = createPoint(c, "B", [1, 0, 0]);
        const d = createPoint(c, "D", [2, 0, 0]);
        const circle = createCircle3pts(c, "C", a, b, d);
        const center = createCenter(c, "M", circle);

        expect(circle.defined).toBe(false);
        expect(center.defined).toBe(false);

        d.coords = [0, 1, 0];
        c.invalidateGeometry(d);
        c.OBJS.update();

        expect(circle.defined).toBe(true);
        expect(center.defined).toBe(true);
        expect(center.coords[0]).toBeCloseTo(0.5);
        expect(center.coords[1]).toBeCloseTo(0.5);
    });
});
