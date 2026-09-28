import type { construction } from "../construction";
import {
    evaluateFormula,
    realPart,
    type FormulaNode,
} from "../import/dgp_formula";
import { vSub, type Vec2 } from "../vec";
import type { construction_object, DgoContext } from "./construction_object";
import { list_object } from "./list_object";
import type { point_object } from "./point_object";

// A direct similarity in a segment's own frame, where its start is 0 and its
// end 1: it maps the segment PQ to the segment from P + (Q - P)·a to
// P + (Q - P)·b, a and b being complex numbers.
export type SegmentMap = readonly [Vec2, Vec2];

const MAX_SEGMENTS = 5000;

// GeoGebra's Iteration of a list of segments: at each level, every segment
// is replaced by its images under the maps. A level that would exceed
// MAX_SEGMENTS isn't built.
export class iteration_object extends list_object {
    ends: [point_object, point_object][];
    maps: SegmentMap[];

    constructor(
        c: construction,
        name: string | null | undefined,
        ends: [point_object, point_object][],
        levels: FormulaNode,
        refs: Map<string, construction_object>,
        maps: SegmentMap[],
    ) {
        super(c, name, "segment", levels, [], refs);
        this.ends = ends;
        this.maps = maps;
        this.addParents(...ends.flat());
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "Itr",
            [
                this.ends.flat().map(context.index),
                this.dgoFormula(this.countFormula, context),
                this.maps.map((map) => map.flat()),
            ],
        ];
    }

    computeGeometry(): void {
        const levels = realPart(
            evaluateFormula(this.countFormula, this.baseEnv()),
        );
        let segments: Vec2[][] =
            levels !== null &&
            this.ends.every(([p, q]) => p.defined && q.defined)
                ? this.ends.map((ends) =>
                      ends.map(({ coords }): Vec2 => [coords[0], coords[1]]),
                  )
                : [];
        for (
            let level = 0;
            level < Math.round(levels ?? 0) &&
            segments.length * this.maps.length <= MAX_SEGMENTS;
            level++
        )
            segments = segments.flatMap(([p, q]) => {
                const [dx, dy] = vSub(q, p);
                return this.maps.map((map) =>
                    map.map(([x, y]): Vec2 => [
                        p[0] + dx * x - dy * y,
                        p[1] + dx * y + dy * x,
                    ]),
                );
            });
        this.items = segments;
        this.count = segments.length;
        this.defined = this.count > 0;
    }
}

export function createIteration(
    c: construction,
    name: string | null | undefined,
    ends: [point_object, point_object][],
    levels: FormulaNode,
    refs: Map<string, construction_object>,
    maps: SegmentMap[],
): iteration_object {
    return c.add(new iteration_object(c, name, ends, levels, refs, maps));
}
