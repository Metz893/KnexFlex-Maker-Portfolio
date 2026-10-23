// app/online/reports/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import SectionTitle from "@/components/SectionTitle";
import { useAuth } from "@/lib/auth";
import { listCloudSessions, createShareLink } from "@/lib/firestore";
import { computeStats, type Sample } from "@/lib/analytics";
import { computeQuality } from "@/lib/analyticsPro";
import { analyzeGaitAngles } from "@/lib/gaitAnalysis";
import { analyzeSprintingAngles } from "@/lib/sprintGaitAnalysis";
import { buildClinicianReportHTML, openPrintWindow } from "@/lib/reporting";
import { shareUrl } from "@/lib/share";

export default function ReportsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeId, setActiveId] = useState("");
  const [shareLink, setShareLink] = useState<string>("");

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

  const samples: Sample[] = useMemo(() => (active?.samples ?? []).map((x: any) => ({ t: x.t, angle: x.angle })), [active]);
  const stats = useMemo(() => computeStats(samples), [samples]);
  const quality = useMemo(() => computeQuality(samples), [samples]);
  const gait = useMemo(() => analyzeGaitAngles(samples.map((s) => s.angle)), [samples]);

  const createLink = async () => {
    if (!user || !active) return;
    const { token } = await createShareLink({ userId: user.uid, sessionId: active.id, expiresAtMs: null });
    setShareLink(shareUrl(token));
  };

  const printReport = () => {
    if (!active || !stats || !quality) return;
    const html = buildClinicianReportHTML({ session: active, stats, quality, gait });
    openPrintWindow(html);
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Reports & Sharing"
        subtitle="Generate clinician-style reports and secure read-only share links."
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

      <Card title="Clinician Report (Print to PDF)">
        <div className="flex flex-wrap gap-2">
          <button onClick={printReport} className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
            Generate & Print
          </button>
          <div className="text-xs text-slate-600 self-center">
            Tip: choose “Save as PDF” in the print dialog.
          </div>
        </div>
      </Card>

      <Card title="Secure Share Link (Read-only)">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={createLink} className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50">
            Create Share Link
          </button>

          {shareLink ? (
            <>
              <input
                value={shareLink}
                readOnly
                className="w-full max-w-xl rounded-xl border bg-white px-3 py-2 text-sm"
              />
              <button
                onClick={() => navigator.clipboard.writeText(shareLink)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
              >
                Copy
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              Generates a tokenized link. You can revoke later (optional enhancement).
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
