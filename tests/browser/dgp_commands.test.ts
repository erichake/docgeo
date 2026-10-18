import { describe, expect, it } from "vitest";
// First, as in main.ts: the object classes import each other.
import { AWAKE } from "../../src/construction";
import { importDgp, importDgpFromUrl } from "../../src/dgp_importer";
import { t } from "../../src/i18n";
import type { circle3pts_object } from "../../src/objects/circle3pts_object";
import type { curve_object } from "../../src/objects/curve_object";
import type { expression_list_object } from "../../src/objects/expression_list_object";
import type { expression_object } from "../../src/objects/expression_object";
import type { fixed_angle_object } from "../../src/objects/fixed_angle_object";
import { panel_object } from "../../src/objects/panel_object";
import type { point_object } from "../../src/objects/point_object";
import type { two_points_line_object } from "../../src/objects/two_points_line_object";
import {
    createConstruction,
    disposeFigures,
    expectClose,
    figure,
    frame,
} from "./figures";

disposeFigures();

const value = (c: ReturnType<typeof createConstruction>, name: string) =>
    (c.getObj(name) as expression_object).value;

describe("DGPad's commands", () => {
    it("imports a figure with Blockly programs it can't read without them, reporting them", () => {
        const c = createConstruction();
        const unsupported = importDgp(
            c,
            `P1=Point("P1",1,2);
btn=BlocklyButton("btn","reset","0","0");
c=Expression("c","","","","var bl_a=function(){GLOBAL_INC(\\"T\\",1);return GLOBAL_GET(\\"T\\")};bl_a()","0","0");
d=Expression("d","","","","c+1","0","0");
BLK(P1,{"onlogo":{"xml":"<xml/>","sync":"TURTLE_INIT(\\"P1\\",P1);"}});
BLK(P1,{"onchange":{"xml":"<xml/>","sync":"ALERT(1);"}});
BLK_GLOB_SET({"T":0});`,
        );
        expect(c.getObj("P1")).toBeTruthy();
        // A button without a program, which does nothing.
        expect(c.getObj("btn")).toBeTruthy();
        expect(c.getObj("d")).toBeFalsy();
        expect(unsupported.map((call) => call.split("(")[0])).toEqual([
            "Expression",
            "BLK",
        ]);
        expect(unsupported[0]).toContain("…");
        expect(unsupported[1]).toContain("onchange");
    });

    it("runs DGPad's SET_EXP, styles a List declared later, and ignores a turtle whose point was deleted", () => {
        const c = createConstruction();
        const unsupported = importDgp(
            c,
            `A=Point("A",1,2);
C=Point("C",0,0);
cpt=Expression("cpt","","","","5","0","0");
e=Expression("e","","","","var bl_a=function(){\\nBLK_STL(\\"l1\\",\\"setArrow\\",[[8,3]]);\\nSET_EXP(\\"C\\",[A[0]+1,A.slice(-1)[0]]);\\nSET_EXP(\\"cpt\\",0);\\nSET_EXP(\\"cpt\\",cpt+2);\\nreturn [[0,0],[1,cpt]]\\n};\\nbl_a()","0","0");
l1=List("l1",e);
STL(l1,"sg:1;ar:[8,3]");
m=Expression("m","","","","3","0","0");
f=Curvus("f","0","m*2","x^2");
t=Expression("t","","","","TURTLE_INIT(\\"P9\\",P9);TURTLE_MV(1,false);return TURTLE_RESULT()","0","0");
lt=List("lt",t);`,
        );
        c.OBJS.update();
        expect(unsupported).toEqual([]);
        expect(c.getObj("t")).toBeFalsy();
        expect(c.getObj("lt")).toBeFalsy();
        expect((c.getObj("C") as point_object).coords).toEqual([2, 2, 0]);
        expect(value(c, "cpt")).toBe(2);
        expect(value(c, "e")).toEqual([
            [0, 0],
            [1, 2],
        ]);
        // From its style, which DGPad keeps: the program runs before it.
        expect((c.getObj("l1") as expression_list_object).arrow).toEqual([
            8, 3,
        ]);
        expect((c.getObj("f") as curve_object).max).toBe(6);
    });

    it("makes an inert object, which the pointer passes through unless the body wakes it", () => {
        const c = createConstruction();
        importDgp(
            c,
            `P1=Point("P1",1,2);
P2=Point("P2",-1,2);
STL(P1,"nmi:true");`,
        );
        c.flush();
        c.reveal();
        const [inert, other] = ["P1", "P2"].map(
            (name) => c.getObj(name) as point_object,
        );
        expect([inert.inert, other.inert]).toEqual([true, false]);
        const box = c.svg.dom().getBoundingClientRect();
        const under = (point: point_object) =>
            document.elementFromPoint(box.left + point.sx, box.top + point.sy);
        expect(inert.dom.dom().contains(under(inert))).toBe(false);
        expect(other.dom.dom().contains(under(other))).toBe(true);
        document.body.classList.add(AWAKE);
        expect(inert.dom.dom().contains(under(inert))).toBe(true);
        document.body.classList.remove(AWAKE);
    });

    it("reads the early SetCoords, without 3D flag nor window size", () => {
        const c = createConstruction();
        importDgp(c, `SetCoords(100,200,40);`);
        expect(c.GRID.ORG).toEqual([100, 200]);
        expect(c.GRID.UNIT).toEqual([40, 40, 40]);
        expect(c.GRID.is2D).toBe(true);
    });

    it("builds DGPad's axes, which are never drawn", () => {
        const c = createConstruction();
        importDgp(
            c,
            `ox=X_axis("ox");
oy=Y_axis("oy");
A=PointOn("A",ox,2);
B=Point("B",1,3);
P=Parallel("P",oy,B);
I=OrderedIntersection("I",P,ox,0);`,
        );
        c.OBJS.update();
        expect((c.getObj("A") as point_object).coords).toEqual([2, 0, 0]);
        expect((c.getObj("I") as point_object).coords).toEqual([1, 0, 0]);
        const axis = c.getObj("oy") as two_points_line_object;
        expect(axis.hidden).toBe(2);
        expect([axis.P1.hidden, axis.P2.hidden]).toEqual([2, 2]);
    });

    it("reads a segment's length, a circle's radius, an angle's measure and a polygon's area", () => {
        const c = createConstruction();
        importDgp(
            c,
            `A=Point("A",0,0);
B=Point("B",3,0);
C=Point("C",0,4);
S1=Segment("S1",A,B);
C1=Circle1("C1",A,"S1+1");
a=Angle("a",B,A,C);
Poly1=Polygon("Poly1","_A,_B,_C");
v=Expression("v","","","","S1*100+C1*10+a/90+Poly1/1000","0","0");`,
        );
        c.OBJS.update();
        expect(value(c, "v")).toBeCloseTo(300 + 40 + 1 + 0.006, 12);
    });

    it("derives function expressions, derivatives of derivatives included", () => {
        const c = createConstruction();
        const unsupported = importDgp(
            c,
            `a=Expression("a","","","","3","0","0");
f=Expression("f","","","","a*sin(t)+t^3","0","0");
d1=Expression("d1","","","","f.dt(t)","0","0");
d2=Expression("d2","","","","d1.dt(t)","0","0");
d3=Expression("d3","","","","d2.dt(t)","0","0");
v=Expression("v","","","","[d1(2),d2(2),d3(2)]","0","0");
SetGeneralStyle("degree:false");`,
        );
        c.OBJS.update();
        expect(unsupported).toEqual([]);
        expectClose(value(c, "v") as number[], [
            3 * Math.cos(2) + 12,
            -3 * Math.sin(2) + 12,
            -3 * Math.cos(2) + 6,
        ]);
    });

    it("reads a slider's bounds naming an object declared later", () => {
        const c = createConstruction();
        const unsupported = importDgp(
            c,
            `n=Expression("n","","","","30","0","0");
s=Expression("s","","0","1+floor(n*m)","12","0","0");
m=Expression("m","","","","2*n","0","0");
v=Expression("v","","","","s+m","0","0");`,
        );
        c.OBJS.update();
        expect(unsupported).toEqual([]);
        expect((c.getObj("s") as expression_object).max).toBe(1801);
        expect(value(c, "v")).toBe(72);
    });

    it("turns a fixed angle given by a formula, in the figure's unit", () => {
        const c = createConstruction();
        importDgp(
            c,
            `O=Point("O",0,0);
A=Point("A",1,0);
C=Point("C",0,1);
F=FixedAngle("F",A,O,"Angle360(A,O,C)/3",true);`,
        );
        c.OBJS.update();
        const angle = c.getObj("F") as fixed_angle_object;
        expect(angle.valueDegrees).toBeCloseTo(30, 12);
        const point = c.getObj("C") as point_object;
        point.coords = [-1, 0, 0];
        c.invalidateGeometry(point);
        c.OBJS.update();
        expect(angle.valueDegrees).toBeCloseTo(60, 12);
    });

    it("draws the circle through three points in space", () => {
        const c = createConstruction();
        importDgp(
            c,
            `SetCoords(0,0,40,true,400,400);
O=Point("O",0,0);
A=Point("A","[1,0,0]","1");
B=Point("B","[0,1,0]","1");
C=Point("C","[0,0,1]","1");
C1=Circle3pts3D("C1",A,B,C);`,
        );
        c.OBJS.update();
        const circle = c.getObj("C1") as circle3pts_object;
        expect(circle.defined).toBe(true);
        circle.CENTER.forEach((coordinate) =>
            expect(coordinate).toBeCloseTo(1 / 3, 12),
        );
        expect(circle.R).toBeCloseTo(Math.sqrt(2 / 3), 12);
    });

    it("moves a slider's bounds with the numbers they read", () => {
        const c = createConstruction();
        importDgp(
            c,
            `n=Expression("n","","0","5","2","0","0");
m=Expression("m","","-n","2*n","3","0","0");`,
        );
        c.OBJS.update();
        const slider = c.getObj("m") as expression_object;
        expect([slider.min, slider.max, slider.isCursor]).toEqual([
            -2,
            4,
            true,
        ]);
        expect(slider.dom.dom().querySelector("circle")).not.toBeNull();
        (c.getObj("n") as expression_object).value = 1;
        c.invalidateGeometry(c.getObj("n")!);
        c.OBJS.update();
        expect([slider.min, slider.max, slider.value]).toEqual([-1, 2, 3]);
    });

    it("reads a checkbox's true or false", () => {
        const c = createConstruction();
        importDgp(
            c,
            `b=Expression("b","","","","true","0","0");
d=Expression("d","","","","false","0","0");`,
        );
        expect([value(c, "b"), value(c, "d")]).toEqual([1, 0]);
    });

    it("puts a point on a List's item", () => {
        const c = createConstruction();
        importDgp(
            c,
            `L=Expression("L","","","","[[0,0],[1,1],[2,0]]","0","0");
LL=List("LL",L);
M=PointOn("M",LL,[1,0]);`,
        );
        c.OBJS.update();
        expect((c.getObj("M") as point_object).coords).toEqual([1, 1, 0]);
    });

    it("draws the curves its scripts compute in the window", async () => {
        const c = createConstruction([1300, 844]);
        expect(await importDgpFromUrl(c, figure("yves.dgp"))).toEqual([]);
        await frame();
        const counts = () =>
            ["Cnk2Alg", "Cnk2Alg0", "Cnk2Alg1", "Cnk2Alg2", "Cnk2Alg3"]
                .concat(["Cnk3v3Alg", "Cnk3v3Alg0", "Cnk3v3Alg1"])
                .map(
                    (name) => (c.getObj(name) as expression_list_object).count,
                );
        expect(counts()).toEqual([191, 188, 190, 189, 190, 524, 442, 679]);
        const k = c.getObj("k") as expression_object;
        k.value = 0;
        c.invalidateGeometry(k);
        await frame();
        expect(counts()).not.toContain(0);
        expect(counts()).not.toEqual([191, 188, 190, 189, 190, 524, 442, 679]);
    });
});

