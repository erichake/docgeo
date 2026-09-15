import type { construction } from "./construction";
import { executeDgpCommands } from "./import/dgp_commands";
import { parseDgp } from "./import/dgp_parser";

export function importDgp(c: construction, source: string): void {
    executeDgpCommands(c, parseDgp(source));
}

export async function importDgpFromUrl(
    c: construction,
    url: string,
): Promise<void> {
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`Unable to load DGP file: ${response.status}`);
    importDgp(c, await response.text());
}
