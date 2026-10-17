import type { construction } from "../construction";
import type { DOMElement, PointerDelta } from "../dom";
import { vAdd, type Vec2, type Vec3 } from "../vec";
import type { construction_object, DgoContext } from "./construction_object";
import { point_object } from "./point_object";
import { vector_object } from "./vector_object";

// GeoGebra's free vector, `u = (1, 2)`: its coordinates, drawn from the
// origin. Its two ends are its own, outside the construction; dragged, its
// tip follows the pointer.
export class free_vector_object extends vector_object {
    constructor(
        c: construction,
        name: string | null | undefined,
        coords: Vec3,
    ) {
        super(
            c,
            name,
            new point_object(c, null, [0, 0, 0]),
            new point_object(c, null, coords),
        );
    }

    dgo(_context: DgoContext): [string, unknown] {
        const [x, y, z] = this.P2.coords;
        return ["VecF", z ? [x, y, z] : [x, y]];
    }

    project(): void {
        this.P1.project();
        this.P2.project();
        super.project();
    }

    // Moves from where the last move left it, the figure being redrawn
    // only at the next frame.
    mousedrag(_event: PointerEvent, delta: PointerDelta): void {
        const screen: Vec2 = vAdd(this.P2.screen, delta as Vec2);
        const tip = this.C.unprojectToZPlane(screen, this.P2.z);
        if (!tip) return;
        this.P2.screen = screen;
        this.P2.coords = this.P2.snapToIncrement(tip);
        this.C.invalidateGeometry(this);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as free_vector_object;
        return vector_object
            .createSVG(t)
            .drag((event, delta) => t.mousedrag(event, delta));
    }
}

export function createFreeVector(
    c: construction,
    name: string | null | undefined,
    coords: Vec3,
): free_vector_object {
    return c.add(new free_vector_object(c, name, coords));
}
