import { describe, expect, it } from "vitest";
// First, as in main.ts: the object classes import each other.
import "../../src/construction";
import type { construction } from "../../src/construction";
import { readDgo } from "../../src/dgo";
import { isCommand } from "../../src/editor/catalog";
import { add, resolve } from "../../src/editor/figure";
import { parseLine } from "../../src/editor/text";
import { createConstruction, disposeFigures } from "./figures";

disposeFigures();

function space(): construction {
    const c = createConstruction([800, 600]);
    readDgo(c, {
        dgo: 1,
        v: { o: [400, 300], u: 40, w: 800, h: 600, "3d": 1 },
        o: [],
    });
    c.GRID.THETA = 0.4;
    c.GRID.PHI = 0.6;
    c.invalidateProjection();
    c.flush();
    return c;
}

const type = (c: construction, ...lines: string[]) => {
    const objects = lines.map((line) =>
        add(c, resolve(c, parseLine(line, isCommand))),
    );
    c.flush();
    return objects;
};

// What the slightest turn of the view would draw must already be drawn.
function expectUpToDate(c: construction): void {
    const drawn = c.svg.dom().outerHTML;
    c.invalidateProjection();
    c.flush();
    expect(drawn).toBe(c.svg.dom().outerHTML);
}

const POINTS = ["A = (-3, 2, 1)", "B = (1, -3, 1)", "C = (2, 3, 4)"];
const PREVIEW = ["P = (-1, 1, 3)", "Q = (2, -1, 3)", "R = (0, 3, -4)"];

describe("the view as objects come and go", () => {
    it("draws a new plane's part behind the floor", () => {
        const c = space();
        type(c, ...POINTS);
        type(c, "p = Plane(A, B, C)");
        expectUpToDate(c);
    });

    it("forgets a removed plane's part behind the floor", () => {
        const c = space();
        type(c, ...PREVIEW);
        const [plane] = type(c, "p = Plane(P, Q, R)");
        c.invalidateProjection();
        c.flush();
        c.removeObject(plane);
        c.flush();
        expectUpToDate(c);
    });

    it("replaces a plane's preview by the plane", () => {
        const c = space();
        type(c, ...POINTS, ...PREVIEW);
        const [preview] = type(c, "r = Plane(P, Q, R)");
        // As the pointer moves it.
        c.invalidateGeometry(c.getObj("R")!);
        c.flush();
        c.removeObject(preview);
        type(c, "p = Plane(A, B, C)");
        expectUpToDate(c);
    });

    it("draws the floor without a plane hidden, and with it shown again", () => {
        const c = space();
        type(c, ...POINTS);
        const [plane] = type(c, "p = Plane(A, B, C)");
        c.invalidateProjection();
        c.flush();
        plane.hidden = 1;
        plane.updateView();
        c.flush();
        expectUpToDate(c);
        plane.hidden = 0;
        plane.updateView();
        c.flush();
        expectUpToDate(c);
    });

    it("cuts the faces by a new plane, and no longer by a removed one", () => {
        const c = space();
        type(
            c,
            "U = (-2, -2, -1)",
            "V = (2, -2, -1)",
            "W = (0, 2, 3)",
            "t = Polygon(U, V, W)",
            ...POINTS,
        );
        const [plane] = type(c, "p = Plane(A, B, C)");
        expectUpToDate(c);
        c.removeObject(plane);
        c.flush();
        expectUpToDate(c);
    });

    it("dashes what a new polygon hides, and no longer what a removed one did", () => {
        const c = space();
        type(c, "U = (-3, -3, 0)", "V = (3, 3, 0)", "s = Segment(U, V)");
        type(c, "E = (-4, 0, 5)", "F = (4, -4, 5)", "G = (4, 4, 5)");
        const [polygon] = type(c, "t = Polygon(E, F, G)");
        expectUpToDate(c);
        c.removeObject(polygon);
        c.flush();
        expectUpToDate(c);
    });
});
