// Hand gestures -> pen events.
//
//   pinch (thumb tip meets index tip)  -> pen down, the pen follows the midpoint of the two fingertips
//   open the fingers                   -> pen up
//   closed fist held ~1.2 s            -> clear the canvas
//
// GestureEngine is pure logic (landmarks in, pen state out) so it can be unit-tested without a camera.
// HandTracker wraps MediaPipe Hand Landmarker, which runs fully in the browser; no frames leave the machine.

export const CFG = {
  pinchOn: 0.30,        // pinch ratio below this starts a stroke   (ratio = thumb-index distance / hand size)
  pinchOff: 0.45,       // ...and above this ends it (hysteresis: no flicker around the threshold)
  freeze: 1.2,          // while pinched, the pen stops following once the ratio exceeds pinchOn * freeze (fingers opening)
  confirmFrames: 2,     // frames a pinch change must persist before it counts
  lostMs: 250,          // hand missing this long -> stroke ends
  clearHoldMs: 1200,    // fist hold time for "clear"
  curl: 0.95,           // fingertip is "curled" when its distance to the wrist < curl * (PIP joint distance to wrist)
  zone: 0.8,            // the square of the camera frame (fraction of its height) that maps onto the whole canvas
  minCutoff: 1.2,       // One Euro filter: lower = smoother when slow
  beta: 0.04,           // ...higher = less lag when fast
};

// Landmark indices (MediaPipe hand model)
const WRIST = 0, THUMB_TIP = 4, INDEX_TIP = 8, MIDDLE_MCP = 9;
const FINGERS = [[8, 6], [12, 10], [16, 14], [20, 18]];    // [tip, pip] for index, middle, ring, pinky

