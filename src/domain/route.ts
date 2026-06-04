import {
  FEET_PER_NM,
  FINAL_LEAD_SECONDS,
  GRAVITY_FTPS2,
  KNOTS_TO_FEET_PER_SECOND,
  MIN_TURN_RADIUS_NM
} from "./constants";
import { add, appendLine, clamp, distance, forward, makeArc, makeLine, scale, stateAt } from "./math";
import type {
  AircraftId,
  AircraftState,
  ControlsState,
  CrossingResult,
  EqualSpacingResult,
  ManeuverParams,
  ManeuverType,
  Point,
  Route,
  Segment,
  TriggeredRouteResult
} from "./types";
import { AIRCRAFT_PROFILES } from "./constants";
import { angularDistance, degrees, radians, sub } from "./math";

interface TurnRoles {
  a1Start: Point;
  a2Start: Point;
  outsideAircraft: AircraftId;
  insideAircraft: AircraftId;
  outsideStart: Point;
  insideStart: Point;
}

export function controlsToParams(controls: ControlsState): ManeuverParams {
  const aircraft = AIRCRAFT_PROFILES[controls.aircraftKey];
  const turnLoadFactor = clamp(controls.turnLoadFactor, 1.01, aircraft.maxTurnG);
  const angleMin = controls.maneuverType === "check" ? 1 : 20;
  const angleMax = isUnassistedManeuver(controls.maneuverType) || controls.maneuverType === "check" ? 90 : 70;
  const angleDeg = controls.maneuverType === "turn90"
    ? 90
    : needsTurnAngleControl(controls.maneuverType)
      ? clamp(controls.angleDeg, angleMin, angleMax)
      : controls.angleDeg;
  const overturnDeg = controls.lockOverturnToHalf ? angleDeg / 2 : controls.overturnDeg;

  return {
    maneuverType: controls.maneuverType,
    angleDeg,
    angleRad: radians(angleDeg),
    overturnDeg,
    overturnRad: radians(overturnDeg),
    lockOverturnToHalf: controls.lockOverturnToHalf,
    direction: controls.direction,
    sign: controls.direction === "right" ? -1 : 1,
    separation: controls.separation,
    speedKts: controls.speedKts,
    speedNmPerSec: controls.speedKts / 3600,
    aircraftKey: controls.aircraftKey,
    aircraftLabel: aircraft.label,
    aircraftMilSustainedG: aircraft.milSustainedG,
    aircraftMaxTurnG: aircraft.maxTurnG,
    turnLoadFactor,
    turnBankDeg: getTurnBankDeg(turnLoadFactor),
    firstStartMode: controls.firstStartMode,
    mode: controls.mode,
    fixedWait: controls.fixedWait,
    blindspotDeg: controls.blindspotDeg,
    blindspotRad: radians(controls.blindspotDeg),
    showBlindspots: controls.showBlindspots
  };
}

export function getTurnBankDeg(loadFactor: number): number {
  return degrees(Math.acos(1 / Math.max(loadFactor, 1.0001)));
}

export function getTurnRadius(settings: ManeuverParams): number {
  const speedFtPerSecond = settings.speedKts * KNOTS_TO_FEET_PER_SECOND;
  const radialG = Math.sqrt(Math.max(settings.turnLoadFactor * settings.turnLoadFactor - 1, 0.0001));
  const radiusFeet = (speedFtPerSecond * speedFtPerSecond) / (GRAVITY_FTPS2 * radialG);
  return Math.max(MIN_TURN_RADIUS_NM, radiusFeet / FEET_PER_NM);
}

export function buildRoute(settings: ManeuverParams): Route {
  if (settings.maneuverType === "hook") {
    return buildHookRoute(settings);
  }
  if (settings.maneuverType === "cross180") {
    return buildCrossRoute(settings);
  }
  if (settings.maneuverType === "check") {
    return buildCheckRoute(settings);
  }
  if (settings.maneuverType === "shackle") {
    return buildShackleRoute(settings);
  }
  if (isUnassistedManeuver(settings.maneuverType)) {
    return buildUnassistedRoute(settings);
  }
  if (settings.maneuverType === "assisted") {
    return buildAssistedRoute(settings);
  }
  return buildDoubleAssistedRoute(settings);
}

export function isBasicFormationManeuver(type: ManeuverType): boolean {
  return type === "turn90" || type === "hook" || type === "cross180" || type === "check" || type === "shackle";
}

export function isUnassistedManeuver(type: ManeuverType): boolean {
  return type === "unassisted" || type === "turn90";
}

export function needsTurnAngleControl(type: ManeuverType): boolean {
  return type === "double" || type === "assisted" || type === "unassisted" || type === "check";
}

export function needsDirectionControl(type: ManeuverType): boolean {
  return type === "double" || type === "assisted" || isUnassistedManeuver(type) || type === "hook" || type === "check";
}

export function needsSecondTurnControl(type: ManeuverType): boolean {
  return type === "double" || type === "assisted" || isUnassistedManeuver(type);
}

export function getStartPositions(settings: ManeuverParams): { a1Start: Point; a2Start: Point } {
  return {
    a1Start: { x: 0, y: settings.separation / 2 },
    a2Start: { x: 0, y: -settings.separation / 2 }
  };
}

