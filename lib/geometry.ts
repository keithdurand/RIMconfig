export type Point = { x: number; z: number };
export type Side = "inner" | "outer";

export type ModelParameters = {
  crownDiameter: number;
  crownZ: number;
  outerDX: number;
  outerDZ: number;
  outerCrownT: number;
  outerEndT: number;
  outerAngle: number;
  innerDX: number;
  innerDZ: number;
  innerCrownT: number;
  innerEndT: number;
  innerAngle: number;
};

export type Model = {
  crown: Point;
  inner: Point[];
  outer: Point[];
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

export function buildModel(p: ModelParameters, samples = 500): Model {
  const crown = { x: p.crownDiameter / 2, z: p.crownZ };
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

  const outer: Point[] = [];
  const inner: Point[] = [];

  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;

    outer.push(
      hermite(
        crown,
        outerEnd,
        { x: p.outerCrownT, z: 0 },
        {
          x: Math.cos(outerAngle) * p.outerEndT,
          z: -Math.sin(outerAngle) * p.outerEndT,
        },
        t,
      ),
    );

    inner.push(
      hermite(
        crown,
        innerEnd,
        { x: -p.innerCrownT, z: 0 },
        {
          x: -Math.cos(innerAngle) * p.innerEndT,
          z: -Math.sin(innerAngle) * p.innerEndT,
        },
        t,
      ),
    );
  }

  return {
    crown,
    inner,
    outer,
    all: [...inner.slice().reverse(), ...outer.slice(1)],
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
