import type { construction } from "../construction";
import { usesView } from "../import/dgp_formula";
import {
    vAdd,
    vCross,
    vDot,
    vNormalize,
    vScale,
    vSub,
    type Vec3,
} from "../vec";
import { dgoRadius, radiusValue, type circle1_radius } from "./circle1_object";
import type { DgoContext } from "./construction_object";
import { point_object } from "./point_object";

// A turn of a net's face around its edge OE towards its parent face: C a
// point of the face, Q one of the parent's.
export type net_turn = [point_object, point_object, point_object, point_object];

// A vertex of GeoGebra's net of a polyhedron, unfolded by f (0: folded, 1:
// flat): turned by its own face, then by each of its ancestors, by f times
// the face's angle with its parent.
export class net_vertex_object extends point_object {
    moveable = false;
    vertex: point_object;
    unfolding: circle1_radius;
    turns: net_turn[];

    constructor(
        c: construction,
        name: string | null | undefined,
        vertex: point_object,
        unfolding: circle1_radius,
        turns: net_turn[],
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.vertex = vertex;
        this.unfolding = unfolding;
        this.turns = turns;
        this.readsView =
            typeof unfolding !== "number" && usesView(unfolding.formula);
        this.addParents(
            vertex,
            ...(typeof unfolding === "number" ? [] : unfolding.refs.values()),
            ...turns.flat(),
        );
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "NetV",
            [
                context.index(this.vertex),
                dgoRadius(this.unfolding, context),
                ...this.turns.flat().map(context.index),
            ],
        ];
    }

    computeGeometry(): void {
        const f = radiusValue(this.unfolding, this.C);
        if (
            f === null ||
            ![this.vertex, ...this.turns.flat()].every((point) => point.defined)
        ) {
            this.defined = false;
            return;
        }
        let p = this.vertex.coords;
        for (const [O, E, C, Q] of this.turns) {
            const o = O.coords;
            const k = vNormalize(vSub(E.coords, o));
            if (!k) {
                this.defined = false;
                return;
            }
            // The angle from C's direction off the edge to the direction
            // away from the parent face, in the parent's plane.
            const toQ = vSub(Q.coords, o);
            const away = vSub(vScale(k, vDot(k, toQ)), toQ);
            const toC = vSub(C.coords, o);
            const t =
                f * Math.atan2(vDot(k, vCross(toC, away)), vDot(toC, away));
            const v = vSub(p, o);
            p = vAdd(
                vAdd(o, vScale(v, Math.cos(t))),
                vAdd(
                    vScale(vCross(k, v), Math.sin(t)),
                    vScale(k, vDot(k, v) * (1 - Math.cos(t))),
                ),
            );
        }
        this.coords = p as Vec3;
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createNetVertex(
    c: construction,
    name: string | null | undefined,
    vertex: point_object,
    unfolding: circle1_radius,
    turns: net_turn[],
): net_vertex_object {
    return c.add(new net_vertex_object(c, name, vertex, unfolding, turns));
}
