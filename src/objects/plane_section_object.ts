import type { construction } from "../construction";
import {
    GEOMETRY_EPSILON,
    vAdd,
    vCross,
    vDot,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec3,
} from "../vec";
import type { DgoContext } from "./construction_object";
import type { plane_object } from "./plane_object";
import { point_object } from "./point_object";
import { polygon_object } from "./polygon_object";
import type { polyhedron_object } from "./polyhedron_object";

// A plane's section of a polyhedron, with a vertex where it cuts each edge,
// undefined where it misses the edge: it keeps its defined vertices. Those
// of GeoGebra's polyhedra, its faces in the figure, come in the order of
// their edges; those of a polyhedron of DocGeo, convex, around their
// center.
export class plane_section_object extends polygon_object {
    PLANE: plane_object;
    SOLID: polyhedron_object | null;
    edges: [point_object, point_object][];

    constructor(
        c: construction,
        name: string | null | undefined,
        plane: plane_object,
        source: [point_object, point_object][] | polyhedron_object,
    ) {
        const solid = Array.isArray(source) ? null : source;
        const edges = solid
            ? polyhedronEdges(solid)
            : (source as [point_object, point_object][]);
        super(
            c,
            name,
            edges.map(() => new point_object(c, null, [0, 0, 0])),
        );
        this.PLANE = plane;
        this.SOLID = solid;
        this.edges = edges;
        this.section = true;
        this.ownVertices = this.vertices;
        this.addParents(plane, ...(solid ? [solid] : edges.flat()));
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "PlS",
            [
                this.PLANE,
                ...(this.SOLID ? [this.SOLID] : this.edges.flat()),
            ].map(context.index),
        ];
    }

    computeGeometry(): void {
        const { NORMAL: normal, CENTER: center } = this.PLANE;
        const cuts: (Vec3 | null)[] = this.edges.map(([a, b]) => {
            const t =
                vDot(normal, vSub(center, a.coords)) /
                vDot(normal, vSub(b.coords, a.coords));
            return this.PLANE.defined &&
                a.defined &&
                b.defined &&
                t >= 0 &&
                t <= 1
                ? vAdd(a.coords, vScale(vSub(b.coords, a.coords), t))
                : null;
        });
        if (this.SOLID) {
            // Once each, a vertex in the plane being on several edges.
            const points = cuts.filter(
                (p, k): p is Vec3 =>
                    !!p &&
                    !cuts
                        .slice(0, k)
                        .some(
                            (q) =>
                                q &&
                                vNorm(vSub(p, q)) <=
                                    GEOMETRY_EPSILON * (1 + vNorm(p)),
                        ),
            );
            const middle = vScale(
                points.reduce(vAdd, [0, 0, 0]),
                1 / points.length,
            );
            const u =
                vNormalize(vCross(normal, [0, 0, 1])) ??
                vNormalize(vCross(normal, [1, 0, 0]))!;
            const v = vCross(normal, u);
            const angle = (p: Vec3) =>
                Math.atan2(vDot(vSub(p, middle), v), vDot(vSub(p, middle), u));
            points.sort((p, q) => angle(p) - angle(q));
            cuts.fill(null).splice(0, points.length, ...points);
        }
        this.vertices.forEach((vertex, k) => {
            vertex.coords = cuts[k] ?? [0, 0, 0];
            vertex.computeGeometry();
            vertex.defined &&= !!cuts[k];
        });
        super.computeGeometry();
    }
}

// Each edge of its faces once.
function polyhedronEdges(
    solid: polyhedron_object,
): [point_object, point_object][] {
    const edges = new Map<string, [point_object, point_object]>();
    solid.faces.forEach((face) =>
        face.forEach((i, position) => {
            const j = face[(position + 1) % face.length];
            edges.set(i < j ? `${i},${j}` : `${j},${i}`, [
                solid.vertices[i],
                solid.vertices[j],
            ]);
        }),
    );
    return [...edges.values()];
}

export function createPlaneSection(
    c: construction,
    name: string | null | undefined,
    plane: plane_object,
    source: [point_object, point_object][] | polyhedron_object,
): plane_section_object {
    return c.add(new plane_section_object(c, name, plane, source));
}
