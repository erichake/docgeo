import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import {
    geometryTolerance,
    vAdd,
    vCross,
    vDot,
    vNorm,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import type { construction_object, DgoContext } from "./construction_object";
import type { point_object } from "./point_object";
import { normalizeAngle, primitive_arc_object } from "./primitive_arc_object";
import { primitive_circle_object } from "./primitive_circle_object";
import { primitive_quadric_object } from "./primitive_quadric_object";

// The arc of an ellipse from P to Q, counterclockwise in its plane, each
// point taken where it projects onto it, or its sector.
export class conic_arc_object extends primitive_quadric_object {
    CONIC: primitive_quadric_object;
    P: point_object;
    Q: point_object;
    sector: boolean;
    // From the angle `start` over `span`, on CENTER + cos·AXIS_U +
    // sin·AXIS_V.
    start = 0;
    span = 0;
    path!: DOMElement;
    hitArea!: DOMElement;

    constructor(
        c: construction,
        name: string | null | undefined,
        conic: primitive_quadric_object,
        p: point_object,
        q: point_object,
        sector: boolean,
    ) {
        super(c, name);
        this.CONIC = conic;
        this.P = p;
        this.Q = q;
        this.sector = sector;
        this.addParents(conic, p, q);
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            this.sector ? "QSec" : "QArc",
            [this.CONIC, this.P, this.Q].map(context.index),
        ];
    }

    frame(): Vec3[] {
        return this.CONIC.frame();
    }

    computeGeometry(): void {
        const conic = this.CONIC;
        if (
            !conic.defined ||
            conic.KIND !== "ellipse" ||
            !this.P.defined ||
            !this.Q.defined
        ) {
            this.defined = false;
            return;
        }
        this.COEFFS = conic.COEFFS;
        this.ORIGIN = conic.ORIGIN;
        this.PLANE = conic.PLANE;
        this.CENTER = conic.CENTER;
        this.AXIS_U = conic.AXIS_U;
        this.AXIS_V = conic.AXIS_V;
        const [from, to] = [this.P, this.Q].map((point) =>
            this.angleOf(conic.projectPoint(point.coords)),
        );
        // Counterclockwise in the plane, from AXIS_U to AXIS_V or back.
        const direct =
            vDot(vCross(this.AXIS_U, this.AXIS_V), vCross(...this.PLANE)) > 0;
        this.start = direct ? from : to;
        this.span = normalizeAngle(direct ? to - from : from - to);
        this.defined = true;
    }

    private angleOf(point: Vec3): number {
        const relative = vSub(point, this.CENTER);
        const [u, v] = [this.AXIS_U, this.AXIS_V];
        const [uu, uv, vv] = [vDot(u, u), vDot(u, v), vDot(v, v)];
        const [ru, rv] = [vDot(relative, u), vDot(relative, v)];
        return Math.atan2(rv * uu - ru * uv, ru * vv - rv * uv);
    }

    private at(alpha: number): Vec3 {
        return vAdd(
            this.CENTER,
            vAdd(
                vScale(this.AXIS_U, Math.cos(alpha)),
                vScale(this.AXIS_V, Math.sin(alpha)),
            ),
        );
    }

    // Beyond the arc, the nearest of its ends.
    pointAt(alpha: readonly [number, number]): Vec3 {
        const point = super.pointAt(alpha);
        const beyond =
            normalizeAngle(this.angleOf(point) - this.start) - this.span;
        if (beyond <= 0) return point;
        return this.at(
            beyond < (2 * Math.PI - this.span) / 2
                ? this.start + this.span
                : this.start,
        );
    }

    // On the arc, up to rounding errors at its ends.
    insideBounds(point: Vec3): boolean {
        const size = Math.max(vNorm(this.AXIS_U), vNorm(this.AXIS_V));
        const tolerance = geometryTolerance(size) / size;
        const alpha = normalizeAngle(
            this.angleOf(point) - this.start + tolerance,
        );
        return alpha <= this.span + 2 * tolerance;
    }

    // Beside its middle, as an arc of a circle.
    nameAt(): Vec2 | null {
        const alpha = this.start + this.span / 2;
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
        const point = (alpha: number) =>
            `${Math.cos(alpha)} ${Math.sin(alpha)}`;
        const start = point(this.start);
        const arc = `A1 1 0 ${this.span > Math.PI ? 1 : 0} 1 ${point(this.start + this.span)}`;
        const d = this.sector ? `M0 0 L${start} ${arc} Z` : `M${start} ${arc}`;
        this.path.att("d", d).att("transform", transform);
        this.hitArea.att("d", d).att("transform", transform);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as conic_arc_object;
        t.hitArea = t.svg
            .shape("path")
            .stl(
                "fill:none;stroke:transparent;pointer-events:stroke;cursor:pointer;vector-effect:non-scaling-stroke",
            )
            .stl("stroke-width", t.prefs.quadric.touchsize);
        t.path = t.svg
            .shape("path")
            .stl("fill", t.fill_color)
            .stl("fill-opacity", t.opacity ?? 0)
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("stroke-dasharray", t.strokeDashArray)
            .stl("pointer-events", "none")
            .stl("vector-effect", "non-scaling-stroke");
        return t.svg.shape("g").add(t.hitArea, t.path);
    }
}

// The arc of a circle from P to Q, counterclockwise around its normal, each
// point taken at its angle around the center, or its sector.
export class circle_arc_object extends primitive_arc_object {
    CIRCLE: primitive_circle_object;
    P: point_object;
    Q: point_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        circle: primitive_circle_object,
        p: point_object,
        q: point_object,
        sector: boolean,
    ) {
        super(c, name, sector);
        this.CIRCLE = circle;
        this.P = p;
        this.Q = q;
        this.addParents(circle, p, q);
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            this.sector ? "QSec" : "QArc",
            [this.CIRCLE, this.P, this.Q].map(context.index),
        ];
    }

    computeGeometry(): void {
        const circle = this.CIRCLE;
        if (!circle.defined || !this.P.defined || !this.Q.defined) {
            this.defined = false;
            return;
        }
        this.setCircle(circle.CENTER, circle.R, circle.U, circle.V);
        this.setArc(this.P.coords, this.Q.coords, true);
    }
}

export function createConicArc(
    c: construction,
    name: string | null | undefined,
    support: primitive_quadric_object | primitive_circle_object,
    p: point_object,
    q: point_object,
    sector = false,
): conic_arc_object | circle_arc_object {
    return c.add(
        support instanceof primitive_circle_object
            ? new circle_arc_object(c, name, support, p, q, sector)
            : new conic_arc_object(c, name, support, p, q, sector),
    );
}
