import type { construction } from "../construction";
import { vAdd, vDot, vScale, vSub } from "../vec";
import type { DgoContext } from "./construction_object";
import type { plane_object } from "./plane_object";
import { point_object } from "./point_object";
import { polygon_object } from "./polygon_object";

// A plane's section of a polyhedron, with a vertex where it cuts each edge,
// undefined where it misses the edge: it keeps its defined vertices.
export class plane_section_object extends polygon_object {
    PLANE: plane_object;
    edges: [point_object, point_object][];

    constructor(
        c: construction,
        name: string | null | undefined,
        plane: plane_object,
        edges: [point_object, point_object][],
    ) {
        super(
            c,
            name,
            edges.map(() => new point_object(c, null, [0, 0, 0])),
        );
        this.PLANE = plane;
        this.edges = edges;
        this.section = true;
        this.ownVertices = this.vertices;
        this.addParents(plane, ...edges.flat());
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["PlS", [this.PLANE, ...this.edges.flat()].map(context.index)];
    }

    computeGeometry(): void {
        const { NORMAL: normal, CENTER: center } = this.PLANE;
        this.edges.forEach(([a, b], index) => {
            const vertex = this.vertices[index];
            const t =
                vDot(normal, vSub(center, a.coords)) /
                vDot(normal, vSub(b.coords, a.coords));
            vertex.coords = vAdd(a.coords, vScale(vSub(b.coords, a.coords), t));
            vertex.computeGeometry();
            vertex.defined &&=
                this.PLANE.defined &&
                a.defined &&
                b.defined &&
                t >= 0 &&
                t <= 1;
        });
        super.computeGeometry();
    }
}

export function createPlaneSection(
    c: construction,
    name: string | null | undefined,
    plane: plane_object,
    edges: [point_object, point_object][],
): plane_section_object {
    return c.add(new plane_section_object(c, name, plane, edges));
}
