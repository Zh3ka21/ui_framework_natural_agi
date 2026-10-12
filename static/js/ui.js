// DOM rendering helpers. No state lives here; main.js owns it.
import { t } from './i18n.js';

const $ = id => document.getElementById(id);
const previewCtx = $('preview').getContext('2d');
const kind = l => (/\d/.test(l) ? t('kind.digit') : t('kind.letter'));
const fmt = v => (v == null ? '—' : v.toFixed(1));
const ms = v => (v == null ? '—' : `${fmt(v)}<small>${t('unit.ms')}</small>`);

export function renderPrediction(r, backendName) {
  $('pred-backend').textContent = backendName;
  if (!r) {
    $('glyph-char').textContent = '—'; $('glyph-conf').textContent = '';
    $('bars').hidden = true; $('pred-empty').hidden = false; previewCtx.clearRect(0, 0, 28, 28);
    return;
  }
  $('glyph-char').textContent = r.label;
  $('glyph-conf').textContent = `${(r.candidates[0].prob * 100).toFixed(1)}%`;
  $('pred-empty').hidden = true; $('bars').hidden = false;
  $('bars').innerHTML = r.candidates.map(c =>
    `<div class="bar"><b>${c.label}</b><div class="track"><div class="fill" style="width:${(c.prob * 100).toFixed(1)}%"></div></div><span>${(c.prob * 100).toFixed(1)}%</span></div>`).join('');
  const img = previewCtx.createImageData(28, 28);
  r.preview.forEach((row, y) => row.forEach((v, x) => { const i = 4 * (y * 28 + x); img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }));
  previewCtx.putImageData(img, 0, 0);
}

export function renderKpis({ inference, p50, p95, count }) {
  $('k-inf').innerHTML = ms(inference); $('k-p50').innerHTML = ms(p50); $('k-p95').innerHTML = ms(p95); $('k-cnt').textContent = count;
}

export function renderLegend(items) {   // [{label,color,p50,p95}]
  $('legend').innerHTML = items.map(i =>
    `<span class="legend-item"><i style="background:${i.color}"></i>${i.label}${i.p50 == null ? '' : ` p50 <b>${fmt(i.p50)}</b> · p95 <b>${fmt(i.p95)}</b> ${t('unit.ms')}`}</span>`).join('');
}

export function renderHistory(items) {
  $('history-empty').hidden = items.length > 0;
  $('history').innerHTML = items.map(h =>
    `<li><span class="h-glyph">${h.label}</span><span class="h-main"><b>${kind(h.label)}</b><small>${t(h.backend === 'server' ? 'backend.server' : 'backend.browser')} · ${h.time}</small></span><span class="h-conf">${(h.prob * 100).toFixed(0)}%</span></li>`).join('');
}

let toastTimer;
export function toast(msg, kindName = 'ok') {
  const el = $('toast'); el.textContent = msg; el.dataset.kind = kindName; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

export function setConn(state) {
  $('conn').dataset.state = state;
  $('conn-text').textContent = t(state === 'on' ? 'conn.on' : state === 'off' ? 'conn.off' : 'conn.unknown');
}
