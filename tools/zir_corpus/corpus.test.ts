import { it } from "vitest";
import { commands } from "vitest/browser";
import { construction } from "../../src/construction";
import { preferences } from "../../src/preferences";
import { openFigureFile } from "../../src/workbook";

const FILES = import.meta.glob("../../tests/zirz/**/*.{zir,zirz,zirs}", {
    query: "?url",
    import: "default",
    eager: true,
}) as Record<string, string>;

it("corpus", async () => {
    const lines: string[] = [];
    for (const [path, url] of Object.entries(FILES)) {
        const name = path.replace("../../tests/zirz/", "");
        let unsupported: string[] = [];
        let error: string | null = null;
        let pages = 1;
        const start = performance.now();
        (globalThis as any).ZIRF = [];
        try {
            const blob = await (await fetch(url)).blob();
            const c = construction.create({ prefs: new preferences() });
            c.animations.paused = true;
            const opened = await openFigureFile(
                c,
                new File([blob], name.split("/").pop()!),
            );
            unsupported = opened.unsupported;
            pages = opened.book?.pages.length ?? 1;
        } catch (e) {
            error = String((e as Error).stack ?? e).slice(0, 500);
        }
        const ms = Math.round(performance.now() - start);
        construction.constructions.slice().forEach((item) => item.dispose());
        lines.push(
            JSON.stringify({
                name,
                pages,
                unsupported,
                error,
                ms,
                fails: (globalThis as any).ZIRF,
            }),
        );
    }
    await commands.writeFile(
        "tools/zir_corpus/results.jsonl",
        lines.join("\n"),
    );
}, 3_600_000);
