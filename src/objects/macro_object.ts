import type { construction } from "../construction";
import { angle_bisector_object } from "./angle_bisector_object";
import { angle_object } from "./angle_object";
import { center_object } from "./center_object";
import { construction_object, type DgoContext } from "./construction_object";
import { expression_object } from "./expression_object";
import { fixed_angle_object } from "./fixed_angle_object";
import { intersection_object } from "./intersection_object";
import { point_object } from "./point_object";
import { polygon_object } from "./polygon_object";
import { primitive_arc_object } from "./primitive_arc_object";
import { primitive_circle_object } from "./primitive_circle_object";
import { primitive_line_object } from "./primitive_line_object";
import { primitive_quadric_object } from "./primitive_quadric_object";
import { ray_line_object } from "./ray_line_object";
import { segment_object } from "./segment_object";
import { sphere_object } from "./sphere_object";
import { vector_object } from "./vector_object";

// A macro-construction, as its .dgo definition gives it: see DGO.md.
export interface MacroMethod {
    // The type and message of each initial, in order, and for a fixed one
    // the name it is looked for by (see MACROS.md).
    initials: [string, string, string?][];
    // Those of the initials and their sub-objects, by their local indices,
    // in the figure where it was defined, "" for one it didn't have.
    names?: string[];
    help: string;
    // Its .dgo entries, each with its style itself rather than its index.
    body: unknown[][];
    // Their local indices, in the order of the macro's finals.
    finals: number[];
}

export interface Macro {
    name: string;
    finals: string[];
    // A data URL.
    icon: string | null;
    methods: MacroMethod[];
}

export const isRay = (object: construction_object): boolean =>
    object instanceof ray_line_object ||
    object instanceof angle_bisector_object ||
    object instanceof fixed_angle_object;

// What each type of initial accepts, exactly.
export const MACRO_TYPES: Record<
    string,
    (object: construction_object) => boolean
> = {
    point: (object) => object instanceof point_object,
    line: (object) =>
        object instanceof primitive_line_object &&
        !(object instanceof segment_object) &&
        !isRay(object),
    ray: isRay,
    segment: (object) =>
        object instanceof segment_object && !(object instanceof vector_object),
    vector: (object) => object instanceof vector_object,
    circle: (object) =>
        object instanceof primitive_circle_object &&
        !(object instanceof primitive_arc_object),
    arc: (object) => object instanceof primitive_arc_object,
    conic: (object) => object instanceof primitive_quadric_object,
    polygon: (object) => object instanceof polygon_object && !object.plane,
    plane: (object) => object instanceof polygon_object && object.plane,
    sphere: (object) => object instanceof sphere_object,
    angle: (object) => object instanceof angle_object,
    number: (object) => object instanceof expression_object && !object.formula,
};

// How many sub-objects each type of initial has (see initialSlots).
export const SUB_OBJECTS: Record<string, number> = {
    segment: 2,
    vector: 2,
    ray: 1,
    circle: 1,
    arc: 3,
    sphere: 1,
    angle: 3,
};

// An initial in a body: it reads the object's state as it is, but has
// links of its own, so that the body stays out of the figure's graph, and
// virtual parts of its own (see polygon_part.ts), which the application
// computes. Locked: a polygon of the body never drags it.
function standIn<T extends construction_object>(object: T): T {
    return Object.create(object, {
        parents: { value: [], writable: true },
        children: { value: [], writable: true },
        reference: { value: undefined, writable: true },
        virtualParts: { value: undefined, writable: true },
        locked: { value: true, writable: true },
        flat: { get: () => object.flat },
    });
}

// An end of an arc, the one it starts from or the other.
class arc_end extends point_object {
    moveable = false;

    constructor(
        c: construction,
        readonly arc: primitive_arc_object,
        readonly last: boolean,
    ) {
        super(c, null, [0, 0, 0], "intersection");
        this.addParents(arc);
    }

    computeGeometry(): void {
        const { arc } = this;
        this.defined = arc.defined;
        if (this.defined)
            this.coords = arc.pointAt(
                this.last ? arc.endAlpha : arc.startAlpha,
            );
    }
}

