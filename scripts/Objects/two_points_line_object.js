class two_points_line_object extends primitive_line_object {
    constructor(_c, _name, _p1, _p2, _type) {
        super(_c, _name, _p1, _type);
        this.VEC = _p2.coords.sub(_p1.coords).normalize();
        this.P2 = _p2;
        this.addParents(_p2);
        this.createSVG(); // init this.dom
    }

    computeVEC(){
        this.VEC = this.P2.coords.sub(this.P1.coords).normalize();
    }



    static create(_c, _name, _p1, _p2) {
        return _c.add(new two_points_line_object(_c, _name, _p1, _p2));
    }

}