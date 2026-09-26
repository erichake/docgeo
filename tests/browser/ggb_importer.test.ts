import { afterEach, describe, expect, it } from "vitest";
import { construction } from "../../src/construction";
import { importGgb } from "../../src/ggb_importer";
import { readZipEntry } from "../../src/import/ggb_zip";
import { angle_object } from "../../src/objects/angle_object";
import { arc3pts_object } from "../../src/objects/arc3pts_object";
import { circle1_object } from "../../src/objects/circle1_object";
import { curve_object } from "../../src/objects/curve_object";
import { cylinder_intersection_object } from "../../src/objects/cylinder_intersection_object";
import { cylinder_section_object } from "../../src/objects/cylinder_section_object";
import { expression_object } from "../../src/objects/expression_object";
import { fixed_point_object } from "../../src/objects/fixed_point_object";
import { iteration_object } from "../../src/objects/iteration_object";
import { list_object } from "../../src/objects/list_object";
import { locus_object } from "../../src/objects/locus_object";
import { point_on_object } from "../../src/objects/point_on_object";
import { point_object } from "../../src/objects/point_object";
import { polygon_object } from "../../src/objects/polygon_object";
import { segment_object } from "../../src/objects/segment_object";
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
    const response = await fetch(`/tests/ggb/${name}.ggb`);
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
        const arcs = labels.map((label) => c.getObj(label) as arc3pts_object);
        arcs.forEach((arc, index) => {
            const matrix = document.querySelector(
                `element[label="${labels[index]}"] > matrix`,
            )!;
            const [a2, a4, a5] = ["A2", "A4", "A5"].map((name) =>
                Number(matrix.getAttribute(name)),
            );
            expect(arc).toBeInstanceOf(arc3pts_object);
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
        expect(g.P2.coords[1]).toBeGreaterThan(g.CENTER[1]);
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

        const line = c.getObj("f") as two_points_line_object;
        expect(line).toBeInstanceOf(two_points_line_object);
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
        const ends = [line.P1.coords, line.P2.coords];
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
            (name) => c.getObj(name) as polygon_object,
        );
        expect(bottom.opacity).toBeCloseTo(0.4, 6);
        expect(top.outline.getAtt("d")).toMatch(/^M/);
        const b = c.getObj("B") as point_on_object;
        const [x, y] = c.pt3D([0, 0, 2]);
        b.mousedrag(
            new PointerEvent("pointermove", { clientX: x, clientY: y }),
        );
        await new Promise((resolve) => requestAnimationFrame(resolve));

        [
            [bottom, "A"],
            [top, "B"],
        ].forEach(([disk, name]) => {
            const center = (c.getObj(name as string) as point_object).coords;
            const vertices = (disk as polygon_object).points;
            expect(vertices).toHaveLength(60);
            vertices.forEach((vertex) => {
                const offset = vSub(vertex.coords, center);
                expect(vNorm(offset)).toBeCloseTo(2, 9);
                expect(offset[2]).toBeCloseTo(0, 9);
            });
        });
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
        const at = (t: number) =>
            vAdd(
                section.CENTER,
                vAdd(
                    vScale(section.U, Math.cos(t)),
                    vScale(section.V, Math.sin(t)),
                ),
            );
        const expectOnSide = (t: number) => {
            const x = at(t);
            expect(vDot(vSub(x, point("C")), normal)).toBeCloseTo(0, 9);
            expect(Math.hypot(x[0] - g[0], x[1] - g[1])).toBeCloseTo(1, 9);
            expect(x[2]).toBeGreaterThanOrEqual(-1e-9);
            expect(x[2]).toBeLessThanOrEqual(top + 1e-9);
        };
        expect(section.arcs).toHaveLength(1);
        const [[start, end]] = section.arcs;
        expect(end - start).toBeCloseTo(2 * Math.PI, 9);
        [0, 1, 2, 3].forEach((k) => expectOnSide(k));

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
        const [[first, last]] = section.arcs;
        expect(last - first).toBeLessThan(2 * Math.PI);
        expect(at(first)[2]).toBeCloseTo(top, 9);
        expect(at(last)[2]).toBeCloseTo(top, 9);
        [0, 0.25, 0.5, 0.75, 1].forEach((k) =>
            expectOnSide(first + k * (last - first)),
        );

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
        const vector = c.getObj("u") as vector_object;
        expect(vector).toBeInstanceOf(vector_object);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(vector.tipPath2.getAtt("d")).toMatch(/^M/);

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
            ["faceABCD", "C", "face61", "edge191", "face37", "U_3"].filter(
                (name) => c.getObj(name)!.isVisible,
            );
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

    it("leaves edges already drawn by a segment to that segment", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("cube"));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const face = c.getObj("faceABCD") as polygon_object;
        expect(face.outline.getAtt("d")?.trim()).toBe("");
        expect(face.hiddenOutline.getAtt("d")?.trim()).toBe("");
    });

    it("reports what it can't import instead of failing", () => {
        const c = createConstruction();
        const unsupported = importGgb(
            c,
            `<geogebra><construction>
<element type="point" label="A"><coords x="1" y="2" z="1"/></element>
<command name="Translate"><input a0="A" a1="(1, 0)"/><output a0="B"/></command>
<element type="point" label="B"><coords x="2" y="2" z="1"/></element>
<command name="Midpoint"><input a0="A" a1="B"/><output a0="M"/></command>
<element type="point" label="M"><coords x="1.5" y="2" z="1"/></element>
</construction></geogebra>`,
        );
        expect(unsupported).toEqual(["Translate(A, (1, 0))", "Midpoint(A, B)"]);
        expect(c.getObj("A")).toBeInstanceOf(point_object);
        expect(c.getObj("B")).toBeUndefined();
    });
});
