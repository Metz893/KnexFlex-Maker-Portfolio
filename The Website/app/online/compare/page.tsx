// app/online/compare/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import SectionTitle from "@/components/SectionTitle";
import { useAuth } from "@/lib/auth";
import { listCloudSessions } from "@/lib/firestore";
import SessionChart from "@/components/SessionChart";
import { computeStats, type Sample } from "@/lib/analytics";
import { symmetryScore } from "@/lib/analyticsPro";

export default function ComparePage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const rows = await listCloudSessions(user.uid);
      setSessions(rows);
      if (!aId && rows[0]) setAId(rows[0].id);
      if (!bId && rows[1]) setBId(rows[1].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const A = useMemo(() => sessions.find((s) => s.id === aId), [sessions, aId]);
  const B = useMemo(() => sessions.find((s) => s.id === bId), [sessions, bId]);

  const aSamples: Sample[] = useMemo(() => (A?.samples ?? []).map((x: any) => ({ t: x.t, angle: x.angle })), [A]);
  const bSamples: Sample[] = useMemo(() => (B?.samples ?? []).map((x: any) => ({ t: x.t, angle: x.angle })), [B]);

  const aStats = useMemo(() => computeStats(aSamples), [aSamples]);
  const bStats = useMemo(() => computeStats(bSamples), [bSamples]);

  const sym = useMemo(() => {
    // Use downsampled angles for similarity on comparable lengths
    const a = aSamples.map((s) => s.angle);
    const b = bSamples.map((s) => s.angle);
    return symmetryScore(a, b);
  }, [aSamples, bSamples]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Compare Sessions"
        subtitle="Overlay two sessions and quantify changes in ROM, velocity, and similarity."
      />

      <Card title="Pick sessions">
        <div className="grid gap-3 md:grid-cols-2">
          <select value={aId} onChange={(e) => setAId(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm">
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.displayName ?? s.title}</option>
            ))}
          </select>

          <select value={bId} onChange={(e) => setBId(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm">
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.displayName ?? s.title}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card title="Overlay chart">
        <SessionChart samples={aSamples} overlay={bSamples} />
      </Card>

      <Card title="Comparison metrics">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <div className="text-xs text-slate-500">ROM A → B</div>
            <div className="mt-1 font-semibold">
              {(aStats?.rom ?? 0).toFixed(1)}° → {(bStats?.rom ?? 0).toFixed(1)}°
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <div className="text-xs text-slate-500">Reps A → B</div>
            <div className="mt-1 font-semibold">
              {aStats?.reps ?? 0} → {bStats?.reps ?? 0}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <div className="text-xs text-slate-500">Similarity score</div>
            <div className="mt-1 font-semibold">
              {sym ? `${sym.score.toFixed(0)}/100` : "—"}
            </div>
            {sym ? <div className="mt-1 text-xs text-slate-600">RMSE: {sym.rmse.toFixed(2)}</div> : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
