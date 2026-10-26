import { animations } from "./animation";
import { $, type DOMElement, type PointerDelta } from "./dom";
import type { FormulaView } from "./import/dgp_formula";
import type { Macro } from "./objects/macro_object";
import { construction_object } from "./objects/construction_object";
import { createGrid, grid_object } from "./objects/grid_object";
import { objects_collector } from "./objects_collector";
import type { preferences, Preferences } from "./preferences";
import {
    projectPoint,
    unprojectPointToZPlane,
    type ProjectionFrame,
} from "./projection";
import { vAdd, vDot, vScale, type Vec2, type Vec3 } from "./vec";

// Zoom bounds, in pixels per unit: beyond them, graduations would outgrow
// the precision of their labels.
const MIN_UNIT = 1e-3;
const MAX_UNIT = 1e8;

// While the page's body has this class, as in DGPad's properties mode,
// inert objects answer the pointer: their parts keep their own
// pointer-events otherwise overridden.
export const AWAKE = "docgeo-awake";
$("head").append(
    `<style>body:not(.${AWAKE}) [data-inert], body:not(.${AWAKE}) [data-inert] *:not([data-slider-knob]) { pointer-events: none !important; }</style>`,
);

// What the pointer does to an object, which its programs answer (see
// event_object.ts).
export type Gesture = "drag" | "down" | "up";

export interface DgpadLike {
    prefs: preferences;
    mountObject?: (object: construction_object) => void;
}

export class construction {
    static constructions: construction[] = [];

    dgpad: DgpadLike;
    prefs: Preferences;
    OBJS: objects_collector;
    GRID!: grid_object;
    svg!: DOMElement;
    traceLayer!: DOMElement;
    // Above every level, as DGPad's texts over its canvas.
    private panelLayer!: DOMElement;
    // Each level (see construction_object.level) and its type layers.
    private levels = new Map<
        number,
        { group: DOMElement; layers: Map<number, DOMElement> }
    >();
    private typeLayers: number[] = [];
    // As in GeoGebra, an edge shared by segments and polygons is painted
    // by the segments last, rather than in construction order as in DGPad
    // (see edgeStroke).
    segmentsOverPolygons = false;
    // DGPad's degree mode (see FormulaView).
    degrees = false;
    // Bumped by a pan or a zoom, which erase the traces as in DGPad.
    traceEpoch = 0;
    // Set by an embedded lock: dragging the 2D view with the left mouse
    // button or a finger no longer pans it.
    panLocked = false;
    // The window size the figure was saved with (DGO's view, DGPad's
    // SetCoords), when the file gives it.
    savedSize: Vec2 | null = null;
    // In a web page (index.html?fit, see fit.ts), the size of the region
    // shown, which the SVG scales to its window. Null: the window's.
    fixedSize: Vec2 | null = null;
    // The figure's macro-constructions, applied or not (see DGO.md).
    macros: Macro[] = [];
    animations: animations;
    // The objects each gesture was made on since the last update, an
    // animation dragging them, as in DGPad.
    readonly gestures: Record<Gesture, Set<construction_object>> = {
        drag: new Set(),
        down: new Set(),
        up: new Set(),
    };
    private updateFrame: number | null = null;
    private batchedObjects: construction_object[] | null = null;
    // The object each view of a layer shows.
    private viewObjects = new WeakMap<Element, construction_object>();
    private viewportWidth = 0;
    private viewportHeight = 0;
    private measuredSize = { pass: -1, width: 0, height: 0 };
    private planeBasis = {
        phi: NaN,
        theta: NaN,
        basis: [] as unknown as [Vec3, Vec3],
    };
    private keydownListener!: EventListener;

    private constructor(dgpad: DgpadLike) {
        this.dgpad = dgpad;
        this.prefs = dgpad.prefs;
        // All construction objects :
        this.OBJS = new objects_collector();
        this.animations = new animations(this);
        this.createSVG();
        this.GRID = createGrid(this);
        // Needs c.GRID assigned first: creating a real occluder polygon
        // triggers hidden-line's projectionFrame lookup (c.GRID.
        // projectionFrame), which would otherwise run before GRID exists.
        this.GRID.initFloorOccluder();
        this.viewportWidth = this.width;
        this.viewportHeight = this.height;
    }

    mouseclick(_ev: PointerEvent): void {}

    keydown(ev: KeyboardEvent): void {
        if (this.GRID.is2D || ev.metaKey || ev.ctrlKey) return;
        if (ev.key === "p" || ev.key === "P") {
            this.GRID.PERSPECTIVE = !this.GRID.PERSPECTIVE;
            this.invalidateProjection();
        } else if (ev.key === "s" || ev.key === "S") {
            this.GRID.SHOWFLOOR = !this.GRID.SHOWFLOOR;
            // Toggling the floor also toggles its occluder (see
            // grid_object.SHOWFLOOR), which other geometry's hidden-line
            // dashing depends on — not just the floor's own render.
            this.invalidateProjection();
        }
    }

