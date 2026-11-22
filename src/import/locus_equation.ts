import type { algebraic_object } from "../objects/algebraic_object";
import type { construction_object } from "../objects/construction_object";
import { rational } from "./cas_formula";

// The construction as polynomial equations of Giac's variables (Botana's
// method, GeoGebra's, see CAS.md, step 8), over the complex numbers, where
// an intersection gives all its points, a curve all its branches.
// - The equation of a locus or of an envelope: what depends on the driver
//   M, from which Giac eliminates all but x and y, the rest of the figure
//   written by its coordinates, rounded to 6 digits.
// - Prove: the whole construction of a predicate's objects, its free points
//   and the parameters of its points on objects staying symbols, which
//   only the figure's fixed points and exact numbers keep from being
//   general.

type Point = [string, string];
// A point, a line by a point and its direction, or a circle by its center
// and its squared radius.
type Shape = Point | { p: Point; d: Point } | { c: Point; r: string };
type Fields = Record<string, never>;

const UNREAD = new Error("Not an algebraic construction");

const number = (value: number): string => {
    if (!Number.isFinite(value)) throw UNREAD;
    return rational(+value.toPrecision(6));
};
// A fraction of small denominator, for Prove: a number rounded would make a
// statement false.
const exact = (value: number): string => {
    for (let q = 1; q <= 64; q++) {
        const p = Math.round(value * q);
        if (Math.abs(value - p / q) < 1e-9) return `(${p}/${q})`;
    }
    throw UNREAD;
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
const cross = (u: Point, v: Point) => `(${u[0]})*(${v[1]})-(${u[1]})*(${v[0]})`;
const dot = (u: Point, v: Point) => `(${u[0]})*(${v[0]})+(${u[1]})*(${v[1]})`;

// Whether the point is on the line or the circle, now.
const through = (object: construction_object, point: construction_object) => {
    const o = object as unknown as {
        CENTER?: number[];
        R: number;
        P1: { coords: number[] };
        VEC: number[];
    };
    const [x, y] = (point as unknown as { coords: number[] }).coords;
    const [a, b] = o.CENTER ?? o.P1.coords;
    const [u, v] = [x - a, y - b];
    const value = o.CENTER
        ? Math.hypot(u, v) - o.R
        : (u * o.VEC[1] - v * o.VEC[0]) / Math.hypot(o.VEC[0], o.VEC[1]);
    return Math.abs(value) < 1e-9 * (1 + Math.hypot(x, y));
};

function system(prove: boolean, driver?: construction_object) {
    const shapes = new Map<construction_object, Shape>();
    const equations: string[] = [];
    // Eliminated, or else kept: Prove's free points and parameters.
    const variables: string[] = [];
    const kept: string[] = [];
    let absolute = false;
    let origin: Point | undefined;
    const variable = (keep?: boolean) => {
        const name = `dv${variables.length + kept.length}`;
        (keep && prove ? kept : variables).push(name);
        return name;
    };
    const fresh = (keep?: boolean): Point => [variable(keep), variable(keep)];
    const scalar = (value: number) => (prove ? exact(value) : number(value));
    const parts = (object: construction_object) =>
        object.dgo({
            index: (o) => o as never,
            image: (url) => url,
            screen: (position) => position,
        }) as [string, construction_object[]];
    const shape = (object: construction_object): Shape => {
        const known = shapes.get(object);
        if (known) return known;
        if (prove) {
            const built = build(object);
            shapes.set(object, built);
            return built;
        }
        const o = object as unknown as Fields;
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
    // Its number (an angle, a ratio, a radius) reads nothing that moves: no
    // object moved by the driver, and for Prove, no object at all.
    const fixed = (
        object: construction_object,
        ...read: (construction_object | null)[]
    ) => {
        if (
            object.parents.some(
                (parent) =>
                    !read.includes(parent) && (prove || shapes.has(parent)),
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
            `${scalar(cos)}*(${x})-${scalar(sin)}*(${y})`,
            `${scalar(sin)}*(${x})+${scalar(cos)}*(${y})`,
        ]);
    };

    const build = (object: construction_object): Shape => {
        const [tag, args] = parts(object);
        const [a, b, c, k] = args;
        const ends = () => (b ? [a, b] : parts(a)[1]).map(point);
        switch (tag) {
            case "Pt": {
                if (!prove) break;
                const p = fresh(true);
                origin ??= p;
                return p;
            }
            case "Fix": {
                absolute = true;
                const [x, y] = (object as unknown as { coords: number[] })
                    .coords;
                return [scalar(x), scalar(y)];
            }
            // By a parameter, kept by Prove: its position in general.
            case "On": {
                if (!prove && object !== driver) throw UNREAD;
                const s = shape(a);
                const u = variable(true);
                if ("d" in s) return plus(s.p, s.d, u);
                const { c: center, r } = circle(a);
                const v = variable();
                equations.push(`${u}^2+${v}^2-(${r})`);
                return plus(center, [u, v]);
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
                const away = k as unknown as construction_object | undefined;
                const [s, t] = [a, b].map(shape);
                // The second point of a line and a circle, or of two circles,
                // through a point known.
                if (away && through(a, away) && through(b, away)) {
                    const p = point(away);
                    if ("d" in s !== "d" in t) {
                        const { d } = line("d" in s ? a : b);
                        const { c: o } = circle("d" in s ? b : a);
                        on("d" in s ? a : b, m);
                        equations.push(
                            `${dot(minus(m, p), d)}+2*(${dot(minus(p, o), d)})`,
                        );
                        return m;
                    }
                    if (!("d" in s)) {
                        const [o, q] = [a, b].map((x) => circle(x).c);
                        const d = minus(q, o);
                        equations.push(
                            cross(minus(half(m, p), o), d),
                            dot(minus(m, p), d),
                        );
                        return m;
                    }
                }
                on(a, m);
                on(b, m);
                return m;
            }
            case "Refl": {
                const m = fresh();
                const { d } = line(a);
                on(a, half(m, point(b)));
                equations.push(dot(minus(m, point(b)), d));
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
                    r: `${scalar((object as unknown as { R: number }).R)}^2`,
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
    return {
        shapes,
        equations,
        variables,
        kept,
        // Without fixed points, the first free one, which may be anywhere.
        origin: () => (absolute ? undefined : origin),
        build,
        tag: (object: construction_object) => parts(object)[0],
        shape,
        point,
        line,
        circle,
        variable,
    };
}

const attempt = (request: () => string): string | null => {
    try {
        return request();
    } catch (error) {
        if (error !== UNREAD) throw error;
        return null;
    }
};

// The request, null for a construction this translation doesn't know.
export function locusRequest(curve: algebraic_object): string | null {
    const { target, driver } = curve;
    return attempt(() => {
        if (curve.C.space) throw UNREAD;
        const { shapes, equations, variables, build, shape, line } = system(
            false,
            driver,
        );
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
    });
}

// Prove(predicate): for each of its polynomials T, the construction's H and
// 1 - t T (Rabinowitsch), of which Giac eliminates all but the free
// variables: [1] or polynomials of them (degenerate cases) when T vanishes
// wherever H does, in general, [] when not.
export function proveRequest(
    fn: string,
    objects: construction_object[],
): string | null {
    return attempt(() => {
        if (objects[0].C.space) throw UNREAD;
        const s = system(true);
        const { point, line, circle } = s;
        const points = () => objects.map(point);
        const lines = () => objects.map(line);
        let theses: string[];
        switch (fn) {
            case "AreCollinear": {
                const [a, b, c] = points();
                theses = [cross(minus(b, a), minus(c, a))];
                break;
            }
            case "AreParallel":
            case "ArePerpendicular": {
                const [d, e] = lines().map((l) => l.d);
                theses = [fn === "AreParallel" ? cross(d, e) : dot(d, e)];
                break;
            }
            case "AreConcyclic": {
                const [a, ...rest] = points();
                const rows = rest.map((p) => {
                    const u = minus(p, a);
                    return `[${square(u)},${u[0]},${u[1]}]`;
                });
                theses = [`det([${rows.join(",")}])`];
                break;
            }
            case "AreConcurrent": {
                const rows = lines().map(
                    ({ p, d }) => `[${d[1]},-(${d[0]}),-(${cross(p, d)})]`,
                );
                theses = [`det([${rows.join(",")}])`];
                break;
            }
            default: {
                // AreEqual: points, circles, lengths of segments, lines.
                const [a] = objects.map(s.shape);
                if (Array.isArray(a)) {
                    const [p, q] = points();
                    theses = [0, 1].map((i) => `${p[i]}-(${q[i]})`);
                } else if ("r" in a) {
                    const [o, q] = objects.map(circle);
                    theses = [0, 1]
                        .map((i) => `${o.c[i]}-(${q.c[i]})`)
                        .concat(`${o.r}-(${q.r})`);
                } else {
                    const [l, m] = lines();
                    theses = objects.every((o) => s.tag(o) === "Seg")
                        ? [`${square(l.d)}-(${square(m.d)})`]
                        : [cross(l.d, m.d), cross(minus(m.p, l.p), l.d)];
                }
            }
        }
        // The first free point at the origin, which the statement doesn't
        // change, as GeoGebra does.
        const { equations, variables, kept } = s;
        const origin = s.origin();
        if (origin) {
            kept.splice(kept.indexOf(origin[0]), 2);
            variables.push(...origin);
            equations.push(...origin);
        }
        const t = s.variable();
        const all = variables.join(",");
        return `[${theses
            .map(
                (thesis) =>
                    `eliminate([${[...equations, `1-${t}*(${thesis})`].join(",")}],[${all}])`,
            )
            .join(",")}]`;
    });
}
