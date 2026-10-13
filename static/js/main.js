import { applyI18n, setLang, getLang, onLangChange, t } from './i18n.js';
import { createPad } from './pad.js';
import { loadInfo, predictServer, predictBrowser, savePad, validLabels } from './predict.js';
import { LatencyChart } from './chart.js';
import { createCameraInput } from './camera.js';
import * as ui from './ui.js';

const $ = id => document.getElementById(id);
const root = document.documentElement;
const SERIES = [
  { key: 'server', color: 'var(--accent)', get label() { return t('backend.server'); } },
  { key: 'browser', color: 'var(--accent-2)', get label() { return t('backend.browser'); } },
];
const state = { backend: 'server', mode: 'letters', last: null, count: 0, inferenceMs: null, history: [],
  lat: { server: [], browser: [] }, tEvent: 0, inflight: false, pending: false, commit: false, serverRequestSeen: false, runtimeMetrics: null };

const quantile = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const backendName = () => t(state.backend === 'server' ? 'backend.server' : 'backend.browser');

// ---------- canvas ----------
const pad = createPad($('pad'), {
  onActivity(ts, strokeEnd) { state.tEvent = ts; if (strokeEnd) state.commit = true; requestPredict(); },
  onClear() { state.last = null; state.commit = false; ui.renderPrediction(null, backendName()); },
});
$('undo').onclick = () => pad.undo();
$('clear').onclick = () => pad.clear();
$('width').oninput = e => { pad.setWidth(+e.target.value); $('wv').textContent = e.target.value; };
$('width').dispatchEvent(new Event('input'));

// ---------- hand tracking (camera) ----------
const camera = createCameraInput({ pad, video: $('cam-video'), overlay: $('cam-overlay'), row: $('cam-row'), pen: $('pen'), status: $('cam-status') });
const CAM_ERRORS = { insecure: 'toast.cam_insecure', denied: 'toast.cam_denied', nocamera: 'toast.cam_none', load: 'toast.cam_load' };
function markCamera(on) { $('cam-toggle').classList.toggle('is-on', on); $('cam-toggle').setAttribute('aria-pressed', on); }
$('cam-toggle').onclick = async () => {
  const btn = $('cam-toggle');
  if (camera.on) { camera.stop(); markCamera(false); return; }
  btn.disabled = true; markCamera(true);
  try { await camera.start(); }
  catch (err) { console.error(err); markCamera(false); ui.toast(t(CAM_ERRORS[err.code] || 'toast.cam_load'), 'error'); }
  btn.disabled = false;
};

// ---------- real-time rule: one request in flight, one follow-up with the freshest canvas ----------
function requestPredict() { if (state.inflight) { state.pending = true; return; } run(); }
async function run() {
  state.inflight = true; state.pending = false;
  const tEvent = state.tEvent, backend = state.backend;
  try {
    const r = backend === 'server' ? await predictServer(pad.canvas, 5, state.mode) : await predictBrowser(pad.canvas, 5, state.mode);
    if (backend === 'server') ui.setConn('on');
    if (r.empty) { state.last = null; ui.renderPrediction(null, backendName()); }
    else {
      const paintStarted = performance.now();
      state.last = r; state.count++; state.inferenceMs = r.ms;
      ui.renderPrediction(r, backendName());
      if (document.activeElement !== $('lbl')) $('lbl').value = r.label;
      const firstServerRequest = backend === 'server' && !state.serverRequestSeen;
      if (backend === 'server') state.serverRequestSeen = true;
      requestAnimationFrame(() => {
        const paintMs = performance.now() - paintStarted;
        const endToEndMs = performance.now() - tEvent;
        state.lat[backend].push(endToEndMs);
        if (state.lat[backend].length > 200) state.lat[backend].shift();
        const client = r.clientTimings || {};
        const server = r.timings || {};
        state.latestStages = backend === 'server'
          ? { 'Encode (client)': client.encode_ms, 'Network round trip*': client.network_ms,
              'Server preprocessing': server.preprocess_ms, 'Model inference': server.model_ms,
              'Paint (client)': paintMs, 'End-to-end total': endToEndMs }
          : { 'Browser preprocessing': client.preprocess_ms, 'Browser model inference': client.model_ms,
              'Paint (client)': paintMs, 'End-to-end total': endToEndMs };
        renderStageBreakdown(state.latestStages, firstServerRequest);
        refreshStats();
      });
      if (state.commit && !state.pending) { commitHistory(r, backend); }
    }
    if (!state.pending) state.commit = false;
  } catch (err) {
    console.error(err);
    if (backend === 'server') ui.setConn('off');
    ui.toast(t('err.predict'), 'error');
  }
  state.inflight = false;
  if (state.pending) run();
}

