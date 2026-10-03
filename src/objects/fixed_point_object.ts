import type { construction } from "../construction";
import type { ScriptValue } from "../import/dgp_formula";
import type { Vec3 } from "../vec";
import type { DgoContext } from "./construction_object";
import { point_object } from "./point_object";

export class fixed_point_object extends point_object {
    moveable = false;

    // In a DGPad 3D figure, its origin is a 2D point, though a formula reads
    // its 3D coordinates; the other fixed points are 3D ones.
    get flat(): boolean {
        return this.coords.every((coord) => coord === 0);
    }

    scriptValue(vec3: boolean): ScriptValue | null {
        return vec3 ? [...this.coords] : [this.x, this.y];
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["Fix", super.dgo(context)[1]];
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createFixedPoint(
    c: construction,
    name: string | null | undefined,
    pt: Vec3,
): fixed_point_object {
    return c.add(new fixed_point_object(c, name, pt));
}
