import type { construction } from "../construction";
import { vAdd, vDot, vScale, vSub } from "../vec";
import type { DgoContext } from "./construction_object";
import { point_object } from "./point_object";
import { primitive_line_object } from "./primitive_line_object";

export class reflection_object extends point_object {
    moveable = false;
    line: primitive_line_object;
    point: point_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        line: primitive_line_object,
        point: point_object,
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.line = line;
        this.point = point;
        this.addParents(line, point);
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["Refl", [this.line, this.point].map(context.index)];
    }

    computeGeometry(): void {
        if (!this.line.defined || !this.point.defined) {
            this.defined = false;
            return;
        }
        const projection = vAdd(
            this.line.P1.coords,
            vScale(
                this.line.VEC,
                vDot(
                    vSub(this.point.coords, this.line.P1.coords),
                    this.line.VEC,
                ),
            ),
        );
        this.coords = vSub(vScale(projection, 2), this.point.coords);
        super.computeGeometry();
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createReflection(
    c: construction,
    name: string | null | undefined,
    line: primitive_line_object,
    point: point_object,
): reflection_object {
    return c.add(new reflection_object(c, name, line, point));
}
