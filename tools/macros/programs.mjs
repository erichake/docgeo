// Programs of formulas, written for the library's figures: a conic's
// equation a x² + b x y + c y² + d x + e y + f = 0 as the list
// K = [a, b, c, d, e, f], and what follows from it. DocGeo's formulas only
// give a conic's center (q.center()): its other elements come from five
// conditions on it.

// The row of a point P of the conic.
export const pointRow = (P) =>
    `[x(${P})^2, x(${P}) * y(${P}), y(${P})^2, x(${P}), y(${P}), 1]`;

// The row of the conic's tangency, at T, to the line through U and V.
export const tangentRow = (T, U, V) =>
    `[2 * x(${T}) * (x(${V}) - x(${U})), x(${T}) * (y(${V}) - y(${U})) + y(${T}) * (x(${V}) - x(${U})), 2 * y(${T}) * (y(${V}) - y(${U})), x(${V}) - x(${U}), y(${V}) - y(${U}), 0]`;

// The conic that meets these five conditions, its coefficients the
// cofactors of the 6 × 6 determinant, scaled to 1 at most.
export const conicThrough = (rows) =>
    [
        `var R = [${rows.join(", ")}]`,
        "var cof = [0, 0, 0, 0, 0, 0]",
        "for (var j = 0; j < 6; j++) { var M = [0, 0, 0, 0, 0]; for (var r = 0; r < 5; r++) { var w = [0, 0, 0, 0, 0]; var n = 0; for (var k = 0; k < 6; k++) { if (k != j) { w[n] = R[r][k]; n++; } } M[r] = w; } var det = 1; for (var col = 0; col < 5; col++) { var piv = col; for (var r1 = col + 1; r1 < 5; r1++) { if (abs(M[r1][col]) > abs(M[piv][col])) { piv = r1; } } if (piv != col) { var tmp = M[piv]; M[piv] = M[col]; M[col] = tmp; det = -det; } var p = M[col][col]; det = det * p; if (p != 0) { for (var r2 = col + 1; r2 < 5; r2++) { var g = M[r2][col] / p; for (var k2 = col; k2 < 5; k2++) { M[r2][k2] = M[r2][k2] - g * M[col][k2]; } } } } cof[j] = j % 2 == 0 ? det : -det; }",
        "var s = 0",
        "for (var j2 = 0; j2 < 6; j2++) { s = max(s, abs(cof[j2])); }",
        "[cof[0] / s, cof[1] / s, cof[2] / s, cof[3] / s, cof[4] / s, cof[5] / s]",
    ].join("; ");

// Its coefficients, named from the list K.
const coefficients = (K) =>
    `var a = ${K}[0]; var b = ${K}[1]; var c = ${K}[2]; var d = ${K}[3]; var e = ${K}[4]; var f = ${K}[5]`;

// Its axes, without angles, whose unit is the figure's: the unit
// eigenvector (c1, s1) of its quadratic part, for the eigenvalue l1, and
// (-s1, c1), for l2.
const AXES = [
    "var h = sqrt((a - c) * (a - c) / 4 + b * b / 4)",
    "var l1 = (a + c) / 2 + h",
    "var l2 = (a + c) / 2 - h",
    "var vx = l1 - c; var vy = b / 2; var wx = b / 2; var wy = l1 - a",
    "var big = vx * vx + vy * vy >= wx * wx + wy * wy",
    "var nx = big ? vx : wx; var ny = big ? vy : wy",
    "var nn = sqrt(nx * nx + ny * ny)",
    "var c1 = nn > 1e-12 ? nx / nn : 1",
    "var s1 = nn > 1e-12 ? ny / nn : 0",
].join("; ");

// Of a conic with a center: [x0, y0, ux, uy, p, q], its center, the unit
// direction u of its focal axis, and its equation in the frame of its axes,
// X² / p + Y² / q = 1, p > q (q < 0 for a hyperbola).
export const conicFrame = (K) =>
    [
        coefficients(K),
        "var det = 4 * a * c - b * b",
        "var x0 = (b * e - 2 * c * d) / det",
        "var y0 = (b * d - 2 * a * e) / det",
        "var F = a * x0 * x0 + b * x0 * y0 + c * y0 * y0 + d * x0 + e * y0 + f",
        AXES,
        "var p = -F / l1",
        "var q = -F / l2",
        "p >= q ? [x0, y0, c1, s1, p, q] : [x0, y0, -s1, c1, q, p]",
    ].join("; ");