function getTurnRoles(settings: ManeuverParams): TurnRoles {
  const { a1Start, a2Start } = getStartPositions(settings);
  const a1IsOutside = settings.sign < 0;
  return {
    a1Start,
    a2Start,
    outsideAircraft: a1IsOutside ? "a1" : "a2",
    insideAircraft: a1IsOutside ? "a2" : "a1",
    outsideStart: a1IsOutside ? a1Start : a2Start,
    insideStart: a1IsOutside ? a2Start : a1Start
  };
}

function mapRoleSegments(
  roles: TurnRoles,
  outsideSegments: Segment[],
  insideSegments: Segment[]
): Pick<TriggeredRouteResult, "a1Segments" | "a2Segments"> {
  return roles.outsideAircraft === "a1"
    ? { a1Segments: outsideSegments, a2Segments: insideSegments }
    : { a1Segments: insideSegments, a2Segments: outsideSegments };
}

function mapRoleTimes(
  roles: TurnRoles,
  outsideTime: number,
  insideTime: number
): Pick<TriggeredRouteResult, "a1TriggerTime" | "a2TriggerTime"> {
  return roles.outsideAircraft === "a1"
    ? { a1TriggerTime: outsideTime, a2TriggerTime: insideTime }
    : { a1TriggerTime: insideTime, a2TriggerTime: outsideTime };
}

function mapRoleStates(
  roles: TurnRoles,
  outsideState: AircraftState,
  insideState: AircraftState
): Record<AircraftId, AircraftState> {
  return roles.outsideAircraft === "a1"
    ? { a1: outsideState, a2: insideState }
    : { a1: insideState, a2: outsideState };
}

function buildSynchronousTurnRoute(
  settings: ManeuverParams,
  angle: number,
  a1TurnSign: number,
  a2TurnSign: number,
  extras: Partial<Route> = {}
): Route {
  const radius = getTurnRadius(settings);
  const startHeading = 0;
  const { a1Start, a2Start } = getStartPositions(settings);
  const a1Turn = makeArc(0, a1Start, startHeading, a1TurnSign, angle, radius, settings.speedNmPerSec);
  const a2Turn = makeArc(0, a2Start, startHeading, a2TurnSign, angle, radius, settings.speedNmPerSec);
  const maneuverEnd = Math.max(a1Turn.endTime, a2Turn.endTime);
  return finalizeRoute(settings, radius, [a1Turn], [a2Turn], a1Start, a2Start, maneuverEnd, extras);
}

function buildHookRoute(settings: ManeuverParams): Route {
  return buildSynchronousTurnRoute(settings, Math.PI, settings.sign, settings.sign);
}

function buildCheckRoute(settings: ManeuverParams): Route {
  return buildSynchronousTurnRoute(settings, settings.angleRad, settings.sign, settings.sign);
}

function buildCrossRoute(settings: ManeuverParams): Route {
  const radius = getTurnRadius(settings);
  const notes: Route["notes"] = [];
  const crossingCos = 1 - settings.separation / (2 * radius);
  if (crossingCos >= -1 && crossingCos <= 1) {
    const crossingSweep = Math.acos(crossingCos);
    notes.push({
      point: {
        x: radius * Math.sin(crossingSweep),
        y: 0
      },
      lines: ["Wingman:", "below"],
      placement: "right",
      offsetX: 42
    });
  }
  return buildSynchronousTurnRoute(settings, Math.PI, -1, 1, { notes });
}

function buildShackleRoute(settings: ManeuverParams): Route {
  const radius = getTurnRadius(settings);
  const startHeading = 0;
  const shackleAngle = Math.PI / 4;
  const { a1Start, a2Start } = getStartPositions(settings);
  const a1In = makeArc(0, a1Start, startHeading, -1, shackleAngle, radius, settings.speedNmPerSec);
  const a2In = makeArc(0, a2Start, startHeading, 1, shackleAngle, radius, settings.speedNmPerSec);
  const arcLateralGain = 2 * radius * (1 - Math.cos(shackleAngle));
  const straightDuration = Math.max(0, (settings.separation - arcLateralGain) / (settings.speedNmPerSec * Math.sin(shackleAngle)));

  const a1Segments = [a1In];
  const a2Segments = [a2In];
  if (straightDuration > 0.0001) {
    a1Segments.push(makeLine(a1In.endTime, a1In.endPoint, a1In.endHeading, straightDuration, settings.speedNmPerSec));
    a2Segments.push(makeLine(a2In.endTime, a2In.endPoint, a2In.endHeading, straightDuration, settings.speedNmPerSec));
  }

  const a1StraightEnd = a1Segments[a1Segments.length - 1];
  const a2StraightEnd = a2Segments[a2Segments.length - 1];
  const a1Out = makeArc(a1StraightEnd.endTime, a1StraightEnd.endPoint, a1StraightEnd.endHeading, 1, shackleAngle, radius, settings.speedNmPerSec);
  const a2Out = makeArc(a2StraightEnd.endTime, a2StraightEnd.endPoint, a2StraightEnd.endHeading, -1, shackleAngle, radius, settings.speedNmPerSec);
  a1Segments.push(a1Out);
  a2Segments.push(a2Out);

  const maneuverEnd = Math.max(a1Out.endTime, a2Out.endTime);
  const crossingPoint = {
    x: a1In.endPoint.x + (straightDuration * settings.speedNmPerSec * Math.cos(shackleAngle)) / 2,
    y: 0
  };
  return finalizeRoute(settings, radius, a1Segments, a2Segments, a1Start, a2Start, maneuverEnd, {
    notes: [
      {
        point: crossingPoint,
        lines: ["Wingman:", "below"],
        placement: "below",
        offsetY: 44
      }
    ]
  });
}

