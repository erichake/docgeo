import type { construction } from "./construction";
import { executeDgpCommands } from "./import/dgp_commands";
import { translateGgb } from "./import/ggb_translate";
import { readZipEntry } from "./import/ggb_zip";
import { intersection_object } from "./objects/intersection_object";
import { point_on_object } from "./objects/point_on_object";
import type { construction_object } from "./objects/construction_object";
import { vNorm, vSub, type Vec3 } from "./vec";

// Returns what the figure uses that couldn't be imported.
export function importGgb(c: construction, xml: string): string[] {
    const { calls, targets, unsupported } = translateGgb(xml);
    const variables = executeDgpCommands(c, calls);
    settleTargets(
        c,
        new Map(
            [...targets].map(([variable, coords]) => [
                variables.get(variable)!,
                coords,
            ]),
        ),
    );
    return unsupported;
}

export async function importGgbFromUrl(
    c: construction,
    url: string,
): Promise<string[]> {
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`Unable to load GGB file: ${response.status}`);
    return importGgb(
        c,
        await readZipEntry(await response.arrayBuffer(), "geogebra.xml"),
    );
}

// GeoGebra saves where each point on a path or intersection actually is,
// not a DGP-style parameter or branch index: one construction-order pass
// moves each onto its saved position, parents being already settled.
function settleTargets(
    c: construction,
    targets: Map<construction_object, Vec3>,
): void {
    if (targets.size === 0) return;
    // A conic×conic intersection follows its previous position (see
    // intersection_object.groupAssign), so seeding it with the saved one
    // selects the right root.
    targets.forEach((coords, object) => {
        if (object instanceof intersection_object) object.coords = coords;
    });
    c.OBJS.frame++;
    c.OBJS.V.forEach((object) => {
        object.computeGeometry();
        const coords = targets.get(object);
        if (!coords) return;
        if (
            object instanceof point_on_object &&
            object.support.familytype !== "locus"
        ) {
            const alpha = object.alphaFor(coords);
            if (alpha === null) return;
            object.alpha = alpha;
            object.computeGeometry();
        } else if (object instanceof intersection_object) {
            const order = object.order;
            const distance = vNorm(vSub(object.coords, coords));
            object.order = order === 0 ? 1 : 0;
            object.computeGeometry();
            if (vNorm(vSub(object.coords, coords)) >= distance) {
                object.order = order;
                object.computeGeometry();
            }
        }
    });
    c.invalidateProjection();
}
