import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import { vAdd, vIsFinite, vSub, type Vec2, type Vec3 } from "../vec";
import { construction_object } from "./construction_object";

export type QuadricKind = "ellipse" | "hyperbola" | "parabola";

// Number of bisection steps used to locate where an unbounded branch
// leaves the viewport (see project() below) — matches the precision
// convention used for the depth-crossing search in hidden_line.ts.
const BISECTION_STEPS = 20;
// Sample points per side of a branch's own vertex, once its visible extent
// is known. Not a resolution knob like the legacy code's fixed NB=500: the
// *extent* is found analytically per branch, this only controls how finely
// that known extent is subdivided for the SVG polyline.
const BRANCH_SAMPLES = 24;

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
            for (let i = -BRANCH_SAMPLES; i <= BRANCH_SAMPLES; i++) {
                const bound = i < 0 ? boundNeg : boundPos;
                const p = projectAt((bound * i) / BRANCH_SAMPLES);
                if (p) samples.push(p);
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
