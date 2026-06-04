import { useEffect, useMemo, useRef, useState } from "react";
import { Controls } from "./components/Controls";
import { Diagram } from "./components/Diagram";
import { Header } from "./components/Header";
import { ManeuverNav } from "./components/ManeuverNav";
import { Scrubber } from "./components/Scrubber";
import { AIRCRAFT_PROFILES, DEFAULT_CONTROLS } from "./domain/constants";
import { clamp } from "./domain/math";
import { buildRoute, controlsToParams } from "./domain/route";
import type { ControlsState, ManeuverType } from "./domain/types";
import { useElementSize } from "./hooks/useElementSize";

export function App() {
  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState<string | null>(null);
  const [compactOpenSection, setCompactOpenSection] = useState("maneuver");
  const [compactControls, setCompactControls] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const viewport = useElementSize(stageRef);

  const params = useMemo(() => controlsToParams(controls), [controls]);
  const route = useMemo(() => buildRoute(params), [params]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 560px)");
    const update = () => setCompactControls(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setElapsed((value) => clamp(value, 0, route.totalTime));
    setActiveTrigger(null);
  }, [route.totalTime]);

  useEffect(() => {
    if (!playing) {
      return;
    }

    let frameId = 0;
    let lastFrameTime = 0;
    const tick = (timestamp: number) => {
      if (!lastFrameTime) {
        lastFrameTime = timestamp;
      }
      const deltaSeconds = (timestamp - lastFrameTime) / 1000;
      lastFrameTime = timestamp;

      setElapsed((value) => {
        const next = clamp(value + deltaSeconds, 0, route.totalTime);
        if (next >= route.totalTime) {
          setPlaying(false);
        }
        return next;
      });
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [playing, route.totalTime]);

  const updateControls = (next: Partial<ControlsState>) => {
    setControls((current) => ({ ...current, ...next }));
  };

  const handleManeuverChange = (maneuverType: ManeuverType) => {
    setControls((current) => ({
      ...current,
      maneuverType,
      firstStartMode: maneuverType === "assisted"
        ? "outside-first"
        : maneuverType === "double"
          ? "simultaneous"
          : current.firstStartMode
    }));
  };

  const handlePlayPause = () => {
    if (!playing && elapsed >= route.totalTime - 0.05) {
      setElapsed(0);
    }
    setPlaying((value) => !value);
  };

  return (
    <main className="app">
      <ManeuverNav value={controls.maneuverType} onChange={handleManeuverChange} />
      <Header params={params} route={route} elapsed={elapsed} />
      <section className="workspace">
        <Controls
          controls={controls}
          params={params}
          compact={compactControls}
          compactOpenSection={compactOpenSection}
          onCompactOpenSection={setCompactOpenSection}
          onChange={(next) => {
            if (next.aircraftKey) {
              const aircraft = AIRCRAFT_PROFILES[next.aircraftKey];
              updateControls({
                ...next,
                turnLoadFactor: Math.min(next.turnLoadFactor ?? aircraft.milSustainedG, aircraft.maxTurnG)
              });
              return;
            }
            updateControls(next);
          }}
        />
        <div className="stage" ref={stageRef} role="img" aria-label="Animated tactical turn plot">
          <Diagram
            controls={controls}
            params={params}
            route={route}
            elapsed={elapsed}
            viewport={viewport}
            activeTrigger={activeTrigger}
            onActiveTriggerChange={setActiveTrigger}
            onControlsChange={updateControls}
          />
        </div>
      </section>
      <Scrubber
        elapsed={elapsed}
        totalTime={route.totalTime}
        playing={playing}
        onElapsedChange={(value) => {
          setPlaying(false);
          setElapsed(clamp(value, 0, route.totalTime));
        }}
        onPlayPause={handlePlayPause}
      />
    </main>
  );
}
