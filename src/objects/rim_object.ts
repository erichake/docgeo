import type { construction } from "../construction";
import { usesView } from "../import/dgp_formula";
import { vAdd, vCross, vNorm, vScale, vSub, type Vec3 } from "../vec";
import { dgoRadius, radiusValue, type circle1_radius } from "./circle1_object";
import type { DgoContext } from "./construction_object";
import { point_object } from "./point_object";

// The k-th of n points around the circle of radius r centered at A, or at
// B for the top, orthogonal to AB: the rims of GeoGebra's cylinder and cone,
// from (-sin θ, cos θ, 0), θ = atan2(y, x) of AB, which is orthogonal to AB
// even when AB is vertical, since atan2(0, 0) = 0.
export class rim_object extends point_object {
    moveable = false;
    A: point_object;
    B: point_object;
    radius: circle1_radius;
    rank: number;
    count: number;
    top: boolean;

    constructor(
        c: construction,
        name: string | null | undefined,
        a: point_object,
        b: point_object,
        radius: circle1_radius,
        rank: number,
        count: number,
        top: boolean,
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.A = a;
        this.B = b;
        this.radius = radius;
        this.rank = rank;
        this.count = count;
        this.top = top;
        this.readsView = typeof radius !== "number" && usesView(radius.formula);
        this.addParents(
            a,
            b,
            ...(typeof radius === "number" ? [] : radius.refs.values()),
        );
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "Rim",
            [
                context.index(this.A),
                context.index(this.B),
                dgoRadius(this.radius, context),
                this.rank,
                this.count,
                +this.top,
            ],
        ];
    }

    computeGeometry(): void {
        const axis = vSub(this.B.coords, this.A.coords);
        const theta = Math.atan2(axis[1], axis[0]);
        const u: Vec3 = [-Math.sin(theta), Math.cos(theta), 0];
        const v = vScale(vCross(axis, u), 1 / vNorm(axis));
        const radius = radiusValue(this.radius, this.C);
        if (!this.A.defined || !this.B.defined || radius === null) {
            this.defined = false;
            return;
        }
        const t = (2 * Math.PI * this.rank) / this.count;
        this.coords = vAdd(
            (this.top ? this.B : this.A).coords,
            vScale(
                vAdd(vScale(u, Math.cos(t)), vScale(v, Math.sin(t))),
                radius,
            ),
        );
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createRim(
    c: construction,
    name: string | null | undefined,
    a: point_object,
    b: point_object,
    radius: circle1_radius,
    rank: number,
    count: number,
    top: boolean,
): rim_object {
    return c.add(new rim_object(c, name, a, b, radius, rank, count, top));
}
