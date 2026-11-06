import type { construction } from "../construction";
import { vAdd, vCross, vScale, vSub, type Vec3 } from "../vec";
import type { DgoContext } from "./construction_object";
import { point_object } from "./point_object";
import { polygon_object } from "./polygon_object";

// The regular polygon of n sides on [AB], counterclockwise, or around the
// normal of a plane: its other vertices are its own.
export class regular_polygon_object extends polygon_object {
    sides: number;
    support?: polygon_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        a: point_object,
        b: point_object,
        sides: number,
        plane?: polygon_object,
    ) {
        super(c, name, [
            a,
            b,
            ...Array.from(
                { length: sides - 2 },
                () => new point_object(c, null, [0, 0, 0]),
            ),
        ]);
        this.sides = sides;
        this.ownVertices = this.points.slice(2);
        this.support = plane;
        if (plane) this.addParents(plane);
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "RegP",
            [
                ...this.points.slice(0, 2).map(context.index),
                this.sides,
                ...(this.support ? [context.index(this.support)] : []),
            ],
        ];
    }

    computeGeometry(): void {
        const [a, b, ...others] = this.points;
        const side = vSub(b.coords, a.coords);
        // AB turned a quarter, in its plane.
        const across: Vec3 = this.support
            ? vCross(this.support.NORMAL, side)
            : [-side[1], side[0], 0];
        const n = this.sides;
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
    sides: number,
    plane?: polygon_object,
): regular_polygon_object {
    return c.add(new regular_polygon_object(c, name, a, b, sides, plane));
}
