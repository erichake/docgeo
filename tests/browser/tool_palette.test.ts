import { afterEach, describe, expect, it } from "vitest";
import { $ } from "../../src/dom";
import "../../src/construction";
import { SECTION_HUES, readLibrary } from "../../src/editor/library";

type Message = Record<string, any>;
const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach((dispose) => dispose()));

// The editor in a frame, which loads and saves figures.
async function editor() {
    localStorage.setItem("docgeo-palette-open", "false");
    cleanup.push(() => localStorage.removeItem("docgeo-palette-open"));
    const iframe = $.create("iframe")
        .att("src", "/editor.html?embed&lang=en")
        .stl("width:1100px;height:700px;border:0")
        .dom() as HTMLIFrameElement;
    const pending = new Map<number, (answer: Message) => void>();
    let id = 0;
    let ready!: () => void;
    const started = new Promise<void>((resolve) => (ready = resolve));
    const listener = ({ source, data }: MessageEvent) => {
        if (source !== iframe.contentWindow || data?.docgeo !== 1) return;
        if (data.event === "ready") ready();
        else if (!data.event) {
            pending.get(data.id)!(data);
            pending.delete(data.id);
        }
    };
    window.addEventListener("message", listener);
    cleanup.push(() => {
        window.removeEventListener("message", listener);
        iframe.remove();
    });
    $("body").add($(iframe));
    await started;
    const request = (type: string, parameters: Message = {}) =>
        new Promise<Message>((resolve) => {
            pending.set(++id, resolve);
            iframe.contentWindow!.postMessage(
                { docgeo: 1, id, type, ...parameters },
                "*",
            );
        });
    return { page: iframe.contentDocument!, request };
}

async function saved(request: (type: string) => Promise<Message>) {
    const { data } = (await request("save")).result;
    const stream = new Blob([data])
        .stream()
        .pipeThrough(new DecompressionStream("gzip"));
    return JSON.parse(await new Response(stream).text());
}

const TRIANGLE = {
    dgo: 1,
    v: { o: [400, 300], u: 40, w: 800, h: 600 },
    o: [
        ["Pt", "A", [-4, -1]],
        ["Pt", "B", [3, -2]],
        ["Pt", "C", [0, 3]],
        ["Cir", "c", [0, 2]],
        ["Seg", "s", [0, 1]],
    ],
};

