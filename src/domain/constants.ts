import type { AircraftKey, AircraftProfile, ControlsState } from "./types";

export const KNOTS_TO_FEET_PER_SECOND = 1.68780986;
export const FEET_PER_NM = 6076.11549;
export const GRAVITY_FTPS2 = 32.174;
export const MIN_TURN_RADIUS_NM = 0.08;
export const FINAL_LEAD_SECONDS = 8;

// Practical MIL-turn starting points; exact Ps=0 G varies with altitude, weight, stores, and temperature.
export const AIRCRAFT_PROFILES: Record<AircraftKey, AircraftProfile> = {
  f16Block20: {
    label: "F-16C",
    milSustainedG: 4.8,
    maxTurnG: 9
  },
  fa18c: {
    label: "F/A-18C",
    milSustainedG: 4.5,
    maxTurnG: 7.5
  },
  f14b: {
    label: "F-14B",
    milSustainedG: 4.5,
    maxTurnG: 6.5
  }
};

export const DEFAULT_CONTROLS: ControlsState = {
  maneuverType: "double",
  angleDeg: 45,
  direction: "left",
  firstStartMode: "simultaneous",
  overturnDeg: 20,
  lockOverturnToHalf: false,
  separation: 1,
  speedKts: 420,
  aircraftKey: "fa18c",
  turnLoadFactor: 4.5,
  mode: "optimum",
  fixedWait: 3,
  blindspotDeg: 30,
  showBlindspots: false
};

export const AIRCRAFT_COLORS = {
  a1: "#d95f43",
  a2: "#1f7a8c",
  a1Soft: "rgba(217, 95, 67, 0.28)",
  a2Soft: "rgba(31, 122, 140, 0.28)"
} as const;

export const MANEUVER_PRIMARY_TABS = [
  { value: "double", label: "Double assisted" },
  { value: "assisted", label: "Assisted" },
  { value: "unassisted", label: "Unassisted" }
] as const;

export const MANEUVER_SECONDARY_TABS = [
  { value: "turn90", label: "90" },
  { value: "hook", label: "Hook" },
  { value: "cross180", label: "Cross" },
  { value: "check", label: "Check" },
  { value: "shackle", label: "Shackle" }
] as const;
