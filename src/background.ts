import type { Vec2 } from "./vec";

// A background image's layout, as CSS paints it over the background color:
// tiled from the top left corner (in both directions, along the top or
// along the left side), centered, stretched to the window, or scaled to
// fill it or to fit in it.
export const BACKGROUND_FITS = {
    repeat: "0 0 repeat",
    "repeat-x": "0 0 repeat-x",
    "repeat-y": "0 0 repeat-y",
    center: "center no-repeat",
    stretch: "0 0 / 100% 100% no-repeat",
    cover: "center / cover no-repeat",
    contain: "center / contain no-repeat",
};
export type BackgroundFit = keyof typeof BACKGROUND_FITS;

// GeoGebra's graphics view beside its 3D view: a band of its color, `left`
// pixels wide or `top` pixels high.
export function bandBackground(
    color: string,
    [left, top]: Vec2,
): { image: string; fit: BackgroundFit } {
    const [width, height] = left ? [left, 8] : [8, top];
    return {
        image: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${color}"/></svg>`)}`,
        fit: left ? "repeat-y" : "repeat-x",
    };
}