function buildDoubleAssistedRoute(settings: ManeuverParams): Route {
  const radius = getTurnRadius(settings);
  const startHeading = 0;
  const roles = getTurnRoles(settings);
  const { a1Start, a2Start } = roles;
  const overturnAngle = settings.overturnRad;
  const outsideFirstAngle = settings.angleRad + overturnAngle;
  const insideFirstAngle = overturnAngle;

  const outsideFirst = makeArc(0, roles.outsideStart, startHeading, settings.sign, outsideFirstAngle, radius, settings.speedNmPerSec);
  const insideFirstStartTime = settings.firstStartMode === "outside-first" ? outsideFirst.endTime : 0;
  const insideFirstStartPoint = add(roles.insideStart, scale(forward(startHeading), settings.speedNmPerSec * insideFirstStartTime));
  const insideFirst = makeArc(insideFirstStartTime, insideFirstStartPoint, startHeading, -settings.sign, insideFirstAngle, radius, settings.speedNmPerSec);
  const outsideFirstSegments = [outsideFirst];
  const insideFirstSegments = insideFirstStartTime > 0
    ? [makeLine(0, roles.insideStart, startHeading, insideFirstStartTime, settings.speedNmPerSec), insideFirst]
    : [insideFirst];

  function stateAfterFirst(segments: Segment[], firstEndTime: number, time: number): AircraftState {
    const tempSegments = segments.slice();
    appendLine(tempSegments, firstEndTime, time, settings.speedNmPerSec);
    return stateAt(tempSegments, time, settings.speedNmPerSec);
  }

  function makeTriggeredRoute(outsideTriggerTime: number, insideTriggerTime = outsideTriggerTime): TriggeredRouteResult {
    const safeOutsideTriggerTime = Math.max(outsideTriggerTime, outsideFirst.endTime);
    const safeInsideTriggerTime = Math.max(insideTriggerTime, insideFirst.endTime);
    const outsideSegments = outsideFirstSegments.slice();
    appendLine(outsideSegments, outsideFirst.endTime, safeOutsideTriggerTime, settings.speedNmPerSec);
    const outsideAtTrigger = stateAt(outsideSegments, safeOutsideTriggerTime, settings.speedNmPerSec);
    const outsideSecond = makeArc(safeOutsideTriggerTime, outsideAtTrigger.point, outsideAtTrigger.heading, -settings.sign, overturnAngle, radius, settings.speedNmPerSec);
    outsideSegments.push(outsideSecond);

    const insideSegments = insideFirstSegments.slice();
    appendLine(insideSegments, insideFirst.endTime, safeInsideTriggerTime, settings.speedNmPerSec);
    const insideAtTrigger = stateAt(insideSegments, safeInsideTriggerTime, settings.speedNmPerSec);
    const insideSecond = makeArc(safeInsideTriggerTime, insideAtTrigger.point, insideAtTrigger.heading, settings.sign, settings.angleRad + overturnAngle, radius, settings.speedNmPerSec);
    insideSegments.push(insideSecond);

    const maneuverEnd = Math.max(outsideSecond.endTime, insideSecond.endTime);
    appendLine(outsideSegments, outsideSecond.endTime, maneuverEnd, settings.speedNmPerSec);
    appendLine(insideSegments, insideSecond.endTime, maneuverEnd, settings.speedNmPerSec);

    const mappedSegments = mapRoleSegments(roles, outsideSegments, insideSegments);
    const mappedTimes = mapRoleTimes(roles, safeOutsideTriggerTime, safeInsideTriggerTime);
    const completionA1 = stateAt(mappedSegments.a1Segments, maneuverEnd, settings.speedNmPerSec).point;
    const completionA2 = stateAt(mappedSegments.a2Segments, maneuverEnd, settings.speedNmPerSec).point;
    const completionSpacing = distance(completionA1, completionA2);

    return {
      ...mappedSegments,
      ...mappedTimes,
      maneuverEnd,
      completionA1,
      completionA2,
      completionSpacing,
      outsideTriggerTime: safeOutsideTriggerTime,
      insideTriggerTime: safeInsideTriggerTime,
      triggerOutside: outsideAtTrigger.point,
      triggerInside: insideAtTrigger.point
    };
  }

  const equalSpacing = solveEqualSpacingDelay(
    (delay) => makeTriggeredRoute(outsideFirst.endTime + delay, insideFirst.endTime + delay),
    settings.separation,
    getEqualSpacingSearchDuration(settings, outsideFirst.duration)
  );
  const blindspotReferenceTime = Math.max(outsideFirst.endTime, insideFirst.endTime);
  const blindspotEntry = findBlindspotEntryTime(
    (time) => mapRoleStates(
      roles,
      stateAfterFirst(outsideFirstSegments, outsideFirst.endTime, time),
      stateAfterFirst(insideFirstSegments, insideFirst.endTime, time)
    ),
    blindspotReferenceTime,
    getEqualSpacingSearchDuration(settings, outsideFirst.duration),
    settings.blindspotRad,
    roles.insideAircraft,
    roles.outsideAircraft
  );
  let outsideTriggerTime = outsideFirst.endTime + settings.fixedWait;
  let insideTriggerTime = outsideTriggerTime;
  let crossing: CrossingResult | null = null;

  if (settings.mode === "cross") {
    const crossingReferenceTime = Math.max(outsideFirst.endTime, insideFirst.endTime);
    const outsideAtCrossingReference = stateAfterFirst(outsideFirstSegments, outsideFirst.endTime, crossingReferenceTime);
    const insideAtCrossingReference = stateAfterFirst(insideFirstSegments, insideFirst.endTime, crossingReferenceTime);
    crossing = solveLineIntersection(outsideAtCrossingReference.point, outsideAtCrossingReference.heading, insideAtCrossingReference.point, insideAtCrossingReference.heading);
    outsideTriggerTime = crossing && crossing.a1Distance >= 0
      ? crossingReferenceTime + crossing.a1Distance / settings.speedNmPerSec
      : crossingReferenceTime;
    insideTriggerTime = outsideTriggerTime;
  } else if (settings.mode === "fixed") {
    outsideTriggerTime = outsideFirst.endTime + settings.fixedWait;
    insideTriggerTime = insideFirst.endTime + settings.fixedWait;
  } else if (settings.mode === "blindspot") {
    outsideTriggerTime = blindspotEntry.time;
    insideTriggerTime = blindspotEntry.time;
  } else if (settings.mode === "optimum") {
    outsideTriggerTime = outsideFirst.endTime + (equalSpacing.delayAfterFirstComplete ?? 0);
    insideTriggerTime = insideFirst.endTime + (equalSpacing.delayAfterFirstComplete ?? 0);
  }

  const selectedRoute = makeTriggeredRoute(outsideTriggerTime, insideTriggerTime);
  return finishTriggeredRoute(settings, radius, roles, selectedRoute, {
    firstTurnCompleteTime: outsideFirst.endTime,
    outsideFirstTurnCompleteTime: outsideFirst.endTime,
    insideFirstTurnStartTime: insideFirstStartTime,
    insideFirstTurnCompleteTime: insideFirst.endTime,
    a1FirstTurnCompleteTime: roles.outsideAircraft === "a1" ? outsideFirst.endTime : insideFirst.endTime,
    a2FirstTurnStartTime: roles.insideAircraft === "a2" ? insideFirstStartTime : 0,
    a2FirstTurnCompleteTime: roles.outsideAircraft === "a2" ? outsideFirst.endTime : insideFirst.endTime,
    equalSpacing,
    crossing
  });
}

