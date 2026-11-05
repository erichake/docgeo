import { afterEach, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";
import { $ } from "../../src/dom";

type Message = Record<string, any>;
const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach((dispose) => dispose()));

const FIGURE = {
    dgo: 1,
    v: { o: [400, 300], u: 40, w: 800, h: 600 },
    o: [
        ["Pt", "A", [-4, -1]],
        ["Pt", "B", [3, -2]],
        ["Seg", "s", [0, 1]],
    ],
};

async function editor(figure: object = FIGURE) {
    localStorage.setItem("docgeo-palette-open", "true");
    cleanup.push(() => localStorage.removeItem("docgeo-palette-open"));
    const iframe = $.create("iframe")
        .att("src", "/editor.html?embed&lang=en")
        .stl(
            "width:1100px;height:700px;border:0;transform:scale(.3);transform-origin:0 0",
        )
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
    const load = (dgo: object) =>
        request("load", {
            data: new TextEncoder().encode(JSON.stringify(dgo)).buffer,
            format: "dgo",
        });
    await load(figure);
    const page = iframe.contentDocument!;
    const view = page.defaultView as typeof window;
    const svg = page.querySelector("body > svg:has([data-layer])")!;
    const event = (
        type: string,
        [x, y]: number[],
        button: number,
        target: Element = svg,
    ) => {
        // The panels shift it.
        const box = svg.getBoundingClientRect();
        return target.dispatchEvent(
            new view.PointerEvent(type, {
                clientX: box.left + x,
                clientY: box.top + y,
                button,
                buttons: type === "pointerup" ? 0 : button === 2 ? 2 : 1,
                bubbles: true,
                isPrimary: true,
                pointerId: 1,
                pointerType: "mouse",
            }),
        );
    };
    const tap = (at: number[]) => {
        event("pointerdown", at, 0);
        event("pointerup", at, 0);
    };
    const tool = (label: string) =>
        page.querySelector(
            `.dge-palette-grid button[aria-label="${label}"]`,
        ) as HTMLElement;
    const figureNow = async () => {
        const { data } = (await request("save")).result;
        const stream = new Blob([data])
            .stream()
            .pipeThrough(new DecompressionStream("gzip"));
        return JSON.parse(await new Response(stream).text());
    };
    const entry = async (name: string) => {
        const figure = await figureNow();
        const found = figure.o.find((item: unknown[]) => item[1] === name);
        return {
            parameters: found?.[2],
            style: found?.[3] === undefined ? {} : figure.st[found[3]],
            index: figure.o.indexOf(found),
            count: figure.o.length,
        };
    };
    const closePanel = () =>
        (
            page.querySelector(
                '.dge-bar [aria-controls="dge-palette"]',
            ) as HTMLElement
        ).click();
    return { page, svg, event, tap, tool, entry, figureNow, load, closePanel };
}

// The figure's own, not that of a mark, which copies it.
const own = <T extends Element>(page: Document, tag: string): T =>
    [...page.querySelectorAll<T>(`svg foreignObject ${tag}`)].find(
        (element) => !element.closest(".dge-mark"),
    )!;

const press = (page: Document, key: string) =>
    page.body.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true }),
    );

const pick = (at: number[]) => [400 + at[0] * 40, 300 - at[1] * 40];

