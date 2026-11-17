import { describe, expect, it } from "vitest";
// First, as in main.ts: the object classes import each other.
import "../../src/construction";
import type { construction } from "../../src/construction";
import { describeDgo, readDgo } from "../../src/dgo";
import { importGgbFromUrl } from "../../src/ggb_importer";
import type { point_object } from "../../src/objects/point_object";
import type { segment_object } from "../../src/objects/segment_object";
import {
    createConstruction,
    disposeFigures,
    expectClose,
    figure,
} from "./figures";

disposeFigures();

// Two views side by side: A and B on the left, their segment on the right,
// seen from another origin, at another scale, on a white background.
const FIGURE = {
    dgo: 1,
    v: { o: [200, 300], u: 40, w: 800, h: 600, cw: 0.5 },
    vs: [{ o: [100, 200], u: 20, cw: 0.5, bg: "#ffffff" }],
    st: [{ vw: 1 }],
    o: [
        ["Pt", "A", [1, 2]],
        ["Pt", "B", [3, -1]],
        ["Seg", "s", [0, 1], 0],
    ],
};

function open(figure: object = FIGURE): construction {
    const c = createConstruction([800, 600]);
    readDgo(c, figure);
    c.flush();
    return c;
}

describe("views", () => {
    it("draws each object in its view, in its coordinate system", () => {
        const c = open();
        expect(c.views).toHaveLength(2);
        const [left, right] = c.views;
        expect(left.svg.width()).toBe(400);
        expect(right.svg.dom().getBoundingClientRect().left).toBe(400);
        const A = c.getObj("A") as point_object;
        const s = c.getObj("s") as segment_object;
        expect(left.svg.dom().contains(A.dom.dom())).toBe(true);
        expect(right.svg.dom().contains(s.dom.dom())).toBe(true);
        expect(left.svg.dom().contains(s.dom.dom())).toBe(false);
        expectClose(A.SCREEN, [240, 220]);
        expectClose(s.sP1, [120, 160]);
        expectClose(s.sP2, [160, 220]);
        expect((right.svg.dom() as SVGElement).style.background).toBe(
            "rgb(255, 255, 255)",
        );
    });

    it("moves what is drawn in a view with its parents in another", () => {
        const c = open();
        const A = c.getObj("A") as point_object;
        A.coords = [0, 0, 0];
        c.invalidateGeometry(A);
        c.flush();
        expectClose((c.getObj("s") as segment_object).sP1, [100, 200]);
    });

    it("pans and zooms only the view under the pointer", () => {
        const c = open();
        const [left, right] = c.views;
        right.svg
            .dom()
            .dispatchEvent(new PointerEvent("pointermove", { bubbles: true }));
        expect(c.view).toBe(1);
        c.pan(new PointerEvent("pointermove"), [10, 5]);
        c.flush();
        expect(right.grid.ORG).toEqual([110, 205]);
        expect(left.grid.ORG).toEqual([200, 300]);
        expectClose((c.getObj("s") as segment_object).sP1, [130, 165]);
    });

    it("saves its views and their objects", async () => {
        const c = open();
        const saved = await describeDgo(c);
        expect(saved.v).toEqual(FIGURE.v);
        expect(saved.vs).toEqual(FIGURE.vs);
        expect(saved.st).toEqual(FIGURE.st);
        expect(saved.o).toEqual(FIGURE.o);
    });
});

// The same point A in space, then seen from above in the plane view.
const SPACE_FIGURE = {
    dgo: 1,
    v: { o: [200, 300], u: 40, w: 800, h: 600, cw: 0.5, "3d": 1, th: 0.3 },
    vs: [{ o: [100, 200], u: 20, cw: 0.5 }],
    st: [{ vw: 1 }],
    o: [
        ["Pt", "A", [1, 2, 3]],
        ["Pt", "B", [1, 2, 3], 0],
    ],
};

