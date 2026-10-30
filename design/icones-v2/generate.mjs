import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const out = new URL("./", import.meta.url);
const previous = JSON.parse(
    readFileSync(new URL("../icones-v1/icons.json", out), "utf8"),
);
const ink = "#202d40";
const blue = "#3574e8";
const red = "#e3473c";
const guide = "#7d8795";
const p = (d, color = ink, width = 1.25, extra = "") =>
    `<path d="${d}" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const circle = (x, y, r, color = ink, width = 1.25, extra = "") =>
    `<circle cx="${x}" cy="${y}" r="${r}" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const ellipse = (x, y, rx, ry, color = ink, extra = "") =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" stroke="${color}" stroke-width="1.25" ${extra}/>`;
const dot = (x, y, color = blue, r = 2.25) =>
    circle(x, y, r, ink, 1.05, `fill="${color}"`);
const dots = (...points) => points.map(([x, y]) => dot(x, y)).join("");
const fill = (d, color = red, opacity = 0.2, width = 1.25) =>
    p(d, color, width, `fill="${color}" fill-opacity="${opacity}"`);
const dash = (d, color = guide) =>
    p(d, color, 0.9, 'stroke-dasharray="1.7 2.1"');
const letter = (x, y, value, color = red, size = 10) =>
    `<text x="${x}" y="${y}" fill="${color}" stroke="none" font-family="Georgia,serif" font-size="${size}" font-style="italic">${value}</text>`;
const arrow = (x1, y1, x2, y2, color = red, width = 1.55, head = 4) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arm = (sign) => [
        x2 - head * Math.cos(angle + sign * 0.5),
        y2 - head * Math.sin(angle + sign * 0.5),
    ];
    const [ax, ay] = arm(1),
        [bx, by] = arm(-1);
    return p(
        `M${x1} ${y1}L${x2} ${y2}M${ax} ${ay}L${x2} ${y2}L${bx} ${by}`,
        color,
        width,
    );
};
const A = [6, 24],
    B = [26, 24],
    C = [12, 6];
const trianglePath = "M6 24H26L12 6Z";
const triangle = p(trianglePath, ink, 1.15);
const vertices = dots(A, B, C);
const triangleCenter = (x, y, lines = "", extra = "") =>
    fill(trianglePath, blue, 0.035, 1.15) +
    lines +
    extra +
    triangle +
    vertices +
    dot(x, y, red, 2.5);
const a = Math.hypot(B[0] - C[0], B[1] - C[1]);
const b = Math.hypot(A[0] - C[0], A[1] - C[1]);
const c = B[0] - A[0];
const perimeter = a + b + c;
const ix = (a * A[0] + b * B[0] + c * C[0]) / perimeter;
const iy = (a * A[1] + b * B[1] + c * C[1]) / perimeter;
const drawings = {};
const add = (key, body) => {
    drawings[key] = body;
};

add("Point", p("M2.5 23Q14-3 29.5 20", ink, 1.3) + dot(15, 9.25, red, 2.7));
add(
    "Intersection",
    p("M3 25 28 6M4 5 27 27", ink, 1.3) + dot(15.2087133, 15.7218845, red, 2.7),
);
add(
    "Midpoint",
    p("M4.5 22.5 27.5 9.5") +
        p("M9.266 17.509l1.968 3.482M20.766 11.009l1.968 3.482", guide, 0.9) +
        dots([4.5, 22.5], [27.5, 9.5]) +
        dot(16, 16, red, 2.6),
);
add("Center", circle(16, 16, 11.2) + dot(16, 16, red, 2.7));
add(
    "OtherIntersection",
    circle(16, 16, 10.3) +
        p("M1.5 16h29") +
        dot(5.7, 16) +
        dot(26.3, 16, red, 2.6),
);
add("Incenter", triangleCenter(ix, iy, "", circle(ix, iy, 24 - iy, red, 1.2)));
add(
    "Centroid",
    triangleCenter(
        44 / 3,
        18,
        p("M6 24 19 15M26 24 9 15M12 6 16 24", guide, 0.9),
    ),
);
add(
    "Circumcenter",
    circle(16, 52 / 3, Math.hypot(10, 20 / 3), guide, 1.05) +
        triangleCenter(16, 52 / 3),
);
add(
    "Orthocenter",
    triangleCenter(
        12,
        19.3333333,
        p("M12 6v18M6 24 18.46154 14.30769", guide, 0.95) +
            p("M12 20.8h3.2V24", guide, 0.8),
    ),
);

