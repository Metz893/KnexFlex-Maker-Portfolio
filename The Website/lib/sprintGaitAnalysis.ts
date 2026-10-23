// lib/sprintGaitAnalysis.ts
// TypeScript, browser-safe version of the provided sprinting gait-cycle Python logic.
// FIX: Make findPeaks/prominence behave closer to scipy.signal.find_peaks,
// so minima-to-minima starts and flexion peaks are detected reliably.

export type SprintGaitCycleResult = {
  cycles: number[][];
  averageCycle: number[];
  peakFlexion: number;
  peakExtension: number;
  // For UI compatibility with the walking analyzer:
  // heelStrikeIndex = pre-peak minimum index
  // toeOffIndex = post-peak minimum index
  heelStrikeIndex: number;
  toeOffIndex: number;
};

export function analyzeSprintingAngles(
  angles: number[]
): SprintGaitCycleResult | null {
  if (!angles || angles.length < 200) return null;

  // --- STEP 2: Detect sprinting flexion peaks ---
  const rawPeaks = findPeaks(angles, {
    distance: 15,
    prominence: 8,
    mode: "max",
  });

  // Match your python threshold
  const peaks = rawPeaks.filter((i) => angles[i] > 55);
  if (peaks.length < 2) return null;

  // --- STEP 2.5: Detect extension minima (true troughs) ---
  const rawMins = findPeaks(angles, {
    distance: 15,
    prominence: 6,
    mode: "min",
  }).sort((a, b) => a - b);

  const prevMinBefore = (idx: number): number | null => {
    for (let j = rawMins.length - 1; j >= 0; j--) {
      const m = rawMins[j];
      if (m < idx) return m;
    }
    return null;
  };

  // Map each flexion peak to its preceding minimum
  const starts: number[] = [];
  for (const p of peaks) {
    const m = prevMinBefore(p);
    if (m !== null) starts.push(m);
  }

  // Unique, sorted cycle starts
  const uniqStarts = Array.from(new Set(starts)).sort((a, b) => a - b);
  if (uniqStarts.length < 2) return null;

  // --- STEP 3: Extract start->next start cycles and normalize ---
  const lengths: number[] = [];
  for (let i = 0; i < uniqStarts.length - 1; i++) {
    lengths.push(uniqStarts[i + 1] - uniqStarts[i]);
  }

  const medLen = median(lengths);
  const minLen = Math.max(12, Math.floor(medLen * 0.6));
  const maxLen = Math.floor(medLen * 1.55);

  const TARGET_PEAK = 45; // where we force peak flexion to land (0-99)

  const normalizedCycles: number[][] = [];

  for (let i = 0; i < uniqStarts.length - 1; i++) {
    const start = uniqStarts[i];
    const end = uniqStarts[i + 1];
    const L = end - start;

    if (L < minLen || L > maxLen) continue;

    const cycle = angles.slice(start, end);
    if (cycle.length < 12) continue;

    // artifact jump filter
    for (let k = 1; k < cycle.length; k++) {
      if (Math.abs(cycle[k] - cycle[k - 1]) > 18) {
        // reject
        continue;
      }
    }
    // (the loop above can't "continue" outer; so do it properly)
    let bad = false;
    for (let k = 1; k < cycle.length; k++) {
      if (Math.abs(cycle[k] - cycle[k - 1]) > 18) {
        bad = true;
        break;
      }
    }
    if (bad) continue;

    // interpolate to 100 points
    let normalized = resampleLinear(cycle, 100);

    // FIX A: phase-align so peak flexion occurs at the same index
    const peakI = argMax(normalized);
    const shift = TARGET_PEAK - peakI;
    normalized = roll(normalized, shift);

    // FIX B: force wrap consistency so start/end match
    const drift = normalized[normalized.length - 1] - normalized[0];
    normalized = normalized.map(
      (v, idx) => v - (idx / (normalized.length - 1)) * drift
    );

    normalizedCycles.push(normalized);
  }

  if (!normalizedCycles.length) return null;

  // --- STEP 4: Robust outlier removal (distance to median + endpoint check) ---
  const cyclesArray = normalizedCycles;
  const medianCycle = pointwiseMedian(cyclesArray);

  const rmse = cyclesArray.map((c) =>
    Math.sqrt(mean(c.map((v, i) => (v - medianCycle[i]) ** 2)))
  );

  const rmseMed = median(rmse);
  const mad = median(rmse.map((x) => Math.abs(x - rmseMed))) + 1e-9;
  const z = rmse.map((x) => (x - rmseMed) / (1.4826 * mad));

  const endGap = cyclesArray.map((c) => Math.abs(c[0] - c[c.length - 1]));

  const filtered: number[][] = [];
  for (let i = 0; i < cyclesArray.length; i++) {
    if (z[i] < 2.5 && endGap[i] < 3.0) filtered.push(cyclesArray[i]);
  }

  if (filtered.length < 2) return null;

  // --- STEP 4.5: Average cycle ---
  const averageCycle = meanCycle(filtered);

  // --- STEP 5: Events on average (after alignment) ---
  const peakIdx = argMax(averageCycle);
  const prePeakMinIdx =
    peakIdx > 3 ? argMin(averageCycle.slice(0, peakIdx)) : 0;
  const postPeakMinIdx = peakIdx + argMin(averageCycle.slice(peakIdx));

  const peakFlexion = Math.max(...averageCycle);
  const peakExtension = Math.min(...averageCycle);

  return {
    cycles: filtered,
    averageCycle,
    peakFlexion,
    peakExtension,
    heelStrikeIndex: prePeakMinIdx,
    toeOffIndex: postPeakMinIdx,
  };
}

