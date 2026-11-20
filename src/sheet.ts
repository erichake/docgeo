import type { construction } from "./construction";
import { $, type DOMElement } from "./dom";
import { LANG } from "./i18n";
import {
    FormulaLexer,
    readExternal,
    type ScriptValue,
    type Token,
} from "./import/dgp_formula";
import type { construction_object } from "./objects/construction_object";

// A page's DocCells workbook, shown by its sheet view (see TABLEUR.md):
// a single DocCells iframe for the window, made when first needed, then
// moved over the sheet view of the figure shown, never in the DOM, which
// would reload it.

export type Archive = Record<string, unknown>;

type Event = Record<string, never>;
type HostValue = string | number | boolean | null;
interface DocCells {
    load(workbook: Archive): Promise<unknown>;
    save(): Archive;
    on(event: string, listener: (event: Event) => void): unknown;
    subscribe(ref: string): { subscription: number; values: unknown[][] };
    unsubscribe(subscription: number): unknown;
    hostNames(): string[];
    hostDependencies(ref: string): string[];
    setHostValues(updates: { name: string; v: HostValue }[]): {
        values: Event[];
    };
}

// Its message where DocCells can't be shown, in no language: it is a name.
$("head").append(
    `<style>.docgeo-sheet{position:absolute;display:grid;place-items:center}.docgeo-sheet>iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.docgeo-sheet:not(.on)>iframe{visibility:hidden}.docgeo-sheet.failed::before{content:"⚠ DocCells"}</style>`,
);

let frame: DOMElement | null = null;
let cells: DocCells | null = null;
// The figure whose sheet view shows the frame, the one whose workbook it
// holds, and that workbook as last loaded or saved.
let shown: construction | null = null;
let holder: construction | null = null;
let held = "";
let loading = false;

// The object being computed, whose formulas read cells (see readCells).
export const reading: { object: construction_object | null } = {
    object: null,
};
// The values of the cells the holder's figure reads, by reference, each
// with its subscription and the names of the GEO formulas its cells read,
// directly or not, and the objects that read cells, with their references.
const values = new Map<string, ScriptValue | null | undefined>();
const subscriptions = new Map<number, string>();
const dependencies = new Map<string, string[]>();
const readers = new Map<construction_object, Set<string>>();
// The names the workbook's GEO formulas read, and the values given to them.
let names: string[] = [];
const given = new Map<string, HostValue>();
// The references that close a cycle, by object and reference, as written.
export const cycles = new Map<string, string>();

// Under the figure's views and the editor's panels, which come after it.
function createFrame(c: construction): DOMElement {
    const iframe = $.create("iframe").att(
        "src",
        `../doccells/index.html?embed&lang=${LANG}${c.dgpad.editor ? "" : "&mode=student"}`,
    );
    const element = iframe.dom() as HTMLIFrameElement;
    const box = $.create("div").cls("docgeo-sheet").add(iframe);
    document.body.prepend(box.dom());
    // DocCells missing: no message from it once loaded.
    iframe.on(
        "load",
        () => setTimeout(() => cells || box.addClass("failed"), 10000),
        false,
    );
    window.addEventListener("message", ({ source, data }) => {
        if (
            cells ||
            source !== element.contentWindow ||
            data?.event !== "ready"
        )
            return;
        try {
            cells = (element.contentWindow as { docCells?: DocCells })
                .docCells!;
        } catch {
            // Served from another origin.
        }
        if (!cells) return void box.addClass("failed");
        cells.on("save", () => shown?.dgpad.saveFigure?.());
        cells.on("change", () => {
            rescan();
            shown?.dgpad.sheetChanged?.();
        });
        cells.on("hostNamesChanged", (event) => rescan(event.names));
        cells.on("sheetRenamed", ({ oldName, newName }) =>
            shown?.dgpad.sheetRenamed?.(oldName, newName),
        );
        cells.on("values", (event) => receive([event]));
        void sync();
    });
    return box;
}

// Over the sheet view of the figure shown, where its svg is (a column, or
// its part of a web page's region, see fit.ts), with its workbook, if it
// has one.
export function showSheet(c: construction): void {
    const view = c.views.find(({ sheet }) => sheet);
    shown = view ? c : null;
    if (!view) return void frame?.hide();
    frame ??= createFrame(c);
    const { style } = view.svg.dom() as SVGElement;
    frame
        .att(
            "style",
            `left:${style.left};top:${style.top};width:${style.width};height:${style.height}`,
        )
        .toggleClass("on", holder === c);
    void sync();
}

export function hideSheet(c: construction): void {
    if (shown !== c) return;
    shown = null;
    frame!.hide();
}

