import { afterEach, describe, expect, it } from "vitest";
import { construction } from "../../src/construction";
import { importGgb } from "../../src/ggb_importer";
import { readZipEntry } from "../../src/import/ggb_zip";
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
        .querySelectorAll('construction > element[type="point"]')
        .forEach((element) => {
            const coords = element.querySelector("coords")!;
            const [x, y, z] = ["x", "y", "z"].map((name) =>
                Number(coords.getAttribute(name)),
            );
            const point = c.getObj(element.getAttribute("label")!);
            expect(point, element.getAttribute("label")!).toBeInstanceOf(
                point_object,
            );
            expect((point as point_object).x).toBeCloseTo(x / z, 9);
            expect((point as point_object).y).toBeCloseTo(y / z, 9);
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

    it("builds nested commands as hidden auxiliary objects", async () => {
        const c = createConstruction();
        importGgb(c, await loadXml("transform"));

        const locus = c.getObj("L") as locus_object;
        expect(locus).toBeInstanceOf(locus_object);
        expect(locus.parents[0].isHidden).toBe(true);
        expect(c.getObj("F")).toBeInstanceOf(fixed_point_object);
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
