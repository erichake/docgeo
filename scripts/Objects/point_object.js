class point_object extends construction_object {
  constructor(_c, _name, _pt, _type) {
    super(_c, _name, _type ? _type : "point");
    this.COORDS = [_pt[0], _pt[1], _pt[2] ? _pt[2] : 0];
    this.SCREEN = _c.pt3D(this.COORDS);

    this.shape = this.prefs.point.shape.current;
    this.border = this.prefs[this.type].border;

    this.createSVG(); // init this.dom
    // console.log(this.COORDS)
  }
  get coords() {
    return [this.COORDS[0], this.COORDS[1], this.COORDS[2]];
  }
  set coords(_v) {
    this.COORDS[0] = _v[0];
    this.COORDS[1] = _v[1];
    this.COORDS[2] = _v[2];
  }
  get screen() {
    return this.SCREEN;
  }
  set screen(_v) {
    this.SCREEN[0] = _v[0];
    this.SCREEN[1] = _v[1];
  }
  get sx() {
    return this.SCREEN[0];
  }
  get sy() {
    return this.SCREEN[1];
  }
  set sx(_x) {
    this.SCREEN[0] = _x;
  }
  set sy(_y) {
    this.SCREEN[1] = _y;
  }
  get x() {
    return this.COORDS[0];
  }
  set x(_x) {
    this.COORDS[0] = _x;
  }
  get y() {
    return this.COORDS[1];
  }
  get z() {
    return this.COORDS[2];
  }

  compute() {
    this.screen = this.C.pt3D(this.coords);
    // console.log(this.COORDS)
    // console.log(this.C.pt3D(this.COORDS))
  }

  mousedrag(ev) {
    // console.log(this.childs)
    this.screen = [ev.pageX, ev.pageY];
    this.coords = this.C.bidon(this);
    // this.drawChilds();
    this.computeAndDrawChilds();
    this.draw();

    // this.dragSVG(this.SCREEN);
  }

  mouseclick(ev) {
    this.removeSVG();
  }

  static create(_c, _name, _pt) {
    return _c.add(new point_object(_c, _name, _pt));
  }

  // *************************************************
  // *************************************************
  // ****************** SVG PART *********************
  // *************************************************
  // *************************************************

  draw() {
    this.dom
      .att("x", this.sx - this.size)
      .att("y", this.sy - this.size)
      .stl("display", this.isHidden ? "none" : "block");
  }

  dragSVG(_t) {
    this.dom.att("x", _t[0] - this.size).att("y", _t[1] - this.size);
  }

  static createSVG(_this) {
    var t = _this,
      p = t.prefs.point.shape,
      s1 = t.size,
      s2 = 2 * s1;
    // t.removeSVG();
    t.dom = t.svg
      .shape("svg")
      .att("x", t.x - s1)
      .att("y", t.y - s1)
      .att("width", s2)
      .att("height", s2)
      .stl("overflow:visible")
      .bindEvents(t);
    switch (t.shape) {
      case p.rect:
        t.dom.add(
          t.svg
            .shape(p.rect)
            .att("width", s2)
            .att("height", s2)
            .att("x", 0)
            .att("y", 0)
            .stl("fill", t.fill_color)
            .stl("fill-opacity", t.opacity)
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.border)
            .stl("cursor:pointer")
        );
        break;
      case p.circle:
        t.dom.add(
          t.svg
            .shape(p.circle)
            .att("r", s1)
            .att("cx", s1)
            .att("cy", s1)
            .stl("fill", t.fill_color)
            .stl("fill-opacity", t.opacity)
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.border)
            .stl("cursor:pointer")
        );
        break;
      case p.cross:
        t.dom.add(
          t.svg
            .shape("rect")
            .att("width", s2)
            .att("height", s2)
            .att("x", 0)
            .att("y", 0)
            .stl("stroke-width:0;cursor:pointer;fill:rgba(255,255,255,0)")
        );
        var d = "M0 0";
        d += " L" + s2 + " " + s2;
        d += " M0 " + s2;
        d += " L" + s2 + " 0";
        t.dom.add(
          t.svg
            .shape("path")
            .att("d", d)
            .stl("stroke", t.fill_color)
            .stl("stroke-width", 2 * t.border)
            .stl("cursor:pointer")
        );
        break;
      case p.diamond:
        var d = "M0 " + s1;
        d += " L" + s1 + " 0";
        d += " L" + s2 + " " + s1;
        d += " L" + s1 + " " + s2;
        d += " Z";
        t.dom.add(
          t.svg
            .shape("path")
            .att("d", d)
            .stl("fill", t.fill_color)
            .stl("fill-opacity", t.opacity)
            .stl("stroke", t.stroke_color)
            .stl("stroke-width", t.border)
            .stl("cursor:pointer")
        );
        break;
    }
    // t.draw()
  }
}
