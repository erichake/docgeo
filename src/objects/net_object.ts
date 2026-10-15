import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import { usesView } from "../import/dgp_formula";
import { viewDirection } from "../projection";
import {
    vAdd,
    vCross,
    vDot,
    vIsFinite,
    vNormalize,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import { dgoRadius, radiusValue, type circle1_radius } from "./circle1_object";
import { construction_object, type DgoContext } from "./construction_object";
import { lighting, pathData, shade } from "./polygon_object";
import type { polyhedron_object } from "./polyhedron_object";

// GeoGebra's net of a polyhedron, unfolded by f (0: folded, 1: flat), drawn
// whole: each face hangs from the first face reached breadth first from
// the base, its first face, faces in their order, and turns around their
// common edge by f times its angle with it, its descendants along.
export class net_object extends construction_object {
    SOLID: polyhedron_object;
    unfolding: circle1_radius;
    // Each face's parent, -1 for the base, and their common edge.
    private tree: number[];
    private links: [number, number][] = [];
    // Each face's vertices, unfolded, and on the screen.
    faces: Vec3[][] = [];
    private screens: Vec2[][] = [];
    projectionDefined = true;
    private paths: DOMElement[] = [];

    constructor(
        c: construction,
        name: string | null | undefined,
        solid: polyhedron_object,
        unfolding: circle1_radius,
    ) {
        super(c, name, "polygon");
        this.SOLID = solid;
        this.unfolding = unfolding;
        this.readsView =
            typeof unfolding !== "number" && usesView(unfolding.formula);
        this.addParents(
            solid,
            ...(typeof unfolding === "number" ? [] : unfolding.refs.values()),
        );
        const { faces } = solid;
        const key = (i: number, j: number) =>
            i < j ? `${i},${j}` : `${j},${i}`;
        const sides = new Map<string, number[]>();
        faces.forEach((face, k) =>
            face.forEach((i, position) => {
                const edge = key(i, face[(position + 1) % face.length]);
                sides.set(edge, [...(sides.get(edge) ?? []), k]);
            }),
        );
        this.tree = faces.map((_, k) => (k ? -2 : -1));
        for (let level = [0]; level.length;) {
            const next: number[] = [];
            for (const k of level.sort((a, b) => a - b))
                faces[k].forEach((i, position) => {
                    const j = faces[k][(position + 1) % faces[k].length];
                    for (const child of sides.get(key(i, j))!)
                        if (this.tree[child] === -2) {
                            this.tree[child] = k;
                            this.links[child] = [i, j];
                            next.push(child);
                        }
                });
            level = next;
        }
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "Net",
            [context.index(this.SOLID), dgoRadius(this.unfolding, context)],
        ];
    }

    computeGeometry(): void {
        const f = radiusValue(this.unfolding, this.C);
        this.defined = this.SOLID.defined && f !== null;
        if (!this.defined) return;
        const { faces, vertices } = this.SOLID;
        const coords = vertices.map((vertex) => vertex.coords);
        // Around the axis through o along unit k, by t.
        const turns = faces.map((face, k) => {
            const parent = this.tree[k];
            if (parent < 0) return null;
            const [i, j] = this.links[k];
            const o = coords[i];
            const axis = vNormalize(vSub(coords[j], o)) ?? [0, 0, 1];
            const off = (vertex: number) =>
                vertex !== i && vertex !== j ? [coords[vertex]] : [];
            // From the face's direction off the edge to the direction away
            // from its parent, in the parent's plane.
            const toQ = vSub(faces[parent].flatMap(off)[0], o);
            const away = vSub(vScale(axis, vDot(axis, toQ)), toQ);
            const toC = vSub(face.flatMap(off)[0], o);
            const t =
                f! * Math.atan2(vDot(axis, vCross(toC, away)), vDot(toC, away));
            return { o, axis, cos: Math.cos(t), sin: Math.sin(t) };
        });
        this.faces = faces.map((face, k) =>
            face.map((i) => {
                let p = coords[i];
                for (let at = k; turns[at]; at = this.tree[at]) {
                    const { o, axis, cos, sin } = turns[at]!;
                    const v = vSub(p, o);
                    p = vAdd(
                        vAdd(o, vScale(v, cos)),
                        vAdd(
                            vScale(vCross(axis, v), sin),
                            vScale(axis, vDot(axis, v) * (1 - cos)),
                        ),
                    );
                }
                return p;
            }),
        );
    }

    project(): void {
        this.screens = this.faces.map((face) =>
            face.map((p) => this.C.pt3D(p)),
        );
        this.projectionDefined =
            this.defined && this.screens.flat().every(vIsFinite);
    }

    // Each face filled and lit, the far ones first.
    render(): void {
        this.dom.stl(
            "display",
            this.isVisible && this.projectionDefined ? "block" : "none",
        );
        if (!this.defined || !this.projectionDefined) return;
        const dir = viewDirection(this.C.projectionFrame);
        const depth = (face: Vec3[]) =>
            vDot(face.reduce(vAdd), dir) / face.length;
        this.faces
            .map((face, k) => ({ k, depth: depth(face) }))
            .sort((a, b) => b.depth - a.depth)
            .forEach(({ k }, position) => {
                const [p, q, r] = this.faces[k];
                const normal = vNormalize(vCross(vSub(q, p), vSub(r, p))) ?? [
                    0, 0, 1,
                ];
                this.paths[position]
                    .att("d", pathData(this.screens[k]))
                    .stl(
                        "fill",
                        shade(this.fill_color, lighting(this.C, normal)),
                    );
            });
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as net_object;
        t.paths = t.SOLID.faces.map(() =>
            t.svg
                .shape("path")
                .stl("fill-opacity", t.opacity ?? 0)
                .stl("stroke", t.stroke_color)
                .stl("stroke-width", t.size)
                .stl("stroke-dasharray", t.strokeDashArray)
                .stl("stroke-linejoin", "round")
                .stl("pointer-events", "none"),
        );
        return t.svg.shape("g").add(...t.paths);
    }
}

export function createNet(
    c: construction,
    name: string | null | undefined,
    solid: polyhedron_object,
    unfolding: circle1_radius,
): net_object {
    return c.add(new net_object(c, name, solid, unfolding));
}
