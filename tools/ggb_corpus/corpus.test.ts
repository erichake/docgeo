import { it } from "vitest";
import { commands } from "vitest/browser";
import { construction } from "../../src/construction";
import { importGgbFromBlob } from "../../src/ggb_importer";
import { readZipEntry } from "../../src/import/ggb_zip";
import { preferences } from "../../src/preferences";
import { renderTeX } from "../../src/objects/latex";

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
        // The angles and numbers whose value differs from GeoGebra's saved
        // one: "label saved imported".
        const mismatches: string[] = [];
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
            doc.querySelectorAll(
                'construction > element[type="angle"], construction > element[type="numeric"]',
            ).forEach((element) => {
                const label = element.getAttribute("label")!;
                const raw = Number(
                    element
                        .querySelector(":scope > value")
                        ?.getAttribute("val"),
                );
                // An angle not reflex (1) or reflex (2) saves its value
                // counterclockwise.
                const style = element
                    .querySelector(":scope > angleStyle")
                    ?.getAttribute("val");
                const saved =
                    (style === "1" && raw > Math.PI) ||
                    (style === "2" && raw < Math.PI)
                        ? 2 * Math.PI - raw
                        : raw;
                const value = c.getObj(label)?.scriptValue(false);
                // Undefined (null) where GeoGebra saved a number, too.
                if (
                    Number.isFinite(saved) &&
                    (value === null ||
                        (typeof value === "number" &&
                            Math.abs(value - saved) >
                                1e-6 * Math.max(1, Math.abs(saved))))
                )
                    mismatches.push(`${label} ${saved} ${value}`);
            });
            // And the points of the plane whose coordinates differ, but the
            // window's corners.
            const corners = new Set(
                [
                    ...doc.querySelectorAll(
                        'construction > command[name="Corner"] > output',
                    ),
                ].map((output) => output.getAttribute("a0")),
            );
            doc.querySelectorAll(
                'construction > element[type="point"]',
            ).forEach((element) => {
                const label = element.getAttribute("label")!;
                if (corners.has(label)) return;
                const coords = element.querySelector(":scope > coords");
                const w = Number(coords?.getAttribute("z"));
                const saved = ["x", "y"].map(
                    (axis) => Number(coords?.getAttribute(axis)) / w,
                );
                const value = c.getObj(label)?.scriptValue(false);
                if (
                    saved.every(Number.isFinite) &&
                    Array.isArray(value) &&
                    saved.some(
                        (coordinate, index) =>
                            Math.abs((value[index] as number) - coordinate) >
                            1e-6 * Math.max(1, Math.abs(coordinate)),
                    )
                )
                    mismatches.push(`${label} (${saved}) (${value})`);
            });
            // And the shown LaTeX texts that KaTeX refuses, even repaired.
            c.OBJS.V.forEach((object) => {
                const t = object as any;
                if (!t.latex || t.hidden || typeof t.value !== "string") return;
                const tex = t.rounded("{,}");
                const error = /katex-error[^>]*?(?:title="([^"]*)")?>/.exec(
                    renderTeX(tex)[0],
                );
                if (error)
                    mismatches.push(
                        `latex ${t.name} ${error[1]?.slice(0, 120)} ⟦${tex.slice(0, 200)}⟧`,
                    );
            });
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
                mismatches,
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
