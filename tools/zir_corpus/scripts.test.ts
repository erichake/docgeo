import { it } from "vitest";
import { commands } from "vitest/browser";
import { programBlocks } from "../../src/editor/blocks/program_blocks";
import { parseProgram } from "../../src/import/dgp_formula";
import { zipEntries } from "../../src/import/ggb_zip";
import {
    parseZir,
    translateZir,
    Unsupported,
} from "../../src/import/zir_translate";

const FILES = import.meta.glob("../../tests/zirz/**/*.{zir,zirz,zirs}", {
    query: "?url",
    import: "default",
    eager: true,
}) as Record<string, string>;

// Each figure's text, by its name in the file.
async function figures(data: ArrayBuffer): Promise<[string, string][]> {
    const head = new Uint8Array(data, 0, 2);
    if (head[0] === 0x1f && head[1] === 0x8b)
        return [
            [
                "",
                await new Response(
                    new Blob([data])
                        .stream()
                        .pipeThrough(new DecompressionStream("gzip")),
                ).text(),
            ],
        ];
    if (head[0] !== 0x50 || head[1] !== 0x4b)
        return [["", new TextDecoder().decode(data)]];
    const pages: [string, string][] = [];
    for (const [name, read] of zipEntries(data))
        if (/\.zir$/i.test(name)) pages.push([name, await read().text()]);
    return pages;
}

// Each menu script of the corpus, "translated" or what stops it: its
// JavaScript, DGP's grammar, or the editor's blocks. See CARMETAL.md.
it("menu scripts", async () => {
    const lines: string[] = [];
    // The programs the blocks can't show, to find what they lack.
    const unblocked: string[] = [];
    let translated = 0;
    for (const [path, url] of Object.entries(FILES)) {
        const file = path.replace("../../tests/zirz/", "");
        const data = await (await fetch(url)).arrayBuffer();
        for (const [page, text] of await figures(data)) {
            const { menuScripts } = translateZir(
                parseZir(text),
                new Map(),
                1280,
                800,
            );
            for (const { name, program } of menuScripts) {
                let status: string;
                if (program instanceof Unsupported)
                    status = `script: ${program.message}`;
                else {
                    try {
                        status = programBlocks(
                            parseProgram(program),
                            true,
                            (name) => name,
                        )
                            ? "translated"
                            : "blocks";
                        if (status === "blocks")
                            unblocked.push(`===== ${name}\n${program}`);
                    } catch (error) {
                        status = `grammar: ${(error as Error).message}`;
                    }
                }
                if (status === "translated") translated++;
                lines.push(
                    `${file}${page && ` | ${page.replace(/\.zir$/, "")}`} | ${name} | ${status}`,
                );
            }
        }
    }
    lines.push(`${translated}/${lines.length} translated`);
    await commands.writeFile("tools/zir_corpus/scripts.txt", lines.join("\n"));
    await commands.writeFile(
        "tools/zir_corpus/unblocked.txt",
        unblocked.join("\n"),
    );
}, 600_000);
