import type { construction_object } from "./objects/construction_object";

export class objects_collector {
    // All construction objects, in construction order :
    V: construction_object[] = [];
    // Associative objects array (O[name] = <object>) :
    O: Record<string, construction_object> = {};
    // Objects with at least one dirty flag, processed by update() :
    private dirty = new Set<construction_object>();
    private nextSequence = 0;

    add<T extends construction_object>(o: T): T {
        o.sequence = this.nextSequence++;
        this.V.push(o);
        this.O[o.name] = o;
        return o;
    }

    remove(objects: ReadonlySet<construction_object>): void {
        this.V = this.V.filter((object) => !objects.has(object));
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
        while (descendants.length) {
            const object = descendants.pop()!;
            if (object.geometryDirty) continue;
            object.geometryDirty = true;
            object.projectionDirty = true;
            object.renderDirty = true;
            this.dirty.add(object);
            descendants.push(...object.children);
        }
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
        // Sorted by construction order so a parent is always recomputed
        // before the children marked dirty alongside it.
        const objects = [...this.dirty].sort((a, b) => a.sequence - b.sequence);
        this.dirty.clear();
        objects.forEach((object) => {
            if (object.geometryDirty) {
                object.computeGeometry();
                object.geometryDirty = false;
            }
            if (object.projectionDirty) {
                object.project();
                object.projectionDirty = false;
            }
            if (object.renderDirty) {
                if (object.hasView) object.render();
                object.renderDirty = false;
            }
        });
    }
}
