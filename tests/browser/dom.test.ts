import { describe, expect, it, vi } from "vitest";
import { $, type PointerDelta } from "../../src/dom";

describe("DOM pointer interactions", () => {
    it.each(["mouse", "touch", "pen"])(
        "uses the pointer path for %s input",
        (pointerType) => {
            const dom = $.createSVG().shape("g");
            const element = dom.dom();
            const deltas: PointerDelta[] = [];
            vi.spyOn(element, "setPointerCapture").mockImplementation(() => {});
            dom.drag((_event, delta) => deltas.push(delta));
            $("body").add(dom);

            element.dispatchEvent(
                new PointerEvent("pointerdown", {
                    bubbles: true,
                    button: 0,
                    clientX: 10,
                    clientY: 20,
                    isPrimary: true,
                    pointerId: 1,
                    pointerType,
                }),
            );
            element.dispatchEvent(
                new PointerEvent("pointermove", {
                    bubbles: true,
                    clientX: 16,
                    clientY: 28,
                    isPrimary: true,
                    pointerId: 1,
                    pointerType,
                }),
            );
            element.dispatchEvent(
                new PointerEvent("pointerup", {
                    bubbles: true,
                    clientX: 16,
                    clientY: 28,
                    isPrimary: true,
                    pointerId: 1,
                    pointerType,
                }),
            );

            expect(deltas).toEqual([[6, 8]]);
            dom.dispose();
        },
    );

    it("drags again when the browser lost the end of the previous drag", () => {
        const dom = $.createSVG().shape("g");
        const element = dom.dom();
        const deltas: PointerDelta[] = [];
        vi.spyOn(element, "setPointerCapture").mockImplementation(() => {});
        dom.drag((_event, delta) => deltas.push(delta));
        $("body").add(dom);
        const dispatch = (type: string, clientX: number) =>
            element.dispatchEvent(
                new PointerEvent(type, {
                    bubbles: true,
                    button: 0,
                    clientX,
                    isPrimary: true,
                    pointerId: 1,
                    pointerType: "mouse",
                }),
            );

        dispatch("pointerdown", 0);
        dispatch("pointermove", 500);
        dispatch("pointerdown", 100);
        dispatch("pointermove", 103);

        expect(deltas).toEqual([
            [500, 0],
            [3, 0],
        ]);
        dom.dispose();
    });

    it("converts client coordinates into SVG coordinates", () => {
        const svg = $.createSVG();
        const element = svg.dom() as SVGSVGElement;
        element.getScreenCTM = () =>
            ({ a: 2, b: 0, c: 0, d: 4, e: 10, f: 20 }) as DOMMatrix;

        expect(
            svg.svgPoint(
                new PointerEvent("pointermove", {
                    clientX: 30,
                    clientY: 40,
                }),
            ),
        ).toEqual([10, 5]);
    });
});
