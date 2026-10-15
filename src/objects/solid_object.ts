import type { construction } from "../construction";
import { viewDirection } from "../projection";
import {
    geometryTolerance,
    vDot,
    vNormalize,
    type Vec2,
    type Vec3,
} from "../vec";
import { construction_object } from "./construction_object";

// A convex solid that hides what lies behind it, as its faces would (see
// hidden_line.ts): its outline on the screen and where the view ray
// through a point of it enters it.
export abstract class solid_object extends construction_object {
    projectionDefined = true;
    outline: Vec2[] = [];

    constructor(c: construction, name: string | null | undefined) {
        super(c, name, "polygon");
        this.familytype = "solid";
    }

    // The depth along the view direction (larger is farther) where the
    // view ray through `screen` enters it, null if it misses it.
    abstract entryDepth(screen: Vec2): number | null;

    // Whether it hides `point`, behind its surface seen from the camera.
    hides(point: Vec3): boolean {
        const entry = this.entryDepth(this.C.pt3D(point));
        const depth = vDot(
            point,
            vNormalize(viewDirection(this.C.projectionFrame))!,
        );
        return (
            entry !== null && depth - entry > geometryTolerance(depth, entry)
        );
    }
}
