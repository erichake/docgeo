import { animations } from "./animation";
import { BACKGROUND_FITS } from "./background";
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
    viewDirection,
    type ProjectionFrame,
} from "./projection";
import { hideSheet, showSheet, type Archive, type DocCells } from "./sheet";
import { vAdd, vDot, vNormalize, vScale, type Vec2, type Vec3 } from "./vec";

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
    // After the border of two views was moved.
    viewsChanged?: () => void;
    // The editor's: a sheet view shows the whole DocCells, and what the
    // user does in it (see sheet.ts).
    editor?: boolean;
    saveFigure?: () => void;
    sheetChanged?: () => void;
    // A cell's formula that closes a cycle with the figure.
    sheetCycle?: (ref: string) => void;
    // DocCells ready, its bars to be drawn in the editor's; the sheet view
    // made the active one.
    sheetReady?: (cells: DocCells) => void;
    sheetActivated?: () => void;
}

// Left, top, width and height of a view, in fractions of the window's.
export type ViewRect = [number, number, number, number];
const VIEW_EVENTS = ["pointerdown", "pointermove", "wheel"] as const;
// The narrowest a view gets by moving its border, in pixels.
const NARROWEST = 40;

// A view of the figure (see VUES.md): its column of the window, its
// coordinate system, and its SVG, where its objects are drawn.
export interface FigureView {
    grid: grid_object;
    svg: DOMElement;
    traceLayer: DOMElement;
    // Above every level, as DGPad's texts over its canvas.
    panelLayer: DOMElement;
    // Each level (see construction_object.level) and its type layers.
    levels: Map<number, { group: DOMElement; layers: Map<number, DOMElement> }>;
    // Its share of the window's width, relative to the other views', and
    // its part of the window.
    share: number;
    rect: ViewRect;
    width: number;
    height: number;
    measured: { pass: number; width: number; height: number };
    // A sheet view, which shows the figure's workbook (see sheet.ts).
    sheet?: boolean;
}

export class construction {
    static constructions: construction[] = [];

    dgpad: DgpadLike;
    prefs: Preferences;
    OBJS: objects_collector;
    views: FigureView[] = [];
    // The view whose coordinate system and SVG GRID, svg, width and height
    // give: that of the object computed, or of the pointer's gesture.
    view = 0;
    // The view last pressed, which the editor's settings change.
    active = 0;
    private typeLayers: number[] = [];
    // Between two views, the handles that move their border.
    private dividers: DOMElement[] = [];
    // As in GeoGebra, an edge shared by segments and polygons is painted
    // by the segments last, rather than in construction order as in DGPad
    // (see edgeStroke).
    segmentsOverPolygons = false;
    // DGPad's degree mode (see FormulaView).
    degrees = false;
    // Bumped by a pan or a zoom of a plane figure, which erase the traces
    // as in DGPad. GeoGebra's 3D view keeps them in space.
    traceEpoch = 0;
    // Bumped by each change of the view, for traces drawn again from
    // their positions in space.
    viewEpoch = 0;
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
    // The DocCells archive of its sheet view's workbook, as read.
    workbook: Archive | null = null;
    animations: animations;
    // The objects each gesture was made on since the last update, an
    // animation dragging them, as in DGPad.
    readonly gestures: Record<Gesture, Set<construction_object>> = {
        drag: new Set(),
        down: new Set(),
        up: new Set(),
    };
    private updateFrame: number | null = null;
    // Shown, rather than computed only (see workbook.ts).
    private revealed = false;
    private batchedObjects: construction_object[] | null = null;
    // The object each view of a layer shows.
    private viewObjects = new WeakMap<Element, construction_object>();
    private planeBasis = {
        phi: NaN,
        theta: NaN,
        basis: [] as unknown as [Vec3, Vec3],
    };
    private keydownListener: EventListener;
    private viewListeners: EventListener[];

