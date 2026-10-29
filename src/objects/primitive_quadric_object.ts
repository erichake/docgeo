import type { construction } from "../construction";
import { conicConicIntersectionsXY, type ConicCoeffs } from "./conic_algebra";
import type { DOMElement } from "../dom";
import {
    geometryTolerance,
    numEqual,
    vAdd,
    vCross,
    vDot,
    vIsFinite,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import type { ScriptValue } from "../import/dgp_formula";
import { construction_object } from "./construction_object";
import {
    ellipseAnchor,
    ellipseName,
    ellipseNameAt,
} from "./primitive_circle_object";

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

export abstract class primitive_quadric_object extends construction_object {
    KIND: QuadricKind = "ellipse";
    // Implicit a·x²+b·xy+c·y²+d·x+e·y+f=0 form, in the quadric's own
    // (x,y) plane — the algebraic representation intersection math works
    // from. Rendering uses CENTER/AXIS_U/AXIS_V/BRANCHES below instead.
    COEFFS: ConicCoeffs | null = null;
    // That plane, in which (x,y) are coordinates along PLANE from ORIGIN:
    // horizontal, or the screen plane for a DGPad 3D figure's 2D conic (see
    // GRID.FRAME2D).
    ORIGIN: Vec3 = [0, 0, 0];
    PLANE: [Vec3, Vec3] = [
        [1, 0, 0],
        [0, 1, 0],
    ];
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

    // The horizontal plane at height z, or the screen plane.
    protected setPlane(z: number): void {
        if (this.C.GRID.FRAME2D && this.flat) {
            this.ORIGIN = [0, 0, 0];
            this.PLANE = this.C.screenPlaneBasis;
        } else {
            this.ORIGIN = [0, 0, z];
            this.PLANE = [
                [1, 0, 0],
                [0, 1, 0],
            ];
        }
    }

    // A point's (x,y) coordinates in the plane, then its distance to it.
    toPlane(point: Vec3): Vec3 {
        const relative = vSub(point, this.ORIGIN);
        const [u, v] = this.PLANE;
        return [
            vDot(relative, u),
            vDot(relative, v),
            vDot(relative, vCross(u, v)),
        ];
    }

    fromPlane([x, y]: readonly number[]): Vec3 {
        return vAdd(this.ORIGIN, this.planeVector([x, y]));
    }

    private planeVector([x, y]: readonly number[]): Vec3 {
        const [u, v] = this.PLANE;
        return vAdd(vScale(u, x), vScale(v, y));
    }

    // Whether its COEFFS and other's are in the same coordinates.
    sharesPlane(other: primitive_quadric_object): boolean {
        return [
            vSub(other.ORIGIN, this.ORIGIN),
            vSub(other.PLANE[0], this.PLANE[0]),
            vSub(other.PLANE[1], this.PLANE[1]),
        ].every((v) => v.every((x) => numEqual(x, 0)));
    }

    // From plane coordinates, as below.
    setEllipse(center: Vec2, axisU: Vec2, axisV: Vec2): void {
        this.KIND = "ellipse";
        this.CENTER = this.fromPlane(center);
        this.AXIS_U = this.planeVector(axisU);
        this.AXIS_V = this.planeVector(axisV);
        this.BRANCHES = [];
        this.defined =
            vIsFinite(this.CENTER) &&
            vIsFinite(this.AXIS_U) &&
            vIsFinite(this.AXIS_V);
    }

    setBranches(
        kind: "hyperbola" | "parabola",
        center: Vec2,
        branches: ((t: number) => Vec2)[],
    ): void {
        this.KIND = kind;
        this.CENTER = this.fromPlane(center);
        this.BRANCHES = branches.map(
            (branch) => (t) => this.fromPlane(branch(t)),
        );
        this.defined = vIsFinite(this.CENTER);
    }

    // The conic α·x'² + β·y'² + γ·y' + δ = 0 in the frame of `origin` and of
    // the unit `u` of its plane, y' along u turned a quarter.
    protected setCoeffs(
        [ox, oy]: Vec2,
        [ux, uy]: Vec2,
        alpha: number,
        beta: number,
        gamma: number,
        delta: number,
    ): void {
        const a = alpha * ux * ux + beta * uy * uy;
        const b = 2 * ux * uy * (alpha - beta);
        const c = alpha * uy * uy + beta * ux * ux;
        const [d, e] = [-gamma * uy, gamma * ux];
        const coeffs = [
            a,
            b,
            c,
            d - 2 * a * ox - b * oy,
            e - 2 * c * oy - b * ox,
            a * ox * ox + b * ox * oy + c * oy * oy - d * ox - e * oy + delta,
        ];
        const norm = Math.hypot(...coeffs);
        this.COEFFS = coeffs.map((v) => v / norm) as unknown as ConicCoeffs;
    }

    // The conic a·x² + b·xy + c·y² + d·x + e·y + f = 0 of its plane, and its
    // axes: none for an imaginary ellipse or a pair of lines.
    protected setConic(coeffs: readonly number[]): void {
        const norm = Math.hypot(...coeffs);
        const [a, b, c, d, e, f] = coeffs.map((value) => value / norm);
        this.COEFFS = [a, b, c, d, e, f];
        this.defined = false;
        // The eigenvalues of its quadratic part, along e1 and e2.
        const theta = Math.atan2(b, a - c) / 2;
        const half = Math.hypot((a - c) / 2, b / 2);
        const lambdas = [(a + c) / 2 + half, (a + c) / 2 - half];
        const e1: Vec2 = [Math.cos(theta), Math.sin(theta)];
        const e2: Vec2 = [-e1[1], e1[0]];
        const det = 4 * a * c - b * b;
        if (Math.abs(det) <= geometryTolerance(a, b, c)) {
            const curved = Math.abs(lambdas[0]) >= Math.abs(lambdas[1]);
            const l = lambdas[curved ? 0 : 1];
            const u = curved ? e1 : e2;
            const v: Vec2 = [-u[1], u[0]];
            const du = d * u[0] + e * u[1];
            const dv = d * v[0] + e * v[1];
            if (
                Math.abs(l) <= geometryTolerance(a, b, c) ||
                Math.abs(dv) <= geometryTolerance(d, e)
            )
                return;
            // s² = 2p·t in the frame of its vertex, u and v.
            const u0 = -du / (2 * l);
            const v0 = ((du * du) / (4 * l) - f) / dv;
            const p = -dv / (2 * l);
            const at = (s: number, t: number): Vec2 => [
                (u0 + s) * u[0] + (v0 + t) * v[0],
                (u0 + s) * u[1] + (v0 + t) * v[1],
            ];
            this.setBranches("parabola", at(0, 0), [
                (s) => at(s, (s * s) / (2 * p)),
            ]);
            this.axes = [at(0, 0), at(Math.abs(p), 0), at(0, p)].map(
                ([x, y]) => [x, y, 0],
            );
            return;
        }
        const center: Vec2 = [
            (b * e - 2 * c * d) / det,
            (b * d - 2 * a * e) / det,
        ];
        const f0 = (d * center[0] + e * center[1]) / 2 + f;
        const [m1, m2] = lambdas.map((lambda) => -f0 / lambda);
        if (!(m1 > 0 || m2 > 0)) return;
        // Its transverse axis first.
        const [r1, r2, u, v] = m1 > 0 ? [m1, m2, e1, e2] : [m2, m1, e2, e1];
        const [s1, s2] = [Math.sqrt(r1), Math.sqrt(Math.abs(r2))];
        const end = ([x, y]: Vec2, r: number): Vec3 => [
            center[0] + r * x,
            center[1] + r * y,
            0,
        ];
        this.axes = [[...center, 0], end(u, s1), end(v, s2)];
        if (r2 > 0)
            this.setEllipse(
                center,
                [s1 * u[0], s1 * u[1]],
                [s2 * v[0], s2 * v[1]],
            );
        else
            this.setBranches(
                "hyperbola",
                center,
                hyperbolaBranches(center, u, s1, v, s2),
            );
    }

    // Three points of its plane, in plane coordinates, whose affine frame
    // gives the parameter of a point on it: by default, its center and the
    // ends of its semi-axes or, for a parabola, its vertex and two points at
    // the focus-directrix distance p from it, along the directrix and
    // towards the focus.
    protected axes: Vec3[] = [];

    frame(): Vec3[] {
        return this.axes;
    }

    insideBounds(_point: Vec3): boolean {
        return true;
    }

    // PointOn's parameter for a quadric: affine coordinates of a (generally
    // off-curve) point in the frame of the conic's own frame() points,
    // projected onto the true conic — DGPad's own Alpha convention for a
    // point on a quadric, so saved figures round-trip.
    pointAt([g0, g1]: readonly [number, number]): Vec3 {
        const [AA, BB, CC] = this.frame();
        return this.projectPoint(
            this.fromPlane([
                AA[0] + g0 * (BB[0] - AA[0]) + g1 * (CC[0] - AA[0]),
                AA[1] + g0 * (BB[1] - AA[1]) + g1 * (CC[1] - AA[1]),
            ]),
        );
    }

    alphaOf(target: Vec3): readonly [number, number] {
        const [px, py] = this.toPlane(this.projectPoint(target));
        const [AA, BB, CC] = this.frame();
        const a = BB[0] - AA[0],
            b = CC[0] - AA[0],
            d = BB[1] - AA[1],
            e = CC[1] - AA[1];
        const det = a * e - d * b;
        const cx = px - AA[0],
            cy = py - AA[1];
        return [(cx * e - b * cy) / det, (a * cy - cx * d) / det];
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
        const [p, q] = this.toPlane(target);
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
        return best ? this.fromPlane(best) : target;
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

    // GeoGebra's DrawConic: a hyperbola's or a parabola's by its vertex.
    nameAt(): Vec2 | null {
        return this.KIND === "ellipse"
            ? ellipseNameAt(this.centerScreen, this.screenU, this.screenV)
            : this.C.pt3D(this.BRANCHES[0](0));
    }

    anchoredName(offset: number[]): Vec2 | null {
        return this.KIND === "ellipse"
            ? ellipseName(this.centerScreen, this.screenU, this.screenV, offset)
            : super.anchoredName(offset);
    }

    anchorName(at: Vec2): number[] {
        return this.KIND === "ellipse"
            ? ellipseAnchor(this.centerScreen, this.screenU, this.screenV, at)
            : super.anchorName(at);
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
            .stl("stroke-dasharray", t.strokeDashArray)
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
            .stl("stroke-dasharray", t.strokeDashArray)
            .stl("pointer-events", "none");
        return dom.add(
            t.ellipseHitArea,
            t.ellipsePath,
            t.curveHitArea,
            t.curvePath,
        );
    }
}

export function hyperbolaBranches(
    center: Vec2,
    transverseDir: Vec2,
    semiTransverse: number,
    conjugateDir: Vec2,
    semiConjugate: number,
): ((t: number) => Vec2)[] {
    const branch =
        (sign: 1 | -1) =>
        (t: number): Vec2 => {
            const u = sign * semiTransverse * Math.cosh(t);
            const v = semiConjugate * Math.sinh(t);
            return [
                center[0] + u * transverseDir[0] + v * conjugateDir[0],
                center[1] + u * transverseDir[1] + v * conjugateDir[1],
            ];
        };
    return [branch(1), branch(-1)];
}

// The value of DGPad's "conic.center()", the middle of its foci, as a
// point's (see scriptValue): none for a parabola, whose CENTER is its vertex.
export function scriptCenter(
    object: construction_object,
    vec3: boolean,
): ScriptValue | null {
    if (
        !(object instanceof primitive_quadric_object) ||
        !object.defined ||
        object.KIND === "parabola"
    )
        return null;
    const center = object.CENTER;
    if (!vec3) return [center[0], center[1]];
    return object.C.GRID.FRAME2D && object.flat
        ? object.C.screenPlaneCoords(center)
        : [...center];
}
