import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { Vec2 } from "../vec";
import { construction_object } from "./construction_object";
import {
    complement,
    hiddenIntervals,
    intervalsToPath,
    ownsEdge,
    type Interval,
} from "./hidden_line";
import type { point_object } from "./point_object";

export class polygon_object extends construction_object {
    points: point_object[];
    screenPoints: Vec2[];
    projectionDefined: boolean;
    path!: DOMElement;
    hitArea!: DOMElement;
    outline!: DOMElement;
    hiddenOutline!: DOMElement;
    // Per-edge hidden sub-ranges, indexed like points (edge i runs from
    // points[i] to points[(i + 1) % points.length]).
    private edgeHidden: Interval[][] = [];
    private edgeVisible: Interval[][] = [];

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
        const edges = this.points.map((p1, i) => {
            const p2 = this.points[(i + 1) % this.points.length];
            if (!ownsEdge(this.C, this, p1, p2))
                return { hidden: [] as Interval[], visible: [] as Interval[] };
            const hidden = hiddenIntervals(this.C, p1, p2);
            return { hidden, visible: complement(hidden) };
        });
        this.edgeHidden = edges.map((edge) => edge.hidden);
        this.edgeVisible = edges.map((edge) => edge.visible);
    }

    render(): void {
        this.dom.stl(
            "display",
            this.isVisible && this.projectionDefined ? "block" : "none",
        );
        if (!this.defined || !this.projectionDefined) return;
        const d =
            this.screenPoints.reduce(
                (path, [x, y], i) =>
                    path + (i === 0 ? "M" : " L") + x + " " + y,
                "",
            ) + " Z";
        this.path.att("d", d);
        this.hitArea.att("d", d);
        this.outline.att("d", this.edgePathData(this.edgeVisible));
        this.hiddenOutline.att("d", this.edgePathData(this.edgeHidden));
    }

    private edgePathData(edges: Interval[][]): string {
        return edges
            .map((intervals, i) => {
                const p1 = this.screenPoints[i];
                const p2 =
                    this.screenPoints[(i + 1) % this.screenPoints.length];
                return intervalsToPath(p1, p2, intervals);
            })
            .join(" ");
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
            .stl("stroke", "none")
            .stl("pointer-events", "none");
        t.outline = t.svg
            .shape("path")
            .stl("fill", "none")
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("pointer-events", "none");
        t.hiddenOutline = t.svg
            .shape("path")
            .stl("fill", "none")
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("stroke-dasharray", `${t.size * 3} ${t.size * 2}`)
            .stl("pointer-events", "none");
        return dom.add(t.hitArea, t.path, t.outline, t.hiddenOutline);
    }
}

export function createPolygon(
    c: construction,
    name: string | null | undefined,
    points: point_object[],
): polygon_object {
    return c.add(new polygon_object(c, name, points));
}
