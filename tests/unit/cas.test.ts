import { describe, expect, it } from "vitest";
import { CasCache } from "../../src/cas_cache";

class GiacError extends Error {
    constructor(public code: string) {
        super(code);
    }
}

// A Giac answering by hand: each request sent waits for `answer`.
function setup() {
    const sent: string[] = [];
    const pending = new Map<string, (result: Promise<string>) => void>();
    const arrived: string[][] = [];
    let failures = 0;
    const cache = new CasCache<string>(
        (request) => {
            sent.push(request);
            return new Promise((resolve) =>
                pending.set(request, (result) => resolve(result)),
            );
        },
        (readers) => arrived.push([...readers]),
        () => failures++,
    );
    const answer = async (request: string, result: string | Error) => {
        pending.get(request)!(
            result instanceof Error
                ? Promise.reject(result)
                : Promise.resolve(result),
        );
        pending.delete(request);
        await new Promise((resolve) => setTimeout(resolve));
    };
    return { cache, sent, arrived, answer, failures: () => failures };
}

describe("CAS cache", () => {
    it("answers synchronously once the result arrived, the readers computed again", async () => {
        const { cache, sent, arrived, answer } = setup();
        const site = {};
        expect(cache.read(site, "factor(x^2-1)", "A")).toBeUndefined();
        expect(cache.read({}, "factor(x^2-1)", "B")).toBeUndefined();
        expect(sent).toEqual(["factor(x^2-1)"]);
        await answer("factor(x^2-1)", "(x-1)*(x+1)");
        expect(arrived).toEqual([["A", "B"]]);
        expect(cache.read(site, "factor(x^2-1)", "A")).toBe("(x-1)*(x+1)");
        expect(sent).toHaveLength(1);
    });

    it("keeps a site's last result while its next request is computed", async () => {
        const { cache, answer } = setup();
        const site = {};
        cache.read(site, "diff(x^2)");
        await answer("diff(x^2)", "2*x");
        expect(cache.read(site, "diff(x^2)")).toBe("2*x");
        expect(cache.read(site, "diff(x^3)")).toBe("2*x");
        await answer("diff(x^3)", "3*x^2");
        expect(cache.read(site, "diff(x^3)")).toBe("3*x^2");
    });

    it("replaces a request not yet sent rather than queueing it", async () => {
        const { cache, sent, arrived, answer } = setup();
        const site = {};
        cache.read({}, "busy", "A");
        cache.read(site, "a=1", "B");
        cache.read(site, "a=2", "B");
        cache.read(site, "a=3", "B");
        await answer("busy", "0");
        expect(sent).toEqual(["busy", "a=3"]);
        await answer("a=3", "3");
        expect(arrived).toEqual([["A"], ["B"]]);
    });

    it("sends a request still waited for by another site", async () => {
        const { cache, sent, answer } = setup();
        const [site, other] = [{}, {}];
        cache.read({}, "busy");
        cache.read(site, "same");
        cache.read(other, "same");
        cache.read(site, "next");
        await answer("busy", "0");
        expect(sent).toEqual(["busy", "same"]);
        await answer("same", "1");
        expect(sent).toEqual(["busy", "same", "next"]);
    });

    it("keeps Giac's errors, time limits and crashes as no result", async () => {
        const { cache, sent, answer } = setup();
        const site = {};
        cache.read(site, "1/0+");
        await answer("1/0+", new GiacError("giac"));
        expect(cache.read(site, "1/0+")).toBeNull();
        cache.read(site, "while true do od");
        await answer("while true do od", new GiacError("timeout"));
        expect(cache.read(site, "while true do od")).toBeNull();
        expect(sent).toHaveLength(2);
    });

    it("stops asking once Giac is missing, results kept", async () => {
        const { cache, sent, answer, failures } = setup();
        const site = {};
        cache.read(site, "2+2");
        await answer("2+2", "4");
        expect(cache.read(site, "2+2")).toBe("4");
        cache.read(site, "3+3");
        cache.read({}, "4+4");
        await answer("3+3", new TypeError("Failed to fetch"));
        expect(failures()).toBe(1);
        expect(cache.missing).toBe(true);
        expect(cache.read(site, "5+5")).toBe("4");
        expect(cache.read({}, "2+2")).toBe("4");
        expect(sent).toEqual(["2+2", "3+3"]);
    });
});