describe("The tool palette", () => {
    it("takes the properties' place, its tools greyed by the objects chosen", async () => {
        const { page, request } = await editor();
        await request("load", {
            data: new TextEncoder().encode(JSON.stringify(TRIANGLE)).buffer,
            format: "dgo",
        });
        const body = page.body.classList;
        const press = (controls: string) =>
            (
                page.querySelector(
                    `.dge-bar [aria-controls="${controls}"]`,
                ) as HTMLElement
            ).click();
        press("dge-palette");
        expect(body.contains("dge-palette-open")).toBe(true);
        // The ring's families and the menu's tools, the programs and the
        // new macro, not the planes and solids in the plane.
        const zones = [...page.querySelectorAll(".dge-palette-title")].map(
            (title) => title.textContent,
        );
        expect(zones[0]).toBe("Points");
        expect(zones.slice(-2)).toEqual(["Programs", "Macros of the figure"]);
        expect(zones).not.toContain("Planes");
        expect(
            page.querySelector(
                '.dge-palette-grid button[aria-label="New macro"]',
            ),
        ).not.toBe(null);
        // Its button in the bar, none at the end of the line.
        expect(
            getComputedStyle(
                page.querySelector(".dge-line .dge-palette-button")!,
            ).display,
        ).toBe("none");
        // One or the other, at the same place.
        press("dge-properties");
        expect(body.contains("dge-palette-open")).toBe(false);
        expect(body.contains("dge-properties-open")).toBe(true);
        press("dge-palette");
        expect(body.contains("dge-properties-open")).toBe(false);
        expect(body.contains("dge-palette-open")).toBe(true);

        const tool = (label: string) =>
            page.querySelector(
                `.dge-palette-grid button[aria-label="${label}"]`,
            ) as HTMLElement;
        const enabled = (label: string) =>
            !tool(label).classList.contains("dge-off");
        expect(enabled("Segment")).toBe(true);
        // Taps with Shift select A, B and C, in this order.
        const { v } = await saved(request);
        const figure = page.querySelector("body > svg:has([data-layer])")!;
        const box = figure.getBoundingClientRect();
        const Pointer = (page.defaultView as typeof window).PointerEvent;
        const tap = ([x, y]: number[], shiftKey = true) => {
            const at = {
                clientX: box.left + v.o[0] + x * v.u,
                clientY: box.top + v.o[1] - y * v.u,
                shiftKey,
                bubbles: true,
                isPrimary: true,
                pointerType: "mouse",
            };
            figure.dispatchEvent(new Pointer("pointerdown", at));
            figure.dispatchEvent(new Pointer("pointerup", at));
        };
        [
            [-4, -1],
            [3, -2],
            [0, 3],
        ].forEach((at) => tap(at));
        expect(page.querySelectorAll(".dge-badges span").length).toBe(3);
        expect(enabled("Segment")).toBe(false);
        expect(enabled("Circumcircle")).toBe(true);
        // Hovered, the line it would write.
        tool("Circumcircle").dispatchEvent(
            new Pointer("pointerenter", { pointerType: "mouse" }),
        );
        expect(page.querySelector(".dge-hint")!.textContent).toBe(
            "a = Circumcircle(A, B, C)",
        );
        // And what it would build, pale, gone once left.
        const ghosts = () => figure.querySelectorAll(".dge-preview").length;
        expect(ghosts()).toBe(1);
        tool("Circumcircle").dispatchEvent(
            new Pointer("pointerleave", { pointerType: "mouse" }),
        );
        expect(ghosts()).toBe(0);
        // Chosen, it builds from them, and is left at once.
        tool("Circumcircle").click();
        await expect.poll(async () => (await saved(request)).o.length).toBe(6);
        expect(tool("Circumcircle").getAttribute("aria-pressed")).toBe("false");
        // A segment selected gives its form to the midpoint, which needs
        // nothing more.
        tap([-0.5, -1.5]);
        tool("Midpoint").dispatchEvent(
            new Pointer("pointerenter", { pointerType: "mouse" }),
        );
        expect(ghosts()).toBe(1);
        tool("Midpoint").click();
        await expect.poll(async () => (await saved(request)).o.length).toBe(7);
        expect(tool("Midpoint").getAttribute("aria-pressed")).toBe("false");
        // Escape drops the selection, then closes the palette.
        const escape = () =>
            page.body.dispatchEvent(
                new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
            );
        // A tap chooses the object without its ring, the palette showing
        // its tools.
        tap([3, -2], false);
        expect(page.querySelectorAll(".dge-ring button").length).toBe(0);
        expect(page.querySelector(".dge-bar-name")!.textContent).toBe("B");
        expect(enabled("Segment")).toBe(true);
        expect(enabled("Center")).toBe(false);
        escape();
        expect(enabled("Center")).toBe(true);
        expect(body.contains("dge-palette-open")).toBe(true);
        escape();
        expect(body.contains("dge-palette-open")).toBe(false);
    });

    // Open, it alone makes points: anywhere its first tool, on an object
    // the ring's.
    it("makes points with its tools only", async () => {
        const { page, request } = await editor();
        await request("load", {
            data: new TextEncoder().encode(JSON.stringify(TRIANGLE)).buffer,
            format: "dgo",
        });
        (
            page.querySelector(
                `.dge-bar [aria-controls="dge-palette"]`,
            ) as HTMLElement
        ).click();
        const tool = (label: string) =>
            page.querySelector(
                `.dge-palette-grid button[aria-label="${label}"]`,
            ) as HTMLElement;
        expect(page.querySelector(".dge-palette-grid button")!.ariaLabel).toBe(
            "Point",
        );
        const { v } = await saved(request);
        const figure = page.querySelector("body > svg:has([data-layer])")!;
        const box = figure.getBoundingClientRect();
        const Pointer = (page.defaultView as typeof window).PointerEvent;
        const tap = ([x, y]: number[]) => {
            const at = {
                clientX: box.left + v.o[0] + x * v.u,
                clientY: box.top + v.o[1] - y * v.u,
                bubbles: true,
                isPrimary: true,
                pointerType: "mouse",
            };
            figure.dispatchEvent(new Pointer("pointerdown", at));
            figure.dispatchEvent(new Pointer("pointerup", at));
        };
        const types = async () =>
            (await saved(request)).o.slice(5).map(([type]: string[]) => type);
        const hint = () => page.querySelector(".dge-hint")!.textContent;
        // Where the circle crosses the segment, and in the void.
        const crossing = [-4 + (32 / 50) ** 0.5 * 7, -1 - (32 / 50) ** 0.5];
        tap(crossing);
        tap([8, 5]);
        tap([8, 5]);
        expect(await types()).toEqual([]);
        tool("Point on object").click();
        expect(hint()).toContain("Designate an object");
        tap([8, 5]);
        expect(await types()).toEqual([]);
        tap([-0.5, -1.5]);
        await expect.poll(types).toEqual(["On"]);
        tool("Point").click();
        expect(hint()).toContain("Designate a spot");
        tap([8, 5]);
        await expect.poll(types).toEqual(["On", "Pt"]);
        tap(crossing);
        await expect.poll(types).toEqual(["On", "Pt", "Int"]);
    });

    // Its center designated with Shift, it takes point after point, or
    // object after object, each one's image shown first; otherwise, it asks
    // for its center again.
    it("keeps a transformation designated with Shift, which maps points and objects", async () => {
        const { page, request } = await editor();
        await request("load", {
            data: new TextEncoder().encode(
                JSON.stringify({
                    dgo: 1,
                    v: { o: [400, 300], u: 40, w: 800, h: 600 },
                    o: [
                        ["Pt", "A", [-4, -1]],
                        ["Pt", "B", [3, -2]],
                        ["Pt", "C", [0, 3]],
                        ["Pt", "O", [5, 2]],
                        ["Poly", "p", [0, 1, 2]],
                    ],
                }),
            ).buffer,
            format: "dgo",
        });
        (
            page.querySelector(
                `.dge-bar [aria-controls="dge-palette"]`,
            ) as HTMLElement
        ).click();
        const tool = page.querySelector(
            `.dge-palette-grid button[aria-label="Point reflection"]`,
        ) as HTMLElement;
        tool.click();
        const { v } = await saved(request);
        // An undo rebuilds the figure.
        const figure = () =>
            page.querySelector("body > svg:has([data-layer])")!;
        const box = figure().getBoundingClientRect();
        const Pointer = (page.defaultView as typeof window).PointerEvent;
        const pointer = (kind: string, [x, y]: number[], shiftKey = false) =>
            figure().dispatchEvent(
                new Pointer(kind, {
                    clientX: box.left + v.o[0] + x * v.u,
                    clientY: box.top + v.o[1] - y * v.u,
                    bubbles: true,
                    isPrimary: true,
                    pointerType: "mouse",
                    shiftKey,
                }),
            );
        const tap = async (at: number[], count: number, shiftKey = false) => {
            pointer("pointerdown", at, shiftKey);
            pointer("pointerup", at, shiftKey);
            await expect
                .poll(async () => (await saved(request)).o.length)
                .toBe(count);
        };
        const hint = () => page.querySelector(".dge-hint")!.textContent;
        const button = (text: string) =>
            [...page.querySelectorAll(".dge-hint .dge-hint-text")].find(
                (button) => button.textContent === text,
            ) as HTMLElement | undefined;
        await tap([5, 2], 5);
        expect(button("Keep O")).toBeDefined();
        await tap([-4, -1], 6);
        await tap([3, -2], 6);
        expect(hint()).toContain("Designate a point or an object");
        await tap([5, 2], 7);
        await tap([5, 2], 7, true);
        expect(button("Change O")).toBeDefined();
        pointer("pointermove", [-0.3, 0]);
        expect(figure().querySelectorAll(".dge-preview").length).toBe(1);
        await tap([-0.3, 0], 8);
        await tap([-4, -1], 9);
        // In the void, a point and its image.
        await tap([7, -3], 11);
        expect((await saved(request)).o.slice(5)).toEqual([
            ["Sym", "D", [3, 0], expect.anything()],
            ["Sym", "E", [1, 3], expect.anything()],
            ["Sym", "a", [3, 4], expect.anything()],
            ["Sym", "F", [3, 0], expect.anything()],
            ["Pt", "G", expect.any(Array), expect.anything()],
            ["Sym", "H", [3, 9], expect.anything()],
        ]);
        expect(tool.getAttribute("aria-pressed")).toBe("true");
        // Undone, the figure rebuilt, the center is still kept.
        page.body.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "z",
                ctrlKey: true,
                metaKey: true,
                bubbles: true,
            }),
        );
        await expect
            .poll(async () => (await saved(request)).o.length)
            .toBeLessThan(11);
        const count = (await saved(request)).o.length;
        expect(button("Change O")).toBeDefined();
        await tap([0, 3], count + 1);
        expect((await saved(request)).o[count].slice(0, 3)).toEqual([
            "Sym",
            expect.any(String),
            [3, 2],
        ]);
        button("Change O")!.click();
        expect(hint()).toContain("Designate a point");
        await tap([3, -2], count + 1);
        await tap([0, 3], count + 2);
        await tap([5, 2], count + 2);
        expect(button("Keep O")).toBeDefined();
    });

    // Kept are only the arguments designated after the tool of the menu:
    // the ring's builds a single object.
    it("keeps no argument designated before the tool", async () => {
        const { page, request } = await editor();
        await request("load", {
            data: new TextEncoder().encode(
                JSON.stringify({
                    dgo: 1,
                    v: { o: [400, 300], u: 40, w: 800, h: 600 },
                    o: [
                        ["Pt", "A", [-4, -1]],
                        ["Pt", "B", [3, -2]],
                        ["Pt", "O", [5, 2]],
                    ],
                }),
            ).buffer,
            format: "dgo",
        });
        const { v } = await saved(request);
        const figure = page.querySelector("body > svg:has([data-layer])")!;
        const box = figure.getBoundingClientRect();
        const Pointer = (page.defaultView as typeof window).PointerEvent;
        const tap = ([x, y]: number[], shiftKey = false) => {
            const at = {
                clientX: box.left + v.o[0] + x * v.u,
                clientY: box.top + v.o[1] - y * v.u,
                shiftKey,
                bubbles: true,
                isPrimary: true,
                pointerType: "mouse",
            };
            figure.dispatchEvent(new Pointer("pointerdown", at));
            figure.dispatchEvent(new Pointer("pointerup", at));
        };
        const buttons = () =>
            [...page.querySelectorAll(".dge-hint .dge-hint-text")].map(
                (button) => button.textContent,
            );
        tap([5, 2]);
        const reflection = page.querySelector(
            `.dge-ring button[aria-label="Point reflection"]`,
        )!;
        const ring = reflection.getBoundingClientRect();
        reflection.dispatchEvent(
            new Pointer("pointerdown", {
                clientX: ring.x + ring.width / 2,
                clientY: ring.y + ring.height / 2,
                pointerId: 1,
                bubbles: true,
                isPrimary: true,
                pointerType: "mouse",
            }),
        );
        expect(page.querySelector(".dge-hint")!.textContent).toContain(
            "Designate a point or an object",
        );
        expect(buttons()).toEqual([]);
        page.body.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        (
            page.querySelector(
                `.dge-bar [aria-controls="dge-palette"]`,
            ) as HTMLElement
        ).click();
        tap([5, 2], true);
        (
            page.querySelector(
                `.dge-palette-grid button[aria-label="Point reflection"]`,
            ) as HTMLElement
        ).click();
        expect(buttons()).toEqual([]);
        tap([-4, -1]);
        await expect.poll(async () => (await saved(request)).o.length).toBe(4);
        // Taken with a selection, the tool is left once it has built.
        expect(
            page
                .querySelector(
                    `.dge-palette-grid button[aria-label="Point reflection"]`,
                )!
                .getAttribute("aria-pressed"),
        ).toBe("false");
    });

    // So does a macro that maps points (see TRANSFORMATIONS.md).
    it("keeps the initials of a macro designated with Shift", async () => {
        const { page, request } = await editor();
        await request("load", {
            data: new TextEncoder().encode(
                JSON.stringify({
                    dgo: 1,
                    v: { o: [400, 300], u: 40, w: 800, h: 600 },
                    mac: [
                        {
                            n: "Half",
                            f: ["M"],
                            m: [
                                {
                                    i: [["point"], ["point"]],
                                    b: [["Mid", "M", [0, 1]]],
                                    f: [2],
                                },
                            ],
                        },
                    ],
                    o: [
                        ["Pt", "A", [-4, -1]],
                        ["Pt", "B", [3, -2]],
                        ["Pt", "C", [0, 3]],
                        ["Pt", "O", [5, 2]],
                        ["Poly", "p", [0, 1, 2]],
                    ],
                }),
            ).buffer,
            format: "dgo",
        });
        (
            page.querySelector(
                `.dge-bar [aria-controls="dge-palette"]`,
            ) as HTMLElement
        ).click();
        (
            page.querySelector(
                `.dge-palette-grid button[aria-label="Half"]`,
            ) as HTMLElement
        ).click();
        const { v } = await saved(request);
        const figure = page.querySelector("body > svg:has([data-layer])")!;
        const box = figure.getBoundingClientRect();
        const Pointer = (page.defaultView as typeof window).PointerEvent;
        const pointer = (kind: string, [x, y]: number[], shiftKey = false) =>
            figure.dispatchEvent(
                new Pointer(kind, {
                    clientX: box.left + v.o[0] + x * v.u,
                    clientY: box.top + v.o[1] - y * v.u,
                    bubbles: true,
                    isPrimary: true,
                    pointerType: "mouse",
                    shiftKey,
                }),
            );
        const tap = async (at: number[], count: number) => {
            pointer("pointerdown", at);
            pointer("pointerup", at);
            await expect
                .poll(async () => (await saved(request)).o.length)
                .toBe(count);
        };
        pointer("pointerdown", [5, 2], true);
        pointer("pointerup", [5, 2], true);
        pointer("pointermove", [-0.3, 0]);
        expect(figure.querySelectorAll(".dge-preview").length).toBe(1);
        await tap([-0.3, 0], 6);
        await tap([-4, -1], 8);
        const change = [
            ...page.querySelectorAll(".dge-hint .dge-hint-text"),
        ].find((button) => button.textContent === "Change O") as HTMLElement;
        change.click();
        await tap([3, -2], 8);
        await tap([0, 3], 10);
        await tap([-4, -1], 10);
        const { o } = await saved(request);
        expect(
            o
                .slice(5)
                .map(([tag, , parameters]: unknown[]) => [tag, parameters]),
        ).toEqual([
            ["Mac", [0, 0, [3, 4], "Poly"]],
            ["Mac", [0, 0, [3, 0]]],
            ["Out", [6, 1]],
            ["Mac", [0, 0, [1, 2]]],
            ["Out", [8, 1]],
        ]);
        // Applied from a selection, completed in the figure, it is left.
        page.body.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        const half = page.querySelector(
            `.dge-palette-grid button[aria-label="Half"]`,
        ) as HTMLElement;
        expect(half.getAttribute("aria-pressed")).toBe("false");
        await tap([-4, -1], 10);
        half.click();
        expect(half.getAttribute("aria-pressed")).toBe("true");
        await tap([0, 3], 12);
        expect(half.getAttribute("aria-pressed")).toBe("false");
    });
});

