import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { ObjectPref, PrefKey, Preferences } from "../preferences";
import type { ScriptValue } from "../import/dgp_formula";
import type { Vec2 } from "../vec";
import type { expression_object } from "./expression_object";

// The twin being drawn: it alone keeps its own state (its view, DOM and
// projection); at any other moment, as during its gestures, a twin reads
// and writes its object (see VUES.md, « Plusieurs vues »).
let drawn: construction_object | null = null;

const asTwin = (twin: construction_object, action: () => void): void => {
    const previous = drawn;
    drawn = twin;
    action();
    drawn = previous;
};

// GeoGebra's tolerance: how far from z = 0 an object still lies in it.
export const GROUND = 1e-8;

// What an object's .dgo description needs from the file being written.
export type PartKind = "side" | "vertex" | "face";
export type DgoRef = number | [PartKind, number, number] | [string, unknown];

export const objectIndex = (
    object: construction_object,
    index: (object: construction_object) => number,
): DgoRef =>
    object.reference
        ? [
              object.reference.kind,
              index(object.reference.owner),
              object.reference.rank,
          ]
        : object.embedded
          ? embeddedRef(object, index)
          : index(object);

// Its entry without name, a formula only for a point or a list given by
// one.
function embeddedRef(
    object: construction_object,
    index: (object: construction_object) => number,
): DgoRef {
    const [tag, parameters] = object.dgo({
        index: (other) => objectIndex(other, index),
    } as DgoContext) as [string, unknown[]];
    return [tag, tag === "Fp" || tag === "Fl" ? parameters[0] : parameters];
}

// Written in the definition of the object it is given to (see embedded).
export function embed<T extends construction_object>(object: T): T {
    object.parents.forEach((parent) => {
        parent.children = parent.children.filter((child) => child !== object);
    });
    object.embedded = true;
    object.computeGeometry();
    return object;
}

export interface DgoContext {
    // Another object's position in the file.
    index(object: construction_object): DgoRef;
    // An image's key in the file's image table.
    image(url: string): string;
    // A window position, in the saved window, to the pixel.
    screen(position: Vec2): Vec2;
}

// Its .dgo type and parameters: a macro's final is the output of its
// application, with what a manipulation changes of it.
export const objectEntry = (
    object: construction_object,
    context: DgoContext,
): [string, unknown] =>
    object.output
        ? [
              "Out",
              [
                  context.index(object.output.node),
                  object.output.rank,
                  ...object.outputState(),
              ],
          ]
        : object.dgo(context);

// A formula's text and, when it reads other objects, what each of its names
// stands for.
export function dgoFormula(
    source: string,
    refs: ReadonlyMap<string, construction_object>,
    context: DgoContext,
): string | [string, Record<string, DgoRef>] {
    return refs.size
        ? [
              source,
              Object.fromEntries(
                  [...refs].map(([name, ref]) => [name, context.index(ref)]),
              ),
          ]
        : source;
}

// Dashes each followed by a gap, in pixels; as many as needed for a period.
export const isDash = (dash: number[]): boolean =>
    dash.length % 2 === 0 &&
    dash.every((length) => Number.isFinite(length) && length >= 0) &&
    (dash.length === 0 || dash.some((length) => length > 0));

// Writes `name` then `after` in an SVG text, with in subscript what follows
// its "_", a braced group or the rest of the name, as GeoGebra does, or else
// its final digits, as DGPad does.
export function writeName(
    text: DOMElement,
    name: string,
    after = "",
): DOMElement {
    const match =
        /^([^_]+)_\{([^}]+)\}(.*)$/.exec(name) ??
        /^([^_]+)_(.+)()$/.exec(name) ??
        /^(.*\D)(\d+)()$/.exec(name);
    if (!match) return text.text(name + after);
    const [, base, subscript, tail] = match;
    text.text(base).add(
        text
            .shape("tspan")
            .att("font-size", "70%")
            .att("dy", ".4em")
            .text(subscript),
    );
    // Back on the baseline: .4em of the subscript's font.
    if (tail + after)
        text.add(
            text
                .shape("tspan")
                .att("dy", "-.28em")
                .text(tail + after),
        );
    return text;
}

