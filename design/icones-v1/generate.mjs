import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const out = new URL("./", import.meta.url);
const originals = JSON.parse(
    readFileSync(new URL("originals.json", out), "utf8"),
);
const ink = "#3d5067";
const red = "#cb4254";
const guide = "#a5afbd";
const p = (d, kind = "ink", extra = "") =>
    `<path class="${kind}" d="${d}" ${extra}/>`;
const circle = (x, y, r, kind = "ink", extra = "") =>
    `<circle class="${kind}" cx="${x}" cy="${y}" r="${r}" ${extra}/>`;
const ellipse = (x, y, rx, ry, kind = "red", extra = "") =>
    `<ellipse class="${kind}" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" ${extra}/>`;
const dot = (x, y, result = false) =>
    `<circle cx="${x}" cy="${y}" r="${result ? 1.65 : 1.45}" fill="${result ? red : ink}" stroke="#fff" stroke-width=".55"/>`;
const dots = (...points) => points.map(([x, y]) => dot(x, y)).join("");
const fill = (d, opacity = 0.08) =>
    p(d, "red", `fill="${red}" fill-opacity="${opacity}"`);
const dash = (d) => p(d, "guide", 'stroke-dasharray="1.2 2" stroke-width="1"');
const arrow = (d, kind = "red") => p(d, kind);
const radius = (x, y) =>
    `<text x="${x}" y="${y}" fill="${ink}" stroke="none" font-family="Georgia,serif" font-style="italic" font-size="8.5">r</text>`;
const triangle = p("M5 18H19L9 6Z");
const vertices = dots([5, 18], [19, 18], [9, 6]);
const tri = (lines, x, y, more = "") =>
    triangle + lines + more + vertices + dot(x, y, true);

const groups = [];
let items;
const group = (name, color, subtitle) => {
    items = [];
    groups.push({ name, color, subtitle, items });
};
const add = (key, label, body) => {
    if (!originals[key]) throw new Error(`Missing original: ${key}`);
    items.push({ key, label, body, original: originals[key][2] });
};

group("Points", "#b39161", "Désigner · intersecter · repérer un centre");
add(
    "Point",
    "Point sur objet",
    p("M3.5 17Q12 1.5 20.5 17", "guide") + dot(12, 9.25, true),
);
add(
    "Intersection",
    "Intersection",
    p("M4.5 19.5 19.5 4.5M4.5 4.5l15 15", "guide") + dot(12, 12, true),
);
add(
    "Midpoint",
    "Milieu",
    p("M4.5 12h15", "guide") +
        p("M8 10.5v3M16 10.5v3", "guide", 'stroke-width="1"') +
        dots([4.5, 12], [19.5, 12]) +
        dot(12, 12, true),
);
add(
    "Center",
    "Centre",
    circle(12, 12, 8) + dash("M12 8v8M8 12h8") + dot(12, 12, true),
);
add(
    "OtherIntersection",
    "Autre intersection",
    circle(12, 12, 7, "guide") +
        p("M2.5 12h19", "guide") +
        dot(5, 12) +
        dot(19, 12, true),
);
add(
    "Incenter",
    "Centre inscrit",
    tri("", 10.278, 14.197, circle(10.278, 14.197, 3.803, "red")),
);
add(
    "Centroid",
    "Centre de gravité",
    tri(
        p("M5 18 14 12M19 18 7 12M9 6 12 18", "guide", 'stroke-width="1"'),
        11,
        14,
    ),
);
add(
    "Circumcenter",
    "Centre circonscrit",
    circle(12, 13.667, 8.232, "guide") + tri("", 12, 13.667),
);
add(
    "Orthocenter",
    "Orthocentre",
    tri(
        p("M9 6v12M5 18 13.262 11.115", "guide", 'stroke-width="1"') +
            p(
                "M9 16h2v2M12.2 12.4l1.5 1.25 1.25-1.5",
                "guide",
                'stroke-width=".8"',
            ),
        9,
        14.667,
    ),
);

