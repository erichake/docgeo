import { afterEach, describe, expect, it } from "vitest";
import { construction } from "../../src/construction";
import { importDgp, importDgpFromUrl } from "../../src/dgp_importer";
import { point_object } from "../../src/objects/point_object";
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

describe("DGP importer", () => {
    it("imports two points and their line from the public DGP file", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/_Droite.dgp");

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

    it("imports the perpendicular-bisector reference figure", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/_Mediatrice.dgp");

        expect(c.OBJS.V).toHaveLength(8);
        expect(c.getObj("P1")).toBeInstanceOf(point_object);
        expect(c.getObj("L1")).toBeInstanceOf(two_points_line_object);
    });

    it("imports the complete Apollonius construction", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/_Apollonius.dgp");

        expect(c.OBJS.V).toHaveLength(2570);
        expect(c.getObj("P1")).toBeInstanceOf(point_object);
        expect(c.getObj("P14")).toBeInstanceOf(point_object);
        expect(c.getObj("Center32")).toBeInstanceOf(point_object);
    });
});