function commitHistory(r, backend) {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  state.history.unshift({ label: r.label, prob: r.candidates[0].prob, backend, time: `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` });
  state.history.length = Math.min(state.history.length, 12);
  ui.renderHistory(state.history);
}


function renderStageBreakdown(stages, firstServerRequest = false) {
  const el = $('stage-breakdown');
  const entries = Object.entries(stages || {}).filter(([, value]) => Number.isFinite(value));
  if (!entries.length) return;
  const max = Math.max(1, ...entries.map(([, value]) => value));
  el.innerHTML = entries.map(([name, value]) => {
    const width = Math.max(0, Math.min(100, value / max * 100));
    return `<div class="stage-row"><span class="stage-name">${name}</span><span class="stage-track"><span class="stage-fill" style="display:block;width:${width}%"></span></span><span class="stage-value">${value.toFixed(1)} ms</span></div>`;
  }).join('') + '<p class="stage-note">*Network round trip includes server processing; do not add it to the server stages. End-to-end total is measured from the input event until the next paint.</p>' +
    (firstServerRequest ? '<p class="stage-note">First server request in this page session; it may include a hosting cold start.</p>' : '') +
    (firstServerRequest && state.runtimeMetrics ? `<p class="stage-note">Server process startup/model loading: ${Number(state.runtimeMetrics.startup_ms).toFixed(1)} ms. This excludes any provider wake-up time before the process accepted requests.</p>` : '');
}

function refreshStats() {
  const a = state.lat[state.backend];
  ui.renderKpis({ inference: state.inferenceMs, p50: quantile(a, .5), p95: quantile(a, .95), count: state.count });
  ui.renderLegend(SERIES.map(s => ({ label: s.label, color: s.color, p50: quantile(state.lat[s.key], .5), p95: quantile(state.lat[s.key], .95) })));
  chart.setData(state.lat);
  $('chart-empty').hidden = state.lat.server.length + state.lat.browser.length > 0;
}
const chart = new LatencyChart($('chart'), SERIES);

// ---------- symbols switch (letters / digits) ----------
document.querySelectorAll('#mode-group button').forEach(btn => btn.onclick = () => {
  state.mode = btn.dataset.mode;
  document.querySelectorAll('#mode-group button').forEach(b => { const on = b === btn; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on); });
  if (state.last) { state.tEvent = performance.now(); requestPredict(); }
});

// ---------- model switch ----------
document.querySelectorAll('#backend-group .option').forEach(btn => btn.onclick = () => {
  state.backend = btn.dataset.backend;
  document.querySelectorAll('#backend-group .option').forEach(b => { const on = b === btn; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on); });
  state.inferenceMs = null; refreshStats(); ui.renderPrediction(state.last, backendName());
  if (state.last) requestPredict();
});

// ---------- save sample ----------
$('save').onclick = async () => {
  const label = $('lbl').value.trim().toUpperCase();
  if (!state.last) return ui.toast(t('toast.no_ink'), 'error');
  const valid = validLabels(state.mode);
  if (!(valid ? valid.includes(label) : (state.mode === 'digits' ? /^[0-9]$/ : /^[A-Z]$/).test(label))) return ui.toast(t('toast.bad_label'), 'error');
  try { await savePad(pad.canvas, label); ui.toast(t('toast.saved')); pad.clear(); }
  catch (err) { console.error(err); ui.toast(t('toast.save_err'), 'error'); }
};

// ---------- theme, language, help ----------
$('theme-toggle').onclick = () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark'; root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) {}
};
function markLang() { document.querySelectorAll('#lang-group button').forEach(b => b.classList.toggle('is-on', b.dataset.lang === getLang())); }
document.querySelectorAll('#lang-group button').forEach(b => b.onclick = () => setLang(b.dataset.lang));
onLangChange(() => {
  markLang(); ui.setConn($('conn').dataset.state); ui.renderPrediction(state.last, backendName()); ui.renderHistory(state.history);
  chart.setUnit(t('unit.ms')); refreshStats();
});
const dlg = $('help');
$('help-open').onclick = () => dlg.showModal();
$('help-close').onclick = () => dlg.close();
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

document.addEventListener('keydown', e => {
  if (dlg.open || e.target.tagName === 'INPUT' && e.target.id === 'lbl') return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); pad.undo(); }
  else if (e.key === 'Escape' || e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) pad.clear();
});

// ---------- boot ----------
applyI18n(); markLang(); chart.setUnit(t('unit.ms'));
ui.renderPrediction(null, backendName()); ui.renderHistory([]); refreshStats();
loadInfo().then(() => {
  ui.setConn('on');
  fetch('/api/metrics').then(r => r.ok ? r.json() : null).then(m => { state.runtimeMetrics = m; }).catch(() => {});
}).catch(() => ui.setConn('off'));
