import type { construction } from "./construction";
import { executeDgpCommands } from "./import/dgp_commands";
import { parseDgp } from "./import/dgp_parser";

// Returns what the figure uses that couldn't be imported.
export function importDgp(c: construction, source: string): string[] {
    return executeDgpCommands(c, parseDgp(source)).unsupported;
}

export async function importDgpFromUrl(
    c: construction,
    url: string,
): Promise<string[]> {
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`Unable to load DGP file: ${response.status}`);
    return importDgp(c, await response.text());
}
