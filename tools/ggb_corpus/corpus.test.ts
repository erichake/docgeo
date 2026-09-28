import { it } from "vitest";
import { commands } from "vitest/browser";
import { construction } from "../../src/construction";
import { importGgbFromBlob } from "../../src/ggb_importer";
import { readZipEntry } from "../../src/import/ggb_zip";
import { preferences } from "../../src/preferences";

const FILES = import.meta.glob("./corpus/*.ggb", {
    query: "?url",
    import: "default",
    eager: true,
}) as Record<string, string>;

it("corpus", async () => {
    const lines: string[] = [];
    for (const [path, url] of Object.entries(FILES)) {
        const data = await (await fetch(url)).arrayBuffer();
        let used: string[] = [];
        let types: string[] = [];
        let unsupported: string[] = [];
        let error: string | null = null;
        let ms = 0;
        try {
            const xml = await readZipEntry(data, "geogebra.xml");
            const doc = new DOMParser().parseFromString(xml, "application/xml");
            used = [...doc.querySelectorAll("construction > command")].map(
                (c) => c.getAttribute("name") ?? "",
            );
            types = [...doc.querySelectorAll("construction > element")].map(
                (e) => e.getAttribute("type") ?? "",
            );
            const c = construction.create({ prefs: new preferences() });
            c.animations.paused = true;
            const start = performance.now();
            unsupported = await importGgbFromBlob(c, new Blob([data]));
            ms = performance.now() - start;
        } catch (e) {
            error = String(e).slice(0, 200);
        }
        construction.constructions.slice().forEach((item) => item.dispose());
        lines.push(
            JSON.stringify({
                name: path.split("/").pop(),
                commands: used,
                types,
                unsupported,
                error,
                ms,
            }),
        );
    }
    await commands.writeFile(
        "tools/ggb_corpus/results.jsonl",
        lines.join("\n"),
    );
}, 3_600_000);
