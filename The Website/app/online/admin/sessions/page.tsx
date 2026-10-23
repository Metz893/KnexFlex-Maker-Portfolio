"use client";

import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";

type Row = {
  id: string;
  ownerUid: string | null;
  title: string;
  createdAtMs: number | null;
  sampleCount: number | null;
  sessionType: string | null;
};

async function exportJson(sessionId: string) {
  const token = await auth.currentUser?.getIdToken(true);
  if (!token) throw new Error("Not logged in");

  const res = await fetch(
    `/api/admin/export-session?collection=sessions&sessionId=${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) throw new Error(await res.text());

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `session_${sessionId}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminSessionsPage() {
  const { user } = useAuth();

  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [ownerUid, setOwnerUid] = useState("");
  const [limit, setLimit] = useState(50);
  const [from, setFrom] = useState(""); // datetime-local
  const [to, setTo] = useState("");     // datetime-local
  const [loading, setLoading] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // check admin claim on client (UI-only; server still enforces)
  useEffect(() => {
    const run = async () => {
      if (!auth.currentUser) return setIsAdmin(false);
      const r = await auth.currentUser.getIdTokenResult(true);
      setIsAdmin(r.claims.admin === true);
    };
    run();
  }, [user]);

  const fromMs = useMemo(() => (from ? new Date(from).getTime() : 0), [from]);
  const toMs = useMemo(() => (to ? new Date(to).getTime() : 0), [to]);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken(true);
      if (!token) throw new Error("Not logged in");

      const qs = new URLSearchParams();
      qs.set("collection", "sessions");
      qs.set("limit", String(limit));
      if (email.trim()) qs.set("email", email.trim());
      if (ownerUid.trim()) qs.set("ownerUid", ownerUid.trim());
      if (fromMs > 0) qs.set("fromMs", String(fromMs));
      if (toMs > 0) qs.set("toMs", String(toMs));

      const res = await fetch(`/api/admin/list-sessions?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(await res.text());

      const json = await res.json();
      setRows(json.rows || []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load sessions");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // load recent sessions by default once admin
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!user) return <div className="p-6">Please sign in.</div>;
  if (!isAdmin) return <div className="p-6">Forbidden (not admin).</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="text-xl font-semibold">Admin: Export Any Session</div>

      <div className="grid gap-3 md:grid-cols-5">
        <input
          className="rounded-xl border px-3 py-2 text-sm"
          placeholder="User email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="rounded-xl border px-3 py-2 text-sm"
          placeholder="Owner UID (optional)"
          value={ownerUid}
          onChange={(e) => setOwnerUid(e.target.value)}
        />
        <input
          className="rounded-xl border px-3 py-2 text-sm"
          type="datetime-local"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          title="From (optional)"
        />
        <input
          className="rounded-xl border px-3 py-2 text-sm"
          type="datetime-local"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          title="To (optional)"
        />
        <select
          className="rounded-xl border px-3 py-2 text-sm"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        >
          {[20, 50, 100, 200].map((n) => (
            <option key={n} value={n}>
              Limit {n}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={load}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Loading…" : "Search"}
        </button>
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
      </div>

      <div className="rounded-xl border bg-white">
        <div className="grid grid-cols-5 gap-2 border-b px-3 py-2 text-xs font-semibold text-slate-600">
          <div>Title</div>
          <div>Date</div>
          <div>Samples</div>
          <div>Owner UID</div>
          <div>Actions</div>
        </div>

        {rows.length === 0 ? (
          <div className="px-3 py-4 text-sm text-slate-500">No results.</div>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-5 gap-2 px-3 py-2 text-sm border-b items-center"
            >
              <div className="truncate">{r.title}</div>
              <div className="text-xs text-slate-600">
                {r.createdAtMs ? new Date(r.createdAtMs).toLocaleString() : "—"}
              </div>
              <div className="text-xs text-slate-600">{r.sampleCount ?? "—"}</div>
              <div className="text-xs font-mono text-slate-600 truncate">{r.ownerUid ?? "—"}</div>
              <div>
                <button
                  onClick={async () => {
                    setExportingId(r.id);
                    try {
                      await exportJson(r.id);
                    } catch (e: any) {
                      alert(e?.message ?? "Export failed");
                    } finally {
                      setExportingId(null);
                    }
                  }}
                  disabled={exportingId === r.id}
                  className="rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-60"
                >
                  {exportingId === r.id ? "Downloading…" : "Export JSON"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}