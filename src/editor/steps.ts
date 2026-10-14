import type { construction } from "../construction";
import { figureObjects } from "../dgo";
import type { construction_object } from "../objects/construction_object";

// Step by step, as GeoGebra's navigation bar: see EDITOR.md. The objects of
// the steps after the one shown are hidden in the figure, not in the figure
// saved (`withHidden`).

export interface Stepping {
    at: number;
    later: Set<construction_object>;
}

// Each object shown is a step, the hidden ones going with the step before
// them.
export const steps = (c: construction, later: Set<construction_object>) =>
    figureObjects(c).filter(
        (object) => object.hidden === 0 || later.has(object),
    );

// The figure at step `at`, bounded by the steps there are.
export function showStep(
    c: construction,
    later: Set<construction_object>,
    at: number,
): Stepping {
    const all = steps(c, later);
    at = Math.max(Math.min(at, all.length), Math.min(1, all.length));
    const hidden = new Set(all.slice(at));
    all.forEach((object) => {
        const value = hidden.has(object) ? 1 : 0;
        if (object.hidden === value) return;
        object.hidden = value;
        if (value) object.updateView();
        else object.createSVG();
    });
    c.flush();
    return { at, later: hidden };
}

// The step that shows the object.
export function stepOf(
    c: construction,
    { later }: Stepping,
    object: construction_object,
): number {
    const objects = figureObjects(c);
    const at = objects.indexOf(object);
    const shown = new Set(steps(c, later));
    return Math.max(
        1,
        objects.slice(0, at + 1).filter((step) => shown.has(step)).length,
    );
}
