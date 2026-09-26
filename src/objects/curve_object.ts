import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import { realPart, type FormulaView } from "../import/dgp_formula";
import { GEOMETRY_EPSILON, vIsFinite, type Vec2, type Vec3 } from "../vec";
import { construction_object } from "./construction_object";
import { evaluateAtX, type ExpressionFormula } from "./expression_object";

const SAMPLES_MIN = 2;
const SAMPLES_MAX = 2000;
// Screen gap (px) below which two samples are joined without looking closer,
// and bisection depth after which a gap that still hasn't closed is a jump.
const CONTINUITY_GAP = 1;
const JUMP_DEPTH = 20;

// A plotted y = f(x) curve (DGPad's Curvus/CartesianFunction). Unlike
// locus_object (which samples a driver point's position, a genuine
// geometric dependency), a curve's domain is the visible viewport itself:
// panning/zooming only marks projection dirty (see construction.ts), so all
// of the sampling — not just the screen conversion — has to happen in
// project(), mirroring how primitive_line_object re-extends its screen-
// filling line there instead of in computeGeometry().
export class curve_object extends construction_object {
    formula: ExpressionFormula;
    min: number | null;
    max: number | null;
    screenPoints: (Vec2 | null)[] = [];
    // Whether the curve is continuous between screenPoints[i] and [i + 1].
    private links: boolean[] = [];
    // The x sampled at screenPoints[0] and the x step between consecutive
    // samples, from the last project() — lets alphaAtScreen turn a segment
    // index back into an x, and is 0/0 (harmlessly) whenever the domain was
    // empty and screenPoints is [].
    private sampleLo = 0;
    private sampleStep = 0;
    private path!: DOMElement;
    private hitArea!: DOMElement;

    constructor(
        c: construction,
        name: string | null | undefined,
        formula: ExpressionFormula,
        min: number | null,
        max: number | null,
    ) {
        super(c, name, "curve");
        this.familytype = "curve";
        this.formula = formula;
        this.min = min;
        this.max = max;
        this.addParents(...formula.refs.values());
    }

    // The x range currently sampled: Curvus's own explicit bounds, or
    // (unbounded) the visible viewport's edges — also used by Locus to
    // sample a driver point dragged along this curve.
    domain(): [number, number] {
        const org = this.C.GRID.ORG;
        const unit = this.C.GRID.UNIT[0];
        const x0 = (0 - org[0]) / unit;
        const x1 = (this.C.width - org[0]) / unit;
        return [this.min ?? Math.min(x0, x1), this.max ?? Math.max(x0, x1)];
    }

    project(): void {
        const [lo, hi] = this.domain();
        const view = this.C.formulaView();
        const count = Math.max(
            SAMPLES_MIN,
            Math.min(SAMPLES_MAX, Math.round(this.C.width)),
        );
        const screenPoints: (Vec2 | null)[] = [];
        const step = hi > lo ? (hi - lo) / (count - 1) : 0;
        if (hi > lo)
            for (let i = 0; i < count; i++)
                screenPoints.push(this.screenAt(lo + i * step, view));
        this.links = screenPoints.slice(1).map((end, i) => {
            const start = screenPoints[i];
            if (!start || !end) return false;
            const before = screenPoints[i - 1];
            const after = screenPoints[i + 2];
            // A step that its neighbours' average predicts is smooth: no need
            // to evaluate the formula any further.
            if (
                before &&
                after &&
                Math.hypot(
                    end[0] - start[0] - (after[0] - before[0]) / 3,
                    end[1] - start[1] - (after[1] - before[1]) / 3,
                ) <=
                    CONTINUITY_GAP / 2
            )
                return true;
            const x = lo + i * step;
            return this.continuous(x, start, x + step, end, view, JUMP_DEPTH);
        });
        this.screenPoints = screenPoints;
        this.sampleLo = lo;
        this.sampleStep = step;
        this.defined = screenPoints.some((point) => point !== null);
    }

    // The exact math-space point at x (not interpolated from a sample, since
    // — unlike locus_object — a curve can evaluate its formula directly at
    // any x), or null outside Curvus's own explicit bounds or where the
    // formula is undefined. Used by PointOn.
    pointAt(x: number): Vec3 | null {
        if (this.min !== null && x < this.min) return null;
        if (this.max !== null && x > this.max) return null;
        const y = realPart(evaluateAtX(this.formula, x, this.C.formulaView()));
        return y === null ? null : [x, y, 0];
    }

