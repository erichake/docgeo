import { createReadStream, statSync } from "node:fs";
import { extname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

// DocCells, which DocTools serves beside DocGeo (see TABLEUR.md), served
// under /doccells/ from its build in DocTools, by the development server
// and the browser tests'.
const ROOT = fileURLToPath(
    new URL("../doctools_MAIN/public/apps/doccells", import.meta.url),
);
const TYPES: Record<string, string> = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const serveDocCells = (): Plugin => ({
    name: "serve-doccells",
    configureServer(server) {
        server.middlewares.use("/doccells", (request, response, next) => {
            const path = decodeURIComponent(
                new URL(request.url!, "http://localhost").pathname,
            );
            const file = join(ROOT, path === "/" ? "index.html" : path);
            if (
                !file.startsWith(ROOT + sep) ||
                !statSync(file, { throwIfNoEntry: false })?.isFile()
            )
                return next();
            response.setHeader(
                "Content-Type",
                TYPES[extname(file)] ?? "application/octet-stream",
            );
            createReadStream(file).pipe(response);
        });
    },
});
