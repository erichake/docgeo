import type { construction_object } from "./objects/construction_object";

export class objects_collector {
    // All construction objects, in construction order :
    V: construction_object[] = [];
    // All construction objects, in draw order :
    D: construction_object[] = [];
    // Associative objects array (O[name] = <object>) :
    O: Record<string, construction_object> = {};

    add(o: construction_object): construction_object {
        this.V.push(o);
        this.D.push(o);
        this.O[o.name] = o;
        return o;
    }
    getObj(n: string): construction_object | undefined {
        return this.O[n];
    }
    loopD(cb: (o: construction_object) => void): void {
        this.D.forEach(cb);
    }
    drawSort(): void {
        this.D.sort((a, b) => a.layer - b.layer);
    }
    draw(): void {
        this.D.forEach((elt) => elt.draw());
    }
    compute(): void {
        this.V.forEach((elt) => elt.compute());
    }
}
