import type { construction } from "../construction";
import { figureObjects } from "../dgo";
import { point_object } from "../objects/point_object";
import type { Vec2 } from "../vec";

// The names of the points, dragged as in GeoGebra: see EDITOR.md.

const MARGIN = 3;
const MAX_DISTANCE = 80;

// The shown name under the pointer, in client pixels.
export function labelAt(c: construction, [x, y]: Vec2): point_object | null {
    for (const object of figureObjects(c)) {
        if (!(object instanceof point_object) || !object.isVisible) continue;
        const text = object.nameText?.dom();
        if (!text?.isConnected) continue;
        const box = text.getBoundingClientRect();
        if (
            box.width &&
            x >= box.left - MARGIN &&
            x <= box.right + MARGIN &&
            y >= box.top - MARGIN &&
            y <= box.bottom + MARGIN
        )
            return object;
    }
    return null;
}

const distance = (point: point_object): number =>
    point.nameDistance ?? 2 * point.size;

// The engine puts the name's box at `distance` from the point, in its
// direction: its center runs on an ellipse widened by half the box.
export function labelCenter(point: point_object): Vec2 {
    const d = distance(point);
    const width = point.nameText!.width();
    return [
        point.sx + Math.cos(point.namePosition) * (d + width / 2),
        point.sy - Math.sin(point.namePosition) * (d + point.fontSize / 2),
    ];
}

// The direction and distance that put the name's center at `center`, or
// as near as the name can be without covering the point.
export function placeLabel(point: point_object, center: Vec2): void {
    const [x, y] = [center[0] - point.sx, center[1] - point.sy];
    const [w, h] = [point.nameText!.width() / 2, point.fontSize / 2];
    const outside = (d: number) => (x / (d + w)) ** 2 + (y / (d + h)) ** 2;
    let [low, high] = [0, Math.hypot(x, y)];
    if (outside(0) <= 1) high = 0;
    for (let step = 0; step < 30 && high > low; step++) {
        const middle = (low + high) / 2;
        if (outside(middle) > 1) low = middle;
        else high = middle;
    }
    const d = Math.min(high, MAX_DISTANCE);
    point.nameDistance = Math.round(d * 10) / 10;
    point.namePosition =
        (Math.atan2(-y / (d + h), x / (d + w)) + 2 * Math.PI) % (2 * Math.PI);
    point.C.invalidateRender(point);
}
