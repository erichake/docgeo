import * as Blockly from "blockly/core";
import { describe, expect, it, vi } from "vitest";
import { blocksEditor } from "../../src/editor/blocks/workspace";
import { parseProgram } from "../../src/import/dgp_formula";

const source = (point: string) =>
    `TURTLE_INIT("${point}", ${point});\nvar t;\nfunction carre(n) {\n    TURTLE_MV(n, false);\n}\nt = 2;\ncarre(t);\nTURTLE_TURN(90°);\nM.setHidden(1);\nreturn TURTLE_RESULT();`;
const empty = (point: string) =>
    `TURTLE_INIT("${point}", ${point});\nreturn TURTLE_RESULT();`;

async function setup() {
    const host = document.createElement("div");
    host.style.cssText = "width:800px;height:600px";
    const outside = document.createElement("button");
    document.body.append(host, outside);
    const actions = {
        changed: vi.fn(),
        open: vi.fn(),
        start: vi.fn(),
        removed: vi.fn(),
    };
    const editor = await blocksEditor(
        host,
        {
            lang: "en",
            format: (name) => name,
            objects: () => ["A", "B"],
            turtles: () => [],
            globals: () => [],
            dialog: () => {},
        },
        actions,
    );
    const workspace = Blockly.getMainWorkspace() as Blockly.WorkspaceSvg;
    const load = (point: string, program: string, starts: string[] = []) =>
        editor.load(
            [
                {
                    hat: { key: point, kind: "turtle", object: point },
                    program: parseProgram(program),
                },
            ],
            point,
            true,
            point,
            starts,
        );
    return { outside, actions, editor, workspace, load };
}

const menu = (id: string) =>
    Blockly.ContextMenuRegistry.registry.getItem(id) as Exclude<
        Blockly.ContextMenuRegistry.RegistryItem,
        { separator: true }
    >;

// A menu item chosen, on `block` or on the workspace.
function choose(
    id: string,
    workspace: Blockly.WorkspaceSvg,
    block?: Blockly.BlockSvg,
) {
    const event = new Event("pointerdown");
    menu(id).callback(
        block ? { block } : { workspace },
        event,
        event,
        new Blockly.utils.Coordinate(300, 300),
    );
}

const MAC = navigator.platform.startsWith("Mac");
const key = (code: number) =>
    new KeyboardEvent("keydown", {
        keyCode: code,
        metaKey: MAC,
        ctrlKey: !MAC,
    });

