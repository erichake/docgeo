import { afterEach, describe, expect, it } from "vitest";
import { $ } from "../../src/dom";
import { expectClose, figure as fixture } from "./figures";

type Message = Record<string, any>;
const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach((dispose) => dispose()));

async function host() {
    const iframe = $.create("iframe")
        .att("src", "/editor.html?embed&lang=en")
        .stl("width:900px;height:600px;border:0")
        .dom() as HTMLIFrameElement;
    const events: Message[] = [];
    const pending = new Map<number, (answer: Message) => void>();
    let id = 0;
    let ready!: () => void;
    const started = new Promise<void>((resolve) => (ready = resolve));
    const listener = ({ source, data }: MessageEvent) => {
        if (source !== iframe.contentWindow || data?.docgeo !== 1) return;
        if (data.event === "ready") ready();
        else if (data.event) events.push(data);
        else {
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
    return {
        iframe,
        events,
        request: (type: string, parameters: Message = {}) =>
            new Promise<Message>((resolve) => {
                pending.set(++id, resolve);
                iframe.contentWindow!.postMessage(
                    { docgeo: 1, id, type, ...parameters },
                    "*",
                );
            }),
    };
}

const encoded = (figure: object) =>
    new TextEncoder().encode(JSON.stringify(figure)).buffer;
const figure = (name: string) => ({
    dgo: 1,
    v: { o: [400, 300], u: 40, w: 800, h: 600 },
    st: [{ h: 1 }],
    o: [["Pt", name, [2, 3], 0]],
});
async function decoded(data: ArrayBuffer): Promise<Message> {
    const stream = new Blob([data])
        .stream()
        .pipeThrough(new DecompressionStream("gzip"));
    return JSON.parse(await new Response(stream).text());
}

describe("embedded editor", () => {
    it("saves complete constructions and clears history when switching copies", async () => {
        const { iframe, request } = await host();
        expect(
            await request("load", {
                data: encoded(figure("A")),
                format: "dgo",
            }),
        ).toMatchObject({ ok: true, result: { unsupported: [] } });
        const page = iframe.contentDocument!;
        const input = page.querySelector(
            ".dge-entry .dge-input",
        ) as HTMLInputElement;
        input.value = "B = (4, 5)";
        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        await expect.poll(() => input.value).toBe("");
        const saved = await request("save");
        expect(saved.ok).toBe(true);
        const content = await decoded(saved.result.data);
        expect(content.o.map((object: unknown[]) => object[1])).toEqual([
            "A",
            "B",
        ]);
        expect(content.st).toContainEqual({ h: 1 });

        expect(
            await request("load", {
                data: encoded(figure("C")),
                format: "dgo",
            }),
        ).toMatchObject({ ok: true });
        page.body.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "z",
                ctrlKey: true,
                bubbles: true,
            }),
        );
        const replacement = await decoded((await request("save")).result.data);
        expect(replacement.o.map((object: unknown[]) => object[1])).toEqual([
            "C",
        ]);
    });

    it("imports DGPad and GeoGebra files and reopens their native DGO", async () => {
        const { request } = await host();
        for (const [name, format] of [
            ["orthocentre.dgp", "dgp"],
            ["pointon.ggb", "ggb"],
        ]) {
            const data = await (await fetch(fixture(name))).arrayBuffer();
            expect(await request("load", { data, format })).toMatchObject({
                ok: true,
            });
            const saved = (await request("save")).result.data;
            const content = await decoded(saved);
            expect(content.o.length).toBeGreaterThan(0);
            expect(
                await request("load", { data: saved, format: "dgo" }),
            ).toMatchObject({ ok: true, result: { unsupported: [] } });
            expectClose(
                (await decoded((await request("save")).result.data)).o,
                content.o,
            );
        }
    });

    it("routes the save button and keyboard shortcut to the host", async () => {
        const { iframe, events } = await host();
        const page = iframe.contentDocument!;
        const button = page.querySelector(
            '[aria-label="Save"]',
        ) as HTMLButtonElement;
        button.click();
        page.body.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "s",
                ctrlKey: true,
                bubbles: true,
            }),
        );
        await expect
            .poll(() => events.filter(({ event }) => event === "save").length)
            .toBe(2);
    });

    it("refuses malformed requests and continues processing messages", async () => {
        const { request } = await host();
        expect(
            await request("load", { data: "bad", format: "dgo" }),
        ).toMatchObject({ ok: false, error: "Invalid request" });
        expect(await request("unknown")).toMatchObject({
            ok: false,
            error: "Unknown request: unknown",
        });
        expect(
            await request("load", {
                data: encoded(figure("A")),
                format: "dgo",
            }),
        ).toMatchObject({ ok: true });
        expect(
            (await decoded((await request("save")).result.data)).o[0][1],
        ).toBe("A");
    });

    it("ignores requests from a window other than its parent", async () => {
        const { iframe, request } = await host();
        await request("load", { data: encoded(figure("A")), format: "dgo" });
        iframe.contentWindow!.dispatchEvent(
            new MessageEvent("message", {
                source: iframe.contentWindow,
                data: {
                    docgeo: 1,
                    id: 0,
                    type: "load",
                    data: encoded(figure("B")),
                    format: "dgo",
                },
            }),
        );
        expect(
            (await decoded((await request("save")).result.data)).o[0][1],
        ).toBe("A");
    });
});