    private constructor(dgpad: DgpadLike) {
        this.dgpad = dgpad;
        this.prefs = dgpad.prefs;
        // All construction objects :
        this.OBJS = new objects_collector(this);
        this.animations = new animations(this);
        const layers = new Set<number>();
        Object.values(this.prefs).forEach((pref) => {
            if ("layer" in pref) layers.add(pref.layer);
        });
        layers.delete(this.prefs.panel.layer);
        this.typeLayers = [...layers].sort((a, b) => a - b);
        this.addView();
        this.keydownListener = $("body").on(
            "keydown",
            (event) => this.keydown(event),
            false,
        );
        this.viewListeners = VIEW_EVENTS.map((type) =>
            $(document.documentElement).on(type, this.enterView, {
                capture: true,
                passive: true,
            }),
        );
    }

    // The view under the pointer becomes the current one before anything
    // answers it, the one pressed for a whole gesture.
    private enterView = (event: Event): void => {
        if ((event as PointerEvent).buttons && event.type === "pointermove")
            return;
        const index = this.views.findIndex(({ svg }) =>
            svg.dom().contains(event.target as Node),
        );
        if (index < 0) return;
        this.view = index;
        if (event.type === "pointerdown") this.active = index;
    };

    get GRID(): grid_object {
        return this.views[this.view].grid;
    }

    // The grid of the first 3D view, which GeoGebra's scripts turn.
    get spaceGrid(): grid_object | undefined {
        // Not yet given while its grid is made.
        return this.views.find(({ grid }) => grid?.is2D === false)?.grid;
    }

    // Points in space rather than in the plane: a view is 3D (see VUES.md).
    get space(): boolean {
        return this.spaceGrid !== undefined;
    }

    get svg(): DOMElement {
        return this.views[this.view].svg;
    }

    get traceLayer(): DOMElement {
        return this.views[this.view].traceLayer;
    }

    // The window's size, all views together.
    get windowSize(): Vec2 {
        const [, , w, h] = this.views[0].rect;
        return this.inView(0, () => [this.width / w, this.height / h]);
    }

    // Computed in this view, then back in the current one.
    inView<T>(view: number, compute: () => T): T {
        const current = this.view;
        this.view = view;
        const result = compute();
        this.view = current;
        return result;
    }

    // A new view, a column at the right of the others, with its grid: its
    // index. Its share is relative to the other views' (see arrangeViews).
    addView(share = 1): number {
        const index = this.views.length;
        const svg = this.createSVG(index);
        const view: FigureView = {
            grid: null as unknown as grid_object,
            svg,
            traceLayer: svg
                .shape("g")
                .att("data-layer", "trace")
                .stl("pointer-events", "none"),
            panelLayer: svg
                .shape("g")
                .att("data-layer", this.prefs.panel.layer),
            levels: new Map(),
            share,
            rect: [0, 0, 1, 1],
            width: 0,
            height: 0,
            measured: { pass: -1, width: 0, height: 0 },
        };
        svg.add(view.panelLayer, view.traceLayer);
        this.views.push(view);
        this.arrangeViews();
        this.inView(index, () => {
            view.grid = createGrid(this);
            // Needs the grid assigned first: creating a real occluder
            // polygon triggers hidden-line's projectionFrame lookup.
            view.grid.initFloorOccluder();
            view.width = this.width;
            view.height = this.height;
        });
        return index;
    }

    // The views side by side, each a column as wide as its share of their
    // shares' sum, a line and a handle between two (but in a web page, see
    // fit.ts).
    arrangeViews(): void {
        const total = this.sharesTotal;
        const handles = this.fixedSize ? 0 : this.views.length - 1;
        while (this.dividers.length > handles) this.dividers.pop()!.dispose();
        while (this.dividers.length < handles)
            this.dividers.push(this.divider(this.dividers.length + 1));
        let x = 0;
        this.views.forEach((view, index) => {
            const width = view.share / total;
            view.rect = [x, 0, width, 1];
            view.svg
                .stl("left", `${x * 100}%`)
                .stl("top", "0")
                .stl("width", `${width * 100}%`)
                .stl("height", "100%")
                .stl("box-shadow", x ? "inset 1px 0 #c0c0c0" : "");
            this.dividers[index - 1]?.stl("left", `${x * 100}%`);
            x += width;
        });
        if (this.revealed) showSheet(this);
    }

    // Measured at once rather than by their observers, a 3D view keeping
    // its center (see resize), before what follows reads or sets it.
    measureViews(): void {
        this.views.forEach(({ svg }, index) =>
            this.resize(index, svg.width(), svg.height()),
        );
    }

