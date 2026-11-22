// Giac's answers (see CAS.md), computed in its module's worker, loaded the
// first time a request isn't already answered, and read synchronously from
// the cache. A request is a text DocGeo builds, never one of the figure.

// Giac's answer, or none (Giac's error, out of time or memory).
export type CasResult = string | null;

// Errors with an answer: Giac's, a calculation out of time or memory, which
// asked again would fail again. Any other means no Giac.
const ANSWERED = new Set(["giac", "timeout", "crash"]);
// The answers kept, the most recently read last.
const KEPT = 2000;

// `Site`: where a formula asks (its node), which keeps its last result
// while the next one is computed; `R`: what reads results, computed again
// when they arrive.
export class CasCache<R> {
    private results = new Map<string, CasResult>();
    // The requests to send, in order, each with the sites that wait for
    // it: a site asking for another request is no longer waiting for its
    // previous one, which unwaited is never sent.
    private wanted = new Map<string, Set<object>>();
    private asked = new WeakMap<object, string>();
    private last = new WeakMap<object, CasResult>();
    private readers = new Map<string, Set<R>>();
    private sent: string | null = null;
    missing = false;

    constructor(
        private evaluate: (request: string) => Promise<string>,
        private arrived: (readers: Set<R>) => void,
        private failed: () => void,
    ) {}

    // The answer to the request, else the site's last one, undefined if it
    // never had any.
    read(site: object, request: string, reader?: R): CasResult | undefined {
        if (this.results.has(request)) {
            const result = this.results.get(request)!;
            this.results.delete(request);
            this.results.set(request, result);
            this.asked.delete(site);
            this.last.set(site, result);
            return result;
        }
        if (this.missing) return this.last.get(site);
        if (reader)
            (
                this.readers.get(request) ??
                this.readers.set(request, new Set()).get(request)!
            ).add(reader);
        const previous = this.asked.get(site);
        if (previous !== request) {
            this.asked.set(site, request);
            const waiting = previous && this.wanted.get(previous);
            if (waiting) {
                waiting.delete(site);
                if (!waiting.size) {
                    this.wanted.delete(previous);
                    this.readers.delete(previous);
                }
            }
            if (request !== this.sent)
                (
                    this.wanted.get(request) ??
                    this.wanted.set(request, new Set()).get(request)!
                ).add(site);
            this.send();
        }
        return this.last.get(site);
    }

    private send(): void {
        const [request] = this.wanted.keys();
        if (this.sent !== null || request === undefined) return;
        this.wanted.delete(request);
        this.sent = request;
        this.evaluate(request)
            .then(
                (result) => this.store(request, result),
                (error) =>
                    ANSWERED.has(error?.code)
                        ? this.store(request, null)
                        : this.fail(),
            )
            .then(() => {
                this.sent = null;
                if (!this.missing) this.send();
            });
    }

    private store(request: string, result: CasResult): void {
        this.results.set(request, result);
        if (this.results.size > KEPT)
            this.results.delete(this.results.keys().next().value!);
        const readers = this.readers.get(request);
        this.readers.delete(request);
        if (readers) this.arrived(readers);
    }

    private fail(): void {
        this.missing = true;
        this.wanted.clear();
        this.readers.clear();
        this.failed();
    }
}
