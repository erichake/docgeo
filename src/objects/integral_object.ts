import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import { usesView, type ScriptValue } from "../import/dgp_formula";
import { dgoRadius, radiusValue, type circle1_radius } from "./circle1_object";
import { construction_object, type DgoContext } from "./construction_object";
import type { curve_object } from "./curve_object";

// GeoGebra's integral of a function from a to b (Itg), by Simpson's rule,
// shaded between its graph and the x-axis, and its lower and upper sums on
// n intervals (LSum, USum), each rectangle's height being the least or the
// greatest of the function's samples on its interval. A formula reads it
// as its value.
export type IntegralTag = "Itg" | "LSum" | "USum";

const SIMPSON_INTERVALS = 1000;
const REGION_INTERVALS = 200;
const EXTREMUM_SAMPLES = 16;

export class integral_object extends construction_object {
    tag: IntegralTag;
    F: curve_object;
    // a, b, then n for a sum.
    bounds: circle1_radius[];
    private value = 0;
    // Its region's outlines, closed by the x-axis.
    private outlines: number[][][] = [];
    private d = "";
    private path!: DOMElement;

    constructor(
        c: construction,
        name: string | null | undefined,
        tag: IntegralTag,
        f: curve_object,
        bounds: circle1_radius[],
    ) {
        super(c, name, "polygon");
        this.tag = tag;
        this.F = f;
        this.bounds = bounds;
        const formulas = bounds.flatMap((bound) =>
            typeof bound === "number" ? [] : [bound],
        );
        this.readsView = formulas.some((bound) => usesView(bound.formula));
        this.addParents(
            f,
            ...formulas.flatMap((bound) => [...bound.refs.values()]),
        );
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            this.tag,
            [
                context.index(this.F),
                ...this.bounds.map((bound) => dgoRadius(bound, context)),
            ],
        ];
    }

    computeGeometry(): void {
        const [a, b, n] = this.bounds.map(
            (bound) => radiusValue(bound, this.C) ?? NaN,
        );
        const f = (x: number) => this.F.pointAt(x)?.[1] ?? NaN;
        const outline = (h: number, count: number, y: (x: number) => number) =>
            Array.from({ length: count + 1 }, (_, k) => [
                a + k * h,
                y(a + k * h),
            ]);
        if (this.tag === "Itg") {
            const h = (b - a) / SIMPSON_INTERVALS;
            let sum = f(a) + f(b);
            for (let k = 1; k < SIMPSON_INTERVALS; k++)
                sum += (2 + 2 * (k % 2)) * f(a + k * h);
            this.value = (sum * h) / 3;
            this.outlines = [
                [
                    [a, 0],
                    ...outline((b - a) / REGION_INTERVALS, REGION_INTERVALS, f),
                    [b, 0],
                ],
            ];
        } else {
            const w = (b - a) / n;
            const extremum = this.tag === "LSum" ? Math.min : Math.max;
            this.value = 0;
            this.outlines = [];
            for (let i = 0; i < n; i++) {
                let e = f(a + i * w);
                for (let j = 1; j <= EXTREMUM_SAMPLES; j++)
                    e = extremum(e, f(a + (i + j / EXTREMUM_SAMPLES) * w));
                this.value += e * w;
                const [x0, x1] = [a + i * w, a + (i + 1) * w];
                this.outlines.push([
                    [x0, 0],
                    [x0, e],
                    [x1, e],
                    [x1, 0],
                ]);
            }
        }
        this.defined = Number.isFinite(this.value);
    }

    scriptValue(): ScriptValue | null {
        return this.defined ? this.value : null;
    }

    project(): void {
        this.d = this.defined
            ? this.outlines
                  .map(
                      (points) =>
                          `M${points.map(([x, y]) => this.C.pt3D([x, y, 0]).join(" ")).join("L")}Z`,
                  )
                  .join("")
            : "";
    }

    render(): void {
        this.dom.stl("display", this.isVisible ? "block" : "none");
        if (this.isVisible) this.path.att("d", this.d);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as integral_object;
        t.path = t.svg
            .shape("path")
            .stl(
                `fill:${t.fill_color};fill-opacity:${t.opacity ?? 0};stroke:${t.stroke_color};stroke-width:${t.size};stroke-dasharray:${t.strokeDashArray}`,
            )
            .stl("cursor", "pointer");
        return t.svg.shape("g").add(t.path);
    }
}

export function createIntegral(
    c: construction,
    name: string | null | undefined,
    tag: IntegralTag,
    f: curve_object,
    bounds: circle1_radius[],
): integral_object {
    return c.add(new integral_object(c, name, tag, f, bounds));
}
