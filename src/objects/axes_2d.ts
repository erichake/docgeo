import type { DOMElement } from "../dom";
import type { grid_object } from "./grid_object";

const SMALL_TICK = 5;
const LONG_TICK = 10;
const ARROW_LENGTH = 16;
const ARROW_HALF_WIDTH = 8;
// A digit's advance in Verdana, in em, and in Verdana Bold: labels are sized
// without measuring the rendered text.
const DIGIT_WIDTH = 0.64;
const BOLD_DIGIT_WIDTH = 0.71;
const LABEL_GAP = 3;

interface Step {
    mantissa: 1 | 2 | 5;
    exponent: number;
}

export const stepValue = ({ mantissa, exponent }: Step): number =>
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
export function stepAtLeast(pixels: number, unit: number): Step {
    let step: Step = {
        mantissa: 1,
        exponent: Math.floor(Math.log10(pixels / unit)),
    };
    while (stepValue(step) * unit < pixels) step = nextStep(step);
    return step;
}

// GeoGebra's (relevé dans GeoGebra): at most one number every 100 pixels,
// compared within its 1e-8 tolerance (a saved unit of 49.999999999999986
// pixels has a number every unit).
function geogebraStep(unit: number): Step {
    const units = 100 / unit;
    const exponent = Math.floor(Math.log10(units) + 1e-8);
    const n = units / 10 ** exponent;
    return {
        mantissa: n > 5 + 1e-8 ? 5 : n > 2 + 1e-8 ? 2 : 1,
        exponent,
    };
}

// An axis's graduations: a number every `major`, `subdivisions` minor
// graduations between two, in units of `factor` (π, or 1).
interface Graduation {
    major: number;
    subdivisions: number;
    format: Intl.NumberFormat;
    factor: number;
}

// The smallest step of an axis in units of π: its numbers are then all
// multiples of π/2.
const HALF: Step = { mantissa: 5, exponent: -1 };

function formatter(digits: number): Intl.NumberFormat {
    return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
        useGrouping: false,
    });
}

// Five subdivisions of a 1 or 5 step, four of a 2 step, so that minor
// ticks always fall on round values; GeoGebra's halfway.
const automatic = (step: Step, factor = 1, geogebra = false): Graduation => ({
    major: stepValue(step),
    subdivisions: geogebra ? 2 : step.mantissa === 2 ? 4 : 5,
    format: formatter(Math.max(0, -step.exponent)),
    factor,
});

// GeoGebra's fixed distance: a minor graduation halfway, numbers with as
// many decimals as it has, but at most as many as GeoGebra writes at this
// unit (pixels per unit).
export function fixed(
    distance: number,
    factor: number,
    unit: number,
): Graduation {
    const most = Math.max(2, -Math.floor(Math.log10(100 / unit)));
    let digits = 0;
    while (
        digits < most &&
        Math.abs(
            Math.round(distance * 10 ** digits) - distance * 10 ** digits,
        ) > 1e-9
    )
        digits++;
    return {
        major: distance,
        subdivisions: 2,
        format: formatter(digits),
        factor,
    };
}

// As GeoGebra writes a number of π units: π/2, π, 3π/2…, else its value.
function piText(value: number): string {
    const halves = Math.round(2 * value);
    if (Math.abs(2 * value - halves) > 1e-9)
        return formatter(2).format(value * Math.PI);
    const sign = halves < 0 ? "-" : "";
    const n = Math.abs(halves);
    return n === 0
        ? "0"
        : n % 2
          ? `${sign}${n === 1 ? "" : n}π/2`
          : `${sign}${n === 2 ? "" : n / 2}π`;
}

