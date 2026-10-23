"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import Card from "@/components/Card";
import SessionChart from "@/components/SessionChart";
import GaitCycleChart from "@/components/GaitCycleChart";

import { useAuth } from "@/lib/auth";
import { getCloudSession } from "@/lib/firestore";
import {
  computeStats,
  toCSV,
  percentile,
  type Sample,
} from "@/lib/analytics";
import { analyzeGaitAngles } from "@/lib/gaitAnalysis";
import { analyzeSprintingAngles } from "@/lib/sprintGaitAnalysis";
import { downloadTextFile } from "@/lib/fileTransfer";

export default function SessionDocPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { user } = useAuth();
  const [session, setSession] = useState<any>(null);

  /* -----------------------------
     Load session
  ----------------------------- */
  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const s = await getCloudSession(id);
      setSession(s);
    };
    load();
  }, [user, id]);

  /* -----------------------------
     Raw samples
  ----------------------------- */
  const samples: Sample[] = useMemo(
    () => session?.samples ?? [],
    [session]
  );

  /* -----------------------------
     Raw data analytics
  ----------------------------- */
  const stats = useMemo(
    () => computeStats(samples),
    [samples]
  );

  const p10 = useMemo(
    () => percentile(samples, 10),
    [samples]
  );
  const p50 = useMemo(
    () => percentile(samples, 50),
    [samples]
  );
  const p90 = useMemo(
    () => percentile(samples, 90),
    [samples]
  );

  /* -----------------------------
     Python-logic gait analysis
  ----------------------------- */
  const gait = useMemo(() => {
    if (!samples.length) return null;

    const mode = (session?.sessionType ?? "walk") as any;

    if (mode === "sprint") {
      return analyzeSprintingAngles(samples.map((s) => s.angle));
    }

    if (mode === "walk") {
      return analyzeGaitAngles(samples.map((s) => s.angle));
    }

    // "other" => no gait-cycle analysis
    return null;
  }, [samples, session?.sessionType]);

  /* -----------------------------
     Guards
  ----------------------------- */
  if (!user) {
    return (
      <p className="text-sm text-slate-600">
        Sign in to view this session.
      </p>
    );
  }

  if (!session) {
    return (
      <p className="text-sm text-slate-600">
        Loading…
      </p>
    );
  }

  const created = (
    session.createdAt?.toDate?.() ??
    new Date(session.createdAtMs)
  ).toLocaleString();

  /* -----------------------------
     Render
  ----------------------------- */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">
          {session.title}
        </h1>
        <p className="text-sm text-slate-600">
          {created} • {stats?.sampleCount ?? 0} samples
        </p>
      </div>

      {/* =============================
          RAW DATA GRAPH
      ============================== */}
      <Card title="Angle vs Time (Raw Data)">
        <p className="mb-2 text-sm text-slate-600">
          All recorded angle values plotted over time.
          No processing or normalization is applied.
        </p>
        <SessionChart samples={samples} />
      </Card>

      {/* =============================
          RAW DATA ANALYTICS
      ============================== */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Key Analytics (Raw Data)">
          {!stats ? (
            <p className="text-sm text-slate-500">
              No data available.
            </p>
          ) : (
            <div className="space-y-2 text-sm text-slate-700">
              <div>
                <b>Duration:</b>{" "}
                {stats.durationSec.toFixed(1)} s
              </div>
              <div>
                <b>Min / Max:</b>{" "}
                {stats.min.toFixed(2)}° /{" "}
                {stats.max.toFixed(2)}°
              </div>
              <div>
                <b>ROM:</b>{" "}
                {stats.rom.toFixed(2)}°
              </div>
              <div>
                <b>Mean ± SD:</b>{" "}
                {stats.mean.toFixed(2)}° ±{" "}
                {stats.stdev.toFixed(2)}°
              </div>
              <div>
                <b>Velocity avg / max:</b>{" "}
                {stats.velMean.toFixed(1)} /{" "}
                {stats.velMax.toFixed(1)} deg/s
              </div>
              <div>
                <b>Rep estimate:</b>{" "}
                {stats.reps}
              </div>
            </div>
          )}
        </Card>

        <Card title="Distribution (Raw Data)">
          <div className="space-y-2 text-sm text-slate-700">
            <div>
              <b>P10:</b>{" "}
              {p10?.toFixed(2) ?? "—"}°
            </div>
            <div>
              <b>P50 (median):</b>{" "}
              {p50?.toFixed(2) ?? "—"}°
            </div>
            <div>
              <b>P90:</b>{" "}
              {p90?.toFixed(2) ?? "—"}°
            </div>
            <p className="text-xs text-slate-500">
              Percentiles are computed directly from
              the raw time-series data.
            </p>
          </div>
        </Card>
      </div>

      {/* =============================
          PYTHON-LOGIC ANALYSIS
      ============================== */}
      {gait ? (
        <Card title="Normalized Gait Cycle Analysis (Python Logic)">
          <p className="mb-3 text-sm text-slate-600">
            Gait cycles are detected, windowed, normalized
            to 100 points, filtered, and averaged using
            the same logic as the original Python script.
          </p>

          <GaitCycleChart
            cycles={gait.cycles}
            average={gait.averageCycle}
          />

          <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
            <div>
              <b>Peak Flexion:</b>{" "}
              {gait.peakFlexion.toFixed(1)}°
            </div>
            <div>
              <b>Peak Extension:</b>{" "}
              {gait.peakExtension.toFixed(1)}°
            </div>
            <div>
              <b>Heel Strike Index:</b>{" "}
              {gait.heelStrikeIndex}
            </div>
            <div>
              <b>Toe-Off Index:</b>{" "}
              {gait.toeOffIndex}
            </div>
          </div>
        </Card>
      ) : (
        <Card title="Normalized Gait Cycle Analysis (Python Logic)">
          <p className="text-sm text-slate-600">
            No valid gait cycles were detected in this session.
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
            <li>
              The angle signal did not exceed the minimum
              flexion threshold.
            </li>
            <li>
              No repeated flexion–extension cycles were found.
            </li>
            <li>
              The signal may be flat or dominated by noise.
            </li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Try recording a session with repeated knee
            flexion and extension (e.g., 3–5 reps reaching
            60–100°).
          </p>
        </Card>
      )}

      {/* =============================
          EXPORT
      ============================== */}
      <Card title="Export + Copy">
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50"
            onClick={async () => {
              await navigator.clipboard.writeText(
                toCSV(samples)
              );
              alert("Copied CSV ✅");
            }}
          >
            Copy CSV
          </button>

          <button
            className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50"
            onClick={() =>
              downloadTextFile(
                `knexflex_${id}.csv`,
                toCSV(samples),
                "text/csv"
              )
            }
          >
            Download CSV
          </button>

          <button
            className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50"
            onClick={() =>
              downloadTextFile(
                `knexflex_${id}.json`,
                JSON.stringify(session, null, 2)
              )
            }
          >
            Download JSON
          </button>
        </div>
      </Card>
    </div>
  );
}
