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

type Message = Record<string, any>;

interface Host {
    iframe: HTMLIFrameElement;
    // The events DocGeo sent besides ready.
    events: Message[];
    request(
        type: string,
        parameters?: Message,
        transfer?: Transferable[],
    ): Promise<Message>;
    drag(
        from: [number, number],
        to: [number, number],
        touch?: boolean,
    ): Promise<void>;
}

afterEach(() =>
    document.querySelectorAll("iframe").forEach((iframe) => iframe.remove()),
);

// A page embedding DocGeo in an iframe of the given style.
async function host(
    style = "width: 400px; height: 300px",
    parent = document.body,
): Promise<Host> {
    const iframe = document.createElement("iframe");
    iframe.setAttribute(
        "style",
        `display: block; border: 0; transform-origin: 0 0; ${style}`,
    );
    iframe.src = "/index.html?embed";
    const events: Message[] = [];
    const answers = new Map<number, (message: Message) => void>();
    let id = 0;
    const ready = new Promise<void>((resolve) =>
        window.addEventListener("message", ({ source, data }) => {
            if (source !== iframe.contentWindow || data?.docgeo !== 1) return;
            if (data.event === "ready") resolve();
            else if (data.event) events.push(data);
            else answers.get(data.id)!(data);
        }),
    );
    parent.append(iframe);
    await ready;
    return {
        iframe,
        events,
        request: (type, parameters = {}, transfer = []) =>
            new Promise((resolve) => {
                answers.set(++id, resolve);
                iframe.contentWindow!.postMessage(
                    { docgeo: 1, id, type, ...parameters },
                    "*",
                    transfer,
                );
            }),
        drag: (from, to, touch = false) =>
            commands.drag("iframe", from, to, touch),
    };
}

const fetched = async (path: string) => (await fetch(path)).arrayBuffer();
const encoded = (figure: object) =>
    new TextEncoder().encode(JSON.stringify(figure)).buffer as ArrayBuffer;
async function decoded(data: ArrayBuffer): Promise<Message> {
    const stream = new Blob([data])
        .stream()
        .pipeThrough(new DecompressionStream("gzip"));
    return JSON.parse(await new Response(stream).text());
}

// A window of 400 × 300 pixels, 40 per unit, its origin in the middle: A is
// drawn at (200, 150), B at (280, 110), M at (120, 190), and M is attracted
// by H, the orthocenter of ABC.
const FIGURE = {
    dgo: 1,
    v: { o: [200, 150], u: 40, w: 400, h: 300 },
    st: [{ mg: [[7, 20]] }],
    o: [
        ["Pt", "A", [0, 0]],
        ["Pt", "B", [2, 1]],
        ["Pt", "C", [-1, 2.5]],
        ["Line", "a", [1, 2]],
        ["Line", "b", [0, 2]],
        ["Perp", "ha", [3, 0]],
        ["Perp", "hb", [4, 1]],
        ["Int", "H", [5, 6, 0]],
        ["Pt", "M", [-2, -1], 0],
        ["Ex", "d", { t: "", s: ["d(H,M)", { H: 7, M: 8 }], xy: [10, 20] }],
        ["Ex", "k", { t: "", v: 2, mn: 0, mx: 10, xy: [10, 280] }],
    ],
};

async function loaded(style?: string, parent?: HTMLElement): Promise<Host> {
    const embedded = await host(style, parent);
    const answer = await embedded.request("load", {
        data: encoded(FIGURE),
        format: "dgo",
    });
    expect(answer).toMatchObject({ ok: true, result: { unsupported: [] } });
    return embedded;
}

function expectNear(actual: unknown, expected: number[], tolerance: number) {
    expect(actual).toHaveLength(expected.length);
    (actual as number[]).forEach((value, index) =>
        expect(Math.abs(value - expected[index])).toBeLessThanOrEqual(
            tolerance,
        ),
    );
}