add(
    "Segment",
    p("M5.5 24.5 26.5 8.5", ink, 1.45) + dots([5.5, 24.5], [26.5, 8.5]),
);
add("Line", p("M2 28 30 7", ink, 1.45) + dots([8, 23.5], [24, 11.5]));
add("Ray", p("M5 25 30 6.25", ink, 1.45) + dots([5, 25], [21, 13]));
add("Vector", arrow(5, 25, 27, 7, ink, 1.55, 6) + dot(5, 25));

add(
    "Perpendicular",
    p("M2.5 24.17 29.5 14.83") +
        p("M10.5 3.61 19 28.17", red, 1.6) +
        p("M14.69 15.72 18.47 14.41 19.78 18.19", guide, 0.85) +
        dot(13, 10.8333),
);
add(
    "Parallel",
    p("M2.5 24 28.5 14.25") + p("M4 15 30 5.25", red, 1.6) + dot(17, 10.125),
);
add(
    "PerpendicularBisector",
    p("M6 23 26 13") +
        p("M9 4 22 30", red, 1.55) +
        p("M10.1 18.7l1.8 3.6M20.1 13.7l1.8 3.6", ink, 0.9) +
        dots([6, 23], [26, 13]),
);
add(
    "AngleBisector",
    fill("M4 26h10a10 10 0 0 0-5-8.66Z", red, 0.13, 0.8) +
        p("M4 26H29M4 26 16.5 4.35") +
        p("M4 26 27 12.72", red, 1.65) +
        dot(4, 26),
);
add(
    "Tangent",
    circle(14, 20, 8.2) +
        p("M2 11.8h28", red, 1.6) +
        dot(24, 11.8) +
        circle(14, 11.8, 1.6, red, 1, 'fill="#fff"'),
);

add(
    "Circle (centre and point)",
    circle(16, 16, 11.3) + dots([16, 16], [24.475, 8.525]),
);
add(
    "Circle (centre and radius)",
    circle(13, 18, 10.1) +
        p("M13 18 22.06 13.54", red, 1.2) +
        dot(13, 18) +
        letter(23, 10.5, "r", red, 11),
);
add(
    "Circumcircle",
    circle(16, 16, 11.2) +
        dots([5.021, 18.218], [18.218, 5.021], [24.96, 22.72]),
);
add(
    "Compass",
    p("M3.5 26h8.2", ink, 1.15) +
        circle(21.5, 12, 8.2) +
        p("M21.5 12 28.3 7.415", red, 1.1) +
        dots([3.5, 26], [11.7, 26], [21.5, 12]),
);
add(
    "Arc",
    p("M4.5 22A11.5 11.5 0 0 1 25.959 16.25", red, 1.7) +
        dots([4.5, 22], [16, 10.5], [25.959, 16.25]),
);
add(
    "Sector",
    fill("M6 26V5a21 21 0 0 1 21 21Z", red, 0.2, 1.4) +
        dots([6, 5], [20.849, 11.151], [27, 26]),
);
add(
    "CenterArc",
    dash("M5 26 18.5 2.617M5 26h23") +
        p("M28 26a23 23 0 0 0-11.5-19.919", red, 1.7) +
        dots([5, 26], [28, 26], [11, 15.608]),
);
add(
    "CenterSector",
    fill("M5 26h23a23 23 0 0 0-11.5-19.919Z", red, 0.2, 1.4) +
        dash("M16.5 6.081 18.5 2.617") +
        dots([5, 26], [28, 26], [11, 15.608]),
);
add(
    "Semicircle",
    fill("M4 22a12 12 0 0 1 24 0Z", red, 0.14, 1.3) +
        p("M4 22h24", ink, 1.25) +
        dots([4, 22], [28, 22]),
);
add(
    "Conic",
    ellipse(16, 16, 13, 8.5) +
        dots([3, 16], [9.5, 8.639], [22.5, 8.639], [29, 16], [16, 24.5]),
);
add(
    "Ellipse",
    ellipse(16, 16, 13, 8.5) +
        p("M6.165 16 22.5 8.639 25.835 16", guide, 0.85) +
        dots([6.165, 16], [25.835, 16], [22.5, 8.639]),
);
const h = 4.5,
    v = 6;
