import { defineConfig } from "vite";
import { execFileSync } from "node:child_process";

const version = execFileSync("git", ["log", "-1", "--format=%cs"], {
    cwd: new URL(".", import.meta.url),
    encoding: "utf8",
})
    .trim()
    .replace(/-/g, "");

export default defineConfig({
    base: "./",
    define: {
        __DOCGEO_VERSION__: JSON.stringify(`v${version}`),
    },
    server: {
        host: "0.0.0.0",
        port: 5175,
        strictPort: true,
        // The figure relay (public/figure.php), run by PHP's own server
        // where PHP is installed (see scripts/dev.sh).
        proxy: { "/figure.php": "http://127.0.0.1:5176" },
    },
    // The player and the editor (see EDITOR.md) in one build, so that
    // neither erases the other: they share the engine's chunk, the player
    // never loading the editor's code.
    build: {
        outDir: "../doctools_MAIN/public/apps/docgeo",
        emptyOutDir: true,
        rollupOptions: {
            input: ["index.html", "editor.html"],
            output: {
                // Rather than named after one of its modules.
                chunkFileNames: ({ facadeModuleId }) =>
                    facadeModuleId
                        ? "assets/[name]-[hash].js"
                        : "assets/engine-[hash].js",
            },
        },
    },
    plugins: [
        {
            // Every browser DocGeo runs in reads woff2: KaTeX's woff and
            // ttf fallbacks would only weigh down the build.
            name: "katex-woff2-only",
            enforce: "pre",
            transform(code, id) {
                if (id.includes("katex.min.css"))
                    return code.replace(
                        /,url\([^)]+\.woff\) format\("woff"\),url\([^)]+\.ttf\) format\("truetype"\)/g,
                        "",
                    );
            },
        },
    ],
});
