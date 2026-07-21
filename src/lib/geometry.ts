export type Point = { x: number; z: number };
export type Side = "inner" | "outer";

export type ModelParameters = {
  crownDiameter: number;
  outerDX: number;
  outerDZ: number;
  outerCrownT: number;
  outerEndT: number;
  outerAngle: number;
  externalBiarcEndX: number;
  externalBiarcEndZ: number;
  externalBiarcRadius: number;
  innerDX: number;
  innerDZ: number;
  innerCrownT: number;
  innerEndT: number;
  innerAngle: number;
  junctionEndX: number;
  junctionEndZ: number;
  junctionStartT: number;
  junctionEndT: number;
  junctionEndAngle: number;
};

export type Biarc = {
  start: Point;
  meeting: Point;
  end: Point;
  center1: Point;
  center2: Point;
  radius1: number;
  radius2: number;
  first: Point[];
  second: Point[];
  all: Point[];
  valid: boolean;
};

export type Model = {
  crown: Point;
  innerEnd: Point;
  outerEnd: Point;
  junctionEnd: Point;
  outerBodyEnd: Point;
  inner: Point[];
  outer: Point[];
  junction: Point[];
  externalBiarc: Biarc;
  all: Point[];
};

export function hermite(
  p0: Point,
  p1: Point,
  m0: Point,
  m1: Point,
  t: number,
): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  return {
    x: h00 * p0.x + h10 * m0.x + h01 * p1.x + h11 * m1.x,
    z: h00 * p0.z + h10 * m0.z + h01 * p1.z + h11 * m1.z,
  };
}

function sampleHermite(
  p0: Point,
  p1: Point,
  m0: Point,
  m1: Point,
  samples: number,
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= samples; i += 1) {
    points.push(hermite(p0, p1, m0, m1, i / samples));
  }
  return points;
}

function normalizeAngle(angle: number): number {
  let result = angle % (Math.PI * 2);
  if (result < 0) result += Math.PI * 2;
  return result;
}

function sampleArc(
  center: Point,
  radius: number,
  start: Point,
  end: Point,
  clockwise: boolean,
  samples: number,
): Point[] {
  const a0 = Math.atan2(start.z - center.z, start.x - center.x);
  const a1 = Math.atan2(end.z - center.z, end.x - center.x);
  let sweep: number;

  if (clockwise) {
    sweep = -normalizeAngle(a0 - a1);
  } else {
    sweep = normalizeAngle(a1 - a0);
  }

  return Array.from({ length: samples + 1 }, (_, index) => {
    const angle = a0 + sweep * (index / samples);
    return {
      x: center.x + radius * Math.cos(angle),
      z: center.z + radius * Math.sin(angle),
    };
  });
}

/**
 * Connect two points with externally tangent, opposite-curvature arcs.
 * Both endpoint tangents are parallel to Z. The first radius is supplied;
 * the second radius and meeting point are derived exactly.
 */
export function verticalTangentBiarc(
  start: Point,
  end: Point,
  radius1: number,
  samplesPerArc = 120,
): Biarc {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const side = Math.sign(dx) || 1;
  const radiusSum = (dx * dx + dz * dz) / (2 * Math.abs(dx || Number.EPSILON));
  const radius2 = radiusSum - radius1;
  const valid = Number.isFinite(radius2) && radius1 > 0 && radius2 > 0 && Math.abs(dx) > 1e-9;

  if (!valid) {
    return {
      start,
      meeting: start,
      end,
      center1: start,
      center2: end,
      radius1,
      radius2,
      first: [start, end],
      second: [],
      all: [start, end],
      valid: false,
    };
  }

  const center1 = { x: start.x + side * radius1, z: start.z };
  const center2 = { x: end.x - side * radius2, z: end.z };
  const fraction = radius1 / radiusSum;
  const meeting = {
    x: center1.x + fraction * (center2.x - center1.x),
    z: center1.z + fraction * (center2.z - center1.z),
  };

  // Select the short arc from each endpoint to the external-tangency point.
  const candidates1 = [
    sampleArc(center1, radius1, start, meeting, true, samplesPerArc),
    sampleArc(center1, radius1, start, meeting, false, samplesPerArc),
  ];
  const candidates2 = [
    sampleArc(center2, radius2, meeting, end, true, samplesPerArc),
    sampleArc(center2, radius2, meeting, end, false, samplesPerArc),
  ];
  const length = (points: Point[]) =>
    points.slice(1).reduce(
      (sum, point, index) => sum + Math.hypot(point.x - points[index].x, point.z - points[index].z),
      0,
    );
  const first = length(candidates1[0]) <= length(candidates1[1]) ? candidates1[0] : candidates1[1];
  const second = length(candidates2[0]) <= length(candidates2[1]) ? candidates2[0] : candidates2[1];

  return {
    start,
    meeting,
    end,
    center1,
    center2,
    radius1,
    radius2,
    first,
    second,
    all: [...first, ...second.slice(1)],
    valid: true,
  };
}