// The workbook of the figure shown loaded, unless the frame holds it: a
// figure rebuilt from the description of the one it replaces shows it as
// it is. One refused (malformed, from a later version) leaves the message
// instead, the figure keeping its archive.
async function sync(): Promise<void> {
    const c = shown;
    if (!cells || loading || !c || holder === c) return;
    const text = JSON.stringify(c.workbook);
    if (text !== held) {
        loading = true;
        held = text;
        holder = null;
        subscriptions.forEach((_, subscription) =>
            cells!.unsubscribe(subscription),
        );
        subscriptions.clear();
        values.clear();
        dependencies.clear();
        given.clear();
        let failed = false;
        try {
            await cells.load(c.workbook!);
            names = cells.hostNames();
        } catch {
            failed = true;
        }
        loading = false;
        frame!.toggleClass("failed", failed);
        // Asked to load again meanwhile (see restoreSheet).
        const restored = held !== text;
        if (failed) held = "";
        if (shown !== c || restored) return sync();
        if (failed) return;
    }
    holder = c;
    frame!.addClass("on");
    cycles.clear();
    provide(c);
    reread();
}

// Loaded again as it was (see the editor's sheetCycle and the embedded
// mode's reset).
export function restoreSheet(c: construction, workbook: Archive) {
    c.workbook = workbook;
    held = "";
    holder = null;
    return sync();
}

// The objects that read cells computed again, as after a gesture: those
// that read these references, or all.
function reread(refs?: Set<string>): void {
    readers.forEach((read, object) => {
        if (object.C !== holder) readers.delete(object);
        else if (!refs || [...read].some((ref) => refs.has(ref)))
            holder.invalidateGeometry(object);
    });
}

function receive(changes: Event[]): void {
    const refs = new Set<string>();
    changes.forEach(({ subscription, values: rows }) => {
        const ref = subscriptions.get(subscription);
        if (ref === undefined) return;
        values.set(ref, value(rows));
        refs.add(ref);
    });
    reread(refs);
}

// After the user changed cells: what each reference depends on read again,
// the formula of a cell that closes a cycle signalled.
function rescan(list?: string[]): void {
    const c = holder;
    if (!c) return;
    if (list) names = list;
    subscriptions.forEach((ref) => {
        try {
            dependencies.set(ref, cells!.hostDependencies(ref));
        } catch {
            // Its sheet deleted.
            dependencies.delete(ref);
        }
    });
    const before = new Set(cycles.keys());
    cycles.clear();
    provide(c);
    reread();
    c.flush();
    const closed = [...cycles].find(([key]) => !before.has(key));
    if (closed) c.dgpad.sheetCycle?.(closed[1]);
}

const targets = new Map<string, Token | null>();

// The object a GEO formula names (see TABLEUR.md), as a formula of the
// figure names it: of its page, or of another.
function target(name: string): Token | null {
    let token = targets.get(name);
    if (token === undefined) {
        const lexer = new FormulaLexer(name);
        try {
            token = lexer.next();
            if (lexer.next().type !== "eof") token = null;
        } catch {
            token = null;
        }
        targets.set(name, token);
    }
    return token;
}

const local = (c: construction, token: Token | null) =>
    token?.type === "identifier" ? c.getObj(token.value as string) : undefined;

// What a formula reads naming it, if it is a number, a text or a boolean.
function hostValue(c: construction, token: Token | null): HostValue {
    const v =
        token?.type === "external"
            ? readExternal(token.page!, token.value as string)
            : local(c, token)?.scriptValue(c.space);
    return typeof v === "string" ||
        typeof v === "boolean" ||
        (typeof v === "number" && isFinite(v))
        ? v
        : null;
}

// The values of the objects GEO formulas name given to DocCells, those of
// `objects` or all, if they changed: the objects that read the cells it
// computes again then follow, in the same update.
export function provide(
    c: construction,
    objects?: construction_object[],
): void {
    if (c !== holder || !names.length) return;
    const outer = reading.object;
    reading.object = null;
    const touched = objects && new Set(objects.map(({ name }) => name));
    const updates = names.flatMap((name) => {
        const token = target(name);
        if (
            touched &&
            !(
                token?.type === "identifier" &&
                touched.has(token.value as string)
            )
        )
            return [];
        const v = hostValue(c, token);
        if (given.get(name) === v) return [];
        given.set(name, v);
        return [{ name, v }];
    });
    reading.object = outer;
    if (updates.length) receive(cells!.setHostValues(updates).values);
}

