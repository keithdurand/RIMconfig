"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./RimDesigner.module.css";
import { DEFAULT_MEASURED_DATA, DEFAULTS, NumericSetting } from "@/lib/defaults";
import {
  automaticallyOffsetRun,
  buildModel,
  parseMeasuredData,
  sameXError,
  splitRuns,
  type ModelParameters,
  type Point,
} from "@/lib/geometry";

type Values = ModelParameters & {
  ballRadius: number;
  splitThreshold: number;
  measurementZOffset: number;
};

type RimDesignFile = {
  schemaVersion: "rim-design-0.1" | "rim-design-0.2";
  recordType: "rim-design";
  name: string;
  savedAt: string;
  geometry: ModelParameters;
  measurement: {
    ballRadius: number;
    splitThreshold: number;
    zOffset?: number;
    data: string;
  };
};

const INITIAL_VALUES: Values = {
  ballRadius: DEFAULTS.probe.ballRadius.value,
  splitThreshold: DEFAULTS.probe.splitThreshold.value,
  measurementZOffset: DEFAULTS.probe.zOffset.value,
  crownDiameter: DEFAULTS.crown.diameter.value,
  outerDX: DEFAULTS.outer.dx.value,
  outerDZ: DEFAULTS.outer.dz.value,
  outerCrownT: DEFAULTS.outer.crownTangent.value,
  outerEndT: DEFAULTS.outer.endTangent.value,
  outerAngle: DEFAULTS.outer.endAngle.value,
  externalBiarcEndX: DEFAULTS.externalBiarc.endX.value,
  externalBiarcEndZ: DEFAULTS.externalBiarc.endZ.value,
  externalBiarcRadius: DEFAULTS.externalBiarc.firstRadius.value,
  innerDX: DEFAULTS.inner.dx.value,
  innerDZ: DEFAULTS.inner.dz.value,
  innerCrownT: DEFAULTS.inner.crownTangent.value,
  innerEndT: DEFAULTS.inner.endTangent.value,
  innerAngle: DEFAULTS.inner.endAngle.value,
  junctionDX: DEFAULTS.internalJunction.dx.value,
  junctionDZ: DEFAULTS.internalJunction.dz.value,
  junctionStartT: DEFAULTS.internalJunction.startTangent.value,
  junctionEndT: DEFAULTS.internalJunction.endTangent.value,
  junctionEndAngle: DEFAULTS.internalJunction.endAngle.value,
};

const GEOMETRY_KEYS: Array<keyof ModelParameters> = [
  "crownDiameter",
  "outerDX",
  "outerDZ",
  "outerCrownT",
  "outerEndT",
  "outerAngle",
  "externalBiarcEndX",
  "externalBiarcEndZ",
  "externalBiarcRadius",
  "innerDX",
  "innerDZ",
  "innerCrownT",
  "innerEndT",
  "innerAngle",
  "junctionDX",
  "junctionDZ",
  "junctionStartT",
  "junctionEndT",
  "junctionEndAngle",
];

