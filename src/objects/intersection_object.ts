import type { construction } from "../construction";
import {
    GEOMETRY_EPSILON,
    geometryTolerance,
    numEqual,
    vAdd,
    vCross,
    vDot,
    vIsFinite,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec3,
} from "../vec";
import {
    conicConicIntersectionsXY,
    lineConicIntersections,
    type ConicCoeffs,
} from "./conic_algebra";
import type { construction_object } from "./construction_object";
import type { curve_object } from "./curve_object";
import { point_object } from "./point_object";
import { primitive_circle_object } from "./primitive_circle_object";
import { primitive_line_object } from "./primitive_line_object";
import { primitive_quadric_object } from "./primitive_quadric_object";

export type intersectable_object =
    | primitive_line_object
    | primitive_circle_object
    | primitive_quadric_object
    | curve_object;

const CURVE_ROOT_SAMPLES = 3000;

// A circle restricted to the flat (x,y) plane it lies in, in the same
// implicit form as a Quadric — a circle is just a conic of that special
// shape — so one conic×conic solver (see conic_algebra.ts) handles both
// circle×quadric and quadric×quadric intersections.
function circleAsConic(circle: primitive_circle_object): ConicCoeffs {
    const [cx, cy] = circle.CENTER;
    return [1, 0, 1, -2 * cx, -2 * cy, cx * cx + cy * cy - circle.R * circle.R];
}

// Whether `circle` is flat in the world's z-plane (normal parallel to the
// z axis) — required to treat it as a 2D conic alongside a Quadric, which
// (like every conic in this reader) only ever lives in such a plane.
function isFlatInZ(circle: primitive_circle_object): boolean {
    const tolerance = geometryTolerance(circle.R);
    return (
        Math.abs(circle.NORMAL[0]) <= tolerance &&
        Math.abs(circle.NORMAL[1]) <= tolerance
    );
}

// Points of the curve where distance(x, f(x)) changes sign between samples of
// [start, end], refined by bisection down to adjacent floats. A root where
// the distance only touches zero (tangency) is not found, and a sign change
// across a discontinuity is rejected by its residual.
function curveRoots(
    curve: curve_object,
    start: number,
    end: number,
    scale: number,
    distance: (x: number, y: number) => number,
): Vec3[] {
    if (!(end > start)) return [];
    const at = (x: number): number | null => {
        const point = curve.pointAt(x);
        return point && distance(x, point[1]);
    };
    const step = (end - start) / CURVE_ROOT_SAMPLES;
    const roots: number[] = [];
    let x0 = start;
    let h0 = at(x0);
    for (let i = 1; i <= CURVE_ROOT_SAMPLES; i++) {
        const x1 = start + i * step;
        const h1 = at(x1);
        if (h0 === 0) roots.push(x0);
        else if (h0 !== null && h1 !== null && h0 * h1 < 0) {
            let [a, b, ha, hb] = [x0, x1, h0, h1];
            for (;;) {
                const middle = (a + b) / 2;
                if (middle <= a || middle >= b) break;
                const hm = at(middle);
                if (hm === null) break;
                if (hm * ha > 0) [a, ha] = [middle, hm];
                else [b, hb] = [middle, hm];
            }
            const [root, residual] =
                Math.abs(ha) < Math.abs(hb) ? [a, ha] : [b, hb];
            if (Math.abs(residual) <= geometryTolerance(root, scale))
                roots.push(root);
        }
        [x0, h0] = [x1, h1];
    }
    if (h0 === 0) roots.push(x0);
    return roots.map((root) => curve.pointAt(root)!);
}

// Coordinates conic×conic candidate selection across every
// OrderedIntersection sharing the same (O1, O2) pair: each one choosing
// independently (see groupAssign) can otherwise both claim the same
// candidate on the same frame, leaving another one unclaimed and two of the
// named points coincident. Cached per frame, same convention as
// hidden_line.ts's edgeOwnerCache.
const conicGroupCache = new WeakMap<
    intersectable_object,
    WeakMap<
        intersectable_object,
        { frame: number; assignments: Map<intersection_object, Vec3> }
    >
>();

