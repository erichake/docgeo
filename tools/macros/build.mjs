// Builds the library shipped with DocGeo, public/macros/<lang>.dgo, from
// tools/macros/library.mjs:
//
//   npm run macros
//
// Each macro is defined by the editor's own code from its figure, written
// in the text language, as a user would define it (see MACROS.md,
// « Bibliothèque »). DocGeo is served by Vite and driven by Playwright,
// the modules of the editor being read in the page itself.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { createServer } from "vite";
import { FOLDERS, LANGS, MACROS } from "./library.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "public/macros");

// Every text in every language.
for (const { name, folder, methods } of MACROS) {
    const texts = [
        name,
        ...folder.map((key) => FOLDERS[key]),
        ...methods.flatMap(({ help, messages = {} }) => [
            help,
            ...(Object.keys(messages).length ? [messages] : []),
        ]),
    ];
    for (const text of texts)
        for (const lang of LANGS)
            if (text?.[lang] === undefined)
                throw new Error(`${name.en}: nothing in ${lang}`);
}

const server = await createServer({
    root: ROOT,
    logLevel: "error",
    server: { port: 5191, strictPort: false, host: "127.0.0.1" },
});
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch();

try {
    const built = await inPage("en", build, MACROS);
    for (const lang of LANGS) {
        const library = {
            macros: MACROS.map(({ name, methods }, index) => ({
                ...built[index],
                name: name[lang],
                methods: built[index].methods.map((method, rank) => ({
                    ...method,
                    help: methods[rank].help[lang],
                    initials: method.initials.map(([type], at) => [
                        type,
                        methods[rank].messages?.[lang][at] ?? "",
                    ]),
                })),
            })),
            folders: MACROS.map(({ folder }) =>
                folder.map((key) => FOLDERS[key][lang]),
            ),
        };
        const figure = await inPage(lang, describe, library);
        writeFileSync(
            join(OUT, `${lang}.dgo`),
            gzipSync(JSON.stringify(figure), { level: 9 }),
        );
    }
    console.log(
        `public/macros: ${MACROS.length} macros, ${LANGS.length} languages`,
    );
} finally {
    await browser.close();
    await server.close();
}

async function inPage(lang, task, data) {
    const page = await browser.newPage();
    page.on("pageerror", (error) => console.error(error));
    await page.goto(`${base}tools/macros/page.html?lang=${lang}`);
    const result = await page.evaluate(task, data);
    await page.close();
    return result;
}

// Run in the page: each macro's methods and icon, from its figure.
async function build(sources) {
    const { construction } = await import("/src/construction.ts");
    const { preferences } = await import("/src/preferences.ts");
    const { readDgo } = await import("/src/dgo.ts");
    const { add, resolve } = await import("/src/editor/figure.ts");
    const { parseLine } = await import("/src/editor/text.ts");
    const { isCommand } = await import("/src/editor/catalog.ts");
    const { analyse, methodOf } = await import("/src/editor/macro.ts");
    const { macroThumbnail } = await import("/src/editor/macro_icon.ts");
    document.body.style.cssText =
        "margin: 0; position: relative; width: 800px; height: 600px";
    return sources.map(({ name, figure, hidden = [], methods }) => {
        const c = construction.create({ prefs: new preferences() });
        c.animations.paused = true;
        readDgo(c, {
            dgo: 1,
            v: { o: [400, 300], u: 40, w: 800, h: 600 },
            o: [],
        });
        figure.forEach((line) =>
            add(c, resolve(c, parseLine(line, isCommand))),
        );
        const get = (object) => {
            const found = c.getObj(object);
            if (!found) throw new Error(`${name.en}: no ${object}`);
            return found;
        };
        hidden.forEach((object) => (get(object).hidden = 1));
        c.flush();
        const defined = methods.map(({ initials, finals }) => {
            const given = initials.map(get);
            const analysis = analyse(c, given);
            const lacking = finals.filter(
                (final) => !analysis.determined(get(final)),
            );
            if (lacking.length)
                throw new Error(`${name.en}: ${lacking} not determined`);
            return methodOf(c, given, finals.map(get), [], "");
        });
        const [{ initials, finals }] = methods;
        const icon = macroThumbnail(initials.map(get), finals.map(get));
        c.dispose();
        return { finals, icon, methods: defined };
    });
}

// Run in the page, in the library's language: its names checked, as a
// .dgo, read back.
async function describe(library) {
    // First: the object classes import each other.
    await import("/src/construction.ts");
    const { nameProblem } = await import("/src/editor/macro.ts");
    const { describeLibrary, readLibrary } =
        await import("/src/editor/library.ts");
    const names = library.macros.map(({ name }) => name);
    names.forEach((name, index) => {
        const problem =
            nameProblem(name) ??
            (names.indexOf(name) !== index ? "named twice" : null);
        if (problem) throw new Error(`${name}: ${problem}`);
    });
    const figure = await describeLibrary(library);
    readLibrary(figure);
    return figure;
}
