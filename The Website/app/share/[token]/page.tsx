// app/share/[token]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import SessionChart from "@/components/SessionChart";
import { getShareLinkByToken, getCloudSession } from "@/lib/firestore";
import { computeStats, type Sample } from "@/lib/analytics";
import { computeQuality } from "@/lib/analyticsPro";
import QualityBadge from "@/components/QualityBadge";

export default function SharePage({ params }: { params: { token: string } }) {
  const [status, setStatus] = useState("Loading…");
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const link = await getShareLinkByToken(params.token);
      if (!link) return setStatus("Invalid link.");
      if (link.revoked) return setStatus("This link was revoked.");
      if (link.expiresAtMs && Date.now() > link.expiresAtMs) return setStatus("This link expired.");

      const s = await getCloudSession(link.sessionId);
      if (!s) return setStatus("Session not found.");
      setSession(s);
      setStatus("");
    })();
  }, [params.token]);

  const samples: Sample[] = useMemo(() => (session?.samples ?? []).map((x: any) => ({ t: x.t, angle: x.angle })), [session]);
  const stats = useMemo(() => computeStats(samples), [samples]);
  const quality = useMemo(() => computeQuality(samples), [samples]);

  if (status) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl">
          <Card title="KnexFlex Share">{status}</Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <Card
          title={session.displayName ?? session.title}
          right={quality ? <QualityBadge score={quality.score} /> : null}
        >
          <div className="text-sm text-slate-600">
            Read-only shared session • {stats?.sampleCount ?? 0} samples • ROM {(stats?.rom ?? 0).toFixed(1)}°
          </div>
        </Card>

        <Card title="Angle chart">
          <SessionChart samples={samples} />
        </Card>

        <Card title="Summary">
          <div className="grid gap-3 md:grid-cols-4 text-sm">
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-xs text-slate-500">ROM</div>
              <div className="mt-1 font-semibold">{(stats?.rom ?? 0).toFixed(1)}°</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Mean</div>
              <div className="mt-1 font-semibold">{(stats?.mean ?? 0).toFixed(1)}°</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Reps</div>
              <div className="mt-1 font-semibold">{stats?.reps ?? 0}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Duration</div>
              <div className="mt-1 font-semibold">{(stats?.durationSec ?? 0).toFixed(1)} s</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