export class intersection_object extends point_object {
    moveable = false;
    O1: intersectable_object;
    O2: intersectable_object;
    order: 0 | 1 | 2 | 3;
    away?: point_object;
    // This object's own defined-state from the previous recompute, captured
    // before computeGeometry() resets it — the anchor continuity tracking
    // (see groupAssign) matches new candidates against. `defined`
    // itself starts true (construction_object's own default), so a separate
    // flag is needed to tell "never computed yet" from "was defined".
    private previouslyDefined = false;
    private hasComputedBefore = false;

    constructor(
        c: construction,
        name: string | null | undefined,
        o1: intersectable_object,
        o2: intersectable_object,
        order: 0 | 1 | 2 | 3 = 0,
        away?: point_object,
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.O1 = o1;
        this.O2 = o2;
        this.order = order;
        this.away = away;
        this.addParents(o1, o2, ...(away ? [away] : []));
    }

    computeGeometry(): void {
        this.previouslyDefined = this.hasComputedBefore && this.defined;
        this.hasComputedBefore = true;
        this.defined = false;
        INTERSECTION_COMPUTERS.get(
            `${this.O1.familytype}:${this.O2.familytype}`,
        )?.(this);
    }

    computeLineLine(): void {
        if (
            !(this.O1 instanceof primitive_line_object) ||
            !(this.O2 instanceof primitive_line_object)
        ) {
            return;
        }
        if (!this.O1.defined || !this.O2.defined) return;

        const p = this.O1.P1.coords,
            u = this.O1.VEC,
            m = this.O2.P1.coords,
            v = this.O2.VEC;
        const normal = vCross(u, v);
        const denominator = vDot(normal, normal);
        if (denominator <= GEOMETRY_EPSILON * GEOMETRY_EPSILON) return;

        const betweenOrigins = vSub(m, p);
        const parameter1 =
            vDot(vCross(betweenOrigins, v), normal) / denominator;
        const parameter2 =
            vDot(vCross(betweenOrigins, u), normal) / denominator;
        const point1 = vAdd(p, vScale(u, parameter1));
        const point2 = vAdd(m, vScale(v, parameter2));
        if (!vIsFinite(point1) || !vIsFinite(point2)) return;

        if (
            vNorm(vSub(point1, point2)) >
                geometryTolerance(vNorm(point1), vNorm(point2)) ||
            !this.O1.insideBounds(parameter1) ||
            !this.O2.insideBounds(parameter2)
        ) {
            return;
        }

        this.coords = vScale(vAdd(point1, point2), 0.5);
        super.computeGeometry();
    }

    computeLineCircle(
        line: primitive_line_object,
        circle: primitive_circle_object,
    ): void {
        if (!line.defined || !circle.defined) return;
        const relative = vSub(line.P1.coords, circle.CENTER);
        const planeDistance = vDot(relative, circle.NORMAL);
        const planeDirection = vDot(line.VEC, circle.NORMAL);
        const tolerance = geometryTolerance(vNorm(relative), circle.R);

        if (Math.abs(planeDirection) > GEOMETRY_EPSILON) {
            const parameter = -planeDistance / planeDirection;
            const point = vAdd(line.P1.coords, vScale(line.VEC, parameter));
            if (
                Math.abs(vNorm(vSub(point, circle.CENTER)) - circle.R) <=
                    tolerance &&
                line.insideBounds(parameter)
            ) {
                this.coords = point;
                super.computeGeometry();
            }
            return;
        }
        if (Math.abs(planeDistance) > tolerance) return;

        const projectionParameter = -vDot(relative, line.VEC);
        let discriminant =
            circle.R * circle.R -
            vDot(
                vAdd(relative, vScale(line.VEC, projectionParameter)),
                vAdd(relative, vScale(line.VEC, projectionParameter)),
            );
        if (discriminant < -tolerance) return;
        discriminant = Math.max(0, discriminant);
        const offset = Math.sqrt(discriminant);
        const parameters =
            offset <= tolerance
                ? [projectionParameter]
                : [projectionParameter + offset, projectionParameter - offset];
        const index = this.choose(
            parameters.map((parameter) =>
                vAdd(line.P1.coords, vScale(line.VEC, parameter)),
            ),
        );
        const parameter = parameters[index];
        if (!line.insideBounds(parameter)) return;
        this.coords = vAdd(line.P1.coords, vScale(line.VEC, parameter));
        super.computeGeometry();
    }

