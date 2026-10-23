// lib/gaitSimilarity.ts
import type { GaitCycleResult } from "@/lib/gaitAnalysis";

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function rmse(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("rmse(): length mismatch");
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s / a.length);
}

function mean(x: number[]): number {
  let s = 0;
  for (const v of x) s += v;
  return s / x.length;
}

/**
 * Removes vertical shift only (mean offset).
 * Keeps amplitude/ROM differences intact.
 */
function removeVerticalShift(x: number[]): number[] {
  const m = mean(x);
  return x.map((v) => v - m);
}

function indexOfMax(arr: number[]): number {
  let idx = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[idx]) idx = i;
  return idx;
}

/**
 * Circularly shift an array by k samples (k can be negative).
 * Positive k shifts to the right.
 */
function circularShift(x: number[], k: number): number[] {
  const n = x.length;
  const out = new Array<number>(n);
  const kk = ((k % n) + n) % n;
  for (let i = 0; i < n; i++) {
    out[(i + kk) % n] = x[i];
  }
  return out;
}

/**
 * Find the best circular alignment (horizontal shift) between two curves by
 * trying all shifts and choosing the one with the smallest RMSE.
 * - If removeMean is true, mean-center both signals before aligning (ignores vertical shift).
 * Returns aligned versions and the chosen shift.
 */
function bestCircularAlignment(
  a: number[],
  b: number[],
  removeMean: boolean
): { aAligned: number[]; bAligned: number[]; shiftSamples: number; rmseDeg: number } {
  const aa = removeMean ? removeVerticalShift(a) : a;
  const bb = removeMean ? removeVerticalShift(b) : b;

  let bestShift = 0;
  let bestErr = Infinity;

  // brute force over all possible circular shifts (length is 100 in our use-case)
  for (let k = 0; k < aa.length; k++) {
    const bShifted = circularShift(bb, k);
    const e = rmse(aa, bShifted);
    if (e < bestErr) {
      bestErr = e;
      bestShift = k;
    }
  }

  return {
    aAligned: aa,
    bAligned: circularShift(bb, bestShift),
    shiftSamples: bestShift,
    rmseDeg: bestErr,
  };
}

export type SimilarityMode =
  | "shapeOnlyIgnoreShift"
  | "shapePlusShift"
  | "shapeOnlyIgnoreShiftAndTiming";

export type SimilarityConfig = {
  /**
   * Bigger = more forgiving (scores stay higher for larger differences).
   * Units depend on mode:
   * - shapeOnlyIgnoreShift: degrees (after mean removal)
   * - shapePlusShift: degrees (raw)
   * - shapeOnlyIgnoreShiftAndTiming: degrees (after mean removal + best horizontal alignment)
   */
  shapeSigmaDeg?: number;

  /**
   * Bigger = more forgiving for event timing differences (in samples, 0..99).
   */
  eventSigmaSamples?: number;

  /**
   * Bigger = more forgiving for ROM difference (degrees).
   */
  romSigmaDeg?: number;

  /**
   * Weighting (0..1-ish). These multiply the penalty terms.
   * If you want a pure curve-based score, set eventWeight/romWeight to 0.
   */
  eventWeight?: number;
  romWeight?: number;

  /**
   * Output scale. You asked for /1000.
   */
  maxScore?: number;
};

export type GaitSimilarity = {
  mode: SimilarityMode;
  score: number; // 0..maxScore (default 1000)
  shapeRmseDeg: number; // RMSE used for shape term (degrees)
  eventDelta: {
    heelStrike: number; // samples
    toeOff: number; // samples
    peakFlexion: number; // samples
  };
  romDeltaDeg: number;
  notes?: string;

  /**
   * Only populated for the "ignore vertical + horizontal shift" mode.
   * This tells you how many samples B was circularly shifted to best match A.
   */
  timingShiftSamples?: number;
};

/**
 * Main similarity scorer for average gait cycles.
 *
 * Three modes:
 * - "shapeOnlyIgnoreShift": subtract mean from each curve => ignores vertical shift only
 * - "shapePlusShift": compare raw curves => vertical shift affects similarity
 * - "shapeOnlyIgnoreShiftAndTiming": mean-center + best circular alignment => ignores vertical + horizontal shift
 *
 * Score uses smooth exponential factors so it’s *forgiving* (configurable).
 */
