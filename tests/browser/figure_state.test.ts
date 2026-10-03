import { describe, expect, it } from "vitest";
// First, as in main.ts: the object classes import each other.
import "../../src/construction";
import type { construction } from "../../src/construction";
import { describeDgo, figureObjects, readDgo } from "../../src/dgo";
import { importDgpFromUrl } from "../../src/dgp_importer";
import {
    builtView,
    figureState,
    figureValues,
    objectValue,
    stateFigure,
} from "../../src/figure_state";
import { importGgbFromUrl } from "../../src/ggb_importer";
import { circle1_object } from "../../src/objects/circle1_object";
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

// An orthocenter H, a point M it attracts, their distance, and a slider.
const FIGURE = {
    dgo: 1,
    v: { o: [400, 300], u: 40, w: 800, h: 600 },
    st: [{ mg: [[7, 20]] }],
    o: [
        ["Pt", "A", [-3.1, -2.3]],
        ["Pt", "B", [4.2, -1.7]],
        ["Pt", "C", [0.7, 3.3]],
        ["Line", "a", [1, 2]],
        ["Line", "b", [0, 2]],
        ["Perp", "ha", [3, 0]],
        ["Perp", "hb", [4, 1]],
        ["Int", "H", [5, 6, 0]],
        ["Pt", "M", [3, 3], 0],
        ["Ex", "d", { t: "", s: ["d(H,M)", { H: 7, M: 8 }], xy: [20, 20] }],
        ["Ex", "k", { t: "", v: 2, mn: 0, mx: 10, xy: [20, 60] }],
    ],
};

// What a student can do: move every free point, pinned or not, and point on
// an object, change every slider, checkbox, number and circle's radius.
function manipulate(c: construction): void {
    figureObjects(c).forEach((object) => {
        if (object instanceof point_on_object) {
            const alpha = object.alpha;
            object.alpha =
                typeof alpha === "number"
                    ? alpha * 0.97 + 0.01
                    : [alpha[0] * 0.97 + 0.01, alpha[1]];
        } else if (object.constructor === point_object) {
            const point = object as point_object;
            point.coords = [
                point.x + 0.37,
                point.y - 0.21,
                point.z && point.z + 0.13,
            ];
            if (point.pinned) point.pin();
        } else if (
            object instanceof circle1_object &&
            typeof object.radius === "number"
        )
            object.radius = object.radius * 0.97 + 0.01;
        else if (
            object instanceof expression_object &&
            !object.formula &&
            !object.program &&
            typeof object.value === "number"
        )
            object.value = object.checkbox
                ? +(object.value === 0)
                : object.isCursor
                  ? object.min! + (object.max! - object.min!) * 0.37
                  : object.value + 0.5;
        else return;
        c.invalidateGeometry(object);
    });
}

// The figure a student left, and the one their state rebuilds from the
// base figure: the same, traces aside, which the state doesn't keep.
async function stateRoundTrip(
    open: (c: construction) => Promise<unknown>,
    change = manipulate,
): Promise<void> {
    const imported = createConstruction();
    await open(imported);
    await frame();
    const base = await describeDgo(imported);
    imported.dispose();
    const student = createConstruction();
    readDgo(student, base, true);
    await frame();
    const view = builtView(student);
    const values = figureValues(student, view);
    expect(figureState(student, values, view)).toEqual({});
    change(student);
    await frame();
    const state = JSON.parse(
        JSON.stringify(figureState(student, values, view)),
    );
    const copy = createConstruction();
    readDgo(copy, stateFigure(student, base, state), true);
    await frame();
    expectClose(figureState(copy, values, builtView(copy)), state);
    [student, copy].forEach((c) => c.traceLayer.dom().replaceChildren());
    // Up to rounding: a point on a polygon recomputes its parameters from
    // its position, a name is placed by its measured width.
    expect(
        drawingDifference(
            drawing(copy.svg.dom()),
            drawing(student.svg.dom()),
            1e-3,
        ),
    ).toBe("");
}

describe("state round trip", () => {
    it.each(DGP)("%s", (name) =>
        stateRoundTrip((c) => importDgpFromUrl(c, figure(name))),
    );
    it.each(GGB)("%s", (name) =>
        stateRoundTrip((c) => importGgbFromUrl(c, figure(name))),
    );

    // The state alone, from the base figure, would number them otherwise.
    it("keeps which intersection is which", () =>
        stateRoundTrip(
            (c) => importDgpFromUrl(c, figure("_Conique3.dgp")),
            (c) => {
                const [first, third] = ["I0", "I2"].map(
                    (name) => c.getObj(name) as point_object,
                );
                [first.coords, third.coords] = [third.coords, first.coords];
                c.invalidateGeometry(c.getObj("Cir")!);
            },
        ));
});

describe("state", () => {
    async function open(): Promise<construction> {
        const c = createConstruction();
        await importDgpFromUrl(c, figure("_Expression.dgp"));
        await frame();
        return c;
    }

    it("holds only what differs from the base figure", async () => {
        const c = await open();
        const view = builtView(c);
        const values = figureValues(c, view);
        const slider = c.getObj("E2") as expression_object;
        slider.value = 7.25;
        c.invalidateGeometry(slider);
        expect(figureState(c, values, view)).toEqual({ E2: 7.25 });
        slider.value = JSON.parse(values.get("E2")!);
        expect(figureState(c, values, view)).toEqual({});
    });

    it("leaves the view out", async () => {
        const c = await open();
        const view = builtView(c);
        const values = figureValues(c, view);
        const [ux, uy, uz] = c.GRID.UNIT;
        c.GRID.UNIT = [2 * ux, 2 * uy, 2 * uz];
        c.GRID.ORG = [c.GRID.ORG[0] + 50, c.GRID.ORG[1] - 30];
        c.invalidateProjection();
        await frame();
        expect(figureState(c, values, view)).toEqual({});
    });

    it.each([
        ["not an object", [1]],
        ["an unknown name", { Z: 1 }],
        ["an inherited name", { toString: 1 }],
        ["an object no manipulation changes", { H: [1, 2] }],
        ["a point's coordinates as a number", { A: 1 }],
        ["too many coordinates", { A: [1, 2, 3, 4] }],
        ["a number as coordinates", { k: [1, 2] }],
        ["a string", { k: "1" }],
    ])("rejects %s", (_, state) => {
        const c = createConstruction();
        readDgo(c, FIGURE);
        expect(() => stateFigure(c, FIGURE, state)).toThrow("Invalid state");
    });
});

describe("magnets", () => {
    it("give the attracted point the attracting point's coordinates", async () => {
        const c = createConstruction();
        readDgo(c, FIGURE);
        await frame();
        const [H, M] = ["H", "M"].map((name) => c.getObj(name) as point_object);
        const { left, top } = c.svg.dom().getBoundingClientRect();
        M.mousedrag(
            new PointerEvent("pointermove", {
                clientX: left + H.sx + 7,
                clientY: top + H.sy - 5,
            }),
        );
        c.flush();
        expect(M.coords).toEqual(H.coords);
        expect(objectValue(c, "d")).toBe(0);
    });
});
