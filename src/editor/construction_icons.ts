const ink = "var(--dge-icon-ink, #202d40)";
const blue = "var(--dge-icon-blue, #3574e8)";
const red = "var(--dge-icon-red, #e3473c)";
const guide = "var(--dge-icon-guide, #7d8795)";
const polygon = "var(--dge-icon-polygon, #a75c25)";
const p = (d: string, color = ink, width = 1.25, extra = "") =>
    `<path d="${d}" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const circle = (
    x: number,
    y: number,
    r: number,
    color = ink,
    width = 1.25,
    extra = "",
) =>
    `<circle cx="${x}" cy="${y}" r="${r}" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const ellipse = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    color = ink,
    extra = "",
) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" stroke="${color}" stroke-width="1.25" ${extra}/>`;
const dot = (x: number, y: number, color = blue, r = 2.25) =>
    circle(x, y, r, ink, 1.05, `fill="${color}"`);
const dots = (...points: [number, number][]) =>
    points.map(([x, y]) => dot(x, y)).join("");
const fill = (d: string, color = red, opacity = 0.2, width = 1.25) =>
    p(d, color, width, `fill="${color}" fill-opacity="${opacity}"`);
const dash = (d: string, color = guide) =>
    p(d, color, 0.9, 'stroke-dasharray="1.7 2.1"');
const letter = (x: number, y: number, value: string, color = red, size = 10) =>
    `<text x="${x}" y="${y}" fill="${color}" stroke="none" font-family="Georgia,serif" font-size="${size}" font-style="italic">${value}</text>`;