    computeCircleCircle(
        first: primitive_circle_object,
        second: primitive_circle_object,
    ): void {
        if (!first.defined || !second.defined) return;
        const centers = vSub(second.CENTER, first.CENTER);
        const distance = vNorm(centers);
        const tolerance = geometryTolerance(distance, first.R, second.R);
        if (
            vNorm(vCross(first.NORMAL, second.NORMAL)) > tolerance ||
            Math.abs(vDot(centers, first.NORMAL)) > tolerance ||
            distance <= tolerance ||
            distance > first.R + second.R + tolerance ||
            distance < Math.abs(first.R - second.R) - tolerance
        ) {
            return;
        }
        const direction = vNormalize(centers);
        if (!direction) return;
        const along =
            (distance * distance + first.R * first.R - second.R * second.R) /
            (2 * distance);
        let heightSquared = first.R * first.R - along * along;
        if (heightSquared < -tolerance) return;
        heightSquared = Math.max(0, heightSquared);
        const base = vAdd(first.CENTER, vScale(direction, along));
        const side = vScale(
            vCross(first.NORMAL, direction),
            Math.sqrt(heightSquared),
        );
        const candidates =
            vNorm(side) <= tolerance
                ? [base]
                : [vAdd(base, side), vSub(base, side)];
        this.coords = candidates[this.choose(candidates)];
        super.computeGeometry();
    }

    // Line × conic: substituting the line's parametrization into the
    // conic's implicit equation is always a quadratic in the line's own
    // parameter, so — like line×circle — there are at most 2 candidates,
    // returned already sorted by that parameter (see lineConicIntersections),
    // which is what `order` indexes into.
    computeLineQuadric(
        line: primitive_line_object,
        quadric: primitive_quadric_object,
    ): void {
        if (!line.defined || !quadric.defined || !quadric.COEFFS) return;
        const z = quadric.CENTER[2];
        const tolerance = geometryTolerance(z);
        if (!numEqual(line.P1.z, z) || Math.abs(line.VEC[2]) > tolerance)
            return;
        const parameters = lineConicIntersections(
            line.P1.coords,
            line.VEC,
            quadric.COEFFS,
        ).filter((parameter) => line.insideBounds(parameter));
        if (parameters.length === 0) return;
        const candidates = parameters.map((parameter) =>
            vAdd(line.P1.coords, vScale(line.VEC, parameter)),
        );
        this.coords = candidates[this.choose(candidates)];
        super.computeGeometry();
    }

    // Circle × conic and conic × conic both reduce to the same conic×conic
    // solve (a circle is just a conic of that special shape), which can
    // return up to 4 real points whose count and identity can change
    // continuously as the figure is dragged — there's no stable "formula
    // slot" for 4 roots the way there is for 2 (see groupAssign).
    computeCircleQuadric(
        circle: primitive_circle_object,
        quadric: primitive_quadric_object,
    ): void {
        if (!circle.defined || !quadric.defined || !quadric.COEFFS) return;
        if (
            !isFlatInZ(circle) ||
            !numEqual(circle.CENTER[2], quadric.CENTER[2])
        )
            return;
        this.intersectConics(
            circleAsConic(circle),
            quadric.COEFFS,
            quadric.CENTER[2],
        );
    }

    computeQuadricQuadric(
        first: primitive_quadric_object,
        second: primitive_quadric_object,
    ): void {
        if (
            !first.defined ||
            !second.defined ||
            !first.COEFFS ||
            !second.COEFFS
        )
            return;
        if (!numEqual(first.CENTER[2], second.CENTER[2])) return;
        this.intersectConics(first.COEFFS, second.COEFFS, first.CENTER[2]);
    }

