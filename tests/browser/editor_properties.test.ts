import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { AWAKE } from "../../src/construction";
import { describeDgo, figureObjects, readDgo } from "../../src/dgo";
import { $ } from "../../src/dom";
import {
    add,
    entryOf,
    figureIndex,
    lineOf,
    redefine,
    resolve,
    type Studio,
} from "../../src/editor/figure";
import { applyMacro } from "../../src/editor/macro";
import { message } from "../../src/editor/messages";
import { pick } from "../../src/editor/pick";
import { propertiesPanel } from "../../src/editor/properties";
import { parseLine } from "../../src/editor/text";
import { isCommand } from "../../src/editor/catalog";
import type { expression_object } from "../../src/objects/expression_object";
import type { point_object } from "../../src/objects/point_object";
import type { point_on_object } from "../../src/objects/point_on_object";
import type { polygon_object } from "../../src/objects/polygon_object";
import type { segment_object } from "../../src/objects/segment_object";
import { createConstruction, disposeFigures } from "./figures";

disposeFigures();

// The panel moved so that the field's center is at x, in the test's
// 414 pixels wide window: its box then.
function centerAt(panel: HTMLElement, input: HTMLElement, x: number): DOMRect {
    panel.style.cssText = "position:fixed;left:0;top:0;width:300px";
    const box = input.getBoundingClientRect();
    panel.style.left = `${x - box.left - box.width / 2}px`;
    return input.getBoundingClientRect();
}