function buildUnassistedRoute(settings: ManeuverParams): Route {
  const radius = getTurnRadius(settings);
  const startHeading = 0;
  const roles = getTurnRoles(settings);
  const { a1Start, a2Start } = roles;
  const outsideFirst = makeArc(0, roles.outsideStart, startHeading, settings.sign, settings.angleRad, radius, settings.speedNmPerSec);
  const outsideFirstSegments = [outsideFirst];

  function makeTriggeredRoute(insideTriggerTime: number): TriggeredRouteResult {
    const safeInsideTriggerTime = Math.max(0, insideTriggerTime);
    const outsideSegments = outsideFirstSegments.slice();
    appendLine(outsideSegments, outsideFirst.endTime, safeInsideTriggerTime, settings.speedNmPerSec);
    const outsideAtTrigger = stateAt(outsideSegments, safeInsideTriggerTime, settings.speedNmPerSec);

    const insideSegments = [makeLine(0, roles.insideStart, startHeading, safeInsideTriggerTime, settings.speedNmPerSec)];
    const insideAtTrigger = stateAt(insideSegments, safeInsideTriggerTime, settings.speedNmPerSec);
    const insideTurn = makeArc(safeInsideTriggerTime, insideAtTrigger.point, insideAtTrigger.heading, settings.sign, settings.angleRad, radius, settings.speedNmPerSec);
    insideSegments.push(insideTurn);

    const maneuverEnd = Math.max(outsideFirst.endTime, insideTurn.endTime);
    appendLine(outsideSegments, Math.max(outsideFirst.endTime, safeInsideTriggerTime), maneuverEnd, settings.speedNmPerSec);
    appendLine(insideSegments, insideTurn.endTime, maneuverEnd, settings.speedNmPerSec);

    const mappedSegments = mapRoleSegments(roles, outsideSegments, insideSegments);
    const mappedTimes = mapRoleTimes(roles, safeInsideTriggerTime, safeInsideTriggerTime);
    const completionA1 = stateAt(mappedSegments.a1Segments, maneuverEnd, settings.speedNmPerSec).point;
    const completionA2 = stateAt(mappedSegments.a2Segments, maneuverEnd, settings.speedNmPerSec).point;
    const completionSpacing = distance(completionA1, completionA2);

    return {
      ...mappedSegments,
      ...mappedTimes,
      maneuverEnd,
      completionA1,
      completionA2,
      completionSpacing,
      outsideTriggerTime: safeInsideTriggerTime,
      insideTriggerTime: safeInsideTriggerTime,
      triggerOutside: outsideAtTrigger.point,
      triggerInside: insideAtTrigger.point
    };
  }

  const optimumTriggerTime = getUnassistedOptimumTriggerTime(settings);
  const equalSpacing: EqualSpacingResult = {
    available: true,
    delayAfterFirstComplete: optimumTriggerTime,
    result: makeTriggeredRoute(optimumTriggerTime)
  };
  const blindspotEntry = findBlindspotEntryTime(
    (time) => {
      const outsideSegments = outsideFirstSegments.slice();
      appendLine(outsideSegments, outsideFirst.endTime, time, settings.speedNmPerSec);
      return mapRoleStates(
        roles,
        stateAt(outsideSegments, time, settings.speedNmPerSec),
        {
          point: add(roles.insideStart, scale(forward(startHeading), settings.speedNmPerSec * time)),
          heading: startHeading
        }
      );
    },
    outsideFirst.endTime,
    getEqualSpacingSearchDuration(settings, outsideFirst.duration),
    settings.blindspotRad,
    roles.insideAircraft,
    roles.outsideAircraft
  );

  let insideTriggerTime = outsideFirst.endTime + settings.fixedWait;
  let crossing: CrossingResult | null = null;

  if (settings.mode === "cross") {
    const insideAtOutsideFirst = stateAt([makeLine(0, roles.insideStart, startHeading, outsideFirst.endTime, settings.speedNmPerSec)], outsideFirst.endTime, settings.speedNmPerSec);
    crossing = solveLineIntersection(outsideFirst.endPoint, outsideFirst.endHeading, insideAtOutsideFirst.point, startHeading);
    insideTriggerTime = crossing && crossing.a1Distance >= 0
      ? outsideFirst.endTime + crossing.a1Distance / settings.speedNmPerSec
      : outsideFirst.endTime;
  } else if (settings.mode === "fixed") {
    insideTriggerTime = outsideFirst.endTime + settings.fixedWait;
  } else if (settings.mode === "blindspot") {
    insideTriggerTime = blindspotEntry.time;
  } else if (settings.mode === "optimum") {
    insideTriggerTime = equalSpacing.delayAfterFirstComplete ?? outsideFirst.endTime;
  }

  const selectedRoute = makeTriggeredRoute(insideTriggerTime);
  return finishTriggeredRoute(settings, radius, roles, selectedRoute, {
    firstTurnCompleteTime: outsideFirst.endTime,
    outsideFirstTurnCompleteTime: outsideFirst.endTime,
    insideFirstTurnStartTime: 0,
    insideFirstTurnCompleteTime: 0,
    a1FirstTurnCompleteTime: roles.outsideAircraft === "a1" ? outsideFirst.endTime : 0,
    a2FirstTurnStartTime: 0,
    a2FirstTurnCompleteTime: roles.outsideAircraft === "a2" ? outsideFirst.endTime : 0,
    equalSpacing,
    crossing
  });
}