    computeLineCurve(line: primitive_line_object, curve: curve_object): void {
        if (!line.defined) return;
        const [px, py, pz] = line.P1.coords;
        const [vx, vy, vz] = line.VEC;
        if (!numEqual(pz, 0) || Math.abs(vz) > GEOMETRY_EPSILON) return;
        this.assignCurvePoints(() => {
            if (Math.abs(vx) <= GEOMETRY_EPSILON) {
                const point = curve.pointAt(px);
                return point ? [point] : [];
            }
            // An unbounded curve is searched well beyond the viewport it is
            // drawn in, so that a root just off-screen still exists.
            const [lo, hi] = curve.domain();
            return curveRoots(
                curve,
                curve.min ?? 2 * lo - hi,
                curve.max ?? 2 * hi - lo,
                py,
                (x, y) => y - py - ((x - px) * vy) / vx,
            ).filter((point) =>
                line.insideBounds(vDot(vSub(point, line.P1.coords), line.VEC)),
            );
        });
    }

    computeCircleCurve(
        circle: primitive_circle_object,
        curve: curve_object,
    ): void {
        if (!circle.defined) return;
        const [cx, cy, cz] = circle.CENTER;
        if (!isFlatInZ(circle) || !numEqual(cz, 0)) return;
        this.assignCurvePoints(() =>
            curveRoots(
                curve,
                Math.max(curve.min ?? -Infinity, cx - circle.R),
                Math.min(curve.max ?? Infinity, cx + circle.R),
                circle.R,
                (x, y) => Math.hypot(x - cx, y - cy) - circle.R,
            ),
        );
    }

    computeQuadricCurve(
        quadric: primitive_quadric_object,
        curve: curve_object,
    ): void {
        if (!quadric.defined || !quadric.COEFFS) return;
        if (!numEqual(quadric.CENTER[2], 0)) return;
        const [a, b, c, d, e, f] = quadric.COEFFS;
        const [lo, hi] = curve.domain();
        this.assignCurvePoints(() =>
            curveRoots(
                curve,
                curve.min ?? 2 * lo - hi,
                curve.max ?? 2 * hi - lo,
                1,
                // The conic's value over its gradient norm: a signed
                // distance near the conic, so the residual test holds.
                (x, y) =>
                    (a * x * x + b * x * y + c * y * y + d * x + e * y + f) /
                    Math.hypot(2 * a * x + b * y + d, b * x + 2 * c * y + e),
            ),
        );
    }

    // Like conic×conic, the root count drifts as the figure is dragged, so
    // siblings share the candidates through groupAssign.
    private assignCurvePoints(candidates: () => Vec3[]): void {
        const assigned = this.groupAssign(candidates);
        if (!assigned) return;
        this.coords = assigned;
        super.computeGeometry();
    }

    private intersectConics(
        conic1: ConicCoeffs,
        conic2: ConicCoeffs,
        z: number,
    ): void {
        const points = conicConicIntersectionsXY(conic1, conic2);
        if (points.length === 0) return;
        // Always resolved per sibling group rather than by this object alone
        // (see groupAssign). Unlike line/circle pairs (always exactly ≤2
        // roots, so a fixed order slot is inherently collision-free), a
        // circle×quadric or quadric×quadric pair's real root count drifts
        // between 0 and 4 as the figure is dragged — even down at 2
        // candidates, two siblings declared with order 1 and 2 would
        // otherwise both clamp to the same index.
        const assigned = this.groupAssign(() =>
            points.map(([x, y]): Vec3 => [x, y, z]),
        );
        if (!assigned) return;
        this.coords = assigned;
        super.computeGeometry();
    }

    // Only ever called with ≤2 candidates (line×circle, circle×circle,
    // line×quadric): substituting a line always yields a quadratic, and
    // intersecting two circles caps out at 2 real solutions too, so a fixed
    // order slot is inherently collision-free between siblings — unlike the
    // conic×conic case (see groupAssign).
    private choose(candidates: Vec3[]): number {
        if (candidates.length === 1) return 0;
        if (this.away?.defined) {
            const firstDistance = vNorm(vSub(candidates[0], this.away.coords));
            const secondDistance = vNorm(vSub(candidates[1], this.away.coords));
            return firstDistance < secondDistance ? 1 : 0;
        }
        // order's type allows up to 3 (needed for groupAssign below), so a
        // malformed file requesting order 2 or 3 here is clamped rather
        // than indexing out of bounds.
        return Math.min(this.order, candidates.length - 1);
    }

