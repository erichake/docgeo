import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import { usesView } from "../import/dgp_formula";
import { viewDirection, viewRay } from "../projection";
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
import { solid_object } from "./solid_object";
import { convexHull } from "./sphere_object";

// Rim points of its silhouette, generators of its shading.
const SAMPLES = 48;
const STOPS = 24;
let gradients = 0;

// GeoGebra's limited cylinder of axis AB and radius r, or its cone of base
// centered at A and apex B: radius r at A, r or 0 at B. Drawn as its
// silhouette, lit along its generators; it hides what lies behind it, as
// its faces would (see hidden_line.ts).
export class revolution_object extends solid_object {
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
    readonly fill = `url(#revolution-gradient-${++gradients})`;
    private path!: DOMElement;
    private gradient!: DOMElement;
    private edges!: DOMElement;
    private hiddenEdges!: DOMElement;
    private stops: DOMElement[] = [];

    constructor(
        c: construction,
        name: string | null | undefined,
        a: point_object,
        b: point_object,
        radius: circle1_radius,
        cone: boolean,
    ) {
        super(c, name);
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

    // Its side, extended beyond its disks, is where F = d² - r² vanishes, d
    // being the distance to its axis and r its radius at that height from
    // A, R0 + g·s: F(origin + l·ray) = qa·l² + qb·l + qc.
    quadratic(origin: Vec3, ray: Vec3): [number, number, number] {
        const w = this.AXIS;
        const g = (this.R1 - this.R0) / this.HEIGHT;
        const m = vSub(origin, this.A.coords);
        const [s0, s1] = [vDot(m, w), vDot(ray, w)];
        const mp = vSub(m, vScale(w, s0));
        const dp = vSub(ray, vScale(w, s1));
        const r0 = this.R0 + g * s0;
        return [
            vDot(dp, dp) - g * g * s1 * s1,
            2 * (vDot(mp, dp) - g * s1 * r0),
            vDot(mp, mp) - r0 * r0,
        ];
    }

    // Half the gradient of F at `point`.
    normal(point: Vec3): Vec3 {
        const g = (this.R1 - this.R0) / this.HEIGHT;
        const m = vSub(point, this.A.coords);
        const s = vDot(m, this.AXIS);
        return vSub(
            vSub(m, vScale(this.AXIS, s)),
            vScale(this.AXIS, g * (this.R0 + g * s)),
        );
    }

    // The point of its side at [cos t, sin t] around its axis, from U
    // towards V, at fraction h of its height from A.
    pointAt([x, y, h]: Vec3): Vec3 | null {
        const radial = vNormalize([x, y, 0] as Vec3);
        if (!radial) return null;
        return vAdd(
            vAdd(this.A.coords, vScale(this.AXIS, h * this.HEIGHT)),
            vScale(
                vAdd(vScale(this.U, radial[0]), vScale(this.V, radial[1])),
                this.R0 + (this.R1 - this.R0) * h,
            ),
        );
    }

    // That of the point of its side nearest `target`, across its axis.
    alphaOf(target: Vec3): Vec3 {
        const m = vSub(target, this.A.coords);
        const h = Math.min(Math.max(vDot(m, this.AXIS) / this.HEIGHT, 0), 1);
        const [x, y] = vNormalize([
            vDot(m, this.U),
            vDot(m, this.V),
        ] as Vec2) ?? [1, 0];
        return [x, y, h];
    }

    // Where the line origin + l·ray meets its side, extended beyond its
    // disks: its parameters l, increasing.
    meet(origin: Vec3, ray: Vec3): number[] {
        const [qa, qb, qc] = this.quadratic(origin, ray);
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
        const view = viewRay(screen, a, frame);
        if (!view) return null;
        const [origin, ray] = view;
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
        if (this.size > 0) this.renderEdges();
        // Seen through, its far side too, as GeoGebra draws it.
        this.path.stl("fill-opacity", 1 - (1 - (this.opacity ?? 0)) ** 2);
        this.path.att("d", pathData(this.outline));
    }

    // The rims of its disks, dashed where it hides them, and the
    // generators of its outline, between a rim and the other or the apex.
    private renderEdges(): void {
        const paths = ["", ""];
        const at = ([x, y]: Vec2) => `${x} ${y}`;
        (this.cone ? [false] : [false, true]).forEach((top) => {
            let previous: number | null = null;
            for (let k = 0; k <= SAMPLES; k++) {
                const point = this.rim(top, (2 * Math.PI * k) / SAMPLES);
                const hidden = +this.hides(point);
                const screen = at(this.C.pt3D(point));
                if (previous === null) paths[hidden] += ` M${screen}`;
                else if (previous === hidden) paths[hidden] += ` L${screen}`;
                else {
                    paths[previous] += ` L${screen}`;
                    paths[hidden] += ` M${screen}`;
                }
                previous = hidden;
            }
        });
        const tops = new Set(
            Array.from({ length: SAMPLES }, (_, k) =>
                at(this.C.pt3D(this.rim(true, (2 * Math.PI * k) / SAMPLES))),
            ),
        );
        this.outline.forEach((p, i) => {
            const q = this.outline[(i + 1) % this.outline.length];
            if (tops.has(at(p)) !== tops.has(at(q)))
                paths[0] += ` M${at(p)} L${at(q)}`;
        });
        this.edges.att("d", paths[0]);
        this.hiddenEdges.att("d", paths[1]);
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
        const stroke = (dash: string) =>
            t.svg
                .shape("path")
                .stl("fill", "none")
                .stl("stroke", t.stroke_color)
                .stl("stroke-width", t.size)
                .stl("stroke-dasharray", dash)
                .stl("pointer-events", "none");
        t.edges = stroke(t.strokeDashArray);
        t.hiddenEdges = stroke(`${t.size * 3} ${t.size * 2}`);
        return t.svg
            .shape("g")
            .add(
                t.svg.shape("defs").add(t.gradient),
                t.path,
                t.edges,
                t.hiddenEdges,
            );
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
