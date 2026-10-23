"use client";

export type Sample = { angle: number; t: number };
export type LocalSession = {
  id: string;
  createdAt: number;
  title: string;
  samples: Sample[];
};

const KEY = "knexflex_local_sessions_v1";

function safeParse<T>(s: string | null, fallback: T): T {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getLocalSessions(): LocalSession[] {
  if (typeof window === "undefined") return [];
  return safeParse<LocalSession[]>(localStorage.getItem(KEY), []);
}

export function saveLocalSessions(sessions: LocalSession[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(sessions));
}

export function addLocalSession(session: LocalSession) {
  const sessions = getLocalSessions();
  sessions.unshift(session);
  saveLocalSessions(sessions);
}

export function deleteLocalSession(id: string) {
  const sessions = getLocalSessions().filter((s) => s.id !== id);
  saveLocalSessions(sessions);
}

export function clearLocalSessions() {
  saveLocalSessions([]);
}