describe("The controls of the palette", () => {
    it("come after the solids, and put each control where it is clicked", async () => {
        const { page, tap, tool, entry } = await editor();
        const zones = [...page.querySelectorAll(".dge-palette-title")].map(
            (title) => title.textContent,
        );
        expect(zones.slice(-3)).toEqual([
            "Controls",
            "Programs",
            "Macros of the figure",
        ]);

        tool("Slider").click();
        expect(page.querySelector(".dge-hint")!.textContent).toContain(
            "Designate where it goes",
        );
        tap([100, 50]);
        await expect.poll(async () => (await entry("a")).count).toBe(4);
        const slider = await entry("a");
        expect(slider.parameters).toMatchObject({ mn: -5, mx: 5, v: 1 });
        expect(slider.parameters.xy).toEqual([100, 50]);
        expect(page.body.classList).toContain("dge-properties-open");
    });

    it("put an input field, whose own number the typed one becomes", async () => {
        const { page, tap, tool, entry } = await editor();
        tool("InputField").click();
        tap([120, 60]);
        await expect.poll(async () => (await entry("a")).count).toBe(4);
        const { style, parameters } = await entry("a");
        expect(style.iB).toBe(8);
        expect(parameters.v).toBe(1);
        const input = own<HTMLInputElement>(page, "input");
        await expect.poll(() => input.value).toBe("1");
        input.value = "2,5";
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await expect
            .poll(async () => (await entry("a")).parameters.v)
            .toBe(2.5);
    });

    it("put a menu, its number the choice, read back from its file", async () => {
        const { page, tap, tool, entry, figureNow, load } = await editor();
        tool("Menu").click();
        tap([120, 60]);
        await expect.poll(async () => (await entry("a")).count).toBe(4);
        const select = () => own<HTMLSelectElement>(page, "select");
        expect([...select().options].map((option) => option.text)).toEqual([
            "Choice 1",
            "Choice 2",
            "Choice 3",
        ]);
        await expect.poll(() => select().selectedIndex).toBe(0);
        select().selectedIndex = 2;
        select().dispatchEvent(new Event("change", { bubbles: true }));
        await expect.poll(async () => (await entry("a")).parameters.v).toBe(3);
        const saved = await figureNow();
        await load(saved);
        await expect.poll(() => select().selectedIndex).toBe(2);
        expect((await entry("a")).parameters.mu).toHaveLength(3);
    });

    it("write their command in their line, which redefines them", async () => {
        const { page, tap, tool, entry } = await editor();
        tool("Menu").click();
        tap([120, 60]);
        await expect.poll(async () => (await entry("a")).count).toBe(4);
        const select = () => own<HTMLSelectElement>(page, "select");
        select().selectedIndex = 2;
        select().dispatchEvent(new Event("change", { bubbles: true }));
        await expect.poll(async () => (await entry("a")).parameters.v).toBe(3);
        const line = () =>
            page.querySelector(
                ".dge-properties textarea",
            ) as HTMLTextAreaElement;
        await expect.poll(() => line()?.value).toContain("Menu(");
        expect(line().value).toContain('"Choice 1", "Choice 2", "Choice 3"');
        // Fewer choices: the number it had, within them, and its place.
        const { xy } = (await entry("a")).parameters;
        line().value = 'Menu("One", "Two")';
        line().dispatchEvent(new Event("input", { bubbles: true }));
        (
            page.querySelector(
                ".dge-properties .dge-program-actions .dge-primary",
            ) as HTMLElement
        ).click();
        await expect
            .poll(async () => (await entry("a")).parameters.mu)
            .toEqual(["One", "Two"]);
        expect((await entry("a")).parameters).toMatchObject({ v: 2, xy });
    });

    it("show what a checkbox designated, kept when it is deleted", async () => {
        const { page, tap, tool, entry, svg } = await editor();
        tool("Checkbox").click();
        expect(page.querySelector(".dge-hint")!.textContent).toContain(
            "Designate what it shows",
        );
        // The segment, lit, then the place of the checkbox.
        tap(pick([-0.5, -1.5]));
        const segment = () =>
            [...svg.querySelectorAll("[data-layer] > g")].find((g) =>
                g.classList.contains("dge-picked"),
            );
        expect(segment()).toBeTruthy();
        tap([120, 60]);
        await expect.poll(async () => (await entry("a")).count).toBe(4);
        const { style, parameters, index } = await entry("a");
        expect(style.cB).toBe(1);
        expect(parameters).toMatchObject({ t: "Show", v: 1 });
        expect((await entry("s")).style.sc).toBe(index);
        expect(segment()).toBeUndefined();
        // Deleted, what it showed stays, always shown.
        press(page, "Delete");
        await expect.poll(async () => (await entry("a")).count).toBe(3);
        expect((await entry("s")).style.sc).toBeUndefined();
    });

    it("are read by the condition of the properties", async () => {
        const figure = {
            ...FIGURE,
            st: [{ cB: 1 }],
            o: [
                ...FIGURE.o,
                ["Ex", "b", { t: "Show", v: 1, xy: [20, 20] }, 0],
                ["Ex", "n", { t: "", v: 2, xy: [20, 80] }],
            ],
        };
        const { page, tap, closePanel, entry, svg } = await editor(figure);
        closePanel();
        (
            page.querySelector(
                '.dge-bar [aria-controls="dge-properties"]',
            ) as HTMLElement
        ).click();
        tap(pick([-0.5, -1.5]));
        const field = () =>
            page.querySelector(
                '.dge-properties input[aria-label="Visible if"]',
            ) as HTMLInputElement;
        await expect.poll(() => !!field()).toBe(true);
        expect(field().value).toBe("");
        const type = (text: string) => {
            field().value = text;
            field().dispatchEvent(new Event("change", { bubbles: true }));
        };
        const shown = () =>
            [...svg.querySelectorAll("[data-layer] line, [data-layer] path")]
                .length;
        // An expression's name.
        type("b");
        await expect.poll(async () => (await entry("s")).style.sc).toBe(3);
        // A formula, in a hidden expression that goes when it is replaced.
        type("n == 3");
        await expect.poll(async () => (await entry("s")).style.sc).toBe(5);
        const { count } = await entry("s");
        type("n > 1");
        await expect.poll(async () => (await entry("s")).count).toBe(count);
        expect(field().classList).not.toContain("dge-error");
        // What it is built from can't hide it.
        type("s > 1");
        await expect
            .poll(() => field().classList.contains("dge-error"))
            .toBe(true);
        expect(shown()).toBeGreaterThan(0);
        // None.
        type("");
        await expect
            .poll(async () => (await entry("s")).style.sc)
            .toBeUndefined();
        await expect.poll(async () => (await entry("s")).count).toBe(5);
    });

    it("are moved by the right button, without being worked", async () => {
        const { event, tap, tool, entry, svg } = await editor();
        tool("Checkbox").click();
        tap([200, 100]);
        await expect.poll(async () => (await entry("a")).count).toBe(4);
        const box = svg.querySelector("rect[style*='cursor']")!;
        // A synthetic pointer can't be captured.
        svg.setPointerCapture = () => {};
        event("pointerdown", [215, 115], 2, box);
        event("pointermove", [315, 165], 2, svg);
        event("pointerup", [315, 165], 2, svg);
        await expect
            .poll(async () => (await entry("a")).parameters.xy)
            .toEqual([300, 150]);
        expect((await entry("a")).parameters.v).toBe(1);
    });

    it("are moved by the finger, their properties shown", async () => {
        const { page, tap, tool, entry } = await editor();
        tool("InputField").click();
        tap([120, 60]);
        await expect.poll(async () => (await entry("a")).count).toBe(4);
        expect(page.body.classList).toContain("dge-properties-open");
        await new Promise((resolve) => setTimeout(resolve, 400));
        const { left, top } = page
            .querySelector("body > svg:has([data-layer])")!
            .getBoundingClientRect();
        await commands.drag(
            "iframe",
            [left + 140, top + 75],
            [left + 240, top + 175],
            true,
        );
        await expect
            .poll(async () => (await entry("a")).parameters.xy)
            .toEqual([220, 160]);
    });

    it("name in a checkbox's line what it shows, which the line changes", async () => {
        const figure = {
            ...FIGURE,
            st: [{ cB: 1 }, { sc: 3 }, { sc: 4 }],
            o: [
                ["Pt", "A", [-4, -1]],
                ["Pt", "B", [3, -2]],
                ["Seg", "s", [0, 1], 1],
                ["Ex", "b", { t: "Show", v: 0, xy: [20, 20] }, 0],
                ["Ex", "f", { t: "", s: ["b > 0", { b: 3 }], xy: [20, 80] }],
                ["Cir", "c", [0, 1], 2],
            ],
        };
        const { page, entry } = await editor(figure);
        const line = () =>
            [...page.querySelectorAll<HTMLInputElement>(".dge-row")].find(
                (row) => row.value.startsWith("b ="),
            )!.value;
        await expect.poll(line).toBe('b = Checkbox("Show", s)');
        const enter = (text: string) => {
            const field = page.querySelector(
                ".dge-rows > .dge-item:last-child .dge-row, .dge-new-line, .dge-line input",
            ) as HTMLInputElement;
            field.focus();
            field.value = text;
            field.dispatchEvent(new Event("input", { bubbles: true }));
            field.dispatchEvent(
                new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
            );
        };
        // A condition that only reads it isn't said, and is replaced.
        enter('b = Checkbox("Show", s, c)');
        await expect.poll(line).toBe('b = Checkbox("Show", s, c)');
        const { index } = await entry("b");
        expect((await entry("c")).style.sc).toBe(index);
        expect((await entry("s")).style.sc).toBe(index);
        // Taken out, always shown; its state kept.
        enter('b = Checkbox("Hide", c)');
        await expect.poll(line).toBe('b = Checkbox("Hide", c)');
        expect((await entry("s")).style.sc).toBeUndefined();
        expect((await entry("b")).parameters.v).toBe(0);
        // Not itself.
        enter('b = Checkbox("Hide", b)');
        await expect
            .poll(() => page.querySelector(".dge-hint")!.textContent)
            .toContain("can't depend");
        expect(line()).toBe('b = Checkbox("Hide", c)');
    });

    it("give back the palette when their properties close, in 18 points", async () => {
        const { page, tap, tool, entry } = await editor();
        tool("Checkbox").click();
        tap([120, 60]);
        await expect.poll(async () => (await entry("a")).count).toBe(4);
        expect((await entry("a")).style.f).toBe(18);
        expect(page.body.classList).toContain("dge-properties-open");
        expect(page.body.classList).not.toContain("dge-palette-open");
        (
            page.querySelector(
                '.dge-bar [aria-controls="dge-properties"]',
            ) as HTMLElement
        ).click();
        expect(page.body.classList).not.toContain("dge-properties-open");
        expect(page.body.classList).toContain("dge-palette-open");
    });

    it("anchor an image on two points, the first one designated", async () => {
        const { page, tap, event, svg, tool, entry, figureNow } =
            await editor();
        const view = page.defaultView as typeof window;
        // The input isn't in the page: it's created and clicked there.
        const clicked: HTMLInputElement[] = [];
        const click = view.HTMLInputElement.prototype.click;
        view.HTMLInputElement.prototype.click = function () {
            clicked.push(this);
        };
        cleanup.push(() => {
            view.HTMLInputElement.prototype.click = click;
        });
        const choose = () => {
            const canvas = page.createElement("canvas");
            canvas.width = 200;
            canvas.height = 100;
            const bytes = Uint8Array.from(
                atob(canvas.toDataURL("image/png").split(",")[1]),
                (c) => c.charCodeAt(0),
            );
            const files = new view.DataTransfer();
            files.items.add(
                new view.File([bytes], "x.png", { type: "image/png" }),
            );
            const field = clicked.at(-1)!;
            field.files = files.files;
            field.dispatchEvent(new view.Event("change"));
        };
        // In the void: two free points.
        tool("Image").click();
        tap([100, 200]);
        choose();
        await expect.poll(async () => (await figureNow()).o.length).toBe(6);
        let figure = await figureNow();
        const [a, b, image] = figure.o.slice(-3);
        expect([a[0], b[0], image[0]]).toEqual(["Pt", "Pt", "Img"]);
        expect(image[2].slice(1)).toEqual([200, 100, 3, 4]);
        const dx = (b[2][0] - a[2][0]) * figure.v.u;
        expect(dx).toBeCloseTo(200);
        // On the point A: only its second anchor is made.
        (
            page.querySelector(
                '.dge-bar [aria-controls="dge-palette"]',
            ) as HTMLElement
        ).click();
        tool("Image").click();
        const { o, u } = figure.v;
        const [ax, ay] = FIGURE.o[0][2] as number[];
        tap([o[0] + ax * u, o[1] - ay * u]);
        choose();
        await expect.poll(async () => (await figureNow()).o.length).toBe(8);
        figure = await figureNow();
        expect(figure.o.at(-1)[2].slice(3)).toEqual([0, 6]);
        // Dragged, its free anchors follow.
        svg.setPointerCapture = () => {};
        const before = (await entry(a[1])).parameters;
        event("pointerdown", [200, 150], 0);
        event("pointermove", [240, 150], 0);
        event("pointerup", [240, 150], 0);
        await expect
            .poll(async () => (await entry(a[1])).parameters[0])
            .toBeCloseTo(before[0] + 40 / u);
    });

    it("frame an image with its line, none by default", async () => {
        const figure = {
            ...FIGURE,
            img: {
                k: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M/wn4EIwDiqkL4KAcT9GO0U4BxoAAAAAElFTkSuQmCC",
            },
            o: [...FIGURE.o, ["Img", "i", ["k", 100, 100, [40, 40]]]],
        };
        const { page, tap, closePanel, entry } = await editor(figure);
        closePanel();
        (
            page.querySelector(
                '.dge-bar [aria-controls="dge-properties"]',
            ) as HTMLElement
        ).click();
        const frame = () =>
            [...page.querySelectorAll("body > svg [data-layer] rect")].find(
                (rect) =>
                    !rect.closest(".dge-mark") &&
                    rect.parentElement!.querySelector("image"),
            ) as SVGRectElement | undefined;
        expect(frame()).toBeUndefined();
        tap([90, 90]);
        const field = (label: string) =>
            page.querySelector(
                `.dge-property-section [aria-label="${label}"]`,
            ) as HTMLInputElement;
        await expect.poll(() => !!field("Thickness")).toBe(true);
        const titles = [
            ...page.querySelectorAll(".dge-property-section > h3"),
        ].map((title) => title.textContent);
        expect(titles).toContain("Frame");
        const section = (label: string) =>
            field(label).closest(".dge-property-section")!.querySelector("h3")!
                .textContent;
        for (const label of ["Color", "Thickness", "Stroke opacity", "Dashed"])
            expect(section(label), label).toBe("Frame");
        expect(section("Opacity")).toBe("Appearance");
        expect(section("Layer")).toBe("Appearance");
        expect(field("Fill color")).toBe(null);
        expect(field("Thickness").value).toBe("0");
        const set = (label: string, value: string) => {
            field(label).value = value;
            field(label).dispatchEvent(new Event("input", { bubbles: true }));
            field(label).dispatchEvent(new Event("change", { bubbles: true }));
        };
        set("Thickness", "3");
        await expect.poll(async () => (await entry("i")).style.s).toBe(3);
        expect(frame()!.style.strokeWidth).toBe("3");
        expect(frame()!.getAttribute("width")).toBe("100");
        // Its own opacity doesn't bring a fill.
        set("Opacity", "40");
        await expect.poll(async () => (await entry("i")).style.o).toBe(0.4);
        await expect.poll(() => field("Fill color")).toBe(null);
        // Gone at 0.
        set("Thickness", "0");
        await expect.poll(() => frame()).toBeUndefined();
    });

    it.each([
        ["Button", () => [120, 60]],
        ["Turtle", () => pick([-4, -1])],
    ])(
        "give back the palette too after the %s tool's program",
        async (label, at) => {
            const { page, tap, tool } = await editor();
            tool(label).click();
            tap(at());
            await expect
                .poll(() => page.body.classList.contains("dge-properties-open"))
                .toBe(true);
            expect(page.body.classList).not.toContain("dge-palette-open");
            (
                page.querySelector(
                    '.dge-bar [aria-controls="dge-properties"]',
                ) as HTMLElement
            ).click();
            expect(page.body.classList).toContain("dge-palette-open");
        },
    );

    it("don't overlap when typed one after the other", async () => {
        const { page, figureNow } = await editor();
        const field = page.querySelector(
            ".dge-line .dge-input",
        ) as HTMLInputElement;
        const lines = [
            'k = Checkbox("Show")',
            'm = Menu("One", "Two")',
            "n = InputField(3)",
            "r = Slider(0, 10, 4)",
        ];
        for (const line of lines) {
            field.focus();
            field.value = line;
            field.dispatchEvent(new Event("input", { bubbles: true }));
            field.dispatchEvent(
                new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
            );
            await expect.poll(() => field.value).toBe("");
        }
        const place = async (name: string) =>
            (await figureNow()).o.find((item: unknown[]) => item[1] === name)[2]
                .xy[1] as number;
        // A value's text rises 18 pixels above its place.
        expect(await place("m")).toBeGreaterThanOrEqual(
            (await place("k")) + 31,
        );
        expect(await place("n")).toBeGreaterThanOrEqual(
            (await place("m")) + 34,
        );
        expect(await place("r")).toBeGreaterThanOrEqual(
            (await place("n")) + 34 + 18,
        );
    });

    it("anchor an image on three points in space, in a horizontal plane", async () => {
        const { page, tap, tool, figureNow } = await editor({
            dgo: 1,
            v: { o: [400, 300], u: 40, w: 800, h: 600, "3d": 1 },
            o: [["Pt", "A", [1, 2, 3]]],
        });
        const view = page.defaultView as typeof window;
        const clicked: HTMLInputElement[] = [];
        const click = view.HTMLInputElement.prototype.click;
        view.HTMLInputElement.prototype.click = function () {
            clicked.push(this);
        };
        cleanup.push(() => {
            view.HTMLInputElement.prototype.click = click;
        });
        const canvas = page.createElement("canvas");
        canvas.width = 200;
        canvas.height = 100;
        const bytes = Uint8Array.from(
            atob(canvas.toDataURL("image/png").split(",")[1]),
            (c) => c.charCodeAt(0),
        );
        const place = async (at: number[], count: number) => {
            const files = new view.DataTransfer();
            files.items.add(
                new view.File([bytes], "x.png", { type: "image/png" }),
            );
            tool("Image").click();
            tap(at);
            clicked.at(-1)!.files = files.files;
            clicked.at(-1)!.dispatchEvent(new view.Event("change"));
            await expect
                .poll(async () => (await figureNow()).o.length)
                .toBe(count);
            return figureNow();
        };
        // A, the only object yet.
        const shape = [
            ...page.querySelectorAll("body > svg [data-layer] circle"),
        ].find((circle) => !circle.closest(".dge-mark"))!;
        const box = shape.getBoundingClientRect();
        const frame = page
            .querySelector("body > svg:has([data-layer])")!
            .getBoundingClientRect();
        const [sx, sy] = [
            box.left + box.width / 2 - frame.left,
            box.top + box.height / 2 - frame.top,
        ];
        // On a point: from it, at its height.
        let figure = await place([sx, sy], 4);
        const { u } = figure.v;
        const [second, third, on] = figure.o.slice(-3);
        expect(on[2].slice(3)).toEqual([0, 1, 2]);
        expect(second[2]).toEqual([1 + 200 / u, 2, 3]);
        expect(third[2]).toEqual([1, 2 + 100 / u, 3]);
        // In the void: three new points on the ground.
        (
            page.querySelector(
                '.dge-bar [aria-controls="dge-palette"]',
            ) as HTMLElement
        ).click();
        figure = await place([150, 450], 8);
        const [a, b, c, image] = figure.o.slice(-4);
        expect(image[2].slice(1)).toEqual([200, 100, 4, 5, 6]);
        expect(a[2][2] ?? 0).toBeCloseTo(0);
        expect(b[2][0] - a[2][0]).toBeCloseTo(200 / u);
        expect(b[2][1]).toBeCloseTo(a[2][1]);
        expect(c[2][0]).toBeCloseTo(a[2][0]);
        expect(c[2][1] - a[2][1]).toBeCloseTo(100 / u);
        expect(c[2][2] ?? 0).toBeCloseTo(a[2][2] ?? 0);
    });
});
