import { $, type DOMElement, type PointerDelta } from "./dom";
import { construction_object } from "./objects/construction_object";
import { createGrid, grid_object } from "./objects/grid_object";
import { createIntersection } from "./objects/intersection_object";
import { createPoint } from "./objects/point_object";
import { createSegment } from "./objects/segment_object";
import { createLine } from "./objects/two_points_line_object";
import { objects_collector } from "./objects_collector";
import type { preferences, Preferences } from "./preferences";
import {
    projectPoint,
    unprojectPointToZPlane,
    type ProjectionFrame,
} from "./projection";
import type { Vec2, Vec3 } from "./vec";

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
    layers: Map<number, DOMElement>;
    private updateFrame: number | null = null;

    private constructor(dgpad: DgpadLike) {
        this.dgpad = dgpad;
        this.prefs = dgpad.prefs;
        // All construction objects :
        this.OBJS = new objects_collector();
        this.layers = new Map();
        this.createSVG();
        this.GRID = createGrid(this);
    }

    mouseclick(_ev: PointerEvent): void {
        const p1 = createPoint(this, null, [1, 1, 0]);
        const p2 = createPoint(this, null, [-2, 0, 0]);
        createSegment(this, null, p2, p1);
        const d1 = createLine(this, null, p2, p1);
        d1.hidden = 1;
        this.invalidateRender(d1);
        const p3 = createPoint(this, null, [5, 4, 0]);
        const p4 = createPoint(this, null, [1, -3, 0]);
        const d2 = createLine(this, null, p3, p4);
        const i1 = createIntersection(this, null, d1, d2);
        const p5 = createPoint(this, null, [0, -1, 0]);
        createSegment(this, null, i1, p5);
    }

    mousedrag(_ev: PointerEvent, [dx, dy]: PointerDelta): void {
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

    add<T extends construction_object>(obj: T): T {
        const added = this.OBJS.add(obj);
        added.createSVG();
        return added;
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

    // *************************************************
    // ********************* SVG PART **********************
    // *************************************************

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
        this.svg.observeResize((width, height) => this.resize(width, height));
    }

    private bindSceneEvents(element: DOMElement): void {
        element
            .drag((event, delta) => this.mousedrag(event, delta))
            .tap((event) => this.mouseclick(event));
    }

    private scheduleUpdate(): void {
        if (this.updateFrame !== null) return;
        this.updateFrame = requestAnimationFrame(() => {
            this.updateFrame = null;
            this.OBJS.update();
        });
    }
}
