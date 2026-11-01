import { advance, type Animation } from "../animation";
import type { construction } from "../construction";
import {
    projectPointOnLine,
    projectPointOnPlane,
    viewRay,
} from "../projection";
import {
    vAdd,
    vDot,
    vIsFinite,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import { angle_bisector_object } from "./angle_bisector_object";
import { primitive_arc_object } from "./primitive_arc_object";
import { circle3pts_object, SAMPLES } from "./circle3pts_object";
import type { curve_object } from "./curve_object";
import type { DgoContext } from "./construction_object";
import { fixed_angle_object } from "./fixed_angle_object";
import { list_object } from "./list_object";
import type { locus_object } from "./locus_object";
import { polygon_object } from "./polygon_object";
import { primitive_circle_object } from "./primitive_circle_object";
import { primitive_line_object } from "./primitive_line_object";
import { point_object } from "./point_object";
import { primitive_quadric_object } from "./primitive_quadric_object";
import { ray_line_object } from "./ray_line_object";
import { revolution_object } from "./revolution_object";
import { segment_object } from "./segment_object";
import { sphere_object } from "./sphere_object";
import { two_points_line_object } from "./two_points_line_object";

export type point_support_object =
    | primitive_line_object
    | primitive_circle_object
    | polygon_object
    | primitive_quadric_object
    | locus_object
    | list_object
    | curve_object
    | surface_object;

// A sphere, or the side of a cylinder or of a cone.
export type surface_object = sphere_object | revolution_object;

const isSurface = (object: point_support_object): object is surface_object =>
    object instanceof sphere_object || object instanceof revolution_object;

type Alpha = number | readonly [number, number] | Vec3;

const TWO_PI = 2 * Math.PI;
// The longest step along a conic, in screen pixels.
const GLIDE = 4;

const angle = (alpha: number) => ((alpha % TWO_PI) + TWO_PI) % TWO_PI;

// GeoGebra's PathNormalizer: a path's parameter from `min` to `max`, maybe
// infinite, to one from 0 to 1, and back.
const toInfinity = (t: number) => t / (1 - Math.abs(t));
const fromInfinity = (t: number) => t / (1 + Math.abs(t));

function normalize(t: number, min: number, max: number): number {
    t = Math.min(Math.max(t, min), max);
    if (min === -Infinity)
        return max === Infinity
            ? 0.5 + 0.5 * fromInfinity(t)
            : 1 + fromInfinity(t - max);
    if (max === Infinity) return fromInfinity(t - min);
    return (t - min) / (max - min);
}

function denormalize(t: number, min: number, max: number): number {
    if (min === -Infinity)
        return max === Infinity
            ? toInfinity(2 * t - 1)
            : max + toInfinity(t - 1);
    if (max === Infinity) return min + toInfinity(t);
    return min + t * (max - min);
}

export class point_on_object extends point_object {
    support: point_support_object;
    alpha: Alpha;
    onBoundary: boolean;
    animation: Animation | null = null;
    // DGPad's parameter on a Circle3pts3D, which becomes its angle once the
    // circle is computed (see circle3pts_object.dgpadSample).
    dgpadSample: number | null = null;

    constructor(
        c: construction,
        name: string | null | undefined,
        support: point_support_object,
        alpha: Alpha,
    ) {
        super(c, name, [0, 0, 0]);
        this.support = support;
        this.alpha = alpha;
        this.onBoundary = false;
        this.addParents(support);
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["On", [context.index(this.support), this.alpha]];
    }

    outputState(): unknown[] {
        return [this.alpha];
    }

    computeGeometry(): void {
        if (!this.support.defined) {
            this.defined = false;
            return;
        }
        if (this.support.familytype === "locus") {
            const coords = (this.support as locus_object).pointAt(
                this.alpha as number,
            );
            if (!coords) {
                this.defined = false;
                return;
            }
            this.coords = coords;
        } else if (this.support instanceof list_object) {
            const coords = this.support.pointAt(this.alpha as number);
            if (!coords) {
                this.defined = false;
                return;
            }
            this.coords = coords;
        } else if (this.support.familytype === "curve") {
            const coords = (this.support as curve_object).pointAt(
                this.alpha as number,
            );
            if (!coords) {
                this.defined = false;
                return;
            }
            this.coords = coords;
        } else if (this.support instanceof primitive_circle_object) {
            if (this.dgpadSample !== null) {
                this.alpha = this.support.alphaOf(
                    (this.support as circle3pts_object).dgpadSample(
                        this.dgpadSample,
                    ),
                );
                this.dgpadSample = null;
            }
            this.coords = this.support.pointAt(this.alpha as number);
        } else if (this.support instanceof polygon_object) {
            const coords = this.support.pointAt(
                this.alpha as readonly [number, number],
                this.onBoundary,
            );
            if (!coords) {
                this.defined = false;
                return;
            }
            this.coords = coords;
            this.alpha = this.support.alphaOf(coords, this.onBoundary)!;
        } else if (this.support instanceof primitive_quadric_object) {
            this.coords = this.support.pointAt(
                this.alpha as readonly [number, number],
            );
        } else if (isSurface(this.support)) {
            const coords = this.support.pointAt(this.alpha as Vec3);
            if (!coords) {
                this.defined = false;
                return;
            }
            this.coords = coords;
        } else if (this.support instanceof two_points_line_object) {
            this.coords = vAdd(
                this.support.P1.coords,
                vScale(
                    vSub(this.support.P2.coords, this.support.P1.coords),
                    this.alpha as number,
                ),
            );
        } else {
            // On a line built from a point and a direction, the distance
            // from that point (see the PointOn command for DGPad's pixels).
            const support = this.support as primitive_line_object;
            this.coords = vAdd(
                support.P1.coords,
                vScale(support.VEC, this.alpha as number),
            );
        }
        super.computeGeometry();
    }

    mousedrag(ev: PointerEvent): void {
        const screen = this.C.pointerPosition(ev);
        if (this.support.familytype === "locus") {
            const alpha = (this.support as locus_object).alphaAtScreen(screen);
            if (alpha === null) return;
            this.alpha = alpha;
            this.C.invalidateGeometry(this);
            return;
        }
        if (this.support instanceof list_object) {
            const alpha = this.support.alphaAtScreen(screen);
            if (alpha === null) return;
            this.alpha = alpha;
            this.C.invalidateGeometry(this);
            return;
        }
        if (this.support.familytype === "curve") {
            const alpha = (this.support as curve_object).alphaAtScreen(screen);
            if (alpha === null) return;
            this.alpha = alpha;
            this.C.invalidateGeometry(this);
            return;
        }
        const target = this.dragTarget(screen);
        if (!target) return;
        const alpha = this.alphaFor(this.snapToIncrement(target));
        if (alpha === null) return;
        this.alpha = alpha;
        this.C.invalidateGeometry(this);
    }

    // As in DGPad: along a line or a polygon's edges, `speed` pixels per
    // second on the screen; on a circle, radians per second; on a locus or a
    // Circle3pts3D, five times as many of its samples. DGPad doesn't animate
    // a point on a conic: as on a polygon, pixels per second.
    animate(seconds: number): void {
        const support = this.support;
        if (!support.defined) return;
        const step =
            this.animation!.direction * this.animation!.speed * seconds;
        if (this.animation!.geogebra) {
            const path = this.geogebraPath();
            if (!path || !(path[2] > path[1])) return;
            const [t, min, max, move] = path;
            move(
                denormalize(
                    advance(
                        this.animation!,
                        normalize(t, min, max),
                        0,
                        1,
                        step / 10,
                    ),
                    min,
                    max,
                ),
            );
        } else if (support instanceof circle3pts_object && support.space)
            this.alpha = support.alphaOf(
                support.dgpadSample(
                    advance(
                        this.animation!,
                        support.dgpadIndex(this.coords),
                        0,
                        3 * SAMPLES - 1,
                        5 * step,
                    ),
                ),
            );
        else if (support instanceof primitive_circle_object) {
            // DGPad's angles run from 0 to 2π.
            const alpha = (this.alpha as number) % TWO_PI;
            this.alpha = advance(
                this.animation!,
                alpha < 0 ? alpha + TWO_PI : alpha,
                0,
                TWO_PI,
                step,
            );
        } else if (support.familytype === "locus")
            this.alpha = advance(
                this.animation!,
                this.alpha as number,
                0,
                (support as locus_object).points.length - 1,
                5 * step,
            );
        else if (support instanceof polygon_object) {
            const alpha = this.walk(support, step);
            if (!alpha) return;
            this.alpha = alpha;
        } else if (support instanceof primitive_quadric_object) {
            const alpha = this.glide(support, step);
            if (!alpha) return;
            this.alpha = alpha;
        } else if (support instanceof primitive_line_object) {
            const range = this.lineRange(support);
            if (!range) return;
            this.alpha = advance(
                this.animation!,
                this.alpha as number,
                range[0],
                range[1],
                step / range[2],
            );
        } else return;
        this.C.invalidateGeometry(this);
    }

    // GeoGebra's parameter of the point on its path, its range and how to
    // move the point to another: an angle from -π to π on a circle, from 0
    // to 1 along an arc or a segment, an edge per unit around a polygon.
    private geogebraPath():
        [number, number, number, (t: number) => void] | null {
        const support = this.support;
        const alpha = this.alpha as number;
        const set = (t: number) => (this.alpha = t);
        if (support instanceof primitive_arc_object) {
            const from = support.startAlpha;
            const sign = support.sweepFlag ? 1 : -1;
            const span = angle(sign * (support.endAlpha - from));
            if (!(span > 0)) return null;
            // Beyond the arc, the nearest of its ends.
            let t = angle(sign * (alpha - from));
            if (t > span) t = t - span < (TWO_PI - span) / 2 ? span : 0;
            return [t / span, 0, 1, (t) => set(from + sign * t * span)];
        }
        if (support instanceof primitive_circle_object)
            return [angle(alpha + Math.PI) - Math.PI, -Math.PI, Math.PI, set];
        if (support instanceof segment_object) return [alpha, 0, 1, set];
        if (support instanceof ray_line_object)
            return [alpha, 0, Infinity, set];
        if (support instanceof primitive_line_object)
            return [alpha, -Infinity, Infinity, set];
        if (support.familytype === "locus")
            return [alpha, 0, (support as locus_object).points.length - 1, set];
        if (support.familytype === "curve") {
            const { min, max } = support as curve_object;
            return [alpha, min ?? -Infinity, max ?? Infinity, set];
        }
        if (!(support instanceof polygon_object) || !this.onBoundary)
            return null;
        const vertices = support.points.map((point) => point.coords);
        const count = vertices.length;
        let edge = 0;
        let along = 0;
        let gap = Infinity;
        vertices.forEach((start, index) => {
            const direction = vSub(vertices[(index + 1) % count], start);
            const length = vDot(direction, direction);
            const t =
                length > 0
                    ? Math.min(
                          Math.max(
                              vDot(vSub(this.coords, start), direction) /
                                  length,
                              0,
                          ),
                          1,
                      )
                    : 0;
            const offset = vSub(vAdd(start, vScale(direction, t)), this.coords);
            if (vDot(offset, offset) < gap) {
                gap = vDot(offset, offset);
                edge = index;
                along = t;
            }
        });
        return [
            edge + along,
            0,
            count,
            (t) => {
                const edge = Math.min(Math.floor(t), count - 1);
                const start = vertices[edge];
                const alpha = support.alphaOf(
                    vAdd(
                        start,
                        vScale(
                            vSub(vertices[(edge + 1) % count], start),
                            t - edge,
                        ),
                    ),
                    true,
                );
                if (alpha) this.alpha = alpha;
            },
        ];
    }

    // The parameters of the line's visible part, as in DGPad, from a ray's
    // origin, a segment's being its own, and the length on the screen of a
    // unit of them.
    private lineRange(
        support: primitive_line_object,
    ): [number, number, number] | null {
        const origin = support.P1.coords;
        const [x, y] = this.C.pt3D(origin);
        const [ex, ey] = this.C.pt3D(
            vAdd(
                origin,
                support instanceof two_points_line_object
                    ? vSub(support.P2.coords, origin)
                    : support.VEC,
            ),
        );
        const [dx, dy] = [ex - x, ey - y];
        const length = Math.hypot(dx, dy);
        if (!(length > 0)) return null;
        if (support instanceof segment_object) return [0, 1, length];
        let [low, high] = [-Infinity, Infinity];
        [
            [x, dx, this.C.width],
            [y, dy, this.C.height],
        ].forEach(([start, delta, size]) => {
            if (delta === 0) return;
            const ends = [-start / delta, (size - start) / delta];
            low = Math.max(low, Math.min(...ends));
            high = Math.min(high, Math.max(...ends));
        });
        if (
            support instanceof ray_line_object ||
            support instanceof angle_bisector_object ||
            support instanceof fixed_angle_object
        )
            low = 0;
        return low < high ? [low, high, length] : null;
    }

    // Along the conic by a few pixels at a time, each along its tangent and
    // back onto it. An ellipse goes round; a branch of a parabola or of a
    // hyperbola turns back where it would leave the window, an arc at its
    // ends.
    private glide(conic: primitive_quadric_object, step: number): Alpha | null {
        const c = this.C;
        const [a, b, cc, d, e] = conic.COEFFS!;
        const animation = this.animation!;
        const center: Vec2 = [c.width / 2, c.height / 2];
        const outside = ([x, y]: Vec2) =>
            x < 0 || y < 0 || x > c.width || y > c.height;
        let coords = this.coords;
        let sign = Math.sign(step);
        for (let left = Math.abs(step); left > 0; left -= GLIDE) {
            const [x, y] = conic.toPlane(coords);
            const tangent = vNormalize([
                -(b * x + 2 * cc * y + e),
                2 * a * x + b * y + d,
            ] as Vec2);
            if (!tangent) return null;
            const from = c.pt3D(coords);
            const pixels = vNorm(
                vSub(c.pt3D(conic.fromPlane(vAdd([x, y], tangent))), from),
            );
            const along = (sign * Math.min(left, GLIDE)) / pixels;
            const next = conic.projectPoint(
                conic.fromPlane(vAdd([x, y], vScale(tangent, along))),
            );
            const to = c.pt3D(next);
            if (
                (conic.KIND !== "ellipse" &&
                    outside(to) &&
                    vNorm(vSub(to, center)) > vNorm(vSub(from, center))) ||
                !conic.insideBounds(next)
            ) {
                if (animation.once) {
                    animation.speed = 0;
                    break;
                }
                animation.direction *= -1;
                sign = -sign;
            } else coords = next;
        }
        return conic.alphaOf(coords);
    }

    // DGPad's: from the edge the point is on, as far along the polygon's
    // boundary on the screen, wrapping to the next or the previous edge.
    private walk(polygon: polygon_object, step: number): Alpha | null {
        const count = polygon.points.length;
        if (count < 2) return null;
        const screens = polygon.points.map((point) =>
            this.C.pt3D(point.coords),
        );
        const point = this.C.pt3D(this.coords);
        const distance = (a: Vec2, b: Vec2) =>
            Math.hypot(a[0] - b[0], a[1] - b[1]);
        const edgeLength = (edge: number) =>
            distance(screens[edge], screens[(edge + 1) % count]);
        let edge = 0;
        let gap = Infinity;
        screens.forEach((start, index) => {
            const offset =
                distance(start, point) +
                distance(point, screens[(index + 1) % count]) -
                edgeLength(index);
            if (offset < gap) {
                gap = offset;
                edge = index;
            }
        });
        let along = distance(screens[edge], point) + step;
        if (along > edgeLength(edge)) {
            along -= edgeLength(edge);
            edge = (edge + 1) % count;
        } else if (along < 0) {
            edge = (edge + count - 1) % count;
            along += edgeLength(edge);
        }
        const start = polygon.points[edge].coords;
        const end = polygon.points[(edge + 1) % count].coords;
        const length = edgeLength(edge);
        return polygon.alphaOf(
            length > 0
                ? vAdd(start, vScale(vSub(end, start), along / length))
                : start,
            this.onBoundary,
        );
    }

    private dragTarget(screen: Vec2): Vec3 | null {
        if (isSurface(this.support))
            return this.surfaceTarget(this.support, screen);
        if (
            this.support instanceof polygon_object &&
            this.support.points.length >= 3
        )
            return projectPointOnPlane(
                screen,
                this.support.points[0].coords,
                [
                    vSub(
                        this.support.points[1].coords,
                        this.support.points[0].coords,
                    ),
                    vSub(
                        this.support.points[2].coords,
                        this.support.points[0].coords,
                    ),
                ],
                this.C.projectionFrame,
            );
        // A line/segment/ray's own direction can be anything in 3D (e.g. a
        // vertical cube edge): projecting onto the fixed Z=this.z plane
        // below only recovers real movement for a support that happens to
        // lie within that plane, and otherwise leaves the point stuck (the
        // recovered target's Z never moves off this.z, so its projection
        // onto the line's direction barely changes). Solving directly for
        // the point of the line itself whose projection lands on the
        // cursor handles any orientation.
        if (this.support instanceof two_points_line_object)
            return projectPointOnLine(
                screen,
                this.support.P1.coords,
                vSub(this.support.P2.coords, this.support.P1.coords),
                this.C.projectionFrame,
            );
        if (this.support instanceof primitive_circle_object)
            return projectPointOnPlane(
                screen,
                this.support.CENTER,
                [this.support.U, this.support.V],
                this.C.projectionFrame,
            );
        if (this.support instanceof primitive_line_object)
            return projectPointOnLine(
                screen,
                this.support.P1.coords,
                this.support.VEC,
                this.C.projectionFrame,
            );
        if (this.support instanceof primitive_quadric_object)
            return projectPointOnPlane(
                screen,
                this.support.ORIGIN,
                this.support.PLANE,
                this.C.projectionFrame,
            );
        return this.C.unprojectToZPlane(screen, this.z);
    }

    // The point stays on the side of the surface it is on, which a point
    // dragged onto its outline leaves for the near side.
    private surfaceTarget(support: surface_object, screen: Vec2): Vec3 | null {
        const own = viewRay(
            this.C.pt3D(this.coords),
            this.coords,
            this.C.projectionFrame,
        );
        if (!own) return null;
        const normal = support.normal(this.coords);
        return surfacePoint(
            support,
            screen,
            vDot(normal, own[1]) > 1e-9 * vNorm(normal) * vNorm(own[1]),
        );
    }

    alphaFor(target: Vec3): Alpha | null {
        if (this.support.familytype === "curve") return target[0];
        if (this.support.familytype === "locus")
            return (this.support as locus_object).alphaOf(target);
        if (this.support instanceof list_object)
            return this.support.nearestIndex(target);
        if (this.support instanceof primitive_circle_object) {
            return this.support.alphaOf(target);
        }
        if (this.support instanceof polygon_object) {
            return this.support.alphaOf(target, this.onBoundary);
        }
        if (
            this.support instanceof primitive_quadric_object ||
            isSurface(this.support)
        ) {
            return this.support.alphaOf(target);
        }
        if (this.support instanceof two_points_line_object) {
            const direction = vSub(
                this.support.P2.coords,
                this.support.P1.coords,
            );
            let alpha =
                vDot(vSub(target, this.support.P1.coords), direction) /
                vDot(direction, direction);
            if (this.support instanceof segment_object) {
                alpha = Math.max(0, Math.min(1, alpha));
            } else if (this.support instanceof ray_line_object) {
                alpha = Math.max(0, alpha);
            }
            return alpha;
        }
        const support = this.support as primitive_line_object;
        return vDot(vSub(target, support.P1.coords), support.VEC);
    }
}

// Where the view ray through `screen` enters the surface, or leaves it if
// `far`; where the ray passes nearest it when it misses it, on its outline.
export function surfacePoint(
    support: surface_object,
    screen: Vec2,
    far: boolean,
): Vec3 | null {
    const view = viewRay(
        screen,
        support instanceof sphere_object ? support.CENTER : support.A.coords,
        support.C.projectionFrame,
    );
    if (!view) return null;
    const [a, b, c] = support.quadratic(...view);
    const root = Math.sqrt(Math.max(0, b * b - 4 * a * c));
    const [near, back] = [(-b - root) / (2 * a), (-b + root) / (2 * a)]
        // A cone's a may be negative.
        .sort((l, k) => l - k);
    const point = vAdd(view[0], vScale(view[1], far ? back : near));
    return vIsFinite(point) ? point : null;
}

export function createPointOn(
    c: construction,
    name: string | null | undefined,
    support: point_support_object,
    alpha: Alpha,
): point_on_object {
    return c.add(new point_on_object(c, name, support, alpha));
}
