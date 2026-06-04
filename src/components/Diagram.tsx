import type { KonvaEventObject } from "konva/lib/Node";
import { Box, Chip, FormControlLabel, Paper, Slider, Stack, Switch, Typography } from "@mui/material";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import { AIRCRAFT_COLORS } from "../domain/constants";
import { formatDegrees, formatNm } from "../domain/format";
import { getClockCue, getTriggerSnapshots, getTriggerSpacing } from "../domain/markers";
import { add, forward, scale, stateAt } from "../domain/math";
import { chooseGridStep, clampLabel, estimateTextWidth, flatPoints, makeTransform, splitPath } from "../domain/view";
import type { ControlsState, ManeuverParams, Point, Route, RouteNote, SamplePoint, Viewport, ViewportTransform } from "../domain/types";

interface DiagramProps {
  controls: ControlsState;
  params: ManeuverParams;
  route: Route;
  elapsed: number;
  viewport: Viewport;
  activeTrigger: string | null;
  onActiveTriggerChange(id: string | null): void;
  onControlsChange(next: Partial<ControlsState>): void;
}

export function Diagram({
  controls,
  params,
  route,
  elapsed,
  viewport,
  activeTrigger,
  onActiveTriggerChange,
  onControlsChange
}: DiagramProps) {
  const transform = makeTransform(route, params, viewport);
  const a1 = stateAt(route.a1Segments, elapsed, params.speedNmPerSec);
  const a2 = stateAt(route.a2Segments, elapsed, params.speedNmPerSec);
  const markers = getTriggerSnapshots(route, params);
  const drawnTimes: number[] = [];

  return (
    <>
      <Stage width={viewport.width} height={viewport.height} aria-label="Animated tactical turn plot">
        <Layer>
          <Grid transform={transform} viewport={viewport} />
          <InitialSeparation params={params} route={route} transform={transform} />
          {params.showBlindspots && (
            <Blindspots params={params} route={route} elapsed={elapsed} transform={transform} />
          )}
          <AircraftPath points={route.samples.a1} splitTime={elapsed} color={AIRCRAFT_COLORS.a1} futureColor={AIRCRAFT_COLORS.a1Soft} transform={transform} />
          <AircraftPath points={route.samples.a2} splitTime={elapsed} color={AIRCRAFT_COLORS.a2} futureColor={AIRCRAFT_COLORS.a2Soft} transform={transform} />
          {markers.map((marker) => {
            const duplicateLine = drawnTimes.some((time) => Math.abs(time - marker.time) < 0.05);
            drawnTimes.push(marker.time);
            return (
              <TriggerSnapshot
                key={marker.id}
                item={marker}
                transform={transform}
                viewport={viewport}
                duplicateLine={duplicateLine}
                active={activeTrigger === marker.id}
                onActiveTriggerChange={onActiveTriggerChange}
              />
            );
          })}
          <CompletionSpacing route={route} transform={transform} viewport={viewport} />
          {(route.notes ?? []).map((note, index) => (
            <RouteNoteLabel key={`${note.point.x}-${note.point.y}-${index}`} note={note} transform={transform} viewport={viewport} />
          ))}
          <Aircraft point={a1.point} heading={a1.heading} color={AIRCRAFT_COLORS.a1} label="A1" transform={transform} />
          <Aircraft point={a2.point} heading={a2.heading} color={AIRCRAFT_COLORS.a2} label="A2" transform={transform} />
        </Layer>
      </Stage>
      <Paper
        variant="outlined"
        sx={{
          position: "absolute",
          top: 14,
          right: 14,
          zIndex: 5,
          width: 210,
          p: 1.25,
          bgcolor: "rgba(255, 255, 255, 0.88)",
          backdropFilter: "blur(8px)",
          display: { xs: "none", lg: "block" }
        }}
      >
        <Stack spacing={1}>
          <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Blindspot
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
              {formatDegrees(params.blindspotDeg)}
            </Typography>
          </Stack>
          <Slider
            aria-label="Blindspot"
            min={15}
            max={180}
            step={5}
            value={controls.blindspotDeg}
            onChange={(_, value) => onControlsChange({ blindspotDeg: Array.isArray(value) ? value[0] : value })}
          />
          <FormControlLabel
            control={<Switch checked={controls.showBlindspots} onChange={(event) => onControlsChange({ showBlindspots: event.target.checked })} />}
            label="Show blindspots"
          />
        </Stack>
      </Paper>
      <Stack direction="row" spacing={1} sx={{ position: "absolute", left: 14, top: 14, pointerEvents: "none" }} aria-hidden="true">
        <Chip
          variant="outlined"
          size="small"
          label="A1"
          icon={<Box component="span" sx={{ display: "inline-block", width: 22, height: 4, bgcolor: "#d95f43", borderRadius: 10 }} />}
          sx={{ bgcolor: "rgba(255, 255, 255, 0.82)" }}
        />
        <Chip
          variant="outlined"
          size="small"
          label="A2"
          icon={<Box component="span" sx={{ display: "inline-block", width: 22, height: 4, bgcolor: "#1f7a8c", borderRadius: 10 }} />}
          sx={{ bgcolor: "rgba(255, 255, 255, 0.82)" }}
        />
      </Stack>
    </>
  );
}

