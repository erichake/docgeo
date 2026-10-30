import { describe, expect, it } from "vitest";
// First, as in main.ts: the object classes import each other.
import "../../src/construction";
import type { construction } from "../../src/construction";
import { importDgp, importDgpFromUrl } from "../../src/dgp_importer";
import {
    describeDgo,
    figureObjects,
    importDgoFromBlob,
    importDgoFromUrl,
    readDgo,
    writeDgo,
} from "../../src/dgo";
import {
    blocksProgram,
    programBlocks,
} from "../../src/editor/blocks/program_blocks";
import { formatName } from "../../src/editor/text";
import { importGgb, importGgbFromUrl } from "../../src/ggb_importer";
import { parseProgram } from "../../src/import/dgp_formula";
import type { arc3pts_object } from "../../src/objects/arc3pts_object";
import type { circle3pts_object } from "../../src/objects/circle3pts_object";
import { button_object } from "../../src/objects/button_object";
import type { center_arc_object } from "../../src/objects/center_arc_object";
import type {
    circle_arc_object,
    conic_arc_object,
} from "../../src/objects/conic_arc_object";
import { expression_list_object } from "../../src/objects/expression_list_object";
import {
    expression_object,
    setValue,
} from "../../src/objects/expression_object";
import { point_on_object } from "../../src/objects/point_on_object";
import { point_object } from "../../src/objects/point_object";
import { polygon_object } from "../../src/objects/polygon_object";
import { ray_line_object } from "../../src/objects/ray_line_object";
import type { segment_object } from "../../src/objects/segment_object";
import type { two_points_line_object } from "../../src/objects/two_points_line_object";
import { vector_object } from "../../src/objects/vector_object";
import type { Vec3 } from "../../src/vec";
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
    seedRandom,
} from "./figures";

disposeFigures();

