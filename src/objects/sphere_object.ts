import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import {
    vAdd,
    vCross,
    vIsFinite,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import { construction_object, type DgoContext } from "./construction_object";
import { dgoRadius, radiusValue, type circle1_radius } from "./circle1_object";
import { point_object } from "./point_object";
import { AMBIENT, LIGHT, pathData, shade } from "./polygon_object";

const CIRCLE_POINTS = 96;
let gradients = 0;

function circle(center: Vec3, radius: number, u: Vec3, v: Vec3): Vec3[] {
    return Array.from({ length: CIRCLE_POINTS }, (_, index) => {
        const t = (2 * Math.PI * index) / CIRCLE_POINTS;
        return vAdd(
            center,
            vAdd(
                vScale(u, radius * Math.cos(t)),
                vScale(v, radius * Math.sin(t)),
            ),
        );
    });
}

// Andrew's monotone chain.
export function convexHull(points: Vec2[]): Vec2[] {
    const sorted = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const turn = (o: Vec2, a: Vec2, b: Vec2) =>
        (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const chain = (list: Vec2[]) =>
        list.reduce<Vec2[]>((hull, point) => {
            while (
                hull.length >= 2 &&
                turn(hull[hull.length - 2], hull[hull.length - 1], point) <= 0
            )
                hull.pop();
            hull.push(point);
            return hull;
        }, []);
    const lower = chain(sorted);
    const upper = chain(sorted.reverse());
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// Drawn as its silhouette, filled with a radial gradient lit like polygon
// faces. Its part behind the floor is drawn by the floor, beneath its own
// fill (see grid_object.renderUnderlay): seen from the camera's side of the
// floor, a point of the silhouette shows the near cap, the ball's part on
// that side, exactly when it lies in the near cap's projection, the convex
// hull of the contour's points on that side and of the floor's section.
export class sphere_object extends construction_object {
    P1: point_object;
    // Through a point, or of a radius.
    P2: point_object | circle1_radius;
    CENTER: Vec3 = [0, 0, 0];
    R = 0;
    projectionDefined = true;
    contour: Vec2[] = [];
    nearPart: Vec2[] = [];
    // The silhouette, with the near part as a hole (even-odd rule).
    farPath = "";
    readonly fill = `url(#sphere-gradient-${++gradients})`;
    path!: DOMElement;
    private gradient!: DOMElement;
    private gradientCenter: Vec2 = [0, 0];
    private gradientRadius = 0;

    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        p2: point_object | circle1_radius,
    ) {
        super(c, name, "polygon");
        this.familytype = "sphere";
        this.P1 = p1;
        this.P2 = p2;
        this.addParents(
            p1,
            ...(p2 instanceof point_object
                ? [p2]
                : typeof p2 === "number"
                  ? []
                  : p2.refs.values()),
        );
    }

    dgo(context: DgoContext): [string, unknown] {
        const { P1, P2 } = this;
        return P2 instanceof point_object
            ? ["Sph", [P1, P2].map(context.index)]
            : ["Sph1", [context.index(P1), dgoRadius(P2, context)]];
    }

    computeGeometry(): void {
        const { P1, P2 } = this;
        const radius =
            P2 instanceof point_object
                ? P2.defined
                    ? vNorm(vSub(P2.coords, P1.coords))
                    : null
                : radiusValue(P2, this.C);
        this.defined = P1.defined && radius !== null;
        this.CENTER = P1.coords;
        this.R = radius ?? 0;
    }

    // With the eye at E, the contour is the circle of the points P where
    // CP ⊥ EP; seen from infinitely far along the view axis, it is the
    // great circle orthogonal to that axis.
    project(): void {
        this.projectionDefined = false;
        if (!this.defined) return;
        const { dir, focal } = this.C.projectionFrame;
        const toEye =
            focal === undefined
                ? vScale(dir!, -1)
                : vSub(vScale(dir!, -focal), this.CENTER);
        const distance = vNorm(toEye);
        const ratio = focal === undefined ? 0 : this.R / distance;
        if (ratio >= 1) return;
        const normal = vScale(toEye, 1 / distance);
        const u =
            vNormalize(vCross(normal, [0, 0, 1])) ??
            vNormalize(vCross(normal, [1, 0, 0]))!;
        const contour = circle(
            vAdd(this.CENTER, vScale(normal, this.R * ratio)),
            this.R * Math.sqrt(1 - ratio * ratio),
            u,
            vCross(normal, u),
        );
        this.contour = contour.map((p) => this.C.pt3D(p));
        this.projectionDefined = this.contour.every(vIsFinite);
        if (!this.projectionDefined) return;

        const center = this.C.pt3D(this.CENTER);
        this.gradientCenter = center;
        this.gradientRadius = Math.max(
            ...this.contour.map((p) => vNorm(vSub(p, center))),
        );
        // Positive on the camera's side of the floor.
        const side = dir![2] < 0 ? 1 : -1;
        const height = side * this.CENTER[2];
        if (!this.C.GRID.SHOWFLOOR || height >= this.R) {
            this.nearPart = this.contour;
            this.farPath = "";
            return;
        }
        const section =
            height > -this.R
                ? circle(
                      [this.CENTER[0], this.CENTER[1], 0],
                      Math.sqrt(this.R ** 2 - height ** 2),
                      [1, 0, 0],
                      [0, 1, 0],
                  )
                : [];
        this.nearPart = convexHull([
            ...contour
                .filter((p) => side * p[2] >= 0)
                .map((p) => this.C.pt3D(p)),
            ...section.map((p) => this.C.pt3D(p)),
        ]);
        this.farPath = pathData(this.contour) + " " + pathData(this.nearPart);
    }

    render(): void {
        this.dom.stl(
            "display",
            this.isVisible && this.projectionDefined ? "block" : "none",
        );
        if (!this.defined || !this.projectionDefined) return;
        const [x, y] = this.gradientCenter;
        const r = this.gradientRadius;
        this.gradient
            .att("cx", x)
            .att("cy", y)
            .att("r", r)
            .att("fx", x + LIGHT[0] * r)
            .att("fy", y + LIGHT[1] * r);
        this.path.att("d", pathData(this.nearPart));
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as sphere_object;
        t.gradient = t.svg
            .shape("radialGradient")
            .att("id", t.fill.slice(5, -1))
            .att("gradientUnits", "userSpaceOnUse")
            .add(
                ...[1, AMBIENT].map((factor, index) =>
                    t.svg
                        .shape("stop")
                        .att("offset", index)
                        .stl("stop-color", shade(t.fill_color, factor)),
                ),
            );
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

export function createSphere(
    c: construction,
    name: string | null | undefined,
    p1: point_object,
    p2: point_object | circle1_radius,
): sphere_object {
    return c.add(new sphere_object(c, name, p1, p2));
}
