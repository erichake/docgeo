import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import {
    GEOMETRY_EPSILON,
    vAdd,
    vIsFinite,
    vNorm,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import { construction_object } from "./construction_object";
import { point_on_object } from "./point_on_object";
import { point_object } from "./point_object";
import { polygon_object } from "./polygon_object";
import { primitive_circle_object } from "./primitive_circle_object";
import { primitive_line_object } from "./primitive_line_object";
import { quadric5pts_object } from "./quadric5pts_object";
import { ray_line_object } from "./ray_line_object";
import { segment_object } from "./segment_object";
import { two_points_line_object } from "./two_points_line_object";

type Alpha = number | readonly [number, number];
type DriverSample = Alpha | { coords: Vec3 } | null;

const DEFAULT_SAMPLES = 1000;
const MAX_SAMPLES = 5000;
const QUADRIC_BOUND_STEPS = 20;

export class locus_object extends construction_object {
    target: point_object;
    driver: point_on_object;
    points: (Vec3 | null)[] = [];
    screenPoints: (Vec2 | null)[] = [];
    projectionDefined = true;
    path!: DOMElement;
    hitArea!: DOMElement;
    private dependencyChain: construction_object[];

    constructor(
        c: construction,
        name: string | null | undefined,
        target: point_object,
        driver: point_on_object,
    ) {
        super(c, name, "locus");
        this.target = target;
        this.driver = driver;
        this.precision = DEFAULT_SAMPLES;
        this.familytype = "locus";
        this.dependencyChain = this.findDependencyChain();
        this.addParents(target, driver);
    }

    private findDependencyChain(): construction_object[] {
        const ancestors = new Set<construction_object>();
        const visitParents = (object: construction_object): void => {
            if (ancestors.has(object)) return;
            ancestors.add(object);
            object.parents.forEach(visitParents);
        };
        visitParents(this.target);

        const dependsMemo = new Map<construction_object, boolean>();
        const dependsOnDriver = (object: construction_object): boolean => {
            if (object === this.driver) return true;
            const cached = dependsMemo.get(object);
            if (cached !== undefined) return cached;
            const depends = object.parents.some(dependsOnDriver);
            dependsMemo.set(object, depends);
            return depends;
        };

        return this.C.OBJS.V.filter(
            (object) =>
                object !== this.driver &&
                ancestors.has(object) &&
                dependsOnDriver(object),
        );
    }

    computeGeometry(): void {
        const samples = this.driverSamples();
        const savedAlpha = this.driver.alpha;
        const savedPoints = new Map(
            [this.driver, ...this.dependencyChain]
                .filter(
                    (object): object is point_object =>
                        object instanceof point_object,
                )
                .map(
                    (point) =>
                        [
                            point,
                            { coords: point.coords, defined: point.defined },
                        ] as const,
                ),
        );

        this.points = samples.map((sample) => {
            if (sample === null) return null;
            // Intersection candidate assignments are cached per frame; each
            // trial position must therefore use its own cache generation.
            this.C.OBJS.frame++;
            if (isDirectSample(sample)) {
                this.driver.coords = sample.coords;
                this.driver.defined = true;
            } else {
                this.driver.alpha = sample;
                this.driver.computeGeometry();
            }
            this.dependencyChain.forEach((object) => object.computeGeometry());
            if (!this.target.defined || !vIsFinite(this.target.coords))
                return null;
            return [...this.target.coords] as Vec3;
        });

        this.C.OBJS.frame++;
        savedPoints.forEach((state, point) => {
            point.coords = state.coords;
            point.defined = state.defined;
        });
        this.driver.alpha = savedAlpha;
        this.driver.computeGeometry();
        this.dependencyChain.forEach((object) => object.computeGeometry());
        this.defined = this.points.filter((point) => point !== null).length > 1;
    }

    private driverSamples(): DriverSample[] {
        const count = Math.max(
            2,
            Math.min(
                MAX_SAMPLES,
                this.precision > 0
                    ? Math.round(this.precision)
                    : DEFAULT_SAMPLES,
            ),
        );
        const support = this.driver.support;
        if (!support.defined) return [];
        if (support instanceof primitive_circle_object)
            return range(0, 2 * Math.PI, count);
        if (support instanceof primitive_line_object)
            return this.lineAlphas(support, count);
        if (support instanceof polygon_object)
            return this.polygonSamples(support);
        return this.quadricAlphas(support, count);
    }

    private lineAlphas(
        support: primitive_line_object,
        count: number,
    ): number[] {
        if (support instanceof segment_object) return range(0, 1, count);
        const direction =
            support instanceof two_points_line_object
                ? vSub(support.P2.coords, support.P1.coords)
                : support.VEC;
        const start = this.C.pt3D(support.P1.coords);
        const next = this.C.pt3D(vAdd(support.P1.coords, direction));
        const pixelsPerAlpha = vNorm(vSub(next, start));
        const extent =
            this.C.width +
            this.C.height +
            Math.abs(start[0]) +
            Math.abs(start[1]);
        const bound =
            pixelsPerAlpha > GEOMETRY_EPSILON
                ? extent / pixelsPerAlpha
                : DEFAULT_SAMPLES;
        return support instanceof ray_line_object
            ? range(0, bound, count)
            : range(-bound, bound, count);
    }

    private polygonSamples(support: polygon_object): { coords: Vec3 }[] {
        if (support.points.length < 3) return [];
        return [...support.points, support.points[0]].map((point) => ({
            coords: point.coords,
        }));
    }

    private quadricAlphas(
        support: quadric5pts_object,
        count: number,
    ): (readonly [number, number] | null)[] {
        if (support.KIND === "ellipse") {
            return range(0, 2 * Math.PI, count).map((angle) =>
                support.alphaOf(
                    vAdd(
                        support.CENTER,
                        vAdd(
                            vScale(support.AXIS_U, Math.cos(angle)),
                            vScale(support.AXIS_V, Math.sin(angle)),
                        ),
                    ),
                ),
            );
        }
        const samplesPerBranch = Math.max(
            2,
            Math.floor(count / support.BRANCHES.length),
        );
        const result: (readonly [number, number] | null)[] = [];
        support.BRANCHES.forEach((branch, index) => {
            if (index > 0) result.push(null);
            const negative = this.quadricBound(branch, -1);
            const positive = this.quadricBound(branch, 1);
            range(-negative, positive, samplesPerBranch).forEach((parameter) =>
                result.push(support.alphaOf(branch(parameter))),
            );
        });
        return result;
    }

    private quadricBound(branch: (t: number) => Vec3, sign: 1 | -1): number {
        const center = this.C.pt3D(branch(0));
        const extent =
            this.C.width +
            this.C.height +
            Math.abs(center[0]) +
            Math.abs(center[1]);
        const outside = (value: number): boolean => {
            const point = this.C.pt3D(branch(sign * value));
            return !vIsFinite(point) || vNorm(vSub(point, center)) > extent;
        };
        let high = 1;
        while (high < 1e8 && !outside(high)) high *= 2;
        let low = high / 2;
        for (let i = 0; i < QUADRIC_BOUND_STEPS; i++) {
            const middle = (low + high) / 2;
            if (outside(middle)) high = middle;
            else low = middle;
        }
        return high;
    }

    project(): void {
        this.screenPoints = this.points.map((point) => {
            if (!point) return null;
            const screen = this.C.pt3D(point);
            return vIsFinite(screen) ? screen : null;
        });
        this.projectionDefined = this.screenPoints.some(
            (point) => point !== null,
        );
    }

    render(): void {
        this.dom.stl(
            "display",
            this.isVisible && this.projectionDefined ? "block" : "none",
        );
        if (!this.defined || !this.projectionDefined) return;
        const limit = 2 * (this.C.width + this.C.height);
        let previous: Vec2 | null = null;
        const d = this.screenPoints.reduce((path, point) => {
            if (!point) {
                previous = null;
                return path;
            }
            const connected =
                previous !== null && vNorm(vSub(point, previous)) <= limit;
            previous = point;
            return `${path}${connected ? " L" : " M"}${point[0]} ${point[1]}`;
        }, "");
        this.path.att("d", d);
        this.hitArea.att("d", d);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as locus_object;
        const dom = t.svg.shape("g");
        t.hitArea = t.svg
            .shape("path")
            .stl(
                "fill:none;stroke:transparent;pointer-events:stroke;cursor:pointer",
            )
            .stl("stroke-width", t.prefs.locus.touchsize);
        t.path = t.svg
            .shape("path")
            .stl("fill", "none")
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("pointer-events", "none");
        return dom.add(t.hitArea, t.path);
    }
}

function range(start: number, end: number, count: number): number[] {
    const step = (end - start) / (count - 1);
    return Array.from({ length: count }, (_, index) => start + index * step);
}

function isDirectSample(
    sample: Exclude<DriverSample, null>,
): sample is { coords: Vec3 } {
    return typeof sample === "object" && !Array.isArray(sample);
}

export function createLocus(
    c: construction,
    name: string | null | undefined,
    target: point_object,
    driver: point_on_object,
): locus_object {
    return c.add(new locus_object(c, name, target, driver));
}
