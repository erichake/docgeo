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
import { importGgb, importGgbFromUrl } from "../../src/ggb_importer";
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
    figure,
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
        roundTrip((c) => importDgpFromUrl(c, figure(name))),
    );
    it.each(GGB)("%s", (name) =>
        roundTrip((c) => importGgbFromUrl(c, figure(name))),
    );
});

describe(".dgo writer", () => {
    // What a student leaves: saved as it is, not as it was opened.
    it("saves the figure's current state", () =>
        roundTrip(
            (c) => importDgpFromUrl(c, figure("_Conique3.dgp")),
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
            (c) => importDgpFromUrl(c, figure("_Conique3.dgp")),
            (c) => {
                const [first, third] = ["I0", "I2"].map(
                    (name) => c.getObj(name) as point_object,
                );
                [first.coords, third.coords] = [third.coords, first.coords];
                c.invalidateGeometry(c.getObj("Cir")!);
            },
        ));

    // Its 2D points keep their place on the screen, not in space.
    it("keeps a 3D figure's 2D points in the screen plane", () =>
        roundTrip(
            (c) => importDgpFromUrl(c, figure("PSE_01.dgp")),
            (c) => {
                const point = c.getObj("Odl") as point_object;
                point.pinned = [point.pinned![0] + 0.2, point.pinned![1] - 0.1];
                c.invalidateGeometry(point);
                c.GRID.PHI += 0.4;
                c.invalidateProjection();
            },
        ));

    it("saves a slider's value", () =>
        roundTrip(
            (c) => importDgpFromUrl(c, figure("_Expression.dgp")),
            (c) => {
                const slider = c.getObj("E2") as expression_object;
                slider.value = 7.25;
                c.invalidateGeometry(slider);
            },
        ));

    it("keeps images sized in pixels, at a point or in the window", () =>
        roundTrip(
            async (c) =>
                importGgb(
                    c,
                    `<geogebra><euclidianView><coordSystem xZero="200" yZero="300" scale="50"/><size width="800" height="600"/></euclidianView><construction>
<element type="point" label="A"><coords x="1" y="2" z="1"/></element>
<element type="image" label="one"><file name="p.png"/><startPoint number="0" exp="A"/></element>
<element type="image" label="fixed"><file name="p.png"/><absoluteScreenLocation x="30" y="50"/></element>
</construction></geogebra>`,
                    new Map([
                        [
                            "p.png",
                            {
                                url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                                width: 40,
                                height: 20,
                            },
                        ],
                    ]),
                ),
            (c) => {
                c.GRID.ORG = [c.GRID.ORG[0] + 40, c.GRID.ORG[1] - 25];
                c.invalidateProjection();
            },
        ));

    it("keeps function calls, window corners and computed checkboxes", () =>
        roundTrip(
            async (c) =>
                importGgb(
                    c,
                    `<geogebra><construction>
<element type="point" label="A"><coords x="2" y="0" z="1"/></element>
<element type="point" label="B"><coords x="0" y="3" z="1"/></element>
<element type="point" label="O"><coords x="0" y="0" z="1"/></element>
<expression label="f" exp="f(x) = x^(2) / 4"/>
<element type="function" label="f"/>
<expression label="M" exp="(x(A), f(x(A)))" type="point"/>
<element type="point" label="M"><coords x="2" y="1" z="1"/></element>
<command name="Corner"><input a0="3"/><output a0="C"/></command>
<element type="point" label="C"/>
<command name="TriangleCenter"><input a0="A" a1="B" a2="O" a3="3"/><output a0="K"/></command>
<element type="point" label="K"/>
<command name="Segment"><input a0="A" a1="B"/><output a0="s"/></command>
<element type="segment" label="s"/>
<expression label="long" exp="s > 3"/>
<element type="boolean" label="long"><value val="true"/></element>
</construction></geogebra>`,
                ),
            (c) => {
                c.GRID.ORG = [c.GRID.ORG[0] + 40, c.GRID.ORG[1] - 25];
                c.invalidateProjection();
            },
        ));

    it("keeps integrals, sums and slope triangles", () =>
        roundTrip(async (c) =>
            importGgb(
                c,
                `<geogebra><construction>
<element type="point" label="A"><coords x="1" y="0" z="1"/></element>
<expression label="f" exp="f(x) = x^(2) / 2"/>
<element type="function" label="f"/>
<command name="Tangent"><input a0="A" a1="f"/><output a0="t"/></command>
<element type="line" label="t"/>
<command name="Slope"><input a0="t"/><output a0="m"/></command>
<element type="numeric" label="m"><show object="true"/><objColor r="0" g="0" b="255" alpha="0.2"/></element>
<command name="Integral"><input a0="f" a1="0" a2="x(A)"/><output a0="I"/></command>
<element type="numeric" label="I"><show object="true"/><objColor r="0" g="128" b="0" alpha="0.3"/></element>
<command name="UpperSum"><input a0="f" a1="-2" a2="0" a3="4"/><output a0="U"/></command>
<element type="numeric" label="U"><show object="true"/><objColor r="128" g="0" b="0" alpha="0.3"/></element>
</construction></geogebra>`,
            ),
        ));

    it("keeps lists of polygons and images of lists", () =>
        roundTrip(async (c) =>
            importGgb(
                c,
                `<geogebra><construction>
<element type="point" label="A"><coords x="1" y="0" z="1"/></element>
<element type="point" label="B"><coords x="2" y="1" z="1"/></element>
<command name="Sequence"><input a0="Polygon[(i, 0), (i + 1, 0), Rotate[(i, 1), 10°, A]]" a1="i" a2="0" a3="3"/><output a0="l"/></command>
<element type="list" label="l"><objColor r="0" g="0" b="255" alpha="0.3"/></element>
<command name="Polygon"><input a0="A" a1="B" a2="(1, 2)"/><output a0="t"/></command>
<element type="polygon" label="t"/>
<command name="Translate"><input a0="{t, Segment[A, B]}" a1="B - A"/><output a0="m"/></command>
<element type="list" label="m"><objColor r="0" g="128" b="0" alpha="0.2"/></element>
</construction></geogebra>`,
            ),
        ));

    it("keeps 3D lists and images of polyhedra", () =>
        roundTrip(async (c) =>
            importGgb(
                c,
                `<geogebra><construction>
<element type="point3d" label="A"><coords x="0" y="0" z="0" w="1"/></element>
<element type="point3d" label="B"><coords x="1" y="0" z="0" w="1"/></element>
<element type="point3d" label="C"><coords x="1" y="1" z="0" w="1"/></element>
<command name="Cube"><input a0="A" a1="B" a2="C"/><output a0="k"/></command>
<element type="polyhedron" label="k"/>
<command name="Rotate"><input a0="k" a1="30°" a2="zAxis"/><output a0="k'"/></command>
<element type="polyhedron" label="k'"><objColor r="255" g="0" b="0" alpha="0.4"/></element>
<command name="Sequence"><input a0="Segment[(0, 0, i), (i, 1, i)]" a1="i" a2="1" a3="3"/><output a0="s"/></command>
<element type="list" label="s"/>
</construction></geogebra>`,
            ),
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
            await importDgpFromUrl(c, figure(name));
            await frame();
            const shown = new Map(positions(c));
            const saved = await describeDgo(c, region);
            expect(saved.v).toMatchObject({ w: 400, h: 300 });
            c.dispose();
            for (const [size, centered, offset] of [
                [[400, 300], false, [0, 0]],
                [[400, 300], true, [0, 0]],
                [[900, 700], true, [250, 200]],
            ] as const) {
                const copy = createConstruction([...size]);
                readDgo(copy, saved, centered);
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
