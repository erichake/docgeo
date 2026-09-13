class objects_collector {
    constructor() {
        // All construction objects, in construction order :
        this.V = [];
        // All construction objects, in draw order :
        this.D = [];
        // Associative objects array (AO[name]=<object>) :
        this.O = {};
    }
    add(_o) {
        this.V.push(_o);
        this.D.push(_o);
        this.O[_o.name] = _o;
        return _o;
    }
    getObj(_n) {
        return this.O[_n]
    }
    loopD(_cb) {
        this.D.forEach(_cb)
    }
    drawSort() {
        this.D.sort((a, b) => (a.layer - b.layer))
    }
    draw() {
        this.D.forEach(elt => elt.draw())
    }
    compute() {
        this.V.forEach(elt => elt.compute())
    }
}