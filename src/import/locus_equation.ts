import type { algebraic_object } from "../objects/algebraic_object";
import type { construction_object } from "../objects/construction_object";
import { rational } from "./cas_formula";

// The equation of a locus or of an envelope (see CAS.md, step 8), as
// GeoGebra finds it (Botana's method): what depends on the driver M becomes
// polynomial equations of Giac's variables, from which Giac eliminates all
// but x and y. The rest of the figure is written by its coordinates,
// rounded to 6 digits. Over the complex numbers, an intersection gives all
// its points, a curve all its branches.

type Point = [string, string];
// A point, a line by a point and its direction, or a circle by its center
// and its squared radius.
type Shape = Point | { p: Point; d: Point } | { c: Point; r: string };

const UNREAD = new Error("Not an algebraic construction");

const number = (value: number): string => {
    if (!Number.isFinite(value)) throw UNREAD;
    return rational(+value.toPrecision(6));
};
const plus = (a: Point, b: Point, k = "1"): Point => [
    `${a[0]}+${k}*(${b[0]})`,
    `${a[1]}+${k}*(${b[1]})`,
];
const minus = (a: Point, b: Point): Point => plus(a, b, "-1");
const half = (a: Point, b: Point): Point => [
    `(${a[0]}+${b[0]})/2`,
    `(${a[1]}+${b[1]})/2`,
];
const square = ([x, y]: Point): string => `(${x})^2+(${y})^2`;
const normal = ([x, y]: Point): Point => [`-(${y})`, x];

