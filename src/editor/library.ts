import { describeMacros, dgoJson, imageKey, readMacros } from "../dgo";
import { LANG } from "../i18n";
import type { Macro } from "../objects/macro_object";

// Macros kept out of a figure: the library shipped with DocGeo and the
// user's own (see MACROS.md, « Bibliothèque », and DGO.md).

export interface Library {
    macros: Macro[];
    // Each one's folder, from the root.
    folders: string[][];
}

export const emptyLibrary = (): Library => ({ macros: [], folders: [] });

const invalid = (): never => {
    throw new Error("Invalid DGO file");
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

// A library, or a figure whose objects are ignored.
export function readLibrary(figure: unknown): Library {
    if (!isRecord(figure) || figure.dgo !== 1) return invalid();
    const { mac = [], st = [], img = {} } = figure;
    if (!Array.isArray(mac) || !Array.isArray(st) || !isRecord(img))
        return invalid();
    const macros = readMacros(mac, st, img);
    const folders = mac.map(({ d = [] }) =>
        Array.isArray(d) &&
        d.every((name) => typeof name === "string" && name !== "")
            ? (d as string[])
            : invalid(),
    );
    return { macros, folders };
}

// As a .dgo without objects.
export async function describeLibrary({ macros, folders }: Library) {
    const images: Record<string, string> = {};
    for (const { icon } of macros)
        if (icon) images[await imageKey(icon)] = icon;
    const keys = new Map(
        Object.entries(images).map(([key, url]) => [url, key]),
    );
    const styles: unknown[] = [];
    const indices = new Map<string, number>();
    const mac = describeMacros(
        macros,
        (url) => keys.get(url)!,
        (style) => {
            const json = JSON.stringify(style);
            if (!indices.has(json)) indices.set(json, styles.push(style) - 1);
            return indices.get(json)!;
        },
    );
    folders.forEach((folder, index) => {
        if (folder.length) mac[index].d = folder;
    });
    return {
        dgo: 1,
        v: { o: [400, 300], u: 40, w: 800, h: 600 },
        o: [],
        mac,
        ...(styles.length && { st: styles }),
        ...(keys.size && { img: images }),
    };
}

// The library shipped with DocGeo, in the editor's language; empty where
// the page has none.
export async function suppliedLibrary(): Promise<Library> {
    const response = await fetch(new URL(`macros/${LANG}.dgo`, location.href));
    if (!response.ok) return emptyLibrary();
    return readLibrary(await dgoJson(await response.blob()));
}

// ************************** MY MACROS ***************************

// In the browser's storage, which may refuse access, or lose them.
const STORAGE = "docgeo-macros";

export function myMacros(): Library {
    let stored: string | null = null;
    try {
        stored = localStorage.getItem(STORAGE);
    } catch {
        return emptyLibrary();
    }
    return stored ? readLibrary(JSON.parse(stored)) : emptyLibrary();
}

export async function keepMyMacros(library: Library): Promise<void> {
    const json = JSON.stringify(await describeLibrary(library));
    try {
        localStorage.setItem(STORAGE, json);
    } catch {
        // Refused, or full: they last until the page closes.
    }
}

// Mine, but for the copies of macros of the library, which serve others.
export const shownMacros = (mine: Library, supplied: Library): number[] =>
    mine.macros.flatMap((macro, index) => {
        const twin = supplied.macros.find(({ name }) => name === macro.name);
        return twin && sameMacro(mine.macros, macro, supplied.macros, twin)
            ? []
            : [index];
    });

// ************************** MERGING *****************************

// A body's applications of macros, the macro named rather than indexed,
// which compares macros of different libraries.
function named(macros: Macro[], macro: Macro): Macro {
    return {
        ...macro,
        methods: macro.methods.map((method) => ({
            ...method,
            body: method.body.map((entry) => {
                if (entry[0] !== "Mac") return entry;
                const [index, ...rest] = entry[2] as unknown[];
                return [
                    entry[0],
                    entry[1],
                    [macros[index as number].name, ...rest],
                    ...entry.slice(3),
                ];
            }),
        })),
    };
}

// The names of the macros its bodies apply.
const applied = (macro: Macro): string[] =>
    macro.methods.flatMap(({ body }) =>
        body.flatMap(([tag, , parameters]) =>
            tag === "Mac" ? [(parameters as unknown[])[0] as string] : [],
        ),
    );

export const sameMacro = (
    one: Macro[],
    a: Macro,
    other: Macro[],
    b: Macro,
): boolean => JSON.stringify(named(one, a)) === JSON.stringify(named(other, b));

// The macros of `from` named, and those they apply, that are in `into`
// with another definition.
export function conflicts(
    into: Library,
    from: Library,
    names: string[],
): string[] {
    const found: string[] = [];
    const seen = new Set<string>();
    const visit = (name: string): void => {
        if (seen.has(name)) return;
        seen.add(name);
        const macro = from.macros.find((other) => other.name === name)!;
        const there = into.macros.find((other) => other.name === name);
        if (there && sameMacro(into.macros, there, from.macros, macro)) return;
        if (there) found.push(name);
        applied(named(from.macros, macro)).forEach(visit);
    };
    names.forEach(visit);
    return found;
}

export interface Merge {
    library: Library;
    // Where each macro of `into` now is.
    indices: number[];
    // Whether a macro of `into` was replaced, or moved.
    rewritten: boolean;
}

// The macros of `from` named, and those they apply, added to `into`; one
// of the same name there kept, unless `replace` and it differs. A macro
// comes after those it applies, which may move one replaced.
export function merge(
    into: Library,
    from: Library,
    names: string[],
    replace: boolean,
): Merge {
    type Entry = { macro: Macro; folder: string[]; at: number };
    const entries = new Map<string, Entry>(
        into.macros.map((macro, at) => [
            macro.name,
            { macro: named(into.macros, macro), folder: into.folders[at], at },
        ]),
    );
    let rewritten = false;
    const take = (name: string): void => {
        const at = from.macros.findIndex((other) => other.name === name);
        const macro = named(from.macros, from.macros[at]);
        const there = entries.get(name);
        if (
            there &&
            (!replace || JSON.stringify(there.macro) === JSON.stringify(macro))
        )
            return;
        entries.set(name, {
            macro,
            folder: there?.folder ?? from.folders[at] ?? [],
            at: there?.at ?? -1,
        });
        if (there) rewritten = true;
        applied(macro).forEach(take);
    };
    names.forEach(take);
    const order: string[] = [];
    const placed = (name: string): void => {
        if (order.includes(name)) return;
        applied(entries.get(name)!.macro).forEach(placed);
        order.push(name);
    };
    entries.forEach((_, name) => placed(name));
    const position = new Map(order.map((name, index) => [name, index]));
    const macros = order.map((name) => {
        const { macro, at } = entries.get(name)!;
        const indexed: Macro = {
            ...macro,
            methods: macro.methods.map((method) => ({
                ...method,
                body: method.body.map((entry) => {
                    if (entry[0] !== "Mac") return entry;
                    const [ref, ...rest] = entry[2] as unknown[];
                    return [
                        entry[0],
                        entry[1],
                        [position.get(ref as string), ...rest],
                        ...entry.slice(3),
                    ];
                }),
            })),
        };
        const original = into.macros[at];
        return original && JSON.stringify(original) === JSON.stringify(indexed)
            ? original
            : indexed;
    });
    const indices = into.macros.map(({ name }) => position.get(name)!);
    return {
        library: {
            macros,
            folders: order.map((name) => entries.get(name)!.folder),
        },
        indices,
        rewritten: rewritten || indices.some((index, at) => index !== at),
    };
}

// Without the macros that only serve others, but for those named.
export const pruned = (library: Library, names: string[]): Library =>
    merge(emptyLibrary(), library, names, false).library;