const hyperbola = (sign) =>
    Array.from({ length: 33 }, (_, i) => {
        const t = -1.4 + (i * 2.8) / 32;
        return `${i ? "L" : "M"}${16 + sign * h * Math.cosh(t)} ${16 + v * Math.sinh(t)}`;
    }).join(" ");
add(
    "Hyperbola",
    p(hyperbola(-1) + hyperbola(1), ink, 1.4) +
        dots(
            [8.5, 16],
            [23.5, 16],
            [16 + h * Math.cosh(0.8), 16 + v * Math.sinh(0.8)],
        ),
);
add(
    "Parabola",
    p("M2.5 7h27") +
        p("M3 24.0833Q16-4.0833 29 24.0833", red, 1.5) +
        dash("M16 7v6") +
        dot(16, 13),
);
add(
    "Sphere",
    circle(16, 16, 11.7, ink, 1.25, `fill="${blue}" fill-opacity=".12"`) +
        ellipse(16, 16, 4.4, 11.7, blue, 'opacity=".6"') +
        p("M4.3 16a11.7 4.3 0 0 0 23.4 0", ink, 1.05) +
        p(
            "M4.3 16a11.7 4.3 0 0 1 23.4 0",
            guide,
            0.85,
            'stroke-dasharray="1.5 1.8"',
        ) +
        dot(16, 16, blue, 1.7),
);
add(
    "Circle (centre, direction and radius)",
    arrow(13, 21, 13, 2.5, ink, 1.2, 3.5) +
        ellipse(13, 22, 10.8, 5, red, `fill="${red}" fill-opacity=".12"`) +
        dot(13, 22) +
        letter(25, 15, "r", red, 10),
);
add(
    "Circle (axis and point)",
    dash("M16 2v28") +
        p("M16 2v10") +
        ellipse(16, 19, 12.5, 5.4, red, `fill="${red}" fill-opacity=".12"`) +
        dot(28.5, 19),
);

add(
    "Polygon",
    fill("M5 25 10 6 27 12 24 27Z", "#a75c25", 0.22, 1.3) +
        dots([5, 25], [10, 6], [27, 12], [24, 27]),
);
add(
    "Angle",
    fill("M6 25 9.161 14.464a11 11 0 0 1 7.567 8.098Z", red, 0.24, 1) +
        p("M12 5 6 25 28 20", ink, 1.35) +
        dots([12, 5], [6, 25], [28, 20]) +
        letter(21, 12, "α", red, 10),
);
add(
    "Locus",
    p("M3 23C7-2 25 4 29 22", red, 1.7) +
        p("M3 28h25", ink, 1.1) +
        dash("M20.8555 28V8.324625") +
        dots([20.8555, 28], [20.8555, 8.324625]),
);
add(
    "RegularPolygon",
    fill("M9 27h14l4.326-13.315L16 5.456 4.674 13.685Z", "#a75c25", 0.22, 1.3) +
        dots([9, 27], [23, 27]),
);

