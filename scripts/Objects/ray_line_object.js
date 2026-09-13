class ray_line_object extends two_points_line_object {
    constructor(_c, _name, _p1, _p2, _type) {
        super(_c, _name, _p1, _p2, "ray");
    }

    compute() {
        super.compute();
        this.sP1 = this.P1.screen;
    }

    static create(_c, _name, _p1, _p2) {
        return _c.add(new ray_line_object(_c, _name, _p1, _p2));
    }

}