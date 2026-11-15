import type { construction } from "./construction";
import { executeDgpCommands } from "./import/dgp_commands";
import {
    translateGgb,
    type GgbImage,
    type GgbView3D,
} from "./import/ggb_translate";
import { readZipBlob, readZipEntry } from "./import/ggb_zip";
import { expression_object } from "./objects/expression_object";
import type { formula_point_object } from "./objects/formula_point_object";
import { cylinder_intersection_object } from "./objects/cylinder_intersection_object";
import { intersection_object } from "./objects/intersection_object";
import { point_object } from "./objects/point_object";
import { point_on_object } from "./objects/point_on_object";
import type { construction_object } from "./objects/construction_object";
import { projectPoint } from "./projection";
import { vAdd, vNorm, vScale, vSub, type Vec3 } from "./vec";
import { bandBackground } from "./background";

// Returns what the figure uses that couldn't be imported.
export function importGgb(
    c: construction,
    xml: string,
    images?: Map<string, GgbImage>,
    macros?: string,
): string[] {
    const {
        calls,
        targets,
        handles,
        follows,
        nameShifts,
        menus,
        animations,
        rates,
        startAnimation,
        unsupported,
        is3D,
        view3D,
    } = translateGgb(xml, images, macros);
    // First, since sliders are placed with the camera's unit.
    if (view3D) applyView3D(c, view3D);
    c.segmentsOverPolygons = true;
    const executed = executeDgpCommands(c, calls, is3D);
    const variables = executed.variables;
    // Built without its choices: rebuilt with them.
    menus.forEach((choices, variable) => {
        const expression = variables.get(variable) as expression_object;
        expression.menu = choices;
        if (!expression.isHidden) expression.createSVG();
    });
    handles.forEach((numbers, variable) =>
        (variables.get(variable) as formula_point_object).setHandles(
            numbers.map(
                (number) =>
                    number && (variables.get(number) as expression_object),
            ) as [expression_object | null, expression_object | null],
        ),
    );
    follows.forEach((point, variable) =>
        (variables.get(variable) as formula_point_object).setFollows(
            variables.get(point) as point_object,
        ),
    );
    settleTargets(
        c,
        new Map(
            [...targets].map(([variable, coords]) => [
                variables.get(variable)!,
                coords,
            ]),
        ),
    );
    c.flush();
    // A point's name in pixels from it, another object's where GeoGebra
    // writes it, kept relative to it.
    nameShifts.forEach((shift, variable) => {
        const object = variables.get(variable);
        const at = object?.nameAt();
        if (
            object instanceof point_object ||
            object instanceof expression_object
        )
            object.nameOffset = [...shift];
        else if (at) object!.nameOffset = object!.anchorName(vAdd(at, shift));
    });
    rates.forEach(
        (rate, variable) =>
            (animations.get(variable)!.rate = variables.get(
                rate,
            ) as expression_object),
    );
    animations.forEach((animation, variable) =>
        c.animations.add(
            variables.get(variable) as point_on_object | expression_object,
            animation,
        ),
    );
    if (!startAnimation) c.animations.paused = true;
    // Also redraws each object whose show condition, defined after it,
    // wasn't evaluated yet when it was first drawn.
    c.invalidateProjection();
    return [...unsupported, ...executed.unsupported];
}

export async function importGgbFromUrl(
    c: construction,
    url: string,
): Promise<string[]> {
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`Unable to load GGB file: ${response.status}`);
    return importGgbFromBlob(c, await response.blob());
}

export async function importGgbFromBlob(
    c: construction,
    file: Blob,
): Promise<string[]> {
    const data = await file.arrayBuffer();
    const xml = await readZipEntry(data, "geogebra.xml");
    const images = new Map<string, GgbImage>();
    const files = new DOMParser()
        .parseFromString(xml, "application/xml")
        .querySelectorAll("element[type='image'] > file");
    for (const file of files) {
        const name = file.getAttribute("name") ?? "";
        const type = IMAGE_TYPES[name.split(".").pop()!.toLowerCase()];
        if (!type || images.has(name)) continue;
        // A missing or broken image is only left out, as unsupported.
        try {
            const blob = new Blob([await readZipBlob(data, name)], { type });
            const url = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            const image = new Image();
            image.src = url;
            await image.decode();
            images.set(name, {
                url,
                width: image.naturalWidth,
                height: image.naturalHeight,
            });
        } catch {}
    }
    // The user-defined tools, if the figure has any.
    const macros = await readZipEntry(data, "geogebra_macro.xml").catch(
        () => undefined,
    );
    return importGgb(c, xml, images, macros);
}

const IMAGE_TYPES: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
};

function applyView3D(c: construction, view: GgbView3D): void {
    const grid = c.GRID;
    grid.PHI = view.phi;
    grid.THETA = view.theta;
    grid.UNIT = [view.unit, view.unit, view.unit];
    grid.pivot = vScale(view.offset, -1);
    if (view.band)
        Object.assign(
            c.prefs.background,
            bandBackground(view.band.color, view.band.inset),
        );
    grid.ORG = projectPoint(view.offset, {
        origin: [c.width / 2 + view.shift[0], c.height / 2 + view.shift[1]],
        unit: grid.UNIT,
        cosPhi: Math.cos(view.phi),
        sinPhi: Math.sin(view.phi),
        cosTheta: Math.cos(view.theta),
        sinTheta: Math.sin(view.theta),
    });
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
        } else if (
            object instanceof intersection_object ||
            object instanceof cylinder_intersection_object
        ) {
            const order = object.order;
            const distance = object.defined
                ? vNorm(vSub(object.coords, coords))
                : Infinity;
            object.order = order === 0 ? 1 : 0;
            object.computeGeometry();
            if (
                !object.defined ||
                vNorm(vSub(object.coords, coords)) >= distance
            ) {
                object.order = order;
                object.computeGeometry();
            }
        }
    });
}