function Grid({ transform, viewport }: { transform: ViewportTransform; viewport: Viewport }) {
  const gridStep = chooseGridStep((transform.maxX - transform.minX) / 8);
  const lines = [];
  const startX = Math.floor(transform.minX / gridStep) * gridStep;
  for (let x = startX; x <= transform.maxX; x += gridStep) {
    const a = transform.toScreen({ x, y: transform.minY });
    const b = transform.toScreen({ x, y: transform.maxY });
    lines.push(<Line key={`x-${x}`} points={[a.x, a.y, b.x, b.y]} stroke="#e2e8e5" strokeWidth={1} />);
  }

  const startY = Math.floor(transform.minY / gridStep) * gridStep;
  for (let y = startY; y <= transform.maxY; y += gridStep) {
    const a = transform.toScreen({ x: transform.minX, y });
    const b = transform.toScreen({ x: transform.maxX, y });
    lines.push(<Line key={`y-${y}`} points={[a.x, a.y, b.x, b.y]} stroke="#e2e8e5" strokeWidth={1} />);
  }

  const scaleStart = transform.toScreen({
    x: transform.minX + (transform.maxX - transform.minX) * 0.06,
    y: transform.minY + (transform.maxY - transform.minY) * 0.08
  });
  const scaleEnd = {
    x: scaleStart.x + gridStep * transform.scale,
    y: scaleStart.y
  };
  const label = Number.isInteger(gridStep) ? `${gridStep} NM` : `${gridStep.toFixed(2)} NM`;

  return (
    <Group>
      {lines}
      <Line points={[scaleStart.x, scaleStart.y, scaleEnd.x, scaleEnd.y]} stroke="#6d7773" strokeWidth={2} />
      <Line points={[scaleStart.x, scaleStart.y - 5, scaleStart.x, scaleStart.y + 5]} stroke="#6d7773" strokeWidth={2} />
      <Line points={[scaleEnd.x, scaleEnd.y - 5, scaleEnd.x, scaleEnd.y + 5]} stroke="#6d7773" strokeWidth={2} />
      <Text
        x={(scaleStart.x + scaleEnd.x) / 2 - 40}
        y={Math.max(8, scaleStart.y - 24)}
        width={80}
        align="center"
        text={label}
        fill="#596460"
        fontSize={12}
        fontFamily="Inter, system-ui, sans-serif"
      />
      <Rect x={0} y={0} width={viewport.width} height={viewport.height} listening={false} opacity={0} />
    </Group>
  );
}

