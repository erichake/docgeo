import type { construction } from "../construction";
import type { DgoContext } from "./construction_object";
import { point_object } from "./point_object";
import type { polygon_object } from "./polygon_object";

// The vertex of a polygon of rank k, from 0.
export class vertex_object extends point_object {
    moveable = false;
    polygon: polygon_object;
    rank: number;

    constructor(
        c: construction,
        name: string | null | undefined,
        polygon: polygon_object,
        rank: number,
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.polygon = polygon;
        this.rank = rank;
        this.addParents(polygon);
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["Vtx", [context.index(this.polygon), this.rank]];
    }

    computeGeometry(): void {
        const vertex = this.polygon.points[this.rank];
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
    polygon: polygon_object,
    rank: number,
): vertex_object {
    return c.add(new vertex_object(c, name, polygon, rank));
}
