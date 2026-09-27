import { describe, expect, it } from "vitest";
// First, as in main.ts: the object classes import each other.
import "../../src/construction";
import type { construction } from "../../src/construction";
import { importDgp, importDgpFromUrl } from "../../src/dgp_importer";
import {
    describeDgo,
    figureObjects,
    importDgoFromBlob,
    readDgo,
    writeDgo,
} from "../../src/dgo";
import { importGgbFromUrl } from "../../src/ggb_importer";
import { expression_object } from "../../src/objects/expression_object";
import { point_on_object } from "../../src/objects/point_on_object";
import { point_object } from "../../src/objects/point_object";
import {
    createConstruction,
    DGP,
    disposeFigures,
    drawing,
    drawingDifference,
    expectClose,
    frame,
    GGB,
} from "./figures";

disposeFigures();

// Import, save, reopen: the reopened figure must be the same, down to its
// drawing, since the original file isn't kept.
async function roundTrip(
    open: (c: construction) => Promise<unknown>,
    change?: (c: construction) => void,
): Promise<void> {
    const original = createConstruction();
    await open(original);
    await frame();
    if (change) {
        change(original);
        await frame();
    }
    const saved = await describeDgo(original);
    const reopened = createConstruction();
    await importDgoFromBlob(reopened, await writeDgo(original));
    await frame();
    expectClose(await describeDgo(reopened), saved);
    const objects = saved.o.length;
    const [before, after] = [original, reopened].map((c) =>
        c.OBJS.V.slice(-objects),
    );
    before.forEach((object, index) => {
        const copy = after[index];
        expect(copy.name).toBe(object.name);
        expect(copy.defined, object.name).toBe(object.defined);
        if (object instanceof point_object && object.defined)
            expectClose(
                (copy as point_object).coords,
                object.coords,
                object.name,
            );
    });
    const difference = drawingDifference(
        drawing(reopened.svg.dom()),
        drawing(original.svg.dom()),
    );
    if (difference) console.log("DIFF<<" + difference + ">>");
    expect(difference).toBe("");
}

describe(".dgo round trip", () => {
    it.each(DGP)("%s", (name) =>
        roundTrip((c) => importDgpFromUrl(c, `/tests/dgp/${name}`)),
    );
    it.each(GGB)("%s", (name) =>
        roundTrip((c) => importGgbFromUrl(c, `/tests/ggb/${name}`)),
    );
});

describe(".dgo writer", () => {
    // What a student leaves: saved as it is, not as it was opened.
    it("saves the figure's current state", () =>
        roundTrip(
            (c) => importDgpFromUrl(c, "/tests/dgp/_Conique3.dgp"),
            (c) => {
                const point = c.getObj("A") as point_object;
                point.coords = [point.x + 0.3, point.y - 0.2, 0];
                c.invalidateGeometry(point);
                const unit = c.GRID.UNIT[0] * 1.5;
                c.GRID.UNIT = [unit, unit, unit];
                c.GRID.ORG = [c.GRID.ORG[0] + 40, c.GRID.ORG[1] - 25];
                c.invalidateProjection();
            },
        ));

    // Two of them followed each other's branch while the figure moved: a
    // fresh figure would number them otherwise.
    it("keeps which intersection is which", () =>
        roundTrip(
            (c) => importDgpFromUrl(c, "/tests/dgp/_Conique3.dgp"),
            (c) => {
                const [first, third] = ["I0", "I2"].map(
                    (name) => c.getObj(name) as point_object,
                );
                [first.coords, third.coords] = [third.coords, first.coords];
                c.invalidateGeometry(c.getObj("Cir")!);
            },
        ));

    it("saves a slider's value", () =>
        roundTrip(
            (c) => importDgpFromUrl(c, "/tests/dgp/_Expression.dgp"),
            (c) => {
                const slider = c.getObj("E2") as expression_object;
                slider.value = 7.25;
                c.invalidateGeometry(slider);
            },
        ));

    it("keeps numbers JSON can't hold", () =>
        roundTrip(
            async (c) =>
                importDgp(
                    c,
                    `SetCoords(400,300,40,false,800,600);
A=Point("A",0,0);
B=Point("B",0,0);
s=Segment("s",A,B);
M=PointOn("M",s,0.5);
E=Expression("E","","","","[NaN,1]","1","1");`,
                ),
            (c) => {
                const point = c.getObj("M") as point_on_object;
                point.alpha = NaN;
                c.invalidateGeometry(point);
            },
        ));
});

