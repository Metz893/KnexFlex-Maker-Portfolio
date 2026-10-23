"use client";

export type Sample = { angle: number; t: number };

export type SessionType = "walk" | "sprint" | "other";

export type LocalSession = {
  id: string;
  createdAt: number;
  title: string;
  sessionType?: SessionType; // default = "walk" when missing
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
  const rows = safeParse<LocalSession[]>(localStorage.getItem(KEY), []);
  // Backward compatible: default missing sessionType to "walk"
  return rows.map((r) => ({
    ...r,
    sessionType: (r.sessionType ?? "walk") as SessionType,
  }));
}

export function saveLocalSessions(sessions: LocalSession[]) {
  localStorage.setItem(KEY, JSON.stringify(sessions));
}

export function addLocalSession(session: LocalSession) {
  const sessions = getLocalSessions();
  sessions.unshift({
    ...session,
    sessionType: (session.sessionType ?? "walk") as SessionType,
  });
  saveLocalSessions(sessions);
}

export function updateLocalSessionMeta(
  id: string,
  patch: Partial<Pick<LocalSession, "title" | "sessionType">>
) {
  const sessions = getLocalSessions().map((s) => {
    if (s.id !== id) return s;
    return {
      ...s,
      ...(patch.title !== undefined ? { title: patch.title } : null),
      ...(patch.sessionType !== undefined ? { sessionType: patch.sessionType } : null),
    };
  });
  saveLocalSessions(sessions);
}

export function deleteLocalSession(id: string) {
  const sessions = getLocalSessions().filter((s) => s.id !== id);
  saveLocalSessions(sessions);
}

export function clearLocalSessions() {
  saveLocalSessions([]);
}
