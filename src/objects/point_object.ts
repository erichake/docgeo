import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { ScriptValue } from "../import/dgp_formula";
import type { PrefKey } from "../preferences";
import {
    vAdd,
    vDot,
    vIsFinite,
    vNorm,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import { projectPoint } from "../projection";
import { isOccluded } from "./hidden_line";
import {
    construction_object,
    type DgoContext,
    writeName,
} from "./construction_object";
import type { curve_object } from "./curve_object";
import type { grid_object } from "./grid_object";
import type { list_object } from "./list_object";
import { primitive_circle_object } from "./primitive_circle_object";
import { primitive_line_object } from "./primitive_line_object";
import { primitive_quadric_object } from "./primitive_quadric_object";
import { ray_line_object } from "./ray_line_object";
import { segment_object } from "./segment_object";
import { two_points_line_object } from "./two_points_line_object";

export type magnet_target =
    | primitive_line_object
    | primitive_circle_object
    | primitive_quadric_object
    | list_object
    | curve_object
    | point_object;

// A margin (screen pixels) a competing magnet must beat the currently
// active one by before the point switches to it. Without this, right at
// the boundary between two magnets (equally close), the tiniest pointer
// jitter flips which one is "closest" every single frame, dragging the
// point back and forth between them instead of following either one.
const MAGNET_HYSTERESIS = 15;
// Beyond any magnet radius (DGPad's largest is 5000 pixels).
const LINE_MAGNET_RANK = 1e5;
// Far beyond any window, yet within the single precision SVG parses its
// numbers in: a point further away (e.g. a diverging sequence's term) isn't
// drawn, rather than rejected by the SVG.
export const MAX_SCREEN = 1e7;

// The closest point to `point` lying on `target` (segment/ray bounds
// respected, same convention as point_on_object's own projection). A point
// target has no projection: it's a plain snap onto that point's own coords.
function projectOntoMagnet(target: magnet_target, point: Vec3): Vec3 {
    if (target instanceof point_object) return target.coords;
    if (target.familytype === "list")
        return (target as list_object).nearestPoint(point) ?? point;
    if (target.familytype === "curve")
        return (target as curve_object).nearestPoint(point) ?? point;
    if (target instanceof primitive_circle_object)
        return target.pointAt(target.alphaOf(point));
    if (target instanceof primitive_quadric_object)
        return target.projectPoint(point);
    if (target instanceof two_points_line_object) {
        const direction = vSub(target.P2.coords, target.P1.coords);
        let alpha =
            vDot(vSub(point, target.P1.coords), direction) /
            vDot(direction, direction);
        if (target instanceof segment_object)
            alpha = Math.max(0, Math.min(1, alpha));
        else if (target instanceof ray_line_object) alpha = Math.max(0, alpha);
        return vAdd(target.P1.coords, vScale(direction, alpha));
    }
    const support = target as primitive_line_object;
    const alpha = vDot(vSub(point, support.P1.coords), support.VEC);
    return vAdd(support.P1.coords, vScale(support.VEC, alpha));
}

export class point_object extends construction_object {
    COORDS: Vec3;
    SCREEN: Vec2;
    projectionDefined: boolean;
    shape: string;
    border = 1;
    // GeoGebra's empty circle or diamond: no fill.
    hollow = false;
    namePosition = 0;
    // Its name's distance in pixels, twice its size if null.
    nameDistance: number | null = null;
    nameText?: DOMElement;
    trace = false;
    // GeoGebra's trace: a copy of the point at each of its positions, not
    // a line through them.
    traceDots = false;
    tracePath?: DOMElement;
    // False for every subclass that overrides mousedrag as a no-op (it's
    // driven entirely by its parents' geometry, e.g. an intersection or
    // midpoint): such a point must not claim pointer hit-testing, or it
    // permanently shadows whatever's underneath once another point is
    // magnetized onto its exact position (see createSVG).
    moveable = true;
    private traceCoords: Vec3;
    private traceFrom: Vec3 | null = null;
    private traceData = "";
    // traceData's subpaths in space, to draw it again when the view changes.
    private traceSegs: Vec3[][] = [];
    private traceOpen = false;
    private traceBreak = false;
    private traceEpoch = 0;
    private traceView = 0;
    // Its trace before it changed color or stopped, kept as it was drawn.
    private traceKept: { path: DOMElement; segs: Vec3[][] }[] = [];
    // DGPad's magnetism ("mg" style): while dragging, the point snaps onto
    // whichever of these is both within `radius` screen pixels and closest,
    // instead of following the pointer directly.
    magnets: { target: magnet_target; radius: number }[] = [];
    // DGPad's "i" style (and GeoGebra's grid capturing): a dragged point
    // snaps its x and y onto multiples of these steps.
    increment: [number, number] = [0, 0];
    // DGPad's "fl" style (pushpin), in a plane figure: the window position
    // the point keeps, rather than its coordinates, through zooms and pans.
    pinned: Vec2 | null = null;
    // The magnet currently holding this point, if any — see
    // MAGNET_HYSTERESIS.
    private activeMagnet: magnet_target | null = null;

    constructor(
        c: construction,
        name: string | null | undefined,
        pt: Vec3,
        type?: PrefKey,
    ) {
        super(c, name, type ? type : "point");
        this.COORDS = [pt[0], pt[1], pt[2]];
        this.traceCoords = this.COORDS;
        this.SCREEN = [0, 0];
        this.projectionDefined = true;

        this.shape = this.prefs.point.shape.current;
    }

    get coords(): Vec3 {
        return this.COORDS;
    }
    set coords(v: Vec3) {
        this.COORDS = [v[0], v[1], v[2]];
    }
    get screen(): Vec2 {
        return this.SCREEN;
    }
    set screen(v: Vec2) {
        this.SCREEN = [v[0], v[1]];
    }
    get sx(): number {
        return this.SCREEN[0];
    }
    get sy(): number {
        return this.SCREEN[1];
    }
    get x(): number {
        return this.COORDS[0];
    }
    get y(): number {
        return this.COORDS[1];
    }
    get z(): number {
        return this.COORDS[2];
    }

    computeGeometry(): void {
        if (this.pinned)
            this.coords = this.C.GRID.FRAME2D
                ? this.C.screenPlanePoint(this.pinned)
                : this.pinnedIn(this.C.GRID);
        this.defined = vIsFinite(this.COORDS);
    }

    // A pinned point's coordinates in the given view.
    pinnedIn({ ORG, UNIT }: Pick<grid_object, "ORG" | "UNIT">): Vec3 {
        return [
            (this.pinned![0] - ORG[0]) / UNIT[0],
            (ORG[1] - this.pinned![1]) / UNIT[1],
            0,
        ];
    }

    scriptValue(vec3: boolean): ScriptValue | null {
        if (!this.defined) return null;
        if (!vec3) return [this.x, this.y];
        return this.C.GRID.FRAME2D && this.flat
            ? this.C.screenPlaneCoords(this.coords)
            : [...this.coords];
    }

    // DGPad's coords2D: where it is drawn, in the window's coordinate system
    // (see GRID.FRAME2D).
    coords2D(): Vec2 | null {
        if (!this.defined) return null;
        const { ORG, UNIT, FRAME2D } = this.C.GRID;
        if (FRAME2D && this.flat) return this.C.screenPlaneCoords(this.coords);
        // From the camera's angles rather than the projection frame, which is
        // only updated after geometry, where a formula point reads it.
        const { PHI, THETA } = this.C.GRID;
        const screen = projectPoint(this.coords, {
            ...this.C.projectionFrame,
            cosPhi: Math.cos(PHI),
            sinPhi: Math.sin(PHI),
            cosTheta: Math.cos(THETA),
            sinTheta: Math.sin(THETA),
        });
        if (!vIsFinite(screen)) return null;
        const [u0, v0] = FRAME2D ?? [0, 0];
        return [
            u0 + (screen[0] - ORG[0]) / UNIT[0],
            v0 + (ORG[1] - screen[1]) / UNIT[1],
        ];
    }

    dgo(_context: DgoContext): [string, unknown] {
        if (this.pinned && this.C.GRID.FRAME2D) return ["Pt", [...this.pinned]];
        return ["Pt", this.z ? this.coords : [this.x, this.y]];
    }

    // In a DGPad 3D figure, the point is in the screen plane, its coordinates
    // being its plane ones (see GRID.FRAME2D), which `pinned` then holds.
    pin(): void {
        const { ORG, UNIT, FRAME2D } = this.C.GRID;
        this.pinned = FRAME2D
            ? [this.x, this.y]
            : [ORG[0] + this.x * UNIT[0], ORG[1] - this.y * UNIT[1]];
        this.readsView = true;
    }

    project(): void {
        this.projectionDefined = false;
        if (!this.defined) return;
        const screen = this.C.pt3D(this.COORDS);
        this.projectionDefined = vIsFinite(screen);
        if (this.projectionDefined) this.screen = screen;
    }

    mousedrag(ev: PointerEvent): void {
        const screen = this.C.pointerPosition(ev);
        const { ORG, UNIT, FRAME2D } = this.C.GRID;
        if (this.pinned && FRAME2D) {
            this.pinned = [
                FRAME2D[0] + (screen[0] - ORG[0]) / UNIT[0],
                FRAME2D[1] + (ORG[1] - screen[1]) / UNIT[0],
            ];
            this.C.invalidateGeometry(this);
            return;
        }
        const coords = this.C.unprojectToZPlane(screen, this.z);
        if (!coords) return;
        const snapped = this.snapToIncrement(coords);
        this.coords = this.magnets.length
            ? this.snapToMagnets(snapped, screen)
            : snapped;
        if (this.pinned) this.pin();
        this.C.invalidateGeometry(this);
    }

    snapToIncrement(coords: Vec3): Vec3 {
        const [dx, dy] = this.increment;
        return [
            dx ? dx * Math.round(coords[0] / dx) : coords[0],
            dy ? dy * Math.round(coords[1] / dy) : coords[1],
            coords[2],
        ];
    }

    protected snapToMagnets(coords: Vec3, screen: Vec2): Vec3 {
        let magnet = this.nearestMagnet(coords, screen);
        // As DGPad, which computes the magnets twice: once held by a line or
        // a curve, the point is caught by a point magnet near its new
        // position, however far the pointer is.
        if (magnet && !(magnet.target instanceof point_object))
            magnet = this.nearestMagnet(magnet.point, magnet.screen) ?? magnet;
        if (!magnet) {
            if (this.activeMagnet) this.breakTraces();
            this.activeMagnet = null;
            return coords;
        }
        // A magnet switch starts a new trace subpath for this point and its
        // dependent points instead of drawing a line between both targets.
        if (this.activeMagnet !== magnet.target) this.breakTraces();
        this.activeMagnet = magnet.target;
        return magnet.point;
    }

    private nearestMagnet(
        coords: Vec3,
        screen: Vec2,
    ): { target: magnet_target; point: Vec3; screen: Vec2 } | null {
        type candidate = {
            target: magnet_target;
            point: Vec3;
            screen: Vec2;
            rank: number;
        };
        let closest: candidate | null = null;
        let active: candidate | null = null;
        for (const { target, radius } of this.magnets) {
            if (!target.defined) continue;
            const point = projectOntoMagnet(target, coords);
            const candidateScreen = this.C.pt3D(point);
            if (!vIsFinite(candidateScreen)) continue;
            const distance = vNorm(vSub(candidateScreen, screen));
            if (distance > radius) continue;
            // As DGPad, a point within reach beats any line or curve, such
            // as the ones through it, always at least as close.
            const rank =
                target instanceof point_object
                    ? distance
                    : distance + LINE_MAGNET_RANK;
            const candidate = { target, point, screen: candidateScreen, rank };
            if (target === this.activeMagnet) active = candidate;
            if (!closest || rank < closest.rank) closest = candidate;
        }
        if (active && active.rank <= closest!.rank + MAGNET_HYSTERESIS)
            return active;
        return closest;
    }

    private breakTraces(): void {
        this.traceBreak = true;
        this.children.forEach((child) => {
            if (child instanceof point_object) child.traceBreak = true;
        });
    }

    // *************************************************
    // ****************** SVG PART **********************
    // *************************************************

    render(): void {
        const drawn =
            this.defined &&
            this.projectionDefined &&
            Math.abs(this.sx) < MAX_SCREEN &&
            Math.abs(this.sy) < MAX_SCREEN;
        this.dom.stl(
            "display",
            this.isVisible && drawn && !isOccluded(this.C, this)
                ? "block"
                : "none",
        );
        this.renderTrace();
        if (!drawn) return;
        this.dom.att("transform", `translate(${this.sx} ${this.sy})`);
        // GeoGebra's caption "%v": its coordinates, rounded.
        if (this.nameText && this.caption?.includes("%v")) {
            const digits = 10 ** Math.max(this.precision, 0);
            const value = `(${this.coords
                .slice(0, this.C.GRID.is2D ? 2 : 3)
                .map((c) => String(Math.round(c * digits) / digits || 0))
                .join(", ")})`;
            const text = this.caption.replace(/%v/g, value);
            if (text !== this.nameText.text())
                writeName(this.nameText.text(""), text);
        }
        if (this.nameText && this.nameOffset)
            this.nameText
                .att("x", this.nameOffset[0])
                .att("y", this.nameOffset[1]);
        else if (this.nameText) {
            const cos = Math.cos(this.namePosition);
            const sin = Math.sin(this.namePosition);
            const size = this.nameDistance ?? 2 * this.size;
            this.nameText
                .att("x", size * cos + (this.nameText.width() * (cos - 1)) / 2)
                .att("y", -size * sin - (this.fontSize * (sin - 1)) / 2);
        }
    }

    private renderTrace(): void {
        const moved = this.traceCoords !== this.coords;
        this.traceCoords = this.coords;
        if (this.traceEpoch !== this.C.traceEpoch) {
            this.traceEpoch = this.C.traceEpoch;
            this.traceData = "";
            this.traceSegs = [];
            this.tracePath?.att("d", "");
            this.traceOpen = false;
            this.traceKept.forEach(({ path }) => path.dispose());
            this.traceKept = [];
        }
        if (this.traceView !== this.C.viewEpoch) {
            this.traceView = this.C.viewEpoch;
            this.traceKept.forEach(({ path, segs }) =>
                path.att("d", this.traceD(segs)),
            );
            if (this.traceData) {
                this.traceData = this.traceD(this.traceSegs);
                this.tracePath?.att("d", this.traceData);
            }
            this.traceOpen = false;
        }
        if (!this.defined || !this.projectionDefined) {
            this.traceFrom = null;
            this.traceOpen = false;
            this.traceBreak = false;
            return;
        }
        const from = this.traceFrom;
        this.traceFrom = this.coords;
        if (!moved) return;
        if (this.traceDots && this.tracePath) {
            this.traceSegs.push([this.coords]);
            this.traceData += `M${this.sx} ${this.sy}h0`;
            this.tracePath.att("d", this.traceData);
        } else if (this.tracePath && from && !this.traceBreak) {
            const [x, y] = this.C.pt3D(from);
            if (this.traceOpen) {
                this.traceSegs[this.traceSegs.length - 1].push(this.coords);
                this.traceData += ` L${this.sx} ${this.sy}`;
            } else if (x !== this.sx || y !== this.sy) {
                this.traceSegs.push([from, this.coords]);
                this.traceData += `M${x} ${y} L${this.sx} ${this.sy}`;
                this.traceOpen = true;
            }
            this.tracePath.att("d", this.traceData);
        } else if (this.traceBreak) {
            this.traceOpen = false;
        }
        this.traceBreak = false;
    }

    private traceD(segs: Vec3[][]): string {
        let d = "";
        for (const seg of segs) {
            let open = false;
            for (const p of seg) {
                const [x, y] = this.C.pt3D(p);
                if (!vIsFinite([x, y])) open = false;
                else {
                    d += this.traceDots
                        ? `M${x} ${y}h0`
                        : `${open ? " L" : "M"}${x} ${y}`;
                    open = true;
                }
            }
        }
        return d;
    }

    removeSVG(): void {
        super.removeSVG();
        this.tracePath?.dispose();
        this.tracePath = undefined;
        this.traceKept.forEach(({ path }) => path.dispose());
        this.traceKept = [];
        this.traceData = "";
        this.traceSegs = [];
        this.traceOpen = false;
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as point_object;
        const p = t.prefs.point.shape;
        const s1 = t.size;
        const s2 = 2 * s1;

        const dom = t.svg
            .shape("g")
            .att("transform", `translate(${t.sx} ${t.sy})`)
            .stl("pointer-events", "none")
            .drag(
                (event) => {
                    t.mousedrag(event);
                    t.C.gesture(t, "drag");
                },
                () => t.C.gesture(t, "down"),
                () => t.C.gesture(t, "up"),
            );

        if (t.tracePath) {
            if (t.traceData)
                t.traceKept.push({ path: t.tracePath, segs: t.traceSegs });
            else t.tracePath.dispose();
            t.tracePath = undefined;
            t.traceData = "";
            t.traceSegs = [];
            t.traceOpen = false;
        }
        if (t.trace) {
            t.tracePath = t.svg
                .shape("path")
                .att("data-trace", t.name)
                .stl("fill", "none")
                .stl("stroke", t.stroke_color)
                .stl(
                    "stroke-width",
                    t.traceDots ? 2 * t.size + t.border : t.size,
                )
                .stl("stroke-linecap", "round")
                .stl("pointer-events", "none");
            t.C.traceLayer.add(t.tracePath);
        }

        dom.add(
            t.svg
                .shape("circle")
                .att("r", t.prefs[t.type].touchsize)
                .att("cx", 0)
                .att("cy", 0)
                .stl(
                    `fill:transparent;stroke:none;pointer-events:${t.moveable && !t.locked ? "all" : "none"};cursor:pointer`,
                ),
        );

        const fillColor = t.hollow
            ? "none"
            : t.opacity
              ? t.fill_color
              : t.auto_fill_color;
        const fillOpacity = t.opacity ? t.opacity : 1;

        switch (t.shape) {
            case p.rect:
                dom.add(
                    t.svg
                        .shape(p.rect)
                        .att("width", s2)
                        .att("height", s2)
                        .att("x", -s1)
                        .att("y", -s1)
                        .stl("fill", fillColor)
                        .stl("fill-opacity", fillOpacity)
                        .stl("stroke", t.stroke_color)
                        .stl("stroke-width", t.border)
                        .stl("cursor:pointer"),
                );
                break;
            case p.circle:
                dom.add(
                    t.svg
                        .shape(p.circle)
                        .att("r", s1)
                        .att("cx", 0)
                        .att("cy", 0)
                        .stl("fill", fillColor)
                        .stl("fill-opacity", fillOpacity)
                        .stl("stroke", t.stroke_color)
                        .stl("stroke-width", t.border)
                        .stl("cursor:pointer"),
                );
                break;
            case p.cross: {
                dom.add(
                    t.svg
                        .shape("rect")
                        .att("width", s2)
                        .att("height", s2)
                        .att("x", -s1)
                        .att("y", -s1)
                        .stl(
                            "stroke-width:0;cursor:pointer;fill:rgba(255,255,255,0)",
                        ),
                );
                let d = `M${-s1} ${-s1}`;
                d += ` L${s1} ${s1}`;
                d += ` M${-s1} ${s1}`;
                d += ` L${s1} ${-s1}`;
                dom.add(
                    t.svg
                        .shape("path")
                        .att("d", d)
                        .stl("stroke", t.stroke_color)
                        .stl("stroke-width", 2 * t.border)
                        .stl("cursor:pointer"),
                );
                break;
            }
            case p.diamond: {
                let d = `M0 ${-s1}`;
                d += ` L${s1} 0`;
                d += ` L0 ${s1}`;
                d += ` L${-s1} 0`;
                d += " Z";
                dom.add(
                    t.svg
                        .shape("path")
                        .att("d", d)
                        .stl("fill", fillColor)
                        .stl("fill-opacity", fillOpacity)
                        .stl("stroke", t.stroke_color)
                        .stl("stroke-width", t.border)
                        .stl("cursor:pointer"),
                );
                break;
            }
        }

        // A script may hide it again (see setShowName).
        t.nameText = undefined;
        if (t.showName) {
            t.nameText = writeName(
                t.svg
                    .shape("text")
                    .att("x", s2)
                    .att("y", t.fontSize / 2)
                    .stl(
                        `fill:${t.stroke_color};font-family:Verdana;font-size:${t.fontSize}px;pointer-events:none`,
                    ),
                t.caption ?? t.name,
            );
            dom.add(t.nameText);
        }

        return dom;
    }
}

export function createPoint(
    c: construction,
    name: string | null | undefined,
    pt: Vec3,
): point_object {
    return c.add(new point_object(c, name, pt));
}