describe("embedded mode", () => {
    it("shows neither a file picker nor a notice", async () => {
        const { iframe, request } = await host();
        await request("load", {
            data: await fetched("/tests/dgp/orthocentre.dgp"),
            format: "dgp",
        });
        const page = iframe.contentDocument!;
        expect(page.querySelector(".docgeo-picker")).toBeNull();
        expect(page.querySelector(".docgeo-notice")).toBeNull();
        expect(
            page.querySelector("svg")!.getBoundingClientRect(),
        ).toMatchObject({ width: 400, height: 300 });
    });

    it("imports figures", async () => {
        const { request } = await host();
        for (const [path, format] of [
            ["/tests/dgp/orthocentre.dgp", "dgp"],
            ["/tests/ggb/pointon.ggb", "ggb"],
        ]) {
            const data = await fetched(path);
            const answer = await request("load", { data, format }, [data]);
            expect(answer).toMatchObject({
                ok: true,
                result: { unsupported: [] },
            });
            // Transferred rather than copied.
            expect(data.byteLength).toBe(0);
        }
    });

    it("lists targets and reads their values", async () => {
        const { request } = await loaded();
        const { result: targets } = await request("targets");
        expect(targets).toContainEqual({
            name: "A",
            kind: "point",
            hidden: false,
            movable: true,
        });
        expect(targets).toContainEqual({
            name: "H",
            kind: "point",
            hidden: false,
            movable: false,
        });
        expect(targets).toContainEqual({
            name: "d",
            kind: "expression",
            hidden: false,
            movable: false,
        });
        expect(
            targets
                .filter(({ movable }: Message) => movable)
                .map(({ name }: Message) => name),
        ).toEqual(["A", "B", "C", "M", "k"]);
        expect(targets.some(({ name }: Message) => name === "a")).toBe(false);
        expect((await request("value", { name: "B" })).result).toEqual([2, 1]);
        expect((await request("value", { name: "k" })).result).toBe(2);
        expect(await request("value", { name: "a" })).toMatchObject({
            ok: false,
        });
    });

    it("refuses what it can't do", async () => {
        const { request } = await host();
        expect(await request("targets")).toMatchObject({
            ok: false,
            error: "No figure loaded",
        });
        expect(
            await request("load", { data: encoded({ dgo: 1 }), format: "dgo" }),
        ).toMatchObject({ ok: false, error: "Invalid DGO file" });
        expect(await request("getState")).toMatchObject({ ok: false });
        expect(
            await request("load", { data: encoded(FIGURE), format: "pdf" }),
        ).toMatchObject({ ok: false, error: "Invalid request" });
        expect(await request("toString")).toMatchObject({
            ok: false,
            error: "Unknown request: toString",
        });
        await request("load", { data: encoded(FIGURE), format: "dgo" });
        expect(await request("setState", { state: { A: "0" } })).toMatchObject({
            ok: false,
            error: "Invalid state",
        });
    });

    it("saves the current figure", async () => {
        const { request } = await loaded();
        await request("setState", { state: { A: [0.5, 0.25] } });
        const { result } = await request("save");
        const figure = await decoded(result.data);
        expect(figure.v).toMatchObject({ o: [200, 150], w: 400, h: 300 });
        expect(figure.o[0]).toEqual(["Pt", "A", [0.5, 0.25]]);
    });
});

