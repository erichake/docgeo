import { $, type DOMElement } from "../dom";

export function scrubNumber(
    field: DOMElement,
    update: (value: number) => void,
    commit: () => void,
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
        sensitivity: number;
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
            const start = input.valueAsNumber;
            gesture = {
                id: event.pointerId,
                origin: event.clientX,
                x: event.clientX,
                amount: start,
                sensitivity: Math.max(step, Math.abs(start) * 0.01) / 4,
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
            gesture.amount = Math.max(
                min,
                Math.min(
                    max,
                    gesture.amount +
                        ((event.clientX - gesture.x) * gesture.sensitivity) /
                            (event.shiftKey ? 10 : 1),
                ),
            );
            gesture.x = event.clientX;
            const value = Number(
                (
                    min +
                    Math.round((gesture.amount - min) / step) * step
                ).toFixed(digits),
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
