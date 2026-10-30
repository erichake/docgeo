import type { construction } from "../construction";
import {
    geometryTolerance,
    vAdd,
    vCross,
    vDot,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec3,
} from "../vec";
import { arc3pts_object } from "./arc3pts_object";
import { circle3pts_object } from "./circle3pts_object";
import { conic_arc_object } from "./conic_arc_object";
import type { construction_object } from "./construction_object";
import type { curve_object } from "./curve_object";
import { locus_object } from "./locus_object";
import { isRay } from "./macro_object";
import { point_on_object } from "./point_on_object";
import { point_object } from "./point_object";
import { plane_object } from "./plane_object";
import { polygon_object } from "./polygon_object";
import { polyhedron_object } from "./polyhedron_object";
import { normalizeAngle, primitive_arc_object } from "./primitive_arc_object";
import { primitive_circle_object } from "./primitive_circle_object";
import { primitive_line_object } from "./primitive_line_object";
import { primitive_quadric_object } from "./primitive_quadric_object";
import { quadric5pts_object } from "./quadric5pts_object";
import { ray_line_object } from "./ray_line_object";
import { segment_object } from "./segment_object";
import { sphere_object } from "./sphere_object";
import { two_points_line_object } from "./two_points_line_object";
import { vector_object } from "./vector_object";

export type transformable =
    | primitive_line_object
    | primitive_circle_object
    | polygon_object
    | primitive_quadric_object
    | curve_object
    | locus_object
    | sphere_object
    | polyhedron_object;

// How an image is built, when not by a similarity (see createTransformed).
export interface ImageOptions {
    // Its look (see imageLook), a polygon's "Loc" being the polygon of the
    // images of points along its sides.
    look?: string;
    // The point the map sends away, an inversion's center: a line's points
    // are then taken around its point nearest to it, a circle's away from
    // it, a polygon's along its sides.
    pole?: () => Vec3;
    // Added to its entry's parameters: a straight image by an inversion.
    mark?: number;
    // What gives its entry and its parents, by default the image of the
    // object as a point's.
    template?: construction_object;
}

// A point of an object, read from its geometry.
class source_point extends point_object {
    moveable = false;

    constructor(
        c: construction,
        readonly source: construction_object,
        readonly at: () => Vec3,
    ) {
        super(c, null, [0, 0, 0], "intersection");
    }

    computeGeometry(): void {
        this.defined = this.source.defined;
        if (this.defined) this.coords = this.at();
    }
}

// The middle of an arc, whichever way it runs.
function middle(arc: primitive_arc_object): Vec3 {
    const { startAlpha, endAlpha, sweepFlag } = arc;
    const from = sweepFlag ? startAlpha : endAlpha;
    const to = sweepFlag ? endAlpha : startAlpha;
    return arc.pointAt(from + normalizeAngle(to - from) / 2);
}

const foot = (line: primitive_line_object, point: Vec3): Vec3 =>
    vAdd(
        line.P1.coords,
        vScale(line.VEC, vDot(vSub(point, line.P1.coords), line.VEC)),
    );

// Whether the line or the circle passes through the center of the circle
// of an inversion, which maps it to a line.
export function straightImage(
    circle: primitive_circle_object,
    source: construction_object,
): boolean {
    const center = circle.CENTER;
    const gap =
        source instanceof primitive_line_object
            ? vNorm(vSub(center, foot(source, center)))
            : source instanceof primitive_circle_object
              ? Math.abs(vNorm(vSub(center, source.CENTER)) - source.R)
              : Infinity;
    return gap <= geometryTolerance(circle.R);
}