group("Droites", "#6585b6", "Des extrémités, une direction, un sens");
add("Segment", "Segment", p("M5 19 19 5", "red") + dots([5, 19], [19, 5]));
add("Line", "Droite", p("M3 21 21 3", "red") + dots([7, 17], [17, 7]));
add("Ray", "Demi-droite", p("M5 19 21 3", "red") + dots([5, 19], [15, 9]));
add("Vector", "Vecteur", p("M5 19 19 5M12.5 5H19v6.5", "red") + dot(5, 19));

group("Constructions", "#9573bb", "Relations et directions remarquables");
add(
    "Perpendicular",
    "Perpendiculaire",
    p("M3 18h18", "guide") +
        p("M12 14h4v4", "guide", 'stroke-width="1"') +
        p("M12 3.5v17", "red") +
        dot(12, 7),
);
add(
    "Parallel",
    "Parallèle",
    p("M3.5 16.5 16 4", "guide") +
        p("M7.5 20.5 20 8", "red") +
        p(
            "m8 10 .2-2.5 2.5-.2m2 7 .2-2.5 2.5-.2",
            "guide",
            'stroke-width="1"',
        ) +
        dot(14, 14),
);
add(
    "PerpendicularBisector",
    "Médiatrice",
    p("M4 12h16", "guide") +
        p("M8 10.3v3.4M16 10.3v3.4", "guide", 'stroke-width="1"') +
        p("M12 3.5v17", "red") +
        p("M12 15h3v-3", "guide", 'stroke-width=".9"') +
        dots([4, 12], [20, 12]),
);
add(
    "AngleBisector",
    "Bissectrice",
    p("M4 19h17M4 19 12.5 4.3", "guide") +
        p("M10.2 19a6.2 6.2 0 0 0-3.1-5.37", "guide", 'stroke-width="1"') +
        p("M4 19 20.5 9.47", "red"),
);
add(
    "Tangent",
    "Tangente",
    circle(11, 14, 6.5) +
        p("M2.5 7.5h19", "red") +
        circle(11, 7.5, 1.25, "red", 'fill="#fff" stroke-width="1"') +
        dot(19, 7.5),
);

