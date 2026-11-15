import type { construction } from "../construction";
import {
    vAdd,
    vCross,
    vDot,
    vNorm,
    vNormalize,
    vScale,
    vSub,
    type Vec3,
} from "../vec";
import type { construction_object, DgoContext } from "./construction_object";
import {
    dgoEquation,
    equationParents,
    equationReadsView,
    equationValue,
    type Equation,
} from "./equation_conic_object";
import { point_object } from "./point_object";
import { polygon_object } from "./polygon_object";
import type { primitive_line_object } from "./primitive_line_object";

// How it is given: through three points (Pl); through a point, parallel to
// a plane (PlP), containing a line (PlL) or orthogonal to it (PlO); or by
// an equation in x, y and z (PlE).
export type plane_definition =
    | { tag: "Pl"; points: [point_object, point_object, point_object] }
    | { tag: "PlP"; point: point_object; plane: polygon_object }
    | { tag: "PlL" | "PlO"; point: point_object; line: primitive_line_object }
    | { tag: "PlE"; equation: Equation };

// A plane, drawn like GeoGebra's clipped plane: a square of half side HALF
// around CENTER, along U, its corners its own vertices. In a figure of
// GeoGebra, it draws its section of the clipping box (see
// grid.geogebraBox), of up to six points.
export class plane_object extends polygon_object {
    definition: plane_definition;
    U: Vec3 = [1, 0, 0];
    private cuts: point_object[];

    constructor(
        c: construction,
        name: string | null | undefined,
        definition: plane_definition,
    ) {
        const points = (count: number) =>
            Array.from(
                { length: count },
                () => new point_object(c, null, [0, 0, 0]),
            );
        super(c, name, points(4));
        this.definition = definition;
        this.cuts = points(6);
        this.ownVertices = [...this.vertices, ...this.cuts];
        this.plane = true;
        this.readsView =
            definition.tag === "PlE" && equationReadsView(definition.equation);
        this.addParents(...this.sources());
    }

    private sources(): construction_object[] {
        const d = this.definition;
        return d.tag === "Pl"
            ? d.points
            : d.tag === "PlE"
              ? equationParents(d.equation)
              : [d.point, d.tag === "PlP" ? d.plane : d.line];
    }

    dgo(context: DgoContext): [string, unknown] {
        const d = this.definition;
        return [
            d.tag,
            d.tag === "PlE"
                ? dgoEquation(d.equation, context)
                : this.sources().map(context.index),
        ];
    }

    computeGeometry(): void {
        const frame = this.sources().every((source) => source.defined)
            ? this.frame()
            : null;
        const normal = frame && vNormalize(frame[1]);
        if (!frame || !normal || !frame.flat().every(Number.isFinite)) {
            this.defined = false;
            return;
        }
        const [center, , half, u] = frame;
        const v = vCross(normal, u);
        [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
        ].forEach(([s, t], index) => {
            const corner = this.vertices[index];
            corner.coords = vAdd(
                center,
                vScale(vAdd(vScale(u, s), vScale(v, t)), half),
            );
            corner.computeGeometry();
        });
        this.points = this.vertices;
        if (this.C.GRID.geogebraAxes && !this.C.GRID.is2D) {
            this.readsView = true;
            const cuts = boxSection(
                this.C.GRID.geogebraBox,
                normal,
                center,
                u,
                v,
            );
            // Out of the box, its square.
            if (cuts.length >= 3) {
                this.points = this.cuts.slice(0, cuts.length);
                this.points.forEach((point, index) => {
                    point.coords = cuts[index];
                    point.computeGeometry();
                });
            }
        }
        super.computeGeometry();
        [this.CENTER, this.NORMAL, this.HALF, this.U] = [
            center,
            normal,
            half,
            u,
        ];
    }

    // Its points' parameters stay put as the view changes.
    protected get parameterFrame(): Vec3[] {
        return this.vertices.slice(0, 3).map((point) => point.coords);
    }

    // Its center, normal, half side and the direction of its sides.
    private frame(): [Vec3, Vec3, number, Vec3] | null {
        const d = this.definition;
        if (d.tag === "Pl") {
            const [a, b, c] = d.points.map((point) => point.coords);
            const center = vScale(vAdd(vAdd(a, b), c), 1 / 3);
            const reach = [a, b, c].reduce(
                (sum, point) =>
                    sum + vDot(vSub(point, center), vSub(point, center)),
                25,
            );
            const u = vNormalize(vSub(b, a));
            return (
                u && [
                    center,
                    vCross(vSub(b, a), vSub(c, a)),
                    Math.sqrt(reach),
                    u,
                ]
            );
        }
        if (d.tag === "PlE") {
            const [g, x, y, z] = [
                [0, 0, 0],
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1],
            ].map((point) => equationValue(d.equation, this.C, point));
            const normal: Vec3 = [x - g, y - g, z - g];
            return this.through(
                vScale(normal, -g / vDot(normal, normal)),
                normal,
            );
        }
        const p = d.point.coords;
        if (d.tag === "PlP") return this.through(p, d.plane.NORMAL);
        const { VEC, P1 } = d.line;
        return this.through(
            p,
            d.tag === "PlO" ? VEC : vCross(VEC, vSub(P1.coords, p)),
        );
    }

    // Through p: a square around the foot of the origin, where GeoGebra's
    // view is centered, at least as large as the floor and always reaching
    // past p. (-sin θ, cos θ, 0), θ = atan2(y, x) of the normal, is
    // orthogonal to it.
    private through(p: Vec3, normal: Vec3): [Vec3, Vec3, number, Vec3] {
        const center = vScale(normal, vDot(normal, p) / vDot(normal, normal));
        const angle = Math.atan2(normal[1], normal[0]);
        return [
            center,
            normal,
            Math.sqrt(25 + vNorm(vSub(center, p)) ** 2),
            [-Math.sin(angle), Math.cos(angle), 0],
        ];
    }
}

// Where the plane through `center` cuts the box's edges, in turn.
function boxSection(
    [low, high]: [Vec3, Vec3],
    normal: Vec3,
    center: Vec3,
    u: Vec3,
    v: Vec3,
): Vec3[] {
    const corner = (i: number): Vec3 => [
        i & 1 ? high[0] : low[0],
        i & 2 ? high[1] : low[1],
        i & 4 ? high[2] : low[2],
    ];
    const cuts: Vec3[] = [];
    for (let i = 0; i < 8; i++)
        for (const bit of [1, 2, 4]) {
            if (i & bit) continue;
            const [a, b] = [corner(i), corner(i | bit)];
            const t = vDot(normal, vSub(center, a)) / vDot(normal, vSub(b, a));
            if (t >= 0 && t <= 1) cuts.push(vAdd(a, vScale(vSub(b, a), t)));
        }
    const middle = vScale(cuts.reduce(vAdd, [0, 0, 0]), 1 / cuts.length);
    const angle = (p: Vec3) =>
        Math.atan2(vDot(vSub(p, middle), v), vDot(vSub(p, middle), u));
    return cuts
        .sort((p, q) => angle(p) - angle(q))
        .filter(
            (p, k, sorted) => k === 0 || vNorm(vSub(p, sorted[k - 1])) > 1e-9,
        );
}

export function createPlane(
    c: construction,
    name: string | null | undefined,
    definition: plane_definition,
): plane_object {
    return c.add(new plane_object(c, name, definition));
}