add(
    "Point reflection",
    dash("M7.7 18.7 24.3 13.3") +
        fill("M4 20 8 14 11 22Z", blue, 0.2, 1.1) +
        fill("M28 12 24 18 21 10Z", red, 0.22, 1.1) +
        dot(16, 16, blue, 2.1),
);
add(
    "Line reflection",
    dash("M6 18h20") +
        p("M16 2.5v27", ink, 1.5) +
        fill("M3 23 10 11 12 24Z", blue, 0.2, 1.1) +
        fill("M29 23 22 11 20 24Z", red, 0.22, 1.1),
);
add(
    "Rotation",
    fill("M6 25 8.975 16.824a8.7 8.7 0 0 1 5.682 7.31Z", red, 0.18, 0.85) +
        p("M12.875 6.113 6 25 26 23", guide, 1) +
        p("M19.93 23.607a14 14 0 0 0-9.142-11.763", red, 1.35) +
        p("m14.16 12.21-3.372-.366.353 3.3", red, 1.35) +
        dots([6, 25], [26, 23]) +
        dot(12.875, 6.113, red, 2.35) +
        letter(21, 12.5, "α", red, 9.5),
);
add(
    "Translation",
    dash("M4 23 18 11") +
        fill("M4 23 9 16 13 26Z", blue, 0.2, 1.1) +
        fill("M18 11 23 4 27 14Z", red, 0.22, 1.1) +
        arrow(4, 11, 16, 3, ink, 1.4, 4),
);
add(
    "Dilation",
    dash("M4 27 26 18.2M4 27 17 5.3333") +
        fill("M9 23 10 17 14 23Z", blue, 0.22, 1.1) +
        fill("M14 19 16 7 24 19Z", red, 0.22, 1.2) +
        dot(4, 27, blue, 2) +
        letter(22.5, 28, "k", red, 9),
);
add(
    "Inversion",
    circle(11, 16, 9) +
        dash("M11 16h18") +
        circle(11, 16, 0.7, ink, 0.8, `fill="${ink}"`) +
        dot(15.5, 16, blue, 2.1) +
        dot(29, 16, red, 2.1),
);

add(
    "Plane",
    fill("M2.5 24 10 7h19.5L22 24Z", blue, 0.18, 1.2) +
        dots([8, 20], [15, 11], [24, 18]),
);
add(
    "ParallelPlane",
    fill("m3 29 5-9h21l-5 9Z", ink, 0.075, 1.1) +
        fill("m3 13 5-9h21l-5 9Z", red, 0.2, 1.25) +
        dot(16, 8.5),
);
add(
    "OrthogonalPlane",
    dash("M16 3v26") +
        fill("M2.5 23 9.5 11h20L22.5 23Z", red, 0.19, 1.25) +
        p("M16 3v12", ink, 1.35) +
        p("M16 11h4v6", guide, 0.8) +
        dot(16, 17),
);

add(
    "Cylinder",
    fill("M6 8v16a10 4.2 0 0 0 20 0V8", blue, 0.18, 1.25) +
        ellipse(16, 8, 10, 4.2, ink, `fill="${blue}" fill-opacity=".28"`) +
        p("M6 24a10 4.2 0 0 1 20 0", guide, 0.85, 'stroke-dasharray="1.5 2"') +
        dots([16, 8], [16, 24]),
);
add(
    "Cone",
    fill("M4 25 16 3.5 28 25a12 4.4 0 0 1-24 0Z", blue, 0.2, 1.25) +
        p("M4 25a12 4.4 0 0 1 24 0", guide, 0.85, 'stroke-dasharray="1.5 2"') +
        dots([16, 3.5], [16, 25]),
);
add(
    "Cube",
    fill("m5 9 11-6 11 6-11 6Z", blue, 0.13, 1.15) +
        fill("M5 9v14l11 6V15Z", blue, 0.23, 1.15) +
        fill("M16 15v14l11-6V9Z", blue, 0.37, 1.15) +
        dots([5, 23], [16, 29], [27, 23]),
);
add(
    "Prism",
    fill("m4 10 11-6 13 5-11 6Z", blue, 0.13, 1.15) +
        fill("M4 10v15l13 5V15Z", blue, 0.23, 1.15) +
        fill("M17 15v15l11-6V9Z", blue, 0.37, 1.15) +
        dash("M4 25l11-6 13 5M15 19V4") +
        dot(4, 10),
);
add(
    "Pyramid",
    fill("M16 3 4 24l12 6Z", blue, 0.2, 1.15) +
        fill("M16 3v27l12-6Z", blue, 0.37, 1.15) +
        dash("M4 24 16 18 28 24M16 18V3") +
        dot(16, 3),
);
add(
    "Section",
    p("M5 9v14l11 6 11-6V9L16 3ZM5 9l11 6 11-6M16 15v14", guide, 1) +
        fill("m5 16 11 6 11-6-11-6Z", red, 0.35, 1.3),
);
add(
    "Net",
    fill("M12 2h7v28h-7ZM5 9h21v7H5Z", blue, 0.18, 1.2) +
        p(
            "M12 9h7m-7 7h7m-7 7h7M12 9v7m7-7v7",
            ink,
            0.85,
            'stroke-dasharray="1.5 1.5"',
        ),
);

