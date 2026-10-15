import type { construction } from "../construction";
import { vAdd, vNorm, vScale, vSub } from "../vec";
import type { DgoContext } from "./construction_object";
import { point_object } from "./point_object";

// Kimberling's first centers of ABC, by their barycentric coordinates:
// 1 incenter, 2 centroid, 3 circumcenter, 4 orthocenter, 5 nine-point
// center.
export class triangle_center_object extends point_object {
    moveable = false;
    vertices: point_object[];
    kind: number;

    constructor(
        c: construction,
        name: string | null | undefined,
        vertices: point_object[],
        kind: number,
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.vertices = vertices;
        this.kind = kind;
        this.addParents(...vertices);
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["TC", [...this.vertices.map(context.index), this.kind]];
    }

    computeGeometry(): void {
        if (!this.vertices.every((vertex) => vertex.defined)) {
            this.defined = false;
            return;
        }
        const points = this.vertices.map((vertex) => vertex.coords);
        // The sides, a opposite A…
        const sides = points.map((_, i) =>
            vNorm(vSub(points[(i + 1) % 3], points[(i + 2) % 3])),
        );
        const squares = sides.map((side) => side * side);
        const circumcenter = squares.map(
            (square, i) =>
                square * (squares[(i + 1) % 3] + squares[(i + 2) % 3] - square),
        );
        // The orthocenter and the nine-point center from the circumcenter
        // O: H = A + B + C - 2O, N = (A + B + C - O) / 2.
        const [weights, k, l] = [
            [sides, 0, 1],
            [[1, 1, 1], 0, 1],
            [circumcenter, 0, 1],
            [circumcenter, 1, -2],
            [circumcenter, 1 / 2, -1 / 2],
        ][this.kind - 1] as [number[], number, number];
        const total = weights.reduce((sum, weight) => sum + weight, 0);
        const center = points.reduce(
            (sum, point, i) => vAdd(sum, vScale(point, weights[i] / total)),
            [0, 0, 0],
        );
        const sum = points.reduce((s, point) => vAdd(s, point), [0, 0, 0]);
        this.coords = vAdd(vScale(sum, k), vScale(center, l));
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createTriangleCenter(
    c: construction,
    name: string | null | undefined,
    vertices: point_object[],
    kind: number,
): triangle_center_object {
    return c.add(new triangle_center_object(c, name, vertices, kind));
}
