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
    draw(): void {
        this.V.forEach((elt) => elt.draw());
    }
    compute(): void {
        this.V.forEach((elt) => elt.compute());
    }
}