// Whether the cells depend on the object, through the objects their GEO
// formulas name, and the cells these read, directly or not.
function closes(object: construction_object, ref: string): boolean {
    const seen = new Set<construction_object>();
    const pending: construction_object[] = [];
    const named = (read: string) =>
        dependencies.get(read)?.forEach((name) => {
            const found = local(holder!, target(name));
            if (found) pending.push(found);
        });
    named(ref);
    while (pending.length) {
        const next = pending.pop()!;
        if (next === object) return true;
        if (seen.has(next)) continue;
        seen.add(next);
        pending.push(...next.parents);
        readers.get(next)?.forEach(named);
    }
    return false;
}

const CELLS = /^[A-Z]+\d+(:[A-Z]+\d+)?$/i;

// The value of cells of a sheet ("B3", "B2:B21") of the workbook of the
// figure computed, undefined if it has no such sheet: as DocCells gives
// it once it holds the workbook, else as last computed in its archive.
export function readCells(
    sheet: string,
    range: string,
): ScriptValue | null | undefined {
    const { object } = reading;
    const c = object ? object.C : shown;
    if (!c?.workbook || !CELLS.test(range)) return undefined;
    const ref = `'${sheet.replace(/'/g, "''")}'!${range}`;
    let read: ScriptValue | null | undefined;
    if (c !== holder) read = archiveCells(c.workbook, sheet, range);
    else {
        if (!values.has(ref))
            try {
                const subscribed = cells!.subscribe(ref);
                subscriptions.set(subscribed.subscription, ref);
                values.set(ref, value(subscribed.values));
                dependencies.set(ref, cells!.hostDependencies(ref));
            } catch {
                // No such sheet: a page's name.
                values.set(ref, undefined);
            }
        read = values.get(ref);
        // The reference that closes a cycle undefined.
        if (object && read !== undefined && closes(object, ref)) {
            cycles.set(`${object.name}\n${ref}`, `${sheet}!${range}`);
            read = null;
        }
    }
    if (object && read !== undefined)
        (
            readers.get(object) ?? readers.set(object, new Set()).get(object)!
        ).add(ref);
    return read;
}

// Their last computed values, saved in a workbook's archive, which comes
// from anywhere.
export function archiveCells(
    workbook: Archive,
    sheet: string,
    range: string,
): ScriptValue | null | undefined {
    const { sheets } = workbook;
    const found =
        Array.isArray(sheets) &&
        (sheets as { name?: unknown; celldata?: unknown }[]).find(
            (other) => other?.name === sheet,
        );
    if (!found || !CELLS.test(range)) return undefined;
    const [start, end = start] = range.split(":").map((cell) => {
        const [, letters, row] = /([A-Z]+)(\d+)/i.exec(cell)!;
        return [
            +row - 1,
            [...letters.toUpperCase()].reduce(
                (n, letter) => n * 26 + letter.charCodeAt(0) - 64,
                0,
            ) - 1,
        ];
    });
    const [r0, r1] = [start[0], end[0]].sort((a, b) => a - b);
    const [c0, c1] = [start[1], end[1]].sort((a, b) => a - b);
    // As DocCells, which refuses more.
    if ((r1 - r0 + 1) * (c1 - c0 + 1) > 10000) return null;
    const rows = Array.from({ length: r1 - r0 + 1 }, () =>
        Array<unknown>(c1 - c0 + 1).fill(null),
    );
    for (const cell of Array.isArray(found.celldata) ? found.celldata : []) {
        const { r, c, v } = Object(cell);
        if (r >= r0 && r <= r1 && c >= c0 && c <= c1)
            // A number typed is kept as its text.
            rows[r - r0][c - c0] =
                v?.ct?.t === "n" && typeof v.v === "string" ? +v.v : v?.v;
    }
    return value(rows);
}

const ERROR = /^(#[A-Z/0_]+[!?]?|DIV\/0)$/;

// A cell's value read by a formula: a boolean as 1 or 0, an empty cell or
// an error undefined.
const scalar = (v: unknown): ScriptValue | null =>
    typeof v === "boolean"
        ? +v
        : typeof v === "number" || (typeof v === "string" && !ERROR.test(v))
          ? v
          : null;

// A cell's, a row's or a column's as a list, a rectangle's as a list of
// rows (see TABLEUR.md), undefined in a list as NaN.
function value(rows: unknown[][] | null): ScriptValue | null {
    if (!rows) return null;
    const read = rows.map((row) => row.map(scalar));
    const list = (row: (ScriptValue | null)[]) => row.map((v) => v ?? NaN);
    return read.length * read[0].length === 1
        ? read[0][0]
        : read.length === 1
          ? list(read[0])
          : read[0].length === 1
            ? list(read.map(([v]) => v))
            : read.map(list);
}

// What the figure saves: the workbook as the user left it, if the frame
// holds it.
export function sheetArchive(c: construction): Archive {
    if (holder === c) held = JSON.stringify((c.workbook = cells!.save()));
    return c.workbook!;
}
