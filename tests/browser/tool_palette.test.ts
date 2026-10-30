import { afterEach, describe, expect, it } from "vitest";
import { $ } from "../../src/dom";

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
        // The ring's families and the menu's tools, not the programs, nor
        // the planes and solids in the plane, nor macros the figure lacks.
        const zones = [...page.querySelectorAll(".dge-palette-title")].map(
            (title) => title.textContent,
        );
        expect(zones[0]).toBe("Points");
        expect(zones).not.toContain("Programs");
        expect(zones).not.toContain("Planes");
        expect(zones).not.toContain("Macros");
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
        // Chosen, it builds from them, and stays in hand till chosen again.
        tool("Circumcircle").click();
        await expect.poll(async () => (await saved(request)).o.length).toBe(6);
        expect(tool("Circumcircle").getAttribute("aria-pressed")).toBe("true");
        tool("Circumcircle").click();
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
        // Escape drops the tool, then closes the palette.
        const escape = () =>
            page.body.dispatchEvent(
                new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
            );
        escape();
        expect(tool("Midpoint").getAttribute("aria-pressed")).toBe("false");
        expect(body.contains("dge-palette-open")).toBe(true);
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
        tap([3, -2]);
        expect(buttons()).toEqual(["Keep B"]);
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
    });
});
