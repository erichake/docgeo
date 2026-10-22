import type { construction } from "./construction";
import { importDgoFromBlob } from "./dgo";
import { importDgp } from "./dgp_importer";
import { importGgbFromBlob } from "./ggb_importer";

// A Google Drive sharing link leads to a page about the file, not the file,
// which Drive only serves to a server.
const DRIVE =
    /^https:\/\/drive\.google\.com\/(?:file\/d\/|(?:open|uc)\?(?:.*&)?id=)([\w-]+)/;

// The name of a figure opened from `url`: a Drive download doesn't tell its
// file's to another site.
export function urlName(url: string): string {
    return DRIVE.test(url) ? "figure" : url;
}

// The format is told by the file's content, a Drive link having no extension.
export async function importFigureFromUrl(
    c: construction,
    url: string,
): Promise<string[]> {
    const response = await fetchFigure(url);
    if (!response.ok)
        throw new Error(`Unable to load figure: ${response.status}`);
    const file = await response.blob();
    const [first, second] = new Uint8Array(
        await file.slice(0, 2).arrayBuffer(),
    );
    return first === 0x50 && second === 0x4b
        ? importGgbFromBlob(c, file)
        : (first === 0x1f && second === 0x8b) || /\.dgo$/i.test(url)
          ? importDgoFromBlob(c, file)
          : importDgp(c, await file.text());
}

// The relay next to the page (public/figure.php) fetches what the browser
// won't let it: another site's file that site doesn't allow it to read. Where
// the page is served without PHP, such a file just fails to open.
async function fetchFigure(url: string): Promise<Response> {
    const relay = (address: string) =>
        fetch(`figure.php?url=${encodeURIComponent(address)}`);
    const id = DRIVE.exec(url)?.[1];
    if (id)
        return relay(
            `https://drive.usercontent.google.com/download?id=${id}&export=download`,
        );
    try {
        return await fetch(url);
    } catch {
        return relay(new URL(url, location.href).href);
    }
}
