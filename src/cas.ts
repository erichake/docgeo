import { CasCache } from "./cas_cache";
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

// What a formula of the object computed reads (see objects_collector).
export const readCas = (site: object, request: string) =>
    cas.read(site, request, reading.object ?? undefined);