export function buildModel(p: ModelParameters, samples = 500): Model {
  const crown = { x: p.crownDiameter / 2, z: 0 };
  const outerEnd = {
    x: crown.x + p.outerDX,
    z: crown.z - p.outerDZ,
  };
  const innerEnd = {
    x: crown.x - p.innerDX,
    z: crown.z - p.innerDZ,
  };

  const outerAngle = (p.outerAngle * Math.PI) / 180;
  const innerAngle = (p.innerAngle * Math.PI) / 180;
  const junctionEndAngle = (p.junctionEndAngle * Math.PI) / 180;

  const outer = sampleHermite(
    crown,
    outerEnd,
    { x: p.outerCrownT, z: 0 },
    {
      x: Math.cos(outerAngle) * p.outerEndT,
      z: -Math.sin(outerAngle) * p.outerEndT,
    },
    samples,
  );

  const inner = sampleHermite(
    crown,
    innerEnd,
    { x: -p.innerCrownT, z: 0 },
    {
      x: -Math.cos(innerAngle) * p.innerEndT,
      z: -Math.sin(innerAngle) * p.innerEndT,
    },
    samples,
  );

  const junctionEnd = {
    x: p.junctionEndX,
    z: p.junctionEndZ,
  };
  const junction = sampleHermite(
    innerEnd,
    junctionEnd,
    {
      x: -Math.cos(innerAngle) * p.junctionStartT,
      z: -Math.sin(innerAngle) * p.junctionStartT,
    },
    {
      x: -Math.cos(junctionEndAngle) * p.junctionEndT,
      z: -Math.sin(junctionEndAngle) * p.junctionEndT,
    },
    samples,
  );

  const outerBodyEnd = {
    x: p.externalBiarcEndX,
    z: p.externalBiarcEndZ,
  };
  const externalBiarc = verticalTangentBiarc(
    outerEnd,
    outerBodyEnd,
    p.externalBiarcRadius,
  );

  return {
    crown,
    innerEnd,
    outerEnd,
    junctionEnd,
    outerBodyEnd,
    inner,
    outer,
    junction,
    externalBiarc,
    all: [
      ...junction.slice().reverse(),
      ...inner.slice(0, -1).reverse(),
      ...outer.slice(1),
      ...externalBiarc.all.slice(1),
    ],
  };
}

export function parseMeasuredData(text: string): {
  points: Point[];
  invalidLines: number;
} {
  const points: Point[] = [];
  let invalidLines = 0;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const xm = line.match(/X\s*([+-]?(?:\d+\.?\d*|\.\d+))/i);
    const zm = line.match(/Z\s*([+-]?(?:\d+\.?\d*|\.\d+))/i);

    if (xm && zm) {
      points.push({ x: Number(xm[1]), z: Number(zm[1]) });
      continue;
    }

    const parts = line.split(/[;,\t ]+/).filter(Boolean);
    if (
      parts.length >= 2 &&
      Number.isFinite(Number(parts[0])) &&
      Number.isFinite(Number(parts[1]))
    ) {
      points.push({ x: Number(parts[0]), z: Number(parts[1]) });
    } else {
      invalidLines += 1;
    }
  }

  return { points, invalidLines };
}

export function splitRuns(points: Point[], threshold: number): Point[][] {
  if (points.length === 0) return [];

  const runs: Point[][] = [[points[0]]];

  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];
    const currentRun = runs[runs.length - 1];
    const jump = Math.hypot(current.x - previous.x, current.z - previous.z);

    let reversal = false;
    if (currentRun.length >= 3) {
      const a = currentRun[currentRun.length - 2];
      const b = currentRun[currentRun.length - 1];
      const v0 = { x: b.x - a.x, z: b.z - a.z };
      const v1 = { x: current.x - b.x, z: current.z - b.z };
      const m0 = Math.hypot(v0.x, v0.z);
      const m1 = Math.hypot(v1.x, v1.z);
      if (m0 > 0 && m1 > 0) {
        reversal = (v0.x * v1.x + v0.z * v1.z) / (m0 * m1) < -0.35;
      }
    }

    if (jump > threshold || reversal) runs.push([current]);
    else currentRun.push(current);
  }

  return runs.filter((run) => run.length >= 2);
}

