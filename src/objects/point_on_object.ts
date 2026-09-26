import type { construction } from "../construction";
import { projectPointOnLine, projectPointOnPlane } from "../projection";
import { vAdd, vDot, vScale, vSub, type Vec2, type Vec3 } from "../vec";
import type { curve_object } from "./curve_object";
import { list_object } from "./list_object";
import type { locus_object } from "./locus_object";
import { polygon_object } from "./polygon_object";
import { primitive_circle_object } from "./primitive_circle_object";
import { primitive_line_object } from "./primitive_line_object";
import { point_object } from "./point_object";
import { quadric5pts_object } from "./quadric5pts_object";
import { ray_line_object } from "./ray_line_object";
import { segment_object } from "./segment_object";
import { two_points_line_object } from "./two_points_line_object";

export type point_support_object =
    | primitive_line_object
    | primitive_circle_object
    | polygon_object
    | quadric5pts_object
    | locus_object
    | list_object
    | curve_object;

type Alpha = number | readonly [number, number];

export class point_on_object extends point_object {
    support: point_support_object;
    alpha: Alpha;
    onBoundary: boolean;

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
        } else if (this.support instanceof quadric5pts_object) {
            this.coords = this.support.pointAt(
                this.alpha as readonly [number, number],
            );
        } else if (this.support instanceof two_points_line_object) {
            this.coords = vAdd(
                this.support.P1.coords,
                vScale(
                    vSub(this.support.P2.coords, this.support.P1.coords),
                    this.alpha as number,
                ),
            );
        } else {
            // For a line built from a point + direction (Perpendicular,
            // Parallel, PerpendicularBisector...), DGPad stores alpha as a
            // raw screen-pixel offset (its internal point coordinates are
            // screen pixels, converted to math units only at save/load time
            // for a free Point — this PointOn parameter never gets that
            // conversion), so it must be rescaled by GRID.UNIT here.
            const support = this.support as primitive_line_object;
            this.coords = vAdd(
                support.P1.coords,
                vScale(
                    support.VEC,
                    (this.alpha as number) / this.C.GRID.UNIT[0],
                ),
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

    private dragTarget(screen: Vec2): Vec3 | null {
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
        return this.C.unprojectToZPlane(screen, this.z);
    }

    alphaFor(target: Vec3): Alpha | null {
        if (this.support.familytype === "curve") return target[0];
        if (this.support instanceof primitive_circle_object) {
            return this.support.alphaOf(target);
        }
        if (this.support instanceof polygon_object) {
            return this.support.alphaOf(target, this.onBoundary);
        }
        if (this.support instanceof quadric5pts_object) {
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
        return (
            vDot(vSub(target, support.P1.coords), support.VEC) *
            this.C.GRID.UNIT[0]
        );
    }
}

export function createPointOn(
    c: construction,
    name: string | null | undefined,
    support: point_support_object,
    alpha: Alpha,
): point_on_object {
    return c.add(new point_on_object(c, name, support, alpha));
}