function buildAssistedRoute(settings: ManeuverParams): Route {
  const radius = getTurnRadius(settings);
  const startHeading = 0;
  const roles = getTurnRoles(settings);
  const crossingAngle = settings.overturnRad;
  const returnAngle = settings.angleRad + crossingAngle;

  const outsideFirst = makeArc(0, roles.outsideStart, startHeading, settings.sign, settings.angleRad, radius, settings.speedNmPerSec);
  const insideTurnInStartTime = settings.firstStartMode === "outside-first" ? outsideFirst.endTime : 0;
  const insideTurnInStartPoint = add(roles.insideStart, scale(forward(startHeading), settings.speedNmPerSec * insideTurnInStartTime));
  const insideTurnIn = makeArc(insideTurnInStartTime, insideTurnInStartPoint, startHeading, -settings.sign, crossingAngle, radius, settings.speedNmPerSec);
  const outsideFirstSegments = [outsideFirst];
  const insideTurnInSegments = insideTurnInStartTime > 0
    ? [makeLine(0, roles.insideStart, startHeading, insideTurnInStartTime, settings.speedNmPerSec), insideTurnIn]
    : [insideTurnIn];

  function stateAfterTurnIn(segments: Segment[], firstEndTime: number, time: number): AircraftState {
    const tempSegments = segments.slice();
    appendLine(tempSegments, firstEndTime, time, settings.speedNmPerSec);
    return stateAt(tempSegments, time, settings.speedNmPerSec);
  }

  function makeTriggeredRoute(returnTriggerTime: number): TriggeredRouteResult {
    const safeReturnTriggerTime = Math.max(returnTriggerTime, insideTurnIn.endTime);
    const outsideSegments = outsideFirstSegments.slice();
    appendLine(outsideSegments, outsideFirst.endTime, safeReturnTriggerTime, settings.speedNmPerSec);
    const outsideAtTrigger = stateAt(outsideSegments, safeReturnTriggerTime, settings.speedNmPerSec);

    const insideSegments = insideTurnInSegments.slice();
    appendLine(insideSegments, insideTurnIn.endTime, safeReturnTriggerTime, settings.speedNmPerSec);
    const insideAtTrigger = stateAt(insideSegments, safeReturnTriggerTime, settings.speedNmPerSec);
    const insideReturn = makeArc(safeReturnTriggerTime, insideAtTrigger.point, insideAtTrigger.heading, settings.sign, returnAngle, radius, settings.speedNmPerSec);
    insideSegments.push(insideReturn);

    const maneuverEnd = Math.max(outsideFirst.endTime, insideReturn.endTime);
    appendLine(outsideSegments, safeReturnTriggerTime, maneuverEnd, settings.speedNmPerSec);
    appendLine(insideSegments, insideReturn.endTime, maneuverEnd, settings.speedNmPerSec);

    const mappedSegments = mapRoleSegments(roles, outsideSegments, insideSegments);
    const mappedTimes = mapRoleTimes(roles, safeReturnTriggerTime, safeReturnTriggerTime);
    const completionA1 = stateAt(mappedSegments.a1Segments, maneuverEnd, settings.speedNmPerSec).point;
    const completionA2 = stateAt(mappedSegments.a2Segments, maneuverEnd, settings.speedNmPerSec).point;
    const completionSpacing = distance(completionA1, completionA2);

    return {
      ...mappedSegments,
      ...mappedTimes,
      maneuverEnd,
      completionA1,
      completionA2,
      completionSpacing,
      outsideTriggerTime: safeReturnTriggerTime,
      insideTriggerTime: safeReturnTriggerTime,
      triggerOutside: outsideAtTrigger.point,
      triggerInside: insideAtTrigger.point
    };
  }

  const equalSpacing = solveEqualSpacingDelay(
    (delay) => makeTriggeredRoute(insideTurnIn.endTime + delay),
    settings.separation,
    getEqualSpacingSearchDuration(settings, Math.max(outsideFirst.duration, insideTurnIn.duration))
  );
  const blindspotReferenceTime = Math.max(outsideFirst.endTime, insideTurnIn.endTime);
  const blindspotEntry = findBlindspotEntryTime(
    (time) => mapRoleStates(
      roles,
      stateAfterTurnIn(outsideFirstSegments, outsideFirst.endTime, time),
      stateAfterTurnIn(insideTurnInSegments, insideTurnIn.endTime, time)
    ),
    blindspotReferenceTime,
    getEqualSpacingSearchDuration(settings, Math.max(outsideFirst.duration, insideTurnIn.duration)),
    settings.blindspotRad,
    roles.insideAircraft,
    roles.outsideAircraft
  );

  let returnTriggerTime = insideTurnIn.endTime + settings.fixedWait;
  let crossing: CrossingResult | null = null;

  if (settings.mode === "cross") {
    const crossingReferenceTime = Math.max(outsideFirst.endTime, insideTurnIn.endTime);
    const outsideAtCrossingReference = stateAfterTurnIn(outsideFirstSegments, outsideFirst.endTime, crossingReferenceTime);
    const insideAtCrossingReference = stateAfterTurnIn(insideTurnInSegments, insideTurnIn.endTime, crossingReferenceTime);
    crossing = solveLineIntersection(outsideAtCrossingReference.point, outsideAtCrossingReference.heading, insideAtCrossingReference.point, insideAtCrossingReference.heading);
    returnTriggerTime = crossing && crossing.a1Distance >= 0
      ? crossingReferenceTime + crossing.a1Distance / settings.speedNmPerSec
      : crossingReferenceTime;
  } else if (settings.mode === "fixed") {
    returnTriggerTime = insideTurnIn.endTime + settings.fixedWait;
  } else if (settings.mode === "blindspot") {
    returnTriggerTime = blindspotEntry.time;
  } else if (settings.mode === "optimum") {
    returnTriggerTime = insideTurnIn.endTime + (equalSpacing.delayAfterFirstComplete ?? 0);
  }

  const selectedRoute = makeTriggeredRoute(returnTriggerTime);
  return finishTriggeredRoute(settings, radius, roles, selectedRoute, {
    firstTurnCompleteTime: outsideFirst.endTime,
    outsideFirstTurnCompleteTime: outsideFirst.endTime,
    insideFirstTurnStartTime: insideTurnIn.startTime,
    insideFirstTurnCompleteTime: insideTurnIn.endTime,
    a1FirstTurnCompleteTime: roles.outsideAircraft === "a1" ? outsideFirst.endTime : insideTurnIn.endTime,
    a2FirstTurnStartTime: roles.insideAircraft === "a2" ? insideTurnIn.startTime : 0,
    a2FirstTurnCompleteTime: roles.outsideAircraft === "a2" ? outsideFirst.endTime : insideTurnIn.endTime,
    equalSpacing,
    crossing
  });
}

