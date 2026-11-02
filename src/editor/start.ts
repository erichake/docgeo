import "../splash";

// The installed application's offline copy (see editor_sw.js in
// vite.config.ts), limited to the editor's page: the player embedded by
// other pages stays served by the network.
if (import.meta.env.PROD)
    void navigator.serviceWorker?.register("editor_sw.js", { scope: "editor" });

void import("./main");
