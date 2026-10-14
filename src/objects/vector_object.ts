import type { construction } from "../construction";
import type { ScriptValue } from "../import/dgp_formula";
import { vAdd, vNorm, vScale, vSub, type Vec2 } from "../vec";
import type { DgoContext } from "./construction_object";
import type { point_object } from "./point_object";
import { segment_object } from "./segment_object";

// DGPad's arrowhead: 20px long, its sides at ±π/10 from the shaft.
const HEAD_LENGTH = 20;
const HEAD_ANGLE = Math.PI / 10;

export class vector_object extends segment_object {
    dgo(context: DgoContext): [string, unknown] {
        return ["Vec", super.dgo(context)[1]];
    }

    scriptValue(vec3: boolean): ScriptValue | null {
        if (!this.defined) return null;
        const [x, y, z] = vSub(this.P2.coords, this.P1.coords);
        return vec3 ? [x, y, z] : [x, y];
    }

    project(): void {
        super.project();
        if (!this.projectionDefined) return;
        const shaft = vSub(this.sP2, this.sP1);
        const length = vNorm(shaft);
        const kept = Math.max(0, 1 - HEAD_LENGTH / length);
        this.sP2 = vAdd(this.sP1, vScale(shaft, kept));
        this.updateHiddenSplit(
            this.P1.coords,
            vAdd(
                this.P1.coords,
                vScale(vSub(this.P2.coords, this.P1.coords), kept),
            ),
        );
    }

    // GeoGebra's DrawVector: at its middle, shifted by a quarter of its
    // coordinates as if they were pixels, which is next to nothing.
    nameAt(): Vec2 {
        return vScale(vAdd(this.P1.screen, this.P2.screen), 1 / 2);
    }

    render(): void {
        super.render();
        if (!this.defined || !this.projectionDefined) return;
        const apex = this.P2.screen;
        const angle = Math.atan2(apex[1] - this.sP1[1], apex[0] - this.sP1[0]);
        const side = (offset: number): Vec2 => [
            apex[0] - HEAD_LENGTH * Math.cos(angle + offset),
            apex[1] - HEAD_LENGTH * Math.sin(angle + offset),
        ];
        const [left, right] = [side(-HEAD_ANGLE), side(HEAD_ANGLE)];
        this.tipPath2.att(
            "d",
            `M${apex[0]} ${apex[1]} L${left[0]} ${left[1]} L${right[0]} ${right[1]} Z`,
        );
    }
}

export function createVector(
    c: construction,
    name: string | null | undefined,
    p1: point_object,
    p2: point_object,
): vector_object {
    return c.add(new vector_object(c, name, p1, p2));
}