function finishTriggeredRoute(
  settings: ManeuverParams,
  radius: number,
  roles: TurnRoles,
  selectedRoute: TriggeredRouteResult,
  extras: Pick<Route, "firstTurnCompleteTime" | "a1FirstTurnCompleteTime" | "a2FirstTurnStartTime" | "a2FirstTurnCompleteTime" | "equalSpacing" | "crossing"> & Partial<Route>
): Route {
  const a1Segments = selectedRoute.a1Segments;
  const a2Segments = selectedRoute.a2Segments;
  const maneuverEnd = selectedRoute.maneuverEnd;
  const totalTime = maneuverEnd + FINAL_LEAD_SECONDS;
  appendLine(a1Segments, maneuverEnd, totalTime, settings.speedNmPerSec);
  appendLine(a2Segments, maneuverEnd, totalTime, settings.speedNmPerSec);

  return {
    radius,
    a1Segments,
    a2Segments,
    a1Start: roles.a1Start,
    a2Start: roles.a2Start,
    outsideAircraft: roles.outsideAircraft,
    insideAircraft: roles.insideAircraft,
    outsideTriggerTime: selectedRoute.outsideTriggerTime,
    insideTriggerTime: selectedRoute.insideTriggerTime,
    a1TriggerTime: selectedRoute.a1TriggerTime,
    a2TriggerTime: selectedRoute.a2TriggerTime,
    totalTime,
    maneuverEnd,
    completionA1: selectedRoute.completionA1,
    completionA2: selectedRoute.completionA2,
    completionSpacing: selectedRoute.completionSpacing,
    blindspotTime: computeBlindspotTime(a1Segments, a2Segments, maneuverEnd, settings.speedNmPerSec, settings.blindspotRad),
    samples: {
      a1: sampleSegments(a1Segments, totalTime, settings.speedNmPerSec),
      a2: sampleSegments(a2Segments, totalTime, settings.speedNmPerSec)
    },
    notes: [],
    ...extras
  };
}

