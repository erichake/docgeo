/// <reference types="vite/client" />
import { expect, it } from "vitest";
import page from "../../index.html?raw";

const SOURCES = import.meta.glob<string>("../../src/**/*.ts", {
    query: "?raw",
    import: "default",
    eager: true,
});

// See EDITOR.md: the player never imports the editor.
it("keeps the editor out of the player", () => {
    const importing = Object.entries(SOURCES)
        .filter(
            ([path, source]) =>
                !path.includes("/src/editor/") &&
                /from\s+["'][./]*editor\//.test(source),
        )
        .map(([path]) => path);
    expect(Object.keys(SOURCES).length).toBeGreaterThan(50);
    expect(importing).toEqual([]);
    expect(page).not.toMatch(/editor/);
});
