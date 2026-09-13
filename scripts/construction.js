class construction {
    constructor(_dgpad) {
        this.dgpad = _dgpad;
        this.prefs = this.dgpad.prefs;
        // All construction objects :
        this.OBJS = new objects_collector();
        this.createCANVAS();
        this.createSVG();
        this.GRID = grid_object.create(this);
        // console.log(this.GRID.ORG)
        // console.log(this.GRID.screenI)
        // console.log(this.GRID.screenJ)
        // console.log(this.GRID.screenK)
    }

    mouseclick(ev) {
        // console.log(this);
        var p1 = point_object.create(this, null, [1, 1, 0]);
        var p2 = point_object.create(this, null, [-2, 0, 0]);
        // var p3=
        var d1 = segment_object.create(this, null, p2, p1);
        var p3 = point_object.create(this, null, [5, 4, 0]);
        var p4 = point_object.create(this, null, [1, -3, 0]);
        // var d3 = parallel_line_object.create(this, null, p3, d1);
        // var d2 = parallel_line_object.create(this, null, p3, d1);
        var d2 = two_points_line_object.create(this, null, p3, p4);
        var i1 = intersection_object.create(this, null, d1, d2);
        var p5 = point_object.create(this, null, [0, -1, 0]);
        // var s1 = ray_line_object.create(this, null, p2, p1);
        var s2 = segment_object.create(this, null, i1, p5);
        // var m1 = midpoint_object.create(this, null, p2, p3);
        // var m2 = midpoint_object.create(this, null, m1, p1);
        // var m3 = midpoint_object.create(this, null, m1, m2);
        // var s1 = segment_object.create(this, null, m2, p2);
        this.orderAndDrawAll();
    }

    mousedrag(ev) {
        var rt = this.GRID.RESTRICT_THETA;
        var rp = this.GRID.RESTRICT_PHI;
        this.GRID.THETA = Math.max(Math.min(this.GRID.THETA + ev.dY * this.GRID.STEP, rt[1]), rt[0]);
        this.GRID.PHI = Math.max(Math.min(this.GRID.PHI + ev.dX * this.GRID.STEP, rp[1]), rp[0]);
        this.OBJS.compute();
        this.OBJS.draw();
    }

    add(_obj) {
        return this.OBJS.add(_obj)
    }
    getObj(_n) {
        return this.OBJS.getObj(_n)
    }

    static create(_dgpad) {
        var c = new construction(_dgpad);
        construction.constructions.push(c);
        return c;
    }



    // *************************************************
    // *************************************************
    // ******************* 3D PART *********************
    // *************************************************
    // *************************************************

    // _v est représente les coordonnées mathématiques
    // renvoie un tableau à deux éléments : les coordonnées à l'écran
    pt3D(_v) {
        var v0 = _v[0] * this.GRID.UNIT[0],
            v1 = _v[1] * this.GRID.UNIT[1],
            v2 = _v[2] * this.GRID.UNIT[2],
            o = this.GRID.ORG,
            cfi = this.GRID.CPHI,
            sfi = this.GRID.SPHI,
            cth = this.GRID.CTHETA,
            sth = this.GRID.STHETA;
        return [o[0] + v0 * sfi + v1 * cfi, o[1] + v0 * cfi * sth - v1 * sfi * sth - v2 * cth];
    };

    bidon(_pt) {
        var o = this.GRID.ORG;
        var ijk = this.GRID.screenIJK;

        // H est le projeté de _pt sur le plan x0y (en coordonnées écran) :
        var H = [_pt.sx, _pt.sy].sub([ijk[2][0] - o[0], ijk[2][1] - o[1]].times(_pt.z));

        var OH = H.sub(o);
        var OX = ijk[0].sub(o);
        var OY = ijk[1].sub(o);
        var delta = OX[0] * OY[1] - OX[1] * OY[0];
        var x = (OH[0] * OY[1] - OH[1] * OY[0]) / delta;
        var y = (OX[0] * OH[1] - OX[1] * OH[0]) / delta;
        return [x, y, _pt.z]
        // console.log([OH[0]]);

    }






    // *************************************************
    // *************************************************
    // ****************** SVG PART *********************
    // *************************************************
    // *************************************************

    get width() {
        return this.svg.getBoundingClientRect().width
    }

    get height() {
        return this.svg.getBoundingClientRect().height
    }

    orderAndDrawAll() {
        this.OBJS.drawSort();
        this.OBJS.loopD((elt) => this.svg.add(elt.dom.remove()));
        this.OBJS.compute();
        this.OBJS.draw();
    }

    createSVG() {
        this.svg = $.createSVG();
        $("body").add(this.svg
            .stl('position:absolute;border: 0px')
            .att('width:100%;height:100%;x:0;y:0;xmlns:http://www.w3.org/2000/svg')
            .bindEvents(this)
        );
    }

    // *************************************************
    // *************************************************
    // **************** CANVAS PART ********************
    // *************************************************
    // *************************************************

    createCANVAS() {
        this.canvas = $.create("canvas");
        $("body").add(this.canvas
            .stl("position:absolute;width:100%;height:100%;margin:0px;border:0px")
            .stl("background-color", this.prefs.background.color)
            .bindEvents(this)
        );
    }
}

construction.constructions = [];