// The .dgo type whose look the object's image has: of the same kind by a
// similarity, a conic's by an affine map. By a map that bends lines, as an
// inversion, a line or a circle, a segment or an arc, `straight` or not, a
// polygon whose sides are arcs. Otherwise, a locus.
export function imageLook(source: transformable, straight?: boolean): string {
    const bends = straight !== undefined;
    if (source instanceof vector_object) return bends ? "Loc" : "Vec";
    if (source instanceof segment_object)
        return !bends || straight ? "Seg" : "Arc";
    if (source instanceof primitive_line_object)
        return isRay(source)
            ? bends
                ? "Loc"
                : "Ray"
            : !bends || straight
              ? "Line"
              : "Cir";
    if (source instanceof primitive_arc_object) return straight ? "Seg" : "Arc";
    if (source instanceof primitive_circle_object)
        return straight ? "Line" : "Cir";
    if (source instanceof plane_object) return "Pl";
    if (source instanceof polygon_object) return "Poly";
    if (source instanceof sphere_object) return "Sph";
    if (source instanceof polyhedron_object) return "Cube";
    return source instanceof primitive_quadric_object &&
        !(source instanceof conic_arc_object) &&
        !bends
        ? "Quad"
        : "Loc";
}

// The looks its image may have, as a map bends lines or not, or a locus.
export const imageLooks = (source: transformable): string[] => [
    imageLook(source),
    imageLook(source, true),
    imageLook(source, false),
    "Loc",
];

// The points of each side of a polygon whose images draw the arc it
// becomes, as by an inversion.
const SIDE_SAMPLES = 32;

// Points of the object whose images build its image of this look, none
// for a locus: its vertices or its ends, or points along its sides, points
// of a line, of a circle, of an arc or of a conic, away from the pole.
function pointsOf(
    source: transformable,
    look: string,
    pole?: () => Vec3,
): (point_object | (() => Vec3))[] {
    if (source instanceof plane_object)
        return [
            () => source.CENTER,
            () => vAdd(source.CENTER, source.U),
            () => vAdd(source.CENTER, vCross(source.NORMAL, source.U)),
        ];
    if (source instanceof sphere_object)
        return [source.P1, () => vAdd(source.CENTER, [source.R, 0, 0])];
    if (source instanceof polyhedron_object) return source.vertices;
    if (source instanceof polygon_object)
        return look === "Loc" || pole
            ? source.vertices.flatMap((vertex, index, vertices) => {
                  const next = vertices[(index + 1) % vertices.length];
                  return Array.from({ length: SIDE_SAMPLES }, (_, k) =>
                      k
                          ? () =>
                                vAdd(
                                    vertex.coords,
                                    vScale(
                                        vSub(next.coords, vertex.coords),
                                        k / SIDE_SAMPLES,
                                    ),
                                )
                          : vertex,
                  );
              })
            : source.vertices;
    if (look === "Loc") return [];
    if (source instanceof segment_object)
        return look === "Arc"
            ? [
                  source.P1,
                  () => vScale(vAdd(source.P1.coords, source.P2.coords), 0.5),
                  source.P2,
              ]
            : [source.P1, source.P2];
    if (source instanceof primitive_line_object) {
        // Its point, often a center, and the pole, kept away from, but for
        // a ray's origin.
        const at = (k: number) => () =>
            vAdd(source.P1.coords, vScale(source.VEC, k));
        if (!pole)
            return look === "Ray"
                ? [source.P1, at(1)]
                : look === "Line"
                  ? [at(1), at(-1)]
                  : [at(-1), at(1), at(2)];
        const base = () => foot(source, pole());
        const side = (k: number) => () => vAdd(base(), vScale(source.VEC, k));
        return look === "Line"
            ? [side(1), side(-1)]
            : [base, side(1), side(-1)];
    }
    if (source instanceof primitive_arc_object) {
        const start = () => source.pointAt(source.startAlpha);
        const end = () => source.pointAt(source.endAlpha);
        return look === "Seg"
            ? [start, end]
            : [start, () => middle(source), end];
    }
    if (source instanceof primitive_circle_object) {
        if (look === "Line") {
            const away = (quarter: boolean) => () => {
                const u =
                    (pole && vNormalize(vSub(source.CENTER, pole()))) ??
                    source.U;
                return vAdd(
                    source.CENTER,
                    vScale(quarter ? vCross(source.NORMAL, u) : u, source.R),
                );
            };
            return [away(false), away(true)];
        }
        return [0, 1, 2].map(
            (k) => () => source.pointAt((k * 2 * Math.PI) / 3),
        );
    }
    const conic = source as primitive_quadric_object;
    return [0, 1, 2, 3, 4].map((k) => () => {
        if (conic.KIND === "ellipse") {
            const t = (k * 2 * Math.PI) / 5;
            return vAdd(
                conic.CENTER,
                vAdd(
                    vScale(conic.AXIS_U, Math.cos(t)),
                    vScale(conic.AXIS_V, Math.sin(t)),
                ),
            );
        }
        if (conic.KIND === "hyperbola")
            return conic.BRANCHES[k < 3 ? 0 : 1]([-1, 0, 1, -1, 1][k]);
        const [vertex, focal] = conic.frame();
        return conic.BRANCHES[0]((k - 2) * (vNorm(vSub(focal, vertex)) || 1));
    });
}

