import { afterEach, describe, expect, it } from "vitest";
import { $ } from "../../src/dom";

type Message = Record<string, any>;
const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach((dispose) => dispose()));

// The editor in a frame, which loads and saves figures.
async function editor() {
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
        expect(panel.style.display).toBe("flex");
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
        button("Next: the finals").click();
        expect(step()).toBe("Step 2/2: tap the finals among the green objects");
        // A, an initial, is no final.
        ["A", "O", "c"].forEach(tap);
        const names = (list: number) =>
            [...panel.querySelectorAll(".dge-macro-list")[list].children].map(
                (row) => row.querySelector(".dge-macro-object")?.textContent,
            );
        expect(names(0)).toEqual(["A", "B", "C"]);
        expect(names(1)).toEqual(["O", "c"]);
        const name = panel.querySelector(
            ".dge-macro-field input",
        ) as HTMLInputElement;
        name.value = "Circumscribed";
        name.dispatchEvent(new Event("input"));
        const save = button("Create the macro");
        save.click();
        expect(save.textContent).toBe("Replace the method of Circumscribed");
        const { mac } = await saved(request);
        expect(mac).toEqual([
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
        ]);

        // Without C, the finals miss it.
        button("Back to the initials").click();
        tap("C");
        expect(names(0)).toEqual(["A", "B"]);
        button("Next: the finals").click();
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
        expect(panel.style.display).toBe("none");
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

        // In the text, one line for the application and its finals.
        const lines = () =>
            [...page.querySelectorAll<HTMLInputElement>(".dge-row")].map(
                (row) => row.value,
            );
        expect(lines().slice(-2)).toEqual([
            "O1, c1 = Circumscribed(D, E, F)",
            "O1, c1 = Circumscribed(D, E, F)",
        ]);
        const enter = (field: HTMLInputElement, text: string) => {
            field.value = text;
            field.dispatchEvent(new Event("input", { bubbles: true }));
            field.dispatchEvent(
                new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
            );
        };
        enter(input, "Q, k = Circumscribed(A, B, F)");
        await expect.poll(() => lines().length).toBe(14);
        expect(lines().slice(-2)).toEqual([
            "Q, k = Circumscribed(A, B, F)",
            "Q, k = Circumscribed(A, B, F)",
        ]);
        // Redefined from a final's row, one final left out.
        const row = [
            ...page.querySelectorAll<HTMLInputElement>(".dge-row"),
        ].filter((field) => field.value.startsWith("Q, k"))[1];
        enter(row, "Q, _ = Circumscribed(A, B, D)");
        await expect.poll(() => lines().length).toBe(13);
        expect(lines().at(-1)).toBe("Q, _ = Circumscribed(A, B, D)");
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
        await expect.poll(() => lines().length).toBe(15);
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
});
