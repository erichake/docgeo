import type { construction } from "../construction";
import type { PrefKey } from "../preferences";
import { vIsFinite, type Vec2, type Vec3 } from "../vec";
import { construction_object } from "./construction_object";

export class point_object extends construction_object {
    COORDS: Vec3;
    SCREEN: Vec2;
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

        this.shape = this.prefs.point.shape.current;
        this.border = this.prefs[this.type].border;

        this.computeScreen();
        this.createSVG(); // init this.dom
    }

    get coords(): Vec3 {
        return [this.COORDS[0], this.COORDS[1], this.COORDS[2]];
    }
    set coords(v: Vec3) {
        this.COORDS[0] = v[0];
        this.COORDS[1] = v[1];
        this.COORDS[2] = v[2];
    }
    get screen(): Vec2 {
        return this.SCREEN;
    }
    set screen(v: Vec2) {
        this.SCREEN[0] = v[0];
        this.SCREEN[1] = v[1];
    }
    get sx(): number {
        return this.SCREEN[0];
    }
    get sy(): number {
        return this.SCREEN[1];
    }
    set sx(x: number) {
        this.SCREEN[0] = x;
    }
    set sy(y: number) {
        this.SCREEN[1] = y;
    }
    get x(): number {
        return this.COORDS[0];
    }
    set x(x: number) {
        this.COORDS[0] = x;
    }
    get y(): number {
        return this.COORDS[1];
    }
    get z(): number {
        return this.COORDS[2];
    }

    compute(): void {
        this.computeScreen();
    }

    private computeScreen(): void {
        if (!vIsFinite(this.COORDS)) {
            this.defined = false;
            return;
        }
        const screen = this.C.pt3D(this.COORDS);
        this.defined = vIsFinite(screen);
        if (this.defined) this.screen = screen;
    }

    mousedrag(ev: PointerEvent): void {
        const coords = this.C.unprojectToZPlane([ev.pageX, ev.pageY], this.z);
        if (!coords) return;
        this.coords = coords;
        this.compute();
        this.computeAndDrawChilds();
        this.draw();
    }

    mouseclick(_ev: PointerEvent): void {
        this.removeSVG();
    }

    static create(
        c: construction,
        name: string | null | undefined,
        pt: Vec3,
    ): point_object {
        return c.add(new point_object(c, name, pt)) as point_object;
    }

    // *************************************************
    // ****************** SVG PART **********************
    // *************************************************

    draw(): void {
        this.dom!.stl("display", this.isVisible ? "block" : "none");
        if (!this.defined) return;
        this.dom!.att("x", this.sx - this.size).att("y", this.sy - this.size);
    }

    dragSVG(t: Vec2): void {
        this.dom!.att("x", t[0] - this.size).att("y", t[1] - this.size);
    }

    static createSVG(_this: construction_object): void {
        const t = _this as point_object;
        const p = t.prefs.point.shape;
        const s1 = t.size;
        const s2 = 2 * s1;

        t.dom = t.svg
            .shape("svg")
            .att("x", t.sx - s1)
            .att("y", t.sy - s1)
            .att("width", s2)
            .att("height", s2)
            .stl("overflow:visible");
        t.dom
            .drag((event) => t.mousedrag(event))
            .tap((event) => t.mouseclick(event));

        switch (t.shape) {
            case p.rect:
                t.dom.add(
                    t.svg
                        .shape(p.rect)
                        .att("width", s2)
                        .att("height", s2)
                        .att("x", 0)
                        .att("y", 0)
                        .stl("fill", t.fill_color)
                        .stl("fill-opacity", t.opacity ?? 0)
                        .stl("stroke", t.stroke_color)
                        .stl("stroke-width", t.border ?? 0)
                        .stl("cursor:pointer"),
                );
                break;
            case p.circle:
                t.dom.add(
                    t.svg
                        .shape(p.circle)
                        .att("r", s1)
                        .att("cx", s1)
                        .att("cy", s1)
                        .stl("fill", t.fill_color)
                        .stl("fill-opacity", t.opacity ?? 0)
                        .stl("stroke", t.stroke_color)
                        .stl("stroke-width", t.border ?? 0)
                        .stl("cursor:pointer"),
                );
                break;
            case p.cross: {
                t.dom.add(
                    t.svg
                        .shape("rect")
                        .att("width", s2)
                        .att("height", s2)
                        .att("x", 0)
                        .att("y", 0)
                        .stl(
                            "stroke-width:0;cursor:pointer;fill:rgba(255,255,255,0)",
                        ),
                );
                let d = "M0 0";
                d += " L" + s2 + " " + s2;
                d += " M0 " + s2;
                d += " L" + s2 + " 0";
                t.dom.add(
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
                let d = "M0 " + s1;
                d += " L" + s1 + " 0";
                d += " L" + s2 + " " + s1;
                d += " L" + s1 + " " + s2;
                d += " Z";
                t.dom.add(
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
    }
}
