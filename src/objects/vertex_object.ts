import type { construction } from "../construction";
import type { DgoContext } from "./construction_object";
import { point_object } from "./point_object";
import type { polygon_object } from "./polygon_object";
import type { polyhedron_object } from "./polyhedron_object";

// The vertex of a polygon or a polyhedron of rank k, from 0. Wrapping, a
// polygon's rank n is its first vertex: the end of its closing side, when
// its number of sides varies (see regular_polygon_object.ts).
export class vertex_object extends point_object {
    moveable = false;
    polygon: polygon_object | polyhedron_object;
    rank: number;
    wrap: boolean;

    constructor(
        c: construction,
        name: string | null | undefined,
        polygon: polygon_object | polyhedron_object,
        rank: number,
        wrap = false,
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.polygon = polygon;
        this.rank = rank;
        this.wrap = wrap;
        this.addParents(polygon);
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "Vtx",
            [context.index(this.polygon), this.rank, ...(this.wrap ? [1] : [])],
        ];
    }

    computeGeometry(): void {
        const vertex =
            this.polygon.vertices[
                this.wrap &&
                this.rank === (this.polygon as polygon_object).points.length
                    ? 0
                    : this.rank
            ];
        if (!this.polygon.defined || !vertex?.defined) {
            this.defined = false;
            return;
        }
        this.coords = vertex.coords;
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createVertex(
    c: construction,
    name: string | null | undefined,
    polygon: polygon_object | polyhedron_object,
    rank: number,
    wrap?: boolean,
): vertex_object {
    return c.add(new vertex_object(c, name, polygon, rank, wrap));
}
