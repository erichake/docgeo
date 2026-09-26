import type { construction_object } from "./objects/construction_object";
import { expression_object } from "./objects/expression_object";
import { grid_object } from "./objects/grid_object";
import { paintByDepth } from "./objects/hidden_line";
import { point_object } from "./objects/point_object";

export class objects_collector {
    // All construction objects, in construction order :
    V: construction_object[] = [];
    // Associative objects array (O[name] = <object>) :
    O: Record<string, construction_object> = {};
    // Polygons, tracked separately so segments can test occlusion against
    // them without scanning every object on each projection update :
    polygons: construction_object[] = [];
    // Spheres, whose part in front of the floor clips it, and whose part
    // behind it is drawn by it (see grid_object.renderFloor) :
    spheres: construction_object[] = [];
    private grid?: grid_object;
    // Objects with at least one dirty flag, processed by update() :
    private dirty = new Set<construction_object>();
    private nextSequence = 0;
    // Bumped on every update() pass, so per-frame caches (e.g. a polygon
    // spatial index) know when they need rebuilding :
    frame = 0;

    add<T extends construction_object>(o: T): T {
        o.sequence = this.nextSequence++;
        this.V.push(o);
        this.O[o.name] = o;
        if (o.familytype === "polygon") this.polygons.push(o);
        if (o.familytype === "sphere") this.spheres.push(o);
        if (o instanceof grid_object) this.grid = o;
        return o;
    }

    remove(objects: ReadonlySet<construction_object>): void {
        this.V = this.V.filter((object) => !objects.has(object));
        this.polygons = this.polygons.filter((object) => !objects.has(object));
        this.spheres = this.spheres.filter((object) => !objects.has(object));
        objects.forEach((object) => {
            delete this.O[object.name];
            this.dirty.delete(object);
        });
    }

    getObj(n: string): construction_object | undefined {
        return this.O[n];
    }

    markGeometryDirty(root: construction_object): void {
        const descendants = [root];
        let touchesPolygon = false;
        let touchesSphere = false;
        while (descendants.length) {
            const object = descendants.pop()!;
            if (object.geometryDirty) continue;
            object.geometryDirty = true;
            object.projectionDirty = true;
            object.renderDirty = true;
            this.dirty.add(object);
            if (object.familytype === "polygon") touchesPolygon = true;
            if (object.familytype === "sphere") touchesSphere = true;
            descendants.push(...object.children);
        }
        // A polygon that moved (even one outside a segment's own dependency
        // subtree above) can newly occlude, or stop occluding, that
        // segment's hidden-line dashing (see primitive_line_object's
        // updateHiddenSplit/hiddenIntervalsBetween): a spatial relationship
        // the construction DAG doesn't capture, unlike markProjectionDirty
        // below, which already (if bluntly) covers it by reprojecting
        // everything.
        if (touchesPolygon) this.markProjectionDirty();
        else if (touchesSphere) this.markRenderDirty(this.grid!);
    }

    markProjectionDirty(): void {
        this.V.forEach((object) => {
            object.projectionDirty = true;
            object.renderDirty = true;
            this.dirty.add(object);
        });
    }

    markRenderDirty(object: construction_object): void {
        object.renderDirty = true;
        this.dirty.add(object);
    }

    update(): void {
        this.frame++;
        // Sorted by construction order so a parent is always recomputed
        // before the children marked dirty alongside it. Each step runs to
        // completion over every dirty object before the next one starts
        // (rather than one object's full geometry+project+render before the
        // next object's): a line's project() can read a *descendant*
        // point's coords (e.g. an intersection lying on it) even though
        // that point is necessarily later in construction order and would
        // otherwise still hold last frame's position.
        const objects = [...this.dirty].sort((a, b) => a.sequence - b.sequence);
        this.dirty.clear();
        objects.forEach((object) => {
            if (object.geometryDirty) {
                object.computeGeometry();
                object.geometryDirty = false;
            }
        });
        // The grid (its projectionFrame's cached rotation trig) and points
        // (their screen position) project first, within this same step: a
        // line/segment's project() tests hidden-line occlusion against any
        // polygon that happens to be screen-near it (see
        // primitive_line_object.updateHiddenSplit), not just its own
        // construction parents, so — unlike the descendant-coords case
        // above — construction order alone doesn't guarantee a referenced
        // polygon's points already hold this frame's screen position (or
        // the grid its current rotation) by the time that happens. The
        // grid is normally first in construction order anyway (sequence 0),
        // but a point moved via an Expression/slider dirties only its own
        // dependency subtree (see markGeometryDirty), which never includes
        // the grid. Expressions follow, since they may read where points
        // are drawn, and their scripts may set other objects' visibility
        // or opacity.
        objects.forEach((object) => {
            if (
                object.projectionDirty &&
                (object instanceof point_object ||
                    object instanceof grid_object ||
                    object instanceof expression_object)
            ) {
                object.project();
                object.projectionDirty = false;
            }
        });
        let polygonsProjected = false;
        objects.forEach((object) => {
            if (object.projectionDirty) {
                object.project();
                object.projectionDirty = false;
                if (object.familytype === "polygon") polygonsProjected = true;
            }
        });
        objects.forEach((object) => {
            if (object.renderDirty) {
                if (object.hasView) object.render();
                object.renderDirty = false;
            }
        });
        if (polygonsProjected) paintByDepth(this.grid!.C);
    }
}
