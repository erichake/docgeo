import type { DOMElement } from "../dom";
import { projectPoint } from "../projection";
import type { Vec2 } from "../vec";
import { fixed, multiples, stepAtLeast, stepValue } from "./axes_2d";
import type { grid_object } from "./grid_object";

const COLORS = ["rgb(255,0,0)", "rgb(0,127,0)", "rgb(0,0,255)"];
const TICK = 3.5;
const ARROW_LENGTH = 12;
const ARROW_HALF_WIDTH = 4.5;
// Numbers' distance from their axis, and the axes' names' from their end.
const GAP = 7.5;
const DIGIT_WIDTH = 0.6;

// GeoGebra's 3D axes: red, green and blue, each across its clipping box
// (see grid.geogebraBox), a tick and a number at each multiple of its
// distance, numbers on one side, its name on the other past its arrow.
export class axes_3d {
    readonly dom: DOMElement;
    private paths: DOMElement[];
    private labels: DOMElement;
    private texts: DOMElement[] = [];

    constructor(svg: DOMElement) {
        this.dom = svg.shape("g").stl("pointer-events", "none");
        this.paths = COLORS.map((color) =>
            svg
                .shape("path")
                .stl("stroke", color)
                .stl("fill", color)
                .stl("stroke-linecap", "round"),
        );
        this.labels = svg
            .shape("g")
            .stl(
                "font-family:Verdana;paint-order:stroke;stroke-width:3;stroke-linejoin:round",
            );
        this.dom.add(...this.paths, this.labels);
    }

    render(grid: grid_object): void {
        const frame = grid.projectionFrame;
        const box = grid.geogebraBox;
        const font = grid.fontSize;
        const shown = [grid.showOx, grid.showOy, grid.showOz];
        const texts: { text: string; at: Vec2; color: string }[] = [];
        // Centered `along` past `at`, clear of it.
        const place = (
            text: string,
            at: Vec2,
            [nx, ny]: Vec2,
            color: string,
        ) => {
            const reach =
                GAP +
                (Math.abs(nx) * text.length * DIGIT_WIDTH * font) / 2 +
                (Math.abs(ny) * font) / 2;
            texts.push({
                text,
                at: [at[0] + nx * reach, at[1] + ny * reach],
                color,
            });
        };
        this.paths.forEach((path, axis) => {
            let [min, max] = [box[0][axis], box[1][axis]];
            if (grid.onlyPositive) min = Math.max(min, 0);
            // Outside the box, as GeoGebra hides it.
            const outside = box[0].some(
                (low, other) => other !== axis && low * box[1][other] > 0,
            );
            if (!shown[axis] || outside || min >= max)
                return void path.att("d", "");
            const point = (t: number): Vec2 =>
                projectPoint(
                    [
                        axis === 0 ? t : 0,
                        axis === 1 ? t : 0,
                        axis === 2 ? t : 0,
                    ],
                    frame,
                );
            const [a, b] = [point(min), point(max)];
            const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (length < 1) return void path.att("d", "");
            const [dx, dy] = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
            // GeoGebra's side of its numbers: left of Oy and Oz, right of Ox.
            const side: Vec2 = axis ? [dy, -dx] : [-dy, dx];
            const unit = grid.UNIT[axis];
            const distance =
                grid.tickDistances[axis] * unit >= font
                    ? grid.tickDistances[axis]
                    : stepValue(stepAtLeast(4 * font, unit));
            const { format } = fixed(distance, 1, unit);
            let d = `M${a[0]} ${a[1]}L${b[0]} ${b[1]}M${b[0] + dx * ARROW_LENGTH} ${b[1] + dy * ARROW_LENGTH}l${-dx * ARROW_LENGTH + dy * ARROW_HALF_WIDTH} ${-dy * ARROW_LENGTH - dx * ARROW_HALF_WIDTH}l${-2 * dy * ARROW_HALF_WIDTH} ${2 * dx * ARROW_HALF_WIDTH}z`;
            multiples(distance, min, max).forEach((k) => {
                const at = point(k * distance);
                if (grid.tickStyles[axis] < 2)
                    d += `M${at[0] - dy * TICK} ${at[1] + dx * TICK}l${2 * dy * TICK} ${-2 * dx * TICK}`;
                if (grid.showNumbers[axis])
                    place(
                        format.format(k * distance) + grid.axisUnits[axis],
                        at,
                        side,
                        COLORS[axis],
                    );
            });
            path.att("d", d).stl("stroke-width", grid.size);
            const name = grid.axisLabels[axis];
            if (name)
                place(
                    name,
                    [b[0] - dx * GAP, b[1] - dy * GAP],
                    [-side[0], -side[1]],
                    COLORS[axis],
                );
        });
        this.labels
            .stl("stroke", grid.C.prefs.background.color)
            .stl("font-size", `${font}px`);
        while (this.texts.length < texts.length) {
            const text = this.labels
                .shape("text")
                .att("text-anchor", "middle")
                .att("dominant-baseline", "central");
            this.texts.push(text);
            this.labels.add(text);
        }
        this.texts.forEach((element, index) => {
            const label = texts[index];
            element.stl("display", label ? "inline" : "none");
            if (label)
                element
                    .att("x", label.at[0])
                    .att("y", label.at[1])
                    .stl("fill", label.color)
                    .text(label.text);
        });
    }
}
