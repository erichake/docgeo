import {
    GEOMETRY_EPSILON,
    vAdd,
    vCross,
    vNorm,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "./vec";

export interface ProjectionFrame {
    origin: Vec2;
    unit: Vec3;
    cosPhi: number;
    sinPhi: number;
    cosTheta: number;
    sinTheta: number;
}

export function projectPoint(point: Vec3, frame: ProjectionFrame): Vec2 {
    const x = point[0] * frame.unit[0];
    const y = point[1] * frame.unit[1];
    const z = point[2] * frame.unit[2];
    return [
        frame.origin[0] + x * frame.sinPhi + y * frame.cosPhi,
        frame.origin[1] +
            x * frame.cosPhi * frame.sinTheta -
            y * frame.sinPhi * frame.sinTheta -
            z * frame.cosTheta,
    ];
}

export function screenBasis(frame: ProjectionFrame): [Vec2, Vec2, Vec2] {
    return [
        projectPoint([1, 0, 0], frame),
        projectPoint([0, 1, 0], frame),
        projectPoint([0, 0, 1], frame),
    ];
}

export function unprojectPointToZPlane(
    screen: Vec2,
    z: number,
    frame: ProjectionFrame,
): Vec3 | null {
    const basis = screenBasis(frame);
    const h = vSub(screen, vScale(vSub(basis[2], frame.origin), z));
    const oh = vSub(h, frame.origin);
    const ox = vSub(basis[0], frame.origin);
    const oy = vSub(basis[1], frame.origin);
    const determinant = ox[0] * oy[1] - ox[1] * oy[0];
    const scale = vNorm(ox) * vNorm(oy);
    if (Math.abs(determinant) <= GEOMETRY_EPSILON * scale) return null;
    return [
        (oh[0] * oy[1] - oh[1] * oy[0]) / determinant,
        (ox[0] * oh[1] - ox[1] * oh[0]) / determinant,
        z,
    ];
}

// The 3D direction along which a point can move without changing its screen
// projection: the null space of projectPoint's linear part, i.e. the cross
// product of its two (sx, sy) row vectors. Points with a smaller coordinate
// along this axis are closer to the camera.
export function viewDirection(frame: ProjectionFrame): Vec3 {
    const row1: Vec3 = [
        frame.unit[0] * frame.sinPhi,
        frame.unit[1] * frame.cosPhi,
        0,
    ];
    const row2: Vec3 = [
        frame.unit[0] * frame.cosPhi * frame.sinTheta,
        -frame.unit[1] * frame.sinPhi * frame.sinTheta,
        -frame.unit[2] * frame.cosTheta,
    ];
    return vCross(row1, row2);
}

// Finds the point of the plane through `origin` spanned by `basis` whose
// projection lands on `screen`, by solving for its (a, b) plane coordinates.
export function projectPointOnPlane(
    screen: Vec2,
    origin: Vec3,
    basis: [Vec3, Vec3],
    frame: ProjectionFrame,
): Vec3 | null {
    const s0 = projectPoint(origin, frame);
    const e1 = vSub(projectPoint(vAdd(origin, basis[0]), frame), s0);
    const e2 = vSub(projectPoint(vAdd(origin, basis[1]), frame), s0);
    const target = vSub(screen, s0);
    const determinant = e1[0] * e2[1] - e1[1] * e2[0];
    const scale = vNorm(e1) * vNorm(e2);
    if (Math.abs(determinant) <= GEOMETRY_EPSILON * scale) return null;
    const a = (target[0] * e2[1] - target[1] * e2[0]) / determinant;
    const b = (e1[0] * target[1] - e1[1] * target[0]) / determinant;
    return vAdd(origin, vAdd(vScale(basis[0], a), vScale(basis[1], b)));
}
