import { construction } from "./construction";
import { importDgpFromUrl } from "./dgp_importer";
import { $ } from "./dom";
import { preferences } from "./preferences";

class dgpadpro {
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

export const DGPADPRO = new dgpadpro();
const dgpUrl = new URLSearchParams(window.location.search).get("url");
export const DGPADPRO_READY = dgpUrl
    ? importDgpFromUrl(DGPADPRO.scene, dgpUrl)
    : Promise.resolve();