describe("state", () => {
    it("follows manipulations", async () => {
        const { request, drag, events } = await loaded();
        expect((await request("getState")).result).toEqual({});
        await drag([200, 150], [240, 110]);
        await expect
            .poll(() => events)
            .toEqual([{ docgeo: 1, event: "change" }]);
        const { result: state } = await request("getState");
        expect(Object.keys(state)).toEqual(["A"]);
        expectNear(state.A, [1, 1], 1e-9);
        expectNear(
            (await request("value", { name: "A" })).result,
            [1, 1],
            1e-9,
        );

        // Neither a pan nor a click on nothing changes it.
        await drag([300, 250], [320, 260]);
        expect(events).toHaveLength(1);

        await request("reset");
        expect((await request("getState")).result).toEqual({});
        expect((await request("value", { name: "A" })).result).toEqual([0, 0]);

        await request("setState", { state });
        expect((await request("getState")).result).toEqual(state);
        expect((await request("value", { name: "A" })).result).toEqual(state.A);
    });

    // H, the orthocenter, attracts M: their distance is exactly zero.
    it("holds magnets exactly", async () => {
        const { request, drag } = await loaded();
        const H = (await request("value", { name: "H" })).result;
        const at = [200 + 40 * H[0], 150 - 40 * H[1]] as [number, number];
        await drag([120, 190], [at[0] + 6, at[1] - 4]);
        expect((await request("value", { name: "M" })).result).toEqual(H);
        expect((await request("value", { name: "d" })).result).toBe(0);
    });
});

describe("lock", () => {
    it("leaves only what it excepts manipulable", async () => {
        const { request, drag, iframe } = await loaded();
        expect(await request("lock", { except: ["M"] })).toEqual({
            docgeo: 1,
            id: 2,
            ok: true,
            result: null,
        });
        await drag([120, 190], [100, 250]);
        expectNear(
            (await request("value", { name: "M" })).result,
            [-2.5, -2.5],
            1e-9,
        );
        await drag([200, 150], [240, 110]);
        expect((await request("value", { name: "A" })).result).toEqual([0, 0]);
        const { result: state } = await request("getState");
        expect(Object.keys(state)).toEqual(["M"]);
        // The view stays manipulable.
        await drag([300, 250], [340, 210]);
        const saved = await decoded((await request("save")).result.data);
        expect(saved.v.o).toEqual([240, 110]);
        // The slider neither.
        const knob = iframe.contentDocument!.querySelector(
            'circle[style*="cursor: pointer"][style*="pointer-events: none"]',
        );
        expect(knob).not.toBeNull();
    });

    it("survives reset and setState, not load", async () => {
        const { request, drag } = await loaded();
        await request("lock", { except: ["M"] });
        await request("reset");
        await drag([200, 150], [240, 110]);
        expect((await request("value", { name: "A" })).result).toEqual([0, 0]);
        expect(
            await request("setState", { state: { A: [1, 1] } }),
        ).toMatchObject({ ok: true });
        expect((await request("value", { name: "A" })).result).toEqual([1, 1]);
        await drag([240, 110], [280, 110]);
        expect((await request("value", { name: "A" })).result).toEqual([1, 1]);

        await request("load", { data: encoded(FIGURE), format: "dgo" });
        await drag([200, 150], [240, 110]);
        expectNear(
            (await request("value", { name: "A" })).result,
            [1, 1],
            1e-9,
        );
    });

    it("refuses unknown names", async () => {
        const { request, drag } = await loaded();
        await request("lock", { except: ["M"] });
        expect(await request("lock", { except: ["M", "Z"] })).toMatchObject({
            ok: false,
            error: "No point or expression named Z",
        });
        expect(await request("lock", { except: "M" })).toMatchObject({
            ok: false,
            error: "Invalid request",
        });
        await drag([200, 150], [240, 110]);
        expect((await request("value", { name: "A" })).result).toEqual([0, 0]);
        // Nothing locked, all movable objects excepted.
        await request("lock", { except: ["A", "B", "C", "M", "k"] });
        await drag([200, 150], [240, 150]);
        expectNear(
            (await request("value", { name: "A" })).result,
            [1, 0],
            1e-9,
        );
    });
});

// c, of radius 2, is drawn through (280, 150); e, of radius k, through
// (240, 150).
const CIRCLES = {
    dgo: 1,
    v: { o: [200, 150], u: 40, w: 400, h: 300 },
    o: [
        ["Pt", "O", [0, 0]],
        ["C1", "c", [0, 2]],
        ["Ex", "k", { t: "", v: 1, mn: 0, mx: 3, xy: [10, 280] }],
        ["C1", "e", [0, ["k", { k: 2 }]]],
        ["Pt", "M", [-3, -2]],
    ],
};

