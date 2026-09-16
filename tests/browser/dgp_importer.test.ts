import { afterEach, describe, expect, it } from "vitest";
import { construction } from "../../src/construction";
import { importDgp, importDgpFromUrl } from "../../src/dgp_importer";
import { fixed_point_object } from "../../src/objects/fixed_point_object";
import { point_on_object } from "../../src/objects/point_on_object";
import { point_object } from "../../src/objects/point_object";
import { symmetry_object } from "../../src/objects/symmetry_object";
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

    it("imports the perpendicular-bisector reference figure", async () => {
        const c = createConstruction();
        await importDgpFromUrl(c, "/tests/_Mediatrice.dgp");

        expect(c.OBJS.V).toHaveLength(8);
        expect(c.getObj("P1")).toBeInstanceOf(point_object);
        expect(c.getObj("L1")).toBeInstanceOf(two_points_line_object);
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
