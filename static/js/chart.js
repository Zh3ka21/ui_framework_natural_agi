// Dependency-free SVG line/area chart for the latency series, with crosshair tooltip.
const WINDOW = 60;                     // samples kept per series
const NS = 'http://www.w3.org/2000/svg';
const PAD = { l: 38, r: 8, t: 10, b: 8 };

const niceMax = v => { const p = 10 ** Math.floor(Math.log10(v || 1)); for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p; return 10 * p; };

function smooth(pts) {                 // Catmull-Rom -> cubic Bezier
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += `C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export class LatencyChart {
  /** series: [{ key, color: 'var(--accent)', label }] */
  constructor(el, series, unit = 'ms') {
    this.el = el; this.series = series; this.unit = unit; this.data = {};
    this.svg = document.createElementNS(NS, 'svg'); el.prepend(this.svg);
    this.tip = document.createElement('div'); this.tip.className = 'chart-tip'; this.tip.hidden = true; el.appendChild(this.tip);
    new ResizeObserver(() => this.render()).observe(el);
    el.addEventListener('pointermove', e => this.hover(e));
    el.addEventListener('pointerleave', () => { this.tip.hidden = true; this.render(); });
  }
  setUnit(u) { this.unit = u; }
  setData(data) { this.data = data; this.render(); }

  geometry() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    const vals = this.series.flatMap(s => (this.data[s.key] || []).slice(-WINDOW));
    const ymax = niceMax(Math.max(0, ...vals) * 1.1);
    return { w, h, ymax, iw: w - PAD.l - PAD.r, ih: h - PAD.t - PAD.b };
  }
  xy(g, i, v) { return [PAD.l + i * (g.iw / (WINDOW - 1)), PAD.t + g.ih * (1 - v / g.ymax)]; }

  render(hoverIdx = null) {
    const g = this.geometry(); if (!g.w) return;
    const { w, h, ymax, ih } = g;
    let s = `<defs>${this.series.map(se => `<linearGradient id="g-${se.key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${se.color};stop-opacity:.28"/><stop offset="1" style="stop-color:${se.color};stop-opacity:0"/></linearGradient>`).join('')}</defs>`;
    for (let i = 0; i <= 4; i++) {
      const y = PAD.t + ih * (i / 4), v = ymax * (1 - i / 4);
      s += `<line class="grid-line" x1="${PAD.l}" x2="${w - PAD.r}" y1="${y}" y2="${y}"/><text class="tick" x="${PAD.l - 8}" y="${y + 4}" text-anchor="end">${+v.toFixed(1)}</text>`;
    }
    for (const se of this.series) {
      const vals = (this.data[se.key] || []).slice(-WINDOW);
      const pts = vals.map((v, i) => this.xy(g, i, v));
      if (pts.length > 1) {
        const line = smooth(pts);
        s += `<path d="${line}L${pts.at(-1)[0]},${PAD.t + ih}L${pts[0][0]},${PAD.t + ih}Z" style="fill:url(#g-${se.key})"/>`;
        s += `<path d="${line}" style="fill:none;stroke:${se.color};stroke-width:2;stroke-linecap:round"/>`;
      } else if (pts.length === 1) s += `<circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="4" style="fill:${se.color}"/>`;
    }
    if (hoverIdx !== null) {
      const x = PAD.l + hoverIdx * (g.iw / (WINDOW - 1));
      s += `<line x1="${x}" x2="${x}" y1="${PAD.t}" y2="${PAD.t + ih}" style="stroke:var(--muted);stroke-dasharray:3 3"/>`;
      for (const se of this.series) {
        const vals = (this.data[se.key] || []).slice(-WINDOW);
        if (hoverIdx < vals.length) { const [cx, cy] = this.xy(g, hoverIdx, vals[hoverIdx]); s += `<circle cx="${cx}" cy="${cy}" r="5" style="fill:${se.color};stroke:var(--surface);stroke-width:2"/>`; }
      }
    }
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`); this.svg.innerHTML = s;
  }

  hover(e) {
    const g = this.geometry(); if (!g.w) return;
    const r = this.el.getBoundingClientRect(), x = e.clientX - r.left;
    const n = Math.max(0, ...this.series.map(se => Math.min((this.data[se.key] || []).length, WINDOW)));
    if (!n) return;
    const idx = Math.min(n - 1, Math.max(0, Math.round((x - PAD.l) / (g.iw / (WINDOW - 1)))));
    const rows = this.series.map(se => { const v = (this.data[se.key] || []).slice(-WINDOW)[idx]; return v === undefined ? '' : `<div><i style="background:${se.color}"></i>${se.label}: ${v.toFixed(1)} ${this.unit}</div>`; }).join('');
    if (!rows) { this.tip.hidden = true; return; }
    this.tip.innerHTML = rows; this.tip.hidden = false;
    const tw = this.tip.offsetWidth, px = PAD.l + idx * (g.iw / (WINDOW - 1));
    this.tip.style.transform = `translate(${Math.min(Math.max(px + 14, 0), g.w - tw)}px, 4px)`;
    this.render(idx);
  }
}
