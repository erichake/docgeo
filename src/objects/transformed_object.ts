import type { construction } from "../construction";
import { vAdd, type Vec3 } from "../vec";
import { arc3pts_object } from "./arc3pts_object";
import { circle3pts_object } from "./circle3pts_object";
import type { construction_object } from "./construction_object";
import { isRay } from "./macro_object";
import { point_object } from "./point_object";
import { polygon_object } from "./polygon_object";
import { normalizeAngle, primitive_arc_object } from "./primitive_arc_object";
import type { primitive_circle_object } from "./primitive_circle_object";
import { primitive_line_object } from "./primitive_line_object";
import { ray_line_object } from "./ray_line_object";
import { segment_object } from "./segment_object";
import { two_points_line_object } from "./two_points_line_object";
import { vector_object } from "./vector_object";

export type transformable =
    primitive_line_object | primitive_circle_object | polygon_object;

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

// The .dgo type whose look the object's image has.
export const imageLook = (source: transformable): string =>
    source instanceof polygon_object
        ? "Poly"
        : source instanceof vector_object
          ? "Vec"
          : source instanceof segment_object
            ? "Seg"
            : source instanceof primitive_line_object
              ? isRay(source)
                  ? "Ray"
                  : "Line"
              : source instanceof primitive_arc_object
                ? "Arc"
                : "Cir";

// The image of an object by a transformation, `map` making the image of a
// point by it: the same kind of object on the images of points of it,
// which it computes itself, outside the figure, before its own geometry.
// Its entry, its parents and its look are those of the image of a point,
// the object in the point's place (see DGO.md).
export function createTransformed(
    c: construction,
    name: string | null | undefined,
    source: transformable,
    map: (point: point_object) => point_object,
): construction_object {
    const points: point_object[] = [];
    const image = (point: point_object): point_object => {
        const result = map(point);
        points.push(result);
        return result;
    };
    const imageAt = (at: () => Vec3): point_object => {
        const point = new source_point(c, source, at);
        points.push(point);
        return image(point);
    };
    const space = !c.GRID.is2D;
    let object: construction_object;
    if (source instanceof polygon_object) {
        const polygon = new polygon_object(c, name, source.vertices.map(image));
        polygon.ownVertices = polygon.vertices;
        polygon.section = source.section;
        object = polygon;
    } else if (source instanceof segment_object) {
        const ends = [source.P1, source.P2].map(image) as [
            point_object,
            point_object,
        ];
        const vector = source instanceof vector_object;
        object = new (vector ? vector_object : segment_object)(
            c,
            name,
            ...ends,
        );
    } else if (source instanceof primitive_line_object) {
        const ray = isRay(source);
        object = new (ray ? ray_line_object : two_points_line_object)(
            c,
            name,
            image(source.P1),
            imageAt(() => vAdd(source.P1.coords, source.VEC)),
        );
    } else if (source instanceof primitive_arc_object) {
        object = new arc3pts_object(
            c,
            name,
            imageAt(() => source.pointAt(source.startAlpha)),
            imageAt(() => middle(source)),
            imageAt(() => source.pointAt(source.endAlpha)),
            source.sector,
            space,
        );
    } else {
        const [p, q, r] = [0, 1, 2].map((k) =>
            imageAt(() => source.pointAt((k * 2 * Math.PI) / 3)),
        );
        object = new circle3pts_object(c, name, p, q, r, space);
    }
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
    object.look = imageLook(source);
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
        dgo: template.dgo.bind(template),
    });
    return c.add(object);
}
