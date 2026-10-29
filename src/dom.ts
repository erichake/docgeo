const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export type PointerDelta = readonly [number, number];
export type PointerPosition = [number, number];

export interface DOMOnOptions {
    prevent?: boolean;
    capture?: boolean;
    passive?: boolean;
}

type ListenerRegistration = {
    target: EventTarget;
    type: string;
    listener: EventListener;
    options?: boolean | EventListenerOptions;
};

/**
 * Lightweight chainable wrapper around a native DOM element.
 *
 * Contrary to the first version of dom_design, native elements are not mutated:
 * wrapper state and event-listener ownership stay local to this object.
 */
export class DOMElement {
    private readonly element: Element;
    private readonly listeners: ListenerRegistration[] = [];
    private readonly cleanups = new Set<() => void>();
    private value: unknown;
    pinching = false;

    constructor(element: Element) {
        this.element = element;
    }

    dom(): Element {
        return this.element;
    }

    width(): number {
        return this.element.getBoundingClientRect().width;
    }

    height(): number {
        return this.element.getBoundingClientRect().height;
    }

    observeResize(callback: (width: number, height: number) => void): this {
        const observer = new ResizeObserver(([entry]) => {
            callback(entry.contentRect.width, entry.contentRect.height);
        });
        observer.observe(this.element);
        this.cleanups.add(() => observer.disconnect());
        return this;
    }

    svgPoint(event: MouseEvent): PointerPosition {
        const svgElement = this.element as SVGElement;
        const svg = svgElement.ownerSVGElement ?? (svgElement as SVGSVGElement);
        const matrix = svg.getScreenCTM()!;
        const x = event.clientX - matrix.e;
        const y = event.clientY - matrix.f;
        const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
        return [
            (matrix.d * x - matrix.c * y) / determinant,
            (-matrix.b * x + matrix.a * y) / determinant,
        ];
    }

    setValue(value: unknown): this {
        this.value = value;
        return this;
    }

    getValue(): unknown {
        return this.value;
    }

    find(query: string): DOMElement | null {
        const element = this.element.querySelector(query);
        return element ? $(element) : null;
    }

    findAll(query: string): DOMElement[] {
        return Array.from(this.element.querySelectorAll(query), (element) =>
            $(element),
        );
    }

    remove(): this {
        this.element.remove();
        return this;
    }

    /** Removes the element and every event listener owned by this wrapper. */
    dispose(): void {
        this.cleanups.forEach((cleanup) => cleanup());
        this.cleanups.clear();
        this.listeners
            .splice(0)
            .forEach(({ target, type, listener, options }) => {
                target.removeEventListener(type, listener, options);
            });
        this.element.remove();
    }

    stl(property: string, value?: string | number): this {
        const style = (this.element as HTMLElement | SVGElement).style;
        if (value !== undefined) {
            style.setProperty(property, String(value));
            return this;
        }

        splitDeclarations(property).forEach(([name, declarationValue]) => {
            style.setProperty(name, declarationValue);
        });
        return this;
    }

    att(attribute: string, value?: string | number): this {
        if (value !== undefined) {
            this.element.setAttribute(attribute, String(value));
            return this;
        }

        splitDeclarations(attribute).forEach(([name, attributeValue]) => {
            this.element.setAttribute(name, attributeValue);
        });
        return this;
    }

    getAtt(attribute: string): string | null {
        return this.element.getAttribute(attribute);
    }

    cls(className: string): this {
        this.element.setAttribute("class", className);
        return this;
    }

    addClass(className: string): this {
        this.element.classList.add(className);
        return this;
    }

    removeClass(className: string): this {
        this.element.classList.remove(className);
        return this;
    }

    toggleClass(className: string, force?: boolean): this {
        this.element.classList.toggle(className, force);
        return this;
    }

    inner(): string;
    inner(html: string): this;
    inner(html?: string): string | this {
        if (html === undefined) return this.element.innerHTML;
        this.element.innerHTML = html;
        return this;
    }

    text(): string;
    text(content: string): this;
    text(content?: string): string | this {
        if (content === undefined) return this.element.textContent ?? "";
        this.element.textContent = content;
        return this;
    }

    show(display = "block"): this {
        return this.stl("display", display);
    }

    hide(): this {
        return this.stl("display", "none");
    }

    isHidden(): boolean {
        return getComputedStyle(this.element).display === "none";
    }

    add(...children: Array<Node | DOMElement>): this {
        children.forEach((child) => {
            this.element.appendChild(
                child instanceof DOMElement ? child.dom() : child,
            );
        });
        return this;
    }

    append(content: string | DOMElement): this {
        if (content instanceof DOMElement) return this.add(content);

        const template = document.createElement("template");
        template.innerHTML = content;
        this.element.appendChild(template.content.cloneNode(true));
        return this;
    }

