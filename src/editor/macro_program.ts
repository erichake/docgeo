import type { construction } from "../construction";
import { figureObjects, privateConstruction, readEntries } from "../dgo";
import { $, type DOMElement } from "../dom";
import {
    objectIndex,
    type construction_object,
} from "../objects/construction_object";
import {
    MACRO_TYPES,
    SUB_OBJECTS,
    macro_object,
} from "../objects/macro_object";
import { lineOf, nextName } from "./figure";
import type { Picked } from "./macro";
import { message, type MessageKey } from "./messages";
import { macroBadge } from "./my_macros";
import { formatName } from "./text";
import { choice, modal } from "./web_page";

// A macro's program shown, as the text language writes it (see MACROS.md,
// « Voir le programme »).

export interface ProgramLine {
    text: string;
    final: boolean;
    // The macro an application in the body applies.
    macro?: number;
}

export interface MethodProgram {
    // Each initial's name, with its sub-objects', and message.
    initials: { name: string; parts: string[]; message: string }[];
    lines: ProgramLine[];
}

// The kind of name an initial not designated yet takes.
const KINDS: Record<string, true | string> = {
    point: true,
    line: "Line",
    ray: "Ray",
    segment: "Seg",
    vector: "Vec",
    circle: "Cir",
    arc: "Arc",
    conic: "Quad",
    polygon: "Poly",
    plane: "Pl",
    sphere: "Sph",
    angle: "Ang",
    number: "Ex",
};

// The body of one of its methods, read apart from the figure, on the
// initials designated, or on objects standing for them, named as the
// editor names those it makes.
export function methodProgram(
    c: construction,
    index: number,
    method: number,
    picked: Picked[],
): MethodProgram {
    const { initials, body, finals } = c.macros[index].methods[method];
    const designated = picked.every(
        (initial, rank) =>
            rank < initials.length &&
            (typeof initial === "string"
                ? initials[rank][0] === "number"
                : MACRO_TYPES[initials[rank][0]](initial)),
    )
        ? picked
        : [];
    const used = new Set([
        ...body.map(([, name]) => name as string),
        ...designated.map((initial) =>
            typeof initial === "string" ? "" : initial.name,
        ),
    ]);
    const naming = Object.create(c, {
        getObj: { value: (name: string) => used.has(name) || c.getObj(name) },
    }) as construction;
    const fresh = (kind: true | string): string => {
        const name = nextName(naming, kind);
        used.add(name);
        return name;
    };
    const objects = figureObjects(c);
    const entries: unknown[][] = [];
    // Its position among the objects read.
    const entry = (tag: string, name: string, parameters: unknown): number =>
        objects.length + entries.push([tag, name, parameters]) - 1;
    let hidden = 0;
    const point = (named: boolean): number => {
        const angle = 2.4 * entries.length;
        return entry("Pt", named ? fresh(true) : `‧${hidden++}`, [
            3 * Math.cos(angle),
            3 * Math.sin(angle),
        ]);
    };
    const points = (count: number, named = false): number[] =>
        Array.from({ length: count }, () => point(named));
    const references = initials.map(([type], rank) => {
        const initial = designated[rank];
        if (typeof initial === "string") return initial;
        if (initial)
            return objectIndex(initial, (owner) => objects.indexOf(owner));
        if (type === "point") return point(true);
        if (type === "number")
            return entry("Ex", fresh("Ex"), { t: "", v: 1, xy: [0, 0] });
        const kind = KINDS[type] as string;
        const parameters =
            type === "segment" || type === "vector" || type === "angle"
                ? points(type === "angle" ? 3 : 2, true)
                : type === "ray" || type === "sphere"
                  ? [point(true), point(false)]
                  : points(
                        { arc: 3, conic: 5, polygon: 3, plane: 3 }[type] ?? 2,
                    );
        return entry(kind, fresh(kind), parameters);
    });
    entry("Mac", "‧mac", [index, method, references]);
    const read = [...objects];
    readEntries(
        {
            c: privateConstruction(c, []),
            root: c,
            macros: c.macros,
            images: {},
            offset: [0, 0],
        },
        read,
        entries,
        () => ({}),
    );
    const { local } = read.at(-1) as macro_object;
    let slot = 0;
    const shown = initials.map(([type, text], rank) => {
        const count = SUB_OBJECTS[type] ?? 0;
        const parts = local.slice(slot, slot + count);
        // A circle's center, an arc's ends, made by the application.
        if (type === "circle" || type === "arc")
            parts.forEach((part) => (part.name = fresh(true)));
        const initial = local[slot + count];
        slot += count + 1;
        // A number typed.
        const typed = designated[rank];
        if (typeof typed === "string") initial.name = fresh("Ex");
        return {
            name:
                formatName(initial.name) +
                (typeof typed === "string" ? ` = ${typed}` : ""),
            parts: parts.map(({ name }) => formatName(name)),
            message: text || message(`designate_${type}` as MessageKey),
        };
    });
    const positions = new Map(local.map((object, at) => [object, at]));
    const ends = new Set(finals.map((final) => local[final]));
    const lines: ProgramLine[] = [];
    // One line for an application's finals, as in the construction.
    const applications = new Map<construction_object, ProgramLine>();
    local.slice(slot).forEach((object) => {
        if (object instanceof macro_object) return;
        const node = object.output?.node as macro_object | undefined;
        const line = node && applications.get(node);
        if (line) {
            line.final ||= ends.has(object);
            return;
        }
        const made: ProgramLine = {
            text:
                lineOf(object, positions, local) ??
                `${formatName(object.name)} = …`,
            final: ends.has(object),
            macro: node && c.macros.indexOf(node.macro),
        };
        if (node) applications.set(node, made);
        lines.push(made);
    });
    return { initials: shown, lines };
}