function InitialSeparation({ params, route, transform }: { params: ManeuverParams; route: Route; transform: ViewportTransform }) {
  const xOffset = -Math.max(0.18, params.separation * 0.14);
  const p1 = transform.toScreen({ x: xOffset, y: route.a1Start.y });
  const p2 = transform.toScreen({ x: xOffset, y: route.a2Start.y });
  return (
    <Group>
      <Line points={[p1.x, p1.y, p2.x, p2.y]} stroke="#48524e" strokeWidth={1.5} dash={[4, 4]} />
      <Line points={[p1.x - 8, p1.y, p1.x + 8, p1.y]} stroke="#48524e" strokeWidth={1.5} />
      <Line points={[p2.x - 8, p2.y, p2.x + 8, p2.y]} stroke="#48524e" strokeWidth={1.5} />
      <Text
        x={p1.x + 12}
        y={(p1.y + p2.y) / 2 - 8}
        text={formatNm(params.separation)}
        fill="#48524e"
        fontSize={12}
        fontStyle="700"
        fontFamily="Inter, system-ui, sans-serif"
      />
    </Group>
  );
}

function Blindspots({ params, route, elapsed, transform }: { params: ManeuverParams; route: Route; elapsed: number; transform: ViewportTransform }) {
  const range = Math.max(0.8, params.separation * 1.35, route.radius * 1.7);
  const a1 = stateAt(route.a1Segments, elapsed, params.speedNmPerSec);
  const a2 = stateAt(route.a2Segments, elapsed, params.speedNmPerSec);
  return (
    <Group>
      <BlindspotCone point={a1.point} heading={a1.heading} range={range} coneAngle={params.blindspotRad} fill="rgba(217, 95, 67, 0.14)" stroke="rgba(217, 95, 67, 0.28)" transform={transform} />
      <BlindspotCone point={a2.point} heading={a2.heading} range={range} coneAngle={params.blindspotRad} fill="rgba(31, 122, 140, 0.14)" stroke="rgba(31, 122, 140, 0.28)" transform={transform} />
    </Group>
  );
}

function BlindspotCone({
  point,
  heading,
  range,
  coneAngle,
  fill,
  stroke,
  transform
}: {
  point: Point;
  heading: number;
  range: number;
  coneAngle: number;
  fill: string;
  stroke: string;
  transform: ViewportTransform;
}) {
  const tailHeading = heading + Math.PI;
  const halfCone = coneAngle / 2;
  const points = [point];
  for (let index = 0; index <= 12; index += 1) {
    const amount = index / 12;
    const coneHeading = tailHeading - halfCone + coneAngle * amount;
    points.push(add(point, scale(forward(coneHeading), range)));
  }
  return <Line points={flatPoints(points, transform)} closed fill={fill} stroke={stroke} strokeWidth={1} listening={false} />;
}

function AircraftPath({
  points,
  splitTime,
  color,
  futureColor,
  transform
}: {
  points: SamplePoint[];
  splitTime: number;
  color: string;
  futureColor: string;
  transform: ViewportTransform;
}) {
  const { past, future } = splitPath(points, splitTime);
  return (
    <Group listening={false}>
      {future.length >= 2 && <Line points={flatPoints(future, transform)} stroke={futureColor} strokeWidth={3} lineCap="round" lineJoin="round" dash={[9, 8]} />}
      {past.length >= 2 && <Line points={flatPoints(past, transform)} stroke={color} strokeWidth={4} lineCap="round" lineJoin="round" />}
    </Group>
  );
}

