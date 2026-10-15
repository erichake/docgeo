import type { construction } from "../construction";
import { geometryTolerance, vDot, vSub } from "../vec";
import type { DgoContext } from "./construction_object";
import type { point_object } from "./point_object";
import { primitive_arc_object } from "./primitive_arc_object";

// The arc of center M from A to the ray [MB), counterclockwise (clockwise
// as the image of one by a reflection), or its sector.
export class center_arc_object extends primitive_arc_object {
    M: point_object;
    A: point_object;
    B: point_object;
    clockwise: boolean;

    constructor(
        c: construction,
        name: string | null | undefined,
        m: point_object,
        a: point_object,
        b: point_object,
        sector: boolean,
        clockwise: boolean,
    ) {
        super(c, name, sector);
        this.M = m;
        this.A = a;
        this.B = b;
        this.clockwise = clockwise;
        this.addParents(m, a, b);
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            this.sector ? "CSec" : "CArc",
            [
                ...[this.M, this.A, this.B].map(context.index),
                ...(this.clockwise ? [1] : []),
            ],
        ];
    }

    computeGeometry(): void {
        const [u, v] = this.plane;
        const [ma, mb] = [this.A, this.B].map((point) => {
            const d = vSub(point.coords, this.M.coords);
            return Math.hypot(vDot(d, u), vDot(d, v));
        });
        if (
            ![this.M, this.A, this.B].every((point) => point.defined) ||
            !(ma > geometryTolerance(...this.M.coords)) ||
            !(mb > geometryTolerance(...this.M.coords))
        ) {
            this.defined = false;
            return;
        }
        this.setCircle(this.M.coords, ma, u, v);
        this.setArc(this.A.coords, this.B.coords, !this.clockwise);
    }
}

export function createCenterArc(
    c: construction,
    name: string | null | undefined,
    m: point_object,
    a: point_object,
    b: point_object,
    sector = false,
    clockwise = false,
): center_arc_object {
    return c.add(new center_arc_object(c, name, m, a, b, sector, clockwise));
}
