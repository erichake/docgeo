import type { construction } from "../construction";
import { figureObjects } from "../dgo";
import type { construction_object } from "../objects/construction_object";

// The eraser, as in DGPad: see EDITOR.md. Its ghosts, the objects it hides,
// stay shown, pale, and are hidden only in the figure saved.

// The hidden objects as ghosts, but the super-hidden ones (DGPad's macro
// internals, GeoGebra's auxiliary objects), which nobody ever saw.
export function showGhosts(c: construction): Set<construction_object> {
    const ghosts = new Set(
        figureObjects(c).filter(({ hidden }) => hidden === 1),
    );
    ghosts.forEach((ghost) => {
        ghost.hidden = 0;
        ghost.updateView();
        ghost.dom.addClass("dge-ghost");
    });
    return ghosts;
}

export function toggleGhost(
    ghosts: Set<construction_object>,
    object: construction_object,
): void {
    if (!ghosts.delete(object)) ghosts.add(object);
    object.dom.toggleClass("dge-ghost", ghosts.has(object));
}

export function hideGhosts(ghosts: Set<construction_object>): void {
    ghosts.forEach((ghost) => {
        ghost.hidden = 1;
        ghost.updateView();
    });
}

// What `write` makes of the figure, the objects hidden (1) or shown (0)
// meanwhile, as the ghosts are hidden in the figure saved.
export async function withHidden<T>(
    objects: Iterable<construction_object>,
    hidden: number,
    write: () => Promise<T>,
): Promise<T> {
    const changed = [...objects];
    changed.forEach((object) => (object.hidden = hidden));
    const result = await write();
    changed.forEach((object) => (object.hidden = 1 - hidden));
    return result;
}
