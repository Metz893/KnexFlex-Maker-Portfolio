import type { Sample } from "./analytics";

export type SessionDoc = {
  id: string;
  createdAt: number;
  title: string;
  notes?: string;
  tags?: string[];
  samples: Sample[];
  device?: { wsUrl?: string };
};

export type ExportBundle = {
  format: "knexflex_offline_export_v2";
  exportedAt: number;
  sessions: SessionDoc[];
};

export function downloadTextFile(filename: string, content: string, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function isBundle(x: any): x is ExportBundle {
  return x && x.format === "knexflex_offline_export_v2" && Array.isArray(x.sessions);
}

export function normalizeSession(input: any): SessionDoc | null {
  if (!input) return null;

  // Accept either "samples" or legacy "data"
  const rawSamples = input.samples ?? input.data ?? [];
  const samples: Sample[] = rawSamples
    .map((s: any) => {
      if (typeof s?.angle === "number" && typeof s?.t === "number") return { angle: s.angle, t: s.t };
      return null;
    })
    .filter(Boolean) as Sample[];

  if (!samples.length) return null;

  return {
    id: String(input.id ?? crypto.randomUUID()),
    createdAt: Number(input.createdAt ?? Date.now()),
    title: String(input.title ?? "Imported Session"),
    notes: typeof input.notes === "string" ? input.notes : "",
    tags: Array.isArray(input.tags) ? input.tags.map(String).slice(0, 12) : [],
    device: input.device ? { wsUrl: String(input.device.wsUrl ?? "") } : undefined,
    samples,
  };
}