// The indices k of the multiples k*step within [min, max]: values are
// computed from them so that no rounding error accumulates.
export function multiples(step: number, min: number, max: number): number[] {
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
            text.length *
            (grid.boldNumbers ? BOLD_DIGIT_WIDTH : DIGIT_WIDTH) *
            fontSize;
        const spacing = (step: Step) => {
            const { format } = automatic(step);
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
        const geogebra = grid.geogebraAxes;
        let xStep = geogebra ? geogebraStep(ux) : stepAtLeast(4 * fontSize, ux);
        while (
            stepValue(xStep) * ux <
            (geogebra ? spacing(xStep) - 1.5 * fontSize : spacing(xStep))
        )
            xStep = nextStep(xStep);
        const yStep = geogebra
            ? geogebraStep(uy)
            : stepAtLeast(stepValue(xStep) * ux, uy);
        // Zoomed out until its numbers overlap, a fixed distance gives way
        // to DGPad's own; with a unit of π, to multiples of π/2 as far apart.
        const graduation = (
            axis: 0 | 1,
            step: Step,
            unit: number,
        ): Graduation => {
            const factor = grid.axisUnits[axis] === "π" ? Math.PI : 1;
            const distance = grid.tickDistances[axis] / factor;
            if (distance * unit * factor >= fontSize)
                return fixed(distance, factor, unit);
            if (factor === 1) return automatic(step, 1, geogebra);
            const pi = stepAtLeast(stepValue(step) * unit, unit * factor);
            return automatic(stepValue(pi) < 0.5 ? HALF : pi, factor);
        };
        // A number with its unit.
        const number = (axis: 0 | 1, graduation: Graduation, value: number) =>
            graduation.factor === 1
                ? graduation.format.format(value) + grid.axisUnits[axis]
                : piText(value);
        const xAxis = graduation(0, xStep, ux);
        const yAxis = graduation(1, yStep, uy);
        // GeoGebra's: no graduations over a grid at the same distance.
        const [xStyle, yStyle] = grid.tickStyles.map((style, axis) =>
            geogebra && grid.showGrid && !grid.gridDistances[axis] ? 2 : style,
        );

        // Where each axis's graduations go: on the axis, or on the window
        // edge it went past.
        const ax = snap(Math.min(Math.max(x0, 0), width));
        const ay = snap(Math.min(Math.max(y0, 0), height));
        const top = 0;
        const bottom = positive ? Math.min(height, y0) : height;
        const left = positive ? Math.max(0, x0) : 0;

        const [xf, yf] = [xAxis.factor, yAxis.factor];
        const [xn, yn] = [xAxis.subdivisions, yAxis.subdivisions];
        const [xMinor, yMinor] = [xAxis.major / xn, yAxis.major / yn];
        const xTicks = multiples(xMinor, xMin / xf, xMax / xf);
        const yTicks = multiples(yMinor, yMin / yf, yMax / yf);
        const minor: string[] = [];
        const major: string[] = [];
        if (grid.showGrid) {
            // Major lines at the numbers, or at GeoGebra's fixed distance
            // as long as its minor lines stay 3 pixels apart.
            const lines = (
                axis: 0 | 1,
                graduation: Graduation,
                unit: number,
                min: number,
                max: number,
                line: (value: number) => string,
            ) => {
                const n = grid.gridSubdivisions || graduation.subdivisions;
                const fixed = grid.gridDistances[axis];
                const distance =
                    (fixed / n) * unit >= 3
                        ? fixed
                        : graduation.major * graduation.factor;
                multiples(distance / n, min, max).forEach((k) =>
                    (k % n === 0 ? major : minor).push(
                        line((k * distance) / n),
                    ),
                );
            };
            lines(
                0,
                xAxis,
                ux,
                xMin,
                xMax,
                (x) => `M${snap(px(x))} ${top}V${bottom}`,
            );
            lines(
                1,
                yAxis,
                uy,
                yMin,
                yMax,
                (y) => `M${left} ${snap(py(y))}H${width}`,
            );
        }
        // Browsers drop strokes thinner than a pixel unevenly (per raster
        // tile, per sub-pixel offset): a thinner line is drawn one pixel
        // wide and fainter instead.
        const hairline = (path: DOMElement, width: number, opacity = 1) =>
            path
                .stl("stroke", grid.gridColor ?? color)
                .stl("stroke-width", Math.max(1, width))
                .stl("stroke-opacity", Math.min(1, width) * opacity)
                .stl("stroke-dasharray", grid.gridDash.join(" ") || "none");
        // GeoGebra's minor lines are as wide as its major ones, fainter.
        hairline(
            this.minorGrid.att("d", minor.join("")),
            grid.gridWidth,
            geogebra ? 60 / 255 : 1,
        );
        hairline(
            this.majorGrid.att("d", major.join("")),
            geogebra ? grid.gridWidth : 2 * grid.gridWidth,
        );

        const axes: string[] = [];
        const arrows: string[] = [];
        const ticks: string[] = [];
        const texts: {
            text: string;
            x: number;
            y: number;
            anchor: string;
            size?: number;
        }[] = [];
        const tick = (length: number) => length + grid.size;
        // A graduation's extent across its axis, towards its numbers: on
        // both sides in DGPad, only theirs in GeoGebra, 3 pixels long for a
        // major one, 2 for a minor one (3 by bold axes).
        const across = (major: boolean): [number, number] => {
            if (geogebra) return [0, major || grid.size > 1 ? 3 : 2];
            const length = tick(major ? LONG_TICK : SMALL_TICK);
            return [-length, length];
        };
        const [minorFrom, minorTo] = across(false);
        const [majorFrom, majorTo] = across(true);
        // Oy's numbers from the axis, GeoGebra's closer.
        const yGap = geogebra ? 4 + fontSize / 4 : tick(LONG_TICK) + LABEL_GAP;
        let xRow: [number, number] | null = null;
        const [xNumbers, yNumbers] = grid.showNumbers;
        const [xLabel, yLabel] = grid.axisLabels;
        // GeoGebra's arrows, a third of its numbers' size, a pixel more by
        // bold axes; their tip and the axis's end inside the window.
        const dgpad = grid.arrows === 0;
        const open = grid.arrows === 2;
        const arrow = fontSize / 3 + (grid.size > 1 ? 1 : 0);
        const inset = grid.arrows > 1 ? grid.size : 0;
        // An arrow's tip, pointing along (dx, dy), its sides (sx, sy) wide.
        const head = (x: number, y: number, dx: number, dy: number) => {
            const length = dgpad ? ARROW_LENGTH : open ? arrow : 4 * arrow;
            const half = dgpad ? ARROW_HALF_WIDTH : arrow;
            const [bx, by] = [x - dx * length, y - dy * length];
            return `M${bx - dy * half} ${by + dx * half}L${x} ${y}L${bx + dy * half} ${by - dx * half}${open ? "" : "Z"}`;
        };
        // An axis's name, at its end, as large as the figure's own texts.
        const labelSize = fontSize + 4;

        if (grid.showOx) {
            if (y0 > 0 && y0 < height) {
                axes.push(`M${positive ? ax : 0} ${ay}H${width - inset}`);
                if (grid.arrows !== 1)
                    arrows.push(
                        head(width - inset + (dgpad ? 1 : 0), ay, 1, 0),
                    );
                if (xLabel)
                    texts.push({
                        text: xLabel,
                        x: width - (dgpad ? ARROW_LENGTH + 4 : 10),
                        y: ay - (dgpad ? ARROW_HALF_WIDTH + 2 : 4),
                        anchor: "end",
                        size: labelSize,
                    });
            }
            if (xStyle === 0)
                xTicks.forEach((k) =>
                    ticks.push(
                        `M${snap(px(k * xMinor * xf))} ${ay + minorFrom}V${ay + minorTo}`,
                    ),
                );
            const below = geogebra
                ? ay + fontSize + 4
                : ay + tick(LONG_TICK) + fontSize;
            const baseline =
                below <= height - LABEL_GAP
                    ? below
                    : ay - (geogebra ? 4 : tick(LONG_TICK) + LABEL_GAP);
            if (xNumbers) xRow = [baseline - fontSize, baseline + LABEL_GAP];
            multiples(xAxis.major, xMin / xf, xMax / xf).forEach((k) => {
                // GeoGebra's 0 at the origin's bottom left.
                if (k === 0 && grid.showOy) {
                    if (
                        geogebra &&
                        (xNumbers || yNumbers) &&
                        x0 >= 0 &&
                        x0 <= width &&
                        y0 >= 0 &&
                        y0 <= height
                    )
                        texts.push({
                            text: "0",
                            x: ax - yGap,
                            y: baseline,
                            anchor: "end",
                        });
                    return;
                }
                const x = k * xAxis.major;
                const text = number(0, xAxis, x);
                const half = labelWidth(text) / 2;
                const X = snap(px(x * xf));
                if (xStyle < 2)
                    ticks.push(`M${X} ${ay + majorFrom}V${ay + majorTo}`);
                if (xNumbers && X - half >= 0 && X + half <= width)
                    texts.push({ text, x: X, y: baseline, anchor: "middle" });
            });
        }

        if (grid.showOy) {
            if (x0 > 0 && x0 < width) {
                axes.push(`M${ax} ${inset}V${positive ? ay : height}`);
                if (grid.arrows !== 1)
                    arrows.push(head(ax, inset - (dgpad ? 1 : 0), 0, -1));
                if (yLabel)
                    texts.push({
                        text: yLabel,
                        x: ax + (dgpad ? ARROW_HALF_WIDTH + 4 : 5),
                        y: (dgpad ? ARROW_LENGTH / 2 : 5) + 0.8 * labelSize,
                        anchor: "start",
                        size: labelSize,
                    });
            }
            if (yStyle === 0)
                yTicks.forEach((k) =>
                    ticks.push(
                        `M${ax - minorTo} ${snap(py(k * yMinor * yf))}H${ax - minorFrom}`,
                    ),
                );
            const values = multiples(yAxis.major, yMin / yf, yMax / yf).map(
                (k) => k * yAxis.major,
            );
            const widest = Math.max(
                0,
                ...values.map((y) => labelWidth(number(1, yAxis, y))),
            );
            const onLeft = ax - yGap - widest >= 0;
            const x = onLeft ? ax - yGap : ax + yGap;
            values.forEach((y) => {
                if (y === 0 && grid.showOx) return;
                const Y = snap(py(y * yf));
                if (yStyle < 2)
                    ticks.push(`M${ax - majorTo} ${Y}H${ax - majorFrom}`);
                if (!yNumbers) return;
                const [labelTop, labelBottom] = [
                    Y - fontSize / 2,
                    Y + fontSize / 2,
                ];
                if (labelTop < 0 || labelBottom > height) return;
                if (xRow && labelBottom > xRow[0] && labelTop < xRow[1]) return;
                texts.push({
                    text: number(1, yAxis, y),
                    x,
                    y: Y + (geogebra ? fontSize / 2 - 1 : 0.35 * fontSize),
                    anchor: onLeft ? "end" : "start",
                });
            });
        }

        this.axes
            .att("d", axes.join(""))
            .stl("stroke", color)
            .stl("stroke-width", grid.size);
        this.arrows
            .att("d", arrows.join(""))
            .stl("fill", open ? "none" : color)
            .stl("stroke", open ? color : "none")
            .stl("stroke-width", grid.size);
        this.ticks
            .att("d", ticks.join(""))
            .stl("stroke", color)
            .stl("stroke-width", 1);

        this.labels
            .stl("fill", color)
            .stl("stroke", C.prefs.background.color)
            .stl("font-size", `${fontSize}px`)
            .stl("font-weight", grid.boldNumbers ? "bold" : "normal");
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
                    .att("font-size", label.size ?? fontSize)
                    .text(label.text);
        });
    }
}
