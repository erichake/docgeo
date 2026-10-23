// The manual's screenshots (public/tutorials/<lang>/img), each rebuilt from
// scratch by `npm run manual`: a page of DocGeo, what is done in it, and the
// part of the window kept. Lines use the English command names, understood
// in every language, and buttons are found by their translated labels.

const TRIANGLE = [
    "A = (-5, -2)",
    "B = (4, -3)",
    "C = (-1, 4)",
    "p = Polygon(A, B, C)",
    "c = Circumcircle(A, B, C)",
    "M = Midpoint(A, B)",
    "a = Angle(B, A, C)",
];

// A triangle whose colour follows M while it is dragged, and n counting the
// times M is let go; all left of the properties panel.
async function events({ page, type, point, button, t }) {
    await type([
        "A = (-10, -4)",
        "B = (-4, -5)",
        "C = (-8, 3)",
        "p = Polygon(A, B, C)",
        "M = (-4, 2)",
        "n = 0",
    ]);
    const tab = async (key) =>
        page.getByRole("tab", { name: await t(key), exact: true }).click();
    const program = async (tool, lines) => {
        await button("tools");
        await page.hover(
            `.dge-tools button:has-text("${await t("family_programs")}")`,
        );
        await page.click(`.dge-tools button:has-text("${await t(tool)}")`);
        await page.mouse.click(...(await point("M")));
        await page.waitForTimeout(1200);
        await tab("program_text");
        await page.fill("textarea.dge-program", lines.join("\n"));
        await page
            .getByRole("button", { name: await t("apply"), exact: true })
            .click();
        await page.waitForTimeout(300);
        await tab("program_blocks");
        await page.waitForTimeout(800);
    };
    await program("when_dragged", [
        "if (y(M) > 0) {",
        "    p.setRGBColor(220, 38, 38);",
        "} else {",
        "    p.setRGBColor(37, 99, 235);",
        "}",
    ]);
    await program("when_released", ["n.setExpression(n + 1);"]);
    const [x, y] = await point("M");
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 10, y + 20, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(800);
}

// The triangle, published at a made-up address the page's requests to it
// are answered from, and its link given to File > Embed in a web page…:
// left in the dialog, or opened.
const PUBLISHED = "https://example.org/figures/triangle.dgo";
async function embedding({ page, type, t }, open) {
    await type(TRIANGLE);
    const dgo = await page.evaluate(async () => {
        const { studio } = await import("/src/editor/main.ts");
        const { writeDgo } = await import("/src/dgo.ts");
        const blob = await writeDgo(studio.scene);
        return [...new Uint8Array(await blob.arrayBuffer())];
    });
    await page.context().route(PUBLISHED, (route) =>
        route.fulfill({
            body: Buffer.from(dgo),
            headers: { "access-control-allow-origin": "*" },
        }),
    );
    await page.click(
        `.dge-menubar > div > button:has-text("${await t("menu_file")}")`,
    );
    await page.click(
        `.dge-menu-popup button:has-text("${await t("embed_page")}")`,
    );
    await page.fill("dialog input", PUBLISHED);
    if (!open) return;
    await page.click("dialog .dge-done");
    await page.waitForTimeout(1200);
}