describe("The supplied library", () => {
    it("has a hue for each of its sections, in every language", async () => {
        for (const lang of [
            "ar",
            "de",
            "el",
            "en",
            "es",
            "fr",
            "hi",
            "it",
            "nl",
            "pt",
            "zh",
            "zh-TW",
        ]) {
            const data = await fetch(`/macros/${lang}.dgo`);
            const json = await new Response(
                data.body!.pipeThrough(new DecompressionStream("gzip")),
            ).json();
            const { folders } = readLibrary(json);
            expect(new Set(folders.map(([section]) => section)).size).toBe(
                SECTION_HUES.length,
            );
        }
    });
});

describe("A right click", () => {
    it("shows the properties of what it points at, the palette and the tool kept", async () => {
        const { page, request } = await editor();
        await request("load", {
            data: new TextEncoder().encode(JSON.stringify(TRIANGLE)).buffer,
            format: "dgo",
        });
        const { v } = await saved(request);
        const figure = page.querySelector("body > svg:has([data-layer])")!;
        const box = figure.getBoundingClientRect();
        const Pointer = (page.defaultView as typeof window).PointerEvent;
        const click = ([x, y]: number[], button = 0, moved = 0) => {
            const at = {
                clientX: box.left + v.o[0] + x * v.u,
                clientY: box.top + v.o[1] - y * v.u,
                button,
                buttons: button === 2 ? 2 : 1,
                bubbles: true,
                isPrimary: true,
                pointerType: "mouse",
            };
            figure.dispatchEvent(new Pointer("pointerdown", at));
            figure.dispatchEvent(
                new Pointer("pointerup", {
                    ...at,
                    clientX: at.clientX + moved,
                }),
            );
        };
        const body = page.body.classList;
        const shown = () =>
            (page.querySelector("#dge-properties input") as HTMLInputElement)
                ?.value;
        const figureTab = () =>
            page
                .querySelectorAll('#dge-properties [role="tab"]')[1]
                .getAttribute("aria-selected");
        const objects = async () => (await saved(request)).o.length;
        const escape = () =>
            page.body.dispatchEvent(
                new (page.defaultView as typeof window).KeyboardEvent(
                    "keydown",
                    { key: "Escape", bubbles: true },
                ),
            );
        (
            page.querySelector(
                '.dge-bar [aria-controls="dge-palette"]',
            ) as HTMLElement
        ).click();
        (
            page.querySelector(
                '.dge-palette-grid button[aria-label="Segment"]',
            ) as HTMLElement
        ).click();
        const count = await objects();
        const empty = [7, 6];
        // A segment begun at A.
        click([-4, -1]);
        // A drag still only moves.
        click([3, -2], 2, 40);
        expect(body.contains("dge-properties-open")).toBe(false);
        click([3, -2], 2);
        expect(body.contains("dge-properties-open")).toBe(true);
        expect(body.contains("dge-palette-open")).toBe(false);
        expect(shown()).toBe("B");
        expect(localStorage.getItem("docgeo-palette-open")).toBe("true");
        click(empty, 2);
        expect(figureTab()).toBe("true");
        click([0, 3], 2);
        expect(figureTab()).toBe("false");
        expect(shown()).toBe("C");
        // Escape gives the palette back, not the tool up.
        escape();
        expect(body.contains("dge-properties-open")).toBe(false);
        expect(body.contains("dge-palette-open")).toBe(true);
        expect(
            page
                .querySelector(
                    '.dge-palette-grid button[aria-label="Segment"]',
                )!
                .getAttribute("aria-pressed"),
        ).toBe("true");
        // The segment ends from A, the right clicks not being arguments.
        expect(await objects()).toBe(count);
        click([0, 3]);
        const { o } = await saved(request);
        expect(o.length).toBe(count + 1);
        const [A, C] = ["A", "C"].map((name) =>
            o.findIndex((entry: any[]) => entry[1] === name),
        );
        expect(o.at(-1)[0]).toBe("Seg");
        expect(o.at(-1)[2]).toEqual([A, C]);
    });

    it("shows the whole selection when it points at one of its objects", async () => {
        const { page, request } = await editor();
        await request("load", {
            data: new TextEncoder().encode(JSON.stringify(TRIANGLE)).buffer,
            format: "dgo",
        });
        const { v } = await saved(request);
        const figure = page.querySelector("body > svg:has([data-layer])")!;
        const box = figure.getBoundingClientRect();
        const Pointer = (page.defaultView as typeof window).PointerEvent;
        const click = ([x, y]: number[], button = 0, shiftKey = false) => {
            const at = {
                clientX: box.left + v.o[0] + x * v.u,
                clientY: box.top + v.o[1] - y * v.u,
                button,
                shiftKey,
                bubbles: true,
                isPrimary: true,
                pointerType: "mouse",
            };
            figure.dispatchEvent(new Pointer("pointerdown", at));
            figure.dispatchEvent(new Pointer("pointerup", at));
        };
        click([-4, -1], 0, true);
        click([3, -2], 0, true);
        click([3, -2], 2);
        // No name field: the settings common to several objects.
        expect(
            (page.querySelector("#dge-properties input") as HTMLInputElement)
                .type,
        ).toBe("checkbox");
        click([0, 3], 2);
        expect(
            (page.querySelector("#dge-properties input") as HTMLInputElement)
                .value,
        ).toBe("C");
    });
});

