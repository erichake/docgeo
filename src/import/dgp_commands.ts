import type { construction } from "../construction";
import { createCenter } from "../objects/center_object";
import { createCircle1 } from "../objects/circle1_object";
import { createCircle3 } from "../objects/circle3_object";
import { createCircle3pts } from "../objects/circle3pts_object";
import { createCircle } from "../objects/circle_object";
import { construction_object } from "../objects/construction_object";
import { createOrderedIntersection } from "../objects/intersection_object";
import { createMidpoint } from "../objects/midpoint_object";
import { createParallel } from "../objects/parallel_line_object";
import { createPerpendicularBisector } from "../objects/perpendicular_bisector_object";
import { createPlumb } from "../objects/plumb_line_object";
import { createPointOn } from "../objects/point_on_object";
import { createPoint, point_object } from "../objects/point_object";
import { primitive_circle_object } from "../objects/primitive_circle_object";
import { primitive_line_object } from "../objects/primitive_line_object";
import { createRay } from "../objects/ray_line_object";
import { createReflection } from "../objects/reflection_object";
import { createSegment } from "../objects/segment_object";
import { createSymmetry } from "../objects/symmetry_object";
import { createLine } from "../objects/two_points_line_object";
import type { DgpCall, DgpValue } from "./dgp_parser";

type ObjectKind = "point" | "line" | "circle";
type ParameterKind =
    | "string"
    | "number"
    | "boolean"
    | "object"
    | "point"
    | "line"
    | "circle"
    | "intersectable";

interface Parameter {
    kind: ParameterKind;
    optional?: boolean;
}

type RuntimeValue =
    string | number | boolean | null | construction_object | RuntimeValue[];

interface CommandContext {
    construction: construction;
    variables: Map<string, construction_object>;
    gridChanged: boolean;
    projectionChanged: boolean;
}

interface CommandDefinition {
    parameters: Parameter[];
    result?: ObjectKind;
    validate?: (args: DgpValue[], line: number) => void;
    execute: (
        context: CommandContext,
        args: RuntimeValue[],
    ) => construction_object | void;
}

const string: Parameter = { kind: "string" };
const number: Parameter = { kind: "number" };
const boolean: Parameter = { kind: "boolean" };
const object: Parameter = { kind: "object" };
const point: Parameter = { kind: "point" };
const line: Parameter = { kind: "line" };
const circle: Parameter = { kind: "circle" };
const intersectable: Parameter = { kind: "intersectable" };
// DGPad's own color parser matches this hex prefix without anchoring the
// end, so a color value with a stray suffix (e.g. a missing ";" merging it
// with the next "key:value" pair, as seen in some exported .dgp files) is
// tolerated: only the leading hex digits are read, the rest is dropped.
const COLOR = /^#(?:[\da-f]{6}|[\da-f]{3})/i;
const STYLE_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function properties(value: string): Map<string, string> {
    return new Map(
        value.split(";").map((item) => {
            const separator = item.indexOf(":");
            return [item.slice(0, separator), item.slice(separator + 1)];
        }),
    );
}

function literalString(value: DgpValue): string {
    return (value as { type: "literal"; value: string }).value;
}

function validateColor(value: string, lineNumber: number): void {
    if (!COLOR.test(value))
        throw new Error(`Invalid DGP color at line ${lineNumber}`);
}

function extractColor(value: string): string {
    return COLOR.exec(value)![0];
}

function validateNumber(
    value: string,
    lineNumber: number,
    minimum: number,
    maximum = Infinity,
): void {
    const numberValue = Number(value);
    if (
        !STYLE_NUMBER.test(value) ||
        !Number.isFinite(numberValue) ||
        numberValue < minimum ||
        numberValue > maximum
    )
        throw new Error(`Invalid DGP style number at line ${lineNumber}`);
}

