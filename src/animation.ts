import type { construction } from "./construction";
import { $, type DOMElement } from "./dom";
import { t } from "./i18n";
import type { construction_object } from "./objects/construction_object";

// DGPad's animation of an object: at a `speed` its type defines (see its
// animate method), in a `direction` 1 or -1, back and forth (`ar`) or around.
export interface Animation {
    speed: number;
    direction: number;
    ar: boolean;
}

export interface animated_object extends construction_object {
    animation: Animation | null;
    // Moves the object along its animation for this many seconds.
    animate(seconds: number): void;
}

// DGPad's: beyond an end, back from it or around from the other.
export function advance(
    animation: Animation,
    value: number,
    low: number,
    high: number,
    step: number,
): number {
    value += step;
    if (value < low) {
        if (animation.ar) {
            animation.direction *= -1;
            value = 2 * low - value;
        } else value += high - low;
    }
    if (value > high) {
        if (animation.ar) {
            animation.direction *= -1;
            value = 2 * high - value;
        } else value -= high - low;
    }
    return Math.min(Math.max(value, low), high);
}

const icon = (shape: string) =>
    `<svg viewBox="0 0 50 50" width="50" height="50"><circle cx="25" cy="25" r="21" fill="none" stroke="#ccc" stroke-width="3.5"/>${shape}</svg>`;
const PAUSE = icon(
    `<path d="M21 16v18M29 16v18" stroke="#999" stroke-width="4.5"/>`,
);
const PLAY = icon(`<path d="M20 15l16 10-16 10z" fill="#999"/>`);

// As in DGPad, a figure's animations start with it, a button in the
// window's bottom left corner pausing and resuming them all.
export class animations {
    private readonly c: construction;
    private objects: animated_object[] = [];
    private isPaused = false;
    private frame: number | null = null;
    private time: number | null = null;
    private button: DOMElement | null = null;

    constructor(c: construction) {
        this.c = c;
    }

    get paused(): boolean {
        return this.isPaused;
    }

    set paused(paused: boolean) {
        this.isPaused = paused;
        this.show();
    }

    // DGPad ignores a zero speed.
    add(object: animated_object, animation: Animation): void {
        if (animation.speed === 0) return;
        if (!object.animation) this.objects.push(object);
        object.animation = animation;
        if (!this.button) {
            this.button = $.create("button").stl(
                "position:absolute;left:5px;bottom:5px;width:50px;height:50px;padding:0;border:0;background:none;cursor:pointer;z-index:9000",
            );
            this.button.on("pointerdown", () => (this.paused = !this.paused));
            $("body").add(this.button);
        }
        this.show();
    }

    dispose(): void {
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.button?.dispose();
    }

    private show(): void {
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
        this.time = null;
        if (!this.button) return;
        this.button
            .inner(this.paused ? PLAY : PAUSE)
            .att("aria-label", t(this.paused ? "play" : "pause"));
        if (!this.paused) this.frame = requestAnimationFrame(this.tick);
    }

    private tick = (time: number): void => {
        const seconds = this.time === null ? 0 : (time - this.time) / 1000;
        this.time = time;
        this.objects.forEach((object) => object.animate(seconds));
        this.c.flush();
        this.frame = requestAnimationFrame(this.tick);
    };
}