describe("DGPad's texts", () => {
    const panel = (c: ReturnType<typeof createConstruction>) =>
        c.OBJS.V.find((object) => object instanceof panel_object)!;

    it("shows a long list by its first items and its size, as DGPad", async () => {
        const c = createConstruction();
        importDgp(
            c,
            `E1=Expression("E1","","","","var t=[];for(var i=0;i<1000;i++){t.push([i,i/4])};t","0","0");
E2=Expression("E2","","","","[1,2,3]","0","0");
STL(E1,"p:2");
STL(E2,"p:2");`,
        );
        await frame();
        const text = (name: string) =>
            (c.getObj(name) as expression_object).dom.dom().textContent;
        expect(text("E1")).toBe(
            `E1 = [[0 ; 0] ; [1 ; 0,25] ; [2 ; 0,5] ; … (1000 ${t("list_items")})]`,
        );
        expect(text("E2")).toBe("E2 = [1 ; 2 ; 3]");
    });

    it("shows their formulas and TeX, and their fields change the numbers they target", async () => {
        const c = createConstruction();
        const unsupported = importDgp(
            c,
            `A=Point("A",0,0);
B=Point("B",3,4);
E1=Expression("E1","","","","2","0","0");
b=Expression("b","","","","false","0","0");
Text("AB = %d(A,B)% ; $\\\\frac{%E1%}{2}$ <input target=\\"E1\\"><input type=checkbox target=\\"b\\"><b style=\\"background:url(https://x.org/a.png);color:red\\">!</b>",10,20,300,100,"c:rgba(59,79,115,0.18);s:3;r:15;p:2");`,
        );
        expect(unsupported).toEqual([]);
        await frame();
        const html = panel(c).dom.dom();
        expect(html.textContent).toContain("AB = 5 ; ");
        const bold = html.querySelector("b") as HTMLElement;
        expect(bold.style.color).toBe("red");
        expect(bold.style.background).toBe("");
        const [field, checkbox] = html.querySelectorAll("input");
        expect(field.value).toBe("2");
        field.value = "7,5";
        field.dispatchEvent(new Event("input"));
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event("change"));
        c.OBJS.update();
        expect([value(c, "E1"), value(c, "b")]).toEqual([7.5, 1]);
    });

    it("reads the 3D coordinates of a 3D figure's points", async () => {
        const c = createConstruction();
        importDgp(
            c,
            `SetCoords(100,200,40,true,800,600);
M=Point("M","[1,2,3]","1");
Text("%M[2]%",0,0,10,10);`,
        );
        await frame();
        expect(panel(c).dom.dom().textContent).toBe("3");
    });

    it("refuses those that run scripts or load pages", () => {
        const c = createConstruction();
        const unsupported = importDgp(
            c,
            `E1=Expression("E1","","","","2","0","0");
Text("<input type=button onclick=\\"alert(1)\\" target=\\"E1\\">",0,0,10,10);
Text("§ name=\\"run\\"\\nalert(1)\\n§",0,0,10,10);
Text("<script>alert(1)</script>",0,0,10,10);
Text("<iframe src=\\"https://x.org\\"></iframe>",0,0,10,10);
Text("<img src=x>",0,0,10,10);
Text("OK",0,0,10,10);`,
        );
        expect(unsupported).toHaveLength(5);
        expect(
            c.OBJS.V.filter((object) => object instanceof panel_object),
        ).toHaveLength(1);
    });
});
