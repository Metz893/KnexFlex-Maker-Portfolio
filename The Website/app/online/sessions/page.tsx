// app/online/sessions/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import SectionTitle from "@/components/SectionTitle";
import { useAuth } from "@/lib/auth";
import {
  listCloudSessions,
  deleteCloudSession,
  type CloudSession,
  type SessionType,
} from "@/lib/firestore";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Timestamp } from "firebase/firestore"; // ✅ add

export default function OnlineSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<CloudSession[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<"new" | "old" | "samples">("new");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");

  const [editingDateId, setEditingDateId] = useState<string | null>(null); // ✅ add
  const [tempDate, setTempDate] = useState(""); // ✅ add (datetime-local value)

  const load = async () => {
    if (!user) {
      setSessions([]);
      return;
    }
    const rows = await listCloudSessions(user.uid);
    setSessions(rows);
  };

  useEffect(() => {
    load();
  }, [user]);

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await deleteCloudSession(id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) (s.tags ?? []).forEach((t) => set.add(t));
    return Array.from(set).sort();
  }, [sessions]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = sessions.filter((s) => {
      const name = (s.displayName ?? s.title ?? "").toLowerCase();
      const notes = (s.notes ?? "").toLowerCase();
      const tags = (s.tags ?? []).join(" ").toLowerCase();
      const okTerm =
        !term || name.includes(term) || notes.includes(term) || tags.includes(term);
      const okTag = !tag || (s.tags ?? []).includes(tag);
      return okTerm && okTag;
    });

    out = out.sort((a, b) => {
      if (sort === "samples") return (b.sampleCount ?? 0) - (a.sampleCount ?? 0);
      if (sort === "old") return (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0);
      return (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0);
    });

    return out;
  }, [sessions, q, tag, sort]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Session Documents"
        subtitle="Searchable, taggable session library with analytics-ready documents."
        right={
          <Link
            href="/online/import"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Import Offline Sessions
          </Link>
        }
      />

      <Card title="Search & Filters">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-xl border bg-white px-3 py-2 text-sm"
            placeholder="Search title, notes, tags…"
          />

          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="rounded-xl border bg-white px-3 py-2 text-sm"
          >
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="rounded-xl border bg-white px-3 py-2 text-sm"
          >
            <option value="new">Newest first</option>
            <option value="old">Oldest first</option>
            <option value="samples">Most samples</option>
          </select>
        </div>
      </Card>

      <Card title="Your Sessions">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500">
            No sessions match. Try a different search or import a session.
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => {
              const created =
                s.createdAt?.toDate?.() ?? new Date(s.createdAtMs);

              const typeLabel =
                (s.sessionType ?? "walk") === "walk"
                  ? "Walk"
                  : (s.sessionType ?? "walk") === "sprint"
                  ? "Sprint"
                  : "Other";

              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border bg-white px-4 py-3"
                >
                  <div className="space-y-0.5">
                    {editingId === s.id ? (
                      <input
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="rounded-md border px-2 py-1 text-sm"
                        autoFocus
                      />
                    ) : (
                      <Link
                        href={`/online/sessions/${s.id}`}
                        className="text-sm font-semibold text-blue-600 hover:underline"
                      >
                        {s.displayName ?? s.title}
                      </Link>
                    )}

                    <div className="text-xs text-slate-500">
                      {editingDateId === s.id ? (
                        <input
                          type="datetime-local"
                          value={tempDate}
                          onChange={(e) => setTempDate(e.target.value)}
                          className="rounded-md border px-2 py-1 text-xs"
                        />
                      ) : (
                        <>
                          {created.toLocaleDateString()} • {s.sampleCount} samples • {typeLabel}
                        </>
                      )}
                    </div>

                    {s.tags?.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {s.tags.slice(0, 6).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={s.sessionType ?? "walk"}
                      onChange={async (e) => {
                        const v = e.target.value as SessionType;

                        // ✅ Optimistic UI update so it doesn't "snap back"
                        setSessions((prev) =>
                          prev.map((x) =>
                            x.id === s.id ? { ...x, sessionType: v } : x
                          )
                        );

                        try {
                          await updateDoc(doc(db, "sessions", s.id), {
                            sessionType: v,
                          });
                          await load();
                        } catch (err) {
                          // revert if write fails
                          await load();
                          alert("Failed to update session type.");
                        }
                      }}
                      className="rounded-lg border bg-white px-2 py-1.5 text-xs text-slate-700"
                      title="Session type"
                    >
                      <option value="walk">Walk</option>
                      <option value="sprint">Sprint</option>
                      <option value="other">Other</option>
                    </select>

                    <button
                      onClick={async () => {
                        if (editingId === s.id) {
                          await updateDoc(doc(db, "sessions", s.id), {
                            displayName: tempName,
                          });
                          setEditingId(null);
                          await load();
                        } else {
                          setEditingId(s.id);
                          setTempName(s.displayName ?? s.title ?? "");
                        }
                      }}
                      className="rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50"
                    >
                      {editingId === s.id ? "Save" : "Rename"}
                    </button>

                    {/*
                    <button
                      onClick={async () => {
                        if (editingDateId === s.id) {
                          const ms = new Date(tempDate).getTime();
                          if (!Number.isFinite(ms)) {
                            alert("Invalid date/time.");
                            return;
                          }
                          await updateDoc(doc(db, "sessions", s.id), {
                            createdAtMs: ms,
                            createdAt: Timestamp.fromMillis(ms),
                          });
                          setEditingDateId(null);
                          await load();
                        } else {
                          setEditingDateId(s.id);
                          const d = created;
                          const pad = (n: number) => String(n).padStart(2, "0");
                          setTempDate(
                            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
                              d.getDate()
                            )}T${pad(d.getHours())}:${pad(d.getMinutes())}`
                          );
                        }
                      }}
                      className="rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50"
                    >
                      {editingDateId === s.id ? "Save date" : "Redate"}
                    </button>
                    */}

                    <Link
                      href={`/online/sessions/${s.id}`}
                      className="rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50"
                    >
                      Open
                    </Link>

                    <button
                      onClick={() => remove(s.id)}
                      disabled={busyId === s.id}
                      className="rounded-lg border px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      {busyId === s.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
