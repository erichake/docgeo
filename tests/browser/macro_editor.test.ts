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

const CIRCUMCENTER = {
    dgo: 1,
    v: { o: [400, 300], u: 40, w: 800, h: 600 },
    o: [
        ["Pt", "A", [-4, -2]],
        ["Pt", "B", [3, -2]],
        ["Pt", "C", [-1, 3]],
        ["Med", "m1", [0, 1]],
        ["Med", "m2", [1, 2]],
        ["Int", "O", [3, 4, 0]],
        ["Cir", "c", [5, 0]],
    ],
};

describe("Defining a macro in the editor", () => {
    it("takes initials and finals by taps, and saves the macro with the figure", async () => {
        const { page, request } = await editor();
        await request("load", {
            data: new TextEncoder().encode(JSON.stringify(CIRCUMCENTER)).buffer,
            format: "dgo",
        });
        const click = (selector: string, text: string) =>
            [...page.querySelectorAll<HTMLElement>(selector)]
                .find((element) => element.textContent === text)!
                .click();
        (page.querySelector(".dge-line button") as HTMLElement).click();
        click(".dge-tools .dge-family", "Macros");
        click(".dge-tools button", "New macro");
        const panel = page.querySelector(".dge-macro") as HTMLElement;
        const open = () => page.body.classList.contains("dge-macro-open");
        expect(open()).toBe(true);
        // A row designates its object.
        const tap = (name: string) =>
            [...page.querySelectorAll<HTMLInputElement>(".dge-row")]
                .find((row) => row.value.startsWith(`${name} =`))!
                .parentElement!.dispatchEvent(
                    new PointerEvent("pointerdown", { bubbles: true }),
                );
        const button = (text: string) =>
            [...panel.querySelectorAll<HTMLButtonElement>("button")].find(
                (element) => element.textContent === text,
            )!;
        const step = () => panel.querySelector(".dge-macro-step")!.textContent;
        expect(step()).toBe("Step 1/2: tap the initials, in order");
        expect(button("Next: the finals").disabled).toBe(true);
        // At the first step, each tap an initial, even O, which A, B and C
        // then determine: a second tap takes it away.
        ["A", "B", "C", "O", "O"].forEach(tap);
        // Each initial's rank beside it in the figure.
        expect(
            [...page.querySelectorAll(".dge-badges span")].map(
                (badge) => badge.textContent,
            ),
        ).toEqual(["1", "2", "3"]);
        button("Next: the finals").click();
        expect(step()).toBe("Step 2/2: tap the finals among the gray objects");
        // A, an initial, is no final: the hint tells why.
        tap("A");
        expect(page.querySelector(".dge-hint")!.textContent).toBe(
            "A is part of the initials: it can't be a final",
        );
        ["O", "c"].forEach(tap);
        const names = (list: number) =>
            [...panel.querySelectorAll(".dge-macro-list")[list].children].map(
                (row) => row.querySelector(".dge-macro-object")?.textContent,
            );
        expect(names(0)).toEqual(["A", "B", "C"]);
        expect(names(1)).toEqual(["O", "c"]);
        // An image chosen for its icon, then the one drawn from the figure.
        const icon = () =>
            panel.querySelector(".dge-tool-icon image")?.getAttribute("href");
        expect(icon()).toMatch(/^data:image\/svg\+xml;base64,/);
        const files = new DataTransfer();
        files.items.add(
            new File([new Uint8Array([137, 80, 78, 71])], "icon.png", {
                type: "image/png",
            }),
        );
        const chooser = panel.querySelector(
            'input[type="file"]',
        ) as HTMLInputElement;
        chooser.files = files.files;
        chooser.dispatchEvent(new Event("change"));
        await expect.poll(icon).toBe("data:image/png;base64,iVBORw==");
        // Letters typed instead, encoded in UTF-8.
        const letters = panel.querySelector(
            ".dge-macro-letters",
        ) as HTMLInputElement;
        letters.value = "⊥C";
        letters.dispatchEvent(new Event("input"));
        const svg = new TextDecoder().decode(
            Uint8Array.from(atob(icon()!.split(",")[1]), (char) =>
                char.charCodeAt(0),
            ),
        );
        expect(svg).toMatch(/<text [^>]*fill="#536174"[^>]*>⊥C<\/text>/);
        button("Automatic icon").click();
        expect(letters.value).toBe("");
        expect(icon()).toMatch(/^data:image\/svg\+xml;base64,/);
        expect(atob(icon()!.split(",")[1])).not.toContain("<text");
        const name = panel.querySelector(
            ".dge-macro-field input",
        ) as HTMLInputElement;
        name.value = "Circumscribed";
        name.dispatchEvent(new Event("input"));
        button("Create the macro").click();
        // Saved, the mode is left.
        expect(open()).toBe(false);
        expect(page.querySelector("svg.dge-defining")).toBeNull();
        const { mac, img } = await saved(request);
        // Its icon drawn from the figure.
        expect(img[mac[0].ic]).toMatch(/^data:image\/svg\+xml;base64,/);
        expect(mac).toEqual([
            {
                n: "Circumscribed",
                f: ["O", "c"],
                ic: mac[0].ic,
                m: [
                    {
                        i: [["point"], ["point"], ["point"]],
                        n: ["A", "B", "C"],
                        b: [
                            ["Med", "m1", [0, 1]],
                            ["Med", "m2", [1, 2]],
                            ["Int", "O", [3, 4, 0]],
                            ["Cir", "c", [5, 0]],
                        ],
                        f: [5, 6],
                    },
                ],
            },
        ]);

        // Without C, the finals miss it.
        (page.querySelector(".dge-line button") as HTMLElement).click();
        click(".dge-tools .dge-family", "Macros");
        click(".dge-tools button", "New macro");
        ["A", "B", "C"].forEach(tap);
        button("Next: the finals").click();
        ["O", "c"].forEach(tap);
        button("Back to the initials").click();
        tap("C");
        expect(names(0)).toEqual(["A", "B"]);
        button("Next: the finals").click();
        const save = button("Create the macro");
        expect(panel.querySelector(".dge-macro-status")!.textContent).toContain(
            "C",
        );
        expect(save.disabled).toBe(true);
        expect(
            page.querySelector(
                ".dge-item.dge-missing .dge-row",
            ) as HTMLInputElement | null,
        ).toHaveProperty("value", "C = (-1, 3)");
        page.body.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        expect(open()).toBe(false);
        expect(page.querySelector("svg.dge-defining")).toBeNull();

        // Applied from the menu, as a tool.
        const input = page.querySelector(
            ".dge-entry .dge-input",
        ) as HTMLInputElement;
        for (const line of ["D = (-2, 0)", "E = (2, 0)", "F = (0, 4)"]) {
            input.value = line;
            input.dispatchEvent(
                new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
            );
            await expect.poll(() => input.value).toBe("");
        }
        input.blur();
        (page.querySelector(".dge-line button") as HTMLElement).click();
        click(".dge-tools .dge-family", "Macros");
        click(".dge-tools button", "Circumscribed");
        const hint = () => page.querySelector(".dge-hint")!.textContent;
        expect(hint()).toContain("1/3 – Designate a point");
        tap("D");
        tap("E");
        expect(hint()).toContain("3/3");
        tap("F");
        await expect.poll(async () => (await saved(request)).o.length).toBe(13);
        const { o } = await saved(request);
        expect(o.slice(10)).toEqual([
            ["Mac", "mac", [0, 0, [7, 8, 9]]],
            ["Out", "O1", [10, 1]],
            ["Out", "c1", [10, 2]],
        ]);
        // Still the tool, waiting for its first initial.
        expect(hint()).toContain("1/3");
        page.body.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        expect(hint()).toBe("");

        // In the text, one line for the application, which unfolds into
        // its finals'.
        const lines = () =>
            [...page.querySelectorAll<HTMLInputElement>(".dge-row")].map(
                (row) => row.value,
            );
        expect(lines().slice(-2)).toEqual([
            "F = (0, 4)",
            "O1, c1 = Circumscribed(D, E, F)",
        ]);
        const fold = () =>
            (page.querySelector(".dge-fold") as HTMLElement).click();
        fold();
        expect(lines().slice(-3)).toEqual([
            "O1, c1 = Circumscribed(D, E, F)",
            "O1",
            "c1",
        ]);
        fold();
        expect(lines().at(-1)).toBe("O1, c1 = Circumscribed(D, E, F)");
        const enter = (field: HTMLInputElement, text: string) => {
            field.value = text;
            field.dispatchEvent(new Event("input", { bubbles: true }));
            field.dispatchEvent(
                new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
            );
        };
        enter(input, "Q, k = Circumscribed(A, B, F)");
        await expect.poll(() => lines().length).toBe(12);
        expect(lines().at(-1)).toBe("Q, k = Circumscribed(A, B, F)");
        // Redefined from its row, one final left out.
        const row = [
            ...page.querySelectorAll<HTMLInputElement>(".dge-row"),
        ].find((field) => field.value.startsWith("Q, k"))!;
        enter(row, "Q, _ = Circumscribed(A, B, D)");
        await expect
            .poll(() => lines().at(-1))
            .toBe("Q, _ = Circumscribed(A, B, D)");
        expect(lines().length).toBe(12);
        const entries = (await saved(request)).o;
        expect(entries.slice(-2)).toEqual([
            ["Mac", "mac1", [0, 0, [0, 1, 7]]],
            ["Out", "Q", [13, 1]],
        ]);
        // As many names as finals.
        enter(input, "X = Circumscribed(A, B, C)");
        await expect
            .poll(() => page.querySelector(".dge-hint")!.textContent)
            .toContain("This macro has 2 finals");
        enter(input, "e1, e2 = Circumscribed(C, B, A)");
        await expect.poll(() => lines().length).toBe(13);
    });

    it("takes a number typed in the hint", async () => {
        const { page, request } = await editor();
        await request("load", {
            data: new TextEncoder().encode(
                JSON.stringify({
                    dgo: 1,
                    v: { o: [400, 300], u: 40, w: 800, h: 600 },
                    mac: [
                        {
                            n: "Dilate",
                            f: ["D"],
                            m: [
                                {
                                    i: [["point"], ["point"], ["number"]],
                                    b: [["Dil", "D", [0, 1, ["k", { k: 2 }]]]],
                                    f: [3],
                                },
                            ],
                        },
                    ],
                    o: [
                        ["Pt", "O", [0, 0]],
                        ["Pt", "P", [1, 1]],
                    ],
                }),
            ).buffer,
            format: "dgo",
        });
        const click = (selector: string, text: string) =>
            [...page.querySelectorAll<HTMLElement>(selector)]
                .find((element) => element.textContent === text)!
                .click();
        (page.querySelector(".dge-line button") as HTMLElement).click();
        click(".dge-tools .dge-family", "Macros");
        click(".dge-tools button", "Dilate");
        const tap = (name: string) =>
            [...page.querySelectorAll<HTMLInputElement>(".dge-row")]
                .find((row) => row.value.startsWith(`${name} =`))!
                .parentElement!.dispatchEvent(
                    new PointerEvent("pointerdown", { bubbles: true }),
                );
        tap("O");
        expect(page.querySelector(".dge-hint input")).toBeNull();
        tap("P");
        const field = page.querySelector(".dge-hint input") as HTMLInputElement;
        expect(page.querySelector(".dge-hint")!.textContent).toContain(
            "3/3 – Designate a number",
        );
        const enter = () =>
            field.dispatchEvent(
                new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
            );
        field.value = "two";
        enter();
        expect(field.classList.contains("dge-error")).toBe(true);
        field.value = "-1,5";
        enter();
        await expect
            .poll(async () => (await saved(request)).o.slice(2))
            .toEqual([
                ["Mac", "mac", [0, 0, [0, 1, "-1.5"]]],
                ["Out", "D", [2, 1]],
            ]);
    });

    it("takes a number tapped in the figure, to define and to apply", async () => {
        const { page, request } = await editor();
        await request("load", {
            data: new TextEncoder().encode(
                JSON.stringify({
                    dgo: 1,
                    v: { o: [400, 300], u: 40, w: 800, h: 600 },
                    mac: [
                        {
                            n: "Dilate",
                            f: ["D"],
                            m: [
                                {
                                    i: [["point"], ["point"], ["number"]],
                                    b: [["Dil", "D", [0, 1, 2]]],
                                    f: [3],
                                },
                            ],
                        },
                    ],
                    o: [
                        ["Pt", "O", [0, 0]],
                        ["Pt", "P", [1, 1]],
                        ["Ex", "k", { t: "", v: 3, xy: [20, 40] }],
                    ],
                }),
            ).buffer,
            format: "dgo",
        });
        const click = (selector: string, text: string) =>
            [...page.querySelectorAll<HTMLElement>(selector)]
                .find((element) => element.textContent === text)!
                .click();
        // Hovered, k is lit as the other objects; then tapped.
        const tapK = () => {
            const k = [...page.querySelectorAll("svg text")].find((text) =>
                text.textContent!.startsWith("k ="),
            )!;
            const box = k.getBoundingClientRect();
            const at = {
                clientX: box.x + box.width / 2,
                clientY: box.y + box.height / 2,
                bubbles: true,
                isPrimary: true,
                pointerId: 1,
            };
            const target = page.elementFromPoint(at.clientX, at.clientY)!;
            const Pointer = (page.defaultView as typeof window).PointerEvent;
            target.dispatchEvent(new Pointer("pointermove", at));
            expect(k.closest(".dge-hover")).not.toBeNull();
            target.dispatchEvent(new Pointer("pointerdown", at));
            target.dispatchEvent(new Pointer("pointerup", at));
        };
        (page.querySelector(".dge-line button") as HTMLElement).click();
        click(".dge-tools .dge-family", "Macros");
        click(".dge-tools button", "New macro");
        tapK();
        expect(
            [
                ...page.querySelectorAll(
                    ".dge-macro-list:first-of-type .dge-macro-object",
                ),
            ].map((name) => name.textContent),
        ).toEqual(["k"]);
        (
            page.querySelector('.dge-macro [aria-label="Done"]') as HTMLElement
        ).click();
        (page.querySelector(".dge-line button") as HTMLElement).click();
        click(".dge-tools .dge-family", "Macros");
        click(".dge-tools button", "Dilate");
        const tap = (name: string) =>
            [...page.querySelectorAll<HTMLInputElement>(".dge-row")]
                .find((row) => row.value.startsWith(`${name} =`))!
                .parentElement!.dispatchEvent(
                    new PointerEvent("pointerdown", { bubbles: true }),
                );
        tap("O");
        tap("P");
        tapK();
        await expect
            .poll(async () => (await saved(request)).o.slice(3))
            .toEqual([
                ["Mac", "mac", [0, 0, [0, 1, 2]]],
                ["Out", "D", [3, 1]],
            ]);
    });

    it("takes a fixed initial without asking, once designated", async () => {
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
                                    i: [
                                        ["circle", "The disk?", "disk"],
                                        ["point"],
                                    ],
                                    b: [["Mid", "M", [0, 2]]],
                                    f: [3],
                                },
                            ],
                        },
                    ],
                    o: [
                        ["Pt", "O", [0, 0]],
                        ["Pt", "X", [3, 0]],
                        ["Cir", "w", [0, 1]],
                        ["Pt", "P", [1, 1]],
                        ["Pt", "R", [2, -1]],
                    ],
                }),
            ).buffer,
            format: "dgo",
        });
        const click = (selector: string, text: string) =>
            [...page.querySelectorAll<HTMLElement>(selector)]
                .find((element) => element.textContent === text)!
                .click();
        const tap = (name: string) =>
            [...page.querySelectorAll<HTMLInputElement>(".dge-row")]
                .find((row) => row.value.startsWith(`${name} =`))!
                .parentElement!.dispatchEvent(
                    new PointerEvent("pointerdown", { bubbles: true }),
                );
        const hint = () => page.querySelector(".dge-hint")!.textContent;
        const change = () =>
            page.querySelector<HTMLButtonElement>(".dge-hint .dge-hint-text");
        (page.querySelector(".dge-line button") as HTMLElement).click();
        click(".dge-tools .dge-family", "Macros");
        click(".dge-tools button", "Half");
        // Asked the first time.
        expect(hint()).toContain("1/2 – The disk?");
        expect(change()).toBeNull();
        tap("w");
        tap("P");
        await expect
            .poll(async () => (await saved(request)).o.slice(5))
            .toEqual([
                ["Mac", "mac", [0, 0, [2, 3]]],
                ["Out", "M", [5, 1]],
            ]);
        // Then taken: only the point is asked.
        expect(hint()).toContain("2/2");
        expect(change()!.textContent).toBe("Change w");
        tap("R");
        await expect
            .poll(async () => (await saved(request)).o.slice(7))
            .toEqual([
                ["Mac", "mac1", [0, 0, [2, 4]]],
                ["Out", "M1", [7, 1]],
            ]);
        // Another one designated.
        change()!.click();
        expect(hint()).toContain("1/2 – The disk?");
        page.body.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        // Kept with the figure.
        expect((await saved(request)).mac[0].m[0].i).toEqual([
            ["circle", "The disk?", "disk"],
            ["point"],
        ]);

        // A new macro's initial fixed in its panel, looked for by its
        // name.
        (page.querySelector(".dge-line button") as HTMLElement).click();
        click(".dge-tools .dge-family", "Macros");
        click(".dge-tools button", "New macro");
        const panel = page.querySelector(".dge-macro") as HTMLElement;
        ["w", "P"].forEach(tap);
        const lock =
            panel.querySelector<HTMLButtonElement>(".dge-macro-fixed")!;
        lock.click();
        expect(
            panel
                .querySelector(".dge-macro-fixed")!
                .getAttribute("aria-pressed"),
        ).toBe("true");
        click(".dge-macro button", "Next: the finals");
        tap("M");
        const name = panel.querySelector(
            ".dge-macro-field input",
        ) as HTMLInputElement;
        name.value = "Again";
        name.dispatchEvent(new Event("input"));
        click(".dge-macro button", "Create the macro");
        expect((await saved(request)).mac[1].m[0].i).toEqual([
            ["circle", "", "w"],
            ["point"],
        ]);

        // Applied, then undone back before it: the tool is left, the
        // figure still saved.
        const errors: string[] = [];
        page.defaultView!.addEventListener("unhandledrejection", (event) =>
            errors.push(String(event.reason)),
        );
        (page.querySelector(".dge-line button") as HTMLElement).click();
        click(".dge-tools .dge-family", "Macros");
        click(".dge-tools button", "Again");
        expect(hint()).toContain("2/2");
        page.body.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "z",
                ctrlKey: true,
                metaKey: true,
                bubbles: true,
            }),
        );
        await expect
            .poll(async () => (await saved(request)).mac.length)
            .toBe(1);
        expect(hint()).toBe("");
        expect(errors).toEqual([]);
    });

    it("opens the box of an application, a step to undo", async () => {
        const { page, request } = await editor();
        const figure = {
            ...CIRCUMCENTER,
            mac: [
                {
                    n: "Circumscribed",
                    f: ["O", "c"],
                    m: [
                        {
                            i: [["point"], ["point"], ["point"]],
                            b: [
                                ["Med", "m1", [0, 1]],
                                ["Med", "m2", [1, 2]],
                                ["Int", "O", [3, 4, 0]],
                                ["Cir", "c", [5, 0]],
                            ],
                            f: [5, 6],
                        },
                    ],
                },
            ],
            o: [
                ...CIRCUMCENTER.o.slice(0, 3),
                ["Mac", "mac", [0, 0, [0, 1, 2]]],
                ["Out", "P", [3, 1]],
                ["Out", "k", [3, 2]],
            ],
        };
        await request("load", {
            data: new TextEncoder().encode(JSON.stringify(figure)).buffer,
            format: "dgo",
        });
        // P tapped in the figure, where its row lights it.
        const item = [...page.querySelectorAll<HTMLElement>(".dge-item")].find(
            (element) =>
                element
                    .querySelector<HTMLInputElement>(".dge-row")!
                    .value.startsWith("P, k ="),
        )!;
        item.dispatchEvent(new MouseEvent("mouseenter"));
        const box = page
            .querySelector("svg .dge-hover")!
            .getBoundingClientRect();
        item.dispatchEvent(new MouseEvent("mouseleave"));
        const at = {
            clientX: box.x + box.width / 2,
            clientY: box.y + box.height / 2,
            bubbles: true,
            isPrimary: true,
            pointerId: 1,
        };
        const svg = page.elementFromPoint(at.clientX, at.clientY)!;
        const Pointer = (page.defaultView as typeof window).PointerEvent;
        svg.dispatchEvent(new Pointer("pointerdown", at));
        svg.dispatchEvent(new Pointer("pointerup", at));
        const open = page.querySelector(
            '.dge-bar-object [aria-label="Open the box"]',
        ) as HTMLElement;
        await expect.poll(() => open.style.display).toBe("grid");
        open.dispatchEvent(new PointerEvent("pointerenter"));
        expect(page.querySelector(".dge-hint")!.textContent).toBe(
            "P, k = Circumscribed(A, B, C)\nReplaces the application by its construction: 4 objects",
        );
        expect(page.querySelectorAll("svg .dge-preview").length).toBe(2);
        open.click();
        await expect
            .poll(async () => (await saved(request)).o)
            .toEqual([
                ...CIRCUMCENTER.o.slice(0, 5),
                ["Int", "P", [3, 4, 0]],
                ["Cir", "k", [5, 0]],
            ]);
        expect(page.querySelectorAll("svg .dge-preview").length).toBe(0);
        (page.querySelector('[aria-label="Undo"]') as HTMLElement).click();
        await expect
            .poll(async () => (await saved(request)).o)
            .toEqual(figure.o);
    });
});
