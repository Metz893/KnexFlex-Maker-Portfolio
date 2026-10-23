// lib/gaitAnalysis.ts
// Browser-safe, TypeScript-native version of your Python gait analysis
// Small change: accept a wider range of gait cycles (more tolerant for abnormal / impaired gait)
// Function + outputs stay the same.

export type GaitCycleResult = {
  cycles: number[][];
  averageCycle: number[];
  peakFlexion: number;
  peakExtension: number;
  heelStrikeIndex: number;
  toeOffIndex: number;
};

/* ============================
   MAIN ENTRY POINT
============================ */

export function analyzeGaitAngles(angles: number[]): GaitCycleResult | null {
  if (angles.length < 200) return null;

  /* ----------------------------
     STEP 1: Peak detection
     (replacement for scipy.find_peaks)
     Small change: allow weaker peaks by lowering threshold slightly
     and using >= on one side to be less strict.
  ---------------------------- */
  const rawPeaks: number[] = [];
  for (let i = 20; i < angles.length - 20; i++) {
    if (
      angles[i] > 35 && // was 40
      angles[i] > angles[i - 1] &&
      angles[i] >= angles[i + 1]
    ) {
      rawPeaks.push(i);
    }
  }

  /* ----------------------------
     STEP 2: Extract windows
     Small change: slightly relax abrupt-change rejection

     NEW FIX:
     - For each detected peak, look inside the would-be window for a higher peak.
     - Re-center on that true highest peak.
     - DEDUPE: if multiple raw peaks map to the same true highest peak, keep only one cycle.
  ---------------------------- */
  const normalizedCycles: number[][] = [];

  // ✅ NEW: track centers we’ve already used (prevents double-counting same real peak)
  const usedCenters = new Set<number>();

  for (const peakIdx of rawPeaks) {
  // ✅ compute spacing (samples between peaks)
  let spacing = averagePeakSpacing(rawPeaks);

  if (spacing == null) spacing = 100;
  else if (spacing < 65) spacing = spacing * 2;

  // ✅ gradual adjustment:
  // target cadence spacing ~100 samples
  // spacing > 100  -> longer cycle -> widen window
  // spacing < 100  -> shorter cycle -> narrow window
  const target = 100;
  const delta = spacing - target;

  var widenend = Math.max(-10, Math.min(10, Math.round(delta * 0.2)));
  var widenstart = Math.max(-10, Math.min(10, Math.round(delta * 0.6)));

  // scale + clamp to keep changes small and stable
  if (spacing < 95) {
    widenend = 2;
    widenstart = 2;
  }
  else if (spacing > 120) {
    widenend = -2;
    widenstart = -2;
  }


  // apply widening symmetrically (keeps the cycle centered similarly)
  const before = 70 + widenstart; // samples before peak
  const after = 30 + widenend;  // samples after peak

  let start = peakIdx - before;
  let end = peakIdx + after;

  if (start < 0 || end >= angles.length) continue;

  // Find the highest point inside this window and re-center if needed
  let bestIdx = peakIdx;
  let bestVal = angles[peakIdx];

  for (let i = start; i <= end; i++) {
    const v = angles[i];
    if (v > bestVal) {
      bestVal = v;
      bestIdx = i;
    }
  }

  // Re-center using the same adaptive window
  start = bestIdx - before;
  end = bestIdx + after;

  if (start < 0 || end >= angles.length) continue;

    // ✅ NEW: dedupe cycles that would be centered on the same true peak
    if (usedCenters.has(bestIdx)) continue;
    usedCenters.add(bestIdx);

    const cycle = angles.slice(start, end);

    // Abrupt change rejection (≥ 20° rule)
    // Small change: allow a bit more variability (was 20)
    let reject = false;
    for (let i = 1; i < cycle.length - 1; i++) {
      const jump =
        Math.abs(cycle[i] - cycle[i - 1]) +
        Math.abs(cycle[i + 1] - cycle[i]);
      if (jump >= 26) {
        // was 20
        reject = true;
        break;
      }
    }
    if (reject) continue;

    normalizedCycles.push(interpolate(cycle, 100));
  }

  if (!normalizedCycles.length) return null;

  /* ----------------------------
     STEP 3: Rough average
  ---------------------------- */
  let cyclesArray = normalizedCycles;
  let averageCycle = meanCycle(cyclesArray);

  /* ----------------------------
     STEP 4: MSE filtering (keep best 80%)
     Small change: keep more cycles (more inclusive)
  ---------------------------- */
  const mseValues = cyclesArray.map((c) => meanSquaredError(c, averageCycle));

  const threshold = percentile(mseValues, 90); // was 80
  cyclesArray = cyclesArray.filter((_, i) => mseValues[i] <= threshold);

  if (!cyclesArray.length) return null;

  averageCycle = meanCycle(cyclesArray);

  /* ----------------------------
     STEP 4.5: Peak validation
     Small change: widen acceptance ranges for peak flex/extension differences
  ---------------------------- */
  const avgPeakFlex = Math.max(...averageCycle);
  const avgPeakExt = Math.min(...averageCycle);

  cyclesArray = cyclesArray.filter((cycle) => {
    const pf = Math.max(...cycle);
    const pfIdx = cycle.indexOf(pf);
    const peIdx = Math.max(0, pfIdx - 32);
    const pe = cycle[peIdx];

    return (
      Math.abs(pf - avgPeakFlex) <= 22 && // was 15
      Math.abs(pe - avgPeakExt) <= 15 // was 10
    );
  });

  if (!cyclesArray.length) return null;

  averageCycle = meanCycle(cyclesArray);

  /* ----------------------------
     STEP 5: Gait events
  ---------------------------- */
  const peakFlexionIndex = indexOfMax(averageCycle);
  const heelStrikeIndex = indexOfMin(averageCycle);
  const toeOffIndex = findSecondMinFarFrom(averageCycle, heelStrikeIndex);

  return {
    cycles: cyclesArray,
    averageCycle,
    peakFlexion: averageCycle[peakFlexionIndex],
    peakExtension: averageCycle[heelStrikeIndex],
    heelStrikeIndex,
    toeOffIndex,
  };
}