group(
    "Cercles, arcs et coniques",
    "#60a78d",
    "Courbes et surfaces · les trois dernières icônes sont en 3D",
);
add(
    "Circle (centre and point)",
    "Cercle · centre et point",
    circle(12, 12, 8, "red") +
        p("M12 12 18.4 7.2", "guide", 'stroke-width="1"') +
        dots([12, 12], [18.4, 7.2]),
);
add(
    "Circle (centre and radius)",
    "Cercle · rayon",
    circle(10, 14, 7, "red") +
        p("M10 14h7", "guide", 'stroke-width="1"') +
        dot(10, 14) +
        radius(16, 8.5),
);
add(
    "Circumcircle",
    "Cercle par trois points",
    circle(12, 12, 8, "red") + dots([4, 12], [16, 5.072], [16, 18.928]),
);
add(
    "Compass",
    "Compas",
    p("M3 19.5h6.5", "guide", 'stroke-width="1"') +
        dots([3, 19.5], [9.5, 19.5]) +
        circle(15, 9.5, 6.5, "red") +
        dot(15, 9.5),
);
add(
    "Arc",
    "Arc par trois points",
    p("M4 15a8 8 0 0 1 14.928-4", "red") + dots([4, 15], [12, 7], [18.928, 11]),
);
add(
    "Sector",
    "Secteur par trois points",
    fill("M6 18V6a12 12 0 0 1 12 12Z") +
        dots([6, 6], [14.485, 9.515], [18, 18]),
);
add(
    "CenterArc",
    "Arc · centre et points",
    p("M6 18 14 4.144", "guide", 'stroke-width="1"') +
        p("M6 18h12", "guide", 'stroke-width="1"') +
        p("M18 18a12 12 0 0 0-6-10.392", "red") +
        dots([6, 18], [18, 18], [9.5, 11.938]),
);
add(
    "CenterSector",
    "Secteur · centre et points",
    p("M12 7.608 14 4.144", "guide", 'stroke-width="1"') +
        fill("M6 18h12a12 12 0 0 0-6-10.392Z") +
        dots([6, 18], [18, 18], [9.5, 11.938]),
);
add(
    "Semicircle",
    "Demi-cercle",
    p("M4 16h16", "guide", 'stroke-width="1"') +
        p("M4 16a8 8 0 0 1 16 0", "red") +
        dots([4, 16], [20, 16]),
);
add(
    "Conic",
    "Conique par cinq points",
    ellipse(12, 12, 9, 6) +
        dots([3, 12], [7.5, 6.804], [16.5, 6.804], [21, 12], [12, 18]),
);
add(
    "Ellipse",
    "Ellipse",
    ellipse(12, 12, 9, 6) +
        p("M5.292 12 16.5 6.804 18.708 12", "guide", 'stroke-width=".9"') +
        dots([5.292, 12], [18.708, 12], [16.5, 6.804]),
);
add(
    "Hyperbola",
    "Hyperbole",
    p("M3 3.5C10 9.5 10 14.5 3 20.5M21 3.5C14 9.5 14 14.5 21 20.5", "red") +
        dots([4.5, 12], [19.5, 12], [17.0625, 7.796875]),
);
add(
    "Parabola",
    "Parabole",
    p("M3 5h18", "guide") +
        p("M3 18.125Q12-2.125 21 18.125", "red") +
        dash("M12 5v5") +
        dot(12, 10),
);
add(
    "Sphere",
    "Sphère",
    circle(12, 12, 8, "red", `fill="${red}" fill-opacity=".04"`) +
        p("M4 12a8 3 0 0 0 16 0", "red", 'stroke-width="1"') +
        p(
            "M4 12a8 3 0 0 1 16 0",
            "guide",
            'stroke-width=".9" stroke-dasharray="1.2 1.8"',
        ) +
        dot(12, 12),
);
add(
    "Circle (centre, direction and radius)",
    "Cercle · direction et rayon",
    p("M10 17V3.5M7.5 6 10 3.5 12.5 6", "guide") +
        ellipse(10, 16, 7.5, 3.7) +
        dot(10, 16) +
        radius(17, 10),
);
add(
    "Circle (axis and point)",
    "Cercle · axe et point",
    dash("M12 2.5v19") + ellipse(12, 14, 8.5, 3.8) + dot(20.5, 14),
);

group(
    "Polygones, angles et lieux",
    "#60a4b2",
    "Des surfaces légères, des contours précis",
);
add(
    "Polygon",
    "Polygone",
    fill("M5 18 8 5 20 8.5 17 19.5Z") +
        dots([5, 18], [8, 5], [20, 8.5], [17, 19.5]),
);
add(
    "Angle",
    "Angle",
    fill("M4 19h7a7 7 0 0 0-3.5-6.062Z", 0.12) + p("M4 19h17M4 19 12.5 4.278"),
);
add(
    "Locus",
    "Lieu",
    p("M3 17Q12-1 21 17", "red") +
        p("M3 21h18", "guide", 'stroke-width="1"') +
        dash("M15 21V9") +
        dots([15, 21], [15, 9]),
);
add(
    "RegularPolygon",
    "Polygone régulier",
    fill("M7 19h10l3.09-9.51L12 3.612 3.91 9.49Z") + dots([7, 19], [17, 19]),
);

