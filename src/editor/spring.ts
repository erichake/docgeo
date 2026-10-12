import type { Animation } from "../animation";
import type { construction_object } from "../objects/construction_object";
import { point_on_object } from "../objects/point_on_object";
import { polygon_object } from "../objects/polygon_object";
import { primitive_circle_object } from "../objects/primitive_circle_object";
import { primitive_line_object } from "../objects/primitive_line_object";
import { vDot, vNorm, vScale, vSub, type Vec2 } from "../vec";

// DGPad's spring: see EDITOR.md.

// DGPad's speeds, a stop every `gap` pixels along the spring, written in
// `per` times the engine's speed, shown `shown` times in `unit`; along a
// line, a pull across it goes back and forth.
interface Scale {
    stops: number[];
    gap: number;
    per: number;
    shown: number;
    unit: string;
    bounces: boolean;
}

const PIXELS = [0, 1, 5, 10, 25, 50, 100, 200, 300, 500, 800, 1000, 1500];
const LINE: Scale = {
    stops: PIXELS,
    gap: 400 / PIXELS.length,
    per: 1,
    shown: 1,
    unit: "px/s",
    bounces: true,
};
const DEGREES = [0, 1, 6, 10, 30, 45, 60, 70, 90, 180, 270, 360];
const CIRCLE: Scale = {
    stops: DEGREES,
    gap: 30,
    per: 180 / Math.PI,
    shown: 1,
    unit: "°/s",
    bounces: false,
};
const EDGES = [0, 20, 25, 50, 100, 200, 400, 500, 750, 1000, 1500];
const POLYGON: Scale = {
    stops: EDGES,
    gap: 30,
    per: 1,
    shown: 1,
    unit: "px/s",
    bounces: false,
};
const SAMPLES = [0, 20, 25, 50, 100, 200, 400, 500, 750, 1000];
const LOCUS: Scale = {
    stops: SAMPLES,
    gap: 30,
    per: 1,
    shown: 0.1,
    unit: "%",
    bounces: false,
};

// Within the first stop, every stop being at least 30 px long (more than
// DGPad's on circles and polygons): no speed, and the ball clear of the point.
const REST = 28;

function scaleOf({ support }: point_on_object): Scale {
    if (support instanceof primitive_line_object) return LINE;
    if (support instanceof primitive_circle_object) return CIRCLE;
    if (support instanceof polygon_object) return POLYGON;
    return LOCUS;
}

// The points the engine animates. Its sliders too, which the editor can't
// select yet.
export const springy = (
    object: construction_object | null | undefined,
): object is point_on_object =>
    object instanceof point_on_object &&
    (object.support instanceof primitive_line_object ||
        object.support instanceof primitive_circle_object ||
        object.support instanceof polygon_object ||
        object.support.familytype === "locus");

// The point's ghost, ahead of it on its path: its parameter, and its own
// animation.
export interface Ghost {
    alpha: point_on_object["alpha"];
    animation: Animation;
}

// Moves the ghost on for these seconds and gives its place on the screen,
// the point lending itself to the engine's step.
export function moveGhost(
    point: point_on_object,
    ghost: Ghost,
    seconds: number,
): Vec2 {
    const { alpha, animation, C: c } = point;
    point.alpha = ghost.alpha;
    point.animation = ghost.animation;
    point.animate(seconds);
    point.computeGeometry();
    ghost.alpha = point.alpha;
    const screen = c.pt3D(point.coords);
    point.alpha = alpha;
    point.animation = animation;
    point.computeGeometry();
    return screen;
}

// The way the point goes on the screen when animated forwards: the engine's
// own step, as small as the screen still shows it.
function forwardOf(point: point_on_object): Vec2 {
    const from = point.C.pt3D(point.coords);
    let way: Vec2 = [0, 0];
    for (let speed = 1e-4; speed < 10 && !(vNorm(way) > 1e-9); speed *= 10) {
        const ghost = {
            alpha: point.alpha,
            animation: { speed, direction: 1, ar: true },
        };
        // Bounced at an end, it went backwards.
        way = vScale(
            vSub(moveGhost(point, ghost, 1), from),
            ghost.animation.direction,
        );
    }
    const length = vNorm(way);
    return length > 1e-9 ? vScale(way, 1 / length) : [1, 0];
}

// A pull on the object's spring, measured from where it was taken.
export interface Spring {
    scale: Scale;
    forward: Vec2;
    // Across the way, below it on the screen.
    normal: Vec2;
}

export function springOf(object: point_on_object): Spring {
    const forward = forwardOf(object);
    const [x, y] = forward;
    const normal: Vec2 = y > 0 || (y === 0 && x < 0) ? [y, -x] : [-y, x];
    return { scale: scaleOf(object), forward, normal };
}

// As in DGPad: the length gives the speed; let go like an elastic, the
// point goes the other way; a pull across a line makes it go back and forth.
export function pull(
    { scale, forward }: Spring,
    vector: Vec2,
): { animation: Animation; label: string } {
    const { stops, gap, per, shown, unit, bounces } = scale;
    const length = vNorm(vector);
    const stop = stops[Math.min(Math.floor(length / gap), stops.length - 1)];
    const along = length ? vDot(vector, forward) / length : 0;
    const ar = bounces && stop > 0 && Math.abs(along) < Math.SQRT1_2;
    return {
        animation: { speed: stop / per, direction: along > 0 ? -1 : 1, ar },
        label: `${stop * shown} ${unit}${ar ? " ⇄" : ""}`,
    };
}

// Where the handle shows the object's animation: the middle of its stop,
// behind the point or across its way.
export function handleOf(
    { scale, forward, normal }: Spring,
    animation: Animation | null,
): Vec2 {
    if (!animation?.speed) return vScale(normal, REST);
    const { stops, gap, per } = scale;
    const speed = animation.speed * per;
    const index = stops.reduce(
        (best, stop, index) =>
            index && Math.abs(stop - speed) < Math.abs(stops[best] - speed)
                ? index
                : best,
        1,
    );
    const length = (index + 0.5) * gap;
    return animation.ar
        ? vScale(normal, length)
        : vScale(forward, -length * animation.direction);
}

// The engine keeps an animated object: a stopped one has no speed.
export function setAnimation(
    object: point_on_object,
    animation: Animation,
): void {
    if (object.animation) object.animation = animation;
    else object.C.animations.add(object, animation);
}
