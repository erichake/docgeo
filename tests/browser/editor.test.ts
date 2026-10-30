import { describe, expect, it } from "vitest";
// First, as in main.ts: the object classes import each other.
import "../../src/construction";
import type { construction } from "../../src/construction";
import { describeDgo, figureObjects, readDgo } from "../../src/dgo";
import {
    add,
    addEvent,
    addFloor,
    addPointOn,
    cubeOn,
    entryOf,
    figureIndex,
    figureTurtles,
    floorOf,
    lineOf,
    rebuild,
    redefine,
    FREE_POINT,
    nextName,
    ownPrograms,
    programHat,
    programOwner,
    resolve,
    resolveWithSliders,
    turtleStart,
    valueText,
    type Studio,
} from "../../src/editor/figure";
import { showStep, stepOf } from "../../src/editor/steps";
import {
    accepts,
    COMMANDS,
    findCommand,
    isCommand,
    overloadFor,
    paramAt,
    readable,
    type Arg,
    type Param,
} from "../../src/editor/catalog";
import {
    hideGhosts,
    showGhosts,
    toggleGhost,
    withHidden,
} from "../../src/editor/eraser";
import {
    attracts,
    dropLostMagnets,
    magnetizable,
    reachOf,
    setReach,
    showZone,
} from "../../src/editor/magnets";
import { pinnable, togglePin } from "../../src/editor/pin";
import {
    assign,
    driverOf,
    itemLabel,
    TOOL_FAMILIES,
    toolsFor,
    usable,
} from "../../src/editor/tools";
import { offPlane } from "../../src/editor/space";
import {
    anchorOf,
    ghostAt,
    handleOf,
    moveGhost,
    pull,
    setAnimation,
    springOf,
    springy,
} from "../../src/editor/spring";
import type { point_on_object } from "../../src/objects/point_on_object";
import { labelAt, labelCenter, placeLabel } from "../../src/editor/labels";
import {
    arcAt,
    arcDistance,
    crossing,
    meant,
    pick,
} from "../../src/editor/pick";
import type { angle_object } from "../../src/objects/angle_object";
import type { fixed_angle_object } from "../../src/objects/fixed_angle_object";
import { parseLine, TextError } from "../../src/editor/text";
import en from "../../src/editor/lang/en";
import type { MessageKey, Texts } from "../../src/editor/messages";
import { IDENTIFIER_PART, IDENTIFIER_START } from "../../src/import/dgp_parser";
import type { point_object } from "../../src/objects/point_object";
import type { circle1_object } from "../../src/objects/circle1_object";
import type { equation_circle_object } from "../../src/objects/equation_circle_object";
import type { polyhedron_object } from "../../src/objects/polyhedron_object";
import type { sphere_object } from "../../src/objects/sphere_object";
import type { net_object } from "../../src/objects/net_object";
import type { cylinder_section_object } from "../../src/objects/cylinder_section_object";
import type { polygon_object } from "../../src/objects/polygon_object";
import type { expression_object } from "../../src/objects/expression_object";
import type { construction_object } from "../../src/objects/construction_object";
import type { free_vector_object } from "../../src/objects/free_vector_object";
import type { expression_list_object } from "../../src/objects/expression_list_object";
import type { list_object } from "../../src/objects/list_object";
import type { text_object } from "../../src/objects/text_object";
import { importGgb } from "../../src/ggb_importer";
import { createConstruction, disposeFigures, expectClose } from "./figures";
import { vAdd, vDot, vNorm, vScale, vSub, type Vec3 } from "../../src/vec";

disposeFigures();

const LANGUAGES = import.meta.glob<Texts>(
    ["../../src/editor/lang/*.ts", "!../../src/editor/lang/en.ts"],
    { import: "default", eager: true },
);

function studio(space = false): Studio {
    const scene = createConstruction([800, 600]);
    readDgo(scene, {
        dgo: 1,
        v: { o: [400, 300], u: 40, w: 800, h: 600, ...(space && { "3d": 1 }) },
        o: [],
    });
    return { prefs: scene.prefs, scene };
}

const type = (c: construction, text: string) =>
    add(c, resolve(c, parseLine(text, isCommand)));

const lines = (c: construction): string[] => {
    const index = figureIndex(c);
    const objects = figureObjects(c);
    return objects.map((object) => lineOf(object, index, objects)!);
};