    mousedrag(ev: PointerEvent, delta: PointerDelta): void {
        if (this.GRID.is2D) return this.pan(ev, delta);
        const [dx, dy] = delta;
        const rt = this.GRID.RESTRICT_THETA;
        const rp = this.GRID.RESTRICT_PHI;
        this.GRID.THETA = Math.max(
            Math.min(this.GRID.THETA + dy * this.GRID.STEP, rt[1]),
            rt[0],
        );
        this.GRID.PHI = Math.max(
            Math.min(this.GRID.PHI + dx * this.GRID.STEP, rp[1]),
            rp[0],
        );
        this.invalidateProjection();
    }

    pan(_event: PointerEvent, [dx, dy]: PointerDelta): void {
        this.GRID.ORG = [
            this.GRID.ORG[0] + (this.GRID.lockOy ? 0 : dx),
            this.GRID.ORG[1] + (this.GRID.lockOx ? 0 : dy),
        ];
        this.traceEpoch++;
        this.invalidateProjection();
    }

    mousewheel(event: WheelEvent): void {
        const delta =
            event.deltaY *
            (event.deltaMode === WheelEvent.DOM_DELTA_LINE
                ? 40
                : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
                  ? this.height
                  : 1);
        const [ux, uy, uz] = this.GRID.UNIT;
        const scale =
            Math.min(
                Math.max(ux * Math.exp(-delta / 2000), MIN_UNIT),
                MAX_UNIT,
            ) / ux;
        const [ox, oy] = this.GRID.ORG;
        const { centerZoom, lockOx, lockOy } = this.GRID;
        const [px, py] = this.svg.svgPoint(event);
        const x = centerZoom || lockOy ? ox : px;
        const y = centerZoom || lockOx ? oy : py;
        this.GRID.ORG = [x + (ox - x) * scale, y + (oy - y) * scale];
        this.GRID.UNIT = [ux * scale, uy * scale, uz * scale];
        this.traceEpoch++;
        this.invalidateProjection();
    }

    get isBatching(): boolean {
        return this.batchedObjects !== null;
    }

    add<T extends construction_object>(obj: T): T {
        const added = this.OBJS.add(obj);
        if (this.batchedObjects) this.batchedObjects.push(added);
        else this.initializeObject(added);
        return added;
    }

    beginBatch(): void {
        this.batchedObjects = [];
    }

    endBatch(): void {
        const objects = this.batchedObjects!;
        this.batchedObjects = null;
        objects.forEach((object) => this.initializeObject(object));
    }

    // Objects without a view still need their geometry and projection
    // computed once, since visible descendants may depend on them.
    private initializeObject(object: construction_object): void {
        if (object.isHidden) object.refresh();
        else object.createSVG();
    }

    removeObject(obj: construction_object): void {
        const removed = new Set<construction_object>();
        const descendants = [obj];
        while (descendants.length) {
            const descendant = descendants.pop()!;
            if (removed.has(descendant)) continue;
            removed.add(descendant);
            // But for what its program styles or sets, which stays: an
            // expression_object's, which this file can't import.
            const { program } = descendant as {
                program?: { targets: Map<string, construction_object> } | null;
            };
            const targets = [...(program?.targets.values() ?? [])];
            descendants.push(
                ...descendant.children.filter(
                    (child) => !targets.includes(child),
                ),
            );
        }
        // An application of a macro goes with its last final.
        removed.forEach((object) => {
            const node = object.output?.node;
            if (node?.children.every((final) => removed.has(final)))
                removed.add(node);
        });
        // Links are symmetric: the objects left need their links to the
        // removed ones trimmed.
        removed.forEach((object) => {
            object.parents.forEach((parent) => {
                if (!removed.has(parent))
                    parent.children = parent.children.filter(
                        (child) => !removed.has(child),
                    );
            });
            object.children.forEach((child) => {
                if (!removed.has(child))
                    child.parents = child.parents.filter(
                        (parent) => !removed.has(parent),
                    );
            });
        });
        this.OBJS.remove(removed);
        removed.forEach((object) => {
            object.parents = [];
            object.children = [];
            object.removeSVG();
        });
    }

