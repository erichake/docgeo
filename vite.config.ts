import { defineConfig } from "vite";

export default defineConfig({
    base: "./",
    server: {
        port: 5175,
        strictPort: true,
    },
    build: {
        outDir: "../doctools_MAIN/public/apps/docgeo",
        emptyOutDir: true,
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
