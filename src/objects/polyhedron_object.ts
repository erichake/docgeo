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
import { above_object } from "./above_object";
import { dgoRadius, type circle1_radius } from "./circle1_object";
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

// The regular polyhedra, GeoGebra's: of tag Cube, Tetr, Octa, Dode or
// Icos, on the face ABC… of plane ABC, on the side of AB × BC; of tag CubP,
// TetP…, parallel to a plane, or CubZ, TetZ…, horizontal, on the side of
// its normal, or up, times `side` (1 or -1). The prism of a base polygon
// whose first vertex is translated to P; the pyramid of a base polygon and
// an apex S; of height h, as GeoGebra's Prism(poly, h) and Pyramid(poly,
// h), the prism's first top vertex or the pyramid's apex at height h (see
// above_object).
export type Regular = "Cub" | "Tet" | "Oct" | "Dod" | "Ico";
export type polyhedron_definition =
    | {
          tag: "Cube" | "Tetr" | "Octa" | "Dode" | "Icos";
          points: [point_object, point_object, point_object];
      }
    | {
          tag: `${Regular}P`;
          points: [point_object, point_object];
          plane: polygon_object;
          side: number;
      }
    | { tag: `${Regular}Z`; points: [point_object, point_object]; side: number }
    | { tag: "Prsm" | "Pyr"; base: polygon_object; point: point_object }
    | { tag: "PrsH" | "PyrH"; base: polygon_object; height: circle1_radius }
    // An image by a transformation: these vertices, on these faces (see
    // transformed_object.ts).
    | { tag: "Map"; vertices: point_object[]; faces: number[][] };

const PHI = (1 + Math.sqrt(5)) / 2;
// By the first three letters of their tags: the vertices of a face, then
// layers of as many over its center, or one over it, each of radius r and
// at height h, in units of the face's circumradius, turned by t half
// steps (the cube's exact, apart); their faces, by the vertices' letters
// A, B, C…, as GeoGebra's (PlatonicSolidsFactory), which also numbers
// their nets.
export const REGULAR: Record<
    string,
    [sides: number, layers: number[][], faces: string]
> = {
    Cub: [4, [], "DABC EADH BAEF CBFG DCGH EHGF"],
    Tet: [
        3,
        [
            [1, 0, 0],
            [0, Math.SQRT2, 0],
        ],
        "CAB DAC BAD CBD",
    ],
    Oct: [
        3,
        [
            [1, 0, 0],
            [1, Math.SQRT2, 1],
        ],
        "CAB FAC DAF BAD EBD CBE FCE FED",
    ],
    Dod: [
        5,
        [
            [1, 0, 0],
            [PHI, 1, 2],
            [PHI, PHI, 1],
            [1, PHI * PHI, 1],
        ],
        "EABCD JAEIO BAJKF CBFLG DCGMH EDHNI OINST JOTPK FKPQL GLQRM HMRSN TSRQP",
    ],
    Ico: [
        3,
        [
            [1, 0, 0],
            [PHI, 1, 1],
            [PHI, PHI, 0],
            [1, PHI * PHI, 1],
        ],
        "CAB FAC GAF DAG BAD HBD EBH CBE ICE FCI KEH IEK LIK FIL JKH LKJ GLJ FLG DJH GJD",
    ],
};

// A regular polyhedron's faces, by its vertices' indices.
export const regularFaces = (tag: string): number[][] =>
    REGULAR[tag.slice(0, 3)][2]
        .split(" ")
        .map((face) => [...face].map((letter) => letter.charCodeAt(0) - 65));

// The unit normal of a polygon's plane, that of its first three vertices.
export function normalOf({ points }: polygon_object): Vec3 | null {
    const [p, q, r] = points.map((point) => point.coords);
    return vNormalize(vCross(vSub(q, p), vSub(r, p)));
}