const arrow = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color = red,
    width = 1.55,
    head = 4,
) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arm = (sign: number) => [
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
const A: [number, number] = [6, 24],
    B: [number, number] = [26, 24],
    C: [number, number] = [12, 6];
const trianglePath = "M6 24H26L12 6Z";
const triangle = p(trianglePath, ink, 1.15);
const vertices = dots(A, B, C);
const triangleCenter = (x: number, y: number, lines = "", extra = "") =>
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
const h = 4.5,
    v = 6;
const hyperbola = (sign: number) =>
    Array.from({ length: 33 }, (_, i) => {
        const t = -1.4 + (i * 2.8) / 32;
        return `${i ? "L" : "M"}${16 + sign * h * Math.cosh(t)} ${16 + v * Math.sinh(t)}`;
    }).join(" ");

// The 32-unit drawings share the tools’ 24-unit viewport with action and macro icons.
const icon = (body: string) =>
    `<g class="dge-construction-icon" transform="scale(.75)">${body}</g>`;

export const CONSTRUCTION_ICONS = {
    Point: icon(dot(11, 21.5, red, 3) + letter(16, 16.5, "A", ink, 12)),
    PointOn: icon(
        p("M2.5 23Q14-3 29.5 20", ink, 1.3) + dot(15, 9.25, red, 2.7),
    ),
    Intersection: icon(
        p("M3 25 28 6M4 5 27 27", ink, 1.3) +
            dot(15.2087133, 15.7218845, red, 2.7),
    ),
    Midpoint: icon(
        p("M4.5 22.5 27.5 9.5") +
            p(
                "M9.266 17.509l1.968 3.482M20.766 11.009l1.968 3.482",
                guide,
                0.9,
            ) +
            dots([4.5, 22.5], [27.5, 9.5]) +
            dot(16, 16, red, 2.6),
    ),
    Center: icon(circle(16, 16, 11.2) + dot(16, 16, red, 2.7)),
    OtherIntersection: icon(
        circle(16, 16, 10.3) +
            p("M1.5 16h29") +
            dot(5.7, 16) +
            dot(26.3, 16, red, 2.6),
    ),
    Incenter: icon(
        triangleCenter(ix, iy, "", circle(ix, iy, 24 - iy, red, 1.2)),
    ),
    Centroid: icon(
        triangleCenter(
            44 / 3,
            18,
            p("M6 24 19 15M26 24 9 15M12 6 16 24", guide, 0.9),
        ),
    ),
    Circumcenter: icon(
        circle(16, 52 / 3, Math.hypot(10, 20 / 3), guide, 1.05) +
            triangleCenter(16, 52 / 3),
    ),
    Orthocenter: icon(
        triangleCenter(
            12,
            19.3333333,
            p("M12 6v18M6 24 18.46154 14.30769", guide, 0.95) +
                p("M12 20.8h3.2V24", guide, 0.8),
        ),
    ),
    Segment: icon(
        p("M5.5 24.5 26.5 8.5", ink, 1.45) + dots([5.5, 24.5], [26.5, 8.5]),
    ),
    Line: icon(p("M2 28 30 7", ink, 1.45) + dots([8, 23.5], [24, 11.5])),
    Ray: icon(p("M5 25 30 6.25", ink, 1.45) + dots([5, 25], [21, 13])),
    Vector: icon(arrow(5, 25, 27, 7, ink, 1.55, 6) + dot(5, 25)),
    Perpendicular: icon(
        p("M2.5 24.17 29.5 14.83") +
            p("M10.5 3.61 19 28.17", red, 1.6) +
            p("M14.69 15.72 18.47 14.41 19.78 18.19", guide, 0.85) +
            dot(13, 10.8333),
    ),
    Parallel: icon(
        p("M2.5 24 28.5 14.25") +
            p("M4 15 30 5.25", red, 1.6) +
            dot(17, 10.125),
    ),
    PerpendicularBisector: icon(
        p("M6 23 26 13") +
            p("M9 4 22 30", red, 1.55) +
            p("M10.1 18.7l1.8 3.6M20.1 13.7l1.8 3.6", ink, 0.9) +
            dots([6, 23], [26, 13]),
    ),
    AngleBisector: icon(
        fill("M4 26h10a10 10 0 0 0-5-8.66Z", red, 0.13, 0.8) +
            p("M4 26H29M4 26 16.5 4.35") +
            p("M4 26 27 12.72", red, 1.65) +
            dot(4, 26),
    ),
    Tangent: icon(
        circle(14, 20, 8.2) +
            p("M2 11.8h28", red, 1.6) +
            dot(24, 11.8) +
            circle(14, 11.8, 1.6, red, 1, 'fill="var(--dge-icon-bg, #fff)"'),
    ),
    CirclePoint: icon(circle(16, 16, 11.3) + dots([16, 16], [24.475, 8.525])),
    CircleRadius: icon(
        circle(13, 18, 10.1) +
            p("M13 18 22.06 13.54", red, 1.2) +
            dot(13, 18) +
            letter(23, 10.5, "r", red, 11),
    ),
    Circumcircle: icon(
        circle(16, 16, 11.2) +
            dots([5.021, 18.218], [18.218, 5.021], [24.96, 22.72]),
    ),
    Compass: icon(
        p("M3.5 26h8.2", ink, 1.15) +
            circle(21.5, 12, 8.2) +
            p("M21.5 12 28.3 7.415", red, 1.1) +
            dots([3.5, 26], [11.7, 26], [21.5, 12]),
    ),
    Arc: icon(
        p("M4.5 22A11.5 11.5 0 0 1 25.959 16.25", red, 1.7) +
            dots([4.5, 22], [16, 10.5], [25.959, 16.25]),
    ),
    Sector: icon(
        fill("M6 26V5a21 21 0 0 1 21 21Z", red, 0.2, 1.4) +
            dots([6, 5], [20.849, 11.151], [27, 26]),
    ),
    CenterArc: icon(
        dash("M5 26 18.5 2.617M5 26h23") +
            p("M28 26a23 23 0 0 0-11.5-19.919", red, 1.7) +
            dots([5, 26], [28, 26], [11, 15.608]),
    ),
    CenterSector: icon(
        fill("M5 26h23a23 23 0 0 0-11.5-19.919Z", red, 0.2, 1.4) +
            dash("M16.5 6.081 18.5 2.617") +
            dots([5, 26], [28, 26], [11, 15.608]),
    ),
    Semicircle: icon(
        fill("M4 22a12 12 0 0 1 24 0Z", red, 0.14, 1.3) +
            p("M4 22h24", ink, 1.25) +
            dots([4, 22], [28, 22]),
    ),
    Conic: icon(
        ellipse(16, 16, 13, 8.5) +
            dots([3, 16], [9.5, 8.639], [22.5, 8.639], [29, 16], [16, 24.5]),
    ),
    Ellipse: icon(
        ellipse(16, 16, 13, 8.5) +
            p("M6.165 16 22.5 8.639 25.835 16", guide, 0.85) +
            dots([6.165, 16], [25.835, 16], [22.5, 8.639]),
    ),
    Hyperbola: icon(
        p(hyperbola(-1) + hyperbola(1), ink, 1.4) +
            dots(
                [8.5, 16],
                [23.5, 16],
                [16 + h * Math.cosh(0.8), 16 + v * Math.sinh(0.8)],
            ),
    ),
    Parabola: icon(
        p("M2.5 7h27") +
            p("M3 24.0833Q16-4.0833 29 24.0833", red, 1.5) +
            dash("M16 7v6") +
            dot(16, 13),
    ),
    Sphere: icon(
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
    ),
    CircleDirection: icon(
        arrow(13, 21, 13, 2.5, ink, 1.2, 3.5) +
            ellipse(13, 22, 10.8, 5, red, `fill="${red}" fill-opacity=".12"`) +
            dot(13, 22) +
            letter(25, 15, "r", red, 10),
    ),
    CircleAxis: icon(
        dash("M16 2v28") +
            p("M16 2v10") +
            ellipse(
                16,
                19,
                12.5,
                5.4,
                red,
                `fill="${red}" fill-opacity=".12"`,
            ) +
            dot(28.5, 19),
    ),
    Polygon: icon(
        fill("M5 25 10 6 27 12 24 27Z", polygon, 0.22, 1.3) +
            dots([5, 25], [10, 6], [27, 12], [24, 27]),
    ),
    Angle: icon(
        fill("M6 25 9.161 14.464a11 11 0 0 1 7.567 8.098Z", red, 0.24, 1) +
            p("M12 5 6 25 28 20", ink, 1.35) +
            dots([12, 5], [6, 25], [28, 20]) +
            letter(21, 12, "α", red, 10),
    ),
    Locus: icon(
        p("M3 23C7-2 25 4 29 22", red, 1.7) +
            p("M3 28h25", ink, 1.1) +
            dash("M20.8555 28V8.324625") +
            dots([20.8555, 28], [20.8555, 8.324625]),
    ),
    RegularPolygon: icon(
        fill(
            "M9 27h14l4.326-13.315L16 5.456 4.674 13.685Z",
            polygon,
            0.22,
            1.3,
        ) + dots([9, 27], [23, 27]),
    ),
    ReflectPoint: icon(
        dash("M7.7 18.7 24.3 13.3") +
            fill("M4 20 8 14 11 22Z", blue, 0.2, 1.1) +
            fill("M28 12 24 18 21 10Z", red, 0.22, 1.1) +
            dot(16, 16, blue, 2.1),
    ),
    ReflectLine: icon(
        dash("M6 18h20") +
            p("M16 2.5v27", ink, 1.5) +
            fill("M3 23 10 11 12 24Z", blue, 0.2, 1.1) +
            fill("M29 23 22 11 20 24Z", red, 0.22, 1.1),
    ),
    Rotation: icon(
        fill("M6 25 8.975 16.824a8.7 8.7 0 0 1 5.682 7.31Z", red, 0.18, 0.85) +
            p("M12.875 6.113 6 25 26 23", guide, 1) +
            p("M19.93 23.607a14 14 0 0 0-9.142-11.763", red, 1.35) +
            p("m14.16 12.21-3.372-.366.353 3.3", red, 1.35) +
            dots([6, 25], [26, 23]) +
            dot(12.875, 6.113, red, 2.35) +
            letter(21, 12.5, "α", red, 9.5),
    ),
    Translation: icon(
        dash("M4 23 18 11") +
            fill("M4 23 9 16 13 26Z", blue, 0.2, 1.1) +
            fill("M18 11 23 4 27 14Z", red, 0.22, 1.1) +
            arrow(4, 11, 16, 3, ink, 1.4, 4),
    ),
    Dilation: icon(
        dash("M4 27 26 18.2M4 27 17 5.3333") +
            fill("M9 23 10 17 14 23Z", blue, 0.22, 1.1) +
            fill("M14 19 16 7 24 19Z", red, 0.22, 1.2) +
            dot(4, 27, blue, 2) +
            letter(22.5, 28, "k", red, 9),
    ),
    Inversion: icon(
        circle(11, 16, 9) +
            dash("M11 16h18") +
            circle(11, 16, 0.7, ink, 0.8, `fill="${ink}"`) +
            dot(15.5, 16, blue, 2.1) +
            dot(29, 16, red, 2.1),
    ),
    Plane: icon(
        fill("M2.5 24 10 7h19.5L22 24Z", blue, 0.18, 1.2) +
            dots([8, 20], [15, 11], [24, 18]),
    ),
    ParallelPlane: icon(
        fill("m3 29 5-9h21l-5 9Z", ink, 0.075, 1.1) +
            fill("m3 13 5-9h21l-5 9Z", red, 0.2, 1.25) +
            dot(16, 8.5),
    ),
    OrthogonalPlane: icon(
        dash("M16 3v26") +
            fill("M2.5 23 9.5 11h20L22.5 23Z", red, 0.19, 1.25) +
            p("M16 3v12", ink, 1.35) +
            p("M16 11h4v6", guide, 0.8) +
            dot(16, 17),
    ),
    Cylinder: icon(
        fill("M6 8v16a10 4.2 0 0 0 20 0V8", blue, 0.18, 1.25) +
            ellipse(16, 8, 10, 4.2, ink, `fill="${blue}" fill-opacity=".28"`) +
            p(
                "M6 24a10 4.2 0 0 1 20 0",
                guide,
                0.85,
                'stroke-dasharray="1.5 2"',
            ) +
            dots([16, 8], [16, 24]),
    ),
    Cone: icon(
        fill("M4 25 16 3.5 28 25a12 4.4 0 0 1-24 0Z", blue, 0.2, 1.25) +
            p(
                "M4 25a12 4.4 0 0 1 24 0",
                guide,
                0.85,
                'stroke-dasharray="1.5 2"',
            ) +
            dots([16, 3.5], [16, 25]),
    ),
    Cube: icon(
        fill("m5 9 11-6 11 6-11 6Z", blue, 0.13, 1.15) +
            fill("M5 9v14l11 6V15Z", blue, 0.23, 1.15) +
            fill("M16 15v14l11-6V9Z", blue, 0.37, 1.15) +
            dots([5, 23], [16, 29], [27, 23]),
    ),
    Tetrahedron: icon(
        fill("M16 3 4 23l15 6Z", blue, 0.2, 1.15) +
            fill("M16 3l3 26 9-9Z", blue, 0.37, 1.15) +
            dash("M4 23l24-3") +
            dots([4, 23], [19, 29], [28, 20]),
    ),
    Octahedron: icon(
        fill("M16 2 4 15l9 4Z", blue, 0.2, 1.15) +
            fill("M16 2l-3 17 15-5Z", blue, 0.37, 1.15) +
            fill("M4 15l9 4 3 11Z", blue, 0.13, 1.15) +
            fill("M13 19l15-5-12 16Z", blue, 0.28, 1.15) +
            dash("M4 15l15-5 9 4M16 2l3 8-3 20") +
            dots([4, 15], [13, 19], [16, 30]),
    ),
    Dodecahedron: icon(
        fill(
            "M16 2l8.2 2.7 5.1 7v8.6l-5.1 7L16 30l-8.2-2.7-5.1-7v-8.6l5.1-7Z",
            blue,
            0.18,
            1.15,
        ) +
            fill("M16 9.5l6.2 4.5-2.4 7.3h-7.6l-2.4-7.3Z", blue, 0.37, 1.15) +
            p(
                "M16 9.5V2M22.2 14l7.1-2.3M19.8 21.3l4.4 6M12.2 21.3l-4.4 6M9.8 14l-7.1-2.3",
                blue,
                1.15,
            ) +
            dots([12.2, 21.3], [19.8, 21.3], [22.2, 14]),
    ),
    Icosahedron: icon(
        fill("M16 2l12.1 7v14L16 30 3.9 23V9Z", blue, 0.18, 1.15) +
            fill("M16 23 9.9 12.5h12.2Z", blue, 0.37, 1.15) +
            p(
                "M3.9 23h24.2M16 23v7M3.9 23l6-10.5M3.9 9l6 3.5L16 2l6.1 10.5 6-3.5M22.1 12.5l6 10.5",
                blue,
                1.15,
            ) +
            dots([16, 23], [9.9, 12.5], [22.1, 12.5]),
    ),
    Prism: icon(
        fill("m4 10 11-6 13 5-11 6Z", blue, 0.13, 1.15) +
            fill("M4 10v15l13 5V15Z", blue, 0.23, 1.15) +
            fill("M17 15v15l11-6V9Z", blue, 0.37, 1.15) +
            dash("M4 25l11-6 13 5M15 19V4") +
            dot(4, 10),
    ),
    Pyramid: icon(
        fill("M16 3 4 24l12 6Z", blue, 0.2, 1.15) +
            fill("M16 3v27l12-6Z", blue, 0.37, 1.15) +
            dash("M4 24 16 18 28 24M16 18V3") +
            dot(16, 3),
    ),
    Section: icon(
        p("M5 9v14l11 6 11-6V9L16 3ZM5 9l11 6 11-6M16 15v14", guide, 1) +
            fill("m5 16 11 6 11-6-11-6Z", red, 0.35, 1.3),
    ),
    Net: icon(
        fill("M12 2h7v28h-7ZM5 9h21v7H5Z", blue, 0.18, 1.2) +
            p(
                "M12 9h7m-7 7h7m-7 7h7M12 9v7m7-7v7",
                ink,
                0.85,
                'stroke-dasharray="1.5 1.5"',
            ),
    ),
};
