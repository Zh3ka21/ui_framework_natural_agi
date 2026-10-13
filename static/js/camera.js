// Hand-tracking input: camera -> landmarks -> GestureEngine -> pad strokes, plus the small preview and pen cursor.
import { GestureEngine, HandTracker } from './gesture.js';
import { t } from './i18n.js';

const LINES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

export function createCameraInput({ pad, video, overlay, row, pen, status }) {
  const engine = new GestureEngine(pad.canvas.width), tracker = new HandTracker();
  const octx = overlay.getContext('2d');
  let on = false, wasDown = false, shownStatus = '';

  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#8b7bff';

  function setStatus(key, extra = '') {
    const text = t(key) + extra;
    if (text !== shownStatus) { status.textContent = text; shownStatus = text; }
    status.dataset.state = key;
  }

  function drawOverlay(lm, r, vw, vh, zone) {
    if (overlay.width !== vw) { overlay.width = vw; overlay.height = vh; }
    octx.clearRect(0, 0, vw, vh);
    const S = zone * vh;
    octx.setLineDash([8, 6]); octx.lineWidth = 2; octx.strokeStyle = 'rgba(255,255,255,.55)';
    octx.strokeRect((vw - S) / 2, (vh - S) / 2, S, S); octx.setLineDash([]);       // the part of the camera image that maps onto the canvas
    if (!lm) return;
    const accent = r.down ? css('--accent-2') : css('--accent');
    octx.strokeStyle = 'rgba(255,255,255,.7)'; octx.lineWidth = 2; octx.beginPath();
    for (const [a, b] of LINES) { octx.moveTo(lm[a].x * vw, lm[a].y * vh); octx.lineTo(lm[b].x * vw, lm[b].y * vh); }
    octx.stroke();
    octx.fillStyle = accent;
    for (const p of lm) { octx.beginPath(); octx.arc(p.x * vw, p.y * vh, 3.5, 0, 7); octx.fill(); }
    const mx = (lm[4].x + lm[8].x) / 2 * vw, my = (lm[4].y + lm[8].y) / 2 * vh;
    octx.beginPath(); octx.arc(mx, my, 9, 0, 7); octx.lineWidth = 3; octx.strokeStyle = accent; octx.stroke();
  }

  function onFrame(lm, ts, vw, vh) {
    const r = engine.update(lm, ts, vw, vh);
    drawOverlay(lm, r, vw, vh, engine.cfg.zone);

    // pen cursor on the canvas
    pen.hidden = !r.tracking || r.x === null;
    if (!pen.hidden) {
      pen.style.left = (r.x / pad.canvas.width * 100) + '%'; pen.style.top = (r.y / pad.canvas.height * 100) + '%';
      pen.classList.toggle('down', r.down);
      pen.classList.toggle('clearing', r.clearProgress > 0);
      pen.style.setProperty('--p', r.clearProgress.toFixed(2));
    }

    // strokes
    if (r.down && !wasDown) { if (!pad.stroke.begin(r.x, r.y, ts)) return; }
    else if (r.down && r.tracking) pad.stroke.move(r.x, r.y, ts);
    else if (!r.down && wasDown) pad.stroke.end(ts);
    wasDown = r.down;
    if (r.clear) pad.clear();

    if (!r.tracking) setStatus('cam.nohand');
    else if (r.down) setStatus('cam.down');
    else if (r.clearProgress > 0) setStatus('cam.clearing');
    else setStatus('cam.up');
    status.title = r.pinch === null ? '' : `pinch ${r.pinch.toFixed(2)}`;      // handy while tuning thresholds
  }

  return {
    get on() { return on; },
    /** Throws an Error with .code = insecure | denied | nocamera | load when the camera or the model cannot start. */
    async start() {
      row.hidden = false; setStatus('cam.loading');
      try { await tracker.start(video, onFrame); }
      catch (e) { row.hidden = true; throw e; }
      on = true; setStatus('cam.nohand');
    },
    stop() {
      tracker.stop(); pad.stroke.end(performance.now()); engine.reset(); wasDown = false;
      on = false; row.hidden = true; pen.hidden = true; octx.clearRect(0, 0, overlay.width, overlay.height);
    },
  };
}
