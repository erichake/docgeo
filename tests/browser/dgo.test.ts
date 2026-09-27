/// <reference types="vite/client" />
import { afterEach, describe, expect, it } from "vitest";
import { construction } from "../../src/construction";
import { importDgp, importDgpFromUrl } from "../../src/dgp_importer";
import {
    describeDgo,
    importDgoFromBlob,
    readDgo,
    writeDgo,
} from "../../src/dgo";
import { importGgbFromUrl } from "../../src/ggb_importer";
import { expression_object } from "../../src/objects/expression_object";
import { point_on_object } from "../../src/objects/point_on_object";
import { point_object } from "../../src/objects/point_object";
import { preferences } from "../../src/preferences";

function createConstruction(): construction {
    document.documentElement.style.width = "100%";
    document.documentElement.style.height = "100%";
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    document.body.style.margin = "0";
    return construction.create({ prefs: new preferences() });
}

afterEach(() => {
    construction.constructions.slice().forEach((item) => item.dispose());
    document.body.removeAttribute("style");
    document.documentElement.removeAttribute("style");
});

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

const names = (paths: Record<string, unknown>) =>
    Object.keys(paths).map((path) => path.split("/").pop()!);
const DGP = names(import.meta.glob("../dgp/*.dgp"));
const GGB = names(import.meta.glob("../ggb/*.ggb"));

// What the figure draws: its visible elements, whatever order their
// attributes were set in, without the ids numbered per construction.
function drawing(element: Element): string {
    const style = (element.getAttribute("style") ?? "")
        .split(";")
        .map((declaration) => declaration.trim())
        .filter(Boolean);
    if (style.includes("display: none")) return `<${element.tagName}/>`;
    const attributes = [...element.attributes]
        .map(({ name, value }) =>
            name === "style"
                ? `style=${style.sort().join(";")}`
                : `${name}=${value}`,
        )
        .sort();
    const content = [...element.childNodes]
        .map((node) =>
            node instanceof Element ? drawing(node) : (node.textContent ?? ""),
        )
        .join("");
    return `<${element.tagName} ${attributes.join(" ")}>${content}</>`.replace(
        /(sphere-gradient-|floor-clip-)\d+/g,
        "$1",
    );
}

// Where two drawings first differ beyond half a pixel, screen positions
// being saved to the pixel.
function drawingDifference(a: string, b: string): string {
    const NUMBER = /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g;
    const [partsA, partsB] = [a, b].map((text) => text.split(NUMBER));
    const [numbersA, numbersB] = [a, b].map((text) => text.match(NUMBER) ?? []);
    const context = (i: number) =>
        `${partsA.slice(Math.max(0, i - 3), i + 1).join("#")}\n≠\n${partsB.slice(Math.max(0, i - 3), i + 1).join("#")}`;
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        if (partsA[i] !== partsB[i]) return context(i);
        if (
            i < numbersA.length &&
            !(Math.abs(Number(numbersA[i]) - Number(numbersB[i])) <= 0.5)
        )
            return `${numbersA[i]} ≠ ${numbersB[i]}: ${context(i)}`;
    }
    return "";
}

// Numbers only differ by rounding: a point on a polygon, for instance,
// recomputes its parameters from its position.
function expectClose(actual: unknown, expected: unknown, path = ""): void {
    if (Number.isNaN(expected)) expect(actual, path).toBeNaN();
    else if (typeof expected === "number" && typeof actual === "number") {
        expect(Math.abs(actual - expected), path).toBeLessThanOrEqual(
            1e-9 * Math.max(1, Math.abs(expected)),
        );
    } else if (typeof expected === "object" && expected !== null) {
        expect(typeof actual, path).toBe("object");
        const keys = Object.keys(expected);
        expect(Object.keys(actual as object), path).toEqual(keys);
        keys.forEach((key) =>
            expectClose(
                (actual as Record<string, unknown>)[key],
                (expected as Record<string, unknown>)[key],
                `${path}/${key}`,
            ),
        );
    } else expect(actual, path).toEqual(expected);
}

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
