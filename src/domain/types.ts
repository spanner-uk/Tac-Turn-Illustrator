export type AircraftId = "a1" | "a2";

export type AircraftKey = "f16Block20" | "fa18c" | "f14b";

export type Direction = "left" | "right";

export type FirstStartMode = "simultaneous" | "outside-first";

export type ManeuverType =
  | "double"
  | "assisted"
  | "unassisted"
  | "turn90"
  | "hook"
  | "cross180"
  | "check"
  | "shackle";

export type TimingMode = "optimum" | "cross" | "blindspot" | "fixed";

export interface AircraftProfile {
  label: string;
  milSustainedG: number;
  maxTurnG: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface SamplePoint extends Point {
  time: number;
}

export interface AircraftState {
  point: Point;
  heading: number;
}

export interface LineSegment {
  type: "line";
  startTime: number;
  endTime: number;
  duration: number;
  startPoint: Point;
  heading: number;
  endPoint: Point;
  endHeading: number;
}

export interface ArcSegment {
  type: "arc";
  startTime: number;
  endTime: number;
  duration: number;
  startPoint: Point;
  startHeading: number;
  turnSign: number;
  angle: number;
  radius: number;
  center: Point;
  endPoint: Point;
  endHeading: number;
}

export type Segment = LineSegment | ArcSegment;

export interface ManeuverParams {
  maneuverType: ManeuverType;
  angleDeg: number;
  angleRad: number;
  overturnDeg: number;
  overturnRad: number;
  lockOverturnToHalf: boolean;
  direction: Direction;
  sign: number;
  separation: number;
  speedKts: number;
  speedNmPerSec: number;
  aircraftKey: AircraftKey;
  aircraftLabel: string;
  aircraftMilSustainedG: number;
  aircraftMaxTurnG: number;
  turnLoadFactor: number;
  turnBankDeg: number;
  firstStartMode: FirstStartMode;
  mode: TimingMode;
  fixedWait: number;
  blindspotDeg: number;
  blindspotRad: number;
  showBlindspots: boolean;
}

export interface ControlsState {
  maneuverType: ManeuverType;
  angleDeg: number;
  direction: Direction;
  firstStartMode: FirstStartMode;
  overturnDeg: number;
  lockOverturnToHalf: boolean;
  separation: number;
  speedKts: number;
  aircraftKey: AircraftKey;
  turnLoadFactor: number;
  mode: TimingMode;
  fixedWait: number;
  blindspotDeg: number;
  showBlindspots: boolean;
}

export interface EqualSpacingResult {
  available: boolean;
  delayAfterFirstComplete?: number;
  result?: TriggeredRouteResult;
  nearest?: TriggeredRouteResult;
  nearestDelay?: number;
  nearestDiff?: number;
}

export interface CrossingResult {
  a1Distance: number;
  a2Distance: number;
  point: Point;
}

export interface RouteNote {
  point: Point;
  text?: string;
  lines?: string[];
  placement?: "above" | "below" | "right";
  offsetX?: number;
  offsetY?: number;
}

export interface Route {
  radius: number;
  a1Segments: Segment[];
  a2Segments: Segment[];
  a1Start: Point;
  a2Start: Point;
  outsideAircraft?: AircraftId;
  insideAircraft?: AircraftId;
  outsideTriggerTime?: number;
  insideTriggerTime?: number;
  a1TriggerTime: number;
  a2TriggerTime: number;
  firstTurnCompleteTime: number;
  outsideFirstTurnCompleteTime?: number;
  insideFirstTurnStartTime?: number;
  insideFirstTurnCompleteTime?: number;
  a1FirstTurnCompleteTime: number;
  a2FirstTurnStartTime: number;
  a2FirstTurnCompleteTime: number;
  totalTime: number;
  maneuverEnd: number;
  completionA1: Point;
  completionA2: Point;
  completionSpacing: number;
  blindspotTime: number;
  equalSpacing: EqualSpacingResult;
  crossing: CrossingResult | null;
  samples: {
    a1: SamplePoint[];
    a2: SamplePoint[];
  };
  showTriggerMarkers?: boolean;
  notes?: RouteNote[];
}

export interface TriggeredRouteResult {
  a1Segments: Segment[];
  a2Segments: Segment[];
  a1TriggerTime: number;
  a2TriggerTime: number;
  maneuverEnd: number;
  completionA1: Point;
  completionA2: Point;
  completionSpacing: number;
  outsideTriggerTime: number;
  insideTriggerTime: number;
  triggerOutside: Point;
  triggerInside: Point;
}

export interface TriggerMarker {
  id: string;
  trigger: AircraftState;
  ghost: AircraftState;
  triggerLabel: string;
  ghostLabel: string;
  ghostColor: string;
  cueText?: string;
  time: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface ViewportTransform {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  scale: number;
  toScreen(point: Point): Point;
}
