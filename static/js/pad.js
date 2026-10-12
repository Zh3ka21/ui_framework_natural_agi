// Drawing surface: white strokes on a transparent canvas (alpha = ink), undo stack, clear.
export function createPad(canvas, { onActivity, onClear }) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff';
  let width = 24, drawing = false, activePointerId = null, last = null, undoStack = [];
  canvas.style.touchAction = 'none';

  const pos = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height]; };

  canvas.addEventListener('pointerdown', e => {
    if (drawing || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    drawing = true; activePointerId = e.pointerId; last = pos(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); if (undoStack.length > 30) undoStack.shift();
    ctx.beginPath(); ctx.arc(last[0], last[1], width / 2, 0, Math.PI * 2); ctx.fill();
    onActivity(e.timeStamp, false);
  });
  canvas.addEventListener('pointermove', e => {
    if (!drawing || e.pointerId !== activePointerId) return;
    e.preventDefault();
    // Use coalesced touch/stylus samples when the browser provides them for smoother strokes.
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    for (const sample of (events.length ? events : [e])) {
      const p = pos(sample); ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(...p); ctx.stroke(); last = p;
    }
    onActivity(e.timeStamp, false);
  }, { passive: false });
  const end = e => {
    if (!drawing || e.pointerId !== activePointerId) return;
    e.preventDefault(); drawing = false; activePointerId = null; last = null;
    onActivity(e.timeStamp, true);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', e => {
    if (e.pointerId === activePointerId) { drawing = false; activePointerId = null; last = null; }
  });
  canvas.addEventListener('lostpointercapture', e => {
    if (e.pointerId === activePointerId) { drawing = false; activePointerId = null; last = null; }
  });

  return {
    canvas,
    setWidth(w) { width = w; },
    undo() { const s = undoStack.pop(); if (!s) return; ctx.putImageData(s, 0, 0); onActivity(performance.now(), false); },
    clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); undoStack = []; onClear(); },
  };
}