// An initial's sub-objects, then itself, as a body numbers them, through
// stand-ins, one per object of the figure; `c` is the body's construction.
export function initialSlots(
    c: construction,
    type: string,
    initial: construction_object,
    standIns: Map<construction_object, construction_object>,
): construction_object[] {
    const own = <T extends construction_object>(object: T): T => {
        if (!standIns.has(object)) standIns.set(object, standIn(object));
        return standIns.get(object) as T;
    };
    const object = own(initial);
    switch (type) {
        case "segment":
        case "vector": {
            const { P1, P2 } = object as unknown as segment_object;
            return [own(P1), own(P2), object];
        }
        case "ray":
            return [
                own((object as unknown as primitive_line_object).P1),
                object,
            ];
        case "circle":
            return [c.add(new center_object(c, null, object as never)), object];
        case "arc": {
            const arc = object as unknown as primitive_arc_object;
            return [
                c.add(new center_object(c, null, arc)),
                c.add(new arc_end(c, arc, false)),
                c.add(new arc_end(c, arc, true)),
                object,
            ];
        }
        case "sphere":
            return [own((object as unknown as sphere_object).P1), object];
        case "angle": {
            const { A, O, B } = object as unknown as angle_object;
            return [own(A), own(O), own(B), object];
        }
        default:
            return [object];
    }
}

// An application of a macro: the node of the graph that computes the body
// of one of its methods, apart from the figure, whose finals are adopted in
// the figure, each with this node as its only parent.
export class macro_object extends construction_object {
    // What it computes, in order: its own finals only when some object of
    // the body needs them, the figure computing them anyway.
    private computed: construction_object[];
    // Its branches as the body defines them.
    private bodyBranches: unknown[];
    // In body order, the intersections numbered by a branch and the
    // applications in the body, which have branches of their own; not the
    // finals of those, adopted in the body.
    readonly branched: (intersection_object | macro_object)[];
    readonly finals: construction_object[];

    constructor(
        c: construction,
        name: string | null | undefined,
        readonly macro: Macro,
        readonly method: number,
        // Objects, or constant formulas for numbers.
        readonly initials: (construction_object | string)[],
        // Its objects, in the order they were made, those of the body among
        // them.
        readonly objects: construction_object[],
        readonly standIns: construction_object[],
        // The body's objects by their local indices.
        readonly local: construction_object[],
        // Its finals' .dgo types in the body.
        readonly finalTags: string[],
    ) {
        super(c, name, "expression");
        this.finals = macro.methods[method].finals.map((final) => local[final]);
        this.branched = objects.filter(
            (object): object is intersection_object | macro_object =>
                !object.output &&
                ((object instanceof intersection_object && !object.away) ||
                    object instanceof macro_object),
        );
        this.computed = objects.filter(
            (object) => !this.finals.includes(object) || object.children.length,
        );
        this.addParents(
            ...initials.filter(
                (initial): initial is construction_object =>
                    typeof initial !== "string",
            ),
        );
        this.bodyBranches = this.branches;
    }

    get branches(): unknown[] {
        return this.branched.map((object) =>
            object instanceof macro_object
                ? object.branches
                : (object.branch ?? object.order),
        );
    }

    dgo(context: DgoContext): [string, unknown] {
        const initials = this.initials.map((initial) =>
            typeof initial === "string" ? initial : context.index(initial),
        );
        const parameters: unknown[] = [
            this.C.macros.indexOf(this.macro),
            this.method,
            initials,
        ];
        const branches = this.branches;
        if (JSON.stringify(branches) !== JSON.stringify(this.bodyBranches))
            parameters.push(branches);
        return ["Mac", parameters];
    }

    computeGeometry(): void {
        this.standIns.forEach((object) =>
            object.virtualParts?.forEach((part) => part.computeGeometry()),
        );
        this.computed.forEach((object) => {
            object.embeddedPoints?.forEach((point) => point.computeGeometry());
            object.computeGeometry();
            object.virtualParts?.forEach((part) => part.computeGeometry());
        });
    }

    project(): void {
        this.computed.forEach((object) => {
            object.embeddedPoints?.forEach((point) => point.project());
            object.project();
            object.virtualParts?.forEach((part) => part.project());
        });
    }
}

// The final point of an application outside the figure, computed with it:
// the image of a point by a transformation macro (see
// transformed_object.ts).
export class applied_point extends point_object {
    moveable = false;

    // Its parent is the point it maps, as the locus of its image needs.
    constructor(
        c: construction,
        readonly node: macro_object,
        point: point_object,
    ) {
        super(c, null, [0, 0, 0], "intersection");
        this.addParents(point);
    }

    computeGeometry(): void {
        this.node.computeGeometry();
        const final = this.node.finals[0] as point_object;
        final.computeGeometry();
        this.defined = final.defined;
        if (this.defined) this.coords = final.coords;
    }
}
