import type { construction } from "../construction";
import { conicConicIntersectionsXY, type ConicCoeffs } from "./conic_algebra";
import type { DOMElement } from "../dom";
import { vAdd, vIsFinite, vSub, type Vec2, type Vec3 } from "../vec";
import { construction_object } from "./construction_object";

export type QuadricKind = "ellipse" | "hyperbola" | "parabola";

// Number of bisection steps used to locate where an unbounded branch
// leaves the viewport (see project() below) — matches the precision
// convention used for the depth-crossing search in hidden_line.ts.
const BISECTION_STEPS = 20;
// Initial samples per side of a branch's own vertex, once its visible
// extent is known: each interval is then subdivided until the polyline
// stays within FLATNESS pixels of the curve.
const BRANCH_SAMPLES = 24;
const FLATNESS = 0.25;
const MAX_SUBDIVISIONS = 12;

function findBound(isOutside: (t: number) => boolean): number {
    let hi = 1;
    while (hi < 1e8 && !isOutside(hi)) hi *= 2;
    let lo = hi / 2;
    for (let i = 0; i < BISECTION_STEPS; i++) {
        const mid = (lo + hi) / 2;
        if (isOutside(mid)) hi = mid;
        else lo = mid;
    }
    return hi;
}

export class primitive_quadric_object extends construction_object {
    KIND: QuadricKind = "ellipse";
    // Implicit a·x²+b·xy+c·y²+d·x+e·y+f=0 form, in the quadric's own
    // (x,y) plane — the algebraic representation intersection math works
    // from. Rendering uses CENTER/AXIS_U/AXIS_V/BRANCHES below instead.
    COEFFS: ConicCoeffs | null = null;
    CENTER: Vec3 = [0, 0, 0]; // ellipse/hyperbola center, or parabola vertex
    // Ellipse only: rendered exactly as an affine image of the unit circle,
    // so no sampling is ever needed for that case.
    AXIS_U: Vec3 = [1, 0, 0];
    AXIS_V: Vec3 = [0, 1, 0];
    // Hyperbola (2 entries) / parabola (1 entry): one closed-form
    // parametrization per branch. SVG has no native path element for these,
    // so they're sampled between analytically-located, viewport-relative
    // bounds instead of the legacy's fixed pixel-column scan.
    BRANCHES: ((t: number) => Vec3)[] = [];

    projectionDefined = true;
    centerScreen: Vec2 = [0, 0];
    screenU: Vec2 = [0, 0];
    screenV: Vec2 = [0, 0];
    branchScreenPoints: Vec2[][] = [];

    ellipseHitArea!: DOMElement;
    ellipsePath!: DOMElement;
    curveHitArea!: DOMElement;
    curvePath!: DOMElement;

    constructor(c: construction, name: string | null | undefined) {
        super(c, name, "quadric");
        this.familytype = "quadric";
    }

    setEllipse(center: Vec3, axisU: Vec3, axisV: Vec3): void {
        this.KIND = "ellipse";
        this.CENTER = center;
        this.AXIS_U = axisU;
        this.AXIS_V = axisV;
        this.BRANCHES = [];
        this.defined =
            vIsFinite(center) && vIsFinite(axisU) && vIsFinite(axisV);
    }

    setBranches(
        kind: "hyperbola" | "parabola",
        center: Vec3,
        branches: ((t: number) => Vec3)[],
    ): void {
        this.KIND = kind;
        this.CENTER = center;
        this.BRANCHES = branches;
        this.defined = vIsFinite(center);
    }

    // Foot of the point on the conic whose normal passes through `target`
    // (nearest such foot when several exist): intersects the conic with the
    // "conic of normals" through target — the classical construction for
    // projecting a point onto a conic algebraically, ax²+bxy+cy²+dx+ey+f=0
    // vs. its normal-direction conic through (p,q) — rather than a numeric
    // per-branch search, so it matches DGPad's own PointOn-on-Quadric
    // behavior exactly. Falls back to `target` itself when the conic has no
    // real normal foot from there (degenerate/undefined case).
    projectPoint(target: Vec3): Vec3 {
        if (!this.COEFFS) return target;
        const [a, b, c, d, e] = this.COEFFS;
        const [p, q] = target;
        const normalConic: ConicCoeffs = [
            b,
            2 * (c - a),
            -b,
            e + 2 * a * q - p * b,
            b * q - 2 * p * c - d,
            d * q - p * e,
        ];
        const candidates = conicConicIntersectionsXY(this.COEFFS, normalConic);
        let best: Vec2 | null = null;
        let bestDistance = Infinity;
        for (const candidate of candidates) {
            const distance = Math.hypot(candidate[0] - p, candidate[1] - q);
            if (distance < bestDistance) {
                best = candidate;
                bestDistance = distance;
            }
        }
        return best ? [best[0], best[1], target[2]] : target;
    }

    project(): void {
        this.projectionDefined = false;
        if (!this.defined) return;
        if (this.KIND === "ellipse") {
            this.projectEllipse();
            return;
        }
        this.projectBranches();
    }