export class construction_object {
    reference?: {
        owner: construction_object;
        kind: PartKind;
        rank: number;
    };
    virtualParts?: Map<string, construction_object>;
    // An object written in the definition of the object it is given to, as
    // (0, 7) in Line((0, 7), (1, 7)) or Line(A, B) in
    // Intersection(Line(A, B), c): out of the construction, that object
    // computes it first, among its embeds, and depends on what it reads.
    embedded?: boolean;
    embeds?: construction_object[];
    // A final of a macro's application (see macro_object.ts): the
    // application, its rank, and its .dgo type in the macro's body.
    output?: { node: construction_object; rank: number; tag: string };
    // The .dgo type whose default style it has, when not its entry's: an
    // image by a transformation has its object's (see transformed_object.ts).
    look?: string;
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
    // DGPad's layer, painted over the lower ones whatever the type layers.
    level = 0;
    dom!: DOMElement;
    children: construction_object[];
    parents: construction_object[];
    hidden: number; // 0:show  ,   1:hidden    ,   2:super-hidden
    // GeoGebra's condition to show the object: it is shown only while this
    // expression is a nonzero number.
    condition: expression_object | null;
    // GeoGebra's dynamic color: an expression listing its red, green and
    // blue, each brought into [0, 1] by a triangle wave.
    dynamicColor: expression_object | null = null;
    // The embedding page forbids the user to manipulate it (see EMBED.md,
    // lock), which only its view reflects.
    locked = false;
    // DGPad's inert object, which answers neither hover, click nor touch
    // (see AWAKE).
    inert = false;
    // Its stroke's dash pattern, in pixels: solid when empty.
    dash: number[] = [];
    // GeoGebra's line opacity, its strokes' only.
    strokeOpacity = 1;
    // Its name, which GeoGebra writes beside any object (see nameAt), a
    // point writing its own.
    nameLabel?: DOMElement;
    // Where its name was moved, relative to it (see anchorName): null
    // where GeoGebra writes it. A point's: its left end and baseline, in
    // pixels from it.
    nameOffset: number[] | null = null;
    // GeoGebra's caption, written in place of its name.
    caption: string | null = null;
    hasView: boolean;
    // Assigned by objects_collector.add(): a construction-order counter used
    // to process dirty objects in the same order as the (assumed
    // topological) construction order, without scanning every object.
    sequence: number;
    defined: boolean;
    geometryDirty: boolean;
    projectionDirty: boolean;
    renderDirty: boolean;
    // Its geometry reads the window (see usesView in dgp_formula.ts), so is
    // recomputed on every zoom, pan or resize.
    readsView = false;
    // The index of the view it is drawn in (see VUES.md).
    view: number;
    // The other views it is also drawn in, each by a twin.
    alsoIn: number[] = [];
    twins: construction_object[] = [];
    // Of a twin, the object it draws.
    twinOf?: construction_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        type: PrefKey,
    ) {
        this.class = this.constructor as typeof construction_object;
        this.C = c;
        this.prefs = c.prefs;
        this.svg = c.svg;
        this.view = c.view;
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
        this.condition = null;
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
        return (
            this.defined &&
            !this.isHidden &&
            (this.condition === null ||
                (typeof this.condition.value === "number" &&
                    this.condition.value !== 0))
        );
    }

    addParents(...parents: construction_object[]): void {
        parents.forEach((parent) => {
            if (parent.embedded) {
                // Its own first, which it computes after.
                this.addParents(...(parent.embeds ?? []));
                (this.embeds ??= []).push(parent);
                return this.addParents(...parent.parents);
            }
            parent = parent.reference?.owner ?? parent;
            if (this.parents.includes(parent)) return;
            this.parents.push(parent);
            parent.children.push(this);
        });
    }

    refresh(): void {
        this.C.inView(this.view, () => this.computeAll());
    }

    private computeAll(): void {
        this.embeds?.forEach((point) => {
            point.computeGeometry();
            point.project();
        });
        this.computeGeometry();
        this.virtualParts?.forEach((part) => part.computeGeometry());
        this.project();
        this.virtualParts?.forEach((part) => part.project());
        if (this.hasView) this.draw();
        this.geometryDirty = false;
        this.projectionDirty = false;
        this.renderDirty = false;
    }

    // Creates or removes the SVG view to match the current `hidden` state.
    // A no-op while the construction is batching an import, since view
    // creation is deferred to the end of the batch in that case.
    updateView(): void {
        if (this.C.isBatching) return;
        if (this.isHidden === this.hasView) {
            if (this.hasView) this.removeSVG();
            else this.createSVG();
            this.C.invalidateOthers([this]);
        }
    }

    computeGeometry(): void {}

    // Takes its dynamic color, before it is drawn.
    paint(): void {
        const value = this.dynamicColor!.value;
        if (!Array.isArray(value)) return;
        const color = `rgb(${value.map((channel) => {
            const t = Math.abs(channel as number) % 2;
            return Math.floor((t > 1 ? 2 - t : t) * 255);
        })})`;
        if (color === this.stroke_color) return;
        this.fill_color = this.stroke_color = color;
        if (this.hasView) this.recolor();
    }

    // Shows its new color.
    recolor(): void {
        this.createSVG();
    }

    private isFlat?: boolean;
    // One of the 2D objects of a DGPad 3D figure (see GRID.FRAME2D): as in
    // DGPad, it is 3D as soon as one of its parents is.
    get flat(): boolean {
        return (this.isFlat ??= this.reference
            ? this.reference.owner.flat
            : this.parents.every((parent) => parent.flat));
    }

    // What a formula reads when it names the object, as in DGPad (a
    // segment's length, a circle's radius…): null when it has no value.
    // `vec3`: a point's 3D coordinates rather than its plane ones.
    scriptValue(_vec3: boolean): ScriptValue | null {
        return null;
    }

    // Its .dgo type and parameters (see DGO.md).
    dgo(_context: DgoContext): [string, unknown] {
        throw new Error(`${this.name} can't be saved`);
    }

    // As a macro's final, what a manipulation changes of it, after its
    // `Out` parameters.
    outputState(): unknown[] {
        return [];
    }

    project(): void {}

    // Lies in the plane z = 0, as far as it says.
    inGround(): boolean {
        return true;
    }

    render(): void {}

    // It has a program run when it is clicked (see event_object.ts).
    get clickable(): boolean {
        return this.children.some(
            (child) => (child as { gesture?: unknown }).gesture === "down",
        );
    }

    // Where GeoGebra writes its name, at the start of the text's baseline on
    // the screen: null when it has nowhere to.
    nameAt(): Vec2 | null {
        return null;
    }

    // Where its name moved to `offset` is written.
    anchoredName([dx, dy]: number[]): Vec2 | null {
        const at = this.nameAt();
        return at && [at[0] + dx, at[1] + dy];
    }

    // The offset that keeps a name written at `at` in its place relative to
    // the object as it changes: by default, in pixels from where GeoGebra
    // writes it.
    anchorName([x, y]: Vec2): number[] {
        const [x0, y0] = this.nameAt()!;
        return [x - x0, y - y0];
    }

    nameSpot(): Vec2 | null {
        return this.nameOffset
            ? this.anchoredName(this.nameOffset)
            : this.nameAt();
    }

    draw(): void {
        this.drawHere();
        this.twins.forEach((twin) =>
            asTwin(twin, () =>
                this.C.inView(twin.view, () => {
                    twin.project();
                    twin.drawHere();
                }),
            ),
        );
    }

    // A plane view of a figure in space shows its plane z = 0, as
    // GeoGebra's graphics view (see VUES.md).
    private drawHere(): void {
        if (this.C.space)
            this.dom.stl(
                "visibility",
                this.C.GRID?.is2D && !this.inGround() ? "hidden" : "",
            );
        this.render();
        const at = this.showName ? this.nameSpot() : null;
        if (!at) {
            this.nameLabel?.dispose();
            this.nameLabel = undefined;
            return;
        }
        if (!this.nameLabel) {
            this.nameLabel = writeName(
                this.svg
                    .shape("text")
                    .stl(
                        `fill:${this.stroke_color};font-family:Verdana;font-size:${this.fontSize}px;pointer-events:none`,
                    ),
                this.caption ?? this.name,
            );
            this.dom.add(this.nameLabel);
        }
        this.nameLabel.att("x", at[0]).att("y", at[1]);
    }

    get strokeDashArray(): string {
        return this.dash.length ? this.dash.join(" ") : "none";
    }

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
        this.disposeTwins();
        this.hasView = false;
    }

    private disposeTwins(): void {
        this.twins.forEach((twin) => asTwin(twin, () => twin.dom.dispose()));
        this.twins = [];
    }

    private makeTwin(view: number): construction_object {
        const own = Object.create(this) as construction_object;
        const twin: construction_object = new Proxy(own, {
            get: (target, key) =>
                drawn === twin
                    ? Reflect.get(target, key, twin)
                    : Reflect.get(this, key, this),
            set: (target, key, value) =>
                drawn === twin
                    ? Reflect.set(target, key, value, twin)
                    : Reflect.set(this, key, value, this),
        });
        Object.assign(own, { view, twinOf: this, twins: [] });
        asTwin(twin, () => {
            twin.nameLabel = undefined;
            twin.dom = this.class
                .createSVG(twin)
                .stl("stroke-opacity", this.strokeOpacity);
            if (this.inert) twin.dom.att("data-inert", "");
            this.C.mountObject(twin);
        });
        return twin;
    }

    createSVG(): void {
        const previous = this.dom;
        this.nameLabel = undefined;
        this.dom = this.class
            .createSVG(this)
            .stl("stroke-opacity", this.strokeOpacity);
        if (this.inert) this.dom.att("data-inert", "");
        this.C.mountObject(this);
        previous?.dispose();
        this.disposeTwins();
        this.twins = this.alsoIn.map((view) => this.makeTwin(view));
        this.hasView = true;
        // Shown by a script during an update: drawn along with the rest,
        // rather than now from objects not yet updated, whose screen
        // positions would also end up in that update's caches.
        if (this.C.OBJS.updating) this.C.invalidateRender(this);
        else this.refresh();
    }

    static createSVG(_this: construction_object): DOMElement {
        return _this.svg.shape("g");
    }
}
