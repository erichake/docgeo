import type { construction } from "../construction";
import { usesView } from "../import/dgp_formula";
import { vAdd, vCross, vNormalize, vScale, vSub, type Vec3 } from "../vec";
import { dgoRadius, radiusValue, type circle1_radius } from "./circle1_object";
import type { DgoContext } from "./construction_object";
import { point_object } from "./point_object";
import type { polygon_object } from "./polygon_object";

// At height h over a polygon's center (rank -1) or over its vertex of
// rank k, along its normal turned upwards, as GeoGebra's Pyramid(poly, h)
// and Prism(poly, h) place their apex and first top vertex.
export class above_object extends point_object {
    moveable = false;
    polygon: polygon_object;
    height: circle1_radius;
    rank: number;

    constructor(
        c: construction,
        name: string | null | undefined,
        polygon: polygon_object,
        height: circle1_radius,
        rank: number,
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.polygon = polygon;
        this.height = height;
        this.rank = rank;
        this.readsView = typeof height !== "number" && usesView(height.formula);
        this.addParents(
            polygon,
            ...(typeof height === "number" ? [] : height.refs.values()),
        );
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "Abv",
            [
                context.index(this.polygon),
                dgoRadius(this.height, context),
                this.rank,
            ],
        ];
    }

    computeGeometry(): void {
        const vertices = this.polygon.vertices.map((vertex) => vertex.coords);
        const [a, b, c] = vertices;
        const normal = vNormalize(vCross(vSub(b, a), vSub(c, a)));
        const height = radiusValue(this.height, this.C);
        if (!this.polygon.defined || !normal || height === null) {
            this.defined = false;
            return;
        }
        const base: Vec3 =
            this.rank < 0
                ? vScale(vertices.reduce(vAdd), 1 / vertices.length)
                : vertices[this.rank];
        this.coords = vAdd(
            base,
            vScale(normal, normal[2] < 0 ? -height : height),
        );
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createAbove(
    c: construction,
    name: string | null | undefined,
    polygon: polygon_object,
    height: circle1_radius,
    rank: number,
): above_object {
    return c.add(new above_object(c, name, polygon, height, rank));
}
