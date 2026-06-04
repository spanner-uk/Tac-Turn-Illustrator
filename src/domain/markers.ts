import { AIRCRAFT_COLORS } from "./constants";
import { distance, normalizeRadians, stateAt, sub } from "./math";
import { isUnassistedManeuver } from "./route";
import type { AircraftId, ManeuverParams, Route, Segment, TriggerMarker } from "./types";

export function getTriggerSnapshots(route: Route, params: ManeuverParams): TriggerMarker[] {
  if (route.showTriggerMarkers === false) {
    return [];
  }
  const outsideAircraft = route.outsideAircraft ?? "a1";
  const insideAircraft = route.insideAircraft ?? "a2";
  const outsideTriggerTime = typeof route.outsideTriggerTime === "number" ? route.outsideTriggerTime : route.a1TriggerTime;
  const insideTriggerTime = typeof route.insideTriggerTime === "number" ? route.insideTriggerTime : route.a2TriggerTime;
  const insideFirstCue = getInsideFirstTurnCueSnapshot(route, params);
  const insideTurnMarker = makeTriggerMarker(route, params, insideAircraft, insideTriggerTime);

  if (params.maneuverType === "assisted" || isUnassistedManeuver(params.maneuverType)) {
    return params.maneuverType === "assisted" && insideFirstCue
      ? [insideFirstCue, insideTurnMarker]
      : [insideTurnMarker];
  }
  const markers = [
    makeTriggerMarker(route, params, outsideAircraft, outsideTriggerTime),
    insideTurnMarker
  ];
  if (insideFirstCue && params.firstStartMode === "outside-first") {
    markers.unshift(insideFirstCue);
  }
  return markers;
}

export function getClockCue(item: TriggerMarker): string {
  const vector = sub(item.ghost.point, item.trigger.point);
  const bearing = Math.atan2(vector.y, vector.x);
  const relativeClockwise = normalizeRadians(item.trigger.heading - bearing);
  const clockIndex = Math.round(relativeClockwise / (Math.PI / 6)) % 12;
  const clockPoint = clockIndex === 0 ? 12 : clockIndex;
  return `${clockPoint} o'clock`;
}

export function getTriggerSpacing(item: TriggerMarker): number {
  return distance(item.trigger.point, item.ghost.point);
}

function getAircraftSegments(route: Route, aircraft: AircraftId): Segment[] {
  return aircraft === "a1" ? route.a1Segments : route.a2Segments;
}

function getOtherAircraft(aircraft: AircraftId): AircraftId {
  return aircraft === "a1" ? "a2" : "a1";
}

function getAircraftColor(aircraft: AircraftId): string {
  return aircraft === "a1" ? AIRCRAFT_COLORS.a1 : AIRCRAFT_COLORS.a2;
}

function getAircraftStateAt(route: Route, params: ManeuverParams, aircraft: AircraftId, time: number) {
  return stateAt(getAircraftSegments(route, aircraft), time, params.speedNmPerSec);
}

function makeTriggerMarker(route: Route, params: ManeuverParams, aircraft: AircraftId, time: number): TriggerMarker {
  const otherAircraft = getOtherAircraft(aircraft);
  return {
    id: aircraft,
    trigger: getAircraftStateAt(route, params, aircraft, time),
    ghost: getAircraftStateAt(route, params, otherAircraft, time),
    triggerLabel: "",
    ghostLabel: "",
    ghostColor: getAircraftColor(otherAircraft),
    time
  };
}

function getInsideFirstTurnCueSnapshot(route: Route, params: ManeuverParams): TriggerMarker | null {
  const insideFirstTurnStartTime = typeof route.insideFirstTurnStartTime === "number"
    ? route.insideFirstTurnStartTime
    : route.a2FirstTurnStartTime;
  if (typeof insideFirstTurnStartTime !== "number" || insideFirstTurnStartTime <= 0.0001) {
    return null;
  }
  const insideAircraft = route.insideAircraft ?? "a2";
  const outsideAircraft = route.outsideAircraft ?? "a1";
  return {
    id: `${insideAircraft}-first`,
    trigger: getAircraftStateAt(route, params, insideAircraft, insideFirstTurnStartTime),
    ghost: getAircraftStateAt(route, params, outsideAircraft, insideFirstTurnStartTime),
    triggerLabel: "",
    ghostLabel: "",
    ghostColor: getAircraftColor(outsideAircraft),
    cueText: `Cue: ${outsideAircraft.toUpperCase()} levels wings`,
    time: insideFirstTurnStartTime
  };
}
