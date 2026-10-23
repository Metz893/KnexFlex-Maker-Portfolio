export type Sample = { t: number; angle: number };

export type Stats = {
  sampleCount: number;
  durationSec: number;
  min: number;
  max: number;
  rom: number;
  mean: number;
  stdev: number;
  velMean: number; // deg/s
  velMax: number;  // deg/s
  reps: number;
};

export function computeStats(samples: Sample[]): Stats | null {
  if (!samples?.length) return null;

  let min = Infinity, max = -Infinity, sum = 0;

  for (const s of samples) {
    const a = s.angle;
    if (a < min) min = a;
    if (a > max) max = a;
    sum += a;
  }

  const mean = sum / samples.length;
  let varSum = 0;
  for (const s of samples) varSum += (s.angle - mean) ** 2;
  const stdev = Math.sqrt(varSum / samples.length);

  let velSum = 0, velMax = 0, velCount = 0;
  for (let i = 1; i < samples.length; i++) {
    const dt = (samples[i].t - samples[i - 1].t) / 1000;
    if (dt <= 0) continue;
    const v = Math.abs((samples[i].angle - samples[i - 1].angle) / dt);
    velSum += v;
    velCount++;
    if (v > velMax) velMax = v;
  }

  const velMean = velCount ? velSum / velCount : 0;
  const durationSec = (samples[samples.length - 1].t - samples[0].t) / 1000;
  const rom = max - min;

  const reps = countReps(samples);

  return { sampleCount: samples.length, durationSec, min, max, rom, mean, stdev, velMean, velMax, reps };
}

// Simple, robust-ish rep estimate using hysteresis bands based on ROM.
export function countReps(samples: Sample[]): number {
  if (samples.length < 10) return 0;

  const st = (() => {
    let min = Infinity, max = -Infinity;
    for (const s of samples) { if (s.angle < min) min = s.angle; if (s.angle > max) max = s.angle; }
    const rom = max - min;
    return { min, max, rom };
  })();

  if (st.rom < 5) return 0;

  const hi = st.min + st.rom * 0.6;
  const lo = st.min + st.rom * 0.4;

  let reps = 0;
  let armed = true;

  for (const s of samples) {
    if (armed && s.angle >= hi) { reps++; armed = false; }
    else if (!armed && s.angle <= lo) { armed = true; }
  }

  return reps;
}

export function toCSV(samples: Sample[]) {
  const lines = ["t_ms,angle_deg"];
  for (const s of samples) lines.push(`${Math.round(s.t)},${s.angle.toFixed(2)}`);
  return lines.join("\n");
}

export function percentile(samples: Sample[], p: number) {
  if (!samples.length) return null;
  const arr = samples.map(s => s.angle).slice().sort((a, b) => a - b);
  const idx = Math.min(arr.length - 1, Math.max(0, Math.floor((p / 100) * (arr.length - 1))));
  return arr[idx];
}

export function downsample(samples: Sample[], maxPoints = 1200): Sample[] {
  if (samples.length <= maxPoints) return samples;
  const stride = Math.ceil(samples.length / maxPoints);
  const out: Sample[] = [];
  for (let i = 0; i < samples.length; i += stride) out.push(samples[i]);
  return out;
}