describe("circle radius", () => {
    async function circles(): Promise<Host> {
        const embedded = await host();
        await embedded.request("load", {
            data: encoded(CIRCLES),
            format: "dgo",
        });
        return embedded;
    }

    it("is part of the state", async () => {
        const { request, drag, events } = await circles();
        expect((await request("getState")).result).toEqual({});
        await drag([280, 150], [200, 50]);
        await expect
            .poll(() => events)
            .toEqual([{ docgeo: 1, event: "change" }]);
        const { result: state } = await request("getState");
        expect(Object.keys(state)).toEqual(["c"]);
        expect(state.c).toBeCloseTo(2.5, 9);

        await request("reset");
        expect((await request("getState")).result).toEqual({});
        await request("setState", { state });
        expect((await request("getState")).result).toEqual(state);
        expect(
            await request("setState", { state: { c: "abc" } }),
        ).toMatchObject({ ok: false, error: "Invalid state" });
        expect((await request("getState")).result).toEqual(state);

        // A radius given by a formula isn't.
        await drag([240, 150], [240, 100]);
        expect(await request("setState", { state: { e: 2 } })).toMatchObject({
            ok: false,
            error: "Invalid state",
        });
        await request("setState", { state: { k: 2 } });
        expect((await request("getState")).result).toEqual({ k: 2 });

        // A state taken before circles were part of it.
        await request("setState", { state: { M: [1, 1] } });
        expect((await request("getState")).result).toEqual({ M: [1, 1] });
    });

    it("is locked by any lock", async () => {
        const { request, drag } = await circles();
        await request("lock", { except: ["M"] });
        await drag([280, 150], [200, 50]);
        expect((await request("getState")).result).toEqual({});
        // The drag panned the view.
        const saved = await decoded((await request("save")).result.data);
        expect(saved.v.o).toEqual([120, 50]);

        expect(await request("lock", { except: ["c"] })).toMatchObject({
            ok: false,
            error: "No point or expression named c",
        });
        await request("reset");
        await drag([280, 150], [200, 50]);
        expect((await request("getState")).result).toEqual({});

        await request("setState", { state: { c: 3 } });
        expect((await request("getState")).result).toEqual({ c: 3 });
    });
});

// P, pinned, is drawn at (240, 110).
const PINNED = {
    dgo: 1,
    v: { o: [200, 150], u: 40, w: 400, h: 300 },
    st: [{ fl: 1 }],
    o: [
        ["Pt", "P", [1, 1], 0],
        ["Pt", "M", [-3, -2]],
    ],
};

describe("pinned point", () => {
    async function pinned(): Promise<Host> {
        const embedded = await host();
        await embedded.request("load", {
            data: encoded(PINNED),
            format: "dgo",
        });
        return embedded;
    }

    it("is part of the state, in the base view", async () => {
        const { request, drag, events } = await pinned();
        expect((await request("targets")).result).toEqual([
            { name: "P", kind: "point", hidden: false, movable: true },
            { name: "M", kind: "point", hidden: false, movable: true },
        ]);
        // A pan moves its coordinates, not the state.
        await drag([300, 250], [340, 210]);
        expectNear(
            (await request("value", { name: "P" })).result,
            [0, 0],
            1e-9,
        );
        expect((await request("getState")).result).toEqual({});
        expect(events).toEqual([]);

        await drag([240, 110], [280, 150]);
        await expect
            .poll(() => events)
            .toEqual([{ docgeo: 1, event: "change" }]);
        const { result: state } = await request("getState");
        expect(Object.keys(state)).toEqual(["P"]);
        expectNear(state.P, [2, 0], 1e-9);

        await request("reset");
        expect((await request("getState")).result).toEqual({});
        await request("setState", { state });
        expect((await request("getState")).result).toEqual(state);
        expect((await request("value", { name: "P" })).result).toEqual(state.P);

        // A state taken before pinned points were part of it.
        await request("setState", { state: { M: [1, 1] } });
        expect((await request("getState")).result).toEqual({ M: [1, 1] });
    });

    it("is locked unless excepted", async () => {
        const { request, drag } = await pinned();
        await request("lock", { except: ["M"] });
        await drag([240, 110], [280, 150]);
        expect((await request("getState")).result).toEqual({});
        await request("setState", { state: { P: [2, 0] } });
        expect((await request("getState")).result).toEqual({ P: [2, 0] });

        await request("lock", { except: ["P"] });
        await request("reset");
        await drag([240, 110], [280, 150]);
        expectNear((await request("getState")).result.P, [2, 0], 1e-9);
    });
});

