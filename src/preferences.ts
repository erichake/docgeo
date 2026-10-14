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
    // Camera distance from the origin along the view axis, in math
    // coordinates, used when perspective projection is toggled on.
    focal: number;
}

export interface Preferences {
    background: { color: string };
    point: PointPref;
    midpoint: PointPref;
    intersection: PointPref;
    circle: ObjectPref;
    quadric: ObjectPref;
    line: ObjectPref;
    plumb: ObjectPref;
    parallel: ObjectPref;
    ray: ObjectPref;
    segment: ObjectPref;
    polygon: ObjectPref;
    locus: ObjectPref;
    angle: ObjectPref;
    fixedangle: ObjectPref;
    expression: ObjectPref;
    grid: GridPref;
    list: ObjectPref;
    curve: ObjectPref;
    text: ObjectPref;
    panel: ObjectPref;
    image: ObjectPref;
}

export type PrefKey = Exclude<keyof Preferences, "background">;

export class preferences implements Preferences {
    background: { color: string };
    point: PointPref;
    midpoint: PointPref;
    intersection: PointPref;
    circle: ObjectPref;
    quadric: ObjectPref;
    line: ObjectPref;
    plumb: ObjectPref;
    parallel: ObjectPref;
    ray: ObjectPref;
    segment: ObjectPref;
    polygon: ObjectPref;
    locus: ObjectPref;
    angle: ObjectPref;
    fixedangle: ObjectPref;
    expression: ObjectPref;
    grid: GridPref;
    list: ObjectPref;
    curve: ObjectPref;
    text: ObjectPref;
    panel: ObjectPref;
    image: ObjectPref;

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
            color: { fill: "rgb(255,255,255)", stroke: "rgb(80,80,80)" },
            size: 6,
            touchsize: 12,
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

        this.circle = {
            color: { fill: "#CC66CC", stroke: "#CC66CC" },
            size: 2,
            touchsize: 5,
            name: "C",
            opacity: 0,
            layer: 3,
        };

        this.quadric = {
            color: { fill: "#CC66CC", stroke: "#CC66CC" },
            size: 2,
            touchsize: 5,
            name: "Q",
            opacity: 0,
            layer: 3,
        };

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

        this.polygon = {
            color: { fill: "rgb(35,141,227)", stroke: "rgb(80,80,80)" },
            size: 2,
            touchsize: 5,
            name: "Poly",
            opacity: 0,
            layer: 2,
        };

        this.locus = {
            color: { fill: "#0b5b94", stroke: "#0b5b94" },
            size: 2,
            touchsize: 5,
            name: "Locus",
            layer: 3,
        };

        this.angle = {
            color: { fill: "#006633", stroke: "#006633" },
            size: 4,
            touchsize: 5,
            name: "A",
            opacity: 0,
            layer: 4,
        };

        this.fixedangle = {
            color: { fill: "#006633", stroke: "#006633" },
            size: 1,
            touchsize: 5,
            name: "A",
            opacity: 0,
            layer: 4,
        };

        this.expression = {
            color: { fill: "rgb(0,0,178)", stroke: "rgb(0,0,178)" },
            size: 7,
            touchsize: 12,
            name: "E",
            opacity: 0,
            layer: 6,
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
            // Like DGPad and GeoGebra, the view turns freely around Oz,
            // unless a figure restricts it (restrictPhi).
            restrict_phi: [-Infinity, Infinity],
            step: 0.015,
            focal: 10,
            layer: 1,
        };

        this.list = {
            color: { fill: "#656148", stroke: "#656148" },
            size: 2,
            touchsize: 5,
            name: "List",
            layer: 4,
        };

        this.curve = {
            color: { fill: "#0b5b94", stroke: "#0b5b94" },
            size: 2,
            touchsize: 5,
            name: "f",
            layer: 3,
        };

        this.text = {
            color: { fill: "#000000", stroke: "#000000" },
            size: 1,
            touchsize: 5,
            name: "T",
            layer: 6,
        };

        // Above the figure, as DGPad's texts.
        this.panel = {
            color: { fill: "#000000", stroke: "#000000" },
            size: 3,
            touchsize: 5,
            name: "Text",
            layer: 7,
        };

        // Above the grid, below everything else, as GeoGebra draws it.
        this.image = {
            color: { fill: "#000000", stroke: "#000000" },
            size: 1,
            touchsize: 5,
            name: "I",
            layer: 1.5,
        };
    }
}
