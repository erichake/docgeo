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

    it("rejects general JavaScript syntax", () => {
        expect(() =>
            parseDgp(`window.location="https://example.com";`),
        ).toThrow("Invalid DGP syntax at line 1");
    });
});
