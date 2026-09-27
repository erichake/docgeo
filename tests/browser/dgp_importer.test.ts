import { afterEach, describe, expect, it } from "vitest";
import { construction } from "../../src/construction";
import { importDgp, importDgpFromUrl } from "../../src/dgp_importer";
import { angle_bisector_object } from "../../src/objects/angle_bisector_object";
import { angle_object } from "../../src/objects/angle_object";
import { arc3pts_object } from "../../src/objects/arc3pts_object";
import { circle1_object } from "../../src/objects/circle1_object";
import { curve_object } from "../../src/objects/curve_object";
import { NO_VIEW, realPart } from "../../src/import/dgp_formula";
import {
    evaluateFunction,
    expression_object,
} from "../../src/objects/expression_object";
import type { expression_list_object } from "../../src/objects/expression_list_object";
import { fixed_angle_object } from "../../src/objects/fixed_angle_object";
import { fixed_point_object } from "../../src/objects/fixed_point_object";
import { formula_point_object } from "../../src/objects/formula_point_object";
import { locus_object } from "../../src/objects/locus_object";
import { point_on_object } from "../../src/objects/point_on_object";
import { point_object } from "../../src/objects/point_object";
import { polygon_object } from "../../src/objects/polygon_object";
import type { quadric5pts_object } from "../../src/objects/quadric5pts_object";
import { symmetry_object } from "../../src/objects/symmetry_object";
import { text_object } from "../../src/objects/text_object";
import { two_points_line_object } from "../../src/objects/two_points_line_object";
import { intervalsToPath } from "../../src/objects/hidden_line";
import type { segment_object } from "../../src/objects/segment_object";
import { preferences } from "../../src/preferences";

// A segment's current hidden sub-ranges (see hidden_line.ts).
function hiddenOf(segment: segment_object): [number, number][] {
    return (segment as unknown as { hiddenIntervals: [number, number][] })
        .hiddenIntervals;
}
import { vDot, vNormalize, vSub, type Vec2, type Vec3 } from "../../src/vec";

function createConstruction(): construction {
    document.documentElement.style.width = "100%";
    document.documentElement.style.height = "100%";
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    document.body.style.margin = "0";
    return construction.create({ prefs: new preferences() });
}

