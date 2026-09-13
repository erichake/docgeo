class primitive_line_object extends construction_object {
    constructor(_c, _name, _p, _type) {
        super(_c, _name, _type ? _type : "line");
        this.P1 = _p;
        this.VEC = [1, 0, 0];
        this.familytype = "line";
        this.addParents(_p);
    }

    // Compute 3D normalized vector this.VEC
    // Must be override by children classes :
    computeVEC() {

    }

    // Tells if a point is on the line.
    // Must be override by finite lines :
    InsideBounds(_point_coords) {
        return true;
    }

    compute() {
        this.computeVEC();
        var sp = this.P1.screen;
        if (this.VEC.isnull()) {
            this.sP1 = this.P1.screen;
            this.sP2 = this.P1.screen;
        } else {
            // Compute a circle which is centered in P1 and with a ray
            // which makes it containing the screen.
            // Then compute two intersection points (2D screen) between the line
            // and the circle : sP1 and sP2
            var sv = sp.sub(this.C.pt3D(this.P1.coords.sum(this.VEC))).normalize();
            var l = this.C.width + this.C.height + Math.abs(sp[0]) + Math.abs(sp[1]);
            this.sP1 = [sp[0] + l * sv[0], sp[1] + l * sv[1]];
            this.sP2 = [sp[0] - l * sv[0], sp[1] - l * sv[1]];
        }
    }


    // *************************************************
    // *************************************************
    // ****************** SVG PART *********************
    // *************************************************
    // *************************************************


    draw() {
        var d = "M" + this.sP1[0] + " " + this.sP1[1];
        d += " L" + this.sP2[0] + " " + this.sP2[1];
        this.dom
            .att("d", d)
            .stl("display", this.isHidden ? "none" : "block")
    }

    static createSVG(_this) {
        var t = _this;
        t.dom = t.svg.shape("path")
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.size)
            .stl("cursor:pointer");
    }

}