    shape<K extends keyof SVGElementTagNameMap>(tagName: K): DOMElement {
        return $(
            document.createElementNS(
                this.element.namespaceURI ?? SVG_NAMESPACE,
                tagName,
            ),
        );
    }

    on<K extends keyof GlobalEventHandlersEventMap>(
        type: K,
        callback: (event: GlobalEventHandlersEventMap[K]) => void,
        options: boolean | DOMOnOptions = true,
    ): EventListener {
        const normalized = normalizeEventOptions(options);
        const listener: EventListener = (event) => {
            if (normalized.prevent && !normalized.passive)
                event.preventDefault();
            callback(event as GlobalEventHandlersEventMap[K]);
        };
        const nativeOptions: AddEventListenerOptions = {
            capture: normalized.capture,
            passive: normalized.passive,
        };
        this.element.addEventListener(type, listener, nativeOptions);
        this.listeners.push({
            target: this.element,
            type,
            listener,
            options: { capture: normalized.capture },
        });
        return listener;
    }

    off(type: string, listener: EventListener, capture = false): void {
        this.element.removeEventListener(type, listener, { capture });
        const index = this.listeners.findIndex(
            (registration) =>
                registration.type === type &&
                registration.listener === listener,
        );
        if (index !== -1) this.listeners.splice(index, 1);
    }

    /**
     * Registers a short pointer gesture. Unlike the native click event, a drag
     * cannot accidentally be interpreted as a click.
     */
    tap(
        callback: (event: PointerEvent) => void,
        maximumDelay = $.clickDelay,
        maximumDistance = $.clickRadius,
    ): this {
        let pointerId: number | null = null;
        let startedAt = 0;
        let startX = 0;
        let startY = 0;

        this.on("pointerdown", (event) => {
            if (
                !isPrimaryAction(event) ||
                (pointerId !== null && pointerId !== event.pointerId)
            )
                return;
            pointerId = event.pointerId;
            startedAt = performance.now();
            startX = event.clientX;
            startY = event.clientY;
        });
        this.on("pointerup", (event) => {
            if (event.pointerId !== pointerId) return;
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;
            const isTap =
                performance.now() - startedAt <= maximumDelay &&
                dx * dx + dy * dy <= maximumDistance * maximumDistance;
            pointerId = null;
            if (isTap) callback(event);
        });
        this.on("pointercancel", (event) => {
            if (event.pointerId === pointerId) pointerId = null;
        });
        this.cleanups.add(() => {
            pointerId = null;
        });
        return this;
    }