describe("rebase", () => {
    it("makes the current figure the base one", async () => {
        const { request, drag, events } = await loaded();
        const value = async (name: string) =>
            (await request("value", { name })).result;
        await request("setState", { state: { A: [1, 1], k: 4 } });
        expect(await request("rebase")).toMatchObject({
            ok: true,
            result: null,
        });
        expect((await request("getState")).result).toEqual({});
        expect(await value("A")).toEqual([1, 1]);

        await drag([240, 110], [280, 110]);
        await expect
            .poll(() => events)
            .toEqual([{ docgeo: 1, event: "change" }]);
        const { result: state } = await request("getState");
        expect(Object.keys(state)).toEqual(["A"]);
        expectNear(state.A, [2, 1], 1e-9);

        await request("reset");
        expect((await request("getState")).result).toEqual({});
        expect(await value("A")).toEqual([1, 1]);
        expect(await value("k")).toBe(4);

        // The state's values replace the base's.
        await request("setState", { state: { M: [1, 2] } });
        expect((await request("getState")).result).toEqual({ M: [1, 2] });
        expect(await value("A")).toEqual([1, 1]);
        await request("setState", { state: { A: [0, 0], k: 2 } });
        expect((await request("getState")).result).toEqual({
            A: [0, 0],
            k: 2,
        });
        expect(
            await request("setState", { state: { A: [3, 3], Z: 1 } }),
        ).toMatchObject({ ok: false, error: "Invalid state" });
        expect((await request("getState")).result).toEqual({
            A: [0, 0],
            k: 2,
        });

        // Rebases add up.
        await request("setState", { state: { k: 5 } });
        await request("rebase");
        await request("reset");
        expect(await value("A")).toEqual([1, 1]);
        expect(await value("k")).toBe(5);
        expect((await request("getState")).result).toEqual({});
        expect(events).toHaveLength(1);

        // Load brings back the file's base.
        await request("load", { data: encoded(FIGURE), format: "dgo" });
        expect((await request("getState")).result).toEqual({});
        expect(await value("A")).toEqual([0, 0]);
        await request("setState", { state: { M: [1, 2] } });
        expect(await value("A")).toEqual([0, 0]);
        await request("reset");
        expect(await value("k")).toBe(2);
    });

    it("emits no change, even after a manipulation", async () => {
        const { request, drag, events } = await loaded();
        await drag([200, 150], [240, 110]);
        await expect
            .poll(() => events)
            .toEqual([{ docgeo: 1, event: "change" }]);
        await request("rebase");
        expect((await request("getState")).result).toEqual({});
        // A click on nothing.
        await drag([300, 250], [300, 250]);
        expect(events).toHaveLength(1);
        await request("reset");
        expectNear(
            (await request("value", { name: "A" })).result,
            [1, 1],
            1e-9,
        );
    });

    it("keeps the lock", async () => {
        const { request, drag } = await loaded();
        await request("setState", { state: { A: [1, 1] } });
        await request("rebase");
        await request("lock", { except: ["M"] });
        await request("rebase");
        await drag([240, 110], [280, 110]);
        expect((await request("value", { name: "A" })).result).toEqual([1, 1]);
        await drag([120, 190], [100, 250]);
        expectNear((await request("getState")).result.M, [-2.5, -2.5], 1e-9);
        await request("reset");
        await drag([240, 110], [280, 110]);
        expect((await request("getState")).result).toEqual({});
    });

    // P, pinned, is drawn at (240, 110); N, on [OB], at (240, 150).
    it("holds pinned points and points on objects", async () => {
        const { request, drag } = await host();
        await request("load", {
            data: encoded({
                ...PINNED,
                o: [
                    ...PINNED.o,
                    ["Pt", "O", [0, 0]],
                    ["Pt", "B", [4, 0]],
                    ["Seg", "s", [2, 3]],
                    ["On", "N", [4, 0.25]],
                ],
            }),
            format: "dgo",
        });
        const value = async (name: string) =>
            (await request("value", { name })).result;
        await request("setState", { state: { P: [2, 0], N: 0.75 } });
        expectNear(await value("N"), [3, 0], 1e-9);
        await request("rebase");
        expect((await request("getState")).result).toEqual({});

        // The view isn't part of the base.
        await drag([300, 250], [340, 210]);
        expectNear(await value("P"), [1, -1], 1e-9);
        await request("rebase");
        expect((await request("getState")).result).toEqual({});
        await request("reset");
        expect(await value("P")).toEqual([2, 0]);
        expectNear(await value("N"), [3, 0], 1e-9);
        expect((await request("getState")).result).toEqual({});
        const saved = await decoded((await request("save")).result.data);
        expect(saved.v.o).toEqual([200, 150]);

        await request("setState", { state: { N: 0.5 } });
        expect((await request("getState")).result).toEqual({ N: 0.5 });
        expect(await value("P")).toEqual([2, 0]);
        expectNear(await value("N"), [2, 0], 1e-9);
    });
});

