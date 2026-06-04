import { describe, expect, it } from "vitest";
import { DEFAULT_CONTROLS } from "../src/domain/constants";
import { buildRoute, controlsToParams } from "../src/domain/route";
import type { ControlsState, ManeuverType } from "../src/domain/types";

const maneuvers: ManeuverType[] = [
  "double",
  "assisted",
  "unassisted",
  "turn90",
  "hook",
  "cross180",
  "check",
  "shackle"
];

function makeControls(overrides: Partial<ControlsState> = {}) {
  return {
    ...DEFAULT_CONTROLS,
    ...overrides
  };
}

describe("route generation", () => {
  it.each(maneuvers)("builds a finite %s route", (maneuverType) => {
    const params = controlsToParams(makeControls({ maneuverType }));
    const route = buildRoute(params);

    expect(route.radius).toBeGreaterThan(0);
    expect(route.totalTime).toBeGreaterThan(route.maneuverEnd);
    expect(route.samples.a1.length).toBeGreaterThan(2);
    expect(route.samples.a2.length).toBeGreaterThan(2);
    expect(Number.isFinite(route.completionSpacing)).toBe(true);
    expect(Number.isFinite(route.blindspotTime)).toBe(true);
  });

  it("keeps the default numeric route stable", () => {
    const params = controlsToParams(DEFAULT_CONTROLS);
    const route = buildRoute(params);

    expect(route.radius).toBeCloseTo(0.585867, 6);
    expect(route.maneuverEnd).toBeCloseTo(16.390577, 6);
    expect(route.totalTime).toBeCloseTo(route.maneuverEnd + 8, 6);
    expect(route.completionSpacing).toBeCloseTo(1, 2);
    expect(route.blindspotTime).toBeGreaterThanOrEqual(0);
    expect(route.a1TriggerTime).toBeGreaterThan(0);
    expect(route.a2TriggerTime).toBeGreaterThan(0);
  });

  it("locks overturn to half the turn angle in params", () => {
    const params = controlsToParams(makeControls({ angleDeg: 60, lockOverturnToHalf: true }));

    expect(params.overturnDeg).toBe(30);
    expect(params.overturnRad).toBeCloseTo(Math.PI / 6);
  });
});
