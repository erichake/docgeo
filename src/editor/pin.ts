import type { construction_object } from "../objects/construction_object";
import type { point_object } from "../objects/point_object";
import { magnetizable } from "./magnets";

// DGPad's pushpin: see EDITOR.md.

// A free point of a plane figure: in DGPad's 3D ones, every free point is
// already pinned to the screen plane.
export const pinnable = (
    object: construction_object | null | undefined,
): object is point_object => magnetizable(object) && object.C.GRID.is2D;

export function togglePin(point: point_object): void {
    if (point.pinned) {
        point.pinned = null;
        point.readsView = false;
    } else point.pin();
}