function validateObjectStyle(value: string, lineNumber: number): void {
    properties(value).forEach((propertyValue, property) => {
        switch (property) {
            case "c":
                validateColor(propertyValue, lineNumber);
                break;
            case "h":
                validateNumber(propertyValue, lineNumber, 0, 2);
                if (!Number.isInteger(Number(propertyValue)))
                    throw new Error(
                        `Invalid DGP style number at line ${lineNumber}`,
                    );
                break;
            case "o":
                validateNumber(propertyValue, lineNumber, 0, 1);
                break;
            case "s":
                validateNumber(propertyValue, lineNumber, 0);
                break;
            case "sn":
                if (propertyValue !== "true" && propertyValue !== "false")
                    throw new Error(
                        `Invalid DGP style boolean at line ${lineNumber}`,
                    );
                break;
            case "f":
                validateNumber(propertyValue, lineNumber, 0);
                break;
            case "p":
                validateNumber(propertyValue, lineNumber, -1);
                if (!Number.isInteger(Number(propertyValue)))
                    throw new Error(
                        `Invalid DGP style number at line ${lineNumber}`,
                    );
                break;
        }
    });
}

function validateCoordsStyle(value: string, lineNumber: number): void {
    const style = properties(value);
    const color = style.get("color");
    if (color !== undefined) validateColor(color, lineNumber);
    const axisWidth = style.get("axisWidth");
    if (axisWidth !== undefined) validateNumber(axisWidth, lineNumber, 0);
}

function validateGeneralStyle(value: string, lineNumber: number): void {
    const background = properties(value).get("background-color");
    if (background !== undefined) validateColor(background, lineNumber);
}

function applyObjectStyle(target: construction_object, value: string): void {
    properties(value).forEach((propertyValue, property) => {
        switch (property) {
            case "c": {
                const color = extractColor(propertyValue);
                target.fill_color = color;
                target.stroke_color = color;
                break;
            }
            case "h":
                target.hidden = Number(propertyValue);
                break;
            case "o":
                target.opacity = Number(propertyValue);
                break;
            case "s":
                target.size = Number(propertyValue);
                break;
            case "sn":
                target.showName = propertyValue === "true";
                break;
            case "f":
                target.fontSize = Number(propertyValue);
                break;
            case "p":
                target.precision = Number(propertyValue);
                break;
        }
    });
    target.updateView();
}

function applyCoordsStyle(context: CommandContext, value: string): void {
    const style = properties(value);
    const isAxis = style.get("isAxis");
    if (isAxis !== undefined)
        context.construction.GRID.hidden = isAxis === "true" ? 0 : 1;
    const color = style.get("color");
    if (color !== undefined) context.construction.GRID.stroke_color = color;
    const axisWidth = style.get("axisWidth");
    if (axisWidth !== undefined)
        context.construction.GRID.size = Number(axisWidth);
    context.gridChanged = true;
}

function applyGeneralStyle(c: construction, value: string): void {
    const background = properties(value).get("background-color");
    if (background === undefined) return;
    c.prefs.background.color = background;
    c.svg.stl("background", background);
}