/** One Euro filter: smooths jitter when the hand is slow, follows quickly when it moves. */
export class OneEuro {
  constructor(minCutoff, beta, dCutoff = 1) { Object.assign(this, { minCutoff, beta, dCutoff }); this.reset(); }
  reset() { this.x = null; this.dx = 0; this.t = null; }
  static alpha(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filter(v, tMs) {
    if (this.x === null) { this.x = v; this.t = tMs; return v; }
    const dt = Math.max((tMs - this.t) / 1000, 1e-3); this.t = tMs;
    const d = (v - this.x) / dt;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * (d - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (v - this.x);
    return this.x;
  }
}

/** Measurements from one set of 21 normalised landmarks. vw/vh = video size (so distances are in pixels, not skewed by aspect ratio). */
export function analyseHand(lm, vw, vh, cfg = CFG) {
  const d = (a, b) => Math.hypot((lm[a].x - lm[b].x) * vw, (lm[a].y - lm[b].y) * vh);
  const size = d(WRIST, MIDDLE_MCP) || 1;
  const pinch = d(THUMB_TIP, INDEX_TIP) / size;
  const fist = FINGERS.every(([tip, pip]) => d(tip, WRIST) < cfg.curl * d(pip, WRIST));
  const px = (lm[THUMB_TIP].x + lm[INDEX_TIP].x) / 2 * vw, py = (lm[THUMB_TIP].y + lm[INDEX_TIP].y) / 2 * vh;
  return { pinch, fist, px, py };
}

export class GestureEngine {
  /** canvasSize = canvas width in pixels (square). */
  constructor(canvasSize, cfg = CFG) {
    this.size = canvasSize; this.cfg = cfg;
    this.fx = new OneEuro(cfg.minCutoff, cfg.beta); this.fy = new OneEuro(cfg.minCutoff, cfg.beta);
    this.reset();
  }
  reset() {
    this.fx.reset(); this.fy.reset();
    this.down = false; this.streak = 0; this.lostSince = null; this.x = null; this.y = null;
    this.fistSince = null; this.clearFired = false;
  }

  /**
   * lm: array of 21 {x,y} (normalised) or null when no hand is visible. ts in ms (monotonic). vw/vh: video size.
   * Returns { tracking, x, y, down, pinch, fist, clearProgress, clear }; x/y in canvas pixels (null before the first hand).
   */
  update(lm, ts, vw, vh) {
    const c = this.cfg;
    if (!lm) {
      if (this.lostSince === null) this.lostSince = ts;
      if (ts - this.lostSince > c.lostMs) { const wasDown = this.down; this.reset(); this.lostSince = ts; return this.out(false, 0, false, wasDown); }
      return this.out(false, 0, false);            // short dropout: keep the stroke alive
    }
    this.lostSince = null;
    const h = analyseHand(lm, vw, vh, c);

    // map the fingertip midpoint (mirrored, like a mirror) from the camera's central square onto the canvas
    const S = c.zone * vh, left = (vw - S) / 2, top = (vh - S) / 2;
    const u = Math.min(1, Math.max(0, 1 - (h.px - left) / S)), v = Math.min(1, Math.max(0, (h.py - top) / S));
    // While the fingers open to lift the pen, the thumb/index midpoint drifts: freeze the pen so the stroke does not hook at its end
    const opening = this.down && h.pinch > c.pinchOn * c.freeze;
    if (!opening || this.x === null) { this.x = this.fx.filter(u * this.size, ts); this.y = this.fy.filter(v * this.size, ts); }

    // pen: pinch with hysteresis and a short confirmation streak; a fist always lifts the pen
    const want = h.fist ? false : this.down ? h.pinch < c.pinchOff : h.pinch < c.pinchOn;
    if (want === this.down) this.streak = 0;
    else if (++this.streak >= c.confirmFrames) { this.down = want; this.streak = 0; }

    // clear: fist held, pen up
    let clear = false, progress = 0;
    if (h.fist && !this.down) {
      if (this.fistSince === null) this.fistSince = ts;
      progress = Math.min(1, (ts - this.fistSince) / c.clearHoldMs);
      if (progress >= 1 && !this.clearFired) { clear = true; this.clearFired = true; }
    } else { this.fistSince = null; this.clearFired = false; }

    return this.out(true, progress, clear, false, h);
  }

  out(tracking, clearProgress, clear, ended = false, h = null) {
    return { tracking, x: this.x, y: this.y, down: this.down, ended, pinch: h ? h.pinch : null, fist: h ? h.fist : false, clearProgress, clear };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// MediaPipe wrapper (browser only). Pinned versions; the first start downloads ~10 MB (runtime + hand model) and
// the browser caches it afterwards.
const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let attempts = 0;      // a failed module import is cached by the browser for the page's lifetime, so retries use a fresh URL

export class HandTracker {
  constructor() { this.landmarker = null; this.stream = null; this.video = null; this.raf = 0; this.lastVideoTime = -1; this.lastTs = 0; }

  /** Loads the model and opens the camera. Throws Error with .code = 'insecure' | 'denied' | 'nocamera' | 'load'. */
  async start(video, onFrame) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('insecure context'), { code: 'insecure' });
    try {
      const vision = await import(`${VISION}/vision_bundle.mjs${attempts++ ? `?retry=${attempts}` : ''}`);
      const files = await vision.FilesetResolver.forVisionTasks(`${VISION}/wasm`);
      const make = delegate => vision.HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numHands: 1 });
      this.landmarker = await make('GPU').catch(() => make('CPU'));
    } catch (e) { throw Object.assign(e, { code: 'load' }); }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
    } catch (e) { this.stop(); throw Object.assign(e, { code: e.name === 'NotFoundError' || e.name === 'OverconstrainedError' ? 'nocamera' : 'denied' }); }
    this.video = video; video.srcObject = this.stream; await video.play();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      if (video.readyState < 2 || video.currentTime === this.lastVideoTime) return;     // no new camera frame yet
      this.lastVideoTime = video.currentTime;
      const ts = Math.max(performance.now(), this.lastTs + 1); this.lastTs = ts;         // MediaPipe needs strictly increasing timestamps
      const res = this.landmarker.detectForVideo(video, ts);
      onFrame(res.landmarks && res.landmarks[0] ? res.landmarks[0] : null, ts, video.videoWidth, video.videoHeight);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf); this.raf = 0;
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());       // turns the camera light off
    if (this.video) this.video.srcObject = null;
    if (this.landmarker) this.landmarker.close();
    this.stream = this.video = this.landmarker = null; this.lastVideoTime = -1;
  }
}
