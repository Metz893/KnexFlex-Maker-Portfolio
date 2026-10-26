
const WS_URL = "ws://192.168.4.1:81";

// Storage key
const KEY = "knexflex_offline_docs_v2";

let ws;
let recording = false;
let buffer = [];
let lastUpdateMs = null;
let legMultiplier = 1; // +1 = left, -1 = right

const LIVE_MAX_POINTS = 240;
let livePoints = [];

const SCORE_MAX = 1000;
const SCORE_MIN_SAMPLES = 120;
const SCORE_RECALC_EVERY = 6;
let scoreMsgCounter = 0;
let smoothedScore = null;

const HEALTHY_AVERAGE_CYCLE = [
  8.90, 10.27, 11.65, 13.03, 14.26, 15.30, 16.20, 16.94, 17.43, 17.67,
  17.71, 17.57, 17.31, 16.90, 16.35, 15.71, 14.94, 14.09, 13.18, 12.20,
  11.16, 10.07, 8.93, 7.80, 6.68, 5.60, 4.61, 3.67, 2.82, 2.08,
  1.43, 0.88, 0.49, 0.25, 0.15, 0.19, 0.35, 0.60, 0.96, 1.42,
  2.01, 2.73, 3.60, 4.60, 5.76, 7.05, 8.48, 10.04, 11.78, 13.69,
  15.80, 18.17, 20.90, 23.99, 27.49, 31.35, 35.56, 39.93, 44.25, 48.34,
  52.04, 55.47, 58.62, 61.48, 64.06, 66.29, 68.11, 69.52, 70.51, 71.08,
  71.30, 71.27, 71.03, 70.29, 69.15, 67.64, 65.81, 63.67, 61.23, 58.47,
  55.40, 52.03, 48.32, 44.30, 39.89, 35.24, 30.42, 25.71, 21.30, 17.19,
  13.27, 9.53, 6.28, 3.80, 2.58, 2.57, 3.28, 4.29, 4.98, 5.84
];

const angleEl = document.getElementById("angle");
const statusEl = document.getElementById("status");
const samplesEl = document.getElementById("samples");
const lastMsgEl = document.getElementById("lastMsg");
const hzEl = document.getElementById("hz");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const saveBtn = document.getElementById("saveBtn");
const reconnectBtn = document.getElementById("reconnectBtn");

const leftLegBtn = document.getElementById("leftLegBtn");
const rightLegBtn = document.getElementById("rightLegBtn");

const sessionListEl = document.getElementById("sessionList");
const emptyEl = document.getElementById("empty");
const docPaneEl = document.getElementById("docPane");