const COMMANDS = new Map<string, CommandDefinition>([
    [
        "SetCoords",
        {
            parameters: [number, number, number, boolean, number, number],
            validate: (args, lineNumber) => {
                const unit = (args[2] as { value: number }).value;
                if (unit <= 0)
                    throw new Error(`Invalid DGP unit at line ${lineNumber}`);
            },
            execute: (context, args) => {
                const unit = args[2] as number;
                context.construction.GRID.ORG = [
                    args[0] as number,
                    args[1] as number,
                ];
                context.construction.GRID.UNIT = [unit, unit, unit];
                context.projectionChanged = true;
            },
        },
    ],
    [
        "Point",
        {
            parameters: [string, number, number],
            result: "point",
            execute: (context, args) =>
                createPoint(context.construction, args[0] as string, [
                    args[1] as number,
                    args[2] as number,
                    0,
                ]),
        },
    ],
    [
        "PointOn",
        {
            parameters: [string, intersectable, number],
            result: "point",
            execute: (context, args) =>
                createPointOn(
                    context.construction,
                    args[0] as string,
                    args[1] as primitive_line_object | primitive_circle_object,
                    args[2] as number,
                ),
        },
    ],
    [
        "Line",
        {
            parameters: [string, point, point],
            result: "line",
            execute: (context, args) =>
                createLine(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                ),
        },
    ],
    [
        "Ray",
        {
            parameters: [string, point, point],
            result: "line",
            execute: (context, args) =>
                createRay(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                ),
        },
    ],
    [
        "Segment",
        {
            parameters: [string, point, point],
            result: "line",
            execute: (context, args) =>
                createSegment(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                ),
        },
    ],
    [
        "Parallel",
        {
            parameters: [string, line, point],
            result: "line",
            execute: (context, args) =>
                createParallel(
                    context.construction,
                    args[0] as string,
                    args[2] as point_object,
                    args[1] as primitive_line_object,
                ),
        },
    ],
    [
        "Perpendicular",
        {
            parameters: [string, line, point],
            result: "line",
            execute: (context, args) =>
                createPlumb(
                    context.construction,
                    args[0] as string,
                    args[2] as point_object,
                    args[1] as primitive_line_object,
                ),
        },
    ],
    [
        "PerpendicularBisector",
        {
            parameters: [string, point, point],
            result: "line",
            execute: (context, args) =>
                createPerpendicularBisector(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                ),
        },
    ],
    [
        "Circle",
        {
            parameters: [string, point, point],
            result: "circle",
            execute: (context, args) =>
                createCircle(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                ),
        },
    ],
    [
        "Circle1",
        {
            parameters: [string, point, number],
            result: "circle",
            execute: (context, args) =>
                createCircle1(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as number,
                ),
        },
    ],
    [
        "Circle3",
        {
            parameters: [string, point, point, point],
            result: "circle",
            execute: (context, args) =>
                createCircle3(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                    args[3] as point_object,
                ),
        },
    ],
    [
        "Circle3pts",
        {
            parameters: [string, point, point, point],
            result: "circle",
            execute: (context, args) =>
                createCircle3pts(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                    args[3] as point_object,
                ),
        },
    ],
    [
        "OrderedIntersection",
        {
            parameters: [
                string,
                intersectable,
                intersectable,
                number,
                { ...point, optional: true },
            ],
            result: "point",
            validate: (args, lineNumber) => {
                const order = (args[3] as { value: number }).value;
                if (order !== 0 && order !== 1)
                    throw new Error(
                        `Invalid intersection order at line ${lineNumber}`,
                    );
            },
            execute: (context, args) =>
                createOrderedIntersection(
                    context.construction,
                    args[0] as string,
                    args[1] as primitive_line_object | primitive_circle_object,
                    args[2] as primitive_line_object | primitive_circle_object,
                    args[3] === 0 ? 0 : 1,
                    args[4] as point_object | undefined,
                ),
        },
    ],
    [
        "MidPoint",
        {
            parameters: [string, point, point],
            result: "point",
            execute: (context, args) =>
                createMidpoint(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                ),
        },
    ],
    [
        "Symmetry",
        {
            parameters: [string, point, point],
            result: "point",
            execute: (context, args) =>
                createSymmetry(
                    context.construction,
                    args[0] as string,
                    args[1] as point_object,
                    args[2] as point_object,
                ),
        },
    ],
    [
        "Reflection",
        {
            parameters: [string, line, point],
            result: "point",
            execute: (context, args) =>
                createReflection(
                    context.construction,
                    args[0] as string,
                    args[1] as primitive_line_object,
                    args[2] as point_object,
                ),
        },
    ],
    [
        "Center",
        {
            parameters: [string, circle],
            result: "point",
            execute: (context, args) =>
                createCenter(
                    context.construction,
                    args[0] as string,
                    args[1] as primitive_circle_object,
                ),
        },
    ],
    [
        "STL",
        {
            parameters: [object, string],
            validate: (args, lineNumber) =>
                validateObjectStyle(literalString(args[1]), lineNumber),
            execute: (_context, args) =>
                applyObjectStyle(
                    args[0] as construction_object,
                    args[1] as string,
                ),
        },
    ],
    [
        "SetCoordsStyle",
        {
            parameters: [string],
            validate: (args, lineNumber) =>
                validateCoordsStyle(literalString(args[0]), lineNumber),
            execute: (context, args) =>
                applyCoordsStyle(context, args[0] as string),
        },
    ],
    [
        "SetGeneralStyle",
        {
            parameters: [string],
            validate: (args, lineNumber) =>
                validateGeneralStyle(literalString(args[0]), lineNumber),
            execute: (context, args) =>
                applyGeneralStyle(context.construction, args[0] as string),
        },
    ],
]);

