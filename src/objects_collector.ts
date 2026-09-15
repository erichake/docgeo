import type { construction_object } from "./objects/construction_object";

export class objects_collector {
    // All construction objects, in construction order :
    V: construction_object[] = [];
    // Associative objects array (O[name] = <object>) :
    O: Record<string, construction_object> = {};

    add<T extends construction_object>(o: T): T {
        this.V.push(o);
        this.O[o.name] = o;
        return o;
    }

    remove(objects: ReadonlySet<construction_object>): void {
        this.V = this.V.filter((object) => !objects.has(object));
        objects.forEach((object) => delete this.O[object.name]);
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
            descendants.push(...object.children);
        }
    }

    markProjectionDirty(): void {
        this.V.forEach((object) => {
            object.projectionDirty = true;
            object.renderDirty = true;
        });
    }

    markRenderDirty(object: construction_object): void {
        object.renderDirty = true;
    }

    update(): void {
        this.V.forEach((object) => {
            if (object.geometryDirty) {
                object.computeGeometry();
                object.geometryDirty = false;
            }
            if (object.projectionDirty) {
                object.project();
                object.projectionDirty = false;
            }
            if (object.renderDirty) {
                object.render();
                object.renderDirty = false;
            }
        });
    }
}
