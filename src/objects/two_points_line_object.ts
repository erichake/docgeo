import type { construction } from "../construction";
import type { PrefKey } from "../preferences";
import { vNormalize, vSub, type Vec2, type Vec3 } from "../vec";
import type { DgoContext } from "./construction_object";
import type { point_object } from "./point_object";
import type { polygon_object } from "./polygon_object";
import { primitive_line_object } from "./primitive_line_object";

export class two_points_line_object extends primitive_line_object {
    P2: point_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        p2: point_object,
        type?: PrefKey,
    ) {
        super(c, name, p1, type);
        this.P2 = p2;
        this.VEC = this.computeVEC() ?? [0, 0, 0];
        this.addParents(p2);
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["Line", [this.P1, this.P2].map(context.index)];
    }

    computeVEC(): Vec3 | null {
        if (!this.P2.defined) return null;
        return vNormalize(vSub(this.P2.coords, this.P1.coords));
    }

    // The way to its second point: a moved name keeps its place between
    // them, as a fraction of it.
    protected nameAxis(): Vec2 {
        return vSub(this.P2.screen, this.P1.screen);
    }

    protected referenceSpan(): [Vec3, Vec3] | null {
        return [this.P1.coords, this.P2.coords];
    }

    protected isOwnFace(polygon: polygon_object): boolean {
        return (
            polygon.points.includes(this.P1) && polygon.points.includes(this.P2)
        );
    }
}

export function createLine(
    c: construction,
    name: string | null | undefined,
    p1: point_object,
    p2: point_object,
): two_points_line_object {
    return c.add(new two_points_line_object(c, name, p1, p2));
}