/* ============================
   HELPER FUNCTIONS
============================ */

function interpolate(data: number[], points: number): number[] {
  const out: number[] = [];
  const n = data.length - 1;

  for (let i = 0; i < points; i++) {
    const x = (i / (points - 1)) * n;
    const lo = Math.floor(x);
    const hi = Math.ceil(x);
    const t = x - lo;
    out.push(data[lo] * (1 - t) + data[hi] * t);
  }

  return out;
}

function meanCycle(cycles: number[][]): number[] {
  const len = cycles[0].length;
  const sum = new Array(len).fill(0);

  for (const c of cycles) {
    for (let i = 0; i < len; i++) sum[i] += c[i];
  }

  return sum.map((v) => v / cycles.length);
}

function meanSquaredError(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    s += (a[i] - b[i]) ** 2;
  }
  return s / a.length;
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

function indexOfMax(arr: number[]): number {
  return arr.reduce((max, v, i, a) => (v > a[max] ? i : max), 0);
}

function indexOfMin(arr: number[]): number {
  return arr.reduce((min, v, i, a) => (v < a[min] ? i : min), 0);
}

function findSecondMinFarFrom(arr: number[], excludeIdx: number): number {
  const indices = arr
    .map((v, i) => ({ v, i }))
    .sort((a, b) => a.v - b.v)
    .map((x) => x.i);

  return (
    indices.find((i) => i !== excludeIdx && Math.abs(i - excludeIdx) > 10) ??
    excludeIdx
  );
}

function averagePeakSpacing(peaks: number[]): number | null {
  if (peaks.length < 2) return null;

  let sum = 0;
  for (let i = 1; i < peaks.length; i++) {
    sum += peaks[i] - peaks[i - 1];
  }

  console.log(sum / (peaks.length - 1));

  return sum / (peaks.length - 1);
}
