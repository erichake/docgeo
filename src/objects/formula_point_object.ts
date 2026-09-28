import type { construction } from "../construction";
import {
    evaluateFormula,
    formulaSource,
    usesView,
    type FormulaNode,
} from "../import/dgp_formula";
import {
    dgoFormula,
    type construction_object,
    type DgoContext,
} from "./construction_object";
import type { expression_object } from "./expression_object";
import { point_object } from "./point_object";

export class formula_point_object extends point_object {
    moveable = false;
    formula: FormulaNode;
    refs: Map<string, construction_object>;
    // True in a 3D figure (DGPad's legacy SetCoords is3D flag): a
    // referenced point then resolves to its full 3D coordinates (e.g.
    // "P1+[-1,-1,1]", a cube vertex) instead of the 2D/complex-number
    // projection plain point-arithmetic formulas rely on.
    private vec3: boolean;
    // The free numbers a drag shifts, one per coordinate (a GeoGebra point
    // like "(a + x(F), b)", see changeableNumber in ggb_translate.ts):
    // DGPad itself never lets a formula point move.
    handles: [expression_object | null, expression_object | null] = [
        null,
        null,
    ];

    constructor(
        c: construction,
        name: string | null | undefined,
        formula: FormulaNode,
        refs: Map<string, construction_object>,
        vec3 = false,
    ) {
        super(c, name, [0, 0, 0]);
        this.formula = formula;
        this.readsView = usesView(formula);
        this.refs = refs;
        this.vec3 = vec3;
        this.addParents(...refs.values());
    }

    computeGeometry(): void {
        const value = evaluateFormula(this.formula, {
            resolveIdentifier: (n) => this.refs.get(n)!.scriptValue(this.vec3),
            view: () => this.C.formulaView(),
        });
        if (value === null) {
            this.defined = false;
            return;
        }
        this.coords =
            typeof value === "number"
                ? [value, 0, 0]
                : value.length === 3
                  ? value
                  : [value[0], value[1], 0];
        super.computeGeometry();
    }

    dgo(context: DgoContext): [string, unknown] {
        const formula = dgoFormula(
            formulaSource(this.formula),
            this.refs,
            context,
        );
        return [
            "Fp",
            this.moveable
                ? [formula, ...this.handles.map((h) => h && context.index(h))]
                : [formula],
        ];
    }

    setHandles(
        handles: [expression_object | null, expression_object | null],
    ): void {
        this.handles = handles;
        this.moveable = true;
        if (this.hasView) this.createSVG();
    }

    mousedrag(ev: PointerEvent): void {
        const coords = this.C.unprojectToZPlane(
            this.C.pointerPosition(ev),
            this.z,
        );
        if (!coords) return;
        this.handles.forEach((handle, index) => {
            if (!handle) return;
            const value =
                (handle.value as number) + coords[index] - this.coords[index];
            handle.value = Math.min(
                Math.max(value, handle.min ?? -Infinity),
                handle.max ?? Infinity,
            );
            this.C.invalidateGeometry(handle);
        });
    }
}

export function createFormulaPoint(
    c: construction,
    name: string | null | undefined,
    formula: FormulaNode,
    refs: Map<string, construction_object>,
    vec3 = false,
): formula_point_object {
    return c.add(new formula_point_object(c, name, formula, refs, vec3));
}
