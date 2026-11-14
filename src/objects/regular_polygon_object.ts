import type { construction } from "../construction";
import { usesView } from "../import/dgp_formula";
import { vAdd, vCross, vScale, vSub, type Vec3 } from "../vec";
import { dgoRadius, radiusValue, type circle1_radius } from "./circle1_object";
import type { DgoContext } from "./construction_object";
import { point_object } from "./point_object";
import { polygon_object } from "./polygon_object";

// The regular polygon of n sides on [AB], counterclockwise, or around the
// normal of a plane: its other vertices are its own. Of a formula's n, as
// GeoGebra's Polygon(A, B, n) of a slider: undefined below 3 sides, its
// vertices beyond n undefined.
export class regular_polygon_object extends polygon_object {
    sides: circle1_radius;
    support?: polygon_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        a: point_object,
        b: point_object,
        sides: circle1_radius,
        plane?: polygon_object,
    ) {
        super(c, name, [a, b]);
        this.sides = sides;
        this.support = plane;
        if (plane) this.addParents(plane);
        if (typeof sides === "number") this.grow(sides);
        else {
            this.readsView = usesView(sides.formula);
            this.addParents(...sides.refs.values());
        }
    }

    private grow(n: number): void {
        while (this.vertices.length < n) {
            const vertex = new point_object(this.C, null, [0, 0, 0]);
            this.vertices.push(vertex);
            this.ownVertices.push(vertex);
        }
        if (this.points.length !== n) this.points = this.vertices.slice(0, n);
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "RegP",
            [
                ...this.vertices.slice(0, 2).map(context.index),
                dgoRadius(this.sides, context),
                ...(this.support ? [context.index(this.support)] : []),
            ],
        ];
    }

    computeGeometry(): void {
        if (typeof this.sides !== "number") {
            const n = Math.round(radiusValue(this.sides, this.C) ?? NaN);
            this.ownVertices.forEach((vertex) => (vertex.defined = false));
            if (!(n >= 3)) {
                this.defined = false;
                return;
            }
            this.grow(n);
        }
        const [a, b, ...others] = this.points;
        const side = vSub(b.coords, a.coords);
        // AB turned a quarter, in its plane.
        const across: Vec3 = this.support
            ? vCross(this.support.NORMAL, side)
            : [-side[1], side[0], 0];
        const n = this.points.length;
        // The k-th vertex, B turned and scaled around A.
        others.forEach((vertex, index) => {
            const k = index + 2;
            const scale = Math.sin((k * Math.PI) / n) / Math.sin(Math.PI / n);
            const angle = ((k - 1) * Math.PI) / n;
            vertex.coords = vAdd(
                a.coords,
                vAdd(
                    vScale(side, scale * Math.cos(angle)),
                    vScale(across, scale * Math.sin(angle)),
                ),
            );
            vertex.computeGeometry();
        });
        super.computeGeometry();
        this.defined &&= this.support?.defined !== false;
    }
}

export function createRegularPolygon(
    c: construction,
    name: string | null | undefined,
    a: point_object,
    b: point_object,
    sides: circle1_radius,
    plane?: polygon_object,
): regular_polygon_object {
    return c.add(new regular_polygon_object(c, name, a, b, sides, plane));
}
