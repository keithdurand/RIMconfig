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
    zOffset: { value: 1.99, min: -10, max: 10, step: 0.01 },
  },
  crown: {
    diameter: { value: 21.1, min: 15, max: 30, step: 0.01 },
  },
  outer: {
    dx: { value: 2.2, min: 0.1, max: 4, step: 0.01 },
    dz: { value: 1.8, min: 0.1, max: 4, step: 0.01 },
    crownTangent: { value: 2.5, min: 0.01, max: 6, step: 0.01 },
    endTangent: { value: 3.9, min: 0.01, max: 6, step: 0.01 },
    // The external biarc requires a Z-parallel tangent at the rim end.
    endAngle: { value: 90, min: 90, max: 90, step: 0.1 },
  },
  externalBiarc: {
    // Absolute endpoint in radial X/Z design coordinates.
    endX: { value: 10.0, min: 5, max: 15, step: 0.01 },
    endZ: { value: -7.5, min: -15, max: -0.1, step: 0.01 },
    firstRadius: { value: 1.5, min: 0.05, max: 6, step: 0.01 },
  },
  inner: {
    dx: { value: 1.8, min: 0.1, max: 4, step: 0.01 },
    dz: { value: 1.5, min: 0.1, max: 4, step: 0.01 },
    crownTangent: { value: 3.4, min: 0.01, max: 6, step: 0.01 },
    endTangent: { value: 3, min: 0.01, max: 6, step: 0.01 },
    endAngle: { value: 78, min: 60, max: 100, step: 0.1 },
  },
  internalJunction: {
    // Absolute endpoint in radial X/Z design coordinates.
    endX: { value: 8.375, min: 8, max: 9, step: 0.005 },
    endZ: { value: -3.5, min: -6, max: -2, step: 0.01 },
    startTangent: { value: 2.5, min: 0.01, max: 8, step: 0.01 },
    endTangent: { value: 3.0, min: 0.01, max: 10, step: 0.01 },
    endAngle: { value: 78, min: 60, max: 90, step: 0.1 },
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