// [F1, F2, D1, D2, w], each point as x and y: its foci, a point of each
// directrix, and their direction; the second focus and directrix
// undefined for a parabola.
export const conicFoci = (K) =>
    [
        coefficients(K),
        "var det = 4 * a * c - b * b",
        AXES,
        // A parabola: in the frame of the directions (nx, ny), where its
        // equation is λ X² + m X + n Y + f = 0, and (zx, zy), its axis.
        "var big = abs(l1) > abs(l2)",
        "var lambda = big ? l1 : l2",
        "var nx = big ? c1 : -s1",
        "var ny = big ? s1 : c1",
        "var m = d * nx + e * ny",
        "var n = d * (-ny) + e * nx",
        "var X0 = -m / (2 * lambda)",
        "var Y0 = -(lambda * X0 * X0 + m * X0 + f) / n",
        "var h = -n / (4 * lambda)",
        "var parabola = abs(det) < 1e-9",
        "var x0 = (b * e - 2 * c * d) / det",
        "var y0 = (b * d - 2 * a * e) / det",
        "var F = a * x0 * x0 + b * x0 * y0 + c * y0 * y0 + d * x0 + e * y0 + f",
        "var p = -F / l1",
        "var q = -F / l2",
        "var ux = p >= q ? c1 : -s1",
        "var uy = p >= q ? s1 : c1",
        "var P = max(p, q)",
        "var k = sqrt(P - min(p, q))",
        "parabola ? [X0 * nx - (Y0 + h) * ny, X0 * ny + (Y0 + h) * nx, 0 / 0, 0 / 0, X0 * nx - (Y0 - h) * ny, X0 * ny + (Y0 - h) * nx, 0 / 0, 0 / 0, nx, ny] : [x0 + k * ux, y0 + k * uy, x0 - k * ux, y0 - k * uy, x0 + P / k * ux, y0 + P / k * uy, x0 - P / k * ux, y0 - P / k * uy, -uy, ux]",
    ].join("; ");

// Of the conic K and the line of the points U and V, its pole.
export const pole = (K, U, V) =>
    [
        coefficients(K),
        `var A = y(${V}) - y(${U})`,
        `var B = x(${U}) - x(${V})`,
        `var C = -(A * x(${U}) + B * y(${U}))`,
        "var m11 = a; var m12 = b / 2; var m13 = d / 2; var m22 = c; var m23 = e / 2; var m33 = f",
        "var X = (m22 * m33 - m23 * m23) * A + (m13 * m23 - m12 * m33) * B + (m12 * m23 - m13 * m22) * C",
        "var Y = (m13 * m23 - m12 * m33) * A + (m11 * m33 - m13 * m13) * B + (m12 * m13 - m11 * m23) * C",
        "var Z = (m12 * m23 - m13 * m22) * A + (m12 * m13 - m11 * m23) * B + (m11 * m22 - m12 * m12) * C",
        "(X + i * Y) / Z",
    ].join("; ");

// Of the conic K and the point P, a point of its polar, the nearest to the
// origin, then a second one.
export const polarPoint = (K, P, second) =>
    [
        coefficients(K),
        `var A = a * x(${P}) + b / 2 * y(${P}) + d / 2`,
        `var B = b / 2 * x(${P}) + c * y(${P}) + e / 2`,
        `var C = d / 2 * x(${P}) + e / 2 * y(${P}) + f`,
        `-C * (A + i * B) / (A * A + B * B)${second ? " + (-B + i * A)" : ""}`,
    ].join("; ");

// The second point where the normal to the conic K at its point T cuts it
// again.
export const again = (K, T) =>
    [
        coefficients(K),
        `var gx = 2 * a * x(${T}) + b * y(${T}) + d`,
        `var gy = b * x(${T}) + 2 * c * y(${T}) + e`,
        "var s = -(gx * gx + gy * gy) / (a * gx * gx + b * gx * gy + c * gy * gy)",
        `${T} + s * (gx + i * gy)`,
    ].join("; ");

// The conics through four points: lines' products, (P1P2)(P3P4) and
// (P1P3)(P2P4), as two lists of coefficients.
export const pencil = (P1, P2, P3, P4) => {
    const line = (P, Q, n) =>
        `var A${n} = y(${P}) - y(${Q}); var B${n} = x(${Q}) - x(${P}); var C${n} = x(${P}) * y(${Q}) - x(${Q}) * y(${P})`;
    const product = (m, n) =>
        `[A${m} * A${n}, A${m} * B${n} + A${n} * B${m}, B${m} * B${n}, A${m} * C${n} + A${n} * C${m}, B${m} * C${n} + B${n} * C${m}, C${m} * C${n}]`;
    return [
        line(P1, P2, 1),
        line(P3, P4, 2),
        line(P1, P3, 3),
        line(P2, P4, 4),
        `var G = ${product(1, 2)}`,
        `var H = ${product(3, 4)}`,
    ].join("; ");
};

