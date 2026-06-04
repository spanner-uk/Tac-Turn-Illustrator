import type { SyntheticEvent } from "react";
import { AIRCRAFT_PROFILES } from "../domain/constants";
import { formatDegrees, formatG, formatNm, formatSeconds } from "../domain/format";
import { getFixedWaitLabel, getSecondTurnHeading } from "../domain/maneuverInfo";
import { needsDirectionControl, needsSecondTurnControl, needsTurnAngleControl } from "../domain/route";
import type { AircraftKey, ControlsState, Direction, FirstStartMode, ManeuverParams, TimingMode } from "../domain/types";
import { SegmentedControl } from "./SegmentedControl";

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
  {
    value: "outside-first",
    label: "Outside first",
    title: "Inside aircraft's first turn begins after outside aircraft completes first turn (wings level)"
  }
] as const;

const timingOptions = [
  { value: "optimum", label: "Optimum" },
  { value: "cross", label: "At crossing" },
  { value: "blindspot", label: "At blindspot" },
  { value: "fixed", label: "Fixed wait" }
] as const;

export function Controls({ controls, params, compact, onChange, compactOpenSection, onCompactOpenSection }: ControlsProps) {
  const angleMin = params.maneuverType === "check" ? 1 : 20;
  const angleMax = params.maneuverType === "unassisted" || params.maneuverType === "turn90" || params.maneuverType === "check" ? 90 : 70;
  const fixed = needsSecondTurnControl(params.maneuverType) && params.mode === "fixed";

  const sectionProps = (section: string) => ({
    open: !compact || compactOpenSection === section,
    onToggle: (event: SyntheticEvent<HTMLDetailsElement>) => {
      if (event.currentTarget.open) {
        onCompactOpenSection(section);
      }
    }
  });

  return (
    <aside className="controls" aria-label="Maneuver controls">
      <details className="control-section" data-control-section="maneuver" {...sectionProps("maneuver")}>
        <summary>Maneuver</summary>

        {needsTurnAngleControl(params.maneuverType) && (
          <div className="control-group">
            <div className="control-heading">
              <label htmlFor="turnAngle">Turn angle</label>
              <output htmlFor="turnAngle">{formatDegrees(params.angleDeg)}</output>
            </div>
            <input
              id="turnAngle"
              type="range"
              min={angleMin}
              max={angleMax}
              step="1"
              value={params.angleDeg}
              onChange={(event) => onChange({ angleDeg: Number(event.target.value) })}
            />
          </div>
        )}

        {needsDirectionControl(params.maneuverType) && (
          <div className="control-group">
            <div className="control-heading">Direction</div>
            <SegmentedControl<Direction>
              ariaLabel="Turn direction"
              name="direction"
              options={directionOptions}
              value={controls.direction}
              onChange={(direction) => onChange({ direction })}
            />
          </div>
        )}

        {(params.maneuverType === "double" || params.maneuverType === "assisted") && (
          <div className="control-group">
            <div className="control-heading">First turn</div>
            <SegmentedControl<FirstStartMode>
              ariaLabel="First turn timing"
              className="mode"
              name="firstStart"
              options={firstStartOptions}
              value={controls.firstStartMode}
              onChange={(firstStartMode) => onChange({ firstStartMode })}
            />
          </div>
        )}

        {(params.maneuverType === "double" || params.maneuverType === "assisted") && (
          <div className="control-group">
            <div className="control-heading">
              <label htmlFor="overturn">Overturn</label>
              <output htmlFor="overturn">{formatDegrees(params.overturnDeg)}</output>
            </div>
            <input
              id="overturn"
              type="range"
              min="0"
              max="45"
              step="1"
              value={controls.lockOverturnToHalf ? params.overturnDeg : controls.overturnDeg}
              disabled={controls.lockOverturnToHalf}
              onChange={(event) => onChange({ overturnDeg: Number(event.target.value) })}
            />
            <label className="toggle-row" htmlFor="overturnHalfAngle">
              <span>Lock to 50% of turn angle</span>
              <input
                id="overturnHalfAngle"
                type="checkbox"
                checked={controls.lockOverturnToHalf}
                onChange={(event) => onChange({ lockOverturnToHalf: event.target.checked })}
              />
            </label>
          </div>
        )}

        <div className="control-group">
          <div className="control-heading">
            <label htmlFor="separation">Spacing</label>
            <output htmlFor="separation">{formatNm(params.separation)}</output>
          </div>
          <input
            id="separation"
            type="range"
            min="0.5"
            max="5"
            step="0.1"
            value={controls.separation}
            onChange={(event) => onChange({ separation: Number(event.target.value) })}
          />
        </div>
      </details>

      <details className="control-section" data-control-section="performance" {...sectionProps("performance")}>
        <summary>Aircraft / Performance</summary>

        <div className="control-group">
          <div className="control-heading">
            <label htmlFor="speed">Contract speed</label>
            <output htmlFor="speed">{params.speedKts.toFixed(0)} kt</output>
          </div>
          <input
            id="speed"
            type="range"
            min="180"
            max="600"
            step="10"
            value={controls.speedKts}
            onChange={(event) => onChange({ speedKts: Number(event.target.value) })}
          />
        </div>

        <div className="control-group">
          <div className="control-heading">
            <label htmlFor="aircraft">Aircraft</label>
            <output htmlFor="aircraft">{formatG(params.aircraftMilSustainedG)} MIL</output>
          </div>
          <select
            id="aircraft"
            value={controls.aircraftKey}
            onChange={(event) => {
              const aircraftKey = event.target.value as AircraftKey;
              const aircraft = AIRCRAFT_PROFILES[aircraftKey];
              onChange({
                aircraftKey,
                turnLoadFactor: Math.min(aircraft.milSustainedG, aircraft.maxTurnG)
              });
            }}
          >
            {Object.entries(AIRCRAFT_PROFILES).map(([key, aircraft]) => (
              <option key={key} value={key}>
                {aircraft.label}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <div className="control-heading">
            <label htmlFor="turnLoadFactor">Sustained turn G</label>
            <output htmlFor="turnLoadFactor">{formatG(params.turnLoadFactor)}</output>
          </div>
          <input
            id="turnLoadFactor"
            type="range"
            min="2"
            max={params.aircraftMaxTurnG}
            step="0.1"
            value={params.turnLoadFactor}
            onChange={(event) => onChange({ turnLoadFactor: Number(event.target.value) })}
          />
        </div>
      </details>

      <details className="control-section" data-control-section="timing" {...sectionProps("timing")}>
        <summary>Timing</summary>

        {needsSecondTurnControl(params.maneuverType) && (
          <div className="control-group">
            <div className="control-heading">{getSecondTurnHeading(params)}</div>
            <SegmentedControl<TimingMode>
              ariaLabel="Second turn trigger"
              className="mode"
              name="mode"
              options={timingOptions}
              value={controls.mode}
              onChange={(mode) => onChange({ mode })}
            />
          </div>
        )}

        {needsSecondTurnControl(params.maneuverType) && (
          <div className={`control-group ${fixed ? "" : "disabled"}`.trim()}>
            <div className="control-heading">
              <label htmlFor="fixedWait">{getFixedWaitLabel(params)}</label>
              <output htmlFor="fixedWait">{formatSeconds(params.fixedWait)}</output>
            </div>
            <input
              id="fixedWait"
              type="range"
              min="0"
              max="20"
              step="0.5"
              value={controls.fixedWait}
              disabled={!fixed}
              onChange={(event) => onChange({ fixedWait: Number(event.target.value) })}
            />
          </div>
        )}
      </details>

      <details className="control-section mobile-display-section" data-control-section="display" {...sectionProps("display")}>
        <summary>Display</summary>

        <div className="control-group">
          <div className="control-heading">
            <label htmlFor="mobileBlindspotSize">Blindspot</label>
            <output htmlFor="mobileBlindspotSize">{formatDegrees(params.blindspotDeg)}</output>
          </div>
          <input
            id="mobileBlindspotSize"
            type="range"
            min="15"
            max="180"
            step="5"
            value={controls.blindspotDeg}
            onChange={(event) => onChange({ blindspotDeg: Number(event.target.value) })}
          />
        </div>
        <div className="control-group">
          <label className="toggle-row" htmlFor="mobileShowBlindspots">
            <span>Show blindspots</span>
            <input
              id="mobileShowBlindspots"
              type="checkbox"
              checked={controls.showBlindspots}
              onChange={(event) => onChange({ showBlindspots: event.target.checked })}
            />
          </label>
        </div>
      </details>
    </aside>
  );
}
