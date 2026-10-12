// The two backends behind one response shape: { empty, label, candidates:[{label,prob}], preview, ms }.
import { canvasTo28 } from './preprocess.js';

const ORT_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js';
let info = null;                       // from /api/info: which models exist, valid labels
const sessions = {};

export async function loadInfo() {
  const r = await fetch('/api/info');
  if (!r.ok) throw new Error('info ' + r.status);
  info = await r.json();
  return info;
}
export const validLabels = mode => (info && info.classes[mode]) || null;

export async function predictServer(pad, topk = 5, mode = 'auto') {
  const encodeStarted = performance.now();
  const image = pad.toDataURL('image/png');
  const encodeMs = performance.now() - encodeStarted;
  const networkStarted = performance.now();
  const res = await fetch('/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image, topk, mode }) });
  if (!res.ok) throw new Error('predict ' + res.status);
  const result = await res.json();
  result.clientTimings = { encode_ms: encodeMs, network_ms: performance.now() - networkStarted };
  return result;
}

function loadOrt() {
  if (window.ort) return Promise.resolve();
  return new Promise((ok, fail) => {
    const s = document.createElement('script'); s.src = ORT_URL; s.onload = ok;
    s.onerror = () => fail(new Error('onnxruntime-web failed to load')); document.head.appendChild(s);
  });
}
const session = name => (sessions[name] ??= ort.InferenceSession.create(`/models/cnn_${name}.onnx`));

async function probs(name, arr) {
  const out = await (await session(name)).run({ x: new ort.Tensor('float32', arr, [1, 1, 28, 28]) });
  const l = out.logits.data, mx = Math.max(...l), ex = Array.from(l, v => Math.exp(v - mx)), sum = ex.reduce((a, b) => a + b, 0);
  return ex.map(v => v / sum);
}

export async function predictBrowser(pad, topk = 5, mode = 'auto') {
  const t0 = performance.now();
  const encodeStarted = performance.now();
  const arr = canvasTo28(pad);
  const preprocessMs = performance.now() - encodeStarted;
  if (!arr) return { empty: true };
  await loadOrt();
  if (!info) await loadInfo();
  const modelStarted = performance.now();
  let cands = [];
  if (mode === 'letters' || mode === 'digits') {
    const p = await probs(mode, arr);
    cands = p.map((v, i) => ({ label: info.classes[mode][i], prob: v }));
  } else if (info.unified) {
    const p = await probs('mixed', arr);
    cands = p.map((v, i) => ({ label: info.classes.mixed[i], prob: v }));
  } else {   // same merge as server.py: both models, each weighted 0.5
    for (const name of ['letters', 'digits']) {
      const p = await probs(name, arr);
      cands.push(...p.map((v, i) => ({ label: info.classes[name][i], prob: v * 0.5 })));
    }
  }
  const modelMs = performance.now() - modelStarted;
  cands.sort((a, b) => b.prob - a.prob); cands = cands.slice(0, topk);
  const preview = []; for (let y = 0; y < 28; y++) preview.push(Array.from(arr.slice(y * 28, y * 28 + 28), v => Math.round(v * 255)));
  return { empty: false, label: cands[0].label, candidates: cands, preview, ms: modelMs,
    clientTimings: { encode_ms: 0, preprocess_ms: preprocessMs, model_ms: modelMs,
      browser_total_ms: performance.now() - t0 } };
}

export async function savePad(pad, label) {
  const res = await fetch('/save', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: pad.toDataURL('image/png'), label }) });
  if (!res.ok) throw new Error('save ' + res.status);
  return res.json();
}
