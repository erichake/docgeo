import type { construction } from "../construction";
import type { DgoContext } from "./construction_object";
import type { point_object } from "./point_object";
import { normalizeAngle, primitive_arc_object } from "./primitive_arc_object";

// The arc from P1 to P3 through P2.
export class arc3pts_object extends primitive_arc_object {
    P1: point_object;
    P2: point_object;
    P3: point_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        p1: point_object,
        p2: point_object,
        p3: point_object,
        sector: boolean,
    ) {
        super(c, name, sector);
        this.P1 = p1;
        this.P2 = p2;
        this.P3 = p3;
        this.addParents(p1, p2, p3);
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            this.sector ? "Sec" : "Arc",
            [this.P1, this.P2, this.P3].map(context.index),
        ];
    }

    computeGeometry(): void {
        if (!this.P1.defined || !this.P2.defined || !this.P3.defined) {
            this.defined = false;
            return;
        }
        this.setCircleThrough(this.P1.coords, this.P2.coords, this.P3.coords);
        if (!this.defined) return;
        const [a, b, c] = [this.P1, this.P2, this.P3].map((point) =>
            normalizeAngle(this.alphaOf(point.coords)),
        );
        this.setArc(
            this.P1.coords,
            this.P3.coords,
            normalizeAngle(b - a) < normalizeAngle(c - a),
        );
    }
}

export function createArc3pts(
    c: construction,
    name: string | null | undefined,
    p1: point_object,
    p2: point_object,
    p3: point_object,
    sector = false,
): arc3pts_object {
    return c.add(new arc3pts_object(c, name, p1, p2, p3, sector));
}
