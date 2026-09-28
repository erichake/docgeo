import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Imports every figure of corpus/ (see collect.py) into results.jsonl, which
// roots.py then summarizes: see GGB_IMPORT.md.
export default defineConfig({
    test: {
        include: ["tools/ggb_corpus/corpus.test.ts"],
        browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
        },
    },
});
