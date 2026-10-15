import type { construction } from "../construction";
import { usesView } from "../import/dgp_formula";
import { geometryTolerance, numEqual, type Vec2 } from "../vec";
import { dgoRadius, radiusValue, type circle1_radius } from "./circle1_object";
import type { DgoContext } from "./construction_object";
import { point_object } from "./point_object";
import {
    hyperbolaBranches,
    primitive_quadric_object,
} from "./primitive_quadric_object";

// The ellipse or the hyperbola of foci F and G through a point, or of a
// semi-major axis.
export class focal_conic_object extends primitive_quadric_object {
    F: point_object;
    G: point_object;
    third: point_object | circle1_radius;
    hyperbola: boolean;

    constructor(
        c: construction,
        name: string | null | undefined,
        hyperbola: boolean,
        f: point_object,
        g: point_object,
        third: point_object | circle1_radius,
    ) {
        super(c, name);
        this.F = f;
        this.G = g;
        this.third = third;
        this.hyperbola = hyperbola;
        this.readsView =
            typeof third !== "number" &&
            !(third instanceof point_object) &&
            usesView(third.formula);
        this.addParents(
            f,
            g,
            ...(third instanceof point_object
                ? [third]
                : typeof third === "number"
                  ? []
                  : third.refs.values()),
        );
    }

    dgo(context: DgoContext): [string, unknown] {
        const tag = this.hyperbola ? "Hyp" : "Ell";
        const [F, G] = [this.F, this.G].map(context.index);
        return this.third instanceof point_object
            ? [tag, [F, G, context.index(this.third)]]
            : [tag + "1", [F, G, dgoRadius(this.third, context)]];
    }

    computeGeometry(): void {
        const through = this.third instanceof point_object ? this.third : null;
        const points = [this.F, this.G, ...(through ? [through] : [])];
        this.setPlane(this.F.z);
        const local = points.map((point) => this.toPlane(point.coords));
        const [f, g, p] = local;
        const focal = Math.hypot(g[0] - f[0], g[1] - f[1]) / 2;
        const a = p
            ? Math.abs(
                  Math.hypot(p[0] - f[0], p[1] - f[1]) +
                      (this.hyperbola ? -1 : 1) *
                          Math.hypot(p[0] - g[0], p[1] - g[1]),
              ) / 2
            : radiusValue(this.third as circle1_radius, this.C);
        const b = Math.sqrt(
            this.hyperbola ? focal ** 2 - a! ** 2 : a! ** 2 - focal ** 2,
        );
        if (
            !points.every((point) => point.defined) ||
            !local.every(([, , height]) => numEqual(height, 0)) ||
            a === null ||
            !(a > geometryTolerance(focal)) ||
            !(b > geometryTolerance(a, focal))
        ) {
            this.defined = false;
            this.COEFFS = null;
            return;
        }
        const center: Vec2 = [(f[0] + g[0]) / 2, (f[1] + g[1]) / 2];
        const u: Vec2 =
            focal > 0
                ? [(g[0] - f[0]) / (2 * focal), (g[1] - f[1]) / (2 * focal)]
                : [1, 0];
        const v: Vec2 = [-u[1], u[0]];
        if (this.hyperbola)
            this.setBranches(
                "hyperbola",
                center,
                hyperbolaBranches(center, u, a, v, b),
            );
        else
            this.setEllipse(center, [a * u[0], a * u[1]], [b * v[0], b * v[1]]);
        this.setCoeffs(
            center,
            u,
            1 / a ** 2,
            (this.hyperbola ? -1 : 1) / b ** 2,
            0,
            -1,
        );
        this.axes = [
            [...center, 0],
            [center[0] + a * u[0], center[1] + a * u[1], 0],
            [center[0] + b * v[0], center[1] + b * v[1], 0],
        ];
    }
}

export function createFocalConic(
    c: construction,
    name: string | null | undefined,
    hyperbola: boolean,
    f: point_object,
    g: point_object,
    third: point_object | circle1_radius,
): focal_conic_object {
    return c.add(new focal_conic_object(c, name, hyperbola, f, g, third));
}