const missing = previous
    .filter(({ key }) => !drawings[key])
    .map(({ key }) => key);
if (missing.length || Object.keys(drawings).length !== 54)
    throw new Error(
        JSON.stringify({ missing, count: Object.keys(drawings).length }),
    );
const data = previous.map(({ body: old, ...item }) => ({
    ...item,
    body: drawings[item.key],
    old,
}));

const styles = `
.v2 { fill:none; stroke:${ink}; stroke-width:1.25; stroke-linecap:round; stroke-linejoin:round; }
.v1 { fill:none; stroke:#3d5067; stroke-width:1.35; stroke-linecap:round; stroke-linejoin:round; }
.v1 .ink { stroke:#3d5067; } .v1 .red { stroke:#cb4254; } .v1 .guide { stroke:#a5afbd; }
.ui { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
.heading { font-size:34px; font-weight:650; fill:#202d40; letter-spacing:-.8px; }
.label { font-size:12px; fill:#46556a; }
.caption { font-size:12px; fill:#728096; }
.family { font-size:19px; font-weight:600; fill:#202d40; }
`;
const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const text = (x, y, value, cls = "label", extra = "") =>
    `<text x="${x}" y="${y}" class="ui ${cls}" ${extra}>${esc(value)}</text>`;
const icon = (item, x, y, size, old = false) =>
    `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 ${old ? 24 : 32} ${old ? 24 : 32}" class="${old ? "v1" : "v2"}">${old ? item.old : item.body}</svg>`;
const wrapLabel = (label, x, y, max = 25) => {
    const lines = [""];
    for (const word of label.split(" ")) {
        if ((lines.at(-1) + " " + word).trim().length > max) lines.push(word);
        else lines[lines.length - 1] = (lines.at(-1) + " " + word).trim();
    }
    return lines
        .map((line, i) =>
            text(x, y + 16 * i, line, "label", 'text-anchor="middle"'),
        )
        .join("");
};
const familyColors = [
    "#ae8850",
    "#6487bd",
    "#9472bd",
    "#58a083",
    "#4f9fb3",
    "#b86596",
    "#7f84b5",
    "#9472bd",
];
const grouped = [...new Set(data.map((item) => item.family))].map(
    (name, i) => ({
        name,
        color: familyColors[i],
        items: data.filter((item) => item.family === name),
    }),
);
const legend = () =>
    dot(51, 161, blue, 4) +
    text(64, 165, "Points donnés", "caption") +
    dot(207, 161, red, 4) +
    text(220, 165, "Point image / résultat", "caption") +
    p("M417 161h20", ink, 2) +
    text(446, 165, "Géométrie", "caption") +
    `<rect x="557" y="156" width="14" height="10" rx="2" fill="${red}" fill-opacity=".23" stroke="${red}"/>` +
    text(581, 165, "Surfaces et angles", "caption");

