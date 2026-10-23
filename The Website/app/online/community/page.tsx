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
import SessionChart from "@/components/SessionChart";
import {
  listCommunitySessions,
  listMyCommunityPosts,
  publishSessionToCommunity,
  deleteCommunitySession,
  type CommunitySession,
} from "@/lib/community";

function rmse(a: number[], b: number[]) {
  if (a.length !== b.length || !a.length) return NaN;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s / a.length);
}

function corr(a: number[], b: number[]) {
  if (a.length !== b.length || !a.length) return NaN;
  const n = a.length;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  return Math.sqrt(da * db) === 0 ? NaN : num / Math.sqrt(da * db);
}

function analyzeByType(angles: number[], sessionType?: string) {
  const mode = (sessionType ?? "walk") as any;
  if (mode === "sprint") return analyzeSprintingAngles(angles);
  if (mode === "walk") return analyzeGaitAngles(angles);
  return null;
}

export default function CommunityPage() {
  const { user } = useAuth();

  const [sessions, setSessions] = useState<any[]>([]);
  const [activeId, setActiveId] = useState("");
  const [status, setStatus] = useState("");

  const [community, setCommunity] = useState<CommunitySession[]>([]);
  const [myPosts, setMyPosts] = useState<CommunitySession[]>([]);
  const [pickedCommunityId, setPickedCommunityId] = useState("");

  // Load my sessions
  useEffect(() => {
    if (!user) return;
    (async () => {
      const rows = await listCloudSessions(user.uid);
      setSessions(rows);
      if (!activeId && rows[0]) setActiveId(rows[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Load community feed
  useEffect(() => {
    (async () => {
      const rows = await listCommunitySessions();
      setCommunity(rows);
      if (!pickedCommunityId && rows[0]) setPickedCommunityId(rows[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load my published posts
  useEffect(() => {
    if (!user) return;
    (async () => {
      const rows = await listMyCommunityPosts(user.uid);
      setMyPosts(rows);
    })();
  }, [user]);

  const active = useMemo(
    () => sessions.find((s) => s.id === activeId),
    [sessions, activeId]
  );

  const activeSamples: Sample[] = useMemo(
    () => (active?.samples ?? []).map((x: any) => ({ t: x.t, angle: x.angle })),
    [active]
  );

  const activeAngles = useMemo(
    () => activeSamples.map((s) => s.angle),
    [activeSamples]
  );

  const myGait = useMemo(
    () => analyzeByType(activeAngles, active?.sessionType),
    [activeAngles, active?.sessionType]
  );

  const pickedCommunity = useMemo(
    () => community.find((c) => c.id === pickedCommunityId) ?? null,
    [community, pickedCommunityId]
  );

  const similarity = useMemo(() => {
    if (!myGait || !pickedCommunity?.gait?.averageCycle) return null;
    return {
      rmse: rmse(myGait.averageCycle, pickedCommunity.gait.averageCycle),
      corr: corr(myGait.averageCycle, pickedCommunity.gait.averageCycle),
    };
  }, [myGait, pickedCommunity]);

  const onPublish = async () => {
    if (!user) return;
    setStatus("");

    try {
      if (!active) throw new Error("Select a session first.");
      if (!activeSamples.length) throw new Error("That session has no samples.");

      setStatus("Publishing to community…");

      await publishSessionToCommunity({
        ownerUid: user.uid,
        ownerLabel: "Anonymous",
        title: active.displayName ?? active.title ?? "Session",
        sourceSessionId: active.id,
        samples: activeSamples,
      });

      const [all, mine] = await Promise.all([
        listCommunitySessions(),
        listMyCommunityPosts(user.uid),
      ]);

      setCommunity(all);
      setMyPosts(mine);
      setStatus("Published successfully.");
    } catch (e: any) {
      setStatus(e?.message ?? "Failed to publish.");
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Community"
        subtitle="Publish sessions anonymously and compare average gait cycles."
      />

      {status && (
        <div className="rounded-xl border bg-white p-3 text-sm text-slate-700">
          {status}
        </div>
      )}

      <Card title="Publish a session">
        <div className="grid gap-3 md:grid-cols-3">
          <select
            value={activeId}
            onChange={(e) => setActiveId(e.target.value)}
            className="rounded-xl border bg-white px-3 py-2 text-sm md:col-span-2"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName ?? s.title}
              </option>
            ))}
          </select>

          <button
            onClick={onPublish}
            className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
          >
            Publish to Community
          </button>
        </div>

        <div className="mt-4">
          {activeSamples.length ? (
            <SessionChart samples={activeSamples} />
          ) : (
            <p className="text-sm text-slate-600">
              Select a session with samples to preview.
            </p>
          )}
        </div>
      </Card>

      <Card title="My published sessions">
        {!myPosts.length ? (
          <p className="text-sm text-slate-600">
            You haven’t published any sessions yet.
          </p>
        ) : (
          <div className="space-y-3">
            {myPosts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"
              >
                <div>
                  <div className="font-semibold">{p.title}</div>
                  <div className="text-xs text-slate-500">
                    Cycles kept: {p.gait.cyclesKept}
                  </div>
                </div>

                <button
                  onClick={async () => {
                    if (!confirm("Delete this published session?")) return;
                    await deleteCommunitySession(p.id);
                    setCommunity((c) => c.filter((x) => x.id !== p.id));
                    setMyPosts((m) => m.filter((x) => x.id !== p.id));
                  }}
                  className="rounded-lg border border-red-500 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Explore community sessions">
          {!community.length ? (
            <p className="text-sm text-slate-600">
              No community sessions yet.
            </p>
          ) : (
            <select
              value={pickedCommunityId}
              onChange={(e) => setPickedCommunityId(e.target.value)}
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
            >
              {community.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} — Anonymous
                </option>
              ))}
            </select>
          )}
        </Card>

        <Card title="Average gait cycle comparison">
          {!myGait || !pickedCommunity?.gait ? (
            <p className="text-sm text-slate-600">
              Select valid sessions to compare gait cycles.
            </p>
          ) : (
            <div className="space-y-4">
              <GaitCycleChart
                cycles={[pickedCommunity.gait.averageCycle]}
                average={myGait.averageCycle}
                comparisonStroke="#dc2626"
              />

              <div className="grid gap-3 md:grid-cols-4">
                <Stat label="Your peak flex" value={`${myGait.peakFlexion.toFixed(1)}°`} />
                <Stat label="Their peak flex" value={`${pickedCommunity.gait.peakFlexion.toFixed(1)}°`} />
                <Stat label="RMSE" value={similarity ? similarity.rmse.toFixed(2) : "—"} />
                <Stat label="Correlation" value={similarity ? similarity.corr.toFixed(2) : "—"} />
              </div>
            </div>
          )}
        </Card>
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
