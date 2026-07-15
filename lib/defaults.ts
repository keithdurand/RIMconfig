export type NumericSetting = {
  value: number;
  min: number;
  max: number;
  step: number;
};

export const DEFAULTS = {
  probe: {
    ballRadius: { value: 1.5, min: 0, max: 5, step: 0.01 },
    splitThreshold: { value: 0.25, min: 0.01, max: 5, step: 0.01 },
  },
  crown: {
    diameter: { value: 21.0, min: 15, max: 30, step: 0.01 },
    z: { value: 0, min: -10, max: 10, step: 0.01 },
  },
  outer: {
    dx: { value: 1.75, min: 0.1, max: 4, step: 0.01 },
    dz: { value: 1.8, min: 0.1, max: 4, step: 0.01 },
    crownTangent: { value: 1.45, min: 0.01, max: 5, step: 0.01 },
    endTangent: { value: 1.3, min: 0.01, max: 5, step: 0.01 },
    endAngle: { value: 90, min: 60, max: 110, step: 0.1 },
  },
  inner: {
    dx: { value: 1.65, min: 0.1, max: 4, step: 0.01 },
    dz: { value: 1.55, min: 0.1, max: 4, step: 0.01 },
    crownTangent: { value: 1.35, min: 0.01, max: 5, step: 0.01 },
    endTangent: { value: 1.1, min: 0.01, max: 5, step: 0.01 },
    endAngle: { value: 82, min: 60, max: 100, step: 0.1 },
  },
} as const;

export const DEFAULT_MEASURED_DATA = `X6.766 Z-4.000
X6.768 Z-3.990
X6.770 Z-3.980
X6.772 Z-3.970
X6.773 Z-3.960
X6.775 Z-3.950
X6.777 Z-3.940
X6.779 Z-3.930`;