export const SHOTS = [
    {
        file: "interface.webp",
        page: "editor.html",
        run: ({ type }) => type(TRIANGLE),
    },
    {
        file: "menus.webp",
        page: "editor.html",
        clip: { x: 0, y: 0, width: 1200, height: 220 },
        run: async ({ page, type, t }) => {
            await type(TRIANGLE);
            await page.click(
                `.dge-menubar > div > button:has-text("${await t("menu_file")}")`,
            );
        },
    },
    {
        file: "anneau.webp",
        page: "editor.html",
        clip: { x: 320, y: 0, width: 880, height: 720 },
        run: async ({ page, type, point, command }) => {
            await type(TRIANGLE);
            await page.mouse.click(...(await point("C")));
            await page.waitForTimeout(700);
            await page.hover(
                `.dge-ring button[aria-label="${await command("Segment")}"]`,
            );
        },
    },
    {
        file: "menu-outils.webp",
        page: "editor.html",
        clip: { x: 0, y: 0, width: 620, height: 720 },
        run: async ({ page, type, button, t }) => {
            await type(TRIANGLE);
            await button("tools");
            await page.hover(
                `.dge-tools button:has-text("${await t("family_circles")}")`,
            );
        },
    },
    {
        file: "proprietes.webp",
        page: "editor.html",
        run: async ({ page, type, point, button }) => {
            await type(TRIANGLE);
            await button("properties");
            await page.mouse.click(...(await point("C")));
        },
    },
    {
        file: "onglet-figure.webp",
        page: "editor.html",
        clip: { x: 600, y: 0, width: 600, height: 720 },
        run: async ({ page, type, point, button, t }) => {
            await type(TRIANGLE);
            await button("properties");
            await page.mouse.click(...(await point("C")));
            await page.click(`button:has-text("${await t("tab_figure")}")`);
        },
    },
    {
        file: "aimants.webp",
        page: "editor.html",
        clip: { x: 320, y: 0, width: 880, height: 720 },
        run: async ({ page, type, point, on, button }) => {
            await type([
                ...TRIANGLE.slice(0, 6),
                "P = (6, 3)",
                "d = Line(B, C)",
            ]);
            await page.mouse.click(...(await point("P")));
            await page.waitForTimeout(700);
            await button("magnet");
            await page.mouse.click(...(await on("c")));
            await page.waitForTimeout(300);
            await page.mouse.click(...(await point("A")));
            await page.mouse.move(1100, 150);
        },
    },
    {
        file: "tortue.webp",
        page: "editor.html",
        run: async ({ page, type, point, button, t }) => {
            await type(["A = (-8, -1)"]);
            await page.mouse.click(...(await point("A")));
            await page.waitForTimeout(700);
            await button("turtle");
            const tab = async (key) =>
                page
                    .getByRole("tab", { name: await t(key), exact: true })
                    .click();
            await tab("program_text");
            await page.fill(
                "textarea.dge-program",
                [
                    'TURTLE_INIT("A", A);',
                    "TURTLE_WIDTH(3);",
                    "for (var k = 1; k <= 5; k = k + 1) {",
                    "    TURTLE_COLOUR(10 * k);",
                    "    TURTLE_MV(160, true);",
                    "    TURTLE_TURN(144°);",
                    "}",
                    "return TURTLE_RESULT();",
                ].join("\n"),
            );
            await page
                .getByRole("button", { name: await t("apply"), exact: true })
                .click();
            await page.waitForTimeout(500);
            await tab("program_blocks");
            await page.waitForTimeout(1500);
        },
    },
    {
        file: "evenements.webp",
        page: "editor.html",
        run: events,
    },
    {
        file: "blocs-agrandis.webp",
        page: "editor.html",
        run: async (helpers) => {
            const { page } = helpers;
            await events(helpers);
            await page.click(".dge-blocks-size");
            await page.waitForTimeout(800);
            // Narrower, beside the figure.
            const move = async (selector, dx, dy) => {
                const box = await page.locator(selector).boundingBox();
                const x = box.x + box.width / 2;
                const y = box.y + box.height / 2;
                await page.mouse.move(x, y);
                await page.mouse.down();
                await page.mouse.move(x + dx, y + dy, { steps: 8 });
                await page.mouse.up();
            };
            await move(".dge-blocks-corner", -260, -140);
            await move(".dge-blocks-bar", 640, 40);
            await page.mouse.move(600, 650);
            await page.waitForTimeout(500);
        },
    },
    {
        file: "3d.webp",
        page: "editor.html",
        run: async ({ page, type, button }) => {
            await button("space");
            await page.waitForTimeout(1600);
            await type([
                "A = (-2, -2, 0)",
                "B = (2, -2, 0)",
                "C = (2, 2, 0)",
                "D = (-2, 2, 0)",
                "q = Polygon(A, B, C, D)",
                "S = (0, 0, 4)",
                "py = Pyramid(q, S)",
                "pl = z = 1.5",
                "s = Section(py, pl)",
            ]);
        },
    },
    {
        file: "integrer-lien.webp",
        page: "editor.html",
        clip: { x: 300, y: 160, width: 900, height: 420 },
        run: (helpers) => embedding(helpers, false),
    },
    {
        file: "integrer-cadre.webp",
        page: "editor.html",
        run: async (helpers) => {
            const { page, t } = helpers;
            await embedding(helpers, true);
            await page
                .getByRole("button", { name: await t("embed_options") })
                .click();
        },
    },
    {
        // The figure as the copied code shows it, its buttons shown.
        file: "integree.webp",
        page: "editor.html",
        run: async (helpers) => {
            const { page, t } = helpers;
            await embedding(helpers, true);
            await page.evaluate(() =>
                Object.defineProperty(navigator, "clipboard", {
                    value: { writeText: async (text) => (window.code = text) },
                }),
            );
            await page
                .getByRole("button", { name: await t("copy_code") })
                .click();
            const code = await page.evaluate(() => window.code);
            const [, src, w, h] = code.match(
                /src="([^"]*)".*width:(\d+)px.*aspect-ratio:\d+\/(\d+)/,
            );
            const lang = new URL(page.url()).searchParams.get("lang");
            await page.setViewportSize({ width: +w, height: +h });
            await page.goto(
                src
                    .replaceAll("&amp;", "&")
                    .replace("?fit=", `?lang=${lang}&fit=`),
            );
            await page.waitForTimeout(1500);
            await page.mouse.move(+w / 2, +h / 2);
            await page.waitForTimeout(400);
        },
    },
];
