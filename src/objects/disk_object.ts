import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { Vec2 } from "../vec";
import type { construction_object, DgoContext } from "./construction_object";
import { primitive_circle_object } from "./primitive_circle_object";
import type { revolution_object } from "./revolution_object";

const SAMPLES = 72;

// A disk of a cylinder or a cone, at A or at B (top): its outline is dashed
// where the solid hides it.
export class disk_object extends primitive_circle_object {
    solid: revolution_object;
    top: boolean;
    private outline!: DOMElement;
    private hiddenOutline!: DOMElement;

    constructor(
        c: construction,
        name: string | null | undefined,
        solid: revolution_object,
        top: boolean,
    ) {
        super(c, name);
        this.solid = solid;
        this.top = top;
        this.addParents(solid);
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["Disk", [context.index(this.solid), +this.top]];
    }

    computeGeometry(): void {
        const { solid } = this;
        if (!solid.defined) {
            this.defined = false;
            return;
        }
        this.setCircle(
            (this.top ? solid.B : solid.A).coords,
            this.top ? solid.R1 : solid.R0,
            solid.U,
            solid.V,
        );
    }

    render(): void {
        super.render();
        if (!this.defined || !this.projectionDefined) return;
        // Runs of visible and hidden rim, each ending where the next begins.
        const paths = ["", ""];
        let previous: number | null = null;
        for (let k = 0; k <= SAMPLES; k++) {
            const point = this.solid.rim(this.top, (2 * Math.PI * k) / SAMPLES);
            const hidden = +this.solid.hides(point);
            const [x, y]: Vec2 = this.C.pt3D(point);
            if (previous === null) paths[hidden] += `M${x} ${y}`;
            else if (previous === hidden) paths[hidden] += ` L${x} ${y}`;
            else {
                paths[previous] += ` L${x} ${y}`;
                paths[hidden] += ` M${x} ${y}`;
            }
            previous = hidden;
        }
        this.outline.att("d", paths[0]);
        this.hiddenOutline.att("d", paths[1]);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as disk_object;
        const dom = primitive_circle_object.createSVG(t);
        t.path.stl("stroke", "none");
        const stroke = (dash: string) =>
            t.svg
                .shape("path")
                .stl("fill", "none")
                .stl("stroke", t.stroke_color)
                .stl("stroke-width", t.size)
                .stl("stroke-dasharray", dash)
                .stl("pointer-events", "none");
        t.outline = stroke(t.strokeDashArray);
        t.hiddenOutline = stroke(`${t.size * 3} ${t.size * 2}`);
        return dom.add(t.outline, t.hiddenOutline);
    }
}

export function createDisk(
    c: construction,
    name: string | null | undefined,
    solid: revolution_object,
    top: boolean,
): disk_object {
    return c.add(new disk_object(c, name, solid, top));
}
