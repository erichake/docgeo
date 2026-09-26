import type { DOMElement } from "../dom";
import type { grid_object } from "./grid_object";

const SMALL_TICK = 5;
const LONG_TICK = 10;
const ARROW_LENGTH = 16;
const ARROW_HALF_WIDTH = 8;
// A digit's advance in Verdana, in em: labels are sized without measuring
// the rendered text.
const DIGIT_WIDTH = 0.64;
const LABEL_GAP = 3;

interface Step {
    mantissa: 1 | 2 | 5;
    exponent: number;
}

const stepValue = ({ mantissa, exponent }: Step): number =>
    mantissa * 10 ** exponent;

function nextStep({ mantissa, exponent }: Step): Step {
    return mantissa === 1
        ? { mantissa: 2, exponent }
        : mantissa === 2
          ? { mantissa: 5, exponent }
          : { mantissa: 1, exponent: exponent + 1 };
}

// The smallest step of the 1-2-5 sequence spanning at least `pixels` at
// this unit.
function stepAtLeast(pixels: number, unit: number): Step {
    let step: Step = {
        mantissa: 1,
        exponent: Math.floor(Math.log10(pixels / unit)),
    };
    while (stepValue(step) * unit < pixels) step = nextStep(step);
    return step;
}

// Five subdivisions of a 1 or 5 step, four of a 2 step, so that minor
// ticks always fall on round values.
const subdivisions = (step: Step): number => (step.mantissa === 2 ? 4 : 5);

function formatter(step: Step): Intl.NumberFormat {
    const digits = Math.max(0, -step.exponent);
    return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
        useGrouping: false,
    });
}

// The indices k of the multiples k*step within [min, max]: values are
// computed from them so that no rounding error accumulates.
function multiples(step: number, min: number, max: number): number[] {
    const indices: number[] = [];
    for (let k = Math.ceil(min / step); k * step <= max; k++)
        indices.push(k + 0);
    return indices;
}

const snap = (pixel: number): number => Math.round(pixel - 0.5) + 0.5;

// DGPad's plane coordinate system, drawn in screen space for a figure
// without 3D objects: when the origin leaves the window, the graduations
// stay pinned to its edges instead of disappearing with the axes.
export class axes_2d {
    readonly dom: DOMElement;
    private minorGrid: DOMElement;
    private majorGrid: DOMElement;
    private axes: DOMElement;
    private arrows: DOMElement;
    private ticks: DOMElement;
    private labels: DOMElement;
    private texts: DOMElement[] = [];

    constructor(svg: DOMElement) {
        this.dom = svg
            .shape("g")
            .stl("pointer-events", "none")
            .att("shape-rendering", "crispEdges");
        this.minorGrid = svg.shape("path").stl("fill", "none");
        this.majorGrid = svg.shape("path").stl("fill", "none");
        this.axes = svg.shape("path").stl("fill", "none");
        this.arrows = svg
            .shape("path")
            .stl("stroke", "none")
            .att("shape-rendering", "auto");
        this.ticks = svg.shape("path").stl("fill", "none");
        this.labels = svg
            .shape("g")
            .stl(
                "font-family:Verdana;paint-order:stroke;stroke-width:4;stroke-linejoin:round;shape-rendering:auto",
            );
        this.dom.add(
            this.minorGrid,
            this.majorGrid,
            this.axes,
            this.arrows,
            this.ticks,
            this.labels,
        );
    }