describe(".dgo region", () => {
    // Where the figure's points and expressions are drawn.
    const positions = (c: construction) =>
        figureObjects(c).flatMap((object) =>
            object instanceof point_object && object.projectionDefined
                ? [[object.name, object.screen] as const]
                : object instanceof expression_object
                  ? [[object.name, object.screen] as const]
                  : [],
        );

    // What a region of the window shows, a window of its size shows once
    // the figure is reopened, and a larger one in its center.
    it.each(["_Expression.dgp", "_Conique3.dgp", "_patronsCube.dgp"])(
        "%s",
        async (name) => {
            const region = { x: 130, y: 90, w: 400, h: 300 };
            const c = createConstruction([900, 700]);
            await importDgpFromUrl(c, `/tests/dgp/${name}`);
            await frame();
            const shown = new Map(positions(c));
            const figure = await describeDgo(c, region);
            expect(figure.v).toMatchObject({ w: 400, h: 300 });
            c.dispose();
            for (const [size, centered, offset] of [
                [[400, 300], false, [0, 0]],
                [[400, 300], true, [0, 0]],
                [[900, 700], true, [250, 200]],
            ] as const) {
                const copy = createConstruction([...size]);
                readDgo(copy, figure, centered);
                await frame();
                positions(copy).forEach(([object, [x, y]]) => {
                    const [sx, sy] = shown.get(object)!;
                    const expected = [
                        sx - region.x + offset[0],
                        sy - region.y + offset[1],
                    ];
                    // Expressions are placed to the pixel.
                    expect(Math.abs(x - expected[0]), object).toBeLessThan(0.5);
                    expect(Math.abs(y - expected[1]), object).toBeLessThan(0.5);
                });
                copy.dispose();
            }
        },
    );
});

describe(".dgo reader", () => {
    it("reads plain JSON as well as gzip", async () => {
        const c = createConstruction();
        const figure = {
            dgo: 1,
            v: { o: [100, 100], u: 50, w: 800, h: 600 },
            o: [
                ["Pt", "A", [1, 2]],
                ["Pt", "B", [3, -1]],
                ["Seg", "s", [0, 1]],
            ],
        };
        await importDgoFromBlob(c, new Blob([JSON.stringify(figure)]));
        expect((c.getObj("A") as point_object).coords).toEqual([1, 2, 0]);
        expect(c.getObj("s")!.parents.map((p) => p.name)).toEqual(["A", "B"]);
    });

    it.each([
        ["an unknown type", ["Foo", "A", [1, 2]]],
        ["a forward reference", ["Seg", "s", [0, 5]]],
        ["a reference of the wrong kind", ["Cir", "C", [0, 2]]],
        ["a duplicate name", ["Pt", "A", [0, 0]]],
        ["a formula naming no object", ["Fp", "F", ["A+Z", { A: 0 }]]],
        ["an inherited type", ["toString", "T", []]],
    ])("rejects %s", (_, entry) => {
        const c = createConstruction();
        expect(() =>
            readDgo(c, {
                dgo: 1,
                v: { o: [0, 0], u: 50, w: 800, h: 600 },
                o: [["Pt", "A", [1, 2]], ["Seg", "s", [0, 0]], entry],
            }),
        ).toThrow("Invalid DGO file");
    });
});
