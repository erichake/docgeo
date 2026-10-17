import { it } from "vitest";
import { commands } from "vitest/browser";
// First, as in the editor: the object classes import each other.
import "../../src/construction";
import { construction } from "../../src/construction";
import { figureObjects, importDgoFromBlob } from "../../src/dgo";
import { importDgp } from "../../src/dgp_importer";
import { isCommand } from "../../src/editor/catalog";
import { entryOf, figureIndex, lineOf, resolve } from "../../src/editor/figure";
import { parseLine } from "../../src/editor/text";
import { importGgbFromBlob } from "../../src/ggb_importer";
import { readZipEntry } from "../../src/import/ggb_zip";
import { preferences } from "../../src/preferences";

const FILES = import.meta.glob(
    [
        "../ggb_corpus/corpus/*.ggb",
        "../../tests/ggb/**/*.ggb",
        "../../tests/dgp/**/*.dgp",
        "../../tests/dgo/**/*.dgo",
    ],
    { query: "?url", import: "default", eager: true },
) as Record<string, string>;

// Of a GeoGebra figure, the command or element type of each label.
async function ggbSources(data: ArrayBuffer): Promise<Map<string, string>> {
    const xml = await readZipEntry(data, "geogebra.xml");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const sources = new Map<string, string>();
    doc.querySelectorAll("construction > element").forEach((element) =>
        sources.set(
            element.getAttribute("label")!,
            element.getAttribute("type")!,
        ),
    );
    doc.querySelectorAll("construction > expression").forEach((element) =>
        sources.set(element.getAttribute("label")!, "expression"),
    );
    doc.querySelectorAll("construction > command").forEach((command) => {
        const output = command.querySelector("output");
        for (const label of output ? [...output.attributes] : [])
            if (label.value)
                sources.set(label.value, command.getAttribute("name")!);
    });
    return sources;
}

// Each figure opened as the editor opens it: the objects whose row is read
// only (no line) and those whose line the row refuses as it is.
it("editability", async () => {
    const lines: string[] = [];
    for (const [path, url] of Object.entries(FILES)) {
        const name = path.replace(/^(\.\.\/)+/, "");
        const data = await (await fetch(url)).arrayBuffer();
        const blob = new Blob([data]);
        const missing: { name: string; tag: string; source?: string }[] = [];
        const refused: {
            name: string;
            tag: string;
            error: string;
            line: string;
        }[] = [];
        let objects = 0;
        let error: string | null = null;
        try {
            const c = construction.create({ prefs: new preferences() });
            c.animations.paused = true;
            const sources = /\.ggb$/.test(name)
                ? await ggbSources(data)
                : new Map<string, string>();
            if (/\.ggb$/.test(name)) await importGgbFromBlob(c, blob);
            else if (/\.dgo$/.test(name)) await importDgoFromBlob(c, blob);
            else importDgp(c, await blob.text());
            c.flush();
            const index = figureIndex(c);
            const all = figureObjects(c);
            objects = all.length;
            for (const object of all) {
                const [tag] = entryOf(object, index);
                const line = lineOf(object, index, all);
                if (line === null) {
                    missing.push({
                        name: object.name,
                        tag,
                        source: sources.get(object.name),
                    });
                    continue;
                }
                try {
                    resolve(c, parseLine(line, isCommand), object);
                } catch (e) {
                    const key = (e as { key?: string }).key;
                    refused.push({
                        name: object.name,
                        tag,
                        error: key ?? String(e).slice(0, 120),
                        line: line.slice(0, 160),
                    });
                }
            }
        } catch (e) {
            error = String(e).slice(0, 200);
        }
        construction.constructions.slice().forEach((item) => item.dispose());
        lines.push(JSON.stringify({ name, objects, missing, refused, error }));
    }
    await commands.writeFile(
        "tools/editability/results.jsonl",
        lines.join("\n"),
    );
}, 3_600_000);