/* ============================
   Helpers (no external deps)
============================ */

type PeakMode = "max" | "min";

function findPeaks(
  arr: number[],
  opts: { distance: number; prominence: number; mode: PeakMode }
): number[] {
  const { distance, prominence, mode } = opts;
  if (arr.length < 3) return [];

  // For minima detection, invert the signal and do maxima detection.
  const sig = mode === "max" ? arr : arr.map((v) => -v);

  // 1) local maxima candidates on sig
  const cands: number[] = [];
  for (let i = 1; i < sig.length - 1; i++) {
    if (sig[i] > sig[i - 1] && sig[i] >= sig[i + 1]) cands.push(i);
  }

  // 2) prominence filter (closer to scipy’s notion)
  const withProm = cands
    .map((idx) => {
      const prom = prominenceScipyLike(sig, idx);
      return { idx, prom };
    })
    .filter((x) => x.prom >= prominence);

  if (!withProm.length) return [];

  // 3) enforce distance by greedy selection in descending prominence (then height)
  withProm.sort((a, b) => {
    if (b.prom !== a.prom) return b.prom - a.prom;
    return sig[b.idx] - sig[a.idx];
  });

  const picked: number[] = [];
  for (const p of withProm) {
    if (picked.every((j) => Math.abs(j - p.idx) >= distance)) {
      picked.push(p.idx);
    }
  }

  picked.sort((a, b) => a - b);
  return picked;
}

/**
 * Prominence approximation:
 * - Walk left until you find a point higher than the peak (or boundary).
 * - Track the minimum value in that interval.
 * - Same to the right.
 * - Prominence = peak - max(leftMin, rightMin)
 *
 * This matches scipy’s idea much more closely than the old scan.
 */
function prominenceScipyLike(sig: number[], idx: number): number {
  const peak = sig[idx];

  // left side: find nearest higher point; use min in between
  let leftMin = peak;
  let foundHigherLeft = false;
  for (let i = idx - 1; i >= 0; i--) {
    leftMin = Math.min(leftMin, sig[i]);
    if (sig[i] > peak) {
      foundHigherLeft = true;
      break;
    }
  }
  // if no higher found, leftMin is min to boundary (still correct behavior)

  // right side
  let rightMin = peak;
  let foundHigherRight = false;
  for (let i = idx + 1; i < sig.length; i++) {
    rightMin = Math.min(rightMin, sig[i]);
    if (sig[i] > peak) {
      foundHigherRight = true;
      break;
    }
  }

  // contour reference
  const ref = Math.max(leftMin, rightMin);

  // Note: foundHigher flags are not strictly necessary; boundary case is fine.
  return peak - ref;
}

function resampleLinear(values: number[], n: number): number[] {
  if (values.length === n) return values.slice();
  if (values.length < 2) return new Array(n).fill(values[0] ?? 0);

  const out = new Array(n);
  const last = values.length - 1;

  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * last;
    const x0 = Math.floor(x);
    const x1 = Math.min(last, x0 + 1);
    const t = x - x0;
    out[i] = values[x0] * (1 - t) + values[x1] * t;
  }
  return out;
}

function roll(arr: number[], shift: number): number[] {
  const n = arr.length;
  if (!n) return [];
  let k = shift % n;
  if (k < 0) k += n;
  if (k === 0) return arr.slice();
  return arr.slice(n - k).concat(arr.slice(0, n - k));
}

function argMax(arr: number[]): number {
  let bestI = 0;
  let bestV = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > bestV) {
      bestV = arr[i];
      bestI = i;
    }
  }
  return bestI;
}

function argMin(arr: number[]): number {
  let bestI = 0;
  let bestV = Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < bestV) {
      bestV = arr[i];
      bestI = i;
    }
  }
  return bestI;
}

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function pointwiseMedian(cycles: number[][]): number[] {
  const len = cycles[0].length;
  const out = new Array(len).fill(0);
  for (let i = 0; i < len; i++) {
    out[i] = median(cycles.map((c) => c[i]));
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
