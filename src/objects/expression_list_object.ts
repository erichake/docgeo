import type { construction } from "../construction";
import { $, type DOMElement } from "../dom";
import type { FormulaValue, ScriptValue } from "../import/dgp_formula";
import type { Vec2 } from "../vec";
import type { construction_object, DgoContext } from "./construction_object";
import { loadKaTeX, type expression_object } from "./expression_object";
import { list_object } from "./list_object";

// The turtle's 7x10 palette, from color 1.
const PALETTE =
    "ffffff cccccc c0c0c0 999999 666666 333333 000000 ffcccc ff6666 ff0000 cc0000 990000 660000 330000 ffcc99 ff9966 ff9900 ff6600 cc6600 993300 663300 ffff99 ffff66 ffcc66 ffcc33 cc9933 996633 663333 ffffcc ffff33 ffff00 ffcc00 999900 666600 333300 99ff99 66ff99 33ff33 33cc00 009900 006600 003300 99ffff 33ffff 66cccc 00cccc 339999 336666 003333 ccffff 66ffff 33ccff 3366ff 3333ff 000099 000066 ccccff 9999ff 6666cc 6633ff 6600cc 333399 330099 ffccff ff99ff cc66cc cc33cc 993399 663366 330033".split(
        " ",
    );

const hexChannels = (hex: string) =>
    [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));

// A "#rgb", "#rrggbb" or "rgb(r,g,b)" color's channels.
function channels(color: string): number[] {
    if (color[0] !== "#")
        return color
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number);
    const hex = color.slice(1);
    return hexChannels(
        hex.length === 3 ? hex.replace(/./g, (digit) => digit + digit) : hex,
    );
}

interface Image {
    url: string;
    width: number;
    height: number;
    zoom: number;
    opacity: number;
    direction: readonly number[];
}

// How a point of the list is drawn: its color, the size of the segment it
// starts and its own radius, and what the drawing instructions that follow
// it add (a fill of the region it closes, a text, an image).
interface PointStyle {
    rgb: number[];
    width: number;
    radius: number;
    fill?: number;
    text?: [string, readonly number[], readonly ScriptValue[]];
    image?: Image;
}

const ANCHORS: Record<string, string> = { left: "start", right: "end" };

// The turtle's heading, in degrees clockwise on the screen.
const heading = (direction: readonly number[]) =>
    (-Math.atan2(direction[1], direction[0]) * 180) / Math.PI;

// Their natural size, for the images drawn with it (a negative width).
const IMAGE_SIZES = new Map<string, Vec2 | null>();

// DGPad's List: the points of an Expression whose value is a list of 2D or
// 3D points, drawn as dots and, when `segmentsSize` is positive (its "sg"
// style), joined by segments, a point with NaN coordinates breaking the
// line. When opaque, each piece between two breaks is also filled. Items of
// 4 or more values among the points are drawing instructions, those of
// DGPad's Blockly turtle (see TURTLE_ARITY in dgp_formula.ts): colors, pen
// and point sizes, fills, texts and images.
export class expression_list_object extends list_object {
    source: expression_object;
    segmentsSize = -1;
    // The points, without the breaks, that another turtle reads.
    points: ScriptValue[] = [];
    private styles: PointStyle[] = [];
    private fills!: DOMElement;
    private strokes!: DOMElement;
    private dots!: DOMElement;
    private labels!: DOMElement;
    private formulaLabels!: DOMElement;
    private images!: DOMElement;

    constructor(
        c: construction,
        name: string | null | undefined,
        source: expression_object,
    ) {
        super(c, name, "point", { kind: "number", value: 0 }, [], new Map());
        this.source = source;
        this.readsView = source.viewDependent || c.GRID.FRAME2D !== null;
        this.addParents(source);
    }

    dgo(context: DgoContext): [string, unknown] {
        return ["ELst", [context.index(this.source)]];
    }