function document(title, subtitle, bits, height, width = 1200) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">DocGeo — ${esc(title)}</title><desc id="desc">${esc(subtitle)}</desc><style>${styles}</style>
<rect width="${width}" height="${height}" fill="#f4f6f9"/><rect width="${width}" height="193" fill="#fff"/>
${text(44, 39, "DOCGEO   /   PROPOSITION 02", "caption", 'style="font-size:11px;letter-spacing:2px;font-weight:600"')}
${text(44, 89, title, "heading")}${text(44, 121, subtitle, "caption", 'style="font-size:15px"')}
${legend()}${bits.join("\n")}
<path d="M44 ${height - 51}h${width - 88}" stroke="#d9e0e9"/>
${text(44, height - 23, "DocGeo · Recherche graphique · 29 octobre 2026", "caption", 'style="font-size:11px"')}
${text(width - 44, height - 23, "Points cerclés · contrastes francs · surfaces colorées", "caption", 'text-anchor="end" style="font-size:11px"')}
</svg>`;
}

function sheet(compare = false) {
    let y = 240;
    const bits = [];
    for (const group of grouped) {
        bits.push(
            `<rect x="44" y="${y - 17}" width="4" height="22" rx="2" fill="${group.color}"/>`,
        );
        bits.push(text(61, y, group.name, "family"));
        bits.push(
            text(
                1148,
                y,
                `${group.items.length} OUTILS`,
                "caption",
                'text-anchor="end" style="font-size:10px;letter-spacing:1px"',
            ),
        );
        const top = y + 23;
        group.items.forEach((item, i) => {
            const x = 44 + (i % 6) * 186;
            const cy = top + Math.floor(i / 6) * 168;
            bits.push(
                `<rect x="${x}" y="${cy}" width="174" height="154" rx="13" fill="#fff" stroke="#e0e6ee"/>`,
            );
            if (compare) {
                bits.push(
                    icon(item, x + 20, cy + 24, 48, true),
                    icon(item, x + 106, cy + 24, 48),
                );
                bits.push(
                    p(`M${x + 80} ${cy + 47}h12m-3-3 3 3-3 3`, "#a8b3c2", 1),
                );
                bits.push(
                    text(
                        x + 44,
                        cy + 92,
                        "V1",
                        "caption",
                        'text-anchor="middle" style="font-size:10px"',
                    ),
                    text(
                        x + 130,
                        cy + 92,
                        "V2",
                        "caption",
                        'text-anchor="middle" style="font-size:10px;fill:#26364b;font-weight:600"',
                    ),
                );
                bits.push(wrapLabel(item.label, x + 87, cy + 119));
            } else {
                bits.push(icon(item, x + 55, cy + 8, 64));
                bits.push(wrapLabel(item.label, x + 87, cy + 90));
                bits.push(
                    `<rect x="${x + 53}" y="${cy + 115}" width="32" height="32" rx="8" fill="#fff" stroke="#d8e0ea"/>`,
                );
                bits.push(
                    icon(item, x + 56, cy + 118, 26),
                    text(
                        x + 93,
                        cy + 136,
                        "26 px",
                        "caption",
                        'style="font-size:10px"',
                    ),
                );
            }
        });
        y = top + Math.ceil(group.items.length / 6) * 168 + 34;
    }
    const height = y + 66;
    return {
        svg: document(
            compare
                ? "V1 / V2 : le changement de dessin"
                : "Des outils plus expressifs",
            compare
                ? "54 comparaisons · première proposition à gauche, nouvelle proposition à droite."
                : "54 pictogrammes · agrandis et à 26 pixels, comme dans la palette.",
            bits,
            height,
        ),
        height,
    };
}

function focus() {
    const keys = [
        "Point",
        "Midpoint",
        "Segment",
        "Perpendicular",
        "Circle (centre and point)",
        "Arc",
        "Polygon",
        "Angle",
        "Line reflection",
        "Rotation",
        "Translation",
        "Cube",
    ];
    const bits = [];
    keys.forEach((key, i) => {
        const item = data.find((item) => item.key === key);
        const x = 44 + (i % 4) * 282,
            y = 224 + Math.floor(i / 4) * 215;
        bits.push(
            `<rect x="${x}" y="${y}" width="266" height="198" rx="14" fill="#fff" stroke="#dce3ed"/>`,
        );
        bits.push(
            icon(item, x + 37, y + 17, 68, true),
            icon(item, x + 161, y + 17, 68),
        );
        bits.push(
            text(
                x + 70,
                y + 104,
                "V1",
                "caption",
                'text-anchor="middle" style="font-size:11px"',
            ),
            text(
                x + 195,
                y + 104,
                "V2",
                "caption",
                'text-anchor="middle" style="font-size:11px;fill:#26364b;font-weight:600"',
            ),
        );
        bits.push(
            icon(item, x + 57, y + 120, 26, true),
            icon(item, x + 182, y + 120, 26),
        );
        bits.push(p(`M${x + 126} ${y + 53}h16m-4-4 4 4-4 4`, "#a8b3c2", 1.1));
        bits.push(wrapLabel(item.label, x + 133, y + 173, 31));
    });
    const height = 224 + 3 * 215 + 67;
    return {
        svg: document(
            "Un autre langage visuel",
            "12 outils représentatifs · aperçu agrandi et rendu à 26 pixels.",
            bits,
            height,
        ),
        height,
    };
}

function palette() {
    const excluded = [
        "Sphere",
        "Circle (centre, direction and radius)",
        "Circle (axis and point)",
    ];
    let y = 61;
    const bits = [
        text(16, 34, "Palette d’outils", "family", 'style="font-size:18px"'),
        p("M315 21l14 14m-14 0 14-14", ink, 1.5),
    ];
    for (const group of grouped.slice(0, 6)) {
        const items = group.items.filter(
            (item) => !excluded.includes(item.key),
        );
        bits.push(
            `<rect y="${y}" width="352" height="35" fill="${group.color}" fill-opacity=".12"/><rect y="${y}" width="3" height="35" fill="${group.color}"/>`,
        );
        bits.push(p(`M15 ${y + 14}l4 4 4-4`, "#52647b", 1.3));
        bits.push(
            text(
                32,
                y + 23,
                group.name.toUpperCase(),
                "label",
                'style="font-size:12px;font-weight:600"',
            ),
        );
        const top = y + 47;
        items.forEach((item, i) => {
            const x = 14 + (i % 6) * 55,
                cy = top + Math.floor(i / 6) * 55;
            bits.push(
                `<rect x="${x}" y="${cy}" width="45" height="45" rx="9" fill="#fff" stroke="${group.color}" stroke-opacity=".55"/>`,
            );
            bits.push(icon(item, x + 9.5, cy + 9.5, 26));
        });
        y = top + Math.ceil(items.length / 6) * 55 + 3;
    }
    const height = y + 8;
    return {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="352" height="${height}" viewBox="0 0 352 ${height}"><title>DocGeo — aperçu de la palette, proposition 02</title><style>${styles}</style><rect width="352" height="${height}" fill="#fff"/>${bits.join("\n")}</svg>`,
        height,
        width: 352,
    };
}