    dispose(): void {
        if (this.updateFrame !== null) {
            cancelAnimationFrame(this.updateFrame);
            this.updateFrame = null;
        }
        this.animations.dispose();
        const objects = new Set(this.OBJS.V);
        this.OBJS.remove(objects);
        objects.forEach((object) => {
            object.parents = [];
            object.children = [];
            object.removeSVG();
        });
        this.svg.dispose();
        $("body").off("keydown", this.keydownListener);
        this.levels.clear();
        construction.constructions.splice(
            construction.constructions.indexOf(this),
            1,
        );
    }

    // Its programs for the gesture run at the next update.
    gesture(obj: construction_object, gesture: Gesture): void {
        this.gestures[gesture].add(obj);
        obj.children.forEach((child) => {
            if ((child as { gesture?: Gesture | null }).gesture === gesture)
                this.invalidateGeometry(child);
        });
    }

    invalidateGeometry(obj: construction_object): void {
        this.OBJS.markGeometryDirty(obj);
        this.scheduleUpdate();
    }

    invalidateProjection(): void {
        this.OBJS.V.forEach((object) => {
            if (object.readsView) this.OBJS.markGeometryDirty(object);
        });
        this.OBJS.markProjectionDirty();
        this.scheduleUpdate();
    }

    invalidateRender(obj: construction_object): void {
        this.OBJS.markRenderDirty(obj);
        this.scheduleUpdate();
    }

    pointerPosition(event: PointerEvent): Vec2 {
        return this.svg.svgPoint(event);
    }

    resize(width: number, height: number): void {
        if (width === this.viewportWidth && height === this.viewportHeight)
            return;
        this.viewportWidth = width;
        this.viewportHeight = height;
        // As in DGPad, its figures keep their origin where it was.
        if (!this.GRID.is2D && !this.GRID.FRAME2D)
            this.GRID.ORG = [width / 2, height / 2];
        this.invalidateProjection();
    }

    getObj(n: string): construction_object | undefined {
        return this.OBJS.getObj(n);
    }

    static create(dgpad: DgpadLike): construction {
        const c = new construction(dgpad);
        construction.constructions.push(c);
        return c;
    }

    // *************************************************
    // ********************* 3D PART **********************
    // *************************************************

    // _v représente les coordonnées mathématiques
    // renvoie un tableau à deux éléments : les coordonnées à l'écran
    pt3D(v: Vec3): Vec2 {
        return projectPoint(v, this.projectionFrame);
    }

    unprojectToZPlane(screen: Vec2, z: number): Vec3 | null {
        return unprojectPointToZPlane(screen, z, this.projectionFrame);
    }

    get projectionFrame(): ProjectionFrame {
        return this.GRID.projectionFrame;
    }

    // The screen plane's unit vectors towards the right and the top of the
    // screen (see GRID.FRAME2D). From the camera's angles rather than the
    // projection frame, which is only updated after geometry.
    // Read for each point's value: computed again only when the view turns.
    get screenPlaneBasis(): [Vec3, Vec3] {
        const { PHI, THETA } = this.GRID;
        const cached = this.planeBasis;
        if (cached.phi === PHI && cached.theta === THETA) return cached.basis;
        const [cosPhi, sinPhi] = [Math.cos(PHI), Math.sin(PHI)];
        const sinTheta = Math.sin(THETA);
        const basis: [Vec3, Vec3] = [
            [sinPhi, cosPhi, 0],
            [-cosPhi * sinTheta, sinPhi * sinTheta, Math.cos(THETA)],
        ];
        this.planeBasis = { phi: PHI, theta: THETA, basis };
        return basis;
    }

    screenPlanePoint([u, v]: Vec2): Vec3 {
        const [right, up] = this.screenPlaneBasis;
        const [u0, v0] = this.GRID.FRAME2D!;
        return vAdd(vScale(right, u - u0), vScale(up, v - v0));
    }

    screenPlaneCoords(point: Vec3): Vec2 {
        const [right, up] = this.screenPlaneBasis;
        const [u0, v0] = this.GRID.FRAME2D!;
        return [u0 + vDot(point, right), v0 + vDot(point, up)];
    }

    // *************************************************
    // ********************* SVG PART **********************
    // *************************************************

    formulaView(): FormulaView {
        return {
            unit: this.GRID.UNIT[0],
            origin: [this.GRID.ORG[0], this.GRID.ORG[1]],
            width: this.width,
            height: this.height,
            theta: this.GRID.THETA,
            phi: this.GRID.PHI,
            degrees: this.degrees,
        };
    }

    get width(): number {
        if (this.fixedSize) return this.fixedSize[0];
        return this.OBJS.updating ? this.passSize().width : this.svg.width();
    }

    get height(): number {
        if (this.fixedSize) return this.fixedSize[1];
        return this.OBJS.updating ? this.passSize().height : this.svg.height();
    }