    // Every OrderedIntersection sharing this exact (O1, O2) pair (in either
    // argument order), found via the dependency graph rather than a
    // separate registry.
    private siblings(): intersection_object[] {
        return (this.O1.children as construction_object[]).filter(
            (child): child is intersection_object =>
                child instanceof intersection_object &&
                ((child.O1 === this.O1 && child.O2 === this.O2) ||
                    (child.O1 === this.O2 && child.O2 === this.O1)),
        );
    }

    // Assigns every sibling on this (O1, O2) pair a candidate at once.
    // Conic×conic can have anywhere from 0 to 4 real roots, with no stable
    // algebraic labeling the way a 2-root quadratic has (±offset), so each
    // sibling without an `away` point instead tracks its own previous
    // position — whichever candidate is closest to where it was last frame
    // is almost certainly the same physical point, smoothly followed
    // through drags. That has to be resolved for the whole sibling group at
    // once (cached per frame): if each sibling greedily grabbed its own
    // nearest candidate independently, two of them could both claim the
    // same one on the same frame, leaving another candidate unclaimed and
    // two named points coincident.
    private groupAssign(candidates: () => Vec3[]): Vec3 | undefined {
        let forO1 = conicGroupCache.get(this.O1);
        if (!forO1) {
            forO1 = new WeakMap();
            conicGroupCache.set(this.O1, forO1);
        }
        const cached = forO1.get(this.O2);
        if (cached && cached.frame === this.C.OBJS.frame)
            return cached.assignments.get(this);

        const siblings = this.siblings();
        const unclaimed = candidates();
        const assignments = new Map<intersection_object, Vec3>();

        // Phase 1: siblings with an `away` point rank candidates by
        // decreasing distance from it — deterministic regardless of drag
        // history, so (like the 2-candidate case) distinct `order` values
        // can never collide — each just claims the next-farthest
        // still-unclaimed candidate, in order of increasing `order`.
        siblings
            .filter((sibling) => sibling.away?.defined)
            .sort((a, b) => a.order - b.order)
            .forEach((sibling) => {
                if (unclaimed.length === 0) return;
                let bestIndex = 0;
                let bestDistance = -Infinity;
                unclaimed.forEach((point, index) => {
                    const distance = vNorm(vSub(point, sibling.away!.coords));
                    if (distance > bestDistance) {
                        bestDistance = distance;
                        bestIndex = index;
                    }
                });
                assignments.set(sibling, unclaimed[bestIndex]);
                unclaimed.splice(bestIndex, 1);
            });

        // Phase 2: siblings with a tracked previous position each claim
        // their nearest still-unclaimed candidate, processed in a stable
        // (creation) order so the outcome doesn't depend on which sibling's
        // computeGeometry() happens to run first this frame.
        siblings
            .filter(
                (sibling) =>
                    !sibling.away?.defined && sibling.previouslyDefined,
            )
            .sort((a, b) => a.sequence - b.sequence)
            .forEach((sibling) => {
                if (unclaimed.length === 0) return;
                let bestIndex = 0;
                let bestDistance = Infinity;
                unclaimed.forEach((point, index) => {
                    const distance = vNorm(vSub(point, sibling.coords));
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestIndex = index;
                    }
                });
                assignments.set(sibling, unclaimed[bestIndex]);
                unclaimed.splice(bestIndex, 1);
            });

