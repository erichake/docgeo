import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import "../../src/construction";
import { describeDgo, figureObjects, readDgo } from "../../src/dgo";
import { $ } from "../../src/dom";
import {
    add,
    figureIndex,
    lineOf,
    redefine,
    resolve,
    type Studio,
} from "../../src/editor/figure";
import { message } from "../../src/editor/messages";
import { propertiesPanel } from "../../src/editor/properties";
import { parseLine } from "../../src/editor/text";
import { isCommand } from "../../src/editor/catalog";
import type { expression_object } from "../../src/objects/expression_object";
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
        (line) => add(c, resolve(c, parseLine(line, isCommand))),
    );
    c.flush();
    let changes = 0;
    const properties = propertiesPanel({
        scene: () => c,
        changed: () => {
            changes++;
        },
        rename: async () => {},
        define: async () => {},
        create: async () => {},
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
            resolve(c, parseLine("P = Point(s, 0.5)", isCommand)),
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
        const point = add(c, resolve(c, parseLine("A = (0, 0)", isCommand)));
        point.size = (figure.st![0] as { s: number }).s;
        properties.refresh();
        expect(properties.selected).not.toBe(old);
        expect(properties.selected).toBe(
            figureObjects(c).find(({ name }) => name === "A"),
        );
        expect(field("point_size").value).toBe("8");
        properties.panel.dispose();
    });

    it("edits a program on several lines, laid out, and points at a wrong line", async () => {
        const scene = createConstruction([800, 600]);
        readDgo(scene, {
            dgo: 1,
            v: { o: [400, 300], u: 40, w: 800, h: 600 },
            o: [],
        });
        const studio: Studio = { prefs: scene.prefs, scene };
        [
            "A = (0, 0)",
            "B = (3, 1)",
            "s = Segment(A, B)",
            "a = 3",
            'p = if(a>2){s.setHidden(1)}else{s.setHidden(0)};"Faces"',
        ].forEach((line) =>
            add(scene, resolve(scene, parseLine(line, isCommand))),
        );
        const properties = propertiesPanel({
            scene: () => studio.scene,
            changed: () => {},
            rename: async () => {},
            define: async (object, source) => {
                const spec = resolve(
                    studio.scene,
                    {
                        name: object.name,
                        definition: { kind: "formula", source },
                    },
                    object,
                );
                await redefine(studio, object, spec);
                properties.select(studio.scene.getObj(spec.name)!);
            },
            create: async (name, source) => {
                const c = studio.scene;
                properties.select(
                    add(
                        c,
                        resolve(c, {
                            name: name || null,
                            definition: { kind: "formula", source },
                        }),
                    ),
                );
            },
            close: () => {},
        });
        $("body").add(properties.panel);
        const panel = properties.panel;
        const area = () =>
            panel.find("textarea.dge-program")!.dom() as HTMLTextAreaElement;
        const button = (key: Parameters<typeof message>[0]) =>
            [...panel.dom().querySelectorAll("button")].find(
                (button) => button.textContent === message(key),
            )!;
        properties.select(scene.getObj("p")!);
        expect(panel.dom().classList).toContain("dge-properties-wide");
        expect(area().value).toBe(
            'if(a>2){s.setHidden(1)}else{s.setHidden(0)};"Faces"',
        );
        expect(button("apply").disabled).toBe(true);
        button("format_program").click();
        expect(area().value).toBe(
            [
                "if(a>2) {",
                "    s.setHidden(1)",
                "} else {",
                "    s.setHidden(0)",
                "};",
                '"Faces"',
            ].join("\n"),
        );
        // Enter keeps the indentation, a brace closes it.
        area().focus();
        area().setSelectionRange(9, 9);
        await userEvent.keyboard("{Enter}b=1;{Enter}");
        expect(area().value.split("\n").slice(0, 4)).toEqual([
            "if(a>2) {",
            "    b=1;",
            "    ",
            "    s.setHidden(1)",
        ]);
        area().setSelectionRange(0, area().value.length);
        document.execCommand(
            "insertText",
            false,
            'if(a>2){\n    s.setHidden(1)\n\n"Faces"',
        );
        button("apply").click();
        await expect
            .poll(() => panel.find(".dge-program-error")!.text())
            .toBe(message("syntax_line", "1"));
        expect(area().selectionStart).toBe(0);
        expect(area().selectionEnd).toBe(8);
        const program = 'if(a>2){\n    s.setHidden(1)\n};\n"Faces"';
        area().value = program;
        area().dispatchEvent(new Event("input"));
        button("apply").click();
        await expect.poll(() => area().value).toBe(program);
        const p = studio.scene.getObj("p") as expression_object;
        expect(properties.selected).toBe(p);
        const objects = figureObjects(studio.scene);
        expect(lineOf(p, figureIndex(studio.scene), objects)).toBe(
            'p = if(a>2){ s.setHidden(1) }; "Faces"',
        );
        // A constant's value too, in a narrower panel.
        properties.select(studio.scene.getObj("a")!);
        expect(area().value).toBe("3");
        expect(panel.dom().classList).not.toContain("dge-properties-wide");
        // A new program, named and written before it exists.
        properties.create("q");
        expect(panel.dom().classList).toContain("dge-properties-wide");
        expect(
            (
                panel
                    .find(`[aria-label="${message("name")}"]`)!
                    .dom() as HTMLInputElement
            ).value,
        ).toBe("q");
        expect(document.activeElement).toBe(area());
        expect(button("create").disabled).toBe(true);
        document.execCommand(
            "insertText",
            false,
            "var t=[];\nt.push([1,2]);\nt",
        );
        button("create").click();
        await expect.poll(() => properties.selected?.name).toBe("q");
        const q = studio.scene.getObj("q")!;
        expect(
            lineOf(q, figureIndex(studio.scene), figureObjects(studio.scene)),
        ).toBe("q = var t=[]; t.push([1,2]); t");
        expect((q as expression_object).value).toEqual([[1, 2]]);
        panel.dispose();
    });
});
