export interface PointerEventLike {
    pageX: number;
    pageY: number;
    dX?: number;
    dY?: number;
    stopPropagation?: () => void;
    preventDefault?: () => void;
}

export interface EventBindable {
    mousedown?(ev: PointerEventLike): void;
    mouseup?(ev: PointerEventLike): void;
    mousemove?(ev: PointerEventLike): void;
    mouseenter?(ev: PointerEventLike): void;
    mouseover?(ev: PointerEventLike): void;
    mouseout?(ev: PointerEventLike): void;
    mouseleave?(ev: PointerEventLike): void;
    mouseclick?(ev: PointerEventLike): void;
    mousedrag?(ev: PointerEventLike): void;
}

interface DEltMethods {
    customized?: boolean;
    find(query: string): DElt;
    findAll(query: string): DElt[];
    removeAll(): DElt;
    remove(): DElt;
    stl(a0: string, a1?: string | number): DElt;
    att(a0: string, a1?: string | number): DElt;
    cls(cls: string): DElt;
    inner(html: string): DElt;
    show(): DElt;
    hide(): DElt;
    add(obj: Node): DElt;
    append(str: string): DElt;
    shape(tpe: string): DElt;

    prevent: boolean;
    preventDefault(bool: boolean): DElt;

    mousedown(cb?: (ev: PointerEventLike) => void): DElt;
    mouseup(cb?: (ev: PointerEventLike) => void): DElt;
    mousemove(cb?: (ev: PointerEventLike) => void): DElt;
    mouseenter(cb?: (ev: PointerEventLike) => void): DElt;
    mouseover(cb?: (ev: PointerEventLike) => void): DElt;
    mouseout(cb?: (ev: PointerEventLike) => void): DElt;
    mouseleave(cb?: (ev: PointerEventLike) => void): DElt;
    mouseclick(cb: (ev: PointerEventLike) => void): void;
    mousedrag(cb: (ev: PointerEventLike) => void): void;
    bindEvents(obj: EventBindable | undefined): DElt;

    windowMouseMoveEvent?: ((ev: PointerEventLike) => void) & { MouseEvent_Function?: (ev: Event) => void };
    windowMouseUpEvent?: ((ev: PointerEventLike) => void) & { MouseEvent_Function?: (ev: Event) => void };
}

// `Element`'s native `remove(): void` (from ChildNode) is overridden below by our
// chainable `remove(): DElt`, so it is omitted from the base type first.
type BaseElt = Omit<Element & ElementCSSInlineStyle, "remove">;
export type DElt = BaseElt & DEltMethods;