export function gaitSimilarityScore(
  A: GaitCycleResult,
  B: GaitCycleResult,
  mode: SimilarityMode,
  config: SimilarityConfig = {}
): GaitSimilarity {
  const maxScore = config.maxScore ?? 1000;

  // More forgiving defaults (higher sigmas + lower weights)
  const shapeSigmaDeg =
    config.shapeSigmaDeg ??
    (mode === "shapeOnlyIgnoreShift"
      ? 18
      : mode === "shapeOnlyIgnoreShiftAndTiming"
      ? 18
      : 22);

  const eventSigmaSamples = config.eventSigmaSamples ?? 35;
  const romSigmaDeg = config.romSigmaDeg ?? 32;

  const eventWeight = config.eventWeight ?? 0.18;
  const romWeight = config.romWeight ?? 0.12;

  const aAvg = A.averageCycle;
  const bAvg = B.averageCycle;

  if (aAvg.length !== 100 || bAvg.length !== 100) {
    return {
      mode,
      score: 0,
      shapeRmseDeg: 999,
      eventDelta: { heelStrike: 99, toeOff: 99, peakFlexion: 99 },
      romDeltaDeg: Math.abs(
        (A.peakFlexion - A.peakExtension) - (B.peakFlexion - B.peakExtension)
      ),
      notes: "averageCycle length must be 100 for this comparator.",
    };
  }

  // --- Shape term ---
  let shapeErrDeg: number;
  let timingShiftSamples: number | undefined;

  let aForShape = aAvg;
  let bForShape = bAvg;

  if (mode === "shapeOnlyIgnoreShift") {
    aForShape = removeVerticalShift(aAvg);
    bForShape = removeVerticalShift(bAvg);
    shapeErrDeg = rmse(aForShape, bForShape);
  } else if (mode === "shapeOnlyIgnoreShiftAndTiming") {
    const aligned = bestCircularAlignment(aAvg, bAvg, true);
    aForShape = aligned.aAligned;
    bForShape = aligned.bAligned;
    shapeErrDeg = aligned.rmseDeg;
    timingShiftSamples = aligned.shiftSamples;
  } else {
    // "shapePlusShift"
    shapeErrDeg = rmse(aForShape, bForShape);
  }

  const shapeFactor = Math.exp(-shapeErrDeg / shapeSigmaDeg);

  // --- Events term (optional) ---
  const aPeakIdx = indexOfMax(aAvg);
  const bPeakIdx = indexOfMax(bAvg);

  const dHeel = Math.abs(A.heelStrikeIndex - B.heelStrikeIndex);
  const dToe = Math.abs(A.toeOffIndex - B.toeOffIndex);
  const dPeak = Math.abs(aPeakIdx - bPeakIdx);

  const eventMean = (dHeel + dToe + dPeak) / 3;
  const eventFactor = Math.exp(-(eventMean / eventSigmaSamples) * eventWeight);

  // --- ROM term (optional) ---
  const aRom = A.peakFlexion - A.peakExtension;
  const bRom = B.peakFlexion - B.peakExtension;
  const dRom = Math.abs(aRom - bRom);

  const romFactor = Math.exp(-(dRom / romSigmaDeg) * romWeight);

  // Combine
  const score = clamp(maxScore * shapeFactor * eventFactor * romFactor, 0, maxScore);

  const out: GaitSimilarity = {
    mode,
    score,
    shapeRmseDeg: shapeErrDeg,
    eventDelta: { heelStrike: dHeel, toeOff: dToe, peakFlexion: dPeak },
    romDeltaDeg: dRom,
  };

  if (mode === "shapeOnlyIgnoreShiftAndTiming") {
    out.timingShiftSamples = timingShiftSamples ?? 0;
  }

  return out;
}

/**
 * Convenience wrappers (so your UI code is cleaner)
 */
export function gaitSimilarityShapeOnly(
  A: GaitCycleResult,
  B: GaitCycleResult,
  config: SimilarityConfig = {}
) {
  return gaitSimilarityScore(A, B, "shapeOnlyIgnoreShift", config);
}

export function gaitSimilarityWithShift(
  A: GaitCycleResult,
  B: GaitCycleResult,
  config: SimilarityConfig = {}
) {
  return gaitSimilarityScore(A, B, "shapePlusShift", config);
}

/**
 * NEW: ignores both vertical shift (mean) AND horizontal shift (timing)
 * by circularly aligning B to best match A before computing shape RMSE.
 * This compares the "pure shape" when perfectly aligned.
 */
export function gaitSimilarityShapeAligned(
  A: GaitCycleResult,
  B: GaitCycleResult,
  config: SimilarityConfig = {}
) {
  return gaitSimilarityScore(A, B, "shapeOnlyIgnoreShiftAndTiming", config);
}
