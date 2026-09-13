import type { Vec2, Vec3 } from "./vec";

export interface ColorPref {
    fill: string;
    stroke: string;
}

export interface ObjectPref {
    color: ColorPref;
    size: number;
    touchsize: number;
    name: string;
    layer: number;
    opacity?: number;
    border?: number;
}

export interface PointShapePref {
    rect: "rect";
    circle: "circle";
    cross: "cross";
    diamond: "diamond";
    current: string;
}

export interface PointPref extends ObjectPref {
    shape: PointShapePref;
}

export interface GridPref extends ObjectPref {
    unit: Vec3;
    theta: number;
    phi: number;
    restrict_theta: Vec2;
    restrict_phi: Vec2;
    step: number;
}

export interface Preferences {
    background: { color: string };
    point: PointPref;
    midpoint: PointPref;
    intersection: PointPref;
    line: ObjectPref;
    plumb: ObjectPref;
    parallel: ObjectPref;
    ray: ObjectPref;
    segment: ObjectPref;
    grid: GridPref;
}

export type PrefKey = Exclude<keyof Preferences, "background">;

export class preferences implements Preferences {
    background: { color: string };
    point: PointPref;
    midpoint: PointPref;
    intersection: PointPref;
    line: ObjectPref;
    plumb: ObjectPref;
    parallel: ObjectPref;
    ray: ObjectPref;
    segment: ObjectPref;
    grid: GridPref;

    constructor() {
        this.background = { color: "#FAFAFA" };

        this.point = {
            shape: {
                rect: "rect",
                circle: "circle",
                cross: "cross",
                diamond: "diamond",
                current: "circle",
            },
            name: "P",
            color: { fill: "rgb(35,141,227)", stroke: "rgb(80,80,80)" },
            size: 6,
            touchsize: 12,
            border: 1,
            opacity: 0,
            layer: 5,
        };

        this.midpoint = JSON.parse(JSON.stringify(this.point));
        this.midpoint.color.fill = "rgb(180,180,180)";
        this.midpoint.layer = 5;
        this.midpoint.name = "M";

        this.intersection = JSON.parse(JSON.stringify(this.point));
        this.intersection.color.fill = "rgb(180,180,180)";
        this.intersection.layer = 5;
        this.intersection.name = "I";

        this.line = {
            color: { fill: "rgb(35,141,227)", stroke: "rgb(80,80,80)" },
            size: 2,
            touchsize: 5,
            name: "d",
            layer: 4,
        };

        this.plumb = {
            color: { fill: "rgb(35,141,227)", stroke: "rgb(80,80,80)" },
            size: 2,
            touchsize: 5,
            name: "d",
            layer: 4,
        };

        this.parallel = {
            color: { fill: "rgb(35,141,227)", stroke: "rgb(80,80,80)" },
            size: 2,
            touchsize: 5,
            name: "d",
            layer: 4,
        };

        this.ray = {
            color: { fill: "rgb(35,141,227)", stroke: "#993300" },
            size: 2,
            touchsize: 5,
            name: "r",
            layer: 4,
        };

        this.segment = {
            color: { fill: "rgb(35,141,227)", stroke: "rgb(180,80,80)" },
            size: 4,
            touchsize: 5,
            name: "s",
            layer: 4,
        };

        this.grid = {
            color: { fill: "rgb(35,141,227)", stroke: "rgb(80,80,80)" },
            size: 2,
            touchsize: 5,
            name: "g",
            unit: [80, 80, 80],
            // Vue d'avion, avec Ox à droite et Oy en haut :
            theta: Math.PI / 2,
            phi: (5 * Math.PI) / 2,
            restrict_theta: [-Math.PI / 2, Math.PI / 2],
            restrict_phi: [(3 * Math.PI) / 2, (5 * Math.PI) / 2],
            step: 0.015,
            layer: 1,
        };
    }
}
