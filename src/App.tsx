import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Container } from "@mui/material";
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
    <Container
      component="main"
      maxWidth={false}
      sx={{
        width: "min(1440px, 100%)",
        height: "100dvh",
        minHeight: 0,
        py: 2.5,
        display: "grid",
        gridTemplateRows: "auto auto minmax(0, 1fr) auto",
        gridTemplateAreas: `
          "nav"
          "topbar"
          "workspace"
          "scrubber"
        `,
        gap: 2,
        overflow: "hidden",
        "@media (max-width: 1024px)": {
          height: "auto",
          minHeight: "100dvh",
          gridTemplateRows: "auto auto auto auto auto",
          gridTemplateAreas: `
            "nav"
            "topbar"
            "stage"
            "scrubber"
            "controls"
          `,
          overflow: "visible",
          py: 1.5
        },
        "@media (max-width: 1024px) and (orientation: landscape)": {
          height: "100dvh",
          minHeight: 0,
          gridTemplateColumns: "minmax(0, 1fr) minmax(280px, min(360px, 38vw))",
          gridTemplateRows: "auto auto minmax(0, 1fr) auto",
          gridTemplateAreas: `
            "nav nav"
            "topbar topbar"
            "stage controls"
            "scrubber controls"
          `,
          overflow: "hidden"
        }
      }}
    >
      <ManeuverNav value={controls.maneuverType} onChange={handleManeuverChange} />
      <Header params={params} route={route} elapsed={elapsed} />
      <Box
        component="section"
        className="workspace"
        sx={{
          minHeight: 0,
          gridArea: "workspace",
          display: "grid",
          gridTemplateColumns: "minmax(280px, 340px) minmax(0, 1fr)",
          gridTemplateAreas: `"controls stage"`,
          gap: 2,
          overflow: "hidden",
          "@media (max-width: 1024px)": {
            display: "contents"
          }
        }}
      >
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
        <Box
          className="stage"
          ref={stageRef}
          role="img"
          aria-label="Animated tactical turn plot"
          sx={{
            position: "relative",
            minWidth: 0,
            minHeight: 0,
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            overflow: "hidden",
            bgcolor: "background.paper",
            gridArea: "stage",
            "@media (max-width: 1024px)": {
              order: 3,
              height: "clamp(300px, 55dvh, 520px)",
              minHeight: 300
            },
            "@media (max-width: 1024px) and (orientation: landscape)": {
              gridArea: "stage",
              order: 0,
              height: "auto",
              minHeight: 0
            }
          }}
        >
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
        </Box>
      </Box>
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
    </Container>
  );
}
