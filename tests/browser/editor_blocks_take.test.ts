import * as Blockly from "blockly/core";
import { userEvent } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { blocksEditor } from "../../src/editor/blocks/workspace";
import { parseProgram } from "../../src/import/dgp_formula";

const source = `TURTLE_INIT("A", A);\nvar n;\nn = a;\nn = TURTLE_LENGTH("A") + Math.hypot(a, b);\nreturn TURTLE_RESULT();`;

describe("an object clicked in the figure, as in DGPad", async () => {
    const host = document.createElement("div");
    host.style.cssText = "width:800px;height:600px";
    const outside = document.createElement("button");
    document.body.append(host, outside);
    const changed = vi.fn();
    const editor = await blocksEditor(
        host,
        {
            lang: "en",
            format: (name) => name,
            objects: () => ["a", "b", "c", "A"],
            turtles: () => ["A"],
            globals: () => [],
            dialog: () => {},
        },
        { changed, open: vi.fn(), start: vi.fn(), removed: vi.fn() },
    );
    const workspace = Blockly.getMainWorkspace() as Blockly.WorkspaceSvg;
    const load = () =>
        editor.load(
            [
                {
                    hat: { key: "A", kind: "turtle", object: "A" },
                    program: parseProgram(source),
                },
            ],
            "A",
            true,
            "A",
            [],
        );
    const blocks = (type: string) =>
        workspace.getAllBlocks(true).filter((block) => block.type === type);
    // Selected by a click, the focus then leaving the blocks for the figure.
    const select = async (block: Blockly.BlockSvg) => {
        await userEvent.click(block.pathObject.svgPath, {
            position: { x: 4, y: 12 },
        });
        await userEvent.click(outside);
    };
    const written = async (text: string) => {
        await expect.poll(() => changed.mock.calls.length).toBe(1);
        expect(changed.mock.calls[0][0][0][1]).toContain(text);
    };

    it("names the selected block's object", async () => {
        load();
        changed.mockClear();
        const object = blocks("dg_object")[0];
        await select(object);
        await expect
            .poll(() =>
                object.getSvgRoot().classList.contains("blocklySelected"),
            )
            .toBe(true);
        expect(editor.take("b")).toBe(true);
        await written("n = b;");
    });

    it("names that of the one block of the figure plugged into it", async () => {
        load();
        changed.mockClear();
        await select(blocks("variables_set")[0]);
        expect(editor.take("c")).toBe(true);
        await written("n = c;");
    });

    it("leaves the click to the figure without an object to name", async () => {
        load();
        await select(blocks("math_arithmetic")[0]);
        expect(editor.take("c")).toBe(false);
        await select(blocks("dg_turtle")[0]);
        expect(editor.take("c")).toBe(false);
    });

    it("keeps a turtle's menu on a turtle", async () => {
        load();
        const length = blocks("turtle_length")[0];
        await select(length);
        expect(editor.take("b")).toBe(true);
        expect(length.getFieldValue("NAME")).toBe("A");
    });

    it("forgets the block for a click in the blocks' void", async () => {
        load();
        const object = blocks("dg_object")[0];
        await select(object);
        await userEvent.click(host, { position: { x: 500, y: 400 } });
        await userEvent.click(outside);
        expect(editor.take("b")).toBe(false);
        expect(object.getSvgRoot().classList.contains("blocklySelected")).toBe(
            false,
        );
    });
});