// The request, null for a construction this translation doesn't know.
export function locusRequest(curve: algebraic_object): string | null {
    const { target, driver } = curve;
    const shapes = new Map<construction_object, Shape>();
    const equations: string[] = [];
    const variables: string[] = [];
    const fresh = (): Point => {
        const k = variables.length;
        variables.push(`dv${k}`, `dv${k + 1}`);
        return [`dv${k}`, `dv${k + 1}`];
    };
    const parts = (object: construction_object) =>
        object.dgo({
            index: (o) => o as never,
            image: (url) => url,
            screen: (position) => position,
        }) as [string, construction_object[]];
    const shape = (object: construction_object): Shape => {
        const known = shapes.get(object);
        if (known) return known;
        const o = object as unknown as Record<string, never>;
        const coords = (v: number[]): Point => [number(v[0]), number(v[1])];
        if (o.VEC) return { p: coords(o.P1["coords"]), d: coords(o.VEC) };
        if (o.CENTER) return { c: coords(o.CENTER), r: `${number(o.R)}^2` };
        if (o.coords) return coords(o.coords);
        throw UNREAD;
    };
    const point = (object: construction_object): Point => {
        const s = shape(object);
        if (!Array.isArray(s)) throw UNREAD;
        return s;
    };
    const line = (object: construction_object) => {
        const s = shape(object);
        if (!("d" in s)) throw UNREAD;
        return s;
    };
    const circle = (object: construction_object) => {
        const s = shape(object);
        if (!("r" in s)) throw UNREAD;
        return s;
    };
    const on = (object: construction_object, [x, y]: Point) => {
        const s = shape(object);
        if (Array.isArray(s)) throw UNREAD;
        equations.push(
            "d" in s
                ? `(${x}-(${s.p[0]}))*(${s.d[1]})-(${y}-(${s.p[1]}))*(${s.d[0]})`
                : `${square(minus([x, y], s.c))}-${s.r}`,
        );
    };
    // The center of a circle through three points.
    const circumcenter = (a: Point, b: Point, c: Point): Point => {
        const o = fresh();
        const r = square(minus(o, a));
        equations.push(
            `${r}-(${square(minus(o, b))})`,
            `${r}-(${square(minus(o, c))})`,
        );
        return o;
    };
    // Its number (an angle, a ratio, a radius) reads no object that moves
    // with the driver.
    const fixed = (
        object: construction_object,
        ...read: (construction_object | null)[]
    ) => {
        if (
            object.parents.some(
                (parent) => !read.includes(parent) && shapes.has(parent),
            )
        )
            throw UNREAD;
    };
    // What a rotation or a dilation does to a vector, read from its image.
    const similarity = (
        object: construction_object,
        center: construction_object | null,
        source: construction_object,
    ): Point => {
        fixed(object, center, source);
        const at = (o: construction_object | null): number[] =>
            o ? (o as unknown as { coords: number[] }).coords : [0, 0];
        const [u0, u1] = [0, 1].map((i) => at(source)[i] - at(center)[i]);
        const [v0, v1] = [0, 1].map((i) => at(object)[i] - at(center)[i]);
        const n = u0 * u0 + u1 * u1;
        const [cos, sin] = [(u0 * v0 + u1 * v1) / n, (u0 * v1 - u1 * v0) / n];
        const o: Point = center ? point(center) : ["0", "0"];
        const [x, y] = minus(point(source), o);
        return plus(o, [
            `${number(cos)}*(${x})-${number(sin)}*(${y})`,
            `${number(sin)}*(${x})+${number(cos)}*(${y})`,
        ]);
    };

    const build = (object: construction_object): Shape => {
        const [tag, args] = parts(object);
        const [a, b, c, k] = args;
        const ends = () => (b ? [a, b] : parts(a)[1]).map(point);
        switch (tag) {
            case "On": {
                if (object !== driver) throw UNREAD;
                const m = fresh();
                on(a, m);
                return m;
            }
            case "Mid": {
                const [p, q] = ends();
                return half(p, q);
            }
            case "Sym":
                return minus(plus(point(a), point(a)), point(b));
            case "Ctr":
                return circle(a).c;
            case "Int": {
                const m = fresh();
                on(a, m);
                on(b, m);
                return m;
            }
            case "Refl": {
                const m = fresh();
                const { d } = line(a);
                on(a, half(m, point(b)));
                const [x, y] = minus(m, point(b));
                equations.push(`(${x})*(${d[0]})+(${y})*(${d[1]})`);
                return m;
            }
            case "TC": {
                const [p, q, r] = [a, b, c].map(point);
                const sum = plus(plus(p, q), r);
                const kind = k as unknown as number;
                if (kind === 2) return [`(${sum[0]})/3`, `(${sum[1]})/3`];
                if (kind < 3) throw UNREAD;
                const o = circumcenter(p, q, r);
                return kind === 3
                    ? o
                    : kind === 4
                      ? plus(sum, o, "-2")
                      : half(sum, plus(["0", "0"], o, "-1"));
            }
            case "Rot":
            case "Dil":
                return similarity(object, a, b);
            case "Line":
            case "Seg":
            case "Ray": {
                const [p, q] = ends();
                return { p, d: minus(q, p) };
            }
            case "Par":
                return { p: point(b), d: line(a).d };
            case "Perp":
                return { p: point(b), d: normal(line(a).d) };
            case "Med": {
                const [p, q] = ends();
                return { p: half(p, q), d: normal(minus(q, p)) };
            }
            case "Cir":
                return { c: point(a), r: square(minus(point(b), point(a))) };
            case "C1":
                fixed(object, a);
                return {
                    c: point(a),
                    r: `${number((object as unknown as { R: number }).R)}^2`,
                };
            case "C3":
                return { c: point(c), r: square(minus(point(a), point(b))) };
            case "C3p": {
                const [p, q, r] = [a, b, c].map(point);
                const o = circumcenter(p, q, r);
                return { c: o, r: square(minus(o, p)) };
            }
        }
        throw UNREAD;
    };

    try {
        if (curve.C.space) throw UNREAD;
        for (const object of [driver, ...curve.dependencyChain])
            shapes.set(object, build(object));
        const s = shape(target);
        if (Array.isArray(s)) equations.push(`x-(${s[0]})`, `y-(${s[1]})`);
        else {
            // An envelope: the line, and its contact with the next ones,
            // where the jacobian of the system vanishes.
            const { p, d } = line(target);
            equations.push(`(x-(${p[0]}))*(${d[1]})-(y-(${p[1]}))*(${d[0]})`);
            equations.push(
                `det(diff([${equations.join(",")}],[${variables.join(",")}]))`,
            );
        }
        // Each factor once, so that its sign changes across the curve.
        return `map(eliminate([${equations.join(",")}],[${variables.join(",")}]),p->normal(p/gcd(gcd(p,diff(p,x)),diff(p,y))))`;
    } catch (error) {
        if (error !== UNREAD) throw error;
        return null;
    }
}