    computeGeometry(): void {
        const value = this.source.value;
        const items: FormulaValue[][] = [];
        const styles: PointStyle[] = [];
        let rgb = channels(this.stroke_color);
        let width = this.segmentsSize;
        let radius = this.size;
        let font: readonly ScriptValue[] = ["Arial", 30, "normal", "center"];
        let color = 54;
        let gradientStart = 0;
        if (Array.isArray(value))
            for (const item of value) {
                // As DGPad, a malformed item empties the whole list.
                if (!Array.isArray(item) || item.length < 2) {
                    items.length = styles.length = 0;
                    break;
                }
                const last = styles[styles.length - 1];
                const [code, a, b, n] = item as number[];
                if (item.length > 3) {
                    switch (code) {
                        // A gradient from the color at the previous stop.
                        case 0: {
                            const count = styles.length - gradientStart;
                            styles
                                .slice(gradientStart + 1)
                                .forEach((style, k) => {
                                    style.rgb = rgb.map((channel, i) =>
                                        Math.round(
                                            channel +
                                                ((k + 1) *
                                                    ([a, b, n][i] - channel)) /
                                                    count,
                                        ),
                                    );
                                });
                            rgb = [a, b, n];
                            gradientStart = styles.length;
                            break;
                        }
                        case 1:
                            rgb = [a, b, n];
                            break;
                        case 2:
                        case 3:
                            color =
                                code === 2 ? (n - 1) % 70 : (color + n) % 70;
                            rgb = hexChannels(PALETTE[color] ?? "000000");
                            break;
                        case 4:
                            if (last) last.fill = n / 100;
                            break;
                        case 10:
                        case 11:
                            width = code === 10 ? n : width + n;
                            break;
                        case 12:
                        case 13:
                            radius = code === 12 ? n : radius + n;
                            break;
                        case 20:
                            if (last)
                                last.text = [
                                    String(b),
                                    item[3] as number[],
                                    font,
                                ];
                            break;
                        case 21:
                            font = item[3] as ScriptValue[];
                            break;
                        case 30:
                            if (last)
                                last.image = {
                                    url: String(a),
                                    width: b,
                                    height: n,
                                    zoom: item[4] as number,
                                    opacity: item[5] as number,
                                    direction: item[6] as number[],
                                };
                    }
                    continue;
                }
                const [x, y, z] = item.map((coord) =>
                    typeof coord === "number" ? coord : NaN,
                );
                // As DGPad's other 2D points, in the screen plane of a 3D
                // figure (see GRID.FRAME2D).
                items.push([
                    item.length === 3
                        ? [x, y, z]
                        : this.C.GRID.FRAME2D
                          ? this.C.screenPlanePoint([x, y])
                          : [x, y],
                ]);
                styles.push({ rgb, width, radius });
            }
        this.items = items;
        this.styles = styles;
        this.points = (Array.isArray(value) ? value : []).filter(
            (item) =>
                Array.isArray(item) &&
                item.length < 4 &&
                !(Number.isNaN(item[0]) && Number.isNaN(item[1])),
        );
        this.count = items.length;
        this.defined = this.source.defined && this.count > 0;
    }