    render(grid: grid_object): void {
        const C = grid.C;
        const [width, height] = [C.width, C.height];
        const [x0, y0] = grid.ORG;
        const [ux, uy] = grid.UNIT;
        const fontSize = grid.fontSize;
        const color = grid.stroke_color;
        const positive = grid.onlyPositive;

        const xMin = positive ? Math.max(0, -x0 / ux) : -x0 / ux;
        const xMax = (width - x0) / ux;
        const yMin = positive
            ? Math.max(0, (y0 - height) / uy)
            : (y0 - height) / uy;
        const yMax = y0 / uy;
        const px = (x: number) => x0 + x * ux;
        const py = (y: number) => y0 - y * uy;

        // Labels are spaced by their own width, so that they never overlap:
        // the same step then serves both axes when their units are equal.
        const labelWidth = (text: string) =>
            text.length * DIGIT_WIDTH * fontSize;
        const spacing = (step: Step) => {
            const format = formatter(step);
            const widest = Math.max(
                ...[xMin, xMax].map((x) =>
                    labelWidth(
                        format.format(
                            Math.trunc(x / stepValue(step)) * stepValue(step),
                        ),
                    ),
                ),
            );
            return Math.max(4 * fontSize, widest + 2 * fontSize);
        };
        let xStep = stepAtLeast(4 * fontSize, ux);
        while (stepValue(xStep) * ux < spacing(xStep)) xStep = nextStep(xStep);
        const yStep = stepAtLeast(stepValue(xStep) * ux, uy);

        // Where each axis's graduations go: on the axis, or on the window
        // edge it went past.
        const ax = snap(Math.min(Math.max(x0, 0), width));
        const ay = snap(Math.min(Math.max(y0, 0), height));
        const top = 0;
        const bottom = positive ? Math.min(height, y0) : height;
        const left = positive ? Math.max(0, x0) : 0;

        const [xn, yn] = [subdivisions(xStep), subdivisions(yStep)];
        const [xMinor, yMinor] = [stepValue(xStep) / xn, stepValue(yStep) / yn];
        const xTicks = multiples(xMinor, xMin, xMax);
        const yTicks = multiples(yMinor, yMin, yMax);
        const minor: string[] = [];
        const major: string[] = [];
        if (grid.showGrid) {
            xTicks.forEach((k) =>
                (k % xn === 0 ? major : minor).push(
                    `M${snap(px(k * xMinor))} ${top}V${bottom}`,
                ),
            );
            yTicks.forEach((k) =>
                (k % yn === 0 ? major : minor).push(
                    `M${left} ${snap(py(k * yMinor))}H${width}`,
                ),
            );
        }
        // Browsers drop strokes thinner than a pixel unevenly (per raster
        // tile, per sub-pixel offset): a thinner line is drawn one pixel
        // wide and fainter instead.
        const hairline = (path: DOMElement, width: number) =>
            path
                .stl("stroke", color)
                .stl("stroke-width", Math.max(1, width))
                .stl("stroke-opacity", Math.min(1, width));
        hairline(this.minorGrid.att("d", minor.join("")), grid.gridWidth);
        hairline(this.majorGrid.att("d", major.join("")), 2 * grid.gridWidth);

        const axes: string[] = [];
        const arrows: string[] = [];
        const ticks: string[] = [];
        const texts: { text: string; x: number; y: number; anchor: string }[] =
            [];
        const tick = (length: number) => length + grid.size;
        let xRow: [number, number] | null = null;

        if (grid.showOx) {
            if (y0 > 0 && y0 < height) {
                axes.push(`M${positive ? ax : 0} ${ay}H${width}`);
                arrows.push(
                    `M${width + 1} ${ay}L${width - ARROW_LENGTH} ${ay - ARROW_HALF_WIDTH}V${ay + ARROW_HALF_WIDTH}Z`,
                );
            }
            xTicks.forEach((k) =>
                ticks.push(
                    `M${snap(px(k * xMinor))} ${ay - tick(SMALL_TICK)}V${ay + tick(SMALL_TICK)}`,
                ),
            );
            const below = ay + tick(LONG_TICK) + fontSize;
            const baseline =
                below <= height - LABEL_GAP
                    ? below
                    : ay - tick(LONG_TICK) - LABEL_GAP;
            xRow = [baseline - fontSize, baseline + LABEL_GAP];
            const format = formatter(xStep);
            multiples(stepValue(xStep), xMin, xMax).forEach((k) => {
                if (k === 0 && grid.showOy) return;
                const x = k * stepValue(xStep);
                const text = format.format(x);
                const half = labelWidth(text) / 2;
                const X = snap(px(x));
                ticks.push(
                    `M${X} ${ay - tick(LONG_TICK)}V${ay + tick(LONG_TICK)}`,
                );
                if (X - half >= 0 && X + half <= width)
                    texts.push({ text, x: X, y: baseline, anchor: "middle" });
            });
        }

        if (grid.showOy) {
            if (x0 > 0 && x0 < width) {
                axes.push(`M${ax} 0V${positive ? ay : height}`);
                arrows.push(
                    `M${ax} -1L${ax - ARROW_HALF_WIDTH} ${ARROW_LENGTH}H${ax + ARROW_HALF_WIDTH}Z`,
                );
            }
            yTicks.forEach((k) =>
                ticks.push(
                    `M${ax - tick(SMALL_TICK)} ${snap(py(k * yMinor))}H${ax + tick(SMALL_TICK)}`,
                ),
            );
            const format = formatter(yStep);
            const values = multiples(stepValue(yStep), yMin, yMax).map(
                (k) => k * stepValue(yStep),
            );
            const widest = Math.max(
                0,
                ...values.map((y) => labelWidth(format.format(y))),
            );
            const onLeft = ax - tick(LONG_TICK) - LABEL_GAP - widest >= 0;
            const x = onLeft
                ? ax - tick(LONG_TICK) - LABEL_GAP
                : ax + tick(LONG_TICK) + LABEL_GAP;
            values.forEach((y) => {
                if (y === 0 && grid.showOx) return;
                const Y = snap(py(y));
                ticks.push(
                    `M${ax - tick(LONG_TICK)} ${Y}H${ax + tick(LONG_TICK)}`,
                );
                const [labelTop, labelBottom] = [
                    Y - fontSize / 2,
                    Y + fontSize / 2,
                ];
                if (labelTop < 0 || labelBottom > height) return;
                if (xRow && labelBottom > xRow[0] && labelTop < xRow[1]) return;
                texts.push({
                    text: format.format(y),
                    x,
                    y: Y + 0.35 * fontSize,
                    anchor: onLeft ? "end" : "start",
                });
            });
        }

        this.axes
            .att("d", axes.join(""))
            .stl("stroke", color)
            .stl("stroke-width", grid.size);
        this.arrows.att("d", arrows.join("")).stl("fill", color);
        this.ticks
            .att("d", ticks.join(""))
            .stl("stroke", color)
            .stl("stroke-width", 1);

        this.labels
            .stl("fill", color)
            .stl("stroke", C.prefs.background.color)
            .stl("font-size", `${fontSize}px`);
        while (this.texts.length < texts.length) {
            const text = this.labels.shape("text");
            this.texts.push(text);
            this.labels.add(text);
        }
        this.texts.forEach((element, index) => {
            const label = texts[index];
            element.stl("display", label ? "inline" : "none");
            if (label)
                element
                    .att("x", label.x)
                    .att("y", label.y)
                    .att("text-anchor", label.anchor)
                    .text(label.text);
        });
    }
}