function TriggerSnapshot({
  item,
  transform,
  viewport,
  duplicateLine,
  active,
  onActiveTriggerChange
}: {
  item: ReturnType<typeof getTriggerSnapshots>[number];
  transform: ViewportTransform;
  viewport: Viewport;
  duplicateLine: boolean;
  active: boolean;
  onActiveTriggerChange(id: string | null): void;
}) {
  const triggerPoint = transform.toScreen(item.trigger.point);
  const ghostPoint = transform.toScreen(item.ghost.point);
  const triggerColor = item.id.startsWith("a1") ? AIRCRAFT_COLORS.a1 : "#2e6f58";

  const updateCursor = (event: KonvaEventObject<MouseEvent>, cursor: string) => {
    const container = event.target.getStage()?.container();
    if (container) {
      container.style.cursor = cursor;
    }
  };

  return (
    <Group>
      {(!duplicateLine || active) && (
        <Line points={[triggerPoint.x, triggerPoint.y, ghostPoint.x, ghostPoint.y]} stroke={triggerColor} strokeWidth={active ? 2.5 : 1.5} dash={[5, 5]} />
      )}
      <Circle
        x={triggerPoint.x}
        y={triggerPoint.y}
        radius={active ? 10 : 8}
        stroke={triggerColor}
        strokeWidth={active ? 2.5 : 1.5}
        dash={[5, 5]}
        hitStrokeWidth={18}
        onMouseEnter={(event) => updateCursor(event, "pointer")}
        onMouseLeave={(event) => updateCursor(event, "default")}
        onClick={() => onActiveTriggerChange(active ? null : item.id)}
        onTap={() => onActiveTriggerChange(active ? null : item.id)}
      />
      {active && (
        <TriggerDistanceLabel
          triggerPoint={triggerPoint}
          ghostPoint={ghostPoint}
          spacing={getTriggerSpacing(item)}
          clockCue={getClockCue(item)}
          cueText={item.cueText ?? ""}
          labelColor={triggerColor}
          viewport={viewport}
        />
      )}
      <Aircraft point={item.ghost.point} heading={item.ghost.heading} color={item.ghostColor} label={item.ghostLabel} transform={transform} ghost />
    </Group>
  );
}

function TriggerDistanceLabel({
  triggerPoint,
  ghostPoint,
  spacing,
  clockCue,
  cueText,
  labelColor,
  viewport
}: {
  triggerPoint: Point;
  ghostPoint: Point;
  spacing: number;
  clockCue: string;
  cueText: string;
  labelColor: string;
  viewport: Viewport;
}) {
  const mid = {
    x: (triggerPoint.x + ghostPoint.x) / 2,
    y: (triggerPoint.y + ghostPoint.y) / 2
  };
  const labels = [formatNm(spacing), clockCue, ...(cueText ? [cueText] : [])];
  const boxWidth = Math.max(...labels.map((label) => estimateTextWidth(label, 12))) + 18;
  const lineHeight = 16;
  const boxHeight = labels.length * lineHeight + 11;
  const label = clampLabel(mid.x, mid.y - 18, boxWidth, boxHeight, viewport);

  return (
    <Group>
      <Rect x={label.x - boxWidth / 2} y={label.y - boxHeight / 2} width={boxWidth} height={boxHeight} cornerRadius={6} fill="rgba(255, 255, 255, 0.94)" stroke="#2e6f58" strokeWidth={1} />
      {labels.map((text, index) => (
        <Text
          key={text}
          x={label.x - boxWidth / 2}
          y={label.y - ((labels.length - 1) * lineHeight) / 2 - 7 + index * lineHeight}
          width={boxWidth}
          align="center"
          text={text}
          fill={labelColor}
          fontSize={12}
          fontStyle="800"
          fontFamily="Inter, system-ui, sans-serif"
        />
      ))}
    </Group>
  );
}

function CompletionSpacing({ route, transform, viewport }: { route: Route; transform: ViewportTransform; viewport: Viewport }) {
  const p1 = transform.toScreen(route.completionA1);
  const p2 = transform.toScreen(route.completionA2);
  const mid = {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  };
  const labelText = formatNm(route.completionSpacing);
  const boxWidth = estimateTextWidth(labelText, 12) + 16;
  const boxHeight = 24;
  const label = clampLabel(mid.x, mid.y - 18, boxWidth, boxHeight, viewport);

  return (
    <Group listening={false}>
      <Line points={[p1.x, p1.y, p2.x, p2.y]} stroke="#2f3a36" strokeWidth={1.5} dash={[3, 5]} />
      <Circle x={p1.x} y={p1.y} radius={4} fill="#2f3a36" />
      <Circle x={p2.x} y={p2.y} radius={4} fill="#2f3a36" />
      <Rect x={label.x - boxWidth / 2} y={label.y - boxHeight / 2} width={boxWidth} height={boxHeight} cornerRadius={6} fill="rgba(255, 255, 255, 0.9)" stroke="#d8dfdc" strokeWidth={1} />
      <Text
        x={label.x - boxWidth / 2}
        y={label.y - 7}
        width={boxWidth}
        align="center"
        text={labelText}
        fill="#2f3a36"
        fontSize={12}
        fontStyle="700"
        fontFamily="Inter, system-ui, sans-serif"
      />
    </Group>
  );
}

