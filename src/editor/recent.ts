// What the editor keeps in the browser out of a frame (see EDITOR.md
// « Documents récents et récupération »): the last figures opened or saved,
// by their file where the browser gives one, or by their link, and a copy of
// the figure of each window while it has unsaved changes, which a window
// opened later offers to recover once the first one is closed.

export interface Recent {
    name: string;
    handle?: FileSystemFileHandle;
    url?: string;
}

export interface Draft {
    id: string;
    name: string;
    handle: FileSystemFileHandle | null;
    blob: Blob;
}

const RECENT = 10;
// Long enough not to write the figure at each of a series of changes.
const DELAY = 1500;
const LOCK = "docgeo-draft-";

let base: Promise<IDBDatabase> | null = null;

function store<T>(
    name: "recent" | "drafts",
    use: (store: IDBObjectStore) => IDBRequest<T>,
    mode: IDBTransactionMode = "readonly",
): Promise<T> {
    base ??= new Promise((resolve, reject) => {
        const request = indexedDB.open("docgeo-editor", 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore("recent");
            request.result.createObjectStore("drafts", { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    return base.then(
        (db) =>
            new Promise((resolve, reject) => {
                const request = use(
                    db.transaction(name, mode).objectStore(name),
                );
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            }),
    );
}

// The list as last read, for the menu, which is made at once: read again
// when the window comes back to the front, another one may have changed it.
export let recent: Recent[] = [];

let listing: Promise<unknown> = Promise.resolve();

// The list stored made anew by `make`, one change after the other.
const change = (
    make: (list: Recent[]) => Recent[] | Promise<Recent[]>,
): Promise<unknown> =>
    (listing = listing
        .catch(() => {})
        .then(async () => {
            recent =
                (await store<Recent[] | undefined>("recent", (s) =>
                    s.get("list"),
                )) ?? [];
            const list = await make(recent);
            if (list !== recent)
                await store(
                    "recent",
                    (s) => s.put((recent = list.slice(0, RECENT)), "list"),
                    "readwrite",
                );
        }));

const read = (): Promise<unknown> => change((list) => list);

const same = (entry: Recent, other: Recent): Promise<boolean> =>
    entry.handle
        ? (other.handle?.isSameEntry(entry.handle) ?? Promise.resolve(false))
        : Promise.resolve(other.url === entry.url);

const without = async (entry: Recent, list: Recent[]): Promise<Recent[]> => {
    const kept = await Promise.all(list.map((other) => same(entry, other)));
    return list.filter((_, index) => !kept[index]);
};

export const remember = (entry: Recent): Promise<unknown> =>
    change(async (list) => [entry, ...(await without(entry, list))]);

export const forget = (entry: Recent): Promise<unknown> =>
    change((list) => without(entry, list));

export const clearRecent = (): Promise<unknown> => change(() => []);

let id = "";
let write: (() => Promise<Blob>) | null = null;
let timer = 0;
let drafting: Promise<unknown> = Promise.resolve();

const hold = (key: string): void =>
    void navigator.locks.request(LOCK + key, () => new Promise(() => {}));

// The recent figures read, and the window's figure, written by `figure`,
// kept while it isn't saved; the drafts, which need the locks of a secure
// context, then the unsaved figure of a window closed, if there is one.
export async function keepFiles(
    figure: () => Promise<Blob>,
): Promise<Draft | undefined> {
    await read();
    window.addEventListener("focus", () => void read());
    if (!window.isSecureContext) return;
    id = crypto.randomUUID();
    hold(id);
    write = figure;
    const held = new Set(
        (await navigator.locks.query()).held!.map(({ name }) => name),
    );
    return (await store<Draft[]>("drafts", (s) => s.getAll())).find(
        (draft) => !held.has(LOCK + draft.id),
    );
}

// Kept while `dirty`, forgotten otherwise, the figure with the file it was
// opened from.
export function keepDraft(
    dirty: boolean,
    name: string,
    handle: FileSystemFileHandle | null,
): void {
    if (!write) return;
    clearTimeout(timer);
    const [key, figure] = [id, write];
    timer = window.setTimeout(
        () =>
            (drafting = drafting
                .then(async () => {
                    if (!dirty)
                        return store(
                            "drafts",
                            (s) => s.delete(key),
                            "readwrite",
                        );
                    // Before the transaction, which an await would end.
                    const blob = await figure();
                    return store(
                        "drafts",
                        (s) => s.put({ id: key, name, handle, blob }),
                        "readwrite",
                    );
                })
                .catch(console.error)),
        dirty ? DELAY : 0,
    );
}

// The draft recovered, kept as the window's own until the figure is saved.
export function adopt(draft: Draft): void {
    id = draft.id;
    hold(id);
}

export const dropDraft = (draft: Draft): Promise<unknown> =>
    store("drafts", (s) => s.delete(draft.id), "readwrite");