function customize(e: Element | null): DElt | null {
    if (!e || (e as DElt).customized) return e as DElt | null;
    const elt = e as DElt;
    elt.customized = true;

    elt.find = (query: string) => customize(elt.querySelector(query)) as DElt;
    elt.findAll = (query: string) => {
        const res: DElt[] = [];
        elt.querySelectorAll(query).forEach((node) => {
            const c = customize(node);
            if (c) res.push(c);
        });
        return res;
    };
    elt.removeAll = () => {
        if (elt.windowMouseMoveEvent?.MouseEvent_Function)
            window.removeEventListener("mousemove", elt.windowMouseMoveEvent.MouseEvent_Function);
        if (elt.windowMouseUpEvent?.MouseEvent_Function)
            window.removeEventListener("mouseup", elt.windowMouseUpEvent.MouseEvent_Function);
        return elt.remove();
    };
    elt.remove = () => {
        if (elt.parentNode) elt.parentNode.removeChild(elt);
        return elt;
    };
    elt.stl = (a0: string, a1?: string | number) => {
        if (a1 !== undefined) {
            (elt.style as unknown as Record<string, string>)[a0] = String(a1);
        } else {
            a0.split(";").forEach((part) => {
                if (!part.trim()) return;
                const a = part.split(":");
                const pty = a.shift() as string;
                const arg = a.join(":");
                (elt.style as unknown as Record<string, string>)[pty.trim()] = arg.trim();
            });
        }
        return elt;
    };
    elt.att = (a0: string, a1?: string | number) => {
        if (a1 !== undefined) {
            elt.setAttribute(a0, String(a1));
        } else {
            a0.split(";").forEach((part) => {
                if (!part.trim()) return;
                const a = part.split(":");
                const pty = a.shift() as string;
                const arg = a.join(":");
                elt.setAttribute(pty.trim(), arg.trim());
            });
        }
        return elt;
    };
    elt.cls = (cls: string) => {
        elt.className = cls;
        return elt;
    };
    elt.inner = (html: string) => {
        elt.innerHTML = html;
        return elt;
    };
    elt.show = () => {
        elt.style.display = "block";
        return elt;
    };
    elt.hide = () => {
        elt.style.display = "none";
        return elt;
    };
    elt.add = (obj: Node) => {
        elt.appendChild(obj);
        return elt;
    };
    elt.append = (str: string) => {
        elt.innerHTML += str;
        return elt;
    };
    // Only for svg elements :
    elt.shape = (tpe: string) => customize(document.createElementNS(elt.namespaceURI, tpe)) as DElt;

    // ***************************************
    // *********** EVENTS PART ***************
    // ***************************************
    elt.prevent = true;
    elt.preventDefault = (bool: boolean) => {
        elt.prevent = bool;
        return elt;
    };

    const ongoingtouch = (tchs: TouchList): Touch | null => {
        for (let i = 0; i < tchs.length; i++) {
            if (tchs[i].identifier !== undefined) return tchs[i];
        }
        return null;
    };

    const exeMouse = (
        target: EventTarget & { prevent?: boolean },
        mouse: string,
        cb?: ((ev: PointerEventLike) => void) & { MouseEvent_Function?: (ev: Event) => void }
    ) => {
        if (!cb) return;
        cb.MouseEvent_Function = (ev: Event) => {
            if ((target as DElt).prevent) ev.preventDefault();
            cb(ev as unknown as PointerEventLike);
        };
        target.addEventListener(mouse, cb.MouseEvent_Function, false);
    };

    const exeTouch = (
        target: DElt,
        touch: string | null,
        cb?: ((ev: PointerEventLike) => void) & { id?: number | null; TouchEvent_Function?: (ev: TouchEvent) => void }
    ) => {
        if (!cb || !touch) return;
        cb.id = null;
        cb.TouchEvent_Function = (ev: TouchEvent) => {
            let t: Touch | null;
            if (target.prevent) ev.preventDefault();
            if (!cb.id) {
                t = ev.changedTouches[ev.changedTouches.length - 1];
                cb.id = t.identifier;
            } else {
                t = ongoingtouch(ev.changedTouches);
            }
            if (t) cb(t as unknown as PointerEventLike);
        };
        target.addEventListener(touch, cb.TouchEvent_Function as EventListener, false);
    };

    const exe = (
        target: DElt,
        mouse: string,
        touch: string | null,
        cb?: ((ev: PointerEventLike) => void) & {
            MouseEvent_Function?: (ev: Event) => void;
            id?: number | null;
            TouchEvent_Function?: (ev: TouchEvent) => void;
        }
    ) => {
        exeMouse(target, mouse, cb);
        exeTouch(target, touch, cb);
    };

    elt.mousedown = (cb) => {
        exe(elt, "mousedown", "touchstart", cb);
        return elt;
    };
    elt.mouseup = (cb) => {
        exe(elt, "mouseup", "touchend", cb);
        return elt;
    };
    elt.mousemove = (cb) => {
        exe(elt, "mousemove", "touchmove", cb);
        return elt;
    };
    elt.mouseenter = (cb) => {
        exe(elt, "mouseenter", null, cb);
        return elt;
    };
    elt.mouseover = (cb) => {
        exe(elt, "mouseover", null, cb);
        return elt;
    };
    elt.mouseout = (cb) => {
        exe(elt, "mouseout", null, cb);
        return elt;
    };
    elt.mouseleave = (cb) => {
        exe(elt, "mouseleave", null, cb);
        return elt;
    };
    elt.mouseclick = (cb) => {
        let chrono: Date | undefined;
        let x0 = 0,
            y0 = 0;
        exe(elt, "mousedown", "touchstart", (ev) => {
            chrono = new Date();
            x0 = ev.pageX;
            y0 = ev.pageY;
        });
        exe(elt, "mouseup", "touchend", (ev) => {
            const nd = new Date();
            if (chrono && nd.getTime() - chrono.getTime() < $.click_delay) {
                const x1 = ev.pageX,
                    y1 = ev.pageY;
                if ((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0) < $.click_ray * $.click_ray) {
                    cb(ev);
                }
            }
        });
    };
    elt.mousedrag = (cb) => {
        let click = false;
        let oldX = 0,
            oldY = 0;
        exe(elt, "mousedown", "touchstart", (ev) => {
            click = true;
            oldX = ev.pageX;
            oldY = ev.pageY;
            if (ev.stopPropagation) ev.stopPropagation();
        });
        elt.windowMouseMoveEvent = (ev: PointerEventLike) => {
            if (click) {
                ev.dX = ev.pageX - oldX;
                ev.dY = ev.pageY - oldY;
                oldX = ev.pageX;
                oldY = ev.pageY;
                cb(ev);
            }
        };
        elt.windowMouseUpEvent = () => {
            click = false;
        };
        exeMouse(window, "mousemove", elt.windowMouseMoveEvent);
        exeTouch(elt, "touchmove", elt.windowMouseMoveEvent);
        exeMouse(window, "mouseup", elt.windowMouseUpEvent);
        exeTouch(elt, "touchend", elt.windowMouseUpEvent);
    };

    elt.bindEvents = (obj) => {
        if (!obj) return elt;
        if (obj.mousedown) elt.mousedown(obj.mousedown.bind(obj));
        if (obj.mouseup) elt.mouseup(obj.mouseup.bind(obj));
        if (obj.mousemove) elt.mousemove(obj.mousemove.bind(obj));
        if (obj.mouseenter) elt.mouseenter(obj.mouseenter.bind(obj));
        if (obj.mouseover) elt.mouseover(obj.mouseover.bind(obj));
        if (obj.mouseout) elt.mouseout(obj.mouseout.bind(obj));
        if (obj.mouseleave) elt.mouseleave(obj.mouseleave.bind(obj));
        if (obj.mouseclick) elt.mouseclick(obj.mouseclick.bind(obj));
        if (obj.mousedrag) elt.mousedrag(obj.mousedrag.bind(obj));
        return elt;
    };

    return elt;
}

interface DFn {
    (sel: string | Element): DElt;
    click_delay: number;
    click_ray: number;
    create(tpe: string): DElt;
    createSVG(): DElt;
    createShape(svg: DElt, tpe: string): DElt;
}

function dollar(sel: string | Element): DElt {
    let elt: Element | null = sel instanceof Element ? sel : document.getElementById(sel);
    if (!elt) elt = document.querySelector(sel as string);
    const customized = customize(elt);
    if (!customized) throw new Error(`Element not found: ${String(sel)}`);
    return customized;
}

export const $ = dollar as DFn;

// ************************************
// *********** PARAMETERS *************
// ************************************
$.click_delay = 700; // click delay for mouseclick event
$.click_ray = 5; // error ray for mouseclick event

$.create = (tpe: string) => $(document.createElement(tpe));
$.createSVG = () => $(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
$.createShape = (svg: DElt, tpe: string) => $(document.createElementNS(svg.namespaceURI, tpe));
