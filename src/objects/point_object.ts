import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { PrefKey } from "../preferences";
import { vIsFinite, type Vec2, type Vec3 } from "../vec";
import { construction_object } from "./construction_object";

export class point_object extends construction_object {
    COORDS: Vec3;
    SCREEN: Vec2;
    projectionDefined: boolean;
    shape: string;
    border: number | undefined;

    constructor(
        c: construction,
        name: string | null | undefined,
        pt: Vec3,
        type?: PrefKey,
    ) {
        super(c, name, type ? type : "point");
        this.COORDS = [pt[0], pt[1], pt[2]];
        this.SCREEN = [0, 0];
        this.projectionDefined = true;

        this.shape = this.prefs.point.shape.current;
        this.border = this.prefs[this.type].border;
    }

    get coords(): Vec3 {
        return this.COORDS;
    }
    set coords(v: Vec3) {
        this.COORDS = [v[0], v[1], v[2]];
    }
    get screen(): Vec2 {
        return this.SCREEN;
    }
    set screen(v: Vec2) {
        this.SCREEN = [v[0], v[1]];
    }
    get sx(): number {
        return this.SCREEN[0];
    }
    get sy(): number {
        return this.SCREEN[1];
    }
    get x(): number {
        return this.COORDS[0];
    }
    get y(): number {
        return this.COORDS[1];
    }
    get z(): number {
        return this.COORDS[2];
    }

    computeGeometry(): void {
        this.defined = vIsFinite(this.COORDS);
    }

    project(): void {
        this.projectionDefined = false;
        if (!this.defined) return;
        const screen = this.C.pt3D(this.COORDS);
        this.projectionDefined = vIsFinite(screen);
        if (this.projectionDefined) this.screen = screen;
    }

    mousedrag(ev: PointerEvent): void {
        const coords = this.C.unprojectToZPlane(
            this.C.pointerPosition(ev),
            this.z,
        );
        if (!coords) return;
        this.coords = coords;
        this.C.invalidateGeometry(this);
    }

    mouseclick(_ev: PointerEvent): void {
        this.C.removeObject(this);
    }

    // *************************************************
    // ****************** SVG PART **********************
    // *************************************************

    render(): void {
        this.dom.stl(
            "display",
            this.isVisible && this.projectionDefined ? "block" : "none",
        );
        if (!this.defined || !this.projectionDefined) return;
        this.dom.att("transform", `translate(${this.sx} ${this.sy})`);
    }

    static createSVG(_this: construction_object): DOMElement {
        const t = _this as point_object;
        const p = t.prefs.point.shape;
        const s1 = t.size;
        const s2 = 2 * s1;

        const dom = t.svg
            .shape("g")
            .att("transform", `translate(${t.sx} ${t.sy})`)
            .drag((event) => t.mousedrag(event))
            .tap((event) => t.mouseclick(event));

        dom.add(
            t.svg
                .shape("circle")
                .att("r", t.prefs[t.type].touchsize)
                .att("cx", 0)
                .att("cy", 0)
                .stl(
                    "fill:transparent;stroke:none;pointer-events:all;cursor:pointer",
                ),
        );

        switch (t.shape) {
            case p.rect:
                dom.add(
                    t.svg
                        .shape(p.rect)
                        .att("width", s2)
                        .att("height", s2)
                        .att("x", -s1)
                        .att("y", -s1)
                        .stl("fill", t.fill_color)
                        .stl("fill-opacity", t.opacity ?? 0)
                        .stl("stroke", t.stroke_color)
                        .stl("stroke-width", t.border ?? 0)
                        .stl("cursor:pointer"),
                );
                break;
            case p.circle:
                dom.add(
                    t.svg
                        .shape(p.circle)
                        .att("r", s1)
                        .att("cx", 0)
                        .att("cy", 0)
                        .stl("fill", t.fill_color)
                        .stl("fill-opacity", t.opacity ?? 0)
                        .stl("stroke", t.stroke_color)
                        .stl("stroke-width", t.border ?? 0)
                        .stl("cursor:pointer"),
                );
                break;
            case p.cross: {
                dom.add(
                    t.svg
                        .shape("rect")
                        .att("width", s2)
                        .att("height", s2)
                        .att("x", -s1)
                        .att("y", -s1)
                        .stl(
                            "stroke-width:0;cursor:pointer;fill:rgba(255,255,255,0)",
                        ),
                );
                let d = `M${-s1} ${-s1}`;
                d += ` L${s1} ${s1}`;
                d += ` M${-s1} ${s1}`;
                d += ` L${s1} ${-s1}`;
                dom.add(
                    t.svg
                        .shape("path")
                        .att("d", d)
                        .stl("stroke", t.fill_color)
                        .stl("stroke-width", 2 * (t.border ?? 0))
                        .stl("cursor:pointer"),
                );
                break;
            }
            case p.diamond: {
                let d = `M0 ${-s1}`;
                d += ` L${s1} 0`;
                d += ` L0 ${s1}`;
                d += ` L${-s1} 0`;
                d += " Z";
                dom.add(
                    t.svg
                        .shape("path")
                        .att("d", d)
                        .stl("fill", t.fill_color)
                        .stl("fill-opacity", t.opacity ?? 0)
                        .stl("stroke", t.stroke_color)
                        .stl("stroke-width", t.border ?? 0)
                        .stl("cursor:pointer"),
                );
                break;
            }
        }
        return dom;
    }
}

export function createPoint(
    c: construction,
    name: string | null | undefined,
    pt: Vec3,
): point_object {
    return c.add(new point_object(c, name, pt));
}
