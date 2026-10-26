import { $ } from "../dom";
import type { construction_object } from "../objects/construction_object";
import { point_object } from "../objects/point_object";
import { primitive_line_object } from "../objects/primitive_line_object";
import { segment_object } from "../objects/segment_object";

// A macro's icon drawn from the figure, in the style of the tools': its
// initials grey, its finals red, framed on what they show of it. Or its
// author's letters.

// As macroIcon draws it, its content within a margin, as the tools' icons.
const SIZE = 20;
const CONTENT = 16;
const [GREY, RED] = ["#536174", "#d14343"];
// Below, in pixels of the figure, its points drawn apart all the same.
const SMALLEST = 20;

const round = (value: number) => +value.toFixed(2);
const matrix = ({ a, b, c, d, e, f }: DOMMatrix) =>
    `matrix(${[a, b, c, d, e, f].map(round).join(" ")})`;
// Encoded in UTF-8, for the letters an author types.
const dataUrl = (svg: string) =>
    `data:image/svg+xml;base64,${btoa(String.fromCharCode(...new TextEncoder().encode(svg)))}`;
// The colours of a stroke drawn, rather than of a hit area or a gradient.
const drawn = (stroke: string) =>
    !!stroke && !/^(none|transparent|url)/.test(stroke);

export function macroThumbnail(
    initials: construction_object[],
    finals: construction_object[],
): string | null {
    const strokes: string[] = [];
    const dots: [number, number, string][] = [];
    // What frames the icon, else what the lines show of the window.
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    const loose = [...box];
    const extend = (x: number, y: number, frame = box) => {
        frame[0] = Math.min(frame[0], x);
        frame[1] = Math.min(frame[1], y);
        frame[2] = Math.max(frame[2], x);
        frame[3] = Math.max(frame[3], y);
    };
    const draw = (object: construction_object, color: string) => {
        if (!object.hasView) return;
        const group = object.dom.dom() as SVGGElement;
        if (group.style.display === "none") return;
        if (object instanceof point_object) {
            const at = group.getCTM();
            if (!at) return;
            dots.push([at.e, at.f, color]);
            return extend(at.e, at.f);
        }
        // A line crosses the icon framed on the rest.
        const bounded =
            !(object instanceof primitive_line_object) ||
            object instanceof segment_object;
        // A circle's stroke is the unit circle, transformed.
        object.dom.findAll("path, circle").forEach((element) => {
            const shape = element.dom() as SVGGeometryElement;
            const values = (
                shape.tagName === "path" ? ["d"] : ["cx", "cy", "r"]
            ).map((name) => [name, shape.getAttribute(name)?.trim()]);
            const at = shape.getCTM();
            if (values.some(([, value]) => !value) || !at) return;
            if (!drawn(shape.style.stroke)) return;
            const geometry = values
                .map(([name, value]) => `${name}="${value}"`)
                .join(" ");
            strokes.push(
                `<${shape.tagName} ${geometry} transform="${matrix(at)}" stroke="${color}" vector-effect="non-scaling-stroke"/>`,
            );
            const { x, y, width, height } = shape.getBBox();
            [
                [x, y],
                [x + width, y],
                [x, y + height],
                [x + width, y + height],
            ].forEach(([px, py]) => {
                const { x, y } = new DOMPoint(px, py).matrixTransform(at);
                extend(x, y, bounded ? box : loose);
            });
        });
    };
    initials.forEach((object) => draw(object, GREY));
    finals.forEach((object) => draw(object, RED));
    if (!strokes.length && !dots.length) return null;
    if (box[0] === Infinity) box.splice(0, 4, ...loose);
    const side =
        (Math.max(box[2] - box[0], box[3] - box[1], SMALLEST) * SIZE) / CONTENT;
    const left = (box[0] + box[2] - side) / 2;
    const top = (box[1] + box[3] - side) / 2;
    const r = round((1.8 * side) / SIZE);
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="${[left, top, side, side].map(round).join(" ")}" fill="none" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">` +
        strokes.join("") +
        dots
            .map(
                ([x, y, color]) =>
                    `<circle cx="${round(x)}" cy="${round(y)}" r="${r}" fill="${color}"/>`,
            )
            .join("") +
        "</svg>";
    return dataUrl(svg);
}

// An image doesn't see the page's fonts: the system's, measured here.
const FONT = "system-ui, sans-serif";
const measure = ($.create("canvas").dom() as HTMLCanvasElement).getContext(
    "2d",
)!;

// One or two letters typed by the author, rather than the figure.
export function macroLetters(letters: string): string {
    const text = letters
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    let size = [...letters].length > 1 ? 12.5 : 16;
    measure.font = `600 ${size}px ${FONT}`;
    size = Math.min(size, (size * 18) / measure.measureText(letters).width);
    return dataUrl(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
            `<text x="10" y="10" fill="${GREY}" font-family="${FONT}" font-weight="600" font-size="${round(size)}" text-anchor="middle" dominant-baseline="central">${text}</text></svg>`,
    );
}
