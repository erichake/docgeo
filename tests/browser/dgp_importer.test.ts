import { afterEach, describe, expect, it } from "vitest";
import { construction } from "../../src/construction";
import { importDgp, importDgpFromUrl } from "../../src/dgp_importer";
import { angle_bisector_object } from "../../src/objects/angle_bisector_object";
import { angle_object } from "../../src/objects/angle_object";
import { arc3pts_object } from "../../src/objects/arc3pts_object";
import { circle1_object } from "../../src/objects/circle1_object";
import { curve_object } from "../../src/objects/curve_object";
import { realPart } from "../../src/import/dgp_formula";
import {
    evaluateAtX,
    expression_object,
} from "../../src/objects/expression_object";
import { fixed_angle_object } from "../../src/objects/fixed_angle_object";
import { fixed_point_object } from "../../src/objects/fixed_point_object";
import { formula_point_object } from "../../src/objects/formula_point_object";
import { locus_object } from "../../src/objects/locus_object";
import { point_on_object } from "../../src/objects/point_on_object";
import { point_object } from "../../src/objects/point_object";
import { polygon_object } from "../../src/objects/polygon_object";
import { symmetry_object } from "../../src/objects/symmetry_object";
import { two_points_line_object } from "../../src/objects/two_points_line_object";
import { intervalsToPath } from "../../src/objects/hidden_line";
import type { segment_object } from "../../src/objects/segment_object";
import { preferences } from "../../src/preferences";

// A segment's current hidden sub-ranges (see hidden_line.ts).
function hiddenOf(segment: segment_object): [number, number][] {
    return (segment as unknown as { hiddenIntervals: [number, number][] })
        .hiddenIntervals;
}
import { vDot, vNormalize, vSub, type Vec3 } from "../../src/vec";

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