// The vertices of the regular polyhedron of this tag on AB, A and B
// included, rising along the unit vector n, its first face on the side of
// n × AB; none unless n is orthogonal to AB, as in GeoGebra.
export function regularVertices(
    tag: string,
    a: Vec3,
    b: Vec3,
    n: Vec3 | null,
): Vec3[] | null {
    const side = vSub(b, a);
    const length = vNorm(side);
    if (!n || !length || Math.abs(vDot(n, side)) > 1e-9 * length) return null;
    const [sides, layers] = REGULAR[tag.slice(0, 3)];
    const u = vScale(side, 1 / length);
    const w = vCross(n, u);
    if (!layers.length) {
        const across = vCross(n, side);
        const up = vScale(n, length);
        return [
            a,
            b,
            vAdd(b, across),
            vAdd(a, across),
            vAdd(a, up),
            vAdd(b, up),
            vAdd(vAdd(b, across), up),
            vAdd(vAdd(a, across), up),
        ];
    }
    const step = Math.PI / sides;
    const radius = length / 2 / Math.sin(step);
    const center = vAdd(
        vScale(vAdd(a, b), 0.5),
        vScale(w, length / 2 / Math.tan(step)),
    );
    return layers.flatMap(([r, h, t]) =>
        Array.from({ length: r ? sides : 1 }, (_, k) => {
            const angle = (1.5 * sides - 1 + t + 2 * k) * step;
            return [u, w, n].reduce(
                (point, axis, i) =>
                    vAdd(
                        point,
                        vScale(
                            axis,
                            radius *
                                [r * Math.cos(angle), r * Math.sin(angle), h][
                                    i
                                ],
                        ),
                    ),
                center,
            );
        }),
    );
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
    // Its vertex at height h.
    private above: above_object | null = null;
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
        if (definition.tag === "Map") {
            this.vertices = definition.vertices;
            this.faces = definition.faces;
        } else if ("points" in definition) {
            const [a, b] = definition.points;
            this.faces = regularFaces(definition.tag);
            this.vertices = [a, b, ...own(Math.max(...this.faces.flat()) - 1)];
            this.addParents(...definition.points);
            if ("plane" in definition) this.addParents(definition.plane);
        } else {
            const { base } = definition;
            const point =
                "point" in definition
                    ? definition.point
                    : (this.above = new above_object(
                          c,
                          null,
                          base,
                          definition.height,
                          definition.tag === "PyrH" ? -1 : 0,
                      ));
            const n = base.vertices.length;
            const ring = (offset: number) =>
                Array.from({ length: n }, (_, i) => i + offset);
            const bottom = ring(0);
            const next = (i: number) => (i + 1) % n;
            if (definition.tag === "Pyr" || definition.tag === "PyrH") {
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
            // Its vertex at height h is its own, not its parent.
            this.addParents(
                base,
                ...("point" in definition
                    ? [point]
                    : typeof definition.height === "number"
                      ? []
                      : definition.height.refs.values()),
            );
        }
    }

    dgo(context: DgoContext): [string, unknown] {
        const d = this.definition as Exclude<
            polyhedron_definition,
            { tag: "Map" }
        >;
        if ("height" in d)
            return [
                d.tag,
                [context.index(d.base), dgoRadius(d.height, context)],
            ];
        if (!("points" in d))
            return [d.tag, [d.base, d.point].map(context.index)];
        return [
            d.tag,
            [
                ...d.points.map(context.index),
                ...("plane" in d ? [context.index(d.plane)] : []),
                ...("side" in d ? [d.side] : []),
            ],
        ];
    }

    computeGeometry(): void {
        const d = this.definition;
        this.above?.computeGeometry();
        this.defined = [...this.parents, ...this.vertices].every(
            (parent) => parent.defined,
        );
        if (!this.defined) return;
        const coords = this.vertices.map((vertex) => vertex.coords);
        if ("points" in d) {
            const [a, b] = coords;
            const along: Vec3 | null =
                "plane" in d ? normalOf(d.plane) : [0, 0, 1];
            const vertices = regularVertices(
                d.tag,
                a,
                b,
                "side" in d
                    ? along && vScale(along, d.side)
                    : vNormalize(
                          vCross(vSub(b, a), vSub(d.points[2].coords, b)),
                      ),
            );
            if (!vertices) {
                this.defined = false;
                return;
            }
            for (let i = 2; i < vertices.length; i++) coords[i] = vertices[i];
        } else if (d.tag === "Prsm" || d.tag === "PrsH") {
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
