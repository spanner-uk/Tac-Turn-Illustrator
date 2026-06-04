import { isUnassistedManeuver } from "./route";
import type { ManeuverParams, ManeuverType } from "./types";

export interface ManeuverInfo {
  description: string[];
  pros: string[];
  cons: string[];
}

export function getManeuverTitle(type: ManeuverType): string {
  if (type === "hook") {
    return "Hook";
  }
  if (type === "cross180") {
    return "Cross";
  }
  if (type === "check") {
    return "Check";
  }
  if (type === "shackle") {
    return "Shackle";
  }
  if (type === "turn90") {
    return "90";
  }
  if (type === "unassisted") {
    return "Unassisted Tactical Turn";
  }
  if (type === "assisted") {
    return "Assisted Tactical Turn";
  }
  return "Double Assisted Tactical Turn";
}

export function getSecondTurnHeading(params: ManeuverParams): string {
  if (isUnassistedManeuver(params.maneuverType)) {
    return "Inside turn";
  }
  if (params.maneuverType === "assisted") {
    return "Return turn";
  }
  return "Second turn";
}

export function getFixedWaitLabel(params: ManeuverParams): string {
  if (isUnassistedManeuver(params.maneuverType)) {
    return "Wait after outside turn";
  }
  if (params.maneuverType === "assisted") {
    return "Wait after A2 turn-in";
  }
  return "Wait after first turn completed";
}

export function getManeuverInfo(type: ManeuverType): ManeuverInfo {
  if (type === "hook") {
    return {
      description: [
        "Both aircraft perform the same 180 degree turn and reverse course while maintaining their spacing. Can either maintain contract speed, or max performance turn at mil or buster."
      ],
      pros: ["Offsets the flight for the return leg.", "Maintains spacing"],
      cons: []
    };
  }
  if (type === "cross180") {
    return {
      description: [
        "Both aircraft perform simultaneous 180 degree turns into each other. Wingman should deconflict below and slightly outside of lead for a close pass."
      ],
      pros: ["Minimal space required."],
      cons: ["Unlikely to maintain spacing."]
    };
  }
  if (type === "check") {
    return {
      description: ["Both aircraft make the same simultaneous turn without crossing over."],
      pros: ["Easy", "Can also be used to re-align a formation"],
      cons: ["Inside aircraft moves forwards, outside moves backwards"]
    };
  }
  if (type === "shackle") {
    return {
      description: [
        "Both aircraft turn 45 degrees into each other, continue until positions are switched, then turn back out onto the original heading. Wingman deconflicts from lead; below, or if no space, behind."
      ],
      pros: ["Can be used to adjust spacing if desired."],
      cons: []
    };
  }
  if (isUnassistedManeuver(type)) {
    return {
      description: ["Outside aircraft turns onto heading. Inside aircraft turns onto heading."],
      pros: ["Very easy", "Reliable 90 degree turn using crossing visual cues.", "Both aircraft traverse the same distance."],
      cons: ["Takes more time and more space, especially at shallower turn angles."]
    };
  }
  if (type === "assisted") {
    return {
      description: [
        "Outside aircraft makes the turn. Inside aircraft waits for outside aircraft's turn to complete (wings level) and turns across the front, then turns back to roll out on final heading."
      ],
      pros: ["Easy for outside aircraft."],
      cons: ["Inside aircraft travels further and will fall behind slightly if speed is maintained.", "Takes a little longer."]
    };
  }
  return {
    description: [
      "Both aircraft turn in to each other. Outside aircraft overturns beyond the final heading. Inside aircraft turns by the overturn amount."
    ],
    pros: ["Same distance travelled.", "Fast (maintain visual cross cover, less space needed)"],
    cons: ["More complex"]
  };
}
