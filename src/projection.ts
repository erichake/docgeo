import {
    GEOMETRY_EPSILON,
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