group("Transformations", "#b972a2", "Un objet, une relation, son image");
add(
    "Point reflection",
    "Symétrie centrale",
    dash("M4.5 19.5 19.5 4.5") +
        dots([4.5, 19.5], [12, 12]) +
        dot(19.5, 4.5, true),
);
add(
    "Line reflection",
    "Symétrie axiale",
    p("M12 3v18") +
        dash("M4.5 12h15") +
        p("M12 14.5h2.5V12", "guide", 'stroke-width=".8"') +
        dot(4.5, 12) +
        dot(19.5, 12, true),
);
add(
    "Rotation",
    "Rotation",
    p("M19 17a12 12 0 0 0-12-12", "guide", 'stroke-width="1.2"') +
        p("m9.6 3.1-2.6 1.9 2.7 1.7", "red", 'stroke-width="1.1"') +
        dots([7, 17], [19, 17]) +
        dot(7, 5, true),
);
add(
    "Translation",
    "Translation",
    arrow("M3.5 8.5 16 3.5M11.5 2.8l4.5.7-2.7 3.6", "ink") +
        dash("M6 20 18.5 15") +
        dot(6, 20) +
        dot(18.5, 15, true),
);
add(
    "Dilation",
    "Homothétie",
    dash("M3.5 21 21 13M3.5 21 11 3") +
        p("M7.25 12 12.25 17 7.25 17Z") +
        fill("M11 3 21 13H11Z") +
        dot(3.5, 21),
);
add(
    "Inversion",
    "Inversion",
    circle(9, 12, 6.5) +
        dash("M9 12h12.5") +
        circle(9, 12, 0.7, "guide", 'fill="#a5afbd" stroke="none"') +
        dot(12.5, 12) +
        dot(21.071, 12, true),
);

group("Plans", "#8389b8", "Constructions dans l’espace");
add(
    "Plane",
    "Plan",
    fill("M2.5 17 7.5 7.5h14l-5 9.5Z") + dots([7.5, 14], [12, 10], [17, 14]),
);
add(
    "ParallelPlane",
    "Plan parallèle",
    p("m3 21 4-6h14l-4 6Z", "guide", 'fill="#a5afbd" fill-opacity=".06"') +
        fill("m3 10 4-6h14l-4 6Z") +
        dot(12, 7),
);
add(
    "OrthogonalPlane",
    "Plan perpendiculaire",
    dash("M12 2v20") +
        fill("m2.5 17 4-6h15l-4 6Z") +
        p("M12 9V4", "ink") +
        p("M12 11h2.5v3", "guide", 'stroke-width=".85"') +
        dot(12, 14),
);

group(
    "Solides",
    "#9573bb",
    "Faces légèrement teintées et arêtes cachées en retrait",
);
add(
    "Cylinder",
    "Cylindre",
    fill("M5 6.5v11a7 3 0 0 0 14 0v-11", 0.06) +
        ellipse(12, 6.5, 7, 3, "red", `fill="${red}" fill-opacity=".09"`) +
        p(
            "M5 17.5a7 3 0 0 1 14 0",
            "guide",
            'stroke-dasharray="1.2 1.8" stroke-width=".9"',
        ) +
        dots([12, 6.5], [12, 17.5]),
);
add(
    "Cone",
    "Cône",
    fill("M4 18 12 3.5 20 18a8 3 0 0 1-16 0Z", 0.07) +
        p(
            "M4 18a8 3 0 0 1 16 0",
            "guide",
            'stroke-dasharray="1.2 1.8" stroke-width=".9"',
        ) +
        dots([12, 18], [12, 3.5]),
);
const cubeFaces =
    fill("m4 7.5 8-4.5 8 4.5-8 4.5Z", 0.04) +
    fill("M4 7.5v9l8 4.5v-9Z", 0.09) +
    fill("M12 12v9l8-4.5v-9Z", 0.17);
add("Cube", "Cube", cubeFaces + dots([4, 16.5], [12, 21], [20, 16.5]));
add(
    "Prism",
    "Prisme",
    fill("m4 7 7-3 9 4-7 3Z", 0.04) +
        fill("M4 7v10l9 4V11Z", 0.09) +
        fill("M13 11v10l7-3V8Z", 0.17) +
        dash("M4 17l7-3 9 4M11 14V4") +
        dot(4, 7),
);
add(
    "Pyramid",
    "Pyramide",
    fill("m12 3-8 14 8 4Z", 0.07) +
        fill("M12 3v18l8-4Z", 0.16) +
        dash("m4 17 8-4 8 4M12 13V3") +
        dot(12, 3),
);
add(
    "Section",
    "Section plane",
    p(
        "M4 7.5v9l8 4.5 8-4.5v-9L12 3ZM4 7.5l8 4.5 8-4.5M12 12v9",
        "guide",
        'stroke-width="1.1"',
    ) + fill("m4 12 8 4.5 8-4.5-8-4.5Z", 0.18),
);
add(
    "Net",
    "Patron",
    fill("M9.5 2h5v20h-5ZM4.5 7h15v5h-15Z", 0.07) +
        p(
            "M9.5 7h5m-5 5h5m-5 5h5M9.5 7v5m5-5v5",
            "red",
            'stroke-dasharray="1 1.5" stroke-width=".85"',
        ),
);