describe("setHidden", () => {
    it("hides in the base figure too", async () => {
        const { request, iframe } = await loaded();
        const shown = () =>
            [...iframe.contentDocument!.querySelectorAll("text")].some((text) =>
                text.textContent!.startsWith("d = "),
            );
        const hidden = async () =>
            (await request("targets")).result.find(
                ({ name }: Message) => name === "d",
            ).hidden;
        expect(shown()).toBe(true);
        expect(
            await request("setHidden", { name: "d", hidden: true }),
        ).toMatchObject({ ok: true, result: null });
        expect(shown()).toBe(false);
        expect(await hidden()).toBe(true);
        await request("reset");
        expect(shown()).toBe(false);
        const { result } = await request("save");
        await request("load", { data: result.data, format: "dgo" });
        expect(await hidden()).toBe(true);
        await request("setHidden", { name: "d", hidden: false });
        expect(shown()).toBe(true);
        await request("setState", { state: { k: 3 } });
        expect(shown()).toBe(true);

        expect(
            await request("setHidden", { name: "a", hidden: true }),
        ).toMatchObject({ ok: false, error: "No point or expression named a" });
        expect(await request("setHidden", { name: "d" })).toMatchObject({
            ok: false,
            error: "Invalid request",
        });
    });
});

describe("hidden iframe", () => {
    // Loaded while its parent isn't displayed, the figure is placed once
    // shown, as if loaded then.
    it("places the figure once shown", async () => {
        const parent = document.createElement("div");
        parent.style.display = "none";
        document.body.append(parent);
        const { request } = await loaded(undefined, parent);
        await request("setState", { state: { A: [1, 1] } });
        await request("lock", { except: ["M"] });
        await request("setHidden", { name: "k", hidden: true });
        parent.style.display = "block";
        const view = async () =>
            (await decoded((await request("save")).result.data)).v;
        await expect.poll(view).toMatchObject({ o: [200, 150] });
        const figure = await decoded((await request("save")).result.data);
        expect(figure.o[9][2].xy).toEqual([10, 20]);
        expect(figure.o[0]).toEqual(["Pt", "A", [1, 1]]);
        const { result: targets } = await request("targets");
        expect(targets[6]).toMatchObject({ name: "k", hidden: true });
        await request("reset");
        expect(await view()).toMatchObject({ o: [200, 150], w: 400, h: 300 });
        expect((await request("value", { name: "A" })).result).toEqual([0, 0]);
        parent.remove();
    });

    it("keeps the rebased figure once shown", async () => {
        const parent = document.createElement("div");
        parent.style.display = "none";
        document.body.append(parent);
        const { request } = await loaded(undefined, parent);
        await request("setState", { state: { A: [1, 1], k: 4 } });
        await request("rebase");
        await request("setState", { state: { M: [1, 2] } });
        parent.style.display = "block";
        const view = async () =>
            (await decoded((await request("save")).result.data)).v;
        await expect.poll(view).toMatchObject({ o: [200, 150] });
        expect((await request("getState")).result).toEqual({ M: [1, 2] });
        await request("reset");
        expect((await request("getState")).result).toEqual({});
        expect((await request("value", { name: "A" })).result).toEqual([1, 1]);
        expect((await request("value", { name: "k" })).result).toBe(4);
        parent.remove();
    });
});

