import { afterEach, describe, expect, it } from "vitest";
import { construction } from "../../src/construction";
import { importDgp, importDgpFromUrl } from "../../src/dgp_importer";
import { importDgoFromBlob, writeDgo } from "../../src/dgo";
import { event_object } from "../../src/objects/event_object";
import { angle_bisector_object } from "../../src/objects/angle_bisector_object";
import { angle_object } from "../../src/objects/angle_object";
import { arc3pts_object } from "../../src/objects/arc3pts_object";
import type { button_object } from "../../src/objects/button_object";
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
import { createPoint, point_object } from "../../src/objects/point_object";
import { polygon_object } from "../../src/objects/polygon_object";
import type { primitive_line_object } from "../../src/objects/primitive_line_object";
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
import {
    vAdd,
    vCross,
    vDot,
    vNormalize,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../../src/vec";
import { expectClose, figure, frame } from "./figures";

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

    it("writes what follows a name's underscore or its final digits in subscript", () => {
        const c = createConstruction();
        importDgp(
            c,
            `A_5=Point("A_5",0,0);
B=Point("B_{12}'",1,0);
C12=Point("C12",2,0);
D=Point("D",3,0);
STL(A_5,"sn:true");
STL(B,"sn:true");
STL(C12,"sn:true");
STL(D,"sn:true");`,
        );
        const spans = (name: string) =>
            [
                ...(c.getObj(name) as point_object).nameText!.dom().childNodes,
            ].map((node) => node.textContent);

        expect(spans("A_5")).toEqual(["A", "5"]);
        expect(spans("B_{12}'")).toEqual(["B", "12", "'"]);
        expect(spans("C12")).toEqual(["C", "12"]);
        expect(spans("D")).toEqual(["D"]);
    });

    it("imports two points and their line from the public DGP file", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, figure("_Droite.dgp"));

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
        await importDgpFromUrl(c, figure("_Mediatrice.dgp"));

        expect(figureObjects(c)).toHaveLength(7);
        expect(c.getObj("P1")).toBeInstanceOf(point_object);
        expect(c.getObj("L1")).toBeInstanceOf(two_points_line_object);
    });

    it("imports the angle-bisector reference figure", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, figure("_Bissectrice.dgp"));

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

    it("draws a 3D ray from its origin, with a single tip", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, figure("_Bissectrice.dgp"));
        c.GRID.is2D = false;
        c.invalidateProjection();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const bisector = c.getObj("R3") as angle_bisector_object;
        expect(bisector.sP1).toEqual(bisector.P1.screen);
        expect(bisector.tipPath1.getAtt("d")).toBe("");
        expect(bisector.tipPath2.getAtt("d")).toMatch(/^M/);
    });

    it("dashes every kind of stroke with DGPad's pattern, 3D line tips included", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, figure("pointilles.dgp"));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        ["C1", "C2", "Poly1", "L1", "S1", "Quad"].forEach((name) => {
            const strokes = [
                ...c.getObj(name)!.dom.dom().querySelectorAll("path, circle"),
            ].map((shape) => (shape as SVGElement).style.strokeDasharray);
            expect(strokes, name).toContain("6, 10");
        });
        // In 2D, a line runs to the canvas edge, without tips.
        const line = c.getObj("L1") as primitive_line_object;
        [line.tipPath1, line.tipPath2].forEach((tip) =>
            expect(tip.getAtt("d") ?? "").toBe(""),
        );
        c.GRID.is2D = false;
        c.invalidateProjection();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        // A 100 px tip holds 6 or 7 dashes of the 16 px pattern.
        [line.tipPath1, line.tipPath2].forEach((tip) =>
            expect(tip.getAtt("d")!.match(/M/g)!.length).toBeGreaterThan(5),
        );
    });

    it("paints a higher DGPad layer over the lower ones, points included", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, figure("layers.dgp"));
        const [c1, c2, p1] = ["C1", "C2", "P1"].map((name) =>
            c.getObj(name)!.dom.dom(),
        );
        expect(c.getObj("C1")!.level).toBe(1);
        [c2, p1].forEach((below) =>
            expect(
                below.compareDocumentPosition(c1) &
                    Node.DOCUMENT_POSITION_FOLLOWING,
            ).toBeTruthy(),
        );
    });

    it("draws a right angle as DGPad's open square, without its value", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, figure("marque_angle.dgp"));
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
        await importDgpFromUrl(c, figure("_FixedAngle.dgp"));

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

    it("turns a 3D figure's 2D fixed angle in the screen plane", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, figure("PSHPentaOrthoEtoile_R.dgp"));

        const fixedAngle = c.getObj("A1") as fixed_angle_object;
        const [right, up] = c.screenPlaneBasis;
        expect(vDot(fixedAngle.VEC, vCross(right, up))).toBeCloseTo(0, 9);
        expect(c.getObj("sk1")!.defined).toBe(true);
        expect(
            figureObjects(c).filter(
                (object) => !object.hidden && !object.defined,
            ),
        ).toEqual([]);
    });

    it("imports and updates a point locus without moving its driver", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, figure("_Locus.dgp"));

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
        await importDgpFromUrl(c, figure("_Locus2.dgp"));

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
        await importDgpFromUrl(c, figure("_PtOn5.dgp"));

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
        expect(await importDgpFromUrl(c, figure("_AireParallelo.dgp"))).toEqual(
            [],
        );
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
        await importDgpFromUrl(c, figure("poly_mesure.dgp"));
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
        await importDgpFromUrl(c, figure("_PtOn2.dgp"));

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
        await importDgpFromUrl(c, figure("_PtOn3.dgp"));

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
        await importDgpFromUrl(c, figure("_Apollonius.dgp"));

        expect(figureObjects(c)).toHaveLength(2569);
        expect(c.getObj("P1")).toBeInstanceOf(point_object);
        expect(c.getObj("P14")).toBeInstanceOf(point_object);
        expect(c.getObj("Center32")).toBeInstanceOf(point_object);
    });

    it("draws DGPad's plane coordinate system for a figure without 3D objects", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, figure("_onlyAxis.dgp"));
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
        await importDgpFromUrl(c, figure("_Cube.dgp"));

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
        const unsupported = await importDgpFromUrl(c, figure("_tetraOld.dgp"));

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
        await importDgpFromUrl(c, figure("_Expression.dgp"));

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
        expect(e3.cursorColor).toBe("#780013");

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
        await importDgpFromUrl(c, figure("graph.dgp"));

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
                evaluateFunction(f1.formula, [x], () => NO_VIEW),
            );
            const viaExpression = realPart(
                evaluateFunction(e1.formula!, [x], () => NO_VIEW),
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
        await importDgpFromUrl(c, figure("_floor.dgp"));
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

    it("magnetizes a free point onto a point before the circles through it", () => {
        const c = createConstruction();
        importDgp(
            c,
            `A=Point("A",0,0);
B=Point("B",2,0);
C1=Circle("C1",A,B);
C2=Circle("C2",B,A);
I=OrderedIntersection("I",C1,C2,0);
M=Point("M",5,5);
STL(M,"mg:[C1,20],[C2,20],[I,20]");`,
        );
        c.OBJS.update();
        const m = c.getObj("M") as point_object;
        const i = c.getObj("I") as point_object;

        const [x, y] = c.pt3D(i.coords);
        m.mousedrag(
            new PointerEvent("pointermove", { clientX: x + 3, clientY: y + 4 }),
        );
        c.OBJS.update();

        expect(m.coords[0]).toBeCloseTo(i.coords[0], 9);
        expect(m.coords[1]).toBeCloseTo(i.coords[1], 9);
    });

    it("magnetizes a point held by a line onto a point of it, however far the pointer", () => {
        const c = createConstruction();
        importDgp(
            c,
            `A=Point("A",0,0);
B=Point("B",4,0);
a=Line("a",A,B);
M=Point("M",2,3);
STL(M,"mg:[A,20],[B,20],[a,5000]");`,
        );
        c.OBJS.update();
        const m = c.getObj("M") as point_object;

        const [x, y] = c.pt3D([0, 0, 0]);
        m.mousedrag(
            new PointerEvent("pointermove", {
                clientX: x + 5,
                clientY: y - 150,
            }),
        );
        c.OBJS.update();

        expect(m.coords[0]).toBe(0);
        expect(m.coords[1]).toBe(0);
    });

    it("snaps a point on an object onto its magnets, from where it lands on its support", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, figure("aimantation.dgp"));
        c.OBJS.update();
        const [p, m, a, b] = ["P", "m", "A", "B"].map(
            (name) => c.getObj(name) as point_object,
        );
        const { left, top } = c.svg.dom().getBoundingClientRect();
        const dragTo = (x: number, y: number): void => {
            p.mousedrag(
                new PointerEvent("pointermove", {
                    clientX: left + x,
                    clientY: top + y,
                }),
            );
            c.OBJS.update();
        };

        dragTo(m.sx + 10, m.sy);
        expect(p.coords[0]).toBeCloseTo(m.coords[0], 9);
        expect(p.coords[1]).toBeCloseTo(m.coords[1], 9);

        // Far from the magnet as the pointer is, the point on the segment
        // stands right by it.
        dragTo(m.sx + 10, m.sy - 200);
        expect(p.coords[0]).toBeCloseTo(m.coords[0], 9);

        dragTo(m.sx + 40, m.sy);
        expect(p.sx).toBeCloseTo(m.sx + 40, 0);

        // A magnet off the support holds the point at its projection.
        const off = createPoint(c, "off", [0, 3, 0]);
        p.magnets = [{ target: off, radius: 200 }];
        const below = c.pt3D([0, 0, 0]);
        dragTo(below[0], below[1]);
        const direction = vSub(b.coords, a.coords);
        const alpha =
            vDot(vSub(off.coords, a.coords), direction) /
            vDot(direction, direction);
        expect((p as point_on_object).alpha).toBeCloseTo(alpha, 9);
    });

    it("keeps a magnetized point glued to whichever segment it grabbed, only switching on a fresh grab", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, figure("trace.dgp"));
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

    it("traces point movement without joining magnet switches, attached to space", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, figure("trace.dgp"));
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

        const traced = [
            pointAt(s1, 0.35),
            pointAt(s1, 0.45),
            pointAt(s1, 0.55),
            pointAt(s2, 0.4),
            pointAt(s2, 0.5),
        ];
        c.GRID.PHI += 0.1;
        c.invalidateProjection();
        c.OBJS.update();
        const afterProjection = path.getAtt("d")!;
        expect(afterProjection).not.toBe(beforeProjection);
        expect(afterProjection.match(/M/g)).toHaveLength(2);
        expect(afterProjection.match(/L/g)).toHaveLength(3);
        const screens = afterProjection.match(/-?[\d.e-]+ -?[\d.e-]+/g)!;
        expect(screens).toHaveLength(traced.length);
        screens.forEach((xy, i) =>
            xy
                .split(" ")
                .forEach((v, k) =>
                    expect(+v).toBeCloseTo(c.pt3D(traced[i])[k], 6),
                ),
        );

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

    it("erases the traces on a pan or a zoom, as DGPad", () => {
        const c = createConstruction();
        importDgp(c, `M=Point("M",0,1);\nSTL(M,"tk:true");`);
        c.OBJS.update();
        const m = c.getObj("M") as point_object;
        const drag = (x: number): void => {
            const [clientX, clientY] = c.pt3D([x, 1, 0]);
            m.mousedrag(new PointerEvent("pointermove", { clientX, clientY }));
            c.OBJS.update();
        };

        drag(1);
        c.pan(new PointerEvent("pointermove"), [10, 5]);
        c.OBJS.update();
        expect(m.tracePath!.getAtt("d")).toBe("");

        drag(2);
        expect(m.tracePath!.getAtt("d")!.match(/L/g)).toHaveLength(1);
        c.mousewheel(new WheelEvent("wheel", { deltaY: 100 }));
        c.OBJS.update();
        expect(m.tracePath!.getAtt("d")).toBe("");
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
        await importDgpFromUrl(c, figure("_Apollonius.dgp"));

        // 3 free points + 3 initial circles + 32 Circle3pts.
        const objects = figureObjects(c);
        expect(objects.filter((object) => object.hasView)).toHaveLength(38);
        const hidden = objects.find((object) => !object.hasView)!;
        expect(hidden.isHidden).toBe(true);
        expect(hidden.dom).toBeUndefined();
    });

    it("imports Point/Circle1 formulas from ptExp.dgp", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, figure("ptExp.dgp"));

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

    it("imports a point computed by a script, and the scripts reading it", async () => {
        const c = createConstruction();
        expect(
            await importDgpFromUrl(c, figure("F26_m_kCtr_7oct Gene Video.dgp")),
        ).toEqual([]);
        const [ph, qb, pho] = ["Ph", "Qb", "Pho"].map(
            (name) => (c.getObj(name) as point_object).coords,
        );
        const [ux, uy] = [qb[1] - ph[1], ph[0] - qb[0]];
        const lambda =
            (-2 * (ph[0] * ux + 4 * ph[1] * uy)) / (ux * ux + 4 * uy * uy);
        expectClose(pho, [ph[0] + lambda * ux, ph[1] + lambda * uy, 0]);
        expect(
            (c.getObj("E5claudePlanAuto") as expression_object).value,
        ).toHaveLength(4);
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

    it("imports a script styling an object missing from the figure", () => {
        const c = createConstruction();
        expect(
            importDgp(
                c,
                `A=Point("A",0,0);
E1=Expression("E1","","","","A.setRGBColor(0,127,255);Z.setRGBColor(1,2,3);\\"ok\\"","0","0");`,
            ),
        ).toEqual([]);
        expect(c.getObj("A")?.stroke_color).toBe("rgb(0,127,255)");
        expect((c.getObj("E1") as expression_object).value).toBe("ok");
    });

    it("redraws a List a script colors as its value changes", async () => {
        const c = createConstruction();
        importDgp(
            c,
            `k=Expression("k","","","","1","0","0");
E1=Expression("E1","","","","[[0,0],[1,1]]","0","0");
L1=List("L1",E1);
E2=Expression("E2","","","","if(k==1){L1.setRGBColor(255,0,0)} else {L1.setRGBColor(0,0,255)};1","0","0");
STL(L1,"c:#000000;s:0;sg:1");`,
        );
        await frame();
        const stroke = () =>
            c
                .getObj("L1")!
                .dom.dom()
                .querySelector<SVGPathElement>("path[style*='stroke: rgb']")
                ?.style.stroke;
        expect(stroke()).toBe("rgb(255, 0, 0)");
        const k = c.getObj("k") as expression_object;
        k.value = 2;
        c.invalidateGeometry(k);
        await frame();
        expect(stroke()).toBe("rgb(0, 0, 255)");
    });

    it("imports an Arc3pts figure and its center", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, figure("arc.dgp"));

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
        await importDgpFromUrl(c, figure("chemin_cube.dgp"));
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
            figure("_patronsCube.dgp"),
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

    it("draws Blockly turtles, styles with Blockly and runs a button's program", async () => {
        const c = createConstruction();
        const unsupported = await importDgpFromUrl(
            c,
            figure("Pythagore_en_liquide.dgp"),
        );
        // Its other button changes DGPad's interface.
        expect(unsupported).toHaveLength(1);
        expect(unsupported[0]).toMatch(/^BlocklyButton\("blk_btn",/);
        const texts = () =>
            [...c.svg.dom().querySelectorAll("text")].map(
                (text) => text.textContent,
            );
        expect(texts()).toEqual(
            expect.arrayContaining(["temps = 0 s", "a", "b", "c"]),
        );
        // "cacher", styling polygons the file declares after it.
        const t = c.getObj("t") as expression_object;
        const poly6 = c.getObj("Poly6")!;
        expect(poly6.hidden).toBe(1);
        t.value = 2.5;
        c.invalidateGeometry(t);
        c.OBJS.update();
        expect(poly6.hidden).toBe(0);
        expect(texts()).toContain("temps = 2,5 s");
        (c.getObj("blk_btn0") as button_object).run();
        c.OBJS.update();
        expect(t.value).toBe(0);
        expect(poly6.hidden).toBe(1);
    });

    it("draws a turtle that shifts and joins its lists", async () => {
        const c = createConstruction();
        const unsupported = await importDgpFromUrl(
            c,
            figure("decomposition_facteurs_premiers.dgp"),
        );
        // Its field's onclick, which selects its text, is dropped.
        expect(unsupported).toEqual([]);
        const tex = () =>
            [...c.svg.dom().querySelectorAll("[data-tex]")].map((tex) =>
                tex.getAttribute("data-tex"),
            );
        expect(tex()).toEqual([
            "$$294=2\\times3\\times7\\times7$$",
            "$$294=2\\times3\\times7^{2}$$",
        ]);
        const field = c.svg.dom().querySelector("input")!;
        field.value = "360";
        field.dispatchEvent(new Event("input"));
        c.OBJS.update();
        expect(tex()).toEqual([
            "$$360=2\\times2\\times2\\times3\\times3\\times5$$",
            "$$360=2^{3}\\times3^{2}\\times5$$",
        ]);
    });

    it("draws a turtle's long division, splitting and reversing texts", async () => {
        const c = createConstruction();
        expect(
            await importDgpFromUrl(c, figure("division_posee_new.dgp")),
        ).toEqual([]);
        const digits = [...c.svg.dom().querySelectorAll("text")]
            .map((text) => text.textContent)
            .join("");
        expect(digits).toBe("78962278-90-9678-182156-262234-287810123");
    });

    it("draws at each frame of an animated NaN, adding to a global's list", async () => {
        const c = createConstruction();
        expect(await importDgpFromUrl(c, figure("urne_et_boules.dgp"))).toEqual(
            [],
        );
        const a = c.getObj("a") as expression_object;
        const global = (name: string) =>
            (c.getObj(name) as expression_object).value;
        (c.getObj("blk_btn0") as button_object).run();
        c.flush();
        for (let i = 0; i < 4; i++) {
            a.animate(0.1);
            c.gesture(a, "drag");
            c.flush();
        }
        expect(a.isCursor).toBe(false);
        expect(global("TIRAGES")).toBe(5);
        const results = global("RESULTATS") as number[];
        expect(results[0] + results[1] + results[2]).toBe(5);
    });

    it("runs a button's oninit program as DGPad opens the figure", async () => {
        const c = createConstruction();
        expect(await importDgpFromUrl(c, figure("urne_et_boules.dgp"))).toEqual(
            [],
        );
        c.flush();
        const global = (name: string) =>
            (c.getObj(name) as expression_object).value;
        expect((c.getObj("blk_btn") as button_object).program).not.toBeNull();
        expect(global("RESULTATS")).toEqual([0, 0, 0]);
        expect(global("TIRAGES")).toBe(0);
        expect(global("DERNIER")).toBe(-1);
        // Kept, it runs again only as the figure opens again.
        const init = c.getObj("blk_btn.oninit") as event_object;
        expect([init.gesture, init.owner.name]).toEqual(["init", "blk_btn"]);
        const tirages = c.getObj("TIRAGES") as expression_object;
        tirages.value = 7;
        c.invalidateGeometry(tirages);
        c.flush();
        expect(global("TIRAGES")).toBe(7);
        const saved = await writeDgo(c);
        const d = createConstruction();
        expect(await importDgoFromBlob(d, saved)).toEqual([]);
        d.flush();
        expect((d.getObj("TIRAGES") as expression_object).value).toBe(0);
        expect(
            d.OBJS.V.filter(
                (object) =>
                    object instanceof event_object && object.gesture === "init",
            ),
        ).toHaveLength(1);
    });

    it("draws a turtle setting the increment of a point declared after it", async () => {
        const c = createConstruction();
        const unsupported = await importDgpFromUrl(
            c,
            figure("partage_dgpad.dgp"),
        );
        expect(unsupported).toEqual([]);
        const texts = () =>
            [...c.svg.dom().querySelectorAll("text")].map(
                (text) => text.textContent,
            );
        expect(texts()).toEqual(
            expect.arrayContaining(["0", "1", "2", "3", "4", "5", "6"]),
        );
        const m = c.getObj("M") as point_object;
        expect(m.increment).toEqual([0.5, 0.5]);
        const n = c.getObj("n") as expression_object;
        n.value = 5;
        c.invalidateGeometry(n);
        c.OBJS.update();
        expect(m.increment).toEqual([0.2, 0.2]);
    });

    it("reads an object named as two function variables, and turtles writing TeX", async () => {
        const c = createConstruction();
        const unsupported = await importDgpFromUrl(
            c,
            figure("Remplissage_P237_SurfaceKlein.dgp"),
        );
        expect(unsupported).toEqual([]);
        // "xx" is a point, not x*x.
        expect(c.getObj("oAB42")!.defined).toBe(true);
        // As in DGPad, it can't be called: "xx(bDP1)".
        expect(c.getObj("oAB39")!.defined).toBe(false);
        expect(
            c
                .getObj("blk_turtle_list_a")!
                .dom.dom()
                .querySelector("foreignObject")
                ?.getAttribute("data-tex"),
        ).toBe("$$a$$");
    });

    it("drops the restrictions Expression, which only locks DGPad's interface", async () => {
        const c = createConstruction();
        const unsupported = await importDgpFromUrl(
            c,
            figure("PSE_Medatrices_FPetMF_R.dgp"),
        );
        expect(unsupported).toEqual([]);
        expect(c.getObj("restrictions")).toBeUndefined();
    });

    it("interprets script Expressions with variables, conditions and lists", async () => {
        const c = createConstruction();
        const unsupported = await importDgpFromUrl(c, figure("fourmi.dgp"));
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
        expect(s13.dash).toEqual([6, 10]);

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
        const unsupported = await importDgpFromUrl(c, figure("pappus.dgp"));
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
        const unsupported = await importDgpFromUrl(c, figure("mandel.dgp"));
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
        const unsupported = await importDgpFromUrl(c, figure("lst2.dgp"));
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
        const unsupported = await importDgpFromUrl(c, figure("fonction3D.dgp"));
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

        // Hidden then shown again (by a setHidden), its view is rebuilt
        // with all its fills.
        list.hidden = 1;
        list.updateView();
        list.hidden = 0;
        list.updateView();
        const [refills] = (list.dom.dom() as SVGElement).querySelectorAll("g");
        expect(refills.querySelectorAll("path[d]")).toHaveLength(14 * 13);
    });

    it("reads and returns angles in degrees in DGPad's degree mode", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, figure("lst.dgp"));
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

    it("centers a 3D figure's world origin on the live viewport until a point gives it", () => {
        const c = createConstruction();
        importDgp(
            c,
            `SetCoords(9999,-9999,40,true,100,100);
E1=Expression("E1","","","","5","-1","0");`,
        );

        // In 3D, SetCoords' first two numbers are the camera's angles too:
        // only the figure's origin point places the origin (see Point).
        expect(c.GRID.ORG).toEqual([c.width / 2, c.height / 2]);

        // An Expression's screen label isn't projected geometry: it still
        // anchors to the literal saved origin (see Expression's execute).
        const e1 = c.getObj("E1") as expression_object;
        expect(e1.screen).toEqual([9999 - 40, -9999]);
    });

    it("hides an edge lying on a coplanar face without flickering", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, figure("chemin_cube.dgp"));
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

    it("keeps a 3D figure's 2D objects in the screen plane", async () => {
        const c = createConstruction();
        const unsupported = await importDgpFromUrl(c, figure("PSE_01.dgp"));
        expect(unsupported).toEqual([]);
        const value = (name: string) => c.getObj(name)!.scriptValue(true);
        const point = (name: string) => c.getObj(name) as point_object;
        // DGPad's values: xp reads a 2D construction, CdA a point of a
        // Circle3pts3D given by its sample number and IF(test, a, b).
        expectClose(value("xp"), 0.2819985762916974);
        expectClose(
            value("A"),
            [0.2724236281904336, 0.2782780653766438, -1.055942099615054],
        );
        expectClose(value("CdA"), [-1.1268613733569643, 0.7960286312577038]);
        expectClose(value("Odl"), [-0.11885185479773162, -1.0376681168878876]);
        expectClose(value("Akb"), [-0.9084729213395822, -1.2179599901955096]);
        expectClose(value("longM"), 7.346482612705435);
        expectClose(
            value("M"),
            [0.2375691479653453, 0.4272213190358623, -1.2188239945144224],
        );
        // Turning the view moves the 3D objects, not the 2D ones.
        const screens = () =>
            ["Odl", "Akb", "Mkb", "p", "A"].map((name) => [
                ...point(name).screen,
            ]);
        // As in DGPad, the origin is where it was in the window, the 2D
        // objects and the Expressions keeping their place around it.
        expectClose(c.GRID.ORG, [
            771 - 2.5187450766750046 * 218.75973281399922,
            20 + 0.11885185479773162 * 218.75973281399922,
        ]);
        const before = screens();
        c.GRID.PHI += 0.4;
        c.GRID.THETA -= 0.2;
        c.invalidateProjection();
        c.OBJS.update();
        const after = screens();
        before
            .slice(0, 4)
            .forEach((screen, index) => expectClose(after[index], screen));
        expect(after[4]).not.toEqual(before[4]);
        expectClose(value("longM"), 7.346482612705435);
        const origin = c.GRID.ORG;
        c.resize(0, c.width + 200, c.height + 100);
        expect(c.GRID.ORG).toBe(origin);
    });

    it("draws a 3D figure's Circle1 around a 3D point as a circle of the screen", async () => {
        const c = createConstruction();
        const unsupported = await importDgpFromUrl(
            c,
            figure("Horisphere_ortho_checkbox.dgp"),
        );
        expect(unsupported).toEqual([]);
        // "Circle1(Z,1)", Z=[0,0,1]: the outline of the sphere.
        const circle = c.getObj("C10") as circle1_object;
        const expectScreenCircle = () => {
            c.invalidateProjection();
            c.OBJS.update();
            const center = c.pt3D(circle.CENTER);
            [circle.U, circle.V].forEach((axis) => {
                const end = c.pt3D(vAdd(circle.CENTER, vScale(axis, circle.R)));
                expect(
                    Math.hypot(end[0] - center[0], end[1] - center[1]),
                ).toBeCloseTo(c.GRID.UNIT[0], 6);
            });
        };
        expectScreenCircle();
        c.GRID.PHI += 0.4;
        c.GRID.THETA -= 0.2;
        expectScreenCircle();
    });

    it("measures elliptic segments with the modulus of a complex number", async () => {
        const c = createConstruction();
        const unsupported = await importDgpFromUrl(
            c,
            figure("Octogone_Etoile_8_3.dgp"),
        );
        expect(unsupported).toEqual([]);
        const value = (name: string) => c.getObj(name)!.scriptValue(true);
        // "2*atan(mod(Hz*(B-E)/(Hz*Hz+conj(B)*E)))", in degrees.
        expectClose(value("LongAB2"), 103.34850242594905);
        expectClose(value("LongAB3"), 76.65149757405085);
        // Beyond 90°, "GereSeg2" draws the segment's other part.
        expect(c.getObj("partAB2")!.isVisible).toBe(false);
        expect(c.getObj("partAbdA2")!.isVisible).toBe(true);
        expect(c.getObj("partAB3")!.isVisible).toBe(true);
    });

    it("builds a 3D figure's 2D conics and perpendiculars in the screen plane", async () => {
        const c = createConstruction();
        const unsupported = await importDgpFromUrl(
            c,
            figure("TangenteCommune2cercles_CheckBox.dgp"),
        );
        expect(unsupported).toEqual([]);
        const expectValue = (name: string, expected: number[]) =>
            (c.getObj(name)!.scriptValue(true) as number[]).forEach(
                (value, index) => expect(value).toBeCloseTo(expected[index], 5),
            );
        // DGPad's values: Jdl on a perpendicular turned counterclockwise,
        // uI from "O.coords2D()", P66 "Quad0.center()", the 4 intersections
        // of two conics through 2D points, and CdV what they lead to.
        expectValue("Jdl", [-0.36602582630634123, 0.25427378133851236]);
        expectValue("uI", [-0.6340438674390235, -1.7255503240156087]);
        expectValue("P66", [0.6779684491511926, -1.5915645916597723]);
        expectValue("P9", [0.5548263356239604, -1.5731176240995592]);
        expectValue("P10", [0.5482110317315386, -1.7379479823050736]);
        expectValue("P21", [0.7834671768249815, -1.4075813047724681]);
        expectValue("P22", [0.818270569739109, -1.5011261100418571]);
        expectValue("CdV", [1.7426140240148458, -1.2375541780553754]);
    });

    it("shows or hides point names from a script", async () => {
        const c = createConstruction();
        const unsupported = await importDgpFromUrl(
            c,
            figure("PH_Cercles_Exinscrits1.dgp"),
        );
        expect(unsupported).toEqual([]);
        // "Akb.setShowName(ChNom==0)", ChNom a checkbox.
        const name = c.getObj("Akb") as point_object;
        expect(name.showName).toBe(false);
        expect(name.nameText).toBeUndefined();
        const checkbox = c.getObj("ChNom") as expression_object;
        checkbox.value = 0;
        c.OBJS.markGeometryDirty(checkbox);
        c.OBJS.update();
        expect(name.showName).toBe(true);
        expect(name.nameText).toBeDefined();
    });

    it("solves with a script that breaks out of loops and tests lists against null", async () => {
        const c = createConstruction();
        expect(
            await importDgpFromUrl(
                c,
                figure("KH_Malfatti_horicycles_depuis_triangle.dgp"),
            ),
        ).toEqual([]);
        // The values JavaScript gives the script.
        const centre = c.getObj("Ocu") as point_object;
        expectClose(centre.coords, [5.986804199072189, 5.513117926386146, 0]);
        const region = c.getObj("Reg") as expression_object;
        region.value = 0;
        c.OBJS.markGeometryDirty(region);
        c.OBJS.update();
        expectClose(centre.coords, [0.7035489294338203, 2.427248876080155, 0]);
    });

    it("dashes coincident segments in phase whatever their direction", () => {
        expect(intervalsToPath([10, 5], [0, 5], [[0, 0.5]])).toBe(
            intervalsToPath([0, 5], [10, 5], [[0.5, 1]]),
        );
    });
});