const count = groups.reduce((n, g) => n + g.items.length, 0);
if (count !== 54) throw new Error(`Expected 54 icons, got ${count}`);
const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const styles = `
text { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
.ink { stroke: ${ink}; } .red { stroke: ${red}; } .guide { stroke: ${guide}; }
.new { fill:none; stroke:${ink}; stroke-width:1.35; stroke-linecap:round; stroke-linejoin:round; }
.old { fill:none; stroke:currentColor; stroke-width:1.65; stroke-linecap:round; stroke-linejoin:round; color:#536174; }
.old .dge-guide { opacity:.65; } .old .dge-result { color:#d14343; }
.title { font-size:34px; font-weight:650; fill:#26374c; letter-spacing:-1px; }
.caption { font-size:13px; fill:#778497; } .label { font-size:12px; fill:#526176; }
.family { font-size:18px; font-weight:600; fill:#26374c; }
`;
function icon(body, x, y, size, kind = "new") {
    return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" class="${kind}">${body}</svg>`;
}
function text(x, y, s, cls = "label", extra = "") {
    return `<text x="${x}" y="${y}" class="${cls}" ${extra}>${esc(s)}</text>`;
}
function wrapLabel(label, x, y) {
    const words = label.split(" ");
    const lines = [""];
    for (const word of words) {
        if ((lines.at(-1) + " " + word).trim().length > 24) lines.push(word);
        else lines[lines.length - 1] = (lines.at(-1) + " " + word).trim();
    }
    return lines
        .map((line, i) =>
            text(x, y + i * 16, line, "label", 'text-anchor="middle"'),
        )
        .join("");
}

function sheet(compare = false) {
    let y = 228;
    const bits = [];
    for (const [index, g] of groups.entries()) {
        bits.push(
            `<rect x="44" y="${y - 16}" width="4" height="23" rx="2" fill="${g.color}"/>`,
        );
        bits.push(text(60, y + 2, g.name, "family"));
        bits.push(text(60, y + 24, g.subtitle, "caption"));
        const top = y + 42;
        g.items.forEach((item, i) => {
            const x = 44 + (i % 6) * 186;
            const cy = top + Math.floor(i / 6) * 154;
            bits.push(
                `<rect x="${x}" y="${cy}" width="174" height="140" rx="13" fill="#fff" stroke="#e3e8ee"/>`,
            );
            if (compare) {
                bits.push(icon(item.original, x + 23, cy + 29, 42, "old"));
                bits.push(
                    `<path d="M${x + 80} ${cy + 46}h12m-3-3 3 3-3 3" fill="none" stroke="#b6bfcb" stroke-width="1.2"/>`,
                );
                bits.push(icon(item.body, x + 108, cy + 29, 42));
                bits.push(
                    text(
                        x + 44,
                        cy + 89,
                        "Actuel",
                        "caption",
                        'text-anchor="middle" style="font-size:10px"',
                    ),
                );
                bits.push(
                    text(
                        x + 130,
                        cy + 89,
                        "Proposition",
                        "caption",
                        'text-anchor="middle" style="font-size:10px"',
                    ),
                );
            } else {
                bits.push(icon(item.body, x + 62, cy + 12, 50));
                bits.push(
                    `<rect x="${x + 53}" y="${cy + 100}" width="32" height="32" rx="8" fill="#fafbfd" stroke="#e6eaf0"/>`,
                );
                bits.push(icon(item.body, x + 56, cy + 103, 26));
                bits.push(
                    text(
                        x + 91,
                        cy + 121,
                        "26 px",
                        "caption",
                        'style="font-size:10px"',
                    ),
                );
            }
            bits.push(wrapLabel(item.label, x + 87, cy + (compare ? 113 : 78)));
        });
        y = top + Math.ceil(g.items.length / 6) * 154 + 38;
    }
    const height = y + 58;
    const title = compare ? "Avant / proposition" : "Les outils, redessinés";
    const desc = compare
        ? "Même taille, même fond : le dessin actuel à gauche, la proposition à droite."
        : "54 pictogrammes de construction · étude vectorielle 01";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}" role="img" aria-labelledby="title desc">
