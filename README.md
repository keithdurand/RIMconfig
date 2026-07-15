# Horn Rim Visualizer

Internal development tool for comparing a two-Hermite-spline rim model with
measured 3 mm probe-ball centre data.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Set your defaults

Edit `src/lib/defaults.ts`.

Each control has:

- `value`: startup value
- `min`
- `max`
- `step`

The preview is sticky on desktop. Measurement input and controls scroll beside it.

## Measurement format

The parser accepts:

```text
X6.766 Z-4.000
X6.768 Z-3.990
```

It also accepts `X,Z`, spaces, tabs, or semicolons.

The first two detected runs are used. Later runs are ignored. The probe centre
traces are offset by the configured ball radius.

## Error calculation

RMS and maximum error are calculated only for corrected measurement points:

- whose X coordinate lies inside the corresponding spline branch;
- for which the spline branch can be evaluated at that same X.

The nearest point on the entire curve is deliberately not used.

## Deploy

Push the folder to GitHub and import the repository into Vercel, or run:

```bash
npx vercel
```
