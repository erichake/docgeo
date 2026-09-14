import { construction } from "./construction";
import { $ } from "./dom";
import { preferences } from "./preferences";

class dgpadpro {
    prefs: preferences;

    constructor() {
        this.document();
        this.prefs = new preferences();
        construction.create(this);
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
