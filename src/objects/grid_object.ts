import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { GridPref } from "../preferences";
import {
    projectPoint,
    screenBasis,
    viewDirection,
    viewRay,
    type ProjectionFrame,
} from "../projection";
import type { ScriptValue } from "../import/dgp_formula";
import {
    vAdd,
    vDot,
    vNormalize,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import { axes_2d } from "./axes_2d";
import { axes_3d } from "./axes_3d";
import { construction_object } from "./construction_object";
import { floorClipPath } from "./floor_occlusion";
import { point_object } from "./point_object";
import { pathData, polygon_object } from "./polygon_object";
import type { sphere_object } from "./sphere_object";

// The floor is two-sided: a blue "sky" tone seen from above (z>0 looking
// down), an earthy brown seen from below, so which side is currently facing
// the camera is never ambiguous.
const FLOOR_TOP_COLOR = "rgb(35,141,227)";
const FLOOR_BOTTOM_COLOR = "rgb(139,94,52)";

function floorCorners(n: number): Vec3[] {
    return [
        [-n, -n, 0],
        [n, -n, 0],
        [n, n, 0],
        [-n, n, 0],
    ];
}

// Unique per grid_object instance, since more than one construction (and so
// more than one floor) can exist on the same page.
let nextClipId = 0;

export class grid_object extends construction_object {
    UNIT: Vec3;
    RESTRICT_THETA: Vec2;
    RESTRICT_PHI: Vec2;
    PHI: number;
    THETA: number;
    ORG: Vec2;
    STEP: number;
    FOCAL: number;
    PERSPECTIVE = false;
    CPHI = 0;
    SPHI = 0;
    CTHETA = 0;
    STHETA = 0;
    DIR: Vec3 = [0, 0, 1];
    axis!: DOMElement;
    floorFill!: DOMElement;
    floorLines!: DOMElement;
    floorClipShape!: DOMElement;
    private underlay!: DOMElement;
    private underlayPaths: DOMElement[] = [];
    // A plane, invisible face registered as a real occluder (see
    // hidden_line.ts) so that geometry dipping below the floor dashes the
    // same way it would behind any other face. The floor's own visible fill
    // is handled separately, by floor_occlusion.ts's exact per-face clip —
    // hidden_line.ts only ever dashes wireframe edges, never fills areas.
    floorOccluder!: polygon_object;
    // A figure without 3D objects: seen from above only, with DGPad's
    // plane coordinate system instead of the trihedron and the floor.
    is2D = false;
    // A DGPad 3D figure's plane coordinates of its 3D origin. Its 2D points
    // (free ones, those of 2-coordinate formulas and what is built only from
    // them) stay put on the screen as the view turns: they lie in the plane
    // through the origin facing the camera, where they have these plane
    // coordinates (see construction.screenPlanePoint). Null elsewhere.
    FRAME2D: Vec2 | null = null;
    showGrid = true;
    showOx = true;
    showOy = true;
    showOz = true;
    onlyPositive = false;
    // Per axis (Oz in 3D), GeoGebra's fixed distance between two numbers, 0
    // for DGPad's own, and graduations: 0 major and minor, 1 major only, 2
    // none.
    tickDistances: [number, number, number] = [0, 0, 0];
    tickStyles: [number, number, number] = [0, 0, 0];
    boldNumbers = false;
    // Graduations and numbers placed as GeoGebra's (see axes_2d).
    geogebraAxes = false;
    // Per axis: its name, written at its end, whether it shows its numbers,
    // and their unit, written after them ("π": multiples of π).
    axisLabels: [string, string, string] = ["", "", ""];
    showNumbers: [boolean, boolean, boolean] = [true, true, true];
    axisUnits: [string, string, string] = ["", "", ""];
    // GeoGebra's 3D view, where its axes end: its clipping box's size (0
    // small, 1 medium, 2 large) and the view's top left corner in the
    // window, beside a graphics view.
    boxSize = 1;
    viewInset: Vec2 = [0, 0];
    // The point of space at the center of GeoGebra's 3D view when it
    // opens, giving the depth of its clipping box's center. Null: the
    // origin's.
    pivot: Vec3 | null = null;
    // Its view's own background color, null: the figure's.
    background: string | null = null;
    // The axes' ends: DGPad's arrow (0), none (1), GeoGebra's open (2) or
    // filled one (3).
    arrows = 0;
    // Ox (resp. Oy) stays put vertically (resp. horizontally) on pan and
    // zoom.
    lockOx = false;
    lockOy = false;
    centerZoom = false;
    gridWidth = 0.1;
    // In a plane figure, per axis, GeoGebra's fixed distance between two
    // major grid lines, 0 for that between two numbers; the number of
    // intervals between two major lines, 0 for those of the graduations;
    // its color (null: that of the axes) and dash pattern.
    gridDistances: Vec2 = [0, 0];
    gridSubdivisions = 0;
    gridColor: string | null = null;
    gridDash: number[] = [];
    // The 3D floor: its color (null: blue above, brown below), opacity,
    // its lines' distance (0: none), color (null: half-transparent, the
    // floor's) and width, and its half-side, kept smaller than the window by
    // default: a floor covering it would read as a flat background instead
    // of a plane sitting in space.
    floorColor: string | null = null;
    floorOpacity = 0.3;
    floorStep = 1;
    floorLineColor: string | null = null;
    floorLineWidth = 0.5;
    private _floorExtent = 8;
    private floorPoints: point_object[] = [];
    private axes2D!: axes_2d;
    private axes3D!: axes_3d;
    // Defaults to shown, matching the default-visible axis (isAxis defaults
    // to true); applyCoordsStyle keeps the two in sync when isAxis is set
    // explicitly. Independent of the axis afterwards: 's' toggles it even
    // while the axis is hidden.
    private _showFloor = true;

    constructor(c: construction) {
        super(c, null, "grid");
        const pref = this.prefs.grid as GridPref;
        this.UNIT = pref.unit;
        this.RESTRICT_THETA = pref.restrict_theta;
        this.RESTRICT_PHI = pref.restrict_phi;
        this.PHI = pref.phi;
        this.THETA = pref.theta;
        this.ORG = [c.width / 2, c.height / 2];
        this.STEP = pref.step;
        this.FOCAL = pref.focal;
        this.fontSize = 18;
    }

    // Separate from the constructor because a real polygon_object's project()
    // reads c.GRID.projectionFrame (via hidden_line.ts) — it must run only
    // once c.GRID itself has been assigned. Called once by construction.ts
    // right after createGrid().
    // DGPad's restrictTheta and restrictPhi: the angle kept within the
    // range, a single value turning the view to it. Whether the view moved.
    restrict(angle: "THETA" | "PHI", range: ScriptValue | null): boolean {
        if (
            !Array.isArray(range) ||
            range.length !== 2 ||
            typeof range[0] !== "number" ||
            typeof range[1] !== "number" ||
            !(range[0] <= range[1])
        )
            return false;
        const [low, high] = range;
        this[`RESTRICT_${angle}`] = [low, high];
        const value = Math.min(Math.max(this[angle], low), high);
        if (value === this[angle]) return false;
        this[angle] = value;
        return true;
    }

    initFloorOccluder(): void {
        // Named with a space, which the DGP identifier grammar never
        // produces (see IDENTIFIER_PART in dgp_parser.ts): these internal
        // objects can otherwise collide with a real figure's own "P1"-style
        // names, since a null name would draw from the exact same
        // basename+number pool a DGP command's auto-generated name would —
        // silently renaming this figure's own object instead (getObj/STL
        // resolve DGP names through the parser's own variables map, not
        // this internal .name, so a collision here never breaks import, but
        // it does leave the object's displayed/looked-up name wrong).
        this.floorPoints = floorCorners(this._floorExtent).map((p, index) => {
            const point = new point_object(this.C, `floor corner ${index}`, p);
            point.hidden = 2;
            return this.C.add(point);
        });
        const occluder = new polygon_object(
            this.C,
            "floor occluder",
            this.floorPoints,
        );
        occluder.opacity = 0;
        occluder.size = 0;
        occluder.hidden = this._showFloor ? 0 : 1;
        this.floorOccluder = this.C.add(occluder);
    }

    get SHOWFLOOR(): boolean {
        return this._showFloor;
    }
    set SHOWFLOOR(value: boolean) {
        this._showFloor = value;
        this.floorOccluder.hidden = value ? 0 : 1;
    }

    get floorExtent(): number {
        return this._floorExtent;
    }
    set floorExtent(value: number) {
        this._floorExtent = value;
        const corners = floorCorners(value);
        this.floorPoints.forEach((point, index) => {
            point.coords = corners[index];
        });
    }

    project(): void {
        this.CPHI = Math.cos(this.PHI);
        this.SPHI = Math.sin(this.PHI);
        this.CTHETA = Math.cos(this.THETA);
        this.STHETA = Math.sin(this.THETA);
        this.DIR = vNormalize(viewDirection(this.projectionFrame)) ?? this.DIR;
    }

    // GeoGebra's clipping box: centered in its view, as wide as it along Ox
    // and Oy, as high along Oz, shrunk by its size.
    get geogebraBox(): [Vec3, Vec3] {
        const [left, top] = this.viewInset;
        const { width, height } = this.C;
        const center = this.boxCenter;
        const factor = [Math.sqrt(1 / 3), Math.SQRT1_2, 1][this.boxSize];
        const across = ((width - left) / 2 / this.UNIT[0]) * factor;
        const half: Vec3 = [
            across,
            across,
            ((height - top) / 2 / this.UNIT[2]) * factor,
        ];
        return [vSub(center, half), vAdd(center, half)];
    }

    private get viewCenter(): Vec2 {
        const [left, top] = this.viewInset;
        return [(this.C.width + left) / 2, (this.C.height + top) / 2];
    }

    // At the pivot's depth: a pan or a zoom moves it in the screen's plane.
    private get boxCenter(): Vec3 {
        return viewRay(
            this.viewCenter,
            this.pivot ?? [0, 0, 0],
            this.projectionFrame,
        )![0];
    }

    // GeoGebra's view turns about its clipping box's center, kept at its
    // center.
    turn(phi: number, theta: number): void {
        const center = this.pivot && this.boxCenter;
        this.PHI = phi;
        this.THETA = theta;
        if (!center) return;
        this.project();
        const [x, y] = projectPoint(center, this.projectionFrame);
        const [cx, cy] = this.viewCenter;
        this.ORG = [this.ORG[0] + cx - x, this.ORG[1] + cy - y];
    }

    // GeoGebra's SetViewDirection: in a second, the view looks along
    // `direction`, from its side nearest the camera, or from the other
    // when it already does.
    turnTo(direction: Vec3): void {
        const degrees = 180 / Math.PI;
        const [x, y, z] =
            vDot(direction, this.DIR) > 0 ? vScale(direction, -1) : direction;
        let a = Math.hypot(x, y) && Math.atan2(y, x) * degrees;
        let b = Math.atan2(z, Math.hypot(x, y)) * degrees;
        const near = (u: number, v: number) => Math.abs(u - v) < 1e-10;
        // From above, Ox to the right.
        if (near(a, 0) && near(Math.abs(b), 90)) a = -90;
        let start = (-this.PHI * degrees) % 360;
        if (start - a > 180) start -= 360;
        else if (start - a < -180) start += 360;
        let tilt = (this.THETA * degrees) % 360;
        if (tilt > 180) tilt -= 360;
        if (near(start, a) && near(tilt, b)) {
            if (!near(Math.abs(b), 90)) a += 180;
            b = -b;
        }
        const begin = performance.now();
        cancelAnimationFrame(this.turning);
        const step = () => {
            const t = Math.min(((performance.now() - begin) / 1000) ** 2, 1);
            this.turn(
                -(start + (a - start) * t) / degrees,
                (tilt + (b - tilt) * t) / degrees,
            );
            this.C.invalidateProjection();
            if (t < 1) this.turning = requestAnimationFrame(step);
        };
        step();
    }
    private turning = 0;

    get screenIJK(): [Vec2, Vec2, Vec2] {
        return screenBasis(this.projectionFrame);
    }

    get projectionFrame(): ProjectionFrame {
        return {
            origin: this.ORG,
            unit: this.UNIT,
            cosPhi: this.CPHI,
            sinPhi: this.SPHI,
            cosTheta: this.CTHETA,
            sinTheta: this.STHETA,
            dir: this.DIR,
            focal: this.PERSPECTIVE ? this.FOCAL : undefined,
        };
    }

    // *************************************************
    // ****************** SVG PART **********************
    // *************************************************

    render(): void {
        this.axes2D.dom.stl(
            "display",
            this.is2D && this.isVisible ? "block" : "none",
        );
        if (this.is2D) {
            this.axis.stl("display", "none");
            this.axes3D.dom.stl("display", "none");
            if (this.isVisible) this.axes2D.render(this);
            this.renderFloor();
            return;
        }
        const v = this.screenIJK;
        let d = "M" + this.ORG[0] + " " + this.ORG[1];
        d += " L" + v[0][0] + " " + v[0][1];
        d += " M" + this.ORG[0] + " " + this.ORG[1];
        d += " L" + v[1][0] + " " + v[1][1];
        d += " M" + this.ORG[0] + " " + this.ORG[1];
        d += " L" + v[2][0] + " " + v[2][1];
        this.axis.att("d", d);
        const geogebra = this.geogebraAxes && this.isVisible;
        this.axis.stl(
            "display",
            this.isVisible && !geogebra ? "block" : "none",
        );
        this.axes3D.dom.stl("display", geogebra ? "block" : "none");
        if (geogebra) this.axes3D.render(this);
        this.renderFloor();
    }

    private renderFloor(): void {
        const show = this.SHOWFLOOR;
        this.floorFill.stl("display", show ? "block" : "none");
        this.floorLines.stl("display", show ? "block" : "none");
        this.renderUnderlay();
        if (!show) return;

        // The camera looks down at the top (z>0 side) when moving toward it
        // decreases depth-along-DIR there, i.e. when DIR's z component is
        // negative; otherwise it's looking up at the underside.
        const color =
            this.floorColor ??
            (this.DIR[2] < 0 ? FLOOR_TOP_COLOR : FLOOR_BOTTOM_COLOR);
        this.floorFill
            .stl("fill", color)
            .stl("fill-opacity", String(this.floorOpacity));
        this.floorLines
            .stl("stroke", this.floorLineColor ?? color)
            .stl("stroke-opacity", this.floorLineColor ? "1" : "0.5")
            .stl("stroke-width", String(this.floorLineWidth));

        const frame = this.projectionFrame;
        const n = this._floorExtent;
        const step = this.floorStep;
        const project2 = (p: Vec3) => projectPoint(p, frame);

        const screenCorners = floorCorners(n).map(project2);
        this.floorFill.att(
            "points",
            screenCorners.map((p) => p.join(",")).join(" "),
        );

        let d = "";
        if (step > 0)
            for (let k = -Math.floor(n / step); k * step <= n + 1e-9; k++) {
                const t = k * step;
                const [x1, y1] = project2([t, -n, 0]);
                const [x2, y2] = project2([t, n, 0]);
                d += `M${x1} ${y1} L${x2} ${y2}`;
                const [x3, y3] = project2([-n, t, 0]);
                const [x4, y4] = project2([n, t, 0]);
                d += `M${x3} ${y3} L${x4} ${y4}`;
            }
        this.floorLines.att("d", d);

        this.floorClipShape.att(
            "d",
            floorClipPath(this.C, frame, screenCorners, this.floorOccluder),
        );
    }

    private renderUnderlay(): void {
        const pieces = [
            ...(this.C.OBJS.polygons as polygon_object[])
                .filter(
                    (polygon) =>
                        polygon.isVisible && polygon.behindFloor.length >= 3,
                )
                .map((plane) => ({
                    d: pathData(plane.behindFloor),
                    fill: plane.shadedFill,
                    opacity: plane.opacity,
                })),
            ...(this.C.OBJS.spheres as sphere_object[])
                .filter(
                    (sphere) =>
                        sphere.isVisible &&
                        sphere.projectionDefined &&
                        sphere.farPath,
                )
                .map((sphere) => ({
                    d: sphere.farPath,
                    fill: sphere.fill,
                    opacity: sphere.opacity,
                })),
        ];
        while (this.underlayPaths.length < pieces.length) {
            const path = this.svg
                .shape("path")
                .stl("pointer-events", "none")
                .stl("fill-rule", "evenodd");
            this.underlayPaths.push(path);
            this.underlay.add(path);
        }
        this.underlayPaths.forEach((path, index) => {
            const piece = pieces[index];
            path.stl("display", piece ? "block" : "none");
            if (piece)
                path.att("d", piece.d)
                    .stl("fill", piece.fill)
                    .stl("fill-opacity", piece.opacity ?? 0);
        });
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as grid_object;
        const dom = t.svg.shape("g");

        const clipId = `floor-clip-${nextClipId++}`;
        t.floorClipShape = t.svg.shape("path").att("clip-rule", "nonzero");
        const clipPath = t.svg.shape("clipPath").att("id", clipId);
        clipPath.add(t.floorClipShape);
        dom.add(clipPath);

        t.underlayPaths = [];
        t.underlay = t.svg.shape("g");
        dom.add(t.underlay);

        const floorGroup = t.svg.shape("g").stl("clip-path", `url(#${clipId})`);
        t.floorFill = t.svg
            .shape("polygon")
            .stl("stroke", "none")
            .stl("pointer-events", "none");
        t.floorLines = t.svg.shape("path").stl("pointer-events", "none");
        floorGroup.add(t.floorFill, t.floorLines);
        dom.add(floorGroup);

        t.axis = t.svg
            .shape("path")
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("cursor:pointer");
        dom.add(t.axis);
        t.axes2D = new axes_2d(t.svg);
        t.axes3D = new axes_3d(t.svg);
        dom.add(t.axes3D.dom, t.axes2D.dom);
        return dom;
    }
}

export function createGrid(c: construction): grid_object {
    return c.add(new grid_object(c));
}