function tangentAt(run: Point[], index: number): Point {
  let dx: number;
  let dz: number;

  if (index === 0) {
    dx = run[1].x - run[0].x;
    dz = run[1].z - run[0].z;
  } else if (index === run.length - 1) {
    dx = run[index].x - run[index - 1].x;
    dz = run[index].z - run[index - 1].z;
  } else {
    dx = run[index + 1].x - run[index - 1].x;
    dz = run[index + 1].z - run[index - 1].z;
  }

  const magnitude = Math.hypot(dx, dz) || 1;
  return { x: dx / magnitude, z: dz / magnitude };
}

export function offsetRun(run: Point[], radius: number, sign: 1 | -1): Point[] {
  return run.map((point, index) => {
    const tangent = tangentAt(run, index);
    return {
      x: point.x - tangent.z * sign * radius,
      z: point.z + tangent.x * sign * radius,
    };
  });
}

export function automaticallyOffsetRun(
  run: Point[],
  radius: number,
  crown: Point,
): Point[] {
  const left = offsetRun(run, radius, 1);
  const right = offsetRun(run, radius, -1);

  const averageDistance = (points: Point[]) =>
    points.reduce(
      (sum, p) => sum + Math.hypot(p.x - crown.x, p.z - crown.z),
      0,
    ) / points.length;

  return averageDistance(left) <= averageDistance(right) ? left : right;
}

function branchIsMonotonicX(branch: Point[]): boolean {
  if (branch.length < 2) return false;
  const direction = Math.sign(branch[branch.length - 1].x - branch[0].x);
  if (direction === 0) return false;

  for (let i = 1; i < branch.length; i += 1) {
    const delta = branch[i].x - branch[i - 1].x;
    if (Math.abs(delta) < 1e-12) continue;
    if (Math.sign(delta) !== direction) return false;
  }
  return true;
}

/**
 * Linear interpolation within the densely sampled spline polyline.
 * Returns null outside the branch X-span or when the branch is not monotonic.
 */
export function splineZAtX(branch: Point[], x: number): number | null {
  if (!branchIsMonotonicX(branch)) return null;

  const ascending = branch[branch.length - 1].x > branch[0].x;
  const minX = Math.min(branch[0].x, branch[branch.length - 1].x);
  const maxX = Math.max(branch[0].x, branch[branch.length - 1].x);

  if (x < minX || x > maxX) return null;

  let low = 0;
  let high = branch.length - 1;

  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if ((branch[mid].x <= x) === ascending) low = mid;
    else high = mid;
  }

  const a = branch[low];
  const b = branch[high];
  const dx = b.x - a.x;

  if (Math.abs(dx) < 1e-12) return (a.z + b.z) / 2;

  const t = (x - a.x) / dx;
  return a.z + t * (b.z - a.z);
}

export type ErrorResult = {
  rms: number | null;
  maximum: number | null;
  included: number;
  excluded: number;
  residuals: Array<{ point: Point; splineZ: number; error: number; side: Side }>;
};

export function sameXError(points: Point[], model: Model): ErrorResult {
  const residuals: ErrorResult["residuals"] = [];
  let excluded = 0;

  for (const point of points) {
    const side: Side = point.x <= model.crown.x ? "inner" : "outer";
    const branch = side === "inner" ? model.inner : model.outer;
    const splineZ = splineZAtX(branch, point.x);

    if (splineZ === null) {
      excluded += 1;
      continue;
    }

    residuals.push({
      point,
      splineZ,
      error: point.z - splineZ,
      side,
    });
  }

  if (residuals.length === 0) {
    return { rms: null, maximum: null, included: 0, excluded, residuals };
  }

  const rms = Math.sqrt(
    residuals.reduce((sum, item) => sum + item.error ** 2, 0) /
      residuals.length,
  );
  const maximum = Math.max(...residuals.map((item) => Math.abs(item.error)));

  return {
    rms,
    maximum,
    included: residuals.length,
    excluded,
    residuals,
  };
}
