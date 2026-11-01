import { describe, expect, it, vi } from "vitest";
// First, as in main.ts: the object classes import each other.
import "../../src/construction";
import { describeDgo, importDgo } from "../../src/dgo";
import type { button_object } from "../../src/objects/button_object";
import { openFigureFile, writeWorkbook } from "../../src/workbook";
import type { expression_object } from "../../src/objects/expression_object";
import type { point_object } from "../../src/objects/point_object";
import type { text_object } from "../../src/objects/text_object";
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

    // Each for what it uses: points on conics; points pinned to the window
    // and an expression named x; objects named 2 and 3; forward references
    // ("@A") and macros; texts placed by formulas, LaTeX expressions;
    // CaRMetal's memories (d, sum), vectors as lengths, an object named "".
    it("imports CaRMetal figures of the corpus", async () => {
        for (const name of [
            "Yves/Poncelet456IREM.zirs",
            "Alain/stern1.zirs",
            "Eric/Métamorphoses à l'équerre.zirs",
            "Yves_Capes_Agreg/CIRM2_Aimantation.zirs",
            "Yves_Capes_Agreg/05c_PappusFormel.zirs",
        ]) {
            const { unsupported } = await openFigureFile(
                createConstruction(),
                await file(`/tests/zirz/${name}`),
            );
            // stern1's scripts, run as points move, are reported.
            expect(
                unsupported.filter((item) => !item.includes(": Script ")),
                name,
            ).toEqual([]);
        }
    });

    it("places CaRMetal's points on and intersections with a locus where they were saved", async () => {
        const c = createConstruction();
        expect(
            (
                await openFigureFile(
                    c,
                    await file(
                        "/tests/zirz/Yves_Capes_Agreg/07_Horicycles_figure.zir",
                    ),
                )
            ).unsupported,
        ).toEqual([]);
        const at = (name: string) =>
            (c.getObj(name) as point_object).coords.slice(0, 2);
        // B on the locus, P38 its intersection with a line.
        expect(at("B")[0]).toBeCloseTo(-3.812, 1);
        expect(at("B")[1]).toBeCloseTo(0.571, 1);
        expect(at("P38")[0]).toBeCloseTo(-3.551, 2);
        expect(at("P38")[1]).toBeCloseTo(-0.08, 2);
    });

    it("reads CaRMetal's angles without acute from 0 to 360°, and a vector's coordinates as its components", async () => {
        const c = createConstruction();
        await openFigureFile(
            c,
            new File(
                [
                    `<CaR><Construction><Window x="0" y="0" w="8"/><Objects>
<Point name="O" x="0" y="0"/><Point name="A" x="1" y="0"/><Point name="M" x="0" y="-1"/>
<Angle name="a1" first="A" root="O" second="M"/>
<Segment name="u" from="O" to="M" arrow="true"/>
<Point name="P" x="a1" actx="0" y="x(u)+y(u)" acty="0" fixed="true"/>
</Objects></Construction></CaR>`,
                ],
                "angle.zir",
            ),
        );
        const [x, y] = (c.getObj("P") as point_object).coords;
        expect(x).toBeCloseTo(270);
        expect(y).toBeCloseTo(-1);
    });

    it("runs CaRMetal's scripts of a button or a dragged point as DGPad programs", async () => {
        const c = createConstruction();
        expect(
            (
                await openFigureFile(
                    c,
                    await file("/tests/zirz/Olivier/Tchin_tchin.zir"),
                )
            ).unsupported,
        ).toEqual([]);
        const press = (name: string) => {
            const button = c.getObj(name) as expression_object;
            button.value = Number(button.value === 0);
            c.invalidateGeometry(button);
            c.flush();
        };
        const value = (name: string) =>
            (c.getObj(name) as expression_object).value;
        press("r1");
        press("v12");
        expect([value("cont1"), value("cont2"), value("compteur")]).toEqual([
            0, 14, 2,
        ]);
        expect(
            (c.getObj("affichage_historique_B") as text_object).content,
        ).toBe("Historique des doses de B: \n 0,14");

        const square = createConstruction();
        expect(
            (
                await openFigureFile(
                    square,
                    await file("/tests/zirz/Eric/MultiActionCarre.zir"),
                )
            ).unsupported,
        ).toEqual([]);
        const [A, B, C, D, O] = ["A", "B", "C", "D", "O"].map(
            (name) => square.getObj(name) as point_object,
        );
        A.coords = [O.coords[0], O.coords[1] - 2, 0];
        square.gesture(A, "drag");
        square.invalidateGeometry(A);
        square.flush();
        const [ox, oy] = O.coords;
        [
            [B, 2, 0],
            [C, 0, 2],
            [D, -2, 0],
        ].forEach(([point, dx, dy]) => {
            expect((point as point_object).coords[0]).toBeCloseTo(
                ox + (dx as number),
            );
            expect((point as point_object).coords[1]).toBeCloseTo(
                oy + (dy as number),
            );
        });
    });

    it("turns CaRMetal's menu scripts into buttons, which wait as Pause", async () => {
        const { book } = await openFigureFile(
            createConstruction(),
            await file("/tests/zirz/Yves/Complements_StatEspace.zirs"),
        );
        const c = createConstruction();
        importDgo(c, book!.pages.find(({ name }) => name === "Robot")!.figure);
        const button = c.getObj("blk_btn0") as button_object;
        expect(button.label).toBe("Robot (1)");
        const M = c.getObj("M") as point_object;
        vi.useFakeTimers();
        vi.spyOn(Math, "random").mockReturnValue(0.1);
        button.run();
        expect(M.coords.slice(0, 2)).toEqual([1, 0]);
        vi.advanceTimersByTime(200);
        expect(M.coords.slice(0, 2)).toEqual([2, 0]);
        vi.runAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
        expect(M.coords.slice(0, 2)).toEqual([0, 0]);
        expect(document.body.textContent).toContain("Gagné en 4 coups !");
    });

    it("opens a .zirs of a single figure as a figure", async () => {
        const { book } = await openFigureFile(
            createConstruction(),
            await file("/tests/zirz/LotsOfObject.zirs"),
        );
        expect(book).toBeNull();
    });
});