<title id="title">DocGeo — ${title}</title><desc id="desc">${desc}</desc>
<style>${styles}</style><rect width="1200" height="${height}" fill="#f5f7fa"/>
<rect width="1200" height="185" fill="#fff"/>
${text(44, 40, "DOCGEO   /   RECHERCHE ICONOGRAPHIQUE", "caption", 'style="font-size:11px;letter-spacing:2px;font-weight:600"')}
${text(44, 91, title, "title")}${text(44, 121, desc, "caption", 'style="font-size:15px"')}
<circle cx="50" cy="155" r="3" fill="${ink}"/>${text(61, 159, "Objets de départ", "caption", 'style="font-size:11px"')}
<circle cx="196" cy="155" r="3" fill="${guide}"/>${text(207, 159, "Repères de construction", "caption", 'style="font-size:11px"')}
<circle cx="382" cy="155" r="3" fill="${red}"/>${text(393, 159, "Résultat", "caption", 'style="font-size:11px"')}
${text(1150, 159, compare ? "54 COMPARAISONS" : "AGRANDI + TAILLE RÉELLE", "caption", 'text-anchor="end" style="font-size:10px;letter-spacing:1px"')}
${bits.join("\n")}
<path d="M44 ${y - 1}h1104" stroke="#dce3eb"/>
${text(44, y + 27, "DocGeo · Proposition graphique · 29 octobre 2026", "caption", 'style="font-size:11px"')}
${text(1148, y + 27, "SVG · tracés éditables · aucune modification de l’éditeur", "caption", 'text-anchor="end" style="font-size:11px"')}
</svg>`;
    return { svg, height };
}

mkdirSync(new URL("svg/", out), { recursive: true });
const data = groups.flatMap((g) =>
    g.items.map((item) => ({ ...item, family: g.name })),
);
writeFileSync(
    new URL("icons.json", out),
    JSON.stringify(
        data.map(({ original, ...item }) => item),
        null,
        2,
    ) + "\n",
);
for (const item of data) {
    const name = item.key
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "-")
        .replace(/-$/u, "");
    writeFileSync(
        new URL(`svg/${name}.svg`, out),
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" class="new"><title>${esc(item.label)}</title><style>${styles}</style>${item.body}</svg>\n`,
    );
}
const browser = await chromium.launch();
for (const [file, compare] of [
    ["planche-contact", false],
    ["comparatif", true],
]) {
    const { svg, height } = sheet(compare);
    const url = new URL(`${file}.svg`, out);
    writeFileSync(url, svg);
    const page = await browser.newPage({
        viewport: { width: 1200, height: Math.min(height, 1600) },
        deviceScaleFactor: 2,
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setContent(
        `<html lang="fr"><head><meta charset="utf-8"/><title>DocGeo — étude des icônes</title><style>body{margin:0}body>svg{display:block}</style></head><body>${svg}</body></html>`,
    );
    await page.screenshot({
        path: new URL(`${file}.png`, out).pathname,
        fullPage: true,
    });
    const metrics = await page.evaluate(() => ({
        errors: document.querySelectorAll("parsererror").length,
        icons: document.querySelectorAll("svg svg").length,
    }));
    if (metrics.errors || errors.length)
        throw new Error(JSON.stringify({ metrics, errors }));
    console.log(
        `${file}: 1200 × ${height}, ${metrics.icons} icon views, SVG + PNG`,
    );
    await page.close();
}
await browser.close();
