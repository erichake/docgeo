import type { Animation } from "../animation";
import { $, type DOMElement } from "../dom";
import type { construction_object } from "../objects/construction_object";
import { expression_object } from "../objects/expression_object";
import { point_on_object } from "../objects/point_on_object";
import { polygon_object } from "../objects/polygon_object";
import { primitive_circle_object } from "../objects/primitive_circle_object";
import { primitive_line_object } from "../objects/primitive_line_object";
import { primitive_quadric_object } from "../objects/primitive_quadric_object";
import { vAdd, vDot, vNorm, vScale, vSub, type Vec2 } from "../vec";

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
// Along a polygon, and a conic, which DGPad doesn't animate.
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

// A slider's, in fiftieths of its range per second; across it, back and
// forth.
const PERCENTS = [0, 1, 2, 3, 5, 10, 25, 50, 75, 90, 100];
const SLIDER: Scale = {
    stops: PERCENTS,
    gap: 500 / PERCENTS.length,
    per: 1,
    shown: 1,
    unit: "%",
    bounces: true,
};

// Within the first stop, every stop being at least 30 px long (more than
// DGPad's on circles and polygons): no speed, and the ball clear of the point.
const REST = 28;

function scaleOf(object: springy_object): Scale {
    if (object instanceof expression_object) return SLIDER;
    const { support } = object;
    if (support instanceof primitive_line_object) return LINE;
    if (support instanceof primitive_circle_object) return CIRCLE;
    if (
        support instanceof polygon_object ||
        support instanceof primitive_quadric_object
    )
        return POLYGON;
    return LOCUS;
}

export type springy_object = point_on_object | expression_object;

// The points and sliders the engine animates.
export const springy = (
    object: construction_object | null | undefined,
): object is springy_object =>
    (object instanceof point_on_object &&
        (object.support instanceof primitive_line_object ||
            object.support instanceof primitive_circle_object ||
            object.support instanceof polygon_object ||
            object.support instanceof primitive_quadric_object ||
            object.support.familytype === "locus")) ||
    (object instanceof expression_object &&
        object.isCursor &&
        !object.formula &&
        !object.program);

// The slider's knob, the only circle it draws.
const knobOf = (slider: expression_object) =>
    slider.dom.dom().querySelector("circle")!;

// Where the spring is tied: the point, or the slider's knob.
export function anchorOf(object: springy_object): Vec2 {
    if (object instanceof point_on_object) return [object.sx, object.sy];
    const knob = knobOf(object).getBoundingClientRect();
    const box = object.C.svg.dom().getBoundingClientRect();
    return [
        knob.left + knob.width / 2 - box.left,
        knob.top + knob.height / 2 - box.top,
    ];
}

// The object's ghost, ahead of it: the point's parameter or the slider's
// value, and its own animation.
export interface Ghost {
    at: point_on_object["alpha"];
    animation: Animation;
}

export const ghostAt = (object: springy_object): Ghost["at"] =>
    object instanceof point_on_object ? object.alpha : (object.value as number);

// The ghost's drawing, a clone of the point's, or of the slider's knob
// about its centre.
export function ghostDrawing(object: springy_object): DOMElement {
    if (object instanceof point_on_object)
        return $(object.dom.dom().cloneNode(true) as Element);
    return $(knobOf(object).cloneNode() as Element)
        .att("cx", 0)
        .att("cy", 0);
}

// Moves the ghost on for these seconds and gives its place on the screen,
// the object lending itself to the engine's step.
export function moveGhost(
    object: springy_object,
    ghost: Ghost,
    seconds: number,
): Vec2 {
    if (object instanceof expression_object) {
        const { value, animation, min, max, cursorLength } = object;
        object.value = ghost.at as number;
        object.animation = ghost.animation;
        object.animate(seconds);
        ghost.at = object.value as number;
        object.value = value;
        object.animation = animation;
        const along = (value: number) =>
            Math.min(Math.max((value - min!) / (max! - min!), 0), 1);
        return vAdd(
            anchorOf(object),
            vScale(
                forwardOf(object),
                cursorLength * (along(ghost.at) - along(value as number)),
            ),
        );
    }
    const point = object;
    const { alpha, animation, C: c } = point;
    point.alpha = ghost.at;
    point.animation = ghost.animation;
    point.computeGeometry();
    point.animate(seconds);
    point.computeGeometry();
    ghost.at = point.alpha;
    const screen = c.pt3D(point.coords);
    point.alpha = alpha;
    point.animation = animation;
    point.computeGeometry();
    return screen;
}

// The way the object goes on the screen when animated forwards: a slider's
// own, a point's the engine's step, as small as the screen still shows it.
function forwardOf(point: springy_object): Vec2 {
    if (point instanceof expression_object)
        return point.vertical ? [0, -1] : [1, 0];
    const from = point.C.pt3D(point.coords);
    let way: Vec2 = [0, 0];
    for (let speed = 1e-4; speed < 10 && !(vNorm(way) > 1e-9); speed *= 10) {
        const ghost = {
            at: point.alpha,
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

export function springOf(object: springy_object): Spring {
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
    object: springy_object,
    animation: Animation,
): void {
    if (object.animation) object.animation = animation;
    else object.C.animations.add(object, animation);
}
