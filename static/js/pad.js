// Drawing surface: white strokes on a transparent canvas (alpha = ink), undo stack, clear.
// Strokes can come from the pointer (mouse / touch / stylus) or from code (hand tracking) through `stroke`.
export function createPad(canvas, { onActivity, onClear }) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff';
  let width = 24, drawing = false, source = null, activePointerId = null, last = null, undoStack = [];
  canvas.style.touchAction = 'none';

  const pos = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height]; };

  // ---- stroke primitives, shared by every input source ----
  function begin(p, ts, src) {
    if (drawing) return false;
    drawing = true; source = src; last = p;
    undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); if (undoStack.length > 30) undoStack.shift();
    ctx.beginPath(); ctx.arc(p[0], p[1], width / 2, 0, Math.PI * 2); ctx.fill();
    onActivity(ts, false);
    return true;
  }
  function extend(points, ts) {
    for (const p of points) { ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(...p); ctx.stroke(); last = p; }
    onActivity(ts, false);
  }
  function finish(ts) {
    if (!drawing) return;
    drawing = false; source = null; activePointerId = null; last = null;
    onActivity(ts, true);
  }
  const abort = () => { drawing = false; source = null; activePointerId = null; last = null; };

  // ---- pointer input ----
  canvas.addEventListener('pointerdown', e => {
    if (drawing || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    if (!begin(pos(e), e.timeStamp, 'pointer')) return;
    activePointerId = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  });
  canvas.addEventListener('pointermove', e => {
    if (!drawing || source !== 'pointer' || e.pointerId !== activePointerId) return;
    e.preventDefault();
    // Use coalesced touch/stylus samples when the browser provides them for smoother strokes.
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    extend((events.length ? events : [e]).map(pos), e.timeStamp);
  }, { passive: false });
  canvas.addEventListener('pointerup', e => {
    if (!drawing || source !== 'pointer' || e.pointerId !== activePointerId) return;
    e.preventDefault(); finish(e.timeStamp);
  });
  canvas.addEventListener('pointercancel', e => { if (source === 'pointer' && e.pointerId === activePointerId) abort(); });
  canvas.addEventListener('lostpointercapture', e => { if (source === 'pointer' && e.pointerId === activePointerId) abort(); });

  return {
    canvas,
    setWidth(w) { width = w; },
    undo() { const s = undoStack.pop(); if (!s) return; ctx.putImageData(s, 0, 0); onActivity(performance.now(), false); },
    clear() { abort(); ctx.clearRect(0, 0, canvas.width, canvas.height); undoStack = []; onClear(); },
    /** Programmatic strokes (hand tracking). Coordinates are canvas pixels. begin() returns false while a pointer stroke is active. */
    stroke: {
      begin: (x, y, ts) => begin([x, y], ts, 'code'),
      move: (x, y, ts) => { if (drawing && source === 'code') extend([[x, y]], ts); },
      end: ts => { if (source === 'code') finish(ts); },
      get active() { return drawing && source === 'code'; },
    },
  };
}
