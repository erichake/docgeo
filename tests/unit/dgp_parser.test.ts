import { describe, expect, it } from "vitest";
import { parseDgp } from "../../src/import/dgp_parser";

describe("DGP parser", () => {
    it("parses calls, assignments, references and literals", () => {
        expect(
            parseDgp(`// Geometry
Élément=Point("A\\"B",-1.5e2,2);
Configure([Élément,true,false,null]);`),
        ).toEqual([
            {
                variable: "Élément",
                name: "Point",
                arguments: [
                    { type: "literal", value: 'A"B' },
                    { type: "literal", value: -150 },
                    { type: "literal", value: 2 },
                ],
                line: 2,
            },
            {
                variable: null,
                name: "Configure",
                arguments: [
                    {
                        type: "array",
                        items: [
                            { type: "reference", name: "Élément" },
                            { type: "literal", value: true },
                            { type: "literal", value: false },
                            { type: "literal", value: null },
                        ],
                    },
                ],
                line: 3,
            },
        ]);
    });

    it("ignores DGPad macro definitions", () => {
        const source = `// Macros :
$macros={};
$macros["M"]={
	name:"M",
	parameters:["point"],
	exec:
	function (A){
// l'image de A : { [
B=Point("B","A+[1,0]","1");
STL(B,"c:#30614f;s:7");
return [B];
}};

// Geometry :
P=Point("P",1,2);`;
        expect(parseDgp(source)).toEqual([
            {
                variable: "P",
                name: "Point",
                arguments: [
                    { type: "literal", value: "P" },
                    { type: "literal", value: 1 },
                    { type: "literal", value: 2 },
                ],
                line: 15,
            },
        ]);
    });

    it("repairs texts encoded in UTF-8 more than once", () => {
        const texts = parseDgp(
            `T("Interm\\u00c3\\u0083\\u00c2\\u00a9diaire","Été","Ã©tÃ©","€");`,
        )[0].arguments.map((value) => (value as { value: string }).value);
        expect(texts).toEqual(["Intermédiaire", "Été", "été", "€"]);
    });

    it("reads strings as JavaScript does, which JSON wouldn't", () => {
        const [call] = parseDgp('T("l\\\'eau\tici","\\x41\\u00e9\\q");');
        expect(call.arguments).toEqual([
            { type: "literal", value: "l'eau\tici" },
            { type: "literal", value: "Aéq" },
        ]);
    });

    it("reads identifiers spelled with escapes as JavaScript does", () => {
        const [, call] = parseDgp(
            'F\\u03C0=Point("F",1,2);F\\u03C01=Symmetry("G",\\u{3C0}\\u{1D49C},F\\u03c0);',
        );
        expect(call).toMatchObject({
            variable: "Fπ1",
            arguments: [
                { type: "literal", value: "G" },
                { type: "reference", name: "π𝒜" },
                { type: "reference", name: "Fπ" },
            ],
        });
        expect(() => parseDgp('F\\u0028=Point("F",1,2);')).toThrow(
            "Invalid DGP syntax",
        );
    });

    it("keeps a Blockly program's object whole, on its lines", () => {
        const calls = parseDgp(`BLK(P1,{"onlogo":{"xml":"<xml a=\\"}\\">",
"js":[1,{"b":2}]}});
BLK_GLOB_SET({"Theta":0});
P=Point("P",1,2);`);
        expect(calls.map(({ name, line }) => [name, line])).toEqual([
            ["BLK", 1],
            ["BLK_GLOB_SET", 3],
            ["Point", 4],
        ]);
        expect(calls[0].arguments[1]).toEqual({
            type: "literal",
            value: `{"onlogo":{"xml":"<xml a=\\"}\\">",
"js":[1,{"b":2}]}}`,
        });
    });

    it("rejects general JavaScript syntax", () => {
        expect(() =>
            parseDgp(`window.location="https://example.com";`),
        ).toThrow("Invalid DGP syntax at line 1");
    });
});
