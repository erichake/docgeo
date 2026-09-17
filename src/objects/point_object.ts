import type { construction } from "../construction";
import type { DOMElement } from "../dom";
import type { PrefKey } from "../preferences";
import {
    vAdd,
    vDot,
    vIsFinite,
    vNorm,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import { construction_object } from "./construction_object";
import { primitive_circle_object } from "./primitive_circle_object";
import { primitive_line_object } from "./primitive_line_object";
import { ray_line_object } from "./ray_line_object";
import { segment_object } from "./segment_object";
import { two_points_line_object } from "./two_points_line_object";

export type magnet_target = primitive_line_object | primitive_circle_object;

// The closest point to `point` lying on `target` (segment/ray bounds
// respected, same convention as point_on_object's own projection).
function projectOntoMagnet(target: magnet_target, point: Vec3): Vec3 {
    if (target instanceof primitive_circle_object)
        return target.pointAt(target.alphaOf(point));
    if (target instanceof two_points_line_object) {
        const direction = vSub(target.P2.coords, target.P1.coords);
        let alpha =
            vDot(vSub(point, target.P1.coords), direction) /
            vDot(direction, direction);
        if (target instanceof segment_object)
            alpha = Math.max(0, Math.min(1, alpha));
        else if (target instanceof ray_line_object) alpha = Math.max(0, alpha);
        return vAdd(target.P1.coords, vScale(direction, alpha));
    }
    const alpha = vDot(vSub(point, target.P1.coords), target.VEC);
    return vAdd(target.P1.coords, vScale(target.VEC, alpha));
}

export class point_object extends construction_object {
    COORDS: Vec3;
    SCREEN: Vec2;
    projectionDefined: boolean;
    shape: string;
    border: number | undefined;
    // DGPad's magnetism ("mg" style): while dragging, the point snaps onto
    // whichever of these is both within `radius` screen pixels and closest,
    // instead of following the pointer directly.
    magnets: { target: magnet_target; radius: number }[] = [];

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
        const screen = this.C.pointerPosition(ev);
        const coords = this.C.unprojectToZPlane(screen, this.z);
        if (!coords) return;
        this.coords = this.magnets.length
            ? this.snapToMagnets(coords, screen)
            : coords;
        this.C.invalidateGeometry(this);
    }

    private snapToMagnets(coords: Vec3, screen: Vec2): Vec3 {
        let closest: Vec3 | null = null;
        let closestDistance = Infinity;
        for (const { target, radius } of this.magnets) {
            if (!target.defined) continue;
            const candidate = projectOntoMagnet(target, coords);
            const candidateScreen = this.C.pt3D(candidate);
            if (!vIsFinite(candidateScreen)) continue;
            const distance = vNorm(vSub(candidateScreen, screen));
            if (distance <= radius && distance < closestDistance) {
                closest = candidate;
                closestDistance = distance;
            }
        }
        return closest ?? coords;
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

        const fillColor = t.opacity ? t.fill_color : t.auto_fill_color;
        const fillOpacity = t.opacity ? t.opacity : 1;

        switch (t.shape) {
            case p.rect:
                dom.add(
                    t.svg
                        .shape(p.rect)
                        .att("width", s2)
                        .att("height", s2)
                        .att("x", -s1)
                        .att("y", -s1)
                        .stl("fill", fillColor)
                        .stl("fill-opacity", fillOpacity)
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
                        .stl("fill", fillColor)
                        .stl("fill-opacity", fillOpacity)
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
                        .stl("fill", fillColor)
                        .stl("fill-opacity", fillOpacity)
                        .stl("stroke", t.stroke_color)
                        .stl("stroke-width", t.border ?? 0)
                        .stl("cursor:pointer"),
                );
                break;
            }
        }

        if (t.showName) {
            dom.add(
                t.svg
                    .shape("text")
                    .att("x", s2)
                    .att("y", t.fontSize / 2)
                    .stl(
                        `fill:${t.stroke_color};font-family:Verdana;font-size:${t.fontSize}px;pointer-events:none`,
                    )
                    .text(t.name),
            );
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
