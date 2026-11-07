import type { construction } from "../construction";
import { realPart, usesView } from "../import/dgp_formula";
import {
    vAdd,
    vDot,
    vNormalize,
    vScale,
    vSub,
    geometryTolerance,
    type Vec3,
} from "../vec";
import { dgoRadius, radiusValue, type circle1_radius } from "./circle1_object";
import type { DgoContext } from "./construction_object";
import { curve_object } from "./curve_object";
import { callFunction, evaluateFunction } from "./expression_object";
import { point_object } from "./point_object";
import { primitive_circle_object } from "./primitive_circle_object";
import { primitive_line_object } from "./primitive_line_object";
import type { primitive_quadric_object } from "./primitive_quadric_object";

export type tangent_support =
    primitive_circle_object | primitive_quadric_object | curve_object;

// The tangent through P to a circle or a conic, one of two, their touching
// points ordered along the polar of P; or to the curve of a function at
// x(P), or at an abscissa, a number or a formula. Its point is the touching
// point.
export class tangent_object extends primitive_line_object {
    point: point_object | circle1_radius;
    support: tangent_support;
    branch: number;

    constructor(
        c: construction,
        name: string | null | undefined,
        point: point_object | circle1_radius,
        support: tangent_support,
        branch: number,
    ) {
        super(c, name, new point_object(c, null, [0, 0, 0]));
        this.point = point;
        this.support = support;
        this.branch = branch;
        const formula =
            point instanceof point_object || typeof point === "number"
                ? null
                : point;
        this.readsView = !!formula && usesView(formula.formula);
        this.addParents(
            ...(point instanceof point_object ? [point] : []),
            ...(formula ? formula.refs.values() : []),
            support,
        );
    }

    dgo(context: DgoContext): [string, unknown] {
        if (!(this.point instanceof point_object))
            return [
                "TanX",
                [dgoRadius(this.point, context), context.index(this.support)],
            ];
        return [
            "Tan",
            [
                context.index(this.point),
                context.index(this.support),
                ...(this.support instanceof curve_object ? [] : [this.branch]),
            ],
        ];
    }

    computeVEC(): Vec3 | null {
        if (
            (this.point instanceof point_object && !this.point.defined) ||
            !this.support.defined
        )
            return null;
        const line =
            this.support instanceof curve_object
                ? this.curveTangent(this.support)
                : this.conicTangent();
        if (!line) return null;
        this.P1.coords = line[0];
        this.P1.computeGeometry();
        return vNormalize(line[1]);
    }

    project(): void {
        this.P1.project();
        super.project();
    }

    // Its touching point and its direction.
    private curveTangent(curve: curve_object): [Vec3, Vec3] | null {
        const x =
            this.point instanceof point_object
                ? this.point.x
                : radiusValue(this.point, this.C);
        if (x === null) return null;
        const view = () => this.C.formulaView();
        const value = (at: number) =>
            realPart(evaluateFunction(curve.formula, [at], view));
        const y = value(x);
        const h = 1e-6 * Math.max(1, Math.abs(x));
        const slope =
            realPart(
                callFunction(new Map([["f", curve]]), "f", [x], view, ["x"]),
            ) ?? (value(x + h)! - value(x - h)!) / (2 * h);
        if (
            y === null ||
            !Number.isFinite(slope) ||
            (curve.min !== null && x < curve.min) ||
            (curve.max !== null && x > curve.max)
        )
            return null;
        return [
            [x, y, 0],
            [1, slope, 0],
        ];
    }

    private conicTangent(): [Vec3, Vec3] | null {
        const support = this.support as
            primitive_circle_object | primitive_quadric_object;
        // Its coefficients in a frame of its plane.
        const [origin, u, v, coeffs] =
            support instanceof primitive_circle_object
                ? [
                      support.CENTER,
                      support.U,
                      support.V,
                      [1, 0, 1, 0, 0, -support.R * support.R],
                  ]
                : [support.ORIGIN, ...support.PLANE, support.COEFFS];
        if (!coeffs) return null;
        const [a, b, c, d, e, f] = coeffs;
        const point = this.point as point_object;
        const relative = vSub(point.coords, origin);
        const [x0, y0] = [vDot(relative, u), vDot(relative, v)];
        // The polar of P, L1·x + L2·y + L3 = 0, along w from q.
        const l1 = a * x0 + (b * y0 + d) / 2;
        const l2 = c * y0 + (b * x0 + e) / 2;
        const l3 = (d * x0 + e * y0) / 2 + f;
        const norm = l1 * l1 + l2 * l2;
        const w = [l2, -l1];
        const q = [(-l3 * l1) / norm, (-l3 * l2) / norm];
        const A = a * w[0] * w[0] + b * w[0] * w[1] + c * w[1] * w[1];
        const B =
            2 * a * q[0] * w[0] +
            b * (q[0] * w[1] + q[1] * w[0]) +
            2 * c * q[1] * w[1] +
            d * w[0] +
            e * w[1];
        const C =
            a * q[0] * q[0] +
            b * q[0] * q[1] +
            c * q[1] * q[1] +
            d * q[0] +
            e * q[1] +
            f;
        // On the conic, up to rounding errors (F(P) / |∇F(P)|): the tangent
        // there, its polar.
        const onConic =
            Math.abs(l1 * x0 + l2 * y0 + l3) / (2 * Math.sqrt(norm)) <=
            geometryTolerance(x0, y0);
        if (onConic)
            return [point.coords, vAdd(vScale(u, w[0]), vScale(v, w[1]))];
        const disc = Math.sqrt(B * B - 4 * A * C);
        const t = [(-B - disc) / (2 * A), (-B + disc) / (2 * A)].sort(
            (s, t) => s - t,
        )[this.branch];
        const touch = vAdd(
            origin,
            vAdd(vScale(u, q[0] + t * w[0]), vScale(v, q[1] + t * w[1])),
        );
        return touch.every(Number.isFinite)
            ? [touch, vSub(touch, point.coords)]
            : null;
    }
}

export function createTangent(
    c: construction,
    name: string | null | undefined,
    point: point_object | circle1_radius,
    support: tangent_support,
    branch = 0,
): tangent_object {
    return c.add(new tangent_object(c, name, point, support, branch));
}
