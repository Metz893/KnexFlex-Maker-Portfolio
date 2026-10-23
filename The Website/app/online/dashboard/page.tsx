"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  orderBy,
  query,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useRouter } from "next/navigation";


import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import Card from "@/components/Card";
import {
  getLocalSessions,
  deleteLocalSession,
  type LocalSession,
} from "@/lib/localSessions";

/* ----------------------------- */
/* Types */
/* ----------------------------- */

type CloudSession = {
  id: string;
  userId: string;
  title: string;
  createdAt?: any;
  createdAtMs: number;
  samples: number[];
  sampleCount: number;
  sessionType?: "walk" | "sprint" | "other";
};

/* ----------------------------- */
/* Component */
/* ----------------------------- */

export default function OnlineDashboard() {
  const { user } = useAuth();

  const [cloud, setCloud] = useState<CloudSession[]>([]);
  const [local, setLocal] = useState<LocalSession[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  /* ----------------------------- */
  /* Local sessions */
  /* ----------------------------- */

  const refreshLocal = () => {
    setLocal(getLocalSessions());
  };

  useEffect(() => {
    refreshLocal();
  }, []);

  /* ----------------------------- */
  /* Cloud sessions */
  /* ----------------------------- */

  useEffect(() => {
    if (!user) {
      setCloud([]);
      return;
    }

    const load = async () => {
      const q = query(
        collection(db, "sessions"),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);

      const sessions: CloudSession[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: data.userId,
            title: data.title,
            createdAt: data.createdAt,
            createdAtMs: data.createdAtMs,
            samples: data.samples ?? [],
            sampleCount: data.sampleCount ?? 0,
          };
        })
        .filter((s) => s.userId === user.uid);

      setCloud(sessions);
    };

    load();
  }, [user]);

  /* ----------------------------- */
  /* Actions */
  /* ----------------------------- */


  const openOffline = () => {
    // Works only when connected to ESP Wi-Fi
    window.open("http://192.168.4.1");
  };

  const uploadLocal = async (s: LocalSession) => {
    if (!user) return;

    setBusyId(s.id);

    try {
      await addDoc(collection(db, "sessions"), {
        userId: user.uid,
        title: s.title,
        createdAt: serverTimestamp(),
        createdAtMs: s.createdAt,
        samples: s.samples,
        sampleCount: s.samples.length,
        sessionType: s.sessionType ?? "walk",
      });

      deleteLocalSession(s.id);
      refreshLocal();
      alert("Uploaded to cloud ✅");
    } catch (err: any) {
      alert(err?.message ?? "Upload failed");
    } finally {
      setBusyId(null);
    }
  };

  /* ----------------------------- */
  /* Counts */
  /* ----------------------------- */

  const cloudCount = cloud.length;
  const localCount = local.length;

  /* ----------------------------- */
  /* Render */
  /* ----------------------------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Online Dashboard</h1>
          <p className="text-sm text-slate-600">
            View cloud sessions, upload local sessions, or open Offline Live when
            connected to your device.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={openOffline}
            className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-50"
          >
            Open Offline Live
          </button>

          <Link
            href="/online/sessions"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            View Sessions
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card
          title="Cloud Sessions"
          right={
            <span className="text-xs text-slate-500">{cloudCount}</span>
          }
        >
          <p className="text-sm text-slate-600">
            Stored in Firebase and available on any device when you log in.
          </p>

          <div className="mt-3 text-sm">
            <Link
              href="/online/sessions"
              className="text-blue-600 hover:underline"
            >
              Manage cloud sessions →
            </Link>
          </div>
        </Card>

        <Card
          title="Local Sessions (Offline recordings)"
          right={
            <span className="text-xs text-slate-500">{localCount}</span>
          }
        >
          <p className="text-sm text-slate-600">
            Saved locally on this device. Upload them when you have internet.
          </p>

          <div className="mt-4 space-y-2">
            {local.length === 0 ? (
              <p className="text-sm text-slate-500">
                No local sessions yet.
              </p>
            ) : (
              local.slice(0, 4).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border bg-white px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-medium">{s.title}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(s.createdAt).toLocaleString()} •{" "}
                      {s.samples.length} samples
                    </div>
                  </div>

                  <button
                    onClick={() => uploadLocal(s)}
                    disabled={busyId === s.id}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {busyId === s.id ? "Uploading…" : "Upload"}
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Info */}
      <Card title="How Offline Live Works">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>
            Connect your phone or laptop Wi-Fi to{" "}
            <b>KnexFlex</b> (ESP access point).
          </li>
          <li>
            Open Offline Live to view real-time angle updates.
          </li>
          <li>
            Record sessions offline, then reconnect to internet to upload.
          </li>
        </ol>
      </Card>
    </div>
  );
}
