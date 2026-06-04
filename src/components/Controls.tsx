import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import type { ReactNode } from "react";
import { AIRCRAFT_PROFILES } from "../domain/constants";
import { formatDegrees, formatG, formatNm, formatSeconds } from "../domain/format";
import { getFixedWaitLabel, getSecondTurnHeading } from "../domain/maneuverInfo";
import { needsDirectionControl, needsSecondTurnControl, needsTurnAngleControl } from "../domain/route";
import type { AircraftKey, ControlsState, Direction, FirstStartMode, ManeuverParams, TimingMode } from "../domain/types";

interface ControlsProps {
  controls: ControlsState;
  params: ManeuverParams;
  compact: boolean;
  onChange(next: Partial<ControlsState>): void;
  compactOpenSection: string;
  onCompactOpenSection(section: string): void;
}

const directionOptions = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" }
] as const;

const firstStartOptions = [
  { value: "simultaneous", label: "Simultaneous" },
  { value: "outside-first", label: "Outside first" }
] as const;

const timingOptions = [
  { value: "optimum", label: "Optimum" },
  { value: "cross", label: "At crossing" },
  { value: "blindspot", label: "At blindspot" },
  { value: "fixed", label: "Fixed wait" }
] as const;

function sliderValue(value: number | number[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function Controls({ controls, params, compact, onChange, compactOpenSection, onCompactOpenSection }: ControlsProps) {
  const angleMin = params.maneuverType === "check" ? 1 : 20;
  const angleMax = params.maneuverType === "unassisted" || params.maneuverType === "turn90" || params.maneuverType === "check" ? 90 : 70;
  const fixed = needsSecondTurnControl(params.maneuverType) && params.mode === "fixed";

  const expanded = (section: string) => !compact || compactOpenSection === section;
  const onAccordionChange = (section: string) => (_: unknown, nextExpanded: boolean) => {
    if (nextExpanded) {
      onCompactOpenSection(section);
    }
  };

  return (
    <Paper
      component="aside"
      variant="outlined"
      aria-label="Maneuver controls"
      sx={{
        gridArea: "controls",
        minWidth: 0,
        alignSelf: "stretch",
        overflow: "auto",
        "@media (max-width: 1024px)": {
          order: 5,
          overflow: "visible"
        },
        "@media (max-width: 1024px) and (orientation: landscape)": {
          order: 0,
          minHeight: 0,
          overflow: "auto"
        }
      }}
    >
      <Section title="Maneuver" expanded={expanded("maneuver")} onChange={onAccordionChange("maneuver")}>
        {needsTurnAngleControl(params.maneuverType) && (
          <ControlSlider
            label="Turn angle"
            valueLabel={formatDegrees(params.angleDeg)}
            value={params.angleDeg}
            min={angleMin}
            max={angleMax}
            step={1}
            onChange={(value) => onChange({ angleDeg: value })}
          />
        )}

        {needsDirectionControl(params.maneuverType) && (
          <ControlGroup label="Direction">
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={controls.direction}
              aria-label="Turn direction"
              onChange={(_, direction: Direction | null) => {
                if (direction) {
                  onChange({ direction });
                }
              }}
            >
              {directionOptions.map((option) => (
                <ToggleButton key={option.value} value={option.value}>
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </ControlGroup>
        )}

        {(params.maneuverType === "double" || params.maneuverType === "assisted") && (
          <ControlGroup label="First turn">
            <ToggleButtonGroup
              exclusive
              fullWidth
              orientation="vertical"
              size="small"
              value={controls.firstStartMode}
              aria-label="First turn timing"
              onChange={(_, firstStartMode: FirstStartMode | null) => {
                if (firstStartMode) {
                  onChange({ firstStartMode });
                }
              }}
            >
              {firstStartOptions.map((option) => (
                <ToggleButton key={option.value} value={option.value}>
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </ControlGroup>
        )}

        {(params.maneuverType === "double" || params.maneuverType === "assisted") && (
          <ControlGroup label="Overturn" valueLabel={formatDegrees(params.overturnDeg)}>
            <Slider
              aria-label="Overturn"
              min={0}
              max={45}
              step={1}
              value={controls.lockOverturnToHalf ? params.overturnDeg : controls.overturnDeg}
              disabled={controls.lockOverturnToHalf}
              onChange={(_, value) => onChange({ overturnDeg: sliderValue(value) })}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={controls.lockOverturnToHalf}
                  onChange={(event) => onChange({ lockOverturnToHalf: event.target.checked })}
                />
              }
              label="Lock to 50% of turn angle"
            />
          </ControlGroup>
        )}

        <ControlSlider
          label="Spacing"
          valueLabel={formatNm(params.separation)}
          value={controls.separation}
          min={0.5}
          max={5}
          step={0.1}
          onChange={(value) => onChange({ separation: value })}
        />
      </Section>

      <Section title="Aircraft / Performance" expanded={expanded("performance")} onChange={onAccordionChange("performance")}>
        <ControlSlider
          label="Contract speed"
          valueLabel={`${params.speedKts.toFixed(0)} kt`}
          value={controls.speedKts}
          min={180}
          max={600}
          step={10}
          onChange={(value) => onChange({ speedKts: value })}
        />

        <ControlGroup label="Aircraft" valueLabel={`${formatG(params.aircraftMilSustainedG)} MIL`}>
          <FormControl fullWidth size="small">
            <InputLabel id="aircraft-label">Aircraft</InputLabel>
            <Select
              labelId="aircraft-label"
              label="Aircraft"
              value={controls.aircraftKey}
              onChange={(event: SelectChangeEvent) => {
                const aircraftKey = event.target.value as AircraftKey;
                const aircraft = AIRCRAFT_PROFILES[aircraftKey];
                onChange({
                  aircraftKey,
                  turnLoadFactor: Math.min(aircraft.milSustainedG, aircraft.maxTurnG)
                });
              }}
            >
              {Object.entries(AIRCRAFT_PROFILES).map(([key, aircraft]) => (
                <MenuItem key={key} value={key}>
                  {aircraft.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </ControlGroup>

        <ControlSlider
          label="Sustained turn G"
          valueLabel={formatG(params.turnLoadFactor)}
          value={params.turnLoadFactor}
          min={2}
          max={params.aircraftMaxTurnG}
          step={0.1}
          onChange={(value) => onChange({ turnLoadFactor: value })}
        />
      </Section>

      <Section title="Timing" expanded={expanded("timing")} onChange={onAccordionChange("timing")}>
        {needsSecondTurnControl(params.maneuverType) && (
          <ControlGroup label={getSecondTurnHeading(params)}>
            <ToggleButtonGroup
              exclusive
              fullWidth
              orientation="vertical"
              size="small"
              value={controls.mode}
              aria-label="Second turn trigger"
              onChange={(_, mode: TimingMode | null) => {
                if (mode) {
                  onChange({ mode });
                }
              }}
            >
              {timingOptions.map((option) => (
                <ToggleButton key={option.value} value={option.value}>
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </ControlGroup>
        )}

        {needsSecondTurnControl(params.maneuverType) && (
          <ControlSlider
            label={getFixedWaitLabel(params)}
            valueLabel={formatSeconds(params.fixedWait)}
            value={controls.fixedWait}
            min={0}
            max={20}
            step={0.5}
            disabled={!fixed}
            onChange={(value) => onChange({ fixedWait: value })}
          />
        )}
      </Section>

      <Box sx={{ display: { xs: "block", lg: "none" } }}>
        <Section title="Display" expanded={expanded("display")} onChange={onAccordionChange("display")}>
          <ControlSlider
            label="Blindspot"
            valueLabel={formatDegrees(params.blindspotDeg)}
            value={controls.blindspotDeg}
            min={15}
            max={180}
            step={5}
            onChange={(value) => onChange({ blindspotDeg: value })}
          />
          <FormControlLabel
            control={<Switch checked={controls.showBlindspots} onChange={(event) => onChange({ showBlindspots: event.target.checked })} />}
            label="Show blindspots"
          />
        </Section>
      </Box>
    </Paper>
  );
}

function Section({
  title,
  expanded,
  onChange,
  children
}: {
  title: string;
  expanded: boolean;
  onChange(event: unknown, expanded: boolean): void;
  children: ReactNode;
}) {
  return (
    <Accordion disableGutters elevation={0} expanded={expanded} onChange={onChange}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>{children}</Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function ControlGroup({
  label,
  valueLabel,
  children
}: {
  label: string;
  valueLabel?: string;
  children: ReactNode;
}) {
  return (
    <Stack spacing={0.75}>
      <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
        {valueLabel && (
          <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {valueLabel}
          </Typography>
        )}
      </Stack>
      {children}
    </Stack>
  );
}

function ControlSlider({
  label,
  valueLabel,
  value,
  min,
  max,
  step,
  disabled = false,
  onChange
}: {
  label: string;
  valueLabel: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange(value: number): void;
}) {
  return (
    <ControlGroup label={label} valueLabel={valueLabel}>
      <Slider
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(_, nextValue) => onChange(sliderValue(nextValue))}
      />
    </ControlGroup>
  );
}
