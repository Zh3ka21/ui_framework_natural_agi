// Browser port of preprocess.py (used only by the in-browser backend; the server uses preprocess.py).
// Same steps: ink bounding box -> square with 12% margin -> 28x28 -> light blur -> normalise to max 1.
// Differences: canvas resizing instead of Lanczos, so the 28x28 can differ by a few grey levels.
const MARGIN = 0.12, THRESH = 20;
const small = document.createElement('canvas'); small.width = small.height = 28;
const sctx = small.getContext('2d', { willReadFrequently: true });

export function canvasTo28(pad) {
  const W = pad.width, H = pad.height, d = pad.getContext('2d').getImageData(0, 0, W, H).data;
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[4 * (y * W + x) + 3] > THRESH) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, side = Math.floor(Math.max(w, h) * (1 + 2 * MARGIN)) + 1, k = 28 / side;
  sctx.clearRect(0, 0, 28, 28); sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = 'high';
  sctx.filter = 'blur(0.4px)';
  sctx.drawImage(pad, x0, y0, w, h, ((side - w) / 2) * k, ((side - h) / 2) * k, w * k, h * k);
  sctx.filter = 'none';
  const px = sctx.getImageData(0, 0, 28, 28).data, arr = new Float32Array(784);
  let mx = 0;
  for (let i = 0; i < 784; i++) { arr[i] = px[4 * i + 3] / 255; if (arr[i] > mx) mx = arr[i]; }
  if (mx > 0) for (let i = 0; i < 784; i++) arr[i] /= mx;
  return arr;
}
