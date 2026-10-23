// app/online/analytics/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import SectionTitle from "@/components/SectionTitle";
import MetricCard from "@/components/MetricCard";
import QualityBadge from "@/components/QualityBadge";
import { useAuth } from "@/lib/auth";
import { listCloudSessions } from "@/lib/firestore";
import { computeStats, type Sample } from "@/lib/analytics";
import { computeQuality, fatigueIndex, velocity, acceleration } from "@/lib/analyticsPro";
import SessionChart from "@/components/SessionChart";

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const rows = await listCloudSessions(user.uid);
      setSessions(rows);
      if (!activeId && rows[0]) setActiveId(rows[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const active = useMemo(() => sessions.find((s) => s.id === activeId), [sessions, activeId]);

  const samples: Sample[] = useMemo(() => {
    const raw = active?.samples ?? [];
    return raw.map((x: any) => ({ t: Number(x.t), angle: Number(x.angle) }));
  }, [active]);

  const stats = useMemo(() => computeStats(samples), [samples]);
  const quality = useMemo(() => computeQuality(samples), [samples]);
  const fatigue = useMemo(() => fatigueIndex(samples), [samples]);
  const vels = useMemo(() => velocity(samples), [samples]);
  const accs = useMemo(() => acceleration(samples), [samples]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Advanced Analytics"
        subtitle="Clinical-grade insights: quality, fatigue proxy, velocity/acceleration, and export-ready charts."
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

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="ROM" value={`${(stats?.rom ?? 0).toFixed(1)}°`} sub="Range of motion" />
        <MetricCard label="Reps" value={`${stats?.reps ?? 0}`} sub="Estimated repetitions" />
        <MetricCard label="Mean Vel" value={`${(stats?.velMean ?? 0).toFixed(1)}°/s`} sub="Avg angular speed" />
        <MetricCard label="Max Vel" value={`${(stats?.velMax ?? 0).toFixed(1)}°/s`} sub="Peak angular speed" />
      </div>

      <Card
        title="Signal Quality"
        right={quality ? <QualityBadge score={quality.score} /> : null}
      >
        {!quality ? (
          <p className="text-sm text-slate-600">Select a session with samples to view quality.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <div className="text-xs text-slate-500">Jitter</div>
              <div className="mt-1 font-semibold">{quality.jitter.toFixed(2)}°</div>
              <div className="mt-1 text-xs text-slate-600">Average absolute change per sample.</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <div className="text-xs text-slate-500">Dropouts</div>
              <div className="mt-1 font-semibold">{quality.dropoutRate.toFixed(1)}%</div>
              <div className="mt-1 text-xs text-slate-600">Gaps or non-increasing timestamps.</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <div className="text-xs text-slate-500">Clipping</div>
              <div className="mt-1 font-semibold">{quality.clippingRate.toFixed(1)}%</div>
              <div className="mt-1 text-xs text-slate-600">Time near extreme bounds.</div>
            </div>
          </div>
        )}
      </Card>

      <Card title="Angle Time Series">
        <SessionChart samples={samples} />
      </Card>

      <Card title="Derived Signals (Velocity & Acceleration)">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <div className="text-sm font-semibold text-slate-800">Velocity (deg/s)</div>
            <div className="mt-2 text-xs text-slate-500">
              Showing distribution preview: first 12 values
            </div>
            <pre className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
              {JSON.stringify(vels.slice(0, 12).map((x) => Number(x.toFixed(2))), null, 2)}
            </pre>
          </div>

          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <div className="text-sm font-semibold text-slate-800">Acceleration (deg/s²)</div>
            <div className="mt-2 text-xs text-slate-500">
              Showing distribution preview: first 12 values
            </div>
            <pre className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
              {JSON.stringify(accs.slice(0, 12).map((x) => Number(x.toFixed(2))), null, 2)}
            </pre>
          </div>
        </div>
      </Card>

      <Card title="Fatigue Proxy">
        {!fatigue ? (
          <p className="text-sm text-slate-600">Not enough samples to estimate fatigue proxy.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <div className="text-xs text-slate-500">ROM Start</div>
              <div className="mt-1 font-semibold">{fatigue.romStart.toFixed(1)}°</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <div className="text-xs text-slate-500">ROM End</div>
              <div className="mt-1 font-semibold">{fatigue.romEnd.toFixed(1)}°</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <div className="text-xs text-slate-500">Decay</div>
              <div className="mt-1 font-semibold">{fatigue.decayPct.toFixed(1)}%</div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
