class midpoint_object extends point_object {
    constructor(_c, _name, _p1, _p2) {
        super(_c, _name, [0, 0, 0], "midpoint");
        this.P1 = _p1;
        this.P2 = _p2;
        this.addParents(_p1, _p2);
    }

    compute() {
        this.coords = this.P1.coords.sum(this.P2.coords).times(0.5);
        super.compute();
    }

    mousedrag(ev) {}

    static create(_c, _name, _p1, _p2) {
        return _c.add(new midpoint_object(_c, _name, _p1, _p2));
    }
}