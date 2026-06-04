import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Controls } from "../src/components/Controls";
import { DEFAULT_CONTROLS } from "../src/domain/constants";
import { controlsToParams } from "../src/domain/route";
import type { ControlsState } from "../src/domain/types";

function Harness() {
  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);
  const params = controlsToParams(controls);
  return (
    <Controls
      controls={controls}
      params={params}
      compact={false}
      compactOpenSection="maneuver"
      onCompactOpenSection={() => undefined}
      onChange={(next) => setControls((current) => ({ ...current, ...next }))}
    />
  );
}

describe("Controls", () => {
  it("updates readouts when a range changes", async () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText("Contract speed"), { target: { value: "430" } });

    expect(screen.getByText("430 kt")).toBeTruthy();
  });

  it("shows assisted-specific timing labels", async () => {
    render(<Harness />);

    expect(screen.getByText("Second turn")).toBeTruthy();
    expect(screen.getByText("Wait after first turn completed")).toBeTruthy();
  });
});
