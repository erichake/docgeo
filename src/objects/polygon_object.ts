import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { Vec2 } from "../vec";
import { construction_object } from "./construction_object";
import type { point_object } from "./point_object";

export class polygon_object extends construction_object {
    points: point_object[];
    screenPoints: Vec2[];
    projectionDefined: boolean;
    path!: DOMElement;
    hitArea!: DOMElement;

    constructor(
        c: construction,
        name: string | null | undefined,
        points: point_object[],
    ) {
        super(c, name, "polygon");
        this.points = points;
        this.screenPoints = points.map((): Vec2 => [0, 0]);
        this.projectionDefined = true;
        this.familytype = "polygon";
        this.addParents(...points);
    }

    computeGeometry(): void {
        this.defined = this.points.every((p) => p.defined);
    }

    project(): void {
        this.projectionDefined =
            this.defined && this.points.every((p) => p.projectionDefined);
        if (!this.projectionDefined) return;
        this.screenPoints = this.points.map((p) => p.screen);
    }

    render(): void {
        this.dom.stl(
            "display",
            this.isVisible && this.projectionDefined ? "block" : "none",
        );
        if (!this.defined || !this.projectionDefined) return;
        const d =
            this.screenPoints.reduce(
                (path, [x, y], i) => path + (i === 0 ? "M" : " L") + x + " " + y,
                "",
            ) + " Z";
        this.path.att("d", d);
        this.hitArea.att("d", d);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as polygon_object;
        const dom = t.svg.shape("g");
        t.hitArea = t.svg
            .shape("path")
            .stl(
                "fill:transparent;stroke:transparent;pointer-events:fill;cursor:pointer",
            );
        t.path = t.svg
            .shape("path")
            .stl("fill", t.fill_color)
            .stl("fill-opacity", t.opacity ?? 0)
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("pointer-events", "none");
        return dom.add(t.hitArea, t.path);
    }
}

export function createPolygon(
    c: construction,
    name: string | null | undefined,
    points: point_object[],
): polygon_object {
    return c.add(new polygon_object(c, name, points));
}
