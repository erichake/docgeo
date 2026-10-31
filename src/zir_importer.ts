import { construction } from "./construction";
import { describeDgo, importDgo, type Workbook } from "./dgo";
import { executeDgpCommands } from "./import/dgp_commands";
import { readZipBlob, readZipEntry, zipEntries } from "./import/ggb_zip";
import { parseZir, translateZir, type ZirImage } from "./import/zir_translate";
import { intersection_object } from "./objects/intersection_object";
import { settleTargets } from "./settle_targets";

// Returns what the figure uses that couldn't be imported.
export function importZir(
    c: construction,
    doc: Document,
    images = new Map<string, ZirImage>(),
): string[] {
    const { calls, targets, intersections, unsupported } = translateZir(
        doc,
        images,
        c.width,
        c.height,
    );
    c.segmentsOverPolygons = true;
    const executed = executeDgpCommands(c, calls);
    const variables = executed.variables;
    settleTargets(
        c,
        new Map(
            [...targets].map(([variable, coords]) => [
                variables.get(variable)!,
                coords,
            ]),
        ),
    );
    // CaRMetal's first or second intersection isn't DGP's: one that doesn't
    // exist, as on the wrong side of a ray, is the other one.
    c.OBJS.frame++;
    const ordered = new Set(intersections.map((name) => variables.get(name)));
    c.OBJS.V.forEach((object) => {
        object.computeGeometry();
        if (
            !(object instanceof intersection_object) ||
            object.defined ||
            !ordered.has(object)
        )
            return;
        object.order = object.order === 0 ? 1 : 0;
        object.computeGeometry();
    });
    c.flush();
    c.invalidateProjection();
    return [...unsupported, ...executed.unsupported];
}

// A .zir figure, a .zirz one gzipped or a .zirs workbook, a zip archive of
// figures and their images, which, if it has several figures, is the
// workbook returned, of which the figure is the page shown.
export async function importZirBook(
    c: construction,
    file: Blob,
): Promise<{ book: Workbook | null; unsupported: string[] }> {
    const data = await file.arrayBuffer();
    const head = new Uint8Array(data, 0, 2);
    if (head[0] === 0x1f && head[1] === 0x8b)
        return {
            book: null,
            unsupported: importZir(
                c,
                parseZir(
                    await new Response(
                        new Blob([data])
                            .stream()
                            .pipeThrough(new DecompressionStream("gzip")),
                    ).text(),
                ),
            ),
        };
    if (head[0] !== 0x50 || head[1] !== 0x4b)
        return {
            book: null,
            unsupported: importZir(c, parseZir(new TextDecoder().decode(data))),
        };
    const entries = new Map(zipEntries(data));
    const figures = [...entries.keys()].filter((name) => /\.zir$/i.test(name));
    if (figures.length < 2)
        return {
            book: null,
            unsupported: importZir(
                c,
                ...(await zipFigure(data, await readZipEntry(data, /\.zir$/i))),
            ),
        };
    // Each page is imported once, as a .dgo figure.
    const pages: Workbook["pages"] = [];
    const unsupported: string[] = [];
    for (const file of figures) {
        const name = file.replace(/\.zir$/i, "");
        const page = construction.create(c.dgpad);
        try {
            importZir(
                page,
                ...(await zipFigure(data, await entries.get(file)!().text())),
            ).forEach((item) => unsupported.push(`${name}: ${item}`));
            pages.push({ name, figure: await describeDgo(page) });
        } finally {
            page.dispose();
        }
    }
    const preferences = await entries.get("preferences.txt")?.().text();
    const tab = Number(/currenttab=(\d+)/.exec(preferences ?? "")?.[1]);
    const book = {
        pages,
        current: tab >= 1 && tab <= pages.length ? tab - 1 : 0,
    };
    importDgo(c, pages[book.current].figure);
    return { book, unsupported };
}

// The figure of this text from a zip archive, and the images it shows.
async function zipFigure(
    data: ArrayBuffer,
    text: string,
): Promise<[Document, Map<string, ZirImage>]> {
    const doc = parseZir(text);
    const images = new Map<string, ZirImage>();
    const names = doc.querySelectorAll("Image[filename]");
    for (const element of names) {
        const name = element.getAttribute("filename")!;
        const type = IMAGE_TYPES[name.split(".").pop()!.toLowerCase()];
        if (!type || images.has(name)) continue;
        // A missing or broken image is only left out, as unsupported.
        try {
            const blob = new Blob([await readZipBlob(data, name)], { type });
            const url = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            const image = new Image();
            image.src = url;
            await image.decode();
            images.set(name, {
                url,
                width: image.naturalWidth,
                height: image.naturalHeight,
            });
        } catch {}
    }
    return [doc, images];
}

const IMAGE_TYPES: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
};
