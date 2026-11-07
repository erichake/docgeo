import { afterEach, describe, expect, it } from "vitest";
import { construction } from "../../src/construction";
import { describeDgo, readDgo } from "../../src/dgo";
import { importGgb, importGgbFromBlob } from "../../src/ggb_importer";
import { readZipEntry } from "../../src/import/ggb_zip";
import { angle_object } from "../../src/objects/angle_object";
import { arc3pts_object } from "../../src/objects/arc3pts_object";
import { circle3pts_object } from "../../src/objects/circle3pts_object";
import { center_arc_object } from "../../src/objects/center_arc_object";
import { semicircle_object } from "../../src/objects/semicircle_object";
import type { primitive_arc_object } from "../../src/objects/primitive_arc_object";
import { circle1_object } from "../../src/objects/circle1_object";
import { curve_object } from "../../src/objects/curve_object";
import { cylinder_intersection_object } from "../../src/objects/cylinder_intersection_object";
import { cylinder_section_object } from "../../src/objects/cylinder_section_object";
import { equation_circle_object } from "../../src/objects/equation_circle_object";
import { equation_conic_object } from "../../src/objects/equation_conic_object";
import { equation_line_object } from "../../src/objects/equation_line_object";
import { expression_object } from "../../src/objects/expression_object";
import { focal_conic_object } from "../../src/objects/focal_conic_object";
import { image_object } from "../../src/objects/image_object";
import { fixed_point_object } from "../../src/objects/fixed_point_object";
import { isOccluded } from "../../src/objects/hidden_line";
import { iteration_object } from "../../src/objects/iteration_object";
import { list_object } from "../../src/objects/list_object";
import { locus_object } from "../../src/objects/locus_object";
import { parabola_object } from "../../src/objects/parabola_object";
import { point_on_object } from "../../src/objects/point_on_object";
import { point_object } from "../../src/objects/point_object";
import { polygon_object } from "../../src/objects/polygon_object";
import { quadric5pts_object } from "../../src/objects/quadric5pts_object";
import { rotation_object } from "../../src/objects/rotation_object";
import { segment_object } from "../../src/objects/segment_object";
import { translation_object } from "../../src/objects/translation_object";
import { tangent_object } from "../../src/objects/tangent_object";
import { plane_object } from "../../src/objects/plane_object";
import { plane_line_object } from "../../src/objects/plane_line_object";
import { sphere_section_object } from "../../src/objects/sphere_section_object";
import { normal_line_object } from "../../src/objects/normal_line_object";
import { plane_intersection_object } from "../../src/objects/plane_intersection_object";
import { plane_section_object } from "../../src/objects/plane_section_object";
import { revolution_object } from "../../src/objects/revolution_object";
import { disk_object } from "../../src/objects/disk_object";
import { cube_vertex_object } from "../../src/objects/cube_vertex_object";
import { net_vertex_object } from "../../src/objects/net_vertex_object";
import { inversion_object } from "../../src/objects/inversion_object";
import { regular_polygon_object } from "../../src/objects/regular_polygon_object";
import { vertex_object } from "../../src/objects/vertex_object";
import { dilation_object } from "../../src/objects/dilation_object";
import { sphere_object } from "../../src/objects/sphere_object";
import { text_object } from "../../src/objects/text_object";
import { two_points_line_object } from "../../src/objects/two_points_line_object";
import { vector_object } from "../../src/objects/vector_object";
import { preferences } from "../../src/preferences";
import type { primitive_line_object } from "../../src/objects/primitive_line_object";
import type { primitive_circle_object } from "../../src/objects/primitive_circle_object";
import type { primitive_quadric_object } from "../../src/objects/primitive_quadric_object";
import {
    vAdd,
    vCross,
    vDot,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../../src/vec";
import { expectClose, figure } from "./figures";

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

async function loadXml(name: string): Promise<string> {
    const response = await fetch(figure(`${name}.ggb`));
    return readZipEntry(await response.arrayBuffer(), "geogebra.xml");
}

// Every point GeoGebra saved must land at the same place once rebuilt.
function expectSavedPoints(c: construction, xml: string): void {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    document
        .querySelectorAll(
            'construction > element[type="point"], construction > element[type="point3d"]',
        )
        .forEach((element) => {
            const coords = element.querySelector("coords")!;
            const [x, y, z, w] = ["x", "y", "z", "w"].map((name) =>
                Number(coords.getAttribute(name)),
            );
            const expected = coords.hasAttribute("w")
                ? [x / w, y / w, z / w]
                : [x / z, y / z, 0];
            const point = c.getObj(element.getAttribute("label")!);
            expect(point, element.getAttribute("label")!).toBeInstanceOf(
                point_object,
            );
            expect(point!.defined, element.getAttribute("label")!).toBe(true);
            (point as point_object).coords.forEach((value, index) =>
                expect(value).toBeCloseTo(expected[index], 9),
            );
        });
}

describe("GGB importer", () => {
    it("imports the point_droite figure", async () => {
        const c = createConstruction();
        const xml = await loadXml("point_droite");

        expect(importGgb(c, xml)).toEqual([]);
        expectSavedPoints(c, xml);
        const line = c.getObj("f") as two_points_line_object;
        expect(line).toBeInstanceOf(two_points_line_object);
        expect(line.parents).toEqual([c.getObj("A"), c.getObj("B")]);
        expect(line.stroke_color).toBe("#000000");
        expect(line.size).toBe(2.5);
        expect(line.showName).toBe(true);
        expect(c.getObj("A")!.stroke_color).toBe("#4d4dff");
        expect(c.getObj("A")!.size).toBe(5);
        expect(c.GRID.ORG).toEqual([513, 369]);
        expect(c.GRID.UNIT).toEqual([50, 50, 50]);
    });

    it.each([
        "constructions",
        "circles",
        "intersections",
        "pointon",
        "transform",
        "sliders",
        "cube",
        "fonction_inter",
        "fonction_inter_cercle",
        "fonction_inter_conique",
        "polyreg",
        "polyform",
        "circular",
        "allconics",
        "3d_pyramide",
        "3d_prisme",
        "3d_plan",
        "3d_inter_plans",
        "_patronsCube",
    ])("rebuilds every saved point of %s", async (name) => {
        const c = createConstruction();
        const xml = await loadXml(name);

        expect(importGgb(c, xml)).toEqual([]);
        expectSavedPoints(c, xml);
    });

    it("traces GeoGebra's envelope of a line", async () => {
        const c = createConstruction();

        expect(importGgb(c, await loadXml("enveloppe"))).toEqual([]);
        const envelope = c.getObj("e") as locus_object;
        expect(envelope).toBeInstanceOf(locus_object);
        expect(envelope.target).toBe(c.getObj("d"));
        // The equation GeoGebra saved for it: 8x² - 8x + 9y² = 16.
        const points = envelope.points.filter((point) => point !== null);
        expect(points.length).toBeGreaterThan(900);
        points.forEach(([x, y]) =>
            expect(Math.abs(8 * x * x - 8 * x + 9 * y * y - 16)).toBeLessThan(
                1e-3,
            ),
        );
    });

    it("imports _3carres, labels placed below their points included", async () => {
        const c = createConstruction();
        const xml = await loadXml("_3carres");

        expect(importGgb(c, xml)).toEqual([]);
        expectSavedPoints(c, xml);
        expect((c.getObj("A") as point_object).namePosition).toBeCloseTo(
            2 * Math.PI - 2.118358562734894,
            9,
        );
    });

    it("writes the squares' areas at their anchors, following their sides", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("_3carres"));
        const texts = [1, 2, 3, 4].map(
            (index) => c.getObj(`Textepoly${index}`) as text_object,
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(texts.map((text) => text.content)).toEqual(
            [4, 9, 16, 29].map((area) => ` ${area} cm²`),
        );
        const anchor = (c.getObj("Pointpoly4") as point_object).screen;
        expect(texts[3].textElement.getAtt("y")).toBe(`${anchor[1] + 27}`);
        expect(texts[3].textElement.dom().textContent).toBe(" 29 cm²");

        const b = c.getObj("B") as point_object;
        b.coords = [-0.5, -8, 0];
        c.invalidateGeometry(b);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(texts.map((text) => text.content)).toEqual(
            [6.25, 9, 16, 31.25].map((area) => ` ${area} cm²`),
        );
    });

    it("codes segments with GeoGebra's ticks, across their midpoints", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("_3carres"));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        ["f", "j", "n"].forEach((name, index) => {
            const segment = c.getObj(name) as segment_object;
            const ticks = [
                ...segment
                    .decorationPath!.getAtt("d")!
                    .matchAll(/M(\S+) (\S+) L(\S+) (\S+)/g),
            ].map((match) => match.slice(1).map(Number));
            expect(ticks.length).toBe(index + 1);
            const along = vNormalize(
                vSub(segment.P2.screen, segment.P1.screen),
            )!;
            const mid = vScale(
                vAdd(segment.P1.screen, segment.P2.screen),
                1 / 2,
            );
            const spacing = 2.5 + segment.size;
            ticks.forEach(([x1, y1, x2, y2], tick) => {
                const center: Vec2 = [(x1 + x2) / 2, (y1 + y2) / 2];
                expect(vDot(vSub([x2, y2], [x1, y1]), along)).toBeCloseTo(0, 9);
                expect(Math.hypot(x2 - x1, y2 - y1)).toBeCloseTo(
                    2 * (spacing + 1),
                    9,
                );
                expect(vDot(vSub(center, mid), along)).toBeCloseTo(
                    (tick - index / 2) * spacing,
                    9,
                );
            });
        });
    });

    it("dashes strokes with GeoGebra's pattern and line opacity", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("pointilles"));
        // Long dashes, 8 + width long, of a 2.5 px stroke (thickness 5),
        // and GeoGebra's default line opacity, 178 / 255.
        ["f", "g", "c", "d", "e", "i", "j", "k", "l"].forEach((name) => {
            const object = c.getObj(name)!;
            expect(object.dash, name).toEqual([10.5, 8]);
            expect(object.strokeOpacity, name).toBe(178 / 255);
            expect(
                Number((object.dom.dom() as SVGElement).style.strokeOpacity),
            ).toBeCloseTo(178 / 255, 5);
        });
        expect(c.getObj("A")!.strokeOpacity).toBe(1);
        expect(c.getObj("q1")!.opacity).not.toBe(178 / 255);
    });

    it("marks right angles with GeoGebra's square, of diagonal arcSize", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("_3carres"));
        const alpha = c.getObj("α") as angle_object;
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const [o, a, d, b] = [
            ...alpha.arcPath.getAtt("d")!.matchAll(/[ML](\S+) (\S+)/g),
        ].map(([, x, y]) => [Number(x), Number(y)] as Vec2);
        expect(alpha.arcPath.getAtt("d")).toMatch(/Z$/);
        expect(alpha.wedgeFill.getAtt("d")).toBe("");
        const side = 38 * Math.SQRT1_2;
        expect(vNorm(vSub(o, alpha.O.screen))).toBeCloseTo(0, 9);
        [
            [a, alpha.A, side],
            [b, alpha.B, side],
        ].forEach(([vertex, leg, length]) => {
            const edge = vSub(vertex as Vec2, o);
            expect(vNorm(edge)).toBeCloseTo(length as number, 9);
            const toLeg = vSub((leg as point_object).screen, o);
            expect(vDot(edge, toLeg) / vNorm(toLeg)).toBeCloseTo(
                length as number,
                9,
            );
        });
        expect(vNorm(vSub(d, o))).toBeCloseTo(38, 9);
    });

    it("keeps points on paths movable along their support", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("pointon"));

        expect(c.getObj("P")).toBeInstanceOf(point_on_object);
        expect((c.getObj("T") as point_on_object).onBoundary).toBe(true);
        expect((c.getObj("U") as point_on_object).onBoundary).toBe(false);
        expect(c.getObj("poly")).toBeInstanceOf(polygon_object);
        expect(c.getObj("c_1")!.parents).toEqual([
            c.getObj("A"),
            c.getObj("B"),
        ]);
    });

    it("builds points from Vector and OrthogonalVector expressions", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("polyform"));

        expect(c.getObj("poly1")).toBeInstanceOf(polygon_object);
        expect(c.getObj("q1")).toBeInstanceOf(polygon_object);
        expect(c.getObj("C")!.isHidden).toBe(true);
    });

    it("drags a point by shifting the free numbers of its coordinates", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("polyform"));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const point = c.getObj("G") as point_object;
        const f = c.getObj("f") as expression_object;
        const g = c.getObj("g") as expression_object;
        const [f0, g0] = [f.value as number, g.value as number];
        const target = vAdd(point.coords, [1, -0.5, 0]);
        const [x, y] = c.pt3D(target);
        point.mousedrag(
            new PointerEvent("pointermove", { clientX: x, clientY: y }),
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));

        point.coords.forEach((value, index) =>
            expect(value).toBeCloseTo(target[index], 9),
        );
        expect(f.value).toBeCloseTo(f0 + 1, 9);
        expect(g.value).toBeCloseTo(g0 - 0.5, 9);
        expect((c.getObj("F") as point_object).coords).toEqual([2.56, 3.64, 0]);
    });

    it("snaps free points to the grid when capturing is fixed to it", async () => {
        const c = createConstruction();
        const xml = await loadXml("_PtSurGrille");
        importGgb(c, xml);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const point = c.getObj("A") as point_object;
        expect(point.increment).toEqual([1, 1]);
        const [x, y] = c.pt3D([0.7, -1.4, 0]);
        point.mousedrag(
            new PointerEvent("pointermove", { clientX: x, clientY: y }),
        );
        expect(point.coords).toEqual([1, -1, 0]);

        const zoomed = createConstruction();
        importGgb(zoomed, xml.replace(/scale="[\d.]+"/g, 'scale="126"'));
        expect((zoomed.getObj("A") as point_object).increment).toEqual([
            0.5, 0.5,
        ]);

        const spaced = createConstruction();
        importGgb(
            spaced,
            xml.replace("<bgColor", '<grid distX="0.5" distY="0.25"/><bgColor'),
        );
        expect((spaced.getObj("A") as point_object).increment).toEqual([
            0.5, 0.25,
        ]);
    });

    it("only drags points GeoGebra can drag", () => {
        const c = createConstruction();
        importGgb(
            c,
            `<geogebra><construction>
<element type="point" label="F"><coords x="1" y="1" z="1"/></element>
<element type="numeric" label="a"><value val="2"/></element>
<expression label="b" exp="3"/>
<element type="numeric" label="b"><value val="3"/></element>
<element type="numeric" label="c"><value val="1"/><fixed val="true"/></element>
${[
    "(a, 2)",
    "(b + 2 x(F), c)",
    "(x(F) + a, 1)",
    "(a + x(F) - 1, 2 a)",
    "(c, 1)",
]
    .map(
        (exp, index) =>
            `<expression label="P${index}" exp="${exp}" type="point"/><element type="point" label="P${index}"/>`,
    )
    .join("\n")}
</construction></geogebra>`,
        );
        expect(
            [0, 1, 2, 3, 4].map(
                (index) => (c.getObj(`P${index}`) as point_object).moveable,
            ),
        ).toEqual([true, true, false, false, false]);
    });

    it("draws a LaTeX text placed in the plane at its point", async () => {
        const c = createConstruction();
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="point" label="A"><coords x="1" y="2" z="1"/></element>
<expression label="t" exp="&quot;$ y=e^x $&quot;"/>
<element type="text" label="t"><isLaTeX val="true"/><startPoint exp="A"/><labelOffset x="5" y="-10"/></element>
<expression label="u" exp="&quot;\\frac{1}{2}&quot;"/>
<element type="text" label="u"><isLaTeX val="true"/><startPoint x="3" y="1" z="1"/></element>
</construction></geogebra>`,
            ),
        ).toEqual([]);
        const [t, u] = ["t", "u"].map(
            (name) => c.getObj(name) as expression_object,
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const a = c.getObj("A") as point_object;
        expect([t.latex, t.value, t.screen]).toEqual([
            true,
            " y=e^x ",
            [a.screen[0] + 5, a.screen[1] - 10],
        ]);
        expect(u.value).toBe("\\frac{1}{2}");
        a.coords = [2, 3, 0];
        c.invalidateGeometry(a);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(t.screen).toEqual([a.screen[0] + 5, a.screen[1] - 10]);
    });

    it("writes no name for a segment of zero length", async () => {
        const c = createConstruction();
        importGgb(
            c,
            `<geogebra><construction>
<element type="point" label="A"><coords x="1" y="2" z="1"/></element>
<element type="point" label="B"><coords x="1" y="2" z="1"/></element>
<command name="Segment"><input a0="A" a1="B"/><output a0="s"/></command>
<element type="segment" label="s"><show object="true" label="true"/><labelOffset x="5" y="-10"/></element>
</construction></geogebra>`,
        );
        const s = c.getObj("s") as segment_object;
        expect(s.nameSpot()).toBeNull();
        const b = c.getObj("B") as point_object;
        b.coords = [3, 2, 0];
        c.invalidateGeometry(b);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(s.nameSpot()).not.toBeNull();
    });

    it("builds nested commands as hidden auxiliary objects", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("transform"));

        const locus = c.getObj("L") as locus_object;
        expect(locus).toBeInstanceOf(locus_object);
        expect(locus.parents[0].isHidden).toBe(true);
        expect(c.getObj("F")).toBeInstanceOf(fixed_point_object);
    });

    it("draws semicircles, arcs and sectors on GeoGebra's circles", async () => {
        const c = createConstruction();
        const xml = await loadXml("circular");

        expect(importGgb(c, xml)).toEqual([]);
        const document = new DOMParser().parseFromString(
            xml,
            "application/xml",
        );
        const labels = ["g", "h", "k", "p", "q"];
        const arcs = labels.map(
            (label) => c.getObj(label) as primitive_arc_object,
        );
        expect(arcs.map((arc) => arc.constructor)).toEqual([
            semicircle_object,
            center_arc_object,
            arc3pts_object,
            center_arc_object,
            arc3pts_object,
        ]);
        arcs.forEach((arc, index) => {
            const matrix = document.querySelector(
                `element[label="${labels[index]}"] > matrix`,
            )!;
            const [a2, a4, a5] = ["A2", "A4", "A5"].map((name) =>
                Number(matrix.getAttribute(name)),
            );
            expect(arc.CENTER[0]).toBeCloseTo(-a4, 9);
            expect(arc.CENTER[1]).toBeCloseTo(-a5, 9);
            expect(arc.R).toBeCloseTo(Math.sqrt(a4 * a4 + a5 * a5 - a2), 9);
        });
        expect(arcs.map((arc) => arc.sector)).toEqual([
            false,
            false,
            false,
            true,
            true,
        ]);
        const [g, h, , p] = arcs;
        expect(g.insideBounds([g.CENTER[0], g.CENTER[1] + g.R, 0])).toBe(true);
        [h, p].forEach((arc, index) => {
            const [center, direction] = [
                ["J", "L"],
                ["P", "R"],
            ][index].map((label) => (c.getObj(label) as point_object).coords);
            expect(arc.sweepFlag).toBe(1);
            expect(arc.endAlpha).toBeCloseTo(
                Math.atan2(direction[1] - center[1], direction[0] - center[0]),
                9,
            );
        });
    });

    it("drives circles and functions from a slider", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("sliders"));

        const slider = c.getObj("a") as expression_object;
        expect(slider.isCursor).toBe(true);
        expect([slider.min, slider.max, slider.value]).toEqual([-5, 5, 2]);
        const circle = c.getObj("c") as circle1_object;
        expect(circle.R).toBeCloseTo(2);
        expect((c.getObj("e") as circle1_object).R).toBeCloseTo(
            Math.sqrt(10) / 2,
        );
        expect((c.getObj("f") as curve_object).pointAt(2)![1]).toBeCloseTo(7);

        slider.value = 3;
        c.invalidateGeometry(slider);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(circle.R).toBeCloseTo(3);
        expect((c.getObj("f") as curve_object).pointAt(2)![1]).toBeCloseTo(11);
    });

    it("shows GeoGebra's grid and axes with DGPad's coordinate system", async () => {
        const plane = createConstruction();
        importGgb(plane, await loadXml("_3carres"));
        expect(plane.GRID.is2D).toBe(true);
        expect(plane.GRID.isVisible).toBe(true);
        expect(plane.GRID.showGrid).toBe(true);
        expect(plane.GRID.showOx).toBe(false);
        expect(plane.GRID.showOy).toBe(false);

        const space = createConstruction();
        importGgb(space, await loadXml("3d_plan"));
        expect(space.GRID.is2D).toBe(false);
    });

    it("imports functions using floor and abs", async () => {
        const c = createConstruction();

        expect(importGgb(c, await loadXml("_fonctions"))).toEqual([]);
        const y = (label: string, x: number) =>
            (c.getObj(label) as curve_object).pointAt(x)![1];
        expect(y("f", 2)).toBeCloseTo(1.4 * Math.floor(1.4 * 1.1) + 0.4);
        expect(y("f", 0)).toBeCloseTo(1.4 * Math.floor(-0.6 * 1.1) + 0.4);
        expect(y("f3", 0)).toBeCloseTo(1.4 * 0.6 * 1.1 + 0.4);
        expect(y("f3", 2)).toBeCloseTo(1.4 * 1.4 * 1.1 + 0.4);
    });

    it("keeps function×line intersections on both as the line moves", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("fonction_inter"));

        const b = c.getObj("B") as point_object;
        b.coords = [0.58, 2.5, 0];
        c.invalidateGeometry(b);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const [bx, by] = b.coords;
        const [cx, cy] = (c.getObj("C") as point_object).coords;
        const [[dx, dy], [ex, ey]] = ["D", "E"].map(
            (name) => (c.getObj(name) as point_object).coords,
        );
        expect(c.getObj("D")!.defined && c.getObj("E")!.defined).toBe(true);
        expect(ex).toBeLessThan(dx);
        [
            [dx, dy],
            [ex, ey],
        ].forEach(([x, y]) => {
            expect(y).toBeCloseTo(0.5 * x * x - x - 2, 9);
            expect((x - bx) * (cy - by) - (y - by) * (cx - bx)).toBeCloseTo(
                0,
                9,
            );
        });
    });

    it("keeps function×circle intersections on both as the circle moves", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("fonction_inter_cercle"));

        const point = c.getObj("C") as point_object;
        point.coords = [3.2, -0.5, 0];
        c.invalidateGeometry(point);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const [bx, by] = (c.getObj("B") as point_object).coords;
        const radius = Math.hypot(3.2 - bx, -0.5 - by);
        const found = ["D", "E", "F", "G"].map(
            (name) => (c.getObj(name) as point_object).coords,
        );
        expect(new Set(found.map(([x]) => x.toFixed(6))).size).toBe(4);
        found.forEach(([x, y]) => {
            expect(y).toBeCloseTo(x ** 3 - 0.5 * x * x - x - 2, 9);
            expect(Math.hypot(x - bx, y - by)).toBeCloseTo(radius, 9);
        });
    });

    it("keeps function×conic intersections on both as the conic moves", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("fonction_inter_conique"));

        const point = c.getObj("H") as point_object;
        point.coords = [-2.4, 1.3, 0];
        c.invalidateGeometry(point);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const [a, b, cc, d, e, f] = (c.getObj("d") as primitive_quadric_object)
            .COEFFS!;
        const found = ["M", "N", "B", "C"].map(
            (name) => (c.getObj(name) as point_object).coords,
        );
        expect(new Set(found.map(([x]) => x.toFixed(6))).size).toBe(4);
        found.forEach(([x, y]) => {
            expect(y).toBeCloseTo(x ** 3 - 0.5 * x * x - x - 2, 9);
            expect(
                (a * x * x + b * x * y + cc * y * y + d * x + e * y + f) /
                    Math.hypot(2 * a * x + b * y + d, b * x + 2 * cc * y + e),
            ).toBeCloseTo(0, 9);
        });
    });

    it("builds ellipses, hyperbolas and parabolas like GeoGebra", async () => {
        const c = createConstruction();
        const xml = await loadXml("allconics");

        expect(importGgb(c, xml)).toEqual([]);
        // GeoGebra's own commands, without objects in between.
        (
            [
                ["c", focal_conic_object, "ABC"],
                ["d", focal_conic_object, "DEF"],
                ["e", parabola_object, "If"],
                ["g", quadric5pts_object, "JKLMN"],
            ] as const
        ).forEach(([label, kind, parents]) => {
            const conic = c.getObj(label)!;
            expect(conic, label).toBeInstanceOf(kind);
            expect(conic.parents).toEqual(
                parents.split("").map((name) => c.getObj(name)),
            );
        });
        expect((c.getObj("d") as focal_conic_object).hyperbola).toBe(true);
        const saved = new DOMParser().parseFromString(xml, "application/xml");
        (
            [
                ["c", "ellipse"],
                ["d", "hyperbola"],
                ["e", "parabola"],
                ["g", "ellipse"],
            ] as const
        ).forEach(([label, kind]) => {
            const conic = c.getObj(label) as primitive_quadric_object;
            expect(conic.KIND, label).toBe(kind);
            // GeoGebra's A0x² + A1y² + A2 + 2A3xy + 2A4x + 2A5y.
            const [a0, a1, a2, a3, a4, a5] = [0, 1, 2, 3, 4, 5].map((index) =>
                Number(
                    saved
                        .querySelector(`element[label="${label}"] > matrix`)!
                        .getAttribute(`A${index}`),
                ),
            );
            const expected = [a0, 2 * a3, a1, 2 * a4, 2 * a5, a2];
            const found = conic.COEFFS!;
            const ratio = vNorm(expected) / vNorm(found);
            const sign = Math.sign(vDot(expected, found));
            found.forEach((value, index) =>
                expect(sign * ratio * value, label).toBeCloseTo(
                    expected[index],
                    6,
                ),
            );
        });
    });

    it("rotates the cube around AB when C is dragged on its circle", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("cube"));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const point = c.getObj("C") as point_on_object;
        const circle = point.support as primitive_circle_object;
        const target = circle.pointAt((point.alpha as number) + 1);
        const [x, y] = c.pt3D(target);
        point.mousedrag(
            new PointerEvent("pointermove", { clientX: x, clientY: y }),
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));

        point.coords.forEach((value, index) =>
            expect(value).toBeCloseTo(target[index], 6),
        );
        expect(target[2]).not.toBeCloseTo(0);
        const [a, b, e, g] = "ABEG"
            .split("")
            .map((name) => (c.getObj(name) as point_object).coords);
        const side = vNorm(vSub(b, a));
        expect(vNorm(vSub(e, a))).toBeCloseTo(side, 9);
        expect(vDot(vSub(e, a), vSub(b, a))).toBeCloseTo(0, 9);
        expect(vDot(vSub(e, a), vSub(point.coords, b))).toBeCloseTo(0, 9);
        expect(vNorm(vSub(g, a))).toBeCloseTo(side * Math.sqrt(3), 9);
    });

    it("moves the pyramid's apex along the z axis", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("3d_pyramide"));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        expect(c.getObj("faceABD")).toBeInstanceOf(polygon_object);
        expect(c.getObj("arêteCD")!.parents).toEqual([
            c.getObj("C"),
            c.getObj("D"),
        ]);
        const apex = c.getObj("D") as point_on_object;
        expect(apex).toBeInstanceOf(point_on_object);
        const [x, y] = c.pt3D([0, 0, 2]);
        apex.mousedrag(
            new PointerEvent("pointermove", { clientX: x, clientY: y }),
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));

        expect(apex.coords[0]).toBeCloseTo(0, 9);
        expect(apex.coords[1]).toBeCloseTo(0, 9);
        expect(apex.coords[2]).toBeCloseTo(2, 6);
    });

    it("lifts the prism's top face with its first vertex", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("3d_prisme"));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        expect(c.getObj("faceAGHIJ")).toBeInstanceOf(polygon_object);
        expect(c.getObj("arêteEI")!.parents).toEqual([
            c.getObj("E"),
            c.getObj("I"),
        ]);
        const apex = c.getObj("A") as point_on_object;
        const [x, y] = c.pt3D([0, 0, 2]);
        apex.mousedrag(
            new PointerEvent("pointermove", { clientX: x, clientY: y }),
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const [e, i] = ["E", "I"].map(
            (name) => (c.getObj(name) as point_object).coords,
        );
        expect(i[0]).toBeCloseTo(e[0], 9);
        expect(i[1]).toBeCloseTo(e[1], 9);
        expect(i[2]).toBeCloseTo(2, 6);
    });

    it("keeps the plane through A, B and C as C moves on the z axis", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("3d_plan"));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const plane = c.getObj("p") as polygon_object;
        expect(plane).toBeInstanceOf(polygon_object);
        expect(plane.opacity).toBe(0.5);
        expect(plane.plane).toBe(true);
        expect(plane.layer).toBeLessThan(c.prefs.polygon.layer);
        const top = c.getObj("faceIJKL") as polygon_object;
        expect(top.farParts.get(plane)!.length).toBeGreaterThanOrEqual(3);
        const apex = c.getObj("C") as point_on_object;
        const [x, y] = c.pt3D([0, 0, 2]);
        apex.mousedrag(
            new PointerEvent("pointermove", { clientX: x, clientY: y }),
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const [a, b, apexCoords] = ["A", "B", "C"].map(
            (name) => (c.getObj(name) as point_object).coords,
        );
        expect(apexCoords[2]).toBeCloseTo(2, 6);
        const normal = vCross(vSub(b, a), vSub(apexCoords, a));
        plane.points.forEach((corner) =>
            expect(vDot(vSub(corner.coords, a), normal)).toBeCloseTo(0, 9),
        );
    });

    it("shades intersecting planes apart and splits each by the other", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("3d_inter_plans"));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const [p, q] = ["p", "q"].map(
            (name) => c.getObj(name) as polygon_object,
        );
        expect(p.shadedFill).not.toBe(q.shadedFill);
        expect(p.farParts.has(q) || q.farParts.has(p)).toBe(true);
    });

    it("keeps the intersection line of two planes in both as C moves", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("3d_inter_plans"));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const line = c.getObj("f") as plane_line_object;
        expect(line).toBeInstanceOf(plane_line_object);
        expect(line.parents.slice(1).map((plane) => plane.constructor)).toEqual(
            [plane_object, plane_object],
        );
        const apex = c.getObj("C") as point_on_object;
        const [x, y] = c.pt3D([0, 0, 2]);
        apex.mousedrag(
            new PointerEvent("pointermove", { clientX: x, clientY: y }),
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const [a, b, apexCoords, d, e, f] = ["A", "B", "C", "D", "E", "F"].map(
            (name) => (c.getObj(name) as point_object).coords,
        );
        expect(apexCoords[2]).toBeCloseTo(2, 6);
        const normals = [
            vCross(vSub(b, a), vSub(apexCoords, a)),
            vCross(vSub(e, d), vSub(f, d)),
        ];
        // As far as the planes are wide.
        const ends = (
            line as unknown as { referenceSpan(): Vec3[] }
        ).referenceSpan();
        ends.forEach((point) => {
            expect(vDot(vSub(point, a), normals[0])).toBeCloseTo(0, 6);
            expect(vDot(vSub(point, d), normals[1])).toBeCloseTo(0, 6);
        });
        const centers = vScale([a, b, apexCoords, d, e, f].reduce(vAdd), 1 / 6);
        const middle = vScale(vAdd(ends[0], ends[1]), 1 / 2);
        const along = vSub(ends[1], ends[0]);
        expect(vDot(vSub(centers, middle), along)).toBeCloseTo(0, 6);
        expect(vNorm(along)).toBeGreaterThan(10);
        expect(vNorm(along)).toBeLessThan(40);
    });

    it("cuts a pyramid by a plane into a quadrilateral, then a triangle", async () => {
        const c = createConstruction();
        const xml = await loadXml("3d_inter_plan_pyra");
        expect(importGgb(c, xml)).toEqual([]);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const section = c.getObj("H") as polygon_object;
        expect(section).toBeInstanceOf(polygon_object);
        const [a, b, apex] = ["A", "B", "C"].map(
            (name) => (c.getObj(name) as point_object).coords,
        );
        const normal = vCross(vSub(b, a), vSub(apex, a));
        expect(section.points).toHaveLength(4);
        section.points.forEach((vertex) => {
            expect(vertex.isVisible).toBe(true);
            expect(vertex.showName).toBe(false);
            expect(vDot(vSub(vertex.coords, a), normal)).toBeCloseTo(0, 6);
        });
        // GeoGebra names only some of the vertices it saves.
        new DOMParser()
            .parseFromString(xml, "application/xml")
            .querySelectorAll('element[type="point3d"][label^="H"] coords')
            .forEach((coords) => {
                const saved = ["x", "y", "z"].map((name) =>
                    Number(coords.getAttribute(name)),
                );
                expect(
                    section.points.some(
                        (vertex) =>
                            vNorm(vSub(vertex.coords, saved as never)) < 1e-9,
                    ),
                ).toBe(true);
            });
        const [p0, p1, p2, p3] = section.points.map((vertex) => vertex.coords);
        const turns = [
            [p0, p1, p2],
            [p1, p2, p3],
            [p2, p3, p0],
            [p3, p0, p1],
        ].map(([u, v, w]) => vDot(vCross(vSub(v, u), vSub(w, v)), normal));
        expect(
            turns.every((turn) => turn > 0) || turns.every((turn) => turn < 0),
        ).toBe(true);

        const f = c.getObj("F") as point_object;
        const [x, y] = c.pt3D([2, 0, 0]);
        f.mousedrag(
            new PointerEvent("pointermove", { clientX: x, clientY: y }),
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));

        expect(section.points).toHaveLength(3);
        section.points.forEach((vertex) =>
            expect(vDot(vSub(vertex.coords, a), normal)).toBeCloseTo(0, 6),
        );
    });

    it("draws a plane's part behind the floor beneath the floor", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("3d_plan_sol"));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const plane = c.getObj("p") as polygon_object;
        expect(plane.plane).toBe(true);
        expect(plane.behindFloor.length).toBeGreaterThanOrEqual(3);

        c.GRID.SHOWFLOOR = false;
        c.invalidateProjection();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(plane.behindFloor).toEqual([]);
    });

    it("builds a cylinder whose disks follow its axis", async () => {
        const c = createConstruction();
        const xml = await loadXml("3d_cylindre");
        expect(importGgb(c, xml)).toEqual([]);
        expectSavedPoints(c, xml);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const [bottom, top] = ["c", "d"].map(
            (name) => c.getObj(name) as disk_object,
        );
        expect(bottom).toBeInstanceOf(disk_object);
        expect(bottom.opacity).toBeCloseTo(0.4, 6);
        const solid = bottom.solid;
        expect(solid).toBeInstanceOf(revolution_object);
        expect(solid.parents.slice(0, 2)).toEqual(
            ["A", "B"].map((name) => c.getObj(name)),
        );
        const b = c.getObj("B") as point_on_object;
        const [x, y] = c.pt3D([0, 0, 2]);
        b.mousedrag(
            new PointerEvent("pointermove", { clientX: x, clientY: y }),
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));

        // Of radius 2, in the planes orthogonal to AB at A and B.
        [
            [bottom, "A"],
            [top, "B"],
        ].forEach(([disk, name]) => {
            const center = (c.getObj(name as string) as point_object).coords;
            expectClose((disk as disk_object).CENTER, center);
            expect((disk as disk_object).R).toBeCloseTo(2, 9);
            expect((disk as disk_object).NORMAL[2]).toBeCloseTo(1, 9);
        });
        // Seen from above, the top disk hides nothing, the bottom's far side
        // is hidden.
        expect(solid.hides(solid.rim(true, 0))).toBe(false);
        expect(
            Array.from({ length: 8 }, (_, k) =>
                solid.hides(solid.rim(false, (k * Math.PI) / 4)),
            ),
        ).toContain(true);
        expect((c.getObj("B") as point_object).coords[2]).toBeCloseTo(2, 6);
    });

    it("builds spheres drawn as their silhouettes", async () => {
        const c = createConstruction();
        const xml = await loadXml("3d_sphere");
        expect(importGgb(c, xml)).toEqual([]);
        expectSavedPoints(c, xml);
        expect(
            c.OBJS.V.filter((object) => object instanceof sphere_object),
        ).toHaveLength(2);
        expect(c.OBJS.polygons).toHaveLength(1);

        const [x, y] = c.pt3D([4, 3, 0]);
        (c.getObj("C") as point_on_object).mousedrag(
            new PointerEvent("pointermove", { clientX: x, clientY: y }),
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const [a, b] = ["a", "b"].map(
            (name) => c.getObj(name) as sphere_object,
        );
        const point = (name: string) => (c.getObj(name) as point_object).coords;
        expect(a.R).toBeCloseTo(vNorm(vSub(point("B"), point("A"))), 9);
        expect(b.R).toBeCloseTo(1, 9);
        expect(b.CENTER[0]).toBeCloseTo(4, 6);
        // Centered on the floor: the floor veils the lower half, and the
        // upper half hides the floor.
        expect(b.path.getAtt("d")).toMatch(/^M/);
        expect(b.nearPart.length).toBeGreaterThan(3);
        expect(b.farPath).toMatch(/^M/);
        const center = c.pt3D(b.CENTER);
        const edge = vNorm(vSub(c.pt3D(vAdd(b.CENTER, [0, 0, 1])), center));
        b.contour.forEach((screen) => {
            const distance = vNorm(vSub(screen, center));
            expect(distance).toBeGreaterThan(edge * 0.9);
            expect(distance).toBeLessThan(edge * 1.1);
        });
    });

    it("puts points on a sphere and on a cylinder's side where GeoGebra saved them", () => {
        const c = createConstruction();
        const xml = `<geogebra><construction>
<element type="point3d" label="A"><coords x="0" y="0" z="0" w="1"/></element>
<element type="point3d" label="B"><coords x="0" y="0" z="2" w="1"/></element>
<command name="Sphere"><input a0="A" a1="B"/><output a0="s"/></command>
<element type="quadric" label="s"/>
<command name="Point"><input a0="s"/><output a0="M"/></command>
<element type="point3d" label="M"><coords x="1.2" y="0" z="1.6" w="1"/></element>
<command name="Cylinder"><input a0="A" a1="B" a2="1"/><output a0="k" a1="e" a2="f" a3="g"/></command>
<element type="quadric" label="k"/>
<command name="Point"><input a0="g"/><output a0="N"/></command>
<element type="point3d" label="N"><coords x="0.6" y="0.8" z="0.5" w="1"/></element>
</construction></geogebra>`;
        expect(importGgb(c, xml)).toEqual([]);
        expectSavedPoints(c, xml);
        ["M", "N"].forEach((name) =>
            expect((c.getObj(name) as point_on_object).alpha).toHaveLength(3),
        );
    });

    it("intersects a line with a cylinder standing on a regular prism's floor", async () => {
        const c = createConstruction();
        const xml = await loadXml("3d_inter");
        expect(importGgb(c, xml)).toEqual([]);
        expectSavedPoints(c, xml);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const point = (name: string) => (c.getObj(name) as point_object).coords;
        const k = point("K");
        const [x, y] = c.pt3D([k[0], k[1], 6]);
        (c.getObj("N") as point_on_object).mousedrag(
            new PointerEvent("pointermove", { clientX: x, clientY: y }),
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const [m, n] = [point("M"), point("N")];
        expect(n[2]).toBeCloseTo(6, 6);
        ["P", "Q"].forEach((name) => {
            const onCylinder = point(name);
            expect(onCylinder[2]).toBeGreaterThan(point("L")[2]);
            expect(
                Math.hypot(onCylinder[0] - k[0], onCylinder[1] - k[1]),
            ).toBeCloseTo(1, 9);
            expect(vNorm(vCross(vSub(onCylinder, m), vSub(n, m)))).toBeCloseTo(
                0,
                9,
            );
        });
        expect(point("P")[0]).toBeLessThan(point("Q")[0]);
    });

    it("intersects segments, rays and lines with a cylinder", async () => {
        const c = createConstruction();
        const xml = await loadXml("3d_cylindre_inter");
        expect(importGgb(c, xml)).toEqual([]);
        expectSavedPoints(c, xml);
        ["A", "B", "C", "D", "E"].forEach((name) =>
            expect(c.getObj(name)).toBeInstanceOf(cylinder_intersection_object),
        );
    });

    it("intersects any line with a plane orthogonal to any line", async () => {
        const c = createConstruction();
        expect(importGgb(c, await loadXml("3d_plan_inter"))).toEqual([]);

        const point = (name: string) => (c.getObj(name) as point_object).coords;
        (
            [
                ["F", [-1, 0, 3]],
                ["H", [-1, 0, 3]],
                ["I", [-4, -3, 0]],
            ] as const
        ).forEach(([name, expected]) =>
            point(name).forEach((value, index) =>
                expect(value, name).toBeCloseTo(expected[index], 9),
            ),
        );
        // The segment stops short of the plane its ray crosses.
        expect(c.getObj("G")!.defined).toBe(false);
        const normal = vSub(point("B"), point("A"));
        (c.getObj("p") as polygon_object).points.forEach((corner) =>
            expect(vDot(vSub(corner.coords, point("E")), normal)).toBeCloseTo(
                0,
                9,
            ),
        );
    });

    it("draws circles around an axis, or of a direction", async () => {
        const c = createConstruction();
        expect(importGgb(c, await loadXml("3d_cercles_axe"))).toEqual([]);
        // GeoGebra's centers and radii; normal to the axis or the plane.
        const third = 1 / Math.sqrt(3);
        const fifth = 1 / Math.sqrt(5);
        (
            [
                ["c1", [0, 0, 1], Math.SQRT2, [0, 0, 1]],
                ["c2", [1, 1, 1], 2, [third, third, third]],
                ["c3", [1, 1, 1], 1.5, [fifth, 2 * fifth, 0]],
                ["c4", [1, 1, 1], 1, [0, 0, 1]],
                [
                    "c5",
                    [1.2, 0, 0.6],
                    2.6832815729997477,
                    [2 * fifth, 0, fifth],
                ],
            ] as const
        ).forEach(([name, center, radius, normal]) => {
            const circle = c.getObj(name) as primitive_circle_object;
            expectClose(
                [
                    ...circle.CENTER,
                    circle.R,
                    Math.abs(vDot(circle.NORMAL, normal)),
                ],
                [...center, radius, 1],
            );
        });
        // Dashed below the floor, as a line is.
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const { edge, hiddenEdge } = c.getObj("c3") as primitive_circle_object;
        [edge, hiddenEdge].forEach((path) =>
            expect(path.getAtt("d")).toMatch(/^M/),
        );
    });

    it("intersects a line and an orthogonal plane with a sphere", async () => {
        const c = createConstruction();
        expect(importGgb(c, await loadXml("3d_inter2"))).toEqual([]);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const point = (name: string) => c.getObj(name) as point_object;
        expect(point("F").defined).toBe(false);
        expect(point("G").defined).toBe(false);
        point("I").coords.forEach((value, index) =>
            expect(value).toBeCloseTo(
                [-2.1576641263442635, -2.854326503129813, 2.1447738878496283][
                    index
                ],
                9,
            ),
        );
        const plane = c.getObj("p") as polygon_object;
        expect(plane.plane).toBe(true);
        const normal = vSub(point("C").coords, point("B").coords);
        plane.points.forEach((corner) =>
            expect(
                vDot(vSub(corner.coords, point("H").coords), normal),
            ).toBeCloseTo(0, 9),
        );
        const circle = c.getObj("c") as primitive_circle_object;
        const center = point("A").coords;
        const distance =
            vDot(vSub(point("H").coords, center), normal) / vNorm(normal);
        expect(circle.R).toBeCloseTo(Math.sqrt(4 - distance ** 2), 9);
        expect(vNorm(vCross(circle.NORMAL, normal))).toBeCloseTo(0, 9);

        const [x, y] = c.pt3D([-2.523110914951643, -3.575107233917606, 1]);
        (c.getObj("D") as point_on_object).mousedrag(
            new PointerEvent("pointermove", { clientX: x, clientY: y }),
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));

        expect(point("D").coords[2]).toBeCloseTo(1, 6);
        (
            [
                [
                    "F",
                    [
                        -3.4741615542276896, -5.450890511165278,
                        0.3378589536697889,
                    ],
                ],
                [
                    "G",
                    [
                        -2.1286462766403154, -2.797093801769361,
                        1.2746344070075524,
                    ],
                ],
                [
                    "I",
                    [
                        -2.157664126344265, -2.854326503129815,
                        1.2544315822874599,
                    ],
                ],
            ] as const
        ).forEach(([name, expected]) =>
            point(name).coords.forEach((value, index) =>
                expect(value, name).toBeCloseTo(expected[index], 5),
            ),
        );
    });

    it("intersects two spheres", async () => {
        const c = createConstruction();
        const xml = await loadXml("3d_inter4");
        expect(importGgb(c, xml)).toEqual([]);
        expectSavedPoints(c, xml);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const point = (name: string) => (c.getObj(name) as point_object).coords;
        const circle = c.getObj("c") as primitive_circle_object;
        const expectOnSpheres = () => {
            const [a, d] = [point("A"), point("D")];
            const r2 = vDot(vSub(point("B"), a), vSub(point("B"), a));
            (
                [
                    [a, r2],
                    [d, 4],
                ] as const
            ).forEach(([center, square]) => {
                const offset = vSub(circle.CENTER, center);
                expect(vDot(offset, offset) + circle.R ** 2).toBeCloseTo(
                    square,
                    9,
                );
            });
            expect(vNorm(vCross(circle.NORMAL, vSub(d, a)))).toBeCloseTo(0, 9);
        };
        expect(circle.R ** 2).toBeCloseTo(2.681849153905685, 9);
        expectOnSpheres();

        const [x, y] = c.pt3D(
            vAdd(point("A"), vScale(vSub(point("C"), point("A")), 0.3)),
        );
        (c.getObj("D") as point_on_object).mousedrag(
            new PointerEvent("pointermove", { clientX: x, clientY: y }),
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(circle.defined).toBe(true);
        expectOnSpheres();

        const [far, farY] = c.pt3D(point("C"));
        (c.getObj("D") as point_on_object).mousedrag(
            new PointerEvent("pointermove", { clientX: far, clientY: farY }),
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(circle.defined).toBe(false);
    });

    it("cuts a cone by a plane, keeping the conic between its base and apex", async () => {
        const c = createConstruction();
        const xml = await loadXml("3d_cone_section");
        expect(importGgb(c, xml)).toEqual([]);
        // The cone of base x² + y² ≤ 4, z = 0, and apex (0, 0, 4); planes
        // z = 0.5x + 1, cutting an ellipse, and z = 3x + 1, a hyperbola.
        [
            ["s", 0.5],
            ["t", 3],
        ].forEach(([name, slope]) => {
            const section = c.getObj(name as string) as cylinder_section_object;
            expect(section).toBeInstanceOf(cylinder_section_object);
            expect(section.arcs).toHaveLength(1);
            const [arc] = section.arcs;
            arc.forEach(([x, y, z]) => {
                expect(z).toBeCloseTo((slope as number) * x + 1, 9);
                expect(Math.hypot(x, y)).toBeCloseTo(2 - z / 2, 9);
                expect(z).toBeGreaterThanOrEqual(-1e-9);
            });
            const ends = [arc[0], arc[arc.length - 1]];
            if (slope === 3)
                ends.forEach(([, , z]) => expect(z).toBeCloseTo(0, 9));
            else expectClose(ends[0], ends[1]);
        });
    });

    it("unfolds the nets of a prism and a pyramid like GeoGebra", async () => {
        const c = createConstruction();
        const xml = await loadXml("3d_patrons");
        expect(importGgb(c, xml)).toEqual([]);
        expectSavedPoints(c, xml);
    });

    it("cuts a limited cylinder by a plane, keeping the section on its side", async () => {
        const c = createConstruction();
        const xml = await loadXml("3d_inter5");
        expect(importGgb(c, xml)).toEqual([]);
        expectSavedPoints(c, xml);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const point = (name: string) => (c.getObj(name) as point_object).coords;
        const [b, g, top] = [point("B"), point("G"), point("R")[2]];
        const normal = vSub(point("A"), b);
        (c.getObj("q") as polygon_object).points.forEach((corner) =>
            expect(vDot(vSub(corner.coords, point("D")), normal)).toBeCloseTo(
                0,
                9,
            ),
        );

        const section = c.getObj("e") as cylinder_section_object;
        expect(section).toBeInstanceOf(cylinder_section_object);
        const expectOnSide = (x: Vec3) => {
            expect(vDot(vSub(x, point("C")), normal)).toBeCloseTo(0, 9);
            expect(Math.hypot(x[0] - g[0], x[1] - g[1])).toBeCloseTo(1, 9);
            expect(x[2]).toBeGreaterThanOrEqual(-1e-9);
            expect(x[2]).toBeLessThanOrEqual(top + 1e-9);
        };
        // Closed.
        expect(section.arcs).toHaveLength(1);
        const [whole] = section.arcs;
        expectClose(whole[0], whole[whole.length - 1]);
        whole.forEach(expectOnSide);

        // C such that the plane cuts the axis at height h.
        const moveC = async (h: number) => {
            const t =
                (vDot(normal, [g[0], g[1], h]) - vDot(normal, b)) /
                vDot(normal, normal);
            const [x, y] = c.pt3D(vAdd(b, vScale(normal, t)));
            (c.getObj("C") as point_on_object).mousedrag(
                new PointerEvent("pointermove", { clientX: x, clientY: y }),
            );
            await new Promise((resolve) => requestAnimationFrame(resolve));
        };
        await moveC(top - 0.1);
        expect(section.defined).toBe(true);
        expect(section.arcs).toHaveLength(1);
        const [arc] = section.arcs;
        expect(arc[0][2]).toBeCloseTo(top, 9);
        expect(arc[arc.length - 1][2]).toBeCloseTo(top, 9);
        arc.forEach(expectOnSide);

        await moveC(top + 1);
        expect(section.defined).toBe(false);
    });

    it("keeps the plane through a point and a line as the point moves", async () => {
        const c = createConstruction();
        const xml = await loadXml("3d_inter7");
        expect(importGgb(c, xml)).toEqual([]);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const point = (name: string) => (c.getObj(name) as point_object).coords;
        const plane = c.getObj("p") as polygon_object;
        expect(plane.plane).toBe(true);
        const expectThrough = () => {
            const [a, b, p] = [point("A"), point("B"), point("C")];
            const normal = vCross(vSub(b, a), vSub(p, a));
            plane.points.forEach((corner) =>
                expect(vDot(vSub(corner.coords, a), normal)).toBeCloseTo(0, 9),
            );
        };
        expectThrough();
        const [x, y] = c.pt3D([3, 2, 0]);
        (c.getObj("C") as point_object).mousedrag(
            new PointerEvent("pointermove", { clientX: x, clientY: y }),
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(point("C")[0]).toBeCloseTo(3, 6);
        expectThrough();
    });

    it("builds the plane through a point and any kind of line", async () => {
        const c = createConstruction();
        const point = (label: string, [x, y, z]: Vec3) =>
            `<element type="point3d" label="${label}"><coords x="${x}" y="${y}" z="${z}" w="1"/></element>`;
        const command = (name: string, inputs: string[], output: string) =>
            `<command name="${name}"><input ${inputs.map((input, index) => `a${index}="${input}"`).join(" ")}/><output a0="${output}"/></command>`;
        const lines = ["zAxis", "s", "r", "par", "i"];
        expect(
            importGgb(
                c,
                `<geogebra><euclidianView3D><coordSystem xZero="0" yZero="0" zZero="0" scale="50" xAngle="20" zAngle="-60"/></euclidianView3D><construction>
${point("A", [1, 2, 0])}${point("B", [-1, 3, 4])}${point("C", [3, -2, 1])}${point("D", [0, 1, 2])}
${command("Segment", ["A", "B"], "s")}
${command("Ray", ["A", "B"], "r")}
${command("Line", ["D", "s"], "par")}
${command("Plane", ["A", "B", "D"], "q")}
${command("IntersectPath", ["q", "xOyPlane"], "i")}
${lines.map((line, index) => command("Plane", ["C", line], `p${index}`)).join("\n")}
</construction></geogebra>`,
            ),
        ).toEqual([]);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const through = (c.getObj("C") as point_object).coords;
        lines.forEach((label, index) => {
            const line = c.getObj(label) as primitive_line_object;
            const normal = vCross(line.VEC, vSub(line.P1.coords, through));
            (c.getObj(`p${index}`) as polygon_object).points.forEach((corner) =>
                expect(
                    vDot(vSub(corner.coords, through), normal),
                    label,
                ).toBeCloseTo(0, 9),
            );
        });
    });

    it("builds reflections, inversions, rotations, translations and dilations", async () => {
        const c = createConstruction();
        const xml = await loadXml("transformations");

        expect(importGgb(c, xml)).toEqual([]);
        expectSavedPoints(c, xml);
        expect(c.getObj("t1'")).toBeInstanceOf(polygon_object);
        // GeoGebra's arguments as parents, without objects in between.
        (
            [
                ["H'", rotation_object, "KH"],
                ["L'", translation_object, "uL"],
                ["O'", dilation_object, "PO"],
            ] as const
        ).forEach(([label, kind, parents]) => {
            const image = c.getObj(label)!;
            expect(image, label).toBeInstanceOf(kind);
            expect(image.parents).toEqual(
                [...parents].map((name) => c.getObj(name)),
            );
        });
        const vector = c.getObj("u") as vector_object;
        expect(vector).toBeInstanceOf(vector_object);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(vector.head.getAtt("d")).toMatch(/^M/);

        const center = c.getObj("K") as point_object;
        const [x, y] = c.pt3D([2, 1, 0]);
        center.mousedrag(
            new PointerEvent("pointermove", { clientX: x, clientY: y }),
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const [h, k, image] = ["H", "K", "H'"].map(
            (name) => (c.getObj(name) as point_object).coords,
        );
        const [dx, dy] = vSub(h, k);
        const cos = Math.SQRT1_2;
        expect(k[0]).toBeCloseTo(2, 6);
        expect(image[0]).toBeCloseTo(k[0] + cos * (dx - dy), 9);
        expect(image[1]).toBeCloseTo(k[1] + cos * (dx + dy), 9);
    });

    it("rotates, dilates and translates around the origin, an axis, by formulas", async () => {
        const c = createConstruction();
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="numeric" label="a"><value val="2"/></element>
<element type="point" label="P"><coords x="1" y="2" z="1"/></element>
<element type="point" label="A"><coords x="0" y="0" z="1"/></element>
<element type="point" label="B"><coords x="1" y="0" z="1"/></element>
<command name="Line"><input a0="A" a1="B"/><output a0="d"/></command>
<element type="line" label="d"/>
<command name="Rotate"><input a0="P" a1="90°"/><output a0="R"/></command>
<element type="point" label="R"/>
<command name="Dilate"><input a0="P" a1="a"/><output a0="D"/></command>
<element type="point" label="D"/>
<command name="Translate"><input a0="P" a1="Vector[(a, 1)]"/><output a0="T"/></command>
<element type="point" label="T"/>
<command name="Translate"><input a0="P" a1="B"/><output a0="U"/></command>
<element type="point" label="U"/>
</construction></geogebra>`,
            ),
        ).toEqual([]);
        const at = (name: string) => (c.getObj(name) as point_object).coords;
        const check = (k: number) => {
            expectClose(at("R"), [-2, 1, 0]);
            expectClose(at("D"), [k, 2 * k, 0]);
            expectClose(at("T"), [1 + k, 3, 0]);
            expectClose(at("U"), [2, 2, 0]);
        };
        check(2);
        expect(c.getObj("R")!.parents).toEqual([c.getObj("P")]);
        expect(c.getObj("D")!.parents).toEqual([c.getObj("P"), c.getObj("a")]);
        const a = c.getObj("a") as expression_object;
        a.value = 3;
        c.invalidateGeometry(a);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        check(3);
    });

    it("draws tangents to circles, conics and functions' curves", async () => {
        const c = createConstruction();
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="point" label="O"><coords x="0" y="0" z="1"/></element>
<element type="point" label="P"><coords x="4" y="0" z="1"/></element>
<element type="numeric" label="r"><value val="2"/></element>
<command name="Circle"><input a0="O" a1="r"/><output a0="c"/></command>
<element type="conic" label="c"/>
<command name="Tangent"><input a0="P" a1="c"/><output a0="t1" a1="t2"/></command>
<element type="line" label="t1"/>
<element type="line" label="t2"/>
<command name="Point"><input a0="c"/><output a0="A"/></command>
<element type="point" label="A"><coords x="0" y="2" z="1"/></element>
<command name="Tangent"><input a0="A" a1="c"/><output a0="ta" a1=""/></command>
<element type="line" label="ta"/>
<expression label="e" exp="x^(2) / 9 + y^(2) / 4 = 1" type="conic"/>
<element type="conic" label="e"><matrix A0="4" A1="9" A2="-36" A3="0" A4="0" A5="0"/></element>
<element type="point" label="Q"><coords x="0" y="4" z="1"/></element>
<command name="Tangent"><input a0="Q" a1="e"/><output a0="u1" a1="u2"/></command>
<element type="line" label="u1"/>
<element type="line" label="u2"/>
<expression label="f" exp="f(x) = x^(2)"/>
<element type="function" label="f"/>
<element type="point" label="B"><coords x="1" y="0" z="1"/></element>
<command name="Tangent"><input a0="B" a1="f"/><output a0="tf"/></command>
<element type="line" label="tf"/>
<command name="Slope"><input a0="tf"/><output a0="m"/></command>
<element type="numeric" label="m"/>
<command name="Tangent"><input a0="3" a1="f"/><output a0="tx"/></command>
<element type="line" label="tx"/>
<command name="Slope"><input a0="tx"/><output a0="mx"/></command>
<element type="numeric" label="mx"/>
</construction></geogebra>`,
            ),
        ).toEqual([]);
        const line = (name: string) => c.getObj(name) as tangent_object;
        ["t1", "t2", "ta", "u1", "u2", "tf"].forEach((name) =>
            expect(line(name), name).toBeInstanceOf(tangent_object),
        );
        expect(line("t1").parents.slice(1)).toEqual(
            ["P", "c"].map((name) => c.getObj(name)),
        );
        // Through its point, touching where it is perpendicular to the
        // radius, the first on the left of OP.
        const touches = ["t1", "t2"].map((name) => line(name).P1.coords);
        expectClose(touches[0], [1, Math.sqrt(3), 0]);
        expectClose(touches[1], [1, -Math.sqrt(3), 0]);
        expectClose(line("ta").P1.coords, [0, 2, 0]);
        expect(Math.abs(line("ta").VEC[1])).toBeCloseTo(0, 9);
        // x²/9 + y²/4 = 1 from (0, 4): touching at y = 1.
        ["u1", "u2"].forEach((name) =>
            expect(line(name).P1.coords[1]).toBeCloseTo(1, 9),
        );
        expectClose(line("tf").P1.coords, [1, 1, 0]);
        expect(line("tf").VEC[1] / line("tf").VEC[0]).toBeCloseTo(2, 9);
        expect((c.getObj("m") as expression_object).value).toBeCloseTo(2, 9);
        expectClose(line("tx").P1.coords, [3, 9, 0]);
        expect((c.getObj("mx") as expression_object).value).toBeCloseTo(6, 6);
    });

    it("builds inversions, triangle centers and regular polygons", async () => {
        const c = createConstruction();
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="point" label="A"><coords x="0" y="0" z="1"/></element>
<element type="point" label="B"><coords x="4" y="0" z="1"/></element>
<element type="point" label="C"><coords x="0" y="3" z="1"/></element>
<command name="Circle"><input a0="A" a1="B"/><output a0="c"/></command>
<element type="conic" label="c"/>
<element type="point" label="P"><coords x="2" y="0" z="1"/></element>
<command name="Mirror"><input a0="P" a1="c"/><output a0="P'"/></command>
<element type="point" label="P'"/>
${[1, 2, 3, 4, 5]
    .map(
        (n) =>
            `<command name="TriangleCenter"><input a0="A" a1="B" a2="C" a3="${n}"/><output a0="X${n}"/></command><element type="point" label="X${n}"/>`,
    )
    .join("")}
<command name="Polygon"><input a0="A" a1="B" a2="4"/><output a0="sq" a1="s1" a2="s2" a3="s3" a4="s4" a5="D" a6="E"/></command>
<element type="polygon" label="sq"/>
<element type="point" label="D"/>
<element type="point" label="E"/>
<command name="Line"><input a0="A" a1="B"/><output a0="d"/></command>
<element type="line" label="d"/>
<command name="Mirror"><input a0="sq" a1="d"/><output a0="sq'"/></command>
<element type="polygon" label="sq'"/>
</construction></geogebra>`,
            ),
        ).toEqual([]);
        const at = (name: string) => (c.getObj(name) as point_object).coords;
        expect(c.getObj("P'")).toBeInstanceOf(inversion_object);
        expectClose(at("P'"), [8, 0, 0]);
        // In the right triangle ABC of sides 3, 4, 5.
        expectClose(at("X1"), [1, 1, 0]);
        expectClose(at("X2"), [4 / 3, 1, 0]);
        expectClose(at("X3"), [2, 1.5, 0]);
        expectClose(at("X4"), [0, 0, 0]);
        expectClose(at("X5"), [1, 0.75, 0]);
        expect(c.getObj("X3")!.parents).toEqual(
            ["A", "B", "C"].map((name) => c.getObj(name)),
        );
        const square = c.getObj("sq") as regular_polygon_object;
        expect(square).toBeInstanceOf(regular_polygon_object);
        expect(square.parents.slice(0, 2)).toEqual([
            c.getObj("A"),
            c.getObj("B"),
        ]);
        expect(c.getObj("D")).toBeInstanceOf(vertex_object);
        expectClose(at("D"), [4, 4, 0]);
        expectClose(at("E"), [0, 4, 0]);
        expect(square.area).toBeCloseTo(16, 9);
        expect((c.getObj("s3") as segment_object).P1).toBe(c.getObj("D"));
        // Its image by a reflection, below AB.
        const image = c.getObj("sq'") as regular_polygon_object;
        expect(image).toBeInstanceOf(regular_polygon_object);
        expectClose(
            image.points.map((point) => point.coords[1]).sort((u, v) => u - v),
            [-4, -4, 0, 0],
        );
    });

    it("builds images of objects by inversions", () => {
        const c = createConstruction();
        // As GeoGebra saves them: a straight image, a degenerate conic.
        const conic = (label: string, type: string, a: string) =>
            `<element type="${type}" label="${label}"><matrix A0="${a}" A1="${a}" A2="0" A3="0" A4="0" A5="0"/></element>`;
        const mirror = (source: string, label: string, image: string) =>
            `<command name="Mirror"><input a0="${source}" a1="c"/><output a0="${label}"/></command>${image}`;
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="point" label="O"><coords x="0" y="0" z="1"/></element>
<command name="Circle"><input a0="O" a1="2"/><output a0="c"/></command>
<element type="conic" label="c"/>
${[
    ["A", 1, 1],
    ["B", 3, 1],
    ["C", 2, 3],
    ["D", 4, 0],
]
    .map(
        ([label, x, y]) =>
            `<element type="point" label="${label}"><coords x="${x}" y="${y}" z="1"/></element>`,
    )
    .join("")}
<command name="Polygon"><input a0="A" a1="B" a2="C"/><output a0="t" a1="a" a2="b" a3="d"/></command>
<element type="polygon" label="t"/>
<command name="Line"><input a0="A" a1="B"/><output a0="l"/></command>
<element type="line" label="l"/>
<command name="Line"><input a0="O" a1="A"/><output a0="lo"/></command>
<element type="line" label="lo"/>
<command name="Segment"><input a0="B" a1="C"/><output a0="s"/></command>
<element type="segment" label="s"/>
<command name="Circle"><input a0="D" a1="1"/><output a0="k"/></command>
<element type="conic" label="k"/>
<command name="Circle"><input a0="A" a1="O"/><output a0="ko"/></command>
<element type="conic" label="ko"/>
<expression label="f" exp="f(x) = x^(2) + 3"/>
<element type="function" label="f"/>
${mirror("t", "t'", `<element type="curvecartesian" label="t'"/>`)}
${mirror("l", "l'", conic("l'", "conic", "1"))}
${mirror("lo", "lo'", conic("lo'", "conic", "0"))}
${mirror("s", "s'", conic("s'", "conicpart", "1"))}
${mirror("k", "k'", conic("k'", "conic", "1"))}
${mirror("ko", "ko'", conic("ko'", "conic", "0"))}
${mirror("f", "f'", `<element type="curvecartesian" label="f'"/>`)}
</construction></geogebra>`,
            ),
        ).toEqual([]);
        const image = c.getObj("t'") as polygon_object;
        expect(image).toBeInstanceOf(polygon_object);
        expect(image.parents).toEqual(["c", "t"].map((n) => c.getObj(n)));
        // A's inverse, at 4/2 times its distance from O.
        expect(
            image.points.some((p) => vNorm(vSub(p.coords, [2, 2, 0])) < 1e-9),
        ).toBe(true);
        expect(c.getObj("l'")).toBeInstanceOf(circle3pts_object);
        expect(c.getObj("lo'")).toBeInstanceOf(two_points_line_object);
        expect(c.getObj("s'")).toBeInstanceOf(arc3pts_object);
        expect(c.getObj("ko'")).toBeInstanceOf(two_points_line_object);
        const circle = c.getObj("k'") as primitive_circle_object;
        // Through the inverses of (3, 0) and (5, 0).
        expectClose(circle.CENTER, [16 / 15, 0, 0]);
        expect(circle.R).toBeCloseTo(4 / 15, 9);
        expect(c.getObj("f'")).toBeInstanceOf(locus_object);
    });

    it("keeps inverted polygon contours smooth when zoomed and moved", async () => {
        const c = createConstruction();
        expect(importGgb(c, await loadXml("polygone_inverse"))).toEqual([]);
        const source = c.getObj("poly1") as polygon_object;
        const image = c.getObj("poly1'") as polygon_object;
        const circle = c.getObj("c") as primitive_circle_object;
        const error = () => {
            const contour = image.screenPoints;
            let maximum = 0;
            source.points.forEach((start, i, points) => {
                const end = points[(i + 1) % points.length];
                for (let k = 0; k <= 1000; k++) {
                    const offset = vSub(
                        vAdd(
                            start.coords,
                            vScale(vSub(end.coords, start.coords), k / 1000),
                        ),
                        circle.CENTER,
                    );
                    const exact = c.pt3D(
                        vAdd(
                            circle.CENTER,
                            vScale(
                                offset,
                                circle.R ** 2 / vDot(offset, offset),
                            ),
                        ),
                    );
                    let nearest = Infinity;
                    contour.forEach((p, j) => {
                        const q = contour[(j + 1) % contour.length];
                        const dx = q[0] - p[0],
                            dy = q[1] - p[1];
                        const t = Math.max(
                            0,
                            Math.min(
                                1,
                                ((exact[0] - p[0]) * dx +
                                    (exact[1] - p[1]) * dy) /
                                    (dx * dx + dy * dy),
                            ),
                        );
                        nearest = Math.min(
                            nearest,
                            Math.hypot(
                                exact[0] - p[0] - t * dx,
                                exact[1] - p[1] - t * dy,
                            ),
                        );
                    });
                    maximum = Math.max(maximum, nearest);
                }
            });
            return maximum;
        };
        const counts: number[] = [];
        for (const scale of [50, 200, 1000]) {
            c.GRID.UNIT = [scale, scale, scale];
            c.invalidateProjection();
            c.flush();
            expect(error()).toBeLessThan(0.25);
            counts.push(image.points.length);
        }
        expect(counts[1]).toBeGreaterThan(counts[0]);
        expect(counts[2]).toBeGreaterThan(counts[1]);
        const vertex = c.getObj("F") as point_object;
        vertex.coords = [4.5, -1, 0];
        c.invalidateGeometry(vertex);
        c.flush();
        expect(error()).toBeLessThan(0.25);
        expect(image.opacity).toBeCloseTo(0.1);
        expect(image.defined).toBe(true);
        expect(source.children).toEqual([image]);
    });

    it("builds planes, their sections and solids' vertices as objects of their own", async () => {
        const open = async (name: string) => {
            const c = createConstruction();
            expect(importGgb(c, await loadXml(name)), name).toEqual([]);
            return c;
        };
        const tag = (object: unknown) =>
            (object as plane_object).definition.tag;
        let c = await open("3d_inter5");
        expect([tag(c.getObj("p")), tag(c.getObj("q"))]).toEqual([
            "PlO",
            "PlP",
        ]);
        expect(c.getObj("e")!.parents).toContain(c.getObj("p"));
        c = await open("3d_inter2");
        expect(c.getObj("c")).toBeInstanceOf(sphere_section_object);
        expect(c.getObj("f")).toBeInstanceOf(normal_line_object);
        expect(c.getObj("I")).toBeInstanceOf(plane_intersection_object);
        c = await open("3d_inter4");
        expect(c.getObj("c")!.parents).toEqual(
            ["a", "b"].map((name) => c.getObj(name)),
        );
        c = await open("3d_inter_plan_pyra");
        expect(c.getObj("H")).toBeInstanceOf(plane_section_object);
        c = await open("3d_inter6");
        // GeoGebra's xOy plane, hidden.
        expect(tag(c.getObj("g")!.parents[2])).toBe("PlE");
        c = await open("3d_inter");
        expect(
            (c.getObj("poly1") as regular_polygon_object).support,
        ).toBeInstanceOf(plane_object);
        const kinds = (c: construction) =>
            new Set(c.OBJS.V.map((object) => object.constructor));
        expect(kinds(c)).toContain(revolution_object);
        expect(kinds(c)).toContain(disk_object);
        expect(kinds(await open("3d_plan"))).toContain(cube_vertex_object);
        expect(kinds(await open("3d_prisme"))).toContain(translation_object);
        expect(kinds(await open("_patronsCube"))).toContain(net_vertex_object);
    });

    it("iterates segments into a Koch snowflake following its slider", async () => {
        const c = createConstruction();
        expect(importGgb(c, await loadXml("_koch"))).toEqual([]);
        const [a, b, d] = ["A", "B", "D"].map(
            (name) => (c.getObj(name) as point_object).coords,
        );
        const curves = ["l4", "l4'", "l4'_{1}"].map(
            (name) => c.getObj(name) as iteration_object,
        );
        curves.forEach((curve) =>
            expect(curve).toBeInstanceOf(iteration_object),
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(curves.map((curve) => curve.count)).toEqual([1, 1, 1]);

        const slider = c.getObj("a") as expression_object;
        slider.value = 1;
        c.invalidateGeometry(slider);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const [first, rotated] = curves.map((curve) => curve.items as Vec2[][]);
        const [dx, dy] = vScale(vSub(b, a), 1 / 3);
        const rotate = ([x, y]: Vec2, cos: number, sin: number): Vec2 => [
            cos * x - sin * y,
            sin * x + cos * y,
        ];
        const third: Vec2 = [dx, dy];
        const start: Vec2 = [a[0], a[1]];
        const vertices = [
            start,
            vAdd(start, third),
            vAdd(vAdd(start, third), rotate(third, 1 / 2, Math.sqrt(3) / 2)),
            vAdd(start, vScale(third, 2)),
            [b[0], b[1]] as Vec2,
        ];
        first.forEach((segment, index) =>
            segment.forEach((point, side) =>
                point.forEach((value, axis) =>
                    expect(value).toBeCloseTo(vertices[index + side][axis], 9),
                ),
            ),
        );
        const center: Vec2 = [d[0], d[1]];
        rotated.forEach((segment, index) =>
            segment.forEach((point, side) => {
                const image = vAdd(
                    center,
                    rotate(
                        vSub(first[index][side], center),
                        -1 / 2,
                        Math.sqrt(3) / 2,
                    ),
                );
                point.forEach((value, axis) =>
                    expect(value).toBeCloseTo(image[axis], 9),
                );
            }),
        );

        slider.value = 6;
        c.invalidateGeometry(slider);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(curves.map((curve) => curve.count)).toEqual([4096, 4096, 4096]);
    });

    it("imports sequences of points and segments following their slider", async () => {
        const c = createConstruction();
        expect(importGgb(c, await loadXml("_lists"))).toEqual([]);
        const [points, segments] = ["liste1", "liste2"].map(
            (name) => c.getObj(name) as list_object,
        );
        const slider = c.getObj("a") as expression_object;
        const spiral = (i: number): Vec2 => {
            const angle = (i * (slider.value as number) * Math.PI) / 180;
            const r = 0.2 * Math.sqrt(i);
            return [r * Math.cos(angle), r * Math.sin(angle)];
        };
        const expectSpiral = () => {
            expect([points.count, segments.count]).toEqual([500, 500]);
            points.items.forEach(([point], index) =>
                spiral(index + 1).forEach((value, axis) =>
                    expect((point as Vec2)[axis]).toBeCloseTo(value, 9),
                ),
            );
            segments.items.forEach((ends, index) =>
                ends.forEach((end, side) =>
                    spiral(index + 1 + side).forEach((value, axis) =>
                        expect((end as Vec2)[axis]).toBeCloseTo(value, 9),
                    ),
                ),
            );
        };
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expectSpiral();

        slider.value = 137.5;
        c.invalidateGeometry(slider);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expectSpiral();
    });

    it("iterates the spreadsheet's complex orbit, read as lists", async () => {
        const c = createConstruction();
        const xml = await loadXml("mandel");
        expect(importGgb(c, xml)).toEqual(["image MBImage"]);
        expectSavedPoints(c, xml);
        const [points, segments] = ["pts", "Segments"].map(
            (name) => c.getObj(name) as list_object,
        );
        const [upper, lower, stability, caption, title] = [
            "U_n",
            "L_n",
            "ArgPts",
            "text2",
            "text1_1",
        ].map((name) => c.getObj(name) as expression_object);
        const orbit = () =>
            Array.from(
                { length: 200 },
                (_, index) => c.getObj(`B${index + 1}`) as point_object,
            ).map((point) => (point.defined ? point.coords : null));
        const expectLists = () => {
            const terms = orbit();
            expect(points.items.map(([point]) => point)).toEqual(
                terms.map((term) => term && [term[0], term[1]]),
            );
            segments.items.forEach((ends, index) =>
                ends.forEach((end, side) => {
                    const term =
                        terms[(lower.value as number) + index + side - 1];
                    expect(end).toEqual(term ? [term[0], term[1]] : null);
                }),
            );
        };
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(segments.count).toBe(200);
        expectLists();
        expect(caption.value).toBe("Stable orbit");
        expect([upper.min, upper.max, lower.min, lower.max]).toEqual([
            1, 200, 0, 199,
        ]);

        const point = c.getObj("C") as point_object;
        point.coords = [0.5, 0.5, 0];
        c.invalidateGeometry(point);
        upper.value = 50;
        c.invalidateGeometry(upper);
        lower.value = 3;
        c.invalidateGeometry(lower);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        // Diverging, the orbit overflows before the 50th term.
        expect(orbit()[0]).not.toBeNull();
        expect(
            orbit()
                .slice(49)
                .every((term) => term === null),
        ).toBe(true);
        expect(c.getObj("C2")!.defined).toBe(false);
        expect(c.getObj("C3")!.defined).toBe(true);
        expect(segments.count).toBe(47);
        expectLists();
        expect(stability.value).toBe("Unstable");
        expect(caption.value).toBe("Unstable orbit");
        expect([title.latex, title.value]).toEqual([
            true,
            "M(z) = z^{2}+(0.5 + 0.5i)",
        ]);
        await expect
            .poll(() => title.dom.find(".katex-html")?.text())
            .toContain("M(z)=z2+(0,5+0,5i)");
    });

    it("iterates the complex orbit of an IterationList, joined by segments", async () => {
        const c = createConstruction();
        const xml = await loadXml("mandel2");
        expect(importGgb(c, xml)).toEqual([]);
        expectSavedPoints(c, xml);
        const [orbit, segments] = ["M", "L"].map(
            (name) => c.getObj(name) as list_object,
        );
        const n = c.getObj("n") as expression_object;
        const expectOrbit = (count: number) => {
            const [x, y] = (c.getObj("C") as point_object).coords;
            const terms: [number, number][] = [[0, 0]];
            for (let k = 0; k < count; k++) {
                const [a, b] = terms[k];
                terms.push([a * a - b * b + x, 2 * a * b + y]);
            }
            expect(orbit.count).toBe(count + 1);
            orbit.items.forEach(([term], index) =>
                (term as Vec2).forEach((value, axis) =>
                    expect(value).toBeCloseTo(terms[index][axis], 9),
                ),
            );
            expect(segments.count).toBe(count);
            expect(segments.items[count - 1]).toEqual([
                orbit.items[count - 1][0],
                orbit.items[count][0],
            ]);
        };
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expectOrbit(5000);
        const input = (c.getObj("InputBox1") as expression_object).dom
            .find("input")!
            .dom() as HTMLInputElement;
        expect(input.value).toBe("5000");
        const type = async (text: string) => {
            input.value = text;
            input.dispatchEvent(new Event("change"));
            await new Promise((resolve) => requestAnimationFrame(resolve));
        };
        const formula = (c.getObj("text2") as expression_object).dom;
        await expect
            .poll(() => formula.find(".katex-html")?.text())
            .toContain("1≤k≤n");
        expect(formula.find(".katex-error")).toBeNull();
        expect((c.getObj("c") as circle1_object).R).toBeCloseTo(2, 12);

        await type("20");
        expect(n.value).toBe(20);
        // Within the slider's bounds.
        await type("20000");
        expect([n.value, input.value]).toEqual([10000, "10000"]);
        await type("abc");
        expect([n.value, input.value]).toEqual([10000, "10000"]);
        await type("20");
        const point = c.getObj("C") as point_object;
        point.coords = [-0.5, 0.5, 0];
        c.invalidateGeometry(point);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expectOrbit(20);
    });

    it("draws the image between its corners while its checkbox is checked", async () => {
        const c = createConstruction();
        const response = await fetch(figure("mandel.ggb"));
        expect(await importGgbFromBlob(c, await response.blob())).toEqual([]);
        const image = c.getObj("MBImage") as image_object;
        const checkbox = c.getObj("b") as expression_object;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect([checkbox.checkbox, checkbox.value]).toEqual([true, 0]);
        expect(image.isVisible).toBe(false);

        checkbox.value = 1;
        c.invalidateGeometry(checkbox);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(image.isVisible).toBe(true);
        const element = image.dom.find("image")!.dom() as SVGImageElement;
        const [a, b] = ["D", "E"].map(
            (name) => (c.getObj(name) as point_object).screen,
        );
        const corner = (x: number, y: number): Vec2 => {
            const point = new DOMPoint(x, y).matrixTransform(element.getCTM()!);
            return [point.x, point.y];
        };
        // Up the image, perpendicular to its bottom, in proportion.
        const ratio = image.height / image.width;
        [
            [corner(0, image.height), a],
            [corner(image.width, image.height), b],
            [
                corner(0, 0),
                [a[0] + (b[1] - a[1]) * ratio, a[1] - (b[0] - a[0]) * ratio],
            ],
        ].forEach(([actual, expected]) =>
            actual.forEach((value, axis) =>
                expect(value).toBeCloseTo(expected[axis], 3),
            ),
        );
        expect(element.style.opacity).toBe("0.75");
    });

    it("sizes images in pixels without their bottom right corner", async () => {
        const c = createConstruction();
        const url =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        expect(
            importGgb(
                c,
                `<geogebra><euclidianView><coordSystem xZero="200" yZero="300" scale="50"/><size width="800" height="600"/></euclidianView><construction>
<element type="image" label="one"><file name="p.png"/><startPoint number="0" exp="A"/></element>
<element type="image" label="two"><file name="p.png"/><startPoint number="0" exp="A"/><startPoint number="2" exp="D"/></element>
<element type="image" label="fixed"><file name="p.png"/><absoluteScreenLocation x="30" y="50"/></element>
<element type="point" label="A"><coords x="1" y="2" z="1"/></element>
<element type="point" label="D"><coords x="1" y="4" z="1"/></element>
</construction></geogebra>`,
                new Map([["p.png", { url, width: 40, height: 20 }]]),
            ),
        ).toEqual([]);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const corners = (name: string): Vec2[] => {
            const image = c.getObj(name) as image_object;
            const element = image.dom.find("image")!.dom() as SVGImageElement;
            return [
                [0, 20],
                [40, 20],
                [0, 0],
            ].map(([x, y]) => {
                const point = new DOMPoint(x, y).matrixTransform(
                    element.getCTM()!,
                );
                return [point.x, point.y];
            });
        };
        const [a, d] = ["A", "D"].map(
            (name) => (c.getObj(name) as point_object).screen,
        );
        const expectCorners = (actual: Vec2[], expected: Vec2[]) =>
            actual.forEach((corner, index) =>
                corner.forEach((value, axis) =>
                    expect(value).toBeCloseTo(expected[index][axis], 3),
                ),
            );
        expectCorners(corners("one"), [
            a,
            [a[0] + 40, a[1]],
            [a[0], a[1] - 20],
        ]);
        const up = a[1] - d[1];
        expectCorners(corners("two"), [a, [a[0] + 2 * up, a[1]], d]);
        expectCorners(corners("fixed"), [
            [30, 70],
            [70, 70],
            [30, 50],
        ]);
        c.GRID.ORG = [c.GRID.ORG[0] + 40, c.GRID.ORG[1] - 25];
        c.invalidateProjection();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expectCorners(corners("fixed"), [
            [30, 70],
            [70, 70],
            [30, 50],
        ]);
    });

    it("builds an image's images by a dilation and a reflection", async () => {
        const c = createConstruction();
        const url =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        expect(
            importGgb(
                c,
                `<geogebra><euclidianView><coordSystem xZero="200" yZero="300" scale="50"/><size width="800" height="600"/></euclidianView><construction>
<element type="point" label="A"><coords x="1" y="2" z="1"/></element>
<element type="point" label="B"><coords x="3" y="2" z="1"/></element>
<element type="point" label="O"><coords x="0" y="0" z="1"/></element>
<element type="image" label="p"><file name="p.png"/><startPoint number="0" exp="A"/><startPoint number="1" exp="B"/></element>
<command name="Dilate"><input a0="p" a1="-1" a2="O"/><output a0="q"/></command>
<element type="image" label="q"><file name="p.png"/></element>
<command name="Mirror"><input a0="p" a1="xAxis"/><output a0="r"/></command>
<element type="image" label="r"><file name="p.png"/></element>
</construction></geogebra>`,
                new Map([["p.png", { url, width: 40, height: 20 }]]),
            ),
        ).toEqual([]);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const corners = (name: string): Vec2[] => {
            const image = c.getObj(name) as image_object;
            const element = image.dom.find("image")!.dom() as SVGImageElement;
            return [
                [0, 20],
                [40, 20],
                [0, 0],
            ].map(([x, y]) => {
                const point = new DOMPoint(x, y).matrixTransform(
                    element.getCTM()!,
                );
                return [point.x, point.y];
            });
        };
        const screen = ([x, y]: Vec2): Vec2 => [200 + 50 * x, 300 - 50 * y];
        (
            [
                [
                    "p",
                    [
                        [1, 2],
                        [3, 2],
                        [1, 3],
                    ],
                ],
                [
                    "q",
                    [
                        [-1, -2],
                        [-3, -2],
                        [-1, -3],
                    ],
                ],
                [
                    "r",
                    [
                        [1, -2],
                        [3, -2],
                        [1, -3],
                    ],
                ],
            ] as [string, Vec2[]][]
        ).forEach(([name, expected]) =>
            corners(name).forEach((corner, index) =>
                corner.forEach((value, axis) =>
                    expect(value).toBeCloseTo(screen(expected[index])[axis], 3),
                ),
            ),
        );
    });

    it("keeps a point on an orthogonal or parallel line where GeoGebra does", async () => {
        const c = createConstruction();
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="point" label="F"><coords x="0" y="0" z="1"/></element>
<element type="point" label="G"><coords x="2" y="0" z="1"/></element>
<command name="Segment"><input a0="F" a1="G"/><output a0="l"/></command>
<element type="segment" label="l"/>
<command name="OrthogonalLine"><input a0="F" a1="l"/><output a0="m"/></command>
<element type="line" label="m"/>
<command name="Point"><input a0="m"/><output a0="H"/></command>
<element type="point" label="H"><coords x="0" y="1" z="1"/></element>
<command name="Line"><input a0="G" a1="m"/><output a0="n"/></command>
<element type="line" label="n"/>
<command name="Point"><input a0="n"/><output a0="J"/></command>
<element type="point" label="J"><coords x="2" y="-3" z="1"/></element>
</construction></geogebra>`,
            ),
        ).toEqual([]);
        const f = c.getObj("F") as point_object;
        f.coords = [1, 0, 0];
        c.invalidateGeometry(f);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        // Along the lines' direction, turned from G - F, scaled with it.
        [
            ["H", [1, 0.5, 0]],
            ["J", [2, -1.5, 0]],
        ].forEach(([name, expected]) =>
            (c.getObj(name as string) as point_object).coords.forEach(
                (value, axis) =>
                    expect(value).toBeCloseTo((expected as number[])[axis], 9),
            ),
        );
    });

    it("unfolds the cube's nets with their slider, showing the chosen one", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("_patronsCube"));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const [ouv, patron] = ["Ouv", "Patron"].map(
            (name) => c.getObj(name) as expression_object,
        );
        const setValue = async (slider: expression_object, value: number) => {
            slider.value = value;
            c.invalidateGeometry(slider);
            await new Promise((resolve) => requestAnimationFrame(resolve));
        };

        // Where GeoGebra puts them, half unfolded.
        await setValue(ouv, 0.5);
        Object.entries({
            U_3: [-3.7564204061874342, -3.057325365531214, 0],
            T_3: [-0.893254021139871, 4.688515613650447, 3.4206059497756076],
            R_6: [-6.126250773234714, 0.3973412792958957, 2.4187336628533846],
            V: [4.583882661232128, 2.663951247117942, 5.839339612628992],
        }).forEach(([name, expected]) =>
            (c.getObj(name) as point_object).coords.forEach((value, index) =>
                expect(value).toBeCloseTo(expected[index], 9),
            ),
        );

        // A condition alone decides, whatever the saved show flag.
        const shown = () =>
            [
                "faceABCD",
                "C",
                "face61",
                "edge191",
                "face37",
                "U_3",
                "face7",
                "W",
            ].filter((name) => c.getObj(name)!.isVisible);
        expect(shown()).toEqual(["face7", "W"]);
        await setValue(patron, 5);
        expect(shown()).toEqual(["face37", "U_3"]);
        await setValue(patron, 1);
        expect(shown()).toEqual(["face61", "edge191"]);
        await setValue(patron, 0);
        expect(shown()).toEqual(["faceABCD", "C"]);

        // Vertical sliders, rising from where they are in the graphics view.
        expect(ouv.vertical).toBe(true);
        ouv.screen.forEach((value, index) =>
            expect(value).toBeCloseTo([32, 252][index], 9),
        );
    });

    it("hides what lies behind opaque faces, painting them farthest first", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("_patronsCube"));
        const patron = c.getObj("Patron") as expression_object;
        patron.value = 0;
        c.invalidateGeometry(patron);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const painted = [...c.layer(0, c.prefs.polygon.layer).dom().children];
        const position = (name: string) =>
            painted.indexOf(c.getObj(name)!.dom.dom());
        // Only faces whose projections overlap are ordered: not CDHG and
        // ABFE, nor ABCD and EFGH, which only touch in this view.
        [
            ["ABCD", "ABFE"],
            ["ABCD", "BCGF"],
            ["CDHG", "BCGF"],
            ["CDHG", "EFGH"],
            ["ADHE", "ABFE"],
            ["ADHE", "BCGF"],
            ["ADHE", "EFGH"],
        ].forEach(([back, front]) =>
            expect(position(`face${back}`)).toBeLessThan(
                position(`face${front}`),
            ),
        );
        expect(
            [..."ABCDEFGH"].filter((name) =>
                isOccluded(c, c.getObj(name) as point_object),
            ),
        ).toEqual(["D"]);
        const diagonal = c.getObj("a") as unknown as Record<string, unknown>;
        expect([diagonal.visibleIntervals, diagonal.hiddenIntervals]).toEqual([
            [],
            [],
        ]);
    });

    it("leaves edges already drawn by a segment to that segment", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("cube"));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const face = c.getObj("faceABCD") as polygon_object;
        expect(face.outline.getAtt("d")?.trim()).toBe("");
        expect(face.hiddenOutline.getAtt("d")?.trim()).toBe("");
    });

    it("builds a command's point inputs that depend on the figure", async () => {
        const c = createConstruction();
        expect(importGgb(c, await loadXml("Animations03"))).toEqual([]);
        const f = c.getObj("f") as segment_object;
        const t = c.getObj("t") as expression_object;
        expect(f.P1.coords[0]).toBeCloseTo(0.86);
        expect(f.P2.coords[1]).toBeCloseTo(0.14);
        t.value = 0.3;
        c.invalidateGeometry(t);
        c.flush();
        expect(f.P1.coords[0]).toBeCloseTo(0.3);
        expect(f.P2.coords[1]).toBeCloseTo(0.7);
    });

    it("draws the axes as GeoGebra: their width, numbers and graduations", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("Animations03"));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(c.GRID.size).toBe(2);
        expect(c.GRID.fontSize).toBe(15);
        expect(c.GRID.onlyPositive).toBe(true);
        expect(c.GRID.tickDistances).toEqual([1, 1]);
        expect(c.GRID.tickStyles).toEqual([1, 1]);
        expect(c.GRID.boldNumbers).toBe(true);
        expect(c.GRID.geogebraAxes).toBe(true);
        const texts = [...c.GRID.dom.dom().querySelectorAll("text")].filter(
            (text) => (text as SVGElement).style.display !== "none",
        );
        // A number at each unit only, a 0 at the origin.
        expect(texts.map((text) => text.textContent)).toContain("0");
        texts.forEach((text) =>
            expect(Number.isInteger(Number(text.textContent))).toBe(true),
        );
        expect(getComputedStyle(texts[0]).fontWeight).toBe("700");
        const plain = createConstruction();
        importGgb(plain, await loadXml("Animation"));
        expect(plain.GRID.size).toBe(1);
        expect(plain.GRID.fontSize).toBe(12);
        expect(plain.GRID.onlyPositive).toBe(false);
        expect(plain.GRID.tickDistances).toEqual([0, 0]);
        expect(plain.GRID.boldNumbers).toBe(false);
    });

    it("draws GeoGebra's grid: its distances, subgrid, color and dashes", async () => {
        const xml = await loadXml("grille_entiere");
        // Minor and major grid lines, graduations.
        const paths = (c: construction) =>
            [...c.GRID.dom.dom().querySelectorAll("path")]
                .slice(-5)
                .map((path) => path.getAttribute("d") ?? "");
        // The smallest distance between two vertical lines of a path.
        const step = (d: string) => {
            const xs = [...d.matchAll(/M([\d.]+) [\d.]+V/g)].map(([, x]) =>
                Number(x),
            );
            return Math.min(...xs.slice(1).map((x, i) => x - xs[i]));
        };
        // A line at each unit, numbers every 2 graduated over it.
        const c = createConstruction();
        importGgb(c, xml);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(c.GRID.gridDistances).toEqual([1, 1]);
        expect(c.GRID.gridSubdivisions).toBe(1);
        expect(c.GRID.gridColor).toBe("#b4b3ba");
        expect(c.GRID.gridDash).toEqual([]);
        const unit = c.GRID.UNIT[0];
        const [minor, major, , , ticks] = paths(c);
        expect(minor).toBe("");
        expect(step(major)).toBeCloseTo(unit, 0);
        expect(ticks).not.toBe("");
        // Automatic, with a subgrid of five dashed intervals: ungraduated.
        const subgrid = createConstruction();
        importGgb(
            subgrid,
            xml
                .replace('gridType="0"', 'gridType="3"')
                .replace(/<grid [^>]*\/>/, "")
                .replace('grid="0"', 'grid="10"'),
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(subgrid.GRID.gridDistances).toEqual([0, 0]);
        expect(subgrid.GRID.gridSubdivisions).toBe(5);
        expect(subgrid.GRID.gridDash).toEqual([5, 4]);
        const [subMinor, subMajor, , , subTicks] = paths(subgrid);
        expect(step(subMajor)).toBeCloseTo(2 * unit, 0);
        expect(step(subMinor)).toBeCloseTo((2 * unit) / 5, 0);
        expect(subTicks).toBe("");
    });

    it("draws GeoGebra's axis names, hidden numbers, unit of π and arrows", async () => {
        const xml = (await loadXml("Animation"))
            .replace('evSettings axes="false"', 'evSettings axes="true"')
            .replace('lineStyle axes="1"', 'lineStyle axes="9"')
            .replace(
                /<axis id="0"[^>]*\/>/,
                '<axis id="0" show="true" label="$x$" unitLabel="π" tickStyle="1" showNumbers="true" tickDistance="1.5707963267948966"/>',
            )
            .replace(
                /<axis id="1"[^>]*\/>/,
                '<axis id="1" show="true" label="f(x)" unitLabel="" tickStyle="1" showNumbers="false"/>',
            );
        const c = createConstruction();
        importGgb(c, xml);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(c.GRID.axisLabels).toEqual(["x", "f(x)"]);
        expect(c.GRID.axisUnits).toEqual(["π", ""]);
        expect(c.GRID.showNumbers).toEqual([true, false]);
        expect(c.GRID.arrows).toBe(3);
        const texts = [...c.GRID.dom.dom().querySelectorAll("text")]
            .filter((text) => (text as SVGElement).style.display !== "none")
            .map((text) => text.textContent);
        // Ox's name and numbers, all multiples of π/2: Oy's are hidden.
        expect(texts).toContain("x");
        expect(texts.filter((text) => text !== "x").length).toBeGreaterThan(2);
        texts
            .filter((text) => !["x", "f(x)", "0"].includes(text!))
            .forEach((text) => expect(text).toMatch(/^-?\d*π(\/2)?$/));
        const restored = createConstruction();
        readDgo(restored, await describeDgo(c));
        expect(restored.GRID.axisLabels).toEqual(["x", "f(x)"]);
        expect(restored.GRID.axisUnits).toEqual(["π", ""]);
        expect(restored.GRID.showNumbers).toEqual([true, false]);
        expect(restored.GRID.arrows).toBe(3);
        // Open by default.
        const plain = createConstruction();
        importGgb(plain, await loadXml("Animation"));
        expect(plain.GRID.arrows).toBe(2);
    });

    it("reads the degree as a constant, as GeoGebra", () => {
        const c = createConstruction();
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="point" label="A"><coords x="2" y="0" z="1"/></element>
<element type="point" label="M"><coords x="1" y="0" z="1"/></element>
<element type="numeric" label="n"><value val="3"/></element>
${["90*°", "90°", "(540 / n)°", "180 / n * °"]
    .map(
        (angle, index) =>
            `<command name="Rotate"><input a0="A" a1="${angle}" a2="M"/><output a0="P${index}"/></command><element type="point" label="P${index}"/>`,
    )
    .join("\n")}
</construction></geogebra>`,
            ),
        ).toEqual([]);
        [
            [1, 1],
            [1, 1],
            [0, 0],
            [1.5, Math.sqrt(3) / 2],
        ].forEach((expected, index) =>
            expected.forEach((value, axis) =>
                expect(
                    (c.getObj(`P${index}`) as point_object).coords[axis],
                ).toBeCloseTo(value, 9),
            ),
        );
    });

    it("builds the images of polygons and arcs, translating by computed vectors", () => {
        const c = createConstruction();
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="point" label="A"><coords x="0" y="0" z="1"/></element>
<element type="point" label="B"><coords x="2" y="0" z="1"/></element>
<element type="point" label="C"><coords x="0" y="2" z="1"/></element>
<command name="Polygon"><input a0="A" a1="B" a2="C"/><output a0="t"/></command>
<element type="polygon" label="t"/>
<command name="Vector"><input a0="A" a1="C"/><output a0="v"/></command>
<command name="Line"><input a0="A" a1="B"/><output a0="l"/></command>
<command name="CircleArc"><input a0="A" a1="B" a2="C"/><output a0="k"/></command>
<command name="Translate"><input a0="t" a1="v"/><output a0="t1"/></command>
<command name="Mirror"><input a0="t" a1="l"/><output a0="t2"/></command>
<command name="Dilate"><input a0="t" a1="2" a2="A"/><output a0="t3"/></command>
<command name="Rotate"><input a0="k" a1="90°" a2="A"/><output a0="k1"/></command>
<command name="Mirror"><input a0="k" a1="l"/><output a0="k2"/></command>
<command name="Semicircle"><input a0="A" a1="B"/><output a0="g"/></command>
<command name="Mirror"><input a0="g" a1="l"/><output a0="g2"/></command>
<command name="Mirror"><input a0="k" a1="A"/><output a0="k3"/></command>
<command name="Mirror"><input a0="k2" a1="l"/><output a0="k4"/></command>
<command name="Translate"><input a0="A" a1="Vector[(2 * v)]"/><output a0="P"/></command>
<command name="Translate"><input a0="A" a1="(1, 0)"/><output a0="Q"/></command>
</construction></geogebra>`,
            ),
        ).toEqual([]);
        const vertices = (name: string) =>
            (c.getObj(name) as polygon_object).points.map((vertex) => [
                ...vertex.coords,
            ]);
        expect(vertices("t1")).toEqual([
            [0, 2, 0],
            [2, 2, 0],
            [0, 4, 0],
        ]);
        expect(vertices("t2")).toEqual([
            [0, 0, 0],
            [2, 0, 0],
            [0, -2, 0],
        ]);
        expect(vertices("t3")).toEqual([
            [0, 0, 0],
            [4, 0, 0],
            [0, 4, 0],
        ]);
        const arc = c.getObj("k1") as center_arc_object;
        expect(arc).toBeInstanceOf(center_arc_object);
        expectClose(arc.A.coords, [0, 2, 0]);
        // A reflection reverses an arc, not a half turn.
        const inside = ([name, x, y]: [string, number, number]) =>
            (c.getObj(name) as primitive_arc_object).insideBounds([x, y, 0]);
        const r = Math.SQRT2;
        expect(
            (
                [
                    ["k", r, r],
                    ["k", r, -r],
                    ["k2", r, -r],
                    ["k2", r, r],
                    ["k3", -r, -r],
                    ["k3", r, r],
                    ["g", 1, 1],
                    ["g2", 1, -1],
                    ["g2", 1, 1],
                    ["k4", r, r],
                    ["k4", r, -r],
                ] as [string, number, number][]
            ).map(inside),
        ).toEqual([
            true,
            false,
            true,
            false,
            true,
            false,
            true,
            true,
            false,
            true,
            false,
        ]);
        expect((c.getObj("P") as point_object).coords).toEqual([0, 4, 0]);
        expect((c.getObj("Q") as point_object).coords).toEqual([1, 0, 0]);
    });

    it("builds lists of polygons, of rotated points and in space", () => {
        const c = createConstruction();
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="point" label="A"><coords x="0" y="0" z="1"/></element>
<command name="Sequence"><input a0="Rotate[(1, 0), i * 90°, A]" a1="i" a2="0" a3="3"/><output a0="r"/></command>
<element type="list" label="r"/>
<command name="Polygon"><input a0="r"/><output a0="q"/></command>
<element type="polygon" label="q"/>
<command name="Sequence"><input a0="Segment[Element[r, i], Element[r, i + 1]]" a1="i" a2="1" a3="3"/><output a0="s"/></command>
<element type="list" label="s"/>
<command name="Sequence"><input a0="Polygon[(i, 0), (i + 1, 0), Translate[(i, 1), Vector[(0, 1)]]]" a1="i" a2="1" a3="2"/><output a0="p"/></command>
<element type="list" label="p"/>
</construction></geogebra>`,
            ),
        ).toEqual([]);
        const items = (name: string) =>
            (c.getObj(name) as list_object).items.map((values) =>
                values.map((value) =>
                    typeof value === "number"
                        ? value
                        : (value?.map((v) => Math.round(v * 1e9) / 1e9 || 0) ??
                          null),
                ),
            );
        expect(items("r")).toEqual([[[1, 0]], [[0, 1]], [[-1, 0]], [[0, -1]]]);
        expect((c.getObj("q") as list_object).nature).toBe("polygon");
        expect(items("s")).toEqual([
            [
                [1, 0],
                [0, 1],
            ],
            [
                [0, 1],
                [-1, 0],
            ],
            [
                [-1, 0],
                [0, -1],
            ],
        ]);
        const p = c.getObj("p") as list_object;
        expect(p.nature).toBe("polygons");
        expect(items("p")).toEqual([
            [[1, 0]],
            [[2, 0]],
            [[1, 2]],
            [null],
            [[2, 0]],
            [[3, 0]],
            [[2, 2]],
            [null],
        ]);

        const space = createConstruction();
        expect(
            importGgb(
                space,
                `<geogebra><construction>
<element type="point3d" label="A"><coords x="0" y="0" z="2" w="1"/></element>
<command name="Sequence"><input a0="Segment[A, (i, 0, 1)]" a1="i" a2="1" a3="2"/><output a0="s"/></command>
<element type="list" label="s"/>
</construction></geogebra>`,
            ),
        ).toEqual([]);
        expect((space.getObj("s") as list_object).items).toEqual([
            [
                [0, 0, 2],
                [1, 0, 1],
            ],
            [
                [0, 0, 2],
                [2, 0, 1],
            ],
        ]);
    });

    it("draws Sequences of Sequences, of circles by their radius", () => {
        const c = createConstruction();
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="point" label="A"><coords x="0" y="0" z="1"/></element>
<element type="numeric" label="m"><value val="2"/><slider min="0" max="5"/></element>
<expression label="R" exp="{0.5, 0.25}"/>
<element type="list" label="R"/>
<command name="Sequence"><input a0="Sequence[Rotate[(i, 0), j * 90°, A], j, 0, 2]" a1="i" a2="1" a3="m"/><output a0="P"/></command>
<element type="list" label="P"/>
<expression label="n" exp="Length[P]"/>
<element type="numeric" label="n"/>
<command name="Sequence"><input a0="Sequence[Circle[Element[Element[P, i], j], Element[R, j]], j, 1, 3]" a1="i" a2="1" a3="2"/><output a0="c"/></command>
<element type="list" label="c"/>
</construction></geogebra>`,
            ),
        ).toEqual([]);
        const items = (name: string) =>
            (c.getObj(name) as list_object).items.map((values) =>
                values.map((value) =>
                    typeof value === "number"
                        ? value
                        : (value?.map((v) => Math.round(v * 1e9) / 1e9 || 0) ??
                          null),
                ),
            );
        expect(items("P")).toEqual([
            [[1, 0]],
            [[0, 1]],
            [[-1, 0]],
            [[2, 0]],
            [[0, 2]],
            [[-2, 0]],
        ]);
        expect((c.getObj("n") as expression_object).value).toBe(2);
        const circles = c.getObj("c") as list_object;
        expect(circles.nature).toBe("circle");
        expect(items("c")).toEqual([
            [[1, 0], 0.5],
            [[0, 1], 0.25],
            [[-1, 0], null],
            [[2, 0], 0.5],
            [[0, 2], 0.25],
            [[-2, 0], null],
        ]);
        expect(circles.screenItems.map(([center]) => center !== null)).toEqual([
            true,
            true,
            false,
            true,
            true,
            false,
        ]);
    });

    it("imports Cercles3D's Sequence of six directed circles", async () => {
        const c = createConstruction();
        const file = await (await fetch(figure("Cercles3D.ggb"))).blob();
        expect(await importGgbFromBlob(c, file)).toEqual([]);
        const circles = c.getObj("l1") as list_object;
        expect(circles.nature).toBe("circle");
        expect(circles.items).toEqual(
            Array.from({ length: 6 }, (_, k) => [[0, 0, k], 2, [0, 0, 1]]),
        );
        expect(circles.screenItems.every((item) => item.every(Boolean))).toBe(
            true,
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(
            circles.dom
                .dom()
                .querySelector("path")!
                .getAttribute("d")!
                .match(/M/g),
        ).toHaveLength(6);
        expect(c.GRID.THETA).toBeCloseTo((20 * Math.PI) / 180, 9);
        expect(circles.stroke_color).toBe("#006400");
    });

    it("lets a circle's direction in a Sequence read the loop variable", async () => {
        const c = createConstruction();
        const xml = (await loadXml("Cercles3D")).replace(
            "Vector[(0, 0, 1)]",
            "Vector[(0, 0, k), (1, k, 2*k)]",
        );
        expect(importGgb(c, xml)).toEqual([]);
        const circles = c.getObj("l1") as list_object;
        expect(circles.items).toEqual(
            Array.from({ length: 6 }, (_, k) => [[0, 0, k], 2, [1, k, k]]),
        );
        circles.screenItems.forEach(([center, u, v], k) => {
            const normal = vNormalize([1, k, k])!;
            const x = vNormalize(vCross(normal, [0, 0, 1]))!;
            const y = vCross(normal, x);
            const origin = c.pt3D([0, 0, k]);
            expectClose(center, origin);
            // The projected ellipse's area is independent of its basis.
            const [a, b] = [x, y].map((direction) =>
                vSub(c.pt3D(vAdd([0, 0, k], vScale(direction, 2))), origin),
            );
            expect(Math.abs(u![0] * v![1] - u![1] * v![0])).toBeCloseTo(
                Math.abs(a[0] * b[1] - a[1] * b[0]),
                8,
            );
        });
    });

    it("draws Sequences of circles through a point", () => {
        const c = createConstruction();
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="point" label="A"><coords x="0" y="0" z="1"/></element>
<element type="point" label="P"><coords x="0" y="3" z="1"/></element>
<expression label="L" exp="{(4, 0), (0, 1)}"/>
<element type="list" label="L"/>
<command name="Sequence"><input a0="Circle[Element[L, i], P]" a1="i" a2="1" a3="2"/><output a0="c"/></command>
<element type="list" label="c"/>
</construction></geogebra>`,
            ),
        ).toEqual([]);
        const circles = c.getObj("c") as list_object;
        expect(circles.nature).toBe("circle");
        expect(circles.items).toEqual([
            [[4, 0], 5],
            [[0, 1], 2],
        ]);
    });

    it("expands user-defined tools", () => {
        const c = createConstruction();
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="point" label="M"><coords x="5" y="5" z="1"/></element>
<element type="point" label="P"><coords x="0" y="0" z="1"/></element>
<element type="point" label="Q"><coords x="4" y="0" z="1"/></element>
<command name="MidCircle"><input a0="P" a1="Q"/><output a0="c" a1="r"/></command>
<element type="conic" label="c"/>
<element type="numeric" label="r"/>
</construction></geogebra>`,
                undefined,
                `<geogebra><macro cmdName="MidCircle">
<macroInput a0="A" a1="B"/><macroOutput a0="k" a1="d"/>
<construction>
<element type="point" label="A"><coords x="0" y="0" z="1"/></element>
<element type="point" label="B"><coords x="1" y="0" z="1"/></element>
<command name="Midpoint"><input a0="A" a1="B"/><output a0="M"/></command>
<element type="point" label="M"><show object="true"/></element>
<command name="Circle"><input a0="M" a1="A"/><output a0="k"/></command>
<element type="conic" label="k"/>
<expression label="d" exp="Distance[A, M]"/>
<element type="numeric" label="d"/>
</construction></macro></geogebra>`,
            ),
        ).toEqual([]);
        const center = c.getObj("M_{1}") as point_object;
        expect(center.coords).toEqual([2, 0, 0]);
        expect(center.hidden).toBe(1);
        expect((c.getObj("M") as point_object).coords).toEqual([5, 5, 0]);
        expect((c.getObj("c") as circle1_object).R).toBeCloseTo(2, 12);
        expect((c.getObj("r") as expression_object).value).toBe(2);
    });

    it("shows objects under boolean conditions, reading lengths and angles", async () => {
        const c = createConstruction();
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="point" label="A"><coords x="0" y="0" z="1"/></element>
<element type="point" label="B"><coords x="2" y="0" z="1"/></element>
<element type="point" label="O"><coords x="0" y="1" z="1"/></element>
<command name="Segment"><input a0="A" a1="B"/><output a0="s"/></command>
<element type="segment" label="s"/>
<command name="Angle"><input a0="B" a1="A" a2="O"/><output a0="α"/></command>
<element type="angle" label="α"/>
<element type="boolean" label="o"><value val="false"/></element>
<expression label="near" exp="s &lt; 3"/>
<element type="boolean" label="near"><value val="true"/></element>
<element type="point" label="C"><coords x="1" y="1" z="1"/><condition showObject="¬o ∧ near"/></element>
<element type="point" label="D"><coords x="1" y="2" z="1"/><condition showObject="o ≟ false ∧ α ≟ 90°"/></element>
<element type="point" label="E"><coords x="1" y="3" z="1"/><condition showObject="¬near"/></element>
</construction></geogebra>`,
            ),
        ).toEqual([]);
        const visible = async (): Promise<boolean[]> => {
            await new Promise((resolve) => requestAnimationFrame(resolve));
            return ["C", "D", "E"].map((name) => c.getObj(name)!.isVisible);
        };
        const near = c.getObj("near") as expression_object;
        expect([near.checkbox, near.program !== null]).toEqual([true, true]);
        expect(await visible()).toEqual([true, true, false]);

        const o = c.getObj("o") as expression_object;
        o.value = 1;
        c.invalidateGeometry(o);
        expect(await visible()).toEqual([false, false, false]);

        const b = c.getObj("B") as point_object;
        b.coords = [4, 0, 0];
        c.invalidateGeometry(b);
        expect(await visible()).toEqual([false, false, true]);
    });

    it("places points at the graphics view's corners", async () => {
        const c = createConstruction();
        expect(
            importGgb(
                c,
                `<geogebra><construction>
${["1", "2", "3", "4", "5", "1, 3"]
    .map(
        (n, index) =>
            `<command name="Corner"><input ${n
                .split(", ")
                .map((arg, a) => `a${a}="${arg}"`)
                .join(
                    " ",
                )}/><output a0="C${index}"/></command><element type="point" label="C${index}"/>`,
    )
    .join("\n")}
<expression label="w" exp="x(Corner[2]) - x(Corner[1])"/>
<element type="numeric" label="w"><value val="0"/></element>
</construction></geogebra>`,
            ),
        ).toEqual([]);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const { unit, origin, width, height } = c.formulaView();
        const [left, right] = [0, width].map((x) => (x - origin[0]) / unit);
        const [top, bottom] = [0, height].map((y) => (origin[1] - y) / unit);
        [
            [left, bottom],
            [right, bottom],
            [right, top],
            [left, top],
            [width, height],
            [right, top],
        ].forEach((expected, index) =>
            expected.forEach((value, axis) =>
                expect(
                    (c.getObj(`C${index}`) as point_object).coords[axis],
                ).toBeCloseTo(value, 9),
            ),
        );
        expect((c.getObj("w") as expression_object).value).toBeCloseTo(
            width / unit,
            9,
        );
    });

    it("builds the usual triangle centers", () => {
        const c = createConstruction();
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="point" label="A"><coords x="0" y="0" z="1"/></element>
<element type="point" label="B"><coords x="4" y="0" z="1"/></element>
<element type="point" label="C"><coords x="0" y="3" z="1"/></element>
${[1, 2, 3, 4, 5]
    .map(
        (n) =>
            `<command name="TriangleCenter"><input a0="A" a1="B" a2="C" a3="${n}"/><output a0="X${n}"/></command><element type="point" label="X${n}"/>`,
    )
    .join("\n")}
</construction></geogebra>`,
            ),
        ).toEqual([]);
        // The right angle at A: the orthocenter, and the hypotenuse's
        // midpoint as circumcenter.
        [
            [1, 1],
            [4 / 3, 1],
            [2, 1.5],
            [0, 0],
            [1, 0.75],
        ].forEach((expected, index) =>
            expected.forEach((value, axis) =>
                expect(
                    (c.getObj(`X${index + 1}`) as point_object).coords[axis],
                ).toBeCloseTo(value, 9),
            ),
        );
    });

    it("calls the figure's functions in its formulas", async () => {
        const c = createConstruction();
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="numeric" label="a"><value val="1"/></element>
<element type="point" label="A"><coords x="2" y="0" z="1"/></element>
<expression label="f" exp="f(x) = x^(2) + a"/>
<element type="function" label="f"/>
<expression label="g" exp="g(x) = f(x) - f(x - 1)"/>
<element type="function" label="g"/>
<command name="If"><input a0="x ≥ 1" a1="x" a2="0"/><output a0="h"/></command>
<element type="function" label="h"/>
<expression label="M" exp="(x(A), f(x(A)))" type="point"/>
<element type="point" label="M"><coords x="2" y="5" z="1"/></element>
<expression label="N" exp="(g(3), h(x(A)) + h(0))" type="point"/>
<element type="point" label="N"><coords x="5" y="2" z="1"/></element>
<expression label="T" exp="&quot;f(3) = &quot; + f(3)"/>
<element type="text" label="T"><startPoint x="0" y="0" z="1"/></element>
</construction></geogebra>`,
            ),
        ).toEqual([]);
        const coords = (name: string) =>
            (c.getObj(name) as point_object).coords.slice(0, 2);
        expect(coords("M")).toEqual([2, 5]);
        expect(coords("N")).toEqual([5, 2]);
        expect((c.getObj("T") as text_object).content).toBe("f(3) = 10");

        const a = c.getObj("a") as expression_object;
        a.value = 3;
        c.invalidateGeometry(a);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(coords("M")).toEqual([2, 7]);
    });

    it("reads chained comparisons as GeoGebra does", async () => {
        const c = createConstruction();
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="numeric" label="s"><value val="2"/></element>
<expression label="f" exp="f(x) = If[0 ≤ x ≤ 2, x + s, -1]"/>
<element type="function" label="f"/>
<expression label="b" exp="1.5 &lt; s &lt; 2.5 ∧ 3 ≥ s &gt; (1 &lt; 0)"/>
<element type="boolean" label="b"><value val="true"/></element>
<expression label="M" exp="(f(1), f(3))" type="point"/>
<element type="point" label="M"><coords x="3" y="-1" z="1"/></element>
</construction></geogebra>`,
            ),
        ).toEqual([]);
        const b = c.getObj("b") as expression_object;
        const M = c.getObj("M") as point_object;
        expect([b.value, ...M.coords.slice(0, 2)]).toEqual([1, 3, -1]);

        const s = c.getObj("s") as expression_object;
        s.value = 3;
        c.invalidateGeometry(s);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect([b.value, ...M.coords.slice(0, 2)]).toEqual([0, 4, -1]);
    });

    it("computes GeoGebra's other mathematical functions", () => {
        const c = createConstruction();
        const values: [string, number][] = [
            ["exp(1)", Math.E],
            ["ln(ℯ)", 1],
            ["log(2, 8)", 3],
            ["round(2.345, 2)", 2.35],
            ["ceil(1.2) + 2 * sgn(-3)", 0],
            ["cot(π / 4)", 1],
            ["min(1, 2) + Max({3, 5, 4})", 6],
            ["Mod(-7, 5)", 3],
        ];
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="numeric" label="o"><value val="0"/></element>
${values
    .map(
        ([exp], index) =>
            `<expression label="n${index}" exp="${exp} + 0 * o"/><element type="numeric" label="n${index}"><value val="0"/></element>`,
    )
    .join("\n")}
<element type="numeric" label="a"><value val="-7"/></element>
<command name="Mod"><input a0="a" a1="5"/><output a0="m"/></command>
<element type="numeric" label="m"/>
<command name="Min"><input a0="{a, 1}"/><output a0="p"/></command>
<element type="numeric" label="p"/>
</construction></geogebra>`,
            ),
        ).toEqual([]);
        values.forEach(([, value], index) =>
            expect(
                (c.getObj(`n${index}`) as expression_object).value,
            ).toBeCloseTo(value, 9),
        );
        expect(
            ["m", "p"].map(
                (name) => (c.getObj(name) as expression_object).value,
            ),
        ).toEqual([3, -7]);
    });

    it("builds lines and conics given by an equation", async () => {
        const c = createConstruction();
        const conic = (label: string, exp: string | null, matrix: number[]) =>
            `${exp ? `<expression label="${label}" exp="${exp}" type="conic"/>` : ""}<element type="conic" label="${label}"><matrix ${matrix.map((value, index) => `A${index}="${value}"`).join(" ")}/></element>`;
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="numeric" label="a"><value val="2"/></element>
<expression label="d" exp="y = (a * x) + 1" type="line"/>
<element type="line" label="d"><coords x="-2" y="1" z="-1"/></element>
<expression label="v" exp="x = a" type="line"/>
<element type="line" label="v"><coords x="1" y="0" z="-2"/></element>
<element type="line" label="w"><coords x="1" y="1" z="-2"/></element>
${conic("ell", "x^(2) / a^(2) + y^(2) = 1", [0.25, 1, -1, 0, 0, 0])}
${conic("hyp", "y^(2) - x^(2) = a", [-1, 1, -2, 0, 0, 0])}
${conic("hyp2", "x^(2) - y^(2) = -a", [-1, 1, -2, 0, 0, 0])}
${conic("par", "y = x^(2) + (a * x)", [-1, 0, 0, 0, -1, 0.5])}
${conic("side", "y^(2) = (8 * x)", [0, 1, 0, 0, -4, 0])}
${conic("tilted", "x * y = a", [0, 0, -2, 0.5, 0, 0])}
${conic("fixed", null, [0.25, 1, -1, 0, 0, 0])}
${conic("circle", "(x - a)^(2) + y^(2) = 4", [1, 1, 0, 0, -2, 0])}
</construction></geogebra>`,
            ),
        ).toEqual([]);
        // Objects of their equation, read by a, without objects in between.
        (
            [
                ["d v", equation_line_object, true],
                ["w", equation_line_object, false],
                ["ell hyp hyp2 par tilted", equation_conic_object, true],
                ["side fixed", equation_conic_object, false],
                ["circle", equation_circle_object, true],
            ] as const
        ).forEach(([labels, kind, read]) =>
            labels.split(" ").forEach((label) => {
                const object = c.getObj(label)!;
                expect(object, label).toBeInstanceOf(kind);
                expect(
                    object.parents.filter((parent) =>
                        c.OBJS.V.includes(parent),
                    ),
                ).toEqual(read ? [c.getObj("a")] : []);
            }),
        );
        // a·x² + b·xy + c·y² + d·x + e·y + f, and A·x + B·y + C, as each
        // object's own ones, up to a factor.
        const expectLine = (name: string, [A, B, C]: number[]) => {
            const line = c.getObj(name) as primitive_line_object;
            const [x, y] = line.P1.coords;
            expect(A * x + B * y + C).toBeCloseTo(0, 9);
            expect(A * line.VEC[0] + B * line.VEC[1]).toBeCloseTo(0, 9);
        };
        const expectConic = (name: string, expected: number[]) => {
            const coeffs = (c.getObj(name) as primitive_quadric_object).COEFFS!;
            const index = expected.findIndex((value) => value !== 0);
            const k = coeffs[index] / expected[index];
            coeffs.forEach((value, i) =>
                expect(value).toBeCloseTo(k * expected[i], 9),
            );
        };
        const check = (a: number) => {
            expectLine("d", [a, -1, 1]);
            expectLine("v", [1, 0, -a]);
            expectLine("w", [1, 1, -2]);
            expectConic("ell", [1 / a ** 2, 0, 1, 0, 0, -1]);
            expectConic("hyp", [-1, 0, 1, 0, 0, -a]);
            expectConic("hyp2", [1, 0, -1, 0, 0, a]);
            expectConic("par", [-1, 0, 0, -a, 1, 0]);
            expectConic("side", [0, 0, 1, -8, 0, 0]);
            expectConic("tilted", [0, 1, 0, 0, 0, -a]);
            expectConic("fixed", [0.25, 0, 1, 0, 0, -1]);
            const circle = c.getObj("circle") as equation_circle_object;
            expect(circle.R).toBeCloseTo(2, 9);
            expect(circle.CENTER[0]).toBeCloseTo(a, 9);
        };
        check(2);

        const a = c.getObj("a") as expression_object;
        a.value = 3;
        c.invalidateGeometry(a);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        check(3);
    });

    it("writes names, angles, points and fractions in texts", async () => {
        const c = createConstruction();
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="point" label="A"><coords x="1.2345" y="2" z="1"/></element>
<element type="point" label="B"><coords x="0" y="0" z="1"/></element>
<element type="point" label="C"><coords x="0" y="1" z="1"/></element>
<element type="numeric" label="a"><value val="3"/></element>
<command name="Angle"><input a0="A" a1="B" a2="C"/><output a0="α"/></command>
<element type="angle" label="α"/>
<expression label="t" exp="Name[A] + (Name[B]) + &quot; : &quot; + A + &quot;, &quot; + α"/>
<element type="text" label="t"><startPoint exp="B + (0, 1)"/></element>
<command name="Text"><input a0="abs(x(A))" a1="A - (0, 0.6)"/><output a0="u"/></command>
<element type="text" label="u"/>
<command name="FractionText"><input a0="a / 4"/><output a0="f"/></command>
<element type="text" label="f"><isLaTeX val="true"/><startPoint x="0" y="0" z="1"/></element>
<expression label="g" exp="FractionText[-a / 2] + &quot; = &quot; + FractionText[sqrt(2) + a - a] + FractionText[a]"/>
<element type="text" label="g"><isLaTeX val="true"/><startPoint x="0" y="0" z="1"/></element>
</construction></geogebra>`,
            ),
        ).toEqual([]);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const [t, u] = ["t", "u"].map((name) => c.getObj(name) as text_object);
        expect(t.content).toBe(
            `AB : (1.23, 2), ${Math.round(((Math.atan2(1, 0) - Math.atan2(2, 1.2345)) * 18000) / Math.PI) / 100}°`,
        );
        expect(t.anchor.coords.slice(0, 2)).toEqual([0, 1]);
        expect(u.content).toBe("1.23");
        expect(u.anchor.coords[1]).toBeCloseTo(1.4, 9);
        expect((c.getObj("f") as expression_object).value).toBe(
            " \\frac{ 3 }{ 4 } ",
        );
        expect((c.getObj("g") as expression_object).value).toBe(
            " \\frac{ -3 }{ 2 }  =  \\frac{ 19601 }{ 13860 } 3",
        );
    });

    it("computes tangents, slopes, lengths, derivatives and integrals", async () => {
        const c = createConstruction();
        const point = (label: string, x: number, y: number) =>
            `<element type="point" label="${label}"><coords x="${x}" y="${y}" z="1"/></element>`;
        const command = (name: string, inputs: string[], outputs: string[]) =>
            `<command name="${name}"><input ${inputs.map((input, index) => `a${index}="${input}"`).join(" ")}/><output ${outputs.map((output, index) => `a${index}="${output}"`).join(" ")}/></command>`;
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="numeric" label="a"><value val="1"/></element>
${point("A", 1, 0)}
${point("B", 3, 0)}
<expression label="f" exp="f(x) = a * x^(2)"/>
<element type="function" label="f"/>
${command("Tangent", ["A", "f"], ["t"])}
<element type="line" label="t"/>
${command("Slope", ["t"], ["m"])}
<element type="numeric" label="m"><show object="true"/><objColor r="0" g="0" b="0" alpha="0.1"/></element>
${command("Derivative", ["f"], ["f'"])}
<element type="function" label="f'"/>
<expression label="D" exp="(f'(2), Slope[t])" type="point"/>
<element type="point" label="D"/>
${command("Integral", ["f", "0", "x(B)"], ["I"])}
<element type="numeric" label="I"/>
${command("LowerSum", ["f", "0", "1", "4"], ["L"])}
<element type="numeric" label="L"/>
${command("UpperSum", ["x^(2)", "0", "1", "4"], ["U"])}
<element type="numeric" label="U"/>
${command("Function", ["f", "-1", "a"], ["g"])}
<element type="function" label="g"/>
${command("Length", ["Vector[A, B]"], ["n"])}
<element type="numeric" label="n"/>
<expression label="k" exp="Length[{1, a, 3}] + Length[(3, 4 * a)]"/>
<element type="numeric" label="k"/>
${point("O", 0, 0)}
${command("Circle", ["O", "A"], ["c"])}
<element type="conic" label="c"/>
${command("Tangent", ["A", "c"], ["u", ""])}
<element type="line" label="u"/>
${point("P", 0, 2)}
${command("Tangent", ["P", "c"], ["v", "w"])}
<element type="line" label="v"/><element type="line" label="w"/>
</construction></geogebra>`,
            ),
        ).toEqual([]);
        const value = (name: string) =>
            (c.getObj(name) as expression_object).value as number;
        // Whether a line passes through (x, y) along (dx, dy).
        const expectLine = (name: string, [x, y]: Vec2, [dx, dy]: Vec2) => {
            const line = c.getObj(name) as primitive_line_object;
            const [px, py] = line.P1.coords;
            expect((px - x) * dy - (py - y) * dx).toBeCloseTo(0, 6);
            expect(line.VEC[0] * dy - line.VEC[1] * dx).toBeCloseTo(0, 6);
        };
        const check = (a: number) => {
            expectLine("t", [1, a], [1, 2 * a]);
            expect(value("m")).toBeCloseTo(2 * a, 6);
            const D = (c.getObj("D") as point_object).coords;
            expect(D[0]).toBeCloseTo(4 * a, 6);
            expect(D[1]).toBeCloseTo(2 * a, 6);
            expect(value("I")).toBeCloseTo(9 * a, 9);
            expect(value("L")).toBeCloseTo((14 / 64) * a, 9);
            expect(value("U")).toBeCloseTo(30 / 64, 9);
            const g = c.getObj("g") as curve_object;
            expect(g.pointAt(0.5)![1]).toBeCloseTo(a / 4, 9);
            expect(g.pointAt(a + 0.1)).toBe(null);
        };
        check(1);
        expect(value("n")).toBe(2);
        expect(value("k")).toBe(8);
        expectLine("u", [1, 0], [0, 1]);
        // From (0, 2), the tangents to the unit circle have slopes ±√3.
        const slopes = ["v", "w"].map((name) => {
            const line = c.getObj(name) as primitive_line_object;
            expectLine(name, [0, 2], [line.VEC[0], line.VEC[1]]);
            return line.VEC[1] / line.VEC[0];
        });
        expect(slopes[0] * slopes[1]).toBeCloseTo(-3, 6);
        expect(Math.abs(slopes[0])).toBeCloseTo(Math.sqrt(3), 6);

        const a = c.getObj("a") as expression_object;
        a.value = 2;
        c.invalidateGeometry(a);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        check(2);
    });

    it("keeps the random values GeoGebra saved, drawing the others", () => {
        const c = createConstruction();
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<command name="Random"><input a0="1" a1="6"/><output a0="r"/></command>
<element type="numeric" label="r"><value val="4"/></element>
<expression label="h" exp="Random[1, 10] / 2"/>
<element type="numeric" label="h"><value val="1.5"/></element>
<command name="RandomElement"><input a0="{2, 3}"/><output a0="e"/></command>
<element type="numeric" label="e"><value val="3"/></element>
<expression label="A" exp="(Random[-4, 4], Random[-4, 4])" type="point"/>
<element type="point" label="A"><coords x="0" y="1" z="1"/></element>
<command name="Shuffle"><input a0="{&quot;M&quot;, &quot;F&quot;, &quot;X&quot;}"/><output a0="l" randomResult="{&quot;F&quot;, &quot;X&quot;, &quot;M&quot;}"/></command>
<element type="list" label="l"/>
<expression label="T" exp="Element[l, 2] + r"/>
<element type="text" label="T"><startPoint x="0" y="0" z="1"/></element>
<command name="RandomElement"><input a0="l"/><output a0="W"/></command>
<element type="text" label="W"><startPoint x="0" y="0" z="1"/></element>
<expression label="f" exp="f(x) = Random[2, 3] * x"/>
<element type="function" label="f"/>
</construction></geogebra>`,
            ),
        ).toEqual([]);
        expect(
            ["r", "h", "e"].map(
                (name) => (c.getObj(name) as expression_object).value,
            ),
        ).toEqual([4, 1.5, 3]);
        expect((c.getObj("A") as point_object).coords.slice(0, 2)).toEqual([
            0, 1,
        ]);
        expect((c.getObj("T") as text_object).content).toBe("X4");
        expect(["M", "F", "X"]).toContain(
            (c.getObj("W") as text_object).content,
        );
        expect([2, 3]).toContain(
            (c.getObj("f") as curve_object).pointAt(1)![1],
        );
    });

    it("builds solids on polygons, cones, planes by equation and 3D rotations", async () => {
        const c = createConstruction();
        const point = (label: string, [x, y, z]: Vec3) =>
            `<element type="point3d" label="${label}"><coords x="${x}" y="${y}" z="${z}" w="1"/></element>`;
        const command = (name: string, inputs: string[], outputs: string[]) =>
            `<command name="${name}"><input ${inputs.map((input, index) => `a${index}="${input}"`).join(" ")}/><output ${outputs.map((output, index) => `a${index}="${output}"`).join(" ")}/></command>`;
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="numeric" label="h"><value val="2"/></element>
${point("A", [-2, 2, 0])}
${point("B", [2, 2, 0])}
${point("C", [2, -2, 0])}
${point("D", [-2, -2, 0])}
${command("Polygon", ["A", "B", "C", "D"], ["poly", "a", "b", "c", "d"])}
${command("Prism", ["poly", "h"], ["P", "I", "J", "K", "L", "f1", "f2", "f3", "f4", "top", "e1"])}
${point("S", [0, 0, 5])}
${command("Pyramid", ["poly", "S"], ["Q", "F1", "F2", "F3", "F4", "s1", "s2", "s3", "s4"])}
${command("Pyramid", ["poly", "3"], ["R", "T", "t1"])}
${point("O", [0, 0, 0])}
${command("Cone", ["O", "S", "h"], ["V", "base", "side"])}
<element type="quadricpart" label="side"/>
<expression label="p" exp="z = h + 1" type="plane"/>
<element type="plane3d" label="p"/>
<element type="plane3d" label="q"><coords x="1" y="0" z="0" w="-3"/></element>
${command("Line", ["A", "B"], ["l"])}
${point("M", [0, 0, 1])}
${command("OrthogonalLine", ["M", "l", "space"], ["m"])}
${command("Rotate", ["B", "90°", "zAxis"], ["B1"])}
${command("Vector", ["O", "S"], ["u"])}
${command("Rotate", ["B", "90°", "A", "u"], ["B2"])}
${command("Translate", ["Q", "u"], ["Q1"])}
<element type="polyhedron" label="Q1"/>
</construction></geogebra>`,
            ),
        ).toEqual([]);
        const coords = (name: string) => [
            ...(c.getObj(name) as point_object).coords,
        ];
        const expectPoint = (name: string, expected: Vec3) =>
            coords(name).forEach((value, axis) =>
                expect(value, name).toBeCloseTo(expected[axis], 9),
            );
        expectPoint("I", [-2, 2, 2]);
        expectPoint("K", [2, -2, 2]);
        expectPoint("T", [0, 0, 3]);
        expect((c.getObj("top") as polygon_object).points).toHaveLength(4);
        expect(
            (c.getObj("F1") as polygon_object).points.map(
                (vertex) => vertex.name,
            ),
        ).toEqual(["A", "B", "S"]);
        expect((c.getObj("s1") as segment_object).P2.name).toBe("S");
        expect((c.getObj("t1") as polygon_object).points[2].name).toBe("T");
        const base = c.getObj("base") as disk_object;
        expectClose(base.CENTER, [0, 0, 0]);
        expect(base.R).toBeCloseTo(2, 9);
        expect(base.solid.cone).toBe(true);
        ["p", "q"].forEach((name, index) =>
            (c.getObj(name) as polygon_object).points.forEach((corner) =>
                expect(corner.coords[index ? 0 : 2]).toBeCloseTo(3, 9),
            ),
        );
        const m = c.getObj("m") as primitive_line_object;
        expect(vDot(m.VEC, [1, 0, 0])).toBeCloseTo(0, 9);
        expect(Math.abs(vDot(m.VEC, vNormalize([0, 2, -1])!))).toBeCloseTo(
            1,
            9,
        );
        expectPoint("B1", [-2, 2, 0]);
        expectPoint("B2", [-2, 6, 0]);
        // The translated pyramid's lateral faces meet at S + u.
        expect(
            c.OBJS.V.filter(
                (object) =>
                    object instanceof polygon_object &&
                    object.points.some(
                        (vertex) =>
                            vNorm(vSub(vertex.coords, [0, 0, 10])) < 1e-9,
                    ),
            ),
        ).toHaveLength(4);

        const h = c.getObj("h") as expression_object;
        h.value = 1;
        c.invalidateGeometry(h);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expectPoint("I", [-2, 2, 1]);
        (c.getObj("p") as polygon_object).points.forEach((corner) =>
            expect(corner.coords[2]).toBeCloseTo(2, 9),
        );
    });

    it("builds Cube(A, B, p) only while AB is parallel to p, as GeoGebra", async () => {
        const c = createConstruction();
        importGgb(
            c,
            `<geogebra><construction>
<element type="point3d" label="A"><coords x="0" y="0" z="0" w="1"/></element>
<element type="point3d" label="B"><coords x="1" y="0" z="0" w="1"/></element>
<expression label="p" exp="z = 0" type="plane"/>
<element type="plane3d" label="p"/>
<command name="Cube"><input a0="A" a1="B" a2="p"/><output a0="k" a1="C" a2="D" a3="E"/></command>
</construction></geogebra>`,
        );
        const vertex = (name: string) => c.getObj(name) as point_object;
        expectClose(vertex("C").coords, [1, 1, 0]);
        expectClose(vertex("E").coords, [0, 0, 1]);
        const b = vertex("B");
        b.coords = [1, 0, 1e-7];
        c.invalidateGeometry(b);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(vertex("C").defined).toBe(false);
    });

    it("reads GeoGebra's list commands", async () => {
        const c = createConstruction();
        const list = (label: string, name: string, inputs: string[]) =>
            `<command name="${name}"><input ${inputs.map((input, index) => `a${index}="${input}"`).join(" ")}/><output a0="${label}"/></command><element type="list" label="${label}"/>`;
        const values: [string, number][] = [
            ["Sum(s)", 15],
            ["Sum(t)", 9],
            ["Sum(f) + 10 * Length(f)", 23],
            ["Sum(e) + Length(e)", 11],
            ["Sum(k) + 10 * k(1)", 29],
        ];
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="numeric" label="a"><value val="4"/></element>
${list("s", "Sequence", ["5"])}
${list("t", "Sequence", ["2", "a"])}
${list("f", "First", ["s", "2"])}
${list("e", "Last", ["s", "2"])}
${list("k", "Take", ["s", "2", "a"])}
${values
    .map(
        ([exp], index) =>
            `<expression label="n${index}" exp="${exp}"/><element type="numeric" label="n${index}"><value val="0"/></element>`,
    )
    .join("\n")}
</construction></geogebra>`,
            ),
        ).toEqual([]);
        const check = () =>
            values.forEach(([exp, value], index) =>
                expect(
                    (c.getObj(`n${index}`) as expression_object).value,
                    exp,
                ).toBeCloseTo(value, 9),
            );
        check();

        const a = c.getObj("a") as expression_object;
        a.value = 5;
        c.invalidateGeometry(a);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        values[1][1] = 14;
        values[4][1] = 34;
        check();
    });

    it("reads Mode, Roots, Point(A, v) and UnitVector as GeoGebra computes them", () => {
        const c = createConstruction();
        const values: [string, number][] = [
            ["Sum(m) + 10 * Length(m) + 100 * m(1)", 225],
            ["Length(o)", 0],
            ["x(R_1) + 2 * x(R_2)", Math.SQRT2],
            ["x(UnitVector(s)) + 2 * y(UnitVector(s))", 1],
            ["y(UnitVector(l)) * sqrt(5)", -1],
        ];
        expect(
            importGgb(
                c,
                `<geogebra><construction>
<element type="point" label="A"><coords x="0" y="0" z="1"/></element>
<element type="point" label="B"><coords x="4" y="0" z="1"/></element>
<command name="Segment"><input a0="A" a1="B"/><output a0="s"/></command>
<element type="segment" label="s"/>
<element type="line" label="l"><coords x="1" y="2" z="-3"/></element>
<command name="Mode"><input a0="{3, 3, 2, 2, 5}"/><output a0="m"/></command>
<element type="list" label="m"/>
<command name="Mode"><input a0="{1, 2, 3}"/><output a0="o"/></command>
<element type="list" label="o"/>
<expression label="f" exp="f(x) = x^(2) - 2"/>
<element type="function" label="f"/>
<command name="Roots"><input a0="f" a1="-3" a2="3"/><output a0="R_1" a1="R_2"/></command>
<element type="point" label="R_1"><coords x="0" y="0" z="1"/></element>
<element type="point" label="R_2"><coords x="0" y="0" z="1"/></element>
<command name="Point"><input a0="A" a1="Vector[(1, 2)]"/><output a0="U"/></command>
<element type="point" label="U"><coords x="1" y="2" z="1"/></element>
${values
    .map(
        ([exp], index) =>
            `<expression label="n${index}" exp="${exp}"/><element type="numeric" label="n${index}"><value val="0"/></element>`,
    )
    .join("\n")}
</construction></geogebra>`,
            ),
        ).toEqual([]);
        values.forEach(([exp, value], index) =>
            expect(
                (c.getObj(`n${index}`) as expression_object).value,
                exp,
            ).toBeCloseTo(value, 9),
        );
        expect((c.getObj("U") as point_object).coords).toEqual([1, 2, 0]);
    });

    it("reports what it can't import instead of failing", () => {
        const c = createConstruction();
        const unsupported = importGgb(
            c,
            `<geogebra><construction>
<element type="point" label="A"><coords x="1" y="2" z="1"/></element>
<command name="Barycenter"><input a0="A" a1="(1, 0)"/><output a0="B"/></command>
<element type="point" label="B"><coords x="2" y="2" z="1"/></element>
<command name="Midpoint"><input a0="A" a1="B"/><output a0="M"/></command>
<element type="point" label="M"><coords x="1.5" y="2" z="1"/></element>
</construction></geogebra>`,
        );
        expect(unsupported).toEqual([
            "Barycenter(A, (1, 0))",
            "Midpoint(A, B)",
        ]);
        expect(c.getObj("A")).toBeInstanceOf(point_object);
        expect(c.getObj("B")).toBeUndefined();
    });
});
