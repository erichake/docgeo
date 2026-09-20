import type { construction } from "../construction";
import {
    projectPoint,
    projectPointOnPlane,
    viewDirection,
    type ProjectionFrame,
} from "../projection";
import {
    GEOMETRY_EPSILON,
    geometryTolerance,
    vAdd,
    vCross,
    vDot,
    vScale,
    vSub,
    type Vec2,
    type Vec3,
} from "../vec";
import type { polygon_object } from "./polygon_object";

function signedArea(poly: readonly Vec2[]): number {
    let sum = 0;
    for (let i = 0; i < poly.length; i++) {
        const [x1, y1] = poly[i];
        const [x2, y2] = poly[(i + 1) % poly.length];
        sum += x1 * y2 - x2 * y1;
    }
    return sum;
}

function ensureCCW(poly: readonly Vec2[]): Vec2[] {
    return signedArea(poly) >= 0 ? [...poly] : [...poly].reverse();
}

function lineIntersection(p1: Vec2, p2: Vec2, a: Vec2, b: Vec2): Vec2 {
    const d1 = vSub(p2, p1);
    const d2 = vSub(b, a);
    const denom = d1[0] * d2[1] - d1[1] * d2[0];
    const t = ((a[0] - p1[0]) * d2[1] - (a[1] - p1[1]) * d2[0]) / denom;
    return vAdd(p1, vScale(d1, t));
}

// Keeps the part of `subject` on the left of directed edge a->b (standard
// Sutherland-Hodgman single-edge clip).
function clipHalfPlane(subject: readonly Vec2[], a: Vec2, b: Vec2): Vec2[] {
    if (subject.length === 0) return [];
    const edge = vSub(b, a);
    const side = (p: Vec2) =>
        edge[0] * (p[1] - a[1]) - edge[1] * (p[0] - a[0]);
    const output: Vec2[] = [];
    for (let i = 0; i < subject.length; i++) {
        const curr = subject[i];
        const prev = subject[(i - 1 + subject.length) % subject.length];
        const sideCurr = side(curr);
        const sidePrev = side(prev);
        if (sideCurr >= 0) {
            if (sidePrev < 0) output.push(lineIntersection(prev, curr, a, b));
            output.push(curr);
        } else if (sidePrev >= 0) {
            output.push(lineIntersection(prev, curr, a, b));
        }
    }
    return output;
}

// Intersection of two convex polygons (Sutherland-Hodgman). Winding of both
// inputs is normalized internally, so callers don't need to care about it.
function convexClip(subject: readonly Vec2[], clip: readonly Vec2[]): Vec2[] {
    let output = ensureCCW(subject);
    const clipCCW = ensureCCW(clip);
    for (let i = 0; i < clipCCW.length && output.length > 0; i++) {
        output = clipHalfPlane(output, clipCCW[i], clipCCW[(i + 1) % clipCCW.length]);
    }
    return output;
}

// The line where `polygon`'s plane meets the floor plane (z=0), as two
// points in that plane, or null if the polygon's plane is parallel to the
// floor (no intersection, or coincident).
function floorIntersectionLine(normal: Vec3, d: number): [Vec3, Vec3] | null {
    const [nx, ny] = normal;
    if (Math.abs(nx) <= GEOMETRY_EPSILON && Math.abs(ny) <= GEOMETRY_EPSILON)
        return null;
    if (Math.abs(nx) >= Math.abs(ny)) {
        const at = (y: number): Vec3 => [(d - ny * y) / nx, y, 0];
        return [at(0), at(1)];
    }
    const at = (x: number): Vec3 => [x, (d - nx * x) / ny, 0];
    return [at(0), at(1)];
}

const floorBasis: [Vec3, Vec3] = [
    [1, 0, 0],
    [0, 1, 0],
];

function floorDepthAt(screen: Vec2, frame: ProjectionFrame, dir: Vec3): number | null {
    const point = projectPointOnPlane(screen, [0, 0, 0], floorBasis, frame);
    return point ? vDot(point, dir) : null;
}

// The part of the floor's screen quad, if any, that `polygon` is nearer to
// the camera than the floor and therefore hides. Assumes `polygon` is
// convex and planar (true for the ordinary faces this is meant for — an
// arbitrary concave polygon would need true polygon-boolean clipping, which
// this doesn't attempt).
function occluderHiddenPiece(
    frame: ProjectionFrame,
    dir: Vec3,
    floorCCW: readonly Vec2[],
    polygon: polygon_object,
): Vec2[] | null {
    if (!polygon.isVisible || polygon.points.length < 3) return null;
    if (!polygon.points.every((p) => p.projectionDefined)) return null;

    const points3D = polygon.points.map((p) => p.coords);
    const screenPoints = polygon.points.map((p) => p.screen);
    let region = convexClip(floorCCW, screenPoints);
    if (region.length === 0) return null;

    const v0 = points3D[0];
    const normal = vCross(vSub(points3D[1], v0), vSub(points3D[2], v0));
    const d = vDot(normal, v0);

    // Probed at the vertex farthest from the floor plane, not the polygon's
    // centroid: a face straddling z=0 symmetrically (e.g. a cube centered on
    // the origin) has its centroid sitting exactly on the floor's plane,
    // making the depth comparison degenerate and prone to flip sign from
    // rounding noise alone as the camera rotates — a real vertex is never
    // exactly on the boundary it's being tested against.
    const probe = points3D.reduce((best, p) =>
        Math.abs(p[2]) > Math.abs(best[2]) ? p : best,
    );
    const probeScreen = projectPoint(probe, frame);
    const floorDepth = floorDepthAt(probeScreen, frame, dir);
    if (floorDepth === null) return null;
    const probeDepth = vDot(probe, dir);
    const nearer = floorDepth - probeDepth > geometryTolerance(floorDepth, probeDepth);

    const line = floorIntersectionLine(normal, d);
    if (!line) return nearer ? region : null;

    const [s0, s1] = [projectPoint(line[0], frame), projectPoint(line[1], frame)];
    const edge = vSub(s1, s0);
    const side =
        edge[0] * (probeScreen[1] - s0[1]) - edge[1] * (probeScreen[0] - s0[0]);
    const [a, b] = (side >= 0) === nearer ? [s0, s1] : [s1, s0];
    region = clipHalfPlane(region, a, b);
    return region.length >= 3 ? region : null;
}

function ring(points: readonly Vec2[]): string {
    return (
        points.map(([x, y], i) => (i === 0 ? "M" : "L") + x + " " + y).join(" ") +
        " Z"
    );
}

// An SVG path — the floor's screen quad with a hole punched out for every
// nearer face that crosses it — for use as a <clipPath>. The outer ring and
// each hole are wound in opposite directions so overlapping holes (two
// occluding faces covering the same corner of the floor) still clip
// correctly under the nonzero fill rule, without needing true polygon
// subtraction.
export function floorClipPath(
    c: construction,
    frame: ProjectionFrame,
    floorScreenQuad: readonly Vec2[],
    exclude: polygon_object,
): string {
    const dir = viewDirection(frame);
    const floorCCW = ensureCCW(floorScreenQuad);
    const holes: Vec2[][] = [];
    (c.OBJS.polygons as polygon_object[]).forEach((polygon) => {
        if (polygon === exclude) return;
        const piece = occluderHiddenPiece(frame, dir, floorCCW, polygon);
        if (piece) holes.push(piece);
    });
    return (
        ring(floorCCW) +
        " " +
        holes.map((hole) => ring([...hole].reverse())).join(" ")
    );
}
