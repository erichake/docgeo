import type { construction } from "../construction";
import { evaluateFormula, formulaValue, usesView } from "../import/dgp_formula";
import { vAdd, vSub, type Vec3 } from "../vec";
import { dgoRadius, type circle1_radius } from "./circle1_object";
import { construction_object, type DgoContext } from "./construction_object";
import { point_object } from "./point_object";
import { vector_object } from "./vector_object";

// A vector, a point's position vector, or a formula whose value is one.
export type translation_vector =
    vector_object | point_object | Exclude<circle1_radius, number>;

// The image of P by the translation of vector u.
export class translation_object extends point_object {
    moveable = false;
    vector: translation_vector;
    point: point_object;

    constructor(
        c: construction,
        name: string | null | undefined,
        vector: translation_vector,
        point: point_object,
    ) {
        super(c, name, [0, 0, 0], "intersection");
        this.vector = vector;
        this.point = point;
        const formula = !(vector instanceof construction_object);
        this.readsView = formula && usesView(vector.formula);
        this.addParents(...(formula ? vector.refs.values() : [vector]), point);
    }

    dgo(context: DgoContext): [string, unknown] {
        const { vector } = this;
        return [
            "Tra",
            [
                vector instanceof construction_object
                    ? context.index(vector)
                    : dgoRadius(vector, context),
                context.index(this.point),
            ],
        ];
    }

    computeGeometry(): void {
        const u = this.value();
        if (!this.point.defined || !u) {
            this.defined = false;
            return;
        }
        this.coords = vAdd(this.point.coords, u);
        super.computeGeometry();
    }

    private value(): Vec3 | null {
        const { vector } = this;
        if (vector instanceof vector_object)
            return vector.defined
                ? vSub(vector.P2.coords, vector.P1.coords)
                : null;
        if (vector instanceof point_object)
            return vector.defined ? vector.coords : null;
        const vec3 = this.C.space;
        const value = formulaValue(
            evaluateFormula(vector.formula, {
                resolveIdentifier: (name) =>
                    vector.refs.get(name)!.scriptValue(vec3),
                view: () => this.C.formulaView(),
            }),
        );
        return Array.isArray(value)
            ? [value[0], value[1], value[2] ?? 0]
            : null;
    }

    mousedrag(_ev: PointerEvent): void {}
}

export function createTranslation(
    c: construction,
    name: string | null | undefined,
    vector: translation_vector,
    point: point_object,
): translation_object {
    return c.add(new translation_object(c, name, vector, point));
}
