import { clamp } from "./math";
import type { ManeuverParams, Point, Route, SamplePoint, Viewport, ViewportTransform } from "./types";

export function makeTransform(route: Route, params: ManeuverParams, viewport: Viewport): ViewportTransform {
  const all = route.samples.a1.concat(route.samples.a2, [
    { x: route.a1Start.x, y: route.a1Start.y, time: 0 },
    { x: route.a2Start.x, y: route.a2Start.y, time: 0 }
  ]);
  let minX = Math.min(...all.map((point) => point.x));
  let maxX = Math.max(...all.map((point) => point.x));
  let minY = Math.min(...all.map((point) => point.y));
  let maxY = Math.max(...all.map((point) => point.y));
  const margin = Math.max(0.35, params.separation * 0.4, route.radius * 0.3);
  minX -= margin;
  maxX += margin;
  minY -= margin;
  maxY += margin;

  const worldWidth = Math.max(0.1, maxX - minX);
  const worldHeight = Math.max(0.1, maxY - minY);
  const canvasAspect = Math.max(1, viewport.width) / Math.max(1, viewport.height);
  const worldAspect = worldWidth / worldHeight;

  if (worldAspect < canvasAspect) {
    const expandedWidth = worldHeight * canvasAspect;
    const extra = (expandedWidth - worldWidth) / 2;
    minX -= extra;
    maxX += extra;
  } else {
    const expandedHeight = worldWidth / canvasAspect;
    const extra = (expandedHeight - worldHeight) / 2;
    minY -= extra;
    maxY += extra;
  }

  const scaleFactor = Math.max(1, viewport.width) / (maxX - minX);
  return {
    minX,
    maxX,
    minY,
    maxY,
    scale: scaleFactor,
    toScreen(point: Point) {
      return {
        x: (point.x - minX) * scaleFactor,
        y: (maxY - point.y) * scaleFactor
      };
    }
  };
}

export function chooseGridStep(raw: number): number {
  const steps = [0.25, 0.5, 1, 2, 5, 10];
  return steps.find((step) => step >= raw) ?? 10;
}

export function pointAtSamples(points: SamplePoint[], time: number): SamplePoint | null {
  if (!points.length) {
    return null;
  }
  if (time <= 0) {
    return points[0];
  }
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const next = points[index];
    if (next.time >= time) {
      const amount = (time - prev.time) / Math.max(0.0001, next.time - prev.time);
      return {
        time,
        x: prev.x + (next.x - prev.x) * amount,
        y: prev.y + (next.y - prev.y) * amount
      };
    }
  }
  return points[points.length - 1];
}

export function splitPath(points: SamplePoint[], splitTime: number): { past: SamplePoint[]; future: SamplePoint[] } {
  const past: SamplePoint[] = [];
  const future: SamplePoint[] = [];
  for (const point of points) {
    if (point.time <= splitTime) {
      past.push(point);
    } else {
      future.push(point);
    }
  }

  const currentState = pointAtSamples(points, splitTime);
  if (currentState) {
    past.push(currentState);
    future.unshift(currentState);
  }

  return { past, future };
}

export function flatPoints(points: Point[], transform: ViewportTransform): number[] {
  return points.flatMap((point) => {
    const screen = transform.toScreen(point);
    return [screen.x, screen.y];
  });
}

export function clampLabel(x: number, y: number, width: number, height: number, viewport: Viewport): Point {
  return {
    x: clamp(x, width / 2 + 8, Math.max(width / 2 + 8, viewport.width - width / 2 - 8)),
    y: clamp(y, height / 2 + 8, Math.max(height / 2 + 8, viewport.height - height / 2 - 8))
  };
}

export function estimateTextWidth(text: string, fontSize = 12): number {
  return text.length * fontSize * 0.58;
}
