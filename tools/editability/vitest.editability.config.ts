import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Opens every test figure and every figure of the GeoGebra corpus as the
// editor does into results.jsonl, which summary.py then summarizes: see
// EDITOR.md, section « Mesure de l'éditabilité ».
export default defineConfig({
    test: {
        include: ["tools/editability/editability.test.ts"],
        browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
        },
    },
});
