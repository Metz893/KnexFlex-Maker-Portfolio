"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import SectionTitle from "@/components/SectionTitle";
import { useAuth } from "@/lib/auth";
import { listCloudSessions } from "@/lib/firestore";
import type { Sample } from "@/lib/analytics";
import { analyzeGaitAngles } from "@/lib/gaitAnalysis";
import { analyzeSprintingAngles } from "@/lib/sprintGaitAnalysis";
import GaitCycleChart from "@/components/GaitCycleChart";

type SessionType = "walk" | "sprint" | "other";

function getType(s: any): SessionType {
  const t = s?.sessionType;
  if (t === "walk" || t === "sprint" || t === "other") return t;
  return "walk"; // default for older sessions
}

// ✅ NEW: download helper (only the averaged cycle values)
// ✅ NEW: download helper (only the averaged cycle values)
function downloadAverageCycleJSON(avg: number[], fileBaseName: string) {
  // Map averaged cycle to { angle, t } objects
  const payload = avg.map((angle, i) => ({
    angle,
    t: Math.round((i / (avg.length - 1)) * 100), // % of gait cycle
  }));

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });

  const safeName = (fileBaseName || "average_gait_cycle")
    .replace(/[^\w\-]+/g, "_")
    .slice(0, 80);

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}.json`;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


export default function GaitLabPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeId, setActiveId] = useState("");
  const [compareId, setCompareId] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const rows = await listCloudSessions(user.uid);
      setSessions(rows);
      if (!activeId && rows[0]) setActiveId(rows[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const active = useMemo(
    () => sessions.find((s) => s.id === activeId),
    [sessions, activeId]
  );

  const compare = useMemo(
    () => sessions.find((s) => s.id === compareId),
    [sessions, compareId]
  );

  const samples: Sample[] = useMemo(
    () => (active?.samples ?? []).map((x: any) => ({ t: x.t, angle: x.angle })),
    [active]
  );

  const compareSamples: Sample[] = useMemo(
    () => (compare?.samples ?? []).map((x: any) => ({ t: x.t, angle: x.angle })),
    [compare]
  );

  const angles = useMemo(() => samples.map((s) => s.angle), [samples]);
  const compareAngles = useMemo(
    () => compareSamples.map((s) => s.angle),
    [compareSamples]
  );

  // ✅ choose analyzer by sessionType (active)
  const gait = useMemo(() => {
    const t = getType(active);
    if (t === "other") return null;
    if (t === "sprint") return analyzeSprintingAngles(angles);
    return analyzeGaitAngles(angles);
  }, [angles, active]);

  // ✅ choose analyzer by sessionType (compare)
  const compareGait = useMemo(() => {
    if (!compareId) return null;
    const t = getType(compare);
    if (t === "other") return null;
    if (t === "sprint") return analyzeSprintingAngles(compareAngles);
    return analyzeGaitAngles(compareAngles);
  }, [compareAngles, compare, compareId]);

  // ✅ NEW: Key stats for the AVERAGE cycle (computed from gait.averageCycle)
  const avgCycleStats = useMemo(() => {
    if (!gait?.averageCycle?.length) return null;

    const a = gait.averageCycle;

    let min = Infinity;
    let max = -Infinity;
    let sum = 0;

    for (const v of a) {
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }

    const mean = sum / a.length;
    const overall = max - min; // spread of the average curve

    return { min, max, mean, overall };
  }, [gait]);

  // ✅ NEW: Key stats for ALL cycles in the session (computed from gait.cycles)
  const allCyclesStats = useMemo(() => {
    if (!gait?.cycles?.length) return null;

    const cycles = gait.cycles;

    let globalMin = Infinity;
    let globalMax = -Infinity;

    const cycleMeans: number[] = [];
    const cycleRanges: number[] = [];

    for (const c of cycles) {
      if (!c?.length) continue;

      let cMin = Infinity;
      let cMax = -Infinity;
      let cSum = 0;

      for (const v of c) {
        if (v < cMin) cMin = v;
        if (v > cMax) cMax = v;
        cSum += v;
      }

      const cMean = cSum / c.length;
      const cRange = cMax - cMin;

      cycleMeans.push(cMean);
      cycleRanges.push(cRange);

      if (cMin < globalMin) globalMin = cMin;
      if (cMax > globalMax) globalMax = cMax;
    }

    if (!cycleMeans.length) return null;

    const meanOfMeans =
      cycleMeans.reduce((a, b) => a + b, 0) / cycleMeans.length;

    const meanRange =
      cycleRanges.reduce((a, b) => a + b, 0) / cycleRanges.length;

    const overall = globalMax - globalMin; // overall spread across all cycles

    return {
      cyclesKept: cycles.length,
      globalMin,
      globalMax,
      meanOfMeans,
      meanRange,
      overall,
    };
  }, [gait]);

  const comparisonStats = useMemo(() => {
    if (!gait || !compareGait) return null;

    const avgA = gait.averageCycle;
    const avgB = compareGait.averageCycle;

    // If somehow lengths differ, don’t crash
    const n = Math.min(avgA.length, avgB.length);
    if (n < 5) return null;

    const mad =
      avgA.slice(0, n).reduce((sum, v, i) => sum + Math.abs(v - avgB[i]), 0) / n;

    return {
      peakFlexDiff: gait.peakFlexion - compareGait.peakFlexion,
      heelStrikeDiff: gait.heelStrikeIndex - compareGait.heelStrikeIndex,
      toeOffDiff: gait.toeOffIndex - compareGait.toeOffIndex,
      meanAbsDeviation: mad,
    };
  }, [gait, compareGait]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Gait Lab"
        subtitle="Normalize cycles, overlay repeats, and extract gait events (heel strike / toe off)."
        right={
          <select
            value={activeId}
            onChange={(e) => setActiveId(e.target.value)}
            className="rounded-xl border bg-white px-3 py-2 text-sm"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName ?? s.title}
              </option>
            ))}
          </select>
        }
      />

      {/* =========================
          SINGLE SESSION — AREA 1
          Average gait-cycle graph + key stats from the AVERAGE curve
         ========================= */}
      <Card title="Average Gait Cycle (Key Data)">
        {!gait ? (
          <p className="text-sm text-slate-600">
            Not enough valid cycles detected for this session type. Try a longer session
            or cleaner signal.
          </p>
        ) : (
          <div className="space-y-4">
            <GaitCycleChart cycles={gait.cycles} average={gait.averageCycle} />

            <div className="grid gap-3 md:grid-cols-4">
              <Stat label="Heel strike" value={`${gait.heelStrikeIndex}%`} />
              <Stat label="Toe off" value={`${gait.toeOffIndex}%`} />
              <Stat label="Peak flex" value={`${gait.peakFlexion.toFixed(1)}°`} />
              <Stat
                label="Avg mean"
                value={
                  avgCycleStats ? `${avgCycleStats.mean.toFixed(2)}°` : "—"
                }
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Stat
                label="Avg min / max"
                value={
                  avgCycleStats
                    ? `${avgCycleStats.min.toFixed(2)}° / ${avgCycleStats.max.toFixed(2)}°`
                    : "—"
                }
              />
              <Stat
                label="Avg overall"
                value={
                  avgCycleStats ? `${avgCycleStats.overall.toFixed(2)}°` : "—"
                }
              />
              <Stat label="Cycles kept" value={gait.cycles.length} />
            </div>
          </div>
        )}
      </Card>

      {/* =========================
          SINGLE SESSION — AREA 2
          Key data across ALL gait cycles in that session
         ========================= */}

      {/* ADVANCED COMPARISON (UNCHANGED) */}
      <Card
        title="Average Cycle Comparison"
        right={
          <select
            value={compareId}
            onChange={(e) => setCompareId(e.target.value)}
            className="rounded-xl border bg-white px-3 py-2 text-sm"
          >
            <option value="">Select session to compare</option>
            {sessions
              .filter((s) => s.id !== activeId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName ?? s.title}
                </option>
              ))}
          </select>
        }
      >
        {!gait || !compareGait ? (
          <p className="text-sm text-slate-600">
            Select a valid second session to compare average gait cycles.
          </p>
        ) : (
          <div className="space-y-6">
            <GaitCycleChart
              cycles={[compareGait.averageCycle]}
              average={gait.averageCycle}
            />

            {comparisonStats && (
              <div className="grid gap-3 md:grid-cols-4">
                <Stat
                  label="Peak flex Δ"
                  value={`${comparisonStats.peakFlexDiff.toFixed(1)}°`}
                />
                <Stat
                  label="Heel strike Δ"
                  value={`${comparisonStats.heelStrikeDiff}%`}
                />
                <Stat
                  label="Toe off Δ"
                  value={`${comparisonStats.toeOffDiff}%`}
                />
                <Stat
                  label="Mean abs deviation"
                  value={`${comparisonStats.meanAbsDeviation.toFixed(2)}°`}
                />
              </div>
            )}

            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                This comparison overlays the <b>average gait cycle</b> from two sessions.
                Differences in timing (heel strike / toe off) indicate cadence or stance-phase
                changes, while amplitude differences reflect altered joint loading, fatigue,
                or compensation.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Interpretation Guide (UNCHANGED) */}
      <Card title="Interpretation Guide">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Bold line = current session average</li>
          <li>Lighter line = comparison session average</li>
          <li>Peak differences suggest loading or fatigue effects</li>
          <li>Timing shifts may indicate cadence or asymmetry changes</li>
        </ul>
      </Card>

      {/* ✅ NEW: Download button at bottom */}
      <div className="pt-2">
        <button
          type="button"
          disabled={!gait?.averageCycle?.length}
          onClick={() =>
            gait?.averageCycle?.length &&
            downloadAverageCycleJSON(
              gait.averageCycle,
              active?.displayName ?? active?.title ?? "average_gait_cycle"
            )
          }
          className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Download average gait cycle (.json)
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
