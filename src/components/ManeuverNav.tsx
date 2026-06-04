import { MANEUVER_PRIMARY_TABS, MANEUVER_SECONDARY_TABS } from "../domain/constants";
import type { ManeuverType } from "../domain/types";
import { SegmentedControl } from "./SegmentedControl";

interface ManeuverNavProps {
  value: ManeuverType;
  onChange(value: ManeuverType): void;
}

export function ManeuverNav({ value, onChange }: ManeuverNavProps) {
  return (
    <nav className="maneuver-nav" aria-label="Maneuver type">
      <SegmentedControl
        ariaLabel="Primary maneuver type"
        className="tabs"
        name="maneuver-primary"
        options={MANEUVER_PRIMARY_TABS}
        value={MANEUVER_PRIMARY_TABS.some((item) => item.value === value) ? value : ("" as ManeuverType)}
        onChange={onChange}
      />
      <SegmentedControl
        ariaLabel="Secondary maneuver type"
        className="tabs secondary-tabs"
        name="maneuver-secondary"
        options={MANEUVER_SECONDARY_TABS}
        value={MANEUVER_SECONDARY_TABS.some((item) => item.value === value) ? value : ("" as ManeuverType)}
        onChange={onChange}
      />
    </nav>
  );
}
