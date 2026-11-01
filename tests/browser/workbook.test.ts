import { describe, expect, it } from "vitest";
// First, as in main.ts: the object classes import each other.
import "../../src/construction";
import { describeDgo, describeWorkbook, gzipped } from "../../src/dgo";
import { importDgp } from "../../src/dgp_importer";
import type { list_object } from "../../src/objects/list_object";
import type { point_on_object } from "../../src/objects/point_on_object";
import { openFigureFile, writeWorkbook } from "../../src/workbook";
import { createConstruction, disposeFigures } from "./figures";

disposeFigures();

const page = (name: string, x: number) => ({
    name,
    figure: {
        dgo: 1,
        v: { o: [400, 300], u: 40, w: 800, h: 600 },
        o: [["Pt", "A", [x, 0]]],
    },
});

describe("workbooks", () => {
    it("opens the page shown of a .dgo of several, and saves them all", async () => {
        const book = { pages: [page("un", 1), page("deux", 2)], current: 1 };
        const file = new File(
            [await gzipped(describeWorkbook(book))],
            "classeur.dgo",
        );
        const c = createConstruction();
        const opened = (await openFigureFile(c, file)).book!;
        expect(opened.pages.map(({ name }) => name)).toEqual(["un", "deux"]);
        expect(opened.current).toBe(1);
        expect(c.getObj("A")!.scriptValue(false)).toEqual([2, 0]);
        opened.current = 0;
        const other = createConstruction();
        const reopened = (
            await openFigureFile(
                other,
                new File([await writeWorkbook(opened, c)], "classeur.dgo"),
            )
        ).book!;
        expect(reopened.current).toBe(0);
        expect(reopened.pages[0].figure).toEqual(await describeDgo(c));
    });

    it("places a point on a locus, and draws a list's points as crosses", async () => {
        const c = createConstruction();
        importDgp(
            c,
            `O=Point("O",0,0);
A=Point("A",2,0);
c=Circle("c",O,A);
P=PointOn("P",c,0);
M=MidPoint("M",O,P);
l=Locus("l",M,P);
K=PointOn("K",l,0);
e=Expression("e","","","","[[1,2],[3,4]]","0","0");
L=List("L",e);
STL(L,"sp:1");`,
        );
        c.flush();
        const K = c.getObj("K") as point_on_object;
        K.alpha = K.alphaFor([0, -1, 0])!;
        c.invalidateGeometry(K);
        c.flush();
        const [x, y] = K.coords;
        expect(Math.hypot(x, y + 1)).toBeLessThan(0.02);
        expect((c.getObj("L") as list_object).shape).toBe("cross");
        expect(JSON.stringify(await describeDgo(c))).toContain('"sp":"cross"');
    });
});
