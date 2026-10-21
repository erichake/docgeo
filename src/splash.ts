import { $ } from "./dom";
import { DIR, t } from "./i18n";
import "./splash.css";

declare const __DOCGEO_VERSION__: string;

const params = new URLSearchParams(window.location.search);
const standalone =
    window.self === window.top && !params.has("embed") && !params.has("url");
export function splashContent() {
    const content = $.create("div").cls("docgeo-splash-content").append(`
                  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 200" font-family="Arial, Helvetica, sans-serif">
                      <svg x="40" y="36" width="128" height="128" viewBox="12 12 488 488">
                          <image href="icon_light.svg" width="512" height="512" />
                      </svg>
                      <text x="208" y="80" font-size="48" font-weight="700" fill="#1e293b">DocGeo</text>
                      <text class="docgeo-splash-tagline" x="208" y="130" font-size="22" fill="#94a3b8" direction="${DIR}" text-anchor="${DIR === "rtl" ? "end" : "start"}"></text>
                      <text class="docgeo-splash-version" x="208" y="154" font-size="13" fill="#94a3b8"></text>
                  </svg>
          `);
    content.find(".docgeo-splash-tagline")!.text(t("splash_tagline"));
    content.find(".docgeo-splash-version")!.text(__DOCGEO_VERSION__);
    return content;
}

let splash = standalone
    ? $.create("div")
          .cls("docgeo-splash")
          .att("role", "status")
          .att(
              "aria-label",
              `DocGeo — ${t("splash_tagline")} — ${__DOCGEO_VERSION__}`,
          )
          .add(splashContent())
    : null;

if (splash) {
    $("body").add(splash);
}
const minimum = new Promise<void>((resolve) => setTimeout(resolve, 1000));

export function finishSplash(
    ready: Promise<unknown> = Promise.resolve(),
): void {
    if (!splash) return;
    const overlay = splash;
    splash = null;
    const hide = () => {
        overlay.addClass("docgeo-splash-hidden");
        setTimeout(() => overlay.dispose(), 300);
    };
    void Promise.all([minimum, ready]).then(
        hide,
        () => void minimum.then(hide),
    );
}
