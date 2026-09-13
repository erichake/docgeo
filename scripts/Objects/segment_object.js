class segment_object extends two_points_line_object {
    constructor(_c, _name, _p1, _p2) {
        super(_c, _name, _p1, _p2, "segment");
        // this.hidden=1;
    }

    static create(_c, _name, _p1, _p2) {
        return _c.add(new segment_object(_c, _name, _p1, _p2));
    }

    compute() {
        this.computeVEC();
        this.sP1 = this.P1.screen;
        this.sP2 = this.P2.screen;
    }

}