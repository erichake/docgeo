class parallel_line_object extends primitive_line_object {
    constructor(_c, _name, _p1, _d) {
        super(_c, _name, _p1, "parallel");
        this.D = _d;
        this.addParents(_d);
        this.createSVG(); // init this.dom
    }

    computeVEC() {
        this.VEC = this.D.VEC;
    }

    static create(_c, _name, _p1, _d) {
        return _c.add(new parallel_line_object(_c, _name, _p1, _d));
    }

}