const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

// Reads a single entry of a .ggb archive (a plain zip file) through the
// central directory, whose sizes stay valid even when the local headers
// defer them to a trailing data descriptor.
export async function readZipEntry(
    data: ArrayBuffer,
    name: string | RegExp,
): Promise<string> {
    return readZipResponse(data, name).text();
}

export function readZipBlob(
    data: ArrayBuffer,
    name: string | RegExp,
): Promise<Blob> {
    return readZipResponse(data, name).blob();
}

function readZipResponse(data: ArrayBuffer, name: string | RegExp): Response {
    for (const [entryName, read] of zipEntries(data))
        if (
            typeof name === "string" ? entryName === name : name.test(entryName)
        )
            return read();
    throw new Error(`Missing ${name} in GGB archive`);
}

// Each entry's name, in the archive's order, and how to read it.
export function* zipEntries(
    data: ArrayBuffer,
): Generator<[string, () => Response]> {
    const view = new DataView(data);
    let end = data.byteLength - 22;
    while (end >= 0 && view.getUint32(end, true) !== END_OF_CENTRAL_DIRECTORY)
        end--;
    if (end < 0) throw new Error("Invalid GGB archive");
    const count = view.getUint16(end + 10, true);
    let offset = view.getUint32(end + 16, true);
    for (let index = 0; index < count; index++) {
        const method = view.getUint16(offset + 10, true);
        const size = view.getUint32(offset + 20, true);
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const local = view.getUint32(offset + 42, true);
        const entryName = new TextDecoder().decode(
            new Uint8Array(data, offset + 46, nameLength),
        );
        yield [
            entryName,
            () => {
                const start =
                    local +
                    30 +
                    view.getUint16(local + 26, true) +
                    view.getUint16(local + 28, true);
                const stream = new Blob([
                    new Uint8Array(data, start, size),
                ]).stream();
                return new Response(
                    method === 0
                        ? stream
                        : stream.pipeThrough(
                              new DecompressionStream("deflate-raw"),
                          ),
                );
            },
        ];
        offset += 46 + nameLength + extraLength + commentLength;
    }
}
