/// <reference types="vite/client" />
import { describe, expect, it, vi } from "vitest";
import {
    blocklySource,
    evaluateProgram,
    NO_VIEW,
    parseProgram,
    type FormulaEnv,
    type ScriptValue,
} from "../../src/import/dgp_formula";
import {
    blocksProgram as programOf,
    programBlocks as blocksOf,
    stackState,
    type WorkspaceState,
} from "../../src/editor/blocks/program_blocks";
import { formatName } from "../../src/editor/text";
import { parseDgp } from "../../src/import/dgp_parser";
import { BLOCK_MESSAGES } from "../../src/editor/blocks/messages";

const blocksProgram = (state: WorkspaceState) => programOf(state, formatName);
const programBlocks = (source: string, degrees: boolean) =>
    blocksOf(parseProgram(source), degrees, formatName);

const NUMBERS: Record<string, number> = { n: 4, max: 3, a: 2, b: -5, c: 0.5 };

// A point of its own for each name.
function pointOf(name: string): [number, number] {
    const hash = [...name].reduce(
        (h, c) => (h * 31 + c.charCodeAt(0)) % 1000003,
        7,
    );
    return [(hash % 13) - 6, (Math.floor(hash / 13) % 11) - 5];
}

// What the program computes, and the styles it sets. The names of `numbers`
// are numbers, the others points, apart; the globals keep what they are set
// to.
function run(source: string, degrees = true, numbers = new Set<string>()) {
    const styles: unknown[] = [];
    const globals = new Map<string, unknown>();
    const env: FormulaEnv = {
        resolveIdentifier: (name) =>
            (globals.get(name) as ScriptValue) ??
            NUMBERS[name] ??
            (numbers.has(name) ? 3 : pointOf(name)),
        view: () => ({ ...NO_VIEW, unit: 40, degrees }),
        callMethod: (object, method, args) => {
            styles.push([object, method, args]);
            if (object.startsWith("GLOBAL ") && method === "setExpression")
                globals.set(object, args[0]);
        },
    };
    return { value: evaluateProgram(parseProgram(source), env), styles };
}

function close(a: unknown, b: unknown): boolean {
    if (typeof a === "number" && typeof b === "number")
        return (
            a === b ||
            (Number.isNaN(a) && Number.isNaN(b)) ||
            Math.abs(a - b) < 1e-9
        );
    if (Array.isArray(a) && Array.isArray(b))
        return a.length === b.length && a.every((x, i) => close(x, b[i]));
    return a === b;
}

// Through its blocks, the program computes the same, and its blocks write
// the program they read.
function roundTrip(
    source: string,
    degrees = true,
    numbers?: Set<string>,
): string {
    const blocks = programBlocks(source, degrees);
    expect(blocks, source).not.toBeNull();
    const written = blocksProgram(blocks!)!;
    const before = run(source, degrees, numbers);
    const after = run(written, degrees, numbers);
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
        "../dgp/Yves_07_Blockly/*.dgp",
        "../dgp/Blockly/pirates.dgp",
    ],
    { query: "?raw", import: "default", eager: true },
);

const BUTTONS = import.meta.glob<string>("../dgp/Blockly/urne_et_boules.dgp", {
    query: "?raw",
    import: "default",
    eager: true,
})["../dgp/Blockly/urne_et_boules.dgp"];

const PIRATES = import.meta.glob<string>("../dgp/Blockly/pirates.dgp", {
    query: "?raw",
    import: "default",
    eager: true,
})["../dgp/Blockly/pirates.dgp"];

const EVENTS = import.meta.glob<string>("../dgp/Yves_10_Blockly/*.dgp", {
    query: "?raw",
    import: "default",
    eager: true,
});

