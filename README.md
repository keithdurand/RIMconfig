# Horn Rim Visualizer

Internal rim design tool built around two Hermite rim splines, an internal
junction spline, and an exact two-arc external transition.

## Current design model

- Shared crown point
- Outer rim Hermite spline
- External biarc with Z-parallel endpoint tangents
  - first radius is stored
  - second radius and meeting point are calculated
- Inner rim Hermite spline
- Internal junction Hermite spline
  - starts tangent to the inner rim spline

The model remains in ordinary radial X coordinates. Diameter conversion and
machine-code generation belong in the later export stage.

## Save and open

`Save` downloads a `*.rim.json` file using schema `rim-design-0.1`.
The file stores native geometry parameters and optional probe-comparison data;
it does not store sampled points.

`Open` restores one of these JSON files.

## Run locally

```bash
npm install --include=dev
npm run dev
```

Open http://localhost:3000.

## Set defaults

Edit `src/lib/defaults.ts`. Each numeric control has a startup value, minimum,
maximum, and step.
