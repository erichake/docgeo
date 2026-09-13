class preferences {
    constructor() {
        var P = this;
        P.background = {};
        P.background.color = "#FAFAFA";

        P.point = {};
        P.point.shape = {};
        P.point.shape.rect = "rect";
        P.point.shape.circle = "circle";
        P.point.shape.cross = "cross";
        P.point.shape.diamond = "diamond";
        P.point.shape.current = "circle";
        P.point.name = "P";
        P.point.color = {};
        P.point.color.fill = "rgb(35,141,227)";
        P.point.color.stroke = "rgb(80,80,80)";
        P.point.size = 6;
        P.point.touchsize = 12;
        P.point.border = 1;
        P.point.opacity = 0;
        P.point.layer = 5;

        P.midpoint = JSON.parse(JSON.stringify(P.point));
        P.midpoint.color.fill = "rgb(180,180,180)";
        P.midpoint.layer = 5;
        P.midpoint.name = "M";

        P.intersection = JSON.parse(JSON.stringify(P.point));
        P.intersection.color.fill = "rgb(180,180,180)";
        P.intersection.layer = 5;
        P.intersection.name = "I";

        P.line = {};
        P.line.color = {};
        P.line.color.fill = "rgb(35,141,227)";
        P.line.color.stroke = "rgb(80,80,80)";
        P.line.size = 2;
        P.line.touchsize = 5;
        P.line.name = "d";
        P.line.layer = 4;

        P.plumb = {};
        P.plumb.color = {};
        P.plumb.color.fill = "rgb(35,141,227)";
        P.plumb.color.stroke = "rgb(80,80,80)";
        P.plumb.size = 2;
        P.plumb.touchsize = 5;
        P.plumb.name = "d";
        P.plumb.layer = 4;

        P.parallel = {};
        P.parallel.color = {};
        P.parallel.color.fill = "rgb(35,141,227)";
        P.parallel.color.stroke = "rgb(80,80,80)";
        P.parallel.size = 2;
        P.parallel.touchsize = 5;
        P.parallel.name = "d";
        P.parallel.layer = 4;

        P.ray = {};
        P.ray.color = {};
        P.ray.color.fill = "rgb(35,141,227)";
        P.ray.color.stroke = "#993300";
        P.ray.size = 2;
        P.ray.touchsize = 5;
        P.ray.name = "r";
        P.ray.layer = 4;

        P.segment = {};
        P.segment.color = {};
        P.segment.color.fill = "rgb(35,141,227)";
        P.segment.color.stroke = "rgb(180,80,80)";
        P.segment.size = 4;
        P.segment.touchsize = 5;
        P.segment.name = "s";
        P.segment.layer = 4;

        P.grid = {};
        P.grid.color = {};
        P.grid.color.fill = "rgb(35,141,227)";
        P.grid.color.stroke = "rgb(80,80,80)";
        P.grid.size = 2;
        P.grid.touchsize = 5;
        P.grid.name = "g";
        P.grid.unit = [80, 80, 80]; //pixels per unit along three axis
        // Vue d'avion, avec Ox à droite et Oy en haut :
        P.grid.theta = Math.PI / 2;
        P.grid.phi = 5 * Math.PI / 2;
        P.grid.restrict_theta = [-Math.PI / 2, Math.PI / 2];
        P.grid.restrict_phi = [3 * Math.PI / 2, 5 * Math.PI / 2];
        P.grid.step = 0.015;
        P.grid.layer = 1;


        // P.line.border = 1;
        // P.line.opacity = 0;

        // P.color = {};
        // P.color.hilite = "#ffbb00"; // Attention : minuscules importantes...
        // P.color.selected = "#FF0000";
        // P.color.point = "rgb(0,0,178)";
        // P.color.list = "rgb(0,0,178)";
        // P.color.segment = "#006633";
        // P.color.vector = "#006633";
        // P.color.line = "#780013";
        // P.color.circle = "#CC66CC";
        // P.color.area = "#006633";
        // P.color.ray = "#993300";
        // P.color.angle = "#006633";
        // P.color.fixedangle = "#006633";
        // P.color.quadric = "#00ADFF";
        // P.color.point_free = "rgba(255,255,255,1)";
        // P.color.point_on = "rgba(255,255,255,1)";
        // P.color.point_inter = "#ccc";
        // P.color.point_fixed = "#ccc";

        // P.size = {};
        // P.size.marginwidth = 0;
        // P.size.marginheight = 0;
        // P.size.touchfactor = 1;
        // P.size.point = 8;
        // P.size.list = 1;
        // P.size.pointborder = 2;
        // P.size.line = 1;
        // P.size.angle = 4;
        // P.size.fixedangle = 1;
        // P.size.expression = 7;
        // P.size.expression_cursor = 10;
        // P.size.dash = [6, 10];
        // P.size.partiallines = 100;
        // P.size.vectorhead = 20;
        // P.size.blockly_button = 3;

        // P.opacity = {};
        // P.opacity.point = 0;
        // P.opacity.area = 0.2;
        // P.opacity.vector = 0.2;
        // P.opacity.blockly_button = 0.1;
    }
}