function Slider({
  label,
  setting,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  setting: NumericSetting;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.control}>
      <label>{label}</label>
      <input
        type="range"
        min={setting.min}
        max={setting.max}
        step={setting.step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <input
        type="number"
        min={setting.min}
        max={setting.max}
        step={setting.step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function getBounds(points: Point[]) {
  if (!points.length) {
    return { minX: 5, maxX: 13, minZ: -10, maxZ: 1 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }

  const px = Math.max((maxX - minX) * 0.1, 0.2);
  const pz = Math.max((maxZ - minZ) * 0.12, 0.2);

  return {
    minX: minX - px,
    maxX: maxX + px,
    minZ: minZ - pz,
    maxZ: maxZ + pz,
  };
}

function safeFilename(name: string): string {
  const trimmed = name.trim() || "untitled-rim";
  return trimmed.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "untitled-rim";
}

function geometryFromValues(values: Values): ModelParameters {
  const geometry = {} as ModelParameters;
  for (const key of GEOMETRY_KEYS) geometry[key] = values[key];
  return geometry;
}

export default function RimDesigner() {
  const [values, setValues] = useState<Values>(INITIAL_VALUES);
  const [data, setData] = useState(DEFAULT_MEASURED_DATA);
  const [designName, setDesignName] = useState("Untitled rim");
  const [fileStatus, setFileStatus] = useState("");
  const [showRaw, setShowRaw] = useState(true);
  const [showCorrected, setShowCorrected] = useState(true);
  const [showResiduals, setShowResiduals] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (key: keyof Values, value: number) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  const parsed = useMemo(() => parseMeasuredData(data), [data]);
  const offsetMeasuredPoints = useMemo(
    () => parsed.points.map((point) => ({ ...point, z: point.z + values.measurementZOffset })),
    [parsed.points, values.measurementZOffset],
  );
  const allRuns = useMemo(
    () => splitRuns(offsetMeasuredPoints, values.splitThreshold),
    [offsetMeasuredPoints, values.splitThreshold],
  );

  // Deliberately only use the first two runs. A third top approach is ignored.
  const rawRuns = useMemo(() => allRuns.slice(0, 2), [allRuns]);
  const model = useMemo(() => buildModel(values), [values]);

  const correctedRuns = useMemo(
    () =>
      rawRuns.map((run) =>
        automaticallyOffsetRun(run, values.ballRadius, model.crown),
      ),
    [rawRuns, values.ballRadius, model.crown],
  );

  const corrected = useMemo(() => correctedRuns.flat(), [correctedRuns]);
  const error = useMemo(() => sameXError(corrected, model), [corrected, model]);

  const saveDesign = () => {
    const file: RimDesignFile = {
      schemaVersion: "rim-design-0.2",
      recordType: "rim-design",
      name: designName.trim() || "Untitled rim",
      savedAt: new Date().toISOString(),
      geometry: geometryFromValues(values),
      measurement: {
        ballRadius: values.ballRadius,
        splitThreshold: values.splitThreshold,
        zOffset: values.measurementZOffset,
        data,
      },
    };

    const blob = new Blob([JSON.stringify(file, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFilename(file.name)}.rim.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setFileStatus(`Saved ${anchor.download}`);
  };

  const openDesign = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;

    try {
      const parsedFile = JSON.parse(await selected.text()) as Partial<RimDesignFile>;
      if (
        (parsedFile.schemaVersion !== "rim-design-0.2" && parsedFile.schemaVersion !== "rim-design-0.1") ||
        parsedFile.recordType !== "rim-design" ||
        !parsedFile.geometry
      ) {
        throw new Error("This is not a supported rim design file.");
      }

      const next = { ...INITIAL_VALUES };
      const geometry = parsedFile.geometry as ModelParameters & {
        crownZ?: number;
        externalBiarcDX?: number;
        externalBiarcDZ?: number;
      };
      for (const key of GEOMETRY_KEYS) {
        const value = geometry[key];
        if (typeof value === "number" && Number.isFinite(value)) next[key] = value;
      }

      // Migrate rim-design-0.1 files, which stored crown Z and biarc deltas.
      if (parsedFile.schemaVersion === "rim-design-0.1") {
        const oldCrownZ = Number.isFinite(geometry.crownZ) ? geometry.crownZ! : 0;
        next.measurementZOffset = -oldCrownZ;
        const oldOuterEndX = next.crownDiameter / 2 + next.outerDX;
        const oldOuterEndZ = oldCrownZ - next.outerDZ;
        if (Number.isFinite(geometry.externalBiarcDX)) {
          next.externalBiarcEndX = oldOuterEndX + geometry.externalBiarcDX!;
        }
        if (Number.isFinite(geometry.externalBiarcDZ)) {
          next.externalBiarcEndZ = oldOuterEndZ + geometry.externalBiarcDZ! - oldCrownZ;
        }
      }

      if (parsedFile.measurement) {
        if (Number.isFinite(parsedFile.measurement.ballRadius)) {
          next.ballRadius = parsedFile.measurement.ballRadius;
        }
        if (Number.isFinite(parsedFile.measurement.splitThreshold)) {
          next.splitThreshold = parsedFile.measurement.splitThreshold;
        }
        if (Number.isFinite(parsedFile.measurement.zOffset)) {
          next.measurementZOffset = parsedFile.measurement.zOffset!;
        }
        if (typeof parsedFile.measurement.data === "string") {
          setData(parsedFile.measurement.data);
        }
      }

      setValues(next);
      setDesignName(parsedFile.name?.trim() || selected.name.replace(/\.rim\.json$/i, ""));
      setFileStatus(`Opened ${selected.name}`);
    } catch (error) {
      setFileStatus(error instanceof Error ? error.message : "Could not open the design file.");
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const points = [...model.all, ...offsetMeasuredPoints, ...corrected];
    let bounds = getBounds(points);

    const width = canvas.width;
    const height = canvas.height;
    const pad = { left: 70, right: 25, top: 25, bottom: 55 };
    const drawWidth = width - pad.left - pad.right;
    const drawHeight = height - pad.top - pad.bottom;

    const sx0 = drawWidth / (bounds.maxX - bounds.minX);
    const sz0 = drawHeight / (bounds.maxZ - bounds.minZ);
    const scale = Math.min(sx0, sz0);
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;

    bounds = {
      minX: cx - drawWidth / scale / 2,
      maxX: cx + drawWidth / scale / 2,
      minZ: cz - drawHeight / scale / 2,
      maxZ: cz + drawHeight / scale / 2,
    };

    const X = (x: number) => pad.left + (x - bounds.minX) * scale;
    const Z = (z: number) => pad.top + (bounds.maxZ - z) * scale;

    const css = getComputedStyle(document.documentElement);
    const color = (name: string, fallback: string) =>
      css.getPropertyValue(name).trim() || fallback;

    const border = color("--border", "#353943");
    const text = color("--text", "#f2f3f5");
    const muted = color("--muted", "#a8adb7");
    const accent = color("--accent", "#9e80ff");
    const measured = color("--measured", "#f0a05a");
    const raw = color("--raw", "#72a6c9");
    const derived = color("--derived", "#6fd3a7");

    ctx.clearRect(0, 0, width, height);
    ctx.font = "13px Arial";
    ctx.strokeStyle = border;
    ctx.fillStyle = muted;
    ctx.lineWidth = 1;

    const niceStep = (range: number) => {
      const rough = range / 7;
      const power = 10 ** Math.floor(Math.log10(rough));
      const normalized = rough / power;
      return (normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10) * power;
    };

    const xStep = niceStep(bounds.maxX - bounds.minX);
    const zStep = niceStep(bounds.maxZ - bounds.minZ);

    ctx.setLineDash([4, 5]);
    for (let x = Math.ceil(bounds.minX / xStep) * xStep; x <= bounds.maxX + 1e-9; x += xStep) {
      const px = X(x);
      ctx.beginPath();
      ctx.moveTo(px, pad.top);
      ctx.lineTo(px, height - pad.bottom);
      ctx.stroke();
      ctx.fillText(x.toFixed(xStep < 0.1 ? 2 : 1), px - 13, height - 25);
    }

    for (let z = Math.ceil(bounds.minZ / zStep) * zStep; z <= bounds.maxZ + 1e-9; z += zStep) {
      const pz = Z(z);
      ctx.beginPath();
      ctx.moveTo(pad.left, pz);
      ctx.lineTo(width - pad.right, pz);
      ctx.stroke();
      ctx.fillText(z.toFixed(zStep < 0.1 ? 2 : 1), 12, pz + 4);
    }
    ctx.setLineDash([]);

    ctx.fillStyle = text;
    ctx.fillText("X radius, mm", width / 2 - 35, height - 9);

    const drawPolyline = (
      pointsToDraw: Point[],
      stroke: string,
      lineWidth: number,
      dash: number[] = [],
    ) => {
      if (pointsToDraw.length < 2) return;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash(dash);
      ctx.beginPath();
      pointsToDraw.forEach((p, i) => {
        if (i === 0) ctx.moveTo(X(p.x), Z(p.z));
        else ctx.lineTo(X(p.x), Z(p.z));
      });
      ctx.stroke();
      ctx.setLineDash([]);
    };

    if (showRaw) rawRuns.forEach((run) => drawPolyline(run, raw, 1.5, [6, 5]));

    if (showCorrected) {
      correctedRuns.forEach((run) => {
        drawPolyline(run, measured, 2);
        ctx.fillStyle = measured;
        run.forEach((p) => {
          ctx.beginPath();
          ctx.arc(X(p.x), Z(p.z), 3, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    }

    if (showResiduals) {
      ctx.strokeStyle = measured;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.45;
      for (const residual of error.residuals) {
        ctx.beginPath();
        ctx.moveTo(X(residual.point.x), Z(residual.point.z));
        ctx.lineTo(X(residual.point.x), Z(residual.splineZ));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    drawPolyline(model.inner, accent, 4);
    drawPolyline(model.outer, accent, 4);
    drawPolyline(model.junction, derived, 4);
    drawPolyline(model.externalBiarc.first, derived, 4);
    drawPolyline(model.externalBiarc.second, derived, 4);

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(X(model.crown.x), Z(model.crown.z), 5, 0, Math.PI * 2);
    ctx.fill();

    if (model.externalBiarc.valid) {
      ctx.fillStyle = derived;
      ctx.beginPath();
      ctx.arc(X(model.externalBiarc.meeting.x), Z(model.externalBiarc.meeting.z), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [
    corrected,
    correctedRuns,
    error.residuals,
    model,
    offsetMeasuredPoints,
    rawRuns,
    showCorrected,
    showRaw,
    showResiduals,
  ]);

  const ignoredRunPoints = allRuns.slice(2).flat().length;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Horn Rim Visualizer</h1>
          <p>Rim splines, internal junction spline, and exact external biarc.</p>
        </div>
        <div className={styles.fileBar}>
          <input
            className={styles.nameInput}
            value={designName}
            aria-label="Design name"
            onChange={(event) => setDesignName(event.target.value)}
          />
          <button type="button" className={styles.button} onClick={() => fileInputRef.current?.click()}>
            Open
          </button>
          <button type="button" className={styles.button} onClick={saveDesign}>
            Save
          </button>
          <input
            ref={fileInputRef}
            className={styles.hiddenInput}
            type="file"
            accept=".json,.rim.json,application/json"
            onChange={openDesign}
          />
        </div>
        {fileStatus && <div className={styles.fileStatus}>{fileStatus}</div>}
      </header>

      <div className={styles.layout}>
        <section className={styles.controls}>
          <div className={styles.panel}>
            <h2>Probe data</h2>
            <Slider label="Ball radius" setting={DEFAULTS.probe.ballRadius} value={values.ballRadius} onChange={(v) => update("ballRadius", v)} />
            <Slider label="Run threshold" setting={DEFAULTS.probe.splitThreshold} value={values.splitThreshold} onChange={(v) => update("splitThreshold", v)} />
            <Slider label="Imported Z offset" setting={DEFAULTS.probe.zOffset} value={values.measurementZOffset} onChange={(v) => update("measurementZOffset", v)} />
            <textarea className={styles.textarea} value={data} onChange={(e) => setData(e.target.value)} spellCheck={false} />
            <div className={styles.status}>
              {parsed.points.length} parsed; {corrected.length} corrected; {ignoredRunPoints} later-run points ignored
              {parsed.invalidLines > 0 && `; ${parsed.invalidLines} invalid lines`}.
            </div>
          </div>

          <div className={styles.panel}>
            <h2>Shared crown</h2>
            <Slider label="Diameter" setting={DEFAULTS.crown.diameter} value={values.crownDiameter} onChange={(v) => update("crownDiameter", v)} />
            <div className={styles.derivedGrid}><span>Z</span><strong>0.0000</strong></div>
          </div>

          <div className={styles.panel}>
            <h2>Outer spline</h2>
            <Slider label="ΔX" setting={DEFAULTS.outer.dx} value={values.outerDX} onChange={(v) => update("outerDX", v)} />
            <Slider label="ΔZ" setting={DEFAULTS.outer.dz} value={values.outerDZ} onChange={(v) => update("outerDZ", v)} />
            <Slider label="Crown tangent" setting={DEFAULTS.outer.crownTangent} value={values.outerCrownT} onChange={(v) => update("outerCrownT", v)} />
            <Slider label="End tangent" setting={DEFAULTS.outer.endTangent} value={values.outerEndT} onChange={(v) => update("outerEndT", v)} />
            <Slider label="End angle" setting={DEFAULTS.outer.endAngle} value={values.outerAngle} onChange={(v) => update("outerAngle", v)} disabled />
          </div>

          <div className={styles.panel}>
            <h2>External biarc</h2>
            <Slider label="End X (radius)" setting={DEFAULTS.externalBiarc.endX} value={values.externalBiarcEndX} onChange={(v) => update("externalBiarcEndX", v)} />
            <Slider label="End Z" setting={DEFAULTS.externalBiarc.endZ} value={values.externalBiarcEndZ} onChange={(v) => update("externalBiarcEndZ", v)} />
            <Slider label="First radius" setting={DEFAULTS.externalBiarc.firstRadius} value={values.externalBiarcRadius} onChange={(v) => update("externalBiarcRadius", v)} />
            <div className={styles.derivedGrid}>
              <span>Second radius</span>
              <strong>{model.externalBiarc.valid ? model.externalBiarc.radius2.toFixed(4) : "Invalid"}</strong>
              <span>Meeting X / Z</span>
              <strong>
                {model.externalBiarc.valid
                  ? `${model.externalBiarc.meeting.x.toFixed(4)} / ${model.externalBiarc.meeting.z.toFixed(4)}`
                  : "—"}
              </strong>
            </div>
            {!model.externalBiarc.valid && (
              <div className={`${styles.status} ${styles.warning}`}>
                First radius must be smaller than the calculated sum of radii.
              </div>
            )}
          </div>

          <div className={styles.panel}>
            <h2>Inner spline</h2>
            <Slider label="ΔX" setting={DEFAULTS.inner.dx} value={values.innerDX} onChange={(v) => update("innerDX", v)} />
            <Slider label="ΔZ" setting={DEFAULTS.inner.dz} value={values.innerDZ} onChange={(v) => update("innerDZ", v)} />
            <Slider label="Crown tangent" setting={DEFAULTS.inner.crownTangent} value={values.innerCrownT} onChange={(v) => update("innerCrownT", v)} />
            <Slider label="End tangent" setting={DEFAULTS.inner.endTangent} value={values.innerEndT} onChange={(v) => update("innerEndT", v)} />
            <Slider label="End angle" setting={DEFAULTS.inner.endAngle} value={values.innerAngle} onChange={(v) => update("innerAngle", v)} />
          </div>

          <div className={styles.panel}>
            <h2>Internal junction spline</h2>
            <Slider label="Inward ΔX" setting={DEFAULTS.internalJunction.dx} value={values.junctionDX} onChange={(v) => update("junctionDX", v)} />
            <Slider label="Down ΔZ" setting={DEFAULTS.internalJunction.dz} value={values.junctionDZ} onChange={(v) => update("junctionDZ", v)} />
            <Slider label="Start tangent" setting={DEFAULTS.internalJunction.startTangent} value={values.junctionStartT} onChange={(v) => update("junctionStartT", v)} />
            <Slider label="End tangent" setting={DEFAULTS.internalJunction.endTangent} value={values.junctionEndT} onChange={(v) => update("junctionEndT", v)} />
            <Slider label="End angle" setting={DEFAULTS.internalJunction.endAngle} value={values.junctionEndAngle} onChange={(v) => update("junctionEndAngle", v)} />
          </div>
        </section>

        <aside className={styles.previewColumn}>
          <div className={styles.metrics}>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>RMS at same X</div>
              <div className={styles.metricValue}>{error.rms === null ? "—" : error.rms.toFixed(4)}</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>Maximum</div>
              <div className={styles.metricValue}>{error.maximum === null ? "—" : error.maximum.toFixed(4)}</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>Points used</div>
              <div className={styles.metricValue}>{error.included}</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>Outside spline</div>
              <div className={styles.metricValue}>{error.excluded}</div>
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.checks}>
              <label><input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} /> Raw centres</label>
              <label><input type="checkbox" checked={showCorrected} onChange={(e) => setShowCorrected(e.target.checked)} /> Corrected</label>
              <label><input type="checkbox" checked={showResiduals} onChange={(e) => setShowResiduals(e.target.checked)} /> Same-X residuals</label>
            </div>

            <div className={styles.canvasWrap}>
              <canvas ref={canvasRef} width={950} height={700} className={styles.canvas} />
            </div>

            <div className={styles.legend}>
              <span>Purple: rim splines</span>
              <span>Green: junction spline and biarc</span>
              <span>Orange: corrected data</span>
              <span>Blue dashed: ball centre</span>
            </div>

            {error.excluded > 0 && (
              <div className={`${styles.status} ${styles.warning}`}>
                {error.excluded} corrected point(s) are outside the applicable rim spline X-span or the branch is not monotonic in X.
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