        // Phase 3: siblings with no previous position (just created, or
        // their tracked point vanished and later reappeared) split what's
        // left deterministically — sorted by angle around its centroid,
        // matched to those siblings sorted by `order` — so a fresh import
        // is reproducible without depending on the other siblings' history.
        const bootstrapping = siblings
            .filter(
                (sibling) =>
                    !sibling.away?.defined && !sibling.previouslyDefined,
            )
            .sort((a, b) => a.order - b.order);
        if (bootstrapping.length > 0 && unclaimed.length > 0) {
            const centroid = vScale(
                unclaimed.reduce((sum, point) => vAdd(sum, point), [0, 0, 0]),
                1 / unclaimed.length,
            );
            const ranked = unclaimed
                .map((point, index) => ({
                    index,
                    angle: Math.atan2(
                        point[1] - centroid[1],
                        point[0] - centroid[0],
                    ),
                }))
                .sort((a, b) => a.angle - b.angle);
            bootstrapping.forEach((sibling, i) => {
                if (i < ranked.length)
                    assignments.set(sibling, unclaimed[ranked[i].index]);
            });
        }

        forO1.set(this.O2, { frame: this.C.OBJS.frame, assignments });
        return assignments.get(this);
    }

    mousedrag(_ev: PointerEvent): void {}
}

type IntersectionComputer = (object: intersection_object) => void;

const INTERSECTION_COMPUTERS = new Map<string, IntersectionComputer>([
    ["line:line", (object) => object.computeLineLine()],
    [
        "line:circle",
        (object) =>
            object.computeLineCircle(
                object.O1 as primitive_line_object,
                object.O2 as primitive_circle_object,
            ),
    ],
    [
        "circle:line",
        (object) =>
            object.computeLineCircle(
                object.O2 as primitive_line_object,
                object.O1 as primitive_circle_object,
            ),
    ],
    [
        "circle:circle",
        (object) =>
            object.computeCircleCircle(
                object.O1 as primitive_circle_object,
                object.O2 as primitive_circle_object,
            ),
    ],
    [
        "line:quadric",
        (object) =>
            object.computeLineQuadric(
                object.O1 as primitive_line_object,
                object.O2 as primitive_quadric_object,
            ),
    ],
    [
        "quadric:line",
        (object) =>
            object.computeLineQuadric(
                object.O2 as primitive_line_object,
                object.O1 as primitive_quadric_object,
            ),
    ],
    [
        "line:curve",
        (object) =>
            object.computeLineCurve(
                object.O1 as primitive_line_object,
                object.O2 as curve_object,
            ),
    ],
    [
        "curve:line",
        (object) =>
            object.computeLineCurve(
                object.O2 as primitive_line_object,
                object.O1 as curve_object,
            ),
    ],
    [
        "circle:curve",
        (object) =>
            object.computeCircleCurve(
                object.O1 as primitive_circle_object,
                object.O2 as curve_object,
            ),
    ],
    [
        "curve:circle",
        (object) =>
            object.computeCircleCurve(
                object.O2 as primitive_circle_object,
                object.O1 as curve_object,
            ),
    ],
    [
        "quadric:curve",
        (object) =>
            object.computeQuadricCurve(
                object.O1 as primitive_quadric_object,
                object.O2 as curve_object,
            ),
    ],
    [
        "curve:quadric",
        (object) =>
            object.computeQuadricCurve(
                object.O2 as primitive_quadric_object,
                object.O1 as curve_object,
            ),
    ],
    [
        "circle:quadric",
        (object) =>
            object.computeCircleQuadric(
                object.O1 as primitive_circle_object,
                object.O2 as primitive_quadric_object,
            ),
    ],
    [
        "quadric:circle",
        (object) =>
            object.computeCircleQuadric(
                object.O2 as primitive_circle_object,
                object.O1 as primitive_quadric_object,
            ),
    ],
    [
        "quadric:quadric",
        (object) =>
            object.computeQuadricQuadric(
                object.O1 as primitive_quadric_object,
                object.O2 as primitive_quadric_object,
            ),
    ],
]);

export function createIntersection(
    c: construction,
    name: string | null | undefined,
    o1: primitive_line_object,
    o2: primitive_line_object,
): intersection_object {
    return c.add(new intersection_object(c, name, o1, o2));
}

export function createOrderedIntersection(
    c: construction,
    name: string | null | undefined,
    o1: intersectable_object,
    o2: intersectable_object,
    order: 0 | 1 | 2 | 3,
    away?: point_object,
): intersection_object {
    return c.add(new intersection_object(c, name, o1, o2, order, away));
}
