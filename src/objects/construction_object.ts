import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { ObjectPref, PrefKey, Preferences } from "../preferences";

export class construction_object {
    class: typeof construction_object;
    C: construction;
    prefs: Preferences;
    svg: DOMElement;
    type: PrefKey;
    familytype: string;
    name: string;
    size: number;
    opacity: number | undefined;
    fill_color: string;
    stroke_color: string;
    auto_fill_color: string;
    showName: boolean;
    fontSize: number;
    precision: number;
    layer: number;
    dom!: DOMElement;
    children: construction_object[];
    parents: construction_object[];
    hidden: number; // 0:show  ,   1:hidden    ,   2:super-hidden
    hasView: boolean;
    // Assigned by objects_collector.add(): a construction-order counter used
    // to process dirty objects in the same order as the (assumed
    // topological) construction order, without scanning every object.
    sequence: number;
    defined: boolean;
    geometryDirty: boolean;
    projectionDirty: boolean;
    renderDirty: boolean;

    constructor(
        c: construction,
        name: string | null | undefined,
        type: PrefKey,
    ) {
        this.class = this.constructor as typeof construction_object;
        this.C = c;
        this.prefs = c.prefs;
        this.svg = c.svg;
        this.type = type;
        this.familytype = "";
        this.name = this.class.uniqueName(this, name);

        const pref: ObjectPref = this.prefs[type];
        this.size = pref.size;
        this.opacity = pref.opacity;
        this.fill_color = pref.color.fill;
        this.stroke_color = pref.color.stroke;
        this.auto_fill_color = pref.color.fill;
        this.showName = false;
        this.fontSize = 16;
        this.precision = -1;
        this.layer = pref.layer;

        this.children = [];
        this.parents = [];
        this.hidden = 0;
        this.hasView = false;
        this.sequence = 0;
        this.defined = true;
        this.geometryDirty = false;
        this.projectionDirty = false;
        this.renderDirty = false;
    }

    get isHidden(): boolean {
        return this.hidden > 0;
    }

    get isVisible(): boolean {
        return this.defined && !this.isHidden;
    }

    addParents(...parents: construction_object[]): void {
        parents.forEach((parent) => {
            if (this.parents.includes(parent)) return;
            this.parents.push(parent);
            parent.children.push(this);
        });
    }

    refresh(): void {
        this.computeGeometry();
        this.project();
        if (this.hasView) this.render();
        this.geometryDirty = false;
        this.projectionDirty = false;
        this.renderDirty = false;
    }

    // Creates or removes the SVG view to match the current `hidden` state.
    // A no-op while the construction is batching an import, since view
    // creation is deferred to the end of the batch in that case.
    updateView(): void {
        if (this.C.isBatching) return;
        if (this.isHidden) {
            if (this.hasView) this.removeSVG();
        } else if (!this.hasView) {
            this.createSVG();
        }
    }

    computeGeometry(): void {}

    project(): void {}

    render(): void {}

    // *************************************************
    // ****************** STATIC TOOLS ******************
    // *************************************************

    static uniqueName(me: construction_object, n?: string | null): string {
        let num = 1;
        const basename = n ? n : me.prefs[me.type].name;
        let candidate = n ? n : basename + num;
        while (me.C.getObj(candidate)) {
            candidate = basename + num;
            num++;
        }
        return candidate;
    }

    // *************************************************
    // ****************** SVG PART **********************
    // *************************************************

    removeSVG(): void {
        this.dom?.dispose();
        this.hasView = false;
    }

    createSVG(): void {
        this.dom?.dispose();
        this.dom = this.class.createSVG(this);
        this.hasView = true;
        this.C.mountObject(this);
        this.refresh();
    }

    static createSVG(_this: construction_object): DOMElement {
        return _this.svg.shape("g");
    }
}