// The image of an object by a transformation, `map` making the image of a
// point by it: an object of the look imageLook gives by a similarity, or
// of the look given, on the images of points of it, which it computes
// itself, outside the figure, before its own geometry; otherwise, the
// locus of the image of a point on it. Its entry, its parents and its
// look are those of the image of a point, the object in the point's place,
// unless a template is given (see DGO.md).
export function createTransformed(
    c: construction,
    name: string | null | undefined,
    source: transformable,
    map: (point: point_object) => point_object,
    {
        look = imageLook(source),
        pole,
        mark,
        template = map(source as never),
    }: ImageOptions = {},
): construction_object {
    const points: point_object[] = [];
    const images = pointsOf(source, look, pole).map((point) => {
        if (!(point instanceof point_object)) {
            point = new source_point(c, source, point);
            points.push(point);
        }
        const image = map(point);
        points.push(image);
        return image;
    });
    const [p, q, r] = images;
    const space = !c.GRID.is2D;
    let object: construction_object;
    if (source instanceof plane_object)
        object = new plane_object(c, name, { tag: "Pl", points: [p, q, r] });
    else if (source instanceof sphere_object)
        object = new sphere_object(c, name, p, q);
    else if (source instanceof polyhedron_object)
        object = new polyhedron_object(c, name, {
            tag: "Map",
            vertices: images,
            faces: source.faces,
        });
    else if (source instanceof polygon_object) {
        const polygon = new polygon_object(c, name, images);
        polygon.ownVertices = images;
        polygon.section = source.section;
        object = polygon;
        look = "Poly";
    } else if (look === "Loc") {
        const driver = new point_on_object(
            c,
            null,
            source,
            source instanceof primitive_quadric_object ? [0, 0] : 0,
        );
        const target = map(driver);
        points.push(driver, target);
        // Where it finds what joins them.
        const body: construction = Object.assign(Object.create(c), {
            OBJS: Object.assign(Object.create(c.OBJS), {
                V: [driver, target],
            }),
        });
        object = new locus_object(body, name, target, driver);
        object.C = c;
    } else if (look === "Vec") object = new vector_object(c, name, p, q);
    else if (look === "Seg") object = new segment_object(c, name, p, q);
    else if (look === "Ray") object = new ray_line_object(c, name, p, q);
    else if (look === "Line")
        object = new two_points_line_object(c, name, p, q);
    else if (look === "Arc")
        object = new arc3pts_object(
            c,
            name,
            p,
            q,
            r,
            source instanceof primitive_arc_object && source.sector,
            space,
        );
    else if (look === "Cir")
        object = new circle3pts_object(c, name, p, q, r, space);
    else
        object = new quadric5pts_object(c, name, p, q, r, images[3], images[4]);
    // The figure's objects don't know the private ones.
    [template, ...points].forEach((own) =>
        own.parents.forEach(
            (parent) =>
                (parent.children = parent.children.filter(
                    (child) => child !== own,
                )),
        ),
    );
    object.parents = [];
    object.addParents(...template.parents);
    object.readsView = template.readsView;
    object.look = look;
    const { computeGeometry, project } = object;
    Object.assign(object, {
        computeGeometry() {
            points.forEach((point) => point.computeGeometry());
            computeGeometry.call(object);
        },
        project() {
            points.forEach((point) => point.project());
            project.call(object);
        },
        dgo(context: never) {
            const [tag, parameters] = template.dgo(context);
            return [
                tag,
                mark === undefined
                    ? parameters
                    : [...(parameters as unknown[]), mark],
            ];
        },
    });
    return c.add(object);
}