describe("The construction list's filters", () => {
    it("show the objects of some types, or those linked to the selection", async () => {
        const { page, request } = await editor();
        await request("load", {
            data: new TextEncoder().encode(JSON.stringify(TRIANGLE)).buffer,
            format: "dgo",
        });
        const filter = page.querySelector(
            '.dge-panel-header [aria-label="Filter the list"]',
        ) as HTMLElement;
        const item = (text: string) =>
            [
                ...page.querySelectorAll<HTMLElement>(
                    ".dge-filter-menu button",
                ),
            ].find(
                (element) => element.firstElementChild!.textContent === text,
            )!;
        const shown = () =>
            [
                ...page.querySelectorAll<HTMLInputElement>(
                    ".dge-item:not(.dge-filtered) .dge-row",
                ),
            ].map((row) => row.value.split(" ")[0]);
        const count = () => page.querySelector(".dge-count")!.textContent;
        const chips = () =>
            [...page.querySelectorAll(".dge-filters button")].map(
                (chip) => chip.firstElementChild!.textContent,
            );
        filter.click();
        // Only the types the figure has, with their numbers.
        expect(item("Points").lastElementChild!.textContent).toBe("3");
        expect(item("Polygons")).toBe(undefined);
        expect(item("Linked to the selection").hasAttribute("disabled")).toBe(
            true,
        );
        item("Points").click();
        expect(shown()).toEqual(["A", "B", "C"]);
        expect(count()).toBe("3 / 5");
        expect(chips()).toEqual(["Points"]);
        expect(filter.classList.contains("dge-on")).toBe(true);
        item("Lines, segments, vectors").click();
        expect(shown()).toEqual(["A", "B", "C", "s"]);
        // A chip takes its filter away; Escape closes the menu.
        (page.querySelector(".dge-filters button") as HTMLElement).click();
        expect(shown()).toEqual(["s"]);
        page.body.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        expect(page.querySelector(".dge-filter-menu")!.checkVisibility()).toBe(
            false,
        );
        (page.querySelector(".dge-filters button") as HTMLElement).click();
        expect(count()).toBe("5");
        expect(filter.classList.contains("dge-on")).toBe(false);
        // B selected: B and the segment built from it.
        const { v } = await saved(request);
        const figure = page.querySelector("body > svg:has([data-layer])")!;
        const box = figure.getBoundingClientRect();
        const Pointer = (page.defaultView as typeof window).PointerEvent;
        const at = {
            clientX: box.left + v.o[0] + 3 * v.u,
            clientY: box.top + v.o[1] + 2 * v.u,
            shiftKey: true,
            bubbles: true,
            isPrimary: true,
            pointerType: "mouse",
        };
        figure.dispatchEvent(new Pointer("pointerdown", at));
        figure.dispatchEvent(new Pointer("pointerup", at));
        filter.click();
        item("Linked to the selection").click();
        expect(shown()).toEqual(["B", "s"]);
        expect(chips()).toEqual(["Linked to B"]);
        // Another figure, no filter.
        await request("load", {
            data: new TextEncoder().encode(JSON.stringify(TRIANGLE)).buffer,
            format: "dgo",
        });
        expect(chips()).toEqual([]);
        expect(count()).toBe("5");
    });
});
