import { describe, expect, it, vi } from "vitest";
// First, as in main.ts: the object classes import each other.
import "../../src/construction";
import { readCas } from "../../src/cas";
import type { construction_object } from "../../src/objects/construction_object";
import { reading } from "../../src/sheet";

describe("Giac", () => {
    it("is loaded on demand, its answers computing their readers again", async () => {
        const computed: unknown[] = [];
        const object = {
            C: { invalidateGeometry: (o: unknown) => computed.push(o) },
        } as unknown as construction_object;
        const site = {};
        reading.object = object;
        expect(readCas(site, "factor(x^4-1)")).toBeUndefined();
        expect(readCas({}, "factor(")).toBeUndefined();
        reading.object = null;
        await vi.waitFor(() => expect(computed).toHaveLength(2), {
            timeout: 20000,
        });
        expect(computed).toEqual([object, object]);
        expect(readCas(site, "factor(x^4-1)")).toBe("(x-1)*(x+1)*(x^2+1)");
        expect(readCas({}, "factor(")).toBeNull();
        expect(document.body.textContent).not.toContain("⚠ Giac");
    });
});