const exportAllBtn = document.getElementById("exportAllBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const importHintBtn = document.getElementById("importHintBtn");

const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalContent = document.getElementById("modalContent");
const closeModalBtn = document.getElementById("closeModalBtn");

const scoreEl = document.getElementById("score");
const scoreHintEl = document.getElementById("scoreHint");

function safeParse(s, fallback) {
  try { return s ? JSON.parse(s) : fallback; } catch { return fallback; }
}
function getDocs() { return safeParse(localStorage.getItem(KEY), []); }
function setDocs(d) { localStorage.setItem(KEY, JSON.stringify(d)); }
function uuid() { return crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random()}`; }
function fmtDate(ms) { return new Date(ms).toLocaleString(); }

function downloadText(name, content, type="application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV(samples) {
  return ["t_ms,angle_deg", ...samples.map(s => `${s.t},${s.angle.toFixed(2)}`)].join("\n");
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function mean(arr) {
  if (!arr.length) return 0;
  let sum = 0;
  for (const v of arr) sum += v;
  return sum / arr.length;
}

function removeVerticalShift(arr) {
  const m = mean(arr);
  return arr.map(v => v - m);
}

function interpolateToPoints(data, points = 100) {
  if (data.length < 2) return null;

  const out = [];
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

function rmse(a, b) {
  if (a.length !== b.length) return Infinity;
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s / a.length);
}

function circularShift(arr, k) {
  const n = arr.length;
  const out = new Array(n);
  const kk = ((k % n) + n) % n;

  for (let i = 0; i < n; i++) {
    out[(i + kk) % n] = arr[i];
  }

  return out;
}

function bestAlignedRmse(a, b) {
  let best = Infinity;

  for (let k = 0; k < b.length; k++) {
    const shifted = circularShift(b, k);
    const e = rmse(a, shifted);
    if (e < best) best = e;
  }

  return best;
}

function computeLiveScore(points) {
  if (points.length < SCORE_MIN_SAMPLES) return null;

  const recentAngles = points.map(p => Math.abs(p.angle));
  const liveCycle = interpolateToPoints(recentAngles, 100);
  if (!liveCycle) return null;

  const healthyCentered = removeVerticalShift(HEALTHY_AVERAGE_CYCLE);
  const liveCentered = removeVerticalShift(liveCycle);

  const shapeErr = bestAlignedRmse(healthyCentered, liveCentered);

  const sigma = 18;
  const rawScore = SCORE_MAX * Math.exp(-shapeErr / sigma);

  return clamp(rawScore, 0, SCORE_MAX);
}

function updateScoreUI(score) {
  if (!scoreEl || !scoreHintEl) return;

  if (score == null) {
    scoreEl.textContent = "--";
    scoreHintEl.textContent = "Waiting for enough walking data...";
    return;
  }

  scoreEl.textContent = Math.round(score).toString();
  scoreHintEl.textContent = "Live score updating as you walk";
}

// ---------------- analytics ----------------
function computeStats(samples) {
  if (!samples.length) return null;
  let min = Infinity, max = -Infinity, sum = 0;
  for (const s of samples) {
    min = Math.min(min, s.angle);
    max = Math.max(max, s.angle);
    sum += s.angle;
  }
  const mean = sum / samples.length;
  return { min, max, rom: max - min, mean, count: samples.length };
}

const canvas = document.getElementById("liveChart");
const ctx = canvas.getContext("2d");

function drawLiveChart() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#e5e7eb";
  ctx.strokeRect(0.5, 0.5, canvas.width-1, canvas.height-1);

  if (livePoints.length < 2) return;

  const min = 0;
  const max = 140;

  const pad = 18;
  const w = canvas.width - pad*2;
  const h = canvas.height - pad*2;

  ctx.beginPath();
  livePoints.forEach((p, i) => {
    const x = pad + (i/(livePoints.length-1))*w;
    const y = pad + (1-(p.angle-min)/(max-min))*h;
    i ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
  });
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ---------------- UI rendering ----------------
let selectedId = null;

function renderList() {
  const docs = getDocs();
  sessionListEl.innerHTML = "";
  emptyEl.style.display = docs.length ? "none" : "block";

  docs.forEach(d => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <div class="itemTitle">${d.title}</div>
        <div class="itemMeta">${fmtDate(d.createdAt)} • ${d.samples.length} samples</div>
      </div>
      <div class="itemBtns">
        <button class="btn outline">View</button>
        <button class="btn outline">Export</button>
        <button class="btn ghost danger">Delete</button>
      </div>
    `;
    const [view, exp, del] = div.querySelectorAll("button");

    view.onclick = () => { selectedId = d.id; renderDoc(d.id); };
    exp.onclick = () => exportOne(d.id);
    del.onclick = () => {
      setDocs(getDocs().filter(x => x.id !== d.id));
      if (selectedId === d.id) docPaneEl.innerHTML = "";
      renderList();
    };

    sessionListEl.appendChild(div);
  });
}

function renderDoc(id) {
  const d = getDocs().find(x => x.id === id);
  if (!d) return;

  const st = computeStats(d.samples);
  docPaneEl.innerHTML = `
    <h3>${d.title}</h3>
    <div class="muted small">${fmtDate(d.createdAt)}</div>
    <div class="kv">
      <div>Samples</div><div>${st.count}</div>
      <div>ROM</div><div>${st.rom.toFixed(1)}°</div>
      <div>Mean</div><div>${st.mean.toFixed(1)}°</div>
    </div>
    <button class="btn outline" id="csvBtn">Download CSV</button>
  `;

  document.getElementById("csvBtn").onclick = () =>
    downloadText(`knexflex_${d.createdAt}.csv`, toCSV(d.samples), "text/csv");
}

