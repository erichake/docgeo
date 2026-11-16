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
