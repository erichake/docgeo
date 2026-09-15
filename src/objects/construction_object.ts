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
    layer: number;
    dom!: DOMElement;
    childs: construction_object[];
    parents: construction_object[];
    hidden: number; // 0:show  ,   1:hidden    ,   2:super-hidden
    defined: boolean;

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
        this.layer = pref.layer;

        this.childs = [];
        this.parents = [];
        this.hidden = 0;
        this.defined = true;
    }

    get isHidden(): boolean {
        return this.hidden > 0;
    }

    get isVisible(): boolean {
        return this.defined && !this.isHidden;
    }

    childLength(): number {
        return this.childs.length;
    }

    addParent(o: construction_object): void {
        if (this.parents.indexOf(o) === -1) {
            this.parents.push(o);
        }
    }

    addChild(o: construction_object): void {
        if (this.childs.indexOf(o) === -1) {
            this.childs.push(o);
        }
        this.parents.forEach((elt) => elt.addChild(o));
    }

    computeAndDrawChilds(): void {
        this.childs.forEach((elt) => elt.computeAndDraw());
    }

    drawChilds(): void {
        this.childs.forEach((elt) => elt.draw());
    }

    addParents(...parents: construction_object[]): void {
        parents.forEach((parent) => {
            this.addParent(parent);
            parent.addChild(this);
            parent.childs.sort((a, b) => a.childLength() - b.childLength());
        });
    }

    computeAndDraw(): void {
        this.compute();
        this.draw();
    }

    draw(): void {}

    compute(): void {}

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
        this.dom.dispose();
    }

    createSVG(): void {
        this.dom?.dispose();
        this.dom = this.class.createSVG(this);
        this.C.mountObject(this);
        this.computeAndDraw();
    }

    static createSVG(_this: construction_object): DOMElement {
        return _this.svg.shape("g");
    }
}