    private get sharesTotal(): number {
        return this.views.reduce((sum, { share }) => sum + share, 0);
    }

    // The handle on the left border of view `index`: dragged, it moves the
    // border, what both views show staying where it is on the screen.
    private divider(index: number): DOMElement {
        const handle = $.create("div").stl(
            "position:absolute;top:0;height:100%;width:9px;margin-left:-4px;z-index:1;cursor:col-resize;touch-action:none",
        );
        $("body").add(handle);
        return handle.drag(
            (_, [dx]) => {
                const [left, right] = [
                    this.views[index - 1],
                    this.views[index],
                ];
                // In shares: of their sum, the window's width.
                const width = this.windowSize[0] / this.sharesTotal;
                const narrowest = NARROWEST / width;
                const moved = Math.max(
                    narrowest - left.share,
                    Math.min(right.share - narrowest, dx / width),
                );
                left.share += moved;
                right.share -= moved;
                const { grid } = right;
                grid.ORG = [grid.ORG[0] - moved * width, grid.ORG[1]];
                this.arrangeViews();
                this.invalidateProjection();
            },
            undefined,
            () => this.dgpad.viewsChanged?.(),
        );
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
        if (this.GRID.locked) return;
        if (this.GRID.is2D) return this.pan(ev, delta);
        const [dx, dy] = delta;
        const rt = this.GRID.RESTRICT_THETA;
        const rp = this.GRID.RESTRICT_PHI;
        this.GRID.turn(
            Math.max(
                Math.min(this.GRID.PHI + dx * this.GRID.STEP, rp[1]),
                rp[0],
            ),
            Math.max(
                Math.min(this.GRID.THETA + dy * this.GRID.STEP, rt[1]),
                rt[0],
            ),
        );
        this.invalidateProjection();
    }

    pan(_event: PointerEvent, [dx, dy]: PointerDelta): void {
        this.GRID.ORG = [
            this.GRID.ORG[0] + (this.GRID.lockOy ? 0 : dx),
            this.GRID.ORG[1] + (this.GRID.lockOx ? 0 : dy),
        ];
        if (this.GRID.is2D) this.traceEpoch++;
        this.invalidateProjection();
    }

    mousewheel(event: WheelEvent, from = this.svg.svgPoint(event)): void {
        if (this.GRID.locked) return;
        const delta =
            event.deltaY *
            (event.deltaMode === WheelEvent.DOM_DELTA_LINE
                ? 40
                : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
                  ? this.height
                  : 1);
        // Trackpad pinches arrive as Ctrl-wheel with much smaller deltas.
        this.zoom(Math.exp(-delta / (event.ctrlKey ? 100 : 2000)), from);
    }

    private zoom(factor: number, from: Vec2, to = from): void {
        const [ux, uy, uz] = this.GRID.UNIT;
        const scale = Math.min(Math.max(ux * factor, MIN_UNIT), MAX_UNIT) / ux;
        const [ox, oy] = this.GRID.ORG;
        const { centerZoom, lockOx, lockOy } = this.GRID;
        const x = centerZoom || lockOy ? ox : from[0];
        const y = centerZoom || lockOx ? oy : from[1];
        this.GRID.ORG = [
            x + (ox - x) * scale + (centerZoom || lockOy ? 0 : to[0] - from[0]),
            y + (oy - y) * scale + (centerZoom || lockOx ? 0 : to[1] - from[1]),
        ];
        this.GRID.UNIT = [ux * scale, uy * scale, uz * scale];
        if (this.GRID.is2D) this.traceEpoch++;
        this.invalidateProjection();
    }

    get isBatching(): boolean {
        return this.batchedObjects !== null;
    }

    add<T extends construction_object>(obj: T): T {
        const added = this.OBJS.add(obj);
        if (this.batchedObjects) this.batchedObjects.push(added);
        else {
            this.initializeObject(added);
            this.invalidateOthers([added]);
        }
        return added;
    }

    beginBatch(): void {
        this.batchedObjects = [];
    }

    endBatch(): void {
        const objects = this.batchedObjects!;
        this.batchedObjects = null;
        objects.forEach((object) => this.initializeObject(object));
        this.invalidateOthers(objects);
    }

