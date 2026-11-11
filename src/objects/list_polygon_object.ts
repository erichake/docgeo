import type { construction } from "../construction";
import type { DgoContext } from "./construction_object";
import type { list_object } from "./list_object";
import { point_object } from "./point_object";
import { polygon_object } from "./polygon_object";

// GeoGebra's Polygon(L): a vertex for each point of the list, as many as it
// has.
export class list_polygon_object extends polygon_object {
    constructor(
        c: construction,
        name: string | null | undefined,
        readonly list: list_object,
    ) {
        super(c, name, []);
        this.section = true;
        this.ownVertices = this.vertices;
        this.addParents(list);
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["PolyL", [context.index(this.list)]];
    }

    computeGeometry(): void {
        const { vertices, list } = this;
        const count = list.defined ? list.count : 0;
        while (vertices.length < count)
            vertices.push(new point_object(this.C, null, [0, 0, 0]));
        vertices.length = count;
        vertices.forEach((vertex, k) => {
            const coords = list.pointAt(k);
            vertex.coords = coords ?? [0, 0, 0];
            vertex.computeGeometry();
            vertex.defined &&= !!coords;
        });
        super.computeGeometry();
    }
}

export function createListPolygon(
    c: construction,
    name: string | null | undefined,
    list: list_object,
): list_polygon_object {
    return c.add(new list_polygon_object(c, name, list));
}
