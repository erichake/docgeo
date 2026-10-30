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
import { polygon_object } from "./polygon_object";
import { normalizeAngle, primitive_arc_object } from "./primitive_arc_object";
import { primitive_circle_object } from "./primitive_circle_object";
import { primitive_line_object } from "./primitive_line_object";
import { primitive_quadric_object } from "./primitive_quadric_object";
import { quadric5pts_object } from "./quadric5pts_object";
import { ray_line_object } from "./ray_line_object";
import { segment_object } from "./segment_object";
import { two_points_line_object } from "./two_points_line_object";
import { vector_object } from "./vector_object";

export type transformable =
    | primitive_line_object
    | primitive_circle_object
    | polygon_object
    | primitive_quadric_object
    | curve_object
    | locus_object;

// The circle of an inversion, and whether the image of a line or a circle
// through its center, a line, is wanted (see DGO.md).
export interface Inversion {
    circle: primitive_circle_object;
    straight: boolean;
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
// similarity, a conic's by an affine map; by an inversion, a line or a
// circle, a segment or an arc, a polygon whose sides are arcs. Otherwise,
// a locus.
export function imageLook(
    source: transformable,
    inversion?: Inversion,
): string {
    const straight = inversion?.straight;
    if (source instanceof vector_object) return inversion ? "Loc" : "Vec";
    if (source instanceof segment_object)
        return !inversion || straight ? "Seg" : "Arc";
    if (source instanceof primitive_line_object)
        return isRay(source)
            ? inversion
                ? "Loc"
                : "Ray"
            : !inversion || straight
              ? "Line"
              : "Cir";
    if (source instanceof primitive_arc_object) return straight ? "Seg" : "Arc";
    if (source instanceof primitive_circle_object)
        return straight ? "Line" : "Cir";
    if (source instanceof polygon_object) return "Poly";
    return source instanceof primitive_quadric_object &&
        !(source instanceof conic_arc_object) &&
        !inversion
        ? "Quad"
        : "Loc";
}

// The points of each side of a polygon whose images, by an inversion, draw
// the arc it becomes.
const SIDE_SAMPLES = 32;

// Points of the object whose images build its image of this look, none
// for a locus: its
// vertices or its ends, points of a line from its point nearest the center
// of an inversion, of a circle away from it, of an arc or of a conic.
function pointsOf(
    source: transformable,
    look: string,
    inversion?: Inversion,
): (point_object | (() => Vec3))[] {
    if (look === "Loc") return [];
    if (source instanceof polygon_object)
        return inversion
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
    if (source instanceof segment_object)
        return look === "Arc"
            ? [
                  source.P1,
                  () => vScale(vAdd(source.P1.coords, source.P2.coords), 0.5),
                  source.P2,
              ]
            : [source.P1, source.P2];
    if (source instanceof primitive_line_object) {
        if (!inversion)
            return [source.P1, () => vAdd(source.P1.coords, source.VEC)];
        const base = () => foot(source, inversion.circle.CENTER);
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
                    vNormalize(vSub(source.CENTER, inversion!.circle.CENTER)) ??
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
// point by it: an object of the look imageLook gives, on the images of
// points of it, which it computes itself, outside the figure, before its
// own geometry; otherwise, the locus of the image of a point on it. Its
// entry, its parents and its look are those of the image of a point, the
// object in the point's place, a straight image of an inversion marked
// (see DGO.md).
export function createTransformed(
    c: construction,
    name: string | null | undefined,
    source: transformable,
    map: (point: point_object) => point_object,
    inversion?: Inversion,
): construction_object {
    const look = imageLook(source, inversion);
    const points: point_object[] = [];
    const images = pointsOf(source, look, inversion).map((point) => {
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
    if (look === "Loc") {
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
    } else if (look === "Poly") {
        const polygon = new polygon_object(c, name, images);
        polygon.ownVertices = images;
        polygon.section = (source as polygon_object).section;
        object = polygon;
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
    const template = map(source as never);
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
                inversion?.straight
                    ? [...(parameters as unknown[]), 1]
                    : parameters,
            ];
        },
    });
    return c.add(object);
}