describe("A view's background image", () => {
    it("is painted over its color, saved with its layout", async () => {
        const dot =
            "data:image/svg+xml;base64," +
            btoa(
                '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>',
            );
        const c = open({
            ...FIGURE,
            img: { dot },
            vs: [{ ...FIGURE.vs[0], bgi: "dot", bgf: "cover" }],
        });
        const [left, right] = c.views;
        expect(right.grid.backgroundImage).toBe(dot);
        const painted = (right.svg.dom() as SVGElement).style.background;
        expect(painted).toContain("url(");
        expect(painted).toContain("cover");
        expect((left.svg.dom() as SVGElement).style.background).not.toContain(
            "url(",
        );
        const saved = await describeDgo(c);
        expect(saved.vs![0].bgf).toBe("cover");
        expect(saved.img![saved.vs![0].bgi as string]).toBe(dot);
    });
});

describe("A locked view", () => {
    it("is neither panned, zoomed nor turned by a gesture", async () => {
        const c = open({
            ...SPACE_FIGURE,
            vs: [{ ...SPACE_FIGURE.vs[0], lk: 1 }],
        });
        const [space, plane] = c.views.map(({ grid }) => grid);
        expect(plane.locked).toBe(true);
        const wheel = new WheelEvent("wheel", { deltaY: 100 });
        const drag = new PointerEvent("pointermove");
        const before = [plane.ORG, plane.UNIT];
        c.inView(1, () => {
            c.mousewheel(wheel, [10, 10]);
            c.mousedrag(drag, [20, 30]);
        });
        expect([plane.ORG, plane.UNIT]).toEqual(before);
        const theta = space.THETA;
        c.inView(0, () => c.mousedrag(drag, [20, 30]));
        expect(space.THETA).not.toBe(theta);
        expect((await describeDgo(c)).vs![0].lk).toBe(1);
    });
});

describe("A plane view beside a 3D view", () => {
    it("keeps the figure in space, the plane view seeing it from above", () => {
        const c = open(SPACE_FIGURE);
        expect(c.views.map(({ grid }) => grid.is2D)).toEqual([false, true]);
        expect(c.space).toBe(true);
        expect(c.spaceGrid).toBe(c.views[0].grid);
        const B = c.getObj("B") as point_object;
        expect(B.coords).toEqual([1, 2, 3]);
        expectClose(B.SCREEN, [120, 160]);
        // The 3D view keeps its origin where it was saved.
        expect(c.views[0].grid.ORG).toEqual([200, 300]);
    });

    it("moves a column with its objects", async () => {
        const c = open(SPACE_FIGURE);
        c.moveView(1, 0);
        c.flush();
        expect(c.views.map(({ grid }) => grid.is2D)).toEqual([true, false]);
        expect(["A", "B"].map((name) => c.getObj(name)!.view)).toEqual([1, 0]);
        expect(c.views[0].svg.dom().getBoundingClientRect().left).toBe(0);
        expectClose((c.getObj("B") as point_object).SCREEN, [120, 160]);
        const saved = await describeDgo(c);
        expect(saved.v["3d"]).toBeUndefined();
        expect(saved.vs![0]["3d"]).toBe(1);
    });
});

describe("GeoGebra's second graphics view", () => {
    it("is a view beside the first, with its objects", async () => {
        const c = createConstruction([1000, 700]);
        const unsupported = await importGgbFromUrl(
            c,
            figure("synthese_couleurs.ggb"),
        );
        c.flush();
        expect(unsupported).toEqual([]);
        expect(c.views).toHaveLength(2);
        const [left, right] = c.views;
        expect(left.rect[2]).toBeCloseTo(731 / 1461);
        const inSecond = (name: string) =>
            right.svg.dom().contains(c.getObj(name)!.dom.dom());
        expect(["h", "n", "texte2"].every(inSecond)).toBe(true);
        expect(["a", "g", "texte1"].some(inSecond)).toBe(false);
        expect((left.svg.dom() as SVGElement).style.background).toBe(
            "rgb(0, 0, 0)",
        );
        expect((right.svg.dom() as SVGElement).style.background).toBe(
            "rgb(255, 255, 255)",
        );
    });
});
