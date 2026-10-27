// The library shipped with DocGeo (see MACROS.md, « Bibliothèque »): each
// macro is built by the editor from its figure, written in the text
// language, by `npm run macros`, which writes public/macros/<lang>.dgo.
//
// A macro: its folder, its name in each language, its figure, the objects
// to hide in it (intermediates, shown when its box is opened), and its
// methods: initials and finals named in the figure, help in each language,
// messages for the initials if their type's isn't enough, and the fixed
// ones, looked for by their name (see MACROS.md). A point on
// an object stays where the figure puts it: a final's place, which an
// application then moves, or a constant of the body (see MACROS.md).

import { CIRCLES } from "./circles.mjs";
import { CONICS } from "./conics.mjs";
import { CONSTRUCTIONS } from "./constructions.mjs";
import { HYPERBOLIC } from "./hyperbolic.mjs";
import { PROJECTIVE } from "./projective.mjs";
import { QUADRILATERALS } from "./quadrilaterals.mjs";
import { TRANSFORMATIONS } from "./transformations.mjs";
import { TRIANGLES } from "./triangles.mjs";
import { tr } from "./tr.mjs";

export { LANGS } from "./tr.mjs";

export const FOLDERS = {
    triangles: tr(
        "Triangles",
        "Triangles",
        "Dreiecke",
        "Triángulos",
        "Triangoli",
        "Triângulos",
        "Driehoeken",
        "Τρίγωνα",
        "مثلثات",
        "त्रिभुज",
        "三角形",
        "三角形",
    ),
    quadrilaterals: tr(
        "Quadrilatères",
        "Quadrilaterals",
        "Vierecke",
        "Cuadriláteros",
        "Quadrilateri",
        "Quadriláteros",
        "Vierhoeken",
        "Τετράπλευρα",
        "رباعيات الأضلاع",
        "चतुर्भुज",
        "四边形",
        "四邊形",
    ),
    circles: tr(
        "Cercles",
        "Circles",
        "Kreise",
        "Circunferencias",
        "Circonferenze",
        "Circunferências",
        "Cirkels",
        "Κύκλοι",
        "دوائر",
        "वृत्त",
        "圆",
        "圓",
    ),
    transformations: tr(
        "Transformations",
        "Transformations",
        "Abbildungen",
        "Transformaciones",
        "Trasformazioni",
        "Transformações",
        "Transformaties",
        "Μετασχηματισμοί",
        "تحويلات",
        "रूपांतरण",
        "变换",
        "變換",
    ),
    conics: tr(
        "Coniques",
        "Conics",
        "Kegelschnitte",
        "Cónicas",
        "Coniche",
        "Cônicas",
        "Kegelsneden",
        "Κωνικές τομές",
        "القطوع المخروطية",
        "शंकु परिच्छेद",
        "圆锥曲线",
        "圓錐曲線",
    ),
    conicConstructions: tr(
        "Construction",
        "Construction",
        "Konstruktion",
        "Construcción",
        "Costruzione",
        "Construção",
        "Constructie",
        "Κατασκευή",
        "الإنشاء",
        "रचना",
        "作图",
        "作圖",
    ),
    conicElements: tr(
        "Éléments",
        "Elements",
        "Elemente",
        "Elementos",
        "Elementi",
        "Elementos",
        "Elementen",
        "Στοιχεία",
        "العناصر",
        "अवयव",
        "元素",
        "元素",
    ),
    quadraticForms: tr(
        "Formes quadratiques",
        "Quadratic forms",
        "Quadratische Formen",
        "Formas cuadráticas",
        "Forme quadratiche",
        "Formas quadráticas",
        "Kwadratische vormen",
        "Τετραγωνικές μορφές",
        "الصيغ التربيعية",
        "द्विघाती समघात",
        "二次型",
        "二次型",
    ),
    projective: tr(
        "Géométrie projective",
        "Projective geometry",
        "Projektive Geometrie",
        "Geometría proyectiva",
        "Geometria proiettiva",
        "Geometria projetiva",
        "Projectieve meetkunde",
        "Προβολική γεωμετρία",
        "الهندسة الإسقاطية",
        "प्रक्षेपी ज्यामिति",
        "射影几何",
        "射影幾何",
    ),
    hyperbolic: tr(
        "Géométrie hyperbolique",
        "Hyperbolic geometry",
        "Hyperbolische Geometrie",
        "Geometría hiperbólica",
        "Geometria iperbolica",
        "Geometria hiperbólica",
        "Hyperbolische meetkunde",
        "Υπερβολική γεωμετρία",
        "الهندسة الزائدية",
        "अतिपरवलयिक ज्यामिति",
        "双曲几何",
        "雙曲幾何",
    ),
    constructions: tr(
        "Constructions",
        "Constructions",
        "Konstruktionen",
        "Construcciones",
        "Costruzioni",
        "Construções",
        "Constructies",
        "Κατασκευές",
        "إنشاءات",
        "रचनाएँ",
        "作图",
        "作圖",
    ),
};

export const MACROS = [
    ...TRIANGLES,
    ...QUADRILATERALS,
    ...CIRCLES,
    ...TRANSFORMATIONS,
    ...CONICS,
    ...PROJECTIVE,
    ...CONSTRUCTIONS,
    ...HYPERBOLIC,
];
