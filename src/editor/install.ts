// The editor as an application installed from Chrome or Edge: see
// EDITOR.md, « Application installable ».

interface InstallPrompt extends Event {
    prompt(): Promise<unknown>;
}

// Given by the browser while the editor can be installed: never in the
// installed application, nor in Firefox or Safari. Listened to from the
// start (start.ts): it may come before the editor is loaded.
let offer: InstallPrompt | null = null;
window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    offer = event as InstallPrompt;
});
window.addEventListener("appinstalled", () => (offer = null));

export const canInstall = (): boolean => offer !== null;

export function install(): void {
    void offer!.prompt();
    offer = null;
}
