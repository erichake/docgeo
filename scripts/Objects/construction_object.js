class construction_object {
    constructor(_c, _name, _type) {
        var me = this;
        me.class = me.constructor;
        me.C = _c;
        me.prefs = _c.prefs;
        me.svg = _c.svg;
        me.type = _type;
        me.familytype = "";
        me.name = me.class.uniqueName(me, _name);
        me.size = me.prefs[_type].size;
        me.opacity = me.prefs[_type].opacity;
        me.fill_color = me.prefs[_type].color.fill;
        me.stroke_color = me.prefs[_type].color.stroke;
        me.layer = me.prefs[_type].layer;
        me.dom = null;
        me.childs = [];
        me.parents = [];
        me.hidden = 0; // 0:show  ,   1:hidden    ,   2:super-hidden
    }

    get isHidden() {
        return this.hidden > 0
    }

    childLength() {
        return this.childs.length;
    }

    addParent(_o) {
        if (this.parents.indexOf(_o) === -1) {
            this.parents.push(_o)
        }
    }

    addChild(_o) {
        if (this.childs.indexOf(_o) === -1) {
            this.childs.push(_o);
        }
        this.parents.forEach((elt) => elt.addChild(_o))
    }

    computeAndDrawChilds() {
        this.childs.forEach((elt) => elt.computeAndDraw())
    }

    drawChilds() {
        this.childs.forEach((elt) => elt.draw())
    }

    addParents() {
        for (var i = 0, len = arguments.length; i < len; i++) {
            this.addParent(arguments[i]);
            arguments[i].addChild(this);
            arguments[i].childs.sort((_a, _b) => (_a.childLength() - _b.childLength()))
        }
    }

    computeAndDraw() {
        this.compute()
        this.draw()
    }



    draw() {

    }

    compute() {

    }


    // *************************************************
    // *************************************************
    // **************** STATIC TOOLS *******************
    // *************************************************
    // *************************************************

    static uniqueName(_me, _n) {
        var num = 1;
        var basename = _n ? _n : _me.prefs[_me.type].name;
        _n = _n ? _n : basename + num;
        while (_me.C.getObj(_n)) {
            _n = basename + num;
            num++;
        }
        return _n;
    }


    // *************************************************
    // *************************************************
    // ****************** SVG PART *********************
    // *************************************************
    // *************************************************

    removeSVG() {
        if (this.dom) {
            this.dom.removeAll();
            this.dom = null;
        }
    }

    createSVG() {
        this.removeSVG();
        this.constructor.createSVG(this)
    }

    static createSVG(_this) {}
}