    // Measured once per update pass: at each object's render, between DOM
    // writes, the measure would force a layout each time.
    private passSize(): { width: number; height: number } {
        const size = this.measuredSize;
        if (size.pass !== this.OBJS.pass) {
            size.width = this.svg.width();
            size.height = this.svg.height();
            size.pass = this.OBJS.pass;
        }
        return size;
    }

    // Its view, in its layer, among those of the objects before it in
    // construction order, whatever the moment it is shown at: DGPad paints
    // in that order. Restyled, just after the view it replaces.
    mountObject(obj: construction_object): void {
        const view = obj.dom.dom();
        const layer = this.layer(obj.level, obj.layer).dom();
        let before = layer.lastElementChild;
        while (before && this.viewObjects.get(before)!.sequence > obj.sequence)
            before = before.previousElementSibling;
        if (before) before.after(view);
        else layer.prepend(view);
        this.viewObjects.set(view, obj);
        this.dgpad.mountObject?.(obj);
    }

    layer(level: number, layer: number): DOMElement {
        if (layer === this.prefs.panel.layer) return this.panelLayer;
        let entry = this.levels.get(level);
        if (!entry) {
            const group = this.svg.shape("g").att("data-level", level);
            const layers = new Map(
                this.typeLayers.map((layer) => {
                    const child = this.svg.shape("g").att("data-layer", layer);
                    group.add(child);
                    return [layer, child];
                }),
            );
            const above = [...this.levels.keys()]
                .filter((other) => other > level)
                .sort((a, b) => a - b)[0];
            (above === undefined
                ? this.panelLayer
                : this.levels.get(above)!.group
            )
                .dom()
                .before(group.dom());
            entry = { group, layers };
            this.levels.set(level, entry);
        }
        return entry.layers.get(layer)!;
    }

    createSVG(): void {
        this.svg = $.createSVG();
        this.bindSceneEvents(this.svg);
        $("body").add(
            this.svg
                .stl(
                    "position:absolute;border:0;user-select:none;-webkit-user-select:none",
                )
                // Until its figure is built (see reveal), rather than the
                // default scene, 3D floor included, flashing before it.
                .stl("visibility", "hidden")
                .stl("background", this.prefs.background.color)
                .att(
                    "width:100%;height:100%;x:0;y:0;xmlns:http://www.w3.org/2000/svg",
                ),
        );

        const layers = new Set<number>();
        Object.values(this.prefs).forEach((pref) => {
            if ("layer" in pref) layers.add(pref.layer);
        });
        layers.delete(this.prefs.panel.layer);
        this.typeLayers = [...layers].sort((a, b) => a - b);
        this.panelLayer = this.svg
            .shape("g")
            .att("data-layer", this.prefs.panel.layer);
        this.svg.add(this.panelLayer);
        this.traceLayer = this.svg
            .shape("g")
            .att("data-layer", "trace")
            .stl("pointer-events", "none");
        this.svg.add(this.traceLayer);
        this.svg.observeResize((width, height) => {
            if (!this.fixedSize) this.resize(width, height);
        });
    }

    reveal(): void {
        this.svg.stl("visibility", "");
    }

    private bindSceneEvents(element: DOMElement): void {
        element
            .drag(
                (event, delta) => this.pan(event, delta),
                (event) =>
                    !this.panLocked &&
                    event.pointerType === "mouse" &&
                    event.target === element.dom(),
            )
            .drag(
                (event, delta) => this.mousedrag(event, delta),
                (event) =>
                    !(
                        this.panLocked &&
                        this.GRID.is2D &&
                        event.pointerType !== "mouse"
                    ),
                undefined,
                2,
            )
            .tap((event) => this.mouseclick(event));
        element.on(
            "wheel",
            (event) => {
                // In a web page, the wheel scrolls it: a pinch or Ctrl zooms.
                if (this.fixedSize && !event.ctrlKey) return;
                event.preventDefault();
                this.mousewheel(event);
            },
            false,
        );
        this.keydownListener = $("body").on(
            "keydown",
            (event) => this.keydown(event),
            false,
        );
    }

    // Brings the figure up to date now rather than at the next frame.
    flush(): void {
        if (this.updateFrame === null) return;
        cancelAnimationFrame(this.updateFrame);
        this.updateFrame = null;
        this.update();
    }

    private scheduleUpdate(): void {
        if (this.updateFrame !== null) return;
        this.updateFrame = requestAnimationFrame(() => {
            this.updateFrame = null;
            this.update();
        });
    }

    private update(): void {
        this.OBJS.update();
        Object.values(this.gestures).forEach((objects) => objects.clear());
    }
}