describe("frame", () => {
    it("frames what is saved", async () => {
        const { request, drag, events, iframe } = await loaded();
        await request("frame", { show: true, w: 200, h: 150 });
        const label =
            iframe.contentDocument!.querySelector(".docgeo-frame-size")!;
        expect(label.textContent).toBe("200 × 150");

        // Centered: its bottom right corner is at (300, 225).
        await drag([300, 225], [340, 255]);
        await expect
            .poll(() => events)
            .toEqual([{ docgeo: 1, event: "frame", w: 240, h: 180 }]);
        expect(label.textContent).toBe("240 × 180");
        // Moved by its label.
        const box = label.getBoundingClientRect();
        const center: [number, number] = [
            box.x + box.width / 2,
            box.y + box.height / 2,
        ];
        await drag(center, [center[0] - 30, center[1] - 10]);
        await expect.poll(() => events).toHaveLength(2);
        expect(events[1]).toEqual({
            docgeo: 1,
            event: "frame",
            w: 240,
            h: 180,
        });

        // The figure stays manipulable, inside and outside the frame.
        await drag([200, 150], [240, 110]);
        await expect.poll(() => events).toHaveLength(3);
        expect(events[2]).toEqual({ docgeo: 1, event: "change" });

        const { result } = await request("save");
        const figure = await decoded(result.data);
        // The frame's top left corner moved from (100, 75) to (70, 65).
        expect(figure.v).toMatchObject({ o: [130, 85], w: 240, h: 180 });
        expect(figure.o[10][2].xy).toEqual([-60, 215]);

        // Once reopened, the frame surrounds the same region.
        await request("load", { data: result.data, format: "dgo" });
        await request("frame", { show: true, w: 240, h: 180 });
        const frame = iframe.contentDocument!.querySelector(".docgeo-frame")!;
        expect(frame.getBoundingClientRect()).toMatchObject({
            x: 80,
            y: 60,
            width: 240,
            height: 180,
        });
        expect((await decoded((await request("save")).result.data)).v).toEqual(
            figure.v,
        );

        await request("frame", { show: false });
        expect(
            iframe.contentDocument!.querySelector(".docgeo-frame"),
        ).toBeNull();
    });
});

describe("scaled iframe", () => {
    // Shrunk as on a phone, dragging A onto B puts it there, to a pixel of
    // the page, that is two of the figure.
    it.each([false, true])("touch: %s", async (touch) => {
        const { request, drag } = await loaded(
            "width: 400px; height: 300px; transform: scale(0.5)",
        );
        await drag([200, 150], [280, 110], touch);
        expectNear(
            (await request("value", { name: "A" })).result,
            [2, 1],
            2 / 40,
        );
    });
});
