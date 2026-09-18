import { afterEach, describe, expect, it } from "vitest";
import { construction } from "../../src/construction";
import { importDgp, importDgpFromUrl } from "../../src/dgp_importer";
import { angle_bisector_object } from "../../src/objects/angle_bisector_object";
import { angle_object } from "../../src/objects/angle_object";
import { expression_object } from "../../src/objects/expression_object";
import { fixed_angle_object } from "../../src/objects/fixed_angle_object";
import { fixed_point_object } from "../../src/objects/fixed_point_object";
import { locus_object } from "../../src/objects/locus_object";
import { point_on_object } from "../../src/objects/point_on_object";
import { point_object } from "../../src/objects/point_object";
import { polygon_object } from "../../src/objects/polygon_object";
import { symmetry_object } from "../../src/objects/symmetry_object";
import { two_points_line_object } from "../../src/objects/two_points_line_object";
import { preferences } from "../../src/preferences";
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
    it("imports two points and their line from the public DGP file", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/_Droite.dgp");

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
        await importDgpFromUrl(c, "/tests/_Mediatrice.dgp");

        expect(c.OBJS.V).toHaveLength(8);
        expect(c.getObj("P1")).toBeInstanceOf(point_object);
        expect(c.getObj("L1")).toBeInstanceOf(two_points_line_object);
    });

    it("imports the angle-bisector reference figure", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/_Bissectrice.dgp");

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
        await importDgpFromUrl(c, "/tests/_FixedAngle.dgp");

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
        await importDgpFromUrl(c, "/tests/_Locus.dgp");

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
        await importDgpFromUrl(c, "/tests/_Locus2.dgp");

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
        await importDgpFromUrl(c, "/tests/_PtOn5.dgp");

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
        await importDgpFromUrl(c, "/tests/_PtOn2.dgp");

        const point = c.getObj("A") as point_on_object;
        expect(point).toBeInstanceOf(point_on_object);
        expect(point.coords[0]).toBeCloseTo(-1.325);
        expect(point.coords[1]).toBeCloseTo(2.1125);
        expect(point.coords[2]).toBe(0);
    });

    it("keeps an sb point on the polygon boundary", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/_PtOn3.dgp");

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
        await importDgpFromUrl(c, "/tests/_Apollonius.dgp");

        expect(c.OBJS.V).toHaveLength(2570);
        expect(c.getObj("P1")).toBeInstanceOf(point_object);
        expect(c.getObj("P14")).toBeInstanceOf(point_object);
        expect(c.getObj("Center32")).toBeInstanceOf(point_object);
    });

    it("imports the legacy fake-3D cube, pinning its origin and axes", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/_Cube.dgp");

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
        await importDgpFromUrl(c, "/tests/_Expression.dgp");

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

    it("keeps a magnetized point glued to whichever segment it grabbed, only switching on a fresh grab", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/trace.dgp");
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
        await importDgpFromUrl(c, "/tests/trace.dgp");
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

    it("only builds an SVG view for the objects visible in Apollonius", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/_Apollonius.dgp");

        // 3 free points + 3 initial circles + 32 Circle3pts, plus the grid.
        expect(c.OBJS.V.filter((object) => object.hasView)).toHaveLength(39);
        const hidden = c.OBJS.V.find(
            (object) => object !== c.GRID && !object.hasView,
        )!;
        expect(hidden.isHidden).toBe(true);
        expect(hidden.dom).toBeUndefined();
    });
});
