// lib/gaitAnalysis.ts
// Browser-safe, TypeScript-native version of your Python gait analysis

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

export function analyzeGaitAngles(
  angles: number[]
): GaitCycleResult | null {
  if (angles.length < 200) return null;

  /* ----------------------------
     STEP 1: Peak detection
     (replacement for scipy.find_peaks)
  ---------------------------- */
  const rawPeaks: number[] = [];
  for (let i = 20; i < angles.length - 20; i++) {
    if (
      angles[i] > 40 &&
      angles[i] > angles[i - 1] &&
      angles[i] > angles[i + 1]
    ) {
      rawPeaks.push(i);
    }
  }

  /* ----------------------------
     STEP 2: Extract windows
  ---------------------------- */
  const normalizedCycles: number[][] = [];

  for (const peakIdx of rawPeaks) {
    const start = peakIdx - 65;
    const end = peakIdx + 30;

    if (start < 0 || end >= angles.length) continue;

    const cycle = angles.slice(start, end);

    // Abrupt change rejection (≥ 20° rule)
    let reject = false;
    for (let i = 1; i < cycle.length - 1; i++) {
      const jump =
        Math.abs(cycle[i] - cycle[i - 1]) +
        Math.abs(cycle[i + 1] - cycle[i]);
      if (jump >= 20) {
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
  ---------------------------- */
  const mseValues = cyclesArray.map((c) =>
    meanSquaredError(c, averageCycle)
  );

  const threshold = percentile(mseValues, 80);

  cyclesArray = cyclesArray.filter(
    (_, i) => mseValues[i] <= threshold
  );

  if (!cyclesArray.length) return null;

  averageCycle = meanCycle(cyclesArray);

  /* ----------------------------
     STEP 4.5: Peak validation
  ---------------------------- */
  const avgPeakFlex = Math.max(...averageCycle);
  const avgPeakExt = Math.min(...averageCycle);

  cyclesArray = cyclesArray.filter((cycle) => {
    const pf = Math.max(...cycle);
    const pfIdx = cycle.indexOf(pf);
    const peIdx = Math.max(0, pfIdx - 32);
    const pe = cycle[peIdx];

    return (
      Math.abs(pf - avgPeakFlex) <= 15 &&
      Math.abs(pe - avgPeakExt) <= 10
    );
  });

  if (!cyclesArray.length) return null;

  averageCycle = meanCycle(cyclesArray);

  /* ----------------------------
     STEP 5: Gait events
  ---------------------------- */
  const peakFlexionIndex = indexOfMax(averageCycle);
  const heelStrikeIndex = indexOfMin(averageCycle);
  const toeOffIndex = findSecondMinFarFrom(
    averageCycle,
    heelStrikeIndex
  );

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

function findSecondMinFarFrom(
  arr: number[],
  excludeIdx: number
): number {
  const indices = arr
    .map((v, i) => ({ v, i }))
    .sort((a, b) => a.v - b.v)
    .map((x) => x.i);

  return (
    indices.find(
      (i) => i !== excludeIdx && Math.abs(i - excludeIdx) > 10
    ) ?? excludeIdx
  );
}
