import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import "../../src/construction";
import { describeDgo, figureObjects, readDgo } from "../../src/dgo";
import { $ } from "../../src/dom";
import { add, resolve } from "../../src/editor/figure";
import { message } from "../../src/editor/messages";
import { propertiesPanel } from "../../src/editor/properties";
import { parseLine } from "../../src/editor/text";
import type { point_object } from "../../src/objects/point_object";
import type { point_on_object } from "../../src/objects/point_on_object";
import type { segment_object } from "../../src/objects/segment_object";
import { createConstruction, disposeFigures } from "./figures";

disposeFigures();

function setup() {
    const c = createConstruction([800, 600]);
    readDgo(c, {
        dgo: 1,
        v: { o: [400, 300], u: 40, w: 800, h: 600 },
        o: [],
    });
    ["A = (0, 0)", "B = (3, 1)", "s = Segment(A, B)", "d = Line(A, B)"].forEach(
        (line) => add(c, resolve(c, parseLine(line))),
    );
    c.flush();
    let changes = 0;
    const properties = propertiesPanel({
        scene: () => c,
        changed: () => {
            changes++;
        },
        rename: async () => {},
        close: () => {},
    });
    $("body").add(properties.panel);
    const field = (key: Parameters<typeof message>[0]) =>
        properties.panel
            .find(`[aria-label="${message(key)}"]`)!
            .dom() as HTMLInputElement;
    const change = (
        key: Parameters<typeof message>[0],
        value: string | boolean,
    ) => {
        const input = field(key);
        if (typeof value === "boolean") input.checked = value;
        else input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    return { c, properties, field, change, changes: () => changes };
}

describe("Object properties", () => {
    it("scrubs numbers live and commits once, keeping click and keyboard editing", async () => {
        const { c, properties, field, changes } = setup();
        properties.select(c.getObj("A")!);
        properties.panel.stl("position:fixed;left:50px;top:0;width:300px");
        const input = field("point_size");
        const box = input.getBoundingClientRect();
        const target = $.create("div").stl(
            `position:fixed;left:${box.left + box.width / 2 + 46}px;top:${box.top + box.height / 2 - 2}px;width:4px;height:4px`,
        );
        $("body").add(target);
        const seen: number[] = [];
        $(input).on("pointermove", () => seen.push(c.getObj("A")!.size), false);
        await userEvent.dragAndDrop(input, target.dom());
        expect(c.getObj("A")!.size).toBe(12);
        expect(input.value).toBe("12");
        expect(seen).toContain(12);
        expect(changes()).toBe(1);
        expect(document.activeElement).not.toBe(input);
        await userEvent.click(input);
        expect(document.activeElement).toBe(input);
        expect(changes()).toBe(1);
        await userEvent.fill(input, "7.5");
        await userEvent.keyboard("{Enter}");
        expect(c.getObj("A")!.size).toBe(7.5);
        expect(changes()).toBe(2);
        target.dispose();
        properties.panel.dispose();
    });

    it("scrubs more slowly with Shift and respects bounds and decimal steps", async () => {
        const { c, properties, field, changes } = setup();
        properties.select(c.getObj("A")!);
        properties.panel.stl("position:fixed;left:150px;top:0;width:300px");
        const input = field("point_size");
        const box = input.getBoundingClientRect();
        const target = $.create("div").stl(
            `position:fixed;left:${box.left + box.width / 2 + 46}px;top:${box.top + box.height / 2 - 2}px;width:4px;height:4px`,
        );
        $("body").add(target);
        await userEvent.keyboard("{Shift>}");
        await userEvent.dragAndDrop(input, target.dom());
        await userEvent.keyboard("{/Shift}");
        expect(c.getObj("A")!.size).toBe(6.5);
        expect(input.validity.valid).toBe(true);
        target.stl("left", `${box.left + box.width / 2 - 102}px`);
        await userEvent.dragAndDrop(input, target.dom());
        expect(c.getObj("A")!.size).toBe(0);
        expect(changes()).toBe(2);
        target.dispose();
        properties.panel.dispose();
    });

    it("renders point styles, preserves one trace and saves the settings", async () => {
        const { c, properties, change, changes } = setup();
        const point = c.getObj("A") as point_object;
        properties.select(point);
        change("color", "#cc2244");
        change("point_size", "9");
        change("point_shape", "diamond");
        change("show_name", false);
        change("name_position", "90");
        change("trace", true);
        change("font_size", "24");
        change("point_size", "10");
        expect(c.traceLayer.findAll("[data-trace=A]")).toHaveLength(1);
        expect(point.shape).toBe("diamond");
        expect(point.namePosition).toBeCloseTo(Math.PI / 2);
        expect(point.nameText).toBeUndefined();
        expect(changes()).toBe(8);
        const restored = createConstruction([800, 600]);
        readDgo(restored, await describeDgo(c));
        const copy = restored.getObj("A") as point_object;
        expect([
            copy.stroke_color,
            copy.fill_color,
            copy.size,
            copy.shape,
            copy.showName,
            copy.fontSize,
            copy.trace,
        ]).toEqual(["#cc2244", "#cc2244", 10, "diamond", false, 24, true]);
        change("trace", false);
        expect(c.traceLayer.findAll("[data-trace=A]")).toHaveLength(0);
        properties.panel.dispose();
    });

    it("hides an object, selects it from the list and shows it again", () => {
        const { c, properties, field, change } = setup();
        const point = c.getObj("A")!;
        properties.select(point);
        change("visible", false);
        expect(point.hasView).toBe(false);
        properties.select(c.getObj("B")!);
        change("object", "A");
        expect(properties.selected).toBe(point);
        expect(field("visible").checked).toBe(false);
        change("visible", true);
        expect(point.hasView).toBe(true);
        properties.panel.dispose();
    });

    it("refreshes the picker and restores animation settings", async () => {
        const { c, properties, field, change } = setup();
        const point = add(
            c,
            resolve(c, parseLine("P = Point(s, 0.5)")),
        ) as point_on_object;
        c.animations.paused = true;
        properties.refresh();
        expect(
            Array.from(
                (field("object") as unknown as HTMLSelectElement).options,
            ).map(({ value }) => value),
        ).toContain("P");
        change("object", "P");
        change("reverse", true);
        change("animation_speed", "2");
        change("animation_end", "bounce");
        expect(point.animation).toMatchObject({
            speed: 2,
            direction: -1,
            ar: true,
        });
        const restored = createConstruction([800, 600]);
        readDgo(restored, await describeDgo(c));
        expect(
            (restored.getObj("P") as point_on_object).animation,
        ).toMatchObject({ speed: 2, direction: -1, ar: true });
        change("animation_speed", "0");
        expect(point.animation!.speed).toBe(0);
        change("animation_speed", "3");
        expect(point.animation!.speed).toBe(3);
        const start = point.alpha;
        point.animate(0.01);
        const end = point.alpha;
        expect(end).not.toBe(start);
        properties.panel.dispose();
    });

    it("applies styles to the same type and redraws measures and layers", () => {
        const { c, properties, change } = setup();
        properties.select(c.getObj("A")!);
        change("same_type", true);
        change("color", "#112233");
        expect(c.getObj("B")!.stroke_color).toBe("#112233");
        expect(c.getObj("s")!.stroke_color).not.toBe("#112233");
        properties.select(c.getObj("s")!);
        change("precision", "2");
        change("decoration", "3");
        change("level", "4");
        change("dashed", true);
        const segment = c.getObj("s") as segment_object;
        expect(segment.dom.find("text")!.text()).toMatch(/^3[.,]16$/);
        expect(
            segment.dom
                .dom()
                .parentElement!.parentElement!.getAttribute("data-level"),
        ).toBe("4");
        expect(segment.decoration).toBe(3);
        expect(segment.dash).toEqual([6, 6]);
        expect(c.getObj("d")!.dash).toEqual([]);
        properties.panel.dispose();
    });

    it("rebinds selection after restoring a figure and rejects invalid numbers", async () => {
        const { c, properties, field, change } = setup();
        properties.select(c.getObj("A")!);
        change("point_size", "8");
        change("point_size", "-1");
        expect(c.getObj("A")!.size).toBe(8);
        expect(field("point_size").value).toBe("8");
        const figure = await describeDgo(c);
        const old = properties.selected;
        c.removeObject(c.getObj("A")!);
        const point = add(c, resolve(c, parseLine("A = (0, 0)")));
        point.size = (figure.st![0] as { s: number }).s;
        properties.refresh();
        expect(properties.selected).not.toBe(old);
        expect(properties.selected).toBe(
            figureObjects(c).find(({ name }) => name === "A"),
        );
        expect(field("point_size").value).toBe("8");
        properties.panel.dispose();
    });
});
