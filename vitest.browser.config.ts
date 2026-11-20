import { playwright } from "@vitest/browser-playwright";
import type { CDPSession } from "playwright";
import type { BrowserCommand } from "vitest/node";
import { defineConfig } from "vitest/config";
import { serveDocCells } from "./doccells.config.ts";

type Position = [number, number];

// Drags with the mouse, or a finger, from `from` to `to`: positions in the
// page of the test's iframe `selector`, whatever CSS transforms apply to it.
const drag: BrowserCommand<
    [selector: string, from: Position, to: Position, touch: boolean]
> = async ({ page, frame }, selector, from, to, touch) => {
    const iframe = (await frame()).locator(selector);
    const box = (await iframe.boundingBox())!;
    const scale =
        box.width /
        (await iframe.evaluate(
            (element) => (element as HTMLElement).offsetWidth,
        ));
    const STEPS = 10;
    // From and to the same place, a tap: moves in between would only
    // lengthen it, beyond the click delay when the files run together.
    const moves = from[0] === to[0] && from[1] === to[1] ? 0 : STEPS;
    const at = (step: number) => ({
        x: box.x + (from[0] + ((to[0] - from[0]) * step) / STEPS) * scale,
        y: box.y + (from[1] + ((to[1] - from[1]) * step) / STEPS) * scale,
    });
    if (touch) {
        const cdp = await page.context().newCDPSession(page);
        const send = (
            type: "touchStart" | "touchMove" | "touchEnd",
            step?: number,
        ) =>
            cdp.send("Input.dispatchTouchEvent", {
                type,
                touchPoints: step === undefined ? [] : [at(step)],
            });
        await send("touchStart", 0);
        for (let step = 1; step <= moves; step++) await send("touchMove", step);
        await send("touchEnd");
        await cdp.detach();
    } else {
        await page.mouse.move(at(0).x, at(0).y);
        await page.mouse.down();
        for (let step = 1; step <= moves; step++)
            await page.mouse.move(at(step).x, at(step).y);
        await page.mouse.up();
    }
};

const pinch: BrowserCommand<
    [selector: string, from: [Position, Position], to: [Position, Position]]
> = async ({ page, frame }, selector, from, to) => {
    const iframe = (await frame()).locator(selector);
    const box = (await iframe.boundingBox())!;
    const scale =
        box.width /
        (await iframe.evaluate((el) => (el as HTMLElement).offsetWidth));
    const cdp = await page.context().newCDPSession(page);
    const points = (step: number) =>
        from.map(([x, y], id) => ({
            id,
            x: box.x + (x + ((to[id][0] - x) * step) / 10) * scale,
            y: box.y + (y + ((to[id][1] - y) * step) / 10) * scale,
        }));
    await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: points(0),
    });
    for (let step = 1; step <= 10; step++)
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: points(step),
        });
    await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: points(10).slice(0, 1),
    });
    await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: points(10)
            .slice(0, 1)
            .map((p) => ({ ...p, x: p.x + 20 })),
    });
    await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
    });
    await cdp.detach();
};

// The processor slowed down this many times, by a session kept open: its
// emulation ends with it.
const sessions = new WeakMap<object, Promise<CDPSession>>();
const throttle: BrowserCommand<[rate: number]> = async ({ page }, rate) => {
    if (!sessions.has(page))
        sessions.set(page, page.context().newCDPSession(page));
    await (
        await sessions.get(page)!
    ).send("Emulation.setCPUThrottlingRate", {
        rate,
    });
};

export default defineConfig({
    plugins: [
        serveDocCells(),
        {
            // Vitest wraps the pages' dynamic imports (src/start.ts) in a
            // call to its runner, which a page in a test's iframe lacks.
            name: "iframe-pages-runner",
            transformIndexHtml: () => [
                {
                    tag: "script",
                    children:
                        "globalThis.__vitest_browser_runner__ ??= { wrapDynamicImport: (load) => load() };",
                    injectTo: "head-prepend",
                },
            ],
        },
    ],
    test: {
        include: ["tests/browser/**/*.test.ts"],
        browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
            commands: { drag, pinch, throttle },
        },
    },
});
