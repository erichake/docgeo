import type { construction } from "../construction";
import { $ } from "../dom";
import { programTurtle } from "../import/dgp_formula";
import type { construction_object } from "../objects/construction_object";
import { expression_object } from "../objects/expression_object";
import { vAdd, vSub, type Vec3 } from "../vec";

// DGPad's turtle, while its program shows in the properties panel: where
// it ends, heading where it heads, its shell seen from above in the plane;
// in space an arrowhead, green when its top faces the viewer, grey when its
// belly does.

// Heading right, as DGPad's image, 36 pixels wide.
const SHELL = `<g stroke="#14532d" stroke-width="1.2" stroke-linejoin="round" fill="#4ade80">
<ellipse cx="-6.5" cy="-9.5" rx="3" ry="4.2" transform="rotate(-35 -6.5 -9.5)"/>
<ellipse cx="6.5" cy="-9.5" rx="3" ry="4.2" transform="rotate(35 6.5 -9.5)"/>
<ellipse cx="-6.5" cy="9.5" rx="3" ry="4.2" transform="rotate(35 -6.5 9.5)"/>
<ellipse cx="6.5" cy="9.5" rx="3" ry="4.2" transform="rotate(-35 6.5 9.5)"/>
<path d="M-10.5-1.8-16 0-10.5 1.8Z"/>
<ellipse cx="13.5" rx="5" ry="4"/>
<path d="M15.3-1.6h.01M15.3 1.6h.01" stroke-width="1.8" stroke-linecap="round"/>
<ellipse rx="11.5" ry="9.5" fill="#16a34a"/>
<path d="M-4.5-4.2h9l2.6 4.2-2.6 4.2h-9l-2.6-4.2ZM-4.5-4.2-7-8.3M4.5-4.2 7-8.3M-4.5 4.2-7 8.3M4.5 4.2 7 8.3M-7.1 0h-4.4M7.1 0h4.4" fill="#22c55e" stroke-width=".9"/>
</g>`;

export function turtleLayer(
    scene: () => construction,
    shown: () => construction_object | null,
) {
    const element = $.create("div")
        .cls("dge-turtle")
        .append(
            `<svg width="1" height="1"><g class="dge-turtle-plane">${SHELL}</g><path class="dge-turtle-space" stroke="#222" stroke-linejoin="round"/></svg>`,
        )
        .hide();
    const plane = element.find(".dge-turtle-plane")!;
    const space = element.find(".dge-turtle-space")!;
    let frame: number | null = null;

    function draw(): void {
        const object = shown();
        const turtle =
            object instanceof expression_object &&
            object.program &&
            programTurtle(object.program.program);
        if (!turtle) {
            frame = null;
            return void element.hide();
        }
        frame = requestAnimationFrame(draw);
        const c = scene();
        const [x, y, z = 0] = turtle.last;
        const at: Vec3 = [x, y, z];
        const p = c.pt3D(at);
        // The screen vectors of its heading and its left.
        const u = vSub(c.pt3D(vAdd(at, turtle.u)), p);
        const v = vSub(c.pt3D(vAdd(at, turtle.v)), p);
        const box = c.svg.dom().getBoundingClientRect();
        element
            .stl("left", `${box.left + p[0]}px`)
            .stl("top", `${box.top + p[1]}px`);
        if (c.GRID.is2D) {
            plane.att(
                "transform",
                `rotate(${(Math.atan2(u[1], u[0]) * 180) / Math.PI})`,
            );
            plane.show();
            space.hide();
        } else {
            // As DGPad draws it, from the unit vectors on the screen.
            const mix = (k: number, l: number) =>
                `${u[0] * k + v[0] * l} ${u[1] * k + v[1] * l}`;
            space
                .att(
                    "d",
                    `M${mix(0.6, 0)}L${mix(0, -0.25)}L${mix(0.2, 0)}L${mix(0, 0.25)}Z`,
                )
                .att(
                    "fill",
                    u[0] * v[1] - u[1] * v[0] < 0 ? "#00ff00" : "#555555",
                );
            space.show();
            plane.hide();
        }
        element.show();
    }

    return {
        element,
        // Draws the turtle shown, as long as it is.
        watch(): void {
            frame ??= requestAnimationFrame(draw);
        },
    };
}
