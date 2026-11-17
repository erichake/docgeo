import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import { realPart } from "../import/dgp_formula";
import { viewDirection, viewRay } from "../projection";
import {
    vAdd,
    vCross,
    vDot,
    vIsFinite,
    vNormalize,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import {
    construction_object,
    dgoFormula,
    type DgoContext,
} from "./construction_object";
import { evaluateFunction, type ExpressionFormula } from "./expression_object";
import { lighting, pathData, shade } from "./polygon_object";
import { solid_object } from "./solid_object";
import { convexHull } from "./sphere_object";

// Squares of its mesh along x and y, and the side, in pixels, of the
// screen cells its triangles are found by.
const MESH = 40;
const CELL = 32;
// The side of GeoGebra's clipping box, small, medium or large, to the
// window's.
const BOX = [1 / Math.sqrt(3), Math.sqrt(2 / 3), 1];

interface Face {
    screen: Vec2[];
    depth: number;
    color: string;
}
// A triangle of a face on the screen, with its corners' depths.
type Triangle = [Vec2, Vec2, Vec2, number, number, number];

// The part of `polygon` where `side` is positive (Sutherland–Hodgman).
function clip(polygon: Vec3[], side: (point: Vec3) => number): Vec3[] {
    return polygon.flatMap((p, i) => {
        const q = polygon[(i + 1) % polygon.length];
        const [sp, sq] = [side(p), side(q)];
        const kept = sp >= 0 ? [p] : [];
        return sp >= 0 !== sq >= 0
            ? [...kept, vAdd(p, vScale(vSub(q, p), sp / (sp - sq)))]
            : kept;
    });
}

// GeoGebra's surface z = f(x, y), of a function of two variables or of a
// quadric's equation solved for z: drawn within GeoGebra's clipping box,
// its faces lit like polygons, farthest first. Seen
// through as a whole. It hides what lies behind it (see hidden_line.ts),
// not what lies on it: its mesh only approaches it.
export class surface_object extends solid_object {
    formula: ExpressionFormula;
    // GeoGebra's clipping box size: 0, 1 or 2.
    size: number;
    private faces: Face[] = [];
    private cells = new Map<string, Triangle[]>();
    // The depth a curve on it may lie behind its mesh.
    private slack = 0;
    private paths: DOMElement[] = [];

    constructor(
        c: construction,
        name: string | null | undefined,
        formula: ExpressionFormula,
        size: number,
    ) {
        super(c, name);
        this.formula = formula;
        this.size = size;
        this.addParents(...formula.refs.values());
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "Surf",
            [
                dgoFormula(this.formula.source, this.formula.refs, context),
                this.size,
            ],
        ];
    }

    // f(x, y), NaN where it isn't a real number.
    valueAt(x: number, y: number): number {
        const value = evaluateFunction(this.formula, [x, y], () =>
            this.C.formulaView(),
        );
        return (value === null ? null : realPart(value)) ?? NaN;
    }

    // The parameters, sorted, where the line origin + t·ray meets it:
    // exactly when f is at most quadratic along it, else from samples.
    meet(origin: Vec3, ray: Vec3): number[] {
        const h = (t: number) => {
            const [x, y, z] = vAdd(origin, vScale(ray, t));
            return z - this.valueAt(x, y);
        };
        const [m, o, p] = [h(-1), h(0), h(1)];
        const a = (m + p) / 2 - o;
        const b = (p - m) / 2;
        const quadratic = (t: number) => a * t * t + b * t + o;
        if (
            [-2, 2, 3].every(
                (t) =>
                    Math.abs(h(t) - quadratic(t)) <=
                    1e-9 * (1 + Math.abs(h(t))),
            )
        ) {
            if (Math.abs(a) <= 1e-12 * (Math.abs(b) + Math.abs(o)))
                return b ? [-o / b] : [];
            const disc = b * b - 4 * a * o;
            if (disc < 0) return [];
            const root = Math.sqrt(disc);
            return [(-b - root) / (2 * a), (-b + root) / (2 * a)].sort(
                (s, t) => s - t,
            );
        }
        const roots: number[] = [];
        const SPAN = 100;
        const STEPS = 2000;
        let [t0, h0] = [-SPAN, h(-SPAN)];
        for (let k = 1; k <= STEPS; k++) {
            const t1 = -SPAN + (2 * SPAN * k) / STEPS;
            const h1 = h(t1);
            if (h0 === 0) roots.push(t0);
            else if (h0 < 0 !== h1 < 0 && Number.isFinite(h0 + h1)) {
                let [lo, hi, hl] = [t0, t1, h0];
                for (let n = 0; n < 50; n++) {
                    const mid = (lo + hi) / 2;
                    const hm = h(mid);
                    if (hm < 0 === hl < 0) [lo, hl] = [mid, hm];
                    else hi = mid;
                }
                roots.push((lo + hi) / 2);
            }
            [t0, h0] = [t1, h1];
        }
        return roots;
    }

    computeGeometry(): void {
        this.defined = true;
    }

    project(): void {
        this.projectionDefined = false;
        this.faces = [];
        this.cells.clear();
        // Hidden, it is only called.
        if (!this.isVisible) return;
        const { C } = this;
        const frame = C.projectionFrame;
        const dir = vNormalize(viewDirection(frame))!;
        const center = viewRay([C.width / 2, C.height / 2], [0, 0, 0], frame);
        if (!center) return;
        const [cx, cy, cz] = center[0];
        // GeoGebra's clipping box: the box of the window's width and
        // height, as deep as wide, reduced by its size, turned with the
        // view, then the box of x, y and z holding it.
        const [right, up] = C.screenPlaneBasis;
        const scale = BOX[this.size] / 2 / Math.abs(frame.unit[0]);
        const [w, h] = [C.width * scale, C.height * scale];
        const [rx, ry, rz] = [0, 1, 2].map(
            (k) =>
                Math.abs(right[k]) * w +
                Math.abs(up[k]) * h +
                Math.abs(dir[k]) * Math.max(w, h),
        );
        const [sx, sy] = [(2 * rx) / MESH, (2 * ry) / MESH];
        this.slack = Math.min(sx, sy) / 4;
        const grid = Array.from({ length: MESH + 1 }, (_, i) =>
            Array.from({ length: MESH + 1 }, (_, j): Vec3 => {
                const [x, y] = [cx - rx + i * sx, cy - ry + j * sy];
                return [x, y, this.valueAt(x, y)];
            }),
        );
        const corners: Vec2[] = [];
        for (let i = 0; i < MESH; i++)
            for (let j = 0; j < MESH; j++) {
                const square = [
                    grid[i][j],
                    grid[i + 1][j],
                    grid[i + 1][j + 1],
                    grid[i][j + 1],
                ];
                if (!square.every(vIsFinite)) continue;
                const polygon = clip(
                    clip(square, (p) => p[2] - cz + rz),
                    (p) => cz + rz - p[2],
                );
                if (polygon.length < 3) continue;
                const screen = polygon.map((p) => C.pt3D(p));
                if (!screen.every(vIsFinite)) continue;
                const depths = polygon.map((p) => vDot(p, dir));
                const normal = vNormalize(
                    vCross(
                        vSub(square[1], square[0]),
                        vSub(square[3], square[0]),
                    ),
                );
                this.faces.push({
                    screen,
                    depth: depths.reduce((s, d) => s + d) / depths.length,
                    color: shade(
                        this.fill_color,
                        normal ? lighting(C, normal) : 1,
                    ),
                });
                corners.push(...screen);
                for (let k = 1; k + 1 < screen.length; k++) {
                    const triangle: Triangle = [
                        screen[0],
                        screen[k],
                        screen[k + 1],
                        depths[0],
                        depths[k],
                        depths[k + 1],
                    ];
                    const xs = triangle.slice(0, 3).map((p) => (p as Vec2)[0]);
                    const ys = triangle.slice(0, 3).map((p) => (p as Vec2)[1]);
                    for (
                        let u = Math.floor(Math.min(...xs) / CELL);
                        u <= Math.floor(Math.max(...xs) / CELL);
                        u++
                    )
                        for (
                            let v = Math.floor(Math.min(...ys) / CELL);
                            v <= Math.floor(Math.max(...ys) / CELL);
                            v++
                        ) {
                            const key = `${u},${v}`;
                            const cell = this.cells.get(key);
                            if (cell) cell.push(triangle);
                            else this.cells.set(key, [triangle]);
                        }
                }
            }
        this.faces.sort((p, q) => q.depth - p.depth);
        this.outline = convexHull(corners);
        this.projectionDefined = this.faces.length > 0;
    }

    entryDepth([x, y]: Vec2): number | null {
        let entry: number | null = null;
        for (const [a, b, c, da, db, dc] of this.cells.get(
            `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`,
        ) ?? []) {
            const det =
                (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
            if (!det) continue;
            const l1 =
                ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / det;
            const l2 =
                ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / det;
            const l3 = 1 - l1 - l2;
            if (l1 < 0 || l2 < 0 || l3 < 0) continue;
            const depth = l1 * da + l2 * db + l3 * dc + this.slack;
            if (entry === null || depth < entry) entry = depth;
        }
        return entry;
    }

    render(): void {
        this.dom.stl(
            "display",
            this.isVisible && this.projectionDefined ? "block" : "none",
        );
        if (!this.defined || !this.projectionDefined) return;
        this.dom.stl("opacity", this.opacity ?? 0);
        while (this.paths.length < this.faces.length) {
            const path = this.svg
                .shape("path")
                .stl("stroke-width", 1)
                .stl("stroke-linejoin", "round");
            this.paths.push(path);
            this.dom.add(path);
        }
        this.paths.forEach((path, k) => {
            const face = this.faces[k];
            if (!face) path.att("d", "");
            else
                path.att("d", pathData(face.screen))
                    .stl("fill", face.color)
                    .stl("stroke", face.color);
        });
    }

    static createSVG(_this: construction_object): DOMElement {
        (_this as surface_object).paths = [];
        return _this.svg.shape("g").stl("pointer-events", "none");
    }
}

export function createSurface(
    c: construction,
    name: string | null | undefined,
    formula: ExpressionFormula,
    size: number,
): surface_object {
    return c.add(new surface_object(c, name, formula, size));
}