function RouteNoteLabel({ note, transform, viewport }: { note: RouteNote; transform: ViewportTransform; viewport: Viewport }) {
  const point = transform.toScreen(note.point);
  const lines = note.lines ?? [note.text ?? ""];
  const placement = note.placement ?? "above";
  const boxWidth = Math.max(...lines.map((line) => estimateTextWidth(line, 12))) + 18;
  const lineHeight = 15;
  const boxHeight = lines.length * lineHeight + 12;
  const desiredX = placement === "right" ? point.x + boxWidth / 2 + 50 : point.x;
  const desiredY = placement === "below"
    ? point.y + boxHeight / 2 + 38
    : placement === "right"
      ? point.y
      : point.y - boxHeight / 2 - 38;
  const label = clampLabel(desiredX + (note.offsetX ?? 0), desiredY + (note.offsetY ?? 0), boxWidth, boxHeight, viewport);
  const connectorStart = placement === "right"
    ? { x: label.x - boxWidth / 2, y: label.y }
    : { x: label.x, y: placement === "below" ? label.y - boxHeight / 2 : label.y + boxHeight / 2 };

  return (
    <Group listening={false}>
      <Line points={[connectorStart.x, connectorStart.y, point.x, point.y]} stroke="#5f5149" strokeWidth={1.5} dash={[3, 4]} />
      <Circle x={point.x} y={point.y} radius={5} fill="#5f5149" />
      <Rect x={label.x - boxWidth / 2} y={label.y - boxHeight / 2} width={boxWidth} height={boxHeight} cornerRadius={6} fill="rgba(255, 255, 255, 0.94)" stroke="#d8dfdc" strokeWidth={1} />
      {lines.map((line, index) => (
        <Text
          key={line}
          x={label.x - boxWidth / 2}
          y={label.y - ((lines.length - 1) * lineHeight) / 2 - 7 + index * lineHeight}
          width={boxWidth}
          align="center"
          text={line}
          fill="#5f5149"
          fontSize={12}
          fontStyle="800"
          fontFamily="Inter, system-ui, sans-serif"
        />
      ))}
    </Group>
  );
}

function Aircraft({
  point,
  heading,
  color,
  label,
  transform,
  ghost = false
}: {
  point: Point;
  heading: number;
  color: string;
  label: string;
  transform: ViewportTransform;
  ghost?: boolean;
}) {
  const p = transform.toScreen(point);
  const length = ghost ? 30 : 34;
  const width = ghost ? 16 : 18;
  const tail = ghost ? 12 : 13;
  const shape = [length / 2, 0, -tail, width / 2, -tail / 2, 0, -tail, -width / 2];

  return (
    <Group x={p.x} y={p.y} rotation={(-heading * 180) / Math.PI} opacity={ghost ? 0.38 : 1} listening={false}>
      <Line points={shape} closed fill={color} stroke={ghost ? undefined : "#ffffff"} strokeWidth={ghost ? 0 : 2} />
      {label && (
        <Text
          x={-22}
          y={ghost ? 16 : -35}
          width={44}
          align="center"
          text={label}
          fill={ghost ? color : "#18211f"}
          fontSize={ghost ? 11 : 12}
          fontStyle="800"
          fontFamily="Inter, system-ui, sans-serif"
          rotation={(heading * 180) / Math.PI}
        />
      )}
    </Group>
  );
}