describe("DGP importer", () => {
    it("positions a point name from its saved DGPad angle", () => {
        const c = createConstruction();
        const angle = 3.4708243651736628;
        importDgp(
            c,
            `A=Point("A",-5,5);
B=Point("B",3.15,5);
STL(A,"c:#0000b2;s:6;sn:true;f:30;np:${angle}");
STL(B,"c:#0000b2;s:6;sn:true;f:30");`,
        );
        const a = c.getObj("A") as point_object;
        const b = c.getObj("B") as point_object;
        const aName = a.nameText!;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        expect(a.namePosition).toBe(angle);
        expect(Number(aName.getAtt("x"))).toBeCloseTo(
            2 * a.size * cos + (aName.width() * (cos - 1)) / 2,
        );
        expect(Number(aName.getAtt("y"))).toBeCloseTo(
            -2 * a.size * sin - (a.fontSize * (sin - 1)) / 2,
        );
        expect(Number(aName.getAtt("x"))).toBeLessThan(0);
        expect(Number(aName.getAtt("y"))).toBeGreaterThan(0);
        expect(b.nameText!.getAtt("x")).toBe("12");
        expect(b.nameText!.getAtt("y")).toBe("15");
    });

    it("imports two points and their line from the public DGP file", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/_Droite.dgp");

        const p1 = c.getObj("P1");
        const p2 = c.getObj("P2");
        const line = c.getObj("L1");
        expect(p1).toBeInstanceOf(point_object);
        expect(p2).toBeInstanceOf(point_object);
        expect(line).toBeInstanceOf(two_points_line_object);
        expect((p1 as point_object).coords).toEqual([-2.775, 2.7625, 0]);
        expect((line as two_points_line_object).parents).toEqual([p1, p2]);
        expect(c.GRID.ORG).toEqual([400, 285.5]);
        expect(c.GRID.UNIT).toEqual([40, 40, 40]);
        expect(line?.stroke_color).toBe("#780013");
        expect(line?.size).toBe(1);
        expect(c.GRID.hidden).toBe(0);
        expect((c.svg.dom() as SVGSVGElement).style.backgroundColor).toBe(
            "rgb(248, 248, 248)",
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(c.GRID.ORG).toEqual([400, 285.5]);
    });

    it("rejects instructions outside the supported subset", () => {
        const c = createConstruction();
        expect(() =>
            importDgp(
                c,
                `P=Point("P",0,0);
fetch("https://example.com");`,
            ),
        ).toThrow("Unsupported DGP command fetch at line 2");
        expect(c.OBJS.V).toEqual([c.GRID]);
    });

    it("rejects unsafe styles before creating objects", () => {
        const c = createConstruction();
        expect(() =>
            importDgp(
                c,
                `P=Point("P",0,0);
STL(P,"c:url(https://example.com/image)");`,
            ),
        ).toThrow("Invalid DGP color at line 2");
        expect(c.OBJS.V).toEqual([c.GRID]);
    });

    it("rejects a non-boolean trace style", () => {
        const c = createConstruction();
        expect(() =>
            importDgp(
                c,
                `P=Point("P",0,0);
STL(P,"tk:1");`,
            ),
        ).toThrow("Invalid DGP style boolean at line 2");
        expect(c.OBJS.V).toEqual([c.GRID]);
    });

    it("imports the perpendicular-bisector reference figure", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/_Mediatrice.dgp");

        expect(c.OBJS.V).toHaveLength(8);
        expect(c.getObj("P1")).toBeInstanceOf(point_object);
        expect(c.getObj("L1")).toBeInstanceOf(two_points_line_object);
    });

    it("imports the angle-bisector reference figure", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/_Bissectrice.dgp");

        const vertex = c.getObj("P1") as point_object;
        const arm1 = c.getObj("P2") as point_object;
        const arm2 = c.getObj("P3") as point_object;
        const bisector = c.getObj("R3") as angle_bisector_object;
        const angle = c.getObj("A1") as angle_object;

        expect(bisector).toBeInstanceOf(angle_bisector_object);
        const u1 = vNormalize(vSub(arm1.coords, vertex.coords))!;
        const u2 = vNormalize(vSub(arm2.coords, vertex.coords))!;
        expect(vDot(bisector.VEC, u1)).toBeCloseTo(vDot(bisector.VEC, u2));

        expect(angle).toBeInstanceOf(angle_object);
        expect((angle.value * 180) / Math.PI).toBeCloseTo(51.601258193352805);
        expect(angle.arcRadius).toBeCloseTo(71.61005515987263);
        expect(angle.dom.dom().innerHTML).not.toMatch(/NaN|Infinity/);
    });

    it("imports the fixed-angle reference figure", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/_FixedAngle.dgp");

        const vertex = c.getObj("P2") as point_object;
        const a = c.getObj("P1") as point_object;
        const fixedAngle = c.getObj("A1") as fixed_angle_object;

        expect(fixedAngle).toBeInstanceOf(fixed_angle_object);
        expect(fixedAngle.valueDegrees).toBeCloseTo(51);
        expect(fixedAngle.trigo).toBe(true);
        expect(fixedAngle.arcRadius).toBeCloseTo(48.83646178829912);

        const dirA = vNormalize(vSub(a.coords, vertex.coords))!;
        const cosAngle = Math.min(1, Math.max(-1, vDot(fixedAngle.VEC, dirA)));
        expect((Math.acos(cosAngle) * 180) / Math.PI).toBeCloseTo(51);
        expect(fixedAngle.dom.dom().innerHTML).not.toMatch(/NaN|Infinity/);
    });

    it("imports and updates a point locus without moving its driver", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/_Locus.dgp");

        const focus = c.getObj("P3") as point_object;
        const driver = c.getObj("P4") as point_on_object;
        const target = c.getObj("P5") as point_object;
        const locus = c.getObj("Locus1") as locus_object;
        const alpha = driver.alpha;
        const targetCoords = target.coords;
        const middle = locus.points[Math.floor(locus.points.length / 2)];

        expect(locus).toBeInstanceOf(locus_object);
        expect(locus.points).toHaveLength(1000);
        expect(locus.points.every((point) => point !== null)).toBe(true);
        expect(driver.alpha).toBe(alpha);
        expect(target.coords).toEqual(targetCoords);
        expect(locus.stroke_color).toBe("#0b5b94");
        expect(locus.size).toBe(2.5);
        expect(locus.path.getAtt("d")).not.toMatch(/NaN|Infinity/);

        focus.coords = [focus.x, focus.y + 1, focus.z];
        c.invalidateGeometry(focus);
        c.OBJS.update();

        expect(locus.points[Math.floor(locus.points.length / 2)]).not.toEqual(
            middle,
        );
        expect(driver.alpha).toBe(alpha);
    });

    it("uses polygon vertices as the exact locus samples", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/_Locus2.dgp");

        const center = c.getObj("O") as point_object;
        const polygon = c.getObj("Poly1") as polygon_object;
        const locus = c.getObj("Locus1") as locus_object;
        const expected = [...polygon.points, polygon.points[0]].map((point) => [
            2 * center.x - point.x,
            2 * center.y - point.y,
            2 * center.z - point.z,
        ]);

        expect(locus.points).toEqual(expected);
    });

    it("imports and continuously drags a point on a locus", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/_PtOn5.dgp");

        const locus = c.getObj("Locus1") as locus_object;
        const point = c.getObj("M") as point_on_object;
        expect(point).toBeInstanceOf(point_on_object);
        expect(point.support).toBe(locus);
        expect(point.alpha).toBe(643);
        expect(point.coords).toEqual(locus.points[643]);
        expect(point.x).toBeCloseTo(-2.598331299744846);
        expect(point.y).toBeCloseTo(4.720536925631855);
        expect(
            locus.alphaAtScreen(
                locus.screenPoints[locus.screenPoints.length - 1]!,
            ),
        ).toBeCloseTo(locus.points.length - 1);

        const start = locus.screenPoints[643]!;
        const end = locus.screenPoints[644]!;
        point.mousedrag(
            new PointerEvent("pointermove", {
                clientX: start[0] + 0.35 * (end[0] - start[0]),
                clientY: start[1] + 0.35 * (end[1] - start[1]),
            }),
        );
        c.OBJS.update();

        expect(point.alpha as number).toBeCloseTo(643.35);
        expect(point.coords).toEqual(locus.pointAt(point.alpha as number));

        const focus = c.getObj("P3") as point_object;
        const alpha = point.alpha as number;
        focus.coords = [focus.x, focus.y + 1, focus.z];
        c.invalidateGeometry(focus);
        c.OBJS.update();

        expect(point.alpha).toBe(alpha);
        expect(point.coords).toEqual(locus.pointAt(alpha));
    });

    it("imports a point inside a polygon", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/_PtOn2.dgp");

        const point = c.getObj("A") as point_on_object;
        expect(point).toBeInstanceOf(point_on_object);
        expect(point.coords[0]).toBeCloseTo(-1.325);
        expect(point.coords[1]).toBeCloseTo(2.1125);
        expect(point.coords[2]).toBe(0);
    });

    it("keeps an sb point on the polygon boundary", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/_PtOn3.dgp");

        const a = c.getObj("A") as point_on_object;
        const b = c.getObj("B") as point_on_object;
        expect(a.onBoundary).toBe(false);
        expect(b.onBoundary).toBe(true);

        const target = c.pt3D([-1.325, 2.1125, 0]);
        b.mousedrag(
            new PointerEvent("pointermove", {
                clientX: target[0],
                clientY: target[1],
            }),
        );
        c.OBJS.update();

        expect(b.coords[0]).toBeCloseTo(-1.0969847224);
        expect(b.coords[1]).toBeCloseTo(3.258137736);
        expect(a.coords[0]).toBeCloseTo(-1.325);
        expect(a.coords[1]).toBeCloseTo(2.1125);
    });

    it("rejects an invalid scalar parameter for a polygon PointOn", () => {
        const c = createConstruction();
        expect(() =>
            importDgp(
                c,
                `A=Point("A",0,0);
B=Point("B",1,0);
C=Point("C",0,1);
poly=Polygon("poly","_A,_B,_C");
P=PointOn("P",poly,0.5);`,
            ),
        ).toThrow("Invalid PointOn parameter at line 5");
        expect(c.OBJS.V).toEqual([c.GRID]);
    });

    it("imports the complete Apollonius construction", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/_Apollonius.dgp");

        expect(c.OBJS.V).toHaveLength(2570);
        expect(c.getObj("P1")).toBeInstanceOf(point_object);
        expect(c.getObj("P14")).toBeInstanceOf(point_object);
        expect(c.getObj("Center32")).toBeInstanceOf(point_object);
    });

    it("imports the legacy fake-3D cube, pinning its origin and axes", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/_Cube.dgp");

        const o = c.getObj("O") as fixed_point_object;
        const x = c.getObj("X") as fixed_point_object;
        const y = c.getObj("Y") as fixed_point_object;
        const z = c.getObj("Z") as fixed_point_object;
        const a = c.getObj("A") as fixed_point_object;
        const h = c.getObj("H") as symmetry_object;

        expect(o).toBeInstanceOf(fixed_point_object);
        expect(o.coords).toEqual([0, 0, 0]);
        expect(x.coords).toEqual([1, 0, 0]);
        expect(y.coords).toEqual([0, 1, 0]);
        expect(z.coords).toEqual([0, 0, 1]);
        expect(a.coords).toEqual([1, -1, -1]);
        expect(h).toBeInstanceOf(symmetry_object);
        expect(h.coords).toEqual([-1, -1, 1]);

        expect(c.GRID.PHI).toBeCloseTo(340 * 0.015);
        expect(c.GRID.THETA).toBeCloseTo(12 * 0.015);
        expect(c.GRID.UNIT).toEqual([
            112.92512339546204, 112.92512339546204, 112.92512339546204,
        ]);
    });

    it("imports and drags the reference expression figure", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/_Expression.dgp");

        const e1 = c.getObj("E1") as expression_object;
        const e2 = c.getObj("E2") as expression_object;
        const e3 = c.getObj("E3") as expression_object;
        const e4 = c.getObj("E4") as expression_object;

        expect(e1).toBeInstanceOf(expression_object);
        expect(e1.value).toEqual([5, 3]);
        expect(e1.isCursor).toBe(false);
        expect(e1.dom.dom().textContent).toBe("E1 = [5 ; 3]");

        expect(e2.value).toBeCloseTo(2.6);
        expect(e2.isCursor).toBe(true);
        expect(e2.min).toBe(0);
        expect(e2.max).toBe(10);
        expect(e2.dom.dom().textContent).toBe("E2 = 2,6");
        // E2's cPT sets "o:1": its knob is filled solid with its own color,
        // unlike the default hollow-white-with-colored-border look.
        expect(e2.cursorColor).toBe("#8755d2");
        expect(e2.cursorOpacity).toBe(1);

        expect(e3.value).toBe(4);
        expect(e3.isCursor).toBe(true);
        expect(e3.increment).toBe(1);
        expect(e3.dom.dom().textContent).toBe("E3 = 4");
        expect(e3.cursorOpacity).toBe(0);

        expect(e4.value).toEqual([1, -5, 8]);
        expect(e4.isCursor).toBe(false);
        expect(e4.dom.dom().textContent).toBe("E4 = [1 ; -5 ; 8]");

        // Unlike geometric objects, an expression is pinned to a fixed
        // window position: rotating the (here unused) 3D camera must not
        // move it.
        const screenBefore = e1.screen;
        c.GRID.PHI -= 0.5;
        c.GRID.THETA += 0.3;
        c.invalidateProjection();
        c.OBJS.update();
        expect(e1.screen).toEqual(screenBefore);
        c.GRID.PHI += 0.5;
        c.GRID.THETA -= 0.3;
        c.invalidateProjection();
        c.OBJS.update();

        // Drag E2's slider knob roughly to the middle of its track and check
        // the value follows, snapping to nothing since it has no increment.
        const [e2X, e2Y] = e2.screen;
        e2.mousedrag(
            new PointerEvent("pointermove", {
                clientX: e2X + 100,
                clientY: e2Y + 20,
            }),
        );
        c.OBJS.update();
        expect(e2.value as number).toBeCloseTo(5);
        expect(e2.dom.dom().textContent).toBe("E2 = 5");

        // Drag E3's knob near a non-integer position and check it snaps to
        // its "i:1" increment.
        const [e3X, e3Y] = e3.screen;
        e3.mousedrag(
            new PointerEvent("pointermove", {
                clientX: e3X + 138,
                clientY: e3Y + 20,
            }),
        );
        c.OBJS.update();
        expect(e3.value).toBe(7);
        expect(e3.dom.dom().textContent).toBe("E3 = 7");
    });

    it("imports a Curvus plotted function figure", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/graph.dgp");

        const e1 = c.getObj("E1") as expression_object;
        const f1 = c.getObj("f1") as curve_object;

        expect(e1).toBeInstanceOf(expression_object);
        expect(e1.value).toBeNull();
        expect(e1.isCursor).toBe(false);
        expect(e1.formula?.source).toBe("0.5x^2-4");
        expect(e1.dom.dom().textContent).toBe("E1 = 0.5x^2-4");

        expect(f1).toBeInstanceOf(curve_object);
        expect(f1.stroke_color).toBe("#7d0c13");
        expect(f1.size).toBe(1);
        expect(f1.min).toBeNull();
        expect(f1.max).toBeNull();
        expect(f1.formula.refs.get("E1")).toBe(e1);
        expect(f1.parents).toEqual([e1]);

        // f1's own formula is "E1(x)": evaluating it must match E1's formula
        // (0.5x^2-4) evaluated directly at the same x.
        [-3, 0, 2.5].forEach((x) => {
            const viaCurve = realPart(evaluateAtX(f1.formula, x, 40));
            const viaExpression = realPart(evaluateAtX(e1.formula!, x, 40));
            expect(viaCurve).toBeCloseTo(0.5 * x * x - 4);
            expect(viaCurve).toBeCloseTo(viaExpression!);
        });

        expect(f1.defined).toBe(true);
        expect(f1.screenPoints.some((point) => point !== null)).toBe(true);
        expect(f1.dom.dom().innerHTML).not.toMatch(/NaN|Infinity/);

        const p1 = c.getObj("P1") as point_on_object;
        expect(p1).toBeInstanceOf(point_on_object);
        expect(p1.support).toBe(f1);
        expect(p1.alpha).toBe(3.75);
        expect(p1.coords[0]).toBeCloseTo(3.75);
        expect(p1.coords[1]).toBeCloseTo(0.5 * 3.75 * 3.75 - 4);
        expect(p1.coords[2]).toBe(0);

        // Dragging P1 must follow the curve: its alpha is the x it lands on.
        const targetX = -2;
        const targetY = 0.5 * targetX * targetX - 4;
        const [clientX, clientY] = c.pt3D([targetX, targetY, 0]);
        p1.mousedrag(new PointerEvent("pointermove", { clientX, clientY }));
        c.OBJS.update();
        expect(p1.alpha as number).toBeCloseTo(targetX, 1);
        expect(p1.coords[0]).toBeCloseTo(targetX, 1);
        expect(p1.coords[1]).toBeCloseTo(targetY, 1);
    });

    it("magnetizes a free point onto a Curvus curve", () => {
        const c = createConstruction();
        importDgp(
            c,
            `E1=Expression("E1","","","","0.5x^2-4","5.25","2.3875");
f1=Curvus("f1","","","E1(x)");
M=Point("M",0,0);
STL(M,"mg:[f1,5000]");`,
        );
        const m = c.getObj("M") as point_object;

        const targetX = 2;
        const targetY = 0.5 * targetX * targetX - 4;
        // Drag from a spot off the curve but within the magnet radius.
        const [clientX, clientY] = c.pt3D([targetX, targetY + 1, 0]);
        m.mousedrag(new PointerEvent("pointermove", { clientX, clientY }));
        c.OBJS.update();

        expect(m.coords[1]).toBeCloseTo(0.5 * m.coords[0] * m.coords[0] - 4, 1);
    });

    it("keeps a magnetized point glued to whichever segment it grabbed, only switching on a fresh grab", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/trace.dgp");
        c.OBJS.update();
        const m = c.getObj("M") as point_object;
        const s1 = c.getObj("S1") as two_points_line_object;
        const s2 = c.getObj("S2") as two_points_line_object;
        const el = m.dom.dom();

        const dragEvent = (
            type: "pointerdown" | "pointermove" | "pointerup",
            x: number,
            y: number,
        ) =>
            new PointerEvent(type, {
                clientX: x,
                clientY: y,
                button: 0,
                isPrimary: true,
                pointerId: 1,
                bubbles: true,
            });
        const distanceToSegment = (
            line: two_points_line_object,
            point: Vec3,
        ): number => {
            const direction = vSub(line.P2.coords, line.P1.coords);
            const alpha = Math.max(
                0,
                Math.min(
                    1,
                    vDot(vSub(point, line.P1.coords), direction) /
                        vDot(direction, direction),
                ),
            );
            return Math.hypot(
                point[0] - (line.P1.coords[0] + alpha * direction[0]),
                point[1] - (line.P1.coords[1] + alpha * direction[1]),
            );
        };

        // S1 and S2 run close and roughly parallel — exactly the ambiguous
        // zone that used to make the closest-of-the-two flip every frame,
        // dragging the point back and forth between them instead of
        // following whichever one it actually snapped onto.
        const start = c.pt3D(m.coords);
        el.dispatchEvent(dragEvent("pointerdown", start[0], start[1]));
        for (const [x, y] of [
            [300, 200],
            [305, 210],
            [298, 220],
            [290, 235],
            [295, 245],
            [285, 255],
            [280, 260],
        ]) {
            el.dispatchEvent(dragEvent("pointermove", x, y));
            c.OBJS.update();
            expect(distanceToSegment(s1, m.coords)).toBeLessThan(1e-6);
        }
        el.dispatchEvent(dragEvent("pointerup", 280, 260));

        // A fresh grab (pointer up, then down again) dragged decisively
        // toward S2 must still be able to switch magnets.
        el.dispatchEvent(dragEvent("pointerdown", 280, 260));
        el.dispatchEvent(dragEvent("pointermove", 420, 200));
        c.OBJS.update();
        el.dispatchEvent(dragEvent("pointermove", 400, 280));
        c.OBJS.update();
        el.dispatchEvent(dragEvent("pointerup", 400, 280));

        expect(distanceToSegment(s2, m.coords)).toBeLessThan(1e-6);
    });

    it("traces point movement without joining magnet switches or reprojections", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/trace.dgp");
        c.OBJS.update();
        const m = c.getObj("M") as point_object;
        const s1 = c.getObj("S1") as two_points_line_object;
        const s2 = c.getObj("S2") as two_points_line_object;
        const path = m.tracePath!;
        const pointAt = (line: two_points_line_object, alpha: number): Vec3 => [
            line.P1.x + alpha * (line.P2.x - line.P1.x),
            line.P1.y + alpha * (line.P2.y - line.P1.y),
            line.P1.z + alpha * (line.P2.z - line.P1.z),
        ];
        const moveTo = (coords: Vec3): void => {
            const [clientX, clientY] = c.pt3D(coords);
            m.mousedrag(new PointerEvent("pointermove", { clientX, clientY }));
            c.OBJS.update();
        };

        expect(m.trace).toBe(true);
        expect(c.svg.dom().lastElementChild).toBe(c.traceLayer.dom());
        expect(path.getAtt("d")).toBeNull();

        [0.35, 0.45, 0.55].forEach((alpha) => moveTo(pointAt(s1, alpha)));
        [0.4, 0.5].forEach((alpha) => moveTo(pointAt(s2, alpha)));

        const beforeProjection = path.getAtt("d")!;
        expect(beforeProjection.match(/M/g)).toHaveLength(2);
        expect(beforeProjection.match(/L/g)).toHaveLength(3);

        c.GRID.PHI += 0.1;
        c.invalidateProjection();
        c.OBJS.update();
        expect(path.getAtt("d")).toBe(beforeProjection);

        moveTo(pointAt(s2, 0.6));
        expect(path.getAtt("d")!.match(/M/g)).toHaveLength(3);
        expect(path.getAtt("d")!.match(/L/g)).toHaveLength(4);
    });

    it("traces a dependent point when its parent moves", () => {
        const c = createConstruction();
        importDgp(
            c,
            `A=Point("A",-1,0);
B=Point("B",1,0);
L=Line("L",A,B);
M=Point("M",0,1);
R=Reflection("R",L,M);
STL(M,"tk:true");
STL(R,"tk:true");`,
        );
        c.OBJS.update();
        const m = c.getObj("M") as point_object;
        const reflection = c.getObj("R") as point_object;

        [1, 2].forEach((x) => {
            const [clientX, clientY] = c.pt3D([x, 1, 0]);
            m.mousedrag(new PointerEvent("pointermove", { clientX, clientY }));
            c.OBJS.update();
        });

        expect(m.tracePath!.getAtt("d")!.match(/L/g)).toHaveLength(2);
        expect(reflection.tracePath!.getAtt("d")!.match(/L/g)).toHaveLength(2);
    });

    it("drags a point along a 3D segment that's vertical in world space", () => {
        const c = createConstruction();
        importDgp(
            c,
            `SetCoords(0,0,40,true,800,600);
A=Point("A","[0,0,-1]","1");
B=Point("B","[0,0,1]","1");
S=Segment("S",A,B);
M=PointOn("M",S,0.5);`,
        );
        c.OBJS.update();
        const m = c.getObj("M") as point_on_object;
        expect(m.alpha).toBe(0.5);

        // Dragging M via a screen point unprojected onto the fixed Z=this.z
        // plane (this point_on_object's old behavior) can't move it at all
        // along a purely-vertical segment: that plane barely intersects a
        // vertical line anywhere else, so the recovered alpha stays ~0.5
        // regardless of where the cursor goes. Projecting onto the
        // segment's own line (see point_on_object.dragTarget) fixes that.
        const [clientX, clientY] = c.pt3D([0, 0, 0.8]);
        m.mousedrag(new PointerEvent("pointermove", { clientX, clientY }));
        c.OBJS.update();

        expect(m.alpha as number).toBeCloseTo(0.9);
    });

    it("only builds an SVG view for the objects visible in Apollonius", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/_Apollonius.dgp");

        // 3 free points + 3 initial circles + 32 Circle3pts, plus the grid.
        expect(c.OBJS.V.filter((object) => object.hasView)).toHaveLength(39);
        const hidden = c.OBJS.V.find(
            (object) => object !== c.GRID && !object.hasView,
        )!;
        expect(hidden.isHidden).toBe(true);
        expect(hidden.dom).toBeUndefined();
    });

    it("imports Point/Circle1 formulas from ptExp.dgp", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/ptExp.dgp");

        const a = c.getObj("A") as point_object;
        const b = c.getObj("B") as point_object;
        const e = c.getObj("E") as point_object;
        const circle = c.getObj("C1") as circle1_object;

        expect(a).toBeInstanceOf(fixed_point_object);
        expect(a.coords).toEqual([-4, 3, 0]);
        expect(b).toBeInstanceOf(formula_point_object);
        expect(b.coords).toEqual([2, 3, 0]);
        expect(e).toBeInstanceOf(formula_point_object);
        expect(e.coords[0]).toBeCloseTo(1);
        expect(e.coords[1]).toBeCloseTo(2);
        expect(circle).toBeInstanceOf(circle1_object);
        expect(circle.CENTER).toEqual(b.coords);
        expect(circle.R).toBeCloseTo(Math.hypot(5, 1));
    });

    it("rejects a point formula referencing an unknown object", () => {
        const c = createConstruction();
        expect(() =>
            importDgp(
                c,
                `A=Point("A","[-4,3]","0");
E=Point("E","A+Z","0");`,
            ),
        ).toThrow("Unknown DGP reference at line 2");
    });

    it("rejects a circle radius formula referencing an unknown object", () => {
        const c = createConstruction();
        expect(() =>
            importDgp(
                c,
                `A=Point("A",0,0);
C1=Circle1("C1",A,"d(A,Z)");`,
            ),
        ).toThrow("Unknown DGP reference at line 2");
    });

    it("imports an Arc3pts figure and its center", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/arc.dgp");

        const p1 = c.getObj("P1") as point_object;
        const p2 = c.getObj("P2") as point_object;
        const p3 = c.getObj("P3") as point_object;
        const arc = c.getObj("C1") as arc3pts_object;
        const center = c.getObj("Center1") as point_object;

        expect(arc).toBeInstanceOf(arc3pts_object);
        expect(arc.defined).toBe(true);
        expect(Math.hypot(...vSub(p1.coords, arc.CENTER))).toBeCloseTo(arc.R);
        expect(Math.hypot(...vSub(p2.coords, arc.CENTER))).toBeCloseTo(arc.R);
        expect(Math.hypot(...vSub(p3.coords, arc.CENTER))).toBeCloseTo(arc.R);
        expect(center.coords).toEqual(arc.CENTER);
        expect(arc.dom.dom().innerHTML).not.toMatch(/NaN|Infinity/);
    });

    it("imports a legacy-3D cube built from vector-literal point formulas", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/chemin_cube.dgp");
        c.OBJS.update();

        // P1 is the figure's implicit 3D origin (see SetCoords' is3D
        // handling); the other 7 vertices are "P1+[dx,dy,dz]" formula
        // points and must come out as real 3D coordinates, not 2D.
        const p1 = c.getObj("P1") as point_object;
        const h = c.getObj("H") as point_object;
        const c1 = c.getObj("C") as point_object;
        expect(p1.coords).toEqual([0, 0, 0]);
        expect(h.coords).toEqual([-1, -1, 1]);
        expect(c1.coords).toEqual([1, 1, 1]);

        // P2 is a fixed point computed from a slider Expression (E2) inside
        // a 3-component vector literal ("[1-2*cos(E2),1+2*sin(E2),1]").
        const e2 = c.getObj("E2") as expression_object;
        const angle = e2.value as number;
        const p2 = c.getObj("P2") as point_object;
        expect(p2.coords[0]).toBeCloseTo(1 - 2 * Math.cos(angle));
        expect(p2.coords[1]).toBeCloseTo(1 + 2 * Math.sin(angle));
        expect(p2.coords[2]).toBeCloseTo(1);

        // P4 mirrors M's own 3D position via "M.coords3D()".
        const m = c.getObj("M") as point_object;
        const p4 = c.getObj("P4") as point_object;
        expect(p4.coords).toEqual(m.coords);

        // AI, AM, MI are Expressions computing 3D distances between cube
        // vertices ("d(A,I)" etc.), and E3 ("AI-AM-MI") reads their live
        // values directly, whatever M's current position on [BC] is.
        const ai = (c.getObj("AI") as expression_object).value as number;
        const am = (c.getObj("AM") as expression_object).value as number;
        const mi = (c.getObj("MI") as expression_object).value as number;
        const e3 = (c.getObj("E3") as expression_object).value as number;
        expect(ai).toBeGreaterThan(0);
        expect(e3).toBeCloseTo(ai - am - mi);

        // The 17 "Dash code"/"Visibilité des faces" Expressions script
        // other objects via unsupported method calls (S1.setDash(...),
        // Poly1.setOpacity(...)): imported as inert placeholders instead of
        // failing the whole figure.
        const dash = c.getObj("E36") as expression_object;
        expect(dash).toBeInstanceOf(expression_object);
        expect(dash.value).toBeNull();

        // The "Ouvrir" slider (E2) must land on a real, finite screen
        // position — this figure is hand-edited between test runs, so this
        // only guards against it going missing/NaN, not an exact pixel spot.
        expect(e2.isCursor).toBe(true);
        expect(e2.screen.every(Number.isFinite)).toBe(true);
    });

    it("centers a 3D figure's world origin on the live viewport, independently of its Expression labels", () => {
        const c = createConstruction();
        importDgp(
            c,
            `SetCoords(9999,-9999,40,true,100,100);
E1=Expression("E1","","","","5","-1","0");`,
        );

        // DGPad's native app resizes its own window to the figure's saved
        // width/height on load, so its saved pixel origin (9999,-9999) is
        // always meaningful there. This is a responsive web page that
        // can't do that: reusing that origin as-is for 3D point
        // projection would push the whole figure off-screen whenever the
        // live viewport doesn't match, so it's centered on the live
        // viewport instead (see SetCoords' execute) — matching both this
        // legacy format's own "centerZoom" convention and how the app
        // already recenters on a live resize (construction.resize).
        expect(c.GRID.ORG).toEqual([c.width / 2, c.height / 2]);

        // An Expression's screen label isn't projected geometry: it still
        // anchors to the literal saved origin (see Expression's execute).
        const e1 = c.getObj("E1") as expression_object;
        expect(e1.screen).toEqual([9999 - 40, -9999]);
    });

    it("hides an edge lying on a coplanar face without flickering", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/chemin_cube.dgp");
        // [GC] lies on the closed face BFGC through P2, a different point
        // coincident with G: sweeping the camera must switch it between
        // visible and hidden once, not flip at random on rounding noise.
        const edge = c.getObj("S109") as segment_object;
        const phi = c.GRID.PHI;
        c.GRID.THETA -= 0.3;
        const states: boolean[] = [];
        for (let step = 0; step <= 400; step++) {
            c.GRID.PHI = phi + 0.35 + step * 0.0005;
            c.OBJS.markProjectionDirty();
            c.OBJS.update();
            const hidden = hiddenOf(edge);
            expect(hidden.length).toBeLessThanOrEqual(1);
            states.push(hidden.length === 1);
        }
        const changes = states.filter(
            (state, index) => index > 0 && state !== states[index - 1],
        ).length;
        expect(changes).toBe(1);
    });

    it("dashes coincident segments in phase whatever their direction", () => {
        expect(intervalsToPath([10, 5], [0, 5], [[0, 0.5]])).toBe(
            intervalsToPath([0, 5], [10, 5], [[0.5, 1]]),
        );
    });
});
