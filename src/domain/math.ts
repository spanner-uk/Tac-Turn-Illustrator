import type { AircraftState, Point, Segment } from "./types";

export function radians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function degrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v: Point, amount: number): Point {
  return { x: v.x * amount, y: v.y * amount };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function forward(heading: number): Point {
  return { x: Math.cos(heading), y: Math.sin(heading) };
}

export function leftNormal(heading: number): Point {
  return { x: -Math.sin(heading), y: Math.cos(heading) };
}

export function normalizeRadians(value: number): number {
  const fullTurn = Math.PI * 2;
  return ((value % fullTurn) + fullTurn) % fullTurn;
}

export function angularDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeRadians(a - b));
  return Math.min(diff, Math.PI * 2 - diff);
}

export function makeArc(
  startTime: number,
  startPoint: Point,
  startHeading: number,
  turnSign: number,
  angle: number,
  radius: number,
  speed: number
): Segment {
  const duration = (radius * angle) / speed;
  const center = add(startPoint, scale(leftNormal(startHeading), turnSign * radius));
  const endHeading = startHeading + turnSign * angle;
  const endPoint = sub(center, scale(leftNormal(endHeading), turnSign * radius));
  return {
    type: "arc",
    startTime,
    endTime: startTime + duration,
    duration,
    startPoint,
    startHeading,
    turnSign,
    angle,
    radius,
    center,
    endPoint,
    endHeading
  };
}

export function makeLine(
  startTime: number,
  startPoint: Point,
  heading: number,
  duration: number,
  speed: number
): Segment {
  const safeDuration = Math.max(0, duration);
  const endPoint = add(startPoint, scale(forward(heading), speed * safeDuration));
  return {
    type: "line",
    startTime,
    endTime: startTime + safeDuration,
    duration: safeDuration,
    startPoint,
    heading,
    endPoint,
    endHeading: heading
  };
}

export function stateOnSegment(segment: Segment, time: number, speed: number): AircraftState {
  const local = clamp(time - segment.startTime, 0, segment.duration);
  if (segment.type === "line") {
    return {
      point: add(segment.startPoint, scale(forward(segment.heading), speed * local)),
      heading: segment.heading
    };
  }

  const swept = segment.radius > 0 ? (speed * local) / segment.radius : 0;
  const heading = segment.startHeading + segment.turnSign * swept;
  return {
    point: sub(segment.center, scale(leftNormal(heading), segment.turnSign * segment.radius)),
    heading
  };
}

export function stateAt(segments: Segment[], time: number, speed: number): AircraftState {
  const segment = segments.find((item) => time <= item.endTime + 0.0001) ?? segments[segments.length - 1];
  return stateOnSegment(segment, time, speed);
}

export function appendLine(segments: Segment[], startTime: number, endTime: number, speed: number): void {
  const last = segments[segments.length - 1];
  if (!last || endTime <= startTime + 0.0001) {
    return;
  }
  segments.push(makeLine(startTime, last.endPoint, last.endHeading, endTime - startTime, speed));
}
