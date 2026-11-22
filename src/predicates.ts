import type { construction_object } from "./objects/construction_object";
import { vCross, vDot, vNorm, vSub, type Vec3 } from "./vec";

// GeoGebra's predicates, numerically: 1 or 0, null for objects of other
// kinds or undefined. Prove decides them in general (see
// locus_equation.ts). Read by their fields, to import no object class.
type Shape = {
    defined: boolean;
    coords?: Vec3;
    P1?: { coords: Vec3 };
    VEC?: Vec3;
    CENTER?: Vec3;
    R?: number;
    scriptValue(vec3: boolean): unknown;
};

const small = (value: number, scale: number) => Math.abs(value) <= 1e-9 * scale;
const sine = (u: Vec3, v: Vec3) =>
    small(vNorm(vCross(u, v)), vNorm(u) * vNorm(v));
const plane = ([x, y]: Vec3) => [x, y];
const det3 = ([a, b, c]: number[][]) =>
    a[0] * (b[1] * c[2] - b[2] * c[1]) -
    a[1] * (b[0] * c[2] - b[2] * c[0]) +
    a[2] * (b[0] * c[1] - b[1] * c[0]);

export function predicate(
    fn: string,
    objects: construction_object[],
): number | null {
    const shapes = objects as unknown as Shape[];
    if (shapes.some((shape) => !shape.defined)) return null;
    const kind = (shape: Shape) =>
        shape.coords && !shape.VEC
            ? "point"
            : shape.CENTER
              ? "circle"
              : shape.VEC
                ? "line"
                : "";
    const all = (wanted: string) =>
        shapes.every((shape) => kind(shape) === wanted);
    const points = () => shapes.map((shape) => shape.coords!);
    const directions = () => shapes.map((shape) => shape.VEC!);
    let result: boolean;
    switch (fn) {
        case "AreCollinear": {
            if (!all("point")) return null;
            const [a, b, c] = points();
            result = sine(vSub(b, a), vSub(c, a));
            break;
        }
        case "AreParallel":
        case "ArePerpendicular": {
            if (!all("line")) return null;
            const [d, e] = directions();
            result =
                fn === "AreParallel"
                    ? sine(d, e)
                    : small(vDot(d, e), vNorm(d) * vNorm(e));
            break;
        }
        case "AreConcyclic": {
            if (!all("point")) return null;
            // A circle or a line through them, as GeoGebra's.
            const [a, ...rest] = points();
            const rows = rest.map((p) => {
                const [x, y] = plane(vSub(p, a));
                return [x * x + y * y, x, y];
            });
            const scale = Math.max(...rows.map((row) => row[0]));
            result = small(det3(rows), scale * scale);
            break;
        }
        case "AreConcurrent": {
            if (!all("line")) return null;
            // Or parallel, as GeoGebra's.
            const origin = shapes[0].P1!.coords;
            const rows = shapes.map(({ P1, VEC }) => {
                const [x, y] = plane(vSub(P1!.coords, origin));
                const [dx, dy] = plane(VEC!);
                const n = Math.hypot(dx, dy);
                return [dy / n, -dx / n, (y * dx - x * dy) / n];
            });
            result = small(
                det3(rows),
                Math.max(...rows.map((row) => Math.abs(row[2]))),
            );
            break;
        }
        default: {
            // AreEqual: points, circles, lines, else the lengths of segments
            // or the values of numbers.
            const [a, b] = shapes;
            const wanted = kind(a);
            const [u, v] = shapes.map((shape) => shape.scriptValue(false));
            if (
                typeof u === "number" &&
                typeof v === "number" &&
                wanted !== "point" &&
                wanted !== "circle"
            )
                result = small(u - v, Math.abs(u) + Math.abs(v));
            else if (kind(b) !== wanted || !wanted) return null;
            else if (wanted === "point")
                result = small(
                    vNorm(vSub(a.coords!, b.coords!)),
                    vNorm(a.coords!) + vNorm(b.coords!),
                );
            else if (wanted === "circle")
                result =
                    small(vNorm(vSub(a.CENTER!, b.CENTER!)), a.R! + b.R!) &&
                    small(a.R! - b.R!, a.R! + b.R!);
            else {
                const w = vSub(b.P1!.coords, a.P1!.coords);
                result =
                    sine(a.VEC!, b.VEC!) &&
                    small(vNorm(vCross(w, a.VEC!)), vNorm(w) * vNorm(a.VEC!));
            }
        }
    }
    return +result;
}
