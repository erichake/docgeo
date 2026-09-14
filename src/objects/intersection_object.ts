import type { construction } from "../construction";
import { numEqual, rnd0, vAdd, vScale } from "../vec";
import { point_object } from "./point_object";
import type { primitive_line_object } from "./primitive_line_object";

// @ts-expect-error - static `create` intentionally has a different signature than
// point_object's (each construction_object subtype has its own factory args).
export class intersection_object extends point_object {
    O1: primitive_line_object;
    O2: primitive_line_object;

    constructor(c: construction, name: string | null | undefined, o1: primitive_line_object, o2: primitive_line_object) {
        super(c, name, [0, 0, 0], "intersection");
        this.O1 = o1;
        this.O2 = o2;
        this.addParents(o1, o2);
        // Dynamic dispatch by family-type combination (e.g. "line_line"), built from a
        // string key at runtime : not statically resolvable by TS, hence this single `any` cast.
        this.compute = (this as unknown as Record<string, () => void>)[`${o1.familytype}_${o2.familytype}`];
    }

    // Compute line/line intersection :
    line_line(): void {
        const p = this.O1.P1.coords,
            u = this.O1.VEC,
            m = this.O2.P1.coords,
            v = this.O2.VEC;
        const ks: number[] = [];
        let k = NaN;
        for (let i = 0; i < 3; i++) {
            const j = (i + 1) % 3;
            const d = v[i] * u[j] - v[j] * u[i];
            k = (v[i] * (m[j] - p[j]) - v[j] * (m[i] - p[i])) / rnd0(d);
            if (isFinite(k)) ks.push(k);
        }
        k = ks.length > 0 ? ks.reduce((a, b) => (numEqual(a, b) ? a : NaN)) : NaN;
        this.coords = vAdd(p, vScale(u, k));
        super.compute();
    }

    mousedrag(_ev: PointerEvent): void {}

    static create(
        c: construction,
        name: string | null | undefined,
        o1: primitive_line_object,
        o2: primitive_line_object
    ): intersection_object {
        return c.add(new intersection_object(c, name, o1, o2)) as intersection_object;
    }
}
