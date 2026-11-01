// A figure as DocGeo's player shows it, to compare with render.sh's:
//   node tools/carmetal/docgeo.mjs tests/zirz/eric/IllustreSymCollege.zirs \
//     out.png [--page n] [x1,y1:x2,y2 …] [--click name [--wait ms]]
// each x1,y1:x2,y2 a drag from and to these pixels of the 1280×832 window
// (the figure's 1280×800 above the workbook's tabs). Needs the dev server:
// npm run dev:vite -- --port 5199.
import { chromium } from "playwright";

const [figure, out, ...args] = process.argv.slice(2);
// "--click name": the button of that name clicked, after the drags, and
// "--wait ms" (default 3000) for it to run.
const option = (name) => {
    const k = args.indexOf(name);
    return k < 0 ? null : args.splice(k, 2)[1];
};
const click = option("--click");
const wait = Number(option("--wait") ?? 3000);
const rest = args;
const pageIndex = rest[0] === "--page" ? Number(rest[1]) : 1;
const drags = rest[0] === "--page" ? rest.slice(2) : rest;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 832 } });
page.on("pageerror", (error) => console.log("Error:", error.message));
await page.goto(
    `http://localhost:5199/index.html?url=http://localhost:5199/${encodeURI(figure)}`,
);
await page.waitForTimeout(1500);
const notices = await page.locator(".docgeo-notice").allInnerTexts();
if (notices.length) console.log(notices.join("\n"));
if (rest[0] === "--page") {
    await page
        .locator(".docgeo-tabs button")
        .nth(pageIndex - 1)
        .click();
    await page.waitForTimeout(1000);
}
for (const drag of drags) {
    const [from, to] = drag
        .split(":")
        .map((point) => point.split(",").map(Number));
    await page.mouse.move(...from);
    await page.mouse.down();
    await page.mouse.move(...to, { steps: 15 });
    await page.mouse.up();
}
await page
    .locator(".docgeo-notice button")
    .first()
    .click()
    .catch(() => {});
if (click) {
    page.on("dialog", (dialog) => {
        console.log("Dialog:", dialog.message());
        dialog.dismiss();
    });
    await page
        .locator("svg text")
        .getByText(click, { exact: true })
        .first()
        .click({ force: true });
    await page.waitForTimeout(wait);
    const alerts = await page
        .locator(".docgeo-alert, [role=alertdialog]")
        .allInnerTexts();
    if (alerts.length) console.log("Alert:", alerts.join(" | "));
}
await page.waitForTimeout(500);
await page.screenshot({ path: out });
await browser.close();
