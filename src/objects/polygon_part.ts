import type { construction_object, PartKind } from "./construction_object";
import { point_object } from "./point_object";
import { polygon_object } from "./polygon_object";
import type { polyhedron_object } from "./polyhedron_object";
import { segment_object } from "./segment_object";

class polygon_vertex extends point_object {
    constructor(
        readonly polygon: polygon_object,
        readonly rank: number,
    ) {
        super(polygon.C, null, [0, 0, 0]);
        this.reference = { owner: polygon, kind: "vertex", rank };
        this.moveable = false;
    }

    computeGeometry(): void {
        const point = this.polygon.points[this.rank - 1];
        this.defined = this.polygon.defined && !!point?.defined;
        if (this.defined) this.coords = point.coords;
    }
}

class polygon_side extends segment_object {
    constructor(
        readonly polygon: polygon_object,
        readonly rank: number,
    ) {
        super(
            polygon.C,
            null,
            polygonVertex(polygon, rank),
            polygonVertex(polygon, 1),
        );
        this.parents.forEach((parent) => {
            parent.children = parent.children.filter((child) => child !== this);
        });
        this.parents = [];
        this.reference = { owner: polygon, kind: "side", rank };
    }

    computeGeometry(): void {
        // The closing vertex follows the polygon when its number of sides changes.
        this.P2 = polygonVertex(
            this.polygon,
            this.rank === this.polygon.points.length ? 1 : this.rank + 1,
        );
        super.computeGeometry();
        this.defined &&= this.polygon.defined;
    }
}

class polyhedron_face extends polygon_object {
    constructor(
        readonly solid: polyhedron_object,
        readonly rank: number,
    ) {
        super(
            solid.C,
            null,
            (solid.faces[rank - 1] ?? []).map((i) => solid.vertices[i]),
        );
        this.parents.forEach((parent) => {
            parent.children = parent.children.filter((child) => child !== this);
        });
        this.parents = [];
        this.reference = { owner: solid, kind: "face", rank };
    }

    computeGeometry(): void {
        this.defined = this.solid.defined && this.points.length > 0;
        if (this.defined) super.computeGeometry();
    }

    // Its vertices are projected by its polyhedron.
    project(): void {}
}

function part<T extends construction_object>(
    owner: construction_object,
    kind: PartKind,
    rank: number,
    create: () => T,
): T {
    const parts = (owner.virtualParts ??= new Map());
    const key = kind + rank;
    const found = parts.get(key);
    if (found) return found as T;
    const made = create();
    parts.set(key, made);
    // Parts are updated in this order: a side reads its vertices, which a
    // side may create after itself.
    if (kind === "vertex")
        [...parts].forEach(([name, side]) => {
            if (!name.startsWith("side")) return;
            parts.delete(name);
            parts.set(name, side);
        });
    made.computeGeometry();
    made.project();
    return made;
}

export const polygonVertex = (
    polygon: polygon_object,
    rank: number,
): point_object =>
    part(polygon, "vertex", rank, () => new polygon_vertex(polygon, rank));

export const polygonSide = (
    polygon: polygon_object,
    rank: number,
): segment_object =>
    part(polygon, "side", rank, () => new polygon_side(polygon, rank));

export const polyhedronFace = (
    solid: polyhedron_object,
    rank: number,
): polygon_object =>
    part(solid, "face", rank, () => new polyhedron_face(solid, rank));

export const partOf = (
    kind: PartKind,
    owner: construction_object,
    rank: number,
): construction_object =>
    kind === "face"
        ? polyhedronFace(owner as polyhedron_object, rank)
        : (kind === "side" ? polygonSide : polygonVertex)(
              owner as polygon_object,
              rank,
          );
