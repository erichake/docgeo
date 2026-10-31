// Drawn for the supplied library, baked into its .dgo images at build time.
const ink = "#202d40";
const blue = "#3574e8";
const red = "#e3473c";
const guide = "#7d8795";
const n = (value) => +value.toFixed(3);
const p = (d, color = ink, width = 1.25, extra = "") =>
    `<path d="${d}" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const circle = (x, y, r, color = ink, width = 1.25, extra = "") =>
    `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const ellipse = (x, y, rx, ry, color = ink, extra = "") =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" stroke="${color}" stroke-width="1.25" ${extra}/>`;
const dot = ([x, y], color = blue, r = 1.9) =>
    circle(x, y, r, ink, 0.95, `fill="${color}"`);
const dots = (...points) => points.map((point) => dot(point)).join("");
const line = (a, b, color = ink, width = 1.25) =>
    p(`M${a.map(n)} ${b.map(n)}`, color, width);
const dash = (a, b, color = guide) =>
    p(`M${a.map(n)} ${b.map(n)}`, color, 0.85, 'stroke-dasharray="1.6 2"');
const polygon = (points, color = red, opacity = 0.12) =>
    p(
        `M${points.map((point) => point.map(n).join(" ")).join("L")}Z`,
        color,
        1.3,
        `fill="${color}" fill-opacity="${opacity}"`,
    );
const text = (x, y, value, size = 10, color = red) =>
    `<text x="${x}" y="${y}" fill="${color}" stroke="none" font-family="Georgia,serif" font-style="italic" font-size="${size}">${value}</text>`;
const arrow = (a, b, color = red) => {
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const arm = (sign) =>
        b.map((v, i) =>
            n(v - 3.4 * [Math.cos, Math.sin][i](angle + sign * 0.5)),
        );
    return line(a, b, color, 1.4) + p(`M${arm(1)} ${b} ${arm(-1)}`, color, 1.4);
};
const midpoint = (a, b) => a.map((v, i) => (v + b[i]) / 2);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const intersection = (a, b, c, d) => {
    const u = b.map((x, i) => x - a[i]),
        v = d.map((x, i) => x - c[i]);
    const t =
        ((c[0] - a[0]) * v[1] - (c[1] - a[1]) * v[0]) /
        (u[0] * v[1] - u[1] * v[0]);
    return a.map((x, i) => x + t * u[i]);
};
const circumcenter = (a, b, c) => {
    const ab = midpoint(a, b),
        ac = midpoint(a, c);
    return intersection(ab, [ab[0] + b[1] - a[1], ab[1] + a[0] - b[0]], ac, [
        ac[0] + c[1] - a[1],
        ac[1] + a[0] - c[0],
    ]);
};
const A = [5, 25],
    B = [27, 25],
    C = [12, 5];
const triangle = polygon([A, B, C], ink, 0.025);
const vertices = dots(A, B, C);
const a = distance(B, C),
    b = distance(C, A),
    c = distance(A, B);
const I = A.map((v, i) => (a * v + b * B[i] + c * C[i]) / (a + b + c));
const O = [16, 17.625];
const H = [12, 19.75];
const N = midpoint(O, H);
const R = distance(O, A);
const center = (point, extra = "") =>
    triangle + extra + vertices + dot(point, red, 2.1);
const ticks = (points) =>
    points
        .map(([a, b]) => {
            const m = midpoint(a, b),
                length = distance(a, b);
            const d = [
                ((b[1] - a[1]) * 1.7) / length,
                ((a[0] - b[0]) * 1.7) / length,
            ];
            return line(
                m.map((v, i) => v - d[i]),
                m.map((v, i) => v + d[i]),
                ink,
                0.9,
            );
        })
        .join("");
const shape = (points, given, marks = "") =>
    polygon(points) +
    marks +
    points
        .map((point, i) => dot(point, given.includes(i) ? blue : red))
        .join("");
