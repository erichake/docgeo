/// <reference types="vite/client" />
import { afterEach, expect } from "vitest";
import { construction } from "../../src/construction";
import { preferences } from "../../src/preferences";

// Each test file's figures are disposed of after each test.
export function disposeFigures(): void {
    afterEach(() => {
        construction.constructions.slice().forEach((item) => item.dispose());
        document.body.removeAttribute("style");
        document.documentElement.removeAttribute("style");
    });
}

// In a window of the given size, in pixels, or the whole page.
export function createConstruction(size?: [number, number]): construction {
    document.documentElement.style.width = "100%";
    document.documentElement.style.height = "100%";
    document.body.style.width = size ? `${size[0]}px` : "100%";
    document.body.style.height = size ? `${size[1]}px` : "100%";
    // The figure fills its containing block, which the test page otherwise
    // makes at least as high as the page.
    if (size) {
        document.body.style.position = "relative";
        document.body.style.minHeight = "0";
    }
    document.body.style.margin = "0";
    return construction.create({ prefs: new preferences() });
}

export const frame = () =>
    new Promise((resolve) => requestAnimationFrame(resolve));

const names = (paths: Record<string, unknown>) =>
    Object.keys(paths).map((path) => path.split("/").pop()!);
export const DGP = names(import.meta.glob("../dgp/*.dgp"));
export const GGB = names(import.meta.glob("../ggb/*.ggb"));

// What the figure draws: its visible elements, whatever order their
// attributes were set in, without the ids numbered per construction.
export function drawing(element: Element): string {
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

// Where two drawings first differ beyond `tolerance` pixels: by default
// half a pixel, screen positions being saved to the pixel.
export function drawingDifference(
    a: string,
    b: string,
    tolerance = 0.5,
): string {
    const NUMBER = /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g;
    const [partsA, partsB] = [a, b].map((text) => text.split(NUMBER));
    const [numbersA, numbersB] = [a, b].map((text) => text.match(NUMBER) ?? []);
    const context = (i: number) =>
        `${partsA.slice(Math.max(0, i - 3), i + 1).join("#")}\n≠\n${partsB.slice(Math.max(0, i - 3), i + 1).join("#")}`;
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        if (partsA[i] !== partsB[i]) return context(i);
        if (
            numbersA[i] !== numbersB[i] &&
            i < numbersA.length &&
            !(Math.abs(Number(numbersA[i]) - Number(numbersB[i])) <= tolerance)
        )
            return `${numbersA[i]} ≠ ${numbersB[i]}: ${context(i)}`;
    }
    return "";
}

// Numbers only differ by rounding: a point on a polygon, for instance,
// recomputes its parameters from its position.
export function expectClose(
    actual: unknown,
    expected: unknown,
    path = "",
): void {
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
