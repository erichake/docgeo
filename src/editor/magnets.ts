import type { construction } from "../construction";
import { figureObjects } from "../dgo";
import { $, type DOMElement } from "../dom";
import type { construction_object } from "../objects/construction_object";
import { curve_object } from "../objects/curve_object";
import { list_object } from "../objects/list_object";
import { point_object, type magnet_target } from "../objects/point_object";
import { primitive_circle_object } from "../objects/primitive_circle_object";
import { primitive_line_object } from "../objects/primitive_line_object";
import { primitive_quadric_object } from "../objects/primitive_quadric_object";
import { descendants } from "./figure";

// The magnets, as in DGPad: see EDITOR.md.

// DGPad's slider stops, in screen pixels: 0 removes the magnet, the last
// one reaches the whole window.
export const REACHES = [
    0, 1, 2, 5, 10, 15, 20, 30, 50, 100, 200, 500, 1000, 5000,
];

// The points the engine's drag snaps onto their magnets: free points.
export const magnetizable = (
    object: construction_object | null | undefined,
): object is point_object =>
    object instanceof point_object &&
    object.mousedrag === point_object.prototype.mousedrag;

// An object depending on the point would move with it.
export const attracts = (
    point: point_object,
    object: construction_object,
): object is magnet_target =>
    [
        point_object,
        primitive_line_object,
        primitive_circle_object,
        primitive_quadric_object,
        list_object,
        curve_object,
    ].some((type) => object instanceof type) && !descendants(point).has(object);

export const reachOf = (point: point_object, target: magnet_target): number =>
    point.magnets.find((magnet) => magnet.target === target)?.radius ?? 0;

export function setReach(
    point: point_object,
    target: magnet_target,
    radius: number,
): void {
    const magnets = point.magnets.filter((magnet) => magnet.target !== target);
    point.magnets = radius ? [...magnets, { target, radius }] : magnets;
}

// Where the pointer is attracted: the target's own shape, stroked as wide as
// the reach, or a disc around a point; drawn under it.
export function showZone(
    target: magnet_target,
    radius: number,
): DOMElement | null {
    if (!radius || !target.hasView || !target.isVisible) return null;
    const node = target.dom.dom();
    const point = target instanceof point_object;
    // A disc: the stroke of a circle half as large, as wide as the reach.
    const zone = $(node.cloneNode(!point) as Element)
        .cls("dge-zone")
        .stl("--dge-reach", `${point ? radius : 2 * radius}px`);
    if (point) zone.add(target.svg.shape("circle").att("r", radius / 2));
    node.before(zone.dom());
    return zone;
}

// The engine keeps a removed target among the magnets, which the figure
// saved could not name.
export function dropLostMagnets(c: construction): void {
    figureObjects(c).forEach((object) => {
        if (object instanceof point_object && object.magnets.length)
            object.magnets = object.magnets.filter(
                ({ target }) => c.getObj(target.name) === target,
            );
    });
}