// The figure's own objects: without the grid and its floor (see
// grid_object.initFloorOccluder), present in every construction.
function figureObjects(c: construction) {
    const floor = c.GRID.floorOccluder;
    return c.OBJS.V.filter(
        (object) =>
            object !== c.GRID &&
            object !== floor &&
            !floor.parents.includes(object),
    );
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

    it("skips and reports instructions outside the supported subset", () => {
        const c = createConstruction();
        expect(
            importDgp(
                c,
                `P=Point("P",0,0);
fetch("https://example.com");
Q=Unknown("Q",P,[1,2]);
R=Point("R","Q+[1,0]","0");
STL(Q,"c:#ff0000");
S=Point("S",1,0);`,
            ),
        ).toEqual(['fetch("https://example.com")', 'Unknown("Q", P, [1, 2])']);
        expect(figureObjects(c).map((object) => object.name)).toEqual([
            "P",
            "S",
        ]);
    });

    it("writes formula values and literal percents in an AnchoredText", () => {
        const c = createConstruction();
        importDgp(
            c,
            `P=Point("P",1,2);
T=AnchoredText("T",P,0,0,"x+y=%x(P)+y(P)%, 100%%");
STL(T,"p:2");`,
        );
        expect((c.getObj("T") as text_object).content).toBe("x+y=3, 100%");
        expect(
            importDgp(
                createConstruction(),
                `P=Point("P",1,2);
T=AnchoredText("T",P,0,0,"100%");`,
            ),
        ).toEqual(['AnchoredText("T", P, 0, 0, "100%")']);
    });

    it("skips and reports unsafe styles", () => {
        const c = createConstruction();
        expect(
            importDgp(
                c,
                `P=Point("P",0,0);
STL(P,"c:url(https://example.com/image)");`,
            ),
        ).toEqual(['STL(P, "c:url(https://example.com/image)")']);
        expect(c.getObj("P")?.stroke_color).not.toContain("url");
    });

    it("skips and reports a non-boolean trace style", () => {
        const c = createConstruction();
        expect(
            importDgp(
                c,
                `P=Point("P",0,0);
STL(P,"tk:1");`,
            ),
        ).toEqual(['STL(P, "tk:1")']);
        expect(c.getObj("P")).toBeInstanceOf(point_object);
    });

    it("imports the perpendicular-bisector reference figure", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/_Mediatrice.dgp");

        expect(figureObjects(c)).toHaveLength(7);
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

    it("draws a right angle as DGPad's open square, without its value", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/marque_angle.dgp");
        const angle = c.getObj("A1") as angle_object;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(angle.arcPath.getAtt("d")).toMatch(/ A30 30 /);
        expect((angle.valueText!.dom() as SVGElement).style.display).toBe(
            "block",
        );

        const [p1, p2, p3] = ["P1", "P2", "P3"].map(
            (name) => (c.getObj(name) as point_object).coords,
        );
        const [dx, dy] = vNormalize(vSub(p2, p1))!;
        const p4 = c.getObj("P4") as point_object;
        p4.coords = [p3[0] - 3 * dy, p3[1] + 3 * dx, 0];
        c.invalidateGeometry(p4);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const [o, a, d, b] = [
            ...angle.wedgeFill.getAtt("d")!.matchAll(/[ML](\S+) (\S+)/g),
        ].map(([, x, y]) => [Number(x), Number(y)]);
        expect(o[0]).toBeCloseTo(angle.O.screen[0], 9);
        expect(o[1]).toBeCloseTo(angle.O.screen[1], 9);
        [a, b].forEach((vertex) =>
            expect(Math.hypot(vertex[0] - o[0], vertex[1] - o[1])).toBeCloseTo(
                30,
                9,
            ),
        );
        expect(Math.hypot(d[0] - o[0], d[1] - o[1])).toBeCloseTo(
            30 * Math.SQRT2,
            9,
        );
        expect(angle.arcPath.getAtt("d")).toBe(
            `M${a[0]} ${a[1]} L${d[0]} ${d[1]} L${b[0]} ${b[1]}`,
        );
        expect((angle.valueText!.dom() as SVGElement).style.display).toBe(
            "none",
        );
    });

    it("imports the fixed-angle reference figure", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/_FixedAngle.dgp");

        const vertex = c.getObj("P2") as point_object;
        const a = c.getObj("P1") as point_object;
        const fixedAngle = c.getObj("A1") as fixed_angle_object;

        expect(fixedAngle).toBeInstanceOf(fixed_angle_object);
        expect(fixedAngle.valueDegrees).toBeCloseTo(120.5);
        expect(fixedAngle.trigo).toBe(true);
        expect(fixedAngle.arcRadius).toBeCloseTo(48.83646178829912);

        const dirA = vNormalize(vSub(a.coords, vertex.coords))!;
        const cosAngle = Math.min(1, Math.max(-1, vDot(fixedAngle.VEC, dirA)));
        expect((Math.acos(cosAngle) * 180) / Math.PI).toBeCloseTo(120.5);
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
        expect(point.alpha).toBe(689);
        expect(point.coords).toEqual(locus.points[689]);
        expect(point.x).toBeCloseTo(-2.079158862780794);
        expect(point.y).toBeCloseTo(3.2862801601722698);
        expect(
            locus.alphaAtScreen(
                locus.screenPoints[locus.screenPoints.length - 1]!,
            ),
        ).toBeCloseTo(locus.points.length - 1);

        const start = locus.screenPoints[689]!;
        const end = locus.screenPoints[690]!;
        point.mousedrag(
            new PointerEvent("pointermove", {
                clientX: start[0] + 0.35 * (end[0] - start[0]),
                clientY: start[1] + 0.35 * (end[1] - start[1]),
            }),
        );
        c.OBJS.update();

        expect(point.alpha as number).toBeCloseTo(689.35);
        expect(point.coords).toEqual(locus.pointAt(point.alpha as number));

        const focus = c.getObj("P3") as point_object;
        const alpha = point.alpha as number;
        focus.coords = [focus.x, focus.y + 1, focus.z];
        c.invalidateGeometry(focus);
        c.OBJS.update();

        expect(point.alpha).toBe(alpha);
        expect(point.coords).toEqual(locus.pointAt(alpha));
    });

    it("keeps a pinned figure sized by the window in place on zoom and pan", async () => {
        const c = createConstruction();
        expect(
            await importDgpFromUrl(c, "/tests/dgp/_AireParallelo.dgp"),
        ).toEqual([]);
        const a = c.getObj("A") as point_object;
        const b = c.getObj("B") as formula_point_object;
        const d = c.getObj("D") as formula_point_object;
        const ab = () => b.coords[0] - a.coords[0];
        expect(ab()).toBeCloseTo(c.width / c.GRID.UNIT[0] / 4, 9);
        expect(a.coords[1] - d.coords[1]).toBeCloseTo(
            c.width / c.GRID.UNIT[0] / 3,
            9,
        );
        expect(c.getObj("Poly1")).toBeInstanceOf(polygon_object);

        await new Promise((resolve) => requestAnimationFrame(resolve));
        const screens = () => [a.screen, b.screen, d.screen];
        const before = screens();
        const [ux, uy, uz] = c.GRID.UNIT;
        c.GRID.UNIT = [2 * ux, 2 * uy, 2 * uz];
        c.GRID.ORG = [c.GRID.ORG[0] + 30, c.GRID.ORG[1] - 20];
        c.invalidateProjection();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        screens().forEach((screen, index) =>
            screen.forEach((value, axis) =>
                expect(value).toBeCloseTo(before[index][axis], 9),
            ),
        );
        expect(ab()).toBeCloseTo(c.width / c.GRID.UNIT[0] / 4, 9);
    });

    it("writes a polygon's area at its vertices' mean, like DGPad", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/poly_mesure.dgp");
        const polygon = c.getObj("Poly1") as polygon_object;
        const vertices = ["P1", "P2", "P3", "P4"].map(
            (name) => c.getObj(name) as point_object,
        );
        const area = () =>
            Math.abs(
                vertices.reduce((sum, p, i) => {
                    const q = vertices[(i + 1) % vertices.length];
                    return (
                        sum +
                        p.coords[0] * q.coords[1] -
                        q.coords[0] * p.coords[1]
                    );
                }, 0),
            ) / 2;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const text = polygon.measureText!;
        expect(text.dom().textContent).toBe(
            `${Math.round(area() * 100) / 100}`.replace(".", ","),
        );
        [0, 1].forEach((axis) =>
            expect(Number(text.getAtt(axis ? "y" : "x"))).toBeCloseTo(
                vertices.reduce((sum, p) => sum + p.screen[axis], 0) / 4,
                9,
            ),
        );

        vertices[3].coords = [3, 3, 0];
        c.invalidateGeometry(vertices[3]);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(polygon.area).toBeCloseTo(area(), 12);
        expect(text.dom().textContent).toBe(
            `${Math.round(area() * 100) / 100}`.replace(".", ","),
        );
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

    it("keeps a point on a perpendicular at its distance whatever the zoom", async () => {
        const c = createConstruction();
        importDgp(
            c,
            `SetCoords(400,300,40,false,800,600);
A=Point("A",0,0);
B=Point("B",0,1);
d=Line("d",A,B);
p=Perpendicular("p",d,B);
M=PointOn("M",p,80);`,
        );
        const [b, m] = ["B", "M"].map((name) => c.getObj(name) as point_object);
        expect(Math.abs(m.x - b.x)).toBeCloseTo(2);

        c.GRID.UNIT = [80, 80, 80];
        c.invalidateProjection();
        b.coords = [0, 2, 0];
        c.invalidateGeometry(b);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(Math.abs(m.x - b.x)).toBeCloseTo(2);
        expect(m.y).toBeCloseTo(2);
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

    it("skips and reports an invalid scalar parameter for a polygon PointOn", () => {
        const c = createConstruction();
        expect(
            importDgp(
                c,
                `A=Point("A",0,0);
B=Point("B",1,0);
C=Point("C",0,1);
poly=Polygon("poly","_A,_B,_C");
P=PointOn("P",poly,0.5);`,
            ),
        ).toEqual(['PointOn("P", poly, 0.5)']);
        expect(c.getObj("P")).toBeUndefined();
    });

    it("imports the complete Apollonius construction", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/_Apollonius.dgp");

        expect(figureObjects(c)).toHaveLength(2569);
        expect(c.getObj("P1")).toBeInstanceOf(point_object);
        expect(c.getObj("P14")).toBeInstanceOf(point_object);
        expect(c.getObj("Center32")).toBeInstanceOf(point_object);
    });

    it("draws DGPad's plane coordinate system for a figure without 3D objects", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/_onlyAxis.dgp");
        const labels = () =>
            [...c.GRID.dom.dom().querySelectorAll("text")]
                .filter((text) => (text as SVGElement).style.display !== "none")
                .map((text) => text.textContent);

        expect(c.GRID.is2D).toBe(true);
        expect(c.GRID.SHOWFLOOR).toBe(false);
        expect(labels()).toContain("5");
        expect(labels()).toContain("-5");
        expect(labels()).not.toContain("0");
        labels().forEach((label) =>
            expect(Math.abs(Number(label) % 5)).toBe(0),
        );

        const svg = c.svg.dom();
        const origin = [...c.GRID.ORG];
        const phi = c.GRID.PHI;
        const pointer = (
            type: "pointerdown" | "pointermove" | "pointerup",
            x: number,
            y: number,
        ) =>
            new PointerEvent(type, {
                bubbles: true,
                button: 2,
                clientX: x,
                clientY: y,
                isPrimary: true,
                pointerId: 1,
                pointerType: "mouse",
            });
        svg.dispatchEvent(pointer("pointerdown", 100, 100));
        svg.dispatchEvent(pointer("pointermove", 130, 90));
        svg.dispatchEvent(pointer("pointerup", 130, 90));
        expect(c.GRID.PHI).toBe(phi);
        expect(c.GRID.ORG).toEqual([origin[0] + 30, origin[1] - 10]);

        // The origin far outside the window: graduations stay on its edges.
        c.GRID.ORG = [-20000, c.height + 20000];
        c.invalidateProjection();
        c.OBJS.update();
        expect(labels().length).toBeGreaterThan(4);
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

    it("imports a 2D figure of point3D points as a 3D one", async () => {
        const c = createConstruction();
        const unsupported = await importDgpFromUrl(
            c,
            "/tests/dgp/_tetraOld.dgp",
        );

        const coords = (name: string) =>
            (c.getObj(name) as point_object).coords;
        expect(unsupported).toEqual([]);
        expect(c.getObj("P1")).toBeInstanceOf(fixed_point_object);
        expect(coords("P1")).toEqual([0, 0, 0]);
        expect(coords("X")).toEqual([1, 0, 0]);
        expect(coords("Z")).toEqual([0, 0, 1]);
        expect(coords("P43")).toEqual([2, 2, 2]);
        const d = coords("D");
        expect(d[0]).toBeCloseTo(d[2]);
        expect(c.GRID.is2D).toBe(false);
        expect(c.GRID.PHI).toBeCloseTo(342 * 0.015);
        expect(c.GRID.THETA).toBeCloseTo(-30 * 0.015);
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
            const viaCurve = realPart(
                evaluateFunction(f1.formula, [x], NO_VIEW),
            );
            const viaExpression = realPart(
                evaluateFunction(e1.formula!, [x], NO_VIEW),
            );
            expect(viaCurve).toBeCloseTo(0.5 * x * x - 4);
            expect(viaCurve).toBeCloseTo(viaExpression!);
        });

        expect(f1.defined).toBe(true);
        expect(f1.screenPoints.some((point) => point !== null)).toBe(true);
        expect(f1.dom.dom().innerHTML).not.toMatch(/NaN|Infinity/);

        const m = c.getObj("M") as point_on_object;
        expect(m).toBeInstanceOf(point_on_object);
        expect(m.support).toBe(f1);
        expect(m.alpha).toBe(4.025);
        expect(m.coords[0]).toBeCloseTo(4.025);
        expect(m.coords[1]).toBeCloseTo(0.5 * 4.025 * 4.025 - 4);
        expect(m.coords[2]).toBe(0);

        // Dragging M must follow the curve: its alpha is the x it lands on.
        const targetX = -2;
        const targetY = 0.5 * targetX * targetX - 4;
        const [clientX, clientY] = c.pt3D([targetX, targetY, 0]);
        m.mousedrag(new PointerEvent("pointermove", { clientX, clientY }));
        c.OBJS.update();
        expect(m.alpha as number).toBeCloseTo(targetX, 1);
        expect(m.coords[0]).toBeCloseTo(targetX, 1);
        expect(m.coords[1]).toBeCloseTo(targetY, 1);
    });

    it("breaks a Curvus curve at its jumps, not where it is only steep", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/_floor.dgp");
        importDgp(
            c,
            `E2=Expression("E2","","","","1/(x-0.3)","0","0");
f2=Curvus("f2","","","E2(x)");
E3=Expression("E3","","","","atan(1000(x-0.3))+x^3","0","0");
f3=Curvus("f3","","","E3(x)");`,
        );
        c.OBJS.update();
        const pieces = (name: string) =>
            c
                .getObj(name)!
                .dom.dom()
                .lastElementChild!.getAttribute("d")!
                .match(/M/g)!.length;

        const [lo, hi] = (c.getObj("f1") as curve_object).domain();
        expect(pieces("f1")).toBe(Math.floor(hi) - Math.floor(lo) + 1);
        expect(pieces("f2")).toBe(2);
        expect(pieces("f3")).toBe(1);
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

    it("draws an edge shared by segments and polygons as DGPad paints them, or segments last as GeoGebra does", () => {
        const figure = (
            segmentSize: number,
        ) => `SetCoords(400,300,40,false,800,600);
A=Point("A",0,0);
B=Point("B",4,0);
C=Point("C",0,3);
S1=Segment("S1",A,B);
S2=Segment("S2",B,C);
P=Polygon("P","_A,_B,_C");
STL(S1,"s:${segmentSize}");
STL(S2,"s:3");
STL(P,"s:2");`;
        const drawn = (element: { dom(): Element }) =>
            element.dom().getAttribute("d")?.match(/M/g)?.length ?? 0;

        // The polygon, painted after them, hides [AB] as thick, but not the
        // thicker [BC], drawn on its own outline.
        const c = createConstruction();
        importDgp(c, figure(1));
        c.OBJS.update();
        const polygon = c.getObj("P") as polygon_object;
        expect(drawn((c.getObj("S1") as segment_object).path)).toBe(0);
        expect(drawn((c.getObj("S2") as segment_object).path)).toBe(1);
        expect(drawn(polygon.outline)).toBe(3);

        const ggb = createConstruction();
        ggb.segmentsOverPolygons = true;
        importDgp(ggb, figure(2));
        ggb.OBJS.update();
        // Its segments, painted last, hide both edges they share with it.
        expect(drawn((ggb.getObj("S1") as segment_object).path)).toBe(1);
        expect(drawn((ggb.getObj("P") as polygon_object).outline)).toBe(1);
    });

    it("only builds an SVG view for the objects visible in Apollonius", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/_Apollonius.dgp");

        // 3 free points + 3 initial circles + 32 Circle3pts.
        const objects = figureObjects(c);
        expect(objects.filter((object) => object.hasView)).toHaveLength(38);
        const hidden = objects.find((object) => !object.hasView)!;
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

    it("skips and reports a point formula referencing an unknown object", () => {
        const c = createConstruction();
        expect(
            importDgp(
                c,
                `A=Point("A","[-4,3]","0");
E=Point("E","A+Z","0");`,
            ),
        ).toEqual(['Point("E", "A+Z", "0")']);
    });

    it("skips and reports a circle radius formula referencing an unknown object", () => {
        const c = createConstruction();
        expect(
            importDgp(
                c,
                `A=Point("A",0,0);
C1=Circle1("C1",A,"d(A,Z)");`,
            ),
        ).toEqual(['Circle1("C1", A, "d(A,Z)")']);
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

        // The "Dash code" Expressions only script S1.setDash(...), left
        // aside since the reader dashes hidden edges on its own: they only
        // hold their text.
        const dash = c.getObj("E36") as expression_object;
        expect(dash).toBeInstanceOf(expression_object);
        expect(dash.value).toBe("Dash code");

        // The "Ouvrir" slider (E2) must land on a real, finite screen
        // position — this figure is hand-edited between test runs, so this
        // only guards against it going missing/NaN, not an exact pixel spot.
        expect(e2.isCursor).toBe(true);
        expect(e2.screen.every(Number.isFinite)).toBe(true);
    });

    it("carries out the setHidden and setOpacity statements of script Expressions", async () => {
        const c = createConstruction();
        const unsupported = await importDgpFromUrl(
            c,
            "/tests/dgp/_patronsCube.dgp",
        );
        expect(unsupported).toEqual([]);
        const patron = c.getObj("Patron") as expression_object;
        const enroule = c.getObj("Enroule") as expression_object;
        const polgr1 = c.getObj("Polgr1") as polygon_object;
        const polar1 = c.getObj("Polar1") as polygon_object;
        const poly2 = c.getObj("Poly2") as polygon_object;
        const setValue = (slider: expression_object, value: number) => {
            slider.value = value;
            c.OBJS.markGeometryDirty(slider);
            c.OBJS.update();
        };

        // "Polgr1.setHidden(Patron>1)" overrides the face's own h:1 style.
        expect(patron.value).toBe(11);
        expect(polgr1.isVisible).toBe(false);
        setValue(patron, 1);
        expect(polgr1.isVisible).toBe(true);
        expect(polgr1.hasView).toBe(true);

        // Folded up, a face becomes opaque only while seen from the front,
        // as told by "arg(... .coords2D() ...)" Expressions.
        setValue(enroule, Math.PI / 2);
        expect(poly2.opacity).toBeCloseTo(1);
        expect(polar1.opacity).toBeCloseTo(0.2);
        // Seen from the other side of the cube:
        c.GRID.PHI += c.GRID.PHI < 2 * Math.PI ? Math.PI : -Math.PI;
        c.OBJS.markProjectionDirty();
        c.OBJS.update();
        expect(polar1.opacity).toBeCloseTo(1);
        expect(poly2.opacity).toBeCloseTo(0.2);

        // "ar1[0]" reads a point's coordinate.
        const fgr1 = c.getObj("fgr1") as point_object;
        expect(fgr1.coords[0]).toBeCloseTo(2);
    });

    it("interprets script Expressions with variables, conditions and lists", async () => {
        const c = createConstruction();
        const unsupported = await importDgpFromUrl(c, "/tests/dgp/fourmi.dgp");
        expect(unsupported).toEqual([]);

        // E11 folds P7 down around the hinge [Symc1 P2] both ways, and Q
        // and R read its two points ("E11[0]", "E11[1]").
        const e11 = c.getObj("E11") as expression_object;
        expect(e11.value).toEqual([
            [1.5, -0.75, 0],
            [1.5, 0.75, 0],
        ]);
        expect((c.getObj("Q") as point_object).coords).toEqual([1.5, -0.75, 0]);
        // E1 holds a point's coordinates, which P6 ("E1+[0,1,0]") shifts.
        const p6 = c.getObj("P6") as point_object;
        expect(p6.coords).toEqual([1.5, 1, 0]);

        // "S13.setHidden(1-E18)": Déployer isn't at P5.
        const s13 = c.getObj("S13") as segment_object;
        expect(s13.hidden).toBe(1);
        // Its "dh:true" style dashes it all along.
        expect(s13.dash).toBe(true);

        // "if(theta()<0) {...Poly5.setOpacity(0.95);} else {...(0.2);}; \"program3\""
        const e4 = c.getObj("E4") as expression_object;
        const poly5 = c.getObj("Poly5")!;
        expect(e4.value).toBe("program3");
        expect(poly5.opacity).toBe(0.2);
        c.GRID.THETA = -0.3;
        c.invalidateProjection();
        c.OBJS.update();
        expect(poly5.opacity).toBe(0.95);
    });

    it("anchors ExpressionOn to its point and magnetizes points to a quadric", async () => {
        const c = createConstruction();
        const unsupported = await importDgpFromUrl(c, "/tests/dgp/pappus.dgp");
        expect(unsupported).toEqual([]);

        // "xA=ExpressionOn(...,P1,[20,-20])" is drawn 20px right of and
        // 20px above P1, and follows it.
        const xA = c.getObj("xA") as expression_object;
        const p1 = c.getObj("P1") as point_object;
        expect(xA.screen).toEqual([p1.sx + 20, p1.sy - 20]);
        const [clientX, clientY] = c.pt3D([-28, 10, 0]);
        p1.mousedrag(new PointerEvent("pointermove", { clientX, clientY }));
        c.OBJS.update();
        expect(xA.screen).toEqual([p1.sx + 20, p1.sy - 20]);

        // The lemma: [M, N, P] = Produit1 - Produit2.
        const mnp = c.getObj("MNP") as expression_object;
        const lemme = c.getObj("lemme") as expression_object;
        expect(mnp.value as number).toBeCloseTo(lemme.value as number, 9);

        // "mg:[Quad,20],[L11,20]": C1 dropped next to the conic lands on it.
        const quad = c.getObj("Quad") as quadric5pts_object;
        const c1 = c.getObj("C1") as point_object;
        const onQuad = quad.projectPoint([-3, -9, 0]);
        const [qx, qy] = c.pt3D(onQuad);
        c1.mousedrag(
            new PointerEvent("pointermove", { clientX: qx + 5, clientY: qy }),
        );
        c.OBJS.update();
        expect(quad.projectPoint(c1.coords)[0]).toBeCloseTo(c1.x, 9);
        expect(quad.projectPoint(c1.coords)[1]).toBeCloseTo(c1.y, 9);
    });

    it("calls function Expressions of z on complex numbers from scripts", async () => {
        const c = createConstruction();
        const unsupported = await importDgpFromUrl(c, "/tests/dgp/mandel.dgp");
        expect(unsupported).toEqual([]);

        // E1 is "z^2+c", E2 the sequence z(n+1)=E1(z(n)) from z0, and each
        // Pk its term "E2[k-1]".
        const e1 = c.getObj("E1") as expression_object;
        expect(e1.formula!.variables).toEqual(["z"]);
        const cPoint = c.getObj("c") as point_object;
        const [cx, cy] = cPoint.coords;
        const e2 = c.getObj("E2") as expression_object;
        const terms = e2.value as [number, number][];
        expect(terms).toHaveLength(4001);
        expect(terms[0]).toEqual([cx, cy]);
        expect(terms[1][0]).toBeCloseTo(cx * cx - cy * cy + cx);
        expect(terms[1][1]).toBeCloseTo(2 * cx * cy + cy);
        expect((c.getObj("P2") as point_object).coords).toEqual([
            ...terms[1],
            0,
        ]);

        // Outside the Mandelbrot set, the terms past the sequence's
        // overflow are undefined, not the ones before.
        cPoint.coords = [1, 1, 0];
        c.invalidateGeometry(cPoint);
        c.OBJS.update();
        const length = (e2.value as unknown[]).length;
        expect(length).toBeLessThan(20);
        expect((c.getObj("P3") as point_object).defined).toBe(true);
        expect((c.getObj("P100") as point_object).defined).toBe(false);
        // The last finite term is too far away for the SVG to parse its
        // position: it isn't drawn.
        const last = c.getObj(`P${length}`) as point_object;
        expect(Math.abs(last.sx)).toBeGreaterThan(1e38);
        expect((last.dom.dom() as SVGElement).style.display).toBe("none");
    });

    it("draws a DGPad List of the points an Expression computes", async () => {
        const c = createConstruction();
        const unsupported = await importDgpFromUrl(c, "/tests/dgp/lst2.dgp");
        expect(unsupported).toEqual([]);

        // E1 lists n points [0.2√i·cos(i·ang·π/180), 0.2√i·sin(...)],
        // joined by segments ("sg:1").
        const list = c.getObj("List1") as expression_list_object;
        expect(list.count).toBe(336);
        expect(list.segmentsSize).toBe(1);
        const k = (2 * 138.3 * Math.PI) / 180;
        const [x, y] = list.items[1][0] as Vec2;
        expect(x).toBeCloseTo(0.2 * Math.sqrt(2) * Math.cos(k), 12);
        expect(y).toBeCloseTo(0.2 * Math.sqrt(2) * Math.sin(k), 12);
        const [segments] = (list.dom.dom() as SVGElement).querySelectorAll(
            "path",
        );
        expect(segments.getAttribute("d")!.match(/L/g)).toHaveLength(335);

        const n = c.getObj("n") as expression_object;
        n.value = 400;
        c.invalidateGeometry(n);
        c.OBJS.update();
        expect(list.count).toBe(400);
    });

    it("draws a 3D surface computed from a two-variable function", async () => {
        const c = createConstruction();
        const unsupported = await importDgpFromUrl(
            c,
            "/tests/dgp/fonction3D.dgp",
        );
        expect(unsupported).toEqual([]);

        // f is "sin(xy)": DGPad reads "xy" as x*y. E1 draws every other
        // cell of a 27×25 grid over [-3,3]², each as a closed 5-point
        // polyline followed by a NaN break.
        const list = c.getObj("List1") as expression_list_object;
        expect(list.count).toBe(14 * 13 * 6);
        const [x, y, z] = list.items[1][0] as Vec3;
        expect([x, y]).toEqual([-3, -3 + 6 / 25]);
        expect(z).toBeCloseTo(Math.sin(x * y), 12);

        // Opaque ("o:0.25"), each cell is filled on its own path.
        const [fills] = (list.dom.dom() as SVGElement).querySelectorAll("g");
        const cells = [...fills.querySelectorAll("path")].filter((path) =>
            path.getAttribute("d"),
        );
        expect(cells).toHaveLength(14 * 13);
    });

    it("reads and returns angles in degrees in DGPad's degree mode", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/dgp/lst.dgp");
        // The same figure in degrees: its "·π/180" converts once more, as in
        // DGPad.
        const list = c.getObj("List1") as expression_list_object;
        const k = (2 * 138.3 * Math.PI) / 180;
        const [x, y] = list.items[1][0] as Vec2;
        expect(x).toBeCloseTo(
            0.2 * Math.sqrt(2) * Math.cos((k * Math.PI) / 180),
            12,
        );
        expect(y).toBeCloseTo(
            0.2 * Math.sqrt(2) * Math.sin((k * Math.PI) / 180),
            12,
        );

        // Degrees are DGPad's default.
        const deg = createConstruction();
        importDgp(
            deg,
            `A=Point("A",1,0);
B=Point("B",0,0);
F=FixedAngle("F",A,B,"30",true);
a=Expression("a","","","","acos(0.5)+arg(i)","0","0");`,
        );
        deg.OBJS.update();
        expect((deg.getObj("a") as expression_object).value).toBeCloseTo(
            150,
            12,
        );
        expect((deg.getObj("F") as fixed_angle_object).valueDegrees).toBe(30);

        const rad = createConstruction();
        importDgp(
            rad,
            `A=Point("A",1,0);
B=Point("B",0,0);
F=FixedAngle("F",A,B,"0.5",true);
SetGeneralStyle("degree:false");`,
        );
        expect(
            (rad.getObj("F") as fixed_angle_object).valueDegrees,
        ).toBeCloseTo((0.5 * 180) / Math.PI, 12);
    });

    it("keeps a 3D figure's saved turn around Oz, which the view can then follow freely", () => {
        const c = createConstruction();
        importDgp(c, `SetCoords(1449.0859375,14.28,40,true,100,100);`);
        // Beyond the half turn once enforced by default: as in DGPad, only
        // a figure's own restrictPhi bounds it.
        expect(c.GRID.PHI).toBeCloseTo(1449.0859375 * 0.015);
        c.mousedrag(null as unknown as PointerEvent, [1000, 0]);
        expect(c.GRID.PHI).toBeCloseTo((1449.0859375 + 1000) * 0.015);
        expect(c.GRID.THETA).toBeCloseTo(14.28 * 0.015);

        const restricted = createConstruction();
        importDgp(
            restricted,
            `SetCoords(1449.0859375,14.28,40,true,100,100);
E1=Expression("E1","","","","restrictPhi([0,PI]);\\"Restriction\\"","0","0");`,
        );
        expect(restricted.GRID.PHI).toBe(Math.PI);
        restricted.mousedrag(null as unknown as PointerEvent, [-1000, 0]);
        expect(restricted.GRID.PHI).toBe(0);
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
