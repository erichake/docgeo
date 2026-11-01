import { describe, expect, it } from "vitest";
// First, as in main.ts: the object classes import each other.
import "../../src/construction";
import type { construction } from "../../src/construction";
import {
    describeDgo,
    describeWorkbook,
    gzipped,
    importDgo,
    type DgoFigure,
    type Workbook,
} from "../../src/dgo";
import { importDgp } from "../../src/dgp_importer";
import { add, resolve } from "../../src/editor/figure";
import { isCommand } from "../../src/editor/catalog";
import { parseLine, renameExternals } from "../../src/editor/text";
import { parseFormula } from "../../src/import/dgp_formula";
import type { list_object } from "../../src/objects/list_object";
import type { point_on_object } from "../../src/objects/point_on_object";
import { leavePage, openFigureFile, writeWorkbook } from "../../src/workbook";
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

const sheet = (name: string, o: unknown[]) => ({
    name,
    figure: {
        dgo: 1,
        v: { o: [400, 300], u: 40, w: 800, h: 600 },
        o,
    } as DgoFigure,
});

const ex = (name: string, content: object) => [
    "Ex",
    name,
    { t: "", ...content, xy: [0, 0] },
];

const value = (c: construction, name: string) =>
    c.getObj(name)!.scriptValue(false);

// The page of this index, shown in place of the one shown.
function show(book: Workbook, c: construction, index: number): construction {
    leavePage(c);
    book.current = index;
    const shown = createConstruction();
    importDgo(shown, book.pages[index].figure);
    return shown;
}

describe("workbooks", () => {
    it("reads the expressions of other pages, computed again once they change", async () => {
        const book = {
            pages: [
                sheet("Page 1", [ex("c", { v: 3 })]),
                sheet("deux", [ex("m", { s: "'Page 1'!c*2" })]),
                sheet("trois", [
                    ex("n", { s: "deux!m+1" }),
                    ex("u", { s: "'Page 1'!u" }),
                    ex("s", { s: "trois!n" }),
                ]),
            ],
            current: 2,
        };
        const c = createConstruction();
        const opened = (
            await openFigureFile(
                c,
                new File(
                    [await gzipped(describeWorkbook(book))],
                    "classeur.dgo",
                ),
            )
        ).book!;
        expect(value(c, "n")).toBe(7);
        expect(value(c, "u")).toBeNull();
        expect(value(c, "s")).toBeNull();
        (opened.pages[0].figure.o[0] as [string, string, { v: number }])[2].v =
            5;
        const first = show(opened, c, 0);
        expect(value(show(opened, first, 2), "n")).toBe(11);
    });

    it("refuses a reference that would read the page shown", async () => {
        const book = {
            pages: [
                sheet("un", [ex("a", { v: 1 }), ["Pt", "A", [2, 3]]]),
                sheet("deux", [ex("b", { s: "un!a+1" })]),
            ],
            current: 0,
        };
        const c = createConstruction();
        const opened = (
            await openFigureFile(
                c,
                new File(
                    [await gzipped(describeWorkbook(book))],
                    "classeur.dgo",
                ),
            )
        ).book!;
        const type = (c: construction, text: string) =>
            add(c, resolve(c, parseLine(text, isCommand)));
        expect(() => type(c, "k = deux!b")).toThrow("circular_reference");
        expect(() => type(c, "k = trois!b")).toThrow("unknown_object");
        const second = show(opened, c, 1);
        type(second, "w = 10 * un!a");
        expect(value(second, "w")).toBe(10);
        type(second, "A = Point(un!A)");
        expect(value(second, "A")).toEqual([2, 3]);
        expect(() => type(second, "q = un!z")).toThrow("unknown_object");
        expect(() => type(second, "r = deux!b")).toThrow("circular_reference");
    });

    it("writes a reference to another page as a spreadsheet does", () => {
        expect(parseFormula("'a'!=c").kind).toBe("binary");
        expect(parseFormula("'L\\'aire'!c")).toEqual({
            kind: "external",
            page: "L'aire",
            name: "c",
        });
        expect(
            renameExternals("un!a + 'un'!b * deux!a", (page, name) =>
                page === "un" ? ["Page 1", name] : undefined,
            ),
        ).toBe("'Page 1'!a + 'Page 1'!b * deux!a");
    });

    it("opens the page shown of a .dgo of several, and saves them all", async () => {
        const book = {
            pages: [{ ...page("un", 1), color: "#ec4899" }, page("deux", 2)],
            current: 1,
        };
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
        expect(reopened.pages.map(({ color }) => color)).toEqual([
            "#ec4899",
            undefined,
        ]);
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