describe("Editor", () => {
    it("speaks every language of DocTools, with localized command names", () => {
        const placeholders = (text: string) => text.split("%").length;
        const identifier = new RegExp(
            `^${IDENTIFIER_START.source}${IDENTIFIER_PART.source}*$`,
            "u",
        );
        const fold = (name: string) =>
            name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
        const shared: string[][] = [];
        for (const [path, { messages, commands }] of Object.entries(
            LANGUAGES,
        )) {
            for (const key of Object.keys(en) as MessageKey[]) {
                const text = messages[key];
                expect(text, `${path}: ${key}`).toBeDefined();
                expect(placeholders(text!), `${path}: ${key}`).toBe(
                    placeholders(en[key]),
                );
            }
            expect(Object.keys(commands!).sort(), path).toEqual(
                COMMANDS.map(({ name }) => name).sort(),
            );
            const named = new Map<string, Set<string>>();
            for (const { name } of COMMANDS)
                for (const each of [name, commands![name]!]) {
                    expect(each, path).toMatch(identifier);
                    const set = named.get(fold(each)) ?? new Set();
                    named.set(fold(each), set.add(name));
                }
            for (const set of named.values())
                if (set.size > 1) shared.push([...set]);
        }
        // Told apart by their arguments.
        expect(shared).toEqual([["Midpoint", "Center"]]);
    });

    it("writes back the line of each command", async () => {
        const { scene: c } = studio();
        const text = [
            "A = (-2, 0)",
            "B = (3, 1)",
            "C = (1, 4)",
            "D = (-3, 3)",
            "E = (0, -3)",
            "s = Segment(A, B)",
            "d = Line(A, C)",
            "r = Ray(B, C)",
            "u = Vector(C, D)",
            "M = Midpoint(A, B)",
            "m = PerpendicularBisector(B, C)",
            "p = Perpendicular(D, d)",
            "q = Parallel(E, d)",
            "b = AngleBisector(A, B, C)",
            "c = Circle(A, B)",
            "f = Circle(E, 1.5)",
            "g = Circumcircle(A, B, C)",
            "h = Compass(A, B, E)",
            "j = Arc(A, C, D)",
            "n = Sector(B, C, D)",
            "i = CenterArc(A, B, C)",
            "j2 = Tangent(E, c, 2)",
            "W2 = Orthocenter(A, B, C)",
            "W3 = Incenter(A, B, C)",
            "W4 = Centroid(A, B, C)",
            "W5 = Circumcenter(A, B, C)",
            "W6 = Inversion(c, D)",
            "p3 = RegularPolygon(A, B, 5)",
            "W7 = Vertex(p3, 3)",
            "q2 = CenterSector(A, C, D)",
            "r2 = Semicircle(D, E)",
            "O = Center(g)",
            "F = Intersection(d, q)",
            "G = Intersection(c, d, 2)",
            "H = OtherIntersection(c, d, B)",
            "P = Point(c, 0.5)",
            "Q = Point(s, 0.25)",
            "v = Polygon(A, B, C, D)",
            "R = Point(v, 0.5, 0.5)",
            "w = Angle(A, B, C)",
            "S = Reflect(A, D)",
            "T = Reflect(d, D)",
            "K = Rotation(A, D, 30)",
            "L = Dilation(A, D, 2)",
            "N = Translation(u, D)",
            "a = Conic(A, B, C, D, E)",
            "k = Ellipse(A, B, C)",
            "t = Ellipse(A, B, 4)",
            "e = Hyperbola(A, B, E)",
            "o = Hyperbola(A, B, 1)",
            "z = Parabola(E, d)",
            "V = Point(k, 0.5, 0.5)",
            "k2 = Arc(k, A, C)",
            "k3 = Sector(k, C, A)",
            "k4 = Arc(c, D, E)",
            "U = FixedPoint(1, 1)",
            "l = Locus(M, P)",
        ];
        text.forEach((line) => type(c, line));
        c.flush();
        expect(lines(c)).toEqual(text);
        // Saved and read, the same text.
        const other = createConstruction([800, 600]);
        readDgo(other, await describeDgo(c));
        expect(lines(other)).toEqual(text);
    });

    it("names objects, and refuses wrong lines", () => {
        const { scene: c } = studio();
        expect(type(c, "(1, 2)").name).toBe("A");
        expect(type(c, "(2, 2)").name).toBe("B");
        expect(type(c, "Segment(A, B)").name).toBe("a");
        expect(type(c, "Midpoint(A, B)").name).toBe("C");
        expect(type(c, "Circle(A, B)").name).toBe("b");
        expect(type(c, "Rotation(B, A, 90)").name).toBe("D");
        for (const [text, key] of [
            ["Segment(A, Z)", "unknown_object"],
            ["Unknown(A, B)", "unknown_command"],
            ["Circle(A, a)", "arguments"],
            ["Intersection(b, a, 5)", "branch"],
            ["Tangent(A, b, 3)", "tangent_branch"],
            ["RegularPolygon(A, B, 2)", "arguments"],
            ["Intersection(b, a)", "arguments"],
            ["Intersection(a, a, 1)", "arguments"],
            ["A = (3, 3)", "name_taken"],
        ])
            expect(() => resolve(c, parseLine(text, isCommand)), text).toThrow(
                expect.objectContaining({ key }),
            );
        for (const [text, detail] of [
            ["Circle(A, B, C)", "Circumcircle(A, B, C)"],
            ["Intersection(b, a, A)", "OtherIntersection(b, a, A)"],
            ["Point(1, 2)", "FixedPoint(1, 2)"],
        ])
            expect(() => resolve(c, parseLine(text, isCommand)), text).toThrow(
                expect.objectContaining({ key: "instead", detail }),
            );
    });

    it("tells from the arguments designated whether the line goes on", () => {
        const { scene: c } = studio();
        [
            "A = (-2, 0)",
            "B = (3, 1)",
            "C = (1, 4)",
            "D = (-3, 3)",
            "E = (0, -3)",
            "s = Segment(A, B)",
            "d = Line(A, C)",
            "c = Circle(A, B)",
            "v = Polygon(A, B, C)",
            "a = Conic(A, B, C, D, E)",
            "S = Sphere(A, B)",
            "P = Point(c, 0.5)",
            "M = Midpoint(A, B)",
            "l = Locus(M, P)",
            "w = Angle(A, B, C)",
        ].forEach((line) => type(c, line));
        const samples: Arg[] = [...figureObjects(c), 1];
        const overlap = (p: Param, q: Param | null) =>
            q !== null &&
            samples.some((arg) => accepts(arg, p) && accepts(arg, q));
        for (const { name, overloads } of COMMANDS)
            for (const shorter of overloads)
                for (const longer of overloads)
                    if (
                        !shorter.variadic &&
                        !["number", "real"].includes(
                            shorter.params[shorter.params.length - 1],
                        ) &&
                        longer.params.length > shorter.params.length
                    )
                        expect(
                            shorter.params.every((param, position) =>
                                overlap(param, paramAt(longer, position)),
                            ),
                            `${name}: ${shorter.params} begins ${longer.params}`,
                        ).toBe(false);
    });

    it("redefines an object, after the ones it is built from", async () => {
        const studied = studio();
        const c = studied.scene;
        ["A = (-2, 0)", "B = (3, 1)", "d = Line(A, B)", "O = (0, -1)"].forEach(
            (line) => type(c, line),
        );
        const line = parseLine("A = Midpoint(B, O)", isCommand);
        await redefine(
            studied,
            c.getObj("A")!,
            resolve(c, line, c.getObj("A")),
        );
        const scene = studied.scene;
        expect(lines(scene)).toEqual([
            "B = (3, 1)",
            "O = (0, -1)",
            "A = Midpoint(B, O)",
            "d = Line(A, B)",
        ]);
        expectClose((scene.getObj("A") as point_object).coords, [1.5, 0, 0]);
        // Nor on itself, nor on what is built from it.
        const cycle = parseLine("B = Midpoint(A, O)", isCommand);
        await expect(
            redefine(
                studied,
                scene.getObj("B")!,
                resolve(scene, cycle, scene.getObj("B")),
            ),
        ).rejects.toThrow(TextError);
        // Renamed, and in space.
        const renamed = parseLine("K = (1, 2, 3)", isCommand);
        await redefine(
            studied,
            scene.getObj("O")!,
            resolve(scene, renamed, scene.getObj("O")),
        );
        expect(lines(studied.scene)).toEqual([
            "B = (3, 1)",
            "K = (1, 2, 3)",
            "A = Midpoint(B, K)",
            "d = Line(A, B)",
        ]);
    });

    it("writes and reads expressions, their nature told by the text", async () => {
        const { scene: c } = studio();
        const text = [
            "A = (0, 0)",
            "B = (3, 4)",
            "a = 3",
            "L = [1, 2, 3]",
            "f = 0.5x^2-4",
            "E = d(A, B)+f(2)",
            "s = Segment(A, B)",
            "c = Circle(A, a)",
            'p = if(a>2){s.setHidden(1)};"Faces"',
            "z = 3i-9",
        ];
        text.forEach((line) => type(c, line));
        c.flush();
        expect(lines(c)).toEqual(text);
        const index = figureIndex(c);
        const entry = (name: string) => entryOf(c.getObj(name)!, index);
        expect(entry("a")).toEqual(["Ex", { t: "", v: 3, xy: [20, 40] }]);
        expect(entry("L")[1]).toMatchObject({ v: [1, 2, 3], xy: [20, 70] });
        expect(entry("z")[1]).toMatchObject({ s: "3i-9" });
        expect((c.getObj("z") as expression_object).value).toEqual([-9, 3]);
        expect(entry("f")[1]).toMatchObject({ f: "0.5x^2-4" });
        expect(entry("E")[1]).toMatchObject({
            s: ["d(A, B)+f(2)", { A: 0, B: 1, f: 4 }],
        });
        expect(entry("c")).toEqual(["C1", [0, ["a", { a: 2 }]]]);
        expect((c.getObj("E") as expression_object).value).toBe(3);
        expect((c.getObj("c") as circle1_object).R).toBe(3);
        expect(c.getObj("s")!.hidden).toBe(1);
        // Saved and read, the same text.
        const other = createConstruction([800, 600]);
        readDgo(other, await describeDgo(c));
        expect(lines(other)).toEqual(text);
        for (const [line, key, detail] of [
            ["E = d(A, Z)", "unknown_object", "Z"],
            ["E = Distance(A, B)", "unknown_command", "Distance"],
            ["E = 1 +", "syntax", "1 +"],
            ["c = Circle(A, s)", "arguments", "Circle"],
        ])
            expect(() => resolve(c, parseLine(line, isCommand)), line).toThrow(
                expect.objectContaining({ key, detail }),
            );
    });

    it("renames a program's own variable that an object read would hide", () => {
        // As a macro's box opened writes it: named after the body, read
        // through the figure's own objects, one of which is named `a`.
        const c = createConstruction([800, 600]);
        readDgo(c, {
            dgo: 1,
            v: { o: [400, 300], u: 40, w: 800, h: 600 },
            o: [
                ["Pt", "a", [1, 1]],
                ["Fp", "P", [["var a = 2; Hz * a", { Hz: 0 }]]],
            ],
        });
        c.flush();
        const [, line] = lines(c);
        expect(line).toBe("P = Point(var a1 = 2; a * a1)");
        // Read back, the same point.
        const other = createConstruction([800, 600]);
        readDgo(other, {
            dgo: 1,
            v: { o: [400, 300], u: 40, w: 800, h: 600 },
            o: [["Pt", "a", [1, 1]]],
        });
        type(other, line);
        other.flush();
        expect((other.getObj("P") as point_object).coords).toEqual(
            (c.getObj("P") as point_object).coords,
        );
    });

    it("writes and reads equations, a line, a circle or a conic", async () => {
        const { scene: c } = studio();
        const text = [
            "a = 2",
            "d = y = a*x + 1",
            "v = x = a",
            "c = (x - a)^2 + y^2 = 4",
            "e = x^2/9 + y^2/4 = 1",
            "h = x*y = a",
            "p = y = x^2",
        ];
        text.forEach((line) => type(c, line));
        c.flush();
        expect(lines(c)).toEqual(text);
        const index = figureIndex(c);
        const tag = (name: string) => entryOf(c.getObj(name)!, index)[0];
        expect(["d", "v", "c", "e", "h", "p"].map(tag)).toEqual([
            "EqL",
            "EqL",
            "EqC",
            "EqQ",
            "EqQ",
            "EqQ",
        ]);
        expect(entryOf(c.getObj("c")!, index)[1]).toEqual([
            ["(x - a)^2 + y^2", { a: 0 }],
            "4",
        ]);
        expect((c.getObj("c") as equation_circle_object).R).toBeCloseTo(2, 9);
        // As in GeoGebra, without a name.
        expect(tag(type(c, "y = 2x - 1").name)).toBe("EqL");
        // Saved and read, the same text.
        const other = createConstruction([800, 600]);
        readDgo(other, await describeDgo(c));
        expect(lines(other)).toEqual([...text, "b = y = 2x - 1"]);
        for (const [line, key] of [
            ["q = sin(x) = y", "degree"],
            ["q = x^3 = y", "degree"],
            ["q = x = x", "degree"],
            ["q = x^2 = r", "unknown_object"],
            ["q = x^2 = ", "syntax"],
        ])
            expect(() => resolve(c, parseLine(line, isCommand)), line).toThrow(
                expect.objectContaining({ key }),
            );
    });

    it("writes and reads solids in space, drawn whole", async () => {
        const { scene: c } = studio(true);
        const text = [
            "A = (0, 0, 0)",
            "B = (2, 0, 0)",
            "C = (2, 2, 0)",
            "D = (0, 0, 3)",
            "a = Cube(A, B, C)",
            "b = Cylinder(A, D, 1.5)",
            "d = Cone(B, C, 1)",
            "e = Sphere(C, 0.5)",
            "f = Polygon(A, B, C)",
            "g = Prism(f, D)",
            "h = Pyramid(f, D)",
            "E = Vertex(a, 7)",
        ];
        text.forEach((line) => type(c, line));
        c.flush();
        expect(lines(c)).toEqual(text);
        const other = createConstruction([800, 600]);
        readDgo(other, await describeDgo(c));
        expect(lines(other)).toEqual(text);
        // The cube's G, over C.
        expectClose((c.getObj("E") as point_object).coords, [2, 2, 2]);
        const cube = c.getObj("a") as polyhedron_object;
        // Seen from above.
        expect(cube.hides([1, 1, 5])).toBe(false);
        expect(cube.hides([1, 1, -5])).toBe(true);
        expect(cube.hides([1, 1, 1])).toBe(true);
    });

    // A spherical triangle's medians: arcs of great circles, in the plane
    // of their points, that meet.
    it("writes and reads arcs in space", async () => {
        const { scene: c } = studio(true);
        const text = [
            "O = (0, 0, 0)",
            "A = (2, 0, 0)",
            "B = (0, 2, 0)",
            "C = (0, 0, 2)",
            "a = CenterArc(O, A, B)",
            "b = CenterArc(O, B, C)",
            "c = Arc(A, B, C)",
            "d = CenterSector(O, C, A)",
            "M = Point(a, 0.7854)",
            "N = Point(b, 0.7854)",
            "e = CenterArc(O, M, C)",
            "f = CenterArc(O, N, A)",
            "G = Intersection(e, f, 1)",
        ];
        text.forEach((line) => type(c, line));
        c.flush();
        expect(lines(c)).toEqual(text);
        const other = createConstruction([800, 600]);
        readDgo(other, await describeDgo(c));
        expect(lines(other)).toEqual(text);
        const index = figureIndex(c);
        const tag = (name: string) => entryOf(c.getObj(name)!, index)[0];
        expect(["a", "c", "d", "e"].map(tag)).toEqual([
            "CArcs",
            "Arcs",
            "CSecs",
            "CArcs",
        ]);
        // The middles of AB and BC, to the four decimals of π/4; the
        // medians meet on the sphere, at the center of ABC seen from O.
        const k = 2 / Math.sqrt(3);
        for (const [name, expected] of [
            ["M", [Math.SQRT2, Math.SQRT2, 0]],
            ["G", [k, k, k]],
        ] as const)
            (c.getObj(name) as point_object).coords.forEach((x, axis) =>
                expect(x, name).toBeCloseTo(expected[axis], 5),
            );
    });

    it("builds a cube from two points that give its plane", async () => {
        const { scene: c } = studio(true);
        ["A = (0, 0, 0)", "B = (2, 0, 0)", "p = z = 1", "q = -z = -1"].forEach(
            (line) => type(c, line),
        );
        // Its corners projected as soon as it is built.
        expect(
            pick(c, c.pt3D([1, 1, 1])).map(({ object }) => object.name),
        ).toEqual(["p", "q"]);
        const on = (name: string, plane: string, at: Vec3) =>
            addPointOn(c, name, c.getObj(plane)!, at);
        const [P, Q, R, S] = [
            on("P", "p", [0, 0, 1]),
            on("Q", "p", [2, 0, 1]),
            on("R", "q", [0, 0, 1]),
            on("S", "q", [2, 0, 1]),
        ];
        const [A, B] = ["A", "B"].map((name) => c.getObj(name)!);
        const cube = findCommand("Cube")!.overloads[0];
        const [a, b, d] = [
            [A, B],
            [P, Q],
            [R, S],
        ].map(([first, second], index) =>
            add(c, {
                name: "abd"[index],
                ...cubeOn(c, cube, [first, second, undefined])!,
            }),
        ) as polyhedron_object[];
        expect(cubeOn(c, cube, [A, P, undefined])).toBe(null);
        expect(cubeOn(c, cube, [A, B, P])).toBe(null);
        // Horizontal, above AB.
        expectClose(a.vertices[2].coords, [2, 2, 0]);
        expectClose(a.vertices[4].coords, [0, 0, 2]);
        // On the camera's side, whichever way the plane's normal goes.
        b.vertices.forEach((vertex, index) =>
            expectClose(vertex.coords, d.vertices[index].coords),
        );
        type(c, "D = (2, 0, 1)");
        const e = type(c, "e = Cube(A, D, 1)");
        c.flush();
        expect(e.defined).toBe(false);
        const text = lines(c);
        expect(text.slice(-5)).toEqual([
            "a = Cube(A, B, 1)",
            `b = Cube(P, Q, p, ${(b.definition as { side: number }).side})`,
            `d = Cube(R, S, q, ${(d.definition as { side: number }).side})`,
            "D = (2, 0, 1)",
            "e = Cube(A, D, 1)",
        ]);
        const other = createConstruction([800, 600]);
        readDgo(other, await describeDgo(c));
        expect(lines(other)).toEqual(text);
    });

    it("writes and reads planes, sections and nets in space", async () => {
        const { scene: c } = studio(true);
        const text = [
            "A = (0, 0, 0)",
            "B = (2, 0, 0)",
            "C = (2, 2, 0)",
            "D = (0, 0, 3)",
            "E = (1, 1, 1)",
            "a = Cube(A, B, C)",
            "p = x + y + z = 3",
            "q = Plane(A, B, D)",
            "r = ParallelPlane(E, q)",
            "d = Line(A, D)",
            "t = OrthogonalPlane(E, d)",
            "s = Plane(E, d)",
            "F = Intersection(d, p)",
            "g = Intersection(p, q)",
            "h = Perpendicular(E, p)",
            "b = Sphere(E, 1)",
            "S = Sphere(A, B)",
            "k = Intersection(b, S)",
            "l = Section(b, t)",
            "c = Cylinder(A, D, 1)",
            "m = Section(c, t)",
            "e = Cone(A, D, 1)",
            "n = Section(e, t)",
            "o = Section(a, p)",
            "f = Net(a, 1)",
            "w = Circle(E, 1, d)",
            "v = Circle(E, 2, p)",
            "e1 = Circle(d, E)",
        ];
        text.forEach((line) => type(c, line));
        c.flush();
        expect(lines(c)).toEqual(text);
        const other = createConstruction([800, 600]);
        readDgo(other, await describeDgo(c));
        expect(lines(other)).toEqual(text);
        expectClose((c.getObj("F") as point_object).coords, [0, 0, 3]);
        // Around a line, orthogonal to a plane, of axis d through E.
        const circle = (name: string) => {
            const { CENTER, R, NORMAL } = c.getObj(name) as circle1_object;
            return [...CENTER, R, ...NORMAL.map(Math.abs)];
        };
        const third = 1 / Math.sqrt(3);
        expectClose(circle("w"), [1, 1, 1, 1, 0, 0, 1]);
        expectClose(circle("v"), [1, 1, 1, 2, third, third, third]);
        expectClose(circle("e1"), [0, 0, 1, Math.SQRT2, 0, 0, 1]);
        // The cone's radius at height 1.
        const cone = c.getObj("n") as cylinder_section_object;
        cone.arcs.flat().forEach(([x, y, z]) => {
            expect(z).toBeCloseTo(1, 9);
            expect(Math.hypot(x, y)).toBeCloseTo(2 / 3, 9);
        });
        // A regular hexagon, its vertices in turn.
        const hexagon = (c.getObj("o") as polygon_object).points.map(
            ({ coords }) => coords,
        );
        expect(hexagon).toHaveLength(6);
        hexagon.forEach((vertex, k) => {
            expect(vertex.reduce((sum, value) => sum + value)).toBeCloseTo(
                3,
                9,
            );
            expect(vNorm(vSub(vertex, hexagon[(k + 1) % 6]))).toBeCloseTo(
                Math.SQRT2,
                9,
            );
        });
        // Flat on the cube's base, its six faces apart.
        const net = c.getObj("f") as net_object;
        net.faces.flat().forEach(([, , z]) => expect(z).toBeCloseTo(0, 9));
        const middles = net.faces.map((face) =>
            vScale(face.reduce(vAdd), 1 / face.length)
                .map(Math.round)
                .join(),
        );
        expect(new Set(middles).size).toBe(6);
        // Folded, the cube's faces.
        const cube = c.getObj("a") as polyhedron_object;
        expect((type(c, "j = Net(a, 0)") as net_object).faces).toEqual(
            cube.faces.map((face) => face.map((i) => cube.vertices[i].coords)),
        );
        // The menu's section takes the plane first, then any solid.
        const [section] = TOOL_FAMILIES.flatMap(({ items }) => items).find(
            (item) => itemLabel(item) === "Section",
        )!.tools;
        const args = assign(section, [c.getObj("p")!, c.getObj("a")!]);
        expect(args).toEqual([c.getObj("a"), c.getObj("p")]);
        expect(overloadFor(section.command, args as Arg[], true)!.tag).toBe(
            "PlS",
        );
        expect([false, true].map((space) => usable(section, space))).toEqual([
            false,
            true,
        ]);
        // In space, the menu's perpendicular to a line or a plane.
        const perpendicular = TOOL_FAMILIES.flatMap(({ items }) => items)
            .find((item) => itemLabel(item) === "Perpendicular")!
            .tools.filter((tool) => usable(tool, true));
        expect(perpendicular.map(({ overload }) => overload.tag)).toEqual([""]);
        expect(
            ["p", "d"].map(
                (name) =>
                    overloadFor(
                        perpendicular[0].command,
                        assign(perpendicular[0], [
                            c.getObj(name)!,
                            c.getObj("E")!,
                        ]) as Arg[],
                        true,
                    )!.tag,
            ),
        ).toEqual(["Nrm", "Perp"]);
        // The floor designated, a hidden plane z = 0, made once.
        expect(floorOf(c)).toBeUndefined();
        const floor = addFloor(c);
        expect([
            floorOf(c),
            floor.hidden,
            lineOf(floor, figureIndex(c), figureObjects(c)),
        ]).toEqual([floor, 1, `${floor.name} = z = 0`]);
        // A plane is of degree 1.
        expect(() => resolve(c, parseLine("u = x*z = 1", isCommand))).toThrow(
            expect.objectContaining({ key: "degree" }),
        );
    });

    it("takes a plane, a curve or a solid in either order, as GeoGebra", () => {
        const { scene: c } = studio(true);
        [
            "A = (0, 0, 0)",
            "B = (2, 0, 0)",
            "C = (2, 2, 0)",
            "D = (0, 0, 3)",
            "E = (1, 1, 1)",
            "a = Cube(A, B, C)",
            "p = x + y + z = 3",
            "d = Line(A, D)",
            "b = Sphere(E, 1)",
            "e = Cone(A, D, 1)",
        ].forEach((line) => type(c, line));
        const reversed = [
            ["F = Intersection(p, d)", "F = Intersection(d, p)"],
            ["l = Section(p, b)", "l = Section(b, p)"],
            ["m = Section(p, e)", "m = Section(e, p)"],
            ["o = Section(p, a)", "o = Section(a, p)"],
        ];
        reversed.forEach(([line]) => type(c, line));
        c.flush();
        expect(lines(c).slice(-reversed.length)).toEqual(
            reversed.map(([, line]) => line),
        );
        expectClose((c.getObj("F") as point_object).coords, [0, 0, 3]);
        const { scene: plane } = studio();
        [
            "A = (0, 0)",
            "P = (3, 0)",
            "B = (0, 3)",
            "c = Circle(A, 2)",
            "q = Polygon(A, P, B)",
        ].forEach((line) => type(plane, line));
        const flat = [
            ["t = Tangent(c, P, 2)", "t = Tangent(P, c, 2)"],
            ["V = Vertex(2, q)", "V = Vertex(q, 2)"],
            ["M = Midpoint(Vertex(3, q), A)", "M = Midpoint(Vertex(q, 3), A)"],
        ];
        flat.forEach(([line]) => type(plane, line));
        plane.flush();
        expect(lines(plane).slice(-flat.length)).toEqual(
            flat.map(([, line]) => line),
        );
        expectClose(
            (plane.getObj("V") as point_object).coords.slice(0, 2),
            [3, 0],
        );
    });

    it("writes GeoGebra's equations, read back as the same objects", () => {
        const { scene: c } = studio();
        importGgb(
            c,
            `<geogebra><construction>
<element type="numeric" label="a"><value val="2"/></element>
<expression label="d" exp="y = (a * x) + 1" type="line"/>
<element type="line" label="d"><coords x="-2" y="1" z="-1"/></element>
<element type="line" label="w"><coords x="1" y="-1" z="-2"/></element>
<expression label="ell" exp="x^(2) / a^(2) + y^(2) = 1" type="conic"/>
<element type="conic" label="ell"><matrix A0="0.25" A1="1" A2="-1" A3="0" A4="0" A5="0"/></element>
<element type="conic" label="f"><matrix A0="0.25" A1="1" A2="-1" A3="0.5" A4="0" A5="-1"/></element>
</construction></geogebra>`,
        );
        const index = figureIndex(c);
        const objects = figureObjects(c);
        const written = objects
            .slice(1)
            .map(
                (object) => [object, lineOf(object, index, objects)!] as const,
            );
        expect(written.map(([, line]) => line)).toEqual([
            "d = y = (a * x) + 1",
            "w = x - y - 2 = 0",
            "ell = x^(2) / a^(2) + y^(2) = 1",
            "f = 0.25x^2 + x*y + y^2 - 2y - 1 = 0",
        ]);
        written.forEach(([object, line]) =>
            expect(
                resolve(c, parseLine(line, isCommand), object).overload.tag,
            ).toBe(entryOf(object, index)[0]),
        );
    });

    it("types GeoGebra's shortcuts: sliders, degrees, polar points, primes", () => {
        const { scene: c } = studio();
        const typed = (text: string, added: construction_object[] = []) =>
            add(
                c,
                resolveWithSliders(
                    c,
                    parseLine(text, isCommand),
                    undefined,
                    added,
                ),
            );
        // A slider for each name no object has, an angle for a Greek one.
        [
            "A = (a, 4)",
            "O = (0, 0)",
            "c = Circle(O, r)",
            "d = y = m x + p",
            "B = Rotation(O, A, α)",
            "f(x) = x^2 + 3x",
            "g = f'(2)",
            "h(x) = f'(x)",
            "k = h'(1)",
            "P = (2; 90°)",
            "w = cos(60°)",
            "Vector(O, A)",
            "Angle(A, O, B)",
        ].forEach((text) => typed(text));
        c.flush();
        expect(lines(c)).toEqual([
            "a = Slider(-5, 5, 1)",
            "A = (a, 4)",
            "O = (0, 0)",
            "r = Slider(-5, 5, 1)",
            "c = Circle(O, r)",
            "m = Slider(-5, 5, 1)",
            "p = Slider(-5, 5, 1)",
            "d = y = m x + p",
            "α = Slider(0, 360, 45)",
            "B = Rotation(O, A, α)",
            "f(x) = x^2 + 3x",
            "g = f'(2)",
            "h(x) = f'(x)",
            "k = h'(1)",
            "P = (2; 90°)",
            "w = cos(60°)",
            "u = Vector(O, A)",
            "β = Angle(A, O, B)",
        ]);
        const value = (name: string) => c.getObj(name)!.scriptValue(false);
        expect(
            ["a", "α"].map(
                (name) => (c.getObj(name) as expression_object).increment,
            ),
        ).toEqual([0.1, 1]);
        expect(value("g")).toBe(7);
        expect(value("k")).toBe(2);
        expectClose(value("w") as number, 0.5);
        expectClose((c.getObj("P") as point_object).coords, [0, 2, 0]);
        // Refused, the line leaves its sliders to undo; the formulas' own
        // names are none, nor are capitalized ones.
        const added: construction_object[] = [];
        expect(() => typed("M = Midpoint(a, q)", added)).toThrow(
            expect.objectContaining({ key: "arguments" }),
        );
        expect(added.map(({ name }) => name)).toEqual(["q"]);
        for (const text of ["e1 = Circle(O, x)", "e1 = Midpoint(A, Q)"])
            expect(() => typed(text), text).toThrow(
                expect.objectContaining({ key: "unknown_object" }),
            );
        // In radians.
        c.degrees = false;
        typed("C = Rotation(O, A, θ)");
        expect(lines(c).slice(-2, -1)).toEqual(["θ = Slider(0, 2π, 0.7854)"]);
    });

    it("plots f(x) = ax^2 + bx + c, its sliders made", () => {
        const { scene: c } = studio();
        add(
            c,
            resolveWithSliders(
                c,
                parseLine("f(x) = ax^2 + bx + c", isCommand),
                undefined,
                [],
            ),
        );
        type(c, "v = f(2)");
        c.flush();
        expect(lines(c)).toEqual([
            "a = Slider(-5, 5, 1)",
            "b = Slider(-5, 5, 1)",
            "c = Slider(-5, 5, 1)",
            "f(x) = a x^2 + b x + c",
            "v = f(2)",
        ]);
        expect(entryOf(c.getObj("f")!, figureIndex(c))[0]).toBe("Cur");
        expect(c.getObj("v")!.scriptValue(false)).toBe(7);
    });

    it("reads a small letter's coordinates as a free vector", async () => {
        const studied = studio();
        const c = studied.scene;
        [
            "u = (1, 2)",
            "A = (3, 0)",
            "B = Translation(u, A)",
            "p = (1, 1)",
        ].forEach((line) => type(c, line));
        c.flush();
        expect(lines(c)).toEqual([
            "u = (1, 2)",
            "A = (3, 0)",
            "B = Translation(u, A)",
            "p = (1, 1)",
        ]);
        const u = c.getObj("u") as free_vector_object;
        expect(entryOf(u, figureIndex(c))[0]).toBe("VecF");
        expect(entryOf(c.getObj("p")!, figureIndex(c))[0]).toBe("VecF");
        expect(u.scriptValue(false)).toEqual([1, 2]);
        expectClose((c.getObj("B") as point_object).coords, [4, 2, 0]);
        // Its tip dragged, from where the last move left it.
        const unit = c.GRID.UNIT[0];
        u.mousedrag(new PointerEvent("pointermove"), [unit, 0]);
        u.mousedrag(new PointerEvent("pointermove"), [0, -unit]);
        c.flush();
        expectClose(u.scriptValue(false) as number[], [2, 3]);
        expectClose((c.getObj("B") as point_object).coords, [5, 3, 0]);
        // Redefined in place, read back from the .dgo; a free point stays
        // one.
        await redefine(
            studied,
            u,
            resolve(c, parseLine("u = (0, 1)", isCommand), u),
        );
        rebuild(studied, await describeDgo(studied.scene));
        const read = studied.scene;
        expect(lines(read)[0]).toBe("u = (0, 1)");
        expectClose((read.getObj("B") as point_object).coords, [3, 1, 0]);
        const q = add(read, { name: "q", overload: FREE_POINT, args: [1, 1] });
        expect(
            resolve(read, parseLine("q = (2, 1)", isCommand), q).overload.tag,
        ).toBe("Pt");
        expect(nextName(read, "VecF")).toBe("v");
    });

    it("redefines and renames expressions, their targets before them", async () => {
        const studied = studio();
        [
            "A = (0, 0)",
            "B = (3, 4)",
            "a = 3",
            "s = Segment(A, B)",
            "c = Circle(A, a)",
            'p = if(a>2){s.setHidden(1)};"Faces"',
            "E = d(A, B)",
        ].forEach((line) => type(studied.scene, line));
        const redefined = async (text: string, name: string) => {
            const c = studied.scene;
            const target = c.getObj(name)!;
            await redefine(
                studied,
                target,
                resolve(c, parseLine(text, isCommand), target),
            );
        };
        // A program styles an object before it, reordered or not.
        await redefined("s = Segment(B, A)", "s");
        await redefined("a = 1", "a");
        expect((studied.scene.getObj("c") as circle1_object).R).toBe(1);
        // Kept: its place; its slider's bounds only by Slider(…).
        const slider = (c: construction) =>
            entryOf(c.getObj("b")!, figureIndex(c))[1];
        const figure = await describeDgo(studied.scene);
        const position = figure.o.findIndex(
            (entry) => (entry as unknown[])[1] === "a",
        );
        Object.assign((figure.o[position] as unknown[])[2] as object, {
            mn: 0,
            mx: 10,
            xy: [100, 200],
        });
        rebuild(studied, figure);
        expect(lines(studied.scene)[2]).toBe("a = Slider(0, 10, 1)");
        await redefined("b = Slider(0, 10, 4)", "a");
        expect(slider(studied.scene)).toEqual({
            t: "",
            v: 4,
            mn: 0,
            mx: 10,
            xy: [100, 200],
        });
        await redefined("b = 4", "b");
        expect(slider(studied.scene)).toEqual({ t: "", v: 4, xy: [100, 200] });
        await redefined("b = d(A, B)", "b");
        expect(slider(studied.scene)).toEqual({
            t: "",
            s: ["d(A, B)", { A: 0, B: 1 }],
            xy: [100, 200],
        });
        expect(lines(studied.scene)).toEqual([
            "A = (0, 0)",
            "B = (3, 4)",
            "b = d(A, B)",
            "s = Segment(B, A)",
            "c = Circle(A, b)",
            'p = if(b>2){s.setHidden(1)};"Faces"',
            "E = d(A, B)",
        ]);
        // It may read what it styles, not what is built from it.
        await redefined('p = if(s>2){s.setHidden(1)};"Faces"', "p");
        for (const [text, name] of [
            ["b = 2*c", "b"],
            ["s = Circle(A, p)", "s"],
        ])
            await expect(redefined(text, name), text).rejects.toThrow(
                expect.objectContaining({ key: "cycle" }),
            );
        // What it styles comes before it.
        await redefined('p = if(b>2){E.setHidden(1)};"Faces"', "p");
        // Renamed, the formulas that read it write its new name.
        const figure2 = await describeDgo(studied.scene);
        (figure2.o[0] as unknown[])[1] = "A 1";
        rebuild(studied, figure2);
        expect(lines(studied.scene).slice(2)).toEqual([
            "b = d(`A 1`, B)",
            "s = Segment(B, `A 1`)",
            "c = Circle(`A 1`, b)",
            "E = d(`A 1`, B)",
            'p = if(b>2){E.setHidden(1)};"Faces"',
        ]);
        await redefined("E = d(`A 1`, B)/2", "E");
        expect((studied.scene.getObj("E") as expression_object).value).toBe(
            2.5,
        );
    });

    it("reads a formula where a command takes a number", async () => {
        const { scene: c } = studio(true);
        const text = [
            "A = (0, 0, 0)",
            "B = (3, 4, 0)",
            "C = (0, 0, 4)",
            "a = 2",
            "b = Cylinder(A, C, d(A, B))",
            "c = Sphere(B, a/2 + 1)",
            "D = Dilation(A, B, -a)",
            "e = Slider(0, 2*a, 1)",
            "f = Sphere(C, d(A, C)/4)",
            "g = Slider(0, d(A, C), 1)",
        ];
        text.forEach((line) => type(c, line));
        c.flush();
        expect(lines(c)).toEqual(text);
        const index = figureIndex(c);
        expect(entryOf(c.getObj("b")!, index)).toEqual([
            "Cyl",
            [0, 2, ["d(A, B)", { A: 0, B: 1 }]],
        ]);
        expect((c.getObj("c") as sphere_object).R).toBe(2);
        expectClose((c.getObj("D") as point_object).coords, [-6, -8, 0]);
        expect((c.getObj("e") as expression_object).max).toBe(4);
        // In space, a formula reads the points' three coordinates.
        expect((c.getObj("f") as sphere_object).R).toBe(1);
        expect((c.getObj("g") as expression_object).max).toBe(4);
        const other = createConstruction([800, 600]);
        readDgo(other, await describeDgo(c));
        expect(lines(other)).toEqual(text);
        for (const [line, key, detail] of [
            ["h = Cylinder(A, C, d(A, Z))", "unknown_object", "Z"],
            ["h = Cylinder(A, C, 1 +)", "syntax", "1 +"],
            ["F = Midpoint(A, 1 + 2)", "arguments", "Midpoint"],
        ])
            expect(() => resolve(c, parseLine(line, isCommand)), line).toThrow(
                expect.objectContaining({ key, detail }),
            );
    });

    it("makes sliders, read back as such", async () => {
        const studied = studio();
        const c = studied.scene;
        ["a = Slider(0, 10, 3)", "b = Slider(-1, a, 2)", "E = 2*b"].forEach(
            (line) => type(c, line),
        );
        c.flush();
        expect(lines(c)).toEqual([
            "a = Slider(0, 10, 3)",
            "b = Slider(-1, a, 2)",
            "E = 2*b",
        ]);
        const index = figureIndex(c);
        expect(entryOf(c.getObj("a")!, index)[1]).toEqual({
            t: "",
            v: 3,
            mn: 0,
            mx: 10,
            xy: [20, 40],
        });
        // Under the sliders' tracks.
        expect(entryOf(c.getObj("E")!, index)[1]).toMatchObject({
            xy: [20, 160],
        });
        const b = c.getObj("b") as expression_object;
        expect([b.isCursor, b.min, b.max]).toEqual([true, -1, 3]);
        const other = createConstruction([800, 600]);
        readDgo(other, await describeDgo(c));
        expect(lines(other)).toEqual(lines(c));
        expect(() => type(c, "d = Slider(0, 10, a)")).toThrow(
            expect.objectContaining({ key: "arguments" }),
        );
        // A constant again, then a slider again.
        await redefine(
            studied,
            b,
            resolve(c, parseLine("b = 2", isCommand), b),
        );
        expect(lines(studied.scene)[1]).toBe("b = 2");
        expect((studied.scene.getObj("b") as expression_object).isCursor).toBe(
            false,
        );
        const figure = await describeDgo(studied.scene);
        rebuild(studied, figure);
        const constant = studied.scene.getObj("b")!;
        await redefine(
            studied,
            constant,
            resolve(
                studied.scene,
                parseLine("b = Slider(0, 5, 1)", isCommand),
                constant,
            ),
        );
        expect(lines(studied.scene)[1]).toBe("b = Slider(0, 5, 1)");
        // Bounds that are formulas.
        const bounded = await describeDgo(studied.scene);
        Object.assign((bounded.o[1] as unknown[])[2] as object, {
            mx: ["2*a", { a: 0 }],
        });
        rebuild(studied, bounded);
        expect(lines(studied.scene)[1]).toBe("b = Slider(0, 2*a, 1)");
    });

    it("draws the points of an expression's value as a list", async () => {
        const { scene: c } = studio();
        const text = [
            "p = var t=[]; for (var i=0;i<4;i++){t.push([i,0])}; t",
            "L = List(p)",
        ];
        text.forEach((line) => type(c, line));
        c.flush();
        expect(lines(c)).toEqual(text);
        const index = figureIndex(c);
        expect(entryOf(c.getObj("L")!, index)).toEqual(["ELst", [0]]);
        const list = c.getObj("L") as expression_list_object;
        expect(list.points).toEqual([
            [0, 0],
            [1, 0],
            [2, 0],
            [3, 0],
        ]);
        const other = createConstruction([800, 600]);
        readDgo(other, await describeDgo(c));
        expect(lines(other)).toEqual(text);
        type(c, "A = (1, 1)");
        expect(() => type(c, "M = List(A)")).toThrow(
            expect.objectContaining({ key: "arguments" }),
        );
        expect(accepts(c.getObj("p")!, "expression")).toBe(true);
        expect(accepts(1, "expression")).toBe(false);
    });

    it("reads a turtle by its name, whatever its list's", async () => {
        const { scene: c } = studio();
        const program = (name: string, source: string) =>
            add(
                c,
                resolve(c, { name, definition: { kind: "formula", source } }),
            );
        type(c, "A = (0, 0)");
        type(c, "B = (5, 0)");
        program(
            "p",
            'TURTLE_INIT("A", A); TURTLE_MV(2, false); return TURTLE_RESULT();',
        );
        type(c, "L = List(p)");
        program("q", 'TURTLE_INIT("B", B); return TURTLE_RESULT();');
        type(c, "M = List(q)");
        expect(
            figureTurtles(c).map(([name, list]) => [name, list.name]),
        ).toEqual([
            ["A", "L"],
            ["B", "M"],
        ]);
        expect(turtleStart(c.getObj("q")!)!.point).toBe(c.getObj("B"));
        const reader = program(
            "r",
            'TURTLE_INIT("B", B); [TURTLE_LENGTH("A"), TURTLE_GET("A", 2)]',
        ) as expression_object;
        c.flush();
        expect(reader.value).toEqual([2, [2, 0]]);
        const other = createConstruction([800, 600]);
        readDgo(other, await describeDgo(c));
        other.flush();
        expect((other.getObj("r") as expression_object).value).toEqual([
            2,
            [2, 0],
        ]);
        expect(() => program("s", 'TURTLE_GET("C", 1)')).toThrow(
            expect.objectContaining({ key: "unknown_object", detail: '"C"' }),
        );
    });

    it("writes Sequences, nested ones reading the variables around them", async () => {
        const { scene: c } = studio();
        const text = [
            "A = (1, 0)",
            "n = 3",
            "L = Sequence(rotate(A, [0, 0], 90°*i), i, 0, n - 1)",
            "c = Sequence(Sequence(Circle(L[i], 0.5*j), j, 1, i + 1), i, 0, 1)",
            "s = Sequence(Segment(L[k], dilate(L[k], [0, 0], 2)), k, 0, 2, 2)",
            "p = Sequence(Polygon((k, 0), (k + 1, 0), (k, 1)), k, 1, 2)",
            "q = Sequence(Sequence((i, j), j, 1, i), i, 1, 3)",
            "r = Sequence((2; 30°*k), k, 0, 1)",
            "t = Sequence(Segment(A, (1, 2)), k, 0, 1)",
            "a = Sequence(Circle((k, 0), 1, (1, 0)), k, 0, 1)",
        ];
        text.forEach((line) => type(c, line));
        c.flush();
        expect(lines(c)).toEqual(text);
        const round = (values: unknown): unknown =>
            Array.isArray(values)
                ? values.map(round)
                : typeof values === "number"
                  ? Math.round(values * 1e9) / 1e9 || 0
                  : values;
        const items = (name: string) =>
            round((c.getObj(name) as list_object).items);
        expect(round(c.getObj("L")!.scriptValue(false))).toEqual([
            [1, 0],
            [0, 1],
            [-1, 0],
        ]);
        expect(items("c")).toEqual([
            [[1, 0], 0.5],
            [[0, 1], 0.5],
            [[0, 1], 1],
        ]);
        expect(items("s")).toEqual([
            [
                [1, 0],
                [2, 0],
            ],
            [
                [-1, 0],
                [-2, 0],
            ],
        ]);
        expect(items("p")).toEqual([
            [[1, 0]],
            [[2, 0]],
            [[1, 1]],
            [null],
            [[2, 0]],
            [[3, 0]],
            [[2, 1]],
            [null],
        ]);
        expect(round(c.getObj("q")!.scriptValue(false))).toEqual([
            [[1, 1]],
            [
                [2, 1],
                [2, 2],
            ],
            [
                [3, 1],
                [3, 2],
                [3, 3],
            ],
        ]);
        expect(items("r")).toEqual(round([[[2, 0]], [[Math.sqrt(3), 1]]]));
        expect(items("a")).toEqual([
            [[0, 0], 1, [1, 0]],
            [[1, 0], 1, [1, 0]],
        ]);
        // Orthogonal to the x axis, seen edge-on.
        const [[, x, y]] = (c.getObj("a") as list_object).screenItems;
        expect(round([x![0], y![0], y![1]])).toEqual([0, 0, 0]);
        expect(Math.abs(x![1])).toBeGreaterThan(0);
        expect(entryOf(c.getObj("L")!, figureIndex(c))).toEqual([
            "Seq",
            [
                "point",
                [["i", "0", ["n - 1", { n: 1 }]]],
                ["rotate(A, [0, 0], 90°*i)", { A: 0 }],
            ],
        ]);
        const other = createConstruction([800, 600]);
        readDgo(other, await describeDgo(c));
        expect(lines(other)).toEqual(text);
        expect(readable(c.getObj("L")!)).toBe(true);
        expect(readable(c.getObj("s")!)).toBe(false);
        expect(() => type(c, "q = Sequence(A, 1, 0, 2)")).toThrow(
            expect.objectContaining({ key: "arguments" }),
        );
        expect(() =>
            type(c, "q = Sequence(Sequence(A, i, 0, 1), i, 0, 1)"),
        ).toThrow(expect.objectContaining({ key: "arguments" }));
        expect(() => type(c, "q = Sequence(Segment(A), k, 0, 1)")).toThrow(
            expect.objectContaining({ key: "syntax" }),
        );
        expect(() => type(c, "q = Sequence(B, k, 0, 1)")).toThrow(
            expect.objectContaining({ key: "unknown_object", detail: "B" }),
        );
    });

    it("writes texts, panels and images, keeping what their lines don't say", async () => {
        const scene = createConstruction([800, 600]);
        readDgo(scene, {
            dgo: 1,
            v: { o: [400, 300], u: 40, w: 800, h: 600 },
            img: { k: "data:image/png;base64,iVBORw0KGgo=" },
            o: [
                ["Pt", "A", [0, 0]],
                ["Pt", "B", [2, 0]],
                ["Ex", "a", { t: "", v: 2, xy: [20, 20] }],
                ["Txt", "t", [0, [5, -3], ["a = %a%", { a: 2 }]]],
                ["Html", "h", [[10, 20, 100, 50], 8, "<b>x</b>"]],
                ["Img", "p", ["k", 10, 5, 0, 1]],
                ["Img", "q", ["k", 10, 5, [30, 40]]],
            ],
        });
        const studied: Studio = { prefs: scene.prefs, scene };
        let c = scene;
        expect(lines(c).slice(3)).toEqual([
            't = Text("a = %a%", A)',
            'h = Html("<b>x</b>")',
            "p = Image(A, B)",
            "q = Image(30, 40)",
        ]);
        const define = async (text: string) => {
            const line = parseLine(text, isCommand);
            await redefine(
                studied,
                studied.scene.getObj(line.name!)!,
                resolve(studied.scene, line, studied.scene.getObj(line.name!)),
            );
            c = studied.scene;
        };
        await define(String.raw`t = Text("2a = %2*a%, 100 %%\n\"\\o/\"", B)`);
        await define(
            String.raw`h = Html("<b>%a%</b> <input type=\"number\" target=\"a\">")`,
        );
        await define("p = Image(B)");
        await define("q = Image(50, 60)");
        const text = [
            String.raw`t = Text("2a = %2*a%, 100 %%\n\"\\o/\"", B)`,
            String.raw`h = Html("<b>%a%</b> <input type=\"number\" target=\"a\">")`,
            "p = Image(B)",
            "q = Image(50, 60)",
        ];
        expect(lines(c).slice(3)).toEqual(text);
        const entries = ["t", "h", "p", "q"].map(
            (name) => entryOf(c.getObj(name)!, figureIndex(c))[1],
        );
        expect(entries).toEqual([
            [1, [5, -3], ['2a = %2*a%, 100 %%\n"\\o/"', { a: 2 }]],
            [
                [10, 20, 100, 50],
                8,
                ['<b>%a%</b> <input type="number" target="a">', { a: 2 }],
            ],
            ["data:image/png;base64,iVBORw0KGgo=", 10, 5, 1],
            ["data:image/png;base64,iVBORw0KGgo=", 10, 5, [50, 60]],
        ]);
        expect((c.getObj("t") as text_object).content).toBe(
            '2a = 4, 100 %\n"\\o/"',
        );
        // A name changed, in their formulas and their fields' targets.
        const a = c.getObj("a")!;
        await redefine(
            studied,
            a,
            resolve(c, parseLine("r = 2", isCommand), a),
        );
        c = studied.scene;
        expect(lines(c).slice(3, 5)).toEqual([
            String.raw`t = Text("2a = %2*r%, 100 %%\n\"\\o/\"", B)`,
            String.raw`h = Html("<b>%r%</b> <input type=\"number\" target=\"r\">")`,
        ]);
        const other = createConstruction([800, 600]);
        readDgo(other, await describeDgo(c));
        expect(lines(other)).toEqual(lines(c));
        // New ones: a text at its point, a panel at the window's corner.
        const index = figureIndex(c);
        expect(entryOf(type(c, 'u = Text("%r%", A)'), index)).toEqual([
            "Txt",
            [
                index.get(c.getObj("A")!),
                [0, 0],
                ["%r%", { r: index.get(c.getObj("r")!) }],
            ],
        ]);
        for (const [text, key] of [
            ["v = Image(A)", "image_file"],
            ["p = Image(A, A, B, B)", "arguments"],
            ['v = Text("%a%", A)', "unknown_object"],
            ['v = Text("100 % sûr", A)', "syntax"],
            ['v = Html("<script>alert(1)</script>")', "html"],
            ['v = Html("<b onclick=\\"x\\">a</b>")', "html"],
        ])
            expect(() => type(c, text), text).toThrow(
                expect.objectContaining({ key }),
            );
        expect(entryOf(type(c, 'v = Html("ok")'), figureIndex(c))).toEqual([
            "Html",
            [[20, 20, 300, 150], 15, "ok"],
        ]);
    });

    it("writes buttons, keeping the program and the place their lines don't say", async () => {
        const scene = createConstruction([800, 600]);
        readDgo(scene, {
            dgo: 1,
            v: { o: [400, 300], u: 40, w: 800, h: 600 },
            o: [
                ["Ex", "a", { t: "", v: 2, xy: [20, 20] }],
                [
                    "Btn",
                    "b",
                    {
                        t: "+1",
                        s: ["a.setExpression(a + 1)", { a: 0 }],
                        xy: [100, 50],
                    },
                ],
            ],
        });
        const studied: Studio = { prefs: scene.prefs, scene };
        expect(lines(scene)[1]).toBe('b = Button("+1")');
        const line = parseLine('b = Button("50 % de plus")', isCommand);
        await redefine(
            studied,
            scene.getObj("b")!,
            resolve(scene, line, scene.getObj("b")!),
        );
        const c = studied.scene;
        expect(lines(c)[1]).toBe('b = Button("50 % de plus")');
        expect(entryOf(c.getObj("b")!, figureIndex(c))[1]).toEqual({
            t: "50 % de plus",
            s: ["a.setExpression(a + 1)", { a: 0 }],
            xy: [100, 50],
        });
        // A new one, its arrow at the window's centre.
        expect(entryOf(type(c, 'Button("Go")'), figureIndex(c))).toEqual([
            "Btn",
            { t: "Go", xy: [420, 300] },
        ]);
    });

    it("makes and redefines the programs of a point's gestures, shown with it", async () => {
        const { scene } = studio();
        ["A = (0, 0)", "n = 0"].forEach((line) => type(scene, line));
        const event = addEvent(scene, scene.getObj("A") as point_object, "up");
        expect(event.hidden).toBe(2);
        expect(programOwner(event)).toBe(scene.getObj("A"));
        expect(entryOf(event, figureIndex(scene))).toEqual([
            "Evt",
            { on: 0, e: "up", s: "" },
        ]);
        const studied: Studio = { prefs: scene.prefs, scene };
        await redefine(
            studied,
            event,
            resolve(
                scene,
                {
                    name: event.name,
                    definition: {
                        kind: "formula",
                        source: "n.setExpression(n + 1);",
                    },
                },
                event,
            ),
        );
        const c = studied.scene;
        expect(entryOf(c.getObj(event.name)!, figureIndex(c))).toEqual([
            "Evt",
            { on: 0, e: "up", s: ["n.setExpression(n + 1);", { n: 1 }] },
        ]);
        expect(ownPrograms(c, c.getObj("A")!).map(programHat)).toEqual([
            { key: event.name, kind: "up", object: "A" },
        ]);
        c.gesture(c.getObj("A")!, "up");
        c.flush();
        expect((c.getObj("n") as expression_object).value).toBe(1);
    });

    it("signs the formulas' functions, a real number reading expressions", () => {
        const { scene: c } = studio();
        ["A = (0, 0)", "a = 3", "s = Segment(A, A)", "w = Point(s, 0)"].forEach(
            (line) => type(c, line),
        );
        const [A, a, s] = ["A", "a", "s"].map((name) => c.getObj(name)!);
        expect(accepts(a, "real")).toBe(true);
        expect(accepts(a, "number")).toBe(false);
        expect(accepts(2, "number")).toBe(true);
        expect(findCommand("d")!.overloads[0].params).toEqual([
            "point",
            "point",
        ]);
        expect(findCommand("d")!.formula).toBe(true);
        // A command's name only: no formula's function in the text's head.
        expect(isCommand("d")).toBe(false);
        expect(isCommand("midpoint")).toBe(true);
        expect(findCommand("Sqrt")).toBeUndefined();
        expect([A, a, s].every(readable)).toBe(true);
        expect(readable(c.getObj("w")!)).toBe(true);
        expect(() => type(c, "P = Point(s, a)")).toThrow(
            expect.objectContaining({ key: "arguments" }),
        );
    });

    it("designates the objects under the pointer, points first", () => {
        const { scene: c } = studio();
        [
            "A = (0, 0)",
            "B = (4, 0)",
            "s = Segment(A, B)",
            "c = Circle(A, B)",
        ].forEach((line) => type(c, line));
        c.flush();
        // A at (400, 300), B at (560, 300).
        expect(pick(c, [403, 301]).map(({ object }) => object.name)).toEqual([
            "A",
            "s",
        ]);
        expect(pick(c, [480, 305]).map(({ object }) => object.name)).toEqual([
            "s",
        ]);
        const [hit] = pick(c, [400, 142]);
        expect(hit.object.name).toBe("c");
        const point = addPointOn(c, "P", hit.object, hit.at);
        expectClose(point.coords, [0, 4, 0]);
        expect(pick(c, [400, 200])).toEqual([]);
    });

    it("lets the user choose between objects superposed, not points", () => {
        const { scene: c } = studio();
        [
            "A = (0, 0)",
            "B = (4, 0)",
            "a = Line(A, B)",
            "C = Point(a, -0.5)",
            "D = Point(a, 0.5)",
            "b = Segment(C, D)",
            "c = Segment(A, B)",
        ].forEach((line) => type(c, line));
        c.flush();
        // Between A and D.
        const names = (screen: [number, number]) =>
            meant(pick(c, screen))
                .map(({ object }) => object.name)
                .sort();
        expect(names([440, 300])).toEqual(["a", "b", "c"]);
        expect(names([520, 300])).toEqual(["a", "c"]);
        expect(names([401, 300])).toEqual(["A"]);
    });

    it("finds the intersection a click near two objects makes", () => {
        const { scene: c } = studio();
        [
            "A = (0, 0)",
            "B = (4, 0)",
            "C = (2, -2)",
            "D = (2, 2)",
            "a = Line(A, B)",
            "b = Line(C, D)",
            "c = Segment(A, B)",
            "d = Circle(A, B)",
        ].forEach((line) => type(c, line));
        c.flush();
        const crossed = (screen: [number, number]) => {
            const found = crossing(c, screen, pick(c, screen));
            return found && [found.a.name, found.b.name].sort();
        };
        // Near (2, 0), on a, b and c, a and c superposed.
        expect(crossed([484, 302])).toEqual(["a", "b"]);
        // Near (4, 0), on B.
        expect(crossed([559, 300])).toBeNull();
        // Near (-4, 0), on a and d.
        expect(crossed([243, 304])).toEqual(["a", "d"]);
        expect(crossed([300, 380])).toBeNull();
    });

    it("erases as DGPad, its hidden objects shown pale", async () => {
        const { scene: c } = studio();
        ["A = (0, 0)", "B = (4, 0)", "C = (0, 4)"].forEach((line) =>
            type(c, line),
        );
        const [a, b, k] = ["A", "B", "C"].map((name) => c.getObj(name)!);
        b.hidden = 1;
        k.hidden = 2;
        [b, k].forEach((object) => object.updateView());
        c.flush();
        const ghosts = showGhosts(c);
        expect([...ghosts]).toEqual([b]);
        expect(b.hasView && b.dom.dom().classList.contains("dge-ghost")).toBe(
            true,
        );
        expect(pick(c, [560, 300]).map(({ object }) => object)).toEqual([b]);
        expect(pick(c, [400, 140])).toEqual([]);
        toggleGhost(ghosts, a);
        toggleGhost(ghosts, b);
        const { o, st } = await withHidden(ghosts, 1, () => describeDgo(c));
        expect(o.map((entry) => st?.[entry[3] as number]?.h ?? 0)).toEqual([
            1, 0, 2,
        ]);
        expect([a.hidden, b.hidden, a.hasView]).toEqual([0, 0, true]);
        hideGhosts(ghosts);
        expect([a.hidden, a.hasView, b.hidden]).toEqual([1, false, 0]);
    });

    it("shows the construction step by step, the figure saved whole", async () => {
        const { scene: c } = studio();
        [
            "A = (0, 0)",
            "B = (4, 0)",
            "C = (0, 4)",
            "s = Segment(A, B)",
            "M = Midpoint(A, B)",
        ].forEach((line) => type(c, line));
        const [a, b, k, s, m] = ["A", "B", "C", "s", "M"].map((name) =>
            c.getObj(name)!,
        );
        k.hidden = 1;
        k.updateView();
        let stepping = showStep(c, new Set(), 2);
        expect(stepping.at).toBe(2);
        expect([...stepping.later]).toEqual([s, m]);
        expect([a, b, k, s, m].map((object) => object.hidden)).toEqual([
            0, 0, 1, 1, 1,
        ]);
        // A hidden object goes with the step before it.
        expect([a, k, s].map((object) => stepOf(c, stepping, object))).toEqual([
            1, 2, 3,
        ]);
        const { o, st } = await withHidden(stepping.later, 0, () =>
            describeDgo(c),
        );
        expect(o.map((entry) => st?.[entry[3] as number]?.h ?? 0)).toEqual([
            0, 0, 1, 0, 0,
        ]);
        expect([s.hidden, m.hidden]).toEqual([1, 1]);
        stepping = showStep(c, stepping.later, 9);
        expect(stepping.at).toBe(4);
        expect([...stepping.later]).toEqual([]);
        expect([k.hidden, s.hidden, m.hidden, m.hasView]).toEqual([
            1,
            0,
            0,
            true,
        ]);
    });

    it("writes below a line the value a formula reads", () => {
        const { scene: c } = studio();
        [
            "A = (0, 0)",
            "B = (3, 4)",
            "C = (4, 0)",
            "s = Segment(A, B)",
            "M = Midpoint(A, B)",
            "a = Angle(C, A, B)",
            "k = 2",
        ].forEach((line) => type(c, line));
        const index = figureIndex(c);
        const objects = figureObjects(c);
        const value = (name: string) => {
            const object = c.getObj(name)!;
            return valueText(object, lineOf(object, index, objects), false);
        };
        expect(["A", "s", "M", "k"].map(value)).toEqual([
            "",
            "= 5",
            "= (1.5, 2)",
            "",
        ]);
        expect(value("a")).toMatch(/^= 0\.9273$|^= 53\.1301°$/);
    });

    it("sets magnets as DGPad, and drops those of removed targets", async () => {
        const { scene: c } = studio();
        [
            "A = (0, 0)",
            "B = (4, 0)",
            "C = (0, 4)",
            "a = Line(A, B)",
            "c = Circle(C, A)",
            "M = Midpoint(A, B)",
            "P = Point(c, 1)",
        ].forEach((line) => type(c, line));
        const [A, B, C, a, k, M, P] = ["A", "B", "C", "a", "c", "M", "P"].map(
            (name) => c.getObj(name)!,
        );
        expect([A, M, P].map(magnetizable)).toEqual([true, false, false]);
        const point = B as point_object;
        expect([A, C, k].map((o) => attracts(point, o))).toEqual([
            true,
            true,
            true,
        ]);
        // These move with B.
        expect([point, a, M].map((o) => attracts(point, o))).toEqual([
            false,
            false,
            false,
        ]);
        expect(attracts(A as point_object, a)).toBe(false);
        setReach(point, k as never, 20);
        setReach(point, C as never, 50);
        setReach(point, k as never, 30);
        expect(
            point.magnets.map(({ target, radius }) => [target.name, radius]),
        ).toEqual([
            ["C", 50],
            ["c", 30],
        ]);
        c.flush();
        const zone = showZone(k as never, 30)!;
        expect(zone.dom().nextSibling).toBe(k.dom.dom());
        expect(
            (zone.dom() as SVGElement).style.getPropertyValue("--dge-reach"),
        ).toBe("60px");
        zone.remove();
        setReach(point, k as never, 0);
        expect(reachOf(point, k as never)).toBe(0);
        setReach(point, k as never, 30);
        c.removeObject(C);
        dropLostMagnets(c);
        expect(point.magnets.map(({ target }) => target)).toEqual([]);
        const { st } = await describeDgo(c);
        expect(st?.some((style) => style.mg)).toBe(false);
    });

    it("pins a free point to the window, as DGPad's pushpin", async () => {
        const { scene: c } = studio();
        ["A = (1, 2)", "B = (3, 0)", "M = Midpoint(A, B)"].forEach((line) =>
            type(c, line),
        );
        const [A, M] = ["A", "M"].map((name) => c.getObj(name)!);
        expect([A, M].map(pinnable)).toEqual([true, false]);
        expect(pinnable(studio(true).scene.getObj("A"))).toBe(false);
        const point = A as point_object;
        togglePin(point);
        c.GRID.ORG = [440, 260];
        c.GRID.UNIT = [80, 80, 80];
        c.invalidateProjection();
        c.flush();
        expectClose(point.coords, [0, 0.5, 0]);
        const figure = await describeDgo(c);
        expect(figure.st?.some((style) => style.fl === 1)).toBe(true);
        togglePin(point);
        c.GRID.ORG = [400, 300];
        c.invalidateProjection();
        c.flush();
        expectClose(point.coords, [0, 0.5, 0]);
        expect((await describeDgo(c)).st?.some((style) => style.fl)).toBe(
            false,
        );
    });

    it("finds the objects that keep a figure off the plane z = 0", () => {
        const { scene: c } = studio();
        [
            "A = (1, 2)",
            "B = (3, 0, 0)",
            "M = Midpoint(A, B)",
            "d = Line(A, B)",
            "q = Perpendicular(M, d)",
            "a = [1, 2, 3]",
        ].forEach((line) => type(c, line));
        c.flush();
        expect(offPlane(c)).toBeUndefined();
        type(c, "P = Point([1, 2, 3])");
        c.flush();
        expect(offPlane(c)?.name).toBe("P");
        c.removeObject(c.getObj("P")!);
        type(c, "S = Sphere(A, B)");
        c.flush();
        expect(offPlane(c)?.name).toBe("S");
        c.removeObject(c.getObj("S")!);
        // A circle of axis d, in a vertical plane.
        type(c, "k = Circle(d, M)");
        c.flush();
        expect(offPlane(c)?.name).toBe("k");
        c.removeObject(c.getObj("k")!);
        type(c, "p = [[0, 0, 1], [1, 1, 1]]");
        type(c, "L = List(p)");
        c.flush();
        expect(offPlane(c)?.name).toBe("L");
    });

    it("offers the locus of a point moved by a point on an object, as DGPad", () => {
        const { scene: c } = studio();
        [
            "A = (0, 0)",
            "B = (4, 0)",
            "s = Segment(A, B)",
            "P = Point(s, 0.5)",
            "Q = Point(s, 0.2)",
            "M = Midpoint(A, P)",
            "N = Midpoint(P, Q)",
            "t = Segment(A, M)",
        ].forEach((line) => type(c, line));
        const objects = ["A", "P", "M", "N", "t"].map((name) =>
            c.getObj(name)!,
        );
        const locus = (object: (typeof objects)[number]) =>
            toolsFor(object, false).some(
                ({ overload }) => overload.tag === "Loc",
            );
        expect(objects.map(locus)).toEqual([false, false, true, true, false]);
        // The last built moves it.
        expect([objects[2], objects[3]].map(driverOf)).toEqual([
            c.getObj("P"),
            c.getObj("Q"),
        ]);
    });

    it("offers the ring's tools in a menu, by family, one item per command of a place, and others", () => {
        const items = TOOL_FAMILIES.map(({ items }) =>
            items.map((item) => [
                itemLabel(item),
                ...item.tools.map(({ overload }) => overload.tag),
            ]),
        );
        expect(items).toEqual([
            [
                ["Point", "On"],
                ["Intersection", "Int"],
                ["Midpoint", "Mid", "Mid"],
                ["Center", "Ctr"],
                ["OtherIntersection", "Int"],
                ["Incenter", "TC"],
                ["Centroid", "TC"],
                ["Circumcenter", "TC"],
                ["Orthocenter", "TC"],
            ],
            [
                ["Segment", "Seg"],
                ["Line", "Line"],
                ["Ray", "Ray"],
                ["Vector", "Vec"],
            ],
            [
                ["Perpendicular", "Perp", ""],
                ["Parallel", "Par"],
                ["PerpendicularBisector", "Med", "Med"],
                ["AngleBisector", "Bis"],
                ["Tangent", "Tan", "Tan"],
            ],
            [
                ["Circle (centre and point)", "Cir"],
                ["Circle (centre and radius)", "C1"],
                ["Circumcircle", "C3p", "C3s"],
                ["Compass", "C3"],
                ["Circle (centre, direction and radius)", "C1"],
                ["Circle (axis and point)", "CAx"],
                ["Arc", "Arc", "Arcs", "QArc"],
                ["Sector", "Sec", "Secs", "QSec"],
                ["CenterArc", "CArc", "CArcs"],
                ["CenterSector", "CSec", "CSecs"],
                ["Semicircle", "Semi"],
                ["Conic", "Quad"],
                ["Ellipse", "Ell"],
                ["Hyperbola", "Hyp"],
                ["Parabola", "Prb"],
            ],
            [
                ["Polygon", "Poly"],
                ["Angle", "Ang"],
                ["Locus", "Loc"],
                ["RegularPolygon", "RegP"],
            ],
            [
                ["Point reflection", "Sym"],
                ["Line reflection", "Refl"],
                ["Rotation", "Rot"],
                ["Translation", "Tra"],
                ["Dilation", "Dil"],
                ["Inversion", "Inv"],
            ],
            [
                ["Plane", "Pl", "PlL"],
                ["ParallelPlane", "PlP"],
                ["OrthogonalPlane", "PlO"],
            ],
            [
                ["Sphere", "Sph"],
                ["Cylinder", "Cyl"],
                ["Cone", "Cone"],
                ["Cube", "Cube"],
                ["Prism", "Prsm"],
                ["Pyramid", "Pyr"],
                ["Section", ""],
                ["Net", "Net"],
            ],
            [
                ["Turtle", "ELst"],
                ["Button", "Btn"],
                ["When the object is dragged", "ELst"],
                ["When the object is pressed", "ELst"],
                ["When the object is released", "ELst"],
                ["When the value changes", "ELst"],
            ],
            [["New macro", "ELst"]],
        ]);
        const sphere = TOOL_FAMILIES[7].items[0].tools[0];
        expect([false, true].map((space) => usable(sphere, space))).toEqual([
            false,
            true,
        ]);
    });

    it("gives the objects selected to the menu's tools, in their order, where their types fit", () => {
        const { scene: c } = studio();
        [
            "A = (0, 0)",
            "B = (4, 0)",
            "C = (1, 3)",
            "D = (5, 2)",
            "d = Line(A, B)",
            "s = Segment(A, C)",
            "k = Circle(A, B)",
        ].forEach((line) => type(c, line));
        const [A, B, C, D, d, s, k] = ["A", "B", "C", "D", "d", "s", "k"].map(
            (name) => c.getObj(name)!,
        );
        const item = (label: string) =>
            TOOL_FAMILIES.flatMap(({ items }) => items).find(
                (item) => itemLabel(item) === label,
            )!.tools;
        const given = (label: string, objects: (typeof A)[]) =>
            item(label)
                .filter((tool) => usable(tool, false))
                .map((tool) => assign(tool, objects, 3.8));
        // Any order of types, points in their order.
        expect(given("Perpendicular", [d, C])).toEqual([[C, d]]);
        expect(given("Segment", [B, A])).toEqual([[B, A]]);
        expect(given("Segment", [A])).toEqual([[A, undefined]]);
        expect(given("Segment", [d])).toEqual([null]);
        expect(given("Midpoint", [s])).toEqual([null, [s]]);
        expect(given("Circle (centre and radius)", [A])).toEqual([[A, 3.8]]);
        expect(given("Rotation", [B, A])).toEqual([[B, A, 3.8]]);
        expect(given("Dilation", [B])).toEqual([[B, undefined, 3.8]]);
        expect(given("Tangent", [D, k])).toEqual([[D, k, 3.8], null]);
        expect(given("Polygon", [A, B, D, C])).toEqual([[A, B, D, C]]);
        expect(given("Point", [k])).toEqual([[k]]);
        expect(given("Intersection", [d, k])).toEqual([[d, k]]);
        expect(given("Intersection", [d, A])).toEqual([null]);
        expect(given("Locus", [A])).toEqual([null]);
        // A program answers a point that is dragged, or an expression.
        type(c, "a = 3");
        type(c, "M = Midpoint(A, B)");
        const [a, M] = ["a", "M"].map((name) => c.getObj(name)!);
        expect(given("When the object is dragged", [A])).toEqual([[A]]);
        expect(given("When the object is pressed", [M])).toEqual([null]);
        expect(given("When the object is released", [A, B])).toEqual([null]);
        expect(given("When the value changes", [a])).toEqual([[a]]);
        expect(given("When the value changes", [A])).toEqual([null]);
    });

    it("animates a point on an object as DGPad's spring", async () => {
        const { scene: c } = studio();
        [
            "A = (0, 0)",
            "B = (4, 0)",
            "C = (0, 4)",
            "s = Segment(A, B)",
            "c = Circle(C, A)",
            "M = Midpoint(A, B)",
            "P = Point(s, 0.5)",
            "Q = Point(c, 1)",
        ].forEach((line) => type(c, line));
        c.flush();
        const [A, s, M, P, Q] = ["A", "s", "M", "P", "Q"].map((name) =>
            c.getObj(name)!,
        );
        expect([A, s, M, P, Q].map(springy)).toEqual([
            false,
            false,
            false,
            true,
            true,
        ]);
        const point = P as point_on_object;
        const spring = springOf(point);
        expectClose(spring.forward.map(Math.abs), [1, 0]);
        // Let go like an elastic, the point goes the other way.
        [1, -1].forEach((side) => {
            const { animation, label } = pull(spring, [side * 160, 0]);
            expect(animation).toEqual({
                speed: 50,
                direction: -side * Math.sign(spring.forward[0]),
                ar: false,
            });
            expect(label).toBe("50 px/s");
            setAnimation(point, animation);
            const x = point.sx;
            point.animate(0.1);
            c.flush();
            expect(Math.sign(point.sx - x)).toBe(-side);
        });
        expect(pull(spring, [0, 160])).toEqual({
            animation: { speed: 50, direction: 1, ar: true },
            label: "50 px/s ⇄",
        });
        expect(pull(spring, [10, 0]).animation.speed).toBe(0);
        // Its handle shows its animation, but the direction a back and
        // forth starts in.
        [
            [150, 20],
            [-60, 5],
            [3, -200],
            [400, 0],
        ].forEach((vector) => {
            const { animation } = pull(spring, vector as [number, number]);
            const shown = pull(spring, handleOf(spring, animation)).animation;
            if (animation.ar) shown.direction = animation.direction;
            expect(shown).toEqual(animation);
        });
        const turning = springOf(Q as point_on_object);
        const radius = vSub(
            (Q as point_object).SCREEN,
            (c.getObj("C") as point_object).SCREEN,
        );
        expect(vDot(turning.forward, radius)).toBeCloseTo(0, 1);
        const { animation, label } = pull(
            turning,
            vScale(turning.forward, 130),
        );
        expect(label).toBe("30 °/s");
        expect(animation.speed).toBeCloseTo(Math.PI / 6);
        setAnimation(point, { speed: 0, direction: 1, ar: false });
        expect(
            (await describeDgo(c)).st?.find((style) => style.an)?.an,
        ).toEqual([0, 1, 0]);
    });

    it("animates a slider as DGPad's spring, from its knob", () => {
        const { scene: c } = studio();
        ["b = Slider(0, 10, 2)", "d = 2 * b"].forEach((line) => type(c, line));
        c.flush();
        const [b, d] = ["b", "d"].map(
            (name) => c.getObj(name) as expression_object,
        );
        expect([b, d].map(springy)).toEqual([true, false]);
        const spring = springOf(b);
        expect(spring.forward).toEqual([1, 0]);
        expect(spring.normal.map(Math.abs)).toEqual([0, 1]);
        // Pulled to the left, it goes up.
        const { animation, label } = pull(spring, [-200, 0]);
        expect(animation).toEqual({ speed: 5, direction: 1, ar: false });
        expect(label).toBe("5 %");
        expect(pull(spring, [0, 200])).toEqual({
            animation: { speed: 5, direction: 1, ar: true },
            label: "5 % ⇄",
        });
        // The spring tied to the knob, the ghost along the track.
        const [x] = anchorOf(b);
        const ghost = { at: ghostAt(b), animation };
        const [gx] = moveGhost(b, ghost, 1);
        expect(ghost.at).toBeCloseTo(3);
        expect(b.value).toBe(2);
        expect(gx - x).toBeCloseTo(b.cursorLength / 10);
        setAnimation(b, animation);
        b.animate(1);
        c.flush();
        expect(d.value).toBeCloseTo(6);
    });

    it("animates a point on a conic, which DGPad doesn't", () => {
        const { scene: c } = studio();
        const r = Math.SQRT2;
        [
            "A = (4, 0)",
            "B = (-4, 0)",
            "C = (0, 2)",
            "D = (0, -2)",
            `E = (${2 * r}, ${r})`,
            "e = Conic(A, B, C, D, E)",
            "F = (1, 0)",
            "G = (-1, 0)",
            `H = (${r}, 1)`,
            `I = (${r}, -1)`,
            `J = (${-r}, 1)`,
            "h = Conic(F, G, H, I, J)",
        ].forEach((line) => type(c, line));
        c.flush();
        const P = addPointOn(c, "P", c.getObj("e")!, [4, 0, 0]);
        const Q = addPointOn(c, "Q", c.getObj("h")!, [1, 0, 0]);
        c.flush();
        expect([P, Q].map(springy)).toEqual([true, true]);
        // Round the ellipse, a turn of about 795 px.
        setAnimation(P, { speed: 100, direction: 1, ar: false });
        let turned = 0;
        let last = Math.atan2(P.coords[1] / 2, P.coords[0] / 4);
        for (let step = 0; step < 20; step++) {
            P.animate(0.5);
            c.flush();
            const [x, y] = P.coords;
            expect((x * x) / 16 + (y * y) / 4).toBeCloseTo(1, 6);
            const angle = Math.atan2(y / 2, x / 4);
            turned += ((angle - last + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
            last = angle;
        }
        expect(Math.abs(turned) / (2 * Math.PI)).toBeCloseTo(1000 / 795, 1);
        // Back and forth on its branch of the hyperbola, in the window.
        setAnimation(Q, { speed: 1500, direction: 1, ar: false });
        const sides = new Set<number>();
        for (let step = 0; step < 60; step++) {
            Q.animate(0.1);
            c.flush();
            const [x, y] = Q.coords;
            expect(x * x - y * y).toBeCloseTo(1, 6);
            expect(x).toBeGreaterThan(0);
            expect(Q.sy).toBeGreaterThan(-5);
            expect(Q.sy).toBeLessThan(c.height + 5);
            sides.add(Q.animation!.direction);
        }
        expect(sides.size).toBe(2);
    });

    it("drags the name of a point around it, as in GeoGebra", async () => {
        const { scene: c } = studio();
        readDgo(c, {
            dgo: 1,
            v: { o: [400, 300], u: 40, w: 800, h: 600 },
            o: [["Pt", "A", [0, 0], 0]],
            st: [{ sn: 1, s: 4 }],
        });
        c.flush();
        const A = c.getObj("A") as point_object;
        const box = () => A.nameText!.dom().getBoundingClientRect();
        const { left, top, width, height } = box();
        expect(labelAt(c, [left + width / 2, top + height / 2])).toBe(A);
        expect(labelAt(c, [left - 20, top - 20])).toBe(null);
        // Its center follows the pointer, the name never covering the point.
        placeLabel(A, [370, 260]);
        const [x, y] = labelCenter(A);
        expect([x, y].map(Math.round)).toEqual([370, 260]);
        expect(A.namePosition).toBeCloseTo((Math.PI * 3) / 4, 0);
        placeLabel(A, [401, 301]);
        expect(A.nameDistance).toBe(0);
        placeLabel(A, [400, 0]);
        expect(A.nameDistance).toBe(80);
        expect(A.namePosition).toBeCloseTo(Math.PI / 2);
        placeLabel(A, [440, 280]);
        const { scene: copy } = studio();
        readDgo(copy, await describeDgo(c));
        const B = copy.getObj("A") as point_object;
        expect(B.nameDistance).toBe(A.nameDistance);
        expect(B.namePosition).toBe(A.namePosition);
    });

    it("drags the name of a segment, which then keeps its place beside it", async () => {
        const { scene: c } = studio();
        readDgo(c, {
            dgo: 1,
            v: { o: [400, 300], u: 40, w: 800, h: 600 },
            o: [
                ["Pt", "A", [0, 0]],
                ["Pt", "B", [4, 0]],
                ["Seg", "s", [0, 1], 0],
            ],
            st: [{ sn: 1 }],
        });
        c.flush();
        const s = c.getObj("s")!;
        const B = c.getObj("B") as point_object;
        const box = () => s.nameLabel!.dom().getBoundingClientRect();
        const before = box();
        expect(
            labelAt(c, [
                before.left + before.width / 2,
                before.top + before.height / 2,
            ]),
        ).toBe(s);
        // A quarter of the way from A, 20 pixels above.
        placeLabel(s, [440, 280]);
        c.flush();
        expect(s.nameOffset).toEqual([0.25, -20]);
        expect(s.nameSpot()).toEqual([440, 280]);
        // B turned a quarter turn about A: the name follows, still a quarter
        // of the way and 20 pixels on the same side.
        B.coords = [0, 4, 0];
        c.invalidateGeometry(B);
        c.flush();
        const [x, y] = s.nameSpot()!;
        expect(x).toBeCloseTo(380);
        expect(y).toBeCloseTo(260);
        const figure = await describeDgo(c);
        expect(figure.st).toContainEqual({ sn: 1, no: [0.25, -20] });
        const { scene: copy } = studio();
        readDgo(copy, figure);
        expect(copy.getObj("s")!.nameOffset).toEqual([0.25, -20]);
    });

    it("picks an angle by its mark, whose radius is then dragged", () => {
        const { scene: c } = studio();
        readDgo(c, {
            dgo: 1,
            v: { o: [400, 300], u: 40, w: 800, h: 600 },
            o: [
                ["Pt", "A", [1, 0]],
                ["Pt", "O", [0, 0]],
                ["Pt", "B", [1, 1]],
                ["Pt", "C", [0, 1]],
                ["Ang", "a", [0, 1, 2]],
                ["Ang", "r", [0, 1, 3]],
                ["FA", "f", [0, 1, 45, 1]],
            ],
        });
        c.flush();
        const a = c.getObj("a") as angle_object;
        const r = c.getObj("r") as angle_object;
        r.hidden = 1;
        const at = (t: number, d: number): [number, number] => [
            400 + d * Math.cos(t),
            300 - d * Math.sin(t),
        ];
        // On its arc, beyond it, or past its sides.
        expect(arcDistance(c, a, at(Math.PI / 8, 30))).toBeCloseTo(0);
        expect(arcDistance(c, a, at(Math.PI / 8, 40))).toBeCloseTo(10);
        expect(arcDistance(c, a, [430, 310])).toBeCloseTo(10);
        // DGPad's square of a right angle.
        expect(arcDistance(c, r, [430, 270])).toBeCloseTo(0);
        expect(arcDistance(c, r, [415, 285])).toBeCloseTo(15);
        const f = c.getObj("f") as fixed_angle_object;
        expect(arcDistance(c, f, at(Math.PI / 8, 30))).toBeCloseTo(0);
        expect(arcDistance(c, f, [430, 310])).toBeCloseTo(10);
        f.hidden = 1;
        r.rightAngleMark = "none";
        expect(arcDistance(c, r, at(Math.PI / 4, 30))).toBeCloseTo(0);
        const hits = pick(c, at(Math.PI / 8, 35));
        expect(hits[0].object).toBe(a);
        expect(arcAt(c, at(Math.PI / 8, 35), hits)).toBe(a);
        // A point rather than a mark.
        const vertex = pick(c, [430, 302]);
        expect(vertex[0].object).toBe(c.getObj("A"));
        expect(arcAt(c, [430, 302], vertex)).toBe(null);
    });
});