// Of the pencil G + λ H, the parabola of this root (1 or -1), or the
// rectangular hyperbola, as their list of coefficients.
export const parabolaOfPencil = (root) =>
    [
        "var al = H[1] * H[1] - 4 * H[0] * H[2]",
        "var be = 2 * G[1] * H[1] - 4 * (G[0] * H[2] + H[0] * G[2])",
        "var ga = G[1] * G[1] - 4 * G[0] * G[2]",
        `var lambda = (-be ${root < 0 ? "-" : "+"} sqrt(be * be - 4 * al * ga)) / (2 * al)`,
        "[G[0] + lambda * H[0], G[1] + lambda * H[1], G[2] + lambda * H[2], G[3] + lambda * H[3], G[4] + lambda * H[4], G[5] + lambda * H[5]]",
    ].join("; ");

export const rectangularOfPencil = [
    "var lambda = -(G[0] + G[2]) / (H[0] + H[2])",
    "[G[0] + lambda * H[0], G[1] + lambda * H[1], G[2] + lambda * H[2], G[3] + lambda * H[3], G[4] + lambda * H[4], G[5] + lambda * H[5]]",
].join("; ");

// Of the circles c1, c2, c3 of centers O1, O2, O3, the center (or radius)
// of the circle tangent to the three, for the signs s2, s3 of the
// tangencies to c2 and c3 relative to c1, and a root (1 or -1).
export const apollonius = (s2, s3, root, radius) =>
    [
        `var a2 = 2 * (x(O2) - x(O1)); var b2 = 2 * (y(O2) - y(O1)); var g2 = 2 * (${s2} * c2 - c1); var d2 = (x(O2)^2 + y(O2)^2 - c2^2) - (x(O1)^2 + y(O1)^2 - c1^2)`,
        `var a3 = 2 * (x(O3) - x(O1)); var b3 = 2 * (y(O3) - y(O1)); var g3 = 2 * (${s3} * c3 - c1); var d3 = (x(O3)^2 + y(O3)^2 - c3^2) - (x(O1)^2 + y(O1)^2 - c1^2)`,
        "var det = a2 * b3 - a3 * b2",
        "var x0 = (d2 * b3 - d3 * b2) / det; var xr = (-g2 * b3 + g3 * b2) / det",
        "var y0 = (a2 * d3 - a3 * d2) / det; var yr = (-a2 * g3 + a3 * g2) / det",
        "var A = xr * xr + yr * yr - 1",
        "var B = 2 * (xr * (x0 - x(O1)) + yr * (y0 - y(O1)) - c1)",
        "var C = (x0 - x(O1))^2 + (y0 - y(O1))^2 - c1^2",
        `var r = (-B ${root < 0 ? "-" : "+"} sqrt(B * B - 4 * A * C)) / (2 * A)`,
        radius ? "abs(r)" : "x0 + xr * r + i * (y0 + yr * r)",
    ].join("; ");

// The second point where the line through the point T of the conic K, of
// direction (wx, wy), cuts it again.
export const secant = (K, T, wx, wy) =>
    [
        coefficients(K),
        `var gx = 2 * a * x(${T}) + b * y(${T}) + d`,
        `var gy = b * x(${T}) + 2 * c * y(${T}) + e`,
        `var s = -(gx * ${wx} + gy * ${wy}) / (a * ${wx} * ${wx} + b * ${wx} * ${wy} + c * ${wy} * ${wy})`,
        `${T} + s * (${wx} + i * ${wy})`,
    ].join("; ");

// The value at P of the conic K's quadratic form, 1 on the conic, from its
// center; with Q, the value of its polar form.
export const quadraticForm = (K, P, Q = P) =>
    [
        coefficients(K),
        "var det = 4 * a * c - b * b",
        "var x0 = (b * e - 2 * c * d) / det",
        "var y0 = (b * d - 2 * a * e) / det",
        "var F = a * x0 * x0 + b * x0 * y0 + c * y0 * y0 + d * x0 + e * y0 + f",
        `var ux = x(${P}) - x0; var uy = y(${P}) - y0; var vx = x(${Q}) - x0; var vy = y(${Q}) - y0`,
        "(a * ux * vx + b / 2 * (ux * vy + uy * vx) + c * uy * vy) / -F",
    ].join("; ");