    render(): void {
        this.dom.stl("display", this.isVisible ? "block" : "none");
        if (!this.isVisible) return;
        const points = this.screenItems.map(([p]) => p);
        const joined = this.segmentsSize > 0;
        const fills: [string, string][] = [];
        const strokes = new Map<string, string>();
        const dots = new Map<string, string>();
        const labels: [Vec2, PointStyle][] = [];
        const pieceFill = `${this.fill_color};fill-opacity:${this.opacity}`;
        // Since the last break, filled when opaque, and since the last break
        // or fill, which a fill closes.
        let piece = "";
        let region = "";
        points.forEach((p, i) => {
            if (!p) {
                if (piece && joined && this.opacity)
                    fills.push([piece, pieceFill]);
                piece = region = "";
                return;
            }
            const style = this.styles[i];
            const color = `rgb(${style.rgb})`;
            const at = `${p[0]} ${p[1]}`;
            const previous = points[i - 1];
            if (joined && previous) {
                const key = `${this.styles[i - 1].rgb}|${this.styles[i - 1].width}`;
                strokes.set(
                    key,
                    `${strokes.get(key) ?? ""}M${previous[0]} ${previous[1]}L${at}`,
                );
            }
            piece += `${piece ? "L" : "M"}${at}`;
            region += `${region ? "L" : "M"}${at}`;
            if (joined && style.fill !== undefined) {
                fills.push([
                    region,
                    `rgb(${style.rgb});fill-opacity:${style.fill}`,
                ]);
                region = `M${at}`;
            }
            const r = style.radius;
            if (r > 1e-10)
                dots.set(
                    color,
                    `${dots.get(color) ?? ""}M${p[0] - r} ${p[1]}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`,
                );
            if (style.text || style.image) labels.push([p, style]);
        });
        if (piece && joined && this.opacity) fills.push([piece, pieceFill]);

        this.shapes(this.fills, "path", fills.length).forEach((path, i) =>
            path.att("d", fills[i][0]).stl(`fill:${fills[i][1]}`),
        );
        const segments = [...strokes];
        this.shapes(this.strokes, "path", segments.length).forEach(
            (path, i) => {
                const [key, d] = segments[i];
                const [rgb, width] = key.split("|");
                path.att("d", d).stl(
                    `stroke:rgb(${rgb});stroke-width:${width}`,
                );
            },
        );
        // As DGPad's points: white, or filled with their color when opaque.
        const circles = [...dots];
        this.shapes(this.dots, "path", circles.length).forEach((path, i) => {
            const [color, d] = circles[i];
            path.att("d", d).stl(
                `stroke:${color};fill:${this.opacity ? color : this.prefs.point.color.fill};fill-opacity:${this.opacity || 1}`,
            );
        });
        const texts = labels.filter(
            ([, style]) => style.text && !style.text[0].includes("$$"),
        );
        this.shapes(this.labels, "text", texts.length).forEach((text, i) => {
            const [p, style] = texts[i];
            const [content, direction, [family, size, face, align]] =
                style.text!;
            text.att("transform", this.placement(p, direction))
                .att("text-anchor", ANCHORS[align as string] ?? "middle")
                .stl(`fill:rgb(${style.rgb});font:${face} ${size}px ${family}`)
                .text(content);
        });
        // Its "$$TeX$$" parts drawn by KaTeX, turned only when it has to be,
        // as a turned foreignObject is drawn out of place by some browsers.
        const formulas = labels.filter(([, style]) =>
            style.text?.[0].includes("$$"),
        );
        this.shapes(
            this.formulaLabels,
            "foreignObject",
            formulas.length,
        ).forEach((object, i) => {
            const [p, style] = formulas[i];
            const [content, direction, [family, size, face, align]] =
                style.text!;
            const angle = heading(direction);
            object
                .att("x", p[0])
                .att("y", p[1])
                .att("width", 1)
                .att("height", 1)
                .att(
                    "transform",
                    angle ? `rotate(${angle} ${p[0]} ${p[1]})` : "",
                )
                .stl(
                    `overflow:visible;color:rgb(${style.rgb});font:${face} ${size}px ${family}`,
                );
            if (object.getAtt("data-tex") === content) return;
            object.att("data-tex", content).text("");
            const parts = content.split("$$");
            const shift = { left: 0, right: -100 }[align as string] ?? -50;
            const line = $.create("div")
                .stl(
                    `width:max-content;white-space:pre;line-height:1;transform:translate(${shift}%,-0.8em)`,
                )
                .add(
                    ...parts.map((part, k) =>
                        k % 2 ? $.create("span") : new Text(part),
                    ),
                );
            object.add(line);
            loadKaTeX().then((katex) => {
                if (object.getAtt("data-tex") !== content) return;
                const spans = line.findAll(":scope > span");
                parts
                    .filter((_, k) => k % 2)
                    .forEach((tex, k) =>
                        spans[k].inner(
                            katex.renderToString(tex, {
                                throwOnError: false,
                            }),
                        ),
                    );
            });
        });
        const images = labels.filter(([, style]) => style.image);
        this.shapes(this.images, "image", images.length).forEach((image, i) => {
            const [p, { image: img }] = images[i];
            const { url, zoom, opacity, direction } = img!;
            let size: Vec2 | null | undefined = [img!.width, img!.height];
            if (size[0] < 0) {
                size = IMAGE_SIZES.get(url);
                if (size === undefined) this.loadImage(url);
                size ??= [0, 0];
            }
            const [w, h] = [size[0] * zoom, size[1] * zoom];
            image
                .att("href", url)
                .att("x", -w / 2)
                .att("y", -h / 2)
                .att("width", w)
                .att("height", h)
                .att("opacity", opacity)
                .att("transform", this.placement(p, direction));
        });
    }

    // At the point, turned to the turtle's heading.
    private placement(p: Vec2, direction: readonly number[]): string {
        return `translate(${p[0]} ${p[1]}) rotate(${heading(direction)})`;
    }

    private loadImage(url: string): void {
        IMAGE_SIZES.set(url, null);
        const image = new Image();
        image.onload = () => {
            IMAGE_SIZES.set(url, [image.naturalWidth, image.naturalHeight]);
            if (this.hasView) this.render();
        };
        image.src = url;
    }

    // The group's first `count` children, made or removed as needed.
    private shapes(
        group: DOMElement,
        tag: keyof SVGElementTagNameMap,
        count: number,
    ): DOMElement[] {
        const shapes = group.findAll(":scope > *");
        while (shapes.length < count) {
            const shape = this.svg.shape(tag);
            group.add(shape);
            shapes.push(shape);
        }
        shapes.splice(count).forEach((shape) => shape.dispose());
        return shapes;
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as expression_list_object;
        const group = (style: string) =>
            t.svg.shape("g").stl(`${style};pointer-events:none`);
        t.fills = group("stroke:none");
        t.strokes = group(
            "fill:none;stroke-linecap:round;stroke-linejoin:round",
        );
        t.dots = group(`stroke-width:${t.prefs.point.border ?? 1}`);
        t.labels = group("white-space:pre");
        t.formulaLabels = group("");
        t.images = group("");
        return t.svg
            .shape("g")
            .add(
                t.fills,
                t.strokes,
                t.dots,
                t.labels,
                t.formulaLabels,
                t.images,
            );
    }
}

export function createExpressionList(
    c: construction,
    name: string | null | undefined,
    source: expression_object,
): expression_list_object {
    return c.add(new expression_list_object(c, name, source));
}
