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

export const SHOTS = [
    {
        file: "interface.webp",
        page: "editor.html",
        run: ({ type }) => type(TRIANGLE),
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
];
