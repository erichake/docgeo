"use strict";
// ***********************************************************************
// ***********************************************************************
// **************************** DOM DESIGN *******************************
// ***********************************************************************
// ***********************************************************************

function $(_elt) {
    var customize = function(e) {
        if ((e) && (!e.customized)) {
            e.customized = true;
            e.find = function(query) {
                return customize(e.querySelector(query));
            }
            e.findAll = function(query) {
                var res = e.querySelectorAll(query);
                for (var i = 0; i < res.length; i++) {
                    try {
                        res[i] = customize(res[i]);
                    } catch (e) {

                    }

                }
                return res;
            }
            e.removeAll = function() {
                if (e.windowMouseMoveEvent)
                    window.removeEventListener("mousemove", e.windowMouseMoveEvent.MouseEvent_Function);
                if (e.windowMouseUpEvent)
                    window.removeEventListener("mouseup", e.windowMouseUpEvent.MouseEvent_Function);
                return e.remove();
            }
            e.remove = function() {
                if (e.parentNode) e.parentNode.removeChild(e);
                return e;
            }
            e.stl = function(_a0, _a1) {
                if (_a1) {
                    e.style[_a0] = _a1
                } else {
                    var t = _a0.split(";");
                    for (var i = 0, len = t.length; i < len; i++) {
                        // Si l'argument du style contient des ":"
                        // il ne faut pas qu'il soit tronqué par
                        // le split :
                        var a = t[i].split(":");
                        var pty = a[0];
                        a.shift();
                        var arg = a.join(":");
                        e.style[pty.trim()] = arg.trim();
                    }
                }
                return e;
            }

            e.att = function(_pty, _val) {
                if (_val) {
                    e.setAttribute(_pty, _val)
                } else {
                    var t = _pty.split(";");
                    for (var i = 0, len = t.length; i < len; i++) {
                        // Si l'attribut contient des ":"
                        // il ne faut pas qu'il soit tronqué par
                        // le split :
                        var a = t[i].split(":");
                        var pty = a[0];
                        a.shift();
                        var arg = a.join(":");
                        e.setAttribute(pty.trim(), arg.trim())
                    }
                }
                return e;
            }
            e.cls = function(_cls) {
                e.className = _cls;
                return e;
            }
            e.inner = function(_html) {
                e.innerHTML = _html;
                return e;
            }
            e.show = function() {
                e.style["display"] = "block";
                return e;
            }
            e.hide = function() {
                e.style["display"] = "none";
                return e;
            }
            e.add = function(obj) {
                e.appendChild(obj);
                return e;
            }
            e.append = function(_str) {
                e.innerHTML += _str;
                return e;
            }

            // Only for svg elements :
            e.shape = function(_tpe) {
                return $(document.createElementNS(e.namespaceURI, _tpe));
            }




            // ***************************************
            // ***************************************
            // *********** EVENTS PART ***************
            // ***************************************
            // ***************************************
            e.prevent = true;
            e.preventDefault = function(_bool) {
                e.prevent = _bool;
                return e;
            }
            var ongoingtouch = function(_id, _tchs) {
                for (var i = 0; i < _tchs.length; i++) {
                    if (_tchs[i].identifier) return _tchs[i];
                }
                return null;
            }
            var exeMouse = function(_elt, _mouse, _cb) {
                if (!_cb)
                    return;
                _cb.MouseEvent_Function = function(ev) {
                    if (_elt.prevent) ev.preventDefault();
                    _cb(ev);
                }
                _elt.addEventListener(_mouse, _cb.MouseEvent_Function, false);
            }

            var exeTouch = function(_elt, _touch, _cb) {
                if (!_cb)
                    return;
                if (_touch) {
                    _cb.id = null;
                    _cb.TouchEvent_Function = function(ev) {
                        var t;
                        if (_elt.prevent) ev.preventDefault();
                        if (!_cb.id) {
                            t = ev.changedTouches[ev.changedTouches.length - 1];
                            _cb.id = t.identifier;
                        } else {
                            t = ongoingtouch(_cb.id, ev.changedTouches);
                        }
                        if (t) {
                            _cb(t);
                        }

                    };
                    _elt.addEventListener(_touch, _cb.TouchEvent_Function, false);
                }
            }
            var exe = function(_elt, _mouse, _touch, _cb) {
                exeMouse(_elt, _mouse, _cb);
                exeTouch(_elt, _touch, _cb);
            }

            e.mousedown = function(_cb) {
                exe(e, 'mousedown', 'touchstart', _cb);
                return e;
            }
            e.mouseup = function(_cb) {
                exe(e, 'mouseup', 'touchend', _cb);
                return e;
            }
            e.mousemove = function(_cb) {
                exe(e, 'mousemove', 'touchmove', _cb);
                return e;
            }
            e.mouseenter = function(_cb) {
                exe(e, 'mouseenter', null, _cb);
                return e;
            }
            e.mouseover = function(_cb) {
                exe(e, 'mouseover', null, _cb);
                return e;
            }
            e.mouseout = function(_cb) {
                exe(e, 'mouseout', null, _cb);
                return e;
            }
            e.mouseleave = function(_cb) {
                exe(e, 'mouseleave', null, _cb);
                return e;
            }
            e.mouseclick = function(_cb) {
                var chrono, x0, y0;
                exe(e, 'mousedown', 'touchstart', function(ev) {
                    chrono = new Date();
                    x0 = ev.pageX, y0 = ev.pageY;
                });
                exe(e, 'mouseup', 'touchend', function(ev) {
                    var nd = new Date();
                    if (chrono && ((nd.getTime() - chrono.getTime()) < $.click_delay)) {
                        var x1 = ev.pageX,
                            y1 = ev.pageY;
                        if (((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)) < ($.click_ray * $.click_ray)) {
                            _cb(ev)
                        }
                    }
                });
            }
            e.mousedrag = function(_cb) {
                var click = false;
                var oldX, oldY, dX, dY;
                exe(e, 'mousedown', 'touchstart', function(ev) {
                    click = true;
                    oldX = ev.pageX;
                    oldY = ev.pageY;
                    dX = dY = 0;
                    if (ev.stopPropagation) ev.stopPropagation()
                });
                e.windowMouseMoveEvent = function(ev) {
                    if (click) {
                        ev.dX = (ev.pageX - oldX);
                        ev.dY = (ev.pageY - oldY);
                        oldX = ev.pageX;
                        oldY = ev.pageY;
                        _cb(ev)
                    }
                };
                e.windowMouseUpEvent = function(ev) {
                    // console.log("mouse up!");
                    click = false;
                }
                exeMouse(window, 'mousemove', e.windowMouseMoveEvent);
                exeTouch(e, 'touchmove', e.windowMouseMoveEvent);
                exeMouse(window, 'mouseup', e.windowMouseUpEvent);
                exeTouch(e, 'touchend', e.windowMouseUpEvent);
                // exe(window, 'mouseup', 'touchend', function(ev) {
                //     console.log("mouse up!");
                //     click = false;
                // });
            }

            e.bindEvents = function(_obj) {
                if (!_obj)
                    return;
                if (_obj.mousedown) e.mousedown(_obj.mousedown.bind(_obj));
                if (_obj.mouseup) e.mouseup(_obj.mouseup.bind(_obj));
                if (_obj.mousemove) e.mousemove(_obj.mousemove.bind(_obj));
                if (_obj.mouseenter) e.mouseenter(_obj.mouseenter.bind(_obj));
                if (_obj.mouseover) e.mouseover(_obj.mouseover.bind(_obj));
                if (_obj.mouseout) e.mouseout(_obj.mouseout.bind(_obj));
                if (_obj.mouseleave) e.mouseleave(_obj.mouseleave.bind(_obj));
                if (_obj.mouseclick) e.mouseclick(_obj.mouseclick.bind(_obj));
                if (_obj.mousedrag) e.mousedrag(_obj.mousedrag.bind(_obj));
                return e;
            }
        }
        return e;
    }
    var elt = (_elt instanceof Element) ? _elt : null;
    if (!elt) elt = document.getElementById(_elt);
    if (!elt) elt = document.querySelector(_elt);
    if (elt) elt = customize(elt);
    return elt;
}