function accepts(actual: ObjectKind, expected: ParameterKind): boolean {
    return (
        expected === "object" ||
        actual === expected ||
        (expected === "intersectable" &&
            (actual === "line" || actual === "circle"))
    );
}

function validateValue(
    value: DgpValue,
    parameter: Parameter,
    variables: Map<string, ObjectKind>,
    lineNumber: number,
): void {
    if (value.type === "literal") {
        if (typeof value.value !== parameter.kind)
            throw new Error(
                `Invalid ${parameter.kind} argument at line ${lineNumber}`,
            );
        return;
    }
    if (value.type === "array")
        throw new Error(`Unexpected array at line ${lineNumber}`);
    const actual = variables.get(value.name);
    if (!actual) throw new Error(`Unknown DGP reference at line ${lineNumber}`);
    if (!accepts(actual, parameter.kind))
        throw new Error(`Invalid DGP reference at line ${lineNumber}`);
}

function validateCalls(calls: DgpCall[]): void {
    const variables = new Map<string, ObjectKind>();
    calls.forEach((call) => {
        const definition = COMMANDS.get(call.name);
        if (!definition)
            throw new Error(
                `Unsupported DGP command ${call.name} at line ${call.line}`,
            );
        const required = definition.parameters.filter(
            (parameter) => !parameter.optional,
        ).length;
        if (
            call.arguments.length < required ||
            call.arguments.length > definition.parameters.length
        )
            throw new Error(`Invalid argument count at line ${call.line}`);
        if (definition.result && !call.variable)
            throw new Error(`Missing assignment at line ${call.line}`);
        if (!definition.result && call.variable)
            throw new Error(`Unexpected assignment at line ${call.line}`);
        call.arguments.forEach((value, index) =>
            validateValue(
                value,
                definition.parameters[index],
                variables,
                call.line,
            ),
        );
        definition.validate?.(call.arguments, call.line);
        if (call.variable) {
            if (variables.has(call.variable))
                throw new Error(`Duplicate DGP variable at line ${call.line}`);
            variables.set(call.variable, definition.result!);
        }
    });
}

function resolveValue(
    value: DgpValue,
    variables: Map<string, construction_object>,
): RuntimeValue {
    if (value.type === "literal") return value.value;
    if (value.type === "reference") return variables.get(value.name)!;
    return value.items.map((item) => resolveValue(item, variables));
}

export function executeDgpCommands(c: construction, calls: DgpCall[]): void {
    validateCalls(calls);
    const context: CommandContext = {
        construction: c,
        variables: new Map(),
        gridChanged: false,
        projectionChanged: false,
    };

    c.beginBatch();
    calls.forEach((call) => {
        const definition = COMMANDS.get(call.name)!;
        const result = definition.execute(
            context,
            call.arguments.map((value) =>
                resolveValue(value, context.variables),
            ),
        );
        if (call.variable)
            context.variables.set(call.variable, result as construction_object);
    });
    if (context.gridChanged) c.GRID.createSVG();
    c.endBatch();
    if (context.projectionChanged) c.invalidateProjection();
}