    // Objects without a view still need their geometry and projection
    // computed once, since visible descendants may depend on them.
    private initializeObject(object: construction_object): void {
        if (object.isHidden) object.refresh();
        else object.createSVG();
    }

    // Drawn in that view from now on.
    // A view's column moved to another place among them, its objects
    // with it.
    moveView(from: number, to: number): void {
        const order = this.views.map((_, index) => index);
        order.splice(to, 0, ...order.splice(from, 1));
        const place = order.map((_, index) => order.indexOf(index));
        this.views = order.map((index) => this.views[index]);
        this.OBJS.V.forEach((object) => {
            object.view = place[object.view];
            if (object.alsoIn.length)
                this.alsoShow(
                    object,
                    object.alsoIn.map((view) => place[view]),
                );
        });
        this.view = place[this.view];
        this.active = place[this.active];
        this.arrangeViews();
        this.invalidateProjection();
    }

    moveToView(object: construction_object, view: number): void {
        if (object.view === view) return;
        object.view = view;
        object.alsoIn = object.alsoIn.filter((other) => other !== view);
        if (object.hasView) object.createSVG();
        this.invalidateGeometry(object);
    }

    // Drawn also in these other views, each by a twin (see VUES.md).
    alsoShow(object: construction_object, views: number[]): void {
        object.alsoIn = [...new Set(views)].filter(
            (view) => view !== object.view && view < this.views.length,
        );
        if (object.hasView) object.createSVG();
    }