describe("copying and pasting blocks", async () => {
    const { outside, actions, editor, workspace, load } = await setup();
    const tops = () => workspace.getTopBlocks(true);
    const settled = (count: number) =>
        expect.poll(() => actions.changed.mock.calls.length).toBe(count);

    it("offers them in the menus, the paste only with blocks copied", () => {
        localStorage.removeItem("docgeo-blocks-clipboard");
        load("A", source("A"));
        expect(
            menu("dg_copy_all").preconditionFn({ workspace }, new Event("x")),
        ).toBe("enabled");
        expect(
            menu("dg_copy_selected").preconditionFn(
                { block: tops()[0] },
                new Event("x"),
            ),
        ).toBe("enabled");
        expect(
            menu("dg_paste_workspace").preconditionFn(
                { workspace },
                new Event("x"),
            ),
        ).toBe("disabled");
        choose("dg_copy_all", workspace);
        expect(
            menu("dg_paste_block").preconditionFn(
                { block: tops()[0] },
                new Event("x"),
            ),
        ).toBe("enabled");
    });

    it("starts the program of another object, under which the blocks go, its procedures with them", async () => {
        load("A", source("A"));
        choose("dg_copy_all", workspace);
        actions.changed.mockClear();
        editor.load([], "", true, "B", ["turtle"]);
        expect(tops()).toEqual([]);
        choose("dg_paste_workspace", workspace);
        expect(actions.start).toHaveBeenCalledWith("turtle");
        load("B", empty("B"));
        await settled(1);
        const [[key, program]] = actions.changed.mock.calls[0][0];
        expect(key).toBe("B");
        expect(program).toBe(source("B"));
    });

    it("keeps the object's own program and procedure, the blocks beside them", async () => {
        load("A", source("A"));
        choose("dg_copy_all", workspace);
        actions.changed.mockClear();
        const before = tops().length;
        choose("dg_paste_workspace", workspace);
        expect(tops().length).toBe(before + 1);
        await new Promise((done) => setTimeout(done, 400));
        expect(actions.changed).not.toHaveBeenCalled();
    });

    it("copies a block with those under it and the procedures they call", () => {
        load("A", source("A"));
        const stack = tops().find(({ type }) => type === "dg_turtle")!;
        const set = stack.getNextBlock()!;
        const call = set.getNextBlock()! as Blockly.BlockSvg;
        choose("dg_copy_selected", workspace, call);
        const copied = JSON.parse(
            localStorage.getItem("docgeo-blocks-clipboard")!,
        );
        expect(copied.map(({ type }: { type: string }) => type)).toEqual([
            "procedures_callnoreturn",
            "procedures_defnoreturn",
        ]);
        expect(copied[0].next.block.type).toBe("turtle_turn");
    });

    it("pastes a variable by its name, wherever its id comes from", async () => {
        load("A", source("A"));
        const set = tops()
            .find(({ type }) => type === "dg_turtle")!
            .getNextBlock()!;
        choose("dg_copy_selected", workspace, set as Blockly.BlockSvg);
        expect(localStorage.getItem("docgeo-blocks-clipboard")).toContain(
            '"VAR":{"name":"t"}',
        );
        load("B", empty("B"));
        actions.changed.mockClear();
        choose("dg_paste_workspace", workspace);
        const pasted = tops().find(({ type }) => type === "variables_set")!;
        expect(pasted.getField("VAR")!.getText()).toBe("t");
        const hat = tops().find(({ type }) => type === "dg_turtle")!;
        hat.nextConnection!.connect(pasted.previousConnection!);
        await settled(1);
        expect(actions.changed.mock.calls[0][0][0][1]).toContain("t = 2;");
    });

    it("copies a folded stack, not the block standing for it", () => {
        load("A", source("A"));
        const hat = tops().find(({ type }) => type === "dg_turtle")!;
        menu("dg_fold_stack").callback(
            { block: hat },
            new Event("x"),
            new Event("x"),
            new Blockly.utils.Coordinate(0, 0),
        );
        const folded = tops().find(({ type }) => type === "dg_turtle")!;
        expect(folded.getNextBlock()).toBeNull();
        choose("dg_copy_selected", workspace, folded);
        const [state] = JSON.parse(
            localStorage.getItem("docgeo-blocks-clipboard")!,
        );
        expect(state.next.block.type).toBe("variables_set");
        menu("dg_fold_stack").callback(
            { block: folded },
            new Event("x"),
            new Event("x"),
            new Blockly.utils.Coordinate(0, 0),
        );
    });

    it("undoes a paste at once", async () => {
        load("A", source("A"));
        const stack = tops().find(({ type }) => type === "dg_turtle")!;
        choose("dg_copy_all", workspace);
        const before = workspace.getAllBlocks(false).length;
        workspace.clearUndo();
        choose("dg_paste_workspace", workspace);
        expect(stack.isDisposed()).toBe(false);
        expect(workspace.getAllBlocks(false).length).toBeGreaterThan(before);
        // Blockly records its events on the next tick.
        await new Promise((done) => setTimeout(done));
        workspace.undo(false);
        expect(workspace.getAllBlocks(false).length).toBe(before);
    });

    it("pastes twice without one paste hiding the other", () => {
        load("A", source("A"));
        const set = tops()
            .find(({ type }) => type === "dg_turtle")!
            .getNextBlock()!;
        choose("dg_copy_selected", workspace, set as Blockly.BlockSvg);
        choose("dg_paste_workspace", workspace);
        choose("dg_paste_workspace", workspace);
        const [first, second] = tops().filter(
            ({ type }) => type === "variables_set",
        );
        expect(
            Blockly.utils.Coordinate.distance(
                first.getRelativeToSurfaceXY(),
                second.getRelativeToSurfaceXY(),
            ),
        ).toBeGreaterThan(1);
    });

    it("pastes from the keyboard only with the focus in the blocks", () => {
        const shortcuts = Blockly.ShortcutRegistry.registry;
        const paste = () =>
            shortcuts.onKeyDown(workspace, key(Blockly.utils.KeyCodes.V));
        load("A", source("A"));
        const count = () => tops().length;
        const before = count();
        outside.focus();
        expect(paste()).toBe(false);
        expect(count()).toBe(before);
        Blockly.getFocusManager().focusTree(workspace);
        expect(paste()).toBe(true);
        expect(count()).toBeGreaterThan(before);
    });
});
