import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import { usesView } from "../import/dgp_formula";
import { projectPointOnPlane, viewDirection } from "../projection";
import {
    geometryTolerance,
    vAdd,
    vCross,
    vDot,
    vIsFinite,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import { dgoRadius, radiusValue, type circle1_radius } from "./circle1_object";
import { construction_object, type DgoContext } from "./construction_object";
import type { point_object } from "./point_object";
import { lighting, pathData, shade } from "./polygon_object";
import { convexHull } from "./sphere_object";

// Rim points of its silhouette, generators of its shading.
const SAMPLES = 48;
const STOPS = 24;
let gradients = 0;

// GeoGebra's limited cylinder of axis AB and radius r, or its cone of base
// centered at A and apex B: radius r at A, r or 0 at B. Drawn as its
// silhouette, lit along its generators; it hides what lies behind it, as
// its faces would (see hidden_line.ts).
export class revolution_object extends construction_object {
    A: point_object;
    B: point_object;
    radius: circle1_radius;
    cone: boolean;
    // Its unit axis, its height and its radii at A and B; U, V span the
    // planes of its disks, from (-sin θ, cos θ, 0), θ = atan2(y, x) of AB,
    // orthogonal to AB even when AB is vertical, since atan2(0, 0) = 0.
    AXIS: Vec3 = [0, 0, 1];
    HEIGHT = 0;
    R0 = 0;
    R1 = 0;
    U: Vec3 = [1, 0, 0];
    V: Vec3 = [0, 1, 0];
    projectionDefined = true;
    outline: Vec2[] = [];
    readonly fill = `url(#revolution-gradient-${++gradients})`;
    private path!: DOMElement;
    private gradient!: DOMElement;
    private stops: DOMElement[] = [];

    constructor(
        c: construction,
        name: string | null | undefined,
        a: point_object,
        b: point_object,
        radius: circle1_radius,
        cone: boolean,
    ) {
        super(c, name, "polygon");
        this.familytype = "solid";
        this.A = a;
        this.B = b;
        this.radius = radius;
        this.cone = cone;
        this.readsView = typeof radius !== "number" && usesView(radius.formula);
        this.addParents(
            a,
            b,
            ...(typeof radius === "number" ? [] : radius.refs.values()),
        );
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            this.cone ? "Cone" : "Cyl",
            [
                context.index(this.A),
                context.index(this.B),
                dgoRadius(this.radius, context),
            ],
        ];
    }

    computeGeometry(): void {
        const axis = vSub(this.B.coords, this.A.coords);
        const unit = vNormalize(axis);
        const radius = radiusValue(this.radius, this.C);
        this.defined =
            this.A.defined &&
            this.B.defined &&
            !!unit &&
            radius !== null &&
            radius > 0;
        if (!this.defined) return;
        const theta = Math.atan2(axis[1], axis[0]);
        this.AXIS = unit!;
        this.HEIGHT = vNorm(axis);
        this.R0 = radius!;
        this.R1 = this.cone ? 0 : radius!;
        this.U = [-Math.sin(theta), Math.cos(theta), 0];
        this.V = vCross(unit!, this.U);
    }

    // The point of its rim at A (or at B) at angle t.
    rim(top: boolean, t: number): Vec3 {
        return vAdd(
            (top ? this.B : this.A).coords,
            vScale(
                vAdd(vScale(this.U, Math.cos(t)), vScale(this.V, Math.sin(t))),
                top ? this.R1 : this.R0,
            ),
        );
    }

    project(): void {
        this.projectionDefined = false;
        if (!this.defined) return;
        const points = Array.from({ length: SAMPLES }, (_, k) => {
            const t = (2 * Math.PI * k) / SAMPLES;
            return [this.rim(false, t), this.rim(true, t)];
        })
            .flat()
            .map((point) => this.C.pt3D(point));
        if (!points.every(vIsFinite)) return;
        this.outline = convexHull(points);
        this.projectionDefined = true;
    }

    // Where the line origin + l·ray meets its side, extended beyond its
    // disks: its parameters l, increasing. Its radius at height s from A is
    // R0 + g·s.
    meet(origin: Vec3, ray: Vec3): number[] {
        const w = this.AXIS;
        const g = (this.R1 - this.R0) / this.HEIGHT;
        const m = vSub(origin, this.A.coords);
        const [s0, s1] = [vDot(m, w), vDot(ray, w)];
        const mp = vSub(m, vScale(w, s0));
        const dp = vSub(ray, vScale(w, s1));
        const r0 = this.R0 + g * s0;
        const qa = vDot(dp, dp) - g * g * s1 * s1;
        const qb = 2 * (vDot(mp, dp) - g * s1 * r0);
        const qc = vDot(mp, mp) - r0 * r0;
        const disc = qb * qb - 4 * qa * qc;
        if (disc < -geometryTolerance(qb * qb, 4 * qa * qc)) return [];
        return [-1, 1]
            .map(
                (sign) =>
                    (-qb + sign * Math.sqrt(Math.max(0, disc))) / (2 * qa),
            )
            .sort((l, k) => l - k);
    }

    // Where the view ray through `screen` enters it, by its depth along
    // the view direction (larger is farther): null if it misses it.
    entryDepth(screen: Vec2): number | null {
        const frame = this.C.projectionFrame;
        const dir = vNormalize(viewDirection(frame))!;
        const a = this.A.coords;
        const across = vNormalize(vCross(dir, this.AXIS)) ?? this.U;
        const origin = projectPointOnPlane(
            screen,
            a,
            [across, vCross(dir, across)],
            frame,
        );
        if (!origin) return null;
        const ray =
            frame.focal === undefined
                ? dir
                : vSub(origin, vScale(dir, -frame.focal));
        const w = this.AXIS;
        const h = this.HEIGHT;
        const m = vSub(origin, a);
        const [s0, s1] = [vDot(m, w), vDot(ray, w)];
        // Between its disks, not on the cone's other nappe.
        const hits = this.meet(origin, ray).filter((l) => {
            const s = s0 + l * s1;
            return s >= 0 && s <= h;
        });
        // Its disks.
        [
            [0, this.R0],
            [h, this.R1],
        ].forEach(([s, r]) => {
            const l = (s - s0) / s1;
            const point = vAdd(m, vScale(ray, l));
            const off = vSub(point, vScale(w, vDot(point, w)));
            if (r > 0 && vDot(off, off) <= r * r) hits.push(l);
        });
        const depths = hits
            .filter(Number.isFinite)
            .map((l) => vDot(vAdd(origin, vScale(ray, l)), dir));
        return depths.length ? Math.min(...depths) : null;
    }

    // Whether it hides `point`, behind its surface seen from the camera.
    hides(point: Vec3): boolean {
        const entry = this.entryDepth(this.C.pt3D(point));
        const depth = vDot(
            point,
            vNormalize(viewDirection(this.C.projectionFrame))!,
        );
        return (
            entry !== null && depth - entry > geometryTolerance(depth, entry)
        );
    }

    render(): void {
        this.dom.stl(
            "display",
            this.isVisible && this.projectionDefined ? "block" : "none",
        );
        if (!this.defined || !this.projectionDefined) return;
        // Lit along its generators facing the camera, across its outline.
        const a = this.C.pt3D(this.A.coords);
        const axis = vNormalize(vSub(this.C.pt3D(this.B.coords), a));
        const across: Vec2 = axis ? [-axis[1], axis[0]] : [1, 0];
        const offsets = this.outline.map((p) => vDot(vSub(p, a), across));
        const [low, high] = [Math.min(...offsets), Math.max(...offsets)];
        const dir = vNormalize(viewDirection(this.C.projectionFrame))!;
        const stops = Array.from({ length: STOPS }, (_, k) => {
            const t = (2 * Math.PI * k) / STOPS;
            const p = this.C.pt3D(this.rim(false, t));
            // Outward, tilted for a cone.
            const normal = vNormalize(
                vAdd(
                    vScale(
                        vAdd(
                            vScale(this.U, Math.cos(t)),
                            vScale(this.V, Math.sin(t)),
                        ),
                        this.HEIGHT,
                    ),
                    vScale(this.AXIS, this.R0 - this.R1),
                ),
            )!;
            return {
                offset: (vDot(vSub(p, a), across) - low) / (high - low || 1),
                factor: lighting(this.C, normal),
                facing: vDot(normal, dir) < 0,
            };
        })
            .filter(({ facing }) => facing)
            .sort((p, q) => p.offset - q.offset);
        this.gradient
            .att("x1", a[0] + across[0] * low)
            .att("y1", a[1] + across[1] * low)
            .att("x2", a[0] + across[0] * high)
            .att("y2", a[1] + across[1] * high);
        this.stops.forEach((stop, k) => {
            const { offset, factor } = stops[Math.min(k, stops.length - 1)] ?? {
                offset: 0,
                factor: 1,
            };
            stop.att("offset", offset).stl(
                "stop-color",
                shade(this.fill_color, factor),
            );
        });
        // Seen through, its far side too, as GeoGebra draws it.
        this.path.stl("fill-opacity", 1 - (1 - (this.opacity ?? 0)) ** 2);
        this.path.att("d", pathData(this.outline));
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as revolution_object;
        t.stops = Array.from({ length: STOPS }, () => t.svg.shape("stop"));
        t.gradient = t.svg
            .shape("linearGradient")
            .att("id", t.fill.slice(5, -1))
            .att("gradientUnits", "userSpaceOnUse")
            .add(...t.stops);
        t.path = t.svg
            .shape("path")
            .stl("fill", t.fill)
            .stl("fill-opacity", t.opacity ?? 0)
            .stl("stroke", "none")
            .stl("pointer-events", "none");
        return t.svg
            .shape("g")
            .add(t.svg.shape("defs").add(t.gradient), t.path);
    }
}

export function createRevolution(
    c: construction,
    name: string | null | undefined,
    a: point_object,
    b: point_object,
    radius: circle1_radius,
    cone: boolean,
): revolution_object {
    return c.add(new revolution_object(c, name, a, b, radius, cone));
}
