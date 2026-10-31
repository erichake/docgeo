import { construction, type DgpadLike } from "./construction";
import {
    describeDgo,
    importDgoFromBlob,
    readDgo,
    writeDgo,
    type DgoFigure,
} from "./dgo";
import { $ } from "./dom";
import {
    builtView,
    figureState,
    type FigureState,
    figureTargets,
    figureValues,
    hideTarget,
    lockFigure,
    objectValue,
    placeOn,
    stateFigure,
} from "./figure_state";
import { frameRegion, hideFrame, showFrame } from "./frame";

// The embedded mode's postMessage protocol: see EMBED.md.
const PROTOCOL = 1;

export interface Embedder extends DgpadLike {
    scene: construction;
}

type Message = Record<string, unknown>;
type Answer = [unknown, Transferable[]?];

export function embed(app: Embedder): void {
    // The figure loaded, which reset and setState start from, and its
    // modifiable objects' values.
    let base: { figure: DgoFigure; values: Map<string, string> } | null = null;
    // The view the figure was built with.
    let view = builtView(app.scene);
    // The state the last change event reported.
    let reported = "{}";
    // What lock leaves manipulable, null when nothing is locked.
    let unlocked: string[] | null = null;
    // What setHidden changed since the figure was loaded.
    const visibility = new Map<string, boolean>();
    // What rebase changed in the base figure since it was loaded.
    let rebased: FigureState = {};
    // The figure loaded in a window of no size, an iframe in a hidden
    // element, which is placed once the window has one.
    let unplaced: { blob: Blob; format: string } | null = null;

    const post = (message: Message, transfer: Transferable[] = []): void =>
        window.parent.postMessage(
            { docgeo: PROTOCOL, ...message },
            "*",
            transfer,
        );
    const invalid = (): never => {
        throw new Error("Invalid request");
    };
    const renew = (): void => {
        app.scene.dispose();
        app.scene = construction.create(app);
    };
    // Once the figure is built.
    const settle = (): void => {
        if (unlocked) lockFigure(app.scene, unlocked);
        app.scene.flush();
        view = builtView(app.scene);
        reported = JSON.stringify(state());
        app.scene.reveal();
    };
    // `values`: the state whose coordinates place points on objects.
    const rebuild = (figure: DgoFigure, values: FigureState = {}): void => {
        renew();
        readDgo(app.scene, figure, true);
        placeOn(app.scene, values);
        settle();
    };
    const state = () => figureState(app.scene, base!.values, view);
    // Makes the current figure the base one, its view aside.
    const rebase = (): void => {
        base = {
            figure: stateFigure(app.scene, base!.figure, state()),
            values: figureValues(app.scene, view),
        };
        reported = "{}";
    };
    // Makes the figure the base one.
    const open = async (blob: Blob, format: string): Promise<string[]> => {
        base = null;
        renew();
        unplaced =
            app.scene.width > 0 && app.scene.height > 0
                ? null
                : { blob, format };
        let unsupported: string[];
        try {
            unsupported =
                format === "dgo"
                    ? await importDgoFromBlob(app.scene, blob, true)
                    : format === "ggb"
                      ? await (
                            await import("./ggb_importer")
                        ).importGgbFromBlob(app.scene, blob)
                      : (await import("./dgp_importer")).importDgp(
                            app.scene,
                            await blob.text(),
                        );
        } catch (error) {
            // Discards what the failed import may have already built.
            renew();
            unplaced = null;
            throw error;
        }
        app.scene.flush();
        base = {
            figure: await describeDgo(app.scene),
            values: figureValues(app.scene, builtView(app.scene)),
        };
        // An import becomes the figure reset and setState rebuild.
        if (format === "dgo") settle();
        else rebuild(base.figure);
        return unsupported;
    };

    const requests: Record<string, (message: Message) => Promise<Answer>> = {
        async load({ data, format }) {
            if (
                !(data instanceof ArrayBuffer) ||
                !["dgo", "dgp", "ggb"].includes(format as string)
            )
                invalid();
            unlocked = null;
            visibility.clear();
            rebased = {};
            const unsupported = await open(
                new Blob([data as ArrayBuffer]),
                format as string,
            );
            return [{ unsupported }];
        },
        async save() {
            const data = await (
                await writeDgo(app.scene, frameRegion() ?? undefined)
            ).arrayBuffer();
            return [{ data }, [data]];
        },
        async targets() {
            return [figureTargets(app.scene)];
        },
        async value({ name }) {
            if (typeof name !== "string") invalid();
            return [objectValue(app.scene, name as string)];
        },
        async getState() {
            return [state()];
        },
        async setState({ state: values }) {
            rebuild(
                stateFigure(app.scene, base!.figure, values),
                values as FigureState,
            );
            return [null];
        },
        async reset() {
            rebuild(base!.figure);
            return [null];
        },
        async rebase() {
            rebased = { ...rebased, ...state() };
            rebase();
            return [null];
        },
        async lock({ except }) {
            if (!(
                Array.isArray(except) &&
                except.every((name) => typeof name === "string")
            ))
                invalid();
            lockFigure(app.scene, except as string[]);
            unlocked = except as string[];
            return [null];
        },
        async setHidden({ name, hidden }) {
            if (typeof name !== "string" || typeof hidden !== "boolean")
                invalid();
            base!.figure = hideTarget(
                app.scene,
                base!.figure,
                name as string,
                hidden as boolean,
            );
            visibility.set(name as string, hidden as boolean);
            return [null];
        },
        async frame({ show, w, h }) {
            if (!show) {
                hideFrame();
                return [null];
            }
            if (!(
                Number.isInteger(w) &&
                Number.isInteger(h) &&
                (w as number) > 0 &&
                (h as number) > 0
            ))
                invalid();
            showFrame(w as number, h as number, (region) =>
                post({ event: "frame", w: region.w, h: region.h }),
            );
            return [null];
        },
    };

    // One request at a time, in the order they came.
    let queue = Promise.resolve();
    window.addEventListener("message", (event) => {
        const message = event.data as Message;
        if (
            event.source !== window.parent ||
            typeof message !== "object" ||
            message === null ||
            message.docgeo !== PROTOCOL ||
            typeof message.type !== "string"
        )
            return;
        const { id, type } = message;
        queue = queue.then(async () => {
            try {
                if (!Object.prototype.hasOwnProperty.call(requests, type))
                    throw new Error(`Unknown request: ${type}`);
                if (!base && type !== "load" && type !== "frame")
                    throw new Error("No figure loaded");
                if (base) app.scene.flush();
                const [result, transfer] =
                    await requests[type as string](message);
                post({ id, ok: true, result }, transfer);
            } catch (error) {
                post({ id, ok: false, error: (error as Error).message });
            }
        });
    });

    // As if the figure were loaded now, with what the requests since then
    // changed.
    $("body").observeResize(() => {
        queue = queue.then(async () => {
            if (!unplaced || !app.scene.width || !app.scene.height) return;
            const current = state();
            await open(unplaced.blob, unplaced.format);
            visibility.forEach((hidden, name) => {
                base!.figure = hideTarget(
                    app.scene,
                    base!.figure,
                    name,
                    hidden,
                );
            });
            if (Object.keys(rebased).length) {
                rebuild(stateFigure(app.scene, base!.figure, rebased));
                rebase();
            }
            rebuild(stateFigure(app.scene, base!.figure, current));
        });
    });

    // Once a manipulation is over: a drag released, a checkbox ticked, an
    // input box's number typed. After the event's own handlers, which make
    // the change.
    const released = (): void => {
        setTimeout(() => {
            if (!base) return;
            const current = JSON.stringify(state());
            if (current === reported) return;
            reported = current;
            post({ event: "change" });
        });
    };
    const body = $("body");
    const options = { prevent: false, capture: true };
    body.on("pointerup", released, options);
    body.on("pointercancel", released, options);
    body.on("change", released, options);

    post({ event: "ready" });
}
