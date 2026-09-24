import type { construction } from "../construction";
import { geometryTolerance, numEqual } from "../vec";
import type { construction_object } from "./construction_object";
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

    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        p2: point_object,
        p3: point_object,
    ) {
        super(c, name);
        this.P1 = p1;
        this.P2 = p2;
        this.P3 = p3;
        this.addParents(p1, p2, p3);
    }

    computeGeometry(): void {
        if (!this.P1.defined || !this.P2.defined || !this.P3.defined) {
            this.defined = false;
            return;
        }
        if (
            !numEqual(this.P1.z, this.P2.z) ||
            !numEqual(this.P1.z, this.P3.z)
        ) {
            this.defined = false;
            return;
        }
        const [ax, ay] = this.P1.coords;
        const [bx, by] = this.P2.coords;
        const [cx, cy] = this.P3.coords;
        const abx = bx - ax;
        const aby = by - ay;
        const acx = cx - ax;
        const acy = cy - ay;
        const denominator = 2 * (abx * acy - aby * acx);
        const scale = Math.hypot(abx, aby) * Math.hypot(acx, acy);
        if (Math.abs(denominator) <= 2 * geometryTolerance(scale)) {
            this.defined = false;
            return;
        }
        const ab2 = abx * abx + aby * aby;
        const ac2 = acx * acx + acy * acy;
        const center: [number, number, number] = [
            ax + (acy * ab2 - aby * ac2) / denominator,
            ay + (abx * ac2 - acx * ab2) / denominator,
            this.P1.z,
        ];
        this.setCircle(
            center,
            Math.hypot(center[0] - ax, center[1] - ay),
            [1, 0, 0],
            [0, 1, 0],
        );
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

    render(): void {
        this.dom.stl(
            "display",
            this.isVisible && this.projectionDefined ? "block" : "none",
        );
        if (!this.defined || !this.projectionDefined) return;
        const transform = `matrix(${this.screenU[0]} ${this.screenU[1]} ${this.screenV[0]} ${this.screenV[1]} ${this.centerScreen[0]} ${this.centerScreen[1]})`;
        const start = `${Math.cos(this.startAlpha)} ${Math.sin(this.startAlpha)}`;
        const end = `${Math.cos(this.endAlpha)} ${Math.sin(this.endAlpha)}`;
        const d = `M${start} A1 1 0 ${this.largeArcFlag} ${this.sweepFlag} ${end}`;
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
): arc3pts_object {
    return c.add(new arc3pts_object(c, name, p1, p2, p3));
}
