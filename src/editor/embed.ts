export const embedded =
    window.self !== window.top &&
    new URLSearchParams(window.location.search).has("embed");

const post = (message: object, transfer: Transferable[] = []): void =>
    window.parent.postMessage({ docgeo: 1, ...message }, "*", transfer);

export function requestSave(): void {
    post({ event: "save" });
}

export function embedEditor(editor: {
    load: (file: File, name?: string) => Promise<string[]>;
    save: () => Promise<Blob>;
}): void {
    let queue = Promise.resolve();
    window.addEventListener("message", ({ source, data: message }) => {
        if (
            source !== window.parent ||
            message?.docgeo !== 1 ||
            typeof message.type !== "string"
        )
            return;
        const { id, type } = message;
        queue = queue.then(async () => {
            try {
                if (type === "load") {
                    const { data, format, name } = message;
                    if (
                        !(data instanceof ArrayBuffer) ||
                        !["dgo", "dgp", "ggb"].includes(format) ||
                        (name !== undefined && typeof name !== "string")
                    )
                        throw new Error("Invalid request");
                    const file = new File([data], `figure.${format}`);
                    const unsupported = await editor.load(file, name);
                    post({ id, ok: true, result: { unsupported } });
                } else if (type === "save") {
                    const data = await (await editor.save()).arrayBuffer();
                    post({ id, ok: true, result: { data } }, [data]);
                } else throw new Error(`Unknown request: ${type}`);
            } catch (error) {
                post({ id, ok: false, error: (error as Error).message });
            }
        });
    });
    post({ event: "ready" });
}