// ---------------- export ----------------
function exportOne(id) {
  const d = getDocs().find(x => x.id === id);
  if (!d) return;
  downloadText(`knexflex_${d.createdAt}.knexflex.json`, JSON.stringify(d,null,2));
}

function exportAll() {
  downloadText(
    `knexflex_export_${Date.now()}.knexflex.json`,
    JSON.stringify({ exportedAt: Date.now(), sessions: getDocs() }, null, 2)
  );
}

function openModal(title, html) {
  modalTitle.textContent = title;
  modalContent.innerHTML = html;
  modal.showModal();
}
closeModalBtn.onclick = () => modal.close();

// ---------------- leg buttons ----------------
leftLegBtn.onclick = () => {
  legMultiplier = 1;
  leftLegBtn.classList.add("primary");
  rightLegBtn.classList.remove("primary");
};

rightLegBtn.onclick = () => {
  legMultiplier = -1;
  rightLegBtn.classList.add("primary");
  leftLegBtn.classList.remove("primary");
};

// ---------------- websocket ----------------
let msgCount = 0;
let msgStart = Date.now();

function setStatus(ok) {
  statusEl.textContent = ok ? "Connected" : "Disconnected";
  statusEl.className = "status " + (ok ? "connected" : "disconnected");
}

function connect() {
  try { ws?.close(); } catch {}
  ws = new WebSocket(WS_URL);

  ws.onopen = () => setStatus(true);
  ws.onclose = ws.onerror = () => setStatus(false);

  ws.onmessage = e => {
    const raw = parseFloat(e.data);
    if (Number.isNaN(raw)) return;
    const value = raw * legMultiplier;

    const now = Date.now();
    angleEl.textContent = value.toFixed(2) + "°";
    lastMsgEl.textContent = "Last update: " + new Date(now).toLocaleTimeString();

    msgCount++;
    if (now - msgStart > 1000) {
      hzEl.textContent = (msgCount / ((now-msgStart)/1000)).toFixed(1) + " Hz";
      msgCount = 0;
      msgStart = now;
    }

    livePoints.push({ t: now, angle: value });
    if (livePoints.length > LIVE_MAX_POINTS) livePoints.shift();
    drawLiveChart();

    scoreMsgCounter++;
    if (scoreMsgCounter % SCORE_RECALC_EVERY === 0) {
      const rawScore = computeLiveScore(livePoints);

      if (rawScore == null) {
        updateScoreUI(null);
      } else {
        smoothedScore = smoothedScore == null
          ? rawScore
          : smoothedScore * 0.8 + rawScore * 0.2;

        updateScoreUI(smoothedScore);
      }
    }

    if (recording) {
      buffer.push({ t: now, angle: value });
      samplesEl.textContent = `${buffer.length} samples recorded`;
      saveBtn.disabled = true;
    } else {
      samplesEl.textContent = "Not recording";
    }
  };
}

// ---------------- controls ----------------
startBtn.onclick = () => {
  buffer = [];
  recording = true;
  startBtn.classList.add("hidden");
  stopBtn.classList.remove("hidden");
};

stopBtn.onclick = () => {
  recording = false;
  startBtn.classList.remove("hidden");
  stopBtn.classList.add("hidden");
  saveBtn.disabled = !buffer.length;
};

saveBtn.onclick = () => {
  if (!buffer.length) return;
  const docs = getDocs();
  docs.unshift({
    id: uuid(),
    createdAt: Date.now(),
    title: "Session " + fmtDate(Date.now()),
    samples: buffer,

    source: "offline",
    leg: legMultiplier === 1 ? "left" : "right",
    schemaVersion: 1
  });
  setDocs(docs);
  buffer = [];
  saveBtn.disabled = true;
  renderList();
};

reconnectBtn.onclick = connect;
exportAllBtn.onclick = exportAll;
clearAllBtn.onclick = () => { setDocs([]); renderList(); };

importHintBtn.onclick = () =>
  openModal("Upload", "Export sessions and import on the online dashboard.");

// ---------------- init ----------------
renderList();
drawLiveChart();
updateScoreUI(null);
connect();
