import type { construction } from "../construction";
import type { DgoContext } from "./construction_object";
import { point_object } from "./point_object";
import { polygon_object } from "./polygon_object";

// The regular polygon of n sides on [AB], counterclockwise: its other
// vertices are its own.
export class regular_polygon_object extends polygon_object {
    sides: number;

    constructor(
        c: construction,
        name: string | null | undefined,
        a: point_object,
        b: point_object,
        sides: number,
    ) {
        super(c, name, [
            a,
            b,
            ...Array.from(
                { length: sides - 2 },
                () => new point_object(c, null, [0, 0, 0]),
            ),
        ]);
        this.sides = sides;
    }

    dgo(context: DgoContext): [string, unknown] {
        return [
            "RegP",
            [...this.points.slice(0, 2).map(context.index), this.sides],
        ];
    }

    computeGeometry(): void {
        const [a, b, ...others] = this.points;
        const [ax, ay, az] = a.coords;
        const [dx, dy] = [b.x - ax, b.y - ay];
        const n = this.sides;
        // The k-th vertex, A turned and scaled from B around A.
        others.forEach((vertex, index) => {
            const k = index + 2;
            const scale = Math.sin((k * Math.PI) / n) / Math.sin(Math.PI / n);
            const angle = ((k - 1) * Math.PI) / n;
            const [cos, sin] = [Math.cos(angle), Math.sin(angle)].map(
                (value) => scale * value,
            );
            vertex.coords = [
                ax + cos * dx - sin * dy,
                ay + sin * dx + cos * dy,
                az,
            ];
            vertex.computeGeometry();
        });
        super.computeGeometry();
    }

    project(): void {
        this.points.slice(2).forEach((vertex) => vertex.project());
        super.project();
    }
}

export function createRegularPolygon(
    c: construction,
    name: string | null | undefined,
    a: point_object,
    b: point_object,
    sides: number,
): regular_polygon_object {
    return c.add(new regular_polygon_object(c, name, a, b, sides));
}