    private projectEllipse(): void {
        const center = this.C.pt3D(this.CENTER);
        const u = vSub(this.C.pt3D(vAdd(this.CENTER, this.AXIS_U)), center);
        const v = vSub(this.C.pt3D(vAdd(this.CENTER, this.AXIS_V)), center);
        if (!vIsFinite(center) || !vIsFinite(u) || !vIsFinite(v)) return;
        this.centerScreen = center;
        this.screenU = u;
        this.screenV = v;
        this.projectionDefined = true;
    }

    private projectBranches(): void {
        const anchor = this.C.pt3D(this.CENTER);
        if (!vIsFinite(anchor)) return;
        const margin =
            this.C.width +
            this.C.height +
            Math.abs(anchor[0]) +
            Math.abs(anchor[1]);
        const branchPoints: Vec2[][] = [];
        for (const branch of this.BRANCHES) {
            const projectAt = (t: number): Vec2 | null => {
                const p = this.C.pt3D(branch(t));
                return vIsFinite(p) ? p : null;
            };
            const isOutside = (t: number): boolean => {
                const p = projectAt(t);
                return (
                    !p ||
                    Math.hypot(p[0] - anchor[0], p[1] - anchor[1]) > margin
                );
            };
            const boundPos = findBound((t) => isOutside(t));
            const boundNeg = findBound((t) => isOutside(-t));
            const samples: Vec2[] = [];
            const refine = (
                t0: number,
                p0: Vec2,
                t1: number,
                p1: Vec2,
                depth: number,
            ): void => {
                const t = (t0 + t1) / 2;
                const p = projectAt(t);
                if (
                    p &&
                    depth < MAX_SUBDIVISIONS &&
                    Math.hypot(
                        p[0] - (p0[0] + p1[0]) / 2,
                        p[1] - (p0[1] + p1[1]) / 2,
                    ) > FLATNESS
                ) {
                    refine(t0, p0, t, p, depth + 1);
                    samples.push(p);
                    refine(t, p, t1, p1, depth + 1);
                }
            };
            let previous: [number, Vec2] | null = null;
            for (let i = -BRANCH_SAMPLES; i <= BRANCH_SAMPLES; i++) {
                const t = ((i < 0 ? boundNeg : boundPos) * i) / BRANCH_SAMPLES;
                const p = projectAt(t);
                if (!p) continue;
                if (previous) refine(previous[0], previous[1], t, p, 0);
                samples.push(p);
                previous = [t, p];
            }
            if (samples.length > 1) branchPoints.push(samples);
        }
        if (branchPoints.length === 0) return;
        this.branchScreenPoints = branchPoints;
        this.projectionDefined = true;
    }

    render(): void {
        this.dom.stl(
            "display",
            this.isVisible && this.projectionDefined ? "block" : "none",
        );
        if (!this.defined || !this.projectionDefined) return;
        const isEllipse = this.KIND === "ellipse";
        this.ellipseHitArea.stl("display", isEllipse ? "block" : "none");
        this.ellipsePath.stl("display", isEllipse ? "block" : "none");
        this.curveHitArea.stl("display", isEllipse ? "none" : "block");
        this.curvePath.stl("display", isEllipse ? "none" : "block");
        this.ellipsePath.stl(
            "fill-opacity",
            isEllipse ? (this.opacity ?? 0) : 0,
        );
        if (isEllipse) {
            const transform = `matrix(${this.screenU[0]} ${this.screenU[1]} ${this.screenV[0]} ${this.screenV[1]} ${this.centerScreen[0]} ${this.centerScreen[1]})`;
            this.ellipseHitArea.att("transform", transform);
            this.ellipsePath.att("transform", transform);
        } else {
            const d = this.branchScreenPoints
                .map((points) =>
                    points.reduce(
                        (path, [x, y], i) =>
                            path + (i === 0 ? "M" : " L") + x + " " + y,
                        "",
                    ),
                )
                .join(" ");
            this.curveHitArea.att("d", d);
            this.curvePath.att("d", d);
        }
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as primitive_quadric_object;
        const dom = t.svg.shape("g");
        t.ellipseHitArea = t.svg
            .shape("circle")
            .att("cx", 0)
            .att("cy", 0)
            .att("r", 1)
            .stl(
                "fill:transparent;stroke:transparent;pointer-events:stroke;cursor:pointer;vector-effect:non-scaling-stroke",
            )
            .stl("stroke-width", t.prefs.quadric.touchsize);
        t.ellipsePath = t.svg
            .shape("circle")
            .att("cx", 0)
            .att("cy", 0)
            .att("r", 1)
            .stl("fill", t.fill_color)
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("pointer-events", "none")
            .stl("vector-effect", "non-scaling-stroke");
        t.curveHitArea = t.svg
            .shape("path")
            .stl(
                "fill:none;stroke:transparent;pointer-events:stroke;cursor:pointer",
            )
            .stl("stroke-width", t.prefs.quadric.touchsize);
        t.curvePath = t.svg
            .shape("path")
            .stl("fill", "none")
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("pointer-events", "none");
        return dom.add(
            t.ellipseHitArea,
            t.ellipsePath,
            t.curveHitArea,
            t.curvePath,
        );
    }
}
