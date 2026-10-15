import type { construction } from "../construction";
import { usesView } from "../import/dgp_formula";
import { vAdd, vScale, vSub, type Vec3 } from "../vec";
import { dgoRadius, radiusValue, type circle1_radius } from "./circle1_object";
import type { DgoContext } from "./construction_object";
import { point_object } from "./point_object";

// The image of P by the dilation of center O (the origin without it) and
// ratio k.
export class dilation_object extends point_object {
    moveable = false;
    center: point_object | null;
    point: point_object;
    ratio: circle1_radius;

    constructor(
        c: construction,
        name: string | null | undefined,
        center: point_object | null,
        point: point_object,
        ratio: circle1_radius,
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.center = center;
        this.point = point;
        this.ratio = ratio;
        this.readsView = typeof ratio !== "number" && usesView(ratio.formula);
        this.addParents(
            ...(center ? [center] : []),
            point,
            ...(typeof ratio === "number" ? [] : ratio.refs.values()),
        );
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "Dil",
            [
                this.center && context.index(this.center),
                context.index(this.point),
                dgoRadius(this.ratio, context),
            ],
        ];
    }

    computeGeometry(): void {
        const ratio = radiusValue(this.ratio, this.C);
        if (
            !this.point.defined ||
            this.center?.defined === false ||
            ratio === null
        ) {
            this.defined = false;
            return;
        }
        const o: Vec3 = this.center?.coords ?? [0, 0, 0];
        this.coords = vAdd(o, vScale(vSub(this.point.coords, o), ratio));
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createDilation(
    c: construction,
    name: string | null | undefined,
    center: point_object | null,
    point: point_object,
    ratio: circle1_radius,
): dilation_object {
    return c.add(new dilation_object(c, name, center, point, ratio));
}
