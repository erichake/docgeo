import type { construction } from "../construction";
import { vCross, vNormalize, vSub } from "../vec";
import type { DgoContext } from "./construction_object";
import { plane_object } from "./plane_object";
import { point_object } from "./point_object";
import { cubeVertices, normalOf } from "./polyhedron_object";

// A vertex of GeoGebra's cube on the square ABCD of plane ABC, on the side
// of AB × BC, or parallel to a plane, on the side of its normal, none when
// AB isn't: of rank k
// among B + w, A + w, A + h, B + h, B + w + h and A + w + h, w being AB
// turned a quarter in the square's plane and h its height.
export class cube_vertex_object extends point_object {
    moveable = false;
    A: point_object;
    B: point_object;
    third: point_object | plane_object;
    rank: number;

    constructor(
        c: construction,
        name: string | null | undefined,
        a: point_object,
        b: point_object,
        third: point_object | plane_object,
        rank: number,
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.A = a;
        this.B = b;
        this.third = third;
        this.rank = rank;
        this.addParents(a, b, third);
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "CubV",
            [...[this.A, this.B, this.third].map(context.index), this.rank],
        ];
    }

    computeGeometry(): void {
        const { A, B, third } = this;
        const [a, b] = [A.coords, B.coords];
        const vertices =
            A.defined &&
            B.defined &&
            third.defined &&
            cubeVertices(
                a,
                b,
                third instanceof plane_object
                    ? normalOf(third)
                    : vNormalize(vCross(vSub(b, a), vSub(third.coords, b))),
            );
        if (!vertices) {
            this.defined = false;
            return;
        }
        this.coords = vertices[this.rank];
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createCubeVertex(
    c: construction,
    name: string | null | undefined,
    a: point_object,
    b: point_object,
    third: point_object | plane_object,
    rank: number,
): cube_vertex_object {
    return c.add(new cube_vertex_object(c, name, a, b, third, rank));
}
