// lib/gaitByType.ts
// One place to choose the correct gait analysis based on sessionType.
// Every UI / community / report feature should call this file instead of
// calling walking/sprinting analyzers directly.

import type { Sample } from "@/lib/analytics";
import { analyzeGaitAngles } from "@/lib/gaitAnalysis";
import { analyzeSprintingAngles } from "@/lib/sprintGaitAnalysis";
import type { SessionType } from "@/lib/firestore";

// Unified result shape expected by the UI
export type UnifiedGaitResult = {
  cycles: number[][];
  averageCycle: number[];
  peakFlexion: number;
  peakExtension: number;
  heelStrikeIndex: number;
  toeOffIndex: number;
};

export function getSessionTypeOrDefault(
  t?: SessionType | null
): SessionType {
  if (t === "walk" || t === "sprint" || t === "other") return t;
  return "walk";
}

export function samplesToAngles(samples: Sample[]): number[] {
  return (samples ?? []).map((s) => s.angle);
}

export function analyzeGaitByType(params: {
  samples: Sample[];
  sessionType?: SessionType | null;
}): UnifiedGaitResult | null {
  const type = getSessionTypeOrDefault(params.sessionType ?? null);

  if (type === "other") return null;

  const angles = samplesToAngles(params.samples);
  if (angles.length < 200) return null;

  if (type === "walk") {
    const r = analyzeGaitAngles(angles);
    if (!r) return null;
    return {
      cycles: r.cycles,
      averageCycle: r.averageCycle,
      peakFlexion: r.peakFlexion,
      peakExtension: r.peakExtension,
      heelStrikeIndex: r.heelStrikeIndex,
      toeOffIndex: r.toeOffIndex,
    };
  }

  // sprint
  const s = analyzeSprintingAngles(angles);
  if (!s) return null;
  return {
    cycles: s.cycles,
    averageCycle: s.averageCycle,
    peakFlexion: s.peakFlexion,
    peakExtension: s.peakExtension,
    heelStrikeIndex: s.heelStrikeIndex,
    toeOffIndex: s.toeOffIndex,
  };
}

export function sessionTypeLabel(t?: SessionType | null): string {
  const type = getSessionTypeOrDefault(t ?? null);
  if (type === "walk") return "Walk";
  if (type === "sprint") return "Sprint";
  return "Other";
}
