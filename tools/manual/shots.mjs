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
        file: "editeur-interface.webp",
        page: "editor.html",
        run: ({ type }) => type(TRIANGLE),
    },
    {
        file: "editeur-anneau.webp",
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
        file: "editeur-menu-outils.webp",
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
        file: "editeur-proprietes.webp",
        page: "editor.html",
        run: async ({ page, type, point, button }) => {
            await type(TRIANGLE);
            await button("properties");
            await page.mouse.click(...(await point("C")));
        },
    },
    {
        file: "editeur-onglet-figure.webp",
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
        file: "editeur-aimants.webp",
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
        file: "editeur-3d.webp",
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