// Its program, method by method, on the initials designated: an
// application in it shows that of its macro, the names above lead back.
export function showMacroProgram(
    c: construction,
    index: number,
    picked: Picked[],
): void {
    const trail = [index];
    const content = $.create("div").cls("dge-program");
    const close = choice("close", true).att("type", "button");
    const element = modal(
        "",
        content,
        $.create("div").cls("dge-dialog-buttons").add(close),
    );
    element.classList.add("dge-program-dialog");
    const title = $(element).find("h2")!.cls("dge-program-title");
    close.on("click", () => element.close(), false);

    const code = (text: string, muted = false): DOMElement =>
        $.create("code")
            .cls(muted ? "dge-program-muted" : "")
            .att("dir", "ltr")
            .text(text);

    function lineRow(line: ProgramLine): DOMElement {
        if (line.macro === undefined)
            return $.create("div")
                .cls(
                    line.final
                        ? "dge-program-line dge-final"
                        : "dge-program-line",
                )
                .att("dir", "ltr")
                .text(line.text);
        const row = $.create("button")
            .att("type", "button")
            .cls(
                line.final
                    ? "dge-program-line dge-program-call dge-final"
                    : "dge-program-line dge-program-call",
            )
            .att("dir", "ltr")
            .att("title", message("macro_program"))
            .text(line.text);
        row.on(
            "click",
            () => {
                trail.push(line.macro!);
                show();
            },
            false,
        );
        return row;
    }

    function methodSection(shown: number, rank: number): DOMElement[] {
        const { methods } = c.macros[shown];
        const { help } = methods[rank];
        const { initials, lines } = methodProgram(
            c,
            shown,
            rank,
            trail.length === 1 ? picked : [],
        );
        return [
            ...(methods.length > 1
                ? [$.create("h3").text(message("macro_method", `${rank + 1}`))]
                : []),
            ...(help
                ? [
                      $.create("p")
                          .cls("dge-dialog-note")
                          .att("dir", "auto")
                          .text(help),
                  ]
                : []),
            $.create("h4").text(message("macro_initials")),
            ...initials.map(({ name, parts, message: text }, at) =>
                $.create("div")
                    .cls("dge-program-initial")
                    .add(
                        $.create("span")
                            .cls("dge-program-rank")
                            .text(`${at + 1}`),
                        code(name),
                        ...(parts.length
                            ? [code(`(${parts.join(", ")})`, true)]
                            : []),
                        $.create("span").att("dir", "auto").text(text),
                    ),
            ),
            $.create("h4").text(`${message("construction")} · ${lines.length}`),
            $.create("div")
                .cls("dge-program-lines")
                .add(...lines.map(lineRow)),
        ];
    }

    function show(): void {
        const shown = trail.at(-1)!;
        title.inner("").add(macroBadge(c.macros[shown]));
        trail.forEach((at, depth) => {
            const name = formatName(c.macros[at].name);
            if (depth)
                title.add($.create("span").cls("dge-program-sep").text("›"));
            if (depth === trail.length - 1)
                return void title.add($.create("span").text(name));
            const back = $.create("button")
                .att("type", "button")
                .cls("dge-program-back")
                .text(name);
            back.on(
                "click",
                () => {
                    trail.length = depth + 1;
                    show();
                },
                false,
            );
            title.add(back);
        });
        content
            .inner("")
            .add(
                ...c.macros[shown].methods.flatMap((_, rank) =>
                    methodSection(shown, rank),
                ),
            );
        content.dom().scrollTop = 0;
    }

    show();
}
