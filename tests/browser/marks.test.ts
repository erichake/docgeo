import { afterEach, describe, expect, it } from "vitest";
import { $ } from "../../src/dom";
import { watchMarks } from "../../src/editor/marks";

const SVG = "http://www.w3.org/2000/svg";
const settled = () => new Promise((done) => setTimeout(done));

describe("marks", () => {
    const svg = document.createElementNS(SVG, "svg");
    const layer = document.createElementNS(SVG, "g");
    const object = document.createElementNS(SVG, "g");
    const shape = document.createElementNS(SVG, "path");
    layer.setAttribute("data-layer", "0");
    shape.setAttribute("d", "M0 0L9 9");
    shape.style.stroke = "red";
    shape.style.strokeWidth = "2px";
    object.append(shape);
    layer.append(object);
    svg.append(layer);
    $("body").dom().append(svg);
    watchMarks();

    afterEach(async () => {
        object.removeAttribute("class");
        await settled();
    });

    const marks = () => layer.querySelectorAll(".dge-mark");

    it("doubles a hovered object under itself, wider, without its state", async () => {
        object.setAttribute("class", "dge-hover");
        await settled();
        expect(marks()).toHaveLength(1);
        expect(marks()[0].nextElementSibling).toBe(object);
        expect(marks()[0].classList.contains("dge-hover")).toBe(false);
        const copy = marks()[0].firstElementChild as SVGElement;
        expect(copy.style.stroke).toBe("red");
        expect(copy.style.strokeWidth).toBe("8px");
    });

    it("follows its object and leaves with its state", async () => {
        object.setAttribute("class", "dge-picked");
        await settled();
        shape.setAttribute("d", "M1 1L2 2");
        await settled();
        expect(marks()).toHaveLength(1);
        expect(marks()[0].firstElementChild!.getAttribute("d")).toBe(
            "M1 1L2 2",
        );
        object.removeAttribute("class");
        await settled();
        expect(marks()).toHaveLength(0);
    });

    it("keeps the light mark for the properties", async () => {
        object.setAttribute("class", "dge-property-selected dge-hover");
        await settled();
        expect(marks()).toHaveLength(1);
        expect(marks()[0].getAttribute("class")).toBe("dge-mark");
    });

    it("gives an object in several states its strongest mark only", async () => {
        object.setAttribute("class", "dge-picked dge-hover");
        await settled();
        expect(marks()).toHaveLength(1);
        expect(marks()[0].getAttribute("class")).toBe(
            "dge-mark dge-mark-strong",
        );
    });

    it("leaves a macro's objects to their own paint", async () => {
        object.setAttribute("class", "dge-initial dge-hover");
        await settled();
        expect(marks()).toHaveLength(0);
    });
});