const oval = ellipse(16, 16, 11, 7.5);
const hyperbola = (color = ink, b = 6) =>
    [-1, 1]
        .map((sign) =>
            p(
                "M" +
                    Array.from({ length: 33 }, (_, i) => {
                        const t = -1.4 + (i * 2.8) / 32;
                        return [
                            16 + sign * 4 * Math.cosh(t),
                            16 + b * Math.sinh(t),
                        ]
                            .map(n)
                            .join(" ");
                    }).join("L"),
                color,
                1.4,
            ),
        )
        .join("");
const disk = circle(
    16,
    16,
    13,
    guide,
    0.95,
    `fill="${blue}" fill-opacity=".04"`,
);
const hIcon = (drawing) => disk + drawing;
// Geodesics meet the boundary orthogonally. The minor arc joins two points
// of the closed disk; a diameter is the limiting straight line.
const geodesic = (a, b, color = red, width = 1.5) => {
    const [x, y] = a.map((v) => v - 16),
        [u, v] = b.map((v) => v - 16);
    const det = x * v - y * u;
    if (Math.abs(det) < 1e-8) return line(a, b, color, width);
    const q = (x * x + y * y + 169) / 2,
        s = (u * u + v * v + 169) / 2;
    const cx = (q * v - s * y) / det,
        cy = (x * s - u * q) / det;
    const r = Math.sqrt(cx * cx + cy * cy - 169);
    const sweep = (x - cx) * (v - cy) - (y - cy) * (u - cx) > 0 ? 1 : 0;
    return p(
        `M${a.map(n)}A${n(r)} ${n(r)} 0 0 ${sweep} ${b.map(n)}`,
        color,
        width,
    );
};
const ha = [11, 34 - Math.sqrt(130)],
    hb = [21, 34 - Math.sqrt(130)];
const hy = 16 + 169 / 18,
    hx = Math.sqrt(169 - (169 / 18) ** 2);
const hleft = [16 - hx, hy],
    hright = [16 + hx, hy];
const hm = [16, 34 - Math.sqrt(155)];
const hbase = (color = ink) => geodesic(hleft, hright, color);
const hCenter = (y, r) => [
    16,
    16 +
        13 *
            Math.tanh(
                (Math.atanh((y - r - 16) / 13) +
                    Math.atanh((y + r - 16) / 13)) /
                    2,
            ),
];
const quad = [
    [5, 12],
    [22, 6],
    [27, 22],
    [10, 28],
];

