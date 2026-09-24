import { afterEach, describe, expect, it } from "vitest";
import { construction } from "../../src/construction";
import { importGgb } from "../../src/ggb_importer";
import { readZipEntry } from "../../src/import/ggb_zip";
import { arc3pts_object } from "../../src/objects/arc3pts_object";
import { circle1_object } from "../../src/objects/circle1_object";
import { curve_object } from "../../src/objects/curve_object";
import { expression_object } from "../../src/objects/expression_object";
import { fixed_point_object } from "../../src/objects/fixed_point_object";
import { locus_object } from "../../src/objects/locus_object";
import { point_on_object } from "../../src/objects/point_on_object";
import { point_object } from "../../src/objects/point_object";
import { polygon_object } from "../../src/objects/polygon_object";
import { two_points_line_object } from "../../src/objects/two_points_line_object";
import { preferences } from "../../src/preferences";
import type { primitive_circle_object } from "../../src/objects/primitive_circle_object";
import type { primitive_quadric_object } from "../../src/objects/primitive_quadric_object";
import { vAdd, vDot, vNorm, vSub } from "../../src/vec";

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
    ])("rebuilds every saved point of %s", async (name) => {
        const c = createConstruction();
        const xml = await loadXml(name);

        expect(importGgb(c, xml)).toEqual([]);
        expectSavedPoints(c, xml);
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