    // Added, removed, shown or hidden: what depends on them without being built from them.
    // A polygon or a solid hides segments, a plane cuts faces and, as a
    // sphere, is drawn in part by the floor.
    invalidateOthers(objects: Iterable<construction_object>): void {
        const families = new Set(
            Array.from(objects, ({ familytype }) => familytype),
        );
        if (families.has("polygon") || families.has("solid"))
            this.invalidateProjection();
        else if (families.has("sphere")) this.invalidateRender(this.GRID);
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
            // Nor what it shows, which stays, shown from then on.
            descendants.push(
                ...descendant.children.filter(
                    (child) =>
                        !targets.includes(child) &&
                        child.condition !== descendant,
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
                if (!removed.has(child)) {
                    child.parents = child.parents.filter(
                        (parent) => !removed.has(parent),
                    );
                    if (child.condition === object) child.condition = null;
                }
            });
        });
        this.OBJS.remove(removed);
        removed.forEach((object) => {
            object.parents = [];
            object.children = [];
            object.removeSVG();
        });
        this.invalidateOthers(removed);
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
        this.views.forEach(({ svg }) => svg.dispose());
        this.dividers.forEach((divider) => divider.dispose());
        hideSheet(this);
        $("body").off("keydown", this.keydownListener);
        VIEW_EVENTS.forEach((type, n) =>
            $(document.documentElement).off(type, this.viewListeners[n], true),
        );
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
        this.viewEpoch++;
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

    resize(index: number, width: number, height: number): void {
        const view = this.views[index];
        if (width === view.width && height === view.height) return;
        // As in DGPad, its figures keep their origin where it was; another
        // 3D one, where it was from the window's center (see readDgo).
        const { grid } = view;
        if (!grid.is2D && !grid.FRAME2D)
            grid.ORG = [
                grid.ORG[0] + (width - view.width) / 2,
                grid.ORG[1] + (height - view.height) / 2,
            ];
        view.width = width;
        view.height = height;
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

    // The projection of the camera's current angles: the grid's is only
    // updated after geometry, where pinned and formula points read it.
    get cameraFrame(): ProjectionFrame {
        const { PHI, THETA } = this.GRID;
        const frame = {
            ...this.projectionFrame,
            cosPhi: Math.cos(PHI),
            sinPhi: Math.sin(PHI),
            cosTheta: Math.cos(THETA),
            sinTheta: Math.sin(THETA),
        };
        frame.dir = vNormalize(viewDirection(frame)) ?? frame.dir;
        return frame;
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
        const view = this.views[this.view];
        if (this.fixedSize) return this.fixedSize[0] * view.rect[2];
        return this.OBJS.updating
            ? this.passSize(view).width
            : view.svg.width();
    }

    get height(): number {
        const view = this.views[this.view];
        if (this.fixedSize) return this.fixedSize[1] * view.rect[3];
        return this.OBJS.updating
            ? this.passSize(view).height
            : view.svg.height();
    }

    // Measured once per update pass: at each object's render, between DOM
    // writes, the measure would force a layout each time.
    private passSize(view: FigureView): { width: number; height: number } {
        const size = view.measured;
        if (size.pass !== this.OBJS.pass) {
            size.width = view.svg.width();
            size.height = view.svg.height();
            size.pass = this.OBJS.pass;
        }
        return size;
    }

    // Its view, in its layer, among those of the objects before it in
    // construction order, whatever the moment it is shown at: DGPad paints
    // in that order. Restyled, just after the view it replaces.
    mountObject(obj: construction_object): void {
        const view = obj.dom.dom();
        const layer = this.layer(obj.level, obj.layer, obj.view).dom();
        let before = layer.lastElementChild;
        // The editor's marks, not objects, lie among the views.
        while (
            before &&
            (this.viewObjects.get(before)?.sequence ?? Infinity) > obj.sequence
        )
            before = before.previousElementSibling;
        if (before) before.after(view);
        else layer.prepend(view);
        this.viewObjects.set(view, obj);
        this.dgpad.mountObject?.(obj);
    }

    layer(level: number, layer: number, index = this.view): DOMElement {
        const { svg, panelLayer, levels } = this.views[index];
        if (layer === this.prefs.panel.layer) return panelLayer;
        let entry = levels.get(level);
        if (!entry) {
            const group = svg.shape("g").att("data-level", level);
            const layers = new Map(
                this.typeLayers.map((layer) => {
                    const child = svg.shape("g").att("data-layer", layer);
                    group.add(child);
                    return [layer, child];
                }),
            );
            const above = [...levels.keys()]
                .filter((other) => other > level)
                .sort((a, b) => a - b)[0];
            (above === undefined ? panelLayer : levels.get(above)!.group)
                .dom()
                .before(group.dom());
            entry = { group, layers };
            levels.set(level, entry);
        }
        return entry.layers.get(layer)!;
    }

    private createSVG(index: number): DOMElement {
        const svg = $.createSVG();
        this.bindSceneEvents(svg);
        $("body").add(
            svg
                .stl(
                    "position:absolute;border:0;user-select:none;-webkit-user-select:none",
                )
                // Until its figure is built (see reveal), rather than the
                // default scene, 3D floor included, flashing before it.
                .stl(
                    "visibility",
                    index
                        ? (this.views[0].svg.dom() as SVGElement).style
                              .visibility
                        : "hidden",
                )
                .stl("background", this.prefs.background.color)
                .att("xmlns", "http://www.w3.org/2000/svg"),
        );
        svg.observeResize((width, height) => {
            const index = this.views.findIndex((view) => view.svg === svg);
            if (!this.fixedSize && index >= 0)
                this.resize(index, width, height);
        });
        return svg;
    }

    // Each view's background: its color, else the figure's image, if any,
    // over its color.
    paintBackground(): void {
        const { color, image, fit } = this.prefs.background;
        const figure = image
            ? `url("${image}") ${BACKGROUND_FITS[fit]},${color}`
            : color;
        this.views.forEach(({ svg, grid }) =>
            svg.stl(
                "background",
                grid.backgroundImage
                    ? `url("${grid.backgroundImage}") ${BACKGROUND_FITS[grid.backgroundFit]},${grid.background ?? color}`
                    : (grid.background ?? figure),
            ),
        );
    }

    // Its traces start once it's shown, not with the moves of its opening.
    reveal(): void {
        this.traceEpoch++;
        this.views.forEach(({ svg, traceLayer, sheet }) => {
            traceLayer.findAll("path").forEach((path) => path.att("d", ""));
            // Under the sheet's frame (see sheet.ts).
            svg.stl("visibility", sheet ? "hidden" : "");
        });
        this.revealed = true;
        showSheet(this);
    }

    private bindSceneEvents(element: DOMElement): void {
        element
            .pinch(
                (scale, from, to) =>
                    this.GRID.locked ||
                    this.zoom(scale, from, this.panLocked ? from : to),
            )
            .drag(
                (event, delta) => this.pan(event, delta),
                (event) =>
                    !this.panLocked &&
                    !this.GRID.locked &&
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