    // Nearest x, in screen space, to a pointer position — PointOn's dragging
    // counterpart to pointAt, searched over the samples built by the last
    // project() (see sampleLo/sampleStep).
    alphaAtScreen(target: Vec2): number | null {
        let bestAlpha: number | null = null;
        let bestDistance = Infinity;
        for (let index = 0; index < this.screenPoints.length - 1; index++) {
            if (!this.isConnected(index)) continue;
            const start = this.screenPoints[index]!;
            const end = this.screenPoints[index + 1]!;
            const direction: Vec2 = [end[0] - start[0], end[1] - start[1]];
            const lengthSquared =
                direction[0] * direction[0] + direction[1] * direction[1];
            if (lengthSquared <= GEOMETRY_EPSILON) continue;
            const fraction = Math.max(
                0,
                Math.min(
                    1,
                    ((target[0] - start[0]) * direction[0] +
                        (target[1] - start[1]) * direction[1]) /
                        lengthSquared,
                ),
            );
            const candidate: Vec2 = [
                start[0] + fraction * direction[0],
                start[1] + fraction * direction[1],
            ];
            const distance = Math.hypot(
                target[0] - candidate[0],
                target[1] - candidate[1],
            );
            if (distance >= bestDistance) continue;
            bestDistance = distance;
            bestAlpha = this.sampleLo + (index + fraction) * this.sampleStep;
        }
        if (bestAlpha !== null) return bestAlpha;
        this.screenPoints.forEach((point, index) => {
            if (!point) return;
            const distance = Math.hypot(
                target[0] - point[0],
                target[1] - point[1],
            );
            if (distance >= bestDistance) return;
            bestDistance = distance;
            bestAlpha = this.sampleLo + index * this.sampleStep;
        });
        return bestAlpha;
    }

    // Nearest point on the curve to a math-space point — the magnetism
    // ("mg" style) counterpart of alphaAtScreen, used while dragging a free
    // point instead of a point already constrained to this curve.
    nearestPoint(target: Vec3): Vec3 | null {
        const screen = this.C.pt3D(target);
        if (!vIsFinite(screen)) return null;
        const x = this.alphaAtScreen(screen);
        return x === null ? null : this.pointAt(x);
    }

    private screenAt(x: number, view: FormulaView): Vec2 | null {
        const y = realPart(evaluateAtX(this.formula, x, view));
        if (y === null) return null;
        const screen = this.C.pt3D([x, y, 0]);
        return vIsFinite(screen) ? screen : null;
    }

    // Unlike DGPad, which joins every pair of samples, a jump (floor, an
    // asymptote…) isn't drawn as a vertical segment. Between two distant
    // samples, a continuous curve, however steep, soon looks straight once
    // bisected, whereas a jump keeps its whole gap in one half at any depth.
    private continuous(
        x0: number,
        p0: Vec2,
        x1: number,
        p1: Vec2,
        view: FormulaView,
        depth: number,
    ): boolean {
        if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) <= CONTINUITY_GAP)
            return true;
        if (depth === 0) return false;
        const xm = (x0 + x1) / 2;
        const pm = this.screenAt(xm, view);
        if (!pm) return false;
        if (
            Math.hypot(
                pm[0] - (p0[0] + p1[0]) / 2,
                pm[1] - (p0[1] + p1[1]) / 2,
            ) <=
            CONTINUITY_GAP / 2
        )
            return true;
        return Math.hypot(pm[0] - p0[0], pm[1] - p0[1]) >
            Math.hypot(p1[0] - pm[0], p1[1] - pm[1])
            ? this.continuous(x0, p0, xm, pm, view, depth - 1)
            : this.continuous(xm, pm, x1, p1, view, depth - 1);
    }

    private isConnected(index: number): boolean {
        return this.links[index];
    }

    render(): void {
        this.dom.stl("display", this.isVisible ? "block" : "none");
        if (!this.isVisible) return;
        let previous: Vec2 | null = null;
        const d = this.screenPoints.reduce((path, point, index) => {
            if (!point) {
                previous = null;
                return path;
            }
            const connected = previous !== null && this.isConnected(index - 1);
            previous = point;
            return `${path}${connected ? " L" : " M"}${point[0]} ${point[1]}`;
        }, "");
        this.path.att("d", d);
        this.hitArea.att("d", d);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as curve_object;
        const dom = t.svg.shape("g");
        t.hitArea = t.svg
            .shape("path")
            .stl(
                "fill:none;stroke:transparent;pointer-events:stroke;cursor:pointer",
            )
            .stl("stroke-width", t.prefs.curve.touchsize);
        t.path = t.svg
            .shape("path")
            .stl("fill", "none")
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("pointer-events", "none");
        return dom.add(t.hitArea, t.path);
    }
}

export function createCurve(
    c: construction,
    name: string | null | undefined,
    formula: ExpressionFormula,
    min: number | null,
    max: number | null,
): curve_object {
    return c.add(new curve_object(c, name, formula, min, max));
}
