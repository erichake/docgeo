import { afterEach, describe, expect, it } from "vitest";
import { construction } from "../../src/construction";
import { createAngleBisector } from "../../src/objects/angle_bisector_object";
import { createAngle } from "../../src/objects/angle_object";
import { createArc3pts } from "../../src/objects/arc3pts_object";
import { createCenter } from "../../src/objects/center_object";
import {
    circle1_object,
    createCircle1,
} from "../../src/objects/circle1_object";
import { createCircle3 } from "../../src/objects/circle3_object";
import { createCircle3pts } from "../../src/objects/circle3pts_object";
import { createCircle } from "../../src/objects/circle_object";
import { parseFormula } from "../../src/import/dgp_formula";
import { createFixedAngle } from "../../src/objects/fixed_angle_object";
import { createExpression } from "../../src/objects/expression_object";
import { createFormulaPoint } from "../../src/objects/formula_point_object";
import { createOrderedIntersection } from "../../src/objects/intersection_object";
import { createList } from "../../src/objects/list_object";
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

    it("only resizes a Circle1 whose radius is numeric", () => {
        const c = createConstruction();
        const fixedCenter = createPoint(c, "P1", [-4.35, 2.7625, 0]);
        const movableCenter = createPoint(c, "P2", [1.725, 0.0375, 0]);
        const fixed = createCircle1(c, "C1", fixedCenter, {
            formula: parseFormula("2"),
            refs: new Map(),
        });
        const movable = createCircle1(
            c,
            "C2",
            movableCenter,
            3.870158265497678,
        );
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
        const dragRadius = (circle: circle1_object, radius: number): void => {
            const start = c.pt3D([
                circle.P1.x + circle.R,
                circle.P1.y,
                circle.P1.z,
            ]);
            const end = c.pt3D([
                circle.P1.x + radius,
                circle.P1.y,
                circle.P1.z,
            ]);
            const hitArea = circle.hitArea.dom();
            hitArea.dispatchEvent(pointer("pointerdown", start[0], start[1]));
            hitArea.dispatchEvent(pointer("pointermove", end[0], end[1]));
            hitArea.dispatchEvent(pointer("pointerup", end[0], end[1]));
            c.OBJS.update();
        };

        dragRadius(fixed, 5);
        dragRadius(movable, 5);

        expect(fixed.R).toBeCloseTo(2);
        expect(movable.R).toBeCloseTo(5);
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

    it("rotates a fixed-angle ray away from its reference point", () => {
        const c = createConstruction();
        const vertex = createPoint(c, "O", [0, 0, 0]);
        const a = createPoint(c, "A", [1, 0, 0]);
        const trigo = createFixedAngle(c, "Trigo", a, vertex, 90, true);
        const clockwise = createFixedAngle(
            c,
            "Clockwise",
            a,
            vertex,
            90,
            false,
        );

        expect(trigo.VEC[0]).toBeCloseTo(0);
        expect(trigo.VEC[1]).toBeCloseTo(1);
        expect(clockwise.VEC[0]).toBeCloseTo(0);
        expect(clockwise.VEC[1]).toBeCloseTo(-1);
        expect(trigo.insideBounds(0)).toBe(true);
        expect(trigo.insideBounds(-1)).toBe(false);

        a.coords = [0, 0, 0];
        c.invalidateGeometry(a);
        c.OBJS.update();

        expect(trigo.defined).toBe(false);
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

    it("constructs an arc through three points, picking the arc that passes through the middle one", () => {
        const c = createConstruction();
        const a = createPoint(c, "A", [5, 0, 0]);
        const bShort = createPoint(c, "Bs", [2.5, 5 * Math.sin(Math.PI / 3), 0]);
        const cPt = createPoint(
            c,
            "C",
            [5 * Math.cos((5 * Math.PI) / 6), 2.5, 0],
        );
        const shortArc = createArc3pts(c, "ShortArc", a, bShort, cPt);
        const center = createCenter(c, "Center", shortArc);

        expect(shortArc.CENTER[0]).toBeCloseTo(0);
        expect(shortArc.CENTER[1]).toBeCloseTo(0);
        expect(shortArc.R).toBeCloseTo(5);
        expect(center.coords[0]).toBeCloseTo(0);
        expect(center.coords[1]).toBeCloseTo(0);
        expect(shortArc.sweepFlag).toBe(1);
        expect(shortArc.largeArcFlag).toBe(0);
        expect(shortArc.dom.dom().innerHTML).not.toMatch(/NaN|Infinity/);

        const bLong = createPoint(
            c,
            "Bl",
            [5 * Math.cos(-Math.PI / 3), 5 * Math.sin(-Math.PI / 3), 0],
        );
        const longArc = createArc3pts(c, "LongArc", a, bLong, cPt);

        expect(longArc.sweepFlag).toBe(0);
        expect(longArc.largeArcFlag).toBe(1);
    });

    it("propagates arc degeneracy and recovers after parent movement", () => {
        const c = createConstruction();
        const a = createPoint(c, "Aa", [0, 0, 0]);
        const b = createPoint(c, "Bb", [1, 0, 0]);
        const d = createPoint(c, "Dd", [2, 0, 0]);
        const arc = createArc3pts(c, "Arc", a, b, d);

        expect(arc.defined).toBe(false);

        d.coords = [0, 1, 0];
        c.invalidateGeometry(d);
        c.OBJS.update();

        expect(arc.defined).toBe(true);
        expect(arc.CENTER[0]).toBeCloseTo(0.5);
        expect(arc.CENTER[1]).toBeCloseTo(0.5);
    });

    it("recomputes a formula point and a formula-radius circle when their references move", () => {
        const c = createConstruction();
        const a = createPoint(c, "A", [0, 0, 0]);
        const b = createPoint(c, "B", [3, 4, 0]);

        const formulaPoint = createFormulaPoint(
            c,
            "P",
            parseFormula("A+5-i"),
            new Map([["A", a]]),
        );
        const circle = createCircle1(c, "C", a, {
            formula: parseFormula("d(A,B)"),
            refs: new Map([
                ["A", a],
                ["B", b],
            ]),
        });

        expect(formulaPoint.coords).toEqual([5, -1, 0]);
        expect(circle.R).toBeCloseTo(5);

        a.coords = [1, 1, 0];
        c.invalidateGeometry(a);
        c.OBJS.update();

        expect(formulaPoint.coords).toEqual([6, 0, 0]);
        expect(circle.R).toBeCloseTo(Math.hypot(2, 3));
    });

    it("evaluates a List's per-index formula and recomputes when its cursor moves", () => {
        const c = createConstruction();
        const a = createPoint(c, "A", [0, 0, 0]);
        const b = createPoint(c, "B", [6, 0, 0]);
        const n = createExpression(c, "n", "", 2, 0, 10, [0, 0]);

        const list = createList(
            c,
            "L",
            "point",
            parseFormula("n"),
            [parseFormula("A+(B-A)*k/count")],
            new Map<string, typeof a | typeof n>([
                ["A", a],
                ["B", b],
                ["n", n],
            ]),
        );

        expect(list.count).toBe(2);
        expect(list.items[0][0]).toEqual([0, 0]);
        expect(list.items[1][0]).toEqual([3, 0]);

        n.value = 4;
        c.invalidateGeometry(n);
        c.OBJS.update();

        expect(list.count).toBe(4);
        expect(list.items[3][0]).toEqual([4.5, 0]);
    });

    it("evaluates a List label's bare-identifier value as a plain number", () => {
        const c = createConstruction();
        const a = createPoint(c, "A", [0, 0, 0]);

        c.beginBatch();
        const list = createList(
            c,
            "L",
            "label",
            parseFormula("3"),
            [parseFormula("A"), parseFormula("k")],
            new Map<string, typeof a>([["A", a]]),
        );
        list.precision = 0;
        c.endBatch();

        expect(list.texts.slice(0, 3).map((text) => text.text())).toEqual([
            "0",
            "1",
            "2",
        ]);
    });

    it("constructs a PointOn a point-nature List, snapping to the nearest item", () => {
        const c = createConstruction();
        const a = createPoint(c, "A", [0, 0, 0]);
        const b = createPoint(c, "B", [6, 0, 0]);
        const n = createExpression(c, "n", "", 2, 0, 10, [0, 0]);

        const list = createList(
            c,
            "L",
            "point",
            parseFormula("n"),
            [parseFormula("A+(B-A)*k/count")],
            new Map<string, typeof a | typeof n>([
                ["A", a],
                ["B", b],
                ["n", n],
            ]),
        );
        // n=2 -> items at x=0 (k=0) and x=3 (k=1); a non-integer alpha
        // snaps to the nearest item instead of landing in between.
        const m = createPointOn(c, "M", list, 0.5);
        expect(m.coords).toEqual([3, 0, 0]);

        n.value = 6;
        c.invalidateGeometry(n);
        c.OBJS.update();
        // n=6 -> items at x=0,1,2,3,4,5; the same alpha=0.5 now snaps to a
        // different item since the items themselves changed.
        expect(m.coords).toEqual([1, 0, 0]);
    });
});
