# TAC Turn Illustrator

An interactive React/Konva single-page tool for visualizing two-ship tactical turns, timing cues, spacing, turn radius, and blindspot exposure.

![TAC Turn Illustrator screenshot](assets/tac-turn-illustrator.png)

## Why

Tac turns can be tricky and different doctrines are applied by different airforces / airframes. This is an attempt to show them all in one place so people can be clear about the technique they intend to employ so they can brief accurately and workshop whilst learning tac form maneuvers.

It is nicely illustrative how contract speed, separation and turn amount impacts turn cues, and the pros and cons of the different turn types. Note, tac turns don't have to be precise. The optimum turn locations may not be conducive to typical rules of thumb, but hopefully you can apply your rules of thumb to this tool and see the impact of those decisions in different scenarios.

## Features

- Animated route plots for double assisted, assisted, unassisted, hook, cross, check, and shackle tac form maneuvers.
- Controls for turn direction, turn angle, spacing, speed, sustained turn G, blindspot size, and second-turn timing.
- Level-turn radius calculation based on selected speed and sustained load factor.
- Trigger markers, spacing readouts, elapsed-time scrubber, and optional blindspot cones.

## Usage

Install dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

Build the static production site:

```bash
npm run build
```

The production build is emitted to `dist/` and can be hosted as static files, including on GitHub Pages.

Available here: https://spanner-uk.github.io/Tac-Turn-Illustrator/

## Development

The app is built with Vite, React, TypeScript, and react-konva/Konva. Maneuver generation lives in typed domain modules under `src/domain`, while the UI and diagram renderer live under `src/components`.

Run the verification suite:

```bash
npm test
npm run test:e2e
```

## Notes

The turn radius model uses the coordinated level-turn equation:

```text
R = V^2 / (g * sqrt(n^2 - 1))
```

where `V` is true speed, `g` is gravitational acceleration, and `n` is the selected sustained load factor. Aircraft presets are practical starting points; exact sustained turn performance varies with altitude, weight, stores, temperature, and engine state.
