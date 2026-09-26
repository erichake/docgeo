import { $, type DOMElement, type PointerDelta } from "./dom";
import type { FormulaView } from "./import/dgp_formula";
import { construction_object } from "./objects/construction_object";
import { createGrid, grid_object } from "./objects/grid_object";
import { objects_collector } from "./objects_collector";
import type { preferences, Preferences } from "./preferences";
import {
    projectPoint,
    unprojectPointToZPlane,
    type ProjectionFrame,
} from "./projection";
import type { Vec2, Vec3 } from "./vec";

// Zoom bounds, in pixels per unit: beyond them, graduations would outgrow
// the precision of their labels.
const MIN_UNIT = 1e-3;
const MAX_UNIT = 1e8;

export interface DgpadLike {
    prefs: preferences;
}

export class construction {
    static constructions: construction[] = [];

    dgpad: DgpadLike;
    prefs: Preferences;
    OBJS: objects_collector;
    GRID!: grid_object;
    svg!: DOMElement;
    traceLayer!: DOMElement;
    layers: Map<number, DOMElement>;
    // As in GeoGebra, an edge shared by segments and polygons is painted
    // by the segments last, rather than in construction order as in DGPad
    // (see edgeStroke).
    segmentsOverPolygons = false;
    private updateFrame: number | null = null;
    private batchedObjects: construction_object[] | null = null;
    private viewportWidth = 0;
    private viewportHeight = 0;
    private keydownListener!: EventListener;

    private constructor(dgpad: DgpadLike) {
        this.dgpad = dgpad;
        this.prefs = dgpad.prefs;
        // All construction objects :
        this.OBJS = new objects_collector();
        this.layers = new Map();
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
        if (this.GRID.is2D) return;
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
            descendants.push(...descendant.children);
        }
        this.OBJS.V.forEach((object) => {
            object.parents = object.parents.filter(
                (parent) => !removed.has(parent),
            );
            object.children = object.children.filter(
                (child) => !removed.has(child),
            );
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
        const objects = new Set(this.OBJS.V);
        this.OBJS.remove(objects);
        objects.forEach((object) => {
            object.parents = [];
            object.children = [];
            object.removeSVG();
        });
        this.svg.dispose();
        $("body").off("keydown", this.keydownListener);
        this.layers.clear();
        construction.constructions.splice(
            construction.constructions.indexOf(this),
            1,
        );
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
        // As in DGPad, a plane figure keeps its origin where it was.
        if (!this.GRID.is2D) this.GRID.ORG = [width / 2, height / 2];
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
        };
    }

    get width(): number {
        return this.svg.width();
    }

    get height(): number {
        return this.svg.height();
    }

    mountObject(obj: construction_object): void {
        this.layers.get(obj.layer)!.add(obj.dom);
    }

    createSVG(): void {
        this.svg = $.createSVG();
        this.bindSceneEvents(this.svg);
        $("body").add(
            this.svg
                .stl("position:absolute;border:0")
                .stl("background", this.prefs.background.color)
                .att(
                    "width:100%;height:100%;x:0;y:0;xmlns:http://www.w3.org/2000/svg",
                ),
        );

        const layers = new Set<number>();
        Object.values(this.prefs).forEach((pref) => {
            if ("layer" in pref) layers.add(pref.layer);
        });
        [...layers]
            .sort((a, b) => a - b)
            .forEach((layer) => {
                const group = this.svg.shape("g").att("data-layer", layer);
                this.layers.set(layer, group);
                this.svg.add(group);
            });
        this.traceLayer = this.svg
            .shape("g")
            .att("data-layer", "trace")
            .stl("pointer-events", "none");
        this.svg.add(this.traceLayer);
        this.svg.observeResize((width, height) => this.resize(width, height));
    }

    private bindSceneEvents(element: DOMElement): void {
        element
            .drag(
                (event, delta) => this.pan(event, delta),
                (event) =>
                    event.pointerType === "mouse" &&
                    event.target === element.dom(),
            )
            .drag(
                (event, delta) => this.mousedrag(event, delta),
                undefined,
                undefined,
                2,
            )
            .tap((event) => this.mouseclick(event));
        element.on("wheel", (event) => this.mousewheel(event));
        this.keydownListener = $("body").on(
            "keydown",
            (event) => this.keydown(event),
            false,
        );
    }

    private scheduleUpdate(): void {
        if (this.updateFrame !== null) return;
        this.updateFrame = requestAnimationFrame(() => {
            this.updateFrame = null;
            this.OBJS.update();
        });
    }
}
