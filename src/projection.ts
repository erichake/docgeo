import {
    GEOMETRY_EPSILON,
    vAdd,
    vCross,
    vDot,
    vScale,
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
    // Unit-length camera axis (the null space of the linear part below) and
    // the camera distance along it, in math coordinates. Perspective is
    // active only when `focal` is set; otherwise the projection is the
    // orthographic parallel projection `origin + linearPart(point)`.
    dir?: Vec3;
    focal?: number;
}

// The (sx, sy) contribution of a point/vector under the parallel part of the
// projection, before the perspective divide and before adding `frame.origin`.
function linearPart(point: Vec3, frame: ProjectionFrame): Vec2 {
    const x = point[0] * frame.unit[0];
    const y = point[1] * frame.unit[1];
    const z = point[2] * frame.unit[2];
    return [
        x * frame.sinPhi + y * frame.cosPhi,
        x * frame.cosPhi * frame.sinTheta -
            y * frame.sinPhi * frame.sinTheta -
            z * frame.cosTheta,
    ];
}

function perspectiveScale(point: Vec3, frame: ProjectionFrame): number {
    if (frame.focal === undefined) return 1;
    const depth = vDot(point, frame.dir!);
    return frame.focal / (frame.focal + depth);
}

export function projectPoint(point: Vec3, frame: ProjectionFrame): Vec2 {
    const [x, y] = linearPart(point, frame);
    const scale = perspectiveScale(point, frame);
    return [frame.origin[0] + x * scale, frame.origin[1] + y * scale];
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
    return projectPointOnPlane(
        screen,
        [0, 0, z],
        [
            [1, 0, 0],
            [0, 1, 0],
        ],
        frame,
    );
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
//
// Under the perspective divide, screen position is a ratio of two functions
// that are each affine in (a, b) (the linear part and the depth are both
// linear in the point, hence affine along the plane). Clearing that ratio
// out of `projectPoint(origin + a*basis0 + b*basis1) = screen` still leaves
// a system that's linear in (a, b) — see AGENTS-adjacent notes in 3D.md —
// so this stays a single closed-form 2x2 solve in both projection modes.
export function projectPointOnPlane(
    screen: Vec2,
    origin: Vec3,
    basis: [Vec3, Vec3],
    frame: ProjectionFrame,
): Vec3 | null {
    const [lx0, ly0] = linearPart(origin, frame);
    const [lxa, lya] = linearPart(basis[0], frame);
    const [lxb, lyb] = linearPart(basis[1], frame);
    const tx = screen[0] - frame.origin[0];
    const ty = screen[1] - frame.origin[1];

    let m00: number, m01: number, m10: number, m11: number;
    let r0: number, r1: number;
    if (frame.focal === undefined) {
        m00 = lxa;
        m01 = lxb;
        m10 = lya;
        m11 = lyb;
        r0 = tx - lx0;
        r1 = ty - ly0;
    } else {
        const f = frame.focal;
        const d0 = vDot(origin, frame.dir!);
        const da = vDot(basis[0], frame.dir!);
        const db = vDot(basis[1], frame.dir!);
        m00 = tx * da - f * lxa;
        m01 = tx * db - f * lxb;
        m10 = ty * da - f * lya;
        m11 = ty * db - f * lyb;
        r0 = f * (lx0 - tx) - tx * d0;
        r1 = f * (ly0 - ty) - ty * d0;
    }

    const determinant = m00 * m11 - m01 * m10;
    const scale = Math.hypot(m00, m10) * Math.hypot(m01, m11);
    if (Math.abs(determinant) <= GEOMETRY_EPSILON * scale) return null;
    const a = (r0 * m11 - m01 * r1) / determinant;
    const b = (m00 * r1 - r0 * m10) / determinant;
    return vAdd(origin, vAdd(vScale(basis[0], a), vScale(basis[1], b)));
}

// Finds the point of the line through `origin` with the given `direction`
// whose projection lands on `screen`, by solving for its scalar position.
// Lines still project to lines under the perspective divide, so `screen` is
// assumed to already lie on this line's projection; of the two (now
// generally different) equations `projectPoint(origin + a*direction) =
// screen` gives for `a`, this uses whichever is better conditioned.
export function projectPointOnLine(
    screen: Vec2,
    origin: Vec3,
    direction: Vec3,
    frame: ProjectionFrame,
): Vec3 | null {
    const [lx0, ly0] = linearPart(origin, frame);
    const [lxd, lyd] = linearPart(direction, frame);
    const tx = screen[0] - frame.origin[0];
    const ty = screen[1] - frame.origin[1];

    let mx: number, my: number, rx: number, ry: number;
    if (frame.focal === undefined) {
        mx = lxd;
        my = lyd;
        rx = tx - lx0;
        ry = ty - ly0;
    } else {
        const f = frame.focal;
        const d0 = vDot(origin, frame.dir!);
        const dd = vDot(direction, frame.dir!);
        mx = tx * dd - f * lxd;
        my = ty * dd - f * lyd;
        rx = f * (lx0 - tx) - tx * d0;
        ry = f * (ly0 - ty) - ty * d0;
    }

    const a = Math.abs(mx) >= Math.abs(my) ? rx / mx : ry / my;
    return Number.isFinite(a) ? vAdd(origin, vScale(direction, a)) : null;
}
