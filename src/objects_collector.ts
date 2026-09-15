import type { construction_object } from "./objects/construction_object";

export class objects_collector {
    // All construction objects, in construction order :
    V: construction_object[] = [];
    // Associative objects array (O[name] = <object>) :
    O: Record<string, construction_object> = {};

    add(o: construction_object): construction_object {
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

    markDirty(root: construction_object): void {
        const descendants = [root];
        while (descendants.length) {
            const object = descendants.pop()!;
            if (object.dirty) continue;
            object.dirty = true;
            descendants.push(...object.children);
        }
    }

    markAllDirty(): void {
        this.V.forEach((object) => {
            object.dirty = true;
        });
    }

    update(): void {
        this.V.forEach((object) => {
            if (!object.dirty) return;
            object.computeAndDraw();
            object.dirty = false;
        });
    }

    draw(): void {
        this.V.forEach((elt) => elt.draw());
    }
}
