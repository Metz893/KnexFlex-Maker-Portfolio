// lib/community.ts
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { deleteDoc, doc } from "firebase/firestore";
import type { Sample } from "@/lib/analytics";
import { computeStats } from "@/lib/analytics";
import { analyzeGaitAngles } from "@/lib/gaitAnalysis";
import { analyzeSprintingAngles } from "@/lib/sprintGaitAnalysis";

// ✅ IMPORTANT: adjust this import if your db export lives elsewhere
import { db } from "./firebase";

export type CommunitySession = {
  id: string;
  ownerUid: string;
  ownerLabel: string;
  title: string;
  createdAt: any;

  sourceSessionId: string;

  stats: {
    rom: number;
    reps: number;
  };

  gait: {
    cyclesKept: number;
    heelStrikeIndex: number;
    toeOffIndex: number;
    peakFlexion: number;
    averageCycle: number[]; // length 100
  };
};

const COMMUNITY_COL = "community_sessions";

export async function listCommunitySessions() {
  const q = query(collection(db, COMMUNITY_COL), orderBy("createdAt", "desc"), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as CommunitySession[];
}

export async function publishSessionToCommunity(args: {
  ownerUid: string;
  ownerLabel: string;
  title: string;
  sourceSessionId: string;
  samples: Sample[];
  sessionType?: "walk" | "sprint" | "other";
}) {
  const { ownerUid, ownerLabel, title, sourceSessionId, samples, sessionType } = args;

  const stats = computeStats(samples);
  const angles = samples.map((s) => s.angle);
  const gait = (sessionType ?? "walk") === "sprint" ? analyzeSprintingAngles(angles) : (sessionType ?? "walk") === "walk" ? analyzeGaitAngles(angles) : null;

  if (!gait) {
    throw new Error("No valid gait cycles detected for this session.");
  }

  const payload = {
    ownerUid,
    ownerLabel,
    title,
    sourceSessionId,
    createdAt: serverTimestamp(),
    stats: {
      rom: stats?.rom ?? 0,
      reps: stats?.reps ?? 0,
    },
    gait: {
      cyclesKept: gait.cycles.length,
      heelStrikeIndex: gait.heelStrikeIndex,
      toeOffIndex: gait.toeOffIndex,
      peakFlexion: gait.peakFlexion,
      averageCycle: gait.averageCycle,
    },
  };

  const ref = await addDoc(collection(db, COMMUNITY_COL), payload);
  return ref.id;
}

export async function listMyCommunityPosts(ownerUid: string) {
  const q = query(
    collection(db, COMMUNITY_COL),
    where("ownerUid", "==", ownerUid),
    orderBy("createdAt", "desc"),
    limit(25)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as CommunitySession[];
}

export async function deleteCommunitySession(id: string) {
  await deleteDoc(doc(db, COMMUNITY_COL, id));
}
