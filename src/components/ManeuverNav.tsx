import { Stack, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { MANEUVER_PRIMARY_TABS, MANEUVER_SECONDARY_TABS } from "../domain/constants";
import type { ManeuverType } from "../domain/types";

interface ManeuverNavProps {
  value: ManeuverType;
  onChange(value: ManeuverType): void;
}

export function ManeuverNav({ value, onChange }: ManeuverNavProps) {
  return (
    <Stack
      component="nav"
      aria-label="Maneuver type"
      spacing={1}
      sx={{
        gridArea: "nav",
        position: "sticky",
        top: 0,
        zIndex: 10,
        bgcolor: "background.default"
      }}
    >
      <ToggleButtonGroup
        exclusive
        fullWidth
        value={MANEUVER_PRIMARY_TABS.some((item) => item.value === value) ? value : null}
        aria-label="Primary maneuver type"
        onChange={(_, next: ManeuverType | null) => {
          if (next) {
            onChange(next);
          }
        }}
      >
        {MANEUVER_PRIMARY_TABS.map((option) => (
          <ToggleButton key={option.value} value={option.value}>
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <ToggleButtonGroup
        exclusive
        fullWidth
        value={MANEUVER_SECONDARY_TABS.some((item) => item.value === value) ? value : null}
        aria-label="Secondary maneuver type"
        onChange={(_, next: ManeuverType | null) => {
          if (next) {
            onChange(next);
          }
        }}
      >
        {MANEUVER_SECONDARY_TABS.map((option) => (
          <ToggleButton key={option.value} value={option.value}>
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Stack>
  );
}