// `macros`: the figure's macros and their styles.
function setup(macros: object = {}) {
    const c = createConstruction([800, 600]);
    readDgo(c, {
        dgo: 1,
        v: { o: [400, 300], u: 40, w: 800, h: 600 },
        o: [],
        ...macros,
    });
    ["A = (0, 0)", "B = (3, 1)", "s = Segment(A, B)", "d = Line(A, B)"].forEach(
        (line) => add(c, resolve(c, parseLine(line, isCommand))),
    );
    c.flush();
    let changes = 0;
    const patches: object[] = [];
    const properties = propertiesPanel({
        scene: () => c,
        changed: () => {
            changes++;
        },
        error: () => {},
        rename: async () => {},
        define: async () => {},
        line: () => null,
        enter: async () => {},
        condition: () => {},
        bind: () => {},
        create: async () => {},
        shown: () => {},
        mark: () => {},
        figure: (patch) => patches.push(patch),
        start: () => {},
        remove: () => {},
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
    return {
        c,
        properties,
        field,
        change,
        changes: () => changes,
        patches,
    };
}

describe("Object properties", () => {
    it("scrubs numbers live and commits once, keeping click and keyboard editing", async () => {
        const { c, properties, field, changes } = setup();
        properties.select(c.getObj("A")!);
        const input = field("point_size");
        const box = centerAt(properties.panel.dom() as HTMLElement, input, 100);
        const target = $.create("div")
            .stl(
                `position:fixed;left:${box.left + box.width / 2 + 46}px;top:${box.top + box.height / 2 - 2}px;width:4px;height:4px`,
            )
            .att("data-testid", "drop");
        $("body").add(target);
        const seen: number[] = [];
        $(input).on("pointermove", () => seen.push(c.getObj("A")!.size), false);
        await userEvent.dragAndDrop(input, target.dom());
        // 0.05 per pixel: 6 + 2.3, by steps of 0.5.
        expect(c.getObj("A")!.size).toBe(8.5);
        expect(input.value).toBe("8.5");
        expect(seen).toContain(8.5);
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
        const input = field("point_size");
        const box = centerAt(properties.panel.dom() as HTMLElement, input, 220);
        const target = $.create("div")
            .stl(
                `position:fixed;left:${box.left + box.width / 2 + 100}px;top:${box.top + box.height / 2 - 2}px;width:4px;height:4px`,
            )
            .att("data-testid", "drop");
        $("body").add(target);
        await userEvent.keyboard("{Shift>}");
        await userEvent.dragAndDrop(input, target.dom());
        await userEvent.keyboard("{/Shift}");
        expect(c.getObj("A")!.size).toBe(6.5);
        expect(input.validity.valid).toBe(true);
        target.stl("left", `${box.left + box.width / 2 - 202}px`);
        await userEvent.dragAndDrop(input, target.dom());
        expect(c.getObj("A")!.size).toBe(0);
        expect(changes()).toBe(2);
        target.dispose();
        properties.panel.dispose();
    });

    it("gives a panel a fill color and its own opacity, without dashes", () => {
        const { c, properties, field, change } = setup({
            o: [["Html", "T", [[0, 0, 100, 50], 15, "x"], 0]],
            st: [{ c: "#67ae37", fc: "#3d2f83", o: 0.18 }],
        });
        properties.select(c.getObj("T")!);
        expect(field("fill_color").value).toBe("#3d2f83");
        for (const key of [
            "fill_opacity",
            "stroke_opacity",
            "dashed",
        ] as const)
            expect(
                properties.panel.find(`[aria-label="${message(key)}"]`),
            ).toBeNull();
        expect(field("opacity").value).toBe("18");
        change("opacity", "60");
        expect(c.getObj("T")!.opacity).toBe(0.6);
        properties.panel.dispose();
    });

    it("spans an opacity in about 200 pixels", async () => {
        const { c, properties, field, change } = setup();
        properties.select(c.getObj("A")!);
        change("stroke_opacity", "0");
        const input = field("stroke_opacity");
        const box = centerAt(properties.panel.dom() as HTMLElement, input, 100);
        const target = $.create("div")
            .stl(
                `position:fixed;left:${box.left + box.width / 2 + 140}px;top:${box.top + box.height / 2 - 2}px;width:4px;height:4px`,
            )
            .att("data-testid", "drop");
        $("body").add(target);
        await userEvent.dragAndDrop(input, target.dom());
        expect(c.getObj("A")!.strokeOpacity).toBeCloseTo(0.7, 1);
        target.dispose();
        properties.panel.dispose();
    });

    it("renders point styles, preserves one trace and saves the settings", async () => {
        const { c, properties, change, changes } = setup();
        const point = c.getObj("A") as point_object;
        const fill = point.fill_color;
        properties.select(point);
        change("color", "#cc2244");
        change("point_size", "9");
        change("point_border", "2.5");
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
        expect(changes()).toBe(9);
        const restored = createConstruction([800, 600]);
        readDgo(restored, await describeDgo(c));
        const copy = restored.getObj("A") as point_object;
        expect([
            copy.stroke_color,
            copy.fill_color,
            copy.size,
            copy.border,
            copy.shape,
            copy.showName,
            copy.fontSize,
            copy.trace,
        ]).toEqual(["#cc2244", fill, 10, 2.5, "diamond", false, 24, true]);
        change("trace", false);
        expect(c.traceLayer.findAll("[data-trace=A]")).toHaveLength(0);
        properties.panel.dispose();
    });

    it("shows the name of a segment, created without it, and saves it", async () => {
        const { c, properties, field, change } = setup();
        const segment = c.getObj("s")!;
        expect([segment.showName, c.getObj("d")!.showName]).toEqual([
            false,
            false,
        ]);
        properties.select(segment);
        expect(field("show_name").checked).toBe(false);
        change("show_name", true);
        expect(segment.dom.find("text")!.dom().textContent).toBe("s");
        const restored = createConstruction([800, 600]);
        readDgo(restored, await describeDgo(c));
        expect(restored.getObj("s")!.showName).toBe(true);
        change("show_name", false);
        expect(segment.dom.find("text")).toBeFalsy();
        properties.panel.dispose();
    });

    it("fixes a polygon, which its vertices no longer translate, and saves it", async () => {
        const { c, properties, field, change } = setup();
        ["C = (0, 3)", "p = Polygon(A, B, C)"].forEach((line) =>
            add(c, resolve(c, parseLine(line, isCommand))),
        );
        c.flush();
        properties.select(c.getObj("A")!);
        expect(
            properties.panel.find(`[aria-label="${message("fixed_object")}"]`),
        ).toBeFalsy();
        const polygon = c.getObj("p") as polygon_object;
        properties.select(polygon);
        expect(field("fixed_object").checked).toBe(false);
        change("fixed_object", true);
        expect(polygon.fixed).toBe(true);
        const restored = createConstruction([800, 600]);
        readDgo(restored, await describeDgo(c));
        expect((restored.getObj("p") as polygon_object).fixed).toBe(true);
        properties.panel.dispose();
    });

    it("makes an object inert, which picking skips unless awake, and saves it", async () => {
        const { c, properties, field, change } = setup();
        const point = c.getObj("A") as point_object;
        const picked = () =>
            pick(c, [point.sx, point.sy]).some(
                ({ object }) => object === point,
            );
        properties.select(point);
        expect(field("inert_object").checked).toBe(false);
        change("inert_object", true);
        expect(point.inert).toBe(true);
        expect(point.dom.getAtt("data-inert")).toBe("");
        expect(picked()).toBe(false);
        document.body.classList.add(AWAKE);
        expect(picked()).toBe(true);
        document.body.classList.remove(AWAKE);
        const restored = createConstruction([800, 600]);
        readDgo(restored, await describeDgo(c));
        expect(restored.getObj("A")!.inert).toBe(true);
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

    it("styles a macro's final, whose default color is the macro's", () => {
        const { c, properties, field, change } = setup({
            mac: [
                {
                    n: "Milieu",
                    f: ["I"],
                    m: [
                        {
                            i: [
                                ["point", "?"],
                                ["point", "?"],
                            ],
                            b: [["Mid", "I", [0, 1], 0]],
                            f: [2],
                        },
                    ],
                },
            ],
            st: [{ c: "#ff0000" }],
        });
        const [final] = applyMacro(c, 0, 0, [c.getObj("A")!, c.getObj("B")!]);
        c.flush();
        expect(final.stroke_color).toBe("#ff0000");
        properties.select(final);
        expect(field("color").value).toBe("#ff0000");
        change("color", "#112233");
        expect(final.stroke_color).toBe("#112233");
        (properties.panel.find(".dge-reset")!.dom() as HTMLElement).click();
        expect(final.stroke_color).toBe("#ff0000");
        properties.panel.dispose();
    });

    it("sets several objects together, showing only their common settings", () => {
        const { c, properties, field, change, changes } = setup();
        const [A, B, s] = ["A", "B", "s"].map((name) => c.getObj(name)!);
        const shown = (key: Parameters<typeof message>[0]) =>
            !!properties.panel.find(`[aria-label="${message(key)}"]`);
        B.stroke_color = "#00aa00";
        B.size = 8;
        properties.select(A);
        properties.toggle(B);
        expect(properties.selection).toEqual([A, B]);
        expect(
            (field("object") as unknown as HTMLSelectElement).selectedOptions[0]
                .text,
        ).toBe("A, B");
        // The first one's value, the others' differing.
        expect(field("color").classList).toContain("dge-mixed");
        expect(field("point_size").value).toBe(String(A.size));
        expect(field("point_size").classList).toContain("dge-mixed");
        expect(shown("point_shape")).toBe(true);
        // Without the name of any.
        expect(shown("name")).toBe(false);
        change("point_size", "9");
        expect([A.size, B.size, s.size]).toEqual([9, 9, s.size]);
        properties.toggle(s);
        expect(shown("point_size")).toBe(false);
        expect(shown("thickness")).toBe(false);
        expect(shown("point_shape")).toBe(false);
        expect(shown("decoration")).toBe(false);
        expect(field("show_name").indeterminate).toBe(true);
        change("color", "#112233");
        expect([A, B, s].map(({ stroke_color }) => stroke_color)).toEqual([
            "#112233",
            "#112233",
            "#112233",
        ]);
        expect(field("color").classList).not.toContain("dge-mixed");
        change("show_name", true);
        expect([A, B, s].every(({ showName }) => showName)).toBe(true);
        expect(changes()).toBe(3);
        properties.toggle(A);
        properties.toggle(B);
        expect(properties.selected).toBe(s);
        expect(field("name").value).toBe("s");
        expect(shown("thickness")).toBe(true);
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
            error: () => {},
            shown: () => {},
            mark: () => {},
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
            line: (object) => {
                const index = figureIndex(studio.scene);
                return entryOf(object, index)[0] === "Pt"
                    ? null
                    : lineOf(object, index, figureObjects(studio.scene));
            },
            condition: () => {},
            enter: async (object, line) => {
                const spec = resolve(
                    studio.scene,
                    parseLine(line, isCommand),
                    object,
                );
                await redefine(studio, object, spec);
                properties.select(studio.scene.getObj(spec.name)!);
            },
            bind: () => {},
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
            figure: () => {},
            start: () => {},
            remove: () => {},
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
        expect(document.body.classList).toContain("dge-properties-wide");
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
        expect(document.body.classList).not.toContain("dge-properties-wide");
        // A new program, named and written before it exists.
        properties.create("q");
        expect(document.body.classList).toContain("dge-properties-wide");
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
        // A command by its line, written on several; no definition for a
        // free point.
        properties.select(studio.scene.getObj("A")!);
        expect(panel.find("textarea")).toBeNull();
        properties.select(studio.scene.getObj("s")!);
        expect(area().value).toBe("Segment(A, B)");
        expect(document.body.classList).not.toContain("dge-properties-wide");
        area().focus();
        area().select();
        document.execCommand("insertText", false, "Segment(\n    B,\n    A)");
        button("format_program").click();
        expect(area().value).toBe("Segment(B, A)");
        area().select();
        document.execCommand("insertText", false, "Segment(\n    B,\n    A)");
        button("apply").click();
        await expect
            .poll(() =>
                lineOf(
                    studio.scene.getObj("s")!,
                    figureIndex(studio.scene),
                    figureObjects(studio.scene),
                ),
            )
            .toBe("s = Segment(B, A)");
        panel.dispose();
    });
});

describe("Figure settings", () => {
    const named =
        (properties: ReturnType<typeof setup>["properties"]) =>
        (name: string) =>
            properties.panel.find(`[aria-label="${name}"]`)!.dom() as
                HTMLInputElement | HTMLButtonElement;
    const type = (input: HTMLInputElement, value: string) => {
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    it("sets the coordinate system, x and y linked or not, and saves it", async () => {
        const { c, properties, changes } = setup();
        const field = named(properties);
        properties.select(c.getObj("A")!);
        properties.figure();
        // No object to delete while it shows.
        expect(properties.selected).toBeNull();
        const grid = c.GRID;
        const spacing = `${message("tick_distance")} `;
        const x = field(spacing + "x") as HTMLInputElement;
        const y = field(spacing + "y") as HTMLInputElement;
        expect([x.value, x.placeholder]).toEqual(["", message("auto")]);
        type(x, "0.5");
        expect(grid.tickDistances).toEqual([0.5, 0.5, 0]);
        expect(y.value).toBe("0.5");
        (field(message("link")) as HTMLButtonElement).click();
        type(y, "2");
        expect(grid.tickDistances).toEqual([0.5, 2, 0]);
        type(y, "");
        expect(grid.tickDistances).toEqual([0.5, 0, 0]);
        (field(message("ticks_none")) as HTMLButtonElement).click();
        expect(grid.tickStyles).toEqual([2, 0, 0]);
        const show = field(`${message("show_axis")} y`) as HTMLInputElement;
        show.click();
        expect(grid.showOy).toBe(false);
        const switches = properties.panel.findAll(".dge-switch");
        (switches[1].dom() as HTMLInputElement).click();
        expect(grid.showGrid).toBe(false);
        expect(changes()).toBe(6);
        const restored = createConstruction([800, 600]);
        readDgo(restored, await describeDgo(c));
        expect(restored.GRID.tickDistances).toEqual([0.5, 0, 0]);
        expect(restored.GRID.tickStyles).toEqual([2, 0, 0]);
        expect([restored.GRID.showOy, restored.GRID.showGrid]).toEqual([
            false,
            false,
        ]);
        properties.select(c.getObj("A")!);
        expect(properties.selected).toBe(c.getObj("A"));
        properties.panel.dispose();
    });

    it("drags a distance from automatic to a round value", async () => {
        const { c, properties } = setup();
        properties.figure();
        const input = named(properties)(
            `${message("tick_distance")} x`,
        ) as HTMLInputElement;
        const box = centerAt(properties.panel.dom() as HTMLElement, input, 100);
        const target = $.create("div")
            .stl(
                `position:fixed;left:${box.left + box.width / 2 + 120}px;top:${box.top + box.height / 2 - 2}px;width:4px;height:4px`,
            )
            .att("data-testid", "drop");
        $("body").add(target);
        await userEvent.dragAndDrop(input, target.dom());
        const [x, y] = c.GRID.tickDistances;
        expect(x).toBeGreaterThan(0.8);
        expect(x).toBeLessThan(2);
        // Two significant digits, y linked.
        expect(Math.round(x * 10)).toBeCloseTo(x * 10, 9);
        expect(y).toBe(x);
        target.dispose();
        properties.panel.dispose();
    });

    it("applies a preset, shows which one is set, and follows the axes' color", () => {
        const { c, properties } = setup();
        const field = named(properties);
        properties.figure();
        const pressed = () =>
            properties.panel
                .findAll(".dge-presets [aria-pressed=true]")
                .map((button) => button.text());
        expect(pressed()).toEqual([message("preset_dgpad")]);
        const preset = [
            ...properties.panel.dom().querySelectorAll(".dge-presets button"),
        ].find(
            (button) => button.textContent === message("preset_geogebra"),
        ) as HTMLButtonElement;
        preset.click();
        expect(c.GRID.geogebraAxes).toBe(true);
        expect(c.GRID.gridColor).toBe("#b4b3ba");
        expect(pressed()).toEqual([message("preset_geogebra")]);
        (field(message("same_as_axes")) as HTMLButtonElement).click();
        expect(c.GRID.gridColor).toBeNull();
        type(field(message("color")) as HTMLInputElement, "#aa0000");
        expect((field(message("grid_color")) as HTMLInputElement).value).toBe(
            "#aa0000",
        );
        expect(pressed()).toEqual([]);
        properties.panel.dispose();
    });

    it("hands the angle unit and the segments order to the figure", () => {
        const { properties, patches } = setup();
        const field = named(properties);
        properties.figure();
        (field(message("radians")) as HTMLButtonElement).click();
        (field(message("segments_over")) as HTMLInputElement).click();
        expect(patches).toEqual([{ deg: 0 }, { sop: 1 }]);
        properties.panel.dispose();
    });

    it("closes the first blocks offered to another object", async () => {
        const { c, properties } = setup();
        ["a = 5", 'b = Button("Go")'].forEach((line) =>
            add(c, resolve(c, parseLine(line, isCommand))),
        );
        c.flush();
        const flyout = () =>
            document.querySelector(".blocklyFlyout") as SVGElement | null;
        const program = () =>
            [...document.querySelectorAll(".blocklyBlockCanvas")].some(
                (canvas) => canvas.textContent === "program",
            );
        properties.select(c.getObj("a")!);
        (
            [...properties.panel.dom().querySelectorAll("button")].find(
                (button) => button.textContent === message("add_program"),
            ) as HTMLButtonElement
        ).click();
        await expect.poll(() => flyout()?.style.display).toBe("block");
        properties.select(c.getObj("b")!);
        await expect.poll(program).toBe(true);
        expect(flyout()!.style.display).toBe("none");
        properties.panel.dispose();
    });
});