function finalizeRoute(
  settings: ManeuverParams,
  radius: number,
  a1Segments: Segment[],
  a2Segments: Segment[],
  a1Start: Point,
  a2Start: Point,
  maneuverEnd: number,
  extras: Partial<Route> = {}
): Route {
  const completionA1 = stateAt(a1Segments, maneuverEnd, settings.speedNmPerSec).point;
  const completionA2 = stateAt(a2Segments, maneuverEnd, settings.speedNmPerSec).point;
  const completionSpacing = distance(completionA1, completionA2);
  const totalTime = maneuverEnd + FINAL_LEAD_SECONDS;
  appendLine(a1Segments, maneuverEnd, totalTime, settings.speedNmPerSec);
  appendLine(a2Segments, maneuverEnd, totalTime, settings.speedNmPerSec);

  return {
    radius,
    a1Segments,
    a2Segments,
    a1Start,
    a2Start,
    a1TriggerTime: 0,
    a2TriggerTime: 0,
    firstTurnCompleteTime: maneuverEnd,
    a1FirstTurnCompleteTime: maneuverEnd,
    a2FirstTurnStartTime: 0,
    a2FirstTurnCompleteTime: maneuverEnd,
    totalTime,
    maneuverEnd,
    completionA1,
    completionA2,
    completionSpacing,
    blindspotTime: computeBlindspotTime(a1Segments, a2Segments, maneuverEnd, settings.speedNmPerSec, settings.blindspotRad),
    equalSpacing: { available: false },
    crossing: null,
    samples: {
      a1: sampleSegments(a1Segments, totalTime, settings.speedNmPerSec),
      a2: sampleSegments(a2Segments, totalTime, settings.speedNmPerSec)
    },
    showTriggerMarkers: false,
    notes: [],
    ...extras
  };
}

export function sampleSegments(segments: Segment[], totalTime: number, speed: number) {
  const step = clamp(totalTime / 700, 0.035, 0.16);
  const points = [];
  for (let time = 0; time < totalTime; time += step) {
    const state = stateAt(segments, time, speed);
    points.push({ time, x: state.point.x, y: state.point.y });
  }
  const finalState = stateAt(segments, totalTime, speed);
  points.push({ time: totalTime, x: finalState.point.x, y: finalState.point.y });
  return points;
}

function solveLineIntersection(p1: Point, h1: number, p2: Point, h2: number): CrossingResult | null {
  const v1 = forward(h1);
  const v2 = forward(h2);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const det = v2.x * v1.y - v1.x * v2.y;
  if (Math.abs(det) < 0.000001) {
    return null;
  }
  const s1 = (v2.x * dy - v2.y * dx) / det;
  const s2 = (v1.x * dy - v1.y * dx) / det;
  return {
    a1Distance: s1,
    a2Distance: s2,
    point: add(p1, scale(v1, s1))
  };
}

function solveEqualSpacingDelay(
  spacingAtDelay: (delay: number) => TriggeredRouteResult,
  targetSpacing: number,
  searchDuration: number
): EqualSpacingResult {
  const tolerance = 0.001;
  let previousDelay = 0;
  let previousResult = spacingAtDelay(previousDelay);
  let previousDiff = previousResult.completionSpacing - targetSpacing;
  let nearestDelay = previousDelay;
  let nearestResult = previousResult;
  let nearestDiff = previousDiff;

  if (Math.abs(previousDiff) <= tolerance) {
    return {
      available: true,
      delayAfterFirstComplete: previousDelay,
      result: previousResult
    };
  }

  let bracket: { lowDelay: number; highDelay: number; lowDiff: number; highDiff: number } | null = null;
  const steps = clamp(Math.ceil(searchDuration / 0.25), 260, 5000);
  const scanStep = searchDuration / steps;
  for (let index = 1; index <= steps; index += 1) {
    const delay = (searchDuration * index) / steps;
    const result = spacingAtDelay(delay);
    const diff = result.completionSpacing - targetSpacing;

    if (Math.abs(diff) < Math.abs(nearestDiff)) {
      nearestDelay = delay;
      nearestResult = result;
      nearestDiff = diff;
    }

    if (Math.abs(diff) <= tolerance) {
      return {
        available: true,
        delayAfterFirstComplete: delay,
        result
      };
    }

    if ((previousDiff < 0 && diff > 0) || (previousDiff > 0 && diff < 0)) {
      bracket = {
        lowDelay: previousDelay,
        highDelay: delay,
        lowDiff: previousDiff,
        highDiff: diff
      };
      break;
    }

    previousDelay = delay;
    previousResult = result;
    previousDiff = diff;
  }

  if (!bracket) {
    const refined = refineNearestSpacingDelay(
      spacingAtDelay,
      targetSpacing,
      Math.max(0, nearestDelay - scanStep),
      Math.min(searchDuration, nearestDelay + scanStep)
    );
    if (Math.abs(refined.diff) <= tolerance) {
      return {
        available: true,
        delayAfterFirstComplete: refined.delay,
        result: refined.result
      };
    }
    return {
      available: false,
      delayAfterFirstComplete: refined.delay,
      result: refined.result,
      nearest: refined.result,
      nearestDelay: refined.delay,
      nearestDiff: refined.diff
    };
  }

  let lowDelay = bracket.lowDelay;
  let highDelay = bracket.highDelay;
  let lowDiff = bracket.lowDiff;
  let bestResult = previousResult;
  let bestDelay = lowDelay;

  for (let index = 0; index < 42; index += 1) {
    const midDelay = (lowDelay + highDelay) / 2;
    const midResult = spacingAtDelay(midDelay);
    const midDiff = midResult.completionSpacing - targetSpacing;
    bestResult = midResult;
    bestDelay = midDelay;

    if (Math.abs(midDiff) <= tolerance) {
      break;
    }

    if ((lowDiff < 0 && midDiff > 0) || (lowDiff > 0 && midDiff < 0)) {
      highDelay = midDelay;
    } else {
      lowDelay = midDelay;
      lowDiff = midDiff;
    }
  }

  return {
    available: true,
    delayAfterFirstComplete: bestDelay,
    result: bestResult
  };
}

