// app/online/gait-similarity/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import SectionTitle from "@/components/SectionTitle";
import GaitCycleChart from "@/components/GaitCycleChart";
import { useAuth } from "@/lib/auth";
import { listCloudSessions } from "@/lib/firestore";
import { analyzeGaitAngles } from "@/lib/gaitAnalysis";
import {
  gaitSimilarityShapeOnly,
  gaitSimilarityWithShift,
} from "@/lib/gaitSimilarity";

type SessionRow = any;

export default function GaitSimilarityPage() {
  const { user } = useAuth();

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const rows = await listCloudSessions(user.uid);
      setSessions(rows);

      // Set defaults if empty
      if (!aId && rows[0]) setAId(rows[0].id);
      if (!bId && (rows[1] ?? rows[0])) setBId((rows[1] ?? rows[0]).id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const A = useMemo(() => sessions.find((s) => s.id === aId), [sessions, aId]);
  const B = useMemo(() => sessions.find((s) => s.id === bId), [sessions, bId]);

  const aAngles = useMemo(
    () => (A?.samples ?? []).map((x: any) => Number(x.angle)).filter((n: number) => Number.isFinite(n)),
    [A]
  );
  const bAngles = useMemo(
    () => (B?.samples ?? []).map((x: any) => Number(x.angle)).filter((n: number) => Number.isFinite(n)),
    [B]
  );

  const aGait = useMemo(
    () => (aAngles.length ? analyzeGaitAngles(aAngles) : null),
    [aAngles]
  );
  const bGait = useMemo(
    () => (bAngles.length ? analyzeGaitAngles(bAngles) : null),
    [bAngles]
  );

  // Config: looser + score out of 1000
  const simConfig = useMemo(
    () => ({
      maxScore: 1000,

      // Higher = more forgiving
      shapeSigmaDeg: 16,
      eventSigmaSamples: 26,
      romSigmaDeg: 24,

      // Lower weights = easier to still get a score even if timing/ROM differ
      eventWeight: 0.2,
      romWeight: 0.12,
    }),
    []
  );

  const simShapeOnly = useMemo(() => {
    if (!aGait || !bGait) return null;
    return gaitSimilarityShapeOnly(aGait, bGait, {
      ...simConfig,
      // A bit stricter on shape-only is fine because we’re already forgiving overall
      shapeSigmaDeg: 14,
    });
  }, [aGait, bGait, simConfig]);

  const simWithShift = useMemo(() => {
    if (!aGait || !bGait) return null;
    return gaitSimilarityWithShift(aGait, bGait, {
      ...simConfig,
      // Give a little extra forgiveness since vertical shift can inflate RMSE
      shapeSigmaDeg: 18,
    });
  }, [aGait, bGait, simConfig]);

  const aLabel = A?.displayName ?? A?.title ?? "Session A";
  const bLabel = B?.displayName ?? B?.title ?? "Session B";

  const aRom = aGait ? aGait.peakFlexion - aGait.peakExtension : null;
  const bRom = bGait ? bGait.peakFlexion - bGait.peakExtension : null;

  const canCompute = !!aGait && !!bGait;

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Gait Similarity"
        subtitle="Compares sessions using the average gait cycle (100-point normalized cycle) produced by analyzeGaitAngles()."
      />

      <Card title="Pick sessions">
        <div className="grid gap-3 md:grid-cols-2">
          <select
            value={aId}
            onChange={(e) => setAId(e.target.value)}
            className="rounded-xl border bg-white px-3 py-2 text-sm"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName ?? s.title}
              </option>
            ))}
          </select>

          <select
            value={bId}
            onChange={(e) => setBId(e.target.value)}
            className="rounded-xl border bg-white px-3 py-2 text-sm"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName ?? s.title}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          This page extracts gait cycles from each session. If the detector rejects everything (noise, too few peaks,
          etc.), you’ll get no score.
        </div>
      </Card>

      <Card title="Average gait cycles (overlay)">
        {!canCompute ? (
          <div className="text-sm text-slate-600">
            {aAngles.length < 200 || bAngles.length < 200 ? (
              <>
                One or both sessions don’t have enough samples. Need at least ~200 samples each (your gait analyzer
                returns null below that).
              </>
            ) : (
              <>
                Couldn’t extract a stable gait cycle from one of the sessions (Peak detection + Filtering rejected all
                cycles).
              </>
            )}
          </div>
        ) : (
          <>
            <div className="mb-2 text-xs text-slate-500">
              Black = {aLabel} average. Blue = {bLabel} average.
            </div>

            <GaitCycleChart
              cycles={[bGait!.averageCycle]}
              average={aGait!.averageCycle}
              comparisonStroke="#2563eb"
            />

            <div className="mt-3 grid gap-2 md:grid-cols-2 text-xs text-slate-600">
              <div>
                <span className="text-slate-500">ROM:</span>{" "}
                {aRom !== null ? aRom.toFixed(1) : "—"}° vs{" "}
                {bRom !== null ? bRom.toFixed(1) : "—"}°
              </div>
            </div>
          </>
        )}
      </Card>

      <Card title="Similarity scores (0–1000)">
        {!canCompute || !simShapeOnly || !simWithShift ? (
          <div className="text-sm text-slate-600">—</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Shape-only */}
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Shape-only (ignores vertical shift)</div>
              <div className="mt-1 text-2xl font-semibold">
                {simShapeOnly.score.toFixed(0)}/1000
              </div>

              <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                <div>
                  <div className="text-xs text-slate-500">Shape RMSE</div>
                  <div className="font-medium">{simShapeOnly.shapeRmseDeg.toFixed(2)}°</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">ΔROM</div>
                  <div className="font-medium">{simShapeOnly.romDeltaDeg.toFixed(1)}°</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">ΔHS / ΔTO</div>
                  <div className="font-medium">
                    {simShapeOnly.eventDelta.heelStrike} / {simShapeOnly.eventDelta.toeOff}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">ΔPeak</div>
                  <div className="font-medium">{simShapeOnly.eventDelta.peakFlexion}</div>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-600">
                Best when sensor zeroing drifts or the whole curve is shifted up/down but the movement pattern is the same.
              </div>
            </div>

            {/* With vertical shift */}
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Shape + vertical shift (offset matters)</div>
              <div className="mt-1 text-2xl font-semibold">
                {simWithShift.score.toFixed(0)}/1000
              </div>

              <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                <div>
                  <div className="text-xs text-slate-500">Shape RMSE</div>
                  <div className="font-medium">{simWithShift.shapeRmseDeg.toFixed(2)}°</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">ΔROM</div>
                  <div className="font-medium">{simWithShift.romDeltaDeg.toFixed(1)}°</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">ΔHS / ΔTO</div>
                  <div className="font-medium">
                    {simWithShift.eventDelta.heelStrike} / {simWithShift.eventDelta.toeOff}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">ΔPeak</div>
                  <div className="font-medium">{simWithShift.eventDelta.peakFlexion}</div>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-600">
                Best when absolute knee angle level matters and you want offset differences to reduce similarity.
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
