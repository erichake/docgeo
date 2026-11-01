import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Imports every CaRMetal figure of tests/zirz into results.jsonl, which
// roots.py then summarizes: see CARMETAL.md.
export default defineConfig({
    test: {
        include: ["tools/zir_corpus/*.test.ts"],
        browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
        },
    },
});
