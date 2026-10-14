import type { construction } from "../construction";
import { geometryTolerance, vAdd, vScale, type Vec2, type Vec3 } from "../vec";
import type { construction_object, DgoContext } from "./construction_object";
import type { point_object } from "./point_object";
import { primitive_circle_object } from "./primitive_circle_object";

const TWO_PI = 2 * Math.PI;

function normalizeAngle(alpha: number): number {
    return ((alpha % TWO_PI) + TWO_PI) % TWO_PI;
}

export class arc3pts_object extends primitive_circle_object {
    P1: point_object;
    P2: point_object;
    P3: point_object;
    startAlpha = 0;
    endAlpha = 0;
    largeArcFlag: 0 | 1 = 0;
    sweepFlag: 0 | 1 = 0;
    sector: boolean;

    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        p2: point_object,
        p3: point_object,
        sector: boolean,
    ) {
        super(c, name);
        this.P1 = p1;
        this.P2 = p2;
        this.P3 = p3;
        this.sector = sector;
        this.addParents(p1, p2, p3);
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            this.sector ? "Sec" : "Arc",
            [this.P1, this.P2, this.P3].map(context.index),
        ];
    }

    computeGeometry(): void {
        if (!this.P1.defined || !this.P2.defined || !this.P3.defined) {
            this.defined = false;
            return;
        }
        this.setCircleThrough(this.P1.coords, this.P2.coords, this.P3.coords);
        if (!this.defined) return;

        const alphaA = normalizeAngle(this.alphaOf(this.P1.coords));
        const alphaB = normalizeAngle(this.alphaOf(this.P2.coords));
        const alphaC = normalizeAngle(this.alphaOf(this.P3.coords));
        const spanAC = normalizeAngle(alphaC - alphaA);
        const spanAB = normalizeAngle(alphaB - alphaA);
        const goesCcw = spanAB < spanAC;

        this.startAlpha = alphaA;
        this.endAlpha = alphaC;
        this.sweepFlag = goesCcw ? 1 : 0;
        this.largeArcFlag =
            (goesCcw ? spanAC : TWO_PI - spanAC) > Math.PI ? 1 : 0;
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
    }

    static createSVG(_this: construction_object) {
        const t = _this as arc3pts_object;
        const dom = t.svg.shape("g");
        t.hitArea = t.svg
            .shape("path")
            .stl(
                "fill:none;stroke:transparent;pointer-events:stroke;cursor:pointer;vector-effect:non-scaling-stroke",
            )
            .stl("stroke-width", t.prefs.circle.touchsize);
        t.path = t.svg
            .shape("path")
            .stl("fill", t.fill_color)
            .stl("fill-opacity", t.opacity ?? 0)
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("stroke-dasharray", t.strokeDashArray)
            .stl("pointer-events", "none")
            .stl("vector-effect", "non-scaling-stroke");
        return dom.add(t.hitArea, t.path);
    }
}

export function createArc3pts(
    c: construction,
    name: string | null | undefined,
    p1: point_object,
    p2: point_object,
    p3: point_object,
    sector = false,
): arc3pts_object {
    return c.add(new arc3pts_object(c, name, p1, p2, p3, sector));
}
