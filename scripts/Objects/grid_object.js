class grid_object extends construction_object {
    constructor(_c) {
        super(_c, null, "grid");
        this.UNIT = this.prefs[this.type].unit;
        this.RESTRICT_THETA = this.prefs[this.type].restrict_theta;
        this.RESTRICT_PHI = this.prefs[this.type].restrict_phi;
        this.PHI = this.prefs[this.type].phi;
        this.THETA = this.prefs[this.type].theta;
        this.ORG = [this.C.width / 2, this.C.height / 2];
        this.STEP = this.prefs[this.type].step;

        this.createSVG(); // init this.dom and add it to this.svg
        // console.log(this.ORG)
    }

    compute() {
        this.CPHI = Math.cos(this.PHI);
        this.SPHI = Math.sin(this.PHI);
        this.CTHETA = Math.cos(this.THETA);
        this.STHETA = Math.sin(this.THETA);
    }


    static create(_c) {
        return _c.add(new grid_object(_c));
    }

    get screenIJK() {
        return [
            [this.ORG[0] + this.UNIT[0] * this.SPHI, this.ORG[1] + this.UNIT[0] * this.CPHI * this.STHETA],
            [this.ORG[0] + this.UNIT[1] * this.CPHI, this.ORG[1] - this.UNIT[1] * this.SPHI * this.STHETA],
            [this.ORG[0], this.ORG[1] - this.UNIT[2] * this.CTHETA]
        ]
    }


    // get screenI() {
    //     var v = this.UNIT[0];
    //     var fi = this.PHI;
    //     var cfi = Math.cos(fi),
    //         sfi = Math.sin(fi);
    //     var sth = Math.sin(this.THETA);
    //     return [this.ORG[0] + v * sfi, this.ORG[1] + v * cfi * sth]
    // };
    // get screenJ() {
    //     var v = this.UNIT[1];
    //     var fi = this.PHI;
    //     var cfi = Math.cos(fi),
    //         sfi = Math.sin(fi);
    //     var sth = Math.sin(this.THETA);
    //     return [this.ORG[0] + v * cfi, this.ORG[1] - v * sfi * sth]
    // };
    // get screenK() {
    //     var v = this.UNIT[2];
    //     var cth = Math.cos(this.THETA);
    //     return [this.ORG[0], this.ORG[1] - v * cth]
    // };


    // *************************************************
    // *************************************************
    // ****************** SVG PART *********************
    // *************************************************
    // *************************************************

    draw() {
        var v = this.screenIJK;
        var d = "M" + this.ORG[0] + " " + this.ORG[1];
        d += " L" + v[0][0] + " " + v[0][1];
        d += " M" + this.ORG[0] + " " + this.ORG[1];
        d += " L" + v[1][0] + " " + v[1][1];
        d += " M" + this.ORG[0] + " " + this.ORG[1];
        d += " L" + v[2][0] + " " + v[2][1];
        // var d = "M0 " + this.ORG[1] + " L" + this.C.width + " " + this.ORG[1];
        this.dom.Axis.att("d", d)
        // d = "M" + this.ORG[0] + " 0 L" + this.ORG[0] + " " + this.C.height;
        // this.dom.OY.att("d", d)
        this.dom.stl("display", this.isHidden ? "none" : "block")
    }

    static createSVG(_this) {
        var t = _this;
        // t.removeSVG();
        t.dom = t.svg.shape("svg")
            .att("x:0;y:0;width:100%;height:100%;overflow:visible")
            .bindEvents(t);
        t.dom.Axis = t.svg.shape("path")
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("cursor:pointer");
        t.dom.OY = t.svg.shape("path")
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("cursor:pointer");
        t.dom.add(t.dom.Axis).add(t.dom.OY);
        // t.draw();
        t.svg.add(t.dom)
    }
}