const drawings = {
    IsoscelesTriangle: shape(
        [
            [5, 26],
            [27, 26],
            [16, 5],
        ],
        [0, 1],
        ticks([
            [
                [5, 26],
                [16, 5],
            ],
            [
                [27, 26],
                [16, 5],
            ],
        ]),
    ),
    RightTriangle: shape(
        [
            [5, 26],
            [28, 26],
            [5, 5],
        ],
        [0, 1],
        p("M5 21h5v5", ink, 0.9),
    ),
    RightIsoscelesTriangle: shape(
        [
            [6, 26],
            [26, 26],
            [6, 6],
        ],
        [0, 1],
        p("M6 21h5v5", ink, 0.9) +
            ticks([
                [
                    [6, 26],
                    [26, 26],
                ],
                [
                    [6, 26],
                    [6, 6],
                ],
            ]),
    ),
    EquilateralTriangle: shape(
        [
            [4, 26],
            [28, 26],
            [16, 5.215],
        ],
        [0, 1],
        ticks([
            [
                [4, 26],
                [28, 26],
            ],
            [
                [28, 26],
                [16, 5.215],
            ],
            [
                [16, 5.215],
                [4, 26],
            ],
        ]),
    ),
    Incircle: center(I, circle(...I, 25 - I[1], red, 1.5)),
    Excircles: (() => {
        const altitude = (7 * Math.sqrt(3)) / 2;
        const points = [
            [12.5, 17],
            [19.5, 17],
            [16, 17 - altitude],
        ];
        return (
            polygon(points, ink, 0.025) +
            circle(16, 17 + altitude, altitude, red, 1.2) +
            circle(9, 17 - altitude, altitude, red, 1.2) +
            circle(23, 17 - altitude, altitude, red, 1.2) +
            points.map((P) => dot(P, blue, 1.4)).join("")
        );
    })(),
    NinePointCircle: center(
        N,
        circle(...N, R / 2, red, 1.5) +
            [midpoint(A, B), midpoint(B, C), midpoint(C, A)]
                .map((at) => dot(at, red, 1.35))
                .join(""),
    ),
    EulerLine: center(
        O,
        line([3, 24.53125], [29, 10.71875], red, 1.55) +
            dot(H, red, 1.65) +
            dot([44 / 3, 55 / 3], red, 1.65),
    ),
    FermatPoint: (() => {
        let F = [14, 18];
        for (let i = 0; i < 40; i++) {
            const weights = [A, B, C].map((P) => 1 / distance(P, F));
            F = F.map(
                (_, j) =>
                    [A, B, C].reduce(
                        (sum, P, k) => sum + P[j] * weights[k],
                        0,
                    ) / weights.reduce((sum, w) => sum + w, 0),
            );
        }
        return center(F, [A, B, C].map((P) => line(P, F, guide, 0.9)).join(""));
    })(),
    SimsonLine:
        circle(16, 16, 12, guide, 0.9) +
        polygon(
            [
                [6.4, 23.2],
                [25.6, 23.2],
                [16, 4],
            ],
            ink,
            0.025,
        ) +
        line([8, 3.2], [30, 25.2], red, 1.5) +
        dash([28, 16], [28, 23.2]) +
        dots([6.4, 23.2], [25.6, 23.2], [16, 4]) +
        dot([28, 16], red) +
        [
            [13.6, 8.8],
            [23.2, 18.4],
            [28, 23.2],
        ]
            .map((P) => dot(P, red, 1.25))
            .join(""),
    IsogonalConjugate: (() => {
        const weights = [(a * a) / 0.55, (b * b) / 0.25, (c * c) / 0.2];
        const Q = A.map(
            (_, i) =>
                [A, B, C].reduce((sum, P, j) => sum + P[i] * weights[j], 0) /
                weights.reduce((sum, w) => sum + w, 0),
        );
        const P = [11.9, 21];
        return center(
            Q,
            line(A, P, guide, 0.9) +
                line(C, P, guide, 0.9) +
                line(A, Q, red, 1) +
                line(C, Q, red, 1) +
                dot(P),
        );
    })(),
    Symmedians: (() => {
        const K = A.map(
            (v, i) =>
                (a * a * v + b * b * B[i] + c * c * C[i]) /
                (a * a + b * b + c * c),
        );
        const end = (P, Q, u, v) =>
            P.map((x, i) => (u * x + v * Q[i]) / (u + v));
        return center(
            K,
            line(A, end(B, C, b * b, c * c), red, 1) +
                line(B, end(A, C, a * a, c * c), red, 1) +
                line(C, end(A, B, a * a, b * b), red, 1),
        );
    })(),
    Parallelogram: shape(
        [
            [4, 25],
            [23, 25],
            [28, 7],
            [9, 7],
        ],
        [0, 1, 2],
    ),
    Trapezoid: shape(
        [
            [4, 25],
            [28, 25],
            [23, 8],
            [10, 8],
        ],
        [0, 1, 2],
        p("m15 23 2 2-2 2m0-21 2 2-2 2", ink, 0.9),
    ),
    Kite: shape(
        [
            [16, 4],
            [27, 14],
            [16, 28],
            [5, 14],
        ],
        [0, 1, 2],
        dash([16, 4], [16, 28]),
    ),
    Rhombus: shape(
        [
            [3, 16],
            [16, 26],
            [29, 16],
            [16, 6],
        ],
        [0, 1],
        ticks([
            [
                [3, 16],
                [16, 26],
            ],
            [
                [16, 26],
                [29, 16],
            ],
            [
                [29, 16],
                [16, 6],
            ],
            [
                [16, 6],
                [3, 16],
            ],
        ]),
    ),
    Rectangle: shape(
        [
            [4, 24],
            [28, 24],
            [28, 8],
            [4, 8],
        ],
        [0, 1],
        p("M4 19h5v5", ink, 0.9),
    ),
    Square: shape(
        [
            [6, 26],
            [26, 26],
            [26, 6],
            [6, 6],
        ],
        [0, 1],
        p("M6 21h5v5", ink, 0.9) +
            ticks([
                [
                    [6, 26],
                    [26, 26],
                ],
                [
                    [26, 26],
                    [26, 6],
                ],
            ]),
    ),
    RadicalAxis:
        circle(12, 16, 10) +
        circle(23, 16, 7) +
        line([19.318, 2], [19.318, 30], red, 1.6),
    RadicalCenter:
        circle(10, 12, 6) +
        circle(22, 12, 6) +
        circle(16, 22, 6) +
        p("M16 3v26M3 7.4 29 23M3 23 29 7.4", guide, 0.8) +
        dot([16, 15.2], red, 2.2),
    HomothetyCenters:
        circle(10, 16, 5) +
        circle(20, 16, 2) +
        p("M3 8.557 26.667 16 3 23.443", guide, 0.8) +
        line([3, 16], [30, 16], guide, 0.85) +
        dot([26.667, 16], red) +
        dot([17.143, 16], red),
    CommonTangents:
        circle(9, 16, 6) +
        circle(24, 16, 4) +
        p(
            "M3 9.138 29 12.636M3 22.862 29 19.364M3 29.417 29 6.161M3 2.583 29 25.839",
            red,
            1.15,
        ),
    OrthogonalCircle:
        circle(9, 19, 5) +
        circle(23, 19, 5) +
        circle(16, 13, Math.sqrt(60), red, 1.5) +
        dot([16, 13 + Math.sqrt(60)]),
    LimitPoints:
        circle(9, 16, 5) +
        circle(24, 16, 3) +
        line([2, 16], [30, 16], guide, 0.8) +
        [1, -1]
            .map((sign) =>
                dot(
                    [
                        9 +
                            (241 / 15 +
                                sign * Math.sqrt((241 / 15) ** 2 - 100)) /
                                2,
                        16,
                    ],
                    red,
                ),
            )
            .join(""),
    ApolloniusCircle:
        circle(18, 16, 10, red, 1.5) +
        line([2, 16], [29, 16], guide, 0.8) +
        dots([3, 16], [11.333, 16]) +
        text(22, 9, "k", 9),
    TangentCirclesTwoPoints:
        circle(16, 8, 4) +
        circle(16, 421 / 22, 421 / 22 - 12, red, 1.4) +
        circle(16, 549 / 38, 549 / 38 - 4, red, 1.1) +
        dots([10, 23], [22, 23]),
    TangentCirclesOnePoint:
        circle(7, 10, 4) +
        circle(25, 10, 4) +
        circle(16, 19, Math.sqrt(162) - 4, red, 1.5) +
        dot([16, 19 + Math.sqrt(162) - 4]),
    QuadrilateralEulerCenter: (() => {
        const [A, B, C, D] = quad;
        const P = midpoint(A, B);
        const O = circumcenter(P, midpoint(B, C), midpoint(C, A));
        const Q = circumcenter(P, midpoint(B, D), midpoint(D, A));
        const delta = Q.map((v, i) => v - O[i]);
        const t =
            delta.reduce((sum, v, i) => sum + v * (P[i] - O[i]), 0) /
            distance(O, Q) ** 2;
        const E = O.map((v, i) => 2 * (v + t * delta[i]) - P[i]);
        return (
            polygon(quad, ink, 0.025) +
            circle(...O, distance(O, P), guide, 0.9) +
            circle(...Q, distance(Q, P), guide, 0.9) +
            dots(...quad) +
            dot(E, red, 2.2)
        );
    })(),
    TangentCirclesThreeCircles:
        circle(8, 10, 4) +
        circle(24, 10, 4) +
        circle(16, 10 + 8 * Math.sqrt(3), 4) +
        circle(16, 10 + 8 / Math.sqrt(3), 16 / Math.sqrt(3) - 4, red, 1.6),
    AffineMap:
        polygon(
            [
                [3, 26],
                [12, 26],
                [5, 16],
            ],
            blue,
        ) +
        polygon([
            [19, 17],
            [29, 12],
            [20, 4],
        ]) +
        arrow([9, 12], [17, 8]) +
        dot([6, 23]) +
        dot([21.967, 11.767], red),
    SimilarityCenter:
        line([7, 23], [13, 21], blue, 1.5) +
        line([21.954, 14.973], [22.749, 8.065], blue, 1.5) +
        dash([7, 8], [7, 23]) +
        dash([7, 8], [21.954, 14.973]) +
        p("M7 17A9 9 0 0 0 15.157 11.804", red, 1.2) +
        dots([7, 23], [13, 21], [21.954, 14.973], [22.749, 8.065]) +
        dot([7, 8], red, 2.2),
    ConicFocusDirectrixEccentricity:
        line([3.333, 4], [3.333, 28]) +
        ellipse(20, 16, 10, 8, red) +
        dot([14, 16]) +
        text(24, 9, "e", 10),
    ConicFocusDirectrixPoint:
        line([6.75, 4], [6.75, 28]) +
        p("M25 4Q-7 16 25 28", red, 1.5) +
        dots([11.25, 16], [13, 22]),
    ConicFromCircleAndFocus:
        circle(16, 16, 12, guide, 1) +
        ellipse(19, 16, 6, Math.sqrt(27), red) +
        dot([22, 16]) +
        dot([13, 16], red, 1.5) +
        dot([25, 16], red, 1.5),
    ConicThreePointsTangent:
        ellipse(16, 16, 11, 8, red) +
        line([2, 24], [30, 24]) +
        dots([5, 16], [16, 8], [27, 16], [16, 24]),
    ConicPointTwoTangents:
        ellipse(16, 16, 10, 8, red) +
        p("M6 3v26M2 24h28") +
        dots([6, 16], [16, 24], [24, 11.2]),
    ParabolasFourPoints:
        p("M5.608 4Q16 40 26.392 4M28 5.608Q-8 16 28 26.392", red, 1.4) +
        dots([16, 22], [10, 16], [25.708, 6.292], [12.292, 19.708]),
    RectangularHyperbolaFourPoints:
        hyperbola(red, 4) +
        p("M3 3 29 29M3 29 29 3", guide, 0.8) +
        dots(
            [22.674, 21.343],
            [22.674, 10.657],
            [9.326, 21.343],
            [9.326, 10.657],
        ),
    ConicCenter:
        oval +
        dash([3, 16], [29, 16]) +
        dash([16, 5], [16, 27]) +
        dot([16, 16], red, 2.3),
    ConicAxes: oval + p("M2 16h28M16 3v26", red, 1.5),
    FociDirectrices:
        ellipse(16, 16, 9, 6) +
        p("M3.925 3v26M28.075 3v26", red, 1.4) +
        dot([9.292, 16], red) +
        dot([22.708, 16], red),
    Asymptotes:
        hyperbola() + p("M7.333 3 24.667 29M7.333 29 24.667 3", red, 1.3),
    AuxiliaryCircle:
        ellipse(16, 16, 12, 7) +
        circle(16, 16, 12, red, 1.5) +
        dash([4, 16], [28, 16]),
    DirectorCircle:
        ellipse(16, 16, 9, 6) +
        circle(16, 16, Math.sqrt(117), red, 1.5) +
        p("M2 10h23v20M21 10v4h4", guide, 0.8),
    ConjugateDiameters:
        oval +
        line([6.474, 12.25], [25.526, 19.75], red, 1.45) +
        line([10.5, 22.495], [21.5, 9.505], red, 1.45) +
        dot([25.526, 19.75]),
    Polar:
        ellipse(14, 16, 9, 8) +
        line([19.4, 3], [19.4, 29], red, 1.5) +
        dash([14, 16], [29, 16]) +
        dot([29, 16]),
    Pole:
        ellipse(14, 16, 9, 8) +
        line([19.4, 3], [19.4, 29]) +
        dash([14, 16], [29, 16]) +
        dot([29, 16], red, 2),
    QuadraticForm:
        ellipse(11, 17, 8, 6) +
        dot([9, 14]) +
        text(20, 23, "q", 16) +
        text(27, 11, "x", 8, blue),
    PolarForm:
        ellipse(11, 17, 8, 6) + dots([8, 13], [16, 19]) + text(21, 23, "f", 16),
    LevelConic:
        ellipse(16, 16, 6, 4) + ellipse(16, 16, 12, 8, red) + dot([25.6, 11.2]),
    HarmonicConjugate:
        line([2, 19], [30, 19]) +
        dots([4, 19], [16, 19], [12, 19]) +
        dot([28, 19], red) +
        text(8, 12, "−1", 10),
    HarmonicHomology:
        line([3, 22], [29, 22]) +
        dash([8, 5], [25, 27]) +
        dots([8, 5], [25, 27]) +
        dot([18.704, 18.852], red, 2) +
        text(19, 10, "−1", 9),
    CrossRatio:
        line([2, 20], [30, 20]) +
        dots([4, 20], [12, 20], [20, 20], [28, 20]) +
        text(13, 12, "r", 13),
    Homography:
        p("M2 11h28M2 25h28") +
        p("M7 11 4 25M16 11 15 25M25 11 26 25", guide, 0.8) +
        dots([7, 11], [16, 11], [25, 11], [4, 25], [15, 25], [26, 25]) +
        dot([21, 11]) +
        dot([21.111, 25], red) +
        arrow([9, 4], [23, 4]),
    PascalLine: (() => {
        const P = [0.3524, 5.8512, 2.8172, 3.6319, 4.9604, 1.4997].map((t) => [
            16 + 11 * Math.cos(t),
            14 + 8 * Math.sin(t),
        ]);
        const X = intersection(P[0], P[1], P[3], P[4]);
        const Y = intersection(P[1], P[2], P[4], P[5]);
        const Z = intersection(P[2], P[3], P[5], P[0]);
        return (
            ellipse(16, 14, 11, 8) +
            polygon(P, guide, 0) +
            line(X, Z, red, 1.5) +
            dots(...P) +
            [X, Y, Z].map((P) => dot(P, red, 1.4)).join("")
        );
    })(),
    BrianchonPoint:
        circle(16, 16, (13 * Math.sqrt(3)) / 2) +
        polygon(
            [
                [16, 3],
                [27.258, 9.5],
                [27.258, 22.5],
                [16, 29],
                [4.742, 22.5],
                [4.742, 9.5],
            ],
            guide,
            0,
        ) +
        p("M16 3v26M27.258 9.5 4.742 22.5M4.742 9.5 27.258 22.5", guide, 0.85) +
        dot([16, 16], red, 2.2),
    DesarguesPerspective:
        polygon(
            [
                [9, 16],
                [14, 10],
                [18, 18],
            ],
            blue,
            0.08,
        ) +
        polygon(
            [
                [13.8, 23.2],
                [23.9, 12.7],
                [26.25, 24.05],
            ],
            blue,
            0.08,
        ) +
        dash([3, 7], [13.8, 23.2]) +
        dash([3, 7], [23.9, 12.7]) +
        dash([3, 7], [26.25, 24.05]) +
        dot([3, 7], red, 2),
    DivideSegment:
        line([4, 17], [28, 17], red, 1.5) +
        p("M10 13v8M16 13v8M22 13v8", ink, 1.1) +
        dots([4, 17], [28, 17]) +
        text(12, 9, "n", 10),
    GeometricMean:
        p("M3 24a13 13 0 0 1 26 0M3 24h26") +
        line([12, 24], [12, 24 - Math.sqrt(153)], red, 1.7) +
        p("M12 20h4v4", guide, 0.8) +
        dots([3, 24], [12, 24], [29, 24]),
    LineH: hIcon(hbase(red) + dots(ha, hb)),
    SegmentH: hIcon(hbase(guide) + geodesic(ha, hb) + dots(ha, hb)),
    RayH: hIcon(hbase(guide) + geodesic(ha, hright) + dots(ha, hb)),
    MidpointH: hIcon(hbase(ink) + dots(ha, hb) + dot(hm, red, 2.2)),
    PerpendicularBisectorH: hIcon(
        hbase(ink) + line([16, 3], [16, 29], red, 1.5) + dots(ha, hb),
    ),
    PerpendicularH: hIcon(
        hbase() +
            line([16, 3], [16, 29], red, 1.5) +
            p(`M16 ${n(hm[1] - 3)}h3v3`, guide, 0.8) +
            dot([16, 10]) +
            dot(hm, red, 1.6),
    ),
    AngleBisectorH: hIcon(
        geodesic([16, 23], [5.1, 9], ink) +
            geodesic([16, 23], [26.9, 9], ink) +
            line([16, 23], [16, 3], red, 1.5) +
            dots([16, 23], [5.1, 9], [26.9, 9]),
    ),
    ReflectH: hIcon(
        line([16, 3], [16, 29]) +
            geodesic([9, 17], [23, 17], guide, 0.9) +
            dot([9, 17]) +
            dot([23, 17], red),
    ),
    CircleH: hIcon(
        circle(16, 19.5, 6.5, red, 1.5) +
            dot(hCenter(19.5, 6.5)) +
            dot([22.5, 19.5]),
    ),
    CircumcircleH: hIcon(
        circle(16, 17, 8.5, red, 1.5) +
            dots([7.5, 17], [20.25, 9.639], [20.25, 24.361]) +
            dot(hCenter(17, 8.5), red, 1.6),
    ),
    DistanceH: hIcon(
        geodesic(ha, hb, guide) + dots(ha, hb) + text(12, 15, "d", 13),
    ),
    AngleH: hIcon(
        geodesic([16, 23], [5.1, 9], ink) +
            geodesic([16, 23], [26.9, 9], ink) +
            p("M11.3 18.6a6.4 6.4 0 0 1 9.4 0", red, 1.4) +
            dot([16, 23]) +
            text(12, 14, "α", 10),
    ),
    Horocycle: hIcon(circle(16, 11, 8, red, 1.5) + dots([16, 3], [22.928, 15])),
    Hypercycle: (() => {
        const r = Math.hypot(hx, 50 - hy);
        return hIcon(
            hbase() +
                p(
                    `M${hleft.map(n)}A${n(r)} ${n(r)} 0 0 1 ${hright.map(n)}`,
                    red,
                    1.5,
                ) +
                dot([16, 50 - r]),
        );
    })(),
    LimitingParallels: hIcon(
        hbase() +
            geodesic([16, 11], hleft) +
            geodesic([16, 11], hright) +
            dot([16, 11]),
    ),
    CommonPerpendicular: hIcon(
        hbase() +
            geodesic([hleft[0], 32 - hy], [hright[0], 32 - hy], ink) +
            line([16, 3], [16, 29], red, 1.5),
    ),
};

export const LIBRARY_ICONS = Object.fromEntries(
    Object.entries(drawings).map(([name, drawing]) => [
        name,
        "data:image/svg+xml;base64," +
            Buffer.from(
                `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none" stroke-linecap="round" stroke-linejoin="round">${drawing}</svg>`,
            ).toString("base64"),
    ]),
);
