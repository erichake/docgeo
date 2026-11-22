import { createReadStream, statSync } from "node:fs";
import { extname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const TYPES: Record<string, string> = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    // Else compiled more slowly (see CAS.md).
    ".wasm": "application/wasm",
    ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// A folder served under `prefix`, by the development server and the
// browser tests'.
const serve = (prefix: string, folder: string): Plugin => {
    const root = fileURLToPath(new URL(folder, import.meta.url));
    return {
        name: `serve${prefix.replace("/", "-")}`,
        configureServer(server) {
            server.middlewares.use(prefix, (request, response, next) => {
                const path = decodeURIComponent(
                    new URL(request.url!, "http://localhost").pathname,
                );
                const file = join(root, path === "/" ? "index.html" : path);
                if (
                    !file.startsWith(root + sep) ||
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
    };
};

// DocCells, which DocTools serves beside DocGeo (see TABLEUR.md), from its
// build in DocTools.
export const serveDocCells = (): Plugin =>
    serve("/doccells", "../doctools_MAIN/public/apps/doccells");

// Giac's module (see CAS.md), from its build in giac_MAIN until the end of
// the project, which installs it in DocTools.
export const serveGiac = (): Plugin => serve("/giac", "../giac_MAIN/dist");
