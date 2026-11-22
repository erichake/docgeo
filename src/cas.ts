import { CasCache, type CasResult } from "./cas_cache";
import { answerCas } from "./import/dgp_formula";
import { $ } from "./dom";
import type { construction_object } from "./objects/construction_object";
import { reading } from "./sheet";

// Within a few seconds, like GeoGebra's.
const TIMEOUT = 5000;

type Giac = { eval(request: string): Promise<{ value: string }> };
let giac: Promise<Giac> | undefined;

// Beside DocGeo's page, as DocTools serves its applications (see CAS.md).
export const cas = new CasCache<construction_object>(
    async (request) => {
        giac ??= import(
            /* @vite-ignore */ new URL("../giac/giac_host.js", document.baseURI)
                .href
        ).then(({ createGiac }) => createGiac({ timeout: TIMEOUT }));
        return (await (await giac).eval(request)).value;
    },
    (objects) =>
        objects.forEach((object) => object.C.invalidateGeometry(object)),
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
answerCas(readCas);

// The answers the objects read, for their .dgo.
export function casAnswers(
    objects: construction_object[],
): Record<string, CasResult> | undefined {
    const answers: Record<string, CasResult> = {};
    objects.forEach((object) =>
        requests.get(object)?.forEach((request) => {
            const answer = cas.answer(request);
            if (answer !== undefined) answers[request] = answer;
        }),
    );
    return Object.keys(answers).length ? answers : undefined;
}
