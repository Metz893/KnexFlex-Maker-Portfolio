// lib/firestore.ts
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  serverTimestamp,
  updateDoc,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";

export type SessionType = "walk" | "sprint" | "other";

import type { SessionDoc } from "./fileTransfer";

/* =========================
   Types
========================= */

export type CloudSession = {
  id: string;
  userId: string;
  title: string;
  createdAtMs: number;
  createdAt?: any;
  notes?: string;
  tags?: string[];
  samples: { t: number; angle: number }[];
  sampleCount: number;
  device?: { wsUrl?: string };
  format?: string;

  // Vault fields (optional)
  folderId?: string;
  displayName?: string; // user-friendly name
  leg?: "left" | "right";
  injury?: string;
  weeksSinceInjury?: number;
  schemaVersion?: number;

  // ✅ NEW
  sessionType?: SessionType;
};

export type ShareLink = {
  id: string;
  token: string;
  userId: string;
  sessionId: string;
  createdAtMs: number;
  expiresAtMs?: number | null;
  revoked?: boolean;
};

export type VaultFolder = {
  id: string;
  userId: string;
  name: string; // "ACL Recovery", "Baseline", etc.
  createdAtMs: number;
};

export type AnalyticsCache = {
  id: string;
  userId: string;
  sessionId: string;
  updatedAtMs: number;
  stats: any;
  quality: any;
  gait?: any;
};

/* =========================
   Sessions
========================= */

export async function uploadSessionToCloud(userId: string, s: SessionDoc) {
  await addDoc(collection(db, "sessions"), {
    userId,
    title: s.title,
    notes: s.notes ?? "",
    tags: s.tags ?? [],
    createdAt: serverTimestamp(),
    createdAtMs: s.createdAt,
    samples: s.samples,
    sampleCount: s.samples.length,
    device: s.device ?? {},
    format: "knexflex_session_v2",

    // ✅ default (keeps old behavior)
    sessionType: (s as any)?.sessionType ?? "walk",
  });
}

export async function listCloudSessions(userId: string) {
  const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  const rows: CloudSession[] = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((x) => x.userId === userId)
    .map((x) => ({
      id: x.id,
      userId: x.userId,
      title: x.title ?? "Session",
      notes: x.notes ?? "",
      tags: x.tags ?? [],
      createdAt: x.createdAt,
      createdAtMs: x.createdAtMs ?? Date.now(),
      samples: Array.isArray(x.samples) ? x.samples : [],
      sampleCount:
        x.sampleCount ?? (Array.isArray(x.samples) ? x.samples.length : 0),
      device: x.device ?? {},
      format: x.format ?? "knexflex_session_v2",

      folderId: x.folderId,
      displayName: x.displayName,
      leg: x.leg,
      injury: x.injury,
      weeksSinceInjury: x.weeksSinceInjury,
      schemaVersion: x.schemaVersion,

      // ✅ FIX: read it back from Firestore
      sessionType: (x.sessionType as SessionType) ?? "walk",
    }));
    rows.sort((a, b) => {
      const nameA = (a.displayName ?? a.title ?? "").toLowerCase();
      const nameB = (b.displayName ?? b.title ?? "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

  return rows;
}

export async function getCloudSession(id: string) {
  const ref = doc(db, "sessions", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const x: any = snap.data();

  return {
    id: snap.id,
    userId: x.userId,
    title: x.title ?? "Session",
    notes: x.notes ?? "",
    tags: x.tags ?? [],
    createdAt: x.createdAt,
    createdAtMs: x.createdAtMs ?? Date.now(),
    samples: Array.isArray(x.samples) ? x.samples : [],
    sampleCount: x.sampleCount ?? (Array.isArray(x.samples) ? x.samples.length : 0),
    device: x.device ?? {},
    format: x.format ?? "knexflex_session_v2",

    folderId: x.folderId,
    displayName: x.displayName,
    leg: x.leg,
    injury: x.injury,
    weeksSinceInjury: x.weeksSinceInjury,
    schemaVersion: x.schemaVersion,

    // ✅ FIX: include sessionType here too
    sessionType: (x.sessionType as SessionType) ?? "walk",
  } as CloudSession;
}

export async function deleteCloudSession(id: string) {
  await deleteDoc(doc(db, "sessions", id));
}

/* =========================
   Update session metadata (Vault / labeling)
========================= */

export async function updateSessionMeta(
  sessionId: string,
  patch: Partial<CloudSession>
) {
  const ref = doc(db, "sessions", sessionId);

  const safe: any = {};
  const keys: (keyof CloudSession)[] = [
    "displayName",
    "folderId",
    "tags",
    "notes",
    "leg",
    "injury",
    "weeksSinceInjury",
    "sessionType",
  ];

  for (const k of keys) {
    if (patch[k] !== undefined) safe[k] = patch[k];
  }

  await updateDoc(ref, safe);
}

/* =========================
   Vault folders
========================= */

export async function listFolders(userId: string): Promise<VaultFolder[]> {
  const qy = query(
    collection(db, "vault_folders"),
    where("userId", "==", userId),
    orderBy("createdAtMs", "desc")
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any;
}

export async function createFolder(userId: string, name: string) {
  const clean = name.trim().slice(0, 60);
  if (!clean) throw new Error("Folder name required");
  await addDoc(collection(db, "vault_folders"), {
    userId,
    name: clean,
    createdAtMs: Date.now(),
  });
}

/* =========================
   Share links (read-only)
========================= */

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function createShareLink(params: {
  userId: string;
  sessionId: string;
  expiresAtMs?: number | null;
}) {
  const token = randomToken();
  const createdAtMs = Date.now();
  const docRef = await addDoc(collection(db, "shared_links"), {
    token,
    userId: params.userId,
    sessionId: params.sessionId,
    createdAtMs,
    expiresAtMs: params.expiresAtMs ?? null,
    revoked: false,
  });

  return { id: docRef.id, token };
}

export async function getShareLinkByToken(token: string) {
  const qy = query(
    collection(db, "shared_links"),
    where("token", "==", token),
    limit(1)
  );
  const snap = await getDocs(qy);
  const d = snap.docs[0];
  if (!d) return null;
  return { id: d.id, ...(d.data() as any) } as ShareLink;
}

export async function revokeShareLink(id: string) {
  await updateDoc(doc(db, "shared_links", id), { revoked: true });
}
