// lib/analyticsPro.ts
import type { Sample } from "@/lib/analytics";

export type Quality = {
  score: number; // 0–100
  jitter: number; // average abs delta
  dropoutRate: number; // % of dt<=0 or huge gaps
  clippingRate: number; // % near 0 or 140
};

export function velocity(samples: Sample[]) {
  const v: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const dt = (samples[i].t - samples[i - 1].t) / 1000;
    if (dt <= 0) continue;
    v.push((samples[i].angle - samples[i - 1].angle) / dt);
  }
  return v;
}

export function acceleration(samples: Sample[]) {
  const a: number[] = [];
  const v = velocity(samples);
  // approximate accel from v assuming ~uniform sampling
  for (let i = 1; i < v.length; i++) a.push(v[i] - v[i - 1]);
  return a;
}

export function fatigueIndex(samples: Sample[]) {
  // A simple fatigue proxy: ROM decay from first third to last third
  if (samples.length < 30) return null;
  const n = samples.length;
  const third = Math.floor(n / 3);

  const rom = (arr: Sample[]) => {
    let min = Infinity, max = -Infinity;
    for (const s of arr) { min = Math.min(min, s.angle); max = Math.max(max, s.angle); }
    return max - min;
  };

  const rom1 = rom(samples.slice(0, third));
  const rom3 = rom(samples.slice(n - third));

  if (rom1 <= 0) return null;
  const decay = (rom1 - rom3) / rom1; // 0 = no fatigue, higher = worse
  return { romStart: rom1, romEnd: rom3, decayPct: decay * 100 };
}

export function computeQuality(samples: Sample[]): Quality | null {
  if (!samples.length) return null;

  let jitterSum = 0;
  let jitterCount = 0;

  let dropout = 0;
  let dtCount = 0;

  let clip = 0;

  for (let i = 1; i < samples.length; i++) {
    const da = Math.abs(samples[i].angle - samples[i - 1].angle);
    jitterSum += da;
    jitterCount++;

    const dt = samples[i].t - samples[i - 1].t;
    dtCount++;
    if (dt <= 0 || dt > 500) dropout++; // gap > 0.5s considered dropout
  }

  for (const s of samples) {
    if (s.angle <= 1 || s.angle >= 139) clip++;
  }

  const jitter = jitterCount ? jitterSum / jitterCount : 0;
  const dropoutRate = dtCount ? (dropout / dtCount) * 100 : 0;
  const clippingRate = samples.length ? (clip / samples.length) * 100 : 0;

  // score (simple + interpretable)
  let score = 100;
  score -= Math.min(40, jitter * 1.2);
  score -= Math.min(40, dropoutRate * 1.1);
  score -= Math.min(20, clippingRate * 1.2);
  score = Math.max(0, Math.min(100, score));

  return { score, jitter, dropoutRate, clippingRate };
}

export function symmetryScore(left: number[], right: number[]) {
  // returns 0–100 similarity (higher is better)
  if (!left.length || !right.length) return null;
  const n = Math.min(left.length, right.length);
  let mse = 0;
  for (let i = 0; i < n; i++) mse += (left[i] - right[i]) ** 2;
  mse /= n;
  const rmse = Math.sqrt(mse);
  // map rmse into score
  const score = Math.max(0, Math.min(100, 100 - rmse * 2));
  return { rmse, score };
}
