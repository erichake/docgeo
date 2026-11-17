import type { construction } from "../construction";
import { geometryTolerance, vAdd, vScale, type Vec2, type Vec3 } from "../vec";
import type { construction_object } from "./construction_object";
import { primitive_circle_object } from "./primitive_circle_object";
import { pointsDrag } from "./drag_points";

const TWO_PI = 2 * Math.PI;

export function normalizeAngle(alpha: number): number {
    return ((alpha % TWO_PI) + TWO_PI) % TWO_PI;
}

// An arc of its circle, or its sector.
export abstract class primitive_arc_object extends primitive_circle_object {
    startAlpha = 0;
    endAlpha = 0;
    largeArcFlag: 0 | 1 = 0;
    sweepFlag: 0 | 1 = 0;
    sector: boolean;

    constructor(
        c: construction,
        name: string | null | undefined,
        sector: boolean,
    ) {
        super(c, name);
        this.sector = sector;
    }

    // From the angle of `from` to that of `to`, counterclockwise or not.
    protected setArc(from: Vec3, to: Vec3, ccw: boolean): void {
        this.startAlpha = normalizeAngle(this.alphaOf(from));
        this.endAlpha = normalizeAngle(this.alphaOf(to));
        const span = normalizeAngle(this.endAlpha - this.startAlpha);
        this.sweepFlag = ccw ? 1 : 0;
        this.largeArcFlag = (ccw ? span : TWO_PI - span) > Math.PI ? 1 : 0;
    }

    // Beyond the arc, the nearest of its ends, as in DGPad.
    pointAt(alpha: number): Vec3 {
        const from = this.sweepFlag ? this.startAlpha : this.endAlpha;
        const to = this.sweepFlag ? this.endAlpha : this.startAlpha;
        const span = normalizeAngle(to - from);
        const beyond = normalizeAngle(alpha - from) - span;
        if (beyond > 0) alpha = beyond < (TWO_PI - span) / 2 ? to : from;
        return super.pointAt(alpha);
    }

    // A point of its circle, on the arc up to rounding errors at its ends.
    insideBounds(point: Vec3): boolean {
        const from = this.sweepFlag ? this.startAlpha : this.endAlpha;
        const to = this.sweepFlag ? this.endAlpha : this.startAlpha;
        const tolerance = geometryTolerance(this.R) / this.R;
        const alpha = normalizeAngle(this.alphaOf(point) - from + tolerance);
        return alpha <= normalizeAngle(to - from) + 2 * tolerance;
    }

    // GeoGebra's DrawConicPart: beside its middle.
    nameAt(): Vec2 | null {
        const from = this.sweepFlag ? this.startAlpha : this.endAlpha;
        const to = this.sweepFlag ? this.endAlpha : this.startAlpha;
        const alpha = from + normalizeAngle(to - from) / 2;
        const [x, y] = vAdd(
            this.centerScreen,
            vAdd(
                vScale(this.screenU, Math.cos(alpha)),
                vScale(this.screenV, Math.sin(alpha)),
            ),
        );
        return [x + 6, y - 6];
    }

    render(): void {
        this.dom.stl(
            "display",
            this.isVisible && this.projectionDefined ? "block" : "none",
        );
        if (!this.defined || !this.projectionDefined) return;
        const transform = `matrix(${this.screenU[0]} ${this.screenU[1]} ${this.screenV[0]} ${this.screenV[1]} ${this.centerScreen[0]} ${this.centerScreen[1]})`;
        const start = `${Math.cos(this.startAlpha)} ${Math.sin(this.startAlpha)}`;
        const end = `${Math.cos(this.endAlpha)} ${Math.sin(this.endAlpha)}`;
        const arc = `A1 1 0 ${this.largeArcFlag} ${this.sweepFlag} ${end}`;
        const d = this.sector ? `M0 0 L${start} ${arc} Z` : `M${start} ${arc}`;
        this.path.att("d", d).att("transform", transform);
        this.hitArea.att("d", d).att("transform", transform);
        const from = this.sweepFlag ? this.startAlpha : this.endAlpha;
        const to = this.sweepFlag ? this.endAlpha : this.startAlpha;
        this.drawStroke(() => {
            const points = this.strokePoints(from, normalizeAngle(to - from));
            return this.sector ? [this.CENTER, ...points, this.CENTER] : points;
        });
    }

    static createSVG(_this: construction_object) {
        const t = _this as primitive_arc_object;
        const dom = t.svg.shape("g").drag(...pointsDrag(t));
        t.hitArea = t.svg
            .shape("path")
            .tap(() => t.C.gesture(t, "down"))
            .stl(
                "fill:none;stroke:transparent;pointer-events:stroke;cursor:pointer;vector-effect:non-scaling-stroke",
            )
            .stl("stroke-width", t.prefs.circle.touchsize);
        return primitive_circle_object.addStroke(t, dom, t.svg.shape("path"));
    }
}
