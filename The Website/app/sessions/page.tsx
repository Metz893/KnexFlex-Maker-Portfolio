"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// -----------------------------
// Types
// -----------------------------
type Sample = {
  angle: number;
  t: number;
};

type Session = {
  id: string;
  createdAt: any;
  data: Sample[];
};

// -----------------------------
// Component
// -----------------------------
export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // -----------------------------
  // Load sessions
  // -----------------------------
  useEffect(() => {
    const loadSessions = async () => {
      const q = query(
        collection(db, "sessions"),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);

      const results: Session[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any)
      }));

      setSessions(results);
    };

    loadSessions();
  }, []);

  // -----------------------------
  // Selection
  // -----------------------------
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  const selectedSessions = sessions.filter((s) =>
    selectedIds.includes(s.id)
  );

  // -----------------------------
  // Helpers
  // -----------------------------
  const formatSessionCSV = (session: Session) => {
    const header = "Time(ms),Angle(deg)";
    const rows = session.data.map(
      (d) => `${d.t},${d.angle}`
    );
    return `${header}\n${rows.join("\n")}`;
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  };

  // -----------------------------
  // Actions
  // -----------------------------
  const copySelected = () => {
    if (!selectedSessions.length) return;

    const text = selectedSessions
      .map((s, i) => {
        const rows = s.data.map(
          (d) => `${d.t},${d.angle}`
        );
        return `SESSION ${i + 1}\nTime(ms),Angle(deg)\n${rows.join("\n")}`;
      })
      .join("\n\n");

    navigator.clipboard.writeText(text);
    alert("Copied selected sessions");
  };

  const downloadSelectedCSV = () => {
    if (!selectedSessions.length) return;

    const csv = selectedSessions
      .map((s, i) => {
        const rows = s.data.map(
          (d) => `${d.t},${d.angle}`
        );
        return `SESSION ${i + 1}\nTime(ms),Angle(deg)\n${rows.join("\n")}`;
      })
      .join("\n\n");

    downloadFile(csv, "knexflex_sessions.csv");
  };

  const downloadSingleSession = (session: Session) => {
    const date = session.createdAt?.toDate
      ? session.createdAt.toDate().toISOString().replace(/:/g, "-")
      : session.id;

    const csv = formatSessionCSV(session);
    downloadFile(csv, `knexflex_session_${date}.csv`);
  };

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div style={{ padding: 40, maxWidth: 800 }}>
      <h1>Saved Sessions</h1>

      <div style={{ marginBottom: 20 }}>
        <button onClick={copySelected} disabled={!selectedIds.length}>
          Copy Selected
        </button>

        <button
          onClick={downloadSelectedCSV}
          disabled={!selectedIds.length}
          style={{ marginLeft: 10 }}
        >
          Download Selected CSV
        </button>
      </div>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {sessions.map((s) => {
          const isSelected = selectedIds.includes(s.id);

          return (
            <li
              key={s.id}
              style={{
                border: "1px solid #ccc",
                padding: 12,
                marginBottom: 10,
                background: isSelected ? "#eef" : "#fff"
              }}
            >
              <div
                onClick={() => toggleSelect(s.id)}
                style={{ cursor: "pointer" }}
              >
                <strong>
                  {s.createdAt?.toDate
                    ? s.createdAt.toDate().toLocaleString()
                    : "Unknown date"}
                </strong>
                <div>{s.data.length} samples</div>
              </div>

              <button
                onClick={() => downloadSingleSession(s)}
                style={{ marginTop: 8 }}
              >
                Download This Session
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
