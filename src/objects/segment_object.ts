import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import { projectPointOnPlane, viewDirection } from "../projection";
import {
    geometryTolerance,
    pointInPolygon,
    vAdd,
    vDot,
    vNorm,
    vNormalize,
    vScale,
    vSub,
} from "../vec";
import type { construction_object } from "./construction_object";
import type { point_object } from "./point_object";
import type { polygon_object } from "./polygon_object";
import { primitive_line_object } from "./primitive_line_object";
import { two_points_line_object } from "./two_points_line_object";

const FONT_MARGIN = 5;
const HALF_TURN = Math.PI;
const QUARTER_TURN = Math.PI / 2;

export class segment_object extends two_points_line_object {
    lengthText?: DOMElement;
    // True when a polygon stands between the camera and this segment, drawn
    // dashed instead of solid to follow hidden-line convention.
    occluded = false;

    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        p2: point_object,
    ) {
        super(c, name, p1, p2, "segment");
    }

    project(): void {
        super.project();
        if (
            !this.defined ||
            !this.projectionDefined ||
            !this.P2.projectionDefined
        ) {
            this.projectionDefined = false;
            return;
        }
        this.sP1 = this.P1.screen;
        this.sP2 = this.P2.screen;
        this.projectionDefined = vNormalize(vSub(this.sP2, this.sP1)) !== null;
        this.occluded = this.projectionDefined && this.isOccludedByPolygon();
    }

    // A polygon occludes the segment when its midpoint, at the same screen
    // position, is both inside the polygon's outline and closer to the
    // camera. A polygon this segment is itself an edge of is skipped, since
    // it is coplanar with it rather than in front of it.
    private isOccludedByPolygon(): boolean {
        const frame = this.C.projectionFrame;
        const dir = viewDirection(frame);
        const mid3D = vScale(vAdd(this.P1.coords, this.P2.coords), 0.5);
        const midScreen = vScale(vAdd(this.sP1, this.sP2), 0.5);
        const segmentDepth = vDot(mid3D, dir);
        return (this.C.OBJS.polygons as polygon_object[]).some((polygon) => {
            if (!polygon.isVisible || polygon.points.length < 3) return false;
            if (
                polygon.points.includes(this.P1) &&
                polygon.points.includes(this.P2)
            )
                return false;
            if (!polygon.points.every((p) => p.projectionDefined)) return false;
            if (
                !pointInPolygon(
                    midScreen,
                    polygon.points.map((p) => p.screen),
                )
            )
                return false;
            const [v0, v1, v2] = polygon.points.map((p) => p.coords);
            const planePoint = projectPointOnPlane(
                midScreen,
                v0,
                [vSub(v1, v0), vSub(v2, v0)],
                frame,
            );
            if (!planePoint) return false;
            const planeDepth = vDot(planePoint, dir);
            return (
                planeDepth <
                segmentDepth - geometryTolerance(segmentDepth, planeDepth)
            );
        });
    }

    insideBounds(parameter: number): boolean {
        const length = vNorm(vSub(this.P2.coords, this.P1.coords));
        const tolerance = geometryTolerance(length);
        return parameter >= -tolerance && parameter <= length + tolerance;
    }

    render(): void {
        super.render();
        if (this.defined && this.projectionDefined)
            this.path.stl(
                "stroke-dasharray",
                this.occluded ? `${this.size * 3} ${this.size * 2}` : "none",
            );
        if (!this.lengthText) return;
        if (!this.defined || !this.projectionDefined) return;

        const midx = (this.sP1[0] + this.sP2[0]) / 2;
        const midy = (this.sP1[1] + this.sP2[1]) / 2;
        let angle = Math.atan2(
            this.sP2[1] - this.sP1[1],
            this.sP2[0] - this.sP1[0],
        );
        if (angle < -QUARTER_TURN || angle > QUARTER_TURN) angle += HALF_TURN;

        const offset = FONT_MARGIN + this.size / 2;
        this.lengthText
            .att(
                "transform",
                `translate(${midx} ${midy}) rotate(${(angle * 180) / Math.PI})`,
            )
            .att("y", -offset)
            .text(
                formatLength(
                    vNorm(vSub(this.P2.coords, this.P1.coords)),
                    this.precision,
                ),
            );
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as segment_object;
        const dom = primitive_line_object.createSVG(t);
        if (t.precision < 0) return dom;

        t.lengthText = t.svg
            .shape("text")
            .att("x", 0)
            .att("text-anchor", "middle")
            .stl(
                `fill:${t.stroke_color};font-family:Verdana;font-size:${t.fontSize}px;pointer-events:none`,
            );
        return dom.add(t.lengthText);
    }
}

function formatLength(value: number, precision: number): string {
    const factor = 10 ** precision;
    return (Math.round(value * factor) / factor).toString().replace(".", ",");
}

export function createSegment(
    c: construction,
    name: string | null | undefined,
    p1: point_object,
    p2: point_object,
): segment_object {
    return c.add(new segment_object(c, name, p1, p2));
}