    pinch(
        callback: (
            scale: number,
            from: PointerPosition,
            to: PointerPosition,
        ) => void,
    ): this {
        this.stl("touch-action", "none");
        const root = $(this.element.ownerDocument.documentElement);
        const pointers = new Map<number, PointerEvent>();
        let cancelling = false;
        const geometry = (): [PointerPosition, number] => {
            const [a, b] = [...pointers.values()].map((event) =>
                this.element instanceof SVGElement
                    ? this.svgPoint(event)
                    : [event.clientX, event.clientY],
            );
            return [
                [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
                Math.hypot(a[0] - b[0], a[1] - b[1]),
            ];
        };
        const consume = (event: PointerEvent): void => {
            event.preventDefault();
            event.stopPropagation();
        };
        const options = { capture: true, prevent: false };
        // Before the editor's body listeners and the objects' drag handlers.
        const down = root.on(
            "pointerdown",
            (event) => {
                if (
                    event.pointerType !== "touch" ||
                    !this.element.contains(event.target as Node)
                )
                    return;
                pointers.set(event.pointerId, event);
                if (pointers.size === 2 && !this.pinching) {
                    const first = pointers.values().next().value!;
                    cancelling = true;
                    first.target!.dispatchEvent(
                        new PointerEvent("pointercancel", first),
                    );
                    cancelling = false;
                    this.pinching = true;
                    this.element.setPointerCapture(first.pointerId);
                }
                if (this.pinching) {
                    this.element.setPointerCapture(event.pointerId);
                    consume(event);
                }
            },
            options,
        );
        const move = root.on(
            "pointermove",
            (event) => {
                if (!pointers.has(event.pointerId)) return;
                const previous = pointers.size === 2 ? geometry() : null;
                pointers.set(event.pointerId, event);
                if (!this.pinching) return;
                if (previous && previous[1] > 0) {
                    const [center, distance] = geometry();
                    if (distance > 0)
                        callback(distance / previous[1], previous[0], center);
                }
                consume(event);
            },
            options,
        );
        const finish = (event: PointerEvent): void => {
            if (cancelling || !pointers.delete(event.pointerId)) return;
            if (!this.pinching) return;
            consume(event);
            if (this.element.hasPointerCapture(event.pointerId))
                this.element.releasePointerCapture(event.pointerId);
            // Consume the remaining finger too: lifting it must not click.
            if (!pointers.size) this.pinching = false;
        };
        const up = root.on("pointerup", finish, options);
        const cancel = root.on("pointercancel", finish, options);
        this.cleanups.add(() => {
            root.off("pointerdown", down, true);
            root.off("pointermove", move, true);
            root.off("pointerup", up, true);
            root.off("pointercancel", cancel, true);
            pointers.forEach((_, id) => {
                if (this.element.hasPointerCapture(id))
                    this.element.releasePointerCapture(id);
            });
            pointers.clear();
            this.pinching = false;
        });
        return this;
    }

    /** Tracks one pointer and reports its displacement since the preceding event. */
    drag(
        callback: (event: PointerEvent, delta: PointerDelta) => void,
        before?: (event: PointerEvent) => boolean | void,
        after?: (event: PointerEvent, cancelled: boolean) => void,
        button = 0,
    ): this {
        let pointerId: number | null = null;
        let oldX = 0;
        let oldY = 0;
        // In the SVG's units, which its viewBox may scale (see fit.ts).
        const position = (event: PointerEvent): PointerPosition =>
            this.element instanceof SVGElement
                ? this.svgPoint(event)
                : [event.clientX, event.clientY];

        const finish = (event: PointerEvent, cancelled: boolean): void => {
            if (event.pointerId !== pointerId) return;
            pointerId = null;
            if (this.element.hasPointerCapture(event.pointerId)) {
                this.element.releasePointerCapture(event.pointerId);
            }
            after?.(event, cancelled);
        };

        this.on("pointerdown", (event) => {
            // The same pointer pressed again: the browser lost the end of its
            // previous gesture (e.g. released outside the window).
            if (
                !isPrimaryAction(event, button) ||
                (pointerId !== null && pointerId !== event.pointerId)
            )
                return;
            if (before?.(event) === false) return;
            pointerId = event.pointerId;
            [oldX, oldY] = position(event);
            event.stopPropagation();
            this.element.setPointerCapture(pointerId);
        });
        this.on("pointermove", (event) => {
            if (event.pointerId !== pointerId) return;
            const [x, y] = position(event);
            const delta: PointerDelta = [x - oldX, y - oldY];
            oldX = x;
            oldY = y;
            callback(event, delta);
        });
        this.on("pointerup", (event) => finish(event, false));
        this.on("pointercancel", (event) => finish(event, true));
        this.on("lostpointercapture", (event) => finish(event, true));
        this.cleanups.add(() => {
            if (
                pointerId !== null &&
                this.element.hasPointerCapture(pointerId)
            ) {
                this.element.releasePointerCapture(pointerId);
            }
            pointerId = null;
        });
        return this;
    }
}

interface Dollar {
    (selector: string | Element | DOMElement): DOMElement;
    clickDelay: number;
    clickRadius: number;
    create<K extends keyof HTMLElementTagNameMap>(tagName: K): DOMElement;
    createSVG(): DOMElement;
    createShape<K extends keyof SVGElementTagNameMap>(
        svg: DOMElement,
        tagName: K,
    ): DOMElement;
}

function dollar(selector: string | Element | DOMElement): DOMElement {
    if (selector instanceof DOMElement) return selector;
    if (selector instanceof Element) return new DOMElement(selector);

    const element =
        document.getElementById(selector) ?? document.querySelector(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);
    return new DOMElement(element);
}

export const $ = dollar as Dollar;

$.clickDelay = 700;
$.clickRadius = 5;
$.create = (tagName) => $(document.createElement(tagName));
$.createSVG = () => $(document.createElementNS(SVG_NAMESPACE, "svg"));
$.createShape = (svg, tagName) =>
    $(
        document.createElementNS(
            svg.dom().namespaceURI ?? SVG_NAMESPACE,
            tagName,
        ),
    );

function splitDeclarations(
    declarations: string,
): Array<readonly [string, string]> {
    const result: Array<readonly [string, string]> = [];
    declarations.split(";").forEach((declaration) => {
        const separator = declaration.indexOf(":");
        if (separator === -1) return;
        const name = declaration.slice(0, separator).trim();
        const value = declaration.slice(separator + 1).trim();
        if (name) result.push([name, value]);
    });
    return result;
}

function normalizeEventOptions(
    options: boolean | DOMOnOptions,
): Required<DOMOnOptions> {
    if (typeof options === "boolean") {
        return { prevent: options, capture: false, passive: false };
    }
    return {
        prevent: options.prevent ?? true,
        capture: options.capture ?? false,
        passive: options.passive ?? false,
    };
}

function isPrimaryAction(event: PointerEvent, button = 0): boolean {
    return (
        event.isPrimary &&
        (event.pointerType !== "mouse" || event.button === button)
    );
}
