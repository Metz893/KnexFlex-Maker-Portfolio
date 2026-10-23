// app/online/vault/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import SectionTitle from "@/components/SectionTitle";
import { useAuth } from "@/lib/auth";
import { createFolder, listCloudSessions, listFolders, updateSessionMeta } from "@/lib/firestore";

export default function VaultPage() {
  const { user } = useAuth();
  const [folders, setFolders] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [folderName, setFolderName] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");

  const load = async () => {
    if (!user) return;
    const [f, s] = await Promise.all([listFolders(user.uid), listCloudSessions(user.uid)]);
    setFolders(f);
    setSessions(s);
    if (!selectedFolderId && f[0]) setSelectedFolderId(f[0].id);
  };

  useEffect(() => { load(); }, [user]);

  const inFolder = useMemo(() => {
    if (!selectedFolderId) return [];
    return sessions.filter((s) => s.folderId === selectedFolderId);
  }, [sessions, selectedFolderId]);

  const add = async () => {
    if (!user) return;
    await createFolder(user.uid, folderName);
    setFolderName("");
    await load();
  };

  const assign = async (sessionId: string) => {
    if (!selectedFolderId) return;
    await updateSessionMeta(sessionId, { folderId: selectedFolderId });
    await load();
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Data Vault"
        subtitle="Organize sessions into folders, improve naming, and keep your library searchable."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Folders">
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="New folder name…"
                className="flex-1 rounded-xl border bg-white px-3 py-2 text-sm"
              />
              <button onClick={add} className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
                Add
              </button>
            </div>

            <div className="space-y-1">
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFolderId(f.id)}
                  className={[
                    "w-full rounded-xl px-3 py-2 text-left text-sm",
                    selectedFolderId === f.id ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-slate-700",
                  ].join(" ")}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Sessions in folder" right={<span className="text-xs text-slate-500">{inFolder.length}</span>}>
          {inFolder.length === 0 ? (
            <p className="text-sm text-slate-600">No sessions assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {inFolder.slice(0, 10).map((s) => (
                <div key={s.id} className="rounded-xl border bg-white px-3 py-2">
                  <div className="text-sm font-semibold">{s.displayName ?? s.title}</div>
                  <div className="text-xs text-slate-500">{s.sampleCount} samples</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Assign session to selected folder">
          <div className="space-y-2">
            {sessions.slice(0, 12).map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{s.displayName ?? s.title}</div>
                  <div className="text-xs text-slate-500">{new Date(s.createdAtMs).toLocaleString()}</div>
                </div>
                <button
                  onClick={() => assign(s.id)}
                  className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800"
                >
                  Assign
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
