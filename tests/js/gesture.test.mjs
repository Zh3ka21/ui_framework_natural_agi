// node --test tests/js          (no browser, no camera: synthetic hand landmarks)
import test from 'node:test';
import assert from 'node:assert/strict';
import { GestureEngine, OneEuro, analyseHand, CFG } from '../../static/js/gesture.js';

const V = 1000, SIZE = 400;           // square "video" and canvas

/** 21 landmarks for a hand centred at (cx, cy) (normalised). pose: 'open' | 'pinch' | 'fist'; gap = thumb-index distance for 'pinch'. */
function hand(pose, cx = 0.5, cy = 0.5, gap = 0.01) {
  const lm = Array.from({ length: 21 }, () => ({ x: cx, y: cy }));
  lm[0] = { x: cx, y: cy + 0.2 };                                  // wrist; hand size = 0.2
  [[5, -0.08], [9, 0], [13, 0.08], [17, 0.16]].forEach(([mcp, dx], i) => {
    const x = cx + dx, curled = pose === 'fist';
    lm[mcp] = { x, y: cy };
    lm[mcp + 1] = { x, y: curled ? cy - 0.08 : cy - 0.1 };         // PIP
    lm[mcp + 2] = { x, y: curled ? cy + 0.05 : cy - 0.18 };        // DIP
    lm[mcp + 3] = { x, y: curled ? cy + 0.12 : cy - 0.25 };        // tip
  });
  const idx = lm[8];
  lm[4] = pose === 'pinch' ? { x: idx.x + gap, y: idx.y } : pose === 'fist' ? { x: cx - 0.02, y: cy + 0.1 } : { x: cx - 0.25, y: cy - 0.05 };
  return lm;
}
const run = (eng, lm, frames, t0 = 0, dt = 33) => { let r; for (let i = 0; i < frames; i++) r = eng.update(lm, t0 + i * dt, V, V); return r; };

test('analyseHand: pinch ratio and fist', () => {
  assert.ok(analyseHand(hand('pinch'), V, V).pinch < 0.1);
  assert.ok(analyseHand(hand('open'), V, V).pinch > 1);
  assert.equal(analyseHand(hand('fist'), V, V).fist, true);
  assert.equal(analyseHand(hand('open'), V, V).fist, false);
  assert.equal(analyseHand(hand('pinch'), V, V).fist, false);
});

test('pen goes down only after confirmFrames, and up again after confirmFrames', () => {
  const e = new GestureEngine(SIZE);
  assert.equal(run(e, hand('open'), 3).down, false);
  assert.equal(e.update(hand('pinch'), 100, V, V).down, false);      // 1st pinch frame: not yet
  assert.equal(e.update(hand('pinch'), 133, V, V).down, true);
  assert.equal(e.update(hand('open'), 166, V, V).down, true);        // 1st open frame: still down
  assert.equal(e.update(hand('open'), 199, V, V).down, false);
});

test('hysteresis: a half-closed hand neither starts nor ends a stroke', () => {
  const half = hand('pinch', 0.5, 0.5, 0.07);                        // ratio 0.35, between pinchOn (0.30) and pinchOff (0.45)
  const e = new GestureEngine(SIZE);
  assert.equal(run(e, half, 10).down, false);                        // from open: stays up
  const e2 = new GestureEngine(SIZE);
  run(e2, hand('pinch'), 3);
  assert.equal(run(e2, half, 10, 200).down, true);                   // from pinched: stays down
});

test('fist held for clearHoldMs clears once, then re-arms after release', () => {
  const e = new GestureEngine(SIZE);
  let fired = 0, maxProgress = 0;
  for (let t = 0; t <= 2500; t += 33) { const r = e.update(hand('fist'), t, V, V); fired += r.clear; maxProgress = Math.max(maxProgress, r.clearProgress); assert.equal(r.down, false); }
  assert.equal(fired, 1);
  assert.equal(maxProgress, 1);
  run(e, hand('open'), 3, 3000);
  for (let t = 4000; t <= 5500; t += 33) fired += e.update(hand('fist'), t, V, V).clear;
  assert.equal(fired, 2);
});

test('a short fist does not clear', () => {
  const e = new GestureEngine(SIZE);
  let fired = 0;
  for (let t = 0; t < CFG.clearHoldMs - 200; t += 33) fired += e.update(hand('fist'), t, V, V).clear;
  assert.equal(fired, 0);
});

test('lost hand: short dropout keeps the stroke, long dropout ends it', () => {
  const e = new GestureEngine(SIZE);
  run(e, hand('pinch'), 4);
  assert.equal(e.update(null, 200, V, V).down, true);                // 1st missing frame
  assert.equal(e.update(null, 200 + CFG.lostMs - 50, V, V).down, true);
  const r = e.update(null, 200 + CFG.lostMs + 100, V, V);
  assert.equal(r.down, false); assert.equal(r.ended, true); assert.equal(r.tracking, false);
});

test('mapping: centre -> canvas centre, image is mirrored, edges clamp', () => {
  // place the hand so that its index fingertip (where the pen is) sits at (x, y) of the frame
  const at = (x, y) => { const e = new GestureEngine(SIZE); return run(e, hand('pinch', x + 0.08, y + 0.25), 5); };
  const c = at(0.5, 0.5);
  assert.ok(Math.abs(c.x - SIZE / 2) < 6 && Math.abs(c.y - SIZE / 2) < 6);
  assert.ok(at(0.2, 0.5).x > at(0.8, 0.5).x);                        // hand on the left of the frame -> right side of canvas (mirror)
  const far = at(0.02, 0.5);
  assert.ok(far.x <= SIZE && far.x > SIZE * 0.95);
});

test('OneEuro smooths jitter but converges on a step', () => {
  const f = new OneEuro(CFG.minCutoff, CFG.beta);
  const raw = [], out = [];
  for (let i = 0; i < 60; i++) { const v = 100 + (i % 2 ? 4 : -4); raw.push(v); out.push(f.filter(v, i * 33)); }
  const spread = a => Math.max(...a.slice(20)) - Math.min(...a.slice(20));
  assert.ok(spread(out) < spread(raw) * 0.5);
  let y; for (let i = 60; i < 140; i++) y = f.filter(300, i * 33);
  assert.ok(Math.abs(y - 300) < 2);
});

test('opening the fingers freezes the pen, so the stroke has no hook at its end', () => {
  const e = new GestureEngine(SIZE);
  run(e, hand('pinch', 0.58, 0.75), 6);                              // pen down, fingertip at (0.5, 0.5)
  const before = e.update(hand('pinch', 0.58, 0.75), 300, V, V);
  // fingers start to open: thumb moves away from the index tip, so the midpoint drifts sideways
  const drift = e.update(hand('pinch', 0.58, 0.75, 0.09), 333, V, V);  // ratio 0.45
  assert.equal(drift.down, true);
  assert.equal(drift.x, before.x); assert.equal(drift.y, before.y);
  const up = e.update(hand('pinch', 0.58, 0.75, 0.12), 366, V, V);
  assert.equal(up.down, false); assert.equal(up.x, before.x);
});
