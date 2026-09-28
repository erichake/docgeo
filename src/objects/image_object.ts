import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { Vec2 } from "../vec";
import { construction_object, type DgoContext } from "./construction_object";
import type { point_object } from "./point_object";

// GeoGebra's image: its bottom left and bottom right corners, and its top
// left one, or else its height keeps its proportions. With its bottom left
// corner only, or fixed at a window position of its top left corner
// without any, it keeps its size in pixels.
export class image_object extends construction_object {
    url: string;
    width: number;
    height: number;
    corners: point_object[];
    screen: Vec2 | null = null;
    private transform: string | null = null;
    private image!: DOMElement;

    constructor(
        c: construction,
        name: string | null | undefined,
        url: string,
        width: number,
        height: number,
        corners: point_object[],
    ) {
        super(c, name, "image");
        this.url = url;
        this.width = width;
        this.height = height;
        this.corners = corners;
        this.addParents(...corners);
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "Img",
            [
                context.image(this.url),
                this.width,
                this.height,
                ...(this.screen
                    ? [context.screen(this.screen)]
                    : this.corners.map(context.index)),
            ],
        ];
    }

    computeGeometry(): void {
        this.defined = this.corners.every((corner) => corner.defined);
    }

    project(): void {
        this.transform = null;
        if (this.screen) {
            this.transform = `translate(${this.screen[0]} ${this.screen[1]})`;
            return;
        }
        if (
            !this.defined ||
            !this.corners.every((corner) => corner.projectionDefined)
        )
            return;
        const [a, b, top] = this.corners.map((corner): Vec2 => corner.screen);
        const [ux, uy] = b
            ? [(b[0] - a[0]) / this.width, (b[1] - a[1]) / this.width]
            : [1, 0];
        // Down the image, one of its pixels.
        const [vx, vy] = top
            ? [(a[0] - top[0]) / this.height, (a[1] - top[1]) / this.height]
            : [-uy, ux];
        this.transform = `matrix(${ux} ${uy} ${vx} ${vy} ${a[0] - vx * this.height} ${a[1] - vy * this.height})`;
    }

    render(): void {
        const shown = this.isVisible && this.transform !== null;
        this.dom.stl("display", shown ? "block" : "none");
        if (shown) this.image.att("transform", this.transform!);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as image_object;
        t.image = t.svg
            .shape("image")
            .att("href", t.url)
            .att("width", t.width)
            .att("height", t.height)
            .att("preserveAspectRatio", "none")
            .stl("pointer-events", "none")
            .stl("opacity", t.opacity ?? 1);
        return t.svg.shape("g").add(t.image);
    }
}

export function createImage(
    c: construction,
    name: string | null | undefined,
    url: string,
    width: number,
    height: number,
    corners: point_object[],
): image_object {
    return c.add(new image_object(c, name, url, width, height, corners));
}
