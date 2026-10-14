import { $, type DOMElement } from "../dom";

// How far a number follows the pointer: by `pixel` per pixel, chosen so that
// a gesture of about 200 pixels spans the setting's useful range; or, for a
// quantity without a natural scale (`relative`), by 1 % of itself per pixel,
// but at least `pixel`, rounded to two significant digits (three with
// Shift).
export interface Scrub {
    pixel: number;
    relative?: boolean;
}

const decimals = (quantum: number): number =>
    Math.max(0, -Math.floor(Math.log10(quantum) + 1e-9));

export function scrubNumber(
    field: DOMElement,
    update: (value: number) => void,
    commit: () => void,
    { pixel, relative = false }: Scrub,
): void {
    const input = field.dom() as HTMLInputElement;
    const min = Number(input.min);
    const max = Number(input.max);
    const step = Number(input.step);
    const digits = input.step.split(".")[1]?.length ?? 0;
    let gesture: {
        id: number;
        origin: number;
        x: number;
        amount: number;
        dragging: boolean;
        changed: boolean;
    } | null = null;
    let suppressClick = false;

    field.addClass("dge-scrubbable").on(
        "pointerdown",
        (event) => {
            suppressClick = false;
            if (
                event.pointerType !== "mouse" ||
                event.button !== 0 ||
                !event.isPrimary ||
                document.activeElement === input
            )
                return;
            event.preventDefault();
            event.stopPropagation();
            if (document.activeElement instanceof HTMLElement)
                document.activeElement.blur();
            // Empty: an automatic value, 0.
            const start = input.valueAsNumber || 0;
            gesture = {
                id: event.pointerId,
                origin: event.clientX,
                x: event.clientX,
                amount: start,
                dragging: false,
                changed: false,
            };
            input.setPointerCapture(event.pointerId);
        },
        false,
    );
    field.on(
        "pointermove",
        (event) => {
            if (event.pointerId !== gesture?.id) return;
            if (
                !gesture.dragging &&
                Math.abs(event.clientX - gesture.origin) <= $.clickRadius
            )
                return;
            event.preventDefault();
            gesture.dragging = true;
            field.addClass("dge-scrubbing");
            const fine = event.shiftKey ? 10 : 1;
            const amount = gesture.amount;
            const rate = relative
                ? Math.max(pixel, Math.abs(amount) * 0.01)
                : pixel;
            gesture.amount = Math.max(
                min,
                Math.min(
                    max,
                    amount + ((event.clientX - gesture.x) * rate) / fine,
                ),
            );
            gesture.x = event.clientX;
            const size = Math.abs(gesture.amount);
            const quantum =
                relative && size >= step
                    ? Math.max(
                          step,
                          10 ** (Math.floor(Math.log10(size)) - 1) / fine,
                      )
                    : step;
            // From the bound, or from 0 if relative, for round values.
            const origin = relative ? 0 : min;
            const value = Number(
                Math.max(
                    min,
                    Math.min(
                        max,
                        origin +
                            Math.round((gesture.amount - origin) / quantum) *
                                quantum,
                    ),
                ).toFixed(Math.max(digits, decimals(quantum))),
            );
            if (value !== input.valueAsNumber) {
                gesture.changed = true;
                update(value);
            }
        },
        false,
    );

    function finish(event: PointerEvent, cancelled: boolean): void {
        if (event.pointerId !== gesture?.id) return;
        const { dragging, changed } = gesture;
        gesture = null;
        field.removeClass("dge-scrubbing");
        if (input.hasPointerCapture(event.pointerId))
            input.releasePointerCapture(event.pointerId);
        suppressClick = dragging;
        if (dragging) {
            if (changed) commit();
        } else if (!cancelled) {
            input.focus();
            input.select();
        }
    }

    field.on("pointerup", (event) => finish(event, false), false);
    field.on("pointercancel", (event) => finish(event, true), false);
    field.on("lostpointercapture", (event) => finish(event, true), false);
    field.on(
        "click",
        (event) => {
            if (!suppressClick) return;
            event.preventDefault();
            event.stopPropagation();
            suppressClick = false;
        },
        false,
    );
}
