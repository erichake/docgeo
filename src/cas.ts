import { CasCache, type CasResult } from "./cas_cache";
import { answerCas } from "./import/dgp_formula";
import { $ } from "./dom";
import type { construction } from "./construction";
import type { construction_object } from "./objects/construction_object";
import { reading } from "./sheet";

// Within a few seconds, like GeoGebra's.
const TIMEOUT = 5000;

type Giac = { eval(request: string): Promise<{ value: string }> };
let giac: Promise<Giac> | undefined;

// Beside DocGeo's page, as DocTools serves its applications (see CAS.md).
// Its readers: objects, or a computer algebra view's lines.
export const cas = new CasCache<construction_object | (() => void)>(
    async (request) => {
        giac ??= import(
            /* @vite-ignore */ new URL("../giac/giac_host.js", document.baseURI)
                .href
        ).then(({ createGiac }) => createGiac({ timeout: TIMEOUT }));
        return (await (await giac).eval(request)).value;
    },
    (readers) =>
        readers.forEach((reader) =>
            typeof reader === "function"
                ? reader()
                : reader.C.invalidateGeometry(reader),
        ),
    // Its message, in no language: it is a name.
    () =>
        $("body").append(
            `<div style="position:fixed;left:8px;bottom:8px;font:13px sans-serif;opacity:.6;pointer-events:none">⚠ Giac</div>`,
        ),
);

// The request each object last read at each site, whose answer its figure
// keeps.
const requests = new WeakMap<construction_object, Map<object, string>>();

// What a formula of the object computed or drawn reads (see
// objects_collector).
export function readCas(site: object, request: string) {
    const { object } = reading;
    if (object)
        (
            requests.get(object) ?? requests.set(object, new Map()).get(object)!
        ).set(site, request);
    return cas.read(site, request, object ?? undefined);
}

let prover: typeof import("./import/locus_equation") | undefined;

// Prove's answer: true where Giac finds the predicate's polynomial in the
// ideal of the construction's, but for degenerate cases, false where its
// elimination leaves nothing (see locus_equation.ts).
function prove(site: object, fn: string, objects: construction_object[]) {
    const { object } = reading;
    if (!prover) {
        void import("./import/locus_equation").then((module) => {
            prover = module;
            if (object) object.C.invalidateGeometry(object);
        });
        return null;
    }
    const request = prover.proveRequest(fn, objects);
    const answer = request && readCas(site, request);
    return typeof answer === "string" && answer.startsWith("[[")
        ? +!answer.includes("[]")
        : null;
}
answerCas(readCas, prove);

// The answers the objects and the computer algebra views read, for their
// .dgo.
export function casAnswers(
    c: construction,
    objects: construction_object[],
): Record<string, CasResult> | undefined {
    const answers: Record<string, CasResult> = {};
    [
        ...objects.flatMap((object) => [
            ...(requests.get(object)?.values() ?? []),
        ]),
        ...c.views.flatMap((view) => view.cas?.requests ?? []),
    ].forEach((request) => {
        const answer = cas.answer(request);
        if (answer !== undefined) answers[request] = answer;
    });
    return Object.keys(answers).length ? answers : undefined;
}

// Its computer algebra views, shown by a module loaded when a figure first
// has one (see cas_view.ts).
let views: Promise<typeof import("./cas_view")> | undefined;

export function showCas(c: construction): void {
    if (views || c.views.some((view) => view.cas))
        void (views ??= import("./cas_view")).then((module) => module.show(c));
}

export const hideCas = (c: construction): void =>
    void views?.then((module) => module.hide(c));