// DGPad's turtles in a figure, their programs compiled by its Blockly.
// Their strings keep DGPad's escaped quotes, which JSON refuses.
function turtles(path: string): string[] {
    return [
        ...FIGURES[path].matchAll(
            /Expression\("blk_turtle_exp_[^"]*","","","",("(?:[^"\\]|\\.)*")/g,
        ),
    ].map((match) => JSON.parse(match[1].replace(/\\'/g, "\\\\'")) as string);
}

const BLOCKLY = import.meta.glob<string>("../dgp/**/*.dgp", {
    query: "?raw",
    import: "default",
    eager: true,
});

// The Blockly programs of a figure, as its import gives them to the editor,
// but DGPad's "restrictions", dropped, in the figure's unit of angles, and
// the names of its expressions and globals.
function blocklyPrograms(text: string): {
    degrees: boolean;
    programs: [string, string][];
    numbers: Set<string>;
} {
    let degrees = true;
    const programs: [string, string][] = [];
    const numbers = new Set<string>();
    parseDgp(text).forEach(
        ({ variable, name, arguments: [target, source] }) => {
            if (name.startsWith("Expression")) numbers.add(variable!);
            if (name === "SetGeneralStyle") {
                const degree = /degree:(\w+)/.exec(
                    String((target as { value: string }).value),
                );
                if (degree) degrees = degree[1] === "true";
            }
            if (name !== "BLK" || target.type !== "reference") return;
            const modes = JSON.parse(
                String((source as { value: string }).value),
            );
            Object.keys(modes).forEach((mode) => {
                const program = blocklySource(modes, mode, target.name);
                if (
                    program !== null &&
                    !program.includes(
                        "ceci_est_un_texte_a_chercher_dans_moi_meme",
                    )
                )
                    programs.push([`${target.name}.${mode}`, program]);
            });
        },
    );
    programs.forEach(([, program]) =>
        [...program.matchAll(/GLOBAL_\w+\("([^"]*)"/g)].forEach(([, global]) =>
            numbers.add(`GLOBAL ${global}`),
        ),
    );
    return { degrees, programs, numbers };
}

describe("Program blocks", () => {
    it("opens every Blockly program of the test figures in blocks", () => {
        vi.spyOn(Math, "random").mockReturnValue(0.3);
        const failing = Object.entries(BLOCKLY)
            .filter(([, text]) => {
                const { degrees, programs, numbers } = blocklyPrograms(text);
                if (
                    programs.some(([, program]) =>
                        program.includes("GetCanvas"),
                    )
                )
                    return false;
                return programs.some(([, program]) => {
                    try {
                        roundTrip(program, degrees, numbers);
                        return false;
                    } catch {
                        return true;
                    }
                });
            })
            .map(([path]) => path.slice("../dgp/".length));
        vi.restoreAllMocks();
        // Those whose programs don't all open in blocks (see BLOCS_BLOCKLY.md).
        expect(failing).toEqual([]);
    });

    it.each(Object.keys(FIGURES))("reads the turtles of %s", (path) => {
        const programs = turtles(path);
        const { numbers } = blocklyPrograms(FIGURES[path]);
        expect(programs.length).toBeGreaterThan(0);
        programs.forEach((program) => roundTrip(program, true, numbers));
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

    it("keeps DGPad's prefix of a variable named as an object it reads", () => {
        expect(
            roundTrip(`blockly_var_k = (a);
blockly_var_a = 2;
blockly_var_b = 3;
return blockly_var_k + blockly_var_a + blockly_var_b;`),
        ).toBe(`k = a;
blockly_var_a = 2;
b = 3;
return k + blockly_var_a + b;`);
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
        "Math.Angle180(P, Q, R) + Angle360(P, Q, [a, 2])",
        "pixel() * windoww() + windowh() - windowcx() / windowcy() + phi() + theta()",
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

    it("leaves loops with break and continue, but outside of them", () => {
        expect(
            roundTrip(`var s = 0;
for (var i = 1; i <= 10; i++) { if (i == 3) { continue; } if (i > 6) break; s += i; }
while (s > 0) { s = s - 4; if (s < 10) { break; } }
return s;`),
        ).toBe(`s = 0;
for (var i = 1; i <= 10; i = i + 1) {
    if (i == 3) {
        continue;
    }
    if (i > 6) {
        break;
    }
    s = s + i;
}
while (s > 0) {
    s = s - 4;
    if (s < 10) {
        break;
    }
}
return s;`);
        const state = programBlocks("while (a) { break; } 1", true)!;
        const root = state.blocks!.blocks[0];
        const loop = root.next!.block!;
        expect(loop.type).toBe("controls_whileUntil");
        root.next = { block: { ...loop.inputs!.DO.block!, next: loop.next } };
        expect(blocksProgram(state)).toBe("return 1;");
    });

    it("sets the value of expressions, as DGPad's buttons", () => {
        expect(
            roundTrip(`SET_EXP("de1", Math.floor(c * 6) + 1);
a.setExpression(a + 1);`),
        ).toBe(`de1.setExpression(floor(c * 6) + 1);
a.setExpression(a + 1);`);
    });

    it("types in an expression what has no other block, as DGPad", () => {
        expect(
            roundTrip(`blockly_var_t = 2;
blockly_var_L = [3, 1];
blockly_var_s = blockly_var_L.join("\\\\times");
SET_EXP("a", NaN);
return 2 * f(blockly_var_t + 1) + parseInt(blockly_var_s) + (blockly_var_L.toString() + blockly_var_s).split("").reverse().length;`),
        ).toBe(`t = 2;
L = [3, 1];
s = L.join("\\\\times");
a.setExpression(NaN);
return 2 * f(t + 1) + parseInt(s) + ("" + L + s).split("").reverse().length;`);
    });

    it("repeats a whole number of times computed, as Blockly writes it", () => {
        expect(
            roundTrip(`var s = 0;
var repeat_end = Math.round(Math.power(2, a / 3));
for (var count = 0; count < repeat_end; count++) {
  s = s + 1;
}
return s;`),
        ).toBe(`s = 0;
for (var k = 1; k <= round(2 ^ (a / 3)); k = k + 1) {
    s = s + 1;
}
return s;`);
        expect(
            programBlocks(
                "var s = 0; var repeat_end = a / 3; for (var count = 0; count < repeat_end; count++) { s = s + 1; } return s;",
                true,
            ),
        ).toBeNull();
    });

    it("sets the arrows of a List, as DGPad's style block", () => {
        expect(roundTrip('BLK_STL("l1","setArrow",[[16,a]]);')).toBe(
            "l1.setArrow([16, a]);",
        );
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

    it("shows each of Blockly's constants", () => {
        const source =
            "return Math.PI + Math.E * ((1 + Math.sqrt(5)) / 2) - Math.SQRT2 / Math.SQRT1_2 + (a < Infinity ? 1 : 0);";
        const constants = JSON.stringify(programBlocks(source, true)).matchAll(
            /"CONSTANT":"(\w+)"/g,
        );
        expect(new Set([...constants].map((match) => match[1]))).toEqual(
            new Set([
                "PI",
                "E",
                "GOLDEN_RATIO",
                "SQRT2",
                "SQRT1_2",
                "INFINITY",
            ]),
        );
        expect(roundTrip(source)).toBe(
            "return Math.PI + Math.E * ((1 + sqrt(5)) / 2) - Math.SQRT2 / Math.SQRT1_2 + (a < Infinity ? 1 : 0);",
        );
    });

    it("draws at random", () => {
        const program = blocksProgram(
            programBlocks("Math.floor(Math.random() * 6) + 1", true)!,
        );
        expect(program).toBe("return floor(random() * 6) + 1;");
        expect(blocksProgram(programBlocks(program!, true)!)).toBe(program);
    });

    it("refuses what has no block", () => {
        [
            "function f(x) { if (x) return 1; return x; } f(2)",
            "function f(x) { return; } f(2)",
            "L.slice(-2)[0]",
        ].forEach((source) => expect(programBlocks(source, true)).toBeNull());
    });

    it("reads DGPad's lists and random integers", () => {
        vi.spyOn(Math, "random").mockReturnValue(0.7);
        expect(
            roundTrip(`var t = listsRepeat(2, 4);
t[3 - 1] = t[1 - 1] + [a, 5, 1, 2][n] + Math.floor(Math.random() * 6) + [].length;
GLOBAL_SET("R", t);
(GLOBAL_GET("R"))[t.length - 1] = (GLOBAL_GET("R"))[(Math.floor(Math.random()*(Math.abs(1-(n))+1)+(1+(n)-Math.abs(1-(n)))/2))-1];
return [t, [a]][2 - 1][1 - 1] + t.slice(-1)[0] + [t][0].slice(-1)[0];
function listsRepeat(blockly_local_value, blockly_local_n) {
  var blockly_var_array = [];
  for (var blockly_var_i = 0; blockly_var_i < blockly_local_n; blockly_var_i++) {
    blockly_var_array[blockly_var_i] = blockly_local_value;
  }
  return blockly_var_array;
}`),
        ).toBe(`function listsRepeat(value, n) {
    var list = [];
    for (var k = 0; k < n; k++) {
        list[k] = value;
    }
    return list;
}
t = listsRepeat(2, 4);
t[3 - 1] = t[1 - 1] + [a, 5, 1, 2][n + 1 - 1] + floor(random() * 6) + [].length;
GLOBAL_SET("R", t);
GLOBAL_GET("R")[t.length - 1] = GLOBAL_GET("R")[floor(random() * (abs(1 - n) + 1) + (1 + n - abs(1 - n)) / 2) - 1];
return [t, [a]][2 - 1][1 - 1] + t.slice(-1)[0] + [t][1 - 1].slice(-1)[0];`);
        const buttons = [
            ...BUTTONS.matchAll(/^BLK\(blk_btn\d*,(.*)\);$/gm),
        ].map((match) => JSON.parse(match[1]).onprogram.sync as string);
        expect(buttons).toHaveLength(4);
        buttons.forEach((program) => roundTrip(program));
        vi.restoreAllMocks();
    });

    it("appends to lists and shows messages, as the pirates' button", () => {
        expect(
            roundTrip(`var t = [];
t.push([-1, TURTLE_TEXT('a')]);
t[1 - 1].push(n);
t.push([NaN,NaN,NaN]);
t.shift();
t[1 - 1].pop();
ALERT('<b>' + t.length + '</b>');
return t;`),
        ).toBe(`t = [];
t.push([-1, "a"]);
t[1 - 1].push(n);
t.push([NaN, NaN, NaN]);
t.shift();
t[1 - 1].pop();
ALERT("<b>" + t.length + "</b>");
return t;`);
        expect(
            JSON.stringify(
                programBlocks("var t = [];\nt.push([NaN,NaN,NaN]);", true),
            ),
        ).toContain('"dg_list_break"');
        vi.spyOn(Math, "random").mockReturnValue(0.3);
        const { onprogram, oninit } = JSON.parse(
            PIRATES.match(/^BLK\(blk_btn,(.*)\);$/m)![1],
        );
        [onprogram.sync, oninit.sync].forEach((program) => roundTrip(program));
        vi.restoreAllMocks();
    });

    it("writes DGPad's procedures and global variables", () => {
        expect(
            roundTrip(`var bl_x=function(){
TURTLE_INIT("A",A);
// Décrire cette fonction…
function Carr_C3_A9(blockly_local_c) {
  GLOBAL_SET("côté",Math.times(blockly_local_c,2));
  TURTLE_MV(GLOBAL_GET("côté"),false);
  GLOBAL_INC("côté");
}
Carr_C3_A9(3);
Z;
TURTLE_MV(GLOBAL_GET("côté"),false);
return TURTLE_RESULT()
};
bl_x()`),
        ).toBe(`TURTLE_INIT("A", A);
function Carré(c) {
    GLOBAL_SET("côté", c * 2);
    TURTLE_MV(GLOBAL_GET("côté"), false);
    GLOBAL_INC("côté", 1);
}
Z;
Carré(3);
TURTLE_MV(GLOBAL_GET("côté"), false);
return TURTLE_RESULT();`);
    });

    it("reads DGPad's ondrag programs, with their lists' minimum and maximum", () => {
        const programs = Object.values(EVENTS).flatMap((text) =>
            [...text.matchAll(/^BLK\(\w+,(.*)\);$/gm)].map(
                (match) => JSON.parse(match[1]).ondrag.sync as string,
            ),
        );
        expect(programs).toHaveLength(10);
        programs.forEach((program) => roundTrip(program));
        expect(
            roundTrip(
                programs.find((program) => program.includes("Math.min"))!,
            ),
        ).toBe(`temp_var = [0, min(y(M), y(MinAD))];
MinAD.setExpression(temp_var);
temp_var2 = [0, max(y(M), y(MaxAD))];
MaxAD.setExpression(temp_var2);`);
        expect(roundTrip("return (a + b) / 2 + min(a, b, c);")).toBe(
            "return (a + b) / 2 + min(a, b, c);",
        );
    });

    it("reads DGPad's functions, the variables they set their own", () => {
        expect(
            roundTrip(`var bl=function(){
TURTLE_INIT("A",A);
function Milieu(blockly_local_P,blockly_local_Q) {
   var blockly_var_m = Math.quotient(Math.plus(blockly_local_P,blockly_local_Q),2);
  return blockly_var_m;
}
function Cote(blockly_local_k) {
  if (blockly_local_k == 0) {
    TURTLE_MV(1,false);
  } else {
     var blockly_var_m = Math.minus(blockly_local_k,1);
    Cote(blockly_var_m);
    TURTLE_TURN(60);
    Cote(blockly_var_m);
  }
}
blockly_var_m = 5;
TURTLE_JOIN_PT(Milieu((A), (B)));
Cote(3);
TURTLE_MV(blockly_var_m,false);
return TURTLE_RESULT()
};
bl()`),
        ).toBe(`TURTLE_INIT("A", A);
var m;
function Milieu(P, Q) {
    var m;
    m = (P + Q) / 2;
    return m;
}
function Cote(k) {
    var m;
    if (k == 0) {
        TURTLE_MV(1, false);
    } else {
        m = k - 1;
        Cote(m);
        TURTLE_TURN(60°);
        Cote(m);
    }
}
m = 5;
TURTLE_JOIN_PT(Milieu(A, B));
Cote(3);
TURTLE_MV(m, false);
return TURTLE_RESULT();`);
        // As Blockly's, the program's variables, but not some of them.
        expect(
            roundTrip("var m = 1; function f() { m = 2; } f(); return m;"),
        ).toBe(
            "var m;\nfunction f() {\n    m = 2;\n}\nm = 1;\nf();\nreturn m;",
        );
        expect(
            programBlocks(
                "var m = 1; function f() { var n = 2; m = n; } f(); return m;",
                true,
            ),
        ).toBeNull();
    });

    it("writes each program a workspace shows, with the procedures it calls", () => {
        const turtle = programBlocks(
            'TURTLE_INIT("A", A);\nfunction f() {\n    TURTLE_MV(1, true);\n}\nf();\nreturn TURTLE_RESULT();',
            true,
        )!;
        const event = programBlocks("a.setExpression(a + 1);", true)!;
        const [root, procedure] = turtle.blocks!.blocks;
        const hat = {
            ...event.blocks!.blocks[0],
            type: "dg_when_dragged",
            fields: { TEXT: "when A is dragged" },
        };
        const state: WorkspaceState = {
            blocks: { languageVersion: 0, blocks: [root, hat, procedure] },
        };
        expect(blocksProgram(stackState(state, hat))).toBe(
            "a.setExpression(a + 1);",
        );
        expect(blocksProgram(stackState(state, root))).toBe(
            'TURTLE_INIT("A", A);\nfunction f() {\n    TURTLE_MV(1, true);\n}\nf();\nreturn TURTLE_RESULT();',
        );
    });

    it("keeps a value's block left alone, as DGPad's Blockly writes it", () => {
        expect(
            roundTrip(
                'TURTLE_INIT("A", A);\n12;\nZ;\nTURTLE_MV(1, true);\nreturn TURTLE_RESULT();',
            ),
        ).toBe(
            'TURTLE_INIT("A", A);\n12;\nZ;\nTURTLE_MV(1, true);\nreturn TURTLE_RESULT();',
        );
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
