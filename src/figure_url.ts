// The address of the figure to open, passed by `?url=`: the whole rest of
// the page's query, so that a link pasted as it is keeps its own parameters
// (Dropbox's `&`…).
const raw = /[?&]url=(.*)/.exec(window.location.search)?.[1];
export const FIGURE_URL =
    raw === undefined
        ? null
        : raw.includes("://")
          ? raw
          : decodeURIComponent(raw);

// A sharing link leads to a page showing the file: its file's address
// instead. Drive and Nextcloud then only serve it through the relay.
const SHARES: [RegExp, string][] = [
    [
        /^https:\/\/drive\.google\.com\/(?:file\/d\/|(?:open|uc)\?(?:.*&)?id=)([\w-]+).*/,
        "https://drive.usercontent.google.com/download?id=$1&export=download",
    ],
    [/^https:\/\/www\.dropbox\.com\//, "https://dl.dropboxusercontent.com/"],
    [
        /^https:\/\/(?:1drv\.ms\/u\/c|onedrive\.live\.com\/:u:\/g\/personal)\/(\w+)\/([\w-]+).*/,
        "https://my.microsoftpersonalcontent.com/personal/$1/_layouts/15/download.aspx?share=$2",
    ],
    [/^(https:\/\/[^?#]+\/s\/\w{15,})\/?(?:[?#].*)?$/, "$1/download"],
];

// The figure at `url`, named as its site names it, and with the extension
// of its format, told by its content.
export async function fetchFigure(url: string): Promise<File> {
    const address = SHARES.reduce(
        (address, [share, file]) => address.replace(share, file),
        new URL(url, location.href).href,
    );
    const response = await fetchFile(address);
    if (!response.ok)
        throw new Error(`Unable to load figure: ${response.status}`);
    const blob = await response.blob();
    const header = response.headers.get("content-disposition") ?? "";
    const encoded = /filename\*=utf-8''([^;]+)/i.exec(header)?.[1];
    const name =
        (encoded
            ? decodeURIComponent(encoded)
            : /filename="?([^";]+)/i.exec(header)?.[1]) ||
        decodeURIComponent(new URL(address).pathname.split("/").pop()!) ||
        "figure";
    if (/\.zir[sz]?$/i.test(name)) return new File([blob], name);
    const [first, second] = new Uint8Array(
        await blob.slice(0, 2).arrayBuffer(),
    );
    const extension =
        first === 0x50 && second === 0x4b
            ? "ggb"
            : (first === 0x1f && second === 0x8b) || /\.dgo$/i.test(name)
              ? "dgo"
              : "dgp";
    return new File(
        [blob],
        `${name.replace(/\.(dgo|dgp|ggb)$/i, "")}.${extension}`,
    );
}

// The relay next to the page (public/figure.php) fetches what the browser
// won't let it: another site's file that site doesn't allow it to read. Where
// the page is served without PHP, such a file just fails to open.
async function fetchFile(address: string): Promise<Response> {
    try {
        return await fetch(address);
    } catch {
        return fetch(`figure.php?url=${encodeURIComponent(address)}`);
    }
}
