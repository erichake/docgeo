class intersection_object extends point_object {
    constructor(_c, _name, _o1, _o2) {
        super(_c, _name, [0, 0, 0], "intersection");
        this.O1 = _o1;
        this.O2 = _o2;
        this.addParents(_o1, _o2);
        this.compute = this[_o1.familytype + "_" + _o2.familytype];
    }

    // Compute line/line intersection :
    line_line() {
        var i, j, k, d,
            ks = [],
            p = this.O1.P1.coords,
            u = this.O1.VEC,
            m = this.O2.P1.coords,
            v = this.O2.VEC;
        for (i = 0; i < 3; i++) {
            j = (i + 1) % 3;
            d = v[i] * u[j] - v[j] * u[i];
            k = (v[i] * (m[j] - p[j]) - v[j] * (m[i] - p[i])) / d.rnd0();
            if (isFinite(k)) ks.push(k);
        }
        k = (ks.length > 0) ? ks.reduce((a, b) => a.equal(b) ? a : NaN) : NaN;
        this.coords = p.sum(u.times(k));
        // this.O1.bounds(this);
        // this.O2.bounds(this);
        super.compute();

    }

    mousedrag(ev) {}

    static create(_c, _name, _o1, _o2) {
        return _c.add(new intersection_object(_c, _name, _o1, _o2));
    }
}