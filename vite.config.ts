import { defineConfig, type Plugin } from "vite";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const now = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const version =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `.${pad(now.getHours())}${pad(now.getMinutes())}`;

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
                // Rather than named after one of its modules. What the
                // importers share, loaded with the first .dgp or .ggb
                // opened, isn't the engine.
                chunkFileNames: ({ facadeModuleId, moduleIds }) =>
                    facadeModuleId
                        ? "assets/[name]-[hash].js"
                        : moduleIds.every((id) => id.includes("/src/import/"))
                          ? "assets/import-[hash].js"
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
        editorServiceWorker(),
    ],
});

// The installed editor's service worker: the files it needs, cached when
// it installs, are then served from the cache, offline too. Its version,
// from their contents, changes with any of them, which the browser sees
// when the editor opens: the new version, cached in its own cache, replaces
// the old one once all of the editor's windows are closed.
function editorServiceWorker(): Plugin {
    let outDir = "";
    return {
        name: "editor-service-worker",
        apply: "build",
        configResolved(config) {
            outDir = resolve(config.root, config.build.outDir);
        },
        closeBundle() {
            // Not the player's page, the relay, which needs the network,
            // nor the manual, which isn't the editor's page.
            const files = readdirSync(outDir, {
                recursive: true,
                withFileTypes: true,
            })
                .filter((entry) => entry.isFile())
                .map((entry) =>
                    relative(outDir, join(entry.parentPath, entry.name)),
                )
                .filter(
                    (file) =>
                        !/(^|\/)\.|^(index\.html|figure\.php|tutorials\/)/.test(
                            file,
                        ),
                )
                .sort();
            const hash = createHash("sha256");
            for (const file of files)
                hash.update(file).update(readFileSync(join(outDir, file)));
            writeFileSync(
                join(outDir, "editor_sw.js"),
                serviceWorker(
                    `docgeo-editor-${hash.digest("hex").slice(0, 12)}`,
                    files,
                ),
            );
        },
    };
}

// Only the cached files are answered by the worker, from the cache whatever
// their query (`editor.html?url=…`), the others left to the network. A
// cache of another application of the same site is left alone.
const serviceWorker = (cache: string, files: string[]): string => `
const CACHE = ${JSON.stringify(cache)};
const FILES = ${JSON.stringify(files)};
const PATHS = new Set(FILES.map((file) => new URL(file, location).pathname));

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE).then((cache) =>
            cache.addAll(FILES.map((file) => new Request(file, { cache: "reload" }))),
        ),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key.startsWith("docgeo-editor-") && key !== CACHE)
                    .map((key) => caches.delete(key)),
            ),
        ),
    );
});

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== "GET" || url.origin !== location.origin || !PATHS.has(url.pathname))
        return;
    event.respondWith(
        caches
            .match(event.request, { cacheName: CACHE, ignoreSearch: true })
            .then((hit) => hit ?? fetch(event.request)),
    );
});
`;
