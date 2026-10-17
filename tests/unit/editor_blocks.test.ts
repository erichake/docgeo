/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import {
    evaluateProgram,
    NO_VIEW,
    parseProgram,
    type FormulaEnv,
} from "../../src/import/dgp_formula";
import {
    blocksProgram as programOf,
    programBlocks as blocksOf,
    type WorkspaceState,
} from "../../src/editor/blocks/program_blocks";
import { formatName } from "../../src/editor/text";
import { BLOCK_MESSAGES } from "../../src/editor/blocks/messages";

const blocksProgram = (state: WorkspaceState) => programOf(state, formatName);
const programBlocks = (source: string, degrees: boolean) =>
    blocksOf(parseProgram(source), degrees);

const NUMBERS: Record<string, number> = { n: 4, max: 3, a: 2, b: -5, c: 0.5 };

// What the program computes, and the styles it sets.
function run(source: string, degrees = true) {
    const styles: unknown[] = [];
    const env: FormulaEnv = {
        resolveIdentifier: (name) => NUMBERS[name] ?? [1, 2],
        view: () => ({ ...NO_VIEW, unit: 40, degrees }),
        callMethod: (object, method, args) =>
            styles.push([object, method, args]),
    };
    return { value: evaluateProgram(parseProgram(source), env), styles };
}

function close(a: unknown, b: unknown): boolean {
    if (typeof a === "number" && typeof b === "number")
        return (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) < 1e-9;
    if (Array.isArray(a) && Array.isArray(b))
        return a.length === b.length && a.every((x, i) => close(x, b[i]));
    return a === b;
}

// Through its blocks, the program computes the same, and its blocks write
// the program they read.
function roundTrip(source: string, degrees = true): string {
    const blocks = programBlocks(source, degrees);
    expect(blocks, source).not.toBeNull();
    const written = blocksProgram(blocks!)!;
    const before = run(source, degrees);
    const after = run(written, degrees);
    expect(close(after.value, before.value), written).toBe(true);
    expect(close(after.styles, before.styles), written).toBe(true);
    expect(blocksProgram(programBlocks(written, degrees)!)).toBe(written);
    return written;
}

const FIGURES = import.meta.glob<string>(
    [
        "../dgp/partage_dgpad.dgp",
        "../dgp/Yves/Remplissage_P237_SurfaceKlein.dgp",
        "../dgp/Monique/Pythagore_en_liquide.dgp",
    ],
    { query: "?raw", import: "default", eager: true },
);

// DGPad's turtles in a figure, their programs compiled by its Blockly.
function turtles(path: string): string[] {
    return [
        ...FIGURES[path].matchAll(
            /Expression\("blk_turtle_exp_[^"]*","","","",("(?:[^"\\]|\\.)*")/g,
        ),
    ].map((match) => JSON.parse(match[1]) as string);
}

describe("Program blocks", () => {
    it.each(Object.keys(FIGURES))("reads the turtles of %s", (path) => {
        const programs = turtles(path);
        expect(programs.length).toBeGreaterThan(0);
        programs.forEach((program) => roundTrip(program));
    });

    it("writes a turtle's program plainly", () => {
        expect(
            roundTrip(`var bl_x=function(){
TURTLE_INIT("P1",P1);
blockly_var_m = 40;
for (var blockly_var_count = 1 ; blockly_var_count <= 4 ; blockly_var_count++){
  TURTLE_MV(-blockly_var_m,true);
  TURTLE_TURN(-(90));
};
TURTLE_PRINT(('$$'+String(TURTLE_TEXT('a')) + String('')+'$$'));
return TURTLE_RESULT()
};
bl_x()`),
        ).toBe(`TURTLE_INIT("P1", P1);
m = 40;
for (var k = 1; k <= 4; k = k + 1) {
    TURTLE_MV(-m, true);
    TURTLE_TURN(-90°);
}
TURTLE_PRINT("$$a$$");
return TURTLE_RESULT();`);
    });

    it.each([
        "(a + b) * c - -b",
        "a - (b - c)",
        "a / (b * c)",
        "-(2 ^ a)",
        "(-2) ^ a",
        "2 ^ -a",
        "(a ^ 2) ^ c",
        "a % 3 + b % 2",
        "a < b == c > b",
        "!(a < b) && (b < c || a == 2)",
        "a > 1 ? a < 3 ? 1 : 2 : 3",
        "sqrt(abs(b)) + floor(c) + round(2.5) + ceil(c) + exp(c) + log(a)",
        "sin(30) + cos(60°) + atan(1)",
        '"x = " + (a + 1) + " ; " + a * 2',
        '1 + 2 + "s" + 3',
        "d(P, Q) + x(P) - y([a, 2])",
        "[a, b, c]",
        "Math.PI * a",
    ])("computes %s the same", (formula) => {
        roundTrip(formula);
    });

    it("reads statements", () => {
        roundTrip(`var s = 0;
for (var i = 2; i <= 10; i += 2) { s += i; }
if (s > 100) { s = 1; } else if (s > 20) { s = 2; } else { s = 3; }
while (s < 50) { s = s * 3; }
while (!(s > 1000)) s = s * 2;
if (a) S1.setHidden(1);
S2.setRGBColor(255, 0, a);
return s;`);
        roundTrip("var t = 0; for (var k = 1; k <= n; k++) { t = t + k; } t");
    });

    it("draws turtles in degrees whatever the figure's unit", () => {
        const turn = `TURTLE_INIT("P", P);
TURTLE_TURN(30);
TURTLE_MV(2, false);
TURTLE_ROTATE(-45, true);
TURTLE_ROTATE(10, false);
return TURTLE_RESULT();`;
        roundTrip(turn);
        expect(programBlocks(turn, false)).toBeNull();
        roundTrip(turn.replace(/\((-?\d+)(,|\))/g, "($1°$2"), false);
    });

    it("refuses what has no block", () => {
        [
            "function f(x) { return x; } f(2)",
            "var t = []; t.push(1); t",
            "L[0]",
        ].forEach((source) => expect(programBlocks(source, true)).toBeNull());
    });

    it("ignores the blocks left apart", () => {
        expect(
            blocksProgram({
                blocks: {
                    languageVersion: 0,
                    blocks: [
                        { type: "turtle_reset" },
                        {
                            type: "dg_turtle",
                            data: "A 1",
                            fields: { POINT: "A 1" },
                        },
                    ],
                },
            }),
        ).toBe('TURTLE_INIT("A 1", `A 1`);\nreturn TURTLE_RESULT();');
        expect(blocksProgram({})).toBeNull();
    });

    it("speaks the editor's languages", () => {
        const inputs = (text: string) =>
            (text.match(/%\d/g) ?? []).sort().join();
        const { en, ...others } = BLOCK_MESSAGES;
        expect(Object.keys(others).sort()).toEqual([
            "ar",
            "de",
            "el",
            "es",
            "fr",
            "hi",
            "it",
            "nl",
            "pt",
            "zh",
            "zh-TW",
        ]);
        Object.values(others).forEach((texts) =>
            Object.entries(en).forEach(([key, text]) =>
                expect(inputs(texts[key as keyof typeof en]), key).toBe(
                    inputs(text),
                ),
            ),
        );
    });
});