mkdirSync(new URL("svg/", out), { recursive: true });
writeFileSync(
    new URL("icons.json", out),
    JSON.stringify(
        data.map(({ old, ...item }) => item),
        null,
        4,
    ) + "\n",
);
for (const item of data) {
    const name = item.key
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "-")
        .replace(/-$/u, "");
    writeFileSync(
        new URL(`svg/${name}.svg`, out),
        `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" class="v2"><title>${esc(item.label)}</title><style>.v2{fill:none;stroke:${ink};stroke-linecap:round;stroke-linejoin:round}</style>${item.body}</svg>\n`,
    );
}
const pages = [
    ["planche-contact", sheet()],
    ["comparatif", sheet(true)],
    ["selection", focus()],
    ["palette", palette()],
];
const browser = await chromium.launch();
try {
    const check = await browser.newPage();
    const invalid = await check.evaluate(
        (data) =>
            data
                .filter((item) =>
                    new DOMParser()
                        .parseFromString(
                            `<svg xmlns="http://www.w3.org/2000/svg">${item.body}</svg>`,
                            "image/svg+xml",
                        )
                        .querySelector("parsererror"),
                )
                .map((item) => item.key),
        data,
    );
    await check.close();
    if (invalid.length) throw new Error("Invalid SVG: " + invalid.join(", "));
    for (const [file, { svg, height, width = 1200 }] of pages) {
        writeFileSync(new URL(`${file}.svg`, out), svg);
        const page = await browser.newPage({
            viewport: { width, height: Math.min(height, 1600) },
            deviceScaleFactor: 2,
        });
        await page.setContent(
            `<html lang="fr"><meta charset="utf-8"/><style>body{margin:0}body>svg{display:block}</style><body>${svg}</body></html>`,
        );
        await page.screenshot({
            path: new URL(`${file}.png`, out).pathname,
            fullPage: true,
        });
        const bounds = await page.evaluate(() =>
            [...document.querySelectorAll("svg.v2")]
                .flatMap((svg) =>
                    [...svg.children]
                        .filter((el) => el instanceof SVGGeometryElement)
                        .map((el) => {
                            const box = el.getBBox();
                            return {
                                left: box.x,
                                top: box.y,
                                right: box.x + box.width,
                                bottom: box.y + box.height,
                            };
                        }),
                )
                .filter(
                    (b) =>
                        b.left < 0 ||
                        b.top < 0 ||
                        b.right > 32 ||
                        b.bottom > 32,
                ),
        );
        if (bounds.length)
            throw new Error("Out-of-bounds artwork: " + JSON.stringify(bounds));
        console.log(`${file}: ${width} × ${height} (SVG + PNG)`);
        await page.close();
    }
} finally {
    await browser.close();
}
