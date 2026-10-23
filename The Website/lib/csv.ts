"use client";

import type { LocalSession } from "@/lib/localSessions";

export function sessionToCSV(session: LocalSession) {
  const lines = ["t_ms,angle_deg"];
  for (const s of session.samples) {
    lines.push(`${Math.round(s.t)},${s.angle.toFixed(2)}`);
  }
  return lines.join("\n");
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