function refineNearestSpacingDelay(
  spacingAtDelay: (delay: number) => TriggeredRouteResult,
  targetSpacing: number,
  lowDelay: number,
  highDelay: number
) {
  let low = lowDelay;
  let high = highDelay;

  for (let index = 0; index < 36; index += 1) {
    const left = low + (high - low) / 3;
    const right = high - (high - low) / 3;
    const leftResult = spacingAtDelay(left);
    const rightResult = spacingAtDelay(right);
    const leftDiff = Math.abs(leftResult.completionSpacing - targetSpacing);
    const rightDiff = Math.abs(rightResult.completionSpacing - targetSpacing);

    if (leftDiff <= rightDiff) {
      high = right;
    } else {
      low = left;
    }
  }

  const delay = (low + high) / 2;
  const result = spacingAtDelay(delay);
  return {
    delay,
    result,
    diff: result.completionSpacing - targetSpacing
  };
}

function getEqualSpacingSearchDuration(settings: ManeuverParams, referenceDuration: number): number {
  const spacingTime = settings.separation / Math.max(settings.speedNmPerSec, 0.0001);
  return Math.max(30, referenceDuration * 8, spacingTime * 12);
}

function getUnassistedOptimumTriggerTime(settings: ManeuverParams): number {
  const halfAngle = Math.max(settings.angleRad / 2, 0.0001);
  const spacingTime = settings.separation / Math.max(settings.speedNmPerSec, 0.0001);
  return spacingTime / Math.tan(halfAngle);
}

function isInBlindspot(observer: AircraftState, target: AircraftState, coneAngle: number): boolean {
  const offset = sub(target.point, observer.point);
  if (Math.hypot(offset.x, offset.y) < 0.0001) {
    return false;
  }
  const bearing = Math.atan2(offset.y, offset.x);
  const tailBearing = observer.heading + Math.PI;
  return angularDistance(bearing, tailBearing) <= coneAngle / 2;
}

function isBlindspotEntryCondition(
  getStates: (time: number) => Record<AircraftId, AircraftState>,
  time: number,
  coneAngle: number,
  observerAircraft: AircraftId = "a2",
  targetAircraft: AircraftId = "a1"
): boolean {
  const states = getStates(time);
  return isInBlindspot(states[observerAircraft], states[targetAircraft], coneAngle);
}

function findBlindspotEntryTime(
  getStates: (time: number) => Record<AircraftId, AircraftState>,
  startTime: number,
  searchDuration: number,
  coneAngle: number,
  observerAircraft: AircraftId = "a2",
  targetAircraft: AircraftId = "a1"
) {
  let previousTime = startTime;
  let previousInside = isBlindspotEntryCondition(getStates, previousTime, coneAngle, observerAircraft, targetAircraft);
  if (previousInside) {
    return {
      available: true,
      time: startTime
    };
  }

  const steps = clamp(Math.ceil(searchDuration / 0.05), 320, 7000);
  for (let index = 1; index <= steps; index += 1) {
    const time = startTime + (searchDuration * index) / steps;
    const inside = isBlindspotEntryCondition(getStates, time, coneAngle, observerAircraft, targetAircraft);
    if (!previousInside && inside) {
      let low = previousTime;
      let high = time;
      for (let refine = 0; refine < 36; refine += 1) {
        const mid = (low + high) / 2;
        if (isBlindspotEntryCondition(getStates, mid, coneAngle, observerAircraft, targetAircraft)) {
          high = mid;
        } else {
          low = mid;
        }
      }
      return {
        available: true,
        time: high
      };
    }
    previousTime = time;
    previousInside = inside;
  }

  return {
    available: false,
    time: startTime
  };
}

function computeBlindspotTime(
  a1Segments: Segment[],
  a2Segments: Segment[],
  maneuverEnd: number,
  speed: number,
  coneAngle: number
): number {
  if (maneuverEnd <= 0) {
    return 0;
  }

  const step = clamp(maneuverEnd / 900, 0.025, 0.1);
  let total = 0;
  for (let start = 0; start < maneuverEnd; start += step) {
    const end = Math.min(maneuverEnd, start + step);
    const time = (start + end) / 2;
    const a1 = stateAt(a1Segments, time, speed);
    const a2 = stateAt(a2Segments, time, speed);
    if (isInBlindspot(a1, a2, coneAngle) || isInBlindspot(a2, a1, coneAngle)) {
      total += end - start;
    }
  }
  return total;
}
