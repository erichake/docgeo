import { afterEach, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";

declare module "vitest/browser" {
    interface BrowserCommands {
        drag(
            selector: string,
            from: [number, number],
            to: [number, number],
            touch: boolean,
        ): Promise<void>;
    }
}

afterEach(() =>
    document.querySelectorAll("iframe").forEach((iframe) => iframe.remove()),
);

// Saved by DGPad in a window of 1000 × 650 pixels, its origin at
// (729.43…, 97.24…), 37.44… pixels per unit.
const FIGURE = "/tests/dgp/recip_thales.dgp";
const VIEW = "729.4314345278989,97.23947242656072,37.4411219964434";

const until = async <T>(found: () => T | null | undefined): Promise<T> => {
    for (let tries = 0; tries < 200; tries++) {
        const value = found();
        if (value) return value;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Not found");
};

// A page showing `src` in an iframe of the given style.
function page(src: string, style: string): HTMLIFrameElement {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("style", `display: block; border: 0; ${style}`);
    iframe.src = src;
    document.body.append(iframe);
    return iframe;
}

// Where the point labeled `name` is drawn, in the SVG's units, once shown.
const pointAt = (view: HTMLIFrameElement | Window, name: string) =>
    until(() => {
        const document =
            view instanceof HTMLIFrameElement
                ? view.contentDocument
                : view.document;
        const label = [...(document?.querySelectorAll("svg text") ?? [])].find(
            (text) =>
                text.textContent === name &&
                text.closest("svg")!.style.visibility !== "hidden",
        );
        const transform = label?.parentElement!.getAttribute("transform");
        return transform?.match(/-?[\d.]+/g)!.map(Number);
    });

const scene = (iframe: HTMLIFrameElement) =>
    iframe.contentDocument!.querySelector("body > svg") as SVGSVGElement;

function expectNear(actual: number[], expected: number[], tolerance = 0.5) {
    expect(actual).toHaveLength(expected.length);
    actual.forEach((value, index) =>
        expect(Math.abs(value - expected[index])).toBeLessThanOrEqual(
            tolerance,
        ),
    );
}

describe("web page mode", () => {
    it("shows the saved window, scaled to the iframe", async () => {
        const reference = await pointAt(
            page(`/index.html?url=${FIGURE}`, "width: 1000px; height: 650px"),
            "A",
        );
        document.querySelector("iframe")!.remove();
        const iframe = page(
            `/index.html?fit&url=${FIGURE}`,
            "width: 600px; height: 300px",
        );
        expectNear(await pointAt(iframe, "A"), reference);
        const svg = scene(iframe);
        expect(svg.getAttribute("viewBox")).toBe("0 0 1000 650");
        // As large as the iframe allows, centered.
        const box = svg.getBoundingClientRect();
        expectNear(
            [box.left, box.top, box.width, box.height],
            [(600 - 300 / 0.65) / 2, 0, 300 / 0.65, 300],
        );
    });

    it("shows the region framed, in the view framed", async () => {
        const reference = await pointAt(
            page(`/index.html?url=${FIGURE}`, "width: 1000px; height: 650px"),
            "A",
        );
        document.querySelector("iframe")!.remove();
        // Zoomed in twice as much, about the window's corner.
        const [ox, oy, u] = VIEW.split(",").map(Number);
        const iframe = page(
            `/index.html?fit=400,300,500,100,${2 * ox},${2 * oy},${2 * u}&url=${FIGURE}`,
            "width: 200px; height: 150px",
        );
        expectNear(await pointAt(iframe, "A"), [
            2 * reference[0] - 500,
            2 * reference[1] - 100,
        ]);
        expect(scene(iframe).getAttribute("viewBox")).toBe("0 0 400 300");
    });

    it("drags a point as far as the pointer, and lets the wheel scroll the page", async () => {
        const iframe = page(
            `/index.html?fit&url=${FIGURE}`,
            "width: 500px; height: 325px",
        );
        const [x, y] = await pointAt(iframe, "A");
        await commands.drag(
            "iframe",
            [x / 2, y / 2],
            [x / 2 + 20, y / 2 + 10],
            false,
        );
        expectNear(await pointAt(iframe, "A"), [x + 40, y + 20], 1);

        const wheel = (ctrlKey: boolean) => {
            const event = new WheelEvent("wheel", {
                deltaY: 100,
                ctrlKey,
                cancelable: true,
            });
            scene(iframe).dispatchEvent(event);
            return event.defaultPrevented;
        };
        expect(wheel(false)).toBe(false);
        expect(wheel(true)).toBe(true);
    });

    // In a window of its own: in a frame, the editor has no menus.
    it("shows what the editor framed", async () => {
        const editor = window.open(
            `/editor.html?url=${FIGURE}`,
            "",
            "width=1200,height=800",
        )!;
        const [x, y] = await pointAt(editor, "A");
        const document = editor.document;
        let code = "";
        Object.defineProperty(editor.navigator, "clipboard", {
            value: { writeText: async (text: string) => void (code = text) },
        });
        const buttons = () => [
            ...document.querySelectorAll<HTMLButtonElement>("button"),
        ];
        const button = (text: RegExp) =>
            until(() => buttons().find((item) => text.test(item.textContent!)));
        (await button(/^File$|^Fichier$/)).click();
        (
            await button(/Embed in a web page|Intégrer dans une page web/)
        ).click();
        const frame = await until(() =>
            document.querySelector<HTMLElement>(".docgeo-frame"),
        );
        (await button(/Copy the code|Copier le code/)).click();
        await until(() => code);
        expect(code).toMatch(/^<center><iframe .*<\/iframe><\/center>$/);
        const src = new DOMParser()
            .parseFromString(code, "text/html")
            .querySelector("iframe")!
            .getAttribute("src")!;
        const [w, h, left, top] = new URL(src).searchParams
            .get("fit")!
            .split(",")
            .map(Number);
        expect([w, h]).toEqual([
            Math.round(parseFloat(frame.style.width)),
            Math.round(parseFloat(frame.style.height)),
        ]);
        expect(src).toContain(`&url=${location.origin}${FIGURE}`);
        editor.close();

        const shown = page(src, `width: ${w}px; height: ${h}px`);
        expectNear(await pointAt(shown, "A"), [x - left, y - top]);
    });
});