// ************************************
// *********** PARAMETERS *************
// ************************************

$.click_delay = 700; // click delay for mouseclick event
$.click_ray = 5; // error ray for mouseclick event

// ************************************
// ************************************



$.create = function(_tpe) {
    return $(document.createElement(_tpe));
}
$.createSVG = function() {
    return $(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
}
$.createShape = function(_svg, _tpe) {
    return $(document.createElementNS(_svg.namespaceURI, _tpe));
}

$.files = [];
$.getScript = function(url, callback) {
    if ($.files.indexOf(url) === -1) {
        $.files.push(url);
        var head = document.getElementsByTagName('head')[0];
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url;
        script.onreadystatechange = callback;
        script.onload = callback;
        head.appendChild(script);
    } else {
        callback();
    }
}
$.getCSS = function(url, callback) {
    if ($.files.indexOf(url) === -1) {
        $.files.push(url);
        var head = document.getElementsByTagName('head')[0];
        var cssnode = document.createElement('link');
        cssnode.type = 'text/css';
        cssnode.rel = 'stylesheet';
        cssnode.href = url;
        cssnode.onreadystatechange = callback;
        cssnode.onload = callback;
        head.appendChild(cssnode);
    } else {
        callback();
    }
}
$.getKaTeX = function(callback) {
    $.getCSS("https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.7.1/katex.min.css", function() {
        $.getScript("https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.7.1/katex.min.js", function() {
            callback();
        })
    })
}
$.TeX = function(_str) {
    var s = _str.split("$$");
    for (var j = 1; j < s.length; j = j + 2) {
        try {
            s[j] = katex.renderToString(s[j]);
        } catch (e) {}
    }
    return s.join("")
};

// On fait correspondre $ et $(document.body) :
(function() {
    var body_ns = {};
    for (var key in document.body) {
        body_ns[key] = key;
    }
    $(document.body);
    for (var key in document.body) {
        if (!body_ns.hasOwnProperty(key)) {
            $[key] = $(document.body)[key];
        }
    }
})()