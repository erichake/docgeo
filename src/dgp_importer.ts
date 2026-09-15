import type { construction } from "./construction";
import { construction_object } from "./objects/construction_object";
import { createPoint, point_object } from "./objects/point_object";
import { createLine } from "./objects/two_points_line_object";

const NUMBER = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?`;
const IDENTIFIER = String.raw`[A-Za-z_$][\w$]*`;
const STRING = String.raw`"((?:\\.|[^"\\])*)"`;

const SET_COORDS = new RegExp(
    String.raw`^SetCoords\((${NUMBER}),(${NUMBER}),(${NUMBER}),(true|false),(${NUMBER}),(${NUMBER})\);$`,
);
const POINT = new RegExp(
    String.raw`^(${IDENTIFIER})=Point\(${STRING},(${NUMBER}),(${NUMBER})\);$`,
);
const LINE = new RegExp(
    String.raw`^(${IDENTIFIER})=Line\(${STRING},(${IDENTIFIER}),(${IDENTIFIER})\);$`,
);
const STYLE = new RegExp(String.raw`^STL\((${IDENTIFIER}),${STRING}\);$`);
const COORDS_STYLE = new RegExp(String.raw`^SetCoordsStyle\(${STRING}\);$`);
const GENERAL_STYLE = new RegExp(String.raw`^SetGeneralStyle\(${STRING}\);$`);

type DgpCommand =
    | { type: "coords"; originX: number; originY: number; unit: number }
    | { type: "point"; variable: string; name: string; x: number; y: number }
    | {
          type: "line";
          variable: string;
          name: string;
          first: string;
          second: string;
      }
    | { type: "style"; variable: string; value: string }
    | { type: "coordsStyle"; value: string }
    | { type: "generalStyle"; value: string };

function parseString(value: string): string {
    return JSON.parse(`"${value}"`) as string;
}

function parseDgp(source: string): DgpCommand[] {
    const commands: DgpCommand[] = [];

    source.split(/\r?\n/).forEach((sourceLine, index) => {
        const line = sourceLine.trim();
        if (!line || line.startsWith("//")) return;

        let match = SET_COORDS.exec(line);
        if (match) {
            commands.push({
                type: "coords",
                originX: Number(match[1]),
                originY: Number(match[2]),
                unit: Number(match[3]),
            });
            return;
        }

        match = POINT.exec(line);
        if (match) {
            commands.push({
                type: "point",
                variable: match[1],
                name: parseString(match[2]),
                x: Number(match[3]),
                y: Number(match[4]),
            });
            return;
        }

        match = LINE.exec(line);
        if (match) {
            commands.push({
                type: "line",
                variable: match[1],
                name: parseString(match[2]),
                first: match[3],
                second: match[4],
            });
            return;
        }

        match = STYLE.exec(line);
        if (match) {
            commands.push({
                type: "style",
                variable: match[1],
                value: parseString(match[2]),
            });
            return;
        }

        match = COORDS_STYLE.exec(line);
        if (match) {
            commands.push({
                type: "coordsStyle",
                value: parseString(match[1]),
            });
            return;
        }

        match = GENERAL_STYLE.exec(line);
        if (match) {
            commands.push({
                type: "generalStyle",
                value: parseString(match[1]),
            });
            return;
        }

        throw new Error(`Unsupported DGP instruction at line ${index + 1}`);
    });

    return commands;
}

function properties(value: string): Map<string, string> {
    return new Map(
        value.split(";").map((item) => {
            const separator = item.indexOf(":");
            return [item.slice(0, separator), item.slice(separator + 1)];
        }),
    );
}

function applyObjectStyle(object: construction_object, value: string): void {
    properties(value).forEach((propertyValue, property) => {
        switch (property) {
            case "c":
                object.fill_color = propertyValue;
                object.stroke_color = propertyValue;
                break;
            case "h":
                object.hidden = Number(propertyValue);
                break;
            case "o":
                object.opacity = Number(propertyValue);
                break;
            case "s":
                object.size = Number(propertyValue);
                break;
        }
    });
    object.createSVG();
}

function applyCoordsStyle(c: construction, value: string): void {
    const style = properties(value);
    const isAxis = style.get("isAxis");
    if (isAxis !== undefined) c.GRID.hidden = isAxis === "true" ? 0 : 1;
    const color = style.get("color");
    if (color !== undefined) c.GRID.stroke_color = color;
    const axisWidth = style.get("axisWidth");
    if (axisWidth !== undefined) c.GRID.size = Number(axisWidth);
    c.GRID.createSVG();
}

function applyGeneralStyle(c: construction, value: string): void {
    const background = properties(value).get("background-color");
    if (background === undefined) return;
    c.prefs.background.color = background;
    c.svg.stl("background", background);
}

export function importDgp(c: construction, source: string): void {
    const variables = new Map<string, construction_object>();

    parseDgp(source).forEach((command) => {
        switch (command.type) {
            case "coords":
                c.GRID.ORG = [command.originX, command.originY];
                c.GRID.UNIT = [command.unit, command.unit, command.unit];
                c.invalidateProjection();
                break;
            case "point":
                variables.set(
                    command.variable,
                    createPoint(c, command.name, [command.x, command.y, 0]),
                );
                break;
            case "line": {
                const first = variables.get(command.first);
                const second = variables.get(command.second);
                if (!(first instanceof point_object))
                    throw new Error(`Unknown point: ${command.first}`);
                if (!(second instanceof point_object))
                    throw new Error(`Unknown point: ${command.second}`);
                variables.set(
                    command.variable,
                    createLine(c, command.name, first, second),
                );
                break;
            }
            case "style": {
                const object = variables.get(command.variable);
                if (!object)
                    throw new Error(`Unknown object: ${command.variable}`);
                applyObjectStyle(object, command.value);
                break;
            }
            case "coordsStyle":
                applyCoordsStyle(c, command.value);
                break;
            case "generalStyle":
                applyGeneralStyle(c, command.value);
                break;
        }
    });
}

export async function importDgpFromUrl(
    c: construction,
    url: string,
): Promise<void> {
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`Unable to load DGP file: ${response.status}`);
    importDgp(c, await response.text());
}
