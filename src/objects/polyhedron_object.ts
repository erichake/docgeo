import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import { projectPointOnPlane, viewDirection } from "../projection";
import {
    pointInPolygon,
    vAdd,
    vCross,
    vDot,
    vIsFinite,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import type { construction_object, DgoContext } from "./construction_object";
import { point_object } from "./point_object";
import {
    lighting,
    pathData,
    shade,
    type polygon_object,
} from "./polygon_object";
import { solid_object } from "./solid_object";
import { convexHull } from "./sphere_object";

// The cube on the square ABCD of plane ABC, on the side of AB × BC, or
// of a plane, or horizontal, on the side of its normal, or up, times
// `side` (1 or -1); the prism of a base polygon whose first vertex is
// translated to P; the pyramid of a base polygon and an apex S.
export type polyhedron_definition =
    | { tag: "Cube"; points: [point_object, point_object, point_object] }
    | {
          tag: "CubP";
          points: [point_object, point_object];
          plane: polygon_object;
          side: number;
      }
    | { tag: "CubZ"; points: [point_object, point_object]; side: number }
    | { tag: "Prsm" | "Pyr"; base: polygon_object; point: point_object };

// The cube's faces, by its vertices A..H = 0..7, as GeoGebra's.
const CUBE_FACES = [
    [3, 0, 1, 2],
    [4, 0, 3, 7],
    [1, 0, 4, 5],
    [2, 1, 5, 6],
    [3, 2, 6, 7],
    [4, 7, 6, 5],
];

// The unit normal of a polygon's plane, that of its first three vertices.
export function normalOf({ points }: polygon_object): Vec3 | null {
    const [p, q, r] = points.map((point) => point.coords);
    return vNormalize(vCross(vSub(q, p), vSub(r, p)));
}

// Vertices C to H of the cube on AB rising along the unit vector n, its
// square ABCD on the side of n × AB; none unless n is orthogonal to AB, as
// in GeoGebra.
export function cubeVertices(a: Vec3, b: Vec3, n: Vec3 | null): Vec3[] | null {
    const side = vSub(b, a);
    const length = vNorm(side);
    if (!n || !length || Math.abs(vDot(n, side)) > 1e-9 * length) return null;
    const across = vCross(n, side);
    const up = vScale(n, length);
    return [
        vAdd(b, across),
        vAdd(a, across),
        vAdd(a, up),
        vAdd(b, up),
        vAdd(vAdd(b, across), up),
        vAdd(vAdd(a, across), up),
    ];
}

// A polyhedron drawn whole: its faces, the far ones first, lit like
// polygons, and its edges, dashed when only far faces meet there; its
// vertices are those it is built from and its own.
export class polyhedron_object extends solid_object {
    definition: polyhedron_definition;
    vertices: point_object[];
    faces: number[][];
    // Those it computes, outside the figure.
    private own: point_object[] = [];
    // Their outward unit normals, and whether they face the camera.
    private normals: Vec3[] = [];
    private facing: boolean[] = [];
    private facePaths: DOMElement[] = [];
    private edges!: DOMElement;
    private hiddenEdges!: DOMElement;

    constructor(
        c: construction,
        name: string | null | undefined,
        definition: polyhedron_definition,
    ) {
        super(c, name);
        this.definition = definition;
        const own = (count: number) =>
            (this.own = Array.from(
                { length: count },
                () => new point_object(c, null, [0, 0, 0]),
            ));
        if ("points" in definition) {
            const [a, b] = definition.points;
            this.vertices = [a, b, ...own(6)];
            this.faces = CUBE_FACES;
            this.addParents(...definition.points);
            if (definition.tag === "CubP") this.addParents(definition.plane);
        } else {
            const { base, point } = definition;
            const n = base.vertices.length;
            const ring = (offset: number) =>
                Array.from({ length: n }, (_, i) => i + offset);
            const bottom = ring(0);
            const next = (i: number) => (i + 1) % n;
            if (definition.tag === "Pyr") {
                this.vertices = [...base.vertices, point];
                this.faces = [bottom, ...bottom.map((i) => [i, next(i), n])];
            } else {
                this.vertices = [...base.vertices, point, ...own(n - 1)];
                this.faces = [
                    bottom,
                    ...bottom.map((i) => [i, next(i), n + next(i), n + i]),
                    ring(n),
                ];
            }
            this.addParents(base, point);
        }
    }

    dgo(context: DgoContext): [string, unknown] {
        const d = this.definition;
        if (!("points" in d))
            return [d.tag, [d.base, d.point].map(context.index)];
        const points = d.points.map(context.index);
        return [
            d.tag,
            d.tag === "Cube"
                ? points
                : d.tag === "CubP"
                  ? [...points, context.index(d.plane), d.side]
                  : [...points, d.side],
        ];
    }

    computeGeometry(): void {
        const d = this.definition;
        this.defined = this.parents.every((parent) => parent.defined);
        if (!this.defined) return;
        const coords = this.vertices.map((vertex) => vertex.coords);
        if ("points" in d) {
            const [a, b] = coords;
            const along: Vec3 | null =
                d.tag === "CubP" ? normalOf(d.plane) : [0, 0, 1];
            const vertices = cubeVertices(
                a,
                b,
                d.tag === "Cube"
                    ? vNormalize(
                          vCross(vSub(b, a), vSub(d.points[2].coords, b)),
                      )
                    : along && vScale(along, d.side),
            );
            if (!vertices) {
                this.defined = false;
                return;
            }
            vertices.forEach((point, i) => (coords[i + 2] = point));
        } else if (d.tag === "Prsm") {
            const n = d.base.vertices.length;
            const shift = vSub(coords[n], coords[0]);
            for (let i = 1; i < n; i++) coords[n + i] = vAdd(coords[i], shift);
        }
        this.vertices.forEach((vertex, i) => {
            if (!this.own.includes(vertex)) return;
            vertex.coords = coords[i];
            vertex.computeGeometry();
        });
        const center = vScale(coords.reduce(vAdd), 1 / coords.length);
        this.normals = this.faces.map((face) => {
            const [p, q, r] = face.map((i) => coords[i]);
            const normal = vNormalize(vCross(vSub(q, p), vSub(r, p))) ?? [
                0, 0, 1,
            ];
            return vDot(normal, vSub(p, center)) < 0
                ? vScale(normal, -1)
                : normal;
        });
    }

    project(): void {
        this.projectionDefined = false;
        if (!this.defined) return;
        this.vertices.forEach((vertex) => vertex.project());
        const screens = this.vertices.map((vertex) => vertex.screen);
        if (!screens.every(vIsFinite)) return;
        this.outline = convexHull(screens);
        const frame = this.C.projectionFrame;
        const dir = vNormalize(viewDirection(frame))!;
        this.facing = this.faces.map((face, k) => {
            const p = this.vertices[face[0]].coords;
            const toward =
                frame.focal === undefined
                    ? dir
                    : vSub(p, vScale(dir, -frame.focal));
            return vDot(this.normals[k], toward) < 0;
        });
        this.projectionDefined = true;
    }

    entryDepth(screen: Vec2): number | null {
        const frame = this.C.projectionFrame;
        const dir = vNormalize(viewDirection(frame))!;
        const depths = this.faces.flatMap((face) => {
            const [p, q, r] = face.map((i) => this.vertices[i].coords);
            if (
                !pointInPolygon(
                    screen,
                    face.map((i) => this.vertices[i].screen),
                )
            )
                return [];
            const point = projectPointOnPlane(
                screen,
                p,
                [vSub(q, p), vSub(r, p)],
                frame,
            );
            return point ? [vDot(point, dir)] : [];
        });
        return depths.length ? Math.min(...depths) : null;
    }

    render(): void {
        this.dom.stl(
            "display",
            this.isVisible && this.projectionDefined ? "block" : "none",
        );
        if (!this.defined || !this.projectionDefined) return;
        const screen = (i: number) => this.vertices[i].screen;
        // The far faces first.
        const order = this.faces
            .map((_, k) => k)
            .sort((k, l) => +this.facing[k] - +this.facing[l]);
        order.forEach((k, position) =>
            this.facePaths[position]
                .att("d", pathData(this.faces[k].map(screen)))
                .stl(
                    "fill",
                    shade(this.fill_color, lighting(this.C, this.normals[k])),
                ),
        );
        // Each edge once, dashed when no near face meets there.
        const edges = new Map<string, boolean>();
        this.faces.forEach((face, k) =>
            face.forEach((i, position) => {
                const j = face[(position + 1) % face.length];
                const key = i < j ? `${i},${j}` : `${j},${i}`;
                edges.set(key, (edges.get(key) ?? false) || this.facing[k]);
            }),
        );
        const paths = ["", ""];
        edges.forEach((near, key) => {
            const [i, j] = key.split(",").map(Number);
            paths[+!near] += ` M${screen(i).join(" ")} L${screen(j).join(" ")}`;
        });
        this.edges.att("d", paths[0]);
        this.hiddenEdges.att("d", paths[1]);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as polyhedron_object;
        t.facePaths = t.faces.map(() =>
            t.svg
                .shape("path")
                .stl("fill-opacity", t.opacity ?? 0)
                .stl("stroke", "none")
                .stl("pointer-events", "none"),
        );
        const stroke = (dash: string) =>
            t.svg
                .shape("path")
                .stl("fill", "none")
                .stl("stroke", t.stroke_color)
                .stl("stroke-width", t.size)
                .stl("stroke-dasharray", dash)
                .stl("pointer-events", "none");
        t.edges = stroke(t.strokeDashArray);
        t.hiddenEdges = stroke(`${t.size * 3} ${t.size * 2}`);
        return t.svg.shape("g").add(...t.facePaths, t.edges, t.hiddenEdges);
    }
}

export function createPolyhedron(
    c: construction,
    name: string | null | undefined,
    definition: polyhedron_definition,
): polyhedron_object {
    return c.add(new polyhedron_object(c, name, definition));
}
