import { vAdd, vScale, type Vec2 } from "../vec";

const HALF_TURN = Math.PI;
const FULL_TURN = 2 * Math.PI;

export interface AngleArcGeometry {
    legA: Vec2;
    legC: Vec2;
    sweep: 0 | 1;
    labelRotationDeg: number;
    labelOffset: number;
    labelAnchor: "start" | "end";
}

// Screen-space geometry of an angle wedge sweeping from direction dirA to
// direction dirC through their ≤180° side, plus a degree label placed
// radially along the bisector. The label's rotation is flipped by a half
// turn whenever the bisector points generally leftwards, so its glyphs
// stay upright; the offset and anchor are flipped along with it so the
// anchor point itself (where the label starts, just past the arc) doesn't
// move on screen.
export function computeAngleArc(
    origin: Vec2,
    dirA: Vec2,
    dirC: Vec2,
    radius: number,
    labelRadius: number,
): AngleArcGeometry {
    const angleA = Math.atan2(dirA[1], dirA[0]);
    const angleC = Math.atan2(dirC[1], dirC[0]);
    let diff = angleC - angleA;
    diff -= Math.round(diff / FULL_TURN) * FULL_TURN;
    const sweep = diff > 0 ? 1 : 0;

    const bisector = angleA + diff / 2;
    const normalized = ((bisector % FULL_TURN) + FULL_TURN) % FULL_TURN;
    const flipped = normalized > Math.PI / 2 && normalized < (3 * Math.PI) / 2;

    return {
        legA: vAdd(origin, vScale(dirA, radius)),
        legC: vAdd(origin, vScale(dirC, radius)),
        sweep,
        labelRotationDeg:
            ((flipped ? normalized + HALF_TURN : normalized) * 180) / Math.PI,
        labelOffset: flipped ? -labelRadius : labelRadius,
        labelAnchor: flipped ? "end" : "start",
    };
}

export function formatDegrees(value: number, precision: number): string {
    const factor = 10 ** precision;
    return `${Math.round(value * factor) / factor}`.replace(".", ",") + "°";
}
