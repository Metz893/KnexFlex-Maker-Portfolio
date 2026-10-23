"use client";

import { useState } from "react";
import Card from "@/components/Card";
import { useAuth } from "@/lib/auth";
import { isBundle, normalizeSession, type ExportBundle, type SessionDoc } from "@/lib/fileTransfer";
import { uploadSessionToCloud } from "@/lib/firestore";

export default function ImportPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<string>("");

  const handleFile = async (file: File) => {
    if (!user) return;

    setStatus("Reading file…");
    const text = await file.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      setStatus("Invalid JSON file.");
      return;
    }

    let sessions: SessionDoc[] = [];

    if (isBundle(parsed)) {
      const bundle = parsed as ExportBundle;
      sessions = bundle.sessions.map(normalizeSession).filter(Boolean) as SessionDoc[];
    } else {
      const single = normalizeSession(parsed);
      if (single) sessions = [single];
    }

    if (!sessions.length) {
      setStatus("No valid sessions found in this file.");
      return;
    }

    setStatus(`Uploading ${sessions.length} session(s)…`);
    try {
      for (const s of sessions) {
        await uploadSessionToCloud(user.uid, s);
      }
      setStatus(`Uploaded ${sessions.length} session(s) ✅`);
    } catch (e: any) {
      setStatus(e?.message ?? "Upload failed");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Import Offline Sessions</h1>
        <p className="text-sm text-slate-600">
          Export <b>.knexflex.json</b> from the Offline Live site, then upload it here.
        </p>
      </div>

      <Card title="Upload">
        {!user ? (
          <p className="text-sm text-slate-600">Sign in to import sessions.</p>
        ) : (
          <div className="space-y-3">
            <input
              type="file"
              accept=".json,.knexflex.json,application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {status && <p className="text-sm text-slate-700">{status}</p>}
          </div>
        )}
      </Card>

      <Card title="Workflow">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>Connect to device Wi-Fi → open Offline Live.</li>
          <li>Record → Save → Export (or Export All).</li>
          <li>Reconnect to internet → open Online → Import.</li>
        </ol>
      </Card>
    </div>
  );
}
