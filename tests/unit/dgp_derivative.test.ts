import { describe, expect, it } from "vitest";
import { derivative } from "../../src/import/dgp_derivative";
import {
    evaluateFormula,
    NO_VIEW,
    parseFormula,
} from "../../src/import/dgp_formula";

const noFunctions = () => null;

function derivedAt(
    source: string,
    t: number,
    degrees = false,
    variable = "t",
): unknown {
    const node = derivative(parseFormula(source), variable, noFunctions);
    return (
        node &&
        evaluateFormula(node, {
            resolveIdentifier: (name) => (name === "t" ? t : 2),
            view: () => ({ ...NO_VIEW, degrees }),
        })
    );
}

describe("DGP derivative", () => {
    it.each([
        ["a*t^3-t/a+7", 3 * 2 * 4 - 1 / 2],
        [
            "sin(2*t)*cos(t)",
            2 * Math.cos(4) * Math.cos(2) - Math.sin(4) * Math.sin(2),
        ],
        [
            "tan(t)+sqrt(t)+exp(t)+log(t)",
            1 / Math.cos(2) ** 2 + 1 / (2 * Math.sqrt(2)) + Math.exp(2) + 1 / 2,
        ],
        ["asin(t/4)+acos(t/4)+atan(t)", 1 / 5],
        ["abs(1-t)+floor(t)+(t>1)", 1],
        ["t^t", 4 * (Math.log(2) + 1)],
        ["t<1 ? t : -t^2", -4],
    ])("derives %s", (source, expected) => {
        expect(derivedAt(source, 2)).toBeCloseTo(expected, 12);
    });

    it("derives vectors component by component", () => {
        expect(derivedAt("[t,t^2,3]", 2)).toEqual([1, 4, 0]);
    });

    it("reads the figure's other objects and variables as constants", () => {
        expect(derivedAt("x*a+t", 2, false, "x")).toBe(2);
        expect(derivedAt("x*a+t", 2)).toBe(1);
    });

    it("derives the trigonometric functions in degrees", () => {
        expect(derivedAt("sin(t)", 30, true)).toBeCloseTo(
            (Math.cos(Math.PI / 6) * Math.PI) / 180,
            15,
        );
        expect(derivedAt("atan(t)", 1, true)).toBeCloseTo(90 / Math.PI, 12);
    });

    it("derives the calls of functions with the chain rule", () => {
        expect(
            derivative(parseFormula("g(t^2,a)"), "t", () => ["x", "y"]),
        ).toEqual(parseFormula("g.dx(t^2,a)*(2*t)"));
    });

    it("has none for what isn't a function formula", () => {
        expect(derivedAt("t%2", 1)).toBeNull();
        expect(derivative(parseFormula("g(t)"), "t", noFunctions)).toBeNull();
    });
});
