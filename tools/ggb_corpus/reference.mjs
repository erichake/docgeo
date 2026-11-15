// Compares a corpus figure with GeoGebra, the reference (see GGB_IMPORT.md,
// « Méthode et prochaines étapes »).
//
//   node tools/ggb_corpus/reference.mjs values <file.ggb> <label>…
//       GeoGebra's value of each object once the figure is open.
//   node tools/ggb_corpus/reference.mjs shot <file.ggb>…
//       PNGs of the figure in GeoGebra and in DocGeo, in
//       tools/ggb_corpus/shots/ (out of git), to compare by eye.
//   node tools/ggb_corpus/reference.mjs eval <command>…
//       Runs commands in an empty GeoGebra and writes the value of every
//       object, e.g. to read its convention for a command.
//
// It needs GeoGebra served on port 8765 and, for "shot", DocGeo on 5199:
//   (cd ../doctools_MAIN/public/apps/geogebra && python3 -m http.server 8765)
//   npx vite --port 5199
// GeoGebra loads its script and advanced commands (SetValue, Focus…) on
// demand: the script tries one, then waits for them.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const [mode, ...args] = process.argv.slice(2);
const HERE = new URL(".", import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
await page.goto("http://localhost:8765/classic-offline.html");
await page.waitForFunction(() => window.ggbApplet?.evalCommand, null, {
    timeout: 60000,
});
// Returning strings only: GeoGebra's objects don't serialize.
const load = (file) =>
    page.evaluate(
        async (base64) => {
            await new Promise((resolve) => {
                ggbApplet.setBase64(base64, resolve);
                setTimeout(resolve, 5000);
            });
            await new Promise((resolve) => setTimeout(resolve, 800));
        },
        readFileSync(`${HERE}corpus/${file}`).toString("base64"),
    );

if (mode === "values") {
    await load(args[0]);
    console.log(
        await page.evaluate(
            (labels) =>
                labels
                    .map(
                        (label) =>
                            `${label} = ${ggbApplet.getValue(label)}  ${String(ggbApplet.getValueString(label))}`,
                    )
                    .join("\n"),
            args.slice(1),
        ),
    );
} else if (mode === "shot") {
    mkdirSync(`${HERE}shots`, { recursive: true });
    for (const file of args) {
        await load(file);
        const png = await page.evaluate(() =>
            String(ggbApplet.getPNGBase64(1, false, 72)),
        );
        writeFileSync(`${HERE}shots/${file}.geogebra.png`, png, "base64");
        const docgeo = await browser.newPage({
            viewport: { width: 1000, height: 700 },
        });
        await docgeo.goto(
            `http://localhost:5199/index.html?url=/tools/ggb_corpus/corpus/${file}`,
        );
        await docgeo.waitForTimeout(3000);
        await docgeo.screenshot({ path: `${HERE}shots/${file}.docgeo.png` });
        await docgeo.close();
        console.log(`shots/${file}.geogebra.png, shots/${file}.docgeo.png`);
    }
} else if (mode === "eval") {
    console.log(
        await page.evaluate(async (commands) => {
            const run = () => {
                ggbApplet.newConstruction();
                commands.forEach((command) => ggbApplet.evalCommand(command));
            };
            for (let tries = 0; ; tries++)
                try {
                    run();
                    break;
                } catch (error) {
                    if (tries > 30) return String(error);
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
            return ggbApplet
                .getAllObjectNames()
                .map(
                    (name) =>
                        `${name} = ${String(ggbApplet.getValueString(name))}`,
                )
                .join("\n");
        }, args),
    );
}
await browser.close();
