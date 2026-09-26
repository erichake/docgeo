import { construction } from "./construction";
import { importDgpFromUrl } from "./dgp_importer";
import { $ } from "./dom";
import { importGgbFromUrl } from "./ggb_importer";
import { preferences } from "./preferences";

class docgeo {
    prefs: preferences;
    scene: construction;

    constructor() {
        this.document();
        this.prefs = new preferences();
        this.scene = construction.create(this);
    }

    document(): void {
        $("html").stl("width:100%;height:100%");
        $("body")
            .stl(
                "width:100%;height:100%;margin:0;overflow:hidden;touch-action:none",
            )
            .att("oncontextmenu", "return false;");
    }
}

export const DOCGEO = new docgeo();
const url = new URLSearchParams(window.location.search).get("url");
export const DOCGEO_READY = !url
    ? Promise.resolve()
    : /\.ggb$/i.test(url)
      ? importGgbFromUrl(DOCGEO.scene, url).then((unsupported) => {
            if (unsupported.length > 0)
                console.warn("Unsupported GeoGebra objects:", unsupported);
        })
      : importDgpFromUrl(DOCGEO.scene, url).then((unsupported) => {
            if (unsupported.length > 0)
                console.warn("Unsupported DGPad objects:", unsupported);
        });
