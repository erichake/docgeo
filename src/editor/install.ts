import type { MenuItems } from "./menus";
import { message } from "./messages";

// The editor as an application installed from Chrome or Edge: see
// EDITOR.md, « Application installable ».

interface InstallPrompt extends Event {
    prompt(): Promise<unknown>;
}

// Given by the browser while the editor can be installed: never in the
// installed application, nor in Firefox or Safari.
let offer: InstallPrompt | null = null;
window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    offer = event as InstallPrompt;
});
window.addEventListener("appinstalled", () => (offer = null));

// The File menu's last item, after a separator, while there is an offer.
export const installItems = (): MenuItems =>
    offer
        ? [
              null,
              {
                  label: `${message("install_app")}…`,
                  run: () => {
                      void offer!.prompt();
                      offer = null;
                  },
              },
          ]
        : [];
