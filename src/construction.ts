import { $, type DElt, type PointerEventLike } from "./dom";
import { construction_object } from "./objects/construction_object";
import { grid_object } from "./objects/grid_object";
import { intersection_object } from "./objects/intersection_object";
import { point_object } from "./objects/point_object";
import { segment_object } from "./objects/segment_object";
import { two_points_line_object } from "./objects/two_points_line_object";
import { objects_collector } from "./objects_collector";
import type { preferences, Preferences } from "./preferences";
import { vScale, vSub, type Vec2, type Vec3 } from "./vec";

export interface DgpadLike {
    prefs: preferences;
}

export class construction {
    static constructions: construction[] = [];

    dgpad: DgpadLike;
    prefs: Preferences;
    OBJS: objects_collector;
    GRID!: grid_object;
    svg!: DElt;
    canvas!: DElt;

    constructor(dgpad: DgpadLike) {
        this.dgpad = dgpad;
        this.prefs = dgpad.prefs;
        // All construction objects :
        this.OBJS = new objects_collector();
        this.createCANVAS();
        this.createSVG();
        this.GRID = grid_object.create(this);
    }

    mouseclick(_ev: PointerEventLike): void {
        const p1 = point_object.create(this, null, [1, 1, 0]);
        const p2 = point_object.create(this, null, [-2, 0, 0]);
        const d1 = segment_object.create(this, null, p2, p1);
        const p3 = point_object.create(this, null, [5, 4, 0]);
        const p4 = point_object.create(this, null, [1, -3, 0]);
        const d2 = two_points_line_object.create(this, null, p3, p4);
        const i1 = intersection_object.create(this, null, d1, d2);
        const p5 = point_object.create(this, null, [0, -1, 0]);
        segment_object.create(this, null, i1, p5);
        this.orderAndDrawAll();
    }

    mousedrag(ev: PointerEventLike): void {
        const rt = this.GRID.RESTRICT_THETA;
        const rp = this.GRID.RESTRICT_PHI;
        this.GRID.THETA = Math.max(Math.min(this.GRID.THETA + (ev.dY ?? 0) * this.GRID.STEP, rt[1]), rt[0]);
        this.GRID.PHI = Math.max(Math.min(this.GRID.PHI + (ev.dX ?? 0) * this.GRID.STEP, rp[1]), rp[0]);
        this.OBJS.compute();
        this.OBJS.draw();
    }

    add(obj: construction_object): construction_object {
        return this.OBJS.add(obj);
    }
    getObj(n: string): construction_object | undefined {
        return this.OBJS.getObj(n);
    }

    static create(dgpad: DgpadLike): construction {
        const c = new construction(dgpad);
        construction.constructions.push(c);
        return c;
    }

    // *************************************************
    // ********************* 3D PART **********************
    // *************************************************

    // _v représente les coordonnées mathématiques
    // renvoie un tableau à deux éléments : les coordonnées à l'écran
    pt3D(v: Vec3): Vec2 {
        const v0 = v[0] * this.GRID.UNIT[0],
            v1 = v[1] * this.GRID.UNIT[1],
            v2 = v[2] * this.GRID.UNIT[2],
            o = this.GRID.ORG,
            cfi = this.GRID.CPHI,
            sfi = this.GRID.SPHI,
            cth = this.GRID.CTHETA,
            sth = this.GRID.STHETA;
        return [o[0] + v0 * sfi + v1 * cfi, o[1] + v0 * cfi * sth - v1 * sfi * sth - v2 * cth];
    }

    bidon(pt: point_object): Vec3 {
        const o = this.GRID.ORG;
        const ijk = this.GRID.screenIJK;

        // H est le projeté de _pt sur le plan x0y (en coordonnées écran) :
        const H = vSub([pt.sx, pt.sy], vScale(vSub(ijk[2], o), pt.z));

        const OH = vSub(H, o);
        const OX = vSub(ijk[0], o);
        const OY = vSub(ijk[1], o);
        const delta = OX[0] * OY[1] - OX[1] * OY[0];
        const x = (OH[0] * OY[1] - OH[1] * OY[0]) / delta;
        const y = (OX[0] * OH[1] - OX[1] * OH[0]) / delta;
        return [x, y, pt.z];
    }

    // *************************************************
    // ********************* SVG PART **********************
    // *************************************************

    get width(): number {
        return this.svg.getBoundingClientRect().width;
    }

    get height(): number {
        return this.svg.getBoundingClientRect().height;
    }

    orderAndDrawAll(): void {
        this.OBJS.drawSort();
        this.OBJS.loopD((elt) => this.svg.add(elt.dom!.remove()));
        this.OBJS.compute();
        this.OBJS.draw();
    }

    createSVG(): void {
        this.svg = $.createSVG();
        $("body").add(
            this.svg
                .stl("position:absolute;border: 0px")
                .att("width:100%;height:100%;x:0;y:0;xmlns:http://www.w3.org/2000/svg")
                .bindEvents(this)
        );
    }

    // *************************************************
    // ******************** CANVAS PART *********************
    // *************************************************

    createCANVAS(): void {
        this.canvas = $.create("canvas");
        $("body").add(
            this.canvas
                .stl("position:absolute;width:100%;height:100%;margin:0px;border:0px")
                .stl("background-color", this.prefs.background.color)
                .bindEvents(this)
        );
    }
}
