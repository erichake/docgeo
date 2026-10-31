import { describe, expect, it } from "vitest";
// First, as in main.ts: the object classes import each other.
import "../../src/construction";
import { describeDgo } from "../../src/dgo";
import { openFigureFile, writeWorkbook } from "../../src/workbook";
import { createConstruction, disposeFigures } from "./figures";

disposeFigures();

const file = async (path: string) =>
    new File([await (await fetch(path)).blob()], path.split("/").pop()!);

describe("workbooks", () => {
    it("opens each figure of a .zirs, and saves them as .dgo pages", async () => {
        const c = createConstruction();
        const { book, unsupported } = await openFigureFile(
            c,
            await file("/tests/zirz/eric/Pythagore_EricHakenholz.zirs"),
        );
        expect(unsupported).toEqual([]);
        expect(book!.pages.map(({ name }) => name)).toEqual([
            "Pythagore puzzle",
            "Pythagore démonstration",
            "pyth puz",
        ]);
        expect(book!.current).toBe(0);
        book!.current = 1;
        const saved = new File([await writeWorkbook(book!, c)], "classeur.dgo");
        const other = createConstruction();
        const reopened = (await openFigureFile(other, saved)).book!;
        expect(reopened.current).toBe(1);
        expect(reopened.pages).toEqual(book!.pages);
        expect(await describeDgo(other)).toEqual(book!.pages[1].figure);
    });

    it("imports all of Eric's CaRMetal figures", async () => {
        for (const name of [
            "Droite Graduee Eric.zir",
            "IllustreSymCollege.zirs",
            "Pythagore_EricHakenholz.zirs",
        ]) {
            const { unsupported } = await openFigureFile(
                createConstruction(),
                await file(`/tests/zirz/eric/${name}`),
            );
            expect(unsupported).toEqual([]);
        }
    });

    it("opens a .zirs of a single figure as a figure", async () => {
        const { book } = await openFigureFile(
            createConstruction(),
            await file("/tests/zirz/LotsOfObject.zirs"),
        );
        expect(book).toBeNull();
    });
});