// Import, save, reopen: the reopened figure must be the same, down to its
// drawing, since the original file isn't kept.
async function roundTrip(
    open: (c: construction) => Promise<unknown>,
    change?: (c: construction) => void,
): Promise<void> {
    // The same random numbers either way, e.g. those of an "oninit".
    seedRandom();
    const original = createConstruction();
    await open(original);
    await frame();
    if (change) {
        change(original);
        await frame();
    }
    const saved = await describeDgo(original);
    const reopened = createConstruction();
    const written = await writeDgo(original);
    seedRandom();
    await importDgoFromBlob(reopened, written);
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

    it("keeps lines, circles and conics of their equation", () =>
        roundTrip(
            async (c) =>
                importGgb(
                    c,
                    `<geogebra><construction>
<element type="numeric" label="a"><value val="2"/></element>
<expression label="d" exp="y = (a * x) + 1" type="line"/>
<element type="line" label="d"><coords x="-2" y="1" z="-1"/></element>
<element type="line" label="w"><coords x="1" y="1" z="-2"/></element>
<expression label="ell" exp="x^(2) / a^(2) + y^(2) = 1" type="conic"/>
<element type="conic" label="ell"><matrix A0="0.25" A1="1" A2="-1" A3="0" A4="0" A5="0"/></element>
<expression label="hyp" exp="y^(2) - x^(2) = a" type="conic"/>
<element type="conic" label="hyp"><matrix A0="-1" A1="1" A2="-2" A3="0" A4="0" A5="0"/></element>
<element type="conic" label="par"><matrix A0="0" A1="1" A2="0" A3="0" A4="-4" A5="0"/></element>
<expression label="c" exp="(x - a)^(2) + y^(2) = 4" type="conic"/>
<element type="conic" label="c"><matrix A0="1" A1="1" A2="0" A3="0" A4="-2" A5="0"/></element>
<command name="Point"><input a0="d"/><output a0="A"/></command>
<element type="point" label="A"><coords x="1" y="3" z="1"/></element>
<command name="Point"><input a0="ell"/><output a0="B"/></command>
<element type="point" label="B"><coords x="0" y="1" z="1"/></element>
<command name="Point"><input a0="par"/><output a0="C"/></command>
<element type="point" label="C"><coords x="2" y="4" z="1"/></element>
<command name="Point"><input a0="c"/><output a0="D"/></command>
<element type="point" label="D"><coords x="4" y="0" z="1"/></element>
</construction></geogebra>`,
                ),
            (c) => {
                const a = c.getObj("a") as expression_object;
                a.value = 3;
                c.invalidateGeometry(a);
            },
        ));

    it("keeps rotations, dilations and translations", () =>
        roundTrip(
            async (c) =>
                importGgb(
                    c,
                    `<geogebra><construction>
<element type="numeric" label="a"><value val="2"/></element>
<element type="point" label="P"><coords x="1" y="2" z="1"/></element>
<element type="point" label="O"><coords x="-1" y="0" z="1"/></element>
<element type="point" label="B"><coords x="1" y="0" z="1"/></element>
<command name="Vector"><input a0="O" a1="B"/><output a0="u"/></command>
<element type="vector" label="u"/>
<command name="Rotate"><input a0="P" a1="30°"/><output a0="R"/></command>
<element type="point" label="R"/>
<command name="Rotate"><input a0="P" a1="a"/><output a0="S"/></command>
<element type="point" label="S"/>
<command name="Rotate"><input a0="P" a1="45°" a2="O"/><output a0="Q"/></command>
<element type="point" label="Q"/>
<command name="Dilate"><input a0="P" a1="a" a2="O"/><output a0="D"/></command>
<element type="point" label="D"/>
<command name="Translate"><input a0="P" a1="u"/><output a0="T"/></command>
<element type="point" label="T"/>
<command name="Translate"><input a0="P" a1="B"/><output a0="U"/></command>
<element type="point" label="U"/>
<command name="Translate"><input a0="P" a1="Vector[(a, 1)]"/><output a0="V"/></command>
<element type="point" label="V"/>
</construction></geogebra>`,
                ),
            (c) => {
                const a = c.getObj("a") as expression_object;
                a.value = 3;
                c.invalidateGeometry(a);
            },
        ));

    it("keeps arcs and sectors of a center, semicircles, reflected", () =>
        roundTrip(
            async (c) =>
                importGgb(
                    c,
                    `<geogebra><construction>
<element type="point" label="M"><coords x="0" y="0" z="1"/></element>
<element type="point" label="A"><coords x="2" y="0" z="1"/></element>
<element type="point" label="B"><coords x="-1" y="2" z="1"/></element>
<command name="Line"><input a0="M" a1="A"/><output a0="l"/></command>
<element type="line" label="l"/>
<command name="CircleArc"><input a0="M" a1="A" a2="B"/><output a0="k"/></command>
<element type="conicpart" label="k"/>
<command name="CircleSector"><input a0="M" a1="B" a2="A"/><output a0="s"/></command>
<element type="conicpart" label="s"/>
<command name="Semicircle"><input a0="A" a1="B"/><output a0="g"/></command>
<element type="conicpart" label="g"/>
<command name="Mirror"><input a0="k" a1="l"/><output a0="k'"/></command>
<element type="conicpart" label="k'"/>
<command name="Point"><input a0="k"/><output a0="P"/></command>
<element type="point" label="P"><coords x="0" y="2" z="1"/></element>
</construction></geogebra>`,
                ),
            (c) => {
                const b = c.getObj("B") as point_object;
                b.coords = [1, 2, 0];
                c.invalidateGeometry(b);
            },
        ));

    // From P to Q counterclockwise, each at its angle: P inside the circle.
    it("keeps arcs and sectors of circles and ellipses", async () => {
        const open = async (c: construction) =>
            importGgb(
                c,
                `<geogebra><construction>
<element type="point" label="M"><coords x="0" y="0" z="1"/></element>
<element type="point" label="A"><coords x="2" y="0" z="1"/></element>
<element type="point" label="P"><coords x="0" y="1" z="1"/></element>
<element type="point" label="Q"><coords x="2" y="0.5" z="1"/></element>
<command name="Circle"><input a0="M" a1="A"/><output a0="c"/></command>
<element type="conic" label="c"/>
<command name="Arc"><input a0="c" a1="P" a2="Q"/><output a0="a"/></command>
<element type="conicpart" label="a"/>
<element type="point" label="F"><coords x="-1" y="0" z="1"/></element>
<command name="Ellipse"><input a0="F" a1="A" a2="P"/><output a0="e"/></command>
<element type="conic" label="e"/>
<command name="Sector"><input a0="e" a1="Q" a2="P"/><output a0="s"/></command>
<element type="conicpart" label="s"/>
</construction></geogebra>`,
            );
        const c = createConstruction();
        expect(await open(c)).toEqual([]);
        c.flush();
        const a = c.getObj("a") as circle_arc_object;
        expect(a.R).toBeCloseTo(2);
        // From the top of the circle, by the left, to Q's angle.
        expectClose(a.pointAt(a.startAlpha), [0, 2, 0]);
        expect(a.insideBounds([-2, 0, 0])).toBe(true);
        expect(a.insideBounds([Math.SQRT2, Math.SQRT2, 0])).toBe(false);
        expect((c.getObj("s") as conic_arc_object).defined).toBe(true);
        await roundTrip(open);
    });

    it("keeps tangents to circles, conics and functions' curves", () =>
        roundTrip(
            async (c) =>
                importGgb(
                    c,
                    `<geogebra><construction>
<element type="point" label="O"><coords x="0" y="0" z="1"/></element>
<element type="point" label="P"><coords x="4" y="1" z="1"/></element>
<element type="point" label="A"><coords x="2" y="0" z="1"/></element>
<command name="Circle"><input a0="O" a1="A"/><output a0="c"/></command>
<element type="conic" label="c"/>
<command name="Tangent"><input a0="P" a1="c"/><output a0="t1" a1="t2"/></command>
<element type="line" label="t1"/>
<element type="line" label="t2"/>
<expression label="e" exp="x^(2) / 9 + y^(2) / 4 = 1" type="conic"/>
<element type="conic" label="e"><matrix A0="4" A1="9" A2="-36" A3="0" A4="0" A5="0"/></element>
<command name="Tangent"><input a0="P" a1="e"/><output a0="u1" a1="u2"/></command>
<element type="line" label="u1"/>
<element type="line" label="u2"/>
<expression label="f" exp="f(x) = x^(2) / 4"/>
<element type="function" label="f"/>
<command name="Tangent"><input a0="P" a1="f"/><output a0="tf"/></command>
<element type="line" label="tf"/>
</construction></geogebra>`,
                ),
            (c) => {
                const p = c.getObj("P") as point_object;
                p.coords = [-3, 3, 0];
                c.invalidateGeometry(p);
            },
        ));

    it("keeps inversions, triangle centers and regular polygons", () =>
        roundTrip(
            async (c) =>
                importGgb(
                    c,
                    `<geogebra><construction>
<element type="point" label="A"><coords x="0" y="0" z="1"/></element>
<element type="point" label="B"><coords x="4" y="0" z="1"/></element>
<element type="point" label="C"><coords x="1" y="3" z="1"/></element>
<command name="Circle"><input a0="A" a1="B"/><output a0="c"/></command>
<element type="conic" label="c"/>
<command name="Mirror"><input a0="C" a1="c"/><output a0="C'"/></command>
<element type="point" label="C'"/>
<command name="TriangleCenter"><input a0="A" a1="B" a2="C" a3="4"/><output a0="H"/></command>
<element type="point" label="H"/>
<command name="Polygon"><input a0="A" a1="C" a2="6"/><output a0="h" a1="s1" a2="s2" a3="s3" a4="s4" a5="s5" a6="s6" a7="D" a8="E" a9="F" a10="G"/></command>
<element type="polygon" label="h"/>
<command name="Point"><input a0="h"/><output a0="P"/></command>
<element type="point" label="P"><coords x="1" y="1" z="1"/></element>
</construction></geogebra>`,
                ),
            (c) => {
                const point = c.getObj("C") as point_object;
                point.coords = [-1, 2, 0];
                c.invalidateGeometry(point);
            },
        ));

    it("keeps GeoGebra's fixed and unselectable polygons fixed", () =>
        roundTrip(async (c) => {
            await importGgb(
                c,
                `<geogebra><construction>
<element type="point" label="A"><coords x="0" y="0" z="1"/></element>
<element type="point" label="B"><coords x="4" y="0" z="1"/></element>
<element type="point" label="C"><coords x="1" y="3" z="1"/></element>
<command name="Polygon"><input a0="A" a1="B" a2="C"/><output a0="t"/></command>
<element type="polygon" label="t"><fixed val="true"/></element>
<command name="Polygon"><input a0="A" a1="C" a2="4"/><output a0="q"/></command>
<element type="polygon" label="q"><selectionAllowed val="false"/></element>
<command name="Polygon"><input a0="B" a1="C" a2="A"/><output a0="u"/></command>
<element type="polygon" label="u"/>
</construction></geogebra>`,
            );
            expect(
                ["t", "q", "u"].map(
                    (name) => (c.getObj(name) as polygon_object).fixed,
                ),
            ).toEqual([true, true, false]);
        }));

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
    it("reads the three coordinates of points in a 3D figure's formulas", () => {
        const c = createConstruction();
        readDgo(c, {
            dgo: 1,
            v: { o: [400, 300], u: 40, w: 800, h: 600, "3d": 1 },
            o: [
                ["Pt", "A", [1, 2, 0]],
                ["Pt", "C", [1, 2, 4]],
                ["Pt", "O", [0, 0, 0]],
                ["Sph1", "s", [0, ["d(A, C)/2", { A: 0, C: 1 }]]],
                ["Txt", "t", [0, [0, 0], ["d = %d(A, C)%", { A: 0, C: 1 }]]],
                ["FA", "f", [0, 2, ["10*d(A, C)", { A: 0, C: 1 }], 1]],
            ],
        });
        c.flush();
        const value = (name: string, key: string) =>
            (c.getObj(name) as unknown as Record<string, unknown>)[key];
        expect(value("s", "R")).toBe(2);
        expect(value("t", "content")).toBe("d = 4");
        expect(value("f", "valueDegrees")).toBe(40);
    });

    // The arcs of a sphere's great circles, in the plane of their points.
    it("reads arcs in space, and writes them back", async () => {
        const c = createConstruction();
        readDgo(c, {
            dgo: 1,
            v: { o: [400, 300], u: 40, w: 800, h: 600, "3d": 1 },
            o: [
                ["Pt", "O", [0, 0, 0]],
                ["Pt", "A", [1, 0, 0]],
                ["Pt", "B", [0, 1, 0]],
                ["Pt", "C", [0, 0, 1]],
                ["CArcs", "g", [0, 1, 3]],
                ["Arcs", "h", [1, 2, 3]],
                ["CSecs", "s", [0, 3, 2]],
                ["Int", "I", [4, 5, 0]],
            ],
        });
        c.flush();
        const [g, h, s] = ["g", "h", "s"].map(
            (name) => c.getObj(name) as center_arc_object | arc3pts_object,
        );
        expect(g.defined && h.defined && s.defined).toBe(true);
        expect(g.R).toBeCloseTo(1);
        expectClose(g.pointAt(g.startAlpha + Math.PI / 4), [
            Math.SQRT1_2,
            0,
            Math.SQRT1_2,
        ]);
        // The short way, from C to B.
        expect(
            s.insideBounds([0, Math.SQRT1_2, Math.SQRT1_2]) &&
                !s.insideBounds([0, -Math.SQRT1_2, Math.SQRT1_2]),
        ).toBe(true);
        expectClose(h.CENTER, [1 / 3, 1 / 3, 1 / 3]);
        expect(h.insideBounds([0, 1, 0])).toBe(true);
        // Opposite B.
        expect(h.insideBounds([2 / 3, -1 / 3, 2 / 3])).toBe(false);
        // The two arcs meet at A and at C.
        expect((c.getObj("I") as point_object).defined).toBe(true);
        const saved = await describeDgo(c);
        expect(saved.o.slice(4, 7).map(([tag]) => tag)).toEqual([
            "CArcs",
            "Arcs",
            "CSecs",
        ]);
    });

    // The same kind of object on the images of its points, saved as the
    // image of a point, the object in its place.
    it("reads images of objects by transformations, and writes them back", async () => {
        const figure = {
            dgo: 1,
            v: { o: [400, 300], u: 40, w: 800, h: 600 },
            o: [
                ["Pt", "A", [0, 0]],
                ["Pt", "B", [2, 0]],
                ["Pt", "C", [1, 2]],
                ["Pt", "D", [-1, 0]],
                ["Pt", "E", [-1, 1]],
                ["Pt", "O", [1, -1]],
                ["Line", "d", [3, 4]],
                ["Poly", "p", [0, 1, 2]],
                ["Seg", "s", [0, 1]],
                ["Vec", "v", [0, 2]],
                ["Ray", "r", [0, 1]],
                ["Line", "l", [1, 2]],
                ["Cir", "c", [0, 1]],
                ["Arc", "a", [1, 2, 0]],
                ["Refl", "p1", [6, 7]],
                ["Sym", "s1", [5, 8]],
                ["Tra", "v1", [9, 9]],
                ["Rot", "r1", [5, 10, 90]],
                ["Dil", "l1", [5, 11, ["x(P)", { P: 0 }]]],
                ["Rot", "c1", [5, 12, 90]],
                ["Refl", "a1", [6, 13]],
                ["Int", "I", [19, 17, 0]],
            ],
        };
        const c = createConstruction();
        readDgo(c, figure);
        c.flush();
        const get = <T>(name: string) => c.getObj(name) as T;
        const coords = (points: point_object[]) => points.map((p) => p.coords);
        expectClose(coords(get<polygon_object>("p1").points), [
            [-2, 0, 0],
            [-4, 0, 0],
            [-3, 2, 0],
        ]);
        const s1 = get<segment_object>("s1");
        expectClose(coords([s1.P1, s1.P2]), [
            [2, -2, 0],
            [0, -2, 0],
        ]);
        expect(get<object>("v1")).toBeInstanceOf(vector_object);
        const v1 = get<vector_object>("v1");
        expectClose(coords([v1.P1, v1.P2]), [
            [1, 2, 0],
            [2, 4, 0],
        ]);
        const r1 = get<ray_line_object>("r1");
        expect(r1).toBeInstanceOf(ray_line_object);
        expectClose(r1.P1.coords, [0, -2, 0]);
        expectClose(r1.VEC, [0, 1, 0]);
        // By the dilation of ratio A's abscissa: O itself.
        const l1 = get<two_points_line_object>("l1");
        expect(l1.defined).toBe(false);
        const a = get<point_object>("A");
        a.coords = [2, 1, 0];
        c.invalidateGeometry(a);
        c.flush();
        expect(l1.defined).toBe(true);
        expectClose(l1.P1.coords, [3, 1, 0]);
        a.coords = [0, 0, 0];
        c.invalidateGeometry(a);
        c.flush();
        const c1 = get<circle3pts_object>("c1");
        expectClose(c1.CENTER, [0, -2, 0]);
        expect(c1.R).toBeCloseTo(2);
        const a1 = get<arc3pts_object>("a1");
        expectClose(a1.CENTER, [-3, 0.75, 0]);
        expect(a1.insideBounds([-3, 2, 0])).toBe(true);
        expect(a1.insideBounds([-3, -0.5, 0])).toBe(false);
        expect(get<point_object>("I").defined).toBe(true);
        // The image of the triangle has a polygon's look.
        expect(get<polygon_object>("p1").fill_color).toBe("rgb(35,141,227)");
        const saved = await describeDgo(c);
        expect(saved.o.slice(14)).toEqual(
            figure.o.slice(14).map((entry) => entry.slice(0, 3)),
        );
        await roundTrip(async (copy) => readDgo(copy, saved));
    });

    it("reads arcs of an ellipse, bounded at their ends", () => {
        const c = createConstruction();
        readDgo(c, {
            dgo: 1,
            v: { o: [400, 300], u: 40, w: 800, h: 600 },
            o: [
                ["Pt", "F", [-1, 0]],
                ["Pt", "G", [1, 0]],
                ["Ell1", "e", [0, 1, 2]],
                ["Pt", "P", [2, 0]],
                ["Pt", "Q", [0, 3]],
                ["QArc", "a", [2, 3, 4]],
                ["QSec", "s", [2, 4, 3]],
                ["Pt", "O", [0, 0]],
                ["Pt", "X", [1, 1]],
                ["Line", "d", [7, 8]],
                ["Int", "I", [5, 9, 0]],
                ["Int", "J", [5, 9, 1]],
                ["On", "M", [5, [-1, -0.2]]],
            ],
        });
        c.flush();
        const [a, s] = ["a", "s"].map(
            (name) => c.getObj(name) as conic_arc_object,
        );
        expect(a.defined && s.defined).toBe(true);
        expect(a.span).toBeCloseTo(Math.PI / 2);
        // From Q to P counterclockwise: three quarters of the ellipse.
        expect(s.span).toBeCloseTo((3 * Math.PI) / 2);
        expect(s.path.getAtt("d")).toMatch(/^M0 0 L.* Z$/);
        // Of the line's two points on the ellipse, only that of the arc.
        const [I, J] = ["I", "J"].map((name) => c.getObj(name) as point_object);
        expect([I, J].filter((point) => point.defined)).toHaveLength(1);
        const met = I.defined ? I : J;
        expect(met.x).toBeGreaterThan(0);
        expect(met.y).toBeCloseTo(met.x);
        // Beyond the arc, at its nearest end.
        expectClose((c.getObj("M") as point_object).coords, [
            0,
            Math.sqrt(3),
            0,
        ]);
    });

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

describe(".dgo figures", () => {
    it("draws the long division with a turtle its blocks write", async () => {
        const c = createConstruction();
        await importDgoFromUrl(c, "/tests/dgo/Blockly/division_posee.dgo");
        const digits = [...c.svg.dom().querySelectorAll("text")]
            .map((text) => text.textContent)
            .join("");
        expect(digits).toBe("78962278-90-9678-182156-262234-287810123");
        const objects = (await describeDgo(c)).o as [
            string,
            string,
            { s: [string] },
        ][];
        const [program] = objects.find(
            ([, name]) => name === "blk_turtle_exp_P1",
        )![2].s;
        const blocks = programBlocks(parseProgram(program), true, formatName);
        expect(blocksProgram(blocks!, formatName)).toBe(program);
    });

    it("counts the gears' turns with M's drag program, written by blocks", async () => {
        const c = createConstruction();
        await importDgoFromUrl(c, "/tests/dgo/Blockly/engrenage.dgo");
        await expectBlocksPrograms(c, 9);
        const point = (name: string) => c.getObj(name) as point_object;
        const [M, P1] = [point("M"), point("P1")];
        // Where M is on the green wheel at the angle (degrees).
        const onWheel = (angle: number): Vec3 => {
            const r = c.getObj("C1")!.scriptValue(false) as number;
            const a = (angle * Math.PI) / 180;
            return [P1.x + r * Math.cos(a), P1.y + r * Math.sin(a), 0];
        };
        // M turned by 450°, 5° at a time.
        for (let angle = 5; angle <= 450; angle += 5) {
            M.coords = onWheel(angle);
            c.invalidateGeometry(M);
            c.gesture(M, "drag");
            c.flush();
        }
        const turned = () => (c.getObj("c") as expression_object).value;
        expect(turned()).toBeCloseTo(450);
        // More teeth: a larger wheel, M kept on it.
        const a = c.getObj("a")!;
        setValue(a, 20);
        c.invalidateGeometry(a);
        c.flush();
        expectClose(M.coords, onWheel(90));
        (c.getObj("blk_btn") as button_object).run();
        c.flush();
        expect(turned()).toBe(0);
        expectClose(M.coords, point("P4").coords);
    });

    it("draws the spirograph's curve as its clock turns the wheel, written by blocks", async () => {
        const c = createConstruction();
        c.animations.paused = true;
        await importDgoFromUrl(c, "/tests/dgo/Blockly/spirographe.dgo");
        await expectBlocksPrograms(c, 8);
        const value = (name: string) =>
            (c.getObj(name) as expression_object).value;
        const clock = c.getObj("horloge")!;
        const button = (name: string) => {
            (c.getObj(name) as button_object).run();
            c.flush();
        };
        const tick = (from: number, to: number) => {
            for (let seconds = from; seconds <= to; seconds += 0.5) {
                setValue(clock, seconds);
                c.invalidateGeometry(clock);
                c.flush();
            }
        };
        // 100° a second.
        button("blk_btn0");
        tick(0.5, 2);
        expect(value("c")).toBe(200);
        // P7 shown again, where it was, as c goes back to 0 before.
        button("blk_btn");
        expect([value("c"), value("anim")]).toEqual([0, 0]);
        expectClose(
            (c.getObj("P7") as point_object).coords.slice(0, 2),
            [4.22514716685645, -3.2625],
        );
        // 3 turns: done in 10.8 s.
        button("blk_btn0");
        tick(2.5, 14);
        expect([value("c"), value("anim")]).toEqual([1080, 0]);
        const P4 = c.getObj("P4") as point_object;
        const curve = (c.getObj("blk_turtle_list_P3") as expression_list_object)
            .points;
        expect(curve.length).toBeGreaterThan(1000);
        expectClose(curve[curve.length - 1], P4.coords.slice(0, 2));
        expect(P4.hidden).toBe(0);
    });

    it("counts the bike's turns with the pedal's drag program, written by blocks", async () => {
        const c = createConstruction();
        await importDgoFromUrl(c, "/tests/dgo/Blockly/VTT.dgo");
        // The wheel's size in pixels, 2*C8*pixel(), has no block.
        await expectBlocksPrograms(c, 8, ["taille"]);
        const point = (name: string) => c.getObj(name) as point_object;
        const [M, P1, P3] = [point("M"), point("P1"), point("P3")];
        const r = c.getObj("C2")!.scriptValue(false) as number;
        // Where the pedal is, turned clockwise by the angle (degrees).
        const onCrank = (angle: number): Vec3 => {
            const a = (angle * Math.PI) / 180;
            return [P3.x + r * Math.cos(a), P3.y - r * Math.sin(a), 0];
        };
        // The pedal turned by 450°, 5° at a time.
        for (let angle = 5; angle <= 450; angle += 5) {
            M.coords = onCrank(angle);
            c.invalidateGeometry(M);
            c.gesture(M, "drag");
            c.flush();
        }
        expect((c.getObj("c") as expression_object).value).toBeCloseTo(450);
        await frame();
        const texts = [...c.svg.dom().querySelectorAll("text")].map(
            (text) => text.textContent,
        );
        expect(texts).toContain("1,25 tours");
        expect(texts).toContain("2,19 tours");
        // The bike moved: the pedal stays where it was on the crank.
        P1.coords = [P1.x + 1, P1.y + 2, 0];
        c.invalidateGeometry(P1);
        c.gesture(P1, "drag");
        c.flush();
        expectClose(M.coords, onCrank(450));
        (c.getObj("blk_btn") as button_object).run();
        c.flush();
        expect((c.getObj("c") as expression_object).value).toBe(0);
        expectClose(M.coords, point("P5").coords);
    });
});

// The figure's programs, each shown in blocks, which write it back as it is,
// but the expressions named `formulas`, which have no blocks.
async function expectBlocksPrograms(
    c: construction,
    count: number,
    formulas: string[] = [],
): Promise<void> {
    const programs = ((await describeDgo(c)).o as [string, string, unknown][])
        .filter(([, name]) => !formulas.includes(name))
        .map(([, , params]) => (params as { s?: [string] }).s?.[0])
        .filter((program) => program !== undefined);
    expect(programs.length).toBe(count);
    programs.forEach((program) =>
        expect(
            blocksProgram(
                programBlocks(parseProgram(program), true, formatName)!,
                formatName,
            ),
        ).toBe(program),
    );
}
