class plumb_line_object extends primitive_line_object {
    constructor(_c, _name, _p1, _d) {
        super(_c, _name, _p1, "plumb");
        // this.VEC = _p2.coords.sub(_p1.coords).normalize();
        this.D = _d;
        this.addParents(_d);
        this.createSVG(); // init this.dom
    }

    computeVEC() {
        var v = this.D.VEC,
            p = this.D.P1.coords,
            m = this.P1.coords;

        // test if p, p+v and m are in the same z-plane :
        if ((v[2].equal(0)) && (m[2].equal(p[2]))) {
            this.VEC = [v[1], -v[0], 0];
        } else {
            var w = m.sub(p); // vector PM coordinates
            // cross product v ^ w :
            var c = [v[1] * w[2] - v[2] * w[1], v[2] * w[0] - v[0] * w[2], v[0] * w[1] - v[1] * w[0]];

            // cross product v ^ c :
            var d = [v[1] * c[2] - v[2] * c[1], v[2] * c[0] - v[0] * c[2], v[0] * c[1] - v[1] * c[0]];

            // console.log(d.isnull())

            this.VEC = (d.isnull()) ? [0, 0, 0] : d.normalize();
        }
    }

    // computeVEC() {
    //     var v = this.D.VEC,
    //         p = this.D.P1.coords,
    //         m = this.P1.coords,
    //         k = (v[0] * (m[0] - p[0]) + v[1] * (m[1] - p[1]) + v[2] * (m[2] - p[2])) / (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);

    //     // HM vector coordinates, where H is perp. projection of M on the line :
    //     var HM = m.sub(p.sum(v.times(k)));
    //     // this.VEC = HM.normalize();
    //     if (HM.isnull()) {

    //     } else {
    //         this.VEC = HM.normalize();
    //     }
    //     console.log(this.VEC);

    //     // this.VEC = [m[0] - p[0] - k * v[0], m[1] - p[1] - k * v[1], m[2] - p[2] - k * v[2]].normalize();
    //     // this.VEC = m.sub(p.sum(v.times(k))).normalize();
    // }



    static create(_c, _name, _p1, _d) {
        return _c.add(new plumb_line_object(_c, _name, _p1, _d));
    }

}