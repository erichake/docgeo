import type { construction } from "../construction";
import { vAdd } from "../vec";
import { point_object } from "./point_object";
import type { primitive_line_object } from "./primitive_line_object";

// P moved by a line's direction vector: whatever the line, a formula reads
// its direction as this point minus P.
export class direction_point_object extends point_object {
    moveable = false;
    LINE: primitive_line_object;
    P: point_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        line: primitive_line_object,
        p: point_object,
    ) {
        super(c, name, [0, 0, 0]);
        this.LINE = line;
        this.P = p;
        this.addParents(line, p);
    }

    computeGeometry(): void {
        if (!this.LINE.defined || !this.P.defined) {
            this.defined = false;
            return;
        }
        this.coords = vAdd(this.P.coords, this.LINE.VEC);
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createDirectionPoint(
    c: construction,
    name: string | null | undefined,
    line: primitive_line_object,
    p: point_object,
): direction_point_object {
    return c.add(new direction_point_object(c, name, line, p));
}
