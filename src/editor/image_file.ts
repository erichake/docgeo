import { $, type DOMElement } from "../dom";

// A file input for the images a figure saves (see IMAGE_URL in dgo.ts):
// `read` gets the chosen one as a data URL with its picture, or null for
// any other file, which can still be chosen.
export function imageFileInput(
    read: (picture: { url: string; image: HTMLImageElement } | null) => void,
): DOMElement {
    const input = $.create("input")
        .att("type", "file")
        .att(
            "accept",
            "image/png,image/jpeg,image/gif,image/webp,image/svg+xml",
        );
    input.on(
        "change",
        async () => {
            const field = input.dom() as HTMLInputElement;
            const file = field.files![0];
            field.value = "";
            const url = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });
            const image = new Image();
            image.src = url;
            const valid = await image.decode().then(
                () =>
                    /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,/.test(
                        url,
                    ),
                () => false,
            );
            read(valid ? { url, image } : null);
        },
        false,
    );
    return